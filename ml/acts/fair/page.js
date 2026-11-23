// ═══════════════════════════════════════════════════════════
// 공정 활동 — 화면 로직
// ═══════════════════════════════════════════════════════════
// 이야기: 코딩 동아리가 작년 선발 기록(AI의 교과서)으로 선발 AI를 만든다. 작년 심사는 2반에 불공정했다.
// 화면의 중심은 "실력이 똑같은 세 친구" (1반·걸어서 / 2반·버스 / 2반·걸어서) 의 합격 여부.
// 미션 네 개를 차례로 누르며 본다:
//   1 작년 기록 그대로 → AI 가 "2반인가?" 를 물어 2반 둘 다 불합격
//   2 '2반인가' 가리기 → 이번엔 "통학 버스를 타나?" 를 물어 버스 타는 친구만 불합격 (대리 변수)
//   3 '통학 버스'도 가리기 → 셋 다 합격
//   4 기록을 실력대로 고치기 (정보는 다 보여 줌) → 셋 다 합격, 정확도도 가장 높다
// "직접 골라서 만들기" 에서 정보 · 질문 단계 · 교과서(불공정 정도 · 2반 수 · 고치기)를 직접 바꿀 수 있다.
// 비교표는 결과 기록일 뿐 학습에 쓰지 않는다 (AI 만들기는 늘 교과서로 처음부터 새로 만든다).

import { FEATURES, WORLD, pastData, thisYear, buildTree, predict, audit, usedFeatures } from './fair.js';

const T = s => (typeof GL_T === 'function' ? GL_T(s) : s);
const $ = id => document.getElementById(id);

const BIAS_LEVELS = [[0, '없음'], [0.12, '조금'], [0.25, '많이'], [0.35, '아주 많이']];
const DEFAULT = { bias: 2, n2: 60, depth: 3 };
const FEAT = Object.fromEntries(FEATURES.map(f => [f.id, f]));
const ALL_FEATS = FEATURES.map(f => f.id);
const FLAGGED = new Set(['class2', 'bus']);           // 실력과 상관없는 정보
const FEAT_ICON = { practice: 'fa-clock', works: 'fa-laptop-code', attend: 'fa-calendar-check', class2: 'fa-users', bus: 'fa-bus' };
// 세상 설정 (고급): 반별 버스 비율 · 버스 타는 친구의 출석률 기록 감점. 올해 지원자도 같은 세상에서 다시 만든다
const world = () => ({ bus1: +$('bus1').value / 100, bus2: +$('bus2').value / 100, attendPenalty: +$('attPen').value });
const isDefaultWorld = w => w.bus1 === WORLD.bus1 && w.bus2 === WORLD.bus2 && w.attendPenalty === WORLD.attendPenalty;
let test = thisYear();

const MISSIONS = [
  { title: '작년 기록 그대로 AI 만들기', feats: ALL_FEATS, fix: false, step: 2 },
  { title: "'2반인가' 정보 가리기", feats: ['practice', 'works', 'attend', 'bus'], fix: false, step: 2 },
  { title: "'통학 버스'도 가리기", feats: ['practice', 'works', 'attend'], fix: false, step: 3 },
  { title: '기록을 실력대로 고치기', feats: ALL_FEATS, fix: true, step: 3 },
];
const FRIENDS = [
  { name: '민수', class2: 0, bus: 0 },
  { name: '지우', class2: 1, bus: 1 },
  { name: '서연', class2: 1, bus: 0 },
];

let rows = [], tree = null, treeFeats = [], lastMission = -1;
const done = new Set();
const logRows = [];

// ── 도우미 ──────────────────────────────────────────────────
let toastTimer = 0;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2400);
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = v => Math.round(v * 100) + '%';
function setStep(n) {
  for (let i = 1; i <= 3; i++) {
    $('s' + i).classList.toggle('on', i === n);
    $('s' + i).classList.toggle('done', i < n);
  }
}
const labelKey = () => $('fixLabel').checked ? 'fit' : 'passed';
const classLabel = c => (c ? T('2반') : T('1반'));

// 질문 문장: 숫자는 "연습 시간 6시간 이상?", 예/아니요는 "2반인가?"
function question(f, th) {
  const d = FEAT[f];
  if (d.kind === 'bool') return f === 'class2' ? T('2반인가?') : T('통학 버스를 타나?');
  return `${T(d.label)} ${Math.ceil(th)}${T(d.unit)} ${T('이상?')}`;
}

