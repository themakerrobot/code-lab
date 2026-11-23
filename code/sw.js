// ═══════════════════════════════════════════════════════════
// 서비스 워커 — 오프라인 캐시 + input() · 센서 다리
// ═══════════════════════════════════════════════════════════
// 1) 오프라인: 한 번 열면 페이지 · 파이썬 · 블록 파일을 이 브라우저에 담아 두고,
//    인터넷이 끊겨도 다시 열린다. numpy 같은 추가 패키지는 처음 쓸 때 담는다.
//    새 버전을 올리면 VERSION 을 바꾼다 — 옛 캐시는 지워진다.
// 2) input(): 파이썬 워커가 '__codelab__/input?id=…' 로 동기 요청을 보내면
//    화면에 물어보고, 화면이 답을 주면 그 글자로 응답한다.
// 3) 센서: 화면이 최신 센서 값을 계속 올려 두고(sensor-state), 파이썬 워커가
//    '__codelab__/sensor' 로 물으면 그 값을 바로 준다.
// 카메라 AI 모델·wasm(models/ · vendor/tasks-vision/)은 처음 쓸 때 받아 담는다 (약 29MB).

const VERSION = 'ailab-code-3';
const RUNTIME = 'codelab-runtime';
const INPUT_WAIT_MS = 4 * 60 * 1000;   // 그 뒤엔 204 → 워커가 같은 id 로 다시 묻는다

const PRECACHE = [
  './',
  'index.html',
  '../shared/css/themaker-ui.css', 'css/app.css', '../shared/css/all.min.css',
  '../shared/assets/fonts/pretendard.css',
  '../shared/assets/img/favicon.png', '../shared/assets/img/pibo-logo.png',
  '../manifest.webmanifest',
  '../shared/webfonts/fa-solid-900.woff2', '../shared/webfonts/fa-brands-400.woff2',
  'vendor/codemirror/codemirror.css', 'vendor/codemirror/cobalt.css',
  'vendor/codemirror/codemirror.min.js', 'vendor/codemirror/python.js',
  'vendor/blockly/blockly_compressed.js', 'vendor/blockly/blocks_compressed.js',
  'vendor/blockly/python_compressed.js', 'vendor/blockly/ko.js',
  'vendor/blockly/media/sprites.png', 'vendor/blockly/media/handdelete.cur',
  'vendor/pyodide/pyodide.mjs', 'vendor/pyodide/pyodide.asm.mjs',
  'vendor/pyodide/pyodide.asm.wasm', 'vendor/pyodide/python_stdlib.zip',
  'vendor/pyodide/pyodide-lock.json',
  'blocks/customblock.js', 'blocks/customblock_callback.js',
  'blocks/customblock_toolbox.js', 'blocks/disable-top-blocks.js',
  'blocks/svg/bed-solid.svg', 'blocks/svg/clock-solid.svg', 'blocks/svg/database-solid.svg',
  'blocks/svg/flag-solid.svg', 'blocks/svg/list-check-solid.svg', 'blocks/svg/right-left-solid.svg',
  'blocks/svg/square-check-solid.svg', 'blocks/svg/stopwatch-solid.svg',
  'lib/app.js', 'lib/examples.js', 'lib/py-runner.js', 'lib/py-worker.js',
  'lib/turtle.py', 'lib/turtle-canvas.js', 'lib/sensor.py',
  'lib/my-ai.js', 'lib/sensors.js', '../ai/lib/jszip.min.js',
  '../ai/lib/landmarker.js', '../ai/lib/theme.js', '../ai/lib/features.js', '../ai/lib/signals.js',
  '../ai/lib/embedder.js', '../ai/lib/sound.js', '../ai/lib/sources.js', '../ai/lib/classifier.js', '../ai/lib/project.js',
  '../shared/ui/menu.js', '../shared/ui/nav.js', '../shared/ui/lab.css', '../shared/ui/box.js',
  'blocks/svg/hand-solid.svg', 'blocks/svg/face-smile-solid.svg', 'blocks/svg/person-solid.svg',
  'blocks/svg/microphone-solid.svg', 'blocks/svg/brain-solid.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION && k !== RUNTIME) await caches.delete(k);
    await self.clients.claim();
  })());
});

// ── input() 다리 ──
const pending = new Map();    // id → resolve
const answered = new Map();   // 화면이 답했는데 받을 요청이 끊겨 있던 것

let sensorJson = '{}';

self.addEventListener('message', (e) => {
  const m = e.data || {};
  if (m.type === 'sensor-state') {
    sensorJson = m.json || '{}';
  } else if (m.type === 'input-response') {
    const r = pending.get(m.id);
    if (r) { pending.delete(m.id); r(m.value); } else answered.set(m.id, m.value);
  } else if (m.type === 'input-cancel') {
    const r = pending.get(m.id);
    if (r) { pending.delete(m.id); r(null); }
    answered.delete(m.id);
  }
});

function inputResponse(url) {
  const id = url.searchParams.get('id') || '';
  if (answered.has(id)) {
    const v = answered.get(id);
    answered.delete(id);
    return Promise.resolve(new Response(v, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve(new Response(null, { status: 204 }));
    }, INPUT_WAIT_MS);
    pending.set(id, (value) => {
      clearTimeout(timer);
      if (value === null) resolve(new Response(null, { status: 410 }));
      else resolve(new Response(value, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
    });
  });
}

// ── 캐시 ──
async function cacheFirst(req, cacheName) {
  const hit = await caches.match(req, { ignoreSearch: false });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(cacheName)).put(req, res.clone());
  return res;
}

// 우리 파일: 캐시를 먼저 보여 주고 뒤에서 새로 받아 둔다 (다음에 열 때 새 버전)
async function staleWhileRevalidate(e) {
  const req = e.request;
  const cached = await caches.match(req);
  const update = fetch(req).then(async (res) => {
    if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
    return res;
  }).catch(() => null);
  if (cached) { e.waitUntil(update); return cached; }
  return (await update) || new Response('오프라인이에요', { status: 503 });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin && url.pathname.endsWith('/__codelab__/input')) {
    e.respondWith(inputResponse(url));
    return;
  }
  if (url.origin === self.location.origin && url.pathname.endsWith('/__codelab__/sensor')) {
    e.respondWith(new Response(sensorJson, {
      status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    }));
    return;
  }
  if (url.origin === self.location.origin) {
    // 큰 파일(파이썬 · 카메라 AI · 글꼴)은 한 번 받으면 다시 받지 않는다.
    // 이 파일들을 바꿀 때는 파일 이름을 바꾼다 (VERSION 을 올려도 RUNTIME 캐시는 남는다)
    if (/\/(vendor\/(pyodide|tasks-vision|tasks-audio|tfjs)|models)\//.test(url.pathname) || url.pathname.endsWith('.otf')) {
      e.respondWith(cacheFirst(req, RUNTIME));
    }
    else e.respondWith(staleWhileRevalidate(e));
    return;
  }
  if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/pyodide/')) {
    e.respondWith(cacheFirst(req, RUNTIME));
  }
});
