// ═══════════════════════════════════════════════════════════
// 보관함 — 목록 · 이름 바꾸기 · 지우기 · 내보내기 · 불러오기
// ═══════════════════════════════════════════════════════════
// 임베더도 TF.js 도 쓰지 않는다. 파일과 IndexedDB 만 다룬다. (JSZip 은 전역)

import { Store, exportZip, importZip, PROJECT_EXT } from './project.js';
import { SOURCE_LIST } from './sources.js';
import { Box } from '../../shared/ui/box.js';

const $ = id => document.getElementById(id);
const T = s => (typeof GL_T === 'function' ? GL_T(s) : s);

let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function srcLabel(id) {
  const m = SOURCE_LIST.find(s => s.id === (id || 'image'));
  return m ? T(m.label) : id;
}

function dateText(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '. ' + p(d.getMonth() + 1) + '. ' + p(d.getDate());
}

// ── 목록 ──
async function render() {
  const tbl = $('stTable');
  let list = [];
  try { list = await Store.list(); } catch (e) { console.error(e); }

  $('stEmpty').style.display = list.length ? 'none' : '';
  if (!list.length) { tbl.innerHTML = ''; return; }

  let html = '<tr>' +
    '<th>' + T('이름') + '</th>' +
    '<th>' + T('무엇을 보나요') + '</th>' +
    '<th>' + T('종류') + '</th>' +
    '<th>' + T('예시') + '</th>' +
    '<th>' + T('맞힌 비율') + '</th>' +
    '<th>' + T('만든 날') + '</th>' +
    '<th></th></tr>';

  list.forEach(rec => {
    const total = (rec.sampleCounts || []).reduce((a, b) => a + b, 0);
    html += '<tr data-name="' + esc(rec.name) + '">' +
      '<td class="nm" title="' + esc((rec.classes || []).join(', ')) + '">' + esc(rec.name) + '</td>' +
      '<td>' + esc(srcLabel(rec.source)) + '</td>' +
      '<td class="num">' + (rec.classes || []).length + '</td>' +
      '<td class="num">' + total + '</td>' +
      '<td class="num">' + Math.round((rec.accuracy || 0) * 100) + '%</td>' +
      '<td>' + dateText(rec.createdAt) + '</td>' +
      '<td><div class="acts">' +
        '<a class="db" href="test.html?use=' + encodeURIComponent(rec.name) + '" title="' + T('시험하기') + '">' +
          '<i class="fa-solid fa-flask"></i> ' + T('시험하기') + '</a>' +
        '<a class="db" href="index.html?load=' + encodeURIComponent(rec.name) + '" title="' + T('이어서 배우기') + '">' +
          '<i class="fa-solid fa-graduation-cap"></i> ' + T('이어서 배우기') + '</a>' +
        '<button class="db" data-act="zip" title="' + T('프로젝트 파일로 내보내기') + '">' +
          '<i class="fa-solid fa-file-arrow-down"></i></button>' +
        '<button class="db" data-act="rename" title="' + T('이름 바꾸기') + '">' +
          '<i class="fa-solid fa-pen"></i></button>' +
        '<button class="db danger" data-act="del" title="' + T('지우기') + '">' +
          '<i class="fa-solid fa-trash"></i></button>' +
      '</div></td></tr>';
  });
  tbl.innerHTML = html;
}

// ── 동작 ──
async function act(name, what, btn) {
  const rec = await Store.get(name);
  if (!rec) { toast(T('AI를 불러오지 못했어요')); return; }

  if (what === 'zip') {
    try { await exportZip(rec); toast(T('내보냈어요') + ': ' + rec.name + PROJECT_EXT); }
    catch (e) { console.error(e); toast(T('내보내지 못했어요')); }
    return;
  }

  if (what === 'rename') {
    const next = prompt(T('새 이름을 적어 주세요'), rec.name);
    if (next == null) return;
    try {
      await Store.rename(rec.name, next.trim());
      toast(T('이름을 바꿨어요'));
      render();
    } catch (e) {
      toast(e && e.message === 'exists' ? T('같은 이름이 이미 있어요') : T('바꾸지 못했어요'));
    }
    return;
  }

  if (what === 'del') {
    if (!confirm(T('정말 지울까요?') + '\n' + rec.name)) return;
    try { await Store.remove(rec.name); toast(T('지웠어요')); render(); }
    catch (e) { console.error(e); toast(T('지우지 못했어요')); }
  }
}

