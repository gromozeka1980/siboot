// Strategy bot: plays Vetvel through whole games on the real engine (no UI) and reports how often it wins.
// It sees only what the player knows (its own auras, the aura counts it has learnt, what was said to it).
//   node tools/bot.mjs [games per level = 20] [levels = 1,2,3] [length = 1] [policy = smart|random]
import { assets, Rng } from './harness.mjs';
import { Game } from '../src/engine/game.js';
import { W, ObjectB2, NIGHT, SUNSET, VerbA, ObjectA2 } from '../src/engine/constants.js';

const GAMES = Number(process.argv[2] || 20);
const LEVELS = (process.argv[3] || '1,2,3').split(',').map(Number);
const LENG = Number(process.argv[4] || 1);
const POLICY = process.argv[5] || 'smart2';   // random | smart (first version) | smart2
const MAX_DAYS = 40;
const STORY = process.env.STORY || 'smart';   // how the bot answers random-event stories: smart | random
const PAUSE_EVERY = Number(process.env.PE || 3);   // S: small talk after this many offers
const OFFER_CAP = Number(process.env.OC || 40);   // offers per visit; A/B 2026-10 (100 games): 40 beats 12 on level 3 (85 vs 67 wins), level 4 equal
// smart2 rules, switchable for A/B tests (env F, default all): D defence by EV, A night attack by EV,
// R deal details (whom to reveal/learn), C at most 4 offers per visit
// A/B 2026-10: only R helps; C ruins it (fewer deals = knows nothing)
const F = POLICY === 'smart2' ? new Set(process.env.F ?? 'R') : new Set();

const BEATER = { 1: 3, 2: 1, 3: 2 };   // the aura that beats a (tanaga>katsin>shial>tanaga)
const BEATS = { 1: 2, 2: 3, 3: 1 };
const worth = a => 10 * Math.min(...a) + a[0] + a[1] + a[2];   // the weakest aura matters most (8/8/8 wins)
/** Expected worth gain of playing each aura against a guess {1:p,2:p,3:p}; returns [best aura, ev]. */
function bestReply(mine, guess) {
  let best = 0, bestEV = -1e9;
  for (const c of [1, 2, 3]) {
    if (mine[c - 1] <= 0) continue;
    let ev = 0;
    for (const d of [1, 2, 3]) {
      const after = mine.slice();
      if (BEATS[c] === d) after[d - 1] = Math.min(8, after[d - 1] + 1);
      else if (BEATS[d] === c) after[c - 1] = Math.max(0, after[c - 1] - 1);
      ev += guess[d] * (worth(after) - worth(mine));
    }
    if (ev > bestEV) { bestEV = ev; best = c; }
  }
  return [best, bestEV];
}

/** A view that draws nothing: the engine's presentation calls, answered by the bot. */
class BotView {
  constructor(bot) { this.bot = bot; }
  async narrate() {} status() {} refreshRoom() {} clearCommand() {} async heard() {} showHeard() {} deal() {}
  async delay() {} feelings() {} noFeelings() {} face() {} clearFace() {} evening() {} morningTick() {}
  storyFile(n) { return assets.stories[n] || ''; }
  async story(story, run) { this.bot.stats.stories++; (this.bot.stats.nums ||= []).push(story.num); if (process.env.TRACE) console.log('day', this.bot.s.day, 'story', story.num, 'aslyn', this.bot.s.aslyn, 'parm19-23,44', [19,20,21,22,23,31,32,33,34,35,36,44].map(i => this.bot.s.storyParm[i]).join(',')); run(this.bot.storyChoice(story, run)); }
  combatRound() {}
  async combat(w1, w2, a1, a2) { this.bot.duel(w1, w2, a1, a2); }
  async defence(attacker) { return this.bot.defend(attacker); }
  async victory(who) { this.bot.winner = who; this.bot.g.quit = true; }
  midnight() { this.before = [0, 1, 2, 3, 4, 5, 6, 7].map(w => [1, 2, 3].map(k => this.bot.s.auraCnt[k][w][0])); }
  dawn() { // NPC progress: total aura points (max of the six) and points "gained" into an already full aura (wasted wins)
    const s = this.bot.s, st = this.bot.stats;
    let mx = 0;
    for (let w = 2; w <= 7; w++) { const a = [1, 2, 3].map(k => s.auraCnt[k][w][0]); mx = Math.max(mx, a[0] + a[1] + a[2]);
      for (let k = 0; k < 3; k++) if (this.before[w][k] === 8 && a[k] === 8) st.fullNights = (st.fullNights || 0) + 1; }
    (st.npcMax ||= []).push(mx);
  }
}

