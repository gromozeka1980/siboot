// NewWordSet: which icons the player may pick next while composing a sentence.
// Port of DOS OVL_3C3:035A (reconstruction: _ref/dos_src/Words.pas). Pure logic: fills
// s.iconID[1..] / s.iconCount; the UI draws the icon column afterwards.
//
// Connection tables (from CONNECT.DTA): follows1[w][c] = w may follow c in the main chain,
// follows2[w][v] = w may be the second object of verb v.

import { W, NUM_WORDS, VerbA, ObjectA1, ObjectA2, SubjectB, VerbB, ObjectB1 } from './constants.js';

export function newWordSet(s, tables, flag, dosCompat = false) {
  const { follows1, follows2 } = tables;
  const P = s.player, N = s.numChars;
  const S = s.sentence[P];
  const MVerbA = S[VerbA], MObjA1 = S[ObjectA1], MObjA2 = S[ObjectA2],
    MSubjB = S[SubjectB], MVerbB = S[VerbB], MObjB1 = S[ObjectB1];
  const PLocn = s.charLocn[P];
  const Him = s.interloc[P];
  const H = s.hist;
  const aura = (a, whose, knower) => s.auraCnt[a][whose][knower];

  let HimHere = false, HeOffered = false, CanPlead = false, HeAskedWho = false,
    CanNBetray = false, CanNAttack = false, LVerbA = 0, LVerbB = 0, LObjB1 = 0;
  if (Him > 0) {
    const L = s.lastSntc[Him], LP = s.lastSntc[P];
    HimHere = true;
    LVerbA = L[VerbA];
    HeAskedWho = L[SubjectB] === W.Who;
    HeOffered = L[VerbB] === W.Reveal;
    if (LP[VerbA] === W.Ask && (L[VerbA] !== W.Tell || L[VerbB] !== W.Betray || L[ObjectB1] !== P)) CanPlead = true;
    if (LP[VerbA] === W.Reveal && LVerbA !== W.Agree) CanPlead = true;
    LVerbB = L[VerbB];
    LObjB1 = L[ObjectB1];
    CanNBetray = !s.nBetray[P][Him][s.day];
    CanNAttack = !s.nAttack[P][Him];
  }

  const icons = [];
  s.iconCount = 0;
  const done = list => { s.iconID = [0, ...list]; s.iconCount = list.length; };
  const idx = s.sntcIndx;
  const Pos = n => idx === n;
  const ExclWord = idx === 2 ? P : idx === 6 ? MSubjB : 0;
  const Offering = MVerbA === W.Reveal, Answering = MVerbA === W.Answer;
  const Daytime = s.time >= 480 && s.time < 1200;
  const Evening = s.time >= 1200 && s.time <= 1260;
  const Night = s.time > 1260;
  const HimVerb = [W.Tell, W.Ask, W.Answer, W.Greet, W.Goodbye, W.SayFeel, W.Accuse, W.NBetray, W.NAttack].includes(MVerbA);

  // forced choices / empty sets; the last applicable one wins
  let forced = null;
  if (idx > 1 && s.curWord === 0) forced = [];
  if (idx === 0) forced = [P];
  if (Offering && Pos(5)) forced = [W.Reveal];
  if (Evening && PLocn !== P) {
    if (Pos(1)) forced = [W.Go];
    if (Pos(2)) forced = [P + 56];
  }
  if (HimVerb && Pos(2)) forced = [Him];
  if (forced) { done(forced); return { forced: forced.length === 1 }; }

  // aura knowledge Knower has about Whose that Other lacks
  const knowsAura = (whose, knower, other) =>
    [1, 2, 3].some(a => aura(a, whose, knower) >= 0 && aura(a, whose, other) < 0);
  // no event, known to player but not to the listener, with target = t
  const noEventOn = t => !H.some(e => e.know[P] && !e.know[MObjA1] && e.wrd3 === t);
  const findEvent = (actor, target) => H.some(e => e.know[P] && !e.know[Him] && e.wrd1 === actor && e.wrd3 === target);
  const heWrongedMe = () => H.some(e => e.know[P] && e.wrd1 === Him && e.wrd3 === P);

  let CanTrade = false;
  if (Pos(1) && Him > 0) {
    let t4 = false;
    for (let i = 1; i <= N; i++) if (i !== P && i !== Him && knowsAura(i, P, Him)) t4 = true;
    if (t4) for (let i = 1; i <= N; i++) if (i !== P && i !== Him && knowsAura(i, Him, P)) CanTrade = true;
  }

  let AnyAnswer = false;
  for (let w = 1; w <= NUM_WORDS; w++) {
    const BetrayW = w === W.Betray || w === W.BBetray || w === W.BAttack;
    const AttackW = w >= 53 && w <= 55;
    const HasAura = AttackW ? aura(w - 52, P, 0) > 0 : true;
    const AuraW = w >= 36 && w <= 38;
    const PleadW = w === W.Beg || w === W.Threat;
    const GreetOK = (w === W.Greet && !s.helloFlg[P]) ? true : !(Pos(1) && (w === W.Greet || !s.helloFlg[P]));
    const SameRoom = (w <= N && w > 0 && PLocn > 0) ? PLocn === s.charLocn[w] : false;

    let OfferOK = false;
    if (Offering) {
      if (Pos(2) && w === Him) OfferOK = true;
      if (Pos(3) && w <= N && w !== P && w !== MObjA1 && knowsAura(w, P, MObjA1)) OfferOK = true;
      if (Pos(4) && AuraW) OfferOK = aura(w - 35, MObjA2, P) >= 0 && aura(w - 35, MObjA2, MObjA1) < 0;
      if (Pos(5)) OfferOK = true;
      if (Pos(6) && w <= N && w !== MObjA1 && knowsAura(w, MObjA1, P)) OfferOK = true;
      if (Pos(7) && AuraW) OfferOK = aura(w - 35, MObjB1, P) < 0 && aura(w - 35, MObjB1, MObjA1) >= 0;
    }

    let TellOK = true;
    if (MVerbA === W.Tell) {
      if (Pos(4) && w <= W.Nobody) {
        if (w === W.Nobody) {
          TellOK = false;
          for (let j = 1; j <= 7 && !TellOK; j++) TellOK = noEventOn(j);
        } else {
          TellOK = H.some(e => e.know[P] && !e.know[MObjA1] && e.wrd1 === w);
        }
      }
      if (Pos(5) && w !== W.Betray) TellOK = false;
      if (Pos(6)) {
        TellOK = MSubjB === W.Nobody ? noEventOn(w)
          : H.some(e => e.know[P] && !e.know[MObjA1] && e.wrd1 === MSubjB && e.wrd3 === w);
      }
    }

    let AccuseOK = !(Pos(1) && w === W.Accuse);
    if (!AccuseOK && Him > 0) {
      AccuseOK = heWrongedMe();
      if (!AccuseOK && (s.nBetrayCount[Him][P] > 0 || s.nAttackCount[Him][P] > 0)) AccuseOK = true;
    }
    if (MVerbA === W.Accuse) {
      if (Pos(4)) AccuseOK = w === Him;
      if (Pos(5)) {
        AccuseOK = false;
        if (w === W.Betray) AccuseOK = heWrongedMe();
        if (w === W.BBetray && s.nBetrayCount[Him][P] > 0) AccuseOK = true;
        if (w === W.BAttack && s.nAttackCount[Him][P] > 0) AccuseOK = true;
      }
      if (Pos(6)) AccuseOK = w === P;
    }

    let AnswerOK = false;
    if (Answering) {
      if (Pos(2) || Pos(3)) AnswerOK = true;
      if (Pos(4) && w <= N) { AnswerOK = findEvent(w, LObjB1); if (AnswerOK) AnyAnswer = true; }
      if (Pos(4) && w === W.Nobody && !AnyAnswer) AnswerOK = true;
      if (Pos(5)) {
        if (MSubjB === W.Nobody) AnswerOK = w === LVerbB;
        else if (w === LVerbB) AnswerOK = findEvent(MSubjB, LObjB1);
      }
      if (Pos(6)) AnswerOK = w === LObjB1;
    }

    let FeelOK = true;
    if (MVerbA === W.SayFeel && Pos(3)) FeelOK = feelingFits(w, LVerbA, s.lastSntc[Him][ObjectA2], dosCompat);

    const ByeOK = !(w === W.Goodbye && s.guestFlg[P] && !s.helloFlg[P]);

    // the filter chain (DOS order; first failure rejects the word)
    const f1 = tables.follows1[w], f2 = tables.follows2[w];
    const ok =
      ((f1[s.curWord] && flag) || (f2[s.curWord] && !flag)) &&
      !(Pos(5) && follows2[W.That][w]) &&
      w !== ExclWord &&
      !(Pos(1) && !HimHere && !AttackW && follows1[1][w]) &&
      !(Pos(2) && HimVerb && !SameRoom && !Night) &&
      !(idx <= 3 && w === W.Who) &&
      !(w === W.Who && MVerbA !== W.Ask) &&
      !(Pos(1) && BetrayW) &&
      !(Pos(2) && MVerbA === W.Go && w - 56 === Math.abs(PLocn)) &&
      !(w === W.Go && !Daytime) &&
      !(w > N && w <= 7) &&
      !(w - 56 > N && w - 56 <= 7) &&
      !(Offering && !OfferOK) &&
      !(!Offering && Pos(5) && !BetrayW) &&
      (!Pos(1) || (!Night && !AttackW) || (Night && AttackW && HasAura)) &&
      !(Pos(6) && MVerbB >= 36 && MVerbB <= 38 && w !== W.NotKnown) &&
      !(MVerbA === W.Tell && !TellOK) &&
      !(MVerbA === W.Ask && Pos(4) && w !== W.Who) &&
      !(MVerbA === W.Ask && Pos(6) && (dosCompat ? w === P : w !== P)) && // FIX #14: the question is "who betrayed ME?"; DOS inverted the test and forbade the only meaningful word
      !(Pos(1) && w === W.Reveal && !CanTrade) &&
      !(Pos(1) && AuraW) &&
      !(PleadW && !CanPlead) &&
      AccuseOK &&
      !(w === W.Agree && !HeOffered) &&
      !(w === W.Reject && !HeOffered) &&
      !(w === W.Wait && HimHere) &&
      !(w === W.Go && HimHere) &&
      !(w === W.Answer && !HeAskedWho) &&
      !(Answering && !AnswerOK) &&
      !(!GreetOK && HimHere) &&
      ByeOK &&
      FeelOK &&
      !(w === W.NBetray && !CanNBetray) &&
      !(w === W.NAttack && !CanNAttack);
    if (ok) icons.push(w);
  }
  done(icons);
  return { forced: false };
}

