// ═══════════════════════════════════════════════════════════
// 학습지 — 첫 화면(메뉴 넷 전부)과 메뉴 화면(메뉴 하나)을 그린다
// ═══════════════════════════════════════════════════════════
// menu.js · icons.js · nav.js 다음에 불러온다.
//   <div class="sheet" data-sheet="all"></div>     첫 화면
//   <div class="sheet" data-sheet="teach"></div>   메뉴 화면

(function () {
  const A = window.AILAB, MENU = window.AILAB_MENU, ICON = window.AILAB_ICON;
  const T = A.T, en = A.lang === 'en';
  const el = document.querySelector('[data-sheet]');
  if (!el) return;
  const which = el.dataset.sheet;
  const list = which === 'all' ? MENU : MENU.filter(m => m.id === which);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // 손으로 그린 동그라미 (빨간 펜)
  const RING = '<svg class="ring" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M12 54 C10 22 40 6 62 9 C88 13 96 40 90 64 C83 90 46 98 24 86 C10 78 8 64 14 50"/></svg>';
  const ARROW = '<span class="arrow"><svg width="30" height="14" viewBox="0 0 30 14"><path d="M2 7 H26 M20 2 L27 7 L20 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

  let html = '';
  if (which === 'all') {
    html += '<div class="sheet-top"><h2>' + (en ? 'AI worksheet' : '인공지능 학습지') + '</h2>'
      + '<p>' + (en ? 'Look, teach, then make.' : '보고, 가르치고, 만들어 봐요.') + '</p>'
      + '<div class="nm">' + (en ? 'Name' : '이름') + '<span></span>' + (en ? 'Date' : '날짜') + '<span></span></div>'
      + '<a class="guide-link" href="' + A.href('guide/index.html') + '"><i class="fa-solid fa-book-open"></i> ' + (en ? 'Guide for teachers' : '선생님 가이드') + '</a></div>';
  } else {
    const m = list[0];
    html += '<div class="sheet-top"><h2>' + esc(T(m)) + '</h2><p>' + esc(T(m.sub)) + '</p></div>';
  }
  html += '<div class="rows">';
  list.forEach(m => {
    const n = MENU.indexOf(m) + 1;
    const wide = m.acts.length <= 2 && !!m.aside;
    html += '<div class="srow c-' + m.color + (wide ? ' wide' : '') + '">';
    const labTag = which === 'all' ? 'a href="' + A.href(m.id + '/index.html') + '"' : 'div';
    html += '<' + labTag + ' class="slab"><span class="no">' + n + '</span><div><b>' + esc(T(m)) + '</b>'
      + '<small>' + esc(T(m.sub)) + '</small><em>' + esc(T(m.tag)) + '</em></div></' + labTag.split(' ')[0] + '>';
    html += '<div class="cells">';
    m.acts.forEach((a, i) => {
      if (m.ladder && i > 0) html += ARROW;
      html += '<a class="cell" href="' + A.href(a.href) + '">' + ICON(a.id)
        + '<b>' + esc(T(a)) + '</b>'
        + (which !== 'all' && a.desc ? '<span class="desc">' + esc(T(a.desc)) + '</span>' : '')
        + '<small>' + esc(T(a.note)) + '</small>'
        + (a.first && which === 'all' ? RING + '<span class="redpen first-note">' + (en ? 'Start<br>here!' : '처음이면<br>여기부터!') + '</span>' : '')
        + '</a>';
    });
    if (wide) {
      const t = m.aside[A.lang] || m.aside.ko;
      html += '<div class="aside"><div><b>' + esc(t[0]) + '</b><br>' + t.slice(1).map(esc).join('<br>') + '</div></div>';
    }
    html += '</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;
  if (which !== 'all') { el.classList.add('menu-sheet'); if (list[0].ladder) el.classList.add('ladder'); }
})();
