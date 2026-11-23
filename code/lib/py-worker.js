// ═══════════════════════════════════════════════════════════
// 파이썬 워커 — Pyodide (CPython 3, WebAssembly)
// ═══════════════════════════════════════════════════════════
// 화면이 멈추지 않게 파이썬은 이 워커에서 돈다. 화면(lib/py-runner.js)과는
// 메시지로만 이야기한다.
//
//   화면 → 워커  {type:'init', token, canSyncInput}
//                {type:'run', id, code, models}       models: 보관함의 내 AI 이름들
//                {type:'event', kind, key, x, y}      turtle 키보드·마우스
//   워커 → 화면  {type:'ready', version} · {type:'status', text}
//                {type:'out', text, cls} · {type:'image', src} · {type:'turtle', cmds}
//                {type:'input', id} · {type:'sensor-need', what}
//                {type:'waiting'}                     코드는 끝났고 이벤트를 기다림
//                {type:'done', id, ok, error, elapsed}
//
// 정지는 화면이 이 워커를 통째로 끝내고 새로 띄운다 (Pyodide 를 중간에 멈출
// SharedArrayBuffer 는 GitHub Pages 에서 못 쓴다).
//
// 워커가 파이썬을 돌리는 동안에는 메시지를 못 받는다. 그래서 "지금 값"이 필요한 것은
// 동기 XHR 로 서비스 워커(sw.js)에 묻는다:
//   input()  → __codelab__/input   (화면이 답을 줄 때까지 붙잡아 둔다)
//   센서 값  → __codelab__/sensor  (화면이 계속 올려 두는 최신 값을 바로 준다)

import { loadPyodide } from '../vendor/pyodide/pyodide.mjs';

const CDN = 'https://cdn.jsdelivr.net/pyodide/v314.0.8/full/';   // numpy 같은 추가 패키지
const FLUSH_MS = 40;
const FONT_URL = new URL('../../shared/assets/fonts/Pretendard-Regular.otf', import.meta.url);
const FONT_PATH = '/home/pyodide/Pretendard-Regular.otf';

let py = null;
let token = '';
let canSyncInput = false;
let inputSeq = 0;
let fontReady = false;
let modelNames = [];

// ── 출력 묶어 보내기 ──
// 파이썬이 돌고 있는 동안 워커는 타이머를 못 돌린다 → 쓸 때마다 시간을 보고 보낸다.
let outBuf = '';
let turtleBuf = [];
let lastFlush = 0;

function flush() {
  if (outBuf) { postMessage({ type: 'out', text: outBuf }); outBuf = ''; }
  if (turtleBuf.length) { postMessage({ type: 'turtle', cmds: turtleBuf }); turtleBuf = []; }
  lastFlush = performance.now();
}

function maybeFlush() {
  if (performance.now() - lastFlush > FLUSH_MS || outBuf.length > 16384 || turtleBuf.length > 2000) flush();
}

const decoder = new TextDecoder();

function syncGet(path) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', `../__codelab__/${path}`, false);
  xhr.send(null);
  return xhr;
}

function syncInput() {
  flush();
  if (!canSyncInput) {
    postMessage({ type: 'out', cls: 'err', text: '\n[입력 칸을 준비하지 못했어요. 페이지를 새로고침한 뒤 다시 실행해 주세요]\n' });
    return '';
  }
  const id = `${token}-${++inputSeq}`;
  postMessage({ type: 'input', id });
  // 서비스 워커는 오래 기다리면 204 로 끊는다 → 같은 id 로 다시 묻는다
  for (;;) {
    let xhr;
    try { xhr = syncGet(`input?id=${encodeURIComponent(id)}`); } catch (e) { continue; }
    if (xhr.status === 200) return xhr.responseText;
    if (xhr.status === 204 || xhr.status === 0) continue;
    return '';
  }
}

// ── 이벤트 대기 (turtle onkey · onclick · ontimer) ──
let session = null;          // { id, t0 } — 실행 중이거나 이벤트를 기다리는 프로그램
const timers = new Map();    // 파이썬 타이머 번호 → setTimeout 핸들

