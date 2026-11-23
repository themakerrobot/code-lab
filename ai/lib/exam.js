// ═══════════════════════════════════════════════════════════
// 시험실 — 가르친 모델로 바로 맞혀 보기
// ═══════════════════════════════════════════════════════════
// TF.js 를 쓰지 않는다. 분류기는 lib/classifier.js 의 순수 JS 계산으로 돈다.
// 고른 모델에 적힌 소스(이미지·손·얼굴·포즈·소리)에 맞춰 입력을 바꾼다.

import { loadEmbedder, cropTo, EMBEDDER } from './embedder.js';
import { loadLandmarker, drawResult } from './landmarker.js';
import { createSoundEngine, preloadSound, drawLevels } from './sound.js';
import { extract, observeRows } from './features.js';
import { accentColor } from './theme.js';
import { deserialize, predict } from './classifier.js';
import { Store } from './project.js';
import {
  SOURCE_LIST, isImageSource, isLandmarkSource, isSoundSource, dimOfSource,
  applySoundTransform, soundTransformOf,
} from './sources.js';

const $ = id => document.getElementById(id);
const T = s => (typeof GL_T === 'function' ? GL_T(s) : s);

const SEE_INTERVAL = 90;        // 약 11Hz
const SHOW_NUMS = 24;
const THR_KEY = 'teachlab-threshold';

let source = 'image', variant = null;
let engineSource = null;        // 실제로 불러온 엔진 (아직 없으면 null)
let emb = null, lm = null;
const snd = createSoundEngine();
let stream = null;
let clf = null;                 // 지금 고른 분류기
let clfName = '';
let lastSee = 0, lastVec = null, lastResult = null;
let threshold = 0.6;
let holdUntil = 0;              // 사진 파일로 맞힌 답을 잠시 붙들어 두는 시각
let engineBusy = false;
let soundTransform = 'raw';     // 고른 모델이 배운 방식 (옛 모델은 날것)

const camCv = $('camCv');
const fileCv = document.createElement('canvas');
fileCv.width = EMBEDDER.inputSize;
fileCv.height = EMBEDDER.inputSize;

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

function srcLabel(id) {
  const m = SOURCE_LIST.find(s => s.id === id);
  return m ? T(m.label) : id;
}

// ── 모델 목록 ──
async function renderModels() {
  const box = $('mdlList');
  box.innerHTML = '';
  let list = [];
  try { list = await Store.list(); } catch (e) { console.error(e); }
  $('mdlHint').style.display = list.length ? 'none' : '';
  list.forEach(rec => {
    const el = document.createElement('div');
    el.className = 'mradio' + (rec.name === clfName ? ' on' : '');
    const nm = document.createElement('span');
    nm.className = 'nm'; nm.textContent = rec.name;
    const mt = document.createElement('span');
    mt.className = 'mt';
    mt.textContent = srcLabel(rec.source || 'image') + ' · ' + Math.round((rec.accuracy || 0) * 100) + '%';
    el.appendChild(nm); el.appendChild(mt);
    el.addEventListener('click', () => pickModel(rec.name));
    box.appendChild(el);
  });
}

async function pickModel(name) {
  if (engineBusy) return;
  let rec = null;
  try { rec = await Store.get(name); } catch (e) { console.error(e); }
  if (!rec) { toast(T('모델을 불러오지 못했어요')); return; }

  const nextSource = rec.source || 'image';
  const nextVariant = rec.variant || null;
  const wantDim = rec.embedder ? rec.embedder.dim : dimOfSource(nextSource, nextVariant);
  if (wantDim !== dimOfSource(nextSource, nextVariant)) {
    toast(T('이 모델은 지금 버전과 맞지 않아요'));
    return;
  }

  // 입력 장치가 바뀌면 이전 것을 끈다
  if (nextSource !== source) {
    if (isSoundSource(nextSource)) camStop();
    else if (isSoundSource(source)) micStop();
  }
  try {
    clf = deserialize(rec.classifier.json, rec.classifier.bin);
  } catch (e) {
    console.error(e);
    toast(T('모델을 불러오지 못했어요'));
    return;
  }
  clfName = rec.name;
  variant = nextVariant;
  soundTransform = soundTransformOf(rec.embedder);

  $('mdlInfo').innerHTML =
    T('무엇을 보나요') + ': ' + srcLabel(nextSource) + '<br>' +
    T('종류') + ': ' + esc(rec.classes.join(', ')) + '<br>' +
    T('예시') + ': ' + (rec.sampleCounts || []).reduce((a, b) => a + b, 0) + T('장') + '<br>' +
    T('맞힌 비율') + ': ' + Math.round((rec.accuracy || 0) * 100) + '%';

  if (nextSource !== engineSource) await useSource(nextSource);
  else { source = nextSource; applySrcUI(); }
  renderModels();
  refreshUI();
  renderAnswer(null);
}

