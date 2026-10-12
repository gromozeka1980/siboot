// QuickDraw emulation as done by the DOS port on top of BGI (OVL_7AD), on our Screen.
// Colour 0 = white paper, 15 = black ink (as programmed from every .DTA palette).
// DOS specifics reproduced: FrameRect/InvertRect/PtInRect include the right & bottom edge
// (BGI Rectangle semantics); pattern 1-bits = colour 15, 0-bits = colour 0.

import { rect } from '../platform/screen.js';

export const WHITE = 0, BLACK = 15;
const pat = bytes => ({ bits: bytes, fg: BLACK, bg: WHITE });
export const Pat = {
  white: pat([0, 0, 0, 0, 0, 0, 0, 0]),
  black: pat([255, 255, 255, 255, 255, 255, 255, 255]),
  gray: pat([0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55]),
};

// FillRect through BGI FillPoly paints the outline too -> inclusive right/bottom.
// Kept as a switch until verified pixel-exact against the emulator.
export let FILL_INCLUSIVE = true;

export class QD {
  constructor(screen, font) {
    this.scr = screen;
    this.font = font;
    this.pen = { x: 0, y: 0 };
  }
  _incl(r) { return rect(r.left, r.top, r.right + 1, r.bottom + 1); }

  fillRect(r, p) {
    const rr = FILL_INCLUSIVE ? this._incl(r) : r;
    this.scr.fill(rr, p === Pat.white ? WHITE : p === Pat.black ? BLACK : p);
  }
  frameRect(r) { this.scr.frame(this._incl(r), BLACK); }
  invertRect(r) { this.scr.xorRect(this._incl(r), 15); }
  ptInRect(p, r) { return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom; }
  sectRect(a, b) {
    return Math.min(a.right, b.right) - Math.max(a.left, b.left) >= 1 &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) >= 1;
  }
  moveTo(x, y) { this.pen.x = x; this.pen.y = y; }
  lineTo(x, y, c = BLACK) { this.scr.line(this.pen.x, this.pen.y, x, y, c); this.pen.x = x; this.pen.y = y; }
  drawString(s, fg = BLACK) {
    this.pen.x += this.font.draw(this.scr, this.pen.x, this.pen.y, String(s), fg);
  }
  drawChar(c) { this.drawString(c); }
  stringWidth(s) { return this.font.width(String(s)); }
  clearRect(l, t, r, b) { this.fillRect(rect(l, t, r, b), Pat.white); }
}
