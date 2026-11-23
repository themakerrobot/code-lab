// ═══════════════════════════════════════════════════════════
// 놀이실 — 가르친 것과 이미 아는 것을 엮어서 놀기
// ═══════════════════════════════════════════════════════════
// 하나의 생각 틀: 왼쪽에서 볼 것을 켜고(그냥 보기 또는 내 모델),
// 오른쪽에서 "만약 ○○ 하면 △△ 라고 말해요" 규칙이나 순서를 만든다.
//
//  · 그냥 보기 = 학습 없이 바로 아는 것 (lib/signals.js)
//  · 내 모델   = 학습실에서 가르친 종류 (확신 정도는 시험실 설정을 같이 쓴다)
//  · 카메라 소스(이미지·손·얼굴·포즈)는 프레임마다 하나씩 돌아가며 본다
//  · 소리는 마이크 쪽 타이머가 따로 돈다
//  · 맞는 규칙은 소리 내어 말한다 (lib/speak.js — 기기 안 목소리만)
//
// 어린 학생이 쓰는 화면이다. 고르기는 드롭다운 대신 큰 칩, 지금 맞는 것은
// 불이 들어오게 해서 "해 보면서 고른다" 가 되게 한다.

import { loadLandmarker, drawResult } from './landmarker.js';
import { loadEmbedder, cropTo, EMBEDDER } from './embedder.js';
import { extract } from './features.js';
import { createSoundEngine } from './sound.js';
import { createBgFx } from './bgfx.js';
import { deserialize, predict } from './classifier.js';
import { Store } from './project.js';
import { SOURCE_LIST, applySoundTransform, soundTransformOf, dimOfSource } from './sources.js';
import { SIGNALS, signalInfo, computeSignals, soundSignals, sigMatch, describe } from './signals.js';
import { speak, canSpeak, onVoicesChanged, stopSpeaking, ding } from './speak.js';

const $ = id => document.getElementById(id);
const T = s => (typeof GL_T === 'function' ? GL_T(s) : s);
const LANG = () => (typeof GL_LANG === 'string' ? GL_LANG : 'ko');

const SRCS = ['image', 'hand', 'face', 'pose', 'sound'];
const VISION = ['image', 'hand', 'face', 'pose'];
const LANDMARK = ['hand', 'face', 'pose'];
const SRC = Object.fromEntries(SOURCE_LIST.map(s => [s.id, s]));
const WATCH = '@watch';

const STATE_KEY = 'ailab-play';
const THR_KEY = 'ailab-threshold';   // 시험실과 같이 쓴다
const MAX_RULES = 6, MAX_CONDS = 3, MAX_STEPS = 8;
const SEQ_HOLD_MS = 800;      // 동작을 잠깐 유지해야 통과 — 스친 동작과 구분한다
const SEQ_COOLDOWN = 700;
const SAY_HOLD_MS = 400;      // 규칙이 이만큼 계속 맞아야 말한다 (깜빡임 방지)
const SAY_REARM_MS = 700;     // 말한 규칙이 이만큼 꺼져 있어야 다시 말한다

// ── 상태 ──
let mode = 'rule';                                            // 'rule' | 'seq'
const use = { image: '', hand: WATCH, face: '', pose: '', sound: '' };   // '' = 꺼짐
let rules = [];               // [{ say, op: 'AND'|'OR', conds: [{ src, v }] }]  v = 's:신호' | 'c:종류'
let steps = [];               // [{ src, v }]
let voiceOn = true;
let bgMode = 'off';
let allRecs = [];

const slots = {};             // src → { name, clf, variant, transform, classes }
const results = {};           // src → { state: 'none'|'idk'|'ok', label, prob }
const sigs = {};              // src → 그냥 보기 신호
const lastRaw = {};           // src → 마지막 랜드마크 결과 (오버레이용)
const lms = {}, lmPending = {};
let emb = null, embPending = null;
const imgCv = document.createElement('canvas');
imgCv.width = imgCv.height = EMBEDDER.inputSize;

let stream = null;
let rr = 0, lastUi = 0, lastSave = 0;
let restoring = false, lastSavedStr = '';

// 순서 놀이 진행
let seqPos = 0, seqHold = 0, seqCool = 0, seqDone = false, seqLast = 0;
// 규칙 말하기 (깜빡임 거르기)
let ruleCand = -1, ruleSince = 0, ruleSpoken = -1, ruleOffAt = 0;

function readThreshold() {
  let v = 60;
  try {
    const n = Number(localStorage.getItem(THR_KEY));
    if (n >= 20 && n <= 95) v = n;
  } catch (e) { /* 무시 */ }
  return v / 100;
}
let threshold = readThreshold();

let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// ═══ 소리 ═══
const snd = createSoundEngine();
snd.onTick = latest => {
  sigs.sound = soundSignals(latest.vec, latest.level);
  if (slots.sound) results.sound = classify('sound', applySoundTransform(latest.vec, slots.sound.transform));
};

// ═══ 엔진 ═══
function setEngine() {
  const busy = LANDMARK.some(s => lmPending[s]) || !!embPending;
  $('engine').textContent = T(busy ? '준비 중…' : '준비 완료');
}

