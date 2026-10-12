// Screenshots of the remake for the rules in the Library: web/assets/remake/shots/<lang>/<name>.png
import { chromium } from 'playwright';
import fs from 'node:fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = new URL('../web/assets/remake/shots/', import.meta.url);
const b = await chromium.launch();
for (const lang of ['ru', 'en']) {
  fs.mkdirSync(new URL(lang + '/', OUT), { recursive: true });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const shot = async (name, sel) => { const el = sel ? await p.$(sel) : null; await (el || p).screenshot({ path: new URL(`${lang}/${name}.png`, OUT).pathname.replace(/^\/(\w:)/, '$1') }); };
  await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('siboot.tips', '{"off":true}'); } catch {} });
  await p.goto(`http://localhost:8766/play.html?lang=${lang}&seed=11`); await sleep(2500);
  await shot('title');
  await p.click('[data-start]'); await sleep(1500);
  // go to Kendra's, greet, chat until a deal shows up
  const pick = async (...ws) => { for (const w of ws) { const c = await p.$(`.chip[data-w="${w}"]`); if (c) { await c.click(); await sleep(150); return true; } } return false; };
  await pick(49); await pick(58); await p.click('#say'); await sleep(3000);
  while (await p.$('.modal')) { const c = await p.$('.modal .choices button, .modal [data-ok]'); if (c) await c.click(); await sleep(800); }
  for (let k = 0; k < 6; k++) {
    if (await p.$('.modal')) { const c = await p.$('.modal .choices button, .modal [data-ok]'); if (c) await c.click(); await sleep(800); continue; }
    await pick(25); await pick(27, 28, 29); await pick(113); await pick(115, 114);
    if (await p.$eval('#say', e => !e.disabled)) { await p.click('#say'); await sleep(2500); }
  }
  await shot('dialogue', 'main'); await shot('feelings', '.scene'); await shot('deal', '#log'); await shot('promises', 'aside');
  await pick(44); await sleep(300); await shot('builder', 'footer');
  await p.click('[data-cmd=chars]'); await sleep(600); await shot('characters', '.modal .sheet'); await p.click('.modal [data-x]');
  await p.click('[data-cmd=journal]'); await sleep(600); await shot('journal', '.modal .sheet'); await p.click('.modal [data-x]');
  await p.evaluate(() => { const v = __play.view; v.midnight(); window.__d = v.defence(4, 1); }); await sleep(900); await shot('defence', '.modal .sheet');
  await p.click('.defend button:not([disabled])'); await sleep(200);
  await p.evaluate(() => __play.view.combat(1, 4, 1, 2)); await sleep(1800); await shot('duel', '.modal .sheet');
  await p.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); const v = __play.view, g = __play.game;
    window.__s = v.story({ text: g.data.stories ? 'x' : 'x', faceWho: 3, errors: [], options: [] }, () => ({ result: null, errors: [] })); });
  await p.evaluate(() => document.querySelectorAll('.modal').forEach(m => m.remove()));
  await p.close();
}
await b.close();
console.log('ok');
