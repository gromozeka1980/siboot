// Plays the remake into day 2, then shows the aura notebook, a character card, deal slot hints and the title.
import { chromium } from 'playwright';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', x => errs.push(x.message));
await p.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } localStorage.setItem('siboot.tips', '{"off":true}'); } catch {} });
await p.goto('http://localhost:8766/play.html?lang=ru&seed=9'); await sleep(2500); await p.click('[data-start]'); await sleep(1200);
const idle = async () => { for (let i = 0; i < 200 && await p.evaluate(() => document.body.classList.contains('busy')); i++) await sleep(150); };
let day2 = false;
for (let t = 0; t < 900 && !day2; t++) {
  await idle();
  if (await p.$('.modal')) {
    if (await p.$('.modal .recap-auras')) { await p.click('.modal [data-ok]'); day2 = true; break; }
    const c = await p.$('.modal .choices button, .modal [data-ok], .modal .defend button:not([disabled])'); if (c) await c.click(); await sleep(300); continue;
  }
  if (await p.$eval('#say', x => !x.disabled)) { await p.click('#say'); continue; }
  const chips = await p.$$eval('.chip', es => es.map(e => Number(e.dataset.w)));
  if (!chips.length) { await sleep(200); continue; }
  const w = [53, 54, 55, 74, 25, 27, 44, 49, 26, 86].find(x => chips.includes(x)) ?? chips[0];
  await p.click(`.chip[data-w="${w}"]`);
}
await idle(); await sleep(800);
console.log('day', await p.evaluate(() => __play.game.s.day), 'log days', await p.evaluate(() => Object.keys(__play.view.auraLog)));
await p.screenshot({ path: 'shots_ux/d2_table.png', clip: { x: 1110, y: 60, width: 330, height: 560 } });
await p.click('.auras tr[data-who="3"]'); await sleep(500); await p.screenshot({ path: 'shots_ux/d2_card.png' }); await p.keyboard.press('Escape');
// deal hints
for (const w of [49, 58]) { const c = await p.$(`.chip[data-w="${w}"]`); if (c) { await c.click(); await sleep(200); } }
await p.click('#say').catch(() => {}); await idle(); await sleep(1500);
for (const w of [25, 27]) { const c = await p.$(`.chip[data-w="${w}"]`); if (c) { await c.click(); await sleep(200); } }
await p.click('#say').catch(() => {}); await idle(); await sleep(1500);
const c44 = await p.$('.chip[data-w="44"]'); if (c44) { await c44.click(); await sleep(300); }
await p.screenshot({ path: 'shots_ux/d2_deal.png', clip: { x: 0, y: 620, width: 1440, height: 280 } });
await p.goto('http://localhost:8766/play.html?lang=ru'); await sleep(2500); await p.screenshot({ path: 'shots_ux/d2_title.png' });
console.log('errors', errs);
await b.close();