function ensureEngine(src) {
  if (src === 'image') {
    if (emb || embPending) return;
    embPending = loadEmbedder()
      .then(e => { emb = e; })
      .catch(e => { console.error(e); toast(T('불러오지 못했어요. 새로고침해 주세요')); })
      .finally(() => { embPending = null; setEngine(); });
    return;
  }
  if (src === 'sound' || lms[src] || lmPending[src]) return;
  lmPending[src] = loadLandmarker(src)
    .then(l => { lms[src] = l; })
    .catch(e => { console.error(e); toast(T('불러오지 못했어요. 새로고침해 주세요')); })
    .finally(() => { lmPending[src] = null; setEngine(); });
}

function syncEngines() {
  SRCS.forEach(src => { if (use[src]) ensureEngine(src); });
  // 안 쓰는 랜드마커는 닫아서 메모리를 돌려준다
  LANDMARK.forEach(src => {
    if (!use[src]) {
      if (lms[src]) { lms[src].close(); lms[src] = null; }
      sigs[src] = null; results[src] = null; lastRaw[src] = null;
    }
  });
  if (!use.image) results.image = null;
  if (use.sound && !snd.running) {
    snd.start().catch(e => {
      console.error(e);
      toast(T('마이크가 안 보여요. 연결을 확인해 주세요'));
      use.sound = '';
      renderCards();
    });
  } else if (!use.sound) {
    snd.stop();                 // 켜는 중이어도 안전하다 (다 켠 뒤 바로 끈다)
    sigs.sound = null; results.sound = null;
  }
  setEngine();
}

// ═══ 내 모델 ═══
function recsOf(src) { return allRecs.filter(r => (r.source || 'image') === src); }

function classify(src, vec) {
  const slot = slots[src];
  if (!slot) return null;
  if (!vec) return { state: 'none' };
  const probs = predict(slot.clf, vec);
  let top = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[top]) top = i;
  const prob = probs[top];
  if (prob < threshold) return { state: 'idk', prob };
  return { state: 'ok', label: slot.classes[top], prob };
}

async function setUse(src, value) {
  delete slots[src];
  results[src] = null;
  use[src] = value;
  if (value && value !== WATCH) {
    let ok = false;
    try {
      const rec = await Store.get(value);
      const recSrc = rec && (rec.source || 'image');
      const want = rec && (rec.embedder ? rec.embedder.dim : dimOfSource(recSrc, rec.variant || null));
      if (rec && recSrc === src && want === dimOfSource(src, rec.variant || null)) {
        slots[src] = {
          name: rec.name,
          clf: deserialize(rec.classifier.json, rec.classifier.bin),
          variant: rec.variant || null,
          transform: soundTransformOf(rec.embedder),
          classes: rec.classes.slice(),
        };
        ok = true;
      }
    } catch (e) { console.error(e); }
    if (!ok) {
      use[src] = src === 'image' ? '' : WATCH;
      if (!restoring) toast(T('모델을 불러오지 못했어요'));
    }
  }
  if (src === 'image' && use.image === WATCH) use.image = '';   // 이미지는 그냥 보기가 없다
  syncEngines();
}

// ═══ 왼쪽: 무엇을 볼까요 ═══
function renderCards() {
  const box = $('srcCards');
  box.innerHTML = '';
  SRCS.forEach(src => {
    const on = !!use[src];
    const mine = recsOf(src);
    const card = document.createElement('div');
    card.className = 'srccard' + (on ? ' on' : '');
    card.dataset.src = src;

    const top = document.createElement('button');
    top.type = 'button';
    top.className = 'sc-top';
    top.innerHTML = '<i class="fa-solid ' + SRC[src].icon + '"></i>' +
      '<span class="sc-nm">' + esc(T(SRC[src].label)) + '</span>' +
      '<span class="sc-sw" aria-hidden="true"></span>';
    top.setAttribute('aria-pressed', on ? 'true' : 'false');
    top.addEventListener('click', () => toggleSrc(src));
    card.appendChild(top);

    if (on) {
      const chips = document.createElement('div');
      chips.className = 'chips sc-chips';
      const items = [];
      if (src !== 'image') items.push([WATCH, T('그냥 보기'), 'fa-eye']);
      mine.forEach(r => items.push([r.name, r.name, 'fa-cube']));
      items.forEach(([v, txt, icon]) => {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'chip' + (use[src] === v ? ' on' : '');
        c.innerHTML = '<i class="fa-solid ' + icon + '"></i>' + esc(txt);
        c.addEventListener('click', async () => {
          if (use[src] === v) return;
          await setUse(src, v);
          renderAll();
        });
        chips.appendChild(c);
      });
      card.appendChild(chips);
    } else if (src === 'image' && !mine.length) {
      const h = document.createElement('div');
      h.className = 'sc-note';
      h.textContent = T('이미지는 학습실에서 먼저 가르쳐 주세요');
      card.appendChild(h);
    }
    box.appendChild(card);
  });
}

