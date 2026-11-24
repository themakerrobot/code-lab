// ═══════════════════════════════════════════════════════════
// 상단바 · 활동 이름 — 모든 화면이 이 파일 하나로 같은 상단바를 그린다
// ═══════════════════════════════════════════════════════════
// 쓰는 법 (각 화면):
//   <header data-tab="drive.html" data-menu="teach" data-act="drive"></header>
//   <script src="../shared/ui/menu.js"></script>
//   <script src="../shared/ui/nav.js"></script>      ← i18n.js · tour.js 보다 먼저
//
//  · data-tab   : 화면 고유 이름 (tour.js 가 어느 화면 안내를 띄울지 이걸로 고른다)
//  · data-menu  : 상단바에서 불이 켜질 메뉴 (try · teach · self · make · box)
//  · data-act   : menu.js 의 활동 id — 단계 표시줄 맨 앞에 활동 이름이 나온다
//  · 주소의 ?m= · ?a= 가 있으면 그게 이긴다 (같은 화면을 여러 메뉴에서 쓸 때)
//  · data-fs="own" : 전체화면 단추 동작을 화면이 직접 단다 (단추만 만들어 둔다)
//
// 상단바 오른쪽 차례: 상태 글(#engine) · 보관함 · [? 는 tour.js] · 전체화면 · [EN 은 i18n.js]
// 클래스 이름(navlink · hbtn · #engine · #fsBtn)은 디자인 킷과 각 화면 코드가 쓰니 바꾸지 말 것.

