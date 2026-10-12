// The remake (play.html): title screen, sentence builder and turn loop around the unchanged engine.
// Presentation of engine events: ModernView (view.js). Same game rules as the classic version (index.html).

import { loadAssets } from '../platform/assets.js';
import { Game } from '../engine/game.js';
import { Rng } from '../engine/rng.js';
import { ObjectB2, W } from '../engine/constants.js';
import { i18n, I18n } from '../i18n/i18n.js';
import { Library } from './library.js';
import { ModernView, icon, portrait, setRemake, auraSvg } from './view.js';
import { gloss } from './gloss.js';
import { sound } from './sound.js';
import { Tips } from './tips.js';
import { advise } from './advisor.js';
import { loveSummaryText } from '../ui/screens.js';

const T = (k, en) => i18n.t('m.' + k, en);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
// saves: 'auto' (after every move) and three manual slots; each = {s: engine state, seed: rng, at: time}
const KEY = slot => slot === 'auto' ? 'siboot.play.save' : 'siboot.play.slot' + slot;
const store = {
  get(slot = 'auto') { try { return JSON.parse(localStorage.getItem(KEY(slot))); } catch { return null; } },
  set(v, slot = 'auto') { try { localStorage.setItem(KEY(slot), JSON.stringify({ ...v, at: Date.now() })); } catch { /* private mode: no saves */ } },
  clear(slot = 'auto') { try { localStorage.removeItem(KEY(slot)); } catch { /* ignore */ } },
};
const SLOTS = ['auto', 1, 2, 3];
// toolbar icons (phones show the icon only, desktops the label)
const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON = {
  auras: svg('<path d="M12 3l3 6H9z"/><circle cx="6" cy="17" r="3.2"/><path d="M15.5 14.5l5 5M20.5 14.5l-5 5"/>'),
  chars: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.6 3-5.5 6-5.5s5.4 1.9 6 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.6c2.6.2 4.1 2 4.5 4.9"/>'),
  journal: svg('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>'),
  library: svg('<path d="M4 5h4v15H4zM10 5h4v15h-4z"/><path d="M16 6l3.6-1 3 14.2-3.6 1z"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
};
const tb = (cmd, label, cls = '') => `<button class="hbtn ${cls}" data-cmd="${cmd}" aria-label="${label}" title="${label}">${cmd === 'auras' ? `<b class="tri">${[1, 2, 3].map(k => auraSvg(k)).join('')}</b>` : ICON[cmd]}<span>${label}</span></button>`;
// a deal is "I tell <listener> <whose> <which aura>, if <you tell me> <whose> <which aura>": what each slot asks for
const SLOT_HINT = { 2: 'to whom you offer', 3: 'whose aura you tell', 4: 'which of their auras', 6: 'whose aura you want to learn', 7: 'which of their auras' };
// immersion mode: icons without captions or translations, as in 1987 (a click on a conversation bubble reveals its meaning)
const immersion = () => { try { return localStorage.getItem('siboot.immersion') === '1'; } catch { return false; } };
const advisorOn = () => { try { return localStorage.getItem('siboot.advisor') !== '0'; } catch { return true; } };
const setAdvisor = on => { try { localStorage.setItem('siboot.advisor', on ? '1' : '0'); } catch { /* ignore */ } document.body.classList.toggle('no-advisor', !on); };
const setImmersion = on => { try { localStorage.setItem('siboot.immersion', on ? '1' : '0'); } catch { /* ignore */ } document.body.classList.toggle('immersion', on); };
const X = '<button class="x" data-x aria-label="close">×</button>'; // close button of closable modals
const hhmm = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
const slotLabel = (slot, v) => `${slot === 'auto' ? T('autosave', 'Autosave') : T('slot', 'Slot') + ' ' + slot}: ${v ? `${T('day', 'Day')} ${v.s.day}, ${hhmm(v.s.time)} · ${new Date(v.at || 0).toLocaleString(i18n.lang)}` : T('empty', 'empty')}`;

// full-word icon captions for the builder (the in-game captions are abbreviated to fit 31 px)
const LABEL_FIX = { ru: { 44: 'предложить обмен', 90: 'нарушил «не предам»', 91: 'нарушил «не нападу»', 36: 'счёт танаги', 37: 'счёт кацина', 38: 'счёт шиала' } };
async function loadLabels(lang) {
  const raw = await fetch(`assets/i18n/${lang}/words.json`).then(r => r.json()).catch(() => ({}));
  const out = {};
  for (const [n, v] of Object.entries(raw)) out[n] = (Array.isArray(v) ? v : [v]).reduce((a, l) => a.endsWith('-') ? a.slice(0, -1) + l : a ? a + ' ' + l : l, '');
  return Object.assign(out, LABEL_FIX[lang] || {});
}

async function main() {
  const [assets] = await Promise.all([loadAssets(), i18n.load(I18n.requested())]);
  document.documentElement.lang = i18n.lang;
  document.title = T('title', 'Trust & Betrayal') + ' — ' + T('subtitle', 'The Legacy of Siboot');
  const labels = await loadLabels(i18n.lang);
  setRemake(await fetch('assets/remake/manifest.json').then(r => r.json()).catch(() => []));
  const library = new Library();
  addEventListener('pointerdown', () => sound.start(), { capture: true });
  let next = await titleScreen(library);
  for (;;) {
    const r = await play(assets, labels, library, next);
    next = r?.resume ? r : await titleScreen(library);
  }
}

// ---------------------------------------------------------------- title
function titleScreen(library) {
  const root = document.getElementById('root');
  const saved = store.get();
  const opt = { level: 1, gameLeng: 1 };
  root.innerHTML = `<div class="title"><div class="title-card">
    <h1>${T('title', 'Trust & Betrayal')}</h1><div class="sub">${T('subtitle', 'The Legacy of Siboot')}</div>
    <div class="opts">
      <div class="opt-row"><span>${i18n.t('options.level')}</span><div class="seg" data-k="level">
        ${[1, 2, 3, 4].map(v => `<button data-v="${v}" class="${v === 1 ? 'on' : ''}" ${v === 4 ? `title="${T('veryHardHint', 'Remake addition: opponents choose their auras by expected gain')}"` : ''}>${v === 4 ? T('veryHard', 'Very hard') : i18n.t(['', 'options.easy', 'options.medium', 'options.hard'][v])}</button>`).join('')}</div></div>
      <div class="opt-row"><span>${i18n.t('options.length')}</span><div class="seg" data-k="gameLeng">
        ${[1, 2, 3].map(v => `<button data-v="${v}" class="${v === 1 ? 'on' : ''}">${i18n.t(['', 'options.short', 'options.mediumLen', 'options.long'][v])}</button>`).join('')}</div></div>
      <div class="row">${saved ? `<button class="btn primary" data-continue style="flex:1">${T('continueGame', 'Continue')} · ${T('day', 'Day')} ${saved.s.day}</button>` : ''}
        <button class="btn ${saved ? '' : 'primary'}" data-start style="flex:1">${T('start', 'Start a new game')}</button>
        ${SLOTS.slice(1).some(k => store.get(k)) ? `<button class="btn" data-load style="flex:1">${T('load', 'Load')}</button>` : ''}</div>
      <div class="warn">${i18n.t('options.warn2')} ${i18n.t('options.warn3')} ${i18n.t('options.warn4')}</div>
    </div>
    <div class="links"><button data-lib="novella">${i18n.t('lib.readNovella')}</button><button data-lib="rules">${i18n.t('lib.readRules')}</button>
      <button data-lang>${i18n.lang === 'en' ? 'Русский' : 'English'}</button><a href="index.html${location.search}">${T('classic', 'Original 1987 version')}</a></div>
  </div></div>`;
  return new Promise(resolve => root.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const seg = b.closest('.seg');
    if (seg) { opt[seg.dataset.k] = Number(b.dataset.v); seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }
    if (b.dataset.lib) library.show(b.dataset.lib);
    if ('lang' in b.dataset) switchLanguage();
    if ('start' in b.dataset) { root.onclick = null; resolve(opt); }
    if ('continue' in b.dataset) { root.onclick = null; resolve({ resume: saved }); }
    if ('load' in b.dataset) chooseSlot(false).then(v => { if (v) { root.onclick = null; resolve({ resume: v }); } });
  });
}

