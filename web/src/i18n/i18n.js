// Localisation layer. English = the original game data, untouched (i18n.active === false).
// Other languages live in assets/i18n/<lang>/ (see docs/i18n/README.md):
//   ui.json         interface strings (keys of EN below)
//   grammar.json    characters: gender + case forms of names, species, fiancés; list/plural rules
//   narration.json  the 72 narration messages        stories/storyN.json  the 44 random events
//   dossiers.json   character dossiers + love-summary templates
//   menus.json      menu bar     dialogs.json  quit dialog     words.json  icon text labels
//
// Template syntax (all localised texts):
//   {name} {name.gen} {name.dat} {name.acc} {name.ins} {name.pre}   the character the text is about
//   {species.<case>} {fiance.<case>} {myFiance.<case>}               (species / fiancé of that character,
//                                                                      fiancé of the player)
//   {m|f}  text chosen by that character's gender, e.g. {вошёл|вошла}
//   {P:m|f} the same by the player's gender (Vetvel is female)

export const EN = {
  // title / options
  'options.title': 'OPTIONS', 'options.level': 'Difficulty Level', 'options.length': 'Length of Game',
  'options.easy': 'Easy', 'options.medium': 'Medium', 'options.hard': 'Hard',
  'options.short': 'Short', 'options.mediumLen': 'Medium', 'options.long': 'Long',
  'options.proceed': 'Proceed', 'options.warn1': 'WARNING!', 'options.warn2': 'Persons who play this game',
  'options.warn3': 'without reading the rules and the novella', 'options.warn4': 'are wasting their time!',
  'options.loading': 'Loading....  ',
  // main screen
  'btn.back1': 'Back', 'btn.back2': 'Space', 'btn.doit': 'Do It', 'btn.cancel': 'Cancel', 'btn.ok': 'OK',
  'narrate.click': 'Click mouse to continue', 'narrate.bad': 'Bad input message ',
  'menu.narrateOff': 'Narrate Off', 'menu.narrateOn': 'Narrate On',
  'clock.day': 'Day ', 'clock.am': 'AM', 'clock.pm': 'PM',
  'bar.1': 'Previous fear', 'bar.2': 'Current fear', 'bar.3': 'Previous trust', 'bar.4': 'Current trust',
  'bar.5': 'Previous love', 'bar.6': 'Current love',
  'face.looks': 'looks',
  // story screen
  'story.done': 'Done', 'story.prev1': 'Prev', 'story.next1': 'Next', 'story.page2': 'Page',
  // about / victory
  'about.1': 'Trust and Betrayal: Legacy of Siboot', 'about.2': 'by Chris Crawford',
  'about.3': 'Copyright (c) 1987 Chris Crawford', 'about.4': 'All Rights Reserved', 'about.5': 'Version=0.2',
  'victory.title': 'Our Shepherd',
  // library launcher (modern addition)
  'lib.readNovella': 'Read the novella', 'lib.readRules': 'Read the rules', 'lib.novella': 'Novella', 'lib.rules': 'Rules',
  'lib.menu': 'Library', 'lib.story': 'The Story', 'lib.rulesItem': 'The Rules',
  'lib.shotCaption': 'How it looks in the remake.',
  'lib.blurbNovella': 'The novella that came in the box with the game in 1987: the colony on Kira, from the first landing to the campaign you are about to play.',
  'lib.noteTitle': 'In the remake:',
  'lib.note.0': "Nothing to install: the remake runs in the browser and saves automatically after every move; Menu → Save gives three more slots.",
  'lib.note.2': "At midnight the remake shows each of your duels. When someone attacks you, it shows what you know of the attacker’s auras and offers three buttons to choose your defence.",
  'lib.note.5': "The scene at the top shows who you are talking to, their mood and the love / trust / fear bars with the change from your last remark.",
  'lib.note.7': "There is no need to hold the mouse on an icon: every icon in the builder has its caption (Menu → Immersion hides them, as in the original). Each sentence in the conversation is shown as icons and translated into plain language.",
  'lib.note.8': "The bars are always visible in the scene while you talk; the small numbers next to them show the change since your last remark.",
  'lib.note.9': "Menu: Save, Load (three slots plus the autosave), back to the title screen. The game is saved after every move.",
  'lib.note.10': "Menu: music, sound effects, tips and immersion mode can be switched on and off there.",
  'lib.note.11': "What you know of everyone’s auras is always visible in the table on the right; the Characters button shows the dossiers.",
  'lib.note.12': "The Journal button shows the day: who said what to whom, deals, promises and the betrayals you know about.",
  'lib.note.13': "The same choices are on the title screen of the remake.",
  'lib.note.14': "A story opens as a card over the scene; pick one of the four answers.",
  'lib.title': 'The Library of Kira', 'lib.warning': 'Persons who play this game without reading the rules and the novella are wasting their time!',
  'lib.blurbRules': 'How the campaign for the Shepherdship works: dreams and auras, deals, promises and betrayal, and the dictionary of eeyal.',
  'lib.chapters': 'chapter|chapters', 'lib.sections': 'section|sections', 'lib.continue': 'continue reading', 'lib.interlude': 'Interlude', 'lib.untitled': 'Untitled',
  'lib.credits': 'Texts by Chris Crawford, from the booklet in the 1987 game box.',
  'lib.f1': 'F1 opens and closes the library.', 'lib.translation': '',
  'lib.close': 'Close', 'lib.contents': 'Contents', 'lib.smaller': 'Smaller text', 'lib.larger': 'Larger text',
};
// emotion face captions (FACE_LOOKS in data/characters.js) are keys 'face.1'..'face.34'

