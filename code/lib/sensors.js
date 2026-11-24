// ═══════════════════════════════════════════════════════════
// 브라우저 센서 — 웹캠(손·얼굴·포즈) · 마이크(소리 크기·박수) · 내 AI
// ═══════════════════════════════════════════════════════════
// 파이썬(lib/sensor.py)이 처음 쓸 때 need(무엇) 으로 켠다.
// 인식 · 특징 · 분류는 가르치기와 같은 코드(ai/lib/)를 쓴다 — 가르칠 때와 똑같이 계산해야 맞힌다.
// 영상 · 소리는 이 컴퓨터 밖으로 나가지 않는다.
//
// 파이썬 워커는 돌고 있는 동안 메시지를 못 받으므로, 최신 값을 프레임마다 서비스
// 워커에 올려 두고(postState) 파이썬이 동기 요청(__codelab__/sensor)으로 가져간다.

import { loadLandmarker, drawResult } from '../../ai/lib/landmarker.js';
import { computeSignals } from '../../ai/lib/signals.js';
import { extract } from '../../ai/lib/features.js';
import { loadEmbedder, cropTo, EMBEDDER } from '../../ai/lib/embedder.js';
import { createSoundEngine } from '../../ai/lib/sound.js';
import { applySoundTransform } from '../../ai/lib/sources.js';

const POST_MS = 50;              // 서비스 워커에 값 올리는 간격
const CLAP_LEVEL = 0.18;         // 박수: 이 RMS 를 넘고
const CLAP_JUMP = 3;             //       바로 앞보다 이만큼 커지면 (갑자기 큰 소리)
const CLAP_GAP_MS = 250;

export class Sensors {
  constructor({ video, overlay, onCamera, onError }) {
    this.video = video;
    this.overlay = overlay;
    this.octx = overlay.getContext('2d');
    this.onCamera = onCamera || (() => {});
    this.onError = onError || (() => {});
    this.stream = null;
    this.landmarkers = {};       // source → { detect, close }
    this.active = new Set();     // 지금 돌리는 소스 (hand · face · pose)
    this.models = new Map();     // 지금 계산하는 내 AI: 이름 → 계산 준비된 모델 (my-ai.js)
    this.embedder = null;        // 사진 AI 용 (처음 쓸 때 불러온다)
    this.imgCv = document.createElement('canvas');
    this.snd = null;             // 소리 AI 용 (YAMNet — 가르치기와 같은 엔진)
    this.results = {};
    this.state = { ready: {}, error: {} };
    this.waitFirst = new Set();  // 켰지만 아직 첫 결과가 없는 것 — 결과가 나와야 '준비됨'
    this.rr = 0;
    this.raf = 0;
    this.audio = null;
    this.lastPost = 0;
    this.running = false;
  }

  // 실행이 시작되면 값을 올리기 시작한다 (모델 목록이라도 보이게)
  begin() {
    this.running = true;
    this.state = { ready: {}, error: {} };
    this._post(true);
  }

  async need(what) {
    try {
      if (what === 'off') { this.stopAll(); return; }
      if (what === 'sound') { await this._startMic(); this.waitFirst.add('sound'); return; }
      if (what.startsWith('model:')) {
        const name = what.slice(6);
        const m = await MyAI.load(name);
        if (m.source === 'image') {
          await this._startCamera();
          if (!this.embedder) this.embedder = await loadEmbedder();
        } else if (m.source === 'sound') {
          await this._startSoundAI();
        } else {
          await this._startSource(m.source);
        }
        this.models.set(name, m);
        this.waitFirst.add(what);
        return;
      }
      if (['hand', 'face', 'pose'].includes(what)) { await this._startSource(what); this.waitFirst.add(what); return; }
      throw new Error((window.AILAB && window.AILAB.lang === 'en' ? 'Unknown sensor: ' : '알 수 없는 센서예요: ') + what);
    } catch (e) {
      const msg = this._friendly(e);
      this.state.error[what] = msg;
      this._post(true);
      this.onError(msg);
    }
  }

  _friendly(e) {
    const n = e && e.name;
    const en = !!(window.AILAB && window.AILAB.lang === 'en');
    if (n === 'NotAllowedError' || n === 'SecurityError') return en ? 'Please allow the camera and mic' : '카메라·마이크를 쓰도록 허락해 주세요';
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return en ? 'No camera or mic found. Check the connection' : '카메라·마이크를 찾지 못했어요. 연결을 확인해 주세요';
    if (n === 'NotReadableError') return en ? 'Another app is using the camera or mic' : '카메라·마이크를 다른 곳에서 쓰고 있어요';
    return String(e && e.message || e);
  }

  _mark(what) {
    if (!this.waitFirst.has(what)) return;
    this.waitFirst.delete(what);
    this.state.ready[what] = true;
    delete this.state.error[what];
    this._post(true);
  }

  async _startCamera() {
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();
    this.onCamera(true);
    if (!this.raf) this.raf = requestAnimationFrame(() => this._frame());
  }

  async _startSource(src) {
    await this._startCamera();
    if (!this.landmarkers[src]) this.landmarkers[src] = await loadLandmarker(src);
    this.active.add(src);
  }

