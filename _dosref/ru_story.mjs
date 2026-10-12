import { chromium } from 'playwright';
import fs from 'node:fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const n = Number(process.argv[2] || 14), who = Number(process.argv[3] || 2);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1000, height: 780 } })).newPage();
page.on('pageerror', e => console.log('PAGE ERROR', e.message));
await page.goto('http://localhost:8766/?lang=ru&seed=dos');
await page.waitForFunction(() => window.__dbg, null, { timeout: 60000 }); await sleep(2500);
const save = async f => { const u = await page.evaluate(() => { __dbg.screen.present(); return document.getElementById('screen').toDataURL(); }); fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64')); };
await page.evaluate(async ([n]) => {
  const { click, sleep } = __dbg, g = __dbg.ui.g, s = g.s;
  await click(314, 351); await sleep(900); await click(300, 300); await sleep(400); await click(300, 300); await sleep(500);
  s.narratOn = false;
  await click(20, 42); await sleep(300); await click(20, 42); await sleep(300); await click(116, 77); await sleep(1500);
  await click(20, 120); await sleep(300);
  s.storyParm = s.storyParm.map((v, i) => (i === n ? (v < 0 ? -v : v) % 64 : -1)); // make only story n eligible (context/who kept)
  const orig = g.random.bind(g); g.random = () => { g.random = orig; return 32767; };
  click(116, 77);
}, [n]);
await sleep(2000); await save(`shots_ru/story${n}_p1.png`);
await page.evaluate(() => __dbg.click(130, 208)); await sleep(800); await save(`shots_ru/story${n}_p2.png`);
await page.evaluate(() => __dbg.click(100, 281)); await sleep(500); await page.evaluate(() => __dbg.click(30, 208)); await sleep(1500);
await save(`shots_ru/story${n}_result.png`);
await browser.close();
