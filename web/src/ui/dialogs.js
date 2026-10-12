// Dialogs defined in *.DIA files (port of DOS OVL_3CD). Spec: _ref/dos_src/UI.notes.md §6.
// WINDOW x1,y1,x2,y2 is absolute; each item's AREA is relative to the window's top-left.

import { rect } from '../platform/screen.js';
import { Pat } from './qd.js';

const KINDS = { fldbutton: 1, fldend: 2, fldempty: 3, fldclicktext: 4, fldradio: 5, fldtext: 6, fldfatbutton: 7, fldtxtentry: 8, fldlefttext: 9 };
const TEXT_HEIGHT = 8; // BGI Small TextHeight (UI.notes open question: 8 or 6)

export function parseDialog(text) {
  const d = { win: null, items: [] };
  let cur = null;
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(\w+)\s*=?\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    const nums = () => val.split(',').map(v => parseInt(v, 10));
    if (key === 'window') { const [l, t, r, b] = nums(); d.win = rect(l, t, r, b); continue; }
    if (key === 'id') { cur = { id: parseInt(val, 10), kind: 3, area: rect(0, 0, 0, 0), title: '', value: 0, exit: false, visible: true, linked: [] }; d.items.push(cur); continue; }
    if (!cur) continue;
    if (key === 'kind') cur.kind = KINDS[val.toLowerCase()] || 3;
    else if (key === 'area') { const [l, t, r, b] = nums(); cur.area = rect(l, t, r, b); }
    else if (key === 'title') cur.title = val.replace(/^"|"$/g, '');
    else if (key === 'exit') cur.exit = /true/i.test(val);
    else if (key === 'value') cur.value = parseInt(val, 10) || 0;
    else if (key === 'visible') cur.visible = !/false/i.test(val);
    else if (key === 'linked') cur.linked = nums().filter(n => n > 0);
  }
  return d;
}

const inset = (r, dx, dy = dx) => rect(r.left + dx, r.top + dy, r.right - dx, r.bottom - dy);

export class DialogRunner {
  constructor(ui) { this.ui = ui; }

  _leftText(r, s) {
    const qd = this.ui.qd;
    while (s.length && qd.stringWidth(s) > r.right - r.left) s = s.slice(0, -1);
    const dy = Math.trunc(((r.bottom - r.top) - TEXT_HEIGHT) / 2) - 2;
    qd.moveTo(r.left, r.top + dy + 13);
    qd.drawString(s);
  }

  _centeredText(r, s) {
    const qd = this.ui.qd;
    qd.fillRect(r, Pat.white);
    let w = qd.stringWidth(s);
    while (s.length && !(w < Math.abs(r.right - r.left))) { s = s.slice(0, -1); w = qd.stringWidth(s); }
    this._leftText(rect(r.left + Math.trunc((Math.abs(r.right - r.left) - w) / 2), r.top, r.right, r.bottom), s);
  }

  _draw(d) {
    const qd = this.ui.qd, W = d.win;
    qd.fillRect(W, Pat.white);
    qd.frameRect(inset(W, 3)); qd.frameRect(inset(W, 1)); qd.frameRect(W);
    for (const it of d.items) {
      if (!it.visible) continue;
      const A = rect(it.area.left + W.left, it.area.top + W.top, it.area.right + W.left, it.area.bottom + W.top);
      it.abs = A;
      switch (it.kind) {
        case 1: qd.frameRect(inset(A, -1)); qd.frameRect(A); this._centeredText(inset(A, 1), it.title); if (it.value) qd.invertRect(inset(A, 1)); break;
        case 7: qd.frameRect(inset(A, -1)); qd.frameRect(A); qd.frameRect(inset(A, 1)); this._centeredText(inset(A, 2), it.title); if (it.value) qd.invertRect(inset(A, 1)); break;
        case 6: this._centeredText(A, it.title); break;
        case 9: this._leftText(A, it.title); break;
        case 4: this._leftText(rect(A.left + 1, A.top, A.right + 1, A.bottom), it.title); break;
        case 8: qd.frameRect(A); this._leftText(inset(A, 3, 1), it.title); break;
        case 5: {
          const h = A.bottom - A.top, box = rect(A.left, A.top, A.left + h, A.top + h);
          qd.frameRect(inset(box, 3)); if (it.value) qd.invertRect(inset(box, 4));
          this._leftText(rect(A.left + h, A.top, A.right, A.bottom), it.title);
          break;
        }
      }
    }
  }

  /** Runs the dialog; returns the id of the item that ended it (0 = Esc). */
  async run(text) {
    const ui = this.ui, qd = ui.qd, d = parseDialog(text);
    const saved = ui.scr.save(rect(d.win.left, d.win.top, d.win.right + 1, d.win.bottom + 1));
    this._draw(d);
    let result = 0;
    for (;;) {
      const e = await ui.input.nextEvent();
      if (e.type === 'keydown') {
        if (e.key === 'Enter') {
          const it = d.items.find(i => i.exit && i.visible);
          if (it) { qd.invertRect(inset(it.abs, 1)); await ui.input.wait(10, false); result = it.id; break; }
        }
        if (e.key === 'Escape') { result = 0; break; }
        continue;
      }
      if (e.type !== 'mousedown') continue;
      const it = d.items.find(i => i.visible && [1, 4, 5, 7].includes(i.kind) && i.abs && qd.ptInRect(e, i.abs));
      if (!it) continue;
      const r = it.kind === 5 ? inset(rect(it.abs.left, it.abs.top, it.abs.left + (it.abs.bottom - it.abs.top), it.abs.bottom), 4) : inset(it.abs, 1);
      qd.invertRect(r);
      await ui.input.waitRelease();
      if (!qd.ptInRect(ui.input.mouse, it.abs)) { qd.invertRect(r); continue; }
      it.value = 1;
      if (it.exit) { result = it.id; break; }
    }
    ui.scr.restore(saved);
    ui.input.flush();
    return result;
  }
}
