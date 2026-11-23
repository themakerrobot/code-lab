// ═══════════════════════════════════════════════════════════
// 파이썬 워커 — Pyodide (CPython 3, WebAssembly)
// ═══════════════════════════════════════════════════════════
// 화면이 멈추지 않게 파이썬은 이 워커에서 돈다. 화면(lib/py-runner.js)과는
// 메시지로만 이야기한다.
//
//   화면 → 워커  {type:'init', token, canSyncInput}
//                {type:'run', id, code}
//   워커 → 화면  {type:'ready', version} · {type:'status', text}
//                {type:'out', text, cls} · {type:'turtle', cmds}
//                {type:'done', id, ok, error, elapsed}
//
// 정지는 화면이 이 워커를 통째로 끝내고 새로 띄운다 (Pyodide 를 중간에 멈출
// SharedArrayBuffer 는 GitHub Pages 에서 못 쓴다).
//
// input(): 워커는 기다릴 수 없어서, 동기 XHR 을 서비스 워커(sw.js)로 보내고
// 서비스 워커가 화면에서 답을 받아 돌려준다. 서비스 워커가 없으면 빈 문자열.

import { loadPyodide } from '../vendor/pyodide/pyodide.mjs';

const CDN = 'https://cdn.jsdelivr.net/pyodide/v314.0.8/full/';   // numpy 같은 추가 패키지
const FLUSH_MS = 40;

let py = null;
let token = '';
let canSyncInput = false;
let inputSeq = 0;

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
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `../__codelab__/input?id=${encodeURIComponent(id)}`, false);
    try {
      xhr.send(null);
    } catch (e) {
      continue;
    }
    if (xhr.status === 200) return xhr.responseText;
    if (xhr.status === 204 || xhr.status === 0) continue;
    return '';
  }
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
  });

  const turtleSrc = await (await fetch(new URL('./turtle.py', import.meta.url))).text();
  py.globals.set('_CODELAB_TURTLE_SRC', turtleSrc);
  await py.runPythonAsync(RUNNER_PY);
  postMessage({ type: 'ready', version: py.runPython('import sys; sys.version.split()[0]') });
}

// 사용자 코드를 새 이름공간에서 돌리고, 오류는 사용자 코드 줄만 남겨 돌려준다.
const RUNNER_PY = `
import sys, types, traceback, builtins, time

FILENAME = 'main.py'

def _fresh_turtle():
    mod = types.ModuleType('turtle')
    mod.__file__ = 'turtle.py'
    exec(compile(_CODELAB_TURTLE_SRC, 'turtle.py', 'exec'), mod.__dict__)
    sys.modules['turtle'] = mod

def _codelab_run(src):
    _fresh_turtle()
    g = {'__name__': '__main__', '__builtins__': builtins, '__file__': FILENAME}
    t0 = time.perf_counter()
    try:
        exec(compile(src, FILENAME, 'exec'), g)
        return {'ok': True, 'elapsed': time.perf_counter() - t0}
    except SystemExit:
        return {'ok': True, 'elapsed': time.perf_counter() - t0}
    except BaseException as e:
        te = traceback.TracebackException.from_exception(e)
        te.stack = traceback.StackSummary.from_list(
            [f for f in te.stack if f.filename == FILENAME])
        lineno = te.stack[-1].lineno if te.stack else getattr(e, 'lineno', None)
        return {
            'ok': False,
            'elapsed': time.perf_counter() - t0,
            'type': type(e).__name__,
            'msg': str(e),
            'lineno': lineno,
            'text': ''.join(te.format()),
        }
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
  postMessage({ type: 'status', text: '' });
  lastFlush = performance.now();
  let res;
  try {
    res = py.globals.get('_codelab_run')(code).toJs({ dict_converter: Object.fromEntries });
  } catch (e) {
    res = { ok: false, type: 'Error', msg: String(e), text: String(e), elapsed: 0 };
  }
  flush();
  postMessage({ type: 'done', id, ok: res.ok, error: res.ok ? null : res, elapsed: res.elapsed });
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
    await ready;
    if (py) await run(m.id, m.code);
  }
};
