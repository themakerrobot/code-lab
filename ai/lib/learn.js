// ═══════════════════════════════════════════════════════════
// 학습실 — 예시 모으기 → 배우기 → 결과 → 저장
// ═══════════════════════════════════════════════════════════
// 소스(이미지·손·얼굴·포즈·소리)마다 "숫자로 바꾸는 방법"만 다르고,
// 그 뒤(모으기·배우기·저장)는 전부 같은 길을 쓴다.

import { loadEmbedder, cropTo, thumbFrom, EMBEDDER } from './embedder.js';
import { loadLandmarker, drawResult } from './landmarker.js';
import { createSoundEngine, preloadSound, drawLevels } from './sound.js';
import { extract, observeRows } from './features.js';
import { accentColor, accentRgba, warnColor } from './theme.js';
import { trainModel } from './trainer.js';
import { serialize } from './classifier.js';
import { Store, examplesToRecord, examplesFromRecord } from './project.js';
import {
  SOURCE_LIST, SOURCE_HINT, VARIANT_UI, variantsOf, defaultVariant,
  dimOfSource, extractorSpec, isImageSource, isLandmarkSource, isSoundSource,
  applySoundTransform, soundTransformOf, SOUND_TRANSFORM,
} from './sources.js';

const $ = id => document.getElementById(id);
const T = s => (typeof GL_T === 'function' ? GL_T(s) : s);

const MAX_CLASSES = 10;
const MAX_SAMPLES = 200;        // 종류 하나에 모을 수 있는 예시 수
const CAP_INTERVAL = 100;       // 꾹 누르는 동안 초당 10장
const SEE_INTERVAL = 90;        // 화면 미리보기·특징 뽑기 주기 (약 11Hz)
const SHOW_NUMS = 24;           // 이미지 임베딩에서 화면에 보여 줄 앞쪽 개수

let source = 'image';
let variant = null;
let engineBusy = false;

let emb = null;                 // 이미지 임베더
let lm = null;                  // 지금 쓰는 랜드마커
const snd = createSoundEngine();

let stream = null;
let classes = [];               // [{ name, vecs: [Float32Array], thumbs: [dataURL] }]
let selected = -1;
let capturing = false, lastCap = 0, lastSee = 0;
let lastVec = null, lastResult = null;
let trained = null;             // { model, accuracy, confusion, history, classes, saved }
let training = false;

// 이미지 소스: 화면의 미리보기 캔버스가 곧 학습 입력이다 (Teachable Machine 과 같다)
const camCv = $('camCv');
// 사진 파일은 미리보기를 건드리지 않게 따로 만든 캔버스에 그린다
const fileCv = document.createElement('canvas');
fileCv.width = EMBEDDER.inputSize;
fileCv.height = EMBEDDER.inputSize;
// 랜드마크·소리 예시의 썸네일을 만들 때 쓰는 캔버스
const thumbCv = document.createElement('canvas');
thumbCv.width = 96; thumbCv.height = 96;

// ── 알림 ──
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

// ── 단계 표시 ──
function steps() {
  const st = [
    classes.length > 0,
    classes.some(c => c.vecs.length > 0),
    !!trained,
    !!(trained && trained.saved),
  ];
  [1, 2, 3, 4].forEach((n, i) => {
    const el = $('s' + n);
    el.classList.toggle('done', st[i]);
    el.classList.toggle('on', !st[i] && (i === 0 || st[i - 1]));
  });
}

function progress(label, pct, ratio) {
  $('prgLabel').textContent = label;
  $('prgPct').textContent = pct == null ? '' : pct;
  if (ratio != null) $('prgFill').style.width = Math.round(ratio * 100) + '%';
}

// ── 소스 고르기 ──
function renderSrcPick(pending) {
  const box = $('srcPick');
  const cur = pending || source;
  if (!box.children.length) {
    SOURCE_LIST.forEach(s => {
      const b = document.createElement('button');
      b.className = 'db';
      b.dataset.src = s.id;
      b.innerHTML = '<i class="fa-solid ' + s.icon + '"></i> ' + T(s.label);
      b.addEventListener('click', () => pickSource(s.id));
      box.appendChild(b);
    });
  }
  Array.from(box.children).forEach(b => b.classList.toggle('on', b.dataset.src === cur));
}