// ── 엔진 ──
const lmCache = {};
function getLm(src) {
  if (!lmCache[src]) {
    lmCache[src] = loadLandmarker(src).catch(e => { lmCache[src] = null; throw e; });
  }
  return lmCache[src];
}

async function useSource(next) {
  engineBusy = true;
  $('engine').textContent = T('준비 중…');
  lm = null;
  try {
    if (isImageSource(next)) emb = await loadEmbedder();
    else if (isSoundSource(next)) await preloadSound();
    else lm = await getLm(next);
    source = next;
    engineSource = next;
    $('engine').textContent = T('준비 완료');
  } catch (e) {
    console.error(e);
    $('engine').textContent = T('불러오지 못했어요');
    toast(T('불러오지 못했어요. 새로고침해 주세요'));
  }
  engineBusy = false;
  applySrcUI();
  refreshUI();
}

function applySrcUI() {
  const box = $('camBox');
  box.className = isImageSource(source) ? 'm-image' : (isSoundSource(source) ? 'm-sound' : 'm-landmark');
  if (isImageSource(source)) box.style.aspectRatio = '1 / 1';
  else if (isSoundSource(source)) box.style.aspectRatio = '4 / 3';
  else syncAspect();

  const mic = isSoundSource(source);
  $('panCTitle').textContent = mic ? T('마이크') : T('카메라');
  $('privNote').textContent = mic
    ? T('들리는 소리는 이 컴퓨터 밖으로 나가지 않아요')
    : (isImageSource(source)
      ? T('여기 보이는 그대로 AI가 맞혀요. 사진은 이 컴퓨터 밖으로 나가지 않아요')
      : T('찍은 영상은 이 컴퓨터 밖으로 나가지 않아요'));

  const on = mic ? snd.running : !!stream;
  $('camOff').style.display = on ? 'none' : '';
  $('camOff').querySelector('i').className = 'fa-solid fa-2x ' + (mic ? 'fa-microphone-slash' : 'fa-video-slash');
  $('camOff').querySelector('span').textContent = mic ? T('마이크가 꺼져 있어요') : T('카메라가 꺼져 있어요');
  setInputBtn(on);
  $('addFiles').style.display = isImageSource(source) ? '' : 'none';
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

// ── 입력 장치 ──
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

// ── 카메라 · 마이크 ──
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
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  $('camVid').srcObject = null;
  if (!isSoundSource(source)) { $('camOff').style.display = ''; setInputBtn(false); }
  lastVec = null; lastResult = null;
  clearCam();
  renderSee(false);
  renderAnswer(null);
  refreshUI();
}

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
  snd.stop();
  if (isSoundSource(source)) { $('camOff').style.display = ''; setInputBtn(false); }
  lastVec = null;
  clearCam();
  renderSee(false);
  renderAnswer(null);
  refreshUI();
}

snd.onTick = latest => {
  if (!isSoundSource(source)) return;
  lastVec = latest.vec;
  lastResult = latest;
  renderSee(true);
  // 화면은 날것 점수, 맞히는 것은 학습할 때와 같은 방식으로 다듬은 값
  if (clf && lastVec) renderAnswer(predict(clf, applySoundTransform(lastVec, soundTransform)));
};

function camReady() { return !!(stream && $('camVid').videoWidth); }

function syncAspect() {
  if (!isLandmarkSource(source)) return;
  const v = $('camVid');
  if (v.videoWidth) $('camBox').style.aspectRatio = v.videoWidth + ' / ' + v.videoHeight;
}

