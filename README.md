# Code Lab

**블록과 파이썬으로 코딩하고, 브라우저나 piBrain 에서 바로 실행해요.**

예전의 세 서비스를 하나로 합쳤습니다.

| 예전 | 지금 |
|---|---|
| web-code (파이썬 편집기, 브라우저 실행) | 헤더 **파이썬** + 실행 위치 **브라우저** |
| web-blockly (블록 편집기, 브라우저 실행) | 헤더 **블록** + 실행 위치 **브라우저** |
| web-serial (블록/파이썬 → piBrain) | 실행 위치 **piBrain** |

설치도 서버도 없습니다. 정적 파일만 올리면 됩니다.

```bash
python3 -m http.server 8080      # 그리고 http://localhost:8080/
```

## 쓰는 법

1. 헤더에서 **블록** 또는 **파이썬**을 고릅니다.
2. 도구 줄의 **실행 위치**를 고릅니다.
   - **브라우저** — 이 컴퓨터에서 바로 돌아요 (Skulpt). `input()` 과 `turtle`(로봇 그림)을 쓸 수 있어요.
     블록은 기본 분류(논리·반복·수학·문자·목록·색상·변수·함수·도구)만 보여요.
   - **piBrain** — USB 로 연결한 piBrain 에서 돌아요. 소리·장치·화면·음성·시각·인식 블록이 더 나와요.
3. **실행**(Ctrl+Enter) / **정지**(Esc).

블록은 **시작(깃발) 블록 아래에 붙인 것만** 실행됩니다. 떨어진 블록은 흐리게 보여요.
블록 모드의 **코드** 탭에서 만들어진 파이썬을 보고, **파이썬으로 고치기**로 편집기에 옮길 수 있어요.

작업은 이 브라우저에 자동으로 저장됩니다 (Ctrl+S 는 바로 저장).
다른 컴퓨터로 옮길 때는 **내보내기** — 블록은 `.json`, 파이썬은 `.py` 입니다.
**불러오기**는 확장자를 보고 블록/파이썬 편집기를 알아서 엽니다.
예전 web-blockly · web-serial 에서 내보낸 `.json` 도 그대로 열립니다.

## piBrain 연결

- **크롬 또는 엣지**(PC)에서만 됩니다. Web Serial API 가 필요해요. 사파리·파이어폭스·모바일은 안 됩니다.
- piBrain 은 USB gadget serial(`/dev/ttyGS0`) 로 붙습니다. **데이터 선이 있는 USB 케이블**이어야 해요.
  충전 전용 케이블이면 포트 고르기 창에 아무것도 안 나옵니다.
- 장치 쪽 프로그램은 [openpibo-os.pibrain](https://github.com/themakerrobot/openpibo-os.pibrain) 의
  `system/uart_ctrl.py` 입니다. 이 페이지는 그 규약을 그대로 따릅니다.

| 보내는 것 | 장치가 하는 일 |
|---|---|
| 파이썬 코드 | `/home/pi/.tmp.py` 로 저장하고 실행, 출력을 한 줄씩 돌려줌. 끝나면 `실행시간: N.NN 초` |
| `###END###` | 실행 중인 코드 종료 + 화면을 네트워크 정보로 |
| `###DISP###` | 화면을 네트워크 정보로 (**화면 처음으로** 버튼) |

장치는 `readlines()` + `timeout=1` 로 읽기 때문에 **1초 동안 조용해야 한 덩어리가 끝난 것**으로 봅니다.
그래서 이 페이지는 보내기 사이를 1.3초 띄웁니다 (`lib/pibrain-serial.js` 의 `GAP_MS`).
띄우지 않으면 "정지 → 곧바로 실행" 이 한 덩어리로 묶여 코드가 버려집니다.

장치가 코드 앞에 3줄(`coding`, `import logging`, `basicConfig`)을 덧붙이므로
오류 메시지의 줄 번호가 3 크게 나옵니다. 결과 창에 `← 내 코드 N번째 줄` 로 바로잡아 보여 줍니다.

## 파일 구성

```
index.html
css/
  themaker-ui.css     디자인 킷 복사본 (고치지 말 것 — 아래 참고)
  app.css             Code Lab 전용 스타일
  all.min.css         Font Awesome 6.2
lib/
  app.js              화면 · 편집기 · 실행 흐름
  pibrain-serial.js   piBrain Web Serial 연결 (보내기 줄 세우기 · 줄 단위 받기)
  examples.js         파이썬 예제
blocks/               piBrain 블록 정의 · 파이썬 생성기 · 툴박스 (web-serial 에서 옮김)
  svg/                블록 아이콘
vendor/
  blockly/            Blockly + 한국어 메시지 + media
  codemirror/         CodeMirror 5 + python 모드 + cobalt 테마
  skulpt/             Skulpt (로봇 모양 turtle 포함)
assets/fonts/         Pretendard (셀프호스팅)
assets/img/           로고 · 파비콘
webfonts/             Font Awesome 글꼴
```

## 디자인 킷

화면은 공용 디자인 킷 [themaker-ui](https://github.com/themakerrobot/themaker-ui) "학습지" 테마를 씁니다
(sense-lab · teach-lab 과 같은 헤더·버튼·패널·토스트).

- `css/themaker-ui.css` 는 킷 `v1.0.0` 의 **복사본**입니다. 여기서 고치지 않습니다.
  CI 가 원본과 같은지 검사합니다 (`.github/workflows/ci.yml`).
- Code Lab 에만 있는 것(도구 줄·편집기·결과 탭·turtle)은 `css/app.css` 에 둡니다.
- 편집기 안쪽(cobalt 어두운 테마)과 블록 색은 예전 서비스 그대로 두었습니다.