// ── 왼쪽: 교과서 (작년 기록) ────────────────────────────────
function makeRows() {
  const bias = BIAS_LEVELS[+$('bias').value][0];
  const w = world();
  rows = pastData({ n2: +$('n2').value, bias, world: w });
  test = thisYear({ world: w });
  $('bus1Val').textContent = Math.round(w.bus1 * 100) + '%'; $('bus2Val').textContent = Math.round(w.bus2 * 100) + '%';
  $('attPenVal').textContent = w.attendPenalty + '%p';
  $('n2Val').textContent = `${$('n2').value}${T('명')}`;
  $('biasVal').textContent = T(BIAS_LEVELS[+$('bias').value][1]);
  const lk = labelKey();
  // 실력으로 붙었어야 할 친구(fit) 중 기록상 합격한 친구 — 사람 아이콘으로
  const stat = [0, 1].map(c => {
    const fit = rows.filter(r => r.class2 === c && r.fit);
    return { fit: fit.length, pass: fit.filter(r => r[lk]).length };
  });
  $('dataSummary').innerHTML = stat.map((s, c) => `
    <div class="dotrow">
      <div class="dotlb"><b>${classLabel(c)}</b> <span>${T('실력 되는 {n}명 중').replace('{n}', s.fit)} <b class="${s.pass < s.fit ? 'warnt' : 'okt'}">${T('{n}명 합격').replace('{n}', s.pass)}</b></span></div>
      <div class="dots">${Array.from({ length: s.fit }, (_, i) => i < s.pass
        ? '<i class="fa-solid fa-user pass"></i>' : '<i class="fa-solid fa-user fail"></i>').join('')}</div>
    </div>`).join('');
  const s2 = stat[1];
  $('dataNote').innerHTML = s2.pass < s2.fit
    ? T('2반은 실력이 돼도 {k}명 중 {m}명만 붙었어요. AI는 이 기록을 <b>정답이라고 믿고</b> 따라 배워요.')
      .replace('{k}', s2.fit).replace('{m}', s2.pass)
    : T('두 반 모두 실력대로 붙은 기록이에요. AI가 배울 차별이 없어요.');
  // 표: 몇 명만 (두 반 섞어서)
  const sample = [];
  for (let i = 0; sample.length < 8 && i < rows.length; i++) {
    const r = rows[(i * 37) % rows.length];
    if (!sample.includes(r)) sample.push(r);
  }
  $('dataTable').innerHTML = `<tr><th>${T('반')}</th><th>${T('버스')}</th><th>${T('연습')}</th><th>${T('작품')}</th><th>${T('출석')}</th><th>${T('결과')}</th></tr>` +
    sample.map(r => `<tr><td>${r.class2 ? 2 : 1}</td><td>${r.bus ? '○' : ''}</td><td class="num">${r.practice}</td><td class="num">${r.works}</td>
      <td class="num">${r.attend}</td><td class="${r[lk] ? 'ok' : 'low'}">${r[lk] ? T('합격') : T('불합격')}</td></tr>`).join('');
}
['n2', 'bias', 'bus1', 'bus2', 'attPen'].forEach(id => $(id).addEventListener('input', () => { makeRows(); renderFriends(); staleHint(); }));
$('fixLabel').addEventListener('change', () => { makeRows(); staleHint(); });
function staleHint() {
  if (tree) $('missionMsg').innerHTML = `<i class="fa-solid fa-circle-info"></i> ${T('교과서를 바꿨어요. AI 만들기를 눌러야 AI가 바뀌어요.')}`;
}

// ── 미션 버튼 ───────────────────────────────────────────────
function renderMissions() {
  $('missions').innerHTML = MISSIONS.map((m, i) => `
    <button type="button" class="mission${i === lastMission ? ' on' : ''}${done.has(i) ? ' done' : ''}" data-i="${i}">
      <span class="mn">${done.has(i) ? '<i class="fa-solid fa-check"></i>' : i + 1}</span><span>${T(m.title)}</span></button>`).join('');
  $('missions').querySelectorAll('.mission').forEach(b => b.addEventListener('click', () => runMission(+b.dataset.i)));
}
function runMission(i) {
  const m = MISSIONS[i];
  // 미션은 늘 같은 교과서 · 같은 질문 단계로 — 모든 모둠이 같은 결과를 본다
  $('bias').value = DEFAULT.bias; $('n2').value = DEFAULT.n2; $('depth').value = DEFAULT.depth;
  $('bus1').value = WORLD.bus1 * 100; $('bus2').value = WORLD.bus2 * 100; $('attPen').value = WORLD.attendPenalty;
  $('depthVal').textContent = DEFAULT.depth;
  $('fixLabel').checked = m.fix;
  $('feats').querySelectorAll('input').forEach(inp => { inp.checked = m.feats.includes(inp.dataset.f); });
  makeRows();
  lastMission = i; done.add(i);
  build();
  setStep(m.step);
  renderMissions();
}

