import { chromium } from 'playwright';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', x => errs.push(x.message));
await p.addInitScript(() => { try { localStorage.setItem('siboot.tips', '{"off":true}'); } catch {} });
await p.goto('http://localhost:8766/play.html?lang=ru&seed=7'); await sleep(2500);
await p.screenshot({ path: 'shots_ux/d2_title.png' });
await p.click('[data-start]'); await sleep(1200);
const idle = async () => { for (let i = 0; i < 100 && await p.evaluate(() => document.body.classList.contains('busy')); i++) await sleep(150); };
const modals = async () => { for (let i = 0; i < 6 && await p.$('.modal'); i++) { const c = await p.$('.modal .choices button, .modal [data-ok]'); if (c) await c.click(); await sleep(500); } };
const seq = async ws => { for (const w of ws) { await idle(); await modals(); const c = await p.$(`.chip[data-w="${w}"]`); if (c) { await c.click(); await sleep(200); } } await p.click('#say').catch(() => {}); await idle(); await sleep(1200); await modals(); };
await seq([49, 58]); await seq([25, 27]);
const shots = [];
for (let k = 0; k < 7; k++) {
  await idle(); await modals();
  const chips = await p.$$eval('.chip', es => es.map(e => Number(e.dataset.w)));
  const hint = await p.$eval('#preview', e => e.textContent);
  shots.push(hint);
  const w = k === 0 ? 44 : chips[0]; if (!w) break;
  await p.click(`.chip[data-w="${w}"]`); await sleep(250);
  if (k === 2) await p.screenshot({ path: 'shots_ux/d2_deal.png', clip: { x: 0, y: 620, width: 1440, height: 280 } });
}
console.log(shots.join('\n')); console.log('log narr', await p.$$eval('#log .narr', es => es.map(e => e.textContent)));
console.log('errors', errs);
await b.close();