async function toggleSrc(src) {
  if (use[src]) {
    await setUse(src, '');
  } else if (src === 'image') {
    const mine = recsOf('image');
    if (!mine.length) { toast(T('이미지는 학습실에서 먼저 가르쳐 주세요')); return; }
    await setUse('image', mine[0].name);
  } else {
    await setUse(src, WATCH);
  }
  // 카메라 소스를 켰는데 카메라가 꺼져 있으면 같이 켠다 (한 번 덜 누르게)
  if (VISION.includes(src) && use[src] && !stream) camOn();
  renderAll();
}

// ═══ 카메라 ═══
async function listCams() {
  const sel = $('camSel');
  try {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    const cur = sel.value;
    sel.innerHTML = '';
    devs.forEach((d, i) => {
      const o = document.createElement('option');
      o.value = d.deviceId;
      const full = d.label || (T('카메라') + ' ' + (i + 1));
      const cut = full.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '').trim();
      o.textContent = cut.length > 22 ? cut.slice(0, 21) + '…' : cut;
      o.title = full;
      sel.appendChild(o);
    });
    if (cur && devs.some(d => d.deviceId === cur)) sel.value = cur;
  } catch (e) { /* 무시 */ }
}

function setCamBtn(on) {
  $('camBtn').innerHTML = on
    ? '<i class="fa-solid fa-video-slash"></i> ' + T('카메라 끄기')
    : '<i class="fa-solid fa-video"></i> ' + T('카메라 켜기');
  $('camBtn').classList.toggle('go', !on);
}

async function camOn() {
  if (stream) return;
  try {
    const want = { width: { ideal: 640 }, height: { ideal: 480 } };
    if ($('camSel').value) want.deviceId = { exact: $('camSel').value };
    stream = await navigator.mediaDevices.getUserMedia({ video: want, audio: false });
    $('camVid').srcObject = stream;
    await $('camVid').play();
    syncAspect();
    $('camOff').style.display = 'none';
    setCamBtn(true);
    await listCams();
  } catch (e) {
    stream = null;
    toast(T('카메라가 안 보여요. 연결을 확인해 주세요'));
  }
}

function camStop() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  $('camVid').srcObject = null;
  $('camOff').style.display = '';
  setCamBtn(false);
  VISION.forEach(s => { results[s] = null; lastRaw[s] = null; sigs[s] = null; });
  const ov = $('ovCv');
  if (ov.width) ov.getContext('2d').clearRect(0, 0, ov.width, ov.height);
}

function camReady() { return !!(stream && $('camVid').videoWidth); }

function syncAspect() {
  const v = $('camVid');
  if (v.videoWidth) $('camBox').style.aspectRatio = v.videoWidth + ' / ' + v.videoHeight;
}

// ═══ 감지 루프 ═══
function runVision(src, now) {
  const video = $('camVid');
  if (src === 'image') {
    if (!emb || !slots.image) return;
    // 학습할 때와 똑같이: 가운데 정사각형 + 거울
    if (!cropTo(video, imgCv, EMBEDDER.inputSize, EMBEDDER.mirror)) return;
    let v = null;
    try { v = emb.embed(imgCv); } catch (e) { return; }
    results.image = classify('image', v);
    return;
  }
  const l = lms[src];
  if (!l) return;
  let raw = null;
  try { raw = l.detect(video, now); } catch (e) { return; }
  lastRaw[src] = raw;
  sigs[src] = computeSignals(src, raw, video.videoWidth, video.videoHeight);
  if (slots[src]) results[src] = classify(src, raw ? extract(src, raw, slots[src].variant) : null);
}

function drawOverlay() {
  const video = $('camVid');
  const cv = $('ovCv');
  if (cv.width !== video.videoWidth || cv.height !== video.videoHeight) {
    cv.width = video.videoWidth; cv.height = video.videoHeight;
    syncAspect();
  }
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  LANDMARK.forEach(s => {
    if (use[s] && lastRaw[s]) drawResult(ctx, s, lastRaw[s], slots[s] ? slots[s].variant : undefined);
  });
}

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const vis = VISION.filter(s => use[s]);
  if (camReady() && vis.length) {
    runVision(vis[rr++ % vis.length], now);   // 이번 프레임에는 하나만
    drawOverlay();
  }
  if (camReady()) bgfx.tick(now);
  if (now - lastUi > 120) { lastUi = now; renderLive(now); }
  if (now - lastSave > 1500) { lastSave = now; save(); }
}

// ═══ 조건 ═══
function inputReady(src) { return src === 'sound' ? snd.running : camReady(); }

function condMatch(c) {
  if (!c || !use[c.src] || !inputReady(c.src)) return false;
  if (c.v.startsWith('s:')) return sigMatch(c.src, c.v.slice(2), sigs[c.src]);
  if (c.v.startsWith('c:')) {
    const r = results[c.src];
    return !!r && r.state === 'ok' && r.label === c.v.slice(2);
  }
  return false;
}

// 조건이 지금 쓸 수 없는가 (소스가 꺼졌거나, 그 종류를 아는 모델이 안 골라졌을 때)
function condOff(c) {
  if (!use[c.src]) return true;
  if (c.v.startsWith('c:')) return !(slots[c.src] && slots[c.src].classes.includes(c.v.slice(2)));
  return false;
}

