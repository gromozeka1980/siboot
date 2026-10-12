// Finds RNG offsets that make a headless run reproduce an observation from the DOS game.
import { makeGame, ObjectB2 } from './harness.mjs';
const M = 0x08088405, mod = 2n ** 32n;
let inv = 1n; for (let i = 0; i < 6; i++) inv = (inv * (2n - BigInt(M) * inv)) % mod; inv = (inv + mod) % mod;
const back = s => Number(((BigInt(s) - 1n + mod) % mod * inv) % mod);
async function run(k, when) {
  const { game } = makeGame({ seed: 0, dosCompat: true });
  const s = game.s;
  const shift = () => { if (k > 0) for (let i = 0; i < k; i++) game.rng.nextSeed(); else for (let i = 0; i < -k; i++) game.rng.seed = back(game.rng.seed); };
  if (when === 0) shift();
  for (let step = 1; step <= 2; step++) {
    if (when === step) shift();
    while (s.sntcIndx !== ObjectB2) game.chooseWord(s.iconCount !== 1 && s.iconID.includes(86) ? 86 : Math.abs(s.iconID[1]));
    await game.execMove(); game.endSntc();
  }
  return { time: s.time, visitor: s.interloc[1] };
}
for (const when of [0, 1, 2]) for (let k = -12; k <= 12; k++) {
  const r = await run(k, when);
  if (r.visitor === 3 && r.time === 566) console.log('when', when, 'k', k, JSON.stringify(r));
}
console.log('baseline', JSON.stringify(await run(0, 0)));
