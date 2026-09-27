// ═══════════════════════════════════════════════════════════
// piBrain 연결 — Web Serial (USB gadget serial)
// ═══════════════════════════════════════════════════════════
// 장치 쪽 짝: themakerrobot/openpibo-os.pibrain  system/uart_ctrl.py
//   · /dev/ttyGS0 를 1000000 baud 로 연다 (USB CDC 라 실제 속도와는 무관한 명목값).
//   · ser.readlines() + timeout=1 → "1초 동안 아무것도 안 오면" 한 덩어리로 본다.
//   · 덩어리에 '###END###'  → 실행 중인 코드 종료 + 네트워크 화면 표시
//               '###DISP###' → 네트워크 화면 표시
//               그 외         → 파이썬 코드로 저장하고 실행 (앞에 3줄을 덧붙인다)
//   · 실행 출력은 한 줄씩 돌려주고, 끝나면 "실행시간: N.NN 초" 한 줄을 보낸다.
//
// 1초 규칙 때문에 보내기 사이에 틈을 둬야 한다. 정지 직후 바로 실행하면
// 두 메시지가 한 덩어리로 묶여 '###END###' 로 처리되고 코드는 버려진다.
// 그래서 모든 쓰기는 한 줄로 세우고, 앞 쓰기가 끝난 뒤 GAP_MS 만큼 쉰다.

(function () {
  const BAUD = 1000000;
  const GAP_MS = 1300;      // 장치 readlines timeout(1초) + 여유

  const CMD_END = '###END###';
  const CMD_DISP = '###DISP###';

  class PiBrainSerial {
    constructor() {
      this.port = null;
      this.reader = null;
      this.readLoopDone = null;
      this.lastWriteAt = 0;
      this.queue = Promise.resolve();
      this.lineBuf = '';
      this.onLine = () => {};
      this.onState = () => {};

      if (PiBrainSerial.supported()) {
        navigator.serial.addEventListener('disconnect', (e) => {
          if (e.target === this.port) this._teardown('unplugged');
        });
      }
    }

    static supported() {
      return 'serial' in navigator;
    }

    get connected() {
      return !!(this.port && this.port.readable);
    }

    async connect() {
      if (this.connected) return;
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: BAUD });
      this.port = port;
      this.lineBuf = '';
      this.lastWriteAt = 0;
      this.onState('connected');
      this.readLoopDone = this._readLoop();
    }

    async disconnect() {
      if (!this.port) return;
      try { if (this.reader) await this.reader.cancel(); } catch (e) {}
      try { await this.readLoopDone; } catch (e) {}
      await this._teardown('closed');
    }

    async _teardown(reason) {
      const port = this.port;
      this.port = null;
      this.reader = null;
      if (port) { try { await port.close(); } catch (e) {} }
      this._flushLine();
      this.onState('disconnected', reason);
    }

    async _readLoop() {
      const decoder = new TextDecoder();
      while (this.port && this.port.readable) {
        this.reader = this.port.readable.getReader();
        try {
          for (;;) {
            const { value, done } = await this.reader.read();
            if (done) break;
            if (value) this._feed(decoder.decode(value, { stream: true }));
          }
        } catch (e) {
          // 케이블이 빠지면 여기로 온다. disconnect 이벤트가 정리한다.
          break;
        } finally {
          try { this.reader.releaseLock(); } catch (e) {}
        }
        break;
      }
    }

    _feed(text) {
      this.lineBuf += text;
      let i;
      while ((i = this.lineBuf.indexOf('\n')) >= 0) {
        const line = this.lineBuf.slice(0, i).replace(/\r$/, '');
        this.lineBuf = this.lineBuf.slice(i + 1);
        this.onLine(line);
      }
    }

    _flushLine() {
      if (this.lineBuf) { this.onLine(this.lineBuf); this.lineBuf = ''; }
    }

    // 모든 쓰기는 이 줄을 탄다 — 앞 쓰기와 GAP_MS 이상 떨어뜨린다.
    _write(text) {
      const job = this.queue.then(async () => {
        if (!this.connected) throw new Error('not-connected');
        const wait = this.lastWriteAt + GAP_MS - Date.now();
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        const writer = this.port.writable.getWriter();
        try {
          await writer.write(new TextEncoder().encode(text));
        } finally {
          writer.releaseLock();
          this.lastWriteAt = Date.now();
        }
      });
      this.queue = job.catch(() => {});
      return job;
    }

    // 코드 안에 명령 문자열이 있으면 장치가 코드 대신 명령으로 읽는다.
    static hasReservedWord(code) {
      return code.includes(CMD_END) || code.includes(CMD_DISP);
    }

    sendCode(code) {
      const body = code.endsWith('\n') ? code : code + '\n';
      return this._write(body);
    }

    stop() { return this._write(CMD_END + '\n'); }
    showNetwork() { return this._write(CMD_DISP + '\n'); }
  }

  PiBrainSerial.GAP_MS = GAP_MS;
  // 장치가 코드 앞에 덧붙이는 줄 수 (uart_ctrl.py: coding · import logging · basicConfig)
  PiBrainSerial.PRELUDE_LINES = 3;
  window.PiBrainSerial = PiBrainSerial;
})();
