// Renders the remake's defence / combat / victory screens in the state seen in the DOS capture
// and diffs them against the original frames (lockstep/dos_*).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1000, height: 780 } })).newPage();
await page.goto('http://localhost:8766/?seed=dos');
await page.waitForFunction(() => window.__dbg, null, { timeout: 60000 });
await sleep(2500);
await page.evaluate(async () => {
  const { click, sleep } = __dbg;
  await click(314, 351); await sleep(900); await click(300, 300); await sleep(400); await click(300, 300); await sleep(500);
});
const frame = () => page.evaluate(() => { __dbg.screen.present(); return document.getElementById('screen').toDataURL('image/png'); });
const save = async (name) => { const u = await frame(); fs.writeFileSync(path.join(HERE, 'shots_web', name + '.png'), Buffer.from(u.split(',')[1], 'base64')); };

// state from the DOS defence screen: Vetvel 8/8/6; of Kendra's auras Vetvel knows only shial = 8
await page.evaluate(async () => {
  const { ClassicView } = await import('/src/ui/classic/view.js'); const { Pat } = await import('/src/ui/qd.js');
  const g = __dbg.ui.g, s = g.s, ui = __dbg.ui;
  Object.assign(window, { V: new ClassicView(__dbg.ui), Pat });
  s.auraCnt[1][1][1] = 8; s.auraCnt[2][1][1] = 8; s.auraCnt[3][1][1] = 6;
  s.auraCnt[1][2][1] = -1; s.auraCnt[2][2][1] = -1; s.auraCnt[3][2][1] = 8;
  s.narratOn = false; s.diurnal = 'black';
  ui.qd.fillRect({ left: 0, top: 0, right: 639, bottom: 479 }, Pat.black); ui.clearTrans();
});
const which = process.argv[2] || 'combat';
if (which === 'combat') {
  await page.evaluate(() => { window.cg = V.combat(1, 2, 1, 1); });
  await sleep(400); await save('W_combat');
} else {
  await page.evaluate(() => { window.gw = V.victory(1); });
  await sleep(1500); await save('W_victory');
}
await browser.close();
