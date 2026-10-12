// Core constants of the original game (Globals.p). Word numbers index the icon language.

export const NUM_WORDS = 128;
export const CONST_CHARS = 7;       // Vetvel..Skordokott; 8 = Chris (dossier only)
export const SNTC_LENG = 8;
export const HIST_LENG = 1000;
export const DLOG_MAX = 25;

// sentence slots (1-based like the original)
export const SubjectA = 1, VerbA = 2, ObjectA1 = 3, ObjectA2 = 4,
  SubjectB = 5, VerbB = 6, ObjectB1 = 7, ObjectB2 = 8;

// time of day, minutes since midnight
export const DAWN = 480, SUNSET = 1200, NIGHT = 1260;

// narration delays (ticks, 1/60 s)
export const BEG_DELAY = 180, INT_DELAY = 90, EXP_DELAY = 0;

export const HOW_DEPART = 1, HOW_ARRIVE = 2;

// screen geometry (Mac coordinates, reused 1:1 by the DOS port)
export const SCRN_X1 = 84, SCRN_X2 = 230, SCRN_Y1 = 20, SCRN_Y2 = 178;

// words
export const W = {
  Nobody: 10, Who: 11,
  Greet: 25, Goodbye: 26, Warm: 27, Nice: 28, Sincere: 29, Cool: 30, Threaten: 31, Haughty: 32, Formal: 33,
  Accuse: 34, TanagaCount: 36, KatsinCount: 37, ShialCount: 38,
  Reveal: 44, Beg: 45, Threat: 46, Betray: 47, Go: 49, Not: 52,
  TanagaAttack: 53, KatsinAttack: 54, ShialAttack: 55, WhatAttack: 56,
  House1: 57, // house of character i = 56 + i
  AuraIcon1: 66, // aura symbol j = 65 + j
  Tell: 73, Agree: 74, Reject: 75, If: 76, Ask: 77, Answer: 78, Connector: 81, That: 82,
  NBetray: 83, NAttack: 84, Wait: 86, FeelBars: 87, BBetray: 90, BAttack: 91,
  Pause: 102, NotKnown: 103, Zero: 104, // aura count n = 104 + n (103 = unknown)
  SayFeel: 113, STalk: 114, Flatter: 115, Trust: 116, Fear: 117, Love: 118,
  NFear: 119, NTrust: 120, NLove: 121, Forgive: 122, Anger: 123, Thanks: 125, Apolgz: 126, Deride: 127,
};

export const house = who => W.House1 - 1 + who;
