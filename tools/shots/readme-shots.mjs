// README 용 깨끗한 화면 캡처 (번호 없음, 튜토리얼 없음) → docs/img/
//   teach.png · sound.png · test.png · play.png · storage.png
// 먼저 make-scene.mjs 로 tools/shots/scene/ 을 만든다.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);   // tools/shots
const ROOT = path.resolve(HERE, '..', '..');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const SCENE = path.join(HERE, 'scene');
const OUT = path.join(ROOT, 'docs', 'img'); fs.mkdirSync(OUT, { recursive: true });
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
  deviceScaleFactor: 1,
});
// 튜토리얼은 본 것으로, 마이크에는 합성음(220Hz 사인파), 목소리는 기기 안 목소리가 있는 것처럼
await ctx.addInitScript(() => {
  ['index.html', 'test.html', 'play.html', 'storage.html'].forEach(p => {
    try { localStorage.setItem('tl-tour-' + p, '1'); } catch (e) {}
  });
  const voice = { name: 'Heami', lang: 'ko-KR', localService: true, default: true };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => [voice], speak() {}, cancel() {}, addEventListener() {} } });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  AudioContext.prototype.createMediaStreamSource = function () {
    const ac = this;
    try { ac.resume(); } catch (e) {}
    const out = ac.createGain(); out.gain.value = 1;
    const osc = ac.createOscillator(); osc.type = 'sine'; osc.frequency.value = 220; osc.start();
    const lfo = ac.createOscillator(); lfo.frequency.value = 2.5;
    const depth = ac.createGain(); depth.gain.value = 0.5;
    lfo.connect(depth); depth.connect(out.gain); lfo.start();   // 파형이 출렁이게
    osc.connect(out);
    return out;
  };
});
const page = await ctx.newPage();
page.on('dialog', d => d.accept());   // 소스 바꿀 때 '예시가 지워져요' 확인
const pretty = label => page.evaluate(l => {
  const sel = document.getElementById('camSel');
  if (sel) [...sel.options].forEach(o => { o.textContent = l; o.title = l; });
}, label);
const ready = () => page.waitForFunction(() => document.getElementById('engine')?.textContent === '준비 완료', null, { timeout: 180000 });
const shot = (name, opts = {}) => page.screenshot({ path: path.join(OUT, name), ...opts });

// 1) 학습실 — 사과/바나나 가르치고 학습까지
await page.goto(BASE + '/index.html');
await ready();
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
await page.waitForTimeout(2600);            // '잘 배웠어요' 토스트가 사라질 때까지
await pretty('웹캠');
await shot('teach.png');
await page.click('#mdlSave');
await page.waitForTimeout(1200);

// 2) 소리 모드 — 마이크 켜고 듣는 중
await page.click('#srcPick [data-src="sound"]');
await ready();
await page.click('#camBtn');
await page.waitForFunction(() => document.getElementById('seeState')?.textContent === '들려요', null, { timeout: 60000 });
await page.fill('#clsName', '');
await page.waitForTimeout(9000);            // 파형이 화면을 채울 때까지
await pretty('마이크');
await shot('sound.png', { clip: { x: 294, y: 118, width: 803, height: 764 } });

// 3) 시험실
await page.goto(BASE + '/test.html?use=' + encodeURIComponent('과일 맞히기'));
await ready();
await page.click('#camBtn');
await page.waitForFunction(() => document.getElementById('seeState')?.textContent === '보고 있어요', null, { timeout: 60000 });
await page.waitForTimeout(1500);
await pretty('웹캠');
await shot('test.png');

// 4) 놀이실 — 이미지 모델 + 손 그냥 보기, 규칙 둘
await page.goto(BASE + '/play.html');
await page.waitForTimeout(1500);
await page.click('[data-src="image"] .sc-top');
await page.waitForFunction(() => document.getElementById('camOff').style.display === 'none', null, { timeout: 30000 });
await ready();
await page.click('#ruleAdd');
await page.click('#pkBody .chip:text-is("사과")');
await page.fill('#ruleList .rule:nth-child(1) .say', '사과다! 맛있겠다');
await page.click('#ruleAdd');
await page.click('#pkBody .chip:text-is("손가락 2개")');
await page.click('#ruleList .rule:nth-child(2) .slot.add');
await page.click('#pkBody .chip:text-is("바나나")');
await page.fill('#ruleList .rule:nth-child(2) .say', '브이! 바나나');
await page.click('#bgPick .swatch:nth-child(1)');
await page.waitForFunction(() => document.querySelector('#ruleList .rule.fired'), null, { timeout: 30000 });
await page.waitForTimeout(800);
await pretty('웹캠');
await shot('play.png');

// 5) 보관함
await page.goto(BASE + '/storage.html');
await page.waitForSelector('#stTable tr[data-name]');
await page.waitForTimeout(500);
await shot('storage.png');

console.log('readme shots:', fs.readdirSync(OUT).join(', '));
await browser.close();
