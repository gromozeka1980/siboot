// Plays the remake into the second day, asking the advisor along the way; screenshots the morning recap.
import { chromium } from 'playwright';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', x => errs.push(x.message));
await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('siboot.tips', '{"off":true}'); } catch {} });
await p.goto('http://localhost:8766/play.html?lang=ru&seed=9'); await sleep(2500); await p.click('[data-start]'); await sleep(1200);
const idle = async () => { for (let i = 0; i < 200 && await p.evaluate(() => document.body.classList.contains('busy')); i++) await sleep(150); };
const adv = async tag => { await idle(); await p.click('#advise'); await sleep(150); console.log(tag, '|', await p.$eval('.tip.advice p', x => x.textContent)); await p.click('.tip.advice [data-ok]'); };
await adv('start');
let recap = false, n = 0;
for (let t = 0; t < 600 && !recap; t++) {
  await idle();
  if (await p.$('.modal')) {
    if (await p.$('.modal .recap-auras')) { recap = true; await sleep(400); await p.screenshot({ path: 'shots_play/recap.png' }); break; }
    if (await p.$('.modal .defend')) await adv('defence?');
    const c = await p.$('.modal .choices button, .modal [data-ok], .modal .defend button:not([disabled])'); if (c) await c.click(); await sleep(400); continue;
  }
  const time = await p.evaluate(() => __play.game.s.time);
  if (time > 1260 && n < 99) { n = 99; await adv('night ' + time); }
  else if (t % 15 === 0 && n < 6) { n++; await adv('t' + time); }
  if (await p.$eval('#say', x => !x.disabled)) { await p.click('#say'); continue; }
  const chips = await p.$$eval('.chip', es => es.map(e => Number(e.dataset.w)));
  if (!chips.length) { await sleep(300); continue; }
  const w = [53, 54, 55, 74, 25, 27, 28, 113, 115, 26, 86].find(x => chips.includes(x)) ?? chips[0];
  await p.click(`.chip[data-w="${w}"]`);
}
console.log('day', await p.evaluate(() => __play.game.s.day), 'recap', recap, 'errors', errs);
await b.close();
