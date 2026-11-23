// ═══════════════════════════════════════════════════════════
// turtle 화면 — lib/turtle.py 가 보낸 명령을 캔버스에 그린다
// ═══════════════════════════════════════════════════════════
// 캔버스 두 장: 아래는 그림(지워지지 않음), 위는 거북이 모양(매 프레임 다시 그림).
// 명령은 줄에 세우고, 거북이마다 speed 에 맞춰 한 프레임에 조금씩 그린다.
// 좌표는 turtle 식 — 가운데가 (0, 0), 위쪽이 +y.

(function () {
  'use strict';

  // speed 1~10 → 한 프레임에 움직이는 거리(px). 0 은 바로.
  const PX_PER_FRAME = [Infinity, 1.5, 3, 4.5, 6, 8, 10, 13, 17, 23, 32];
  const BIG_QUEUE = 20000;    // 줄이 너무 길면 빨리 감기
  const WALK_MS = 160;        // 마지막으로 움직인 뒤 이만큼은 걷는 자세

  class TurtleCanvas {
    constructor(host) {
      this.host = host;
      this.wrap = document.createElement('div');
      this.wrap.className = 'tc-wrap';
      this.draw = document.createElement('canvas');
      this.top = document.createElement('canvas');
      this.top.className = 'tc-top';
      this.wrap.append(this.draw, this.top);
      host.appendChild(this.wrap);
      this.dctx = this.draw.getContext('2d');
      this.tctx = this.top.getContext('2d');
      this.queue = [];
      this.raf = 0;
      this.onIdle = () => {};
      this.reset();
      new ResizeObserver(() => this._fit()).observe(host);
    }

    reset(w = 400, h = 400) {
      this.queue = [];
      this.turtles = new Map();
      this.tracer = true;
      this.cur = null;      // 반쯤 그린 이동 명령
      this.bg = 'white';
      this._size(w, h);
      this._renderTop();
    }

    _size(w, h) {
      this.w = w; this.h = h;
      const dpr = window.devicePixelRatio || 1;
      for (const c of [this.draw, this.top]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      for (const ctx of [this.dctx, this.tctx]) {
        ctx.setTransform(dpr, 0, 0, dpr, w / 2 * dpr, h / 2 * dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
      this.wrap.style.background = this.bg;
      this.wrap.style.aspectRatio = `${w} / ${h}`;
      this._fit();
    }

    // 패널 크기에 맞춰 비율을 지키며 늘리고 줄인다
    _fit() {
      const r = this.host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const s = Math.min(r.width / this.w, r.height / this.h);
      this.wrap.style.width = Math.floor(this.w * s) + 'px';
      this.wrap.style.height = Math.floor(this.h * s) + 'px';
    }

    // 화면 좌표(clientX, Y) → turtle 좌표. 그림 밖이면 null
    toTurtle(cx, cy) {
      const r = this.wrap.getBoundingClientRect();
      if (!r.width || cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
      return {
        x: (cx - r.left) / r.width * this.w - this.w / 2,
        y: this.h / 2 - (cy - r.top) / r.height * this.h,
      };
    }

    get busy() { return this.queue.length > 0 || !!this.cur; }

    push(cmds) {
      for (const c of cmds) this.queue.push(c);
      if (!this.raf) this.raf = requestAnimationFrame(() => this._frame());
    }

    stop() {
      this.queue = [];
      this.cur = null;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this._renderTop();
    }

    _t(id) {
      let t = this.turtles.get(id);
      if (!t) {
        t = { x: 0, y: 0, h: 0, shape: 'classic', visible: true, speed: 3, color: 'black' };
        this.turtles.set(id, t);
      }
      return t;
    }

    // ── 한 프레임 ──
    _frame() {
      this.raf = 0;
      const fast = this.queue.length > BIG_QUEUE;
      const budgets = new Map();   // 거북이별 이번 프레임에 남은 거리
      let guard = 0;
      while ((this.cur || this.queue.length) && guard++ < 100000) {
        if (!this.cur) {
          const c = this.queue.shift();
          if (c[0] !== 'mv') { this._apply(c); continue; }
          this.cur = { c, done: 0, len: Math.hypot(c[4] - c[2], c[5] - c[3]) };
        }
        const { c, len } = this.cur;
        const t = this._t(c[1]);
        const instant = fast || !this.tracer || t.speed === 0 || len === 0;
        let budget = budgets.has(c[1]) ? budgets.get(c[1]) : PX_PER_FRAME[t.speed];
        if (!instant && budget <= 0) break;
        const step = instant ? len - this.cur.done : Math.min(budget, len - this.cur.done);
        this.cur.done += step;
        this._progress(c, this.cur.done, len);
        if (!instant) budgets.set(c[1], budget - step);
        if (this.cur.done >= len - 1e-9) this.cur = null;
      }
      this._renderTop();
      if (this.cur || this.queue.length) this.raf = requestAnimationFrame(() => this._frame());
      else this.onIdle();
    }

    // 이동 명령을 done 만큼 진행한다. 선은 다 그은 뒤에 아래 캔버스에 한 번에 긋는다 —
    // 조각조각 그으면 이음새가 겹쳐 진해져서 점선처럼 보인다. 그리는 중인 선은 위 캔버스에.
    _progress(c, done, len) {
      const [, id, x0, y0, x1, y1, down, color, width, h] = c;
      const t = this._t(id);
      const f = len ? Math.min(1, done / len) : 1;
      const nx = x0 + (x1 - x0) * f, ny = y0 + (y1 - y0) * f;
      this._walked(t, nx, ny);
      t.x = nx; t.y = ny; t.h = h; t.color = color;
      if (f >= 1 - 1e-9 && down && len) this._line(this.dctx, x0, y0, x1, y1, color, width);
    }

    // 로봇이 걸은 거리 — 다리 흔들기에 쓴다. 멈추면 잠시 뒤 차렷 자세로 다시 그린다
    _walked(t, nx, ny) {
      const d = Math.hypot(nx - t.x, ny - t.y);
      if (!d) return;
      t.walk = (t.walk || 0) + Math.min(d, 40);
      t.lastMove = performance.now();
      if (Math.abs(nx - t.x) > 0.01) t.faceLeft = nx < t.x;
      clearTimeout(this.restTimer);
      this.restTimer = setTimeout(() => this._renderTop(), WALK_MS + 30);
    }

    _line(ctx, x0, y0, x1, y1, color, width) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x0, -y0);
      ctx.lineTo(x1, -y1);
      ctx.stroke();
    }

    _apply(c) {
      const ctx = this.dctx;
      switch (c[0]) {
        case 'new': { const t = this._t(c[1]); t.shape = c[2]; t.visible = c[3]; break; }
        case 'pose': { const t = this._t(c[1]); t.x = c[2]; t.y = c[3]; t.h = c[4]; break; }
        case 'speed': this._t(c[1]).speed = c[2]; break;
        case 'shape': this._t(c[1]).shape = c[2]; break;
        case 'vis': this._t(c[1]).visible = c[2]; break;
        case 'tracer': this.tracer = c[1]; break;
        case 'update': break;
        case 'bg': this.bg = c[1]; this.wrap.style.background = c[1]; break;
        case 'size': this._size(c[1], c[2]); break;
        case 'dot':
          ctx.fillStyle = c[5];
          ctx.beginPath();
          ctx.arc(c[2], -c[3], c[4] / 2, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'fill': {
          // 채우기는 그 뒤에 그은 선보다 아래에 깔리게 (표준 turtle 과 같은 모양)
          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = c[3];
          ctx.beginPath();
          c[2].forEach(([x, y], i) => (i ? ctx.lineTo(x, -y) : ctx.moveTo(x, -y)));
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'tx': {
          const [, , x, y, text, align, name, size, style, color] = c;
          const weight = /bold/.test(style) ? 'bold ' : '';
          const italic = /italic/.test(style) ? 'italic ' : '';
          ctx.fillStyle = color;
          ctx.font = `${italic}${weight}${size * 1.33}px ${JSON.stringify(name)}, 'Pretendard Variable', sans-serif`;
          ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(text, x, -y);
          break;
        }
        case 'stamp': this._drawShape(ctx, this._t(c[1])); break;
        case 'clear': case 'clearall':
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, this.draw.width, this.draw.height);
          ctx.restore();
          break;
      }
    }

    _renderTop() {
      const ctx = this.tctx;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.top.width, this.top.height);
      ctx.restore();
      if (this.cur) {
        const [, id, x0, y0, , , down, color, width] = this.cur.c;
        const t = this._t(id);
        if (down) this._line(ctx, x0, y0, t.x, t.y, color, width);
      }
      for (const t of this.turtles.values()) if (t.visible) this._drawShape(ctx, t);
    }

    // 걷는 로봇: 파이보 캐릭터 (흰 동그란 머리 · 파란 고리 안테나 · 동그란 안경 · 볼터치 ·
    // 웃는 입 · 통통한 몸). 돌리지 않고 선 위에 서 있으며, 왼쪽으로 가면 좌우를 뒤집어
    // 가는 쪽을 본다. 움직이는 동안 팔다리를 번갈아 흔들고 몸이 살짝 통통 튄다.
    // 좌표: 발끝(선)이 (0, 0), 위가 -y. 키는 약 56.
    _drawRobot(ctx, t) {
      const walking = performance.now() - (t.lastMove || 0) < WALK_MS;
      const ph = (t.walk || 0) / 5;
      const swing = walking ? Math.sin(ph) * 0.55 : 0;              // 라디안
      const bob = walking ? -Math.abs(Math.sin(ph)) * 1.6 : 0;
      const WHITE = '#FFFFFF', SHADE = '#E3E8EE', EDGE = '#C9D0D8', INK = '#1E1E1E';
      const BLUE = '#2A8BE0', BLUE_D = '#1C6CB8', PINK = 'rgba(245,150,170,0.75)';
      const S = 1.05;
      if (t.faceLeft) ctx.scale(-1, 1);
      ctx.scale(S, S);
      ctx.translate(0, bob);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const soft = (cx, cy, r) => {                                  // 흰 몸에 은은한 입체감
        const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.15, cx, cy, r * 1.05);
        g.addColorStop(0, WHITE);
        g.addColorStop(0.7, '#F7F9FB');
        g.addColorStop(1, SHADE);
        return g;
      };
      const capsule = (x, y, ang, w, len) => {                       // 팔·다리
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.fillStyle = soft(0, len / 2, len / 1.4);
        ctx.strokeStyle = EDGE;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.roundRect(-w / 2, -w / 2, w, len + w / 2, w / 2);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      };

      // 뒤쪽 팔·다리
      capsule(-4.2, -9, -swing, 6.4, 6.5);
      capsule(-8.5, -18.5, swing * 0.9, 5, 6.5);

      // 몸통
      ctx.fillStyle = soft(0, -15, 11);
      ctx.strokeStyle = EDGE;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.roundRect(-9.5, -22, 19, 15, [6, 6, 8, 8]);
      ctx.fill(); ctx.stroke();
      // 가슴 네모 = 펜 색
      ctx.fillStyle = t.color || '#3A3A3A';
      ctx.strokeStyle = '#2A2A2A';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.roundRect(-3.6, -16.8, 7.2, 3.4, 1.2); ctx.fill(); ctx.stroke();

      // 앞쪽 팔·다리
      capsule(4.2, -9, swing, 6.4, 6.5);
      capsule(8.5, -18.5, -swing * 0.9, 5, 6.5);

      // 안테나 (파란 고리)
      ctx.strokeStyle = BLUE;
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(0, -50); ctx.stroke();
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(0, -54.5, 4, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = BLUE_D;
      ctx.beginPath(); ctx.arc(-3.2, -57, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(3.2, -57, 1.3, 0, Math.PI * 2); ctx.fill();

      // 머리
      const hy = -34, hr = 13.5;
      ctx.fillStyle = soft(0, hy, hr);
      ctx.strokeStyle = EDGE;
      ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.arc(0, hy, hr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      // 볼터치
      ctx.fillStyle = PINK;
      ctx.beginPath(); ctx.ellipse(-8, hy + 4.5, 2.8, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(8.4, hy + 3.5, 2.8, 2, 0, 0, Math.PI * 2); ctx.fill();

      // 눈: 왼쪽은 반짝이는 눈, 오른쪽은 윙크
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(-4.6, hy - 0.5, 1.9, 2.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = WHITE;
      ctx.beginPath(); ctx.arc(-4.1, hy - 1.3, 0.75, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(5, hy + 0.2, 1.9, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();

      // 안경
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(-4.8, hy - 0.6, 4.4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(5, hy - 0.6, 4.4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.6, hy - 1.4); ctx.quadraticCurveTo(0.1, hy - 2.4, 0.8, hy - 1.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-9.2, hy - 1.2); ctx.lineTo(-hr + 0.6, hy - 1.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(9.4, hy - 1.2); ctx.lineTo(hr - 0.6, hy - 1.8); ctx.stroke();

      // 웃는 입
      ctx.fillStyle = '#B8323F';
      ctx.beginPath();
      ctx.moveTo(-3, hy + 5.2);
      ctx.quadraticCurveTo(0.2, hy + 11, 3.4, hy + 5.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#F07A88';
      ctx.beginPath(); ctx.ellipse(0.3, hy + 8, 1.7, 1, 0, 0, Math.PI * 2); ctx.fill();
    }

    _drawShape(ctx, t) {
      if (t.shape === 'blank') return;
      ctx.save();
      ctx.translate(t.x, -t.y);
      if (t.shape === 'robot') {
        this._drawRobot(ctx, t);
        ctx.restore();
        return;
      }
      ctx.rotate(-t.h * Math.PI / 180);
      ctx.fillStyle = t.color;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      switch (t.shape) {
        case 'circle': ctx.arc(0, 0, 10, 0, Math.PI * 2); break;
        case 'square': ctx.rect(-10, -10, 20, 20); break;
        case 'triangle': ctx.moveTo(10, 0); ctx.lineTo(-10, -11.5); ctx.lineTo(-10, 11.5); break;
        case 'turtle':
          ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2);
          ctx.moveTo(14, 0); ctx.arc(12, 0, 3.5, 0, Math.PI * 2);
          break;
        case 'arrow': ctx.moveTo(10, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10); break;
        default: ctx.moveTo(0, 0); ctx.lineTo(-9, -5); ctx.lineTo(-7, 0); ctx.lineTo(-9, 5);   // classic
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  window.TurtleCanvas = TurtleCanvas;
})();
