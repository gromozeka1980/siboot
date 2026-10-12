// Night combat: port of the DOS overlay OVL_3BD (_ref/dos_src/Combat.pas, Combat.notes.md).
// Logic is line-by-line; drawing follows the DOS screen (not the Mac one).
// Colour indices as in DOS: 15 = FillRect(black) background, 0 = aura ink.

import { SNTC_LENG, DAWN, SubjectA, VerbA, ObjectA1 } from './constants.js';
import { div } from './rng.js';
import { Pat } from '../ui/qd.js';
import { rect } from '../platform/screen.js';

// ---- timings (DOS used CPU busy loops / 72.84 Hz ticks; ui ticks are 1/60 s) ----
const START_DELAY_MS = 10;    // FOR i:=1 TO 6000 DO ;
const LOSER_PAUSE_MS = 800;   // FOR i:=1 TO 30000 DO FOR j:=1 TO 10 ...
const CIRCLE_STEP_MS = 25;    // FOR i:=1 TO 13000 ... before each erasing circle (30 steps)
const BLINK_TICKS = 8;        // MyWait(10) = 137 ms
const SPIN_TICKS = 99;        // SpinWheel(120) = 1.65 s

const FULL = rect(0, 0, 639, 479);  // thePort^.portRect / ScreenRect (qd fills are inclusive)
const FirstX = 194, FirstY = 156, SecondX = 314, LeftX = 134;
const WIN_FONT = 'rmn6_19';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Midnight's local FigMerit is never initialised in DOS and PickAura sometimes leaves it
// untouched, so the previous value carries over (first value = stack garbage; here 0).
let figMerit = 0;

/** PickAura(who1, who2, VAR Figger) -> [pick, figger]. figger = incoming value if unassigned. */
export function pickAura(g, who1, who2, figger) {
  const s = g.s, A = s.auraCnt;
  const A1 = A[1][who1][0], A2 = A[2][who1][0], A3 = A[3][who1][0];
  let B1 = A[1][who2][who1], B2 = A[2][who2][who1], B3 = A[3][who2][who1];
  let High = B1, x, Low, result;
  if (B2 > High) High = B2;
  if (B3 > High) High = B3;
  if (High === -1) High = 1;
  if (B1 === -1) B1 = High;
  if (B2 === -1) B2 = High;
  if (B3 === -1) B3 = High;

  switch (s.level) {
    case 1: case 2: {
      x = 0; Low = A1;
      if (A3 > 0) x = 3;
      if (A2 < Low && A1 > 0) { Low = A2; x = 1; }
      if (A2 === Low && A3 < A1) { Low = A2; x = 1; }
      if (A3 < Low && A2 > 0) { Low = A3; x = 2; }
      if (A3 === Low && A1 < A2) { Low = A3; x = 2; }
      if (x === 0) { if (A2 > 0) x = 2; if (A1 > 0) x = 1; }
      result = x;
      const MyPick = x;
      x = 3; Low = B1;
      if (B2 < Low && B1 > 0) { Low = B2; x = 1; }
      if (B2 === Low && B3 < B1) { Low = B2; x = 1; }
      if (B3 < Low && B2 > 0) { Low = B3; x = 2; }
      if (B3 === Low && B1 < B2) { Low = B3; x = 2; }
      // (DOS/Mac dead code: IF x=0 ... x is never 0 here)
      switch (MyPick - x) { // -3 -> Figger not assigned
        case -2: figger = -64; break;
        case -1: figger = 16; break;
        case 0: figger = 0; break;
        case 1: figger = -64; break;
        case 2: figger = 16; break;
      }
      break;
    }
    case 3: {
      const Fig1 = A1 > 0 ? (A3 > 0 ? div(8 * B2 * A1 * A3, A1 * A3) - div(8 * B3 * A2 * A3, A1 * A1) : -999) : -2000;
      const Fig2 = A2 > 0 ? (A1 > 0 ? div(8 * B3 * A2 * A1, A2 * A1) - div(8 * B1 * A3 * A1, A2 * A2) : -999) : -2000;
      const Fig3 = A3 > 0 ? (A2 > 0 ? div(8 * B1 * A3 * A2, A3 * A2) - div(8 * B2 * A1 * A2, A3 * A3) : -999) : -2000;
      do x = Math.abs(div(g.random(), 8192)); while (!(x > 0 && x < 4));
      if (x === 1) figger = Fig1;
      if (x === 2) figger = Fig2;
      if (x === 3) figger = Fig3;
      if (Fig1 > figger) { figger = Fig1; x = 1; }
      if (Fig2 > figger) { figger = Fig2; x = 2; }
      if (Fig3 > figger) { figger = Fig3; x = 3; }
      result = x;
      break;
    }
  }
  return [result, figger];
}

