// ═══════════════════════════════════════════════════════════
// 소리 엔진 — 마이크 + YAMNet 분류 (MediaPipe Tasks Audio)
// ═══════════════════════════════════════════════════════════
// 전부 셀프호스팅이다: wasm 은 vendor/tasks-audio/, 모델은 models/yamnet.tflite.
//
//  · YAMNet 은 소리 한 창(0.975초)을 521가지 점수로 바꾼다 — 이 521차원이
//    손의 63차원 좌표와 똑같은 "특징 벡터"가 되어 그대로 학습에 들어간다
//  · 마이크는 16kHz 모노로 받는다 (YAMNet 기대 입력. 브라우저가 리샘플한다)
//  · 250ms 마다 최근 창을 분류한다 — 수집·실시간 표시 공용
//  · 소리는 어디로도 전송하지 않는다. 녹음 파일도 만들지 않는다

import { FilesetResolver, AudioClassifier } from '../vendor/tasks-audio/audio_bundle.mjs';

const WASM_DIR = './vendor/tasks-audio';
const MODEL = './models/yamnet.tflite';
const RATE = 16000;            // YAMNet 입력 샘플레이트
const TICK_MS = 250;           // 분류 주기
export const SOUND_DIM = 521;

// YAMNet 한 창의 길이. 16000(1초)이 아니라 15600(0.975초)이다.
// 1초를 통째로 넣으면 MediaPipe 가 창을 둘로 쪼개는데, 둘째 창은 400샘플만
// 진짜이고 나머지는 0으로 채운 것이라 늘 "Silence" 가 1등으로 나온다.
// 딱 한 창만 나오게 잘라서 넣는다.
export const WINDOW_SECONDS = 15600 / RATE;

let clfPromise = null;
function ensureClassifier() {
  if (!clfPromise) {
    clfPromise = FilesetResolver.forAudioTasks(WASM_DIR).then(fileset =>
      AudioClassifier.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL },
        maxResults: SOUND_DIM,       // 521개 점수 전부 받는다
      })).catch(e => { clfPromise = null; throw e; });   // 실패하면 다음에 다시 시도
  }
  return clfPromise;
}

// 미리 내려받기 (페이지 진입 시 불러두면 첫 켜기가 빠르다)
export function preloadSound() { return ensureClassifier().catch(() => {}); }

export async function listMics() {
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();
    return devs.filter(d => d.kind === 'audioinput');
  } catch (e) { return []; }
}

