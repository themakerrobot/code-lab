// ═══════════════════════════════════════════════════════════
// Code Lab — 블록 · 파이썬 편집기 + 브라우저 / piBrain 실행
// ═══════════════════════════════════════════════════════════
// 두 축으로 나눈다.
//   편집 방식  mode   : 'block' | 'python'
//   실행 위치  target : 'browser' | 'device'
// 브라우저에서는 openpibo 블록이 돌지 않으므로, target 에 따라 툴박스를 바꾼다.

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
    target: 'codelab-target',
    blocks: 'codelab-blocks',
    python: 'codelab-python',
    font: 'codelab-font',
  };

  // 블록 문구는 한국어로 고정한다 (vendor/blockly/ko.js 만 싣는다).
  // blocks/ko2en.js 가 브라우저 언어로 lang 을 정하므로 여기서 덮어쓴다.
  lang = 'ko';

  const state = {
    mode: store.get(KEY.mode, 'block') === 'python' ? 'python' : 'block',
    target: store.get(KEY.target, 'browser') === 'device' ? 'device' : 'browser',
    running: false,        // 브라우저 실행 중
    deviceBusy: false,     // piBrain 으로 보내는 중
    deviceRunning: false,  // piBrain 이 실행 중 (실행시간 줄을 받으면 끝)
    stopRequested: false,
    fontSize: Math.min(28, Math.max(12, parseInt(store.get(KEY.font, '16'), 10) || 16)),
  };

  // ── 토스트 ──
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), 2000);
  }

  // ── 상태 줄 ──
  function setStatus(text, kind) {
    const el = $('#status');
    el.textContent = text;
    el.className = 'cl-status' + (kind ? ' ' + kind : '');
  }

  // ═══════════════════════════════════════════
  // 1. 블록 편집기
  // ═══════════════════════════════════════════

  // 브라우저에서도 도는 기본 분류. 나머지(소리·장치·OLED·음성·비전·인식…)는 piBrain 전용.
  const BROWSER_CATEGORIES = ['start', 'logic', 'loops', 'math', 'text', 'lists',
    'colour', 'variables', 'functions', 'utils'];

  function toolboxFor(target) {
    const full = toolbox_dict[lang];
    if (target === 'device') return full;
    const allowed = new Set(BROWSER_CATEGORIES.map(k => translations[k][lang]));
    const contents = full.contents.filter(c => c.kind !== 'category' || allowed.has(c.name));
    // 연달아 붙은 구분선 정리
    const tidy = contents.filter((c, i) => !(c.kind === 'sep' && contents[i - 1] && contents[i - 1].kind === 'sep'));
    return Object.assign({}, full, { contents: tidy });
  }

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
    toolbox: toolboxFor(state.target),
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

  let readableNames = false;   // 코드 보기 탭은 늘 읽기 쉬운 이름으로
  // piBrain(파이썬 3)에서는 한글 변수·함수 이름을 그대로 쓴다.
  // 브라우저 실행기(Skulpt)는 한글 이름을 못 읽으므로 Blockly 기본값(_ED_9A_9F…)을 둔다.
  Blockly.Python.init(workspace);
  Blockly.Python.nameDB_.getName = function (name, type) {
    const enc = Blockly.Names.prototype.getName.call(this, name, type);
    if (state.target !== 'device' && !readableNames) return enc;
    const dec = enc.replace(/(_[A-Z0-9]{2})+/g, (m) => {
      try { return decodeURIComponent(m.replace(/_/g, '%')); } catch (e) { return m; }
    });
    return dec.replace(/[^a-zA-Z0-9가-힣_]/g, '_');
  };

  // 시작 블록(깃발)에 붙은 블록만 실행된다 — 떨어진 블록은 흐리게
  new DisableTopBlocks(workspace).init();

  // 파일 목록 드롭다운(소리·그림 폴더)을 가진 블록 되살리기
  function restoreDynamicDropdowns(node) {
    if (!node || typeof node !== 'object') return;
    if (node.block && node.block.type && node.block.type.includes('_dynamic')) {
      const b = workspace.getBlockById(node.block.id);
      if (b && node.block.fields) updateSecondDropdown.call(b, node.block.fields.dir, node.block.fields.filename);
    }
    for (const k in node) restoreDynamicDropdowns(node[k]);
  }

  function loadBlocks(json) {
    Blockly.serialization.workspaces.load(json, workspace);
    if (json && json.blocks && json.blocks.blocks) {
      json.blocks.blocks.forEach(b => restoreDynamicDropdowns({ block: b }));
    }
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
    if (event.type === Blockly.Events.BLOCK_CHANGE && event.element === 'field' && event.name === 'dir') {
      const b = workspace.getBlockById(event.blockId);
      if (b) updateSecondDropdown.call(b, b.getFieldValue('dir'));
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

  const editor = CodeMirror.fromTextArea($('#pyCode'), {
    mode: { name: 'python', version: 3, singleLineStringErrors: false },
    theme: 'cobalt',
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    matchBrackets: true,
    extraKeys: {
      'Ctrl-Enter': () => run(),
      'Cmd-Enter': () => run(),
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
    readableNames = true;
    try { codeView.setValue(blocksToCode() || '# 시작 블록 아래에 블록을 붙여 보세요\n'); }
    finally { readableNames = false; }
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
  // 3. 결과 창
  // ═══════════════════════════════════════════

  const outText = $('#outText');

  function out(text, cls) {
    const span = document.createElement('span');
    if (cls) span.className = cls;
    span.textContent = text;
    outText.appendChild(span);
    const box = $('#outBox');
    box.scrollTop = box.scrollHeight;
  }

  function clearOut() {
    outText.innerHTML = '';
    hideInput();
  }

  function showTab(name) {
    $$('.cl-tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
    $$('.cl-tabpane').forEach(p => p.classList.toggle('on', p.id === 'tab-' + name));
    if (name === 'code') { refreshCodeView(); setTimeout(() => codeView.refresh(), 0); }
  }

  // ═══════════════════════════════════════════
  // 4. 브라우저 실행 (Skulpt)
  // ═══════════════════════════════════════════

  let pendingInput = null;

  function hideInput() {
    $('#inRow').hidden = true;
    if (pendingInput) { const r = pendingInput; pendingInput = null; r(''); }
  }

  function askInput(promptText) {
    return new Promise((resolve) => {
      showTab('out');
      if (promptText) out(promptText);
      const row = $('#inRow');
      const field = $('#inField');
      row.hidden = false;
      field.value = '';
      field.focus();
      pendingInput = resolve;
    });
  }

  $('#inField').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !pendingInput) return;
    const v = e.target.value;
    const r = pendingInput;
    pendingInput = null;
    $('#inRow').hidden = true;
    out(v + '\n', 'echo');
    r(v);
  });

  function friendlyError(err) {
    const s = String(err);
    const rules = [
      [/bad token.*line (\d+)/, m => `${m[1]}번째 줄에 쓸 수 없는 글자가 있어요. 브라우저에서는 이름을 영어로 써 주세요`],
      [/SyntaxError:.*line (\d+)/, m => `문법이 틀렸어요 (${m[1]}번째 줄)`],
      [/IndentationError:.*line (\d+)/, m => `들여쓰기를 확인해 주세요 (${m[1]}번째 줄)`],
      [/NameError: name '(.+?)' is not defined/, m => `'${m[1]}' 이(가) 아직 없어요`],
      [/ImportError: No module named (\S+)/, m => `${m[1]} 는 브라우저에 없어요. piBrain에서 실행해 보세요`],
      [/ZeroDivisionError/, () => '0으로 나눌 수 없어요'],
      [/TypeError: (.+)/, m => `자료형이 맞지 않아요: ${m[1]}`],
      [/IndexError: (.+)/, m => `번호가 범위를 넘었어요: ${m[1]}`],
      [/ValueError: (.+)/, m => `값이 알맞지 않아요: ${m[1]}`],
      [/TimeLimitError/, () => '60초가 지나서 멈췄어요'],
    ];
    for (const [re, f] of rules) {
      const m = s.match(re);
      if (m) return f(m) + '\n\n' + s;
    }
    return '오류가 났어요\n\n' + s;
  }

  function runInBrowser(code) {
    if (/^\s*(import\s+openpibo|from\s+openpibo)/m.test(code)) {
      showTab('out');
      out('이 코드는 piBrain 블록을 써요.\n위의 "실행 위치"를 piBrain 으로 바꾼 뒤 실행해 주세요.\n', 'err');
      setStatus('piBrain 전용 코드', 'err');
      return;
    }

    state.running = true;
    state.stopRequested = false;
    updateButtons();
    clearOut();
    setStatus('실행 중…', 'run');
    $('#execTime').textContent = '';
    const t0 = performance.now();

    const hasTurtle = /(^|\n)\s*(import\s+turtle|from\s+turtle\s+import)/.test(code);
    showTab(hasTurtle ? 'draw' : 'out');

    // turtle 캔버스 자리
    const host = $('#turtle');
    host.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'turtle-canvas-wrapper';
    wrap.id = 'turtle-target';
    host.appendChild(wrap);

    Sk.execLimit = 60 * 1000;
    Sk.configure({
      output: (t) => out(t),
      read: (f) => {
        if (Sk.builtinFiles === undefined || Sk.builtinFiles.files[f] === undefined) {
          throw "File not found: '" + f + "'";
        }
        return Sk.builtinFiles.files[f];
      },
      inputfun: askInput,
      inputfunTakesPrompt: true,
      yieldLimit: 100,
      killableWhile: true,
      killableFor: true,
      __future__: Sk.python3,
    });
    (Sk.TurtleGraphics || (Sk.TurtleGraphics = {})).target = 'turtle-target';
    Sk.TurtleGraphics.width = 400;
    Sk.TurtleGraphics.height = 400;

    // 정지 버튼: 매 양보 지점에서 확인
    const stopCheck = { '*': () => { if (state.stopRequested) throw new Sk.builtin.KeyboardInterrupt('stopped'); } };

    Sk.misceval.asyncToPromise(() => Sk.importMainWithBody('<stdin>', false, code, true), stopCheck)
      .then(() => {
        const sec = ((performance.now() - t0) / 1000).toFixed(2);
        out(`\n실행 끝 (${sec}초)\n`, 'info');
        setStatus('실행 끝', 'ok');
        $('#execTime').textContent = sec + '초';
      })
      .catch((err) => {
        const sec = ((performance.now() - t0) / 1000).toFixed(2);
        $('#execTime').textContent = sec + '초';
        if (state.stopRequested) {
          out('\n멈췄어요\n', 'info');
          setStatus('멈춤', '');
          return;
        }
        showTab('out');
        out('\n' + friendlyError(err) + '\n', 'err');
        setStatus('오류', 'err');
      })
      .finally(() => {
        state.running = false;
        state.stopRequested = false;
        hideInput();
        updateButtons();
      });
  }

  function stopBrowser() {
    if (!state.running) return;
    state.stopRequested = true;
    Sk.execLimit = 0;      // 양보 지점이 없는 계산 루프도 끊는다
    hideInput();           // input() 기다리는 중이면 풀어 준다
  }

  // ═══════════════════════════════════════════
  // 5. piBrain 실행 (Web Serial)
  // ═══════════════════════════════════════════

  const serialOK = PiBrainSerial.supported();
  const link = serialOK ? new PiBrainSerial() : null;

  function setDeviceBadge() {
    const b = $('#devBadge');
    if (!serialOK) { b.textContent = '크롬·엣지 필요'; b.className = 'badge'; return; }
    if (link.connected) { b.textContent = 'piBrain 연결됨'; b.className = 'badge ok'; }
    else { b.textContent = 'piBrain 연결 안 됨'; b.className = 'badge'; }
  }

  if (link) {
    const TRACE_LINE = /File "[^"]*\.tmp\.py", line (\d+)/;
    link.onLine = (line) => {
      if (/^실행시간:/.test(line)) {
        out(line + '\n', 'info');
        state.deviceRunning = false;
        setStatus('실행 끝', 'ok');
        const m = line.match(/([\d.]+)\s*초/);
        if (m) $('#execTime').textContent = m[1] + '초';
        updateButtons();
        return;
      }
      // 장치가 코드 앞에 3줄을 덧붙이므로 오류 줄 번호를 내 코드 기준으로 알려 준다
      const tm = line.match(TRACE_LINE);
      if (tm) {
        const mine = parseInt(tm[1], 10) - PiBrainSerial.PRELUDE_LINES;
        out(line + (mine > 0 ? `   ← 내 코드 ${mine}번째 줄` : '') + '\n', 'err');
        return;
      }
      const isErr = /^Traceback|^\s*\w*(Error|Exception)\b|^Error:/.test(line);
      out(line + '\n', isErr ? 'err' : '');
    };
    link.onState = (s, reason) => {
      setDeviceBadge();
      if (s === 'connected') {
        toast('piBrain 과 연결됐어요');
        setStatus('piBrain 연결됨', 'ok');
      } else {
        state.deviceRunning = false;
        state.deviceBusy = false;
        if (reason === 'unplugged') { toast('piBrain 연결이 끊겼어요'); setStatus('연결 끊김', 'err'); }
        else setStatus('연결 해제', '');
      }
      updateButtons();
    };
  }

  async function toggleConnect() {
    if (!link) { toast('크롬이나 엣지에서 열어 주세요'); return; }
    try {
      if (link.connected) await link.disconnect();
      else await link.connect();
    } catch (e) {
      if (e && e.name === 'NotFoundError') return;   // 고르기 창을 닫음
      console.error(e);
      toast('연결하지 못했어요. 케이블을 확인해 주세요');
      setStatus('연결 실패', 'err');
    }
    updateButtons();
  }

  async function runOnDevice(code) {
    if (!link || !link.connected) { toast('먼저 piBrain 을 연결해 주세요'); return; }
    if (PiBrainSerial.hasReservedWord(code)) {
      out('코드에 ###END### 나 ###DISP### 가 있으면 보낼 수 없어요.\n', 'err');
      return;
    }
    clearOut();
    showTab('out');
    out(new Date().toLocaleTimeString('ko-KR') + '  piBrain 으로 보냈어요\n\n', 'info');
    state.deviceBusy = true;
    state.deviceRunning = true;
    setStatus('piBrain 실행 중…', 'run');
    $('#execTime').textContent = '';
    updateButtons();
    try {
      await link.sendCode(code);
    } catch (e) {
      out('보내지 못했어요: ' + e.message + '\n', 'err');
      state.deviceRunning = false;
      setStatus('보내기 실패', 'err');
    }
    // 장치가 1초 동안 더 받을 것을 기다린 뒤 실행하므로 그동안은 다시 누르지 않게 한다
    setTimeout(() => { state.deviceBusy = false; updateButtons(); }, PiBrainSerial.GAP_MS);
  }

  async function stopDevice() {
    if (!link || !link.connected) return;
    try {
      await link.stop();
      out('\n멈춤 명령을 보냈어요\n', 'info');
      state.deviceRunning = false;
      setStatus('멈춤', '');
    } catch (e) { toast('보내지 못했어요'); }
    updateButtons();
  }

  async function showNetwork() {
    if (!link || !link.connected) return;
    try { await link.showNetwork(); toast('piBrain 화면을 처음으로 돌렸어요'); }
    catch (e) { toast('보내지 못했어요'); }
  }

  // ═══════════════════════════════════════════
  // 6. 실행 · 정지 (공통)
  // ═══════════════════════════════════════════

  function run() {
    const code = currentCode();
    if (!code.trim()) {
      toast(state.mode === 'block' ? '시작 블록 아래에 블록을 붙여 주세요' : '실행할 코드가 없어요');
      return;
    }
    if (state.target === 'device') runOnDevice(code);
    else if (!state.running) runInBrowser(code);
  }

  function stop() {
    if (state.target === 'device') stopDevice();
    else stopBrowser();
  }

  function updateButtons() {
    const dev = state.target === 'device';
    const connected = !!(link && link.connected);
    $('#runBtn').disabled = dev ? (!connected || state.deviceBusy) : state.running;
    $('#stopBtn').disabled = dev ? !connected : !state.running;
    $('#dispBtn').disabled = !connected;
    const cb = $('#connBtn');
    cb.innerHTML = connected
      ? '<i class="fa-solid fa-link-slash"></i> 연결 끊기'
      : '<i class="fa-solid fa-plug"></i> 연결';
    cb.classList.toggle('on', connected);
    cb.disabled = !serialOK;
  }

  // ═══════════════════════════════════════════
  // 7. 편집 방식 · 실행 위치 전환
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

  function setTarget(target) {
    if (target === 'device' && !serialOK) {
      toast('piBrain 실행은 크롬·엣지에서 돼요');
      return;
    }
    if (state.running) stopBrowser();
    state.target = target;
    store.set(KEY.target, target);
    $$('[data-target]').forEach(b => b.classList.toggle('on', b.dataset.target === target));
    document.body.classList.toggle('t-device', target === 'device');
    workspace.updateToolbox(toolboxFor(target));
    $('#execTime').textContent = '';
    if (state.mode === 'block') refreshCodeView();
    $('#tabDrawBtn').hidden = target === 'device';
    if (target === 'device' && $('#tab-draw').classList.contains('on')) showTab('out');
    setStatus(target === 'device' ? (link && link.connected ? 'piBrain 연결됨' : 'piBrain 을 연결해 주세요') : '준비', '');
    updateButtons();
  }

  // ═══════════════════════════════════════════
  // 8. 파일 · 예제
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
    const r = new FileReader();
    r.onload = () => {
      const text = String(r.result);
      try {
        if (/\.json$/i.test(file.name)) {
          loadBlocks(JSON.parse(text));
          setMode('block');
        } else {
          editor.setValue(text);
          setMode('python');
        }
        toast('불러왔어요');
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
        if (ex.turtle && state.target === 'device') setTarget('browser');
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
  // 9. 크기 조절 · 전체화면
  // ═══════════════════════════════════════════

  function initResize() {
    const handle = $('#splitter');
    const main = $('#clMain');
    const out = $('#panOut');
    let dragging = false;

    const move = (e) => {
      if (!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      const r = main.getBoundingClientRect();
      const w = Math.max(280, Math.min(r.width * 0.7, r.right - p.clientX - 12));
      out.style.width = w + 'px';
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
  // 10. 시작
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
  $$('[data-target]').forEach(b => b.addEventListener('click', () => setTarget(b.dataset.target)));
  $$('.cl-tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
  $('#runBtn').addEventListener('click', run);
  $('#stopBtn').addEventListener('click', stop);
  $('#connBtn').addEventListener('click', toggleConnect);
  $('#dispBtn').addEventListener('click', showNetwork);
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
    else if (e.key === 'Escape' && (state.running || state.deviceRunning)) stop();
    else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveNow(); }
  });
  window.addEventListener('resize', () => Blockly.svgResize(workspace));

  buildExamples();
  initResize();
  initFullscreen();
  applyFontSize();
  setDeviceBadge();
  setMode(state.mode);
  setTarget(state.target === 'device' && !serialOK ? 'browser' : state.target);
  showTab('out');
})();
