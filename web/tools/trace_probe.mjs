import { makeGame, ObjectB2 } from './harness.mjs';
const { game } = makeGame({ seed: 0, dosCompat: true });
const s = game.s;
const orig = game.execSntc.bind(game);
game.execSntc = async who => { const S = s.sentence[who]; if (who !== 1 && S[2] !== 102) console.log(s.time, game.charName(who), 'verb', S[2], 'obj', S[3], 'loc', s.charLocn[who]); return orig(who); };
let n = 0; const r = game.rng.random.bind(game.rng); game.rng.random = () => { n++; return r(); };
while (s.sntcIndx !== ObjectB2) game.chooseWord(s.iconCount === 1 ? Math.abs(s.iconID[1]) : 86);
await game.execMove();
console.log('draws', n, 'locations', s.charLocn.slice(1).join(','), 'sentences', [2,3,4,5,6,7].map(i => s.sentence[i][2] + '/' + s.sentence[i][3]).join(' '));
