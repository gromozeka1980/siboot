// Lockstep verifier: drives the original DOS game (js-dos, http://localhost:8765) and the remake
// (http://localhost:8766/?seed=dos) in headless Chromium with identical inputs and compares frames.
//   node lockstep.mjs <scenario>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'lockstep');
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1000, height: 780 } });

// ---------------------------------------------------------------- DOS side
const dos = await ctx.newPage();
await dos.goto('http://localhost:8765/');
await dos.waitForFunction(() => window.ci, null, { timeout: 60000 });
const D = {
  async frame() { return dos.evaluate(async () => { const d = await ci.screenshot(); return { w: d.width, h: d.height, data: Array.from(d.data) }; }); },
  async click(x, y) {
    await dos.evaluate(async ([x, y]) => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      for (let k = 0; k < 3; k++) { ci.sendMouseMotion(x / 640, y / 480); await s(60); }
      ci.sendMouseButton(0, true); await s(150); ci.sendMouseButton(0, false); await s(300);
    }, [x, y]);
  },
  async menu(x, y) {
    await dos.evaluate(async ([x, y]) => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      for (let k = 0; k < 4; k++) { ci.sendMouseMotion(x / 640, 6 / 480); await s(100); }
      ci.sendMouseButton(0, true); await s(600); ci.sendMouseMotion(x / 640, y / 480); await s(500); ci.sendMouseButton(0, false); await s(800);
    }, [x, y]);
  },
  async px(x, y) { const f = await this.frame(); const o = (y * f.w + x) * 4; return f.data[o] + f.data[o + 1] + f.data[o + 2]; },
  cursor: { x: 0, y: 0 },
};

// ---------------------------------------------------------------- remake side
const web = await ctx.newPage();
await web.goto('http://localhost:8766/?seed=dos');
await web.waitForFunction(() => window.__dbg, null, { timeout: 60000 });
const Wb = {
  async frame() {
    return web.evaluate(() => {
      const s = __dbg.screen; s.present();
      const c = document.getElementById('screen'), d = c.getContext('2d').getImageData(0, 0, 640, 480);
      return { w: 640, h: 480, data: Array.from(d.data) };
    });
  },
  async click(x, y) { await web.evaluate(([x, y]) => __dbg.click(x, y), [x, y]); },
  async menu(x, y) {
    await web.evaluate(async ([x, y]) => {
      const c = document.getElementById('screen'), s = ms => new Promise(r => setTimeout(r, ms));
      const ev = (t, x, y) => { const r = c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent(t, { clientX: r.left + (x + 0.5) * r.width / 640, clientY: r.top + (y + 0.5) * r.height / 480, bubbles: true, pointerId: 1 })); };
      ev('pointermove', x, 6); ev('pointerdown', x, 6); await s(300); ev('pointermove', x, y); await s(300); ev('pointerup', x, y); await s(600);
    }, [x, y]);
  },
  async state() { return web.evaluate(() => { const s = __dbg.ui.g.s; return { ids: s.iconID.slice(1, s.iconCount + 1), idx: s.sntcIndx, time: s.time, day: s.day }; }); },
};

// ---------------------------------------------------------------- compare / save
async function savePng(name, f) {
  // minimal PNG writer via the browser (avoid deps): let the remake page encode it
  const url = await web.evaluate(({ w, h, data }) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const id = new ImageData(new Uint8ClampedArray(data), w, h); c.getContext('2d').putImageData(id, 0, 0);
    return c.toDataURL('image/png');
  }, f);
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
}
let stepNo = 0;
async function compare(label) {
  await sleep(300);
  const [a, b] = [await D.frame(), await Wb.frame()];
  let n = 0; const bad = [];
  for (let y = 0; y < 480; y++) for (let x = 0; x < 640; x++) {
    const o = (y * 640 + x) * 4;
    const d = Math.abs(a.data[o] - b.data[o]) + Math.abs(a.data[o + 1] - b.data[o + 1]) + Math.abs(a.data[o + 2] - b.data[o + 2]);
    if (d > 60) {
      // ignore the DOS mouse cursor (16x16 at its last position)
      if (x >= D.cursor.x - 1 && x < D.cursor.x + 17 && y >= D.cursor.y - 1 && y < D.cursor.y + 17) continue;
      n++; if (bad.length < 5) bad.push([x, y]);
    }
  }
  const tag = String(++stepNo).padStart(3, '0') + '_' + label;
  await savePng(tag + '_dos', a); await savePng(tag + '_web', b);
  console.log(`${tag}: ${n === 0 ? 'MATCH' : 'DIFF ' + n + ' px, e.g. ' + JSON.stringify(bad)}`);
  return n;
}

