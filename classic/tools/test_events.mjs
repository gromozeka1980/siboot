// Parses all 44 story files for every character 2..7 and runs every option command through the
// interpreter against a fresh state. Run: node tools/test_events.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import { parseStory, execComd, storyPage, wrapResult, selectStory } from '../src/engine/events.js';
import { createState } from '../src/engine/state.js';
import { CHARACTERS, LOVE, TRUST, FEAR, STORY_PARM } from '../src/data/characters.js';

const DIR = new URL('../../trust-and-betrayal-the-legacy-of-siboot/', import.meta.url);
const BS = String.fromCharCode(92), CR = String.fromCharCode(13), NUL = String.fromCharCode(0);

function freshState() {
  const s = createState();
  s.player = 1;
  for (let a = 1; a <= 7; a++) {
    [, , , s.loyalty[a], s.integrity[a], s.temper[a], s.revenge[a], s.duty[a], s.pride[a], s.secret[a], s.desLiked[a], s.gullble[a]] = CHARACTERS[a];
    for (let b = 1; b <= 7; b++) { s.love[a][b] = LOVE[a][b]; s.trust[a][b] = TRUST[a][b]; s.fear[a][b] = FEAR[a][b]; }
    for (let k = 1; k <= 3; k++) s.auraCnt[k][a][0] = 3;
  }
  STORY_PARM.forEach((v, i) => { if (i) s.storyParm[i] = v; });
  return s;
}
const names = s => ({
  s, charName: i => (i === 8 ? 'Chris Crawford' : CHARACTERS[i][0]),
  species: i => CHARACTERS[i][1], male: i => CHARACTERS[i][2], fiance: i => CHARACTERS[i][12],
});

let fails = 0, runs = 0;
for (let n = 1; n <= 44; n++) {
  const raw = readFileSync(new URL(`STORY${n}`, DIR), 'latin1');
  for (let who = 2; who <= 7; who++) {
    try {
      const st = parseStory(raw, n, who, names(freshState()));
      assert.deepEqual(st.errors, [], 'parse errors');
      assert.equal(st.options.length, 4);
      assert.ok(!/[~%@#$^&=\]]/.test(st.text.slice(0, st.text.indexOf(NUL))), 'unsubstituted marker');
      // paging: at most 8 pages, every page makes progress
      let start = 0, pages = 0, last = false;
      while (!last) { const p = storyPage(st.text, start); assert.ok(p.next > start, 'page stalls'); start = p.next; last = p.last; pages++; }
      assert.ok(pages <= 8, 'more than 8 pages');
      st.options.forEach((o, k) => {
        assert.ok(o.title.length > 0, `empty title ${k + 1}`);
        const r = execComd(freshState(), o.command, who, n);
        runs++;
        assert.ok(r.terminated, `option ${k + 1} unterminated`);
        assert.deepEqual(r.errors, [], `option ${k + 1} errors`);
        assert.ok(r.result !== null && r.result.length > 0, `option ${k + 1} has no P text`);
        for (const line of wrapResult(r.result))
          assert.ok(line.trimEnd().length <= 39 && !line.startsWith(' '), `option ${k + 1}: bad result line`);
      });
      if (n === 30) assert.equal(st.parmOps.map(o => o.op + o.n).join(), 'K31,K32,K33,K34,K35,K36');
    } catch (e) { fails++; console.log(`STORY${n} who=${who}: ${e.message}`); }
  }
}

// FIX #4: H must not re-enable used stories
{ const s = freshState(); s.storyParm[5] = -1; execComd(s, '1H' + BS, 2, 3); assert.equal(s.storyParm[5], -1); assert.equal(s.storyParm[20], 8); }
// FIX #5: capital after ".  " only for lowercase
{ const opt = 'a' + CR + '  P1' + CR + BS + CR;
  const st = parseStory('Hi.  ~ go.  & x. ' + BS + CR + BS + CR + opt.repeat(4), 1, 3, names(freshState()));
  assert.ok(st.text.startsWith('Hi.  You go.  Frem x.')); }
// selection: first eligible story whose Random passes
{ const s = freshState(); assert.equal(selectStory(s, 1, 2, () => 30000), 1); assert.equal(selectStory(s, 1, 2, () => 0), -1); }

console.log(`${runs} option runs, ${fails} failures`);
process.exit(fails ? 1 : 0);
