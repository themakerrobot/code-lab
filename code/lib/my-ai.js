// ═══════════════════════════════════════════════════════════
// 내 AI — 가르치기에서 만든 AI 를 블록 · 파이썬에서 바로 쓴다
// ═══════════════════════════════════════════════════════════
// 같은 사이트라 보관함(IndexedDB 'ai-lab')을 그대로 읽는다 — 파일을 내려받았다 올릴 필요가 없다.
// 저장 형식 · 계산은 가르치기와 같은 코드(ai/lib/project.js · classifier.js)를 쓴다.
//
//   MyAI.ready                 → Promise (처음 목록 읽기)
//   MyAI.refresh()             → Promise<목록>   보관함을 다시 읽는다
//   MyAI.list()                → [{ name, source, classes }]
//   MyAI.get(name)             → 목록 한 줄 | null
//   MyAI.load(name)            → Promise<{ source, variant, classes, clf, transform }>
//   MyAI.predict(m, vec)       → { label, conf }   (확신이 모자라면 label = null)
//   MyAI.importFile(file)      → Promise<이름>     .ailab.zip 을 보관함에 넣는다

window.MyAI = (function () {
  const base = new URL('../../ai/lib/', document.currentScript.src).href;
  const mods = Promise.all([
    import(base + 'project.js'),
    import(base + 'classifier.js'),
    import(base + 'sources.js'),
  ]);
  const THRESHOLD = 0.6;       // 가르치기 · 시험의 기본 "확신 정도" 와 같다
  let rows = [];
  const loaded = new Map();    // 이름 → 계산 준비가 된 모델

  async function refresh() {
    const [P] = await mods;
    let all = [];
    try { all = await P.Store.list(); } catch (e) { console.error(e); }
    rows = all.map(r => ({ name: r.name, source: r.source || 'image', variant: r.variant || null, classes: (r.classes || []).slice() }));
    loaded.clear();
    return rows;
  }

  async function load(name) {
    if (loaded.has(name)) return loaded.get(name);
    const [P, C, S] = await mods;
    const rec = await P.Store.get(name);
    if (!rec) throw new Error(`'${name}' AI 가 보관함에 없어요. 가르치기에서 먼저 만들어 주세요`);
    const m = {
      name,
      source: rec.source || 'image',
      variant: rec.variant || null,
      classes: rec.classes.slice(),
      clf: C.deserialize(rec.classifier.json, rec.classifier.bin),
      transform: S.soundTransformOf(rec.embedder),
      predictRaw: C.predict,
    };
    loaded.set(name, m);
    return m;
  }

  function predict(m, vec) {
    if (!m || !vec) return { label: null, conf: 0 };
    const probs = m.predictRaw(m.clf, vec);
    let top = 0;
    for (let i = 1; i < probs.length; i++) if (probs[i] > probs[top]) top = i;
    const conf = Math.round(probs[top] * 1000) / 1000;
    return { label: conf >= THRESHOLD ? m.classes[top] : null, conf };
  }

  async function importFile(file) {
    const [P] = await mods;
    if (typeof JSZip === 'undefined') throw new Error('파일을 열 준비가 안 됐어요. 새로고침해 주세요');
    const rec = await P.importZip(file);
    await refresh();
    return rec.name;
  }

  const ready = refresh();
  // 다른 탭(가르치기)에서 새로 저장하면 이 탭으로 돌아올 때 다시 읽는다
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

  return { ready, refresh, list: () => rows.map(r => ({ name: r.name, source: r.source, classes: r.classes })),
           get: name => rows.find(r => r.name === name) || null, load, predict, importFile };
})();
