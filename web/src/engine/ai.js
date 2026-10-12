// PlanMove: the non-player character AI. Port of DOS OVL_3B4 (reconstruction:
// _ref/dos_src/PlanMyMove.pas, notes in PlanMyMove.notes.md). Procedure names, order of
// checks and all quirks follow the DOS code; only FIX #2 deviates (see docs/FIXES.md).
// Not ported (no effect on decisions): the DebugFlg-only DealTemp.. ring in GoodDeal,
// DebugVal counting in PlanMove, and FlagError's on-screen error message.

import {
  W, SNTC_LENG, DLOG_MAX, SUNSET, NIGHT,
  SubjectA, VerbA, ObjectA1, ObjectA2, SubjectB, VerbB, ObjectB1, ObjectB2,
} from './constants.js';
import { div } from './rng.js';

const clamp = x => (x > 127 ? 127 : x < -127 ? -127 : x);

const EXPRESS_FACE = {
  [W.STalk]: 25, [W.Flatter]: 29, [W.Trust]: 22, [W.Fear]: 21, [W.Love]: 26, [W.NFear]: 13,
  [W.NTrust]: 24, [W.NLove]: 23, [W.Forgive]: 27, [W.Anger]: 3, [W.Thanks]: 28, [W.Apolgz]: 14,
  [W.Deride]: 10,
};
const GREET_FACE = {
  [W.Warm]: 25, [W.Nice]: 29, [W.Sincere]: 22, [W.Cool]: 31, [W.Threaten]: 34, [W.Haughty]: 13, [W.Formal]: 1,
};