const CASES = ['nom', 'gen', 'dat', 'acc', 'ins', 'pre'];

export class I18n {
  constructor() { this.lang = 'en'; this.active = false; this.d = {}; }

  static requested() {
    const q = new URLSearchParams(location.search).get('lang');
    if (q) return q;
    try { return localStorage.getItem('siboot.lang') || 'en'; } catch { return 'en'; }
  }

  async load(lang) {
    this.lang = lang;
    this.active = lang !== 'en';
    if (!this.active) return this;
    const base = `assets/i18n/${lang}/`;
    const get = f => fetch(base + f).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const names = ['ui', 'grammar', 'narration', 'dossiers', 'menus', 'dialogs', 'words'];
    const vals = await Promise.all(names.map(n => get(n + '.json')));
    names.forEach((n, i) => { this.d[n] = vals[i] || {}; });
    const st = await Promise.all(Array.from({ length: 44 }, (_, i) => get(`stories/story${i + 1}.json`)));
    this.d.stories = [null, ...st];
    return this;
  }

  /** Interface string. */
  t(key, fallback) { return (this.active ? this.d.ui?.[key] : undefined) ?? EN[key] ?? fallback ?? key; }

  // ---------------------------------------------------------------- grammar
  char(who) { return this.d.grammar?.characters?.[String(who)] || null; }
  gender(who, g) { const c = this.char(who); return c ? c.gender : (g?.male(who) ? 'm' : 'f'); }
  form(kind, who, cse = 'nom', g) {
    const c = this.char(who);
    const src = kind === 'name' ? c?.name : kind === 'species' ? c?.species : c?.fiance;
    if (src) return typeof src === 'string' ? src : (src[cse] ?? src.nom);
    if (!g) return '';
    return kind === 'name' ? g.charName(who) : kind === 'species' ? g.species(who) : g.fiance(who);
  }
  name(who, cse = 'nom', g) { return this.active ? this.form('name', who, cse, g) : g.charName(who); }

  /** Resolves {tokens} for character `who` (see header). */
  render(tpl, who, g) {
    const P = g?.s?.player ?? 1;
    return String(tpl ?? '').replace(/\{([^{}]*)\}/g, (all, body) => {
      if (body.includes('|')) {
        let target = who, alt = body;
        if (/^P:/.test(alt)) { target = P; alt = alt.slice(2); }
        const [m, f] = alt.split('|');
        return this.gender(target, g) === 'm' ? m : f;
      }
      const [kind, cse = 'nom'] = body.split('.');
      if (!CASES.includes(cse)) return all;
      if (kind === 'name') return this.form('name', who, cse, g);
      if (kind === 'species') return this.form('species', who, cse, g);
      if (kind === 'fiance') return this.form('fiance', who, cse, g);
      if (kind === 'myFiance') return this.form('fiance', P, cse, g);
      return all;
    });
  }