function setSrcSpin(id, on) {
  const ic = document.querySelector('#srcPick [data-src="' + id + '"] i');
  if (!ic) return;
  if (on) {
    if (!ic.dataset.icon) ic.dataset.icon = ic.className;
    ic.className = 'fa-solid fa-spinner fa-spin';
  } else if (ic.dataset.icon) {
    ic.className = ic.dataset.icon;
  }
}

// 엔진 캐시 — 한 번 만든 랜드마커는 버리지 않는다 (소스를 오갈 때 즉시 전환)
const lmCache = {};
function getLm(src) {
  if (!lmCache[src]) {
    lmCache[src] = loadLandmarker(src).catch(e => { lmCache[src] = null; throw e; });
  }
  return lmCache[src];
}

// 첫 소스가 준비된 뒤, 나머지 엔진을 조용히 하나씩 미리 만든다
let preloaded = false;
function preloadRest() {
  if (preloaded) return;
  preloaded = true;
  setTimeout(async () => {
    try { await loadEmbedder(); } catch (e) { /* 무시 */ }
    for (const s of ['hand', 'face', 'pose']) {
      try { await getLm(s); } catch (e) { /* 누를 때 다시 시도한다 */ }
    }
    preloadSound();
  }, 1200);
}

async function useSource(next) {
  if (engineBusy) return;
  engineBusy = true;
  setSrcSpin(next, true);
  $('engine').textContent = T('준비 중…');
  lm = null;
  let ok = false;
  try {
    if (isImageSource(next)) emb = await loadEmbedder();
    else if (isSoundSource(next)) await preloadSound();
    else lm = await getLm(next);
    source = next;
    $('engine').textContent = T('준비 완료');
    progress(T('준비 완료'), '');
    preloadRest();
    ok = true;
  } catch (e) {
    console.error(e);
    $('engine').textContent = T('불러오지 못했어요');
    progress(T('불러오지 못했어요. 새로고침해 주세요'), '', 0);
  }
  setSrcSpin(next, false);
  engineBusy = false;
  applySrcUI();
  refreshUI();
  return ok;
}

function pickSource(next) {
  if (next === source || engineBusy) return;
  const hasData = classes.some(c => c.vecs.length > 0);
  if (hasData && !confirm(T('보는 것을 바꾸면 모은 예시가 지워져요. 바꿀까요?'))) return;
  // 입력 장치가 다르면 이전 것을 끈다 (소리 ↔ 카메라)
  if (isSoundSource(next)) camStop();
  else if (isSoundSource(source)) micStop();
  classes.forEach(c => { c.vecs = []; c.thumbs = []; });
  clearTrained();
  // 엔진을 못 올리면 소스는 그대로다 — 갈래도 이전 것으로 되돌려야 서로 맞는다
  const prevVariant = variant;
  variant = defaultVariant(next);
  renderSrcPick(next);
  renderClasses();
  useSource(next).then(ok => {
    if (!ok) { variant = prevVariant; toast(T('불러오지 못했어요. 새로고침해 주세요')); }
    renderSrcPick(); renderVariant(); refreshUI(); steps();
  });
}

// ── 갈래 토글 (한 손/두 손 · 상반신/전신) ──
function renderVariant() {
  const box = $('variantRow');
  const opts = variantsOf(source);
  if (!opts) { box.style.display = 'none'; box.innerHTML = ''; return; }
  const ui = VARIANT_UI[source];
  box.style.display = '';
  box.innerHTML = '';
  const lb = document.createElement('span');
  lb.className = 'lb2';
  lb.textContent = T(ui.q);
  box.appendChild(lb);
  const seg = document.createElement('div');
  seg.className = 'seg';
  opts.forEach(([v, ko]) => {
    const b = document.createElement('button');
    b.classList.toggle('on', variant === v);
    b.innerHTML = '<i class="fa-solid ' + ui.icons[v] + '"></i>' + T(ko);
    b.addEventListener('click', () => {
      if (variant === v) return;
      const hasData = classes.some(c => c.vecs.length > 0);
      if (hasData && !confirm(T('보는 것을 바꾸면 모은 예시가 지워져요. 바꿀까요?'))) return;
      classes.forEach(c => { c.vecs = []; c.thumbs = []; });
      clearTrained();
      variant = v;
      renderClasses(); renderVariant(); refreshUI(); steps();
    });
    seg.appendChild(b);
  });
  box.appendChild(seg);
}

