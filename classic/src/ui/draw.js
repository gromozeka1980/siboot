// Drawing layer: port of the DOS Globals unit (OVL_3C6) plus image helpers (OVL_3F6).
// Reconstruction: _ref/dos_src/Globals.pas. Coordinates are DOS screen pixels.

import { rect } from '../platform/screen.js';
import { QD, Pat } from './qd.js';
import { VerbA, VerbB, ObjectA1, ObjectA2, SubjectA, SubjectB, ObjectB1, ObjectB2, SNTC_LENG, W, NIGHT } from '../engine/constants.js';
import { WORD_POS, DEAL_POS, BAR_GRAPH_LABELS, FACE_LOOKS } from '../data/characters.js';
import { div } from '../engine/rng.js';

const TRANS_LENG = 80;

export class Draw {
  constructor(screen, input, font, assets) {
    this.scr = screen;
    this.input = input;
    this.qd = new QD(screen, font);
    this.assets = assets;
    this.g = null; // set by the game
    this.transList = []; // {square, iconID}
    this.barGraphRect = [null];
    this.R = {
      WordRect: rect(0, 20, 80, 342), RoomRect: rect(230, 178, 512, 342), PlayRect: rect(230, 20, 512, 174),
      ComdRect: rect(84, 20, 146, 174), StatRect: rect(146, 20, 226, 174), FeelRect: rect(84, 178, 226, 342),
      FaceRect: rect(106, 247, 219, 342),
      BkSpRect: rect(88, 24, 144, 54), DoItRect: rect(88, 62, 144, 92), CnclRect: rect(88, 100, 144, 130),
      OKRect: rect(88, 138, 144, 168),
    };
    this.palette = assets.palette;
  }

  get s() { return this.g.s; }
  diurnal() { return Pat[this.s.diurnal || 'white']; }
  _rect(r) { return typeof r === 'string' ? this.R[r] : r; }

  // ---------------------------------------------------------------- images
  drawWordIcon(w, x, y) { const i = this.assets.wordIcon[w]; if (i) this.scr.blit(i, x, y); }
  drawWordText(w, x, y) { const i = this.assets.wordText[w]; if (i) this.scr.blit(i, x, y); }
  drawEmotion(n, x, y) { const i = this.assets.emotion[n]; if (i) this.scr.blit(i, x, y); }
  drawFace(who, x, y) {
    const f = this.assets.faces[who];
    if (!f) return;
    if (f.palette) this.scr.setPalette(f.palette);
    this.scr.blit(f.img, x, y);
  }
  restorePalette() { this.scr.setPalette(this.palette); }

  saveScreen() { return this.scr.save(rect(0, 0, 640, 480)); }
  restoreScreen(t) { this.scr.restore(t); }
  saveTrans() { return this.transList.map(t => ({ ...t })); }
  restoreTrans(t) { this.transList = t; }

  // ---------------------------------------------------------------- Globals
  async myWait(ticks) { if (ticks > 0) await this.input.wait(ticks); }
  async spinWheel(ticks) { return this.input.wait(ticks); }

  fillArea(name) { this.qd.fillRect(this.R[name], this.diurnal()); }

  async narrate(message, wordNum) {
    const s = this.s, qd = this.qd;
    if (!s.narratOn || message <= 0) return;
    const box = rect(64, 160, 500, 224);
    const saved = this.scr.save(rect(64, 160, 501, 225));
    qd.fillRect(box, Pat.white);
    qd.frameRect(box);
    let str;
    if (message <= 72) str = this.assets.strings[message] || '';
    else { str = 'Bad input message '; qd.drawString(String(message)); }
    let out = '';
    for (const ch of str) {
      if (ch === '&' || ch === '%') out += this.g.charName(wordNum);
      else if (ch === '#') out += this.g.male(wordNum) ? 'him' : 'her';
      else out += ch;
    }
    let second = null;
    if (out.length > 50) {
      let i = 53; // Pascal i:=54; REPEAT i:=i-1 UNTIL s[i]=' '  (1-based)
      while (i > 0 && out[i - 1] !== ' ') i--;
      second = out.slice(i);
      out = out.slice(0, i);
    }
    qd.moveTo(72, 180); qd.drawString(out);
    if (second !== null) { qd.moveTo(78, 195); qd.drawString(second); }
    qd.moveTo(69, 210); qd.drawString('Click mouse to continue');
    await this.input.waitButton();
    await this.input.waitRelease();
    this.scr.restore(saved);
    this.input.flush();
  }

