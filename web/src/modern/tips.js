// First-game tutorial: short contextual tips, each shown once (remembered in localStorage).

import { W, SUNSET, NIGHT } from '../engine/constants.js';
import { i18n } from '../i18n/i18n.js';

const TIPS_EN = {
  welcome: 'Your goal is to become the Shepherd: reach 8 points in all three auras. By day you visit the others and talk in eeyal — build a sentence from the icons below and press “Say it”. At midnight everyone fights in dream combat.',
  alone: 'You are alone. To visit someone, pick “go to” and their house; or wait for guests (the “wait” icon).',
  greet: 'You are in a conversation. Greet first: “greet” and a tone. The tone you choose depends on and affects how they feel about you.',
  talk: 'The bars show how your companion feels about you. Flattery and small talk raise love, promises raise trust. The real prize is a deal: trading what you know about auras.',
  deal: 'A deal trades one character’s aura count for another’s. But telling someone’s aura betrays that person — if they find out, their trust in you falls.',
  table: 'This table is what you know. At midnight you will attack someone: the weaker their aura, the better your odds. Knowledge is reshuffled every night.',
  evening: 'Evening: everyone goes home. Night is coming.',
  night: 'Night. Choose whom to attack and with which aura. Tanaga beats katsin, katsin beats shial, shial beats tanaga. The winner takes a point of the aura the loser used.',
};

const KEY = 'siboot.tips';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ } };

export class Tips {
  constructor() { this.state = load(); this.el = null; }
  get enabled() { return !this.state.off; }
  setEnabled(on) { this.state.off = !on; if (on) for (const k of Object.keys(TIPS_EN)) delete this.state[k]; save(this.state); if (!on) this.hide(); }

  /** Called after every render: shows the first relevant unseen tip. */
  check(s) {
    if (!this.enabled || this.el || document.querySelector('.modal')) return;
    const P = s.player, him = s.interloc[P], ids = s.iconID.slice(1, s.iconCount + 1).map(Math.abs);
    const when = {
      welcome: true,
      night: s.time > NIGHT && ids.some(w => w >= 53 && w <= 55),
      evening: s.time >= SUNSET && s.time <= NIGHT,
      greet: him > 0 && !s.helloFlg[P],
      deal: ids.includes(W.Reveal) || s.lastSntc[him]?.[2] === W.Reveal,
      talk: him > 0 && s.helloFlg[P],
      table: s.time > 600 && him === 0,
      alone: him === 0 && s.charLocn[P] === P && ids.includes(W.Go),
    };
    const k = Object.keys(when).find(k => when[k] && !this.state[k]);
    if (k) this.show(k);
  }

  show(k) {
    const el = this.el = document.createElement('div');
    el.className = 'tip';
    el.innerHTML = `<div class="tip-k">${i18n.t('m.tip', 'Tip')}</div><p>${i18n.t('tip.' + k, TIPS_EN[k])}</p>
      <div class="tip-row"><button data-off>${i18n.t('m.tipsOff', 'No more tips')}</button><button class="btn primary" data-ok>${i18n.t('m.gotIt', 'Got it')}</button></div>`;
    el.onclick = e => {
      if (e.target.closest('[data-ok]')) { this.state[k] = 1; save(this.state); this.hide(); }
      if (e.target.closest('[data-off]')) this.setEnabled(false);
    };
    document.body.appendChild(el);
  }

  /** Shows an arbitrary message in the tip bubble (the advisor). */
  say(text) {
    this.hide();
    const el = this.el = document.createElement('div');
    el.className = 'tip advice';
    el.innerHTML = `<div class="tip-k">💡 ${i18n.t('m.advise', 'What to do?')}</div><p></p><div class="tip-row"><span></span><button class="btn primary" data-ok>${i18n.t('m.gotIt', 'Got it')}</button></div>`;
    el.querySelector('p').textContent = text;
    el.onclick = e => { if (e.target.closest('[data-ok]')) this.hide(); };
    document.body.appendChild(el);
  }

  hide() { this.el?.remove(); this.el = null; }
}