$('stTable').addEventListener('click', ev => {
  const btn = ev.target.closest('button[data-act]');
  if (!btn) return;
  const row = btn.closest('tr');
  if (!row) return;
  act(row.dataset.name, btn.dataset.act, btn);
});

// ── 불러오기 (놓기 · 고르기) ──
async function takeFile(file) {
  if (!file) return;
  try {
    const rec = await importZip(file);
    toast(T('들어왔어요') + ': ' + rec.name);
    render();
  } catch (e) {
    console.error(e);
    toast(T('파일을 읽지 못했어요. 내보낸 파일이 맞는지 확인해 주세요'));
  }
}

const dz = $('dropzone');
dz.addEventListener('click', () => $('zipInput').click());
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
dz.addEventListener('dragleave', () => dz.classList.remove('over'));
dz.addEventListener('drop', e => {
  e.preventDefault();
  dz.classList.remove('over');
  takeFile((e.dataTransfer.files || [])[0]);
});
$('zipInput').addEventListener('change', e => {
  const f = (e.target.files || [])[0];
  e.target.value = '';
  takeFile(f);
});

// ── 시작 ──
$('engine').textContent = T('준비 완료');
render();


// ═══ 운전 AI · 코딩 작품 (공용 보관함 shared/ui/box.js) ═══
const OPEN = {
  drive: it => '../act/drive.html?box=' + encodeURIComponent(it.id),
  code: it => '../code/index.html?box=' + encodeURIComponent(it.id) + '&mode=' + (it.data && it.data.mode === 'python' ? 'python' : 'block'),
};
const EMPTY = {
  drive: '아직 없어요. 운전 따라 배우기에서 배운 뒤 [보관함에 저장]을 눌러요.',
  code: '아직 없어요. 블록 · 파이썬에서 [보관함에 저장]을 눌러요.',
};
function fileOf(it) {
  if (it.kind === 'drive') return { name: 'car-ai.json', type: 'application/json', text: JSON.stringify(it.data) };
  if (it.data.mode === 'python') return { name: 'code.py', type: 'text/x-python', text: it.data.code || '' };
  return { name: 'blocks.json', type: 'application/json', text: JSON.stringify(it.data.blocks, null, 2) };
}
async function renderBox(kind) {
  const box = $(kind + 'List');
  let items = [];
  try { items = await Box.list(kind); } catch (e) { console.error(e); }
  if (!items.length) { box.innerHTML = '<div class="hint" style="margin-top:0">' + esc(T(EMPTY[kind])) + '</div>'; return; }
  box.innerHTML = '';
  items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'brow';
    const icon = kind === 'drive' ? 'fa-car-side' : (it.data && it.data.mode === 'python' ? 'fa-brands fa-python' : 'fa-cubes');
    row.innerHTML = '<i class="' + (icon.startsWith('fa-brands') ? icon : 'fa-solid ' + icon) + '"></i>' +
      '<span class="nm">' + esc(it.name) + '</span><span class="dt">' + dateText(it.createdAt) + '</span>' +
      '<div class="acts"><a class="db" href="' + OPEN[kind](it) + '" title="' + T('열기') + '"><i class="fa-solid fa-folder-open"></i> ' + T('열기') + '</a>' +
      '<button class="db" data-a="file" title="' + T('파일로 내려받기') + '"><i class="fa-solid fa-file-arrow-down"></i></button>' +
      '<button class="db" data-a="ren" title="' + T('이름 바꾸기') + '"><i class="fa-solid fa-pen"></i></button>' +
      '<button class="db danger" data-a="del" title="' + T('지우기') + '"><i class="fa-solid fa-trash"></i></button></div>';
    row.querySelector('[data-a=file]').addEventListener('click', () => {
      const f = fileOf(it);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([f.text], { type: f.type }));
      a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    row.querySelector('[data-a=ren]').addEventListener('click', async () => {
      const n = prompt(T('새 이름'), it.name);
      if (n && n.trim()) { await Box.rename(it.id, n); renderBox(kind); }
    });
    row.querySelector('[data-a=del]').addEventListener('click', async () => {
      if (!confirm(T('지울까요?') + ' ' + it.name)) return;
      await Box.del(it.id); renderBox(kind);
    });
    box.appendChild(row);
  });
}
renderBox('drive');
renderBox('code');