// ── 소스에 맞게 가운데 패널을 바꾼다 ──
function applySrcUI() {
  const box = $('camBox');
  box.className = isImageSource(source) ? 'm-image' : (isSoundSource(source) ? 'm-sound' : 'm-landmark');
  if (isImageSource(source)) box.style.aspectRatio = '1 / 1';
  else if (isSoundSource(source)) box.style.aspectRatio = '4 / 3';
  else syncAspect();

  const mic = isSoundSource(source);
  $('panCTitle').textContent = mic ? T('마이크 & 예시') : T('카메라 & 예시');
  $('privNote').textContent = mic
    ? T('들리는 소리는 이 컴퓨터 밖으로 나가지 않아요')
    : (isImageSource(source)
      ? T('여기 보이는 그대로 AI가 배워요. 사진은 이 컴퓨터 밖으로 나가지 않아요')
      : T('찍은 영상은 이 컴퓨터 밖으로 나가지 않아요'));

  const on = mic ? snd.running : !!stream;
  $('camOff').style.display = on ? 'none' : '';
  $('camOff').querySelector('i').className = 'fa-solid fa-2x ' + (mic ? 'fa-microphone-slash' : 'fa-video-slash');
  $('camOff').querySelector('span').textContent = mic ? T('마이크가 꺼져 있어요') : T('카메라가 꺼져 있어요');
  setInputBtn(on);

  $('capBtn').innerHTML = '<i class="fa-solid ' + (mic ? 'fa-microphone-lines' : 'fa-camera-retro') + '"></i> ' +
    (mic ? T('꾹 눌러서 소리 모으기') : T('꾹 눌러서 예시 모으기'));
  $('addFiles').style.display = isImageSource(source) ? '' : 'none';
  $('seeHint').textContent = T(SOURCE_HINT[source]);
  lastVec = null; lastResult = null;
  clearCam();
  renderSee(false);
  listInputs();
}

function setInputBtn(on) {
  const mic = isSoundSource(source);
  const icon = mic ? (on ? 'fa-microphone-slash' : 'fa-microphone') : (on ? 'fa-video-slash' : 'fa-video');
  const txt = mic ? (on ? T('마이크 끄기') : T('마이크 켜기')) : (on ? T('카메라 끄기') : T('카메라 켜기'));
  $('camBtn').innerHTML = '<i class="fa-solid ' + icon + '"></i> ' + txt;
}

function clearCam() {
  camCv.getContext('2d').clearRect(0, 0, camCv.width, camCv.height);
  const ov = $('ovCv');
  if (ov.width) ov.getContext('2d').clearRect(0, 0, ov.width, ov.height);
  const mc = $('micCv');
  if (mc.width) mc.getContext('2d').clearRect(0, 0, mc.width, mc.height);
}

// ── 입력 장치 목록 ──
async function listInputs() {
  const sel = $('camSel');
  const kind = isSoundSource(source) ? 'audioinput' : 'videoinput';
  try {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === kind);
    const cur = sel.value;
    sel.innerHTML = '';
    devs.forEach((d, i) => {
      const o = document.createElement('option');
      o.value = d.deviceId;
      const full = d.label || (T(isSoundSource(source) ? '마이크' : '카메라') + ' ' + (i + 1));
      const cut = full.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '').trim();
      o.textContent = cut.length > 22 ? cut.slice(0, 21) + '…' : cut;
      o.title = full;
      sel.appendChild(o);
    });
    if (cur && devs.some(d => d.deviceId === cur)) sel.value = cur;
  } catch (e) { /* 무시 */ }
}

// ── 카메라 ──
async function camOn() {
  if (stream) return true;
  try {
    const want = { width: { ideal: 640 }, height: { ideal: 480 } };
    if ($('camSel').value) want.deviceId = { exact: $('camSel').value };
    stream = await navigator.mediaDevices.getUserMedia({ video: want, audio: false });
    $('camVid').srcObject = stream;
    await $('camVid').play();
    syncAspect();
    $('camOff').style.display = 'none';
    setInputBtn(true);
    await listInputs();
    refreshUI();
    return true;
  } catch (e) {
    toast(T('카메라가 안 보여요. 연결을 확인해 주세요'));
    return false;
  }
}