/** MakeAura: outline in `color`, then BGI flood fill (DOS; always called with color 0). */
function makeAura(g, which, X, Y, color) {
  const ui = g.ui;
  let px, py;
  const moveTo = (x, y) => { px = x; py = y; };
  const lineRel = (...d) => {
    for (let i = 0; i < d.length; i += 2) { ui.scr.line(px, py, px + d[i], py + d[i + 1], color); px += d[i]; py += d[i + 1]; }
  };
  switch (which) {
    case 1: // tanaga
      if (color === 15) ui.floodFill(X - 17, Y + 2, 15, 15); // dead in DOS
      moveTo(X - 20, Y);
      lineRel(9, 0, 21, -21, 0, 38, 8, 6, -15, 0, 0, -25, -9, 9, 0, 7, -14, -14);
      if (color === 0) { ui.floodFill(X + 6, Y + 20, color, color); ui.floodFill(X - 17, Y + 2, color, color); }
      break;
    case 2: // katsin
      moveTo(X - 19, Y + 2);
      lineRel(0, -5, 15, 0, -9, -9, 0, -4, 4, 0, 9, 9, 0, -15, 5, 0, 0, 15, 9, -9, 4, 0, 0, 4,
        -9, 9, 15, 0, 0, 5, -15, 0, 9, 9, 0, 4, -4, 0, -9, -9, 0, 15, -5, 0, 0, -15,
        -9, 9, -4, 0, 0, -4, 9, -9, -15, 0);
      ui.floodFill(X, Y, color, color);
      break;
    case 3: // shial: DOS FrameOval uses full rect width as radius -> r = 24, 20, 6
      ui.circle(X, Y, 24, color); ui.circle(X, Y, 20, color); ui.circle(X, Y, 6, color);
      ui.floodFill(X, Y, color, color);
      ui.floodFill(X - 22, Y, color, color);
      ui.floodFill(X + 22, Y, color, color);
      break;
  }
}

async function combatGraphic(g, who1, who2, firstAura, secondAura) {
  const ui = g.ui, s = g.s;
  ui.qd.fillRect(FULL, Pat.black);
  let firstWins = true, secondWins = true;
  if (firstAura !== secondAura) {
    firstWins = (firstAura === 1 && secondAura === 2) || (firstAura === 2 && secondAura === 3) ||
      (firstAura === 3 && secondAura === 1);
    secondWins = !firstWins;
  }
  ui.plotWord(who1, 55, 145);
  ui.plotWord(who2, 426, 145);
  makeAura(g, firstAura, FirstX, FirstY, 0);
  makeAura(g, secondAura, SecondX, FirstY, 0);
  // (DOS: GetImage snapshots never used; the Mac grow/invert loop is empty and draws nothing; no sound)
  await sleep(START_DELAY_MS);
  if (s.storyDelay !== 0 && !(firstWins && secondWins)) {
    await sleep(LOSER_PAUSE_MS);
    const lx = firstWins ? SecondX : FirstX; // loser's aura erased by growing circles
    for (let k = 1; k <= 30; k++) { await sleep(CIRCLE_STEP_MS); ui.circle(lx, FirstY, k, 15); }
  }
  await ui.spinWheel(SPIN_TICKS);
  ui.qd.fillRect(FULL, Pat.black);
}

