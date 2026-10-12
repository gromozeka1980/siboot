// Phone screens of the remake (portrait 390x844 and a small 360x740), for the mobile game layout.
import { chromium } from 'playwright';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch();
const errs = [];
for (const [tag, vp] of [['m', { width: 390, height: 844 }], ['s', { width: 360, height: 740 }]]) {
  const p = await (await b.newContext({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', x => errs.push(x.message));
  await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('siboot.tips', '{"off":true}'); } catch {} });
  await p.goto('http://localhost:8766/play.html?lang=ru&seed=7'); await sleep(2500);
  const shot = async n => { await sleep(500); await p.screenshot({ path: `shots_ux/${tag}_${n}.png` }); };
  await p.click('[data-start]'); await sleep(1500); await shot('1_start');
  const idle = async () => { for (let i = 0; i < 100 && await p.evaluate(() => document.body.classList.contains('busy')); i++) await sleep(150); };
  for (const w of [49, 58]) { await p.tap(`.chip[data-w="${w}"]`); await sleep(250); }
  await p.tap('#say'); await idle(); await sleep(1500);
  if (await p.$('.modal')) { await shot('2_story'); for (let i = 0; i < 4 && await p.$('.modal'); i++) { const c = await p.$('.modal .choices button, .modal [data-ok]'); if (c) await c.tap(); await sleep(600); } }
  const c27 = await p.$('.chip[data-w="27"]'); if (c27) { await c27.tap(); await sleep(200); await p.tap('#say'); await idle(); await sleep(1500); }
  await shot('3_talk');
  const c44 = await p.$('.chip[data-w="44"]'); if (c44) { await c44.tap(); await sleep(300); }
  await shot('4_offer');
  await p.tap('[data-cmd="auras"]'); await sleep(600); await shot('5_auras');
  await p.mouse.click(200, 60); await sleep(500);
  await p.tap('[data-cmd="menu"]'); await shot('6_menu'); await p.keyboard.press('Escape');
  console.log(tag, await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight, innerHeight]));
}
console.log('errors', errs);
await b.close();
