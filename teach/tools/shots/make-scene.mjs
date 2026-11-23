// 화면 캡처용 합성 장면 만들기 → tools/shots/scene/
//   apple-00..11.png · banana-00..11.png  (학습실에 넣을 사진)
//   camera.y4m                            (가짜 웹캠 영상: 나무 책상 위 사과)
// 브라우저 캔버스로 그린다 — 실제 사진이나 다른 프로그램(ffmpeg 등)이 필요 없다.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, 'scene');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage();
await page.setContent('<canvas id="c"></canvas>');

// 그림 그리는 함수들을 페이지에 심는다
await page.evaluate(() => {
  window.wood = (g, w, h, seed) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#d6b88e'); gr.addColorStop(1, '#bf9a6a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.12;
    for (let i = 0; i < 26; i++) {
      const y = ((i * 37 + seed * 11) % h);
      g.fillStyle = i % 2 ? '#8a6238' : '#f0dcb8';
      g.fillRect(0, y, w, 2 + (i % 3));
    }
    g.globalAlpha = 1;
  };
  window.apple = (g, x, y, r) => {
    g.fillStyle = 'rgba(70,45,20,.25)';
    g.beginPath(); g.ellipse(x, y + r * 0.95, r * 0.9, r * 0.22, 0, 0, Math.PI * 2); g.fill();
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    gr.addColorStop(0, '#f2564a'); gr.addColorStop(1, '#b41f1a');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x - r * 0.28, y, r * 0.78, 0, Math.PI * 2); g.arc(x + r * 0.28, y, r * 0.78, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.45)';
    g.beginPath(); g.ellipse(x + r * 0.32, y - r * 0.35, r * 0.16, r * 0.22, -0.4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#5b3a1e'; g.lineWidth = r * 0.09; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y - r * 0.62); g.lineTo(x + r * 0.08, y - r * 1.0); g.stroke();
    g.fillStyle = '#3f9b3a';
    g.beginPath(); g.ellipse(x + r * 0.32, y - r * 0.95, r * 0.28, r * 0.13, -0.5, 0, Math.PI * 2); g.fill();
  };
  window.banana = (g, x, y, r) => {
    g.fillStyle = 'rgba(70,45,20,.22)';
    g.beginPath(); g.ellipse(x, y + r * 0.55, r * 1.1, r * 0.2, 0, 0, Math.PI * 2); g.fill();
    g.lineCap = 'round';
    g.strokeStyle = '#e8bb1c'; g.lineWidth = r * 0.42;
    g.beginPath(); g.arc(x, y - r * 0.6, r * 1.05, Math.PI * 0.18, Math.PI * 0.82); g.stroke();
    g.strokeStyle = '#ffe066'; g.lineWidth = r * 0.16;
    g.beginPath(); g.arc(x, y - r * 0.68, r * 1.02, Math.PI * 0.25, Math.PI * 0.75); g.stroke();
    g.fillStyle = '#5b3a1e';
    const tip = a => { const px = x + Math.cos(a) * r * 1.05, py = y - r * 0.6 + Math.sin(a) * r * 1.05; g.beginPath(); g.arc(px, py, r * 0.1, 0, Math.PI * 2); g.fill(); };
    tip(Math.PI * 0.18); tip(Math.PI * 0.82);
  };
});

async function png(name, kind, i) {
  const url = await page.evaluate(([kind, i]) => {
    const c = document.getElementById('c'); c.width = 480; c.height = 360;
    const g = c.getContext('2d');
    wood(g, 480, 360, i);
    const x = 240 + ((i * 29) % 70) - 35, y = 190 + ((i * 17) % 40) - 20, r = 78 + (i % 4) * 9;
    (kind === 'apple' ? apple : banana)(g, x, y, r);
    return c.toDataURL('image/png');
  }, [kind, i]);
  fs.writeFileSync(path.join(OUT, name), Buffer.from(url.split(',')[1], 'base64'));
}
for (let i = 0; i < 12; i++) {
  await png(`apple-${String(i).padStart(2, '0')}.png`, 'apple', i);
  await png(`banana-${String(i).padStart(2, '0')}.png`, 'banana', i);
}

// 가짜 웹캠: 640×480, 10장, 사과가 살짝 흔들린다. Y4M (YUV 4:2:0, JPEG 범위)
const W = 640, H = 480, FRAMES = 10;
const head = Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`);
const parts = [head];
for (let f = 0; f < FRAMES; f++) {
  const b64 = await page.evaluate(([W, H, f]) => {
    const c = document.getElementById('c'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    wood(g, W, H, 3);
    apple(g, W / 2 + Math.sin(f / 10 * Math.PI * 2) * 6, H / 2 + 20, 120);
    const d = g.getImageData(0, 0, W, H).data;
    const Y = new Uint8Array(W * H), U = new Uint8Array(W * H / 4), V = new Uint8Array(W * H / 4);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = (j * W + i) * 4, r = d[k], gg = d[k + 1], b = d[k + 2];
      Y[j * W + i] = Math.max(0, Math.min(255, Math.round(0.299 * r + 0.587 * gg + 0.114 * b)));
      if (!(j & 1) && !(i & 1)) {
        const q = (j >> 1) * (W >> 1) + (i >> 1);
        U[q] = Math.max(0, Math.min(255, Math.round(-0.168736 * r - 0.331264 * gg + 0.5 * b + 128)));
        V[q] = Math.max(0, Math.min(255, Math.round(0.5 * r - 0.418688 * gg - 0.081312 * b + 128)));
      }
    }
    const all = new Uint8Array(Y.length + U.length + V.length);
    all.set(Y); all.set(U, Y.length); all.set(V, Y.length + U.length);
    let s = '';
    for (let i = 0; i < all.length; i += 0x8000) s += String.fromCharCode.apply(null, all.subarray(i, i + 0x8000));
    return btoa(s);
  }, [W, H, f]);
  parts.push(Buffer.from('FRAME\n'), Buffer.from(b64, 'base64'));
}
fs.writeFileSync(path.join(OUT, 'camera.y4m'), Buffer.concat(parts));
// 장면 미리보기 (사람이 눈으로 확인용)
const prev = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
fs.writeFileSync(path.join(OUT, 'camera.png'), Buffer.from(prev.split(',')[1], 'base64'));

console.log('scene:', fs.readdirSync(OUT).length, 'files →', OUT);
await browser.close();
