// 코딩 화면 오류 설명 (code/lib/errhelp.js) — 실제 파이썬 메시지로 알맞은 안내가 나오는지
import { test } from 'node:test';
import assert from 'node:assert/strict';
await import('../code/lib/errhelp.js');
const ex = (type, msg, lineno = 4, mode = 'python') => globalThis.ErrHelp.explain({ type, msg, lineno }, mode);

test('TypeError 를 메시지로 가른다 — None 에 엉뚱한 "글자 + 숫자" 안내가 나오지 않는다', () => {
  assert.match(ex('TypeError', "'NoneType' object does not support item assignment"), /^4번째 줄: 값이 비어 있어요\(None\)/);
  assert.match(ex('TypeError', 'can only concatenate str (not "int") to str'), /글자와 숫자/);
  assert.match(ex('TypeError', "'int' object is not iterable"), /range/);
  assert.match(ex('TypeError', 'f() takes 1 positional argument but 2 were given'), /개수/);
  assert.match(ex('AttributeError', "'NoneType' object has no attribute 'append'"), /None/);
});

test('문법 · 들여쓰기 · 이름', () => {
  assert.match(ex('SyntaxError', "invalid character '（' (U+FF08)"), /한글 자판/);
  assert.match(ex('SyntaxError', "'(' was never closed"), /괄호/);
  assert.match(ex('SyntaxError', "expected ':'"), /콜론/);
  assert.match(ex('SyntaxError', "invalid syntax. Maybe you meant '==' or ':=' instead of '='?"), /==/);
  assert.match(ex('IndentationError', "expected an indented block after 'if' statement on line 1"), /들여써야/);
  assert.match(ex('NameError', "name 'true' is not defined"), /True/);
  assert.match(ex('NameError', "name '안녕' is not defined"), /'안녕'이 글자라면 따옴표/);
  assert.match(ex('NameError', "name 'prnt' is not defined. Did you mean: 'print'?"), /혹시 'print'/);
  // 3.12+ : 추천은 Traceback 끝에만 있다
  assert.match(globalThis.ErrHelp.explain({ type: 'NameError', msg: "name 'prnt' is not defined", lineno: 1,
    text: "Traceback (most recent call last):\n  File \"main.py\", line 1\nNameError: name 'prnt' is not defined. Did you mean: 'print'?" }, 'python'), /혹시 'print'/);
});

test('값 · 번호 · 모듈, 조사도 받침에 맞게', () => {
  assert.match(ex('ValueError', "invalid literal for int() with base 10: '열'"), /'열'은 숫자로/);
  assert.match(ex('ValueError', "invalid literal for int() with base 10: ''"), /빈 글자/);
  assert.match(ex('IndexError', 'list index out of range'), /\[0\]/);
  assert.match(ex('ModuleNotFoundError', "No module named 'pygame'"), /'pygame'는 이 브라우저 파이썬에 없어요/);
  assert.match(ex('ZeroDivisionError', 'division by zero'), /0 으로/);
});

test('우리 모듈의 한국어 오류는 그대로, 블록은 코드 탭 줄 번호로', () => {
  assert.equal(ex('SensorError', '카메라·마이크를 쓰도록 허락해 주세요', 3), '3번째 줄: 카메라·마이크를 쓰도록 허락해 주세요');
  assert.equal(ex('NotImplementedError', 'turtle.onkey() 는 아직 지원하지 않아요 / turtle.onkey() is not supported yet', 2), '2번째 줄: turtle.onkey() 는 아직 지원하지 않아요');
  assert.match(ex('ZeroDivisionError', 'division by zero', 7, 'block'), /\(코드 탭의 7번째 줄\)$/);
  assert.match(ex('KeyError', "'사과'"), /'사과' 열쇠/);   // 학생 값의 한글은 우리 오류로 착각하지 않는다
  assert.match(ex('WeirdError', 'x'), /원래 오류의 마지막 줄/);
});