function condView(c) {
  const srcName = T(SRC[c.src] ? SRC[c.src].label : c.src);
  if (c.v.startsWith('s:')) {
    const info = signalInfo(c.src, c.v.slice(2));
    return { src: srcName, text: info ? T(info.text) : c.v, icon: info ? info.icon : 'fa-circle' };
  }
  return { src: srcName, text: c.v.slice(2), icon: 'fa-cube' };
}

// 소스 하나가 고를 수 있는 것: 배운 종류 + 그냥 되는 것
function optionsOf(src) {
  const out = [];
  if (slots[src]) slots[src].classes.forEach(c => out.push({ src, v: 'c:' + c, learned: true }));
  (SIGNALS[src] || []).forEach(([tok]) => out.push({ src, v: 's:' + tok, learned: false }));
  return out;
}

function onSources() { return SRCS.filter(s => use[s]); }

// 켜야 할 입력이 꺼져 있으면 무엇을 켜라고 할까
function gateMessage() {
  const on = onSources();
  if (!on.length) return T('왼쪽에서 볼 것을 켜 주세요');
  if (on.some(s => s !== 'sound') && !camReady()) return T('카메라를 켜 주세요');
  if (on.includes('sound') && !snd.running) return T('마이크를 켜는 중이에요');
  return null;
}

// ═══ 고르기 창 ═══
let pickerCb = null;

function openPicker(title, cb) {
  if (!onSources().length) { toast(T('왼쪽에서 볼 것을 켜 주세요')); return; }
  pickerCb = cb;
  $('pkTitle').textContent = title;
  const body = $('pkBody');
  body.innerHTML = '';
  onSources().forEach(src => {
    const opts = optionsOf(src);
    if (!opts.length) return;
    const g = document.createElement('div');
    g.className = 'pk-group';
    g.innerHTML = '<div class="pk-src"><i class="fa-solid ' + SRC[src].icon + '"></i>' + esc(T(SRC[src].label)) + '</div>';
    const chips = document.createElement('div');
    chips.className = 'chips';
    opts.forEach(o => {
      const view = condView(o);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip big' + (o.learned ? ' learned' : '');
      b.dataset.src = o.src; b.dataset.v = o.v;
      b.innerHTML = '<i class="fa-solid ' + view.icon + '"></i>' + esc(view.text);
      b.addEventListener('click', () => {
        const fn = pickerCb;
        closePicker();
        if (fn) fn({ src: o.src, v: o.v });
      });
      chips.appendChild(b);
    });
    g.appendChild(chips);
    body.appendChild(g);
  });
  $('picker').hidden = false;
  updatePickerLive();
}

function closePicker() {
  $('picker').hidden = true;
  pickerCb = null;
}

function updatePickerLive() {
  if ($('picker').hidden) return;
  document.querySelectorAll('#pkBody .chip').forEach(b => {
    b.classList.toggle('now', condMatch({ src: b.dataset.src, v: b.dataset.v }));
  });
}

// ═══ 규칙 놀이 ═══
function sayText(r) {
  const t = (r.say || '').trim();
  if (t) return t;
  return r.conds.map(c => condView(c).text).join(' ');   // 할 말을 안 적었으면 조건을 읽는다
}

function condSlot(c, onEdit, onDel) {
  const view = condView(c);
  const wrap = document.createElement('span');
  wrap.className = 'slot' + (condOff(c) ? ' off' : '');
  wrap.title = condOff(c) ? T('지금은 꺼져 있어요') : '';
  const main = document.createElement('button');
  main.type = 'button';
  main.className = 'slot-main';
  main.innerHTML = '<i class="fa-solid ' + view.icon + '"></i>' +
    '<span class="slot-src">' + esc(view.src) + '</span>' + esc(view.text);
  main.addEventListener('click', onEdit);
  wrap.appendChild(main);
  if (onDel) {
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'slot-x';
    x.title = T('지우기');
    x.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    x.addEventListener('click', onDel);
    wrap.appendChild(x);
  }
  return wrap;
}

