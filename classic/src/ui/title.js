// Startup: logo (TitleZ.Titles) and the OPTIONS screen (TitleZ.MakeOptions).
// Reconstruction: _ref/dos_src/TitleZ.pas.

import { rect } from '../platform/screen.js';
import { Pat } from './qd.js';

const FONT_HEIGHT = 13;

export async function showTitle(ui) {
  const logo = ui.assets.logo;
  ui.scr.setPalette(ui.assets.palettes.logo);
  ui.scr.blit(logo, 64, 130);
  await ui.input.wait(150, false); // DOS: busy loops + loading of word icons
}

function labelRect(ui, r, str, border) {
  const qd = ui.qd;
  qd.fillRect(rect(r.left - 1, r.top - 1, r.right + 1, r.bottom + 1), Pat.white);
  const cx = ((r.right - r.left) >> 1) + r.left;
  qd.moveTo(cx - (qd.stringWidth(str) >> 1), (r.top >> 1) + (r.bottom >> 1) + (FONT_HEIGHT >> 1));
  qd.drawString(str);
  if (border) { // BGI ThickWidth(3) Rectangle: four 3-px lines, outer corner pixels stay empty
    const s = ui.scr, { left: l, top: t, right: rr, bottom: b } = r;
    s.fill(rect(l, t - 1, rr + 1, t + 2), 15); s.fill(rect(l, b - 1, rr + 1, b + 2), 15);
    s.fill(rect(l - 1, t, l + 2, b + 1), 15); s.fill(rect(rr - 1, t, rr + 2, b + 1), 15);
  } else qd.frameRect(r);
}

/** Returns {level, gameLeng, expert}. */
export async function makeOptions(ui) {
  const qd = ui.qd, input = ui.input;
  ui.scr.setPalette(ui.assets.palettes.main);
  qd.fillRect(rect(0, 0, 639, 479), Pat.white);
  const opt = rect(63, 30, 575, 372);
  qd.frameRect(opt);
  const X0 = opt.left + 10, Y0 = opt.top + 10;
  const center = (t, y) => { qd.moveTo(opt.left + ((opt.right - opt.left) >> 1) - (qd.stringWidth(t) >> 1), y); qd.drawString(t); };
  center('OPTIONS', Y0 + 10);
  qd.moveTo(X0 + 95, Y0 + 40); qd.drawString('Difficulty Level');
  qd.moveTo(X0 + 286, Y0 + 40); qd.drawString('Length of Game');
  const levl = [null, rect(X0 + 106, Y0 + 50, X0 + 186, Y0 + 80), rect(X0 + 106, Y0 + 100, X0 + 186, Y0 + 130), rect(X0 + 106, Y0 + 150, X0 + 186, Y0 + 180)];
  const leng = [null, rect(X0 + 296, Y0 + 50, X0 + 376, Y0 + 80), rect(X0 + 296, Y0 + 100, X0 + 376, Y0 + 130), rect(X0 + 296, Y0 + 150, X0 + 376, Y0 + 180)];
  const proceed = rect(X0 + 201, Y0 + 295, X0 + 281, Y0 + 325);
  const lengStr = [null, 'Short', 'Medium', 'Long'], levlStr = [null, 'Easy', 'Medium', 'Hard'];
  let level = 1, gameLeng = 1;
  for (let i = 1; i <= 3; i++) labelRect(ui, leng[i], lengStr[i], i === 1);
  for (let i = 1; i <= 3; i++) labelRect(ui, levl[i], levlStr[i], i === 1);
  labelRect(ui, proceed, 'Proceed', false);
  center('WARNING!', Y0 + 220);
  center('Persons who play this game', Y0 + 235);
  center('without reading the rules and the novella', Y0 + 250);
  center('are wasting their time!', Y0 + 265);

  for (;;) {
    const e = await input.nextEvent();
    if (e.type === 'keydown' && e.key === 'Enter') {
      qd.invertRect(proceed); await input.wait(10, false); qd.invertRect(proceed);
      return { level, gameLeng, expert: true };
    }
    if (e.type !== 'mousedown') continue;
    for (let i = 1; i <= 3; i++) if (qd.ptInRect(e, levl[i]) && await ui.rectHit(levl[i])) {
      labelRect(ui, levl[level], levlStr[level], false); level = i; labelRect(ui, levl[level], levlStr[level], true);
    }
    for (let i = 1; i <= 3; i++) if (qd.ptInRect(e, leng[i]) && await ui.rectHit(leng[i])) {
      labelRect(ui, leng[gameLeng], lengStr[gameLeng], false); gameLeng = i; labelRect(ui, leng[gameLeng], lengStr[gameLeng], true);
    }
    if (qd.ptInRect(e, proceed) && await ui.rectHit(proceed)) {
      const load = rect(240, 200, 380, 280);
      qd.fillRect(load, Pat.white); qd.frameRect(load);
      qd.moveTo(319 - (qd.stringWidth('Loading....  ') >> 1), 235); qd.drawString('Loading....  ');
      return { level, gameLeng, expert: e.shift }; // shift-click = no narration (FIX #9 keeps it)
    }
  }
}
