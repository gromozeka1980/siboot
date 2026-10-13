// Turns an eeyal sentence (8 word slots) into a plain-language line for the remake's dialogue log.
// English templates are the defaults below; other languages override them in assets/i18n/<lang>/ui.json
// under the same keys ("gloss.*"). Placeholders: {S} speaker, {O} listener, {X}/{Y} third persons,
// {A}/{B} aura names, {N} a number; a case suffix ({O.dat}) asks the grammar for that case.
// {m|f} chooses by the gender of X (the betrayer in reports).

import { W, SubjectA, VerbA, ObjectA1, ObjectA2, SubjectB, VerbB, ObjectB1, ObjectB2 } from '../engine/constants.js';
import { i18n } from '../i18n/i18n.js';

export const GLOSS_EN = {
  'gloss.greet': '{S} greets {O} {T}.',
  'gloss.tone.27': 'warmly', 'gloss.tone.28': 'nicely', 'gloss.tone.29': 'sincerely', 'gloss.tone.30': 'coolly',
  'gloss.tone.31': 'threateningly', 'gloss.tone.32': 'haughtily', 'gloss.tone.33': 'formally',
  'gloss.bye': '{S} says goodbye to {O}.',
  'gloss.feel.114': '{S} makes small talk with {O}.', 'gloss.feel.115': '{S} flatters {O}.',
  'gloss.feel.116': '{S} tells {O}: “I trust you.”', 'gloss.feel.117': '{S} tells {O}: “I fear you.”',
  'gloss.feel.118': '{S} tells {O}: “I love you.”', 'gloss.feel.119': '{S} tells {O}: “I don’t fear you.”',
  'gloss.feel.120': '{S} tells {O}: “I don’t trust you.”', 'gloss.feel.121': '{S} tells {O}: “I don’t love you.”',
  'gloss.feel.122': '{S} forgives {O}.', 'gloss.feel.123': '{S} yells at {O}.', 'gloss.feel.125': '{S} thanks {O}.',
  'gloss.feel.126': '{S} apologises to {O}.', 'gloss.feel.127': '{S} derides {O}.',
  'gloss.accuse.47': '{S} accuses {O} of betrayal.',
  'gloss.accuse.90': '{S} accuses {O} of breaking the promise not to betray.',
  'gloss.accuse.91': '{S} accuses {O} of breaking the promise not to attack.',
  'gloss.offer': '{S} offers {O}: “I’ll tell you {X}’s {A} count if you tell me {Y}’s {B} count.”',
  'gloss.begOffer': '{S} begs {O} to trade: {X}’s {A} count for {Y}’s {B} count.',
  'gloss.threatOffer': '{S} threatens {O}, demanding a trade: {X}’s {A} count for {Y}’s {B} count.',
  'gloss.begAsk': '{S} begs {O} to say who betrayed {Y}.',
  'gloss.threatAsk': '{S} threatens {O}, demanding to know who betrayed {Y}.',
  'gloss.fact': '{S} tells {O}: {X}’s {A} count is {N}.',
  'gloss.tell': '{S} tells {O}: {X} betrayed {Y}.', 'gloss.tellNobody': '{S} tells {O}: nobody betrayed {Y}.',
  'gloss.answer': '{S} answers {O}: {X} betrayed {Y}.', 'gloss.answerNobody': '{S} answers {O}: nobody betrayed {Y}.',
  'gloss.ask': '{S} asks {O} who betrayed {Y}.', 'gloss.askMe': '{S} asks {O}: “Who betrayed me?”',
  'gloss.begAskMe': '{S} begs {O}: “Tell me who betrayed me!”', 'gloss.threatAskMe': '{S} threatens {O}: “Tell me who betrayed me!”',
  'gloss.agree': '{S} accepts the deal.', 'gloss.reject': '{S} rejects the deal.',
  'gloss.wait': '{S} waits.', 'gloss.go': '{S} goes to {X}’s house.', 'gloss.goHome': '{S} goes home.',
  'gloss.nbetray': '{S} promises {O} not to betray them today.',
  'gloss.nattack': '{S} promises {O} not to attack them tonight.',
  'gloss.attack': '{S} attacks {O} with {A}.',
  'gloss.aura.1': 'tanaga', 'gloss.aura.2': 'katsin', 'gloss.aura.3': 'shial',
  'gloss.auraGen.1': 'tanaga', 'gloss.auraGen.2': 'katsin', 'gloss.auraGen.3': 'shial',
  'gloss.auraIns.1': 'tanaga', 'gloss.auraIns.2': 'katsin', 'gloss.auraIns.3': 'shial',
};