function renderRules() {
  const box = $('ruleList');
  box.innerHTML = '';
  rules.forEach((r, ri) => {
    const el = document.createElement('div');
    el.className = 'rule';
    el.dataset.ri = ri;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.title = T('규칙 지우기');
    del.innerHTML = '<i class="fa-solid fa-trash"></i>';
    del.addEventListener('click', () => { rules.splice(ri, 1); renderRules(); });
    el.appendChild(del);

    const line = document.createElement('div');
    line.className = 'r-line';
    const ifw = document.createElement('span');
    ifw.className = 'r-word';
    ifw.textContent = T('만약');
    line.appendChild(ifw);

    r.conds.forEach((c, ci) => {
      if (ci > 0) {
        const op = document.createElement('button');
        op.type = 'button';
        op.className = 'r-op';
        op.textContent = r.op === 'OR' ? T('또는') : T('그리고');
        op.title = T('눌러서 바꿔요');
        op.addEventListener('click', () => { r.op = r.op === 'OR' ? 'AND' : 'OR'; renderRules(); });
        line.appendChild(op);
      }
      const s = condSlot(c,
        () => openPicker(T('무엇으로 바꿀까요?'), pick => { r.conds[ci] = pick; renderRules(); }),
        () => { r.conds.splice(ci, 1); renderRules(); });
      s.dataset.ci = ci;
      line.appendChild(s);
    });

    if (r.conds.length < MAX_CONDS) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'slot add';
      add.innerHTML = '<i class="fa-solid fa-plus"></i>' + (r.conds.length ? T('조건 더하기') : T('무엇을 할까요?'));
      add.addEventListener('click', () => openPicker(T('무엇을 하면 될까요?'), pick => { r.conds.push(pick); renderRules(); }));
      line.appendChild(add);
    }
    el.appendChild(line);

    const then = document.createElement('div');
    then.className = 'r-then';
    const thw = document.createElement('span');
    thw.className = 'r-word';
    thw.innerHTML = '<i class="fa-solid fa-comment"></i>' + esc(T('AI가 할 말'));
    const inp = document.createElement('input');
    inp.className = 'inp say';
    inp.maxLength = 30;
    inp.placeholder = T('예: 안녕!');
    inp.value = r.say || '';
    inp.addEventListener('input', () => { r.say = inp.value; });
    then.appendChild(thw);
    then.appendChild(inp);
    el.appendChild(then);

    box.appendChild(el);
  });
  $('ruleAdd').disabled = rules.length >= MAX_RULES;
  renderRuleFlow();
}

// ═══ 순서도 — 같은 규칙을 순서도로 그린다 (만들기 → 순서도 놀이) ═══
// 시작 → 카메라로 봐요 → [만약 ①?] 예→ 말해요 / 아니오↓ [만약 ②?] … → 아무 말 안 해요 → 다시 봐요 (되돌이 화살표)
// 위에서부터 차례로 묻고, 처음 맞는 규칙 하나만 말한다 — evalRules 와 같은 순서.
let ruleView = 'chip';
function setRuleView(v) {
  ruleView = v === 'flow' ? 'flow' : 'chip';
  document.querySelectorAll('#ruleView button').forEach(b => b.classList.toggle('on', b.dataset.v === ruleView));
  $('ruleFlow').hidden = ruleView !== 'flow';
  document.body.classList.toggle('flow-view', ruleView === 'flow' && mode === 'rule');
  $('ruleList').hidden = ruleView === 'flow';
  $('ruleHint').textContent = ruleView === 'flow'
    ? T('위에서부터 차례로 물어봐요. 맞으면 말하고, 아니면 아래로.')
    : T('"만약 ○○ 하면" AI가 말해요.');
  if (ruleView === 'flow') renderRuleFlow();
}

function condText(r) {
  if (!r.conds.length) return T('무엇을 할까요?');
  const join = r.op === 'OR' ? T(' 또는 ') : T(' 그리고 ');
  return r.conds.map(c => condView(c).text).join(join);
}

function renderRuleFlow() {
  const box = $('ruleFlow');
  if (!box || ruleView !== 'flow') return;
  box.innerHTML = '';
  const node = (cls, html) => { const d = document.createElement('div'); d.className = 'fc-' + cls; d.innerHTML = html; return d; };
  const down = label => node('down', label ? '<span>' + esc(label) + '</span>' : '');
  box.appendChild(node('start', esc(T('시작'))));
  box.appendChild(down(''));
  const loopTop = node('box fc-look', '<i class="fa-solid fa-eye"></i>' + esc(T('카메라 · 마이크로 봐요')));
  box.appendChild(loopTop);
  const body = document.createElement('div');
  body.className = 'fc-body';
  rules.forEach((r, ri) => {
    body.appendChild(down(ri === 0 ? '' : T('아니오')));
    const row = document.createElement('div');
    row.className = 'fc-row';
    row.dataset.ri = ri;
    const dia = node('dia', '<b>' + (ri + 1) + '</b><span>' + esc(T('만약')) + ' ' + esc(condText(r)) + '?</span>');
    dia.title = T('눌러서 조건을 바꿔요');
    dia.addEventListener('click', () => openPicker(T('무엇을 하면 될까요?'), pick => { r.conds = [pick]; renderRules(); }));
    const yes = node('yes', '<span>' + esc(T('예')) + '</span>');
    const say = node('say', '<i class="fa-solid fa-comment"></i>' + esc(r.say ? '"' + r.say + '"' : T('말할 것을 정해요')));
    say.title = T('눌러서 할 말을 바꿔요');
    say.addEventListener('click', () => {
      setRuleView('chip');
      const inp = document.querySelectorAll('#ruleList .say')[ri];
      if (inp) inp.focus();
    });
    row.append(dia, yes, say);
    body.appendChild(row);
  });
  body.appendChild(down(rules.length ? T('아니오') : ''));
  body.appendChild(node('box fc-none', esc(T('아무 말 안 해요'))));
  box.appendChild(body);
  box.appendChild(node('loop', '<span>' + esc(T('다시 봐요')) + '</span>'));
}

