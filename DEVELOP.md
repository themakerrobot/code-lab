# 개발·배포 안내 (for developers)

사용자용 소개는 [README.md](./README.md)를 보세요. 이 문서는 개발·운영 전용입니다.

## 원칙

- 백엔드 없음 — 전부 정적 파일. 외부 CDN 금지, 라이브러리·모델 전부 셀프호스팅
- 최초 로드 후 오프라인 동작
- 사진·소리·영상은 기기 밖으로 보내지 않는다. 목소리(TTS)도 기기 안 목소리만 쓴다
- 코드에 계정명·절대 URL 하드코딩 금지 (조직 이전 대비, 전부 상대경로).
  예외는 README 의 사이트 링크·배지뿐이다 — 이전할 때 그곳만 고친다
- 디자인은 자매 서비스와 동일 — 공용 규격은 **[themakerrobot/themaker-ui](https://github.com/themakerrobot/themaker-ui)** 한 곳에 있다.
  `css/themaker-ui.css` 는 그 저장소 `themaker-ui.css` 의 **복사본이다. 직접 고치지 말 것.**
  고쳐야 하면 킷을 고치고 태그를 올린 뒤 여기로 다시 복사한다 (CI 가 어긋남을 잡는다).
  이 서비스 전용 스타일만 `css/app.css` 에 얹는다. `assets/fonts/` 도 킷과 같은 파일이다.
- 쓰는 사람은 초등 저학년이다. 고르기는 드롭다운보다 큰 카드·칩, 지금 맞는 것은
  불이 들어오게, 한 화면에 할 일 하나. 문구 규칙은 킷 README 를 따른다.

## 지금 범위

방이 넷이다.

| 방 | 페이지 | 하는 일 |
|---|---|---|
| 학습실 | `index.html` · `lib/learn.js` | 다섯 소스로 예시 모으기 → 학습 → 저장 |
| 시험실 | `test.html` · `lib/exam.js` | 모델 하나를 골라 바로 맞혀 보기 |
| 놀이실 | `play.html` · `lib/play.js` | 그냥 보기 · 규칙 놀이 · 순서 놀이 · 배경 놀이 · 목소리 |
| 보관함 | `storage.html` · `lib/storage_page.js` | 이름 바꾸기 · 지우기 · 이어서 배우기 · 프로젝트 파일 |

소스(이미지 · 손 · 얼굴 · 포즈 · 소리)마다 다른 것은 `lib/sources.js` 의 스펙과
"숫자로 바꾸는" 모듈(`embedder.js` · `landmarker.js`+`features.js` · `sound.js`)뿐이고,
수집·학습·저장·시험·놀이는 한 길을 같이 쓴다. 소스를 더할 때도 그 자리에만 끼운다.

놀이실은 sense-lab 의 시험실을 옮겨 온 것이다 (sense-lab 은 teach-lab 으로 합쳤다).
파이썬 내보내기와 PyPI 패키지 `teachlab` 은 v0.2.0 에서 걷어냈다. PyPI 에 올린
0.4.0 까지는 그대로 남아 있고 더 올리지 않는다.

## 실행

`file://` 로는 열 수 없습니다. 반드시 http 로 서빙하세요.

```bash
npx http-server -p 8080          # 또는
python3 -m http.server 8080
```

### MIME 주의

서버가 아래 타입을 내보내야 합니다. 틀리면 wasm 스트리밍 컴파일이 실패합니다.

| 확장자 | MIME |
|---|---|
| `.wasm` | `application/wasm` |
| `.tflite` `.task` | `application/octet-stream` |
| `.mjs` | `text/javascript` |

Go 서버(`pibo-server` 계열) 사용 시 `mime.AddExtensionType` 로 명시 등록하세요.
Cloudflare 배포용 헤더는 `_headers` 에 있습니다.

## 구조

```
index.html / test.html / play.html / storage.html
css/
  themaker-ui.css    공용 디자인 킷 복사본 (themakerrobot/themaker-ui — 수정 금지)
  app.css            이 서비스 전용 (놀이실 카드·칩·규칙 카드 포함)
  all.min.css        Font Awesome
lib/
  nav.js             헤더/탭/전체화면
  i18n.js            한/영 토글 (자매 서비스와 같은 방식)
  theme.js           강조색 읽기 (캔버스에 그릴 때 CSS 변수 값을 쓴다)
  tour.js            첫 방문 튜토리얼 (캐릭터 안내)
  sources.js         소스 5종 정의 · 갈래 · 차원 · 추출기 스펙 · 소리 특징 다듬기
  embedder.js        MediaPipe ImageEmbedder 로드 + cropTo 전처리 (GPU 실패 시 CPU 폴백)
  landmarker.js      Hand/Face/Pose Landmarker · 셀피 세그멘터 로드 + 화면에 그리기
  features.js        랜드마크 → 특징 벡터 (학습용 정규화)
  signals.js         그냥 보기 — 학습 없이 읽는 신호 (손가락 수 · 얼굴 방향 · 손 들기 · 박수…)
  sound.js           마이크 + YAMNet (MediaPipe Tasks Audio)
  speak.js           목소리 (Web Speech API, 기기 안 목소리만) + 효과음
  bgfx.js            배경 놀이 (사람/배경 나눠 지우기·흐리기·색 바꾸기)
  trainer.js         TF.js 분류기 학습 (Dense64-Dropout-Softmax, webgl→cpu)
  classifier.js      저장 형식 + 추론 (TF.js 없이 도는 순수 JS)
  project.js         IndexedDB 저장 + .teachlab.zip 내보내기/불러오기
  learn.js / exam.js / play.js / storage_page.js   페이지 로직
  jszip.min.js
vendor/
  tasks-vision/      @mediapipe/tasks-vision wasm + vision_bundle.mjs
  tasks-audio/       @mediapipe/tasks-audio wasm + audio_bundle.mjs
  tfjs/              @tensorflow/tfjs tf.min.js (학습실만 쓴다)
models/              mobilenet_v3_small_embedder.tflite · hand/face/pose *.task ·
                     yamnet.tflite · selfie_segmenter.tflite (배경 놀이)
assets/fonts/        Pretendard (셀프호스팅 — 디자인 킷과 같은 파일)
assets/img/          캐릭터·로고·앱 아이콘
tools/portable/      오프라인 exe (Go embed 서버)
tools/shots/         README·설명서 화면 캡처 스크립트
```

## 파이프라인

```
카메라/사진 → cropTo(224, flip) → MediaPipe ImageEmbedder (l2Normalize) → 1024차원
           → Dense(64, relu) → Dropout(0.2) → Dense(N, softmax)
```

전처리(`cropTo`)는 **Teachable Machine 것을 그대로 옮겼다**
(`@teachablemachine/image`, `src/utils/canvas.ts`).

1. 짧은 변이 224 가 되도록 전체를 줄인다 (찌그러뜨리지 않는다)
2. 가운데 224×224 만 남긴다
3. 웹캠이면 좌우를 뒤집는다 — TM 의 `Webcam(w, h, flip=true)` 과 같다

- **거울은 웹캠에만 건다.** 사진 파일은 안 뒤집는다. TM 도 같다:
  거울은 `Webcam` 클래스가 찍을 때 한 번 걸고, `predict(image, flipped=false)`
  가 기본이다. `project.json` 의 `embedder.mirror` 가 그 표시다.
- 화면 미리보기는 잘라 낸 정사각형 캔버스(`#camCv`)를 그대로 보여 준다.
  `<video>` 는 원본일 뿐이라 화면에 붙이지 않는다 — TM 이 `webcam.canvas` 를
  붙여 보여 주는 것과 같다. **보이는 것이 곧 학습 입력이다.**
- 임베딩이 1024차원이라 학습 곱셈이 랜드마크 소스보다 훨씬 많다.
  그래서 TF.js 백엔드는 `webgl` 먼저, 실패하면 `cpu` 로 내려간다.

### 소리: 창 길이를 반드시 15600 샘플로

YAMNet 한 창은 **15600 샘플(0.975초)** 이다. 1초(16000)를 통째로 넣으면
MediaPipe 가 창을 둘로 쪼개는데, 둘째 창은 400샘플만 진짜이고 나머지는 0으로
채운 꼬리라 **늘 "Silence" 가 1등**으로 나온다. 거기에 더해 예전 코드는
`results[results.length - 1]` 로 **그 꼬리 창을 골라 썼다.**

```
1초(16000) 를 넣었을 때
  창0 (ts=0)    Sine wave 0.891   ← 진짜 내용
  창1 (ts=975)  Silence 0.801     ← 0으로 채운 꼬리
```

그래서 링 버퍼를 `0.975 × ctx.sampleRate` 로 잡고 `results[0]` 을 쓴다
(`lib/sound.js`). 합성 소리로 재어 보면 이 하나로 4종 분류가 70% → 99.7% 로 올라간다.

### 소리: 마이크를 두 번 켜지 않는다

`createSoundEngine().start()` 는 켜는 중에 또 부르면 같은 약속을 돌려준다.
예전에는 두 번째 호출이 마이크를 하나 더 열어서, 두 스트림이 링 버퍼 하나에
번갈아 써 소리가 뒤섞였다 (놀이실 새로고침 직후 확신도가 84% → 60% 아래로 떨어졌다).
켜는 중에 `stop()` 을 부르면 중간에 뜯지 않고 다 켠 뒤 끈다.

### 소리: 점수를 그대로 넣지 않는다

YAMNet 점수는 sigmoid 출력이라 521칸 중 60칸 남짓만 0이 아니고 값도 작다.
학습에는 제곱근으로 펴고 L2 로 크기를 맞춘 값을 쓴다 (`applySoundTransform`, `sqrt-l2`).
비슷한 소리 4종·종류당 12개·잡음 있는 조건에서 80.0% → 89.4%
(최악의 경우 40% → 73%).

옛 모델은 날것으로 배웠으므로 `project.json` 의 `embedder.featureTransform`
에 어느 쪽인지 적는다. 값이 없으면 `raw` 로 본다. 시험실·놀이실은 고른 모델이
배운 방식을 따르고, "이어서 배우기" 는 옛 예시를 새 방식으로 변환해 둔다.
놀이실의 그냥 보기(박수·휘파람·말소리)는 **날것 점수**를 읽는다 — 기준값이 날것 기준이다.

### Teachable Machine 과 다른 점

전처리·거울은 TM 과 같게 맞췄고, 아래 둘만 다르다.

| | Teachable Machine | Teach Lab |
|---|---|---|
| 임베더 | MobileNet v2 (tfjs), 1280차원, 입력 [-1,1] | MediaPipe MobileNetV3-Small, 1024차원, l2 정규화 |
| 헤드 | Dense(denseUnits, relu) → Dense(N, softmax, useBias=false) | Dense(64, relu) → Dropout(0.2) → Dense(N, softmax) |

임베더는 CLAUDE.md 가 정한 것이다 (MediaPipe 스택).

## 놀이실

### 생각 틀

왼쪽에서 볼 것을 켠다 (소스마다 **그냥 보기** 또는 **내 모델**). 오른쪽에서
"만약 [조건] (그리고/또는 [조건]) 이면 AI가 할 말" 규칙이나 순서를 만든다.
조건은 `{ src, v }` 이고 `v` 는 `s:신호` (그냥 보기) 또는 `c:종류` (내 모델의 종류)다.

- 카메라 소스(이미지·손·얼굴·포즈)는 프레임마다 **하나씩 돌아가며** 본다.
  넷을 다 켜도 프레임당 추론은 하나다.
- 안 쓰는 랜드마커는 `close()` 해서 메모리를 돌려준다.
- 확신 정도는 시험실 값(`localStorage['teachlab-threshold']`, 기본 60%)을 같이 쓴다.
  놀이실에는 슬라이더를 두지 않는다 (화면을 단순하게).
- 소스를 끄면 그 소스의 조건은 **지우지 않고 흐리게** 둔다. 실수로 껐다 켜도
  아이가 만든 규칙이 사라지지 않게.
- 상태는 `localStorage['teachlab-play']` 에 저장해 새로고침해도 이어진다.

### 그냥 보기 기준 (`lib/signals.js`)

sense-lab 에서 아이들과 써 보며 맞춘 값을 그대로 옮겼다.

| 신호 | 판정 |
|---|---|
| 손가락 수 | 손가락 끝이 가운데 마디보다 손목에서 1.08배 멀면 편 것. 엄지는 끝~새끼 MCP 거리가 손바닥 폭의 1.1배 넘으면 |
| 얼굴 거리 | 홍채 지름(11.7mm)으로 역산. 40cm 이하 가까이, 75cm 이상 멀리 (보정 없이 ±10~15%) |
| 고개 방향 | 코끝이 얼굴 좌우·위아래 사이 어디쯤인지 비율 |
| 입 벌리기 · 웃기 | blendshape `jawOpen` · `mouthSmile*` 0.4 초과 |
| 손 들기 | 손목이 코보다 위 |
| 박수 · 휘파람 · 말소리 | YAMNet 날것 점수 0.3 초과 (말소리는 0.5). 조용함은 RMS 0.02 미만 |

### 목소리 (`lib/speak.js`)

- Web Speech API `speechSynthesis`. **`voice.localService === true` 인 목소리만 쓴다.**
  크롬의 "Google …" 목소리처럼 인터넷 목소리는 읽을 문장을 서버로 보낸다.
  맞는 목소리가 없으면 목소리 단추가 "쓸 수 있는 목소리가 없어요" 로 바뀌고 조용히 넘어간다.
  화면의 답은 그대로 나온다.
- 기기마다 있는 한국어 목소리가 다르다. 윈도우 한국어판은 기본으로 들어 있고,
  영문 윈도우는 언어 팩을 깔아야 생긴다. 맥·아이패드·안드로이드는 대개 들어 있다.
  라즈베리파이 크로미움은 목소리가 없는 경우가 많다 (확인 필요).
- 깜빡임 거르기: 규칙이 **0.4초 계속** 맞아야 말하고, 말한 규칙은 **0.7초 꺼져야**
  다시 말한다. 계속 맞고 있으면 한 번만 말한다.
- 목록은 늦게 도착한다 (크롬은 `voiceschanged` 뒤에야 채워진다). `onVoicesChanged` 로 다시 그린다.
- 브라우저는 사용자가 한 번 누른 뒤에야 말하게 해 준다. 놀이실은 카메라·카드를 먼저 누르므로 걸리지 않는다.
- 순서 놀이 한 칸 통과는 웹 오디오로 만든 짧은 "띵" — 목소리가 없는 기기에서도 들린다.

## 저장 형식

브라우저 저장은 IndexedDB `teach-lab` / 스토어 `projects` (keyPath: `name`).
가중치는 TF.js 형식이 아니라 **평범한 float32 덩어리**로 둔다 —
시험실·놀이실이 TF.js 없이 순수 JS 로 바로 계산한다.

```
.teachlab.zip
  manifest.json     { format:"teachlab", version, kind, app, createdAt }
  project.json      이름·소스·갈래·종류·정확도·추출기 정보(embedder)
  classifier.json   층마다 kernel/bias 의 shape 과 offset(float32 개수)
  classifier.bin    float32 little-endian 을 순서대로 이어 붙인 것
  samples.json      예시 특징 벡터 (base64) — 이어서 배우기용
  thumbs/<종류번호>/<번호>.jpg
```

형식을 바꿀 때는 `manifest.version` 을 올리고 읽는 쪽(`lib/project.js`)을 함께 고칩니다.
`project.json` 의 `embedder` 에는 특징을 다시 만드는 데 필요한 것(정규화·창 길이·거울)을
적어 둔다. 다른 컴퓨터에서 불러와도 같은 숫자가 나오게 하기 위해서다.

## 벤더 파일 갱신

```bash
npm i @mediapipe/tasks-vision @mediapipe/tasks-audio @tensorflow/tfjs
cp node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.*        vendor/tasks-vision/
cp node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.* vendor/tasks-vision/
cp node_modules/@mediapipe/tasks-vision/vision_bundle.mjs                  vendor/tasks-vision/
cp node_modules/@tensorflow/tfjs/dist/tf.min.js                            vendor/tfjs/
```

`vision_wasm_module_internal.*` 은 `FilesetResolver.forVisionTasks(path)` 가
부르지 않으므로 담지 않습니다 (약 12MB 절약).

임베더 모델은 MediaPipe 공식 저장소의
`image_embedder/mobilenet_v3_small/float32/1` 을 받아
`models/mobilenet_v3_small_embedder.tflite` 로 둡니다
(입력 1×224×224×3 float32, 출력 1×1024 float32).

`node_modules` 는 커밋하지 않고, 벤더 파일은 커밋합니다.

## 정적 파일 크기

배포되는 것은 약 67MB 다. 브라우저는 wasm 두 벌(SIMD/구형) 중 하나만 받는다.

| 항목 | 크기 |
|---|---|
| models | 25MB (손 7.8 · 포즈 5.8 · 이미지 4.1 · 소리 4.1 · 얼굴 3.8 · 배경 0.25) |
| vendor/tasks-vision | 23MB (실제로 받는 것 약 12MB) |
| vendor/tasks-audio | 13MB (실제로 받는 것 약 7MB) |
| 폰트·아이콘·이미지 | 4.4MB |
| tfjs | 1.5MB |

학습실을 처음 열면 고른 소스만 받아 약 18MB 로 시작하고, 그 뒤 나머지 엔진을
뒤에서 미리 받아(`preloadRest`) 첫 방문에 약 46MB 가 된다. 교실 Wi-Fi 에서
동시에 열면 부담이 되므로, 필요하면 미리 받기를 끄는 것을 고려한다.

## 배포 (자매 서비스와 동일)

- `main` 에 작업 → GitHub Pages 테스트 → 통과하면 `release` 브랜치 머지 → Cloudflare 자동 배포
- Cloudflare 는 Workers 방식: `wrangler.toml` + `.assetsignore` (잠금 없음 — 자산만 서빙)
- 배포 명령: `npx wrangler deploy`
- 캐시 버스팅: 코드 파일만 `?v=N`. 모델·wasm 파일에는 붙이지 않습니다
- 모든 자산 경로는 상대경로 — 하위 경로(`/teach-lab/`) 서빙에서도 동작합니다

## 버전·태그·릴리스

| 무엇 | 태그 | 번호가 사는 곳 | 올리는 곳 |
|---|---|---|---|
| 웹앱 (사이트 · `TeachLab.exe`) | `v0.2.0` | 태그 · Release · `CHANGELOG.md` | GitHub Release |

- 사이트는 `release` 브랜치가 곧 배포라 태그가 없어도 늘 최신이다. `v*` 태그는
  "이 시점의 exe 와 릴리스 노트"를 남기는 표시다. **사용자에게 보이는 변화가 쌓이면** 하나 끊는다.
- `MAJOR.MINOR.PATCH`: 고치기만 했으면 PATCH, 기능이 늘었으면 MINOR, 저장 형식이 깨지면 MAJOR.
- 예전 `py-v*` 태그와 PyPI `teachlab` 은 파이썬 내보내기를 걷어내면서 끝났다.

### 웹앱 릴리스 절차

1. `CHANGELOG.md` 의 "아직 안 올린 것" 을 새 `### vX.Y.Z — 날짜` 로 바꾸고 커밋
2. `main` 푸시 → CI 초록 확인 → `release` 에 같은 커밋 푸시 (Cloudflare 자동 배포)
3. exe + Release: 둘 중 하나
   - `git tag vX.Y.Z && git push origin vX.Y.Z` (태그 푸시가 막힌 환경도 있다)
   - Actions → **Build TeachLab.exe** → Run workflow → `tag` 에 `vX.Y.Z` 입력.
     태그가 없으면 릴리스 액션이 만들어 준다
4. Release 본문은 워크플로가 `CHANGELOG.md` 의 `### vX.Y.Z` 절을 잘라 넣는다. 그래서 1번을 빼먹으면 본문이 빈다

### 오프라인 exe (자매 서비스와 동일)

`v*` 태그(또는 workflow_dispatch 의 `tag` 입력)로 GitHub Actions 가 사이트 전체를 담은 단일
`TeachLab.exe` 를 빌드해 Release 에 첨부한다 (인터넷 없이 동작).

- 구성: `.github/workflows/build-exe.yml` + `tools/portable/` (Go embed 서버)
- 서버는 `.wasm`/`.task`/`.tflite`/`.mjs` MIME 을 명시 등록한다
- 사이트가 약 67MB 라 exe 는 약 75MB 가 된다 (모델·wasm 이 대부분)

## 저장소 About (GitHub)

저장소 첫 화면 오른쪽 **About** 은 코드가 아니라 저장소 설정이다 (관리자 권한 · 톱니 아이콘).
아래로 맞춰 둔다. 바꾸면 여기도 같이 고친다.

**Description** (그대로 붙여 넣기)

```
웹캠·마이크로 보여 주며 AI를 가르치고, 규칙·순서 놀이로 노는 어린이용 Teachable Machine — 이미지·손·얼굴·포즈·소리, 브라우저 안에서만
```

**Website**: 배포 주소 (GitHub Pages 또는 Cloudflare)

**Topics** (토픽 칸은 하나 적고 Enter 를 쳐야 칩 하나가 된다. 한꺼번에 넣으려면 `gh` 를 쓴다)

```bash
gh repo edit themakerrobot/teach-lab --add-topic teachable-machine,machine-learning,mediapipe,tensorflowjs,image-classification,hand-tracking,pose-estimation,audio-classification,speech-synthesis,education,kids,on-device,browser,pwa,korean,pibo
```

**Releases** 표시는 켜 두고, Packages · Deployments 는 꺼도 된다.

## 시험

자동 시험은 CI 의 문법 검사와 디자인 킷 복사본 검사뿐이다. 화면 흐름은 Playwright 로
가짜 카메라·합성음을 넣어 손으로 돌린다 (스크립트는 저장소에 두지 않았다).

- 마이크: `AudioContext.prototype.createMediaStreamSource` 를 가로채 사인파·잡음을 넣는다
- 목소리: `window.speechSynthesis` 를 가짜로 바꿔 말한 문장을 모은다.
  기기 안 목소리와 인터넷 목소리를 하나씩 넣어 두면 "기기 안 목소리만 쓴다" 도 확인된다
- 사진: 브라우저 캔버스로 PNG 를 만들어 `setInputFiles` 로 넣는다

## 화면 캡처 (docs/manual · docs/img)

설명서 그림(`docs/manual`, 번호 배지 있음)과 README 그림(`docs/img`, 깨끗한 화면)은
실제 웹캠 없이 만든다. 가짜 카메라에 합성 장면(Y4M)을 넣고 Playwright 로 찍는다.
스크립트는 `tools/shots/` 에 있고, 장면 파일은 크기 때문에 저장소에 넣지 않는다 —
`tools/shots/README.md` 대로 `tools/shots/scene/` 을 만들고 돌린다.
