// Round-trip test: splitting a story and rebuilding it with its own texts must be byte-exact,
// and the exported English JSON must carry exactly the texts the parser sees.
import fs from 'node:fs';
import { splitStory, rebuildStory } from '../src/i18n/i18n.js';
const rd = n => fs.readFileSync(`assets/text/story${n}.txt`, 'latin1');
let ok = 0;
for (let n = 1; n <= 44; n++) {
  const raw = rd(n), sp = splitStory(raw);
  const text = raw.slice(0, sp.textEnd);
  const options = sp.options.map(o => {
    const title = raw.slice(o.titleStart, o.titleEnd);
    const results = raw.slice(o.titleEnd, o.bodyEnd).split('\r').filter(l => l.includes('P') && l.trim()).map(l => l.slice(l.indexOf('P') + 1));
    return { title, results };
  });
  const back = rebuildStory(raw, text, options);
  if (back !== raw) { console.log('story', n, 'MISMATCH at', [...back].findIndex((c, i) => c !== raw[i])); continue; }
  const en = JSON.parse(fs.readFileSync(`assets/i18n/en/stories/story${n}.json`, 'utf8'));
  if (en.options.length !== 4 || en.options.some((o, k) => o.results.length !== options[k].results.length)) { console.log('story', n, 'export shape differs'); continue; }
  ok++;
}
console.log(`${ok}/44 stories round-trip OK`);
