// The Library: the 1987 novella and the game's rules (the booklet from the game box), as a modern reader
// overlaid on the game. Novella: tools/import_booklet.py; translations: tools/library_i18n.py.
// While the reader is open the game underneath is paused (it cannot receive input).

import { i18n } from '../i18n/i18n.js';

const BASE = 'assets/library/';
const t = k => i18n.t(k);
// "n word" with forms "one|few|many" (English: "one|other"), chosen by Intl.PluralRules
const count = (n, forms) => {
  const f = forms.split('|'), c = new Intl.PluralRules(i18n.lang).select(n);
  return `${n} ${f[{ one: 0, few: 1 }[c] ?? f.length - 1]}`;
};

// Eeyal dictionary order in the rules = icon numbers in the game (see engine/constants.js)
const DICT_ICONS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 36, 37, 38,
  44, 45, 46, 47, 49, 53, 54, 55, 57, 58, 59, 60, 61, 62, 63, 66, 67, 68, 73, 74, 75, 76, 77, 78, 82,
  83, 84, 86, 90, 91, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118,
  119, 120, 121, 122, 123, 125, 126, 127];

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('siboot.library.' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('siboot.library.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const FILES = [null, 'vetvel', 'kendra', 'gardbore', 'wiki', 'locksher', 'zubi', 'skord'];
/** A dictionary word as the remake draws it: portraits for people and houses, digits, aura symbols, else Crawford's icon vectorised. */
function dictIcon(n) {
  if (n >= 1 && n <= 7) return `<img class="d-ic d-face" src="assets/remake/portraits/${FILES[n]}.webp" alt="">`;
  if (n >= 57 && n <= 63) return `<span class="d-home"><img class="d-ic d-face" src="assets/remake/portraits/${FILES[n - 56]}.webp" alt=""><b>⌂</b></span>`;
  if (n >= 103 && n <= 112) return `<span class="d-ic d-num">${n === 103 ? '?' : n - 104}</span>`;
  return `<img class="d-ic" src="assets/remake/iconsvg/${n}.svg" alt="">`;
}

// screenshots of the remake shown at the top of rules sections (tools: _dosref/rules_shots.mjs), by section index
const RULE_SHOTS = { 1: 'title', 2: 'duel', 3: 'deal', 5: 'dialogue', 6: 'promises', 7: 'builder', 8: 'feelings', 11: 'characters', 12: 'journal', 13: 'title', 14: 'story', 16: 'defence' };

export class Library {
  constructor() {
    this.books = null;
    this.open = false;
    this.el = document.createElement('div');
    this.el.className = 'library hidden';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Library');
    document.body.appendChild(this.el);
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = 'src/modern/library.css';
    document.head.appendChild(link);
    // while open, keep keys away from the game (its Input listens on window)
    window.addEventListener('keydown', e => {
      if (e.key === 'F1') { e.preventDefault(); e.stopImmediatePropagation(); this.open ? this.close() : this.show(); return; }
      if (!this.open) return;
      e.stopImmediatePropagation();
      if (e.key === 'Escape') this.close();
      if (e.key === 'ArrowRight' || e.key === 'PageDown') this.step(1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') this.step(-1);
    }, true);
    this.el.addEventListener('click', e => this.onClick(e));
  }

  async load() {
    if (this.books) return this.books;
    const get = url => fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);
    // translated books live in assets/i18n/<lang>/library/ (tools/library_i18n.py); English is the fallback
    const [manual, novella, remake] = await Promise.all([...['manual.json', 'novella.json'].map(async f =>
      (i18n.active && await get(`assets/i18n/${i18n.lang}/library/${f}`)) || get(BASE + f)), get('assets/remake/manifest.json')]);
    const has = new Set(remake || []);
    const books = {};
    if (novella) { // the 1987 novella from the game box, illustrated (assets/remake/novella/ch<N>.webp)
      books.novella = { id: 'novella', kind: t('lib.story'), meta: novella, title: novella.title,
        chapters: novella.parts[0].chapters.map((c, ci) => ({ title: c.title, blocks: c.blocks,
          illus: has.has(`novella/ch${ci}.webp`) ? `assets/remake/novella/ch${ci}.webp` : null })) };
    }
    if (manual) {
      books.rules = {
        id: 'rules', kind: t('lib.rulesItem'), meta: manual, title: manual.title,
        chapters: manual.sections.map((s, si) => {
          const shot = RULE_SHOTS[si] && `shots/${i18n.lang}/${RULE_SHOTS[si]}.webp`;
          return { title: s.title, blocks: s.blocks, shot: shot && has.has(shot) ? `assets/remake/${shot}` : null,
            note: i18n.t('lib.note.' + si, '') || null };
        }),
      };
    }
    this.books = books;
    return books;
  }

  /** Opens the library: book = 'story' | 'rules' | undefined (shelf). */
  async show(book) {
    await this.load();
    this.open = true;
    this.el.classList.remove('hidden');
    document.body.classList.add('library-open');
    if (book && this.books[book]) this.read(book, store.get(book + '.chapter', 0));
    else this.shelf();
  }

  close() {
    this.open = false;
    this.el.classList.add('hidden');
    document.body.classList.remove('library-open');
    this.onClose?.();
  }

  shelf() {
    const b = this.books;
    const card = (id, blurb) => b[id] ? `
      <button class="book" data-open="${id}">
        <span class="book-kind">${esc(b[id].kind)}</span>
        <span class="book-title">${esc(b[id].title)}</span>
        <span class="book-blurb">${blurb}</span>
        <span class="book-meta">${count(b[id].chapters.length, t(id === 'rules' ? 'lib.sections' : 'lib.chapters'))}
          ${store.get(id + '.chapter', 0) ? ' · ' + t('lib.continue') : ''}</span>
      </button>` : '';
    this.el.innerHTML = `
      <div class="lib-shelf">
        <header><h1>${t('lib.title')}</h1>
          <p>${t('lib.warning')}</p>
          <button class="lib-close" data-close aria-label="${t('lib.close')}">×</button></header>
        <div class="books">
          ${card('novella', t('lib.blurbNovella'))}
          ${card('rules', t('lib.blurbRules'))}
        </div>
        <footer>${t('lib.credits')} ${t('lib.f1')}${i18n.active ? ' ' + t('lib.translation') : ''}</footer>
      </div>`;
  }

  read(id, index = 0) {
    const book = this.books[id];
    this.cur = { id, index: Math.max(0, Math.min(index, book.chapters.length - 1)) };
    store.set(id + '.chapter', this.cur.index);
    const size = store.get('fontSize', 1);
    const ch = book.chapters[this.cur.index];
    let toc = '', lastPart = null;
    book.chapters.forEach((c, i) => {
      if (c.part && c.part !== lastPart) { lastPart = c.part; toc += `<li class="toc-part">${esc([c.part.label, c.part.title].filter(Boolean).join(' · '))}</li>`; }
      toc += `<li><a href="#" data-ch="${i}" class="${i === this.cur.index ? 'cur' : ''}">${esc(c.title || t('lib.untitled'))}</a></li>`;
    });
    const body = ch.blocks.map(b => {
      if (b.p !== undefined) return `<p>${b.p}</p>`;
      if (b.img) return `<figure><img src="${BASE + b.img}" alt="" loading="lazy" style="max-width:min(100%, ${Math.max(b.w * 1.4, 240)}px)"></figure>`;
      if (b.dict) return `<table class="dict">${b.dict.map(([w, m], k) =>
        `<tr><td class="dict-icon">${DICT_ICONS[k] ? dictIcon(DICT_ICONS[k]) : ''}</td><th>${esc(w)}</th><td>${esc(m)}</td></tr>`).join('')}</table>`;
      return '';
    }).join('');
    // how the remake differs from the 1987 interface the rules describe
    const note = ch.note ? `<aside class="remake-note"><b>${t('lib.noteTitle')}</b> ${esc(ch.note)}</aside>` : '';
    const lead = ch.illus ? `<figure class="illus"><img src="${ch.illus}" alt=""></figure>`
      : ch.shot ? `<figure class="shot"><img src="${ch.shot}" alt=""><figcaption>${t('lib.shotCaption')}</figcaption></figure>` : '';
    const partLine = ch.part ? `<div class="ch-part">${esc([ch.part.label, ch.part.title].filter(Boolean).join(' · '))}</div>` : '';
    this.el.innerHTML = `
      <div class="lib-reader" style="--fs:${size}">
        <nav class="lib-toc" aria-label="${t('lib.contents')}">
          <button class="lib-back" data-shelf>← ${t('lib.menu')}</button>
          <div class="toc-book">${esc(book.title)}</div>
          <ol>${toc}</ol>
        </nav>
        <main class="lib-page">
          <div class="lib-tools">
            <button data-font="-1" aria-label="${t('lib.smaller')}">A−</button>
            <button data-font="1" aria-label="${t('lib.larger')}">A+</button>
            <button class="lib-close" data-close aria-label="${t('lib.close')}">×</button>
          </div>
          <article>
            ${partLine}
            <h2>${esc(ch.title || book.title)}</h2>
            ${ch.subtitle ? `<div class="ch-sub">${esc(ch.subtitle)}</div>` : ''}
            ${lead}${note}${body}
          </article>
          <div class="lib-nav">
            <button data-step="-1" ${this.cur.index ? '' : 'disabled'}>← ${esc(book.chapters[this.cur.index - 1]?.title || '')}</button>
            <span>${this.cur.index + 1} / ${book.chapters.length}</span>
            <button data-step="1" ${this.cur.index < book.chapters.length - 1 ? '' : 'disabled'}>${esc(book.chapters[this.cur.index + 1]?.title || '')} →</button>
          </div>
        </main>
      </div>`;
    this.el.querySelector('.lib-page').scrollTop = 0;
    this.el.querySelector('.toc-cur, .lib-toc a.cur')?.scrollIntoView({ block: 'center' });
  }

  step(d) { if (this.cur && this.open) this.read(this.cur.id, this.cur.index + d); }

  onClick(e) {
    const t = e.target.closest('[data-open],[data-close],[data-shelf],[data-ch],[data-step],[data-font]');
    if (!t) { if (e.target === this.el) this.close(); return; }
    e.preventDefault();
    if (t.dataset.open) this.read(t.dataset.open, store.get(t.dataset.open + '.chapter', 0));
    else if ('close' in t.dataset) this.close();
    else if ('shelf' in t.dataset) this.shelf();
    else if (t.dataset.ch) this.read(this.cur.id, Number(t.dataset.ch));
    else if (t.dataset.step) this.step(Number(t.dataset.step));
    else if (t.dataset.font) {
      const v = Math.max(0.8, Math.min(1.6, store.get('fontSize', 1) + 0.1 * Number(t.dataset.font)));
      store.set('fontSize', v); this.read(this.cur.id, this.cur.index);
    }
  }
}