(function () {
  const me = document.currentScript;
  const ROOT = new URL('../../', me.src).href;          // 사이트 맨 위 (index.html 이 있는 곳)
  const MENU = window.AILAB_MENU || [];
  const BOX = window.AILAB_BOX || { href: 'ai/storage.html', ko: '보관함', en: 'My box' };

  let lang = 'ko';
  try {
    const s = localStorage.getItem('language');
    if (s === 'ko' || s === 'en') lang = s;
    else lang = /^ko/i.test(navigator.language || 'ko') ? 'ko' : 'en';
  } catch (e) {}
  const T = o => (o && (o[lang] || o.ko)) || '';

  const header = document.querySelector('header');
  if (!header) return;
  const q = new URLSearchParams(location.search);
  const menuId = q.get('m') || header.dataset.menu || '';
  const actId = q.get('a') || header.dataset.act || '';

  let menu = null, act = null;
  MENU.forEach(m => {
    if (m.id === menuId) menu = m;
    m.acts.forEach(a => { if (a.id === actId && (!act || m.id === menuId)) { act = a; if (!menu) menu = m; } });
  });
  if (menuId) document.body.dataset.menu = menuId;
  else if (menu) document.body.dataset.menu = menu.id;

  // ── 상단바 ──
  header.textContent = '';
  const h1 = document.createElement('h1');
  const home = document.createElement('a');
  home.href = ROOT + 'index.html';
  home.className = 'brand';
  home.title = lang === 'en' ? 'Home' : '처음 화면';
  home.innerHTML = '<img src="' + ROOT + 'shared/assets/img/pibo-logo.png" alt=""><span class="brand-txt">AI Lab</span>';
  h1.appendChild(home);
  header.appendChild(h1);

  MENU.forEach(m => {
    const on = document.body.dataset.menu === m.id;
    const el = document.createElement(on && !act ? 'span' : 'a');
    el.className = 'navlink c-' + m.color + (on ? ' on' : '');
    if (el.tagName === 'A') el.href = ROOT + m.id + '/index.html';
    el.textContent = T(m);
    header.appendChild(el);
  });

  const sp = document.createElement('span');
  sp.className = 'hsp';
  header.appendChild(sp);

  const engine = document.createElement('span');
  engine.id = 'engine';
  header.appendChild(engine);

  const box = document.createElement('a');
  box.className = 'hbtn hbox' + (menuId === 'box' ? ' on' : '');
  box.href = ROOT + BOX.href;
  box.innerHTML = '<i class="fa-solid fa-box-archive"></i><span>' + T(BOX) + '</span>';
  header.appendChild(box);

  const guide = document.createElement('a');
  guide.className = 'hbtn hbox' + (menuId === 'guide' ? ' on' : '');
  guide.href = ROOT + 'guide/index.html';
  guide.title = lang === 'en' ? 'How to use' : '사용 가이드';
  guide.innerHTML = '<i class="fa-solid fa-book-open"></i><span>' + (lang === 'en' ? 'Guide' : '가이드') + '</span>';
  header.appendChild(guide);

  // ── 전체화면 (지원하는 브라우저에서만) ──
  // 화면을 옮기면 브라우저가 전체화면을 풀기 때문에, 켜 둔 상태를 기억했다가 다음 화면의 첫 터치에서 되살린다.
  if (document.documentElement.requestFullscreen) {
    const fs = document.createElement('button');
    fs.className = 'hbtn';
    fs.id = 'fsBtn';
    fs.type = 'button';
    fs.title = lang === 'en' ? 'Full screen' : '전체화면';
    fs.innerHTML = '<i class="fa-solid fa-expand"></i>';
    header.appendChild(fs);
    if (header.dataset.fs !== 'own') {
      const KEY = 'ailab-fs';
      const remember = v => { try { v ? sessionStorage.setItem(KEY, '1') : sessionStorage.removeItem(KEY); } catch (e) {} };
      const wanted = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
      fs.addEventListener('click', () => {
        if (document.fullscreenElement) { remember(false); document.exitFullscreen(); }
        else document.documentElement.requestFullscreen().catch(() => {});
      });
      document.addEventListener('fullscreenchange', () => {
        const on = !!document.fullscreenElement;
        remember(on);
        fs.innerHTML = on ? '<i class="fa-solid fa-compress"></i>' : '<i class="fa-solid fa-expand"></i>';
      });
      // 터치 기기는 pointerdown 에 사용자 활성화가 없어 거부된다 — touchend · click 에 건다
      if (wanted()) {
        const revive = () => {
          document.removeEventListener('click', revive, true);
          document.removeEventListener('touchend', revive, true);
          if (!document.fullscreenElement && wanted()) document.documentElement.requestFullscreen().catch(() => {});
        };
        document.addEventListener('click', revive, true);
        document.addEventListener('touchend', revive, true);
      }
    }
  }

  // ── 활동 이름 (단계 표시줄 맨 앞) · 한 활동 안의 화면 전환 ──
  if (act) {
    document.title = T(act) + ' — AI Lab';
    let slot = document.querySelector('#steps, .steps, [data-act-slot]');
    if (!slot) {                     // 단계 표시줄이 없는 화면은 이름 줄을 하나 만든다
      slot = document.createElement('div');
      slot.className = 'steps actbar';
      header.insertAdjacentElement('afterend', slot);
    }
    {
      const wrap = document.createElement('span');
      wrap.className = 'actname';
      const nm = document.createElement('a');
      nm.href = ROOT + document.body.dataset.menu + '/index.html';
      nm.title = lang === 'en' ? 'Back to the list' : '목록으로';
      nm.textContent = T(act);
      wrap.appendChild(nm);
      if (act.pages) {
        const seg = document.createElement('span');
        seg.className = 'actpages';
        const here = location.pathname.replace(/\/$/, '/index.html');
        act.pages.forEach(p => {
          const on = here.endsWith('/' + p.href);
          const a = document.createElement(on ? 'span' : 'a');
          if (!on) a.href = ROOT + p.href;
          a.className = on ? 'on' : '';
          a.textContent = T(p);
          seg.appendChild(a);
        });
        wrap.appendChild(seg);
      }
      slot.insertBefore(wrap, slot.firstChild);
    }
  }

  window.AILAB = { root: ROOT, lang, menu, act, T, href: p => ROOT + p };
})();
