// Menu bar & pull-down menus driven by the original SIBOOT.MNU (port of DOS OVL_40E / OVL_401).
// Spec: _ref/dos_src/UI.notes.md §5. Text: RMN6_13, drawn top-aligned (baseline = top+13);
// titles are centred with BGI Small-font metrics; highlight = InvertRect (inclusive).

import { rect } from '../platform/screen.js';
import { Pat } from './qd.js';

const SHORTCUT_COLOUR = 3;   // BGI colour $3C -> VRAM 12 -> palette entry 3 (magenta)
const DISABLED_SHORTCUT = 10; // BGI colour 5 -> palette entry 10
export function parseMenuFile(text) {
  const menus = [];
  for (const raw of text.split(/\r\n|\r|\n/)) {
    if (!raw.trim()) continue;
    if (raw[0] !== '\t') { menus.push({ title: raw.trim(), items: [] }); continue; }
    let t = ' ' + raw.slice(1), key = null;
    const k = t.indexOf('/');
    if (k >= 0 && k + 1 < t.length) { key = t[k + 1].toUpperCase(); t = t.slice(0, k) + t.slice(k + 2); }
    let enabled = true;
    if (t[1] === '(') { enabled = false; t = t[0] + t.slice(2); }
    menus[menus.length - 1].items.push({ text: t, key, enabled, checked: false });
  }
  return menus.filter(m => m.items.length); // e.g. a trailing ^Z line is not a menu
}

export class Menus {
  constructor(ui, menuText, metrics) {
    this.ui = ui;
    this.metrics = metrics; // BGI small font widths
    this.menus = parseMenuFile(menuText);
    this.layout();
  }

  layout() {
    const w = s => this.ui.qd.stringWidth(s);
    let x = 1;
    for (const m of this.menus) {
      m.rect = rect(x, 0, x + w(m.title) + 15, 14);
      x = m.rect.right;
      m.maxW = Math.max(...m.items.map(i => w(i.text)));
      m.items.forEach((it, k) => {
        const top = 15 + 18 * k;
        it.rect = rect(m.rect.left, top, m.rect.left + m.maxW + 16, top + 18);
      });
      m.pull = rect(m.rect.left - 1, 15, m.rect.left + m.maxW + 17, m.items[m.items.length - 1].rect.bottom + 1);
    }
  }

  /** Draws text so that it fits `width` by BGI metrics, top-aligned at (x, top).
   *  Measured against the real game: BGI TextWidth behaves as the 8x8 default font (8 px/char). */
  _text(s, x, top, width, colour = 15) {
    while (s.length && 8 * s.length > width) s = s.slice(0, -1);
    this.ui.qd.moveTo(x, top + 13);
    this.ui.qd.drawString(s, colour);
  }

  drawBar() {
    const qd = this.ui.qd;
    qd.fillRect(rect(0, 0, 640, 12), Pat.white);
    for (const m of this.menus) {
      qd.fillRect(m.rect, Pat.white);
      const span = m.rect.right - m.rect.left;
      // The DOS code centres titles with BGI stroke-font metrics we could not reproduce exactly;
      // offsets of the original titles are measured from the real game, others use a close formula.
      const off = (span - 8 * m.title.length) >> 1; // BGI TextWidth = 8 px/char (matches all titles)
      qd.moveTo(m.rect.left + off, 13);
      qd.drawString(m.title);
    }
    this.ui.scr.hline(0, 639, 17, 15);
  }

  inMenuBar(pt) { return pt.y >= 0 && pt.y <= 12; }

  _drawPull(m) {
    const qd = this.ui.qd, p = m.pull;
    const saved = this.ui.scr.save(rect(p.left, p.top, p.right + 1, p.bottom + 1));
    qd.fillRect(p, Pat.white);
    this.ui.scr.frame(rect(p.left, p.top, p.right + 1, p.bottom + 1), 15);
    let colour = 15; // DOS quirk: text colour carries over from the previous item's shortcut
    for (const it of m.items) {
      const r = it.rect;
      qd.fillRect(r, Pat.white);
      const t = it.checked ? '*' + it.text.slice(1) : it.text;
      this._text(t, r.left + 6, r.top, r.right - r.left - 6, colour);
      if (it.key) {
        colour = it.enabled ? SHORTCUT_COLOUR : DISABLED_SHORTCUT;
        qd.moveTo(r.right - 13, r.top + 13); qd.drawString(it.key, colour);
      }
    }
    return saved;
  }

