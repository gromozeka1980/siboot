// "What should I do?": advice from what the player knows (never from hidden state), in plain language.
// Night advice follows the AI's own aura choice (engine/combat.js pickAura, levels 1-2): a defender usually plays
// the aura that beats its own weakest aura, hoping to win a point of it.

import { W, SUNSET, NIGHT, ObjectA2, VerbA } from '../engine/constants.js';
import { i18n } from '../i18n/i18n.js';

const BEATS = { 1: 2, 2: 3, 3: 1 };          // tanaga beats katsin, katsin beats shial, shial beats tanaga
const BEATER = { 2: 1, 3: 2, 1: 3 };         // the aura that beats a
const EN = {
  greet: 'Greet {X} first: “greet” and a tone. A warm tone pleases those who like you; a cool one is safer with those who don’t.',
  offerYes: '{X} offers a trade. Accepting tells you {Y}’s {B} count (you don’t know it) — but betrays {Z}, whose aura you give away.',
  offerNo: '{X} offers a trade, but you would learn nothing new. Better to reject.',
  canDeal: 'Offer {X} a deal (“offer-reveal”): trade an aura count you know for one you don’t. Trade often — every deal shows you someone’s aura, and in our bot tests the player who traded most won most.',
  dealGive: 'Whose aura to give away: preferably the strongest rival’s — {X} looks closest to winning. Others will then know how to beat {XA}.',
  dealLearn: 'Whose aura to learn: someone dangerous you know little about — {X}.',
  noDeal: 'You have nothing to trade with {X} now. Flattery or small talk raise their love; a promise raises their trust. Or say goodbye and visit someone else.',
  promise: 'Promising “won’t betray” or “won’t attack” raises trust — but breaking it later costs much more.',
  alone: 'Visit someone. You know least about {X}’s auras — a deal there teaches you most. Pick “go to” and {Y}.',
  waitHome: 'It is evening: go home before nightfall.',
  night: 'Your weakest aura is {A} ({N}). To win a point of it, beat someone who plays {A}: attack with {C}. {X} looks likely to play {A} (the weakest aura of {XG} you know of is {D}).',
  nightBlind: 'Your weakest aura is {A}. You know too little about the others to predict them; {C} is a fair gamble.',
  night0: 'You have no aura points left to attack with: wait for the night to pass.',
  generic: 'Build a sentence from the icons below and press “Say it”.',
};
const t = (k, v = {}) => Object.entries(v).reduce((s, [a, b]) => s.replaceAll(`{${a}}`, b), i18n.t('adv.' + k, EN[k]));
const aura = (n, f = 'aura') => i18n.t(`m.${f}.${n}`, ['', 'tanaga', 'katsin', 'shial'][n]);

export function advise(g) {
  const s = g.s, P = s.player, N = s.numChars, A = s.auraCnt, him = s.interloc[P];
  const name = (w, c) => i18n.name(w, c || 'nom', g);
  const ids = s.iconID.slice(1, s.iconCount + 1).map(Math.abs);
  const known = (w, k) => A[k][w][P];

  if (s.time > NIGHT) {
    const mine = [1, 2, 3].map(k => A[k][P][P]);
    if (mine.every(v => v <= 0)) return t('night0');
    const weak = [1, 2, 3].reduce((a, k) => (mine[k - 1] < mine[a - 1] ? k : a), 1);
    const cast = BEATER[weak];                       // beats the aura we want to win
    // a target whose weakest known aura is X likely plays BEATER[X]; we want them to play `weak`
    let best = null;
    for (let j = 1; j <= N; j++) if (j !== P) {
      const ks = [1, 2, 3].filter(k => known(j, k) >= 0);
      if (!ks.length) continue;
      const lo = ks.reduce((a, k) => (known(j, k) < known(j, a) ? k : a));
      if (BEATER[lo] === weak && (!best || known(j, lo) < known(best.j, best.lo))) best = { j, lo };
    }
    return best ? t('night', { A: aura(weak), AI: aura(weak, 'auraIns'), N: mine[weak - 1], C: aura(cast, 'auraIns'), X: name(best.j), XG: name(best.j, 'gen'), D: aura(best.lo) })
      : t('nightBlind', { A: aura(weak), C: aura(cast) });
  }
  if (s.time >= SUNSET && s.charLocn[P] !== P) return t('waitHome');
  if (him > 0) {
    if (!s.helloFlg[P]) return t('greet', { X: name(him, 'ins') });
    const L = s.lastSntc[him];
    if (L[VerbA] === W.Reveal && L[ObjectA2] !== W.That) {
      // ai.js: setSntc(Reveal, Him, j, L+35, Reveal, i, K+35) = "I tell you j's aura L if you tell me i's aura K":
      // I would learn y = j's aura b, and betray z = i by revealing his aura
      const y = L[ObjectA2], b = L[5] - 35, z = L[7];
      return y >= 1 && y <= N && b >= 1 && b <= 3 && known(y, b) < 0
        ? t('offerYes', { X: name(him), Y: name(y, 'gen'), B: aura(b, 'auraGen'), Z: name(z, 'acc') })
        : t('offerNo', { X: name(him) });
    }
    const S = s.sentence[P], people = ids.filter(w => w >= 1 && w <= N);
    if (S[VerbA] === W.Reveal && people.length > 1 && s.sntcIndx !== 2) {   // building an offer: the bot's best rule (tools/bot.mjs, rule R)
      const threat = w => [1, 2, 3].reduce((t, k) => t + (known(w, k) >= 0 ? known(w, k) : 6), 0);
      const unknown = w => [1, 2, 3].filter(k => known(w, k) < 0).length;
      if (s.sntcIndx === 6) return t('dealLearn', { X: name(people.sort((a, b) => threat(b) + 3 * unknown(b) - threat(a) - 3 * unknown(a))[0]) });
      const lead = people.sort((a, b) => threat(b) - threat(a))[0];
      return t('dealGive', { X: name(lead), XA: name(lead, 'acc') });
    }
    if (s.sntcIndx === 1 && ids.includes(W.Reveal)) return t('canDeal', { X: name(him, 'dat') });
    if (s.sntcIndx === 1 && (ids.includes(W.NBetray) || ids.includes(W.NAttack)) && Math.random() < 0.3) return t('promise');
    return t('noDeal', { X: name(him, 'ins') });
  }
  if (s.sntcIndx === 1 && ids.includes(W.Go)) {
    let least = 0, n = 9;
    for (let j = 1; j <= N; j++) if (j !== P) {
      const c = [1, 2, 3].filter(k => known(j, k) >= 0).length;
      if (c < n && s.visits[P][j] === 0) { n = c; least = j; }
    }
    if (least) return t('alone', { X: name(least, 'gen'), Y: i18n.t('m.homeOf', '{X}’s house').replace('{X}', name(least, 'gen')) });
  }
  return t('generic');
}
