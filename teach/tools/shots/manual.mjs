// 설명서 캡처 (docs/manual) — 사용법은 tools/shots/README.md
//   0-tour · 1-teach · 2-sources · 3-test · 4-storage · 5-play · 6-picker
// 번호 배지는 callouts.py 가 boxes.json 을 보고 그려 docs/manual 에 넣는다.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);   // tools/shots
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const SCENE = path.join(HERE, 'scene');
const OUT = path.join(HERE, 'out-manual'); fs.mkdirSync(OUT, { recursive: true });
const files = k => fs.readdirSync(SCENE).filter(f => f.startsWith(k) && f.endsWith('.png')).sort().map(f => path.join(SCENE, f));
const N = files('apple').length;

const browser = await chromium.launch({
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    '--use-file-for-fake-video-capture=' + path.join(SCENE, 'camera.y4m'),
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const ctx = await browser.newContext({
  permissions: ['camera', 'microphone'], locale: 'ko-KR', viewport: { width: 1440, height: 900 },
});
// 목소리: 기기 안 한국어 목소리가 있는 것처럼 (헤드리스에는 목소리가 없다)
await ctx.addInitScript(() => {
  const voice = { name: 'Heami', lang: 'ko-KR', localService: true, default: true };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => [voice], speak() {}, cancel() {}, addEventListener() {} } });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
});
const page = await ctx.newPage();
page.on('dialog', d => d.accept());
// 설명서 그림용 화장: 가짜 카메라 장치 이름이 파일 경로로 나와 보기 나쁘다
const prettyCam = () => page.evaluate(() => {
  const sel = document.getElementById('camSel');
  if (sel) [...sel.options].forEach(o => { o.textContent = '웹캠'; o.title = '웹캠'; });
});
const boxes = {};
async function mark(file, items) {
  boxes[file] = [];
  for (const [sel, label] of items) {
    const el = await page.$(sel);
    if (!el) { console.log('  (없음)', sel); continue; }
    const b = await el.boundingBox();
    if (b) boxes[file].push({ label, ...b });
  }
}
const ready = () => page.waitForFunction(() => document.getElementById('engine')?.textContent === '준비 완료', null, { timeout: 180000 });
const skipTour = async () => {
  await page.waitForSelector('.tour-bubble', { timeout: 20000 }).catch(() => {});
  if (await page.$('.tour-skip')) { await page.click('.tour-skip'); await page.waitForTimeout(300); }
};

// 1) 튜토리얼 화면 먼저 (첫 방문 상태 그대로)
await page.goto(BASE + '/index.html');
await ready();
await page.waitForSelector('.tour-bubble', { timeout: 20000 });
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(OUT, '0-tour.png') });
await page.click('.tour-skip');
await page.waitForTimeout(300);

// 2) 학습실 — 종류 2개, 예시 채우고, 카메라 켜고, 학습까지
for (const [i, [name, kind]] of [['사과', 'apple'], ['바나나', 'banana']].entries()) {
  await page.fill('#clsName', name);
  await page.click('#clsAdd');
  await page.waitForTimeout(100);
  await page.setInputFiles('#fileInput', files(kind));
  await page.waitForFunction(([i, n]) => document.querySelectorAll('#clsList .cls')[i]?.querySelector('.ct')?.textContent.startsWith(String(n)),
    [i, N], { timeout: 180000 });
}
await page.click('#camBtn');
await page.waitForFunction(() => document.getElementById('seeState')?.textContent === '보고 있어요', null, { timeout: 60000 });
await page.click('#trainBtn');
await page.waitForSelector('#resultSec', { state: 'visible', timeout: 180000 });
await page.fill('#mdlName', '과일 맞히기');
await page.waitForTimeout(2600);
await prettyCam();
await mark('1-teach.png', [
  ['#srcPick', '1'], ['#clsName', '2'], ['#camBtn', '3'], ['#capBtn', '4'],
  ['#seeWrap', '5'], ['#trainBtn', '6'], ['#resultSec', '7'], ['#mdlName', '8'],
]);
await page.screenshot({ path: path.join(OUT, '1-teach.png') });
await page.click('#mdlSave');
await page.waitForTimeout(1200);

