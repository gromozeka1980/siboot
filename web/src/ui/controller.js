// Main input loop: port of TakeInput / DrawBkSp / DrawDoCncl / BackSpWord / EndSntc / DoCommand
// from the DOS main program (_ref/dos_src/Main.pas).

import { rect } from '../platform/screen.js';
import { Pat } from './qd.js';
import { ObjectB2, BEG_DELAY, INT_DELAY, EXP_DELAY } from '../engine/constants.js';
import { recallToday, charDisp, dossier, aboutBox } from './screens.js';

export class Controller {
  constructor(game, ui, menus, persistence) {
    this.g = game; this.ui = ui; this.menus = menus; this.persist = persistence;
  }
  get s() { return this.g.s; }

  drawBkSp() {
    const { qd, R } = this.ui;
    qd.fillRect(R.BkSpRect, Pat.white); qd.frameRect(R.BkSpRect);
    const T = k => this.ui.i18n.t(k), cx = s => 116 - (qd.stringWidth(s) >> 1);
    if (!this.ui.i18n.active) { qd.moveTo(101, 37); qd.drawString('Back'); qd.moveTo(98, 49); qd.drawString('Space'); return; }
    qd.moveTo(cx(T('btn.back1')), 37); qd.drawString(T('btn.back1'));
    qd.moveTo(cx(T('btn.back2')), 49); qd.drawString(T('btn.back2'));
  }

  drawDoCncl() {
    const { qd, R } = this.ui;
    qd.fillRect(R.DoItRect, Pat.white); qd.frameRect(R.DoItRect);
    qd.moveTo(this.ui.i18n.active ? 116 - (qd.stringWidth(this.ui.i18n.t('btn.doit')) >> 1) : 101, 82); qd.drawString(this.ui.i18n.t('btn.doit'));
    qd.fillRect(R.CnclRect, Pat.white); qd.frameRect(R.CnclRect);
    qd.moveTo(this.ui.i18n.active ? 116 - (qd.stringWidth(this.ui.i18n.t('btn.cancel')) >> 1) : 94, 120); qd.drawString(this.ui.i18n.t('btn.cancel'));
  }

  /** Draws the word column for the current IconID list (AddIcon in NewWordSet). */
  drawIcons() {
    const s = this.s, ui = this.ui;
    ui.fillArea('WordRect');
    if (s.iconCount <= 1 && s.sntcIndx === 0) return; // forced subject is not drawn
    for (let i = 1; i <= s.iconCount; i++) {
      const [x, y] = iconPos(i);
      ui.drawWordIcon(s.iconID[i], x, y);
    }
  }

  /** Redraw after a word was placed / removed. */
  drawSentenceArea() {
    const s = this.s, ui = this.ui;
    ui.cleanOutRect('PlayRect');
    ui.plotSntc(s.player, 236, 36, s.sntcIndx !== ObjectB2);
    this.drawBkSp();
    if (s.sntcIndx === 1) ui.grayRect(ui.R.BkSpRect);
    if (s.sntcIndx === ObjectB2) { ui.fillArea('WordRect'); this.drawDoCncl(); }
  }

  newSentence() { // EndSntc
    const ui = this.ui;
    ui.cleanOutRect('PlayRect');
    ui.fillArea('ComdRect');
    this.g.endSntc();
    this.drawIcons();
  }

  async pickWord(i) {
    const s = this.s, ui = this.ui;
    const [x, y] = iconPos(i);
    const w = Math.abs(s.iconID[i]);
    ui.drawWordText(w, x, y);
    await ui.input.waitRelease();
    ui.drawWordIcon(w, x, y);
    if (s.iconCount !== 1 && !ui.qd.ptInRect(ui.input.mouse, rect(x, y, x + 32, y + 32))) return;
    this.g.chooseWord(w);
    this.drawIcons();
    this.drawSentenceArea();
  }

  async button(r) {
    const qd = this.ui.qd;
    qd.invertRect(r); await this.ui.input.waitRelease(); qd.invertRect(r);
    return qd.ptInRect(this.ui.input.mouse, r);
  }

