// ═══════════════════════════════════════════════════════════
// 그냥 보기 — 가르치지 않아도 AI가 이미 아는 것들
// ═══════════════════════════════════════════════════════════
// 놀이실에서 쓴다. 랜드마커·YAMNet 결과에서 학습 없이 바로 읽어 낸다.
//  · 손   : 손가락 개수 (0~5)
//  · 얼굴 : 거리(홍채 크기로 역산) · 고개 방향 · 입 벌리기 · 웃기
//  · 포즈 : 한 손 · 두 손 들기
//  · 소리 : 박수 · 휘파람 · 말소리 · 조용함
// 기준값은 sense-lab 에서 아이들과 써 보며 맞춘 것을 그대로 옮겼다.

// 고를 수 있는 신호 — [토큰, 화면 문구, 아이콘]
// 화면 문구는 짧게 (초등 저학년이 칩 하나에서 바로 읽을 수 있게)
export const SIGNALS = {
  hand: [
    ['shown', '손이 보여요', 'fa-hand'],
    ['hide', '손이 없어요', 'fa-eye-slash'],
    ['f0', '주먹', 'fa-hand-fist'],
    ['f1', '손가락 1개', 'fa-hand-point-up'],
    ['f2', '손가락 2개', 'fa-hand-peace'],
    ['f3', '손가락 3개', 'fa-hand'],
    ['f4', '손가락 4개', 'fa-hand'],
    ['f5', '손바닥 쫙', 'fa-hand'],
  ],
  face: [
    ['shown', '얼굴이 보여요', 'fa-face-smile'],
    ['hide', '얼굴이 없어요', 'fa-eye-slash'],
    ['near', '가까이', 'fa-magnifying-glass-plus'],
    ['far', '멀리', 'fa-magnifying-glass-minus'],
    ['left', '왼쪽 보기', 'fa-arrow-left'],
    ['right', '오른쪽 보기', 'fa-arrow-right'],
    ['up', '위 보기', 'fa-arrow-up'],
    ['down', '아래 보기', 'fa-arrow-down'],
    ['mouth', '입 벌리기', 'fa-face-surprise'],
    ['smile', '웃기', 'fa-face-grin-wide'],
  ],
  pose: [
    ['shown', '몸이 보여요', 'fa-person'],
    ['hide', '몸이 없어요', 'fa-eye-slash'],
    ['up1', '한 손 들기', 'fa-hand-point-up'],
    ['up2', '두 손 들기', 'fa-child-reaching'],
  ],
  sound: [
    ['sound', '소리 나요', 'fa-volume-high'],
    ['quiet', '조용해요', 'fa-volume-xmark'],
    ['clap', '박수', 'fa-hands-clapping'],
    ['whistle', '휘파람', 'fa-music'],
    ['speech', '말소리', 'fa-comment'],
  ],
};

export function signalInfo(src, token) {
  const row = (SIGNALS[src] || []).find(r => r[0] === token);
  return row ? { text: row[1], icon: row[2] } : null;
}

// ── 소스별 신호 상태 ──
export function computeSignals(source, result, vw, vh) {
  if (source === 'hand') return handSignals(result);
  if (source === 'face') return faceSignals(result, vw, vh);
  if (source === 'pose') return poseSignals(result);
  return null;
}

function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// 손가락: 끝점이 가운데 마디보다 손목에서 멀면 편 것 (손 방향과 상관없다)
function handSignals(result) {
  const lm = result && result.worldLandmarks && result.worldLandmarks[0];
  if (!lm || lm.length < 21) return { shown: false };
  const d = (i, j) => dist(lm[i], lm[j]);
  let fingers = 0;
  // 엄지: 접으면 손바닥을 가로질러 새끼 쪽으로 온다 →
  // 엄지끝(4)~새끼 MCP(17) 거리가 손바닥 폭(5~17)보다 충분히 멀면 편 것
  if (d(4, 17) > d(5, 17) * 1.1) fingers++;
  [[8, 6], [12, 10], [16, 14], [20, 18]].forEach(([tip, pip]) => {
    if (d(tip, 0) > d(pip, 0) * 1.08) fingers++;
  });
  return { shown: true, fingers };
}