function endSession(res) {
  flush();
  for (const h of timers.values()) clearTimeout(h);
  timers.clear();
  const s = session;
  session = null;
  if (!s) return;
  const elapsed = (performance.now() - s.t0) / 1000;
  postMessage({ type: 'done', id: s.id, ok: !res, error: res || null, elapsed });
}

function toJs(p) {
  if (p === undefined || p === null) return null;
  const v = p.toJs ? p.toJs({ dict_converter: Object.fromEntries }) : p;
  if (p.destroy) p.destroy();
  return v;
}

function afterPython(err) {
  if (err) { endSession(err); return; }
  if (py.globals.get('_codelab_alive')()) { flush(); postMessage({ type: 'waiting' }); }
  else endSession(null);
}

function dispatch(kind, key, x, y) {
  if (!session) return;
  let err;
  try { err = toJs(py.globals.get('_codelab_event')(kind, key, x, y)); }
  catch (e) { err = { type: 'Error', msg: String(e), text: String(e) }; }
  afterPython(err);
}

async function init() {
  postMessage({ type: 'status', text: '파이썬을 불러오는 중…' });
  py = await loadPyodide({
    indexURL: new URL('../vendor/pyodide/', import.meta.url).href,
    packageBaseUrl: CDN,
  });
  py.setStdout({
    write(buf) { outBuf += decoder.decode(buf, { stream: true }); maybeFlush(); return buf.length; },
  });
  py.setStderr({
    write(buf) { outBuf += decoder.decode(buf, { stream: true }); maybeFlush(); return buf.length; },
  });
  py.setStdin({ stdin: () => syncInput() + '\n' });
  py.registerJsModule('_codelab', {
    turtle(json) { turtleBuf.push(JSON.parse(json)); maybeFlush(); },
    timer(id, ms) {
      timers.set(id, setTimeout(() => { timers.delete(id); dispatch('timer', String(id), 0, 0); }, Math.max(0, ms)));
    },
    image(b64) { flush(); postMessage({ type: 'image', src: 'data:image/png;base64,' + b64 }); },
    sensor_need(what) { flush(); postMessage({ type: 'sensor-need', what }); },
    say(text) { flush(); postMessage({ type: 'say', text: String(text).slice(0, 200) }); },
    sensor_read() {
      if (!canSyncInput) return '';
      try { const x = syncGet('sensor'); return x.status === 200 ? x.responseText : ''; }
      catch (e) { return ''; }
    },
    can_sync() { return canSyncInput; },
    model_list() { return JSON.stringify(modelNames); },
  });

  // 우리 모듈(turtle · sensor)은 실행마다 새로 만든다 — 앞 실행의 상태가 남지 않게
  const src = async (f) => (await fetch(new URL(f, import.meta.url))).text();
  py.globals.set('_CODELAB_SRC', py.toPy({
    turtle: await src('./turtle.py'),
    sensor: await src('./sensor.py'),
  }));
  await py.runPythonAsync(RUNNER_PY);
  postMessage({ type: 'ready', version: py.runPython('import sys; sys.version.split()[0]') });
}

