// Self-check for engine/combat.js logic (no drawing). Run: node tools/test_combat.mjs
import assert from 'node:assert/strict';
import { createState } from '../src/engine/state.js';
import { pickAura, victory } from '../src/engine/combat.js';

const mk = (level, rnd = []) => {
  const s = createState();
  s.level = level;
  return { s, random: () => (rnd.length ? rnd.shift() : 0) };
};
const setAuras = (s, who, knower, a) => { for (let k = 1; k <= 3; k++) s.auraCnt[k][who][knower] = a[k - 1]; };

// Level 1: who1 lowest own aura -> pick; Figger from table
{
  const g = mk(1);
  setAuras(g.s, 1, 0, [5, 3, 7]);     // who1 true: katsin lowest -> x=1 (A2<A1) ... per DOS rules
  setAuras(g.s, 2, 1, [-1, 4, -1]);   // who1's knowledge of who2
  const [pick, fig] = pickAura(g, 1, 2, 777);
  // A: x=3 (A3>0); A2<A1 -> x=1; A3<Low? no; => pick 1. B: -1s -> High=4 -> B=4,4,4 -> x stays 3. 1-3=-2 -> -64
  assert.equal(pick, 1);
  assert.equal(fig, -64);
}
// Level 1: who1 has nothing -> MyPick 0, x=3 -> Figger keeps caller's value
{
  const g = mk(2);
  setAuras(g.s, 1, 0, [0, 0, 0]);
  setAuras(g.s, 2, 1, [5, 5, 5]);
  assert.deepEqual(pickAura(g, 1, 2, 777), [0, 777]);
}
// Level 3: random pick upgraded to max Fig
{
  const g = mk(3, [8192 * 2]);        // x = 2 on first try
  setAuras(g.s, 1, 0, [4, 2, 2]);
  setAuras(g.s, 2, 1, [3, -1, -1]);   // High=3 -> 3,3,3
  // Fig1 = 8*3*4*2/(4*2) - 8*3*2*2/(4*4) = 24 - 6 = 18
  // Fig2 = 8*3*2*4/(2*4) - 8*3*2*4/(2*2) = 24 - 48 = -24
  // Fig3 = 8*3*2*2/(2*2) - 8*3*4*2/(2*2) = 24 - 48 = -24
  assert.deepEqual(pickAura(g, 1, 2, 0), [1, 18]);
}
// Level 3: A1=0 -> Fig1=-2000, A2 ok but A1=0 -> Fig2=-999
{
  const g = mk(3, [-8192 * 3]);       // |−3| = 3
  setAuras(g.s, 1, 0, [0, 2, 2]);
  setAuras(g.s, 2, 1, [1, 1, 1]);
  // Fig3 = 8*1*2*2/4 - 8*1*0*2/4 = 8
  assert.deepEqual(pickAura(g, 1, 2, 0), [3, 8]);
}
// Victory: transfer one aura; knowledge updated only where known; StoryParm
{
  const g = mk(1), s = g.s;
  s.player = 1;
  setAuras(s, 1, 0, [3, 3, 3]); setAuras(s, 2, 0, [8, 3, 3]);
  s.auraCnt[2][1][2] = -1;            // winner(2) doesn't know player's katsin
  s.auraCnt[2][2][1] = 3;             // player knows winner's katsin
  s.storyParm[40] = 1; s.storyParm[21] = 1; s.storyParm[22] = -1;
  victory(g, 2, 1, 2);
  assert.equal(s.auraCnt[2][1][0], 2); assert.equal(s.auraCnt[2][1][1], 2); assert.equal(s.auraCnt[2][1][2], -1);
  assert.equal(s.auraCnt[2][2][0], 4); assert.equal(s.auraCnt[2][2][2], 4); assert.equal(s.auraCnt[2][2][1], 4);
  assert.equal(s.storyParm[40], 8); assert.equal(s.storyParm[21], 1024); assert.equal(s.storyParm[22], -1);
}
// Victory: loser already at 0 -> winner gains nothing; winner capped at 8
{
  const g = mk(1), s = g.s;
  s.player = 7;
  setAuras(s, 3, 0, [0, 1, 1]); setAuras(s, 4, 0, [5, 1, 1]);
  victory(g, 4, 3, 1);
  assert.equal(s.auraCnt[1][3][0], 0); assert.equal(s.auraCnt[1][4][0], 5);
  setAuras(s, 3, 0, [2, 1, 1]); setAuras(s, 4, 0, [8, 1, 1]);
  victory(g, 4, 3, 1);
  assert.equal(s.auraCnt[1][3][0], 1); assert.equal(s.auraCnt[1][4][0], 8);
}
console.log('combat self-check OK');