// 얼굴
//  · 거리: 사람 홍채 지름은 약 11.7mm 로 거의 일정하다 → 화면상 홍채 크기로
//    카메라와의 거리를 역산한다. 보정 없이 ±10~15% 정도의 대략치(cm)다.
//  · 방향: 코끝(1)이 얼굴 좌우 끝(234·454)·위아래(10·152) 사이 어디쯤인지 비율로 본다.
const IRIS_MM = 11.7;
const FOCAL_RATIO = 0.85;      // 초점거리 ≈ 0.85 × 영상 가로폭 (일반 웹캠 화각 가정)
const NEAR_CM = 40, FAR_CM = 75;
const YAW_LO = 0.38, YAW_HI = 0.62;
const PITCH_UP = 0.46, PITCH_DN = 0.62;
const MOUTH_OPEN = 0.4, SMILE = 0.4;   // blendshape 점수 기준

function faceSignals(result, vw, vh) {
  const lm = result && result.faceLandmarks && result.faceLandmarks[0];
  if (!lm || lm.length < 478) return { shown: false };
  const px = (a, b) => {
    const dx = (a.x - b.x) * vw, dy = (a.y - b.y) * vh;
    return Math.sqrt(dx * dx + dy * dy);
  };
  // 홍채 지름(픽셀): 양쪽 중 큰 값 (고개를 돌리면 한쪽이 작아 보인다)
  const iris = Math.max(px(lm[469], lm[471]), px(lm[474], lm[476]));
  const distCm = iris > 1 ? Math.round(FOCAL_RATIO * vw * IRIS_MM / iris / 10) : null;

  // 학생 자신의 기준으로 왼쪽/오른쪽 (거울 화면과 같은 방향감)
  const L = lm[234], R = lm[454], N = lm[1], TOP = lm[10], CHIN = lm[152];
  const yawR = (N.x - L.x) / ((R.x - L.x) || 1e-6);
  const pitR = (N.y - TOP.y) / ((CHIN.y - TOP.y) || 1e-6);
  const yaw = yawR > YAW_HI ? 'left' : (yawR < YAW_LO ? 'right' : 'center');
  const pitch = pitR < PITCH_UP ? 'up' : (pitR > PITCH_DN ? 'down' : 'center');

  const bs = result.faceBlendshapes && result.faceBlendshapes[0];
  let mouth = false, smile = false;
  if (bs && bs.categories) {
    const score = name => {
      const c = bs.categories.find(x => x.categoryName === name);
      return c ? c.score : 0;
    };
    mouth = score('jawOpen') > MOUTH_OPEN;
    smile = (score('mouthSmileLeft') + score('mouthSmileRight')) / 2 > SMILE;
  }
  return { shown: true, distCm, yaw, pitch, mouth, smile };
}

// 포즈: 손목(15·16)이 코(0)보다 위에 있으면 든 것 (화면 좌표는 y 가 작을수록 위)
function poseSignals(result) {
  const lm = result && result.landmarks && result.landmarks[0];
  if (!lm || lm.length < 33) return { shown: false };
  const nose = lm[0];
  const up = [lm[15], lm[16]].filter(w => w.y < nose.y).length;
  return { shown: true, handsUp: up };
}

// 소리: YAMNet 521개 점수(날것)에서 읽는다.
// 인덱스는 YAMNet 라벨 순서 (yamnet.tflite 안에 들어 있는 라벨 목록 기준).
const SND_SPEECH = 0;
const SND_WHISTLE = [35, 396];          // Whistling, Whistle
const SND_CLAP = [57, 58, 62];          // Finger snapping, Clapping, Applause
const SND_SCORE = 0.3;                  // 이 점수를 넘으면 그 소리로 본다
const SND_QUIET_LEVEL = 0.02;           // 소리 크기(RMS)가 이보다 작으면 "조용해요"

export function soundSignals(vec, level) {
  if (!vec) return { shown: false };
  const mx = idx => Math.max(...idx.map(i => vec[i] || 0));
  return {
    shown: true,
    quiet: level < SND_QUIET_LEVEL,
    clap: mx(SND_CLAP) > SND_SCORE,
    whistle: mx(SND_WHISTLE) > SND_SCORE,
    speech: (vec[SND_SPEECH] || 0) > SND_SCORE + 0.2,   // 말소리는 흔해서 기준을 높인다
  };
}

