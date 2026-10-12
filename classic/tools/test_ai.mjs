// Self-check for engine/ai.js: node tools/test_ai.mjs
// Builds a Game with a stub UI, runs planMove in simple situations and a few thousand random
// NPC-vs-NPC dialog turns, and checks invariants (well-formed sentences, clamped feelings).
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// game.js imports modules that may not be ported yet: stub them if missing
registerHooks({
  resolve(spec, ctx, next) {
    if (/\/(combat|events)\.js$/.test(spec)) {
      const url = new URL(spec, ctx.parentURL);
      if (!existsSync(fileURLToPath(url)))
        return { url: 'data:text/javascript,export const midnight=async()=>{};export const randEvent=async()=>{};', shortCircuit: true };
    }
    return next(spec, ctx);
  },
});

const { Game } = await import('../src/engine/game.js');
const { planMove } = await import('../src/engine/ai.js');
const { Rng } = await import('../src/engine/rng.js');
const C = await import('../src/engine/constants.js');
const { W, VerbA, ObjectA1, ObjectA2, SubjectA, SNTC_LENG, DLOG_MAX, DAWN } = C;

const faces = [];
const ui = { makeAFace: (him, f) => faces.push([him, f]), fillArea() {}, myWait: async () => {} };

function newGame(seed) {
  const g = new Game({}, ui);
  g.rng = new Rng(seed);
  g.initChars();
  g.initGame(1, 1);
  return g;
}

function checkSentence(g, me) {
  const s = g.s, S = s.sentence[me];
  for (let i = 1; i <= SNTC_LENG; i++) assert.ok(Number.isInteger(S[i]) && S[i] >= 0 && S[i] <= 128, `slot ${i} = ${S[i]}`);
  assert.equal(S[SubjectA], me);
  const v = S[VerbA], him = s.interloc[me];
  const talk = [W.Greet, W.Goodbye, W.SayFeel, W.Tell, W.Ask, W.Accuse, W.Reveal, W.Agree, W.NBetray, W.NAttack];
  if (talk.includes(v)) assert.equal(S[ObjectA1], him, `verb ${v} addressed to ${S[ObjectA1]}, not ${him}`);
  if (v === W.Go) assert.ok(S[ObjectA1] >= 57 && S[ObjectA1] <= 63);
  if (v === W.SayFeel) assert.ok(S[ObjectA2] >= W.STalk && S[ObjectA2] <= W.Deride);
  for (const k of ['love', 'trust', 'fear']) for (let a = 1; a <= 7; a++) for (let b = 1; b <= 7; b++)
    assert.ok(Math.abs(s[k][a][b]) <= 127, `${k}[${a}][${b}]`);
  for (const k of ['loveMood', 'trstMood', 'fearMood']) assert.ok(Math.abs(s[k][me]) <= 127 || s[k][me] === undefined);
}

async function plan(g, me) { g.s.me = me; await planMove(g); checkSentence(g, me); return g.s.sentence[me]; }

// minimal stand-in for execSntc's dialog bookkeeping
function say(g, who) {
  const s = g.s, S = s.sentence[who];
  for (let i = 1; i <= SNTC_LENG; i++) s.lastSntc[who][i] = S[i];
  let x = s.dlogIndx[who] + 1;
  if (x > DLOG_MAX) { x = DLOG_MAX; for (let j = 2; j <= DLOG_MAX; j++) s.dlogHist[who][j - 1] = s.dlogHist[who][j].slice(); }
  s.dlogIndx[who] = x;
  s.dlogHist[who][x] = S.slice();
  if (S[VerbA] === W.Greet) s.helloFlg[who] = true;
}

// 1. dawn, alone at home: go visiting (never own house) or wait
{
  const g = newGame(1);
  g.s.player = 1; g.s.time = DAWN;
  const S = await plan(g, 2);
  assert.ok(S[VerbA] === W.Wait || (S[VerbA] === W.Go && S[ObjectA1] !== 58), `alone: ${S}`);
}

// 2. evening, visiting someone: say goodbye
{
  const g = newGame(2);
  g.s.time = 1230;
  g.initDialog(2, 3);
  const S = await plan(g, 2);
  assert.equal(S[VerbA], W.Goodbye);
}

// 3. first line of a visit is a greeting
{
  const g = newGame(3);
  g.s.time = DAWN + 10;
  g.initDialog(4, 5);
  const S = await plan(g, 4);
  assert.equal(S[VerbA], W.Greet);
  assert.ok([W.Warm, W.Nice, W.Sincere, W.Formal, W.Haughty, W.Cool, W.Threaten].includes(S[ObjectA2]));
}

// 4. random NPC dialogs with some betrayal history
const seen = new Set();
for (let seed = 10; seed < 400; seed++) {
  const g = newGame(seed), s = g.s;
  s.player = 1; s.time = DAWN + (seed % 600);
  const r = n => 1 + Math.abs(g.random()) % n;
  for (let k = 0; k < 6; k++) { const a = 1 + r(6), b = 1 + r(6); if (a !== b) g.postHist(a, b, 1 + r(6)); }
  if (seed % 3 === 0) s.nBetrayCount[3][2] = 1;
  const guest = 2 + (seed % 3), host = 5 + (seed % 3);
  g.initDialog(guest, host);
  let who = guest;
  for (let turn = 0; turn < 40; turn++) {
    const S = await plan(g, who);
    seen.add(S[VerbA]);
    if (S[VerbA] === W.Goodbye || S[VerbA] === 0) break;
    say(g, who);
    who = who === guest ? host : guest;
  }
}
for (const v of [W.Greet, W.Goodbye, W.SayFeel, W.Ask, W.Tell]) assert.ok(seen.has(v), `verb ${v} never planned`);
assert.ok(faces.length > 0);
console.log('test_ai: ok; verbs planned:', [...seen].sort((a, b) => a - b).join(' '));
