// Headless playthrough smoke test: real engine + UI code against a fake canvas and a scripted
// "player" (random words, clicks through narrations, stories and combat) until somebody wins.
//   node tools/test_playthrough.mjs [games=3] [maxDays=40] [seed]
import { makeGame, ObjectB2 } from './harness.mjs';

const games = Number(process.argv[2] || 3), maxDays = Number(process.argv[3] || 40);
let seed = Number(process.argv[4] || 12345);
for (let n = 0; n < games; n++, seed++) {
  const { game, ui, input, ctl } = makeGame({ seed, botSeed: seed * 7 + 1,
    level: Number(process.env.LEVEL || 1 + (n % 3)), leng: Number(process.env.LENG || 1 + (n % 3)) });
  let winner = 0;
  ui.onGameOver = async w => { winner = w; game.quit = true; };
  const s = game.s;
  let moves = 0;
  while (!game.quit && s.day <= maxDays) {
    // compose a random sentence the way the player would
    while (s.sntcIndx !== ObjectB2) {
      if (s.iconCount === 0) { game.chooseWord(0); continue; }
      const w = s.iconID[1 + Math.floor(input.rng.next() * s.iconCount)];
      game.chooseWord(Math.abs(w));
    }
    const before = [s.day, s.time];
    await game.execMove();
    ctl.newSentence();
    if (process.env.TRACE) process.stderr.write(`move ${moves} ${before} -> day ${s.day} ${s.time} verb ${s.lastSntc[s.player][2]}\n`);
    if (++moves % 50 === 0) await new Promise(r => setImmediate(r)); // let timers/IO run
    if (moves > 20000) throw new Error('too many moves');
  }
  const auras = [1, 2, 3].map(j => s.auraCnt[j][s.player][0]).join('/');
  console.log(`game ${n + 1}: seed ${seed} level ${s.level} length ${s.gameLeng} -> ${winner ? 'winner ' + game.charName(winner) : 'no winner'} on day ${s.day}, moves ${moves}, player auras ${auras}, history ${s.hist.length}`);
}
console.log('playthrough OK');