class Bot {
  constructor(seed, level) {
    this.rng = new Rng(seed * 31 + 7);
    this.g = new Game(assets, new BotView(this));
    this.g.rng = new Rng(seed);
    this.g.initChars(); this.g.initGame(level, LENG, true);
    this.s = this.g.s; this.P = this.s.player;
    this.winner = 0; this.talk = 0; this.sincePause = 0; this.pause = false; this.stats = { duels: 0, won: 0, lost: 0, deals: 0, stories: 0, offered: 0, gotOffers: 0, myDealsTaken: 0 };
  }
  rand(n) { return Math.floor(this.rng.next() * n); }
  known(w, k) { return this.s.auraCnt[k][w][this.P]; }
  mine(k) { return this.s.auraCnt[k][this.P][this.P]; }
  weakest() { return [1, 2, 3].reduce((a, k) => (this.mine(k) < this.mine(a) ? k : a), 1); }
  /** Their likely play (the AI casts the aura that beats its own weakest), from what we know; 0 if unknown. */
  predict(w) {
    const ks = [1, 2, 3].filter(k => this.known(w, k) >= 0);
    if (!ks.length) return 0;
    return BEATER[ks.reduce((a, k) => (this.known(w, k) < this.known(w, a) ? k : a))];
  }

  /** smart2: what w will probably play, as a distribution, from what we know and the chosen level's AI habit. */
  guessOf(w) {
    const s = this.s, ks = [1, 2, 3].filter(k => this.known(w, k) >= 0);
    const g = { 1: 1 / 3, 2: 1 / 3, 3: 1 / 3 };
    if (!ks.length) return g;
    const est = [1, 2, 3].map(k => (this.known(w, k) >= 0 ? this.known(w, k) : 6));
    let pick;
    if (s.level <= 2) pick = BEATER[ks.reduce((a, k) => (this.known(w, k) < this.known(w, a) ? k : a))];
    else if (s.level === 3) pick = ks.reduce((a, k) => (this.known(w, k) > this.known(w, a) ? k : a));   // its formula favours the strongest
    else pick = bestReply(est, { 1: 1 / 3, 2: 1 / 3, 3: 1 / 3, [BEATER[this.weakest()]]: 0.6 })[0] || 1;
    const sure = Math.min(0.95, 0.55 + 0.15 * ks.length);   // the AI's habit is deterministic: trust the prediction
    for (const k of [1, 2, 3]) g[k] = (1 - sure) / 3 + (k === pick ? sure : 0);
    return g;
  }
  myAuras() { return [1, 2, 3].map(k => this.mine(k)); }
  /** Estimated total of w's auras (unknown counted as 6): who is closest to winning. */
  threat(w) { return [1, 2, 3].reduce((t, k) => t + (this.known(w, k) >= 0 ? this.known(w, k) : 6), 0); }

  duel(w1, w2, a1, a2) {
    if (w1 !== this.P && w2 !== this.P) return;
    this.stats.duels++;
    if (a1 === a2) return;
    const won1 = (a1 === 1 && a2 === 2) || (a1 === 2 && a2 === 3) || (a1 === 3 && a2 === 1);
    if ((won1 ? w1 : w2) === this.P) this.stats.won++; else this.stats.lost++;
  }

  defend(attacker) {
    const can = [1, 2, 3].filter(k => this.mine(k) > 0);
    if (POLICY === 'random') return can[this.rand(can.length)];
    if (F.has('D')) return bestReply(this.myAuras(), this.guessOf(attacker))[0] || can[0];
    const p = this.predict(attacker);
    const best = p && BEATER[p];
    if (best && this.mine(best) > 0) return best;
    return can.reduce((a, k) => (this.mine(k) > this.mine(a) ? k : a));   // unknown: play the strongest
  }