// ── 직접 고르기 ─────────────────────────────────────────────
$('feats').innerHTML = FEATURES.map(f => `
  <label class="feat${FLAGGED.has(f.id) ? ' warnish' : ''}"><input type="checkbox" data-f="${f.id}" checked>
    <i class="fa-solid ${FEAT_ICON[f.id]}"></i> ${T(f.label)}</label>`).join('');
$('feats').addEventListener('change', staleHintFeats);
function staleHintFeats() {
  if (tree) $('missionMsg').innerHTML = `<i class="fa-solid fa-circle-info"></i> ${T('정보를 바꿨어요. AI 만들기를 눌러야 AI가 바뀌어요.')}`;
}
$('depth').addEventListener('input', () => { $('depthVal').textContent = $('depth').value; staleHintFeats(); });
$('trainBtn').addEventListener('click', () => {
  lastMission = -1;
  if (!build()) return;
  setStep($('fixLabel').checked ? 3 : 2);
  renderMissions();
});

// ── AI 만들기 (늘 교과서로 처음부터 새로) ──────────────────
function build() {
  treeFeats = [...$('feats').querySelectorAll('input:checked')].map(i => i.dataset.f);
  if (!treeFeats.length) { toast(T('볼 수 있는 정보를 하나 이상 골라 주세요')); return false; }
  tree = buildTree(rows, labelKey(), treeFeats, { maxDepth: +$('depth').value });
  renderTree(); renderFriends(); renderResult(); renderMessage();
  return true;
}

// 친구 한 명이 나무를 따라간 길: [{ f, th, yes }]
function pathOf(r) {
  const out = [];
  let t = tree;
  while (!t.leaf) { const yes = r[t.f] >= t.th; out.push({ f: t.f, th: t.th, yes }); t = yes ? t.yes : t.no; }
  return out;
}
const flaggedQs = () => [...usedFeatures(tree)].filter(f => FLAGGED.has(f)).map(f => `'${question(f, 0.5)}'`);

function renderMessage() {
  const qs = flaggedQs(), used = usedFeatures(tree);
  let msg;
  if (lastMission === 0) {
    msg = T('AI가 작년 기록을 따라 배웠어요.') + ' ' + (qs.length
      ? T('그런데 {q} 하고 물어요 — 작년 심사의 불공정까지 배웠어요.').replace('{q}', qs.join(', '))
      : T('실력 정보만 보고 골라요.'));
  } else if (lastMission === 1) {
    msg = T("'2반인가'를 가렸어요.") + ' ' + (used.has('bus')
      ? T("그런데 이번엔 '통학 버스를 타나?' 하고 물어요. 2반 친구 대부분이 버스를 타서, 버스가 2반을 대신 알려 줘요.")
      : T('이제 실력 정보만 보고 골라요.'));
  } else if (lastMission === 2) {
    msg = T("'통학 버스'까지 가렸어요.") + ' ' + (qs.length
      ? T('그래도 {q} 하고 물어요.').replace('{q}', qs.join(', '))
      : T('이제 AI는 실력 정보만 보고 골라요.'));
  } else if (lastMission === 3) {
    msg = T('교과서를 실력대로 다시 심사한 기록으로 바꿨어요.') + ' ' + (qs.length
      ? T('그래도 {q} 하고 물어요.').replace('{q}', qs.join(', '))
      : T('반 · 버스 정보를 다 보여 줘도 AI가 실력만 보고 골라요 — 배울 차별이 없으니까요.'));
  } else {
    msg = T('직접 고른 설정으로 만들었어요.') + ' ' + (qs.length
      ? T('AI가 {q} 하고 물어요 — 실력과 상관없는 정보예요.').replace('{q}', qs.join(', '))
      : T('AI가 실력 정보만 보고 골라요.'));
  }
  $('missionMsg').innerHTML = `<i class="fa-solid ${qs.length ? 'fa-triangle-exclamation warnt' : 'fa-circle-check okt'}"></i> ${esc(msg)}`;
}

