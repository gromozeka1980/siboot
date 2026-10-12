import { chromium } from 'playwright';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:8766/play.html?lang=ru&seed=7'); await sleep(2500); await p.click('[data-start]'); await sleep(1500);
await p.click('.chip[data-w="86"]').catch(() => {}); await sleep(300); await p.click('#say').catch(() => {}); await sleep(2500);
await p.reload(); await sleep(2500); await p.screenshot({ path: 'shots_ux/d2_title.png', clip: { x: 420, y: 400, width: 600, height: 260 } });
await b.close();
