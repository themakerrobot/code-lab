// ═══════════════════════════════════════════════════════════
// 보관함 — 브라우저 저장 + 프로젝트 파일(.teachlab.zip) 내보내기·불러오기
// ═══════════════════════════════════════════════════════════
//  · 저장소   : IndexedDB 'teach-lab' / 스토어 'projects' (keyPath: name)
//  · 원본 사진은 저장하지 않는다. 임베딩(숫자)과 작은 썸네일만 남는다.
//  · TF.js 에 기대지 않는다 — 가중치는 평범한 float32 덩어리다.
//
// 프로젝트 파일 구조 (.teachlab.zip)
//   manifest.json     { format:"teachlab", version, kind, app, createdAt }
//   project.json      이름·소스(이미지/손/얼굴/포즈/소리)·종류·정확도·특징 뽑는 법
//   classifier.json   분류기 구조
//   classifier.bin    분류기 가중치 (float32 little-endian)
//   samples.json      예시 임베딩 (base64) — 다른 컴퓨터에서 이어서 배우기용
//   thumbs/0/0.jpg …  예시 썸네일

import { bytesToB64, b64ToBytes } from './classifier.js';

export const PROJECT_FORMAT = 'teachlab';
export const PROJECT_VERSION = 2;
export const PROJECT_EXT = '.teachlab.zip';

const DB_NAME = 'teach-lab', STORE = 'projects', DB_VER = 1;

let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const rq = indexedDB.open(DB_NAME, DB_VER);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'name' });
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
  return dbp;
}

function tx(mode, fn) {
  return open().then(db => new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const rq = fn(t.objectStore(STORE));
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  }));
}

function clean(name) { return String(name || '').trim(); }

export const Store = {
  async save(rec) {
    const key = clean(rec.name);
    if (!key) throw new Error('no name');
    const out = Object.assign({}, rec, { name: key });
    if (!out.createdAt) out.createdAt = new Date().toISOString();
    await tx('readwrite', s => s.put(out));
    return out;
  },

  get(name) { return tx('readonly', s => s.get(clean(name))); },

  async list() {
    const a = await tx('readonly', s => s.getAll());
    return (a || []).sort((x, y) => (y.createdAt || '').localeCompare(x.createdAt || ''));
  },

  remove(name) { return tx('readwrite', s => s.delete(clean(name))); },

  async rename(oldName, newName) {
    const from = clean(oldName), to = clean(newName);
    if (!to || from === to) return false;
    if (await this.get(to)) throw new Error('exists');
    const rec = await this.get(from);
    if (!rec) throw new Error('missing');
    await this.save(Object.assign({}, rec, { name: to }));
    await this.remove(from);
    return true;
  },

  // 같은 이름이 있으면 뒤에 숫자를 붙여 피한다
  async freeName(base) {
    let name = clean(base) || 'project';
    let n = 2;
    while (await this.get(name)) name = (clean(base) || 'project') + '-' + (n++);
    return name;
  },
};

// ── 프로젝트 파일 만들기 ──
// rec 은 Store 에 저장한 것과 같은 모양이다.
export function buildZip(rec) {
  const zip = new JSZip();
  const dim = rec.embedder.dim;

  zip.file('manifest.json', JSON.stringify({
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    kind: rec.source || rec.kind || 'image',
    app: 'teach-lab',
    createdAt: rec.createdAt || new Date().toISOString(),
  }, null, 2));

  zip.file('project.json', JSON.stringify({
    name: rec.name,
    kind: rec.source || rec.kind || 'image',
    source: rec.source || 'image',
    variant: rec.variant || null,
    classes: rec.classes,
    sampleCounts: rec.sampleCounts,
    accuracy: rec.accuracy,
    embedder: rec.embedder,
    trainedAt: rec.createdAt,
  }, null, 2));

  zip.file('classifier.json', JSON.stringify(rec.classifier.json, null, 2));
  zip.file('classifier.bin', rec.classifier.bin);

  const ex = rec.examples || [];
  zip.file('samples.json', JSON.stringify({
    dim,
    classes: ex.map(e => ({
      name: e.name,
      count: e.count,
      vecs: bytesToB64(new Uint8Array(e.vecs)),
    })),
  }));

  ex.forEach((e, ci) => {
    (e.thumbs || []).forEach((src, i) => {
      const comma = src.indexOf(',');
      if (comma < 0) return;
      zip.file('thumbs/' + ci + '/' + i + '.jpg', src.slice(comma + 1), { base64: true });
    });
  });

  return zip;
}