// ── 세 친구 ─────────────────────────────────────────────────
const W_UNITS = { wPractice: '시간', wWorks: '개', wAttend: '%' };
const wLabel = id => { $(id + 'Val').textContent = $(id).value + T(W_UNITS[id]); };
for (const id of Object.keys(W_UNITS)) { wLabel(id); $(id).addEventListener('input', () => { wLabel(id); renderFriends(); }); }
const skill = () => ({ practice: +$('wPractice').value, works: +$('wWorks').value, attend: +$('wAttend').value });

function renderFriends() {
  const base = skill();
  $('skillLine').textContent = T('셋 다 연습 {p}시간 · 작품 {w}개 · 출석 {a}% — 다른 건 반과 통학 방법뿐이에요.')
    .replace('{p}', base.practice).replace('{w}', base.works).replace('{a}', base.attend);
  const pen = world().attendPenalty;
  const res = FRIENDS.map(f => {
    // 진짜 출석은 같아도, 버스 타는 친구는 기록에 낮게 적힌다 (세상 설정)
    const r = { ...base, attend: f.bus ? Math.max(40, base.attend - pen) : base.attend, class2: f.class2, bus: f.bus };
    return { ...f, pass: tree ? predict(tree, r) : null, path: tree ? pathOf(r) : [] };
  });
  $('friends').innerHTML = res.map(f => `
    <div class="friend ${f.pass === null ? '' : f.pass ? 'pass' : 'fail'}">
      <i class="fa-solid fa-user-graduate face"></i>
      <div class="fname">${T(f.name)}</div>
      <div class="ftag">${classLabel(f.class2)} · <i class="fa-solid ${f.bus ? 'fa-bus' : 'fa-person-walking'}"></i> ${f.bus ? T('버스') : T('걸어서')}</div>
      ${f.bus && pen ? `<div class="ftag warnt">${T('기록상 출석 {a}%').replace('{a}', Math.max(40, base.attend - pen))}</div>` : ''}
      <div class="stamp">${f.pass === null ? '?' : f.pass ? T('합격') : T('불합격')}</div>
    </div>`).join('');
  if (!tree) { $('verdict').innerHTML = `<div class="hint">${T('위의 1번을 누르면 AI가 세 친구를 골라요.')}</div>`; return; }
  const passes = new Set(res.map(f => f.pass));
  if (passes.size === 1) {
    $('verdict').innerHTML = `<div class="vline okt"><i class="fa-solid fa-circle-check"></i> ${res[0].pass ? T('셋 다 합격') : T('셋 다 불합격')} — ${T('실력이 같으면 결과도 같아요.')}</div>`;
    return;
  }
  // 떨어진 친구가 어느 질문에서 갈렸는지 (실력과 상관없는 질문)
  const why = res.filter(f => !f.pass).map(f => {
    const q = [...f.path].reverse().find(p => FLAGGED.has(p.f));
    return q ? `<li><b>${T(f.name)}</b>: ${esc(T("'{q}'에 '{a}'라서 떨어졌어요").replace('{q}', question(q.f, q.th)).replace('{a}', q.yes ? T('예') : T('아니요')))}</li>` : '';
  }).join('');
  $('verdict').innerHTML = `<div class="vline warnt"><i class="fa-solid fa-triangle-exclamation"></i> ${T('실력은 똑같은데 결과가 달라요!')}</div>${why ? `<ul class="why">${why}</ul>` : ''}`;
}

// ── 질문 나무 ───────────────────────────────────────────────
function renderTree() {
  const node = t => {
    if (t.leaf) {
      return `<div class="tnode leaf ${t.pass ? 'pass' : 'fail'}"><b>${t.pass ? T('합격') : T('불합격')}</b>
        <span class="num">${T('기록')} ${t.n}${T('명')} ${T('중')} ${T('합격')} ${t.pos}</span></div>`;
    }
    return `<div class="tnode q${FLAGGED.has(t.f) ? ' flag' : ''}">${esc(question(t.f, t.th))}</div>
      <div class="tkids">
        <div class="tkid"><div class="tedge">${T('예')}</div>${node(t.yes)}</div>
        <div class="tkid"><div class="tedge">${T('아니요')}</div>${node(t.no)}</div>
      </div>`;
  };
  const used = usedFeatures(tree);
  $('tree').innerHTML = `<div class="treewrap"><div class="tree">${node(tree)}</div></div>
    <div class="hint">${T('AI가 쓴 정보')}: ${[...used].map(f => T(FEAT[f].label)).join(', ') || T('없음')}
    ${[...used].some(f => FLAGGED.has(f)) ? `<br><b class="warnt">${T('빨간 질문은 실력과 상관없는 정보예요!')}</b>` : ''}</div>`;
}