// ── 루프 ──
function loop() {
  requestAnimationFrame(loop);
  if (isSoundSource(source)) {
    if (snd.running) drawLevels($('micCv'), snd.levels, accentColor());
    return;
  }
  if (!camReady()) return;
  const now = performance.now();
  // 사진 파일로 맞힌 직후에는 카메라가 답을 덮어쓰지 않게 잠시 기다린다
  if (now < holdUntil) return;

  if (isImageSource(source)) {
    if (!emb) return;
    // 미리보기는 매 프레임, 학습할 때와 똑같이: 거울 건 정사각형 (EMBEDDER.mirror)
    if (!cropTo($('camVid'), camCv, EMBEDDER.inputSize, EMBEDDER.mirror)) return;
    if (now - lastSee < SEE_INTERVAL) return;
    lastSee = now;
    try { lastVec = emb.embed(camCv); } catch (e) { return; }
    renderSee(true);
    if (clf && lastVec) renderAnswer(predict(clf, lastVec));
    return;
  }

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
  if (clf) renderAnswer(lastVec ? predict(clf, lastVec) : null);
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

// ── 답 · 확률 막대 ──
function renderAnswer(probs) {
  const ans = $('answer');
  const bars = $('exBars');
  if (!clf) {
    ans.textContent = T('모델을 골라 주세요');
    ans.className = 'answer idk';
    bars.innerHTML = '';
    return;
  }
  if (!probs) {
    // 입력은 켜져 있는데 아직 아무것도 안 잡힌 것(손·얼굴·포즈)과, 꺼져 있는 것은 다르다
    const mic = isSoundSource(source);
    const on = mic ? snd.running : camReady();
    ans.textContent = on ? T('아직 안 보여요') : (mic ? T('마이크를 켜 주세요') : T('카메라를 켜 주세요'));
    ans.className = 'answer idk';
    bars.innerHTML = renderBars(clf.classes.map(() => 0), -1);
    return;
  }
  let best = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
  const sure = probs[best] >= threshold;
  ans.textContent = sure ? clf.classes[best] : T('모르겠어요');
  ans.className = 'answer ' + (sure ? 'sure' : 'idk');
  bars.innerHTML = renderBars(probs, best);
}

function renderBars(probs, best) {
  let html = '';
  clf.classes.forEach((name, i) => {
    const p = probs[i] || 0;
    html += '<div class="bar' + (i === best ? ' top' : '') + '">' +
      '<div class="bl"><span>' + esc(name) + '</span><span class="num">' + Math.round(p * 100) + '%</span></div>' +
      '<div class="bt"><div class="bf" style="width:' + (p * 100).toFixed(1) + '%"></div></div></div>';
  });
  return html;
}

// ── 사진 파일로 시험하기 (이미지 소스 전용) ──
// 파일은 뒤집지 않는다 — 거울은 웹캠에만 건다 (학습할 때와 같은 규칙).
async function testFile(file) {
  if (!emb || !clf || !file || !isImageSource(source)) return;
  try {
    const bmp = await createImageBitmap(file);
    cropTo(bmp, fileCv, EMBEDDER.inputSize, false);
    bmp.close();
    const vec = emb.embed(fileCv);
    if (!vec) { toast(T('사진을 읽지 못했어요')); return; }
    lastVec = vec;
    renderSee(true);
    renderAnswer(predict(clf, vec));
    holdUntil = performance.now() + 2500;
    toast(T('사진으로 맞혔어요') + ': ' + file.name);
  } catch (e) {
    console.error(e);
    toast(T('사진을 읽지 못했어요'));
  }
}

// ── 확신 정도 ──
function setThreshold(v) {
  threshold = v / 100;
  $('thrVal').textContent = v + '%';
  try { localStorage.setItem(THR_KEY, String(v)); } catch (e) {}
}

function refreshUI() {
  $('addFiles').disabled = !(isImageSource(source) && emb && clf);
  $('camBtn').disabled = !clf;
}

// ── 이벤트 연결 ──
$('camBtn').addEventListener('click', () => {
  if (isSoundSource(source)) return snd.running ? micStop() : micOn();
  return stream ? camStop() : camOn();
});
$('camSel').addEventListener('change', () => {
  if (isSoundSource(source)) { if (snd.running) { micStop(); micOn(); } }
  else if (stream) { camStop(); camOn(); }
});
$('camVid').addEventListener('loadedmetadata', syncAspect);
$('thrRange').addEventListener('input', e => setThreshold(Number(e.target.value)));
$('addFiles').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', async e => {
  const f = (e.target.files || [])[0];
  e.target.value = '';
  await testFile(f);
});

// ── 시작 ──
(function initThreshold() {
  let v = 60;
  try {
    const saved = Number(localStorage.getItem(THR_KEY));
    if (saved >= 20 && saved <= 95) v = saved;
  } catch (e) {}
  $('thrRange').value = String(v);
  setThreshold(v);
})();

applySrcUI();
navigator.mediaDevices && listInputs();
renderModels().then(async () => {
  const use = new URLSearchParams(location.search).get('use');
  const list = await Store.list();
  if (use) await pickModel(use);
  else if (list.length === 1) await pickModel(list[0].name);
  else $('engine').textContent = T('준비 완료');
});
loop();
refreshUI();