  cleanOutRect(r) {
    r = this._rect(r);
    this.qd.fillRect(r, this.diurnal());
    this.transList = this.transList.filter(t => !this.qd.sectRect(r, t.square));
  }

  rightCnct(x, y) { this.qd.fillRect(rect(x + 32, y, x + 40, y + 31), Pat.gray); }
  downCnct(x, y) { this.qd.fillRect(rect(x - 40, y + 32, x - 9, y + 40), Pat.gray); }

  plotWord(w, x, y) {
    if (this.transList.length < TRANS_LENG) this.transList.push({ square: rect(x, y, x + 32, y + 32), iconID: w });
    this.drawWordIcon(Math.abs(w), x, y); // DOS draws negated words like normal ones
  }

  plotSntc(who, X, Y, endConnect) {
    const s = this.s, S = s.sentence[who];
    const MVerbA = S[VerbA];
    const resp = MVerbA === W.Beg || MVerbA === W.Threat;
    if (resp) for (let i = 3; i <= SNTC_LENG; i++) { S[i] = s.lastSntc[who][i]; if (who === s.player) s.canclAble[i] = false; }
    const temp = S[VerbB] >= 36 && S[VerbB] <= 38;
    const revealF = Math.abs(MVerbA) === W.Reveal && temp;
    const dealF = (MVerbA === W.Reveal && !temp) || (resp && S[VerbB] === W.Reveal);
    const wp = j => [X + WORD_POS[j][0], Y + WORD_POS[j][1]];
    const dp = j => [X + DEAL_POS[j][0], Y + DEAL_POS[j][1]];
    for (let j = 1; j <= SNTC_LENG; j++) {
      const w = S[j];
      if (!w) continue;
      if (dealF) {
        const idx = j === 6 ? 8 : j >= 7 ? j + 3 : j;
        let [x, y] = dp(idx);
        this.plotWord(w, x, y);
        switch (j) {
          case SubjectA: case VerbA: this.rightCnct(x, y); break;
          case ObjectA1: [x, y] = dp(VerbA); this.downCnct(x + 40, y); break;
          case ObjectA2: this.downCnct(x + 40, y); break;
          case SubjectB:
            [x, y] = dp(6); this.drawWordIcon(81, x - 8, y); this.plotWord(W.If, x, y);
            [x, y] = dp(7); this.drawWordIcon(81, x - 8, y); this.plotWord(S[ObjectA1], x, y); this.rightCnct(x, y);
            break;
          case VerbB:
            this.rightCnct(x, y);
            [x, y] = dp(9); this.plotWord(S[SubjectA], x, y);
            [x, y] = dp(8); this.downCnct(x + 40, y);
            break;
          case ObjectB1: this.downCnct(x + 40, y); break;
        }
      } else if (revealF) {
        let x, y;
        switch (j) {
          case SubjectA: case VerbA: [x, y] = wp(j); this.plotWord(w, x, y); this.rightCnct(x, y); break;
          case ObjectA1: [x, y] = wp(j); this.plotWord(w, x, y); this.downCnct(x, y); break;
          case SubjectB: [x, y] = wp(j - 1); this.plotWord(w, x, y); this.downCnct(x + 40, y); break;
          case VerbB: [x, y] = wp(ObjectA2); y += 40; this.plotWord(w, x, y); if (S[ObjectB1] > 0) this.downCnct(x + 40, y); break;
          case ObjectB1: [x, y] = wp(ObjectA2); y += 80; this.plotWord(w, x, y); break;
        }
      } else {
        const [x, y] = wp(j);
        this.plotWord(w, x, y);
        if (j < ObjectB2 && (S[j + 1] !== 0 || endConnect)) {
          if (j % 4 !== ObjectA1) this.rightCnct(x, y); else this.downCnct(x, y);
        }
      }
    }
  }

