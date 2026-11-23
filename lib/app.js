// ═══════════════════════════════════════════════════════════
// Code Lab — 블록 · 파이썬 편집기 + 브라우저 파이썬(Pyodide)
// ═══════════════════════════════════════════════════════════
// 편집 방식 mode: 'block' | 'python'. 어느 쪽이든 파이썬 코드를 만들어
// lib/py-runner.js(→ 워커의 Pyodide)로 실행한다.

(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ── 저장소 (시크릿 창 등에서 막혀도 화면은 떠야 한다) ──
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const KEY = {
    mode: 'codelab-mode',
    blocks: 'codelab-blocks',
    python: 'codelab-python',
    font: 'codelab-font',
  };

  const state = {
    mode: store.get(KEY.mode, 'block') === 'python' ? 'python' : 'block',
    fontSize: Math.min(28, Math.max(12, parseInt(store.get(KEY.font, '16'), 10) || 16)),
  };

  // ── 토스트 · 상태 줄 ──
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), 2000);
  }

  function setStatus(text, kind) {
    const el = $('#status');
    el.textContent = text;
    el.className = 'cl-status' + (kind ? ' ' + kind : '');
  }

  // ═══════════════════════════════════════════
  // 1. 블록 편집기
  // ═══════════════════════════════════════════

  const blockTheme = Blockly.Theme.defineTheme('codelab', {
    base: Blockly.Themes.Classic,
    startHats: true,
    fontStyle: { family: "'Pretendard Variable', Pretendard, sans-serif", weight: '700', size: 15 },
    blockStyles: {
      logic_blocks:     { colourPrimary: '#B098CB', colourSecondary: '#EDE7F6', colourTertiary: '#B39DDB' },
      loop_blocks:      { colourPrimary: '#85B687', colourSecondary: '#E8F5E9', colourTertiary: '#66BB6A' },
      math_blocks:      { colourPrimary: '#2196F3', colourSecondary: '#1E88E5', colourTertiary: '#0D47A1' },
      text_blocks:      { colourPrimary: '#FFAA08', colourSecondary: '#555555', colourTertiary: '#FF8F00' },
      list_blocks:      { colourPrimary: '#4DB6AC', colourSecondary: '#B2DFDB', colourTertiary: '#009688' },
      colour_blocks:    { colourPrimary: '#DFADB2', colourSecondary: '#FFEBEE', colourTertiary: '#EF9A9A' },
      variable_blocks:  { colourPrimary: '#EF9A9A', colourSecondary: '#EF9A9A', colourTertiary: '#EF5350' },
      procedure_blocks: { colourPrimary: '#C7BCB8', colourSecondary: '#EFEBE9', colourTertiary: '#BCAAA4' },
    },
    componentStyles: {
      workspaceBackgroundColour: '#FFFFFF',
      toolboxBackgroundColour: '#FBFAF5',
      toolboxForegroundColour: '#2A2620',
      flyoutBackgroundColour: '#F3EFE6',
      flyoutOpacity: 0.95,
      scrollbarColour: '#9A8F7D',
      scrollbarOpacity: 0.5,
      insertionMarkerOpacity: 0.5,
      selectedGlowColour: '#1F5F7A',
      selectedGlowSize: 0.5,
      replacementGlowColour: '#1F5F7A',
    },
  });

  const workspace = Blockly.inject('blocklyDiv', {
    toolbox: CODELAB_TOOLBOX,
    collapse: true,
    comments: true,
    disable: true,
    maxBlocks: Infinity,
    trashcan: true,
    horizontalLayout: false,
    toolboxPosition: 'start',
    css: true,
    media: 'vendor/blockly/media/',
    rtl: false,
    scrollbars: true,
    sounds: false,
    oneBasedIndex: true,
    grid: { spacing: 20, length: 3, colour: '#DCD5C6', snap: true },
    zoom: { controls: true, wheel: false, startScale: 0.8, maxScale: 3, minScale: 0.3, scaleSpeed: 1.1, pinch: true },
    move: { scrollbars: { horizontal: true, vertical: true }, drag: true, wheel: true },
    renderer: 'zelos',
    theme: blockTheme,
  });

  // 한글 변수·함수 이름을 그대로 쓴다 (Blockly 는 기본으로 _EB_B3_80 처럼 바꾼다).
  // Pyodide 는 진짜 파이썬 3 라 한글 이름이 그대로 돈다.
  Blockly.Python.init(workspace);
  Blockly.Python.nameDB_.getName = function (name, type) {
    const enc = Blockly.Names.prototype.getName.call(this, name, type);
    const dec = enc.replace(/(_[A-Z0-9]{2})+/g, (m) => {
      try { return decodeURIComponent(m.replace(/_/g, '%')); } catch (e) { return m; }
    });
    return dec.replace(/[^a-zA-Z0-9가-힣_]/g, '_');
  };

  // 시작 블록(깃발)에 붙은 블록만 실행된다 — 떨어진 블록은 흐리게
  new DisableTopBlocks(workspace).init();

  // 지금 없는 블록(예전 로봇 전용 블록 등)이 든 파일도 열리게, 모르는 블록은 빼고 알려 준다.
  // 모르는 블록을 만나면 그 블록과 그 아래에 붙은 것까지 뺀다.
  function stripUnknown(node, dropped) {
    if (Array.isArray(node)) {
      return node.map(n => stripUnknown(n, dropped)).filter(n => n !== null);
    }
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'string' && 'id' in node && !Blockly.Blocks[node.type]) {
      dropped.add(node.type);
      // 아래에 붙어 있던 블록은 살려서 한 칸 끌어올린다
      return node.next && node.next.block ? stripUnknown(node.next.block, dropped) : null;
    }
    const out = {};
    for (const k of Object.keys(node)) {
      const v = stripUnknown(node[k], dropped);
      if (v === null) continue;
      // { block: X } 나 { shadow: X } 연결 칸이 비면 칸째 뺀다
      if (v && typeof v === 'object' && !Array.isArray(v)
          && ('block' in node[k] || 'shadow' in node[k]) && !('block' in v) && !('shadow' in v)) continue;
      out[k] = v;
    }
    return out;
  }

  function loadBlocks(json) {
    const dropped = new Set();
    const clean = stripUnknown(json, dropped);
    Blockly.serialization.workspaces.load(clean, workspace);
    return dropped.size;
  }

  function blocksToCode() {
    return Blockly.Python.workspaceToCode(workspace);
  }

  let codeViewTimer;
  workspace.addChangeListener((event) => {
    // 시작 블록은 하나만
    if (event.type === Blockly.Events.BLOCK_CREATE) {
      const flags = workspace.getAllBlocks(false).filter(b => b.type === 'flag_event');
      if (flags.length > 1) {
        const nb = workspace.getBlockById(event.blockId);
        if (nb && nb.type === 'flag_event') { nb.dispose(); toast('시작 블록은 하나만 둘 수 있어요'); }
      }
    }
    if (event.isUiEvent) return;
    clearTimeout(codeViewTimer);
    codeViewTimer = setTimeout(() => {
      if (state.mode === 'block') refreshCodeView();
      store.set(KEY.blocks, JSON.stringify(Blockly.serialization.workspaces.save(workspace)));
    }, 250);
  });

  // ═══════════════════════════════════════════
  // 2. 파이썬 편집기 · 코드 보기
  // ═══════════════════════════════════════════

  // Ctrl+Enter · Esc 는 아래 문서 전체 단축키 하나로만 처리한다 (두 번 실행되지 않게)
  const editor = CodeMirror.fromTextArea($('#pyCode'), {
    mode: { name: 'python', version: 3, singleLineStringErrors: false },
    theme: 'cobalt',
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    matchBrackets: true,
    extraKeys: {
      Tab: (cm) => {
        if (cm.somethingSelected()) cm.indentSelection('add');
        else cm.replaceSelection('    ', 'end');
      },
    },
  });
  editor.on('cursorActivity', () => {
    const p = editor.getCursor();
    $('#cursorPos').textContent = `줄 ${p.line + 1}, 칸 ${p.ch + 1}`;
  });
  let pySaveTimer;
  editor.on('change', () => {
    clearTimeout(pySaveTimer);
    pySaveTimer = setTimeout(() => store.set(KEY.python, editor.getValue()), 500);
  });

  const codeView = CodeMirror($('#codeView'), {
    mode: 'python', theme: 'cobalt', lineNumbers: true, readOnly: true,
  });

  function refreshCodeView() {
    codeView.setValue(blocksToCode() || '# 시작 블록 아래에 블록을 붙여 보세요\n');
  }

  function applyFontSize() {
    $('#fontSize').textContent = state.fontSize;
    editor.getWrapperElement().style.fontSize = state.fontSize + 'px';
    codeView.getWrapperElement().style.fontSize = Math.max(12, state.fontSize - 2) + 'px';
    $('#outText').style.fontSize = Math.max(12, state.fontSize - 2) + 'px';
    editor.refresh();
    codeView.refresh();
    store.set(KEY.font, String(state.fontSize));
  }

  function currentCode() {
    return state.mode === 'block' ? blocksToCode() : editor.getValue();
  }

  // ═══════════════════════════════════════════
  // 3. 결과 창 — 프레임마다 모아서 붙이고, 너무 길면 앞을 잘라 낸다
  // ═══════════════════════════════════════════

  const outText = $('#outText');
  const outBox = $('#outBox');
  const OUT_MAX_CHARS = 200000;
  let outPending = [];      // [text, cls]
  let outRaf = 0;
  let outChars = 0;
  let outTrimmed = false;

  function out(text, cls) {
    if (!text) return;
    outPending.push([text, cls || '']);
    if (!outRaf) outRaf = requestAnimationFrame(flushOut);
  }

  // 그래프(matplotlib) 같은 그림을 결과에 끼운다
  function outImage(src) {
    outPending.push([null, 'img', src]);
    if (!outRaf) outRaf = requestAnimationFrame(flushOut);
  }

  function flushOut() {
    outRaf = 0;
    if (!outPending.length) return;
    const atBottom = outBox.scrollHeight - outBox.scrollTop - outBox.clientHeight < 40;
    const frag = document.createDocumentFragment();
    let span = null, cls = null, text = '';
    const close = () => { if (span) { span.textContent = text; frag.appendChild(span); } };
    for (const [t, c, src] of outPending) {
      if (t === null) {
        close();
        span = null; cls = null;
        const img = document.createElement('img');
        img.className = 'cl-plot';
        img.src = src;
        img.alt = '그래프';
        frag.appendChild(img);
        outChars += 2000;   // 잘라 낼 때 그림도 몫을 갖게
        continue;
      }
      if (!span || c !== cls) {
        close();
        span = document.createElement('span');
        if (c) span.className = c;
        cls = c;
        text = '';
      }
      text += t;
      outChars += t.length;
    }
    close();
    outPending = [];
    outText.appendChild(frag);
    // 오래된 출력 잘라 내기
    if (outChars > OUT_MAX_CHARS) {
      let over = outChars - OUT_MAX_CHARS * 0.8;
      let node = outText.querySelector('.cl-trim') ? outText.firstChild.nextSibling : outText.firstChild;
      while (over > 0 && node) {
        const next = node.nextSibling;
        const len = node.tagName === 'IMG' ? 2000 : node.textContent.length;
        if (len <= over || node.tagName === 'IMG') { node.remove(); over -= len; outChars -= len; }
        else { node.textContent = node.textContent.slice(over); outChars -= over; over = 0; }
        node = next;
      }
      if (!outTrimmed) {
        outTrimmed = true;
        const note = document.createElement('span');
        note.className = 'info cl-trim';
        note.textContent = '… 앞부분은 너무 길어서 지웠어요\n';
        outText.insertBefore(note, outText.firstChild);
      }
    }
    if (atBottom) outBox.scrollTop = outBox.scrollHeight;
  }

  function clearOut() {
    outPending = [];
    outText.textContent = '';
    outChars = 0;
    outTrimmed = false;
  }

  function showTab(name) {
    $$('.cl-tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
    $$('.cl-tabpane').forEach(p => p.classList.toggle('on', p.id === 'tab-' + name));
    if (name === 'code') { refreshCodeView(); setTimeout(() => codeView.refresh(), 0); }
  }

  // ═══════════════════════════════════════════
  // 4. 파이썬 실행 (Pyodide 워커)
  // ═══════════════════════════════════════════

  const runner = new PyRunner();
  const turtle = new TurtleCanvas($('#turtle'));

  function setPyBadge(text, ok) {
    const b = $('#pyBadge');
    b.textContent = text;
    b.className = 'badge' + (ok ? ' ok' : '');
  }

  runner.onStatus = (t) => { if (t) setStatus(t, 'run'); };
  runner.onReady = (v) => {
    setPyBadge('파이썬 ' + String(v).split('.').slice(0, 2).join('.'), true);
    if (!runner.running) setStatus('준비', '');
    updateButtons();
  };
  runner.onFatal = (t) => {
    setPyBadge('파이썬을 못 불러왔어요', false);
    setStatus('파이썬을 불러오지 못했어요', 'err');
    out('\n파이썬을 불러오지 못했어요. 새로고침해 주세요.\n' + t + '\n', 'err');
  };
  runner.onOut = (t, cls) => out(t, cls);
  runner.onTurtle = (cmds) => turtle.push(cmds);
  runner.onImage = (src) => { outImage(src); if (!turtle.busy) showTab('out'); };

  // ── 센서 (웹캠·마이크): 파이썬이 처음 쓸 때 lib/sensors.js 를 불러와 켠다 ──
  let sensors = null;
  async function getSensors() {
    if (!sensors) {
      const { Sensors } = await import('./sensors.js');
      sensors = new Sensors({
        video: $('#camVideo'),
        overlay: $('#camOverlay'),
        onCamera: (on) => {
          $('#tabCamBtn').hidden = !on;
          if (on && !turtle.busy) showTab('cam');
          if (!on && $('#tab-cam').classList.contains('on')) showTab('out');
        },
        onError: (msg) => toast(msg),
      });
      if (runner.running) sensors.begin();
    }
    return sensors;
  }
  runner.onSensorNeed = async (what) => {
    setStatus(what === 'sound' ? '마이크를 켜는 중…' : (what === 'off' ? '센서 끄는 중…' : '카메라·AI 를 준비하는 중…'), 'run');
    const s = await getSensors();
    await s.need(what);
    if (runner.running) setStatus(runner.waiting ? '계속 실행 중이에요 · 끝내려면 정지(Esc)' : '실행 중…', 'run');
  };

  async function importModel(file) {
    try {
      const name = await SenseModels.importZip(file);
      toast(`모델 '${name}' 을(를) 불러왔어요`);
      return name;
    } catch (e) {
      toast(String(e.message || e));
      return null;
    }
  }
  workspace.registerButtonCallback('importModel', () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.zip';
    inp.onchange = () => { if (inp.files[0]) importModel(inp.files[0]).then(() => workspace.refreshToolboxSelection()); };
    inp.click();
  });

  // ── turtle 이벤트: 코드는 끝났고 키보드·마우스를 기다린다 ──
  runner.onWaiting = () => {
    setStatus('계속 실행 중이에요 · 끝내려면 정지(Esc)', 'run');
    updateButtons();
  };

  // 브라우저 키 이름 → turtle(Tk) 키 이름
  const TK_KEYS = {
    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
    ' ': 'space', Enter: 'Return', Backspace: 'BackSpace', Tab: 'Tab', Shift: 'Shift_L',
    Control: 'Control_L', Alt: 'Alt_L', Delete: 'Delete', Home: 'Home', End: 'End',
    PageUp: 'Prior', PageDown: 'Next',
  };
  function typingSomewhere(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable
      || (t.closest && t.closest('.CodeMirror, .blocklyDiv, #blocklyDiv')));
  }
  function forwardKey(e, kind) {
    if (!runner.waiting || e.key === 'Escape' || e.ctrlKey || e.metaKey || typingSomewhere(e)) return;
    const key = TK_KEYS[e.key] || (/^F\d+$/.test(e.key) ? e.key : (e.key.length === 1 ? e.key : null));
    if (!key) return;
    e.preventDefault();      // 화살표로 화면이 스크롤되지 않게
    runner.event(kind, key, 0, 0);
  }
  document.addEventListener('keydown', (e) => forwardKey(e, 'press'));
  document.addEventListener('keyup', (e) => forwardKey(e, 'release'));
  $('#turtle').addEventListener('pointerdown', (e) => {
    if (!runner.waiting) return;
    const p = turtle.toTurtle(e.clientX, e.clientY);
    if (p) runner.event('click', null, p.x, p.y);
  });

  // input(): 입력 칸을 보여 주고, Enter 를 치면 답한다
  runner.onInput = (id) => {
    showTab('out');
    const row = $('#inRow');
    const field = $('#inField');
    row.hidden = false;
    row.dataset.id = id;
    field.value = '';
    setTimeout(() => field.focus(), 0);
  };
  $('#inField').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    const row = $('#inRow');
    const v = e.target.value;
    row.hidden = true;
    out(v + '\n', 'echo');
    runner.answer(row.dataset.id, v);
  });

  runner.onDone = ({ ok, error, elapsed }) => {
    $('#inRow').hidden = true;
    if (sensors) sensors.stopAll();
    const sec = (elapsed || 0).toFixed(2);
    $('#execTime').textContent = sec + '초';
    if (ok) {
      out(`\n실행 끝 (${sec}초)\n`, 'info');
      setStatus('실행 끝', 'ok');
    } else {
      if (!turtle.busy) showTab('out');
      out('\n' + friendlyError(error) + '\n\n', 'err');
      out(error.text || '', 'err');
      setStatus('오류', 'err');
    }
    updateButtons();
  };

  // 쉬운 말 한 줄 + 원래 오류. 파이썬 편집기면 그 줄을 짚는다.
  function friendlyError(e) {
    const line = e.lineno ? `${e.lineno}번째 줄: ` : '';
    const m = e.msg || '';
    const rules = [
      [/^SyntaxError$/, () => '문법이 틀렸어요. 괄호·따옴표·콜론(:)을 확인해 주세요'],
      [/^IndentationError$|^TabError$/, () => '들여쓰기를 확인해 주세요'],
      [/^NameError$/, () => { const n = m.match(/name '(.+?)'/); return `'${n ? n[1] : '?'}' 이(가) 아직 없어요. 이름이 맞는지, 먼저 만들었는지 확인해 주세요`; }],
      [/^ModuleNotFoundError$/, () => { const n = m.match(/'(.+?)'/); return `${n ? n[1] : '그 모듈'} 은(는) 브라우저 파이썬에 없어요`; }],
      [/^ZeroDivisionError$/, () => '0으로 나눌 수 없어요'],
      [/^TypeError$/, () => '자료형이 맞지 않아요 (예: 글자 + 숫자)'],
      [/^IndexError$/, () => '번호가 범위를 넘었어요'],
      [/^KeyError$/, () => `사전에 그 열쇠(${m})가 없어요`],
      [/^ValueError$/, () => '값이 알맞지 않아요'],
      [/^AttributeError$/, () => '그런 기능(속성)이 없어요. 이름을 확인해 주세요'],
      [/^RecursionError$/, () => '함수가 자기 자신을 너무 많이 불렀어요'],
      [/^NotImplementedError$/, () => m.split(' / ')[0]],
    ];
    if (e.lineno && state.mode === 'python') markLine(e.lineno);
    for (const [re, f] of rules) if (re.test(e.type)) return line + f();
    return line + '오류가 났어요';
  }

  let markedLine = null;
  function markLine(n) {
    clearMark();
    markedLine = Math.min(Math.max(0, n - 1), editor.lineCount() - 1);
    editor.addLineClass(markedLine, 'background', 'cl-errline');
    editor.scrollIntoView({ line: markedLine, ch: 0 }, 80);
  }
  function clearMark() {
    if (markedLine !== null) { editor.removeLineClass(markedLine, 'background', 'cl-errline'); markedLine = null; }
  }
  editor.on('change', clearMark);

  function run() {
    if (!runner.ready || runner.running) return;
    const code = currentCode();
    if (!code.trim()) {
      toast(state.mode === 'block' ? '시작 블록 아래에 블록을 붙여 주세요' : '실행할 코드가 없어요');
      return;
    }
    clearOut();
    clearMark();
    $('#execTime').textContent = '';
    const hasTurtle = /(^|\n)\s*(import\s+turtle|from\s+turtle\s+import)/.test(code);
    turtle.stop();
    turtle.reset();
    showTab(hasTurtle ? 'draw' : 'out');
    if (!runner.run(code, { models: SenseModels.list().map(m => m.name) })) return;
    if (sensors) sensors.begin();
    setStatus('실행 중…', 'run');
    updateButtons();
  }

  function stop() {
    if (!runner.running && !turtle.busy) return;
    const wasRunning = runner.running;
    turtle.stop();
    $('#inRow').hidden = true;
    if (sensors) sensors.stopAll();
    if (wasRunning) {
      runner.stop();
      setPyBadge('다시 준비 중…', false);
      out('\n멈췄어요\n', 'info');
    }
    setStatus('멈춤', '');
    updateButtons();
  }

  turtle.onIdle = () => updateButtons();

  function updateButtons() {
    $('#runBtn').disabled = !runner.ready || runner.running;
    $('#stopBtn').disabled = !runner.running && !turtle.busy;
  }

  // ═══════════════════════════════════════════
  // 5. 편집 방식 전환
  // ═══════════════════════════════════════════

  function setMode(mode) {
    state.mode = mode;
    store.set(KEY.mode, mode);
    $$('[data-mode]').forEach(b => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    const isBlock = mode === 'block';
    $('#blocklyDiv').hidden = !isBlock;
    $('#pyWrap').hidden = isBlock;
    $('#editTitle').textContent = isBlock ? '블록 편집기' : '파이썬 편집기';
    $('#editIcon').className = isBlock ? 'fa-solid fa-cubes' : 'fa-brands fa-python';
    $('#tabCodeBtn').hidden = !isBlock;
    $('#exBtnWrap').hidden = isBlock;
    $('#cursorPos').hidden = isBlock;
    if (isBlock) {
      Blockly.svgResize(workspace);
      refreshCodeView();
    } else {
      if ($('#tab-code').classList.contains('on')) showTab('out');
      setTimeout(() => { editor.refresh(); editor.focus(); }, 0);
    }
  }

  // ═══════════════════════════════════════════
  // 6. 파일 · 예제
  // ═══════════════════════════════════════════

  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function exportFile() {
    if (state.mode === 'block') {
      const json = Blockly.serialization.workspaces.save(workspace);
      download('blocks.json', JSON.stringify(json, null, 2), 'application/json');
    } else {
      download('code.py', editor.getValue(), 'text/x-python');
    }
    toast('파일로 내보냈어요');
  }

  // 작업은 자동으로 이 브라우저에 저장된다. Ctrl+S 는 바로 한 번 더 저장한다.
  function saveNow() {
    store.set(KEY.blocks, JSON.stringify(Blockly.serialization.workspaces.save(workspace)));
    store.set(KEY.python, editor.getValue());
    toast('이 브라우저에 저장했어요');
  }

  function exportPy() {
    download('code.py', currentCode(), 'text/x-python');
    toast('.py 파일로 내보냈어요');
  }

  function importFile(file) {
    if (!file) return;
    if (/\.zip$/i.test(file.name)) { importModel(file); return; }
    const r = new FileReader();
    r.onload = () => {
      const text = String(r.result);
      try {
        if (/\.json$/i.test(file.name)) {
          const dropped = loadBlocks(JSON.parse(text));
          setMode('block');
          toast(dropped ? `불러왔어요. 지금은 없는 블록 ${dropped}종은 뺐어요` : '불러왔어요');
        } else {
          editor.setValue(text);
          setMode('python');
          toast('불러왔어요');
        }
      } catch (e) {
        toast('파일을 읽지 못했어요');
      }
    };
    r.readAsText(file);
  }

  function buildExamples() {
    const menu = $('#exMenu');
    CODELAB_EXAMPLES.forEach(ex => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cl-menuitem';
      b.textContent = ex.label;
      b.addEventListener('click', () => {
        editor.setValue(ex.code);
        menu.hidden = true;
        showTab(ex.turtle ? 'draw' : 'out');
        toast('예제를 불러왔어요');
        editor.focus();
      });
      menu.appendChild(b);
    });
    $('#exBtn').addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
    document.addEventListener('click', (e) => { if (!menu.contains(e.target)) menu.hidden = true; });
  }

  // ═══════════════════════════════════════════
  // 7. 크기 조절 · 전체화면
  // ═══════════════════════════════════════════

  function initResize() {
    const handle = $('#splitter');
    const main = $('#clMain');
    const panOut = $('#panOut');
    let dragging = false;

    const move = (e) => {
      if (!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      const r = main.getBoundingClientRect();
      const w = Math.max(280, Math.min(r.width * 0.7, r.right - p.clientX - 12));
      panOut.style.width = w + 'px';
      Blockly.svgResize(workspace);
      editor.refresh();
      e.preventDefault();
    };
    const end = () => {
      dragging = false;
      handle.classList.remove('on');
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', move);
      document.removeEventListener('touchmove', move);
    };
    const start = (e) => {
      dragging = true;
      handle.classList.add('on');
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', move);
      document.addEventListener('touchmove', move, { passive: false });
      document.addEventListener('mouseup', end, { once: true });
      document.addEventListener('touchend', end, { once: true });
      e.preventDefault();
    };
    handle.addEventListener('mousedown', start);
    handle.addEventListener('touchstart', start, { passive: false });
  }

  function initFullscreen() {
    const btn = $('#fsBtn');
    if (!document.documentElement.requestFullscreen) { btn.hidden = true; return; }
    const icon = () => {
      btn.innerHTML = document.fullscreenElement
        ? '<i class="fa-solid fa-compress"></i>'
        : '<i class="fa-solid fa-expand"></i>';
    };
    btn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    });
    document.addEventListener('fullscreenchange', () => {
      icon();
      setTimeout(() => { Blockly.svgResize(workspace); editor.refresh(); }, 100);
    });
    icon();
  }

  // ═══════════════════════════════════════════
  // 8. 시작
  // ═══════════════════════════════════════════

  // 이전 작업 되살리기
  try {
    const saved = store.get(KEY.blocks, '');
    if (saved) loadBlocks(JSON.parse(saved));
  } catch (e) { /* 깨진 저장본은 무시 */ }
  if (!workspace.getAllBlocks(false).length) {
    // 빈 화면이면 시작 블록 하나를 놓아 둔다
    const flag = workspace.newBlock('flag_event');
    flag.initSvg();
    flag.render();
    flag.moveBy(40, 40);
  }
  editor.setValue(store.get(KEY.python, CODELAB_EXAMPLES[0].code));

  $$('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $$('.cl-tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
  $('#runBtn').addEventListener('click', run);
  $('#stopBtn').addEventListener('click', stop);
  $('#clearBtn').addEventListener('click', clearOut);
  $('#exportBtn').addEventListener('click', exportFile);
  $('#pyBtn').addEventListener('click', exportPy);
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', (e) => { importFile(e.target.files[0]); e.target.value = ''; });
  $('#toPyBtn').addEventListener('click', () => {
    editor.setValue(blocksToCode());
    setMode('python');
    toast('파이썬 편집기로 옮겼어요');
  });
  $('#fontDown').addEventListener('click', () => { if (state.fontSize > 12) { state.fontSize--; applyFontSize(); } });
  $('#fontUp').addEventListener('click', () => { if (state.fontSize < 28) { state.fontSize++; applyFontSize(); } });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
    else if (e.key === 'Escape') stop();
    else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveNow(); }
  });
  window.addEventListener('resize', () => Blockly.svgResize(workspace));

  buildExamples();
  initResize();
  initFullscreen();
  applyFontSize();
  setMode(state.mode);
  showTab('out');
  updateButtons();
  setPyBadge('파이썬 준비 중…', false);
  setStatus('파이썬을 불러오는 중…', 'run');
  runner.start();
})();