// ---------------------------------------------------------------- actions (both sides)
async function click(x, y, wait = 1500) { D.cursor = { x, y }; await Promise.all([D.click(x, y), Wb.click(x, y)]); await sleep(wait); }
async function menu(x, y) { D.cursor = { x, y }; await Promise.all([D.menu(x, y), Wb.menu(x, y)]); await sleep(800); }
/** Pick words by number (positions taken from the remake state), then Do It. */
async function say(words, wait = 5000) {
  for (const w of words) {
    const st = await Wb.state();
    const i = st.ids.indexOf(w) + 1;
    if (!i) throw new Error(`word ${w} not offered: ${JSON.stringify(st)}`);
    await click(40 * Math.floor((i - 1) / 8) + 20, 39 * ((i - 1) % 8) + 42, 700);
  }
  await click(116, 77, wait);
}

async function start() {
  // DOS: logo + options; the first clicks can be lost while it is still loading
  await sleep(9000);
  for (let k = 0; k < 12 && (await D.px(63, 200)) < 300; k++) { await D.click(314, 351); await sleep(2500); }
  await Wb.click(314, 351); await sleep(1500);
  for (let k = 0; k < 2; k++) await click(300, 300, 1500); // the two opening narrations
  await menu(130, 24); // Options > Narrate Off
}

async function webInfo() {
  return web.evaluate(() => {
    const ui = __dbg.ui, s = ui.g.s;
    return { mode: ui.mode || null, ids: s.iconID.slice(1, s.iconCount + 1), idx: s.sntcIndx, time: s.time, day: s.day,
      inter: s.interloc[1], auras: [1, 2, 3].map(j => s.auraCnt[j][1][1]) };
  });
}

/** Simple deterministic player: bye to visitors, wait when alone, attack at night. */
async function autoplay(maxSteps, stopWhen) {
  for (let n = 0; n < maxSteps; n++) {
    const st = await webInfo();
    if (stopWhen && stopWhen(st)) return st;
    if (st.mode === 'victory') { await compare('victory'); return st; }
    if (st.mode === 'story') {
      await compare(`story_d${st.day}_${st.time}`);
      await click(30, 208, 2500); await compare('story_result'); await click(30, 208, 2500);
      continue;
    }
    if (st.mode === 'defence') {
      await sleep(1500); await compare(`defence_d${st.day}`);
      const j = st.auras.findIndex(a => a > 0);
      await click(217 + 40 * j, 211, 7000);
      continue;
    }
    if (st.idx === 8) { await click(116, 77, 5000); if (await compare(`t${st.day}_${st.time}`)) return st; continue; }
    if (!st.ids.length) { await sleep(1000); continue; }
    let w = st.ids[0];
    if (st.idx === 1) w = [26, 86].find(x => st.ids.includes(x)) ?? st.ids.find(x => x >= 53 && x <= 55) ?? st.ids[0];
    const i = st.ids.indexOf(w) + 1;
    await click(40 * Math.floor((i - 1) / 8) + 20, 39 * ((i - 1) % 8) + 42, 800);
  }
  return webInfo();
}

async function allChars(label) { await menu(200, 24); await sleep(1500); const n = await compare(label); await click(32, 176, 1500); return n; }

function classify2(f) {
  const p = (x, y) => { const o = (y * f.w + x) * 4; return [f.data[o], f.data[o + 1], f.data[o + 2]]; };
  const dark = (x, y) => p(x, y).reduce((a, b) => a + b) < 60;
  const g = p(20, 460);
  if (Math.abs(g[0] - 0x6d) < 12 && Math.abs(g[1] - 0x6c) < 12 && Math.abs(p(620, 20)[0] - 0x6d) < 12) return 'victory';
  let d = 0, t = 0;
  for (let y = 5; y < 480; y += 16) for (let x = 5; x < 640; x += 16) { t++; if (dark(x, y)) d++; }
  if (d / t > 0.8) {
    let lit = 0; for (let x = 201; x < 313; x += 3) if (!dark(x, 211)) lit++;
    return lit > 10 ? 'defence' : 'combat';
  }
  let line = 0; for (let x = 0; x < 640; x += 4) if (dark(x, 17)) line++;
  if (line > 150) return dark(88, 62) && dark(143, 62) ? 'doit' : 'normal';
  return 'story';
}
const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);

