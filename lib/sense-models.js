// ═══════════════════════════════════════════════════════════
// sense-lab 모델 — 내보낸 zip 을 불러와 이 브라우저에 두고, 직접 계산한다
// ═══════════════════════════════════════════════════════════
// sense-lab 보관함의 [내보내기] zip = model.json + weights.bin + meta.json
//   모델: 입력 D → Dense(32, relu) → Dropout → Dense(N, softmax)  (lib/trainer.js)
// 이 작은 모델은 tfjs 없이 곱셈 몇 번이면 된다 → 여기서 바로 계산한다.
// 압축은 브라우저 내장 DecompressionStream 으로 푼다 (라이브러리 없이).
//
//   SenseModels.importZip(file) → Promise<이름>
//   SenseModels.list()          → [{ name, source, classes }]
//   SenseModels.predict(name, vec) → { label, conf, probs } | null

(function () {
  'use strict';

  const KEY = 'codelab-models';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function save(all) {
    try { localStorage.setItem(KEY, JSON.stringify(all)); }
    catch (e) { throw new Error('모델을 저장할 자리가 모자라요'); }
  }

  // ── zip 읽기 (중앙 디렉터리만 보면 된다) ──
  async function unzip(buf) {
    const dv = new DataView(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('zip 파일이 아니에요');
    const n = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const files = {};
    const dec = new TextDecoder();
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('zip 이 깨졌어요');
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true);
      const extraLen = dv.getUint16(p + 30, true);
      const commentLen = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
      const lNameLen = dv.getUint16(local + 26, true);
      const lExtraLen = dv.getUint16(local + 28, true);
      const data = new Uint8Array(buf, local + 30 + lNameLen + lExtraLen, csize);
      files[name] = { method, data };
      p += 46 + nameLen + extraLen + commentLen;
    }
    return files;
  }

  async function inflate(entry) {
    if (entry.method === 0) return entry.data.slice().buffer;
    if (entry.method !== 8) throw new Error('지원하지 않는 압축이에요');
    const ds = new DecompressionStream('deflate-raw');
    const out = new Blob([entry.data]).stream().pipeThrough(ds);
    return new Response(out).arrayBuffer();
  }

  // model.json(topology + weightSpecs) + weights → 층 목록
  function buildLayers(mj, weights) {
    const specs = mj.weightSpecs || [];
    const f32 = {};
    let off = 0;
    for (const s of specs) {
      if (s.dtype && s.dtype !== 'float32') throw new Error('float32 모델만 쓸 수 있어요');
      const size = s.shape.reduce((a, b) => a * b, 1);
      f32[s.name] = { shape: s.shape, data: Array.from(new Float32Array(weights, off, size)) };
      off += size * 4;
    }
    const topo = mj.modelTopology || {};
    const cfg = (topo.model_config || topo).config || {};
    const layersCfg = cfg.layers || topo.config && topo.config.layers || [];
    const layers = [];
    for (const l of layersCfg) {
      if (l.class_name !== 'Dense') continue;    // Dropout 은 추론 때 아무 일도 안 한다
      const nm = l.config.name;
      const k = f32[`${nm}/kernel`];
      const b = f32[`${nm}/bias`];
      if (!k) throw new Error(`모델 가중치가 없어요 (${nm})`);
      layers.push({ in: k.shape[0], out: k.shape[1], w: k.data, b: b ? b.data : null, act: l.config.activation });
    }
    if (!layers.length) throw new Error('읽을 수 있는 층이 없어요');
    return layers;
  }

  function forward(layers, vec) {
    let x = Array.from(vec);
    for (const L of layers) {
      if (x.length !== L.in) return null;
      const y = new Array(L.out).fill(0);
      for (let j = 0; j < L.out; j++) {
        let s = L.b ? L.b[j] : 0;
        for (let i = 0; i < L.in; i++) s += x[i] * L.w[i * L.out + j];
        y[j] = s;
      }
      if (L.act === 'relu') for (let j = 0; j < y.length; j++) y[j] = Math.max(0, y[j]);
      else if (L.act === 'softmax') {
        const m = Math.max(...y);
        let sum = 0;
        for (let j = 0; j < y.length; j++) { y[j] = Math.exp(y[j] - m); sum += y[j]; }
        for (let j = 0; j < y.length; j++) y[j] /= sum;
      } else if (L.act === 'sigmoid') for (let j = 0; j < y.length; j++) y[j] = 1 / (1 + Math.exp(-y[j]));
      x = y;
    }
    return x;
  }

  const SenseModels = {
    async importZip(file) {
      const files = await unzip(await file.arrayBuffer());
      const need = ['model.json', 'weights.bin', 'meta.json'];
      for (const f of need) if (!files[f]) throw new Error('sense-lab 에서 내보낸 zip 이 아니에요');
      const txt = async (f) => new TextDecoder().decode(await inflate(files[f]));
      const mj = JSON.parse(await txt('model.json'));
      const meta = JSON.parse(await txt('meta.json'));
      const weights = await inflate(files['weights.bin']);
      const source = meta.source;
      if (!['hand', 'face', 'pose'].includes(source)) {
        throw new Error(source === 'sound' ? '소리 모델은 아직 쓸 수 없어요' : '알 수 없는 모델이에요');
      }
      const layers = buildLayers(mj, weights);
      const classes = meta.classes || [];
      if (layers[layers.length - 1].out !== classes.length) throw new Error('모델과 종류 수가 맞지 않아요');
      const name = String(meta.name || file.name.replace(/\.zip$/i, '') || 'model').trim().slice(0, 30);
      const all = load();
      all[name] = { name, source, variant: meta.variant || null, classes, layers, at: Date.now() };
      save(all);
      return name;
    },
    list() {
      return Object.values(load()).map(m => ({ name: m.name, source: m.source, variant: m.variant, classes: m.classes }));
    },
    get(name) { return load()[name] || null; },
    remove(name) { const all = load(); delete all[name]; save(all); },
    predict(name, vec, model) {
      const m = model || this.get(name);
      if (!m || !vec) return null;
      const p = forward(m.layers, vec);
      if (!p) return null;
      let best = 0;
      for (let i = 1; i < p.length; i++) if (p[i] > p[best]) best = i;
      return { label: m.classes[best], conf: p[best], probs: p };
    },
  };

  window.SenseModels = SenseModels;
})();