export function victory(g, winner, loser, lost) {
  const s = g.s, A = s.auraCnt, P = s.player;
  let x = A[lost][loser][0] - 1;
  if (x < 0) x = 0;
  A[lost][loser][0] = x;
  A[lost][loser][loser] = x;
  if (A[lost][loser][winner] >= 0) A[lost][loser][winner] = x;
  if (x > 0) {
    x = A[lost][winner][0] + 1;
    if (x > 8) x = 8;
    A[lost][winner][0] = x;
    A[lost][winner][winner] = x;
    if (A[lost][winner][loser] >= 0) A[lost][winner][loser] = x;
  }
  const sp = s.storyParm;
  if (loser === P && sp[40] > 0) sp[40] = 8;
  if (winner === P && sp[40] > 0) sp[40] = 1024;
  if (loser === P && sp[21] > 0) sp[21] = 1024;
  if (winner === P && sp[21] > 0) sp[21] = 8;
  if (loser === P && sp[22] > 0) sp[22] = 8;
  if (winner === P && sp[22] > 0) sp[22] = 1024;
}

function resolve(g, who1, who2, cast1, cast2) {
  if (cast1 === cast2) return;
  switch (cast1) {
    case 1: if (cast2 === 2) victory(g, who1, who2, 2); else victory(g, who2, who1, 1); break;
    case 2: if (cast2 === 3) victory(g, who1, who2, 3); else victory(g, who2, who1, 2); break;
    case 3: if (cast2 === 1) victory(g, who1, who2, 1); else victory(g, who2, who1, 3); break;
  }
}

async function mindCombat(g, who1, who2, cast1, cast2) {
  const s = g.s;
  resolve(g, who1, who2, cast1, cast2);
  await combatGraphic(g, who1, who2, cast1, cast2);
  if (s.nAttack[who1][who2]) {
    s.nAttackCount[who1][who2]++;
    s.trust[who2][who1] = Math.max(-127, s.trust[who2][who1] - 16);
  }
}

async function gameWin(g, whoWon) {
  g.ui.mode = 'victory';
  const ui = g.ui, qd = ui.qd;
  // ShowFaceScreen(WhoWon,197,117): clear, face palette, fill index 9, 160x160 face at (241,162)
  ui.scr.fill(rect(0, 0, 640, 480), 9);
  ui.drawFace(whoWon, 241, 162);
  const name = g.charName(whoWon);
  ui.drawText(WIN_FONT, name, 320 - div(ui.textWidth(WIN_FONT, name), 2), 147, 0);            // baseline
  ui.drawText(WIN_FONT, 'Our Shepherd', 320 - div(ui.textWidth(WIN_FONT, 'Our Shepherd'), 2), 346, 0);
  const ok = rect(290, 394, 350, 419);
  qd.fillRect(ok, Pat.white);
  qd.frameRect(ok);
  const x = div(ok.right - ok.left, 2) + ok.left - div(ui.textWidth(WIN_FONT, 'OK'), 2);
  const y = div(ok.bottom - ok.top, 2) + ok.top + div(ui.fontHeight(WIN_FONT), 2);
  ui.drawText(WIN_FONT, 'OK', x, y, 15);
  for (let okFlag = false; !okFlag;) {
    const ev = await ui.input.nextEvent();
    if (ev.type === 'keydown' && ev.key === 'Enter') {
      qd.invertRect(ok); await ui.myWait(BLINK_TICKS); qd.invertRect(ok);
      okFlag = true;
    }
    if (ev.type === 'mousedown' && qd.ptInRect(ev, ok)) {
      qd.invertRect(ok); await ui.input.waitRelease(); qd.invertRect(ok);
      okFlag = true;
    }
  }
  await ui.gameOver(whoWon); // DOS: Halt(0)
}