// ── 신호 조건이 지금 맞는가 (규칙 놀이·순서 놀이 공용) ──
export function sigMatch(source, want, s) {
  if (want === 'hide') return !s || !s.shown;
  if (!s || !s.shown) return false;
  if (want === 'shown') return true;
  if (source === 'hand') {
    if (want[0] === 'f') return s.fingers === Number(want.slice(1));
    return false;
  }
  if (source === 'face') {
    if (want === 'near') return s.distCm != null && s.distCm <= NEAR_CM;
    if (want === 'far') return s.distCm != null && s.distCm >= FAR_CM;
    if (want === 'left' || want === 'right') return s.yaw === want;
    if (want === 'up' || want === 'down') return s.pitch === want;
    if (want === 'mouth') return !!s.mouth;
    if (want === 'smile') return !!s.smile;
    return false;
  }
  if (source === 'pose') {
    if (want === 'up1') return s.handsUp >= 1;
    if (want === 'up2') return s.handsUp >= 2;
    return false;
  }
  if (source === 'sound') {
    if (want === 'quiet') return !!s.quiet;
    if (want === 'sound') return !s.quiet;
    if (want === 'clap') return !!s.clap;
    if (want === 'whistle') return !!s.whistle;
    if (want === 'speech') return !!s.speech;
    return false;
  }
  return false;
}

// ── 지금 상태를 한 줄로 (놀이실 "지금 보이는 것") ──
// 돌려주는 것: { text, icon, on }  on=false 면 흐리게 보여 준다
export function describe(src, s) {
  if (src === 'sound') {
    if (!s || !s.shown) return { text: '듣는 중', icon: 'fa-ear-listen', on: false };
    if (s.quiet) return { text: '조용해요', icon: 'fa-volume-xmark', on: false };
    if (s.clap) return { text: '박수', icon: 'fa-hands-clapping', on: true };
    if (s.whistle) return { text: '휘파람', icon: 'fa-music', on: true };
    if (s.speech) return { text: '말소리', icon: 'fa-comment', on: true };
    return { text: '소리 나요', icon: 'fa-volume-high', on: true };
  }
  if (!s || !s.shown) return { text: '안 보여요', icon: 'fa-eye-slash', on: false };
  if (src === 'hand') {
    if (s.fingers === 0) return { text: '주먹', icon: 'fa-hand-fist', on: true };
    if (s.fingers === 5) return { text: '손바닥 쫙', icon: 'fa-hand', on: true };
    return { text: '손가락 N개'.replace('N', s.fingers), icon: s.fingers === 2 ? 'fa-hand-peace' : 'fa-hand', on: true };
  }
  if (src === 'face') {
    if (s.smile) return { text: '웃기', icon: 'fa-face-grin-wide', on: true };
    if (s.mouth) return { text: '입 벌리기', icon: 'fa-face-surprise', on: true };
    if (s.yaw === 'left') return { text: '왼쪽 보기', icon: 'fa-arrow-left', on: true };
    if (s.yaw === 'right') return { text: '오른쪽 보기', icon: 'fa-arrow-right', on: true };
    if (s.pitch === 'up') return { text: '위 보기', icon: 'fa-arrow-up', on: true };
    if (s.pitch === 'down') return { text: '아래 보기', icon: 'fa-arrow-down', on: true };
    if (s.distCm != null && s.distCm <= NEAR_CM) return { text: '가까이', icon: 'fa-magnifying-glass-plus', on: true };
    if (s.distCm != null && s.distCm >= FAR_CM) return { text: '멀리', icon: 'fa-magnifying-glass-minus', on: true };
    return { text: '얼굴이 보여요', icon: 'fa-face-smile', on: true };
  }
  if (src === 'pose') {
    if (s.handsUp >= 2) return { text: '두 손 들기', icon: 'fa-child-reaching', on: true };
    if (s.handsUp >= 1) return { text: '한 손 들기', icon: 'fa-hand-point-up', on: true };
    return { text: '몸이 보여요', icon: 'fa-person', on: true };
  }
  return { text: '', icon: 'fa-circle', on: false };
}
