// Bitmap font renderer for the converted GEM-style .@ fonts (see tools/extract.py).
// DOS font library semantics: pen y = baseline; unless bg is null, an opaque box of colour bg,
// exactly one font cell tall, is filled behind the string first; glyph 1-bits get colour fg.

export class BitmapFont {
  constructor(json) { Object.assign(this, json); }

  static async load(url) { return new BitmapFont(await (await fetch(url)).json()); }

  glyph(ch) { return this.glyphs[String(ch.charCodeAt(0))]; }

  width(str) {
    let w = 0;
    for (const ch of str) { const g = this.glyph(ch); if (g) w += g.w; }
    return w;
  }

  /** Draws str with its baseline at y; returns the advance. */
  draw(scr, x, y, str, fg = 15, bg = 0) {
    const W = this.width(str), top = y - this.ascent;
    if (bg !== null && W > 0) scr.fill({ left: x, top, right: x + W, bottom: top + this.height }, bg);
    let px = x;
    for (const ch of str) {
      const g = this.glyph(ch);
      if (!g) continue;
      if (ch !== ' ') {
        for (let r = 0; r < g.rows.length; r++) {
          const row = g.rows[r];
          if (!row) continue;
          for (let i = 0; i < g.w; i++) if (row & (1 << (g.w - 1 - i))) scr.pset(px + i, top + r, fg);
        }
      }
      px += g.w;
    }
    return W;
  }
}

/** BGI Small font widths, used by menus/dialogs for centering only. */
export class MetricsFont {
  constructor(json) { this.widths = json.widths || json; this.def = 6; }
  static async load(url) { return new MetricsFont(await (await fetch(url)).json()); }
  width(str) {
    let w = 0;
    for (const ch of str) {
      const c = ch.charCodeAt(0);
      w += (Array.isArray(this.widths) ? this.widths[c - 32] : this.widths[c]) ?? this.def;
    }
    return w;
  }
}
