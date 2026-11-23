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

  const robotImg = new Image();
  robotImg.src = 'assets/img/turtle-robot.png';

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
      t.x = x0 + (x1 - x0) * f; t.y = y0 + (y1 - y0) * f; t.h = h; t.color = color;
      if (f >= 1 - 1e-9 && down && len) this._line(this.dctx, x0, y0, x1, y1, color, width);
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

    _drawShape(ctx, t) {
      if (t.shape === 'blank') return;
      ctx.save();
      ctx.translate(t.x, -t.y);
      if (t.shape === 'robot') {
        // 얼굴 모양이라 돌리지 않는다
        if (robotImg.complete && robotImg.naturalWidth) ctx.drawImage(robotImg, -20, -20, 40, 40);
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
