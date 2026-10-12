// Validates a translation against the English source export and the game's layout limits.
//   node tools/i18n_check.mjs ru [--quiet]
// Checks: completeness, story structure (4 options, same number of result lines), token syntax,
// forbidden characters, narration fits the 2-line box, pixel widths of buttons / icon labels
// in the real fonts, and that every character used has a glyph.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EN, I18n } from '../src/i18n/i18n.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lang = process.argv[2] || 'ru', quiet = process.argv.includes('--quiet');
const J = p => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); } catch (e) { return e.code === 'ENOENT' ? null : { __error: e.message }; } };
const font = name => J(`assets/fonts/${name}.json`);
const F13 = font('rmn6_13'), F19 = font('rmn6_19'), F8 = font('rmn4_08');
const REMAP = { '«': '"', '»': '"', '„': '"', '“': '"', '”': '"' };
const key = (f, c) => String(((f !== F19 && REMAP[c]) || (f === F19 && '„“”'.includes(c) && REMAP[c]) || c).codePointAt(0));
const width = (f, s) => [...s].reduce((w, c) => w + (f.glyphs[String(c.codePointAt(0))]?.w ?? 0), 0);
const missing = new Map();
const glyphCheck = (f, s, where) => { for (const c of s) if (!f.glyphs[String(c.codePointAt(0))] && c !== '\n') missing.set(`${c} (U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}) in ${f === F8 ? 'rmn4_08' : f === F19 ? 'rmn6_19' : 'rmn6_13'}`, where); };

const errors = [], warns = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warns.push(`${where}: ${msg}`);

const L = f => J(`assets/i18n/${lang}/${f}`);
const ui = L('ui.json') || {}, grammar = L('grammar.json'), narr = L('narration.json'), doss = L('dossiers.json');
const menus = L('menus.json'), dialogs = L('dialogs.json'), words = L('words.json');
for (const [n, v] of Object.entries({ 'ui.json': ui, 'grammar.json': grammar, 'narration.json': narr, 'dossiers.json': doss, 'menus.json': menus, 'dialogs.json': dialogs, 'words.json': words }))
  if (!v) warn(n, 'missing'); else if (v.__error) err(n, 'invalid JSON: ' + v.__error);

