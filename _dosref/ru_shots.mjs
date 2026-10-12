// Screenshots of the Russian localisation in key screens (headless).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots_ru'); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1000, height: 780 } })).newPage();
page.on('pageerror', e => console.log('PAGE ERROR', e.message));
await page.goto('http://localhost:8766/?lang=ru&seed=dos');
await page.waitForFunction(() => window.__dbg, null, { timeout: 60000 });
await sleep(2500);
const save = async n => { const u = await page.evaluate(() => { __dbg.screen.present(); return document.getElementById('screen').toDataURL(); }); fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from(u.split(',')[1], 'base64')); };
const full = async n => page.screenshot({ path: path.join(OUT, n + '_page.png') });
const click = (x, y, hold) => page.evaluate(([x, y, h]) => __dbg.click(x, y, h), [x, y, hold || 120]);
const menu = (x, y) => page.evaluate(async ([x, y]) => {
  const c = document.getElementById('screen'), s = ms => new Promise(r => setTimeout(r, ms));
  const ev = (t, x, y) => { const r = c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent(t, { clientX: r.left + (x + 0.5) * r.width / 640, clientY: r.top + (y + 0.5) * r.height / 480, bubbles: true, pointerId: 1 })); };
  ev('pointermove', x, 6); ev('pointerdown', x, 6); await s(300); ev('pointermove', x, y); await s(400);
  return () => {};
}, [x, y]);
await save('01_options'); await full('01_options');
await click(314, 351); await sleep(900); await save('02_narration1'); await click(300, 300); await sleep(500); await save('03_narration2');
await click(300, 300); await sleep(500); await save('04_main');
// hold on the first icon to see its Russian label
await page.evaluate(async () => {
  const c = document.getElementById('screen'), r = c.getBoundingClientRect();
  const o = { clientX: r.left + 20.5 * r.width / 640, clientY: r.top + 42.5 * r.height / 480, bubbles: true, pointerId: 1 };
  c.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise(f => setTimeout(f, 300));
  __dbg.screen.present(); window.__lbl = document.getElementById('screen').toDataURL();
  c.dispatchEvent(new PointerEvent('pointerup', o));
});
fs.writeFileSync(path.join(OUT, '05_label_go.png'), Buffer.from((await page.evaluate(() => window.__lbl)).split(',')[1], 'base64'));
await sleep(600);
await click(20, 42); await sleep(400); await click(116, 77); await sleep(1500); await save('06_arrive'); await click(300, 300); await sleep(1500);
await save('07_in_kendra');
// menus
for (const [x, n] of [[40, 'm1'], [100, 'm2'], [170, 'm3'], [260, 'm4'], [360, 'm5']]) {
  await menu(x, 60); await sleep(300); await save('08_menu_' + n);
  await page.evaluate(() => { const c = document.getElementById('screen'), r = c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent('pointerup', { clientX: r.left + 600 * r.width / 640, clientY: r.top + 400 * r.height / 480, bubbles: true, pointerId: 1 })); });
  await sleep(400);
}
await browser.close();
console.log('saved to', OUT);