function camStop() {
  stopCap();
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  $('camVid').srcObject = null;
  if (!isSoundSource(source)) {
    $('camOff').style.display = '';
    setInputBtn(false);
  }
  lastVec = null; lastResult = null;
  clearCam();
  renderSee(false);
  refreshUI();
}

// ── 마이크 ──
async function micOn() {
  if (snd.running) return true;
  try {
    await snd.start($('camSel').value || undefined);
    $('camOff').style.display = 'none';
    setInputBtn(true);
    await listInputs();
    refreshUI();
    return true;
  } catch (e) {
    console.error(e);
    toast(T('마이크가 안 보여요. 연결을 확인해 주세요'));
    return false;
  }
}

function micStop() {
  stopCap();
  snd.stop();
  if (isSoundSource(source)) {
    $('camOff').style.display = '';
    setInputBtn(false);
  }
  lastVec = null;
  clearCam();
  renderSee(false);
  refreshUI();
}

// 소리 틱: 최근 창(0.975초) 분류가 나올 때마다 (250ms 주기)
snd.onTick = latest => {
  if (training || !isSoundSource(source)) return;
  // 화면에는 날것 점수를 보여 주고(어떤 소리인지 읽히게), 배우는 데에는 다듬은 값을 쓴다
  lastVec = latest.vec;
  lastResult = latest;
  renderSee(true);
  if (capturing && selected >= 0) {
    addSample(applySoundTransform(lastVec, SOUND_TRANSFORM), soundThumb());
  }
};

function camReady() { return !!(stream && $('camVid').videoWidth); }

// 랜드마크 소스: 카메라 상자를 실제 영상 비율에 맞춘다
function syncAspect() {
  if (!isLandmarkSource(source)) return;
  const v = $('camVid');
  if (v.videoWidth) $('camBox').style.aspectRatio = v.videoWidth + ' / ' + v.videoHeight;
}

// ── 감지 루프 ──
function loop() {
  requestAnimationFrame(loop);
  // 배우는 동안은 쉰다 — GPU 를 잡고 있으면 학습이 느려진다
  if (training) return;

  if (isSoundSource(source)) {
    if (snd.running) drawLevels($('micCv'), snd.levels, accentColor());
    return;
  }
  if (!camReady()) return;

  const now = performance.now();

  if (isImageSource(source)) {
    if (!emb) return;
    // 미리보기는 매 프레임 그린다 (끊기지 않게). 웹캠은 거울 —
    // Teachable Machine 의 Webcam(w, h, flip=true) 과 같다
    if (!cropTo($('camVid'), camCv, EMBEDDER.inputSize, EMBEDDER.mirror)) return;
    // 특징 뽑기는 SEE_INTERVAL 마다
    if (now - lastSee < SEE_INTERVAL) return;
    lastSee = now;
    try { lastVec = emb.embed(camCv); } catch (e) { return; }
    renderSee(true);
    if (capturing && lastVec && selected >= 0 && now - lastCap > CAP_INTERVAL) {
      lastCap = now;
      addSample(lastVec, thumbFrom(camCv));
    }
    return;
  }

  // 손 · 얼굴 · 포즈
  if (!lm) return;
  if (now - lastSee < SEE_INTERVAL) return;
  lastSee = now;
  const video = $('camVid');
  let result = null;
  try { result = lm.detect(video, performance.now()); } catch (e) { return; }
  lastResult = result;
  lastVec = extract(source, result, variant);

  const cv = $('ovCv');
  if (cv.width !== video.videoWidth || cv.height !== video.videoHeight) {
    cv.width = video.videoWidth; cv.height = video.videoHeight;
    syncAspect();
  }
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (lastVec) drawResult(ctx, source, result, variant);
  renderSee(!!lastVec);

  if (capturing && lastVec && selected >= 0 && now - lastCap > CAP_INTERVAL) {
    lastCap = now;
    addSample(lastVec, videoThumb());
  }
}