const RUNNER_PY = `
import sys, os, types, traceback, builtins, time, io, base64

FILENAME = 'main.py'
os.environ['MPLBACKEND'] = 'module://codelab_mpl'

def _fresh(name):
    mod = types.ModuleType(name)
    mod.__file__ = name + '.py'
    exec(compile(_CODELAB_SRC[name], name + '.py', 'exec'), mod.__dict__)
    sys.modules[name] = mod

def _error(e):
    te = traceback.TracebackException.from_exception(e)
    te.stack = traceback.StackSummary.from_list(
        [f for f in te.stack if f.filename == FILENAME])
    lineno = te.stack[-1].lineno if te.stack else getattr(e, 'lineno', None)
    return {
        'type': type(e).__name__,
        'msg': str(e),
        'lineno': lineno,
        'text': ''.join(te.format()),
    }

# ── matplotlib: show() 하면 그림을 PNG 로 만들어 결과 탭에 보낸다 ──
def _mpl_show(*args, **kwargs):
    from matplotlib._pylab_helpers import Gcf
    import _codelab
    import warnings
    for m in Gcf.get_all_fig_managers():
        buf = io.BytesIO()
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')   # 라이브러리 안쪽 경고가 학생 화면에 섞이지 않게
            m.canvas.figure.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        _codelab.image(base64.b64encode(buf.getvalue()).decode('ascii'))
    Gcf.destroy_all()

def _make_mpl_backend():
    from matplotlib.backends.backend_agg import FigureCanvasAgg
    from matplotlib.backend_bases import FigureManagerBase
    mod = types.ModuleType('codelab_mpl')
    mod.FigureCanvas = FigureCanvasAgg
    mod.FigureManager = FigureManagerBase
    mod.show = _mpl_show
    sys.modules['codelab_mpl'] = mod

def _setup_mpl():
    import matplotlib
    _make_mpl_backend()
    from matplotlib import font_manager
    if os.path.exists(${JSON.stringify(FONT_PATH)}):
        font_manager.fontManager.addfont(${JSON.stringify(FONT_PATH)})
        matplotlib.rcParams['font.family'] = ['Pretendard', 'DejaVu Sans']
    matplotlib.rcParams['axes.unicode_minus'] = False

def _flush_figures():
    if 'matplotlib.pyplot' in sys.modules:
        _mpl_show()

def _codelab_run(src):
    _fresh('turtle')
    _fresh('sensor')
    if 'matplotlib' in src:
        _setup_mpl()
    g = {'__name__': '__main__', '__builtins__': builtins, '__file__': FILENAME}
    try:
        exec(compile(src, FILENAME, 'exec'), g)
        _flush_figures()
        return None
    except SystemExit:
        return None
    except BaseException as e:
        return _error(e)

def _codelab_alive():
    t = sys.modules.get('turtle')
    return bool(t and t._alive())

def _codelab_event(kind, key, x, y):
    try:
        sys.modules['turtle']._dispatch(kind, key, x, y)
        _flush_figures()
        return None
    except SystemExit:
        sys.modules['turtle']._stop_events()
        return None
    except BaseException as e:
        return _error(e)
`;

async function run(id, code) {
  inputSeq = 0;
  try {
    await py.loadPackagesFromImports(code, {
      messageCallback: (m) => postMessage({ type: 'status', text: m }),
      errorCallback: (m) => postMessage({ type: 'status', text: m }),
    });
  } catch (e) {
    // 없는 패키지는 import 할 때 파이썬 오류로 알려 준다
  }
  // 그래프에 한글이 깨지지 않게, matplotlib 을 쓸 때만 글꼴을 받아 둔다
  if (!fontReady && /matplotlib/.test(code)) {
    try {
      const buf = new Uint8Array(await (await fetch(FONT_URL)).arrayBuffer());
      py.FS.writeFile(FONT_PATH, buf);
      fontReady = true;
    } catch (e) { /* 글꼴이 없으면 영어 글꼴로 그린다 */ }
  }
  postMessage({ type: 'status', text: '' });
  lastFlush = performance.now();
  session = { id, t0: performance.now() };
  let err;
  try { err = toJs(py.globals.get('_codelab_run')(code)); }
  catch (e) { err = { type: 'Error', msg: String(e), text: String(e) }; }
  afterPython(err);
}

let ready = null;
onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'init') {
    token = m.token;
    canSyncInput = !!m.canSyncInput;
    ready = init().catch((err) => {
      postMessage({ type: 'fatal', text: String(err && err.message || err) });
    });
  } else if (m.type === 'run') {
    modelNames = m.models || [];
    await ready;
    if (py) await run(m.id, m.code);
  } else if (m.type === 'event') {
    dispatch(m.kind, m.key, m.x, m.y);
  }
};
