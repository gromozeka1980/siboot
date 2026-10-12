// Indexed 16-colour framebuffer that mimics the BGI/QuickDraw-on-BGI surface of the DOS game.
// All drawing works on palette indices so XOR/invert/pattern semantics match the original;
// present() converts to RGBA for the canvas.

export const W = 640, H = 480;

export class Screen {
  constructor(canvas, palette) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.fb = new Uint8Array(W * H);
    this.image = this.ctx.createImageData(W, H);
    this.setPalette(palette);
    this.dirty = true;
    this.clip = null; // {left, top, right, bottom} or null
    const loop = () => { if (this.dirty) this.present(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  setPalette(palette) {
    // palette: array of 16 [r,g,b]
    this.rgba = new Uint32Array(16);
    const le = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
    palette.forEach(([r, g, b], i) => {
      this.rgba[i] = le ? (0xff000000 | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | 0xff);
    });
    this.dirty = true;
  }

  present() {
    const out = new Uint32Array(this.image.data.buffer);
    const fb = this.fb, pal = this.rgba;
    for (let i = 0; i < fb.length; i++) out[i] = pal[fb[i]];
    this.ctx.putImageData(this.image, 0, 0);
    this.dirty = false;
  }

  // --- primitives (rect = {left, top, right, bottom}, right/bottom exclusive like QuickDraw) ---
  _bounds(l, t, r, b) {
    const c = this.clip;
    if (c) { l = Math.max(l, c.left); t = Math.max(t, c.top); r = Math.min(r, c.right); b = Math.min(b, c.bottom); }
    return [Math.max(0, l), Math.max(0, t), Math.min(W, r), Math.min(H, b)];
  }

  pset(x, y, c) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const k = this.clip;
    if (k && (x < k.left || y < k.top || x >= k.right || y >= k.bottom)) return;
    this.fb[y * W + x] = c; this.dirty = true;
  }

  pget(x, y) { return (x < 0 || y < 0 || x >= W || y >= H) ? 0 : this.fb[y * W + x]; }

  // fill with solid colour or with a pattern {bits: [8 bytes], fg, bg}
  fill(rect, paint) {
    const [l, t, r, b] = this._bounds(rect.left, rect.top, rect.right, rect.bottom);
    if (typeof paint === 'number') {
      for (let y = t; y < b; y++) this.fb.fill(paint, y * W + l, y * W + r);
    } else {
      const { bits, fg, bg } = paint;
      for (let y = t; y < b; y++) {
        const row = bits[y & 7];
        for (let x = l; x < r; x++) {
          const on = row & (0x80 >> (x & 7));
          if (on) this.fb[y * W + x] = fg;
          else if (bg !== null && bg !== undefined) this.fb[y * W + x] = bg;
        }
      }
    }
    this.dirty = true;
  }

  // XOR every pixel with mask (DOS "invert" in 16 colours)
  xorRect(rect, mask = 15) {
    const [l, t, r, b] = this._bounds(rect.left, rect.top, rect.right, rect.bottom);
    for (let y = t; y < b; y++) for (let x = l; x < r; x++) this.fb[y * W + x] ^= mask;
    this.dirty = true;
  }

  hline(x1, x2, y, c) { if (x2 < x1) [x1, x2] = [x2, x1]; for (let x = x1; x <= x2; x++) this.pset(x, y, c); }
  vline(x, y1, y2, c) { if (y2 < y1) [y1, y2] = [y2, y1]; for (let y = y1; y <= y2; y++) this.pset(x, y, c); }

  line(x1, y1, x2, y2, c) {
    const dx = Math.abs(x2 - x1), dy = -Math.abs(y2 - y1), sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.pset(x1, y1, c);
      if (x1 === x2 && y1 === y2) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x1 += sx; }
      if (e2 <= dx) { err += dx; y1 += sy; }
    }
  }

  frame(rect, c, thickness = 1) {
    for (let i = 0; i < thickness; i++) {
      const l = rect.left + i, t = rect.top + i, r = rect.right - 1 - i, b = rect.bottom - 1 - i;
      this.hline(l, r, t, c); this.hline(l, r, b, c); this.vline(l, t, b, c); this.vline(r, t, b, c);
    }
  }

  // image = {w, h, data: Uint8Array of palette indices, (optional) transparent index}
  // mode: 'copy' | 'xor' | 'or' | 'and' | 'not'
  blit(img, x, y, mode = 'copy', src = null) {
    const sx0 = src ? src.left : 0, sy0 = src ? src.top : 0;
    const sw = src ? src.right - src.left : img.w, sh = src ? src.bottom - src.top : img.h;
    for (let j = 0; j < sh; j++) {
      const dy = y + j; if (dy < 0 || dy >= H) continue;
      for (let i = 0; i < sw; i++) {
        const dx = x + i; if (dx < 0 || dx >= W) continue;
        const k = this.clip; if (k && (dx < k.left || dy < k.top || dx >= k.right || dy >= k.bottom)) continue;
        const v = img.data[(sy0 + j) * img.w + sx0 + i], o = dy * W + dx;
        switch (mode) {
          case 'copy': this.fb[o] = v; break;
          case 'xor': this.fb[o] ^= v; break;
          case 'or': this.fb[o] |= v; break;
          case 'and': this.fb[o] &= v; break;
          case 'not': this.fb[o] = v ^ 15; break;
          case 'transparent': if (v !== img.transparent) this.fb[o] = v; break;
        }
      }
    }
    this.dirty = true;
  }

  // save-under (GetImage/PutImage)
  save(rect) {
    const w = rect.right - rect.left, h = rect.bottom - rect.top, data = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) data[j * w + i] = this.pget(rect.left + i, rect.top + j);
    return { w, h, data, x: rect.left, y: rect.top };
  }
  restore(saved) { const c = this.clip; this.clip = null; this.blit(saved, saved.x, saved.y); this.clip = c; }
}

export const rect = (left, top, right, bottom) => ({ left, top, right, bottom });
export const inRect = (p, r) => p.x >= r.left && p.x < r.right && p.y >= r.top && p.y < r.bottom;
