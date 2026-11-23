// 화면들이 부르는 파일이 실제로 있는지 본다 (경로를 옮긴 뒤 깨진 링크 찾기)
//   · 모든 .html 의 href= · src= (바깥 주소 · # · data: 는 뺀다)
//   · shared/ui/menu.js 의 활동 주소
//   · JS 의 정적 import (from '...')
// 실행: node tools/check-links.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const skipDir = new Set(['.git', 'node_modules', 'docs', 'vendor']);
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!skipDir.has(e.name)) walk(path.join(d, e.name)); }
    else files.push(path.join(d, e.name));
  }
})(ROOT);

const miss = [];
const check = (from, ref) => {
  if (!ref || /^(https?:|mailto:|data:|blob:|#|javascript:)/.test(ref) || ref.includes('${') || ref.includes("'+")) return;
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean) return;
  const target = path.resolve(path.dirname(from), clean);
  if (!fs.existsSync(target)) miss.push(path.relative(ROOT, from) + ' → ' + ref);
};

for (const f of files) {
  if (f.endsWith('.html')) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/\s(?:href|src)="([^"]+)"/g)) check(f, m[1]);
  }
  if (/\.(js|mjs)$/.test(f) && !f.includes('.min.')) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/^\s*import[^'"]*from\s+['"](\.[^'"]+)['"]/gm)) check(f, m[1]);
    for (const m of s.matchAll(/import\(\s*['"](\.[^'"]+)['"]\s*\)/g)) check(f, m[1]);
  }
}

// 메뉴의 활동 주소 (사이트 맨 위 기준)
const menuSrc = fs.readFileSync(path.join(ROOT, 'shared/ui/menu.js'), 'utf8');
for (const m of menuSrc.matchAll(/href:\s*'([^']+)'/g)) check(path.join(ROOT, 'index.html'), m[1]);
for (const id of ['try', 'teach', 'self', 'make']) check(path.join(ROOT, 'index.html'), id + '/index.html');

if (miss.length) {
  console.error('없는 파일 ' + miss.length + '개:\n  ' + miss.join('\n  '));
  process.exit(1);
}
console.log('링크 모두 있어요 (' + files.filter(f => f.endsWith('.html')).length + '개 화면)');