  /** MenuSelect: press on a title, drag, release on an item. Returns {menu,item} or null. */
  async select(pt) {
    const ui = this.ui, qd = ui.qd, input = ui.input;
    let open = -1, saved = null, hi = -1, result = null;
    const close = () => {
      if (open < 0) return;
      const m = this.menus[open];
      if (hi >= 0) qd.invertRect(m.items[hi].rect);
      ui.scr.restore(saved);
      qd.invertRect(m.rect);
      open = -1; hi = -1;
    };
    const track = p => {
      const t = this.menus.findIndex(m => qd.ptInRect(p, m.rect));
      if (t >= 0 && t !== open) {
        close();
        open = t; qd.invertRect(this.menus[t].rect); saved = this._drawPull(this.menus[t]);
      }
      if (open >= 0) {
        const m = this.menus[open];
        const k = m.items.findIndex(it => it.enabled && qd.ptInRect(p, it.rect));
        if (k !== hi) {
          if (hi >= 0) qd.invertRect(m.items[hi].rect);
          hi = k;
          if (hi >= 0) qd.invertRect(m.items[hi].rect);
        }
      }
    };
    track(pt);
    while (input.down) {
      track(input.mouse);
      await input.changed();
    }
    track(input.mouse);
    if (open >= 0 && hi >= 0) result = { menu: open + 1, item: hi + 1 };
    close();
    input.flush();
    return result;
  }

  /** Alt+letter shortcut or F1..F6 keyboard menu mode. */
  menuKey(key) {
    const k = String(key).toUpperCase();
    for (let m = 0; m < this.menus.length; m++) {
      const i = this.menus[m].items.findIndex(it => it.key === k && it.enabled);
      if (i >= 0) {
        const r = this.menus[m].rect; this.ui.qd.invertRect(r); this.ui.qd.invertRect(r);
        return { menu: m + 1, item: i + 1 };
      }
    }
    return null;
  }

  async keyboardMode(n) {
    const ui = this.ui, qd = ui.qd;
    let m = Math.min(n, this.menus.length) - 1, hi = -1;
    let saved = null;
    const openM = () => { qd.invertRect(this.menus[m].rect); saved = this._drawPull(this.menus[m]); hi = -1; };
    const closeM = () => { if (hi >= 0) qd.invertRect(this.menus[m].items[hi].rect); ui.scr.restore(saved); qd.invertRect(this.menus[m].rect); };
    const move = d => {
      const items = this.menus[m].items;
      for (let k = hi + d; k >= 0 && k < items.length; k += d) if (items[k].enabled) {
        if (hi >= 0) qd.invertRect(items[hi].rect);
        hi = k; qd.invertRect(items[hi].rect); return;
      }
    };
    openM();
    for (;;) {
      const e = await ui.input.nextEvent();
      if (e.type !== 'keydown') continue;
      if (e.key === 'ArrowLeft' && m > 0) { closeM(); m--; openM(); }
      else if (e.key === 'ArrowRight' && m < this.menus.length - 1) { closeM(); m++; openM(); }
      else if (e.key === 'ArrowUp') move(-1);
      else if (e.key === 'ArrowDown') move(1);
      else if (e.key === 'Enter') { const r = hi >= 0 ? { menu: m + 1, item: hi + 1 } : null; closeM(); return r; }
      else if (e.key === 'Escape') { closeM(); return null; }
    }
  }

  /** Adds a menu defined in code (modern additions): items = [{text, action}] */
  addMenu(title, items) {
    this.menus.push({ title, items: items.map(it => ({ text: ' ' + it.text, key: it.key || null, enabled: true, checked: false, action: it.action })) });
    this.layout();
  }

  setItem(menu, item, text) { this.menus[menu - 1].items[item - 1].text = ' ' + text; }
  checkItem(menu, item, on) { const it = this.menus[menu - 1].items[item - 1]; if (it) it.checked = on; }
}
