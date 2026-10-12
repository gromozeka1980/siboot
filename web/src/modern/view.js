// ModernView: the remake's presentation of the engine (same interface as ui/classic/view.js).
// Renders into the DOM of play.html; the engine state (g.s) is read directly for the panels.

import { W, NIGHT, SubjectA, VerbA } from '../engine/constants.js';
import { i18n } from '../i18n/i18n.js';
import { gloss, sentenceWords } from './gloss.js';
import { sound } from './sound.js';

const T = (k, en) => i18n.t('m.' + k, en);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FILES = [null, 'vetvel', 'kendra', 'gardbore', 'wiki', 'locksher', 'zubi', 'skord', 'chris'];
export const portrait = who => FILES[who] && who < 8 ? `assets/remake/portraits/${FILES[who]}.webp` : `assets/portraits/${FILES[who] || 'chris'}.png`;
export const place = who => `assets/remake/places/home_${FILES[who]}.webp`;
const hhmm = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;

// expression numbers used by the AI -> mood words
const MOODS = { 1: 'formal', 3: 'angry', 5: 'confiding', 6: 'curious', 9: 'surprised', 10: 'mocking', 13: 'haughty',
  14: 'apologetic', 19: 'accusing', 20: 'bargaining', 21: 'afraid', 22: 'sincere', 23: 'cold', 24: 'distrustful',
  25: 'friendly', 26: 'loving', 27: 'forgiving', 28: 'grateful', 29: 'pleased', 31: 'cool', 32: 'pleading', 33: 'refusing', 34: 'threatening' };

// aura symbols, traced from the DOS MakeAura outlines (relative moves from the start point)
const path = (x, y, d) => { let p = `M${x} ${y}`; for (let i = 0; i < d.length; i += 2) { x += d[i]; y += d[i + 1]; p += `L${x} ${y}`; } return p + 'Z'; };
const AURA_SVG = {
  1: `<path d="${path(-20, 0, [9, 0, 21, -21, 0, 38, 8, 6, -15, 0, 0, -25, -9, 9, 0, 7, -14, -14])}"/>`,
  2: `<path d="${path(-19, 2, [0, -5, 15, 0, -9, -9, 0, -4, 4, 0, 9, 9, 0, -15, 5, 0, 0, 15, 9, -9, 4, 0, 0, 4, -9, 9, 15, 0, 0, 5, -15, 0, 9, 9, 0, 4, -4, 0, -9, -9, 0, 15, -5, 0, 0, -15, -9, 9, -4, 0, 0, -4, 9, -9, -15, 0])}"/>`,
  3: '<circle r="22" fill="none" stroke="currentColor" stroke-width="4"/><circle r="6"/>',
};
const AURA_COLOR = { 1: 'var(--tanaga)', 2: 'var(--katsin)', 3: 'var(--shial)' };
export const auraSvg = (n, cls = 'aura') => `<svg class="${cls}" viewBox="-26 -26 52 52" style="color:${AURA_COLOR[n]}" fill="currentColor" aria-hidden="true">${AURA_SVG[n]}</svg>`;

const HOUSE_BADGE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 1 7.5h2.2V14h3.6v-4h2.4v4h3.6V7.5H15z" fill="#efe6d6" stroke="#17131f" stroke-width="1.4" stroke-linejoin="round"/></svg>';

// redrawn art that exists (assets/remake/manifest.json, written by tools/remake_art.py)
let REMAKE = new Set();
export const setRemake = files => { REMAKE = new Set(files); };

/** An eeyal word as an icon: redrawn art where it exists, otherwise built from the new portraits/places,
 *  digits and aura symbols, otherwise the original 32x32 pixel icon. */
