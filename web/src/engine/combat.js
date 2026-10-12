// Night combat: port of the DOS overlay OVL_3BD (_ref/dos_src/Combat.pas, Combat.notes.md).
// Logic is line-by-line; the screens (combat graphic, defence prompt, victory) are drawn by the
// view (g.view; DOS version: ui/classic/view.js).

import { SNTC_LENG, DAWN, SubjectA, VerbA, ObjectA1 } from './constants.js';
import { div } from './rng.js';

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

  if (s.level === 4) return smartPick(g, who1, who2);
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

// ---- level 4 ("very hard", remake): expected value instead of Crawford's level-3 formula ----
const BEATS = { 1: 2, 2: 3, 3: 1 }, BEATER = { 1: 3, 2: 1, 3: 2 };
/** Value of an aura position for its owner: the weakest aura matters most (8/8/8 wins). */
const worth = a => 10 * Math.min(...a) + a[0] + a[1] + a[2];
/**
 * who1 picks the aura that maximises the expected worth of its own auras after the duel against who2.
 * Its guess of who2's play: the level-1/2 habit "play the aura that beats your weakest" (from what who1 knows
 * of who2's auras), blended with a uniform guess - less sure the less it knows. Returns [pick, figger]
 * with figger on the scale of the original table, so target choice in Midnight keeps working.
 */
function smartPick(g, who1, who2) {
  const A = g.s.auraCnt, mine = [1, 2, 3].map(k => A[k][who1][0]);
  const known = [1, 2, 3].map(k => A[k][who2][who1]);
  const ks = [1, 2, 3].filter(k => known[k - 1] >= 0);
  const guess = { 1: 1 / 3, 2: 1 / 3, 3: 1 / 3 };
  if (ks.length) {
    const lo = ks.reduce((a, k) => (known[k - 1] < known[a - 1] ? k : a));
    const sure = ks.length / 3 * 0.8;
    for (const k of [1, 2, 3]) guess[k] = (1 - sure) / 3 + (k === BEATER[lo] ? sure : 0);
  }
  const base = worth(mine);
  let best = 0, bestEV = -1e9;
  for (const c of [1, 2, 3]) {
    if (mine[c - 1] <= 0) continue;
    let ev = 0;
    for (const d of [1, 2, 3]) {
      const after = mine.slice();
      if (BEATS[c] === d) after[d - 1] = Math.min(8, after[d - 1] + 1);        // win: gain the loser's aura
      else if (BEATS[d] === c) after[c - 1] = Math.max(0, after[c - 1] - 1);   // lose: lose the aura played
      ev += guess[d] * (worth(after) - base);
    }
    if (ev > bestEV || (ev === bestEV && g.random() > 0)) { bestEV = ev; best = c; }
  }
  return [best, Math.round(bestEV * 16)];
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
  await g.view.combat(who1, who2, cast1, cast2);
  if (s.nAttack[who1][who2]) {
    s.nAttackCount[who1][who2]++;
    s.trust[who2][who1] = Math.max(-127, s.trust[who2][who1] - 16);
  }
}

export async function midnight(g) {
  const s = g.s, view = g.view, A = s.auraCnt, P = s.player, N = s.numChars;
  // (DOS: SEG_07B6:0528/05BE state save/restore around Midnight - purpose unknown, no game effect)
  s.diurnal = 'black';
  view.midnight();
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
    view.combatRound();
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
          cast2 = await view.defence(who1, who2);
          await view.combat(who1, who2, cast1, cast2);
        } else [cast2, figMerit] = pickAura(g, who2, who1, figMerit);
        resolve(g, who1, who2, cast1, cast2);
      }
    }
  }

  const has888 = i => A[1][i][0] === 8 && A[2][i][0] === 8 && A[3][i][0] === 8;
  // FIX #11: DOS also declared the player winner if the mouse button was held here (debug cheat)
  if (has888(P)) return view.victory(P);
  let wonFlag = false;
  for (let i = 2; i <= N; i++) {
    wonFlag = has888(i);
    if (wonFlag) return view.victory(i);
  }
  if (!wonFlag && A[1][P][0] === 0 && A[2][P][0] === 0 && A[3][P][0] === 0) {
    let bestVal = 128, bestIndx = 0;
    for (let i = 2; i <= N; i++) if (s.love[i][P] < bestVal) { bestVal = s.love[i][P]; bestIndx = i; }
    return view.victory(bestIndx);
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
  s.diurnal = 'white';
  view.dawn();
}
