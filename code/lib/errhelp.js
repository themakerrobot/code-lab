// ═══════════════════════════════════════════════════════════
// 오류 설명 — 파이썬이 멈추면 원래 오류 위에 쉬운 말 한 줄을 붙인다
// ═══════════════════════════════════════════════════════════
// 오류 종류(type)만으로 가르면 엉뚱한 안내가 된다 (TypeError 하나에도 원인이 여럿).
// 그래서 메시지(msg)를 보고 가장 그럴듯한 원인 하나를 고른다. 원래 오류는 화면에 그대로 남는다.
//
//   ErrHelp.explain({ type, msg, lineno }, mode)  → "4번째 줄: …"   mode: 'python' | 'block'
//
// 우리 모듈(sensor.py · turtle.py)이 낸 오류는 이미 한국어로 써 두었으니 그 글을 그대로 쓴다.
// 문구: 해요체, 무엇이 잘못됐는지 + 무엇을 해 보면 되는지.

(function (root) {
  const HANGUL = /[가-힣]/;
  const q = s => "'" + s + "'";
  // 조사 고르기 — 마지막 글자에 받침이 있으면 a(이 · 을 · 은), 없으면 b(가 · 를 · 는).
  // 영어 · 숫자는 읽는 소리로 어림한다 (l · m · n · r 은 받침 소리, 0 · 1 · 3 · 6 · 7 · 8 도)
  function J(word, a, b) {
    const c = String(word).slice(-1);
    const code = c.charCodeAt(0);
    let batchim;
    if (code >= 0xAC00 && code <= 0xD7A3) batchim = (code - 0xAC00) % 28 !== 0;
    else if (/[0-9]/.test(c)) batchim = '013678'.includes(c);
    else batchim = /[lmnrLMNR]/.test(c);
    return batchim ? a : b;
  }
  const qa = (w, a, b) => q(w) + J(w, a, b);      // '사과'가 · '열'은

  const NONE = '값이 비어 있어요(None). 앞에서 그 변수에 값이 제대로 들어갔는지 봐요 — return 이 없는 함수의 결과는 None 이에요';
  // 브라우저 파이썬(Pyodide)에서 바로 쓸 수 있는 것
  const MODULES = 'turtle · sensor · math · random · time · numpy · matplotlib';

  // 파이썬 3.12 부터 "Did you mean: 'print'?" 는 메시지가 아니라 Traceback 끝에만 붙는다 → 둘 다 본다
  let fullText = '';
  function suggest(m) {
    const d = (m + '\n' + fullText).match(/Did you mean:? '([^']+)'/);
    return d ? ` 혹시 ${q(d[1])} 인가요?` : '';
  }

  function syntax(m) {
    const ch = m.match(/invalid character '(.)'/);
    if (ch) return `${q(ch[1])} — 파이썬이 모르는 글자예요. 한글 자판의 기호(“ ” ‘ ’ （ ） ，)가 섞였는지 보고 영어 자판으로 다시 써요`;
    if (/invalid non-printable character|invalid character/.test(m)) return '눈에 안 보이는 이상한 글자가 섞였어요. 그 줄을 지우고 다시 써요';
    if (/unterminated (triple-quoted )?string|EOL while scanning|EOF while scanning/.test(m)) return '따옴표(" " 또는 \' \')의 짝이 맞지 않아요. 글자를 여는 따옴표와 닫는 따옴표가 있는지 봐요';
    if (/was never closed|unexpected EOF|expected an expression/.test(m)) return '괄호 ( [ { 를 열고 닫지 않았어요. 짝이 맞는지 세어 봐요';
    if (/unmatched|does not match opening/.test(m)) return '닫는 괄호 ) ] } 가 남거나 모양이 달라요. 여는 괄호와 같은 모양으로 닫아요';
    if (/expected ':'/.test(m)) return 'if · for · while · def 줄 끝에 콜론(:)을 붙여요';
    if (/Maybe you meant '=='|cannot assign to (comparison|expression|literal|function call)/.test(m)) return '같은지 비교할 때는 = 가 아니라 == 를 써요 (= 는 값을 넣을 때만)';
    if (/Missing parentheses in call to 'print'/.test(m)) return 'print 는 괄호와 함께 써요: print("안녕")';
    if (/invalid decimal literal/.test(m)) return '이름은 숫자로 시작할 수 없어요. 숫자와 글자 사이에 연산 기호(* + 등)를 빠뜨리지 않았는지도 봐요';
    if (/Perhaps you forgot a comma/.test(m)) return '값 사이에 쉼표(,)를 빠뜨린 것 같아요';
    if (/'return' outside function/.test(m)) return 'return 은 def 로 만든 함수 안에서만 써요';
    if (/'break' outside loop|'continue' (not properly in|outside) loop/.test(m)) return 'break · continue 는 for · while 반복 안에서만 써요';
    return '문법이 틀렸어요. 괄호 · 따옴표 짝, 줄 끝의 콜론(:)을 확인해요';
  }

  function indent(type, m) {
    if (type === 'TabError' || /inconsistent use of tabs/.test(m)) return '탭과 띄어쓰기가 섞였어요. 띄어쓰기 4칸으로 맞춰요';
    if (/expected an indented block/.test(m)) return 'if · for · def 다음 줄은 안으로 들여써야 해요 (보통 4칸)';
    if (/unexpected indent/.test(m)) return '이 줄만 괜히 안으로 들어갔어요. 위 줄과 같은 칸에서 시작해요';
    if (/unindent does not match/.test(m)) return '들여쓰기 칸 수가 위 줄들과 달라요. 같은 묶음은 같은 칸만큼 들여써요';
    return '들여쓰기를 확인해요. 같은 묶음은 같은 칸만큼(보통 4칸) 들여써요';
  }

  function name(type, m) {
    const n = (m.match(/name '([^']+)'/) || m.match(/variable '([^']+)'/) || [])[1] || '';
    if (type === 'UnboundLocalError' || /referenced before assignment|cannot access local variable/.test(m))
      return `함수 안에서 ${qa(n, '을', '를')} 바꾸기 전에 썼어요. 함수 안에서 먼저 값을 넣거나, 함수 맨 위에 global ${n} 이라고 써요`;
    const fix = { true: 'True', false: 'False', none: 'None', TRUE: 'True', FALSE: 'False', NONE: 'None' }[n];
    if (fix) return `파이썬에서는 첫 글자를 대문자로 써요: ${fix}`;
    if (HANGUL.test(n) && !/[A-Za-z0-9_]/.test(n)) return `${qa(n, '이', '가')} 글자라면 따옴표로 감싸요: "${n}". 변수라면 먼저 값을 넣어요`;
    return `${qa(n || '?', '이', '가')} 아직 없어요. 철자와 대문자 · 소문자를 확인하고, 쓰기 전에 먼저 만들어요.${suggest(m)}`;
  }

  function module(m) {
    const n = (m.match(/No module named '([^']+)'/) || m.match(/cannot import name '([^']+)'/) || [])[1];
    if (/cannot import name/.test(m)) return `그 모듈에 ${qa(n, '은', '는')} 없어요. 이름을 확인해요`;
    return `${n ? qa(n, '은', '는') : '그 모듈은'} 이 브라우저 파이썬에 없어요. 쓸 수 있는 것: ${MODULES}`;
  }

  function typeErr(m) {
    if (/'NoneType'/.test(m)) return NONE;
    if (/can only concatenate str|unsupported operand type.*'(str|int|float)'.*'(str|int|float)'|must be str, not|can't multiply sequence by non-int of type 'str'/.test(m))
      return '글자와 숫자는 바로 계산할 수 없어요. str(숫자) 나 int(글자) 로 바꿔요';
    if (/does not support item assignment/.test(m)) return '글자 · 튜플은 한 칸만 바꿀 수 없어요. 목록(리스트)을 써요';
    if (/is not subscriptable/.test(m)) return '[ ] 로 꺼낼 수 없는 값이에요. 목록 · 글자 · 사전에만 [ ] 를 써요';
    if (/is not callable/.test(m)) return '함수가 아닌 것을 ( ) 로 불렀어요. 변수 이름이 함수 이름과 겹치지 않았는지 봐요';
    if (/is not iterable/.test(m)) return 'for 로 하나씩 꺼낼 수 없는 값이에요. 숫자라면 range(숫자) 를 써요';
    if (/positional argument|takes \d+ .*given|missing \d+ required|unexpected keyword|takes no arguments/.test(m))
      return '함수에 넣는 값의 개수가 맞지 않아요. ( ) 안의 값을 세어 봐요';
    if (/cannot be interpreted as an integer|indices must be integers|must be integers or slices/.test(m))
      return '여기에는 정수(0, 1, 2 …)가 들어가야 해요. int( ) 로 바꿔요';
    if (/unhashable type/.test(m)) return '목록은 사전의 열쇠나 집합에 넣을 수 없어요. 튜플이나 글자로 바꿔요';
    if (/'<' not supported|'>' not supported|'<=' not supported|'>=' not supported/.test(m)) return '글자와 숫자는 크기를 비교할 수 없어요. 같은 종류로 바꿔요';
    return '값의 종류가 맞지 않아요. print( ) 로 값을 먼저 찍어 봐요';
  }

  function value(m) {
    const lit = m.match(/invalid literal for int\(\) with base \d+: '(.*)'/) || m.match(/could not convert string to float: '(.*)'/);
    if (lit) return lit[1] === '' ? '빈 글자는 숫자로 바꿀 수 없어요. 입력이 비어 있지 않은지 봐요' : `${qa(lit[1], '은', '는')} 숫자로 바꿀 수 없어요. 숫자만 들어 있는지 봐요`;
    if (/math domain error/.test(m)) return '계산할 수 없는 값이에요 (예: 음수의 제곱근). 넣는 값을 확인해요';
    if (/not in list/.test(m)) return '목록에 그 값이 없어요. in 으로 먼저 있는지 확인해요';
    if (/too many values to unpack/.test(m)) return '왼쪽 이름 수보다 값이 많아요. = 양쪽의 개수를 맞춰요';
    if (/not enough values to unpack/.test(m)) return '왼쪽 이름 수보다 값이 적어요. = 양쪽의 개수를 맞춰요';
    if (/empty range|randrange/.test(m)) return '범위가 비었어요. random.randint(작은 수, 큰 수) 처럼 앞이 작아야 해요';
    return '쓸 수 없는 값이에요. print( ) 로 값을 먼저 찍어 봐요';
  }

  function attr(m) {
    if (/'NoneType'/.test(m)) return NONE;
    const a = m.match(/has no attribute '([^']+)'/);
    const mod = m.match(/module '([^']+)' has no attribute/);
    if (mod) return `${q(mod[1])} 에는 ${q(a ? a[1] : '?')} 기능이 없어요. 이름을 확인해요.${suggest(m)}`;
    return `그 값에는 ${q(a ? a[1] : '?')} 기능이 없어요. 점(.) 뒤 이름을 확인해요.${suggest(m)}`;
  }

  function index(m) {
    if (/pop from empty/.test(m)) return '빈 목록에서 꺼내려고 했어요. 목록이 비었는지 먼저 확인해요';
    if (/string index/.test(m)) return '글자 번호가 범위를 넘었어요. 첫 글자는 [0], 마지막은 [len(글자) - 1] 이에요';
    return '목록 번호가 범위를 넘었어요. 첫 칸은 [0], 마지막은 [len(목록) - 1] 이에요';
  }

  const RULES = [
    [/^SyntaxError$/, (t, m) => syntax(m)],
    [/^IndentationError$|^TabError$/, (t, m) => indent(t, m)],
    [/^NameError$|^UnboundLocalError$/, (t, m) => name(t, m)],
    [/^ModuleNotFoundError$|^ImportError$/, (t, m) => module(m)],
    [/^ZeroDivisionError$/, () => '0 으로 나눌 수 없어요. 나누는 수가 0 이 아닌지 if 로 먼저 확인해요'],
    [/^TypeError$/, (t, m) => typeErr(m)],
    [/^IndexError$/, (t, m) => index(m)],
    [/^KeyError$/, (t, m) => `사전에 ${m || '그'} 열쇠가 없어요. print(사전) 으로 어떤 열쇠가 있는지 먼저 봐요`],
    [/^ValueError$/, (t, m) => value(m)],
    [/^AttributeError$/, (t, m) => attr(m)],
    [/^RecursionError$/, () => '함수가 자기 자신을 너무 많이 불렀어요. 멈추는 조건(if)이 있는지 봐요'],
    [/^MemoryError$/, () => '메모리가 모자라요. 아주 큰 목록이나 끝없는 반복을 만들지 않았는지 봐요'],
    [/^OverflowError$/, () => '숫자가 너무 커서 계산할 수 없어요'],
    [/^FileNotFoundError$/, () => '그 파일이 없어요. 브라우저 파이썬은 내 컴퓨터의 파일을 바로 열 수 없어요'],
    [/^AssertionError$/, (t, m) => m ? `확인(assert)이 틀렸어요: ${m}` : '확인(assert)한 조건이 거짓이었어요'],
    [/^StopIteration$/, () => '더 꺼낼 것이 없어요. next( ) 대신 for 로 꺼내 봐요'],
    [/^EOFError$/, () => '입력을 받지 못했어요. 입력 칸에 답을 쓰고 Enter 를 눌러요'],
  ];

  function explain(e, mode) {
    const type = (e && e.type) || '';
    const msg = (e && e.msg) || '';
    fullText = (e && e.text) || '';
    let text;
    // 우리 모듈의 오류는 이미 쉬운 말이다 — sensor.py 의 SensorError, turtle.py 의 "한국어 / English" 글.
    // (학생이 넣은 한글 값이 메시지에 섞인 것과 헷갈리지 않게 이 두 모양만 그대로 쓴다)
    const ours = type === 'SensorError' || (/ \/ /.test(msg) && HANGUL.test(msg.split(' / ')[0]));
    if (ours) text = msg.split(' / ')[0];
    else {
      const r = RULES.find(([re]) => re.test(type));
      text = r ? r[1](type, msg) : `${type || '오류'} 가 나서 멈췄어요. 아래 원래 오류의 마지막 줄이 이유예요`;
    }
    const n = e && e.lineno;
    if (!n) return text;
    // 블록은 사람이 쓴 줄이 없다 — 코드 탭의 몇 번째 줄인지로 알려 준다
    return mode === 'block' ? `${text} (코드 탭의 ${n}번째 줄)` : `${n}번째 줄: ${text}`;
  }

  root.ErrHelp = { explain };
})(typeof window !== 'undefined' ? window : globalThis);