export const icon = n => {
  if (n >= 1 && n <= 7) return `<span class="ic face" style="background-image:url(${portrait(n)})"></span>`;
  if (n >= 57 && n <= 63) return `<span class="ic face home" style="background-image:url(${portrait(n - 56)})">${HOUSE_BADGE}</span>`; // the owner, with a house badge
  if (n >= 103 && n <= 112) return `<span class="ic num">${n === 103 ? '?' : n - 104}</span>`;
  if (n >= 66 && n <= 68) return `<span class="ic aura-ic">${auraSvg(n - 65)}</span>`;
  if (n >= 53 && n <= 55) return `<span class="ic attack" style="color:${AURA_COLOR[n - 52]}">${auraSvg(n - 52)}</span>`; // aura on dark rings, as the original
  if (REMAKE.has(`iconsvg/${n}.svg`)) return `<span class="ic art" style="background-image:url(assets/remake/iconsvg/${n}.svg)"></span>`; // Crawford's drawings, vectorised (tools/vectorize_icons.py)
  return `<span class="ic" style="--x:${(n - 1) % 16};--y:${Math.floor((n - 1) / 16)}"></span>`;
};

// moods -> the 10 painted expressions (assets/remake/expressions/<who>/<expr>.webp)
const MOOD_EXPR = { formal: 'neutral', cool: 'neutral', angry: 'angry', threatening: 'angry', accusing: 'angry', confiding: 'trust',
  sincere: 'trust', curious: 'curious', surprised: 'curious', bargaining: 'curious', mocking: 'contempt', haughty: 'contempt',
  refusing: 'contempt', apologetic: 'sorry', pleading: 'sorry', afraid: 'afraid', cold: 'suspicious', distrustful: 'suspicious',
  friendly: 'warm', pleased: 'warm', grateful: 'warm', loving: 'love', forgiving: 'love' };
export const expression = (who, mood) => {
  const f = `expressions/${FILES[who]}/${MOOD_EXPR[mood] || 'neutral'}.webp`;
  return REMAKE.has(f) ? `assets/remake/${f}` : portrait(who);
};

// narration lines that only retell the player's own sentence ("You greet Kendra.")
const ECHO = new Set([3, 6, 15, 19, 21, 23, 25, 29, 33, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 68, 69, 70, 71, 72]);

export class ModernView {
  constructor(assets, labels) {
    this.assets = assets; this.labels = labels; this.g = null;
    this.el = id => document.getElementById(id);
    this.mood = null; this.delta = [0, 0, 0];
    this.journal = []; // [{day, time, who, words, text, kind}], saved with the game
    this.auraLog = {}; // {day: {who: [tanaga, katsin, shial]}} - aura counts the player has seen (-1 = unknown), saved with the game
  }
  get s() { return this.g.s; }
  name(who, cse = 'nom') { return i18n.name(who, cse, this.g); }
  label(n) { return this.labels[n] || ''; }

  // ---------------------------------------------------------------- log
  logHTML(html) {
    const log = this.el('log');
    if (this.dead || !log) return;
    log.insertAdjacentHTML('beforeend', html);
    while (log.children.length > 200) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  }
  logSentence(who, S, extra = '') {
    const P = this.s.player, words = sentenceWords(S);
    if (!words.length || !S[VerbA] || S[VerbA] === W.Pause) return; // Pause = the engine's "thinking" placeholder
    // a player's beg/threat is a bare verb that pleads for his previous offer or question: retell it with those details
    if ([W.Reveal, W.Ask].includes(S[VerbA])) (this.lastPlea ||= {})[who] = S.slice();
    const prev = this.lastPlea?.[who];
    const told = [W.Beg, W.Threat].includes(S[VerbA]) && !S[4] && prev
      ? prev.map((x, i) => (i === VerbA ? S[VerbA] : x)).map((x, i) => (prev[VerbA] === W.Ask && i === 4 ? W.That : x)) : S;
    const bare = [W.Beg, W.Threat].includes(S[VerbA]) && !S[4] && !prev; // nothing to plead for: just the gesture
    const text = bare ? T(S[VerbA] === W.Beg ? 'begBare' : 'threatBare', S[VerbA] === W.Beg ? '{S} pleads with {O} to reconsider.' : '{S} angrily demands that {O} reconsider.')
      .replace('{S}', this.name(who)).replace('{O}', this.name(this.s.interloc[who], S[VerbA] === W.Beg ? 'acc' : 'nom')) : gloss(told, this.g);
    sound.voice(who, words.length);
    this.journal.push({ day: this.s.day, time: this.s.time, who, words, text, kind: S[VerbA] }); // the day log (Journal)
    if (this.journal.length > 600) this.journal.splice(0, this.journal.length - 600);
    this.logHTML(`<div class="line ${who === P ? 'me' : ''}"><img class="av" src="${portrait(who)}" alt="">
      <div class="bubble"><div class="glyphs">${words.map(icon).join('')}</div><div class="say">${esc(text)}</div>${extra}</div></div>`);
  }
  logNote(text) { if (text) this.logHTML(`<div class="narr">${esc(text)}</div>`); }