// ── AI가 보는 숫자 ──
function renderSee(on) {
  const state = $('seeState');
  const empty = $('seeEmpty');
  const table = $('seeTable');
  const flat = $('seeFlat');
  const mic = isSoundSource(source);

  if (!on || !lastVec) {
    state.textContent = T(mic ? '안 들려요' : '아직 안 봐요');
    state.style.color = 'var(--ink3)';
    table.style.display = 'none';
    flat.style.display = 'none';
    empty.style.display = '';
    empty.textContent = mic
      ? T(snd.running ? '소리를 듣는 중이에요' : '마이크를 켜면 숫자가 나와요')
      : T(camReady() ? '아직 안 보여요. 카메라 앞에 서 보세요' : '카메라를 켜면 숫자가 나와요');
    return;
  }

  state.textContent = T(mic ? '들려요' : '보고 있어요');
  state.style.color = 'var(--acc-ink)';
  empty.style.display = 'none';

  if (isImageSource(source)) {
    table.style.display = 'none';
    flat.style.display = '';
    const head = [];
    for (let i = 0; i < SHOW_NUMS && i < lastVec.length; i++) head.push(lastVec[i].toFixed(3));
    flat.textContent = head.join(' ') + ' …';
    return;
  }

  flat.style.display = 'none';
  table.style.display = '';
  if (mic) {
    const rows = (lastResult && lastResult.top) || [];
    let html = '<tr><th>' + T('이름') + '</th><th>' + T('값') + '</th></tr>';
    rows.forEach(r => { html += '<tr><td>' + esc(r.name) + '</td><td>' + r.score.toFixed(3) + '</td></tr>'; });
    table.innerHTML = html;
    return;
  }
  const rows = observeRows(source, lastResult, variant) || [];
  const isFace = source === 'face';
  let html = isFace
    ? '<tr><th>' + T('이름') + '</th><th>' + T('값') + '</th></tr>'
    : '<tr><th>' + T('점') + '</th><th>x</th><th>y</th><th>z</th></tr>';
  rows.forEach(r => {
    html += '<tr><td>' + esc(r.label) + '</td>' +
      r.values.map(v => '<td>' + v.toFixed(3) + '</td>').join('') + '</tr>';
  });
  table.innerHTML = html;
}

// ── 종류(클래스) ──
function addClass() {
  const name = $('clsName').value.trim();
  if (!name) return;
  if (classes.some(c => c.name === name)) { toast(T('같은 이름이 이미 있어요')); return; }
  if (classes.length >= MAX_CLASSES) { toast(T('종류는 10개까지 만들 수 있어요')); return; }
  classes.push({ name, vecs: [], thumbs: [] });
  $('clsName').value = '';
  selected = classes.length - 1;
  clearTrained();
  renderClasses(); refreshUI(); steps();
}

function delClass(i) {
  classes.splice(i, 1);
  if (selected >= classes.length) selected = classes.length - 1;
  clearTrained();
  renderClasses(); refreshUI(); steps();
}

function delSample(ci, si) {
  const c = classes[ci];
  if (!c || !c.vecs[si]) return;
  c.vecs.splice(si, 1);
  c.thumbs.splice(si, 1);
  clearTrained();
  renderClasses(); refreshUI(); steps();
}

function renderClasses() {
  const box = $('clsList');
  box.innerHTML = '';
  classes.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'cls' + (i === selected ? ' on' : '');
    el.addEventListener('click', ev => {
      if (ev.target.closest('.del')) return;
      selected = i; renderClasses(); refreshUI();
    });
    const top = document.createElement('div');
    top.className = 'top';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = c.name;
    const ct = document.createElement('span'); ct.className = 'ct'; ct.textContent = c.vecs.length + T('장');
    const del = document.createElement('button');
    del.className = 'del'; del.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    del.title = T('지우기');
    del.addEventListener('click', () => delClass(i));
    top.appendChild(nm); top.appendChild(ct); top.appendChild(del);
    el.appendChild(top);

    if (c.thumbs.length) {
      const th = document.createElement('div'); th.className = 'thumbs';
      c.thumbs.forEach((src, si) => th.appendChild(thumbEl(i, si, src)));
      el.appendChild(th);
    }
    box.appendChild(el);
  });
  $('clsHint').style.display = classes.length ? 'none' : '';
}