// createSoundEngine() → { start, stop, running, ready, latest, levels, onTick }
//  latest = { vec: Float32Array(521), top: [{name, score}…], level }
//  levels = 최근 소리 크기(RMS) 기록 — 파형 그리기용
export function createSoundEngine() {
  let ctx = null, srcNode = null, proc = null, stream = null;
  let timer = null, classifier = null;
  // 링 버퍼 길이는 실제 샘플레이트를 알아야 정해진다 (start 에서 만든다).
  // 기기가 16kHz 를 못 맞춰 줘도 "0.975초어치" 라는 뜻은 그대로 지킨다.
  let ring = null;
  let ringPos = 0, ringFilled = 0;
  let level = 0;
  // 켜는 중에 또 켜라고 하면 같은 약속을 돌려준다. 안 그러면 마이크 두 개가
  // 링 버퍼 하나에 번갈아 써서 소리가 뒤섞인다 (놀이실 새로고침에서 실제로 났다).
  let starting = null;
  let stopAsked = false;

  const eng = {
    running: false,
    ready: false,        // 첫 분류 결과가 나온 뒤 true
    latest: null,
    levels: [],
    onTick: null,

    start(deviceId) {
      if (eng.running) return Promise.resolve(true);
      if (starting) return starting;
      stopAsked = false;
      starting = open(deviceId)
        .then(() => {
          // 켜는 동안 끄라고 했으면 다 켠 뒤에 바로 끈다
          if (stopAsked) { teardown(); return false; }
          return true;
        }, e => { teardown(); throw e; })
        .finally(() => { starting = null; });
      return starting;
    },

    stop() {
      // 켜는 중이면 중간에 뜯지 않는다 — 다 켠 뒤 위에서 끈다
      if (starting) { stopAsked = true; return; }
      teardown();
    },
  };

  function teardown() {
    clearInterval(timer); timer = null;
    if (proc) { proc.disconnect(); proc.onaudioprocess = null; proc = null; }
    if (srcNode) { srcNode.disconnect(); srcNode = null; }
    if (ctx) { ctx.close().catch(() => {}); ctx = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    eng.running = false;
    eng.ready = false;
    eng.latest = null;
    eng.levels = [];
    ring = null; ringPos = 0; ringFilled = 0; level = 0;
  }

  async function open(deviceId) {
    classifier = await ensureClassifier();
    const want = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    if (deviceId) want.deviceId = { exact: deviceId };
    stream = await navigator.mediaDevices.getUserMedia({ audio: want, video: false });
    try { ctx = new AudioContext({ sampleRate: RATE }); }
    catch (e) { ctx = new AudioContext(); }   // 일부 기기는 샘플레이트 고정
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
      // 사용자 조작 없이 만들면 멈춰 있을 수 있다 → 다음 터치/클릭에서 다시 깨운다
      const wake = () => { ctx && ctx.resume().catch(() => {}); };
      document.addEventListener('click', wake, { once: true });
      document.addEventListener('touchend', wake, { once: true });
    }
    ring = new Float32Array(Math.round(WINDOW_SECONDS * ctx.sampleRate));
    ringPos = 0; ringFilled = 0;
    srcNode = ctx.createMediaStreamSource(stream);
    proc = ctx.createScriptProcessor(4096, 1, 1);
    proc.onaudioprocess = ev => {
      const ch = ev.inputBuffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < ch.length; i++) {
        ring[ringPos] = ch[i];
        ringPos = (ringPos + 1) % ring.length;
        sum += ch[i] * ch[i];
      }
      ringFilled = Math.min(ring.length, ringFilled + ch.length);
      level = Math.sqrt(sum / ch.length);
    };
    srcNode.connect(proc);
    proc.connect(ctx.destination);   // 연결해야 콜백이 돈다 (출력은 무음)
    timer = setInterval(tick, TICK_MS);
    eng.running = true;
  }

  function tick() {
    if (!classifier || !ring || ringFilled < ring.length) return;
    // 링 버퍼를 시간 순서대로 편다
    const buf = new Float32Array(ring.length);
    buf.set(ring.subarray(ringPos));
    buf.set(ring.subarray(0, ringPos), ring.length - ringPos);
    let results = null;
    try { results = classifier.classify(buf, ctx.sampleRate); } catch (e) { return; }
    // 창 하나만 나오도록 길이를 맞춰 두었지만, 혹시 여러 개가 나오면 첫 창을 쓴다.
    // 마지막 창은 0으로 채워진 꼬리라 늘 "Silence" 다.
    const r = results && results[0];
    const cats = r && r.classifications && r.classifications[0] && r.classifications[0].categories;
    if (!cats) return;
    const vec = new Float32Array(SOUND_DIM);
    for (const c of cats) if (c.index < SOUND_DIM) vec[c.index] = c.score;
    const top = cats.slice().sort((a, b) => b.score - a.score).slice(0, 8)
      .map(c => ({ name: c.categoryName, score: c.score }));
    eng.latest = { vec, top, level };
    eng.levels.push(level);
    if (eng.levels.length > 96) eng.levels.shift();
    eng.ready = true;
    if (eng.onTick) eng.onTick(eng.latest);
  }

  return eng;
}

// 파형 그리기 — 마이크 상자 캔버스에 최근 소리 크기를 막대로
export function drawLevels(cv, levels, color) {
  const W = cv.clientWidth || 300, H = cv.clientHeight || 160;
  if (cv.width !== W * 2) { cv.width = W * 2; cv.height = H * 2; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const n = 48;
  const bw = W / n;
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const v = levels[levels.length - n + i] || 0;
    const h = Math.max(2, Math.min(1, v * 6) * (H - 12));
    ctx.globalAlpha = 0.35 + 0.65 * (i / n);
    ctx.fillRect(i * bw + bw * 0.2, (H - h) / 2, bw * 0.6, h);
  }
  ctx.globalAlpha = 1;
}
