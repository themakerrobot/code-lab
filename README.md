# AI Lab

**보고, 가르치고, 만들어 보는 인공지능 학습지.** 설치 없이 브라우저에서 돌고, 사진과 소리는 기기 밖으로 나가지 않아요.

**바로 쓰기 → https://themakerrobot.github.io/ai-lab/**

| 메뉴 | 활동 |
|---|---|
| 1 체험하기 — 배우지 않아도 AI가 알아봐요 | 손 · 얼굴 · 몸, 무슨 소리야?, 배경 바꾸기, 투명 망토, AI 목소리 |
| 2 가르치기 — 예시를 보여 주면 AI가 배워요 | 내 AI 만들기(사진 · 손 · 얼굴 · 몸 · 소리), 운전 따라 배우기, AI 눈 들여다보기, 색 로봇, 글 이어 쓰기, 공정한 AI? |
| 3 스스로 배우기 — 정답 대신 점수를 주면 찾아내요 | 청소 로봇, 진화하는 생물 |
| 4 만들기 — 내가 가르친 AI로 작품을 | 순서도 놀이 → 블록 코딩 → 파이썬 |

크롬 · 엣지에서 가장 잘 돌아요. 카메라가 없어도 되는 활동이 많아요.

## 개발

```bash
python3 -m http.server 8000        # http://localhost:8000
node --test tests/*.test.mjs       # 활동 모델 시험
node tools/check-links.mjs         # 화면이 부르는 파일이 다 있는지
```

구조와 규칙은 [CLAUDE.md](CLAUDE.md).

## 라이선스
코드 MIT. 글꼴 Pretendard · Gowun Batang 은 SIL OFL 1.1, 아이콘 Font Awesome Free, MediaPipe · Pyodide · Blockly · CodeMirror · TF.js 는 각 라이선스를 따른다.
