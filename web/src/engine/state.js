// Complete game state. Mirrors the original global variables (Globals.p) so logic ports 1:1.
// Arrays keep the original 1-based indexing (index 0 unused unless the original used it).
// Everything here is plain JSON-serialisable data: save/load = JSON.stringify/parse.

import { CONST_CHARS, SNTC_LENG, DLOG_MAX } from './constants.js';

const arr = (n, v = 0) => Array.from({ length: n }, () => (typeof v === 'function' ? v() : v));
const mat = (a, b, v = 0) => arr(a, () => arr(b, v));

export function createState() {
  const N = CONST_CHARS + 1; // index 0..7
  return {
    // sentence composition
    curWord: 0,
    sntcIndx: 0,
    sentence: mat(N, SNTC_LENG + 1),     // [0..7][1..8]; row 0 = scratch sentence for display
    lastSntc: mat(N, SNTC_LENG + 1),
    canclAble: arr(SNTC_LENG + 1, false),
    iconID: arr(25),                     // [1..24]
    iconCount: 0,

    // world
    day: 1, time: 0, player: 1, numChars: CONST_CHARS, level: 1, gameLeng: 1,
    charLocn: arr(N),                    // [0..7]; >0 in house n, 0 travelling, <0 waiting outside house -n
    interloc: arr(N),
    doorLock: arr(N, false),
    guestFlg: arr(N, false),
    helloFlg: arr(N, false),
    execTime: arr(N),

    // relationships / personality
    love: mat(N, N), trust: mat(N, N), fear: mat(N, N),
    loyalty: arr(N), integrity: arr(N), temper: arr(N), revenge: arr(N), duty: arr(N),
    pride: arr(N), secret: arr(N), desLiked: arr(N), gullble: arr(N),
    loveMood: arr(N), trstMood: arr(N), fearMood: arr(N),
    beneficence: mat(N, N), visits: mat(N, N),
    maxPers: 0, desperation: 0,

    // auras: auraCnt[type 1..3][who 1..7][knower 0..7]; knower 0 = true value, -1 = unknown
    auraCnt: arr(4, () => mat(N, N)),

    // promises & betrayals
    nBetray: arr(N, () => mat(N, 65, false)),  // [who][whom][day 1..64]
    nAttack: mat(N, N, false),
    nBetrayCount: mat(N, N), nAttackCount: mat(N, N),

    // history of betrayals: entries {wrd1: betrayer, wrd3: victim, date, time, know: bool[1..8]}
    hist: [],

    // dialog memory
    dlogHist: arr(N, () => mat(DLOG_MAX + 1, SNTC_LENG + 1)), // [who][1..25][1..8], never cleared
    dlogIndx: arr(N),

    // story/event system
    storyParm: arr(100, -1),             // [1..99]
    aslyn: 0,
    fBetrayals: 0, playerDeals: 0, dlogCount: 0,

    // AI scratch (globals in the original)
    me: 0, him: 0, foundPlan: false, thatGuy: 0,

    // UI-facing state kept in the save file by the original
    lastLove: 0, lastTrust: 0, lastFear: 0,
    barGraphFlag: false, savedFace: 0,
    narratOn: true, storyDelay: 180, soundOn: false,
    night: false,
  };
}

export const DLOG_LIMIT = DLOG_MAX;