  /** STORY=smart (default): try every answer on the real state, score it, roll back, pick the best; STORY=random: any. */
  storyChoice(story, run) {
    if (POLICY === 'random' || STORY === 'random') return 1 + this.rand(story.options.length);
    const s = this.s, P = this.P, N = s.numChars;
    const snap = structuredClone(s);
    const feel = () => { let v = 0; for (let j = 1; j <= N; j++) if (j !== P) v += s.love[j][P] + s.trust[j][P] + 0.25 * s.fear[j][P]; return v; };
    const known = () => { let n = 0; for (let j = 1; j <= N; j++) for (let k = 1; k <= 3; k++) if (s.auraCnt[k][j][P] >= 0) n++; return n; };
    const f0 = feel(), k0 = known(), a0 = s.aslyn;
    let best = 1, bestV = -1e9;
    for (let o = 1; o <= story.options.length; o++) {
      run(o);
      const v = feel() - f0 + 40 * (known() - k0) - 6 * (s.aslyn - a0);   // auras (story 44) >> feelings; stay friendly with Aslyn
      if ((STORY === 'worst' ? -v : v) > bestV) { bestV = STORY === 'worst' ? -v : v; best = o; }   // worst: A/B, does it matter at all?
      for (const k of Object.keys(snap)) s[k] = structuredClone(snap[k]);
    }
    this.stats.storyGain = (this.stats.storyGain || 0) + bestV;
    return best;
  }

  /** The word for the next slot, from the allowed list `ids`. */
  choose(ids) {
    const s = this.s, P = this.P, idx = s.sntcIndx, S = s.sentence[P], him = s.interloc[P];
    if (POLICY === 'random') return ids[this.rand(ids.length)];
    const has = w => ids.includes(w), first = (...ws) => ws.find(has);

    if (s.time > NIGHT) {                         // attack
      if (idx === 1) {
        const plan = this.attackPlan();
        this.plan = plan;
        return plan ? 52 + plan.cast : ids[0];
      }
      if (idx === 2 && this.plan && has(this.plan.target)) return this.plan.target;
      return ids[0];
    }
    if (idx === 1) {
      if (him > 0) {
        this.talk++;
        if (!s.helloFlg[P] && has(W.Greet)) return W.Greet;
        const L = s.lastSntc[him];
        if (L[VerbA] === W.Reveal && L[ObjectA2] !== W.That) this.stats.gotOffers++;
        if (L[VerbA] === W.Agree && s.lastSntc[P][VerbA] === W.Reveal) this.stats.myDealsTaken++;
        if (L[VerbA] === W.Reveal && L[ObjectA2] !== W.That && (has(W.Agree) || has(W.Reject))) {
          const y = L[ObjectA2], b = L[5] - 35;     // what I would learn
          // N (A/B): never accept
          const learn = y >= 1 && y <= 7 && b >= 1 && b <= 3 && this.known(y, b) < 0;
          if (learn && has(W.Agree) && !F.has('N')) { this.stats.deals++; return W.Agree; }
          return first(W.Reject, W.Agree);
        }
        if (has(W.Answer)) return W.Answer;
        // S: every PAUSE_EVERY offers, small talk instead - a sentence the listener has no reply to gives him the initiative,
        // and only then can he offer a deal himself
        if (F.has('S') && has(W.SayFeel) && this.sincePause >= PAUSE_EVERY) { this.sincePause = 0; this.pause = true; return W.SayFeel; }
        if (has(W.Reveal) && this.talk < (F.has('C') ? 4 : OFFER_CAP)) { this.stats.offered++; this.sincePause++; return W.Reveal; }
        if (has(W.NAttack) && this.talk < 6) return W.NAttack;
        if (has(W.NBetray) && this.talk < 6) return W.NBetray;
        if (has(W.SayFeel) && this.talk < 5) return W.SayFeel;
        if (has(W.Goodbye)) { this.talk = 0; return W.Goodbye; }
        return ids[0];
      }
      this.talk = 0;
      if (process.env.HOME_WAIT && s.charLocn[P] === P && s.time < 720 && has(W.Wait)) return W.Wait;   // A/B: receive visitors at home in the morning
      if (has(W.Go)) return W.Go;
      return first(W.Wait) ?? ids[0];
    }
    if (S[VerbA] === W.Greet) return first(W.Warm, W.Nice, W.Sincere) ?? ids[0];
    if (S[VerbA] === W.SayFeel && this.pause) { this.pause = false; return first(W.STalk, W.Flatter) ?? ids[0]; }
    if (S[VerbA] === W.SayFeel) return first(W.Flatter, W.STalk, W.Love, W.Trust) ?? ids[0];
    if (S[VerbA] === W.Answer) return first(W.Nobody) ?? ids[0];   // never gossip (that betrays someone)
    if (S[VerbA] === W.Go && idx === 2) {        // the house of someone we know least about, not visited today
      const houses = ids.filter(w => w >= 57 && w <= 63 && w - 56 !== P);
      const score = w => [1, 2, 3].filter(k => this.known(w - 56, k) >= 0).length + 3 * s.visits[P][w - 56];
      return houses.sort((a, b) => score(a) - score(b))[0] ?? ids[0];
    }
    if (F.has('R') && S[VerbA] === W.Reveal) {   // deal details
      const people = ids.filter(w => w >= 1 && w <= 7);
      const auras = ids.filter(w => w >= 36 && w <= 38);
      if (people.length && idx === 2) return people[0];                       // the listener (forced)
      if (people.length && idx === 6) {                                        // whose aura to learn: a dangerous, little-known rival
        const unknown = w => [1, 2, 3].filter(k => this.known(w, k) < 0).length;
        return people.sort((a, b) => (this.threat(b) + 3 * unknown(b)) - (this.threat(a) + 3 * unknown(a)))[0];
      }
      if (people.length) return people.sort((a, b) => this.threat(b) - this.threat(a))[0];   // reveal the leader: others will fight him
      if (auras.length) return auras[0];
    }
    return ids[this.rand(ids.length)];           // other details: any allowed choice
  }