  drawClock(x, y, day, time) {
    const qd = this.qd;
    qd.clearRect(x - 5, y, x + 56, y + 26);
    qd.moveTo(x - 4, y + 10); qd.drawString('Day ' + day);
    qd.moveTo(x - 4, y + 24);
    let h = div(time, 60); const m = time % 60;
    const pm = h > 11;
    if (h > 12) h -= 12;
    qd.drawString(`${h}:${m < 10 ? '0' : ''}${m} ${pm ? 'PM' : 'AM'}`);
    if (this.s.time >= NIGHT) qd.frameRect(rect(x - 5, y - 1, x + 56, y + 26));
  }

  grayRect(r) { this.qd.fillRect(r, this.s.time >= NIGHT ? Pat.gray : Pat.white); }

  async rectHit(r) {
    this.qd.invertRect(r);
    await this.input.waitRelease();
    this.qd.invertRect(r);
    return this.qd.ptInRect(this.input.mouse, r);
  }

  statDisp() {
    const s = this.s, P = s.player;
    this.cleanOutRect('StatRect');
    let x = 168, y = 22;
    this.drawClock(x, y, s.day, s.time);
    y += 39; x -= 2;
    if (s.charLocn[P] < 0) {
      x -= 16; this.plotWord(W.Wait, x, y); x += 32; this.plotWord(56 - s.charLocn[P], x, y); x -= 16;
    }
    if (s.charLocn[P] > 0) this.plotWord(s.charLocn[P] + 56, x, y);
    y += 39;
    if (s.charLocn[P] > 0 && s.interloc[P] > 0) this.plotWord(s.interloc[P], x, y);
  }

  makeAFace(him, face) {
    if (him !== this.s.player) return;
    this.s.savedFace = face;
    this.qd.fillRect(this.R.FaceRect, Pat.white);
    this.drawEmotion(face, this.R.FaceRect.left, this.R.FaceRect.top);
  }

  /** Holding the mouse on an icon shows its text label; on bars/face shows a caption. */
  async myTranslate(pt = this.input.mouse) {
    const qd = this.qd, s = this.s;
    for (const t of this.transList.slice()) {
      if (!qd.ptInRect(pt, t.square)) continue;
      const x = Math.abs(t.iconID);
      this.drawWordText(x, t.square.left, t.square.top);
      if (t.iconID < 0) this.scr.blit(this.assets.wordText[52], t.square.left, t.square.top, 'or');
      await this.input.waitRelease();
      this.drawWordIcon(x, t.square.left, t.square.top);
    }
    if (!s.barGraphFlag) return;
    for (let i = 1; i <= 6; i++) {
      const b = this.barGraphRect[i];
      if (!b || !qd.ptInRect(pt, b)) continue;
      const tr = rect(b.left, b.top - 1, 226, b.bottom);
      qd.fillRect(tr, Pat.white);
      qd.moveTo(b.left, b.bottom - (i % 2));
      qd.drawString(BAR_GRAPH_LABELS[i]);
      await this.input.waitRelease();
      qd.fillRect(tr, this.diurnal());
      this.redrawBars();
      break; // DOS reuses the loop variable: the scan ends after a hit
    }
    const F = this.R.FaceRect;
    if (qd.ptInRect(pt, F) && s.interloc[s.player] > 0) {
      qd.fillRect(F, Pat.white);
      qd.moveTo(F.left + 10, F.top + 35); qd.drawString(this.g.charName(s.interloc[s.player]));
      qd.moveTo(F.left + 10, F.top + 50); qd.drawString('looks');
      qd.moveTo(F.left + 10, F.top + 65); qd.drawString(FACE_LOOKS[s.savedFace] || '');
      await this.input.waitRelease();
      this.makeAFace(s.player, s.savedFace);
    }
  }

  redrawBars() {
    for (let i = 1; i <= 6; i++) {
      const b = this.barGraphRect[i];
      if (!b) continue;
      this.qd.fillRect(b, i % 2 ? Pat.gray : Pat.black);
      this.qd.frameRect(b);
    }
  }

