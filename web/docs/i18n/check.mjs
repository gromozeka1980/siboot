// Sanity check for a translation: node docs/i18n/check.mjs [lang=ru]
// Renders every template for characters 2..7 with the real I18n class and reports:
// mixed Latin/Cyrillic words, unknown {tokens}, English {he}/{his}/{him}, narration that overflows the
// two-line box, over-long UI/menu/dialog/face/word strings, and story files with a wrong option/result count.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { I18n, EN } from '../../src/i18n/i18n.js';

const lang = process.argv[2] || 'ru';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = path.join(root, 'assets/i18n', lang), en = path.join(root, 'assets/i18n/en');
const read = (d, f) => { try { return JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); } catch (e) { return e.code === 'ENOENT' ? null : (problem(`${f}: ${e.message}`), null); } };
let n = 0;
const problem = m => { n++; console.log('  ' + m); };

const i = new I18n(); i.lang = lang; i.active = true;
for (const f of ['ui', 'grammar', 'narration', 'dossiers', 'menus', 'dialogs', 'words']) i.d[f] = read(dir, f + '.json') || {};
const g = { s: { player: 1 }, male: w => i.char(w)?.gender === 'm', charName: w => i.form('name', w), species: () => '', fiance: () => '' };
const WHO = [2, 3, 4, 5, 6, 7];
const TOKEN = /\{([^{}]*)\}/g, OK = /^(name|species|fiance|myFiance)(\.(nom|gen|dat|acc|ins|pre))?$|\||^list\.\w+$|^pl:/;

function lint(where, tpl) {
  for (const w of String(tpl).match(/[A-Za-zА-Яа-яЁё]+/g) || []) if (/[A-Za-z]/.test(w) && /[А-Яа-яЁё]/.test(w)) problem(`${where}: mixed-script word "${w}"`);
  for (const [, b] of String(tpl).matchAll(TOKEN)) if (!OK.test(b)) problem(`${where}: unknown token {${b}}`);
  if (where.startsWith('story') && /[%~@#$^&=\]\\]/.test(String(tpl).replace(TOKEN, ''))) problem(`${where}: contains a story control character (% ~ @ # $ ^ & = ] \\)`);
}

console.log('narration');
for (const [k, tpl] of Object.entries(i.d.narration)) {
  lint('narration ' + k, tpl);
  for (const w of k === '2' ? [1] : WHO) {
    let out = i.render(tpl, w, g), second = '';
    if (out.length > 50) { let j = 53; while (j > 0 && out[j - 1] !== ' ') j--; second = out.slice(j); out = out.slice(0, j); }
    if (second.length > 58) { problem(`narration ${k} (${i.form('name', w)}): 2nd line ${second.length} > 58`); break; }
  }
}

console.log('ui');
for (const k of [...Object.keys(EN), ...Array.from({ length: 34 }, (_, j) => 'face.' + (j + 1))]) if (!(k in i.d.ui)) problem(`ui: missing key ${k}`);
const LIM = { 'btn.': 7, 'story.': 5, 'face.': 13, 'menu.': 22, 'clock.': 5 };
for (const [k, v] of Object.entries(i.d.ui)) {
  lint('ui ' + k, v);
  const p = Object.keys(LIM).find(p => k.startsWith(p));
  if (p && v.length > LIM[p]) problem(`ui ${k}: "${v}" ${v.length} > ${LIM[p]} chars`);
}

console.log('menus / dialogs / words');
const enMenus = read(en, 'menus.json') || [];
(Array.isArray(i.d.menus) ? i.d.menus : []).forEach((m, a) => m.items.forEach((it, b) => {
  lint(`menu ${a}.${b}`, it.text);
  if (it.text.length > 22) problem(`menu "${it.text}" ${it.text.length} > 22`);
  if (it.key !== enMenus[a]?.items[b]?.key) problem(`menu "${it.text}": key ${it.key} differs from English`);
}));
for (const s of i.d.dialogs.quit || []) if (s.length > 30) problem(`dialog "${s}" ${s.length} > 30`);
const WIDE = /[жшщыюмфЖШЩЫЮМФ]/;
for (const [k, lines] of Object.entries(i.d.words)) {
  if (lines.length > 3) problem(`word ${k}: ${lines.length} lines`);
  for (const l of lines) { const px = [...l].reduce((a, c) => a + (WIDE.test(c) ? 6 : c === '-' ? 6 : c === '.' ? 3 : c === ' ' ? 4 : 5), 0); if (px > 31) problem(`word ${k}: "${l}" ~${px}px > 31`); }
}

console.log('dossiers');
for (const [k, v] of Object.entries(i.d.dossiers)) if (k !== 'love') lint('dossier ' + k, v);
for (const [k, v] of Object.entries(i.d.dossiers.love || {})) lint('love ' + k, v);

console.log('stories');
for (let s = 1; s <= 44; s++) {
  const tr = read(path.join(dir, 'stories'), `story${s}.json`), orig = read(path.join(en, 'stories'), `story${s}.json`);
  if (!tr) continue;
  lint(`story${s} text`, tr.text);
  if (/\{(he|his|him|hers)\}/i.test(JSON.stringify(tr))) problem(`story${s}: English pronoun token left ({he}/{his}/{him}) — use {он|она} etc.`);
  if (tr.options?.length !== 4) { problem(`story${s}: ${tr.options?.length} options, need 4`); continue; }
  tr.options.forEach((o, k) => {
    lint(`story${s} option ${k + 1}`, o.title);
    const t = i.render(o.title, 7, g);
    if (t.length > 80) problem(`story${s} option ${k + 1}: title ${t.length} > 80 chars with Скордокотт`);
    o.results.forEach((r, m) => lint(`story${s} option ${k + 1} result ${m + 1}`, r));
    if (o.results.length !== orig.options[k].results.length) problem(`story${s} option ${k + 1}: ${o.results.length} results, English has ${orig.options[k].results.length}`);
  });
}
console.log(n ? `${n} problem(s)` : 'OK');
process.exitCode = n ? 1 : 0;
