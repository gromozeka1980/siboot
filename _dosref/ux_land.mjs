import { chromium } from 'playwright';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true })).newPage();
await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('siboot.tips', '{"off":true}'); } catch {} });
await p.goto('http://localhost:8766/play.html?lang=ru&seed=7'); await sleep(2500); await p.click('[data-start]'); await sleep(1500);
for (const w of [49, 58]) { await p.click(`.chip[data-w="${w}"]`); await sleep(300); }
await p.click('#say'); await sleep(4000);
for (let i = 0; i < 4 && await p.$('.modal'); i++) { const c = await p.$('.modal .choices button, .modal [data-ok]'); if (c) await c.click(); await sleep(600); }
console.log(await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]));
await p.screenshot({ path: 'shots_ux/land.png' });
await b.close();
