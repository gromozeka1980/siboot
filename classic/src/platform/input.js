// Event queue + async helpers mirroring the Mac/DOS event model the original code is written against
// (GetNextEvent, Button, StillDown, TickCount, MyWait).

import { W, H } from './screen.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.queue = [];
    this.waiters = [];
    this.mouse = { x: 0, y: 0 };
    this.down = false;
    const pos = e => {
      const r = canvas.getBoundingClientRect();
      return { x: Math.floor((e.clientX - r.left) * W / r.width), y: Math.floor((e.clientY - r.top) * H / r.height) };
    };
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      this.mouse = pos(e); this.down = true;
      this.push({ type: 'mousedown', ...this.mouse, shift: e.shiftKey });
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', e => { this.mouse = pos(e); this.wake(); });
    canvas.addEventListener('pointerup', e => {
      this.mouse = pos(e); this.down = false;
      this.push({ type: 'mouseup', ...this.mouse });
    });
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.push({ type: 'keydown', key: e.key, code: e.code, alt: e.altKey, ctrl: e.ctrlKey, shift: e.shiftKey });
      if (e.key === 'Enter' || e.key === 'Backspace' || e.altKey) e.preventDefault();
    });
  }

  push(ev) { this.queue.push(ev); this.wake(); }
  wake() { const w = this.waiters; this.waiters = []; w.forEach(f => f()); }
  changed() { return new Promise(r => this.waiters.push(r)); }

  /** Next event (mousedown/mouseup/keydown); resolves as soon as one is available. */
  async nextEvent() {
    while (!this.queue.length) await this.changed();
    return this.queue.shift();
  }

  /** Non-blocking GetNextEvent. */
  poll() { return this.queue.shift() || null; }
  flush() { this.queue.length = 0; }

  /** REPEAT UNTIL NOT StillDown */
  async waitRelease() { while (this.down) await this.changed(); this.queue = this.queue.filter(e => e.type !== 'mouseup'); }

  /** REPEAT UNTIL Button */
  async waitButton() {
    for (;;) {
      if (this.down) return;
      const i = this.queue.findIndex(e => e.type === 'mousedown');
      if (i >= 0) { this.queue.splice(0, i + 1); return; }
      await this.changed();
    }
  }

  /** Wait for a full click (press + release). */
  async waitClick() { await this.waitButton(); await this.waitRelease(); }

  /** MyWait(ticks): wait up to ticks/60 s, returning early if the button is pressed. */
  async wait(ticks, abortOnButton = true) {
    const end = performance.now() + ticks * 1000 / 60;
    while (performance.now() < end) {
      if (abortOnButton && (this.down || this.queue.some(e => e.type === 'mousedown'))) return true;
      await Promise.race([this.changed(), sleep(Math.min(16, end - performance.now()))]);
    }
    return false;
  }
}

export const sleep = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));