/** NPC who1 attacks the player: show the situation and let the player pick a defence aura. */
async function playerDefence(g, who1, who2) {
  g.ui.mode = 'defence';
  const s = g.s, ui = g.ui, qd = ui.qd, A = s.auraCnt, P = s.player;
  await ui.narrate(10, who1);
  let x = LeftX, y = 78;
  ui.plotWord(who1, x, y);
  for (let j = 1; j <= 3; j++) { x += 39; ui.plotWord(A[j][who1][P] + 104, x, y); x += 32; ui.plotWord(65 + j, x, y); }
  x = LeftX; y += 39;
  ui.plotWord(P, x, y);
  for (let j = 1; j <= 3; j++) { x += 39; ui.plotWord(A[j][P][P] + 104, x, y); x += 32; ui.plotWord(65 + j, x, y); }
  y += 39;
  const S0 = s.sentence[0];
  for (let j = 1; j <= SNTC_LENG; j++) S0[j] = 0;
  S0[SubjectA] = who1; S0[VerbA] = 56; S0[ObjectA1] = who2;
  ui.plotSntc(0, LeftX + 65, y, false);
  y += 39;
  x = LeftX + 7; ui.plotWord(P, x, y); ui.rightCnct(x, y);
  x = LeftX + 207; ui.plotWord(who1, x, y); ui.rightCnct(x - 40, y);
  x = LeftX + 67;
  const dam = [];
  for (let j = 1; j <= 3; j++) {
    if (A[j][P][P] > 0) ui.plotWord(52 + j, x, y);
    dam[j] = rect(x, y, x + 32, y + 32);
    x += 40;
  }
  let cast2 = 0, dumbFlag = false;
  do { // mouse only, no keyboard (same as DOS/Mac)
    let blinked = false;
    for (let j = 1; j <= 3; j++) {
      if (A[j][P][P] > 0) { qd.invertRect(dam[j]); await ui.myWait(BLINK_TICKS); qd.invertRect(dam[j]); blinked = true; }
      const ev = ui.input.poll();
      if (ev && ev.type === 'mousedown') {
        const pt = { x: ev.x, y: ev.y };
        for (let k = 1; k <= 3; k++)
          if (qd.ptInRect(pt, dam[k]) && A[k][P][P] > 0) {
            qd.invertRect(dam[k]); await ui.input.waitRelease(); qd.invertRect(dam[k]);
            dumbFlag = true; cast2 = k;
          }
        await ui.myTranslate(pt);
      }
    }
    // Not a fix: DOS hangs here forever if the player has no aura left; just yield to the browser.
    if (!blinked) await ui.myWait(BLINK_TICKS);
  } while (!dumbFlag);
  g.ui.mode = null;
  return cast2;
}

