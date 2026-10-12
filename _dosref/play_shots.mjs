// Drives the remake UI (play.html) headless: start a game, play a few turns, screenshot.
import { chromium } from 'playwright';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lang = process.argv[2] || 'ru', turns = Number(process.argv[3] || 12), mode = process.argv[4] || 'talk';
const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
await p.goto(`http://localhost:8766/play.html?lang=${lang}&seed=7`); await sleep(2500);
await p.screenshot({ path: `shots_play/${lang}_title.png` });
await p.click('[data-start]'); await sleep(1500);
await p.screenshot({ path: `shots_play/${lang}_start.png` });
const shot = {};
for (let t = 0; t < turns; t++) {
  for (let k = 0; k < 12; k++) { // build a sentence: prefer going to a house, greeting, small talk, then whatever comes first
    if (await p.$('.modal')) { if (mode === 'night' && !shot[await p.$eval('.modal', m => m.querySelector('.story') ? 'story' : m.querySelector('.defend') ? 'defence' : m.querySelector('.duel') ? 'duel' : m.querySelector('.victory') ? 'victory' : 'other')]) { const k = await p.$eval('.modal', m => m.querySelector('.story') ? 'story' : m.querySelector('.defend') ? 'defence' : m.querySelector('.duel') ? 'duel' : m.querySelector('.victory') ? 'victory' : 'other'); shot[k] = 1; await sleep(1200); await p.screenshot({ path: `shots_play/${lang}_${k}.png` }); }
      const c = await p.$('.modal .choices button, .modal [data-ok], .modal .defend button:not([disabled])'); if (c) await c.click(); await sleep(800); continue; }
    if (await p.$eval('#say', e => !e.disabled)) break;
    const chips = await p.$$eval('.chip', es => es.map(e => Number(e.dataset.w)));
    if (!chips.length) { await sleep(500); continue; }
    const pref = (mode === 'night' ? [53, 54, 55, 2, 3, 26, 86, 74] : [74, 113, 114, 25, 115, 77, 49, 58, 59, 60, 26]).find(w => chips.includes(w)) ?? chips[0];
    await p.click(`.chip[data-w="${pref}"]`); await sleep(150);
  }
  if (await p.$eval('#say', e => !e.disabled)) { await p.click('#say'); }
  for (let w = 0; w < 40; w++) { await sleep(300); if (await p.$('.modal')) break; if (!(await p.evaluate(() => document.body.classList.contains('busy')))) break; }
  if (t === 3) await p.screenshot({ path: `shots_play/${lang}_t3.png` });
}
await sleep(800);
await p.screenshot({ path: `shots_play/${lang}_end.png` });
console.log('errors:', errs.length ? errs.slice(0, 5) : 'none');
await b.close();