// 3) 소스 고르기 (다섯 가지)
await page.evaluate(() => { document.getElementById('clsName').value = ''; });
await page.screenshot({ path: path.join(OUT, '2-sources.png'), clip: { x: 8, y: 105, width: 300, height: 330 } });

// 4) 시험실
await page.goto(BASE + '/test.html?use=' + encodeURIComponent('과일 맞히기'));
await ready();
await skipTour();
await page.click('#camBtn');
await page.waitForFunction(() => document.getElementById('seeState')?.textContent === '보고 있어요', null, { timeout: 60000 });
await prettyCam();
await page.waitForTimeout(1200);
await mark('3-test.png', [
  ['#mdlList', '1'], ['#camBtn', '2'], ['#answer', '3'], ['.thr', '4'],
]);
await page.screenshot({ path: path.join(OUT, '3-test.png') });

// 5) 보관함
await page.goto(BASE + '/storage.html');
await page.waitForSelector('#stTable tr[data-name]');
await skipTour();
await page.waitForTimeout(500);
await mark('4-storage.png', [
  ['#stTable tr[data-name] td.nm', '1'],
  ['#stTable tr[data-name] .acts', '2'],
  ['#dropzone', '3'],
]);
await page.screenshot({ path: path.join(OUT, '4-storage.png') });

// 6) 놀이실 — 볼 것 켜기 · 지금 보는 것 · 규칙 · 목소리 · 배경 놀이
await page.goto(BASE + '/play.html');
await skipTour();
await page.click('[data-src="image"] .sc-top');
await page.waitForFunction(() => document.getElementById('camOff').style.display === 'none', null, { timeout: 30000 });
await ready();
await page.click('#ruleAdd');
await page.waitForSelector('#picker:not([hidden])');
await page.waitForTimeout(600);
await mark('6-picker.png', [['#picker .pk-box', '']]);
boxes['6-picker.png'] = [];
await page.screenshot({ path: path.join(OUT, '6-picker.png') });
await page.click('#pkBody .chip:text-is("사과")');
await page.fill('#ruleList .rule:nth-child(1) .say', '사과다! 맛있겠다');
await page.click('#ruleAdd');
await page.click('#pkBody .chip:text-is("손바닥 쫙")');
await page.fill('#ruleList .rule:nth-child(2) .say', '안녕!');
await page.waitForFunction(() => document.querySelector('#ruleList .rule.fired'), null, { timeout: 30000 });
await page.waitForTimeout(800);
await prettyCam();
await mark('5-play.png', [
  ['#srcCards', '1'], ['#camBtn', '2'], ['#nowRow', '3'], ['#bgPick', '4'],
  ['#modeTabs', '5'], ['#answer', '6'], ['#voiceBtn', '7'], ['#ruleList', '8'],
]);
await page.screenshot({ path: path.join(OUT, '5-play.png') });

// 7) 순서 놀이
await page.click('#modeTabs [data-mode="seq"]');
await page.click('#seqAdd'); await page.click('#pkBody .chip:text-is("사과")');
await page.click('#seqAdd'); await page.click('#pkBody .chip:text-is("주먹")');
await page.click('#seqAdd'); await page.click('#pkBody .chip:text-is("손바닥 쫙")');
await page.waitForTimeout(2600);
await mark('7-seq.png', [['#seqFlow', '1'], ['#seqAdd', '2'], ['#seqReset', '3']]);
await page.screenshot({ path: path.join(OUT, '7-seq.png'), clip: { x: 1100, y: 70, width: 340, height: 700 } });
boxes['7-seq.png'] = boxes['7-seq.png'].map(b => ({ ...b, x: b.x - 1100, y: b.y - 70 }));

fs.writeFileSync(path.join(OUT, 'boxes.json'), JSON.stringify(boxes, null, 1));
console.log('manual shots:', fs.readdirSync(OUT).join(', '));
await browser.close();