function evalRules(now) {
  const el = $('answer');
  el.classList.remove('sure', 'idk');
  let text = '', sure = false, fired = -1;
  const gate = gateMessage();
  if (!rules.length) text = T('규칙을 만들어 보세요');
  else if (gate) text = gate;
  else {
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      if (!r.conds.length) continue;
      const ok = r.op === 'OR' ? r.conds.some(condMatch) : r.conds.every(condMatch);
      if (ok) { fired = i; break; }
    }
    if (fired >= 0) { text = sayText(rules[fired]); sure = true; }
    else text = T('맞는 규칙이 없어요');
  }
  el.textContent = text;
  el.classList.add(sure ? 'sure' : 'idk');

  // 지금 맞는 것에 불을 켠다 (순서도도 같이)
  document.querySelectorAll('#ruleFlow .fc-row').forEach(row => row.classList.toggle('fired', Number(row.dataset.ri) === fired));
  const none = document.querySelector('#ruleFlow .fc-none');
  if (none) none.classList.toggle('fired', fired < 0 && rules.length > 0 && !gateMessage());
  document.querySelectorAll('#ruleList .rule').forEach(re => {
    const ri = Number(re.dataset.ri);
    re.classList.toggle('fired', ri === fired);
    re.querySelectorAll('.slot[data-ci]').forEach(s => {
      const c = rules[ri] && rules[ri].conds[Number(s.dataset.ci)];
      s.classList.toggle('now', !!c && condMatch(c));
    });
  });

  voiceRule(fired, fired >= 0 ? sayText(rules[fired]) : '', now);
}

function voiceRule(fired, text, now) {
  if (fired !== ruleCand) { ruleCand = fired; ruleSince = now; }
  // 말한 규칙이 잠깐 꺼졌다 다시 맞으면 또 말한다
  if (ruleSpoken >= 0 && fired !== ruleSpoken) {
    if (!ruleOffAt) ruleOffAt = now;
    if (now - ruleOffAt > SAY_REARM_MS) { ruleSpoken = -1; ruleOffAt = 0; }
  } else ruleOffAt = 0;
  if (fired >= 0 && ruleSpoken === -1 && now - ruleSince >= SAY_HOLD_MS) {
    ruleSpoken = fired;
    if (voiceOn) speak(text, LANG());
  }
}

// ═══ 순서 놀이 ═══
function seqRestart() { seqPos = 0; seqHold = 0; seqCool = 0; seqDone = false; seqLast = 0; }

function renderSteps() {
  const box = $('seqFlow');
  box.innerHTML = '';
  const start = document.createElement('div');
  start.className = 'seq-node';
  start.textContent = T('시작');
  box.appendChild(start);

  steps.forEach((st, i) => {
    const arrow = document.createElement('div');
    arrow.className = 'seq-arrow';
    box.appendChild(arrow);

    const el = document.createElement('div');
    el.className = 'seq-step';
    el.dataset.i = i;
    const top = document.createElement('div');
    top.className = 'top';
    const idx = document.createElement('span');
    idx.className = 'sq-idx';
    idx.textContent = i + 1;
    top.appendChild(idx);
    top.appendChild(condSlot(st,
      () => openPicker(T('무엇으로 바꿀까요?'), pick => { steps[i] = pick; seqRestart(); renderSteps(); }),
      null));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.title = T('지우기');
    del.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    del.addEventListener('click', () => { steps.splice(i, 1); seqRestart(); renderSteps(); });
    top.appendChild(del);
    el.appendChild(top);
    const track = document.createElement('div');
    track.className = 'sq-track';
    track.innerHTML = '<div class="sq-fill"></div>';
    el.appendChild(track);
    box.appendChild(el);
  });

  const arrow2 = document.createElement('div');
  arrow2.className = 'seq-arrow';
  box.appendChild(arrow2);
  const goal = document.createElement('div');
  goal.className = 'seq-node goal';
  goal.id = 'seqGoal';
  goal.textContent = T('성공!');
  box.appendChild(goal);
  $('seqAdd').disabled = steps.length >= MAX_STEPS;
  updateSteps();
}

function updateSteps() {
  document.querySelectorAll('#seqFlow .seq-step').forEach(el => {
    const i = Number(el.dataset.i);
    el.classList.toggle('done', seqDone || i < seqPos);
    el.classList.toggle('cur', !seqDone && i === seqPos);
    const fill = el.querySelector('.sq-fill');
    if (fill) {
      const w = (seqDone || i < seqPos) ? 100 : (i === seqPos ? Math.round(seqHold / SEQ_HOLD_MS * 100) : 0);
      fill.style.width = w + '%';
    }
    const s = el.querySelector('.slot');
    if (s) s.classList.toggle('now', !seqDone && i === seqPos && condMatch(steps[i]));
  });
  const goal = $('seqGoal');
  if (goal) goal.classList.toggle('done', seqDone);
}