export async function midnight(g) {
  const s = g.s, ui = g.ui, A = s.auraCnt, P = s.player, N = s.numChars;
  // (DOS: SEG_07B6:0528/05BE state save/restore around Midnight - purpose unknown, no game effect)
  s.diurnal = 'black';
  ui.qd.fillRect(FULL, Pat.black);
  const powerArr = [], whoArr = [];
  for (let i = 1; i <= N; i++) {
    const sum = A[1][i][0] + A[2][i][0] + A[3][i][0];
    powerArr[i] = sum === 0 ? 0 : div(A[1][i][0] * A[2][i][0] * A[3][i][0], sum); // FIX #1: no division by zero
    whoArr[i] = i;
  }
  powerArr[1] = 50;
  for (let i = 1; i <= N; i++) {
    let bestVal = -1, bestIndx = 0;
    for (let j = i; j <= N; j++) if (powerArr[j] > bestVal) { bestVal = powerArr[j]; bestIndx = j; }
    let x = powerArr[i]; powerArr[i] = bestVal; powerArr[bestIndx] = x;
    x = whoArr[i]; whoArr[i] = whoArr[bestIndx]; whoArr[bestIndx] = x;
  }

  for (let i = 1; i <= N; i++) {
    ui.clearTrans(); // TransIndx:=0
    const who1 = whoArr[i];
    let who2, cast1, cast2;
    if (who1 === P) {
      who2 = s.sentence[P][ObjectA1];
      cast1 = s.sentence[P][VerbA] - 52;
      [cast2, figMerit] = pickAura(g, who2, P, figMerit);
      if (cast2 === 0) { cast2 = cast1 + 1; if (cast2 === 4) cast2 = 1; }
      await mindCombat(g, P, who2, cast1, cast2);
    } else {
      cast1 = 0;
      let bestFig = -1000;
      for (let j = 1; j <= N; j++) if (j !== who1) {
        let testCast;
        [testCast, figMerit] = pickAura(g, who1, j, figMerit);
        figMerit -= div(s.love[who1][j], 8);
        if (s.nAttack[who1][j]) figMerit -= div(s.integrity[who1], 2); // DOS: Integrity[who1]
        if (figMerit > bestFig || (figMerit === bestFig && g.random() > 0)) { // Random only on ties
          bestFig = figMerit; who2 = j; cast1 = testCast;
        }
      }
      if (cast1 > 0) {
        // FIX #12: DOS hangs forever when the defenceless player (all auras 0) is attacked;
        // with nothing to defend with and nothing left to lose, the attack is skipped.
        if (who2 === P && [1, 2, 3].every(j => s.auraCnt[j][P][P] <= 0)) continue;
        if (who2 === P) {
          cast2 = await playerDefence(g, who1, who2);
          await combatGraphic(g, who1, who2, cast1, cast2);
        } else [cast2, figMerit] = pickAura(g, who2, who1, figMerit);
        resolve(g, who1, who2, cast1, cast2);
      }
    }
  }

  const has888 = i => A[1][i][0] === 8 && A[2][i][0] === 8 && A[3][i][0] === 8;
  // FIX #11: DOS also declared the player winner if the mouse button was held here (debug cheat)
  if (has888(P)) return gameWin(g, P);
  let wonFlag = false;
  for (let i = 2; i <= N; i++) {
    wonFlag = has888(i);
    if (wonFlag) return gameWin(g, i);
  }
  if (!wonFlag && A[1][P][0] === 0 && A[2][P][0] === 0 && A[3][P][0] === 0) {
    let bestVal = 128, bestIndx = 0;
    for (let i = 2; i <= N; i++) if (s.love[i][P] < bestVal) { bestVal = s.love[i][P]; bestIndx = i; }
    return gameWin(g, bestIndx);
  }

  s.storyParm[41] = 1024;
  for (let i = 1; i <= N; i++) {
    s.sentence[i][SubjectA] = i;
    s.sentence[i][VerbA] = 51;
    for (let j = ObjectA1; j <= SNTC_LENG; j++) s.sentence[i][j] = 0;
    s.execTime[i] = DAWN + i;
    for (let k = 1; k <= 3; k++) A[k][i][i] = A[k][i][0];
    const sumAuras = A[1][i][i] + A[2][i][i] + A[3][i][i];
    if (sumAuras === 23 && s.storyParm[41] > 0 && i !== P) s.storyParm[41] = 40 + i;
  }
  g.shuffleAuraKnowledge();
  for (let i = 1; i <= N; i++) for (let j = 1; j <= N; j++) { s.nAttack[i][j] = false; s.visits[i][j] = 0; }
  s.time = DAWN;
  if (s.day < 64) s.day++;
  if (div(s.playerDeals, s.day - 1) < 4 && s.storyParm[38] === 1024) s.storyParm[38] = 8;
  ui.clearTrans();
  s.diurnal = 'white';
  ui.redrawMainScreen(); // FillRect(ScreenRect,white), DrawMenuBar, frame lines, StatDisp
}

// exposed for visual verification against the original (tools / lockstep)
export const _debug = { combatGraphic, playerDefence, gameWin, makeAura };