/** Plans the next sentence of character g.s.me into g.s.sentence[me]. */
export async function planMove(g) {
  const s = g.s, view = g.view, N = s.numChars;
  const Me = s.me;
  const S = s.sentence[Me];
  let Him = 0; // global Him, set below

  const rnd16 = () => div(g.random(), 2048); // -15..15
  const rnd8 = () => div(g.random(), 4096);  // -7..7
  const face = f => view.face(Him, f);       // shown only if Him is the player
  // DlogHist read; slots outside 1..25 (unchecked reads in the original) count as 0
  const dh = (who, i, j) => s.dlogHist[who][i]?.[j] ?? 0;
  // history entry i, 1-based like HstWrd1H^[i]
  const hist = i => s.hist[i - 1];

  function clearSntc() {
    for (let i = 1; i <= SNTC_LENG; i++) S[i] = 0;
    S[SubjectA] = Me;
  }

  // ChgLove / ChgTrust / ChgFear
  function chg(rel, mood, howMuch) {
    howMuch *= 4 - Math.min(s.level, 3); // level 4 (remake) behaves as level 3 here
    s[rel][Me][Him] = clamp(s[rel][Me][Him] + div(howMuch, 4));
    s[mood][Me] = clamp(s[mood][Me] + howMuch);
  }
  const chgLove = h => chg('love', 'loveMood', h);
  const chgTrust = h => chg('trust', 'trstMood', h);
  const chgFear = h => chg('fear', 'fearMood', h);

  function goHome() { clearSntc(); S[VerbA] = W.Go; S[ObjectA1] = Me + 56; }
  function sayGoodBye() { clearSntc(); S[VerbA] = W.Goodbye; S[ObjectA1] = Him; }

  function express(feeling) {
    let i = s.dlogIndx[Me];
    const x = i - 10;
    let saidBefore = true;
    while (i > 0 && saidBefore && i > x) {
      if (dh(Me, i, VerbA) !== W.SayFeel) saidBefore = false;
      i--;
    }
    if (!saidBefore) {
      clearSntc();
      S[VerbA] = W.SayFeel; S[ObjectA1] = Him; S[ObjectA2] = feeling;
      s.foundPlan = true;
      if (EXPRESS_FACE[feeling]) face(EXPRESS_FACE[feeling]);
    }
  }

  function tellHim(who, toWhom) {
    clearSntc();
    S[VerbA] = W.Tell; S[ObjectA1] = Him; S[ObjectA2] = W.That;
    S[SubjectB] = who; S[VerbB] = W.Betray; S[ObjectB1] = toWhom;
    s.foundPlan = true;
    face(5);
  }

  // Does Me know an event "whoDoneIt betrayed Him" that Him doesn't know?
  function searchHist(whoDoneIt, toHimFlg) {
    for (let i = 1; i <= s.hist.length; i++) {
      const e = hist(i);
      const f1 = e.wrd1 === whoDoneIt;
      let f3 = e.wrd3 === Him;
      if (!toHimFlg) f3 = !f1; // quirk kept: makes SearchHist(x, false) always false
      if (f1 && f3 && !e.know[Him] && e.know[Me]) return true;
    }
    return false;
  }

  function setSntc(w2, w3, w4, w5, w6, w7, w8) {
    clearSntc();
    S[VerbA] = w2; S[ObjectA1] = w3; S[ObjectA2] = w4; S[SubjectB] = w5;
    S[VerbB] = w6; S[ObjectB1] = w7; S[ObjectB2] = w8;
    s.foundPlan = true;
  }

  function goodDeal(victim1, victim2, fromDialog = true) {
    let temp = s.beneficence[Him][Me] - s.beneficence[Me][Him];
    const obligation = s.duty[Me] * temp * 2;
    temp = s.love[Me][victim1] + s.love[Me][victim2];
    const loveThem = temp > 0 ? div(s.loyalty[Me] * temp, s.maxPers) : temp;
    temp = 2 * s.trust[Me][Him] + s.trstMood[Me] + obligation - loveThem + s.desLiked[Me]
      + (g.dosCompat ? (fromDialog ? (g.dlgSlot ?? 0) : -1) : s.desperation); // FIX #2: original read an uninitialised stack slot; dosCompat models it (see PlanMyMove.notes.md)
    if (s.nBetray[Me][victim2][s.day]) temp -= 4 * s.integrity[Me];
    if (s.nAttack[Me][victim1]) temp -= s.integrity[Me];
    if (s.nAttack[victim1][Me]) temp -= s.gullble[Me];
    return temp;
  }

  function wontBetray() { setSntc(W.NBetray, Him, 0, 0, 0, 0, 0); s.foundPlan = true; face(22); }
  function wontAttack() { setSntc(W.NAttack, Him, 0, 0, 0, 0, 0); s.foundPlan = true; face(22); }

  function accuse(verbB, trustLoss) {
    setSntc(W.Accuse, Him, W.That, Him, verbB, Me, 0);
    face(19);
    chgTrust(trustLoss); chgFear(8); chgLove(-8);
  }

  function ignore() {
    const LoveMH = s.love[Me][Him], TrustMH = s.trust[Me][Him], FearMH = s.fear[Me][Him];

    // accuse him of a betrayal I know about (loop keeps running, but FoundPlan stops it)
    for (let j = 1; j <= s.hist.length && !s.foundPlan; j++) {
      const e = hist(j);
      if (e.wrd1 === Him && e.wrd3 === Me && e.know[Me]) accuse(W.Betray, -16);
    }
    if (!s.foundPlan && s.nBetrayCount[Him][Me] > 0) accuse(W.BBetray, -32);
    if (!s.foundPlan && s.nAttackCount[Him][Me] > 0) accuse(W.BAttack, -32);

    if (!s.foundPlan) { // I tell him a fact?
      let temp1 = LoveMH + s.loveMood[Me] + 2 * (TrustMH + s.trstMood[Me]);
      temp1 = temp1 + div(FearMH, 4) - 4 * s.secret[Me] + 4 * s.desLiked[Me];
      g.dlgSlot = temp1; // dosCompat model: Ignore.Temp1 shares Dialog's stale slot
      for (let i = 1; i <= N; i++) if (i !== Me && i !== Him && !s.foundPlan) {
        const temp2 = div(s.loyalty[Me] * s.love[Me][i], s.maxPers) + div(s.fear[Me][i], 4);
        if (temp1 > temp2 && searchHist(i, true)) tellHim(i, Him);
      }
    }

    if (!s.foundPlan && (rnd16() > 4 || s.dlogIndx[Me] === 0)) { // ask a question
      let asked = false;
      let x = s.dlogIndx[Him];
      for (let i = 1; i <= x && !asked; i++)
        if (dh(Him, i, SubjectB) === W.Nobody && dh(Him, i, ObjectB1) === Me) asked = true;
      x = s.dlogIndx[Me];
      const k = x - s.dlogIndx[Him] + 1;
      for (let i = 1; i <= x && i + k <= DLOG_MAX && !asked; i++)
        if (dh(Me, i, VerbA) === W.Ask && dh(Him, i + k, ObjectA2) === W.Anger) asked = true;
      if (!asked) { setSntc(W.Ask, Him, W.That, W.Who, W.Betray, Me, 0); face(6); }
    }

    if (!s.foundPlan && !searchHist(Me, true)) { // promise no betray?
      let f = false;
      for (let i = 1; i <= N; i++) if (i !== Me && !f) f = s.love[Me][i] > LoveMH || s.nBetray[Me][i][s.day];
      if (!f) wontBetray();
    }

    if (!s.foundPlan) { // promise no attack -- because I love him?
      let f = false;
      for (let i = 1; i <= N; i++) if (i !== Me && !f) f = s.love[Me][i] > LoveMH || s.nAttack[Me][i];
      if (!f && LoveMH > 48) wontAttack();
    }

    if (!s.foundPlan) { // promise no attack -- because he is unattackable?
      const a = k => s.auraCnt[k][Him][Me];
      if (a(1) === a(2) && a(1) === a(3) && a(1) >= 0 && !s.nAttack[Me][Him]) wontAttack();
    }

    // promise no attack -- because I plan to GET him!
    if (!s.foundPlan && div(LoveMH, 4) + s.integrity[Me] < -8 && !s.nAttack[Me][Him]) wontAttack();

    if (!s.foundPlan) { // offer him a deal?
      let bestDeal = 32, besti = 0, bestj = 0, bestK = 0, bestL = 0;
      for (let i = 1; i <= N; i++) if (i !== Me && i !== Him) {
        for (let j = 1; j <= N; j++) if (j !== Me && j !== Him) {
          const thisDeal = goodDeal(i, j, false);
          if (thisDeal <= bestDeal) continue;
          let gotK = 0, gotL = 0;
          for (let k = 1; k <= 3; k++) if (s.auraCnt[k][i][Me] < 0 && s.auraCnt[k][i][Him] >= 0) gotK = k;
          if (gotK === 0) continue;
          for (let k = 1; k <= 3; k++) if (s.auraCnt[k][j][Me] >= 0 && s.auraCnt[k][j][Him] < 0) gotL = k;
          if (gotL === 0) continue;
          const x = s.dlogIndx[Me];
          if (x > 0) { // as in the original: no deal at all while DlogIndx[Me] = 0
            let offered = false;
            for (let m = 1; m <= x && !offered; m++)
              if (dh(Me, m, 4) === j && dh(Me, m, 7) === i) offered = true;
            if (!offered) { bestDeal = thisDeal; besti = i; bestj = j; bestK = gotK; bestL = gotL; }
          }
        }
      }
      if (besti > 0 && bestj > 0) setSntc(W.Reveal, Him, bestj, bestL + 35, W.Reveal, besti, bestK + 35);
      if (s.foundPlan) face(20);
    }

    if (s.dlogIndx[Me] < DLOG_MAX) {
      if (!s.foundPlan && rnd8() > 4 && FearMH < -32 && LoveMH < -32) express(W.Deride);
      if (!s.foundPlan && rnd8() > 4) express(W.Flatter);
      if (!s.foundPlan && s.dlogIndx[Me] < 2) express(W.STalk);
    }
  }

  function processFeelings(prevFeel) {
    const LoveMH = s.love[Me][Him], TrustMH = s.trust[Me][Him], FearMH = s.fear[Me][Him];
    const lastFeel = s.lastSntc[Me][ObjectA2];
    const posNeg = (val, pos, neg) => {
      if (val > 20 && lastFeel !== pos) express(pos);
      if (val < -20 && lastFeel !== neg) express(neg);
    };
    switch (prevFeel) {
      case W.Trust: case W.NTrust: posNeg(TrustMH, W.Trust, W.NTrust); break;
      case W.Fear: case W.NFear: posNeg(FearMH, W.Fear, W.NFear); break;
      case W.Love: case W.NLove: posNeg(LoveMH, W.Love, W.NLove); break;
      case W.Anger: {
        chgFear(16);
        chgLove(-2 * s.pride[Me]);
        const t1 = s.dlogIndx[Me], t2 = s.dlogIndx[Him];
        if (t1 >= 2 && t2 >= 2 &&
          dh(Me, t1, ObjectA2) === W.Anger && dh(Me, t1 - 1, ObjectA2) === W.Anger &&
          dh(Him, t2, ObjectA2) === W.Anger && dh(Him, t2 - 1, ObjectA2) === W.Anger) {
          s.foundPlan = true;
          sayGoodBye();
          face(3);
        }
        if (!s.foundPlan && FearMH < -50) express(W.Deride);
        if (!s.foundPlan && 2 * s.temper[Me] > FearMH) express(W.Anger);
        if (!s.foundPlan && FearMH < -20) express(W.NFear);
        if (!s.foundPlan && div(FearMH, 4) > 32) express(W.Apolgz);
        if (!s.foundPlan && LoveMH < -20) express(W.NLove);
        break;
      }
      case W.Apolgz:
        chgFear(-24);
        chgTrust(s.gullble[Me]);
        if (LoveMH + 4 * s.desLiked[Me] > 40) express(W.Forgive);
        if (!s.foundPlan && LoveMH > 20) express(W.Love);
        if (!s.foundPlan && FearMH < -40 && LoveMH < -40) express(W.Deride);
        break;
      case W.Deride:
        chgLove(-16);
        chgFear(8);
        if (5 * s.pride[Me] - LoveMH > 50) express(W.Anger);
        if (!s.foundPlan && FearMH < -40 && LoveMH < -40) express(W.Deride);
        break;
      case W.Flatter:
        chgLove(s.gullble[Me] + s.pride[Me]);
        chgTrust(s.gullble[Me] - 8);
        if (LoveMH < -20 && TrustMH > 40) express(W.Thanks);
        if (!s.foundPlan && TrustMH < -40 && LoveMH < -20 && s.lastSntc[Me][ObjectA2] !== W.Flatter) express(W.Flatter);
        if (!s.foundPlan && TrustMH < -20) express(W.NTrust);
        if (!s.foundPlan && LoveMH > 20) express(W.Love);
        break;
      case W.Forgive:
        chgLove(8);
        if (LoveMH > 0) express(W.Thanks);
        if (!s.foundPlan && FearMH > 40) express(W.Flatter);
        break;
      case W.STalk:
        chgLove(4);
        if (s.loveMood[Me] > 0 && s.loveMood[Me] < 40 && s.secret[Me] < 9 &&
          s.lastSntc[Me][ObjectA2] !== W.STalk) express(W.STalk);
        if (!s.foundPlan && TrustMH < -20) express(W.NTrust);
        break;
      case W.Thanks:
        chgLove(4);
        break;
    }
  }

  function agree() {
    clearSntc();
    S[VerbA] = W.Agree; S[ObjectA1] = Him;
    s.foundPlan = true;
    face(20);
  }

  // DebugFlg build: after repeating my last sentence as beg/threat, reject a bad ObjectA1
  function flagError() {
    if (S[ObjectA1] > N) { s.foundPlan = false; clearSntc(); }
  }

  // repeat my last sentence with a new verb (beg or threat)
  function repeatAs(verb, f) {
    for (let i = 1; i <= SNTC_LENG; i++) S[i] = s.lastSntc[Me][i];
    S[VerbA] = verb;
    s.foundPlan = true;
    face(f);
  }

  // for each third character i: TellHim(i, Him) if temp2 > threshold(i) and I know he betrayed Him
  function tellAbout(temp2, threshold, toHimFlg = true) {
    for (let i = 1; i <= N; i++) if (i !== Me && i !== Him && !s.foundPlan)
      if (temp2 > threshold(i) && searchHist(i, toHimFlg)) tellHim(i, Him);
  }

  // true if no plan was found (then the caller says goodbye)
  async function dialog() {
    view.clearFace(Him);
    s.foundPlan = false;
    s.thatGuy = 0;
    clearSntc();
    const L = s.lastSntc[Him], LM = s.lastSntc[Me];
    const [, , LVerbA, , LObjA2, LSubjB, LVerbB, LObjB1] = L;
    const TrustMH = s.trust[Me][Him], LoveMH = s.love[Me][Him], FearMH = s.fear[Me][Him];
    let temp1 = s.beneficence[Him][Me] - s.beneficence[Me][Him], temp2;
    const DutyMH = s.duty[Me] * temp1;
    const love = i => s.love[Me][i], fear = i => s.fear[Me][i];

    if (!s.helloFlg[Me]) {
      g.dlgSlot = 16000; // dosCompat model: the greeting leaves a stack address in the slot
      let x;
      if (LoveMH > 64) x = W.Warm;
      else if (LoveMH > 32) x = W.Nice;
      else if (LoveMH > -32) x = FearMH > -16 ? (TrustMH > 0 ? W.Sincere : W.Formal) : W.Haughty;
      else x = FearMH > -16 ? W.Cool : W.Threaten;
      setSntc(W.Greet, Him, x, 0, 0, 0, 0);
      face(GREET_FACE[x]);
    }

    // does Him's last sentence repeat his dialog line i, with my answer at i+k matching test?
    const sameAsLast = i => {
      for (let j = 1; j <= SNTC_LENG; j++) if (dh(Him, i, j) !== L[j]) return false;
      return true;
    };

    switch (LVerbA) {
      case W.Greet:
        switch (LObjA2) {
          case W.Warm:
            if (LoveMH > 64) chgLove(16); else { chgLove(s.gullble[Me]); chgTrust(s.maxPers - s.gullble[Me]); }
            break;
          case W.Nice:
            if (LoveMH > 32) chgLove(8); else { chgLove(s.gullble[Me]); chgTrust(s.maxPers - s.gullble[Me]); }
            break;
          case W.Sincere: chgTrust(TrustMH > 0 ? 16 : -16); break;
          case W.Cool: face(31); break;
          case W.Threaten: chgLove(-8); chgFear(FearMH < 16 ? -8 : 8); break;
          case W.Haughty: chgFear(FearMH < 16 ? -8 : 8); break;
        }
        break;

      case W.Reveal: {
        s.thatGuy = LObjA2;
        chgTrust(4);
        // (A1/A2 = Love[Me,LObjA2]/Love[Me,LObjB1] are computed but unused in the original)
        const x = s.dlogIndx[Him], y = s.dlogIndx[Me] - x + 1;
        if (x > 1 && !s.foundPlan) {
          let bestFig = 0;
          for (let i = 1; i <= x - 1; i++) // no i+y <= DlogMax check, as in the original
            if (sameAsLast(i) && dh(Me, i + y, VerbA) === W.Reject) bestFig++;
          chgTrust(-4);
          chgLove(-4);
          if ((s.temper[Me] - DutyMH) * bestFig > 0) express(W.Anger);
        }
        temp1 = LM[ObjectA2] === W.Apolgz ? 64 : 0;
        if (!s.foundPlan && goodDeal(LObjA2, LObjB1) + temp1 > 32) { // I accept his offer
          chgTrust(4);
          chgLove(8);
          agree();
        }
        if (!s.foundPlan) { // I reject his offer
          clearSntc();
          S[VerbA] = W.Reject;
          s.foundPlan = true;
          face(33);
        }
        break;
      }

      case W.Ask: {
        const x = s.dlogIndx[Him];
        if (x > 1) {
          let bestFig = 0;
          const k = s.dlogIndx[Me] - x + 1;
          for (let i = 1; i <= x - 1; i++) if (i + k <= DLOG_MAX)
            if (sameAsLast(i) && dh(Me, i + k, 5) === W.Nobody) bestFig++;
          if (bestFig * (s.temper[Me] - DutyMH) > 0) { chgLove(-8); express(W.Anger); }
        }
        if (!s.foundPlan) {
          let told = false, know = false;
          temp2 = DutyMH + TrustMH + s.trstMood[Me] + div(FearMH, 4) - 2 * s.secret[Me];
          for (let i = 1; i <= N; i++) if (i !== Me && i !== Him && !s.foundPlan) {
            temp1 = div(s.loyalty[Me] * love(i), s.maxPers) + div(fear(i), 4) + 80;
            if (searchHist(i, true)) {
              know = true;
              if (temp2 > temp1) { told = true; tellHim(i, Him); }
            }
          }
          if (!know) tellHim(W.Nobody, Him);
          if (know && !told) {
            temp2 = DutyMH + TrustMH + s.trstMood[Me] + div(FearMH, 4) - 2 * s.secret[Me];
            for (let i = 1; i <= N; i++) if (i !== Me && i !== Him && !s.foundPlan) {
              temp1 = love(i) + div(fear(i), 4) + 80;
              if (temp2 > temp1 && searchHist(i, false)) { // dead: SearchHist(x, false) is always false
                told = true;
                tellHim(i, hist(i)?.wrd3 ?? 0); // original indexes history by character number
              }
            }
          }
        }
        break;
      }

      case W.Accuse:
        chgLove(-8);
        chgFear(8);
        temp2 = s.pride[Me] * 5;
        if (LoveMH + FearMH > temp2) { express(W.Apolgz); chgFear(8); }
        temp1 = 2 * (s.pride[Me] + s.temper[Me]) - FearMH - LoveMH;
        if (!s.foundPlan && temp1 > 100) { express(W.Anger); chgFear(4); chgLove(-4); }
        temp1 -= FearMH;
        if (!s.foundPlan && temp1 > 100) { express(W.Deride); chgFear(-8); }
        break;

      case W.SayFeel: processFeelings(LObjA2); break;

      case W.Reject:
        chgLove(-4);
        chgTrust(-4);
        temp1 = LoveMH + FearMH - 7 * s.pride[Me];
        if (temp1 > 0 && LM[VerbA] !== W.Beg) { repeatAs(W.Beg, 32); flagError(); }
        temp1 = 4 * (s.temper[Me] - s.desLiked[Me]) - FearMH;
        if (!s.foundPlan && temp1 > 70 && LM[VerbA] !== W.Beg && LM[VerbA] !== W.Threat) {
          repeatAs(W.Threat, 34);
          flagError();
        }
        temp1 = 4 * s.temper[Me] - FearMH - LoveMH;
        if (!s.foundPlan && temp1 > 60) express(W.Anger);
        break;

      case W.Threat:
        s.thatGuy = LObjA2;
        chgLove(-4);
        chgFear(8);
        temp1 = (4 - Math.min(s.level, 3)) * (FearMH - fear(LObjB1));
        if (LVerbB === W.Reveal && goodDeal(LObjA2, LObjB1) + temp1 > 32) agree();
        if (LObjA2 === W.That) {
          s.thatGuy = 0;
          tellAbout(LoveMH + TrustMH + s.trstMood[Me] + FearMH - 4 * s.secret[Me], i => love(i) + fear(i) + 80);
        }
        if (!s.foundPlan && FearMH < -20) express(W.NFear);
        temp1 = 4 * (s.temper[Me] + s.pride[Me]) - FearMH - LoveMH;
        if (!s.foundPlan && temp1 > 0) express(W.Anger);
        break;

      case W.Beg:
        s.thatGuy = LObjA2;
        chgFear(-8);
        temp1 = LoveMH - love(LObjB1);
        if (LVerbB === W.Reveal && goodDeal(LObjA2, LObjB1) + temp1 > 32) agree();
        if (LObjA2 === W.That) {
          s.thatGuy = 0;
          tellAbout(LoveMH + TrustMH + div(FearMH, 8) + s.trstMood[Me], i => love(i) + fear(i) + 80);
        }
        if (!s.foundPlan && LoveMH < -20) express(W.NLove);
        if (!s.foundPlan && FearMH < -40 && LoveMH < -40) express(W.Deride);
        break;

      case W.Agree:
        chgLove(8);
        chgFear(-4);
        chgTrust(8);
        switch (LM[VerbA]) {
          case W.Reveal: if (LoveMH < -30) express(W.Thanks); break;
          case W.Beg: if (LoveMH < 40) express(W.Thanks); break;
          case W.Threat: if (FearMH < -60) express(W.Deride); break;
        }
        break;

      case W.Tell:
        if (LSubjB !== Him && LSubjB !== W.Nobody) s.thatGuy = LSubjB;
        if (LM[VerbA] === W.Ask && LObjB1 === Me && LSubjB !== Him) { // he answered my question
          chgTrust(8);
          tellAbout(LoveMH + s.trstMood[Me] + div(FearMH, 4) - 4 * s.secret[Me], i => love(i) + div(fear(i), 4) + 20);
          if (!s.foundPlan)
            tellAbout(LoveMH + TrustMH + s.trstMood[Me] + div(FearMH, 4), i => love(i) + div(fear(i), 4) + 80, false);
          if (!s.foundPlan && LoveMH < -30) express(W.Thanks);
          if (!s.foundPlan && LoveMH + s.loveMood[Me] > 80) express(W.Love);
          if (!s.foundPlan && TrustMH + s.trstMood[Me] > 80) express(W.Trust);
        }
        if (LM[VerbA] === W.Ask && LObjB1 !== Me) { // he dodged my question
          chgTrust(-16);
          face(1);
          if (Him === s.player) await view.delay(30);
          if (LoveMH + FearMH - 5 * s.pride[Me] > 0) repeatAs(W.Beg, 32); // no FlagError here (as in DOS)
          if (!s.foundPlan && -FearMH > 80) repeatAs(W.Threat, 34);
          if (!s.foundPlan && 4 * s.temper[Me] - FearMH - LoveMH > 140) express(W.Anger);
        }
        if (LM[VerbA] !== W.Ask && !(LSubjB === Him && LObjB1 === Me)) { // he volunteered this information
          chgTrust(16);
          if (LObjB1 !== Me && LSubjB !== W.Nobody)
            s.trust[Me][LSubjB] = Math.max(-127, s.trust[Me][LSubjB] - 2);
          if (LSubjB !== W.Nobody) face(9);
          if (Him === s.player) await view.delay(30);
          temp2 = LoveMH + TrustMH + s.trstMood[Me] + div(FearMH, 4);
          tellAbout(temp2, i => love(i) + div(fear(i), 4) + 60);
          tellAbout(temp2, i => love(i) + div(fear(i), 4) + 100, false);
          if (!s.foundPlan && LoveMH < -40) express(W.Thanks);
          if (!s.foundPlan && TrustMH > 40) express(W.Trust);
          if (!s.foundPlan && TrustMH < -40) express(W.NTrust);
        }
        break;

      case W.NBetray:
        chgTrust(4 * s.gullble[Me] + 2);
        if (TrustMH > 20) express(W.Trust);
        if (!s.foundPlan && TrustMH < -20) express(W.NTrust);
        break;

      case W.NAttack:
        chgLove(4 * s.gullble[Me]);
        if (TrustMH > 20) express(W.Trust);
        if (!s.foundPlan && TrustMH < -20) express(W.NTrust);
        break;
    }

    if (!s.foundPlan) ignore();
    if (!s.foundPlan) clearSntc();
    return !s.foundPlan;
  }

  function goSomeWhere(notHome) {
    let newLocn, hit, attempts = 0;
    do {
      newLocn = Math.abs(rnd8()) + 1; // 1..8
      attempts++;
      hit = newLocn <= N && newLocn > 0 && s.charLocn[newLocn] === newLocn;
      if (hit) {
        for (let i = 1; i <= N; i++) {
          if (s.charLocn[i] === -newLocn || s.sentence[i][ObjectA1] === newLocn + 56) hit = false;
          if (s.visits[Me][i] > 0 && g.random() > 0) hit = false; // Random drawn only if visited
        }
      }
      if (notHome && newLocn === Me) hit = false;
    } while (!hit && attempts <= 8);
    if (hit) { S[VerbA] = W.Go; S[ObjectA1] = newLocn + 56; }
    else if (notHome) S[VerbA] = W.Wait;
    else goHome();
  }

  // ---- PlanMove body
  clearSntc();
  S[SubjectA] = Me;
  Him = s.him = s.interloc[Me];
  const MyLocn = s.charLocn[Me];
  let sumAuras = -5;
  for (let i = 1; i <= N; i++) if (i !== Me && i !== Him)
    for (let k = 1; k <= 3; k++) if (s.auraCnt[k][i][Me] >= 0) sumAuras++;
  s.desperation = div(1024 * (6 - sumAuras), div(1500 - s.time, 8));

  if (s.time > SUNSET && s.time < NIGHT) {
    if (MyLocn !== Me) { if (s.guestFlg[Me]) sayGoodBye(); else goHome(); }
    else if (Him > 0) sayGoodBye();
  }
  if (s.time <= SUNSET) {
    if (MyLocn !== Me) {
      if (MyLocn > 0 && await dialog()) sayGoodBye(); // in someone's home
      if (MyLocn <= 0) goSomeWhere(false);
    } else if (Him > 0) {
      if (await dialog()) sayGoodBye();
    } else { // alone in my own home
      let waitFlag = false;
      for (let i = 1; i <= N; i++)
        if (s.sentence[i][VerbA] === W.Go && s.sentence[i][ObjectA1] === Me + 56) { S[VerbA] = W.Wait; waitFlag = true; }
      if (!waitFlag) goSomeWhere(true);
    }
  }
}