// ── 예시 모으기 ──
// 저장하는 것은 숫자(특징 벡터)와 작은 썸네일뿐이다. 원본 사진·소리는 남기지 않는다.
function addSample(vec, thumbSrc) {
  const c = classes[selected];
  if (!c) return;
  if (c.vecs.length >= MAX_SAMPLES) {
    stopCap();                  // 꽉 찼으면 꾹 누르고 있어도 더 안 모은다
    toast(T('예시는 종류마다 200장까지예요'));
    return;
  }
  c.vecs.push(Float32Array.from(vec));
  c.thumbs.push(thumbSrc);
  if (trained) clearTrained();
  // 초당 10장씩 들어오므로 목록 전체를 다시 그리지 않고 카드 하나만 갱신한다
  if (!appendThumb(selected, c.vecs.length - 1, thumbSrc)) renderClasses();
  refreshUI(); steps();
}

// 종류 카드에 예시 하나를 붙인다. 카드가 없으면 false (전체를 다시 그린다)
function appendThumb(ci, si, src) {
  const el = $('clsList').children[ci];
  if (!el) return false;
  const ct = el.querySelector('.ct');
  if (ct) ct.textContent = classes[ci].vecs.length + T('장');
  let th = el.querySelector('.thumbs');
  if (!th) { th = document.createElement('div'); th.className = 'thumbs'; el.appendChild(th); }
  th.appendChild(thumbEl(ci, si, src));
  return true;
}

function thumbEl(ci, si, src) {
  const im = document.createElement('img');
  im.src = src;
  im.title = T('누르면 이 예시를 지워요');
  im.addEventListener('click', ev => { ev.stopPropagation(); delSample(ci, si); });
  return im;
}

// 랜드마크 예시 카드: 그 순간의 화면(거울)을 정사각형으로 잘라 둔다
function videoThumb() {
  cropTo($('camVid'), thumbCv, 96, true);
  return thumbCv.toDataURL('image/jpeg', 0.7);
}

// 소리 예시 카드: 그 순간의 소리 크기 파형
function soundThumb() {
  const ctx = thumbCv.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0C1114';
  ctx.fillRect(0, 0, 96, 96);
  ctx.fillStyle = accentColor();
  snd.levels.slice(-16).forEach((v, i) => {
    const h = Math.max(3, Math.min(1, v * 6) * 80);
    ctx.fillRect(i * 6 + 2, (96 - h) / 2, 4, h);
  });
  return thumbCv.toDataURL('image/png');
}

function inputReady() {
  if (isSoundSource(source)) return snd.running;
  if (isImageSource(source)) return camReady() && !!emb;
  return camReady() && !!lm;
}

function startCap() {
  if (selected < 0 || capturing || !inputReady()) return;
  capturing = true; lastCap = 0;
}
function stopCap() { capturing = false; }