  /** Night: maximise the chance to win, preferring a duel that pays in our weakest aura. */
  attackPlan() {
    if (F.has('A')) {
      let best = null;
      for (let w = 1; w <= 7; w++) if (w !== this.P && !this.s.nAttack[this.P][w] && [1, 2, 3].some(k => this.known(w, k) >= 0)) {   // known targets only; never break our own promise
        const [cast, ev] = bestReply(this.myAuras(), this.guessOf(w));
        if (!cast) continue;
        const v = ev + 0.05 * (this.threat(w) - 18);   // a little preference for slowing down the leader
        if (!best || v > best.v) best = { target: w, cast, v };
      }
      return best;
    }
    const weak = this.weakest();
    let best = null;
    for (let w = 1; w <= 7; w++) if (w !== this.P) {
      const p = this.predict(w);
      if (!p) continue;
      const cast = BEATER[p];
      if (this.mine(cast) <= 0) continue;
      const v = (p === weak ? 2 : 1) - (this.s.nAttack[this.P][w] ? 5 : 0);   // never break our own promise
      if (!best || v > best.v) best = { target: w, cast, v };
    }
    if (best && best.v > 0) return best;
    const cast = [1, 2, 3].filter(k => this.mine(k) > 0).sort((a, b) => this.mine(b) - this.mine(a))[0];
    const targets = [1, 2, 3, 4, 5, 6, 7].filter(w => w !== this.P && !this.s.nAttack[this.P][w]);
    return cast && targets.length ? { target: targets[this.rand(targets.length)], cast } : null;
  }

  async play() {
    const s = this.s, g = this.g;
    let moves = 0;
    while (!g.quit && s.day <= MAX_DAYS) {
      while (s.sntcIndx !== ObjectB2) {
        if (s.iconCount === 0) { g.chooseWord(0); continue; }
        g.chooseWord(this.choose(s.iconID.slice(1, s.iconCount + 1).map(Math.abs)));
      }
      await g.execMove();
      if (!g.quit) g.endSntc();
      if (++moves > 30000) throw new Error('too many moves');
    }
    return { winner: this.winner, day: s.day, auras: [1, 2, 3].map(k => this.mine(k)), ...this.stats };
  }
}

for (const level of LEVELS) {
  const res = [];
  for (let n = 0; n < GAMES; n++) res.push(await new Bot(1000 + n, level).play());
  const won = res.filter(r => r.winner === 1), lost = res.filter(r => r.winner > 1), none = res.filter(r => !r.winner);
  const avg = (a, f) => (a.length ? (a.reduce((x, r) => x + f(r), 0) / a.length).toFixed(1) : '-');
  if (process.env.STN) { const c = {}; for (const r of res) for (const n of r.nums || []) c[n] = (c[n] || 0) + 1; console.log('stories/game', (res.reduce((x, r) => x + r.stories, 0) / res.length).toFixed(1), JSON.stringify(c)); }
  const byWinner = {};
  for (const r of lost) byWinner[r.winner] = (byWinner[r.winner] || 0) + 1;
  console.log(`level ${level} (${POLICY}${F.size ? ':' + [...F].join('') : ''}, length ${LENG}, ${GAMES} games): Vetvel wins ${won.length}, loses ${lost.length}, undecided ${none.length}` +
    ` | days to win ${avg(won, r => r.day)}, to lose ${avg(lost, r => r.day)} | duels won/lost ${avg(res, r => r.won)}/${avg(res, r => r.lost)}` +
    ` | accepted ${avg(res, r => r.deals)} offers made ${avg(res, r => r.offered)} taken ${avg(res, r => r.myDealsTaken)} received ${avg(res, r => r.gotOffers)} | other winners ${JSON.stringify(byWinner)}`);
}
