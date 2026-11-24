// ═══════════════════════════════════════════════════════════
// 화면을 그리기 전에 — 밝게 · 어둡게, 한 · 영
// ═══════════════════════════════════════════════════════════
// <head> 안, CSS 다음에 둔다. 몸통을 그리기 전에 정해야 번쩍이지 않는다.
//   html[data-theme="dark"]  어둡게 (칠판) — 고르지 않았으면 밝게(학습지)
//   html[lang]               ko · en — 상단바 단추가 localStorage 'language' 에 적어 둔다
(function () {
  var d = document.documentElement;
  try {
    var t = localStorage.getItem('ailab-theme');
    if (t === 'dark') d.setAttribute('data-theme', 'dark');
    var l = localStorage.getItem('language');
    if (l === 'en' || l === 'ko') d.setAttribute('lang', l);
  } catch (e) { /* 저장소를 못 쓰면 밝게 · 기본 언어 */ }
})();