  // 소리로 배운 AI: 가르칠 때와 같은 YAMNet 점수 → 같은 변환 → 분류
  async _startSoundAI() {
    if (!this.snd) {
      this.snd = createSoundEngine();
      this.snd.onTick = latest => {
        const out = this.state.models || (this.state.models = {});
        for (const [name, m] of this.models) {
          if (m.source !== 'sound') continue;
          out[name] = MyAI.predict(m, applySoundTransform(latest.vec, m.transform));
          this._mark('model:' + name);
        }
      };
    }
    await this.snd.start();
  }

  async _startMic() {
    if (this.audio) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const ctx = new AudioContext();
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(an);
    this.audio = { stream, ctx, an, buf: new Float32Array(an.fftSize), prev: 0, clapAt: 0 };
    this.state.sound = { level: 0, clapAt: 0 };
    if (!this.raf) this.raf = requestAnimationFrame(() => this._frame());
  }

  // ── 한 프레임: 소스를 하나씩 돌아가며 감지 (저사양 노트북 기준) ──
  _frame() {
    this.raf = 0;
    if (!this.stream && !this.audio && !this.snd) return;
    const v = this.video;
    // 이번 프레임에 돌릴 것: 랜드마크 소스들 + (사진 AI 가 있으면) 'image' — 하나씩 돌아가며
    const srcs = [...this.active];
    const hasImage = [...this.models.values()].some(m => m.source === 'image');
    if (hasImage && this.embedder) srcs.push('image');
    if (this.stream && srcs.length && v.readyState >= 2) {
      const src = srcs[this.rr++ % srcs.length];
      try {
        if (src === 'image') this._image();
        else {
          const res = this.landmarkers[src].detect(v, performance.now());
          this.results[src] = res;
          this._update(src, res);
        }
      } catch (e) { /* 한 프레임 실패는 넘어간다 */ }
      this._draw();
    }
    if (this.audio) this._listen();
    this._post(false);
    this.raf = requestAnimationFrame(() => this._frame());
  }

  _update(src, res) {
    const v = this.video;
    const sig = computeSignals(src, res, v.videoWidth, v.videoHeight) || { shown: false };
    if (src === 'hand') {
      // 손 위치: 손바닥 가운데(9번)를 -100~100 으로. 거울처럼 보이게 좌우를 뒤집는다
      const lm = res.landmarks && res.landmarks[0];
      if (lm) { sig.x = Math.round((0.5 - lm[9].x) * 200); sig.y = Math.round((0.5 - lm[9].y) * 200); }
      sig.hands = (res.landmarks || []).length;
    }
    this.state[src] = sig;
    this._mark(src);
    // 이 소스로 배운 내 AI 들
    const out = this.state.models || (this.state.models = {});
    for (const [name, m] of this.models) {
      if (m.source !== src) continue;
      const vec = extract(src, res, m.variant || undefined);
      out[name] = MyAI.predict(m, vec);
      this._mark('model:' + name);
    }
  }

  // 사진으로 배운 AI: 가르칠 때처럼 가운데 정사각형 + 거울로 잘라 특징을 뽑는다
  _image() {
    if (!cropTo(this.video, this.imgCv, EMBEDDER.inputSize, EMBEDDER.mirror)) return;
    const vec = this.embedder.embed(this.imgCv);
    const out = this.state.models || (this.state.models = {});
    for (const [name, m] of this.models) {
      if (m.source !== 'image') continue;
      out[name] = MyAI.predict(m, vec);
      this._mark('model:' + name);
    }
  }

  _listen() {
    const a = this.audio;
    a.an.getFloatTimeDomainData(a.buf);
    let s = 0;
    for (let i = 0; i < a.buf.length; i++) s += a.buf[i] * a.buf[i];
    const rms = Math.sqrt(s / a.buf.length);
    const now = Date.now();
    if (rms > CLAP_LEVEL && rms > a.prev * CLAP_JUMP && now - a.clapAt > CLAP_GAP_MS) a.clapAt = now;
    a.prev = rms * 0.5 + a.prev * 0.5;
    this.state.sound = { level: Math.min(100, Math.round(rms * 300)), clapAt: a.clapAt };
    this._mark('sound');
  }

  _draw() {
    const v = this.video, c = this.overlay;
    if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; }
    this.octx.clearRect(0, 0, c.width, c.height);
    for (const src of this.active) {
      if (this.results[src]) drawResult(this.octx, src, this.results[src], src === 'pose' ? 'full' : 'two');
    }
  }

  _post(force) {
    if (!this.running) return;
    const now = performance.now();
    if (!force && now - this.lastPost < POST_MS) return;
    this.lastPost = now;
    this.state.t = Date.now();
    const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (sw) sw.postMessage({ type: 'sensor-state', json: JSON.stringify(this.state) });
  }

  // 실행이 끝나면 카메라·마이크를 끈다 (모델은 다음 실행을 위해 남겨 둔다)
  stopAll() {
    this.running = false;
    this.active.clear();
    this.models.clear();
    this.waitFirst.clear();
    this.results = {};
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; this.video.srcObject = null; }
    if (this.audio) { this.audio.stream.getTracks().forEach(t => t.stop()); this.audio.ctx.close(); this.audio = null; }
    if (this.snd) this.snd.stop();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.octx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    this.onCamera(false);
    const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (sw) sw.postMessage({ type: 'sensor-state', json: '{}' });
  }
}
