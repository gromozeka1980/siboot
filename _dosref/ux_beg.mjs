import { chromium } from 'playwright';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', x => errs.push(x.message));
await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('siboot.tips', '{"off":true}'); } catch {} });
await p.goto('http://localhost:8766/play.html?lang=ru&seed=7'); await sleep(2500); await p.click('[data-start]'); await sleep(1200);
const idle = async () => { for (let i = 0; i < 100 && await p.evaluate(() => document.body.classList.contains('busy')); i++) await sleep(150); };
const modals = async () => { for (let i = 0; i < 6 && await p.$('.modal'); i++) { const c = await p.$('.modal .choices button, .modal [data-ok]'); if (c) await c.click(); await sleep(500); } };
const say = async ws => { for (const w of ws) { await idle(); await modals(); const c = await p.$(`.chip[data-w="${w}"]`); if (!c) return false; await c.click(); await sleep(150); }
  for (let k = 0; k < 8 && !(await p.$eval('#say', e => !e.disabled)); k++) { const c = await p.$('.chip'); if (!c) break; await c.click(); await sleep(150); }
  await p.click('#say').catch(() => {}); await idle(); await sleep(1200); await modals(); return true; };
await say([49, 58]); console.log("chips", await p.$$eval(".chip", es => es.map(e => e.dataset.w)), await p.$eval(".scene .tag", e => e.textContent)); await say([27]); console.log("chips2", await p.$$eval(".chip", es => es.map(e => e.dataset.w)));
for (let n = 0; n < 6; n++) {
  if (await p.$('.chip[data-w="45"]')) { await say([45]); break; }
  if (await p.$('.chip[data-w="44"]')) await say([44]); else if (await p.$('.chip[data-w="77"]')) await say([77]); else break;
}
console.log((await p.$$eval('#log .say', es => es.map(e => e.textContent))).slice(-5).join('\n'));
console.log('errors', errs);
await b.close();