// Which feeling (ObjectA2 of "say feeling") fits what the other character said last.
function feelingFits(w, LVerbA, LObjA2, dosCompat) {
  const any = (...v) => v.includes(LObjA2);
  switch (w) {
    case 114: case 115: return true;
    case 116: return (LVerbA === W.SayFeel && any(116, 120)) || LVerbA === W.NBetray || LVerbA === W.NAttack;
    case 118: return any(126, 121, 118, 115, 122, 125);
    case 117: return dosCompat ? LVerbA === 123 : LObjA2 === 123; // FIX #7: original compared LVerbA (never 123), so 'fear' was never offered
    case 121: return any(123, 121, 118, 127);
    case 119: return LVerbA === W.Threaten || LVerbA === W.Accuse || (LVerbA === W.SayFeel && any(123, 119, 117));
    case 120: return [W.Reveal, W.NBetray, W.NAttack].includes(LVerbA) || (LVerbA === W.SayFeel && any(120, 116, 114, 115));
    case 122: return LObjA2 === 126;
    case 123: return any(123, 127) || [W.Reveal, W.Ask, W.Accuse, W.Reject, W.Threat, W.Tell].includes(LVerbA);
    case 125: return any(122, 115) || LVerbA === W.Agree || LVerbA === W.Tell;
    case 126: return LObjA2 === 123 || LVerbA === W.Accuse;
    case 127: return any(123, 126, 127) || LVerbA === W.Accuse || LVerbA === W.Beg;
    default: return false;
  }
}