function classify(f) {
  const p = (x, y) => { const o = (y * f.w + x) * 4; return [f.data[o], f.data[o + 1], f.data[o + 2]]; };
  const dark = (x, y) => p(x, y).reduce((a, b) => a + b) < 60;
  let line = 0; for (let x = 0; x < 640; x += 4) if (dark(x, 17)) line++;
  const g = p(20, 460); const gray = Math.abs(g[0] - 0x6d) < 12 && Math.abs(g[1] - 0x6c) < 12;
  if (gray && Math.abs(p(620, 20)[0] - 0x6d) < 12) return 'victory';
  if (line > 150) return dark(88, 62) && dark(143, 62) ? 'doit' : 'normal';
  if (dark(5, 470) && dark(630, 10)) {
    let lit = 0; for (let x = 201; x < 313; x += 3) if (!dark(x, 211)) lit++;
    return lit > 10 ? 'defence' : 'night';
  }
  return 'story';
}

const scenarios = {
  async dosplay2() {
    await start();
    let prev = '', saved = 0, combatShots = 0, same = 0;
    for (let n = 0; n < 6000; n++) {
      const f = await withTimeout(D.frame(), 5000);
      if (!f) { console.log('frame timeout'); await sleep(1000); continue; }
      const c = classify2(f);
      const hot = c === 'combat' || c === 'defence';
      if (c !== prev || (hot && combatShots < 400)) {
        if (hot) combatShots++;
        await savePng(`dos_${String(++saved).padStart(4, '0')}_${c}`, f);
        if (c !== prev) console.log(n, 'state', c);
      }
      if (c === 'normal' && prev === 'combat') combatShots = 0;
      same = c === prev ? same + 1 : 0;
      prev = c;
      if (c === 'victory') { console.log('victory reached'); break; }
      if (c === 'doit') await D.click(116, 77);
      else if (c === 'normal') await D.click(20, 42);
      else if (c === 'story') await D.click(30, 208);
      else if (c === 'defence') { for (const x of [217, 257, 297]) await D.click(x, 211); }
      await sleep(hot ? 60 : 600);
    }
  },
  async dosplay() {
    await start();
    let prev = '', saved = 0, day = 1, nightShots = 0;
    for (let n = 0; n < 3000; n++) {
      const f = await D.frame(); const c = classify(f);
      if (c !== prev || (c === 'night' && nightShots < 60)) {
        if (c === 'night') nightShots++;
        await savePng(`dos_${String(++saved).padStart(4, '0')}_${c}`, f);
      }
      if (c === 'normal' && prev === 'night') { day++; nightShots = 0; console.log('new day', day); }
      prev = c;
      if (c === 'victory') { console.log('victory reached'); break; }
      if (c === 'doit') await D.click(116, 77);
      else if (c === 'normal') await D.click(20, 42);
      else if (c === 'story') await D.click(30, 208);
      else if (c === 'defence') { for (const x of [217, 257, 297]) { await D.click(x, 211); } }
      else await sleep(150);
      await sleep(c === 'night' ? 100 : 700);
    }
  },
  async moves() {
    await start();
    await allChars('chars_start');
    // wait = 57 minutes; stop at the first mismatch in the character overview
    for (let k = 0; k < 3; k++) {
      await say([86], 6000);
      await compare('after_wait' + k);
      if (await allChars('chars_wait' + k)) break;
    }
  },
  async night() {
    await start(); await compare('start');
    const st = await autoplay(400, s => s.day >= 3);
    console.log('reached', JSON.stringify(st));
  },
  async story() {
    await start(); await compare('start');
    await say([49, 58]); await compare('go_kendra');
    await say([29]); await compare('greet');
    for (let k = 0; k < 3; k++) { await say([113, 114]); await compare('smalltalk' + k); }
    // instrument the remake RNG: log every draw with its caller
    await web.evaluate(() => {
      const g = __dbg.ui.g, r = g.rng; window.rlog = []; window.rseed0 = r.seed;
      const orig = r.random.bind(r);
      r.random = () => { const v = orig(); const st = new Error().stack.split('\n').slice(2, 5).map(l => l.trim().replace(/^at /, '').replace(/\(.*\/src\//, '(')).join(' < '); rlog.push([v, st, g.s.time]); return v; };
    });
    await say([74]); await compare('agree');
    for (let k = 0; k < 4; k++) {
      const st = await Wb.state();
      if (!st.ids.includes(113)) break;
      await say([113, 114]); if (await compare('smalltalk_b' + k)) break;
    }
    const log = await web.evaluate(() => ({ seed0: rseed0, rlog }));
    fs.writeFileSync(path.join(OUT, 'rlog.json'), JSON.stringify(log, null, 1));
    console.log('random draws logged:', log.rlog.length);
  },
};

try {
  await scenarios[process.argv[2] || 'story']();
} catch (e) { console.error('ERROR', e.message); }
await browser.close();