// ---- a renderer with the translation's grammar, to measure texts after substitution
const i18n = new I18n(); i18n.active = true; i18n.lang = lang;
i18n.d = { grammar: grammar || {}, ui };
const fakeG = { s: { player: 1 }, male: w => [0, 0, 0, 1, 1, 1, 0, 1, 1][w], charName: w => 'X', species: () => 'X', fiance: () => 'X' };
const TOKEN = /\{([^{}]*)\}/g;
function tokens(where, s, allowed = /^(name|species|fiance|myFiance)(\.(nom|gen|dat|acc|ins|pre))?$/) {
  for (const m of String(s).matchAll(TOKEN)) {
    const b = m[1];
    if (b.includes('|')) { if (b.replace(/^P:/, '').split('|').length !== 2) err(where, `bad gender choice {${b}}`); continue; }
    if (!allowed.test(b)) err(where, `unknown token {${b}}`);
  }
  if (/[%~@#$^&=\]\\]/.test(String(s).replace(TOKEN, ''))) err(where, 'contains a reserved character (% ~ @ # $ ^ & = ] \\)');
}
const longest = s => { let best = ''; for (let w = 1; w <= 8; w++) { const r = i18n.render(s, w, fakeG); if (r.length > best.length) best = r; } return best; };

// ---- grammar
if (grammar && !grammar.__error) {
  for (let w = 1; w <= 8; w++) {
    const c = grammar.characters?.[String(w)];
    if (!c) { err('grammar.json', `character ${w} missing`); continue; }
    if (!['m', 'f'].includes(c.gender)) err('grammar.json', `character ${w}: gender must be m|f`);
    for (const k of ['name', 'species', 'fiance']) {
      const v = c[k];
      if (w === 8 && k !== 'name') continue;
      if (typeof v === 'object') for (const cs of ['nom', 'gen', 'dat', 'acc', 'ins', 'pre']) if (!v[cs]) err('grammar.json', `character ${w} ${k}.${cs} missing`);
      if (v == null) err('grammar.json', `character ${w} ${k} missing`);
    }
  }
}

// ---- ui strings
const limits = { 'btn.back1': [F13, 54], 'btn.back2': [F13, 54], 'btn.doit': [F13, 54], 'btn.cancel': [F13, 54], 'btn.ok': [F13, 54],
  'story.done': [F13, 38], 'story.prev1': [F13, 38], 'story.next1': [F13, 38], 'story.page2': [F13, 38],
  'options.easy': [F13, 78], 'options.medium': [F13, 78], 'options.hard': [F13, 78], 'options.short': [F13, 78], 'options.mediumLen': [F13, 78],
  'options.long': [F13, 78], 'options.proceed': [F13, 78], 'victory.title': [F19, 600], 'face.looks': [F13, 110] };
for (const k of Object.keys(EN)) {
  if (!(k in ui)) { (k.startsWith('about.') || k === 'narrate.bad' ? warn : err)('ui.json', `missing key ${k}`); continue; }
  const f = limits[k]?.[0] || F13;
  if (!/^(lib|m|gloss|tip)\./.test(k)) glyphCheck(f, ui[k], 'ui ' + k); // lib./m./gloss./tip. are HTML-only (Library, remake UI), not drawn in the game fonts
  if (limits[k] && width(f, ui[k]) > limits[k][1]) err('ui.json', `${k} "${ui[k]}" is ${width(f, ui[k])}px, max ${limits[k][1]}px`);
}
for (let i = 1; i <= 34; i++) {
  const k = 'face.' + i;
  if (!ui[k]) err('ui.json', `missing ${k}`);
  else { glyphCheck(F13, ui[k], k); if (width(F13, ui[k]) > 110) err('ui.json', `${k} "${ui[k]}" too wide (${width(F13, ui[k])}px > 110)`); }
}
{ const clock = (ui['clock.day'] || '') + '64', t = '12:59 ' + (ui['clock.pm'] || ''); if (Math.max(width(F13, clock), width(F13, t)) > 60) err('ui.json', `clock texts too wide ("${clock}", "${t}")`); }

// ---- narration
const enNarr = J('assets/i18n/en/narration.json');
if (narr && !narr.__error) for (const k of Object.keys(enNarr)) {
  const v = narr[k];
  if (v == null) { err('narration.json', `missing ${k}`); continue; }
  tokens('narration ' + k, v);
  const s = longest(v);
  glyphCheck(F13, s, 'narration ' + k);
  let first = s, second = '';
  if (s.length > 50) { let i = 53; while (i > 0 && s[i - 1] !== ' ') i--; first = s.slice(0, i); second = s.slice(i); }
  if (width(F13, first) > 424 || width(F13, second) > 418) err('narration ' + k, `does not fit the box (${width(F13, first)}px / ${width(F13, second)}px): "${s}"`);
}

// ---- stories
let words_ru = 0;
for (let n = 1; n <= 44; n++) {
  const en = J(`assets/i18n/en/stories/story${n}.json`), tr = L(`stories/story${n}.json`);
  if (!tr) { warn(`story${n}`, 'not translated'); continue; }
  if (tr.__error) { err(`story${n}`, 'invalid JSON: ' + tr.__error); continue; }
  if (!tr.text) err(`story${n}`, 'missing text');
  tokens(`story${n} text`, tr.text);
  glyphCheck(F13, i18n.render(tr.text, 2, fakeG), `story${n}`);
  words_ru += String(tr.text).split(/\s+/).length;
  if (!Array.isArray(tr.options) || tr.options.length !== 4) { err(`story${n}`, 'needs exactly 4 options'); continue; }
  tr.options.forEach((o, k) => {
    tokens(`story${n} option ${k + 1}`, o.title);
    const t = longest(o.title);
    glyphCheck(F13, t, `story${n} option ${k + 1}`);
    if (width(F13, t) > 620) err(`story${n} option ${k + 1}`, `title too wide (${width(F13, t)}px > 620): "${t}"`);
    if ((o.results || []).length !== en.options[k].results.length) err(`story${n} option ${k + 1}`, `needs ${en.options[k].results.length} result text(s), has ${(o.results || []).length}`);
    (o.results || []).forEach((r, q) => { tokens(`story${n} option ${k + 1} result ${q + 1}`, r); glyphCheck(F13, longest(r), `story${n} result`); });
  });
}

// ---- dossiers
if (doss && !doss.__error) {
  for (let w = 1; w <= 8; w++) { const v = doss[String(w)]; if (!v) err('dossiers.json', `missing ${w}`); else { tokens('dossier ' + w, v); glyphCheck(F13, v, 'dossier ' + w); } }
  for (let i = 1; i <= 5; i++) {
    const v = doss.love?.[String(i)];
    if (!v) err('dossiers.json', `missing love.${i}`);
    else tokens('dossier love ' + i, v.replace(/\{list\.\w+\}|\{pl:[^}]*\}/g, ''));
  }
}

// ---- menus / dialogs / words
const enMenus = J('assets/i18n/en/menus.json');
if (menus && !menus.__error) {
  if (menus.length !== enMenus.length) err('menus.json', `needs ${enMenus.length} menus`);
  menus.forEach((m, i) => {
    glyphCheck(F13, m.title, 'menu');
    if ((m.items || []).length !== enMenus[i]?.items.length) err('menus.json', `menu ${i + 1} needs ${enMenus[i]?.items.length} items`);
    (m.items || []).forEach((it, k) => {
      glyphCheck(F13, it.text, 'menu item');
      if ((it.key || null) !== (enMenus[i]?.items[k]?.key || null)) err('menus.json', `menu ${i + 1} item ${k + 1}: key must stay "${enMenus[i]?.items[k]?.key}"`);
    });
  });
}
if (dialogs && !dialogs.__error && (!Array.isArray(dialogs.quit) || dialogs.quit.length !== 5)) err('dialogs.json', 'quit needs 5 strings');
if (dialogs?.quit) dialogs.quit.forEach(s => glyphCheck(F13, s, 'quit dialog'));
if (words && !words.__error) for (const [n, v] of Object.entries(words)) {
  const lines = Array.isArray(v) ? v : String(v).split('\n');
  if (lines.length > 3) err(`words.json ${n}`, 'max 3 lines');
  for (const l of lines) {
    glyphCheck(F8, l, `word ${n}`);
    const w = width(F8, l) > 30 ? width(F8, l) - ([...l].length - 1) : width(F8, l); // renderer tightens long words
    if (w > 30) err(`words.json ${n}`, `"${l}" is ${w}px wide even with tight spacing, max 30`);
  }
}

for (const [c, where] of missing) err('font', `no glyph for ${c} (first used in ${where})`);
if (!quiet) { for (const w of warns) console.log('warn ', w); }
for (const e of errors) console.log('ERROR', e);
console.log(`${lang}: ${errors.length} error(s), ${warns.length} warning(s); translated story words: ${words_ru}`);
process.exitCode = errors.length ? 1 : 0;
