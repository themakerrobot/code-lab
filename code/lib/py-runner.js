// ═══════════════════════════════════════════════════════════
// 파이썬 실행기 (화면 쪽) — lib/py-worker.js 를 띄우고 부린다
// ═══════════════════════════════════════════════════════════
// · run(code)  : 실행. 끝나면 onDone({ok, error, elapsed})
// · stop()     : 워커를 끝내고 새로 띄운다 (무한 반복도 바로 멈춘다)
// · 입력       : 워커가 input() 을 부르면 onInput(id) → answer(id, 글자)
// · 출력       : onOut(text, cls) · 그림 onImage(src) · turtle 명령 onTurtle(cmds)
// · 이벤트     : 코드가 끝났는데 turtle 이벤트가 걸려 있으면 onWaiting() → event(kind, key, x, y)
// · 센서       : 파이썬이 센서를 쓰려 하면 onSensorNeed(what)

(function () {
  'use strict';

  const SW_WAIT_MS = 4000;

  class PyRunner {
    constructor() {
      this.worker = null;
      this.ready = false;
      this.running = false;
      this.runId = 0;
      this.pendingInput = null;
      this.version = '';
      this.onStatus = () => {};
      this.onReady = () => {};
      this.onOut = () => {};
      this.onTurtle = () => {};
      this.onImage = () => {};
      this.onWaiting = () => {};
      this.onSensorNeed = () => {};
      this.onSay = () => {};
      this.waiting = false;
      this.onInput = () => {};
      this.onDone = () => {};
      this.onFatal = () => {};
      this._swReady = this._waitServiceWorker();
    }

    // input() 은 서비스 워커가 있어야 된다. 처음 열면 설치 → 이 페이지를 맡을 때까지 잠깐 기다린다.
    async _waitServiceWorker() {
      if (!('serviceWorker' in navigator)) return false;
      try {
        await navigator.serviceWorker.register('sw.js');
      } catch (e) {
        return false;
      }
      if (navigator.serviceWorker.controller) return true;
      return new Promise((resolve) => {
        const t = setTimeout(() => resolve(!!navigator.serviceWorker.controller), SW_WAIT_MS);
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          clearTimeout(t);
          resolve(true);
        }, { once: true });
      });
    }

    async start() {
      this.ready = false;
      const canSyncInput = await this._swReady;
      const w = new Worker('lib/py-worker.js', { type: 'module' });
      this.worker = w;
      w.onmessage = (e) => this._onMessage(w, e.data);
      w.onerror = (e) => { if (w === this.worker) this.onFatal(e.message || '파이썬 워커 오류'); };
      w.postMessage({ type: 'init', token: Math.random().toString(36).slice(2), canSyncInput });
    }

    _onMessage(w, m) {
      if (w !== this.worker) return;   // 끝낸 워커의 늦은 메시지
      switch (m.type) {
        case 'status': this.onStatus(m.text); break;
        case 'ready': this.ready = true; this.version = m.version; this.onReady(m.version); break;
        case 'out': this.onOut(m.text, m.cls); break;
        case 'turtle': this.onTurtle(m.cmds); break;
        case 'image': this.onImage(m.src); break;
        case 'waiting': this.waiting = true; this.onWaiting(); break;
        case 'sensor-need': this.onSensorNeed(m.what); break;
        case 'say': this.onSay(m.text); break;
        case 'input': this.pendingInput = m.id; this.onInput(m.id); break;
        case 'done':
          if (m.id !== this.runId) return;
          this.running = false;
          this.waiting = false;
          this.pendingInput = null;
          this.onDone({ ok: m.ok, error: m.error, elapsed: m.elapsed });
          break;
        case 'fatal': this.onFatal(m.text); break;
      }
    }

    run(code, extra) {
      if (!this.worker || this.running) return false;
      this.running = true;
      this.runId += 1;
      this.worker.postMessage(Object.assign({ type: 'run', id: this.runId, code }, extra || {}));
      return true;
    }

    // turtle 키보드·마우스 (이벤트를 기다릴 때만 보낸다)
    event(kind, key, x, y) {
      if (this.worker && this.waiting) this.worker.postMessage({ type: 'event', kind, key, x, y });
    }

    answer(id, value) {
      if (id !== this.pendingInput) return;
      this.pendingInput = null;
      const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
      if (sw) sw.postMessage({ type: 'input-response', id, value });
    }

    stop() {
      if (this.pendingInput) {
        const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
        if (sw) sw.postMessage({ type: 'input-cancel', id: this.pendingInput });
        this.pendingInput = null;
      }
      if (this.worker) this.worker.terminate();
      this.worker = null;
      this.running = false;
      this.waiting = false;
      this.ready = false;     // 새 워커가 준비될 때까지 실행 버튼을 잠근다
      this.start();
    }
  }

  window.PyRunner = PyRunner;
})();