  drawBarGraph(who) {
    const s = this.s, P = s.player;
    this.qd.fillRect(rect(85, 182, 224, 246), this.diurnal());
    this.drawWordIcon(87, 85, 186); this.drawWordIcon(88, 85, 210); this.drawWordIcon(95, 85, 234);
    const v = [null, s.lastFear, s.fear[who][P], s.lastTrust, s.trust[who][P], s.lastLove, s.love[who][P]];
    for (let i = 1; i <= 6; i++) {
      let y = 182 + 8 * (i - 1);
      if (i > 2) y += 8;
      if (i > 4) y += 8;
      this.barGraphRect[i] = rect(96, y, 160 + div(v[i], 2), y + 8);
    }
    this.redrawBars();
  }

  async waitForOK() {
    const qd = this.qd, R = this.R;
    qd.fillRect(R.OKRect, Pat.white);
    qd.moveTo(R.OKRect.left + 22, R.OKRect.top + 21); qd.drawString('OK');
    qd.frameRect(R.OKRect);
    for (;;) {
      const e = await this.input.nextEvent();
      if (e.type === 'keydown' && e.key === 'Enter') {
        qd.invertRect(R.OKRect); await this.input.wait(10, false); qd.invertRect(R.OKRect); break;
      }
      if (e.type === 'mousedown') {
        if (qd.ptInRect(e, R.OKRect)) {
          qd.invertRect(R.OKRect); await this.input.waitRelease(); qd.invertRect(R.OKRect); break;
        }
        await this.myTranslate(e);
      }
    }
    qd.fillRect(R.OKRect, this.diurnal());
    this.input.flush();
  }

  makeBack(name) {
    this.s.diurnal = name;
    for (const r of ['WordRect', 'RoomRect', 'PlayRect', 'ComdRect', 'StatRect', 'FeelRect']) this.fillArea(r);
  }

  // ---------------------------------------------------------------- misc primitives for effects
  circle(cx, cy, r, c) { // BGI Circle (midpoint)
    let x = r, y = 0, e = 1 - r;
    while (x >= y) {
      for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) this.scr.pset(cx + a, cy + b, c);
      y++;
      if (e < 0) e += 2 * y + 1; else { x--; e += 2 * (y - x) + 1; }
    }
  }
  floodFill(x, y, c, border) {
    const st = [[x, y]], scr = this.scr;
    while (st.length) {
      const [px, py] = st.pop();
      if (px < 0 || py < 0 || px >= 640 || py >= 480) continue;
      const v = scr.pget(px, py);
      if (v === border || v === c) continue;
      scr.pset(px, py, c);
      st.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
  }

  clearTrans() { this.transList = []; }

  _font(name) { return name === 'rmn6_19' ? this.assets.font19 : this.assets.font; }
  /** Text in a named font, baseline y, transparent background. */
  drawText(fontName, s, x, y, fg) { return this._font(fontName).draw(this.scr, x, y, s, fg, null); }
  textWidth(fontName, s) { return this._font(fontName).width(s); }
  fontHeight(fontName) { return this._font(fontName).height; }

  /** Main playfield frame (InitGame / after Midnight): white screen, menu bar, separators. */
  redrawMainScreen(withStatus = true) {
    const scr = this.scr;
    this.restorePalette();
    this.qd.fillRect(rect(0, 0, 639, 479), Pat.white);
    this.transList = [];
    this.menus?.drawBar();
    for (const x of [81, 83, 227, 229]) scr.vline(x, 20, 342, 15);
    for (const y of [175, 177]) scr.hline(84, 512, y, 15);
    // gray pen: every other pixel of the middle lines
    for (let y = 21; y <= 342; y += 2) { scr.pset(82, y, 15); scr.pset(228, y, 15); } // PenPat(gray) lines
    for (let x = 85; x <= 512; x += 2) scr.pset(x, 176, 15);
    if (withStatus) this.statDisp();
  }

  async gameOver(winner) { if (this.onGameOver) await this.onGameOver(winner); }

  storyFile(n) { return this.assets.stories[n] || ''; }
  dossierFile(who) { return this.assets.dossiers[who] || ''; }
}
