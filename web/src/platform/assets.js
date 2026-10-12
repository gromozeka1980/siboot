// Loads the converted game assets (tools/extract.py -> assets/manifest.json) into indexed images.

import { BitmapFont, MetricsFont } from '../ui/font.js';

const BASE = 'assets/';

async function loadImage(url) {
  const img = new Image();
  img.src = BASE + url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}

/** RGBA ImageData region -> {w,h,data:Uint8Array of palette indices} */
function toIndexed(id, pal, x0 = 0, y0 = 0, w = id.width, h = id.height) {
  const cache = new Map();
  const index = (r, g, b) => {
    const k = (r << 16) | (g << 8) | b;
    let v = cache.get(k);
    if (v === undefined) {
      let best = 1e9;
      pal.forEach(([pr, pg, pb], i) => { const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2; if (d < best) { best = d; v = i; } });
      cache.set(k, v);
    }
    return v;
  };
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = ((y0 + y) * id.width + x0 + x) * 4;
    data[y * w + x] = index(id.data[o], id.data[o + 1], id.data[o + 2]);
  }
  return { w, h, data };
}

async function sheet(spec, pal) {
  const id = await loadImage(spec.file);
  const [cw, ch] = spec.cell, out = [null];
  for (let n = 0; n < spec.count; n++) out.push(toIndexed(id, pal, (n % spec.cols) * cw, Math.floor(n / spec.cols) * ch, cw, ch));
  return out;
}

const text = async url => new TextDecoder('latin1').decode(await (await fetch(BASE + url)).arrayBuffer());

export async function loadAssets() {
  const man = await (await fetch(BASE + 'manifest.json')).json();
  const P = man.palettes, main = P.main;
  const [wordIcon, wordText] = await Promise.all([sheet(man.wordIcons, main), sheet(man.wordText, main)]);
  const emotion = [null, ...await Promise.all(man.emotionFaces.files.map(async f => toIndexed(await loadImage(f), main)))];
  const order = ['vetvel', 'kendra', 'gardbore', 'wiki', 'locksher', 'zubi', 'skord', 'chris'];
  const faces = [null, ...await Promise.all(order.map(async n => {
    const p = man.portraits[n], pal = P[p.palette];
    return { img: toIndexed(await loadImage(p.file), pal), palette: pal };
  }))];
  const logo = toIndexed(await loadImage(man.logo.file), P.logo);
  const [font, font19, fontSmall, metrics] = await Promise.all([
    BitmapFont.load(BASE + man.fonts.rmn6_13), BitmapFont.load(BASE + man.fonts.rmn6_19),
    BitmapFont.load(BASE + man.fonts.rmn4_08), MetricsFont.load(BASE + man.fonts.bgi_small_metrics)]);

  font.remap = fontSmall.remap = { '«': '"', '»': '"', '„': '"', '“': '"', '”': '"' };
  font19.remap = { '„': '"', '“': '"', '”': '"' };

  // STRINGS.TXT: first line "#301", then one message per non-empty line (DOS skips empty lines)
  const strings = [null, ...(await text(man.text.strings)).split(/\r\n|\r|\n/).slice(1).filter(l => l.trim() !== '')];
  const range = n => Array.from({ length: n }, (_, i) => i + 1);
  const stories = [null, ...await Promise.all(range(44).map(n => text(man.text.stories[n])))];
  const dossiers = [null, ...await Promise.all(range(8).map(n => text(man.text.dossiers[n])))]; // raw bytes, as DOS draws them
  const [menus, quitDialog] = await Promise.all([text(man.text.menus), text(man.text.dialogs.quit)]);

  // connection tables: CONNECT data copied into the manifest-independent binary below
  const conn = new Uint8Array(await (await fetch(BASE + 'connect.bin')).arrayBuffer());
  const table = off => Array.from({ length: 129 }, (_, w) => w === 0 ? new Uint8Array(129) : conn.subarray(off + (w - 1) * 129, off + w * 129));

  return {
    palette: main, palettes: P, wordIcon, wordText, emotion, faces, logo, font, font19, fontSmall, metrics,
    strings, stories, dossiers, menus, quitDialog, cursor: man.cursor,
    follows1: table(0), follows2: table(16512),
  };
}