// ── 오른쪽: 올해 지원자 200명 · 비교표 ─────────────────────
function renderResult() {
  const a = audit(tree, test);
  const bar = (label, v, cls = '') => `<div class="bar${cls}"><div class="bl"><span>${label}</span><span class="num">${pct(v)}</span></div>
    <div class="bt"><div class="bf" style="width:${v * 100}%"></div></div></div>`;
  const gap = Math.round(Math.abs(a.gap) * 100);
  $('result').innerHTML = `
    <div class="pb-label" style="margin-top:10px">${T('반별 합격률')}</div>
    ${bar(T('1반'), a.pass1)}${bar(T('2반'), a.pass2)}
    <div class="gap ${gap >= 10 ? 'bad' : 'good'}">${T('차이')} ${gap}%p
      ${gap >= 10 ? T('— 실력이 같은데 차이가 커요') : T('— 거의 같아요')}</div>
    <div class="pb-label" style="margin-top:10px">${T('실력대로 맞게 고른 비율 (정확도)')}</div>
    ${bar('', a.accuracy, ' top')}`;
  // 비교표: 같은 설정은 한 줄만 (다시 누르면 맨 위로 올린다)
  const fix = $('fixLabel').checked, biasIdx = +$('bias').value, n2 = +$('n2').value, depth = +$('depth').value, w = world();
  const key = [treeFeats.join(','), fix, biasIdx, n2, depth, w.bus1, w.bus2, w.attendPenalty].join('|');
  const name = lastMission >= 0 ? `${lastMission + 1}. ${T(MISSIONS[lastMission].title)}`
    : `${T('직접')}: ${treeFeats.length === 5 ? T('정보 전부') : treeFeats.map(f => T(FEAT[f].label)).join('·')}`;
  const isDefault = biasIdx === DEFAULT.bias && n2 === DEFAULT.n2 && depth === DEFAULT.depth;
  const sub = [fix ? T('고친 기록') : null,
    !isDefault ? `${T('불공정')} ${T(BIAS_LEVELS[biasIdx][1])} · ${T('2반')} ${n2}${T('명')} · ${T('질문')} ${depth}${T('단계')}` : null,
    !isDefaultWorld(w) ? `${T('버스')} ${T('1반')} ${Math.round(w.bus1 * 100)}% · ${T('2반')} ${Math.round(w.bus2 * 100)}%${w.attendPenalty ? ` · ${T('출석 감점')} ${w.attendPenalty}%p` : ''}` : null].filter(Boolean).join(' · ');
  const old = logRows.findIndex(r => r.key === key);
  if (old >= 0) logRows.splice(old, 1);
  logRows.unshift({ key, name, sub, a });
  logRows.length = Math.min(logRows.length, 10);
  renderLog();
}
function renderLog() {
  if (!logRows.length) { $('log').innerHTML = ''; return; }
  $('log').innerHTML = `<table class="mk-table exam">
    <tr><th>${T('설정')}</th><th>${T('1반')}</th><th>${T('2반')}</th><th>${T('차이')}</th><th>${T('정확도')}</th></tr>
    ${logRows.map(r => {
      const gap = Math.round(Math.abs(r.a.gap) * 100);
      return `<tr><td class="nm">${esc(r.name)}${r.sub ? `<div class="sub">${esc(r.sub)}</div>` : ''}</td>
        <td class="num">${pct(r.a.pass1)}</td><td class="num">${pct(r.a.pass2)}</td>
        <td class="num${gap >= 10 ? ' low' : ''}">${gap}%p</td><td class="num">${pct(r.a.accuracy)}</td></tr>`;
    }).join('')}
  </table>`;
}

// ── 시작 ────────────────────────────────────────────────────
$('engine').textContent = T('인터넷 없이 이 컴퓨터에서 배워요');
makeRows(); renderMissions(); renderFriends(); renderLog();