function tickSeq(now) {
  const el = $('answer');
  el.classList.remove('sure', 'idk');
  const dt = seqLast ? Math.min(400, now - seqLast) : 0;
  seqLast = now;
  let msg, sure = false;
  const gate = gateMessage();
  if (!steps.length) msg = T('단계를 더해 보세요');
  else if (seqDone) { msg = T('성공! 참 잘했어요'); sure = true; }
  else if (gate) msg = gate;
  else {
    const st = steps[seqPos];
    if (now >= seqCool && condMatch(st)) {
      seqHold += dt;
      if (seqHold >= SEQ_HOLD_MS) {
        seqHold = 0; seqPos++; seqCool = now + SEQ_COOLDOWN;
        if (seqPos >= steps.length) {
          seqDone = true;
          ding(true);
          if (voiceOn) speak(T('성공! 참 잘했어요'), LANG());
        } else {
          ding(false);
        }
      }
    } else {
      seqHold = Math.max(0, seqHold - dt * 2);   // 벗어나면 서서히 줄어든다
    }
    if (seqDone) { msg = T('성공! 참 잘했어요'); sure = true; }
    else {
      const v = condView(steps[seqPos]);
      msg = T('N번:').replace('N', seqPos + 1) + ' ' + v.text;
    }
  }
  el.textContent = msg;
  el.classList.add(sure ? 'sure' : 'idk');
  updateSteps();
}

// ═══ 지금 보이는 것 ═══
function renderNow() {
  const box = $('nowRow');
  const on = onSources();
  if (box.dataset.keys !== on.join()) {
    box.dataset.keys = on.join();
    box.innerHTML = '';
    on.forEach(src => {
      const d = document.createElement('div');
      d.className = 'nowchip';
      d.dataset.src = src;
      d.innerHTML = '<i class="fa-solid nc-ic"></i><span class="nc-src"></span><span class="nc-v"></span>';
      d.querySelector('.nc-src').textContent = T(SRC[src].label);
      box.appendChild(d);
    });
    if (!on.length) {
      const h = document.createElement('div');
      h.className = 'hint';
      h.style.margin = '0';
      h.textContent = T('왼쪽에서 볼 것을 켜 주세요');
      box.appendChild(h);
    }
  }
  on.forEach(src => {
    const d = box.querySelector('[data-src="' + src + '"]');
    if (!d) return;
    let icon, text, lit;
    if (!inputReady(src)) {
      icon = src === 'sound' ? 'fa-microphone-slash' : 'fa-video-slash';
      text = T(src === 'sound' ? '마이크를 켜는 중이에요' : '카메라를 켜 주세요');
      lit = false;
    } else if (slots[src]) {
      const r = results[src];
      icon = 'fa-cube';
      if (!r || r.state === 'none') { text = T('안 보여요'); lit = false; }
      else if (r.state === 'idk') { text = T('모르겠어요'); lit = false; }
      else { text = r.label + ' ' + Math.round(r.prob * 100) + '%'; lit = true; }
    } else {
      const v = describe(src, sigs[src]);
      icon = v.icon; text = T(v.text); lit = v.on;
    }
    d.querySelector('.nc-ic').className = 'fa-solid nc-ic ' + icon;
    d.querySelector('.nc-v').textContent = text;
    d.classList.toggle('lit', lit);
  });
}

function renderLive(now) {
  renderNow();
  if (mode === 'seq') tickSeq(now);
  else evalRules(now);
  updatePickerLive();
}

// ═══ 배경 놀이 ═══
const BG = [
  ['off', '그대로', 'fa-ban', ''],
  ['erase', '지우개', 'fa-eraser', ''],
  ['blur', '흐리기', 'fa-droplet', ''],
  ['green', '초록', 'fa-fill-drip', '#35CE68'],
  ['blue', '파랑', 'fa-fill-drip', '#3D8BFF'],
];

function renderBg() {
  const box = $('bgPick');
  box.innerHTML = '';
  BG.forEach(([v, ko, icon, color]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (bgMode === v ? ' on' : '');
    b.innerHTML = '<span class="sw-dot"' + (color ? ' style="background:' + color + ';color:#fff"' : '') + '>' +
      '<i class="fa-solid ' + icon + '"></i></span><span class="sw-nm">' + esc(T(ko)) + '</span>';
    b.addEventListener('click', () => {
      bgMode = v;
      bgfx.setMode(v);
      if (v !== 'off' && !stream) camOn();
      renderBg();
    });
    box.appendChild(b);
  });
}

// ═══ 목소리 버튼 ═══
function renderVoice() {
  const b = $('voiceBtn');
  const ok = canSpeak(LANG());
  b.disabled = !ok;
  b.classList.toggle('on', ok && voiceOn);
  b.innerHTML = ok
    ? '<i class="fa-solid ' + (voiceOn ? 'fa-volume-high' : 'fa-volume-xmark') + '"></i>' +
      esc(voiceOn ? T('소리로 말해요') : T('소리 꺼짐'))
    : '<i class="fa-solid fa-volume-xmark"></i>' + esc(T('이 기기에는 쓸 수 있는 목소리가 없어요'));
}