/** Slot picker: save=true writes `data` into the chosen slot; otherwise resolves with the chosen save. */
function chooseSlot(save, data) {
  const m = document.createElement('div');
  m.className = 'modal closable';
  const slots = save ? SLOTS.slice(1) : SLOTS.filter(k => store.get(k));
  m.innerHTML = `<div class="sheet" style="width:min(520px,100%)"><h2>${save ? T('save', 'Save') : T('load', 'Load')}</h2><div class="choices">
    ${slots.map(k => `<button data-slot="${k}">${esc(slotLabel(k, store.get(k)))}</button>`).join('')}
    <button data-slot="">${i18n.t('btn.cancel')}</button></div></div>`;
  document.body.appendChild(m);
  return new Promise(res => m.onclick = e => {
    const b = e.target.closest('[data-slot]'); if (!b && e.target !== m) return;
    m.remove();
    const k = b?.dataset.slot; if (!k) return res(null);
    const slot = k === 'auto' ? 'auto' : Number(k);
    if (save) { store.set(data, slot); res(true); } else res(store.get(slot));
  });
}

function switchLanguage() {
  const lang = i18n.lang === 'en' ? 'ru' : 'en';
  try { localStorage.setItem('siboot.lang', lang); } catch { /* ignore */ }
  const u = new URL(location.href); u.searchParams.set('lang', lang); location.href = u.href;
}