const t = k => i18n.t(k, GLOSS_EN[k]);

/** Plain-language line for sentence S (array, slots 1..8), or '' if it says nothing. */
export function gloss(S, g) {
  const name = (who, cse) => i18n.name(who, cse, g);
  const aura = (n, f = 'aura') => t(`gloss.${f}.` + n);
  const fill = (key, v) => t(key).replace(/\{([A-Z])(?:\.(\w+))?\}|\{([^{}|]*)\|([^{}|]*)\}/g, (m, k, cse, a, b) => {
    if (a !== undefined) return i18n.gender(v.X, g) === 'f' ? b : a;
    const x = v[k];
    if (typeof x === 'number' && x >= 1 && x <= 8 && 'SOXY'.includes(k)) return name(x, cse || 'nom');
    return x ?? m;
  });
  // a beg/threat still being built is a bare verb; the engine fills it from the speaker's previous sentence when it is
  // said (game.js execSntc), so the preview must do the same
  if ((S[VerbA] === W.Beg || S[VerbA] === W.Threat) && !S[ObjectA2] && g?.s?.lastSntc?.[S[SubjectA]]?.[ObjectA2])
    S = S.map((x, i) => (i >= 3 ? g.s.lastSntc[S[SubjectA]][i] : x));
  const sp = S[SubjectA], v = S[VerbA], o = S[ObjectA1], o2 = S[ObjectA2];
  const sb = S[SubjectB], vb = S[VerbB], ob = S[ObjectB1], ob2 = S[ObjectB2];
  const base = { S: sp, O: o };
  const offer = key => fill(key, { ...base, X: o2, A: aura(sb - 35, 'auraGen'), Y: ob, B: aura(ob2 - 35, 'auraGen') });
  switch (v) {
    case W.Greet: return fill('gloss.greet', { ...base, T: t('gloss.tone.' + o2) });
    case W.Goodbye: return fill('gloss.bye', base);
    case W.SayFeel: return fill('gloss.feel.' + o2, base);
    case W.Accuse: return fill('gloss.accuse.' + vb, base);
    case W.Reveal:
      if (o2 === W.That) return fill('gloss.fact', { ...base, X: sb, A: aura(vb - 35, 'auraGen'), N: ob - 104 });
      return offer('gloss.offer');
    case W.Beg: case W.Threat: {
      const k = v === W.Beg ? 'beg' : 'threat';
      return o2 === W.That ? fill(`gloss.${k}Ask${ob === sp ? 'Me' : ''}`, { ...base, Y: ob }) : offer(`gloss.${k}Offer`);
    }
    case W.Tell: case W.Answer: {
      const k = v === W.Tell ? 'tell' : 'answer';
      return sb === W.Nobody ? fill(`gloss.${k}Nobody`, { ...base, Y: ob }) : fill(`gloss.${k}`, { ...base, X: sb, Y: ob });
    }
    case W.Ask: return fill(ob === sp ? 'gloss.askMe' : 'gloss.ask', { ...base, Y: ob });
    case W.Agree: return fill('gloss.agree', base);
    case W.Reject: return fill('gloss.reject', base);
    case W.Wait: return fill('gloss.wait', base);
    case W.Go: return o - 56 === sp ? fill('gloss.goHome', base) : fill('gloss.go', { ...base, X: o - 56 });
    case W.NBetray: return fill('gloss.nbetray', base);
    case W.NAttack: return fill('gloss.nattack', base);
    case W.TanagaAttack: case W.KatsinAttack: case W.ShialAttack: return fill('gloss.attack', { ...base, A: aura(v - 52, 'auraIns') });
    default: return '';
  }
}

/** The words of a sentence that are shown as icons (slots with a word). */
export const sentenceWords = S => [1, 2, 3, 4, 5, 6, 7, 8].map(i => S[i]).filter(w => w > 0 && w !== W.Pause);
