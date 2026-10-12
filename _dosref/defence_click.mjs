import { chromium } from 'playwright';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1000, height: 780 } })).newPage();
page.on('console', m => { if (m.type() === 'error') console.log('console error:', m.text()); });
page.on('crash', () => console.log('PAGE CRASHED'));
await page.goto('http://localhost:8766/?seed=dos');
await page.waitForFunction(() => window.__dbg, null, { timeout: 60000 }); await sleep(2500);
await page.evaluate(async () => { const { click, sleep } = __dbg; await click(314, 351); await sleep(900); await click(300, 300); await sleep(400); await click(300, 300); await sleep(500); });
await page.evaluate(async () => {
  const { ClassicView } = await import('/src/ui/classic/view.js'); const g = __dbg.ui.g, s = g.s;
  s.auraCnt[1][1][1] = 8; s.auraCnt[2][1][1] = 8; s.auraCnt[3][1][1] = 6; s.narratOn = false;
  window.res = null; new ClassicView(__dbg.ui).defence(2, 1).then(v => { window.res = v; });
});
await sleep(1000);
// real mouse click at the katsin icon (canvas coordinates -> page)
const box = await page.locator('#screen').boundingBox();
await page.mouse.move(box.x + 257.5 * box.width / 640, box.y + 211.5 * box.height / 480); await page.mouse.down(); await sleep(700); await page.mouse.up();
await sleep(1500);
console.log('defence result:', await page.evaluate(() => window.res));
await browser.close();
