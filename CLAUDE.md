# ai-lab

초등 저학년용 인공지능 학습 웹 도구. teach-lab · code-lab · ml-lab 세 도구의 기능을 쪼개 메뉴 넷으로 다시 묶었다.
저장소 이름은 code-lab 에서 바꿨다 (커밋 기록은 code-lab 것 + teach-lab · ml-lab 기록을 합친 것).

## 메뉴 (shared/ui/menu.js 한 곳에 정의)
- 체험하기 (단순 체험, 배우지 않아도 되는 것) · 가르치기 (지도학습, 2차시씩) · 스스로 배우기 (강화 · 진화) · 만들기 (순서도 놀이 → 블록 → 파이썬)
- 보관함은 메뉴가 아니라 상단바 단추
- 활동 하나 = 카드 하나 = HTML 한 장. 같은 화면을 여러 메뉴에서 쓰면 주소에 `?m=메뉴&a=활동`

## 폴더
- `index.html` 첫 화면(학습지) · `try/` `teach/` `self/` `make/` 메뉴 화면 (+ `try/voice.html`)
- `ai/` 옛 teach-lab 화면 (내 AI 만들기 · 시험 · 놀이 · 보관함) — `ai/lib/` 가 그 코드
- `act/` 옛 ml-lab 활동 (운전 · AI 눈 · 색 로봇 · 글 · 공정 · 청소 · 진화) — `act/acts/<활동>/`
- `code/` 옛 code-lab (블록 · 파이썬, 서비스 워커 `code/sw.js`)
- `shared/` 공통: `css/themaker-ui.css`(킷 복사본) · `ui/`(상단바 nav.js · menu.js · sheet.js · icons.js · lab.css) · 글꼴 · 그림 · MediaPipe(`vendor/`) · 모델(`models/`)
- `tests/` 활동 모델 시험 (`node --test tests/*.test.mjs`) · `tools/check-links.mjs` 깨진 경로 검사
- `docs/from/` 세 도구의 옛 문서 · 스크린샷 (참고용)

## 화면을 더할 때
- 머리: `<header data-tab="고유이름" data-menu="메뉴" data-act="활동id"></header>`
- 스크립트: `../shared/ui/menu.js` → `../shared/ui/nav.js` 를 i18n.js · tour.js 보다 먼저
- CSS 차례: 킷 → 화면 app.css → `../shared/ui/lab.css` (마지막)
- menu.js 에 활동을 넣고, icons.js 에 그림(펜 선 SVG)을 넣는다

## 제약
- 정적 웹(GitHub Pages), 서버 · 클라우드 API 없음. 설치판(exe)은 지금 범위에서 뺐다
- 사진 · 소리 · 영상은 기기 밖으로 보내지 않는다. 목소리(TTS)도 기기 안 목소리(localService)만
- 쓰는 사람은 초등 저학년 — 큰 카드 · 칩, 지금 맞는 것은 불 켜기, 한 화면에 할 일 하나. 문구는 해요체, 한 문장 20자 안팎
- 디자인: 킷 themakerrobot/themaker-ui 를 따른다. `shared/css/themaker-ui.css` 는 복사본 — 직접 고치지 말 것 (CI 가 v1.4.0 과 비교). 덮어쓰기는 `shared/ui/lab.css` 에, 킷 토큰 색만
  - 메뉴 색: 체험 빨간 펜 · 가르치기 초록(ok) · 스스로 배우기 갈색(line-d) · 만들기 남색 펜. `body[data-menu]` 가 `--acc` 를 바꿔 킷 컴포넌트가 따라간다
  - 그라디언트 · 이모지 장식 · 아이콘 상자 · 알약 꼬리표 같은 흔한 장식 대신 학습지(괘선 · 펜 선 그림 · 빨간 펜 메모)
- 이전에 만든 모델 · 프로젝트 호환은 신경 쓰지 않는다 (출시 전)
- UI 문구 한국어 우선, 새 문구는 영어도 같이 (menu.js 는 ko/en, 화면은 각 i18n.js)
