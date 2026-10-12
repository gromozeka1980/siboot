// UX tour: screenshots of every screen of the remake on desktop and phone.
import { chromium } from 'playwright';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch();
for (const [tag, vp] of [['desk', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: tag === 'phone', hasTouch: tag === 'phone' });
  const p = await ctx.newPage();
  await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await p.goto('http://localhost:8766/play.html?lang=ru&seed=7'); await sleep(2500);
  const shot = async n => { await sleep(500); await p.screenshot({ path: `shots_ux/${tag}_${n}.png`, fullPage: false }); };
  await shot('01_title');
  await p.click('[data-start]'); await sleep(1500); await shot('02_start');
  const idle = async () => { for (let i = 0; i < 100 && await p.evaluate(() => document.body.classList.contains('busy')); i++) await sleep(150); };
  const closeModals = async () => { for (let i = 0; i < 5 && await p.$('.modal'); i++) { const c = await p.$('.modal .choices button, .modal [data-ok], .modal [data-x]'); if (c) await c.click(); await sleep(400); } };
  const tipsOff = async () => { for (const t of await p.$$('.tip [data-ok]')) await t.click().catch(() => {}); };
  // go to Kendra's house and talk
  const pickSeq = async ws => { for (const w of ws) { await idle(); await closeModals(); await tipsOff(); const c = await p.$(`.chip[data-w="${w}"]`); if (c) await c.click(); await sleep(250); } };
  await pickSeq([49, 58]); await shot('03_building'); await p.click('#say'); await idle(); await sleep(1500); await closeModals();
  await pickSeq([25, 27]); await p.click('#say').catch(() => {}); await idle(); await sleep(1500); await closeModals(); await tipsOff();
  await shot('04_talk');
  await pickSeq([44]); await shot('05_offer_build');
  await p.click('#advise'); await shot('06_advice'); await tipsOff();
  for (const cmd of ['chars', 'journal', 'menu']) { await p.click(`[data-cmd="${cmd}"]`).catch(async () => {}); await shot('07_' + cmd); await p.keyboard.press('Escape'); await closeModals(); const x = await p.$('.modal'); if (x) await p.mouse.click(5, 5); await sleep(300); }
  await p.click('.auras tr[data-who="3"]'); await shot('09_card'); await p.keyboard.press('Escape');
  if (tag === 'phone') { await p.click('[data-cmd="auras"]'); await sleep(800); await shot('10_auras'); }
  await ctx.close();
}
await b.close();
