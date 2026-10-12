// Full-screen views opened from the menus: port of Banana.p parts of the DOS main segment
// (RecallToday, CharDisp, Dossier, DoAboutSiboot). Reconstruction: _ref/dos_src/Main.pas.

import { rect } from '../platform/screen.js';
import { Pat } from './qd.js';
import { SubjectA, VerbA, ObjectA1, SNTC_LENG, W } from '../engine/constants.js';

/** Common frame: save screen/TransList, run body, OK button, restore. */
async function subScreen(ui, body, { whiteAll = false } = {}) {
  const s = ui.s;
  const saveBG = s.barGraphFlag; s.barGraphFlag = false;
  const saveTrans = ui.saveTrans(); ui.transList = [];
  const saveOK = ui.R.OKRect; ui.R.OKRect = rect(2, 161, 62, 191);
  const saved = ui.saveScreen();
  if (whiteAll) ui.qd.fillRect(rect(0, 0, 639, 479), Pat.white);
  else ui.qd.fillRect(rect(0, 20, 512, 342), ui.diurnal());
  await body();
  await ui.waitForOK();
  ui.R.OKRect = saveOK;
  ui.restoreTrans(saveTrans);
  s.barGraphFlag = saveBG;
  if (whiteAll) { ui.qd.fillRect(rect(0, 0, 639, 479), Pat.white); ui.restorePalette(); }
  ui.restoreScreen(saved);
}

export async function recallToday(ui) {
  const s = ui.s, P = s.player, N = s.numChars;
  await subScreen(ui, async () => {
    const Z = s.sentence[0];
    const row = (y, subj, verb, obj, list) => {
      for (let j = 1; j <= SNTC_LENG; j++) Z[j] = 0;
      Z[SubjectA] = subj; Z[VerbA] = verb; Z[ObjectA1] = obj;
      ui.plotSntc(0, 80, y, false);
      let x = 240, nobody = true;
      for (let i = 2; i <= N; i++) if (list[i]) { nobody = false; ui.plotWord(i, x, y); x += 40; }
      if (nobody) ui.plotWord(W.Nobody, x, y);
    };
    const flags = f => Array.from({ length: N + 1 }, (_, i) => i >= 1 && f(i));
    row(40, P, W.NBetray, W.Who, flags(i => s.nBetray[P][i][s.day]));
    row(90, P, W.NAttack, W.Who, flags(i => s.nAttack[P][i]));
    const betrayed = Array(N + 1).fill(false);
    for (const e of s.hist) if (e.wrd1 === P && e.date === s.day) betrayed[e.wrd3] = true;
    row(140, P, W.Betray, W.Who, betrayed);
    row(190, W.Who, W.NBetray, P, flags(i => s.nBetray[i][P][s.day]));
    row(240, W.Who, W.NAttack, P, flags(i => s.nAttack[i][P]));
    const betrayers = Array(N + 1).fill(false);
    for (const e of s.hist) if (e.wrd3 === P && e.know[P]) betrayers[e.wrd1] = true;
    row(290, W.Who, W.Betray, P, betrayers);
  });
}

export async function charDisp(ui) {
  const s = ui.s, P = s.player;
  await subScreen(ui, async () => {
    for (let i = 1; i <= s.numChars; i++) {
      let x = 80; const y = 40 * i;
      ui.plotWord(i, x, y);
      x += 40;
      const loc = s.charLocn[i];
      if (loc < 0) { ui.plotWord(W.Wait, x, y); x += 32; ui.plotWord(56 - loc, x, y); }
      if (loc > 0) ui.plotWord(loc + 56, x, y);
      if (loc === 0 && i !== P) {
        ui.plotWord(W.Go, x, y); x += 32;
        if (s.sentence[i][VerbA] === W.Go) ui.plotWord(s.sentence[i][ObjectA1], x, y);
      }
      x = 80 + 132;
      for (let j = 1; j <= 3; j++) {
        x += 39; ui.plotWord(s.auraCnt[j][i][P] + 104, x, y);
        x += 32; ui.plotWord(65 + j, x, y);
      }
    }
  });
}

/** The dossier's last paragraph: whom `who` loves, likes, is neutral about, dislikes, hates (from the current love values). */
export function loveSummaryText(i18n, g, who) {
  const s = g.s;
  if (!(who > 1 && who < 8)) return '';
  const groups = [null, [], [], [], [], []];
  for (let j = 1; j <= s.numChars; j++) if (j !== who) {
    const x = s.love[who][j];
    let y = 1;
    if (x < 40) y = 2;
    if (x < 16) y = 3;
    if (x < -16) y = 4;
    if (x < -40) y = 5;
    groups[y].push(j);
  }
  if (i18n.active) { const ls = i18n.loveSummary(who, groups, g); if (ls != null) return ls; }
  let loveStr = '';
  const verbs = [null, ' loves ', ' likes ', ' is neutral about ', ' dislikes ', ' hates '];
  for (let i = 1; i <= 5; i++) {
    const gr = groups[i].map(j => g.charName(j));
    if (!gr.length) continue;
    loveStr += g.charName(who) + verbs[i];
    if (gr.length === 1) loveStr += gr[0] + '.  ';
    else if (gr.length === 2) loveStr += gr[0] + '&' + gr[1] + '.  '; // DOS literally joins with '&'
    else loveStr += gr.slice(0, -1).join(', ') + ', and ' + gr[gr.length - 1] + '.  ';
  }
  return loveStr;
}

export async function dossier(ui, who) {
  const s = ui.s, g = ui.g, qd = ui.qd;
  await subScreen(ui, async () => {
    const loveStr = loveSummaryText(ui.i18n, g, who);
    ui.drawFace(who, 176, 28);
    const name = ui.i18n.name(who, 'nom', g);
    qd.moveTo(256 - (qd.stringWidth(name) >> 1), 210); qd.drawString(name);
    // original: buffer pre-filled with blanks; break at the last blank before StartI+75
    // the love summary is stored from index Count+1, so the blank-filled slot at Count stays
    const text = ui.dossierFile(who).slice(0, 1024) + ' ' + loveStr;
    const count = text.length - 1;
    const buf = i => (i < count ? text[i] : ' ');
    let start = 0, line = 1, end = false;
    do {
      let e = start + 75;
      if (e >= count) { end = true; e = count + 1; }
      do e--; while (buf(e) !== ' ' && e > start);
      let str = '';
      for (let j = start; j <= e; j++) str += buf(j);
      qd.moveTo(40, 218 + 14 * line);
      qd.drawString(str);
      start = e + 1; line++;
    } while (!end);
  }, { whiteAll: true });
}

export async function aboutBox(ui) {
  const qd = ui.qd, box = rect(100, 100, 412, 220);
  const saved = ui.scr.save(rect(100, 100, 413, 221));
  qd.fillRect(box, Pat.white); qd.frameRect(box);
  const lines = [1, 2, 3, 4, 5].map(i => ui.i18n.t('about.' + i));
  lines.forEach((t, i) => { qd.moveTo(box.left + 160 - (qd.stringWidth(t) >> 1), box.top + 20 * (i + 1)); qd.drawString(t); });
  await ui.input.waitButton();
  ui.scr.restore(saved);
  await ui.input.waitRelease();
  ui.input.flush();
}
