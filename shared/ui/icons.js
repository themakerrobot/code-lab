// ═══════════════════════════════════════════════════════════
// 활동 그림 — 펜 선으로 그린 작은 그림 (첫 화면 · 메뉴 화면 카드)
// ═══════════════════════════════════════════════════════════
// 아이콘 글꼴 대신 활동마다 직접 그린다. 색은 CSS 가 정한다:
//   .ln = 연필 선(--ink2) · .ac = 메뉴 색 선 · .dot = 메뉴 색 점 · .fl = 메뉴 색 옅은 면
// viewBox 는 전부 0 0 76 54.

window.AILAB_ICONS = {
  look: '<path class="ln" d="M30 50 V30 M30 30 V10 M38 30 V7 M46 30 V10 M54 32 V16 M30 30 Q22 26 20 34 Q24 44 34 50 H50 Q56 44 54 32"/><g class="dot"><circle cx="30" cy="10" r="2.6"/><circle cx="38" cy="7" r="2.6"/><circle cx="46" cy="10" r="2.6"/><circle cx="54" cy="16" r="2.6"/><circle cx="20" cy="34" r="2.6"/><circle cx="38" cy="30" r="2.6"/></g><path class="ac thin" d="M30 10 L38 30 L46 10 M38 7 L38 30 L54 16"/>',
  sound: '<path class="ln" d="M10 27 H16 M20 18 V36 M26 10 V44 M32 20 V34 M38 14 V40 M44 22 V32"/><path class="ac" d="M54 14 V36 M54 14 L66 10 V32"/><circle class="ac" cx="51" cy="36" r="3.5"/><circle class="ac" cx="63" cy="32" r="3.5"/>',
  bg: '<rect class="ln" x="6" y="6" width="64" height="44" rx="3"/><path class="ac" d="M6 40 L22 26 L32 34 L46 20 L70 40"/><circle class="dot" cx="58" cy="15" r="3"/><path class="ln" d="M38 50 V44 Q38 36 30 36 H28 M38 44 Q38 36 46 36 H48"/><circle class="ln paper" cx="38" cy="29" r="5"/>',
  cloak: '<path class="fl" d="M30 8 Q38 4 46 8 L52 46 Q38 52 24 46 Z"/><path class="ln" d="M30 8 Q38 4 46 8 L52 46 Q38 52 24 46 Z"/><path class="ac dash" d="M28 22 Q38 28 48 22"/>',
  voice: '<path class="ln" d="M10 10 H50 Q54 10 54 14 V32 Q54 36 50 36 H26 L16 44 V36 H14 Q10 36 10 32 Z"/><path class="ac" d="M60 16 Q64 23 60 30 M66 12 Q72 23 66 34"/><path class="ln thin" d="M18 20 H44 M18 27 H36"/>',
  myai: '<rect class="ln" x="18" y="14" width="40" height="28" rx="4"/><circle class="ln" cx="38" cy="28" r="8"/><path class="ln" d="M30 14 L33 9 H43 L46 14"/><g class="ac thin"><rect x="2" y="40" width="12" height="10" rx="1.5"/><rect x="62" y="40" width="12" height="10" rx="1.5"/><rect x="62" y="4" width="12" height="10" rx="1.5"/></g>',
  drive: '<ellipse class="ln" cx="38" cy="27" rx="32" ry="20"/><ellipse class="ln" cx="38" cy="27" rx="20" ry="10"/><ellipse class="ac dash thin" cx="38" cy="27" rx="26" ry="15"/><rect class="dot" x="58" y="31" width="11" height="7" rx="2" transform="rotate(-50 63 34)"/>',
  eye: '<g class="ln thin"><rect x="4" y="12" width="30" height="30"/><path d="M14 12 V42 M24 12 V42 M4 22 H34 M4 32 H34"/></g><rect class="dot soft" x="14" y="22" width="10" height="10"/><path class="ln" d="M40 27 H46 M44 24 L47 27 L44 30"/><path class="ac" d="M52 27 Q62 16 72 27 Q62 38 52 27 Z"/><circle class="dot" cx="62" cy="27" r="3.5"/>',
  color: '<path class="ln" d="M38 6 C18 6 8 20 10 32 C12 42 22 46 30 42 C36 39 34 32 40 32 C50 32 52 44 60 40 C70 34 68 6 38 6 Z"/><circle class="dot" cx="24" cy="20" r="4"/><circle class="pen-blue" cx="38" cy="15" r="4"/><circle class="pen-red" cx="52" cy="20" r="4"/><circle class="ln" cx="24" cy="32" r="3.5"/>',
  word: '<text class="t-ink" x="6" y="34">가나</text><path class="ln" d="M52 27 H58 M56 24 L59 27 L56 30"/><text class="t-acc" x="61" y="34">다</text><path class="ac dot-line" d="M6 42 H74"/>',
  fair: '<path class="ln" d="M38 6 V46 M26 48 H50 M14 14 H62"/><path class="ln" d="M14 14 L6 30 H22 Z M62 14 L54 26 H70 Z"/><circle class="dot" cx="14" cy="27" r="3"/><circle class="pen-red" cx="62" cy="23" r="3"/>',
  cleaner: '<g class="ln thin"><rect x="8" y="4" width="60" height="46"/><path d="M23 4 V50 M38 4 V50 M53 4 V50 M8 19.3 H68 M8 34.6 H68"/></g><rect class="dot soft2" x="38" y="4" width="15" height="15.3"/><rect class="dot soft2" x="8" y="34.6" width="15" height="15.4"/><path class="ok-line" d="M15 12 H45 V27 H30 V42 H60"/><circle class="ln paper" cx="60" cy="42" r="5"/>',
  evolve: '<path class="ln thin" d="M4 46 H72"/><g opacity=".35"><path class="ln" d="M10 46 L16 36 L22 46 M16 36 L16 28"/><circle class="ln" cx="16" cy="25" r="3"/></g><g opacity=".6"><path class="ln" d="M30 46 L36 34 L42 46 M36 34 L38 26"/><circle class="ln" cx="38" cy="23" r="3.2"/></g><path class="ac" d="M52 46 L58 32 L66 46 M58 32 L62 22 M58 36 L68 32"/><circle class="ac" cx="63" cy="19" r="3.5"/>',
  flow: '<rect class="ln" x="24" y="2" width="28" height="11" rx="5.5"/><path class="ac" d="M38 18 L50 27 L38 36 L26 27 Z"/><rect class="ln" x="2" y="40" width="22" height="11" rx="2"/><rect class="ln" x="52" y="40" width="22" height="11" rx="2"/><path class="ln thin" d="M38 13 V18 M26 27 H13 V40 M50 27 H63 V40"/>',
  block: '<path class="ln soft-fill" d="M14 8 H28 V5 H36 V8 H60 V22 H36 V25 H28 V22 H14 Z"/><path class="ln" d="M22 26 H36 V23 H44 V26 H66 V40 H44 V43 H36 V40 H22 Z"/><path class="ac thin" d="M28 33 H54 M20 15 H46"/>',
  python: '<rect class="ln" x="6" y="4" width="64" height="46" rx="4"/><path class="ln thin" d="M6 13 H70"/><text class="t-code t-acc" x="12" y="28">if hand:</text><text class="t-code t-ink small" x="14" y="41">say("안녕")</text>',
};

window.AILAB_ICON = function (id) {
  const body = window.AILAB_ICONS[id] || '';
  return '<svg class="ill" viewBox="0 0 76 54" aria-hidden="true">' + body + '</svg>';
};