// ---------------------------------------------------------------- the game screen
const LAYOUT = () => `<div class="app">
  <header><h1>${T('title', 'Trust & Betrayal')}</h1><span class="clock" id="clock"></span>
    ${tb('auras', T('aurasBtn', 'Auras'), 'phone-only')}${tb('chars', T('characters', 'Characters'))}${tb('journal', T('journal', 'Journal'))}${tb('library', i18n.t('lib.menu'), 'desk-only')}${tb('menu', T('menu', 'Menu'))}</header>
  <main><div class="scene" id="scene"><div class="tag"></div><div class="who-wrap" style="display:flex;gap:22px;align-items:flex-end"></div></div>
    <section class="card log" id="log" aria-live="polite"></section></main>
  <aside><section class="card"><h3>${T('auraKnow', 'What I know of the auras')}</h3><table class="auras" id="auras"></table>
      <div class="beats" title="${T('beatsHint', 'Tanaga beats katsin, katsin beats shial, shial beats tanaga')}">${[1, 2, 3].map(k =>
        `<span>${auraSvg(k)}</span><i>${T('beatsArrow', 'beats')} →</i>`).join('')}<span>${auraSvg(1)}</span></div>
      <div class="muted" style="font-size:12px;margin-top:8px">${T('auraHint2', 'Everyone learns new things about the others at midnight. Icons on the right are promises; click a row for everything about that character.')}</div></section></aside>
  <footer class="card"><div class="builder"><div><div class="slots" id="slots"></div><div class="preview" id="preview"></div><div class="palette" id="palette"></div></div>
    <div class="actions"><button class="btn primary" id="say">${T('say', 'Say it')}</button><button class="btn" id="back" aria-label="${T('back', 'Back')}"><i>↶</i><span>${T('back', 'Back')}</span></button>
      <button class="btn" id="cancel" aria-label="${i18n.t('btn.cancel')}"><i>✕</i><span>${i18n.t('btn.cancel')}</span></button><button class="btn hint" id="advise" aria-label="${T('advise', 'What to do?')}"><i>💡</i><span>💡 ${T('advise', 'What to do?')}</span></button><span class="kbd">${T('keys', 'Enter · Backspace · Esc')}</span></div></div></footer>
</div>`;

