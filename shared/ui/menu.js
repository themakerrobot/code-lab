// ═══════════════════════════════════════════════════════════
// 메뉴 정의 — 상단바 · 첫 화면 · 메뉴 화면이 전부 이것 하나를 읽는다
// ═══════════════════════════════════════════════════════════
// 메뉴 넷 = 단순 체험 · 심화(가르치기 · 스스로 배우기) · 만들기.
// 활동 하나 = 카드 하나. href 는 사이트 맨 위(index.html 이 있는 곳) 기준.
// 같은 화면을 여러 메뉴에서 쓸 때는 ?m=메뉴&a=활동 을 붙인다 — 상단바 불과 활동 이름이 그걸 따른다.
// pages: 한 활동 안의 화면 여럿 (단계 표시줄 앞에 작은 전환 단추로 나온다).

window.AILAB_MENU = [
  {
    id: 'try', color: 'red',
    ko: '체험하기', en: 'Try',
    sub: { ko: '배우지 않아도 AI가 알아봐요.', en: 'AI that already knows.' },
    tag: { ko: '바로 해요', en: 'Right away' },
    acts: [
      { id: 'look',  ko: '손 · 얼굴 · 몸', en: 'Hand · face · body', desc: { ko: '내 손가락 마디를 AI가 따라와요.', en: 'AI follows your finger joints.' }, note: { ko: '카메라', en: 'Camera' }, href: 'ai/play.html?m=try&a=look', first: true },
      { id: 'sound', ko: '무슨 소리야?',   en: 'What sound?',        desc: { ko: '박수 · 휘파람을 AI가 알아맞혀요.', en: 'AI names claps and whistles.' }, note: { ko: '마이크', en: 'Mic' },    href: 'ai/play.html?m=try&a=sound' },
      { id: 'bg',    ko: '배경 바꾸기',    en: 'New background',     desc: { ko: '나만 남기고 배경을 바꿔요.', en: 'Keep you, change the background.' }, note: { ko: '카메라', en: 'Camera' }, href: 'ai/play.html?m=try&a=bg' },
      { id: 'cloak', ko: '투명 망토',      en: 'Invisible cloak',    desc: { ko: '고른 색이 투명해져요.', en: 'Your chosen color disappears.' }, note: { ko: '카메라', en: 'Camera' }, href: 'act/color.html?m=try&a=cloak' },
      { id: 'voice', ko: 'AI 목소리',      en: 'AI voice',           desc: { ko: '쓴 글을 AI가 소리 내어 읽어요.', en: 'AI reads your words aloud.' }, note: { ko: '스피커', en: 'Speaker' }, href: 'try/voice.html' },
    ],
  },
  {
    id: 'teach', color: 'green',
    ko: '가르치기', en: 'Teach',
    sub: { ko: '예시를 보여 주면 AI가 배워요.', en: 'Show examples, AI learns.' },
    tag: { ko: '2차시씩', en: '2 lessons each' },
    acts: [
      { id: 'myai',  ko: '내 AI 만들기',      en: 'Make my AI',      desc: { ko: '예시를 모아 나만의 AI를 만들어요.', en: 'Collect examples, make your AI.' }, note: { ko: '사진 · 손 · 소리', en: 'Photo · hand · sound' }, href: 'ai/index.html',
        pages: [ { href: 'ai/index.html', ko: '가르치기', en: 'Teach' }, { href: 'ai/test.html', ko: '시험하기', en: 'Test' } ] },
      { id: 'drive', ko: '운전 따라 배우기',  en: 'Learn to drive',  desc: { ko: '내 운전을 보고 AI가 따라 해요.', en: 'AI copies how you drive.' }, note: { ko: '방향키', en: 'Arrow keys' }, href: 'act/drive.html' },
      { id: 'eye',   ko: 'AI 눈 들여다보기',  en: 'Inside AI eyes',  desc: { ko: 'AI가 그림에서 무엇을 보는지 봐요.', en: 'See what AI looks at.' }, note: { ko: '그림', en: 'Pictures' },  href: 'act/eye.html' },
      { id: 'color', ko: '색 로봇',           en: 'Color robot',     desc: { ko: '색을 칠해 가르치면 픽셀을 골라요.', en: 'Paint to teach, AI picks pixels.' }, note: { ko: '칠해서 가르쳐요', en: 'Paint to teach' }, href: 'act/color.html' },
      { id: 'word',  ko: '글 이어 쓰기',      en: 'Next letter',     desc: { ko: '글을 읽고 다음 글자를 맞혀요.', en: 'AI guesses the next letter.' }, note: { ko: '글자', en: 'Letters' },   href: 'act/word.html' },
      { id: 'fair',  ko: '공정한 AI?',        en: 'Fair AI?',        desc: { ko: '기록이 틀리면 AI도 틀려요.', en: 'Wrong records, wrong AI.' }, note: { ko: '기록과 선발', en: 'Records' }, href: 'act/fair.html' },
    ],
  },
  {
    id: 'self', color: 'brown',
    ko: '스스로 배우기', en: 'Self-learning',
    sub: { ko: '정답 대신 점수를 주면 찾아내요.', en: 'Give points, AI finds a way.' },
    tag: { ko: '2차시씩', en: '2 lessons each' },
    aside: {
      ko: ['가르치기와 무엇이 다를까요?', '정답을 보여 주지 않아요. 잘하면 점수만 줘요.', 'AI가 수천 번 해 보며 스스로 방법을 찾아요.'],
      en: ['How is it different?', 'No answers are shown. Only points.', 'AI tries thousands of times to find a way.'],
    },
    acts: [
      { id: 'cleaner', ko: '청소 로봇',     en: 'Cleaning robot',   desc: { ko: '규칙 청소기와 배운 청소기의 대결.', en: 'Rule robot vs learning robot.' }, note: { ko: '규칙대로 vs 배운 대로', en: 'Rules vs learning' }, href: 'act/cleaner.html' },
      { id: 'evolve',  ko: '진화하는 생물', en: 'Evolving creature', desc: { ko: '세대를 거듭하며 걷는 법을 찾아요.', en: 'Finds how to walk over generations.' }, note: { ko: '점수를 내가 정해요', en: 'You set the points' }, href: 'act/evolve.html' },
    ],
  },
  {
    id: 'make', color: 'blue',
    ko: '만들기', en: 'Make',
    sub: { ko: '내가 가르친 AI로 작품을 만들어요.', en: 'Build with your AI.' },
    tag: { ko: '쉬운 것부터', en: 'Easy first' },
    ladder: true,
    acts: [
      { id: 'flow',   ko: '순서도 놀이', en: 'Flow play',   desc: { ko: '이러면 저래! 칩으로 규칙을 만들어요.', en: 'If this, then that — with chips.' }, note: { ko: '칩을 이어 붙여요', en: 'Link chips' },  href: 'ai/play.html?m=make&a=flow' },
      { id: 'block',  ko: '블록 코딩',   en: 'Blocks',      desc: { ko: '블록을 끼워 AI 작품을 만들어요.', en: 'Snap blocks to build with AI.' }, note: { ko: 'AI · 센서 블록', en: 'AI · sensor blocks' }, href: 'code/index.html?mode=block' },
      { id: 'python', ko: '파이썬',      en: 'Python',      desc: { ko: '블록 대신 글로 코딩해요.', en: 'Code with text instead of blocks.' }, note: { ko: '블록이 글로 바뀌어요', en: 'Blocks become text' }, href: 'code/index.html?mode=python' },
    ],
  },
];

// 보관함은 메뉴가 아니라 상단바 단추
window.AILAB_BOX = { href: 'ai/storage.html', ko: '보관함', en: 'My box' };