// 사진 파일에서 예시 더하기 (이미지 소스 전용) — 웹캠 없이도 가르칠 수 있다.
// 파일은 뒤집지 않는다: 거울은 웹캠에만 건다 (TM 도 predict(image, flipped=false) 가 기본).
async function addFromFiles(files) {
  if (selected < 0 || !emb || !isImageSource(source)) return;
  let added = 0, failed = 0;
  for (const file of files) {
    if (!/^image\//.test(file.type)) { failed++; continue; }
    try {
      const bmp = await createImageBitmap(file);
      cropTo(bmp, fileCv, EMBEDDER.inputSize, false);
      bmp.close();
      const vec = emb.embed(fileCv);
      if (!vec) { failed++; continue; }
      const before = classes[selected].vecs.length;
      addSample(vec, thumbFrom(fileCv));
      if (classes[selected].vecs.length > before) added++;
    } catch (e) { failed++; }
  }
  if (added) toast(T('사진을 더했어요') + ': ' + added + T('장'));
  else if (failed) toast(T('사진을 읽지 못했어요'));
}

// ── 배우기 ──
function clearTrained() {
  if (trained) { trained.model.dispose(); trained = null; }
  $('resultSec').style.display = 'none';
  $('chartBox').style.display = 'none';
  refreshUI(); steps();
}

async function train() {
  const usable = classes.filter(c => c.vecs.length > 0);
  if (usable.length < 2) { toast(T('종류 2개에 예시가 있어야 해요')); return; }
  if (training) return;
  training = true;
  refreshUI();

  const dim = dimOfSource(source, variant);
  const vecs = [], labels = [];
  usable.forEach((c, i) => c.vecs.forEach(v => { vecs.push(v); labels.push(i); }));

  $('chartBox').style.display = '';
  const hist = [];
  try {
    const t0 = performance.now();
    const out = await trainModel(vecs, labels, usable.length, dim, (ep, total, rec) => {
      hist.push(rec);
      progress(T('배우는 중') + ' ' + ep + '/' + total,
        T('맞힌 비율') + ' ' + Math.round((rec.acc || 0) * 100) + '%', ep / total);
      drawChart(hist);
    });
    console.log('train took', Math.round(performance.now() - t0), 'ms');
    trained = Object.assign(out, { classes: usable.map(c => c.name), saved: false });
    progress(T('다 배웠어요'), T('맞힌 비율') + ' ' + Math.round(out.accuracy * 100) + '%', 1);
    showResult(out, usable);
    if (out.accuracy < 0.85) toast(T('아직 헷갈려 해요. 예시를 더 모아 볼까요?'));
    else toast(T('잘 배웠어요! 이제 시험해 보세요'));
  } catch (e) {
    console.error(e);
    progress(T('배우다가 멈췄어요. 다시 해 보세요'), '', 0);
  }
  training = false;
  refreshUI(); steps();
}

function showResult(out, usable) {
  $('resultSec').style.display = '';
  $('accBig').textContent = Math.round(out.accuracy * 100) + '%';
  $('accWord').textContent = T('맞힌 비율');

  const names = usable.map(c => c.name);
  let html = '<table><tr><th></th>' + names.map(n => '<th title="' + esc(n) + '">' + esc(n) + '</th>').join('') + '</tr>';
  out.confusion.forEach((row, i) => {
    const total = row.reduce((a, b) => a + b, 0) || 1;
    html += '<tr><th title="' + esc(names[i]) + '">' + esc(names[i]) + '</th>';
    row.forEach((v, j) => {
      const bg = accentRgba(((v / total) * 0.75).toFixed(3));
      html += '<td class="' + (i === j ? 'diag' : '') + '" style="background:' + bg + '">' + (v || '') + '</td>';
    });
    html += '</tr>';
  });
  $('cmWrap').innerHTML = html + '</table>';
}

// ── 학습 그래프 ──
function drawChart(hist) {
  const cv = $('chart');
  const W = cv.clientWidth || 280, H = cv.clientHeight || 110;
  if (cv.width !== W * 2) { cv.width = W * 2; cv.height = H * 2; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!hist.length) return;
  const pad = 6;
  const maxLoss = Math.max(0.001, ...hist.map(h => h.loss || 0));
  const px = i => pad + (W - 2 * pad) * (hist.length === 1 ? 1 : i / (hist.length - 1));
  const line = (get, color) => {
    ctx.beginPath();
    hist.forEach((h, i) => {
      const y = pad + (H - 2 * pad) * (1 - Math.max(0, Math.min(1, get(h))));
      i ? ctx.lineTo(px(i), y) : ctx.moveTo(px(i), y);
    });
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  };
  line(h => (h.loss || 0) / maxLoss, warnColor());
  line(h => h.acc || 0, accentColor());
}

// ── 저장 ──
async function saveModel() {
  if (!trained) return;
  const name = $('mdlName').value.trim();
  if (!name) { toast(T('모델 이름을 적어 주세요')); return; }
  try {
    const exists = await Store.get(name);
    if (exists && !confirm(T('같은 이름이 있어요. 바꿔 쓸까요?'))) return;
    const usable = classes.filter(c => c.vecs.length > 0);
    const dim = dimOfSource(source, variant);
    const packed = await serialize(trained.model, trained.classes, dim);
    await Store.save({
      name,
      kind: source,
      source,
      variant,
      classes: trained.classes,
      sampleCounts: usable.map(c => c.vecs.length),
      accuracy: trained.accuracy,
      embedder: extractorSpec(source, variant),
      classifier: packed,
      // 예시도 함께 저장한다 — 다음에 이어서 모으고 다시 배울 수 있다
      examples: examplesToRecord(usable, dim),
      createdAt: new Date().toISOString(),
    });
    trained.saved = true;
    toast(T('저장했어요') + ': ' + name);
  } catch (e) {
    console.error(e);
    toast(T('저장하지 못했어요'));
  }
  steps();
}

// ── 버튼 상태 ──
function refreshUI() {
  const ready = inputReady() && !training;
  $('capBtn').disabled = !(ready && selected >= 0);
  $('addFiles').disabled = training || !(isImageSource(source) && emb && selected >= 0);
  $('selInfo').textContent = selected >= 0
    ? T('고른 종류') + ': ' + classes[selected].name
    : T('종류를 골라 주세요');
  $('selInfo').classList.toggle('on', selected >= 0);
  const shot = classes.filter(c => c.vecs.length > 0).length;
  $('trainBtn').disabled = training || shot < 2;
  $('mdlSave').disabled = !trained;
}

// ── 이벤트 연결 ──
$('clsAdd').addEventListener('click', addClass);
$('clsName').addEventListener('keydown', e => { if (e.key === 'Enter') addClass(); });
$('camBtn').addEventListener('click', () => {
  if (isSoundSource(source)) return snd.running ? micStop() : micOn();
  return stream ? camStop() : camOn();
});
$('camSel').addEventListener('change', () => {
  if (isSoundSource(source)) { if (snd.running) { micStop(); micOn(); } }
  else if (stream) { camStop(); camOn(); }
});
$('camVid').addEventListener('loadedmetadata', syncAspect);
const cap = $('capBtn');
cap.addEventListener('pointerdown', e => { cap.setPointerCapture(e.pointerId); startCap(); });
cap.addEventListener('pointerup', stopCap);
cap.addEventListener('pointercancel', stopCap);
cap.addEventListener('contextmenu', e => e.preventDefault());
$('addFiles').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', async e => {
  const files = Array.from(e.target.files || []);
  e.target.value = '';
  await addFromFiles(files);
});
$('trainBtn').addEventListener('click', train);
$('mdlSave').addEventListener('click', saveModel);