async function play(assets, labels, library, opt) {
  const root = document.getElementById('root');
  root.onclick = null;
  root.innerHTML = LAYOUT();
  document.body.classList.toggle('immersion', immersion());
  const view = new ModernView(assets, labels);
  const tips = new Tips();
  setAdvisor(advisorOn());
  const game = new Game(assets, view);
  view.g = game;
  window.__play = { game, view }; // debugging hook (tests, console)
  const seed = new URLSearchParams(location.search).get('seed');
  if (seed !== null) game.rng = new Rng(Number(seed) || 0);
  game.initChars();
  if (opt.resume) {
    game.initGame(1, 1, false);
    Object.assign(game.s, opt.resume.s);
    game.rng.seed = opt.resume.seed >>> 0;
  } else {
    store.clear();
    game.initGame(opt.level, opt.gameLeng, false);
    game.s.storyDelay = 60;
  }
  const s = game.s, P = s.player;
  let busy = false, over = false;

  const autoPick = () => { while (s.iconCount === 1 && s.sntcIndx !== ObjectB2) game.chooseWord(Math.abs(s.iconID[1])); };
  if (opt.resume?.journal) view.journal = opt.resume.journal;
  if (opt.resume?.auraLog) view.auraLog = opt.resume.auraLog;
  const state = () => ({ s, seed: game.rng.seed, journal: view.journal, auraLog: view.auraLog });
  const save = () => store.set(state());

  function drawBuilder() {
    const S = s.sentence[P], done = s.sntcIndx === ObjectB2;
    const filled = [1, 2, 3, 4, 5, 6, 7, 8].filter(i => i <= s.sntcIndx && S[i] > 0);
    document.getElementById('slots').innerHTML = filled.map(i => `<div class="slot">${icon(S[i])}</div>`).join('') + (done ? '' : '<div class="slot cur"></div>');
    const hint = !done && S[2] === W.Reveal && SLOT_HINT[s.sntcIndx] ? ` <span class="slot-hint">→ ${esc(T('slot.' + s.sntcIndx, SLOT_HINT[s.sntcIndx]))}</span>` : '';
    document.getElementById('preview').innerHTML = immersion() ? '' : done ? esc(gloss(S, game)) :
      `<span class="muted">${filled.map(i => esc(labels[S[i]] || '')).join(' · ')}${filled.length ? ' …' : ''}</span>${hint}`;
    const ids = done ? [] : s.iconID.slice(1, s.iconCount + 1).map(Math.abs);
    document.getElementById('palette').innerHTML = ids.map(w => `<button class="chip" data-w="${w}" title="${esc(labels[w] || '')}">${icon(w)}<span>${esc(labels[w] || '')}</span></button>`).join('');
    document.getElementById('say').disabled = !done;
    document.getElementById('back').disabled = s.sntcIndx <= 1;
    document.getElementById('cancel').disabled = s.sntcIndx <= 1;
  }
  view.onRender = () => { drawBuilder(); tips.check(s); };
  // keep the newest line in view when the panel below grows or shrinks (phones: the action panel changes height)
  const log = document.getElementById('log');
  let stick = true;
  log.addEventListener('scroll', () => { stick = log.scrollHeight - log.scrollTop - log.clientHeight < 40; });
  new ResizeObserver(() => { if (stick) log.scrollTop = log.scrollHeight; }).observe(log);

  async function act(fn) {
    if (busy || over) return;
    busy = true; document.body.classList.add('busy');
    try { await fn(); } finally { busy = false; document.body.classList.remove('busy'); }
    if (!over) { autoPick(); save(); view.render(); }
  }
  const pick = w => act(async () => { sound.play('pick'); game.chooseWord(w); });
  const say = () => act(async () => { if (s.sntcIndx !== ObjectB2) return; sound.play('say'); await game.execMove(); if (!game.quit) game.endSntc(); });

  root.onclick = e => {
    if (document.body.classList.contains('sheet-auras') && !e.target.closest('[data-cmd="auras"]') && (!e.target.closest('.app > aside') || e.target.closest('[data-who]')))
      document.body.classList.remove('sheet-auras'); // a tap outside (or on a character row) closes the sheet
    const bub = e.target.closest('.bubble'); if (bub && immersion()) bub.classList.toggle('reveal');
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.w) pick(Number(b.dataset.w));
    else if (b.id === 'say') say();
    else if (b.id === 'back') act(async () => game.backSpace());
    else if (b.id === 'cancel') act(async () => game.endSntc());
    else if (b.id === 'advise') { tips.hide(); tips.say(advise(game)); }
    else if (b.dataset.cmd) command(b.dataset.cmd);
  };
  root.addEventListener('click', e => { const r = e.target.closest('[data-who]'); if (r && !e.target.closest('button')) charCard(Number(r.dataset.who)); });
  const onKey = e => {
    if (e.key === 'Escape') { const ms = document.querySelectorAll('.modal.closable'); if (ms.length) { ms[ms.length - 1].remove(); return; } }
    if (document.querySelector('.modal') || library.open) return;
    if (e.key === 'Enter') { e.preventDefault(); say(); }
    if (e.key === 'Backspace' && s.sntcIndx > 1) { e.preventDefault(); act(async () => game.backSpace()); }
    if (e.key === 'Escape' && s.sntcIndx > 1) act(async () => game.endSntc());
  };
  addEventListener('keydown', onKey);

  /** The aura counts of w the player has seen, day by day (newest first). */
  function auraHistory(w) {
    const days = Object.keys(view.auraLog).map(Number).filter(d => view.auraLog[d][w]).sort((a, b) => b - a);
    if (!days.length) return '';
    return `<h3>${T('auraHistory', 'Auras you have seen')}</h3><table class="ahist"><tr><th></th>${[1, 2, 3].map(k => `<th>${auraSvg(k)}</th>`).join('')}</tr>${days.map(d =>
      `<tr><td>${T('day', 'Day')} ${d}${d === s.day ? ` (${T('today', 'today')})` : ''}</td>${view.auraLog[d][w].map(v => `<td>${v < 0 ? '<span class="muted">?</span>' : v}</td>`).join('')}</tr>`).join('')}</table>`;
  }

  /** Everything about one character in one place; who = 0 shows the seven as tiles. */
  function charCard(who) {
    document.querySelector('.modal.chars')?.remove();
    const m = view.modal('', true); m.classList.add('chars');
    const A = s.auraCnt;
    const species = i => esc(i18n.active ? i18n.form('species', i, 'nom', game) : game.species(i));
    const draw = w => {
      if (!w) {
        m.querySelector('.sheet').innerHTML = `${X}<h2>${T('characters', 'Characters')}</h2><div class="tiles">${[1, 2, 3, 4, 5, 6, 7].map(i =>
          `<button class="tile" data-card="${i}"><img src="${portrait(i)}" alt=""><b>${esc(view.name(i))}</b><span class="muted">${species(i)}</span><span class="tile-auras">${[1, 2, 3].map(k => `${auraSvg(k)}${A[k][i][P] < 0 ? '?' : A[k][i][P]}`).join(' ')}</span></button>`).join('')}</div>`;
        return;
      }
      const auras = [1, 2, 3].map(k => { const v = A[k][w][P]; return `<span>${auraSvg(k)}<b>${v < 0 ? '?' : v}</b></span>`; }).join('');
      const proms = w === P ? [] : view.promises(w);
      const betr = s.hist.filter(e => e.know[P] && (e.wrd1 === w || e.wrd3 === w));
      m.querySelector('.sheet').innerHTML = `${X}<button class="back" data-card="0">← ${T('allChars', 'All characters')}</button>
        <div class="card-head"><img src="${portrait(w)}" alt=""><div><h2>${esc(view.name(w))}</h2>
          <div class="muted">${species(w)}</div><div class="card-auras">${auras}</div></div></div>
        ${w === P ? '' : auraHistory(w)}
        ${w === P ? '' : `<h3>${T('promises', 'Promises')}</h3><ul class="list">${proms.map(p => `<li class="${p.k === 'broken' ? 'down' : ''}">${esc(p.text)}</li>`).join('') || `<li class="muted">${T('noPromises', 'No promises yet.')}</li>`}</ul>`}
        ${betr.length ? `<h3>${T('journalHint', 'Betrayals you know about')}</h3><ul class="list">${betr.map(e => `<li>${T('day', 'Day')} ${e.date}, ${hhmm(e.time)}: ${esc(T('betrayed', '{X} betrayed {Y}').replace('{X}', view.name(e.wrd1)).replace('{Y}', view.name(e.wrd3, 'acc')))}</li>`).join('')}</ul>` : ''}
        <h3>${T('dossier', 'Dossier')}</h3><p class="dossier-text">${esc((i18n.active && i18n.dossier(w)) || assets.dossiers[w] || '').replace(/\r/g, ' ')}</p>
        ${w > 1 ? `<p class="loves">${esc(loveSummaryText(i18n, game, w).replace(/&/g, ' & '))}</p>` : ''}`;
      m.querySelector('.sheet').scrollTop = 0;
    };
    draw(who);
    m.onclick = e => {
      const c = e.target.closest('[data-card]');
      if (c) draw(Number(c.dataset.card));
      else if (e.target.closest('[data-x]') || e.target === m) m.remove();
    };
  }

  function command(cmd) {
    if (cmd === 'library') library.show();
    if (cmd === 'auras') document.body.classList.toggle('sheet-auras'); // phones: the aura table slides up over the game
    if (cmd === 'chars') charCard(0);
    if (cmd === 'journal') {
      const days = [...new Set(view.journal.map(e => e.day))].sort((x, y) => y - x);
      let day = days[0] ?? s.day, only = 'all';
      const KIND = { deals: [W.Reveal, W.Agree, W.Reject, W.Beg, W.Threat], gossip: [W.Tell, W.Answer, W.Ask, W.Accuse], promises: [W.NBetray, W.NAttack] };
      const m = view.modal('', true);
      const draw = () => {
        const rows = view.journal.filter(e => e.day === day && (only === 'all' || KIND[only].includes(e.kind)));
        const known = s.hist.filter(e => e.know[P]);
        m.querySelector('.sheet').innerHTML = `${X}<h2>${T('journal', 'Journal')}</h2>
          <div class="seg">${days.map(d => `<button data-day="${d}" class="${d === day ? 'on' : ''}">${T('day', 'Day')} ${d}</button>`).join('')}</div>
          <div class="seg" style="margin-top:8px">${['all', 'deals', 'gossip', 'promises'].map(k => `<button data-only="${k}" class="${k === only ? 'on' : ''}">${T('jf.' + k, k)}</button>`).join('')}</div>
          <ul class="list jlist">${rows.map(e => `<li><span class="muted">${hhmm(e.time)}</span> ${e.words.map(icon).join('')} ${esc(e.text)}</li>`).join('') || `<li class="muted">${T('nothingYet', 'Nothing yet.')}</li>`}</ul>
          <h3>${T('journalHint', 'Betrayals you know about')}</h3>
          <ul class="list">${known.map(e => `<li>${T('day', 'Day')} ${e.date}, ${hhmm(e.time)}: ${esc(T('betrayed', '{X} betrayed {Y}').replace('{X}', view.name(e.wrd1)).replace('{Y}', view.name(e.wrd3, 'acc')))}</li>`).join('') || `<li class="muted">${T('nothingYet', 'Nothing yet.')}</li>`}</ul>
`;
      };
      draw();
      m.onclick = e => {
        const b = e.target.closest('button');
        if (b?.dataset.day) { day = Number(b.dataset.day); draw(); }
        else if (b?.dataset.only) { only = b.dataset.only; draw(); }
        else if (e.target.closest('[data-x]') || e.target === m) m.remove();
      };
    }
    if (cmd === 'menu') {
      const m = view.modal(`${X}<h2>${T('menu', 'Menu')}</h2><div class="choices">
        <button data-m="save">${T('save', 'Save')}</button><button data-m="load">${T('load', 'Load')}</button>
        <button data-m="library" class="phone-only">${i18n.t('lib.menu')}</button>
        <button data-m="title">${T('toTitle', 'Back to the title screen (the game is saved)')}</button></div>
        <h3>${T('settings', 'Settings')}</h3><div class="choices">
        <button data-m="sfx">${T('sfx', 'Sound effects')}: ${sound.sfxOn ? T('on', 'on') : T('off', 'off')}</button>
        <button data-m="immersion">${T('immersion', 'Immersion (no captions)')}: ${immersion() ? T('on', 'on') : T('off', 'off')}</button>
        <button data-m="advisor">${T('advisor', 'Advisor (💡 button)')}: ${advisorOn() ? T('on', 'on') : T('off', 'off')}</button>
        <button data-m="tips">${T('tips', 'Tips')}: ${tips.enabled ? T('on', 'on') : T('off', 'off')}</button>
        <button data-m="lang">${i18n.lang === 'en' ? 'Русский язык' : 'English language'}</button>
        <button data-m="classic">${T('classic', 'Original 1987 version')}</button></div>`, true);
      m.onclick = e => {
        const b = e.target.closest('[data-m]'); if (!b && e.target !== m && !e.target.closest('[data-x]')) return;
        m.remove();
        const k = b?.dataset.m;
        if (k === 'save' && !busy) chooseSlot(true, state());
        if (k === 'load' && !busy) chooseSlot(false).then(v => { if (v) { over = true; game.quit = true; view.dead = true; quit({ resume: v }); } });
        if (k === 'library') library.show();
        if (k === 'sfx') sound.setSfx(!sound.sfxOn);
        if (k === 'tips') tips.setEnabled(!tips.enabled);
        if (k === 'advisor') { setAdvisor(!advisorOn()); if (!advisorOn()) tips.hide(); }
        if (k === 'immersion') { setImmersion(!immersion()); view.render(); }
        if (k === 'lang') { save(); switchLanguage(); }
        if (b?.dataset.m === 'classic') location.href = 'index.html' + location.search;
        if (b?.dataset.m === 'title' && !busy) { save(); over = true; game.quit = true; view.dead = true; quit(); }
      };
    }
  }

  let quit;
  const ended = new Promise(r => { quit = r; view.onGameOver = () => { over = true; store.clear(); r(); }; });
  sound.setMode(s.time > 1260 ? 'night' : 'day');
  if (!opt.resume) {
    view.logHTML(`<div class="day-sep">${T('day', 'Day')} 1</div>`);
    await view.narrate(1, P); await view.narrate(2, P);
    game.newWordSet(true);
  }
  autoPick();
  view.render();
  const result = await ended;
  removeEventListener('keydown', onKey);
  document.body.classList.remove('sheet-auras');
  tips.hide();
  return result;
}

main();