  narration(n, who, g) {
    const tpl = this.d.narration?.[String(n)];
    return tpl == null ? null : this.render(tpl, who, g);
  }

  /**
   * Rebuilds STORYn in the original file format with the translated text, option titles and result
   * texts (tokens already resolved for `who`), keeping every command byte untouched, so the
   * original parser / interpreter run unchanged.
   */
  storyRaw(n, who, raw, g) {
    const tr = this.d.stories?.[n];
    if (!tr) return raw;
    const R = s => this.render(s, who, g).replace(/[%~@#$^&=\]\\]/g, '');
    return rebuildStory(raw, R(tr.text), tr.options.map(o => ({ title: R(o.title), results: o.results.map(R) })));
  }

  dossier(who) { return this.d.dossiers?.[String(who)]?.text ?? this.d.dossiers?.[String(who)] ?? null; }

  /** Love summary sentences: groups = [null, [who...] x5] (loves .. hates). */
  loveSummary(who, groups, g) {
    const T = this.d.dossiers?.love;
    if (!T) return null;
    const G = this.d.grammar?.list || { sep: ', ', last: ' and ' };
    let out = '';
    for (let i = 1; i <= 5; i++) {
      const ids = groups[i];
      if (!ids.length) continue;
      const tpl = T[String(i)];
      out += this.render(tpl.replace(/\{list\.(\w+)\}/g, (_, c) => {
        const ns = ids.map(j => this.form('name', j, c, g));
        return ns.length === 1 ? ns[0] : ns.slice(0, -1).join(G.sep) + G.last + ns[ns.length - 1];
      }).replace(/\{pl:([^|}]*)\|([^}]*)\}/g, (_, one, many) => (ids.length === 1 ? one : many)), who, g) + '  ';
    }
    return out;
  }

  /** Menu file text in SIBOOT.MNU format built from menus.json (keys/shortcuts preserved). */
  menuText(original) {
    const M = this.d.menus;
    if (!Array.isArray(M) || !M.length) return original;
    return M.map(m => [m.title, ...m.items.map(it => '\t' + it.text + (it.key ? ' /' + it.key : ''))].join('\r\n')).join('\r\n');
  }

  dialogText(name, original) {
    const tr = this.d.dialogs?.[name];
    if (!tr) return original;
    let i = 0;
    return original.replace(/title="[^"]*"/gi, m => (i < tr.length ? `title="${tr[i++]}"` : m));
  }

  /** Icon text label lines (array of strings) or null to use the original bitmap. */
  wordLabel(n) { const w = this.d.words?.[String(n)]; return w ? (Array.isArray(w) ? w : String(w).split('\n')) : null; }
}

/** Splits an original story file; returns positions so the file can be rebuilt byte-exactly. */
export function splitStory(raw) {
  const BS = '\\';
  const i = raw.indexOf(BS);
  const j = raw.indexOf(BS, i + 1);
  let k = j + 1;
  const options = [];
  for (let o = 0; o < 4; o++) {
    if (raw[k] === '\r') k++;
    const e = raw.indexOf('\r', k);
    const end = raw.indexOf(BS, e);
    options.push({ titleStart: k, titleEnd: e, bodyEnd: end });
    k = end + 1;
  }
  return { textEnd: i, options };
}

export function rebuildStory(raw, text, options) {
  const sp = splitStory(raw);
  let out = text + raw.slice(sp.textEnd, sp.options[0].titleStart);
  sp.options.forEach((o, n) => {
    out += options[n]?.title ?? raw.slice(o.titleStart, o.titleEnd);
    let r = 0;
    const body = raw.slice(o.titleEnd, o.bodyEnd).split('\r').map(line => {
      const p = line.indexOf('P');
      if (p < 0 || !line.trim()) return line;
      const t = options[n]?.results?.[r++];
      return t == null ? line : line.slice(0, p + 1) + t;
    }).join('\r');
    const next = n < 3 ? sp.options[n + 1].titleStart : raw.length;
    out += body + raw.slice(o.bodyEnd, next);
  });
  return out;
}

export const i18n = new I18n();
