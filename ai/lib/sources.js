// ═══════════════════════════════════════════════════════════
// 입력 소스 — 무엇을 보고 배울지 (이미지 / 손 / 얼굴 / 몸 / 소리)
// ═══════════════════════════════════════════════════════════
// 소스마다 "그림·소리 → 숫자(특징 벡터)" 를 만드는 방법이 다르다.
// 그 뒤(분류기 학습·저장·내보내기)는 전부 같다 — 차원 수만 다를 뿐이다.
//
//   이미지  사진 → MediaPipe ImageEmbedder → 1024
//   손      웹캠 → HandLandmarker  → 정규화 좌표 63 (두 손 126)
//   얼굴    웹캠 → FaceLandmarker  → blendshape 52
//   몸    웹캠 → PoseLandmarker  → 정규화 좌표 75 (전신 99)
//   소리    마이크 → YAMNet        → 521
//
// 거울(좌우 반전) 규칙이 소스마다 다르다. 일부러 그렇게 두었다.
//   · 이미지 : Teachable Machine 과 같이 웹캠 프레임 자체를 뒤집어 학습한다.
//   · 손·얼굴·몸 : 원본 프레임에서 좌표를 뽑는다.
//     뒤집으면 MediaPipe 의 왼손/오른손 판별이 반대로 나와 학습이 망가진다.
//     화면 미리보기만 CSS 로 뒤집어 보여 준다 — 좌표와 뼈대 그림은 같이 움직인다.

import { EMBEDDER } from './embedder.js';
import { VARIANTS, dimOf } from './features.js';

// ── 소리 특징 다듬기 ──
// YAMNet 이 내놓는 521개 점수는 sigmoid 출력이라 대부분 0 근처에 몰려 있고
// (521칸 중 60칸 남짓만 0이 아니다) 값도 작다. 그대로 넣으면 Dense 층이 쓸
// 것이 거의 없어서 잘 못 배운다. 제곱근으로 작은 값을 펴 주고 L2 로 크기를
// 맞추면 훨씬 잘 갈린다.
//
// 합성 소리 4종으로 재어 본 결과 (같은 분류기·같은 학습 조건, 10회 평균)
//   박수·휘파람·조용히 :  날것 67.5%  →  sqrt+L2 98.2%
//   4종 전부           :  날것 70.0%  →  sqrt+L2 91.9%
//
// 옛 AI는 날것으로 배웠으므로 프로젝트 파일에 어느 쪽인지 적어 둔다.
// featureTransform 이 없으면 'raw' 로 본다.
export const SOUND_TRANSFORM = 'sqrt-l2';

export function applySoundTransform(vec, kind) {
  if (kind !== 'sqrt-l2') return vec;              // 'raw' 또는 옛 AI
  const out = new Float32Array(vec.length);
  let sum = 0;
  for (let i = 0; i < vec.length; i++) {
    const v = Math.sqrt(vec[i] > 0 ? vec[i] : 0);
    out[i] = v;
    sum += v * v;
  }
  const n = Math.sqrt(sum) || 1;
  for (let i = 0; i < out.length; i++) out[i] /= n;
  return out;
}

// 저장된 AI가 어떤 방식으로 배웠는지 (옛 AI는 날것)
export function soundTransformOf(spec) {
  return (spec && spec.featureTransform) || 'raw';
}

export const SOURCE_LIST = [
  { id: 'image', label: '이미지', icon: 'fa-image', input: 'camera', files: true },
  { id: 'hand', label: '손', icon: 'fa-hand', input: 'camera' },
  { id: 'face', label: '얼굴', icon: 'fa-face-smile', input: 'camera' },
  { id: 'pose', label: '몸', icon: 'fa-person', input: 'camera' },
  { id: 'sound', label: '소리', icon: 'fa-microphone', input: 'mic' },
];

export const SOURCE_IDS = SOURCE_LIST.map(s => s.id);

export function sourceMeta(id) {
  return SOURCE_LIST.find(s => s.id === id) || SOURCE_LIST[0];
}

export function isSoundSource(id) { return id === 'sound'; }
export function isImageSource(id) { return id === 'image'; }
export function isLandmarkSource(id) { return id === 'hand' || id === 'face' || id === 'pose'; }

export function variantsOf(id) { return VARIANTS[id] || null; }
export function defaultVariant(id) { return VARIANTS[id] ? VARIANTS[id][0][0] : null; }

export function dimOfSource(id, variant) {
  return id === 'image' ? EMBEDDER.dim : dimOf(id, variant);
}

// 갈래 토글 문구·아이콘 (한 손/두 손 · 상반신/전신)
export const VARIANT_UI = {
  hand: { q: '몇 개 볼까요?', icons: { one: 'fa-hand', two: 'fa-hands' } },
  pose: { q: '어디까지 볼까요?', icons: { upper: 'fa-user', full: 'fa-person' } },
};

// 화면 아래 힌트 — "AI는 무엇을 숫자로 바꿔 보는가"
export const SOURCE_HINT = {
  image: 'AI는 사진을 1024개의 숫자로 바꿔서 봐요.',
  hand: 'AI는 손을 21개 점의 좌표로 봐요.',
  face: 'AI는 얼굴을 52가지 표정 점수로 봐요.',
  pose: 'AI는 몸을 관절 점의 좌표로 봐요.',
  sound: 'AI는 소리를 521가지 점수로 바꿔서 봐요.',
};

const LANDMARK_MODEL = {
  hand: 'hand_landmarker.task',
  face: 'face_landmarker.task',
  pose: 'pose_landmarker_lite.task',
};

// 정규화 방법 — 같은 계산을 다시 할 수 있도록 프로젝트 파일에 적어 둔다
const LANDMARK_NORM = {
  hand: 'wrist-origin/middle-mcp-scale',
  face: 'blendshapes',
  pose: 'shoulder-origin/shoulder-width-scale',
};
const LANDMARK_NORM_FULL = 'hip-origin/torso-length-scale';

// 프로젝트 파일(project.json)에 담는 "특징 뽑는 법" 설명.
// 이것만 보고 같은 숫자를 다시 만들 수 있어야 한다 (다른 컴퓨터에서 불러올 때).
export function extractorSpec(source, variant) {
  if (source === 'image') {
    return Object.assign({ type: 'image-embedding', source: 'image', variant: null }, EMBEDDER);
  }
  if (source === 'sound') {
    return {
      type: 'audio-embedding', source: 'sound', variant: null,
      name: 'mediapipe/yamnet', file: 'yamnet.tflite', path: '../shared/models/yamnet.tflite',
      dim: 521, sampleRate: 16000, windowSeconds: 15600 / 16000, hopSeconds: 0.25, mirror: false,
      featureTransform: SOUND_TRANSFORM,
    };
  }
  return {
    type: 'landmark', source, variant,
    name: 'mediapipe/' + source + '_landmarker',
    file: LANDMARK_MODEL[source],
    path: '../shared/models/' + LANDMARK_MODEL[source],
    dim: dimOf(source, variant),
    normalize: (source === 'pose' && variant === 'full') ? LANDMARK_NORM_FULL : LANDMARK_NORM[source],
    // 좌표는 원본 프레임에서 뽑는다 (화면 미리보기만 거울이다)
    mirror: false,
  };
}