  narrationText(msg, who) {
    if (msg <= 0 || msg > 72) return '';
    if (msg === 1) return T('narr1', 'This line explains what is going on. Tips can be turned off in the Menu.'); // the original pointed to a menu the remake doesn't have
    const out = i18n.active ? i18n.narration(msg, who, this.g) : null;
    if (out != null) return out;
    let str = '';
    for (const ch of this.assets.strings[msg] || '') {
      if (ch === '&' || ch === '%') str += this.g.charName(who);
      else if (ch === '#') str += this.g.male(who) ? 'him' : 'her';
      else str += ch;
    }
    return str;
  }

  // ---------------------------------------------------------------- engine interface
  async narrate(msg, who) {
    if (!(ECHO.has(msg) && !document.body.classList.contains('immersion'))) this.logNote(this.narrationText(msg, who));
    await sleep(120);
  }
  status() { this.render(); }
  refreshRoom() { this.render(); }
  clearCommand() { this.logSentence(this.s.player, this.s.sentence[this.s.player]); }
  async heard(who, msg) { sound.play('heard'); this.logSentence(who, this.s.sentence[who]); await sleep(350); }
  showHeard(who, when) {
    this.logSentence(who, this.s.sentence[who], when ? `<div class="when">${T('reported', 'event of day')} ${when.date}, ${hhmm(when.time)}</div>` : '');
  }
  deal(who) {
    const s = this.s;
    sound.play('deal');
    this.logHTML(`<div class="day-sep">${T('dealDone', 'Deal made')}</div>`);
    this.logSentence(who, s.sentence[who]);
    this.logSentence(s.sentence[0][SubjectA], s.sentence[0]);
    this.render();
  }
  delay(ticks) { return sleep(Math.min(ticks, 180) * 6); }
  feelings(who) {
    const s = this.s, P = s.player;
    this.delta = [s.love[who][P] - s.lastLove, s.trust[who][P] - s.lastTrust, s.fear[who][P] - s.lastFear];
    this.render();
  }
  noFeelings() { this.delta = [0, 0, 0]; this.mood = null; this.render(); }
  face(him, f) { if (him === this.s.player) { this.mood = MOODS[f] || null; this.render(); } }
  clearFace() {}
  evening() { this.render(); }
  morningTick() {}
  storyFile(n, who) { const raw = this.assets.stories[n] || ''; return i18n.active && who ? i18n.storyRaw(n, who, raw, this.g) : raw; }