export async function exportZip(rec) {
  const blob = await buildZip(rec).generateAsync({ type: 'blob' });
  download(blob, rec.name + PROJECT_EXT);
}

// ── 프로젝트 파일 읽기 ──
export async function readZip(file) {
  const zip = await JSZip.loadAsync(file);
  const readJson = async path => {
    const f = zip.file(path);
    if (!f) throw new Error('missing ' + path);
    return JSON.parse(await f.async('string'));
  };

  const manifest = await readJson('manifest.json');
  if (manifest.format !== PROJECT_FORMAT) throw new Error('not a teachlab project');
  if ((manifest.version | 0) > PROJECT_VERSION) throw new Error('made by a newer version');

  const project = await readJson('project.json');
  const cjson = await readJson('classifier.json');
  const cbin = await zip.file('classifier.bin').async('arraybuffer');

  const examples = [];
  const sf = zip.file('samples.json');
  if (sf) {
    const samples = JSON.parse(await sf.async('string'));
    const dim = samples.dim || project.embedder.dim;
    for (let ci = 0; ci < samples.classes.length; ci++) {
      const c = samples.classes[ci];
      const bytes = b64ToBytes(c.vecs);
      const thumbs = [];
      for (let i = 0; i < c.count; i++) {
        const tf2 = zip.file('thumbs/' + ci + '/' + i + '.jpg');
        if (!tf2) break;
        thumbs.push('data:image/jpeg;base64,' + await tf2.async('base64'));
      }
      examples.push({ name: c.name, count: c.count, vecs: bytes.buffer, thumbs, dim });
    }
  }

  // version 1 은 이미지 전용이었다 — source 가 없으면 이미지로 본다
  const source = project.source || (project.kind && project.kind !== 'image' ? project.kind : 'image');

  return {
    name: project.name,
    kind: source,
    source,
    variant: project.variant || null,
    classes: project.classes,
    sampleCounts: project.sampleCounts,
    accuracy: project.accuracy,
    embedder: project.embedder,
    classifier: { json: cjson, bin: cbin },
    examples,
    createdAt: project.trainedAt || manifest.createdAt,
  };
}

export async function importZip(file) {
  const rec = await readZip(file);
  rec.name = await Store.freeName(rec.name || file.name.replace(/\.teachlab\.zip$/i, '').replace(/\.zip$/i, ''));
  return Store.save(rec);
}

// ── 예시 묶음 도우미 ──
// 화면에서 쓰는 Float32Array 목록 ↔ 저장용 ArrayBuffer
export function examplesToRecord(classes, dim) {
  return classes.map(c => {
    const buf = new Float32Array(c.vecs.length * dim);
    c.vecs.forEach((v, i) => buf.set(v, i * dim));
    return { name: c.name, count: c.vecs.length, vecs: buf.buffer, thumbs: c.thumbs.slice(), dim };
  });
}

export function examplesFromRecord(examples, dim) {
  return (examples || []).map(e => {
    const d = e.dim || dim;
    const all = new Float32Array(e.vecs);
    const vecs = [];
    const n = e.count != null ? e.count : Math.floor(all.length / d);
    for (let i = 0; i < n; i++) vecs.push(Float32Array.from(all.subarray(i * d, (i + 1) * d)));
    return { name: e.name, vecs, thumbs: (e.thumbs || []).slice() };
  });
}

export function download(blob, filename) {
  const el = document.createElement('a');
  el.href = URL.createObjectURL(blob);
  el.download = filename;
  document.body.appendChild(el);
  el.click();
  el.remove();
  setTimeout(() => URL.revokeObjectURL(el.href), 1000);
}