// ── 이어서 배우기 (?load=모델이름) ──
async function restoreWork(name) {
  try {
    const rec = await Store.get(name);
    if (!rec || !rec.examples || !rec.examples.length) { toast(T('이어 할 예시가 없어요')); return; }
    const dim = rec.embedder ? rec.embedder.dim : dimOfSource(source, variant);
    classes = examplesFromRecord(rec.examples, dim);
    // 옛 소리 모델은 날것 점수로 모았다. 지금 방식으로 맞춰 둔다 —
    // 안 그러면 이어서 모은 새 예시와 섞여서 학습이 망가진다.
    if (isSoundSource(source) && soundTransformOf(rec.embedder) !== SOUND_TRANSFORM) {
      classes.forEach(c => { c.vecs = c.vecs.map(v => applySoundTransform(v, SOUND_TRANSFORM)); });
      console.log('옛 소리 모델의 예시를', SOUND_TRANSFORM, '로 맞췄습니다');
    }
    selected = 0;
    $('mdlName').value = rec.name;
    renderClasses(); refreshUI(); steps();
    toast(T('이어서 시작해요') + ': ' + name);
  } catch (e) {
    console.error(e);
    toast(T('모델을 불러오지 못했어요'));
  }
}

// ── 시작 ──
const loadName = new URLSearchParams(location.search).get('load');
if (loadName) {
  // 소스는 저장해 둔 것을 따른다 — 기본(이미지)을 먼저 올렸다가 바꾸지 않는다
  Store.get(loadName).then(rec => {
    if (rec && rec.source) { source = rec.source; variant = rec.variant || null; }
    renderSrcPick();
    return useSource(source);
  }).then(() => { renderVariant(); return restoreWork(loadName); });
} else {
  renderSrcPick();
  useSource(source);
}
renderVariant();
navigator.mediaDevices && listInputs();
loop();
steps();
refreshUI();