// ═══ 모드 ═══
function setMode(next) {
  mode = next === 'seq' ? 'seq' : 'rule';
  document.querySelectorAll('#modeTabs button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  $('ruleOut').style.display = mode === 'rule' ? '' : 'none';
  $('seqOut').style.display = mode === 'seq' ? '' : 'none';
  document.body.classList.toggle('flow-view', ruleView === 'flow' && mode === 'rule');
  stopSpeaking();
  ruleCand = -1; ruleSpoken = -1; ruleOffAt = 0;
  seqRestart();
  if (mode === 'seq') renderSteps(); else renderRules();
}

function renderAll() {
  renderCards();
  if (mode === 'seq') renderSteps(); else renderRules();
  renderNow();
}

// ═══ 저장 (새로고침해도 이어진다) ═══
function save() {
  if (restoring) return;
  try {
    const str = JSON.stringify({ v: 1, mode, use, rules, steps, voiceOn, bg: bgMode });
    if (str === lastSavedStr) return;
    lastSavedStr = str;
    localStorage.setItem(STATE_KEY, str);
  } catch (e) { /* 무시 */ }
}

const okCond = c => c && SRCS.includes(c.src) && typeof c.v === 'string' && /^[sc]:/.test(c.v);

async function restore() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STATE_KEY) || 'null'); } catch (e) { /* 무시 */ }
  if (!s || s.v !== 1) return;
  restoring = true;
  try {
    for (const src of SRCS) {
      const v = s.use && typeof s.use[src] === 'string' ? s.use[src] : '';
      await setUse(src, v);
    }
    rules = Array.isArray(s.rules) ? s.rules.slice(0, MAX_RULES).map(r => ({
      say: typeof r.say === 'string' ? r.say.slice(0, 30) : '',
      op: r.op === 'OR' ? 'OR' : 'AND',
      conds: Array.isArray(r.conds) ? r.conds.filter(okCond).slice(0, MAX_CONDS) : [],
    })) : [];
    steps = Array.isArray(s.steps) ? s.steps.filter(okCond).slice(0, MAX_STEPS) : [];
    voiceOn = s.voiceOn !== false;
    if (BG.some(b => b[0] === s.bg)) { bgMode = s.bg; bgfx.setMode(bgMode); }
    mode = s.mode === 'seq' ? 'seq' : 'rule';
  } catch (e) { console.error(e); }
  restoring = false;
}

// ═══ 이벤트 ═══
$('camBtn').addEventListener('click', () => (stream ? camStop() : camOn()));
$('camSel').addEventListener('change', () => { if (stream) { camStop(); camOn(); } });
$('camVid').addEventListener('loadedmetadata', syncAspect);
document.querySelectorAll('#modeTabs button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
$('ruleAdd').addEventListener('click', () => {
  if (rules.length >= MAX_RULES) return;
  // 규칙을 만들자마자 첫 조건부터 고르게 한다 (빈 칸을 보고 멈추지 않게)
  openPicker(T('무엇을 하면 될까요?'), pick => {
    rules.push({ say: '', op: 'AND', conds: [pick] });
    renderRules();
    const inputs = document.querySelectorAll('#ruleList .say');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });
});
$('seqAdd').addEventListener('click', () => {
  if (steps.length >= MAX_STEPS) { toast(T('단계는 8개까지예요')); return; }
  openPicker(T('다음에 무엇을 할까요?'), pick => { steps.push(pick); seqRestart(); renderSteps(); });
});
$('seqReset').addEventListener('click', () => { seqRestart(); updateSteps(); });
document.querySelectorAll('#ruleView button').forEach(b => b.addEventListener('click', () => setRuleView(b.dataset.v)));
$('voiceBtn').addEventListener('click', () => {
  voiceOn = !voiceOn;
  if (!voiceOn) stopSpeaking();
  else speak(T('안녕!'), LANG());         // 켜자마자 들려준다 (사용자가 누른 순간이라 막히지 않는다)
  renderVoice();
});
$('pkClose').addEventListener('click', closePicker);
$('picker').addEventListener('click', e => { if (e.target === $('picker')) closePicker(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('picker').hidden) closePicker(); });
window.addEventListener('storage', e => { if (e.key === THR_KEY) threshold = readThreshold(); });
onVoicesChanged(renderVoice);

const bgfx = createBgFx($('camVid'), $('bgCv'));

// ═══ 체험하기에서 들어올 때 — 주소의 ?a= 로 그 기능만 바로 켠다 ═══
// look: 손 · 얼굴 그냥 보기 · sound: 소리 그냥 보기 · bg: 배경 놀이 · flow: 만들기(규칙 · 순서 놀이) — 그대로
async function applyPreset() {
  const q = new URLSearchParams(location.search);
  const a = q.get('a');
  setRuleView(a === 'flow' || (!a && q.get('m') !== 'try') ? 'flow' : 'chip');
  if (q.get('m') === 'try') document.body.classList.add('try-mode');   // 체험에서는 놀이(규칙 · 순서) 칸을 접는다
  if (a === 'look') {
    for (const s of SRCS) await setUse(s, (s === 'hand' || s === 'face') ? WATCH : '');
    camOn();
  } else if (a === 'sound') {
    for (const s of SRCS) await setUse(s, s === 'sound' ? WATCH : '');
  } else if (a === 'bg') {
    for (const s of SRCS) await setUse(s, '');
    bgMode = 'blur'; bgfx.setMode(bgMode);
    camOn();
  }
}

// ═══ 시작 ═══
(async function init() {
  try { allRecs = await Store.list(); } catch (e) { console.error(e); }
  await restore();
  await applyPreset();
  setCamBtn(false);
  renderBg();
  renderVoice();
  setMode(mode);
  renderAll();
  syncEngines();
  navigator.mediaDevices && listCams();
  loop();
})();