  async story(story, run) {
    if (this.dead) return;
    sound.play('story');
    const para = t => t.replace(/\0/g, '').replace(/\\\s*$/, '').split(/\r+/).map(p => p.trim()).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('');
    // stories that happen with whoever the player is with have one picture per character (s<N>_<who>.webp)
    const file = [`stories/s${story.num}_${story.who}.webp`, `stories/s${story.num}.webp`].find(f => REMAKE.has(f));
    const art = file ? `<img class="story-art" src="assets/remake/${file}" alt="">` : '';
    const face = story.faceWho > 0 && !art ? `<img src="${portrait(story.faceWho)}" alt="">` : ''; // the illustration already shows who is there
    const body = story.text.split(' ')[0]; // the story ends at its first ''; story 30 then has K/L parameter codes (DOS showed them)
    const m = this.modal(`${art}<div class="story${face ? '' : ' noface'}">${face}<div><div class="text">${para(body)}</div>
      <div class="choices">${story.options.map((o, i) => `<button data-i="${i + 1}">${esc(o.title)}</button>`).join('')}</div></div></div>`);
    const pick = await new Promise(res => m.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) res(Number(b.dataset.i)); }));
    const r = run(pick);
    for (const e of r.errors) console.warn('story', story, 'error', e);
    const chosen = story.options[pick - 1].title;
    m.querySelector('.choices').outerHTML = `<div class="result"><div class="muted" style="font-size:14px">${esc(chosen)}</div>${r.result ? para(r.result) : ''}</div>
      <div class="row"><button class="btn primary" data-ok>${T('continue', 'Continue')}</button></div>`;
    await new Promise(res => m.querySelector('[data-ok]').addEventListener('click', res));
    m.remove();
    this.render();
  }

  midnight() {
    const s = this.s, P = s.player;
    this.nightLog = { duels: [], before: [1, 2, 3].map(k => s.auraCnt[k][P][P]) };
    sound.play('night'); sound.setMode('night');
    document.body.classList.add('night');
    this.night = this.modal(`<h2>${T('midnight', 'Midnight')}</h2><p class="muted">${T('midnightText', 'The acolytes meet in dream combat.')}</p><div id="duel"></div>`);
  }
  combatRound() {}
  async combat(who1, who2, a1, a2) {
    const P = this.s.player;
    if (who1 !== P && who2 !== P) return; // other duels happen unseen, as in the original (it showed only the player's)
    const won1 = a1 === a2 ? null : (a1 === 1 && a2 === 2) || (a1 === 2 && a2 === 3) || (a1 === 3 && a2 === 1);
    this.nightLog?.duels.push({ who1, who2, a1, a2, won1 });
    const side = (who, a, st) => `<div class="side ${st}"><img src="${portrait(who)}" alt=""><div>${esc(this.name(who))}</div>${auraSvg(a, 'aura big')}<div class="muted">${T('aura.' + a, ['', 'tanaga', 'katsin', 'shial'][a])}</div></div>`;
    const d = this.night.querySelector('#duel');
    d.innerHTML = `<div class="duel">${side(who1, a1, '')}<div class="vs">×</div>${side(who2, a2, '')}</div><div class="verdict"></div>`;
    await sleep(900);
    const sides = d.querySelectorAll('.side');
    let verdict = T('draw', 'Neither aura prevails.');
    if (won1 !== null) {
      sides[won1 ? 0 : 1].classList.add('won'); sides[won1 ? 1 : 0].classList.add('lost');
      const w = won1 ? who1 : who2, l = won1 ? who2 : who1, a = won1 ? a2 : a1;
      verdict = T('beats', '{W} wins: {L} loses a point of {A}.').replace('{W}', this.name(w)).replace('{L}', this.name(l)).replace('{A}', T('auraGen.' + a, ['', 'tanaga', 'katsin', 'shial'][a]));
    }
    d.querySelector('.verdict').textContent = verdict;
    sound.play('clash');
    if (won1 !== null) setTimeout(() => sound.play((won1 ? who1 : who2) === P ? 'win' : 'lose'), 450);
    await this.waitClick(d, 2600);
  }
  async defence(who1) {
    const s = this.s, P = s.player, A = s.auraCnt;
    const known = j => A[j][who1][P] < 0 ? '?' : A[j][who1][P];
    const d = this.night.querySelector('#duel');
    d.innerHTML = `<div class="verdict">${esc(this.narrationText(10, who1))}</div>
      <div class="known"><span></span>${[1, 2, 3].map(j => `<span>${auraSvg(j)}</span>`).join('')}
        <span>${esc(this.name(who1))}</span>${[1, 2, 3].map(j => `<b>${known(j)}</b>`).join('')}
        <span>${esc(this.name(P))}</span>${[1, 2, 3].map(j => `<b>${A[j][P][P]}</b>`).join('')}</div>
      <p class="muted" style="text-align:center">${T('defendHint', 'Choose the aura to defend with. Tanaga beats katsin, katsin beats shial, shial beats tanaga.')}</p>
      <div class="defend">${[1, 2, 3].map(j => `<button data-a="${j}" ${A[j][P][P] > 0 ? '' : 'disabled'}>${auraSvg(j)}${T('aura.' + j, ['', 'tanaga', 'katsin', 'shial'][j])}</button>`).join('')}</div>`;
    return new Promise(res => d.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && !b.disabled) res(Number(b.dataset.a)); }));
  }
  async victory(who) {
    sound.play('victory');
    this.night?.remove();
    const m = this.modal(`<div class="victory"><img src="${portrait(who)}" alt=""><h2>${esc(this.name(who))}</h2>
      <div class="sub serif" style="font-size:24px;color:var(--gold)">${esc(i18n.t('victory.title'))}</div>
      <div class="row" style="justify-content:center"><button class="btn primary" data-ok>${T('newGame', 'New game')}</button></div></div>`);
    await new Promise(res => m.querySelector('[data-ok]').addEventListener('click', res));
    m.remove(); document.body.classList.remove('night');
    this.g.quit = true; this.dead = true;
    this.onGameOver?.(who);
  }
  dawn() {
    sound.setMode('day');
    this.night?.remove(); this.night = null;
    this.recap();
    document.body.classList.remove('night');
    this.logHTML(`<div class="day-sep">${T('day', 'Day')} ${this.s.day}</div>`);
    this.render();
  }

  /** Morning recap: your duels, your auras, and what you now know (knowledge is reshuffled at midnight). */
  recap() {
    const s = this.s, P = s.player, A = s.auraCnt, N = s.numChars, L = this.nightLog;
    if (!L || this.dead) return;
    this.nightLog = null;
    const an = (k, f = 'aura') => T(`${f}.${k}`, ['', 'tanaga', 'katsin', 'shial'][k]);
    const duel = d => {
      const res = d.won1 === null ? T('rDraw', 'a draw') : (d.won1 ? d.who1 : d.who2) === P ? T('rWon', 'you won') : T('rLost', 'you lost');
      const att = d.who1 === P ? T('rYouAtt', 'You attacked {X} with {A}, they defended with {B}: {R}.').replace('{X}', this.name(d.who2, 'acc'))
        : T('rAttYou', '{X} attacked you with {A}, you defended with {B}: {R}.').replace('{X}', this.name(d.who1))
          .replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, m, f) => (i18n.gender(d.who1, this.g) === 'f' ? f : m));
      return att.replace('{A}', an(d.who1 === P ? d.a1 : d.a1, 'auraIns')).replace('{B}', an(d.who1 === P ? d.a2 : d.a2, 'auraIns')).replace('{R}', res);
    };
    const after = [1, 2, 3].map(k => A[k][P][P]);
    const diff = [1, 2, 3].map(k => { const d = after[k - 1] - L.before[k - 1]; return `${auraSvg(k)} <b>${after[k - 1]}</b>${d ? ` <span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${Math.abs(d)}</span>` : ''}`; }).join(' &nbsp; ');
    const facts = [];
    for (let j = 1; j <= N; j++) if (j !== P) for (let k = 1; k <= 3; k++) if (A[k][j][P] >= 0) facts.push(`${esc(this.name(j))}: ${an(k)} ${A[k][j][P]}`);
    const m = this.modal(`<h2>${T('morning', 'Morning')} · ${T('day', 'Day')} ${s.day}</h2>
      <h3>${T('rNight', 'Tonight')}</h3><ul class="list">${L.duels.map(d => `<li>${esc(duel(d))}</li>`).join('') || `<li class="muted">${T('rQuiet', 'Nobody fought you.')}</li>`}</ul>
      <h3>${T('rAuras', 'Your auras')}</h3><div class="recap-auras">${diff}</div>
      <h3>${T('rKnow', 'What you know today')}</h3><div class="muted" style="font-size:13px">${T('rKnowHint', 'Every midnight each acolyte learns one aura of every other — and forgets the rest.')}</div>
      <ul class="list cols">${facts.map(f => `<li>${f}</li>`).join('')}</ul>
      <div class="row"><button class="btn primary" data-ok>${T('continue', 'Continue')}</button></div>`);
    m.querySelector('[data-ok]').onclick = () => m.remove();
  }

  // ---------------------------------------------------------------- helpers
  /** closable: Esc, a click outside or the × close it (not for story, night and other modals that wait for a choice). */
  modal(html, closable = false) {
    const m = document.createElement('div');
    m.className = 'modal' + (closable ? ' closable' : '');
    m.innerHTML = `<div class="sheet">${html}</div>`;
    document.body.appendChild(m);
    return m;
  }
  waitClick(el, ms) { return new Promise(res => { const t = setTimeout(res, ms); el.addEventListener('click', () => { clearTimeout(t); res(); }, { once: true }); }); }

  // ---------------------------------------------------------------- panels
  render() {
    if (!this.g || this.dead || !this.el('clock')) return;
    const s = this.s, P = s.player, N = s.numChars;
    document.body.classList.toggle('night', s.time > NIGHT || !!this.night);
    this.el('clock').innerHTML = `${T('day', 'Day')} <b>${s.day}</b> · <b>${hhmm(s.time)}</b>`;

    // where am I, who is here
    const loc = s.charLocn[P], him = s.interloc[P];
    const home = loc > 0 ? loc : loc < 0 ? -loc : 0;
    const scene = this.el('scene');
    scene.style.setProperty('--place', `url(${new URL(home ? place(home) : 'assets/remake/places/road.webp', location.href).href})`); // absolute: a relative url() in a custom property resolves against the stylesheet
    const tag = loc === 0 ? T('onRoad', 'On the road') : loc < 0 ? T('outside', 'Outside {X}’s door').replace('{X}', this.name(-loc, 'gen'))
      : loc === P ? T('atHome', 'At home') : T('inHouse', 'In {X}’s house').replace('{X}', this.name(loc, 'gen'));
    scene.querySelector('.tag').innerHTML = `${esc(tag)}<span class="tag-clock"> · ${T('day', 'Day')} ${s.day} · ${hhmm(s.time)}</span>`;
    const who = scene.querySelector('.who-wrap');
    if (him > 0) {
      const bars = [['love', s.love[him][P]], ['trust', s.trust[him][P]], ['fear', s.fear[him][P]]];
      const bar = (k, v, d) => `<span>${T(k, k[0].toUpperCase() + k.slice(1))}</span><div class="bar"><i style="background:var(--${k});${v >= 0 ? `left:50%;width:${v / 2.54}%` : `right:50%;width:${-v / 2.54}%`}"></i></div><span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'muted'}">${d > 0 ? '+' + d : d < 0 ? '−' + -d : ''}</span>`;
      who.innerHTML = `<img class="portrait" data-who="${him}" title="${esc(T('openCard', 'About this character'))}" src="${expression(him, this.mood)}" alt=""><div class="who"><h2>${esc(this.name(him))}</h2>
        <div class="sp">${esc(i18n.active ? i18n.form('species', him, 'nom', this.g) : this.g.species(him))}${this.mood ? ` · <span class="mood">${esc(T('mood.' + this.mood, this.mood))}</span>` : ''}</div>
        <div class="meters">${bars.map(([k, v], i) => bar(k, v, this.delta[i])).join('')}</div></div>`;
    } else {
      const here = [];
      for (let i = 1; i <= N; i++) if (i !== P && loc > 0 && s.charLocn[i] === loc) here.push(this.name(i));
      who.innerHTML = `<div class="alone">${here.length ? esc(here.join(', ')) : T('nobody', 'Nobody to talk to.')}</div>`;
    }

    // auras I know
    const A = s.auraCnt;
    this.noteAuras();
    const cell = (w, j) => {
      const v = A[j][w][P]; if (v >= 0) return `<td><span class="n">${v}</span></td>`;
      const old = this.lastSeen(w, j);
      return old ? `<td><span class="n old" title="${esc(T('seenOn', 'last seen on day {D}; it may have changed since').replace('{D}', old.day))}">${old.v}<sub>${T('dayShort', 'd')}${old.day}</sub></span></td>`
        : '<td><span class="n q">?</span></td>';
    };
    const badges = w => this.promises(w).map(p => `<span class="pb ${p.k}" title="${esc(p.text)}">${icon(p.w)}</span>`).join('');
    this.el('auras').innerHTML = `<tr><th></th>${[1, 2, 3].map(j => `<th>${auraSvg(j, 'aura')}<br>${T('aura.' + j, ['', 'tanaga', 'katsin', 'shial'][j])}</th>`).join('')}<th></th></tr>` +
      Array.from({ length: N }, (_, k) => k + 1).map(w => `<tr data-who="${w}" class="${w === P ? 'me-row' : ''}" title="${esc(T('openCard', 'About this character'))}"><td><span class="nm">${icon(w)}${esc(this.name(w))}</span></td>${[1, 2, 3].map(j => cell(w, j)).join('')}<td class="pbs">${w === P ? '' : badges(w)}</td></tr>`).join('');
    this.el('auras').querySelectorAll('svg.aura').forEach(e => { e.style.width = '28px'; e.style.height = '28px'; });

    this.onRender?.();
  }

  /** Records today's known aura counts into the notebook. */
  noteAuras() {
    const s = this.s, P = s.player, A = s.auraCnt, d = (this.auraLog[s.day] ||= {});
    for (let w = 1; w <= s.numChars; w++) if (w !== P) {
      const now = [1, 2, 3].map(k => A[k][w][P]);
      if (now.some(v => v >= 0)) d[w] = (d[w] || [-1, -1, -1]).map((v, i) => (now[i] >= 0 ? now[i] : v));
    }
  }
  /** The latest earlier-day value of w's aura k: {v, day} or null. */
  lastSeen(w, k) {
    for (let d = this.s.day - 1; d >= 1; d--) { const v = this.auraLog[d]?.[w]?.[k - 1]; if (v >= 0) return { v, day: d }; }
    return null;
  }

  /** Promises between the player and i: [{k: mine|theirs|broken, w: word icon, text}]. */
  promises(i) {
    const s = this.s, P = s.player, out = [];
    if (s.nBetray[P][i][s.day]) out.push({ k: 'mine', w: W.NBetray, text: T('iNoBetray', 'You: won’t betray {X} today').replace('{X}', this.name(i, 'acc')) });
    if (s.nAttack[P][i]) out.push({ k: 'mine', w: W.NAttack, text: T('iNoAttack', 'You: won’t attack {X} tonight').replace('{X}', this.name(i, 'acc')) });
    if (s.nBetray[i][P][s.day]) out.push({ k: 'theirs', w: W.NBetray, text: T('heNoBetray', '{X}: won’t betray you today').replace('{X}', this.name(i)) });
    if (s.nAttack[i][P]) out.push({ k: 'theirs', w: W.NAttack, text: T('heNoAttack', '{X}: won’t attack you tonight').replace('{X}', this.name(i)) });
    if (s.nBetrayCount[i][P] > 0) out.push({ k: 'broken', w: W.BBetray, text: T('brokeBetray', '{X} broke a promise not to betray you').replace('{X}', this.name(i)) });
    if (s.nAttackCount[i][P] > 0) out.push({ k: 'broken', w: W.BAttack, text: T('brokeAttack', '{X} broke a promise not to attack you').replace('{X}', this.name(i)) });
    return out;
  }
}

export { MOODS };