  async run() {
    const s = this.s, ui = this.ui, R = ui.R;
    while (!this.g.quit) {
      // IconCount=1 means the only possible word is picked automatically
      if (s.iconCount === 1 && s.sntcIndx !== ObjectB2) { await this.autoPick(); continue; }
      const e = await ui.input.nextEvent();
      if (e.type === 'keydown') {
        if (e.alt || e.ctrl) { // physical key, so Alt+letter works with any keyboard layout
          const key = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : e.key;
          const cmd = this.menus.menuKey(key); if (cmd) await this.doCommand(cmd);
        }
        continue;
      }
      if (e.type !== 'mousedown') continue;
      const pt = { x: e.x, y: e.y };
      if (this.menus.inMenuBar(pt)) { const cmd = await this.menus.select(pt); if (cmd) await this.doCommand(cmd); continue; }
      if (s.sntcIndx > 1 && ui.qd.ptInRect(pt, R.BkSpRect)) {
        if (await this.button(R.BkSpRect)) {
          this.g.backSpace();
          ui.cleanOutRect('PlayRect');
          ui.plotSntc(s.player, 236, 36, true);
          if (s.sntcIndx === 1) ui.grayRect(R.BkSpRect);
          this.drawIcons();
          ui.fillArea('DoItRect'); ui.fillArea('CnclRect');
        }
        continue;
      }
      if (s.sntcIndx === ObjectB2) {
        if (ui.qd.ptInRect(pt, R.DoItRect)) {
          if (await this.button(R.DoItRect)) { await this.g.execMove(); if (this.g.quit) return; this.newSentence(); }
          continue;
        }
        if (ui.qd.ptInRect(pt, R.CnclRect)) { if (await this.button(R.CnclRect)) this.newSentence(); continue; }
      } else {
        let hit = false;
        for (let i = 1; i <= s.iconCount && !hit; i++) {
          const [x, y] = iconPos(i);
          if (ui.qd.ptInRect(pt, rect(x, y, x + 32, y + 32))) { hit = true; await this.pickWord(i); }
        }
        if (hit) continue;
      }
      await ui.myTranslate(pt);
    }
  }

  async autoPick() {
    const s = this.s;
    this.g.chooseWord(Math.abs(s.iconID[1]));
    this.drawIcons();
    this.drawSentenceArea();
  }

  async doCommand({ menu, item }) {
    const s = this.s, ui = this.ui;
    const extra = this.menus.menus[menu - 1]?.items[item - 1]?.action;
    if (extra) { await extra(); return; }
    switch (menu) {
      case 1: await aboutBox(ui); break;
      case 2:
        if (item === 1 && await this.persist.load(this.g)) this.redrawAfterLoad();
        if (item === 2) await this.persist.save(this.g);
        if (item === 3 && await this.menus.quitDialog()) this.g.quit = true;
        break;
      case 3:
        if (item === 1) { s.narratOn = !s.narratOn; this.menus.setItem(3, 1, ui.i18n.t(s.narratOn ? 'menu.narrateOff' : 'menu.narrateOn')); }
        if (item >= 2 && item <= 4) {
          const cur = s.storyDelay === EXP_DELAY ? 4 : s.storyDelay === INT_DELAY ? 3 : 2;
          s.storyDelay = [0, 0, BEG_DELAY, INT_DELAY, EXP_DELAY][item];
          this.menus.checkItem(3, cur, false); this.menus.checkItem(3, item, true);
        }
        break;
      case 4: if (item === 1) await charDisp(ui); else await dossier(ui, item - 1); break;
      case 5: await recallToday(ui); break;
    }
  }

  redrawAfterLoad() {
    const s = this.s, ui = this.ui;
    ui.redrawMainScreen();
    ui.plotSntc(s.player, 236, 36, s.sntcIndx !== ObjectB2);
    ui.statDisp();
    this.drawIcons();
    this.drawBkSp();
    if (s.sntcIndx === 1) ui.grayRect(ui.R.BkSpRect);
    if (s.sntcIndx === ObjectB2) { ui.fillArea('WordRect'); this.drawDoCncl(); }
  }
}

export const iconPos = i => [40 * Math.floor((i - 1) / 8) + 4, 39 * ((i - 1) % 8) + 26];
