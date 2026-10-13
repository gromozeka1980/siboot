import { chromium } from 'playwright';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', x => errs.push(x.message));
await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('siboot.tips', '{"off":true}'); } catch {} });
for (const seed of [3, 5, 8]) {
  await p.goto(`http://localhost:8766/play.html?lang=ru&seed=${seed}`); await sleep(2000); await p.click('[data-start]'); await sleep(1200);
  const st = () => p.evaluate(() => { const s = __play.game.s; return `${s.day}d ${Math.floor(s.time / 60)}:${String(s.time % 60).padStart(2, '0')} loc ${s.charLocn[1]} with ${s.interloc[1]}`; });
  console.log('seed', seed, 'before', await st(), 'waitlong visible', await p.$eval('#waitlong', e => !e.hidden));
  await p.click('.chip[data-w="49"]'); await sleep(200); console.log(' say label after "go":', await p.$eval('#say', e => e.textContent)); await p.click('#back'); await sleep(300);
  await p.click('#waitlong');
  for (let i = 0; i < 300; i++) { await sleep(300); if (await p.$('.modal')) break; if (!(await p.evaluate(() => document.body.classList.contains('busy')))) break; }
  console.log(' after', await st(), 'modal', !!(await p.$('.modal')), '| last log:', (await p.$$eval('#log .say, #log .narr', es => es.slice(-2).map(e => e.textContent))).join(' / '));
}
console.log('errors', errs);
await b.close();
