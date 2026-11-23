# teach-lab

Teachable Machine 스타일의 브라우저 학습·놀이 툴. themakerrobot 라인업(pibo-lab, edge-lab 등)의 자매 서비스.
sense-lab 은 이 저장소로 합쳤다 (놀이실). sense-lab 저장소는 지웠으니 거기서 찾지 말 것.

## 범위
- 입력 5종: 이미지 / 손(hand) / 얼굴(face) / 소리(sound) / 포즈(pose, 상반신·전신)
- 방 넷: 학습실(가르치기) · 시험실(모델 하나 시험) · 놀이실(그냥 보기·규칙 놀이·순서 놀이·배경 놀이·목소리) · 보관함
- 공통 흐름: 클래스 만들기 → 샘플 수집(웹캠·마이크) → 학습 → 웹에서 즉시 추론 → 놀이실에서 엮어 놀기
- 임베딩 추출은 MediaPipe, 분류기는 브라우저에서 학습(TF.js), 추론은 TF.js 없는 순수 JS

## Export / Import
- 프로젝트 파일(.teachlab.zip) export → 다른 브라우저에서 import 후 그대로 추론·이어서 배우기
- 파이썬 내보내기·PyPI `teachlab` 은 걷어냈다 (웹에 집중). 다시 넣지 않는다

## 제약
- 정적 웹(GitHub Pages / Cloudflare), 서버·클라우드 API 없음
- 사진·소리·영상은 기기 밖으로 보내지 않는다. 목소리(TTS)도 기기 안 목소리(localService)만
- 쓰는 사람은 초등 저학년 — 큰 카드·칩, 지금 맞는 것은 불 켜기, 한 화면에 할 일 하나
- 디자인은 공용 킷 themakerrobot/themaker-ui 를 따른다. css/themaker-ui.css 는 복사본, 직접 고치지 말 것
- UI 문구 한국어 우선, 언어 토글은 lib/i18n.js 방식 (새 문구는 영어 키도 같이 넣는다)
