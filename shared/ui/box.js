// ═══════════════════════════════════════════════════════════
// 보관함 (공용) — 운전 AI · 코딩 작품을 이 브라우저에 모아 둔다
// ═══════════════════════════════════════════════════════════
// 가르친 AI(사진 · 손 · 얼굴 · 몸 · 소리)는 ai/lib/project.js 의 Store('ai-lab') 에 있고,
// 그 밖에 만든 것은 여기('ai-lab-box')에 둔다. 보관함 화면(ai/storage.html)이 둘 다 보여 준다.
//
//   Box.put({ kind, name, data })  → Promise<item>   kind: 'drive' | 'code'
//   Box.list(kind?)                 → Promise<item[]> 새것 먼저
//   Box.get(id) · Box.del(id) · Box.rename(id, name)
// item = { id, kind, name, data, createdAt }

const DB = 'ai-lab-box', STORE = 'items', VER = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const rq = indexedDB.open(DB, VER);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
  return dbp;
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out && 'result' in out ? out.result : out);
    t.onerror = () => rej(t.error);
  });
}

export const Box = {
  async put({ kind, name, data }) {
    const item = {
      id: kind + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      kind, name: String(name || '').trim().slice(0, 40) || '이름 없음', data, createdAt: new Date().toISOString(),
    };
    await tx('readwrite', s => s.put(item));
    return item;
  },
  async list(kind) {
    const all = (await tx('readonly', s => s.getAll())) || [];
    return all.filter(i => !kind || i.kind === kind).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  },
  get(id) { return tx('readonly', s => s.get(id)); },
  del(id) { return tx('readwrite', s => s.delete(id)); },
  async rename(id, name) {
    const it = await this.get(id);
    if (!it) return null;
    it.name = String(name || '').trim().slice(0, 40) || it.name;
    await tx('readwrite', s => s.put(it));
    return it;
  },
};
