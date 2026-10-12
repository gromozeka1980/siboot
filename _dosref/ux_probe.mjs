import { chromium } from 'playwright';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
await p.goto('http://localhost:8766/play.html?lang=ru&seed=7'); await sleep(2500); await p.click('[data-start]'); await sleep(1500);
const wide = () => p.evaluate(() => { const W = document.documentElement.clientWidth; return { sw: document.documentElement.scrollWidth, W, culprits: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > W + 1).slice(0, 6).map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right)) }; });
console.log('start', JSON.stringify(await wide())); await p.screenshot({ path: 'shots_ux/probe_start.png' });
for (const w of [49, 58]) { await p.click(`.chip[data-w="${w}"]`); await sleep(300); console.log(w, JSON.stringify(await wide())); }
await p.click('#say'); await sleep(4000);
console.log("talk", JSON.stringify(await wide()), await p.evaluate(() => [scrollX, scrollY, document.body.scrollWidth, document.querySelector(".app").scrollWidth])); await p.screenshot({ path: "shots_ux/probe_talk.png", fullPage: true });
await b.close();
