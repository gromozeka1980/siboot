// Bootstrap: load assets, build platform + UI + engine, run the DOS start sequence.

import { Screen } from './platform/screen.js';
import { Input } from './platform/input.js';
import { loadAssets } from './platform/assets.js';
import { Draw } from './ui/draw.js';
import { Menus } from './ui/menus.js';
import { DialogRunner } from './ui/dialogs.js';
import { Controller } from './ui/controller.js';
import { persistence } from './ui/persistence.js';
import { showTitle, makeOptions } from './ui/title.js';
import { Game } from './engine/game.js';
import { ClassicView } from './ui/classic/view.js';
import { Rng } from './engine/rng.js';
import { EXP_DELAY, BEG_DELAY, INT_DELAY } from './engine/constants.js';
import { installCursor } from './ui/cursor.js';
import { Library } from './modern/library.js';
import { i18n, I18n } from './i18n/i18n.js';

async function main() {
  const canvas = document.getElementById('screen');
  const [assets] = await Promise.all([loadAssets(), i18n.load(I18n.requested())]);
  document.documentElement.lang = i18n.lang;
  const screen = new Screen(canvas, assets.palette);
  const input = new Input(canvas);
  installCursor(canvas, assets.cursor);
  const ui = new Draw(screen, input, assets.font, assets);
  const library = new Library();
  installLibraryLauncher(library);
  // dev hook: window.__dbg.shot('name') uploads the current frame to the dev server
  window.__dbg = {
    ui, screen, input,
    sleep: ms => new Promise(r => setTimeout(r, ms)),
    click: async (x, y, hold = 120) => {
      const r = canvas.getBoundingClientRect(), sl = ms => new Promise(f => setTimeout(f, ms));
      const o = { clientX: r.left + (x + 0.5) * r.width / 640, clientY: r.top + (y + 0.5) * r.height / 480, bubbles: true, pointerId: 1 };
      canvas.dispatchEvent(new PointerEvent('pointermove', o));
      canvas.dispatchEvent(new PointerEvent('pointerdown', o));
      await sl(hold);
      canvas.dispatchEvent(new PointerEvent('pointerup', o));
      await sl(300);
    },
    shot: async name => {
      screen.present();
      const b = await new Promise(r => canvas.toBlob(r, 'image/png'));
      await fetch('/' + name + '.png', { method: 'POST', body: b });
      return name;
    },
  };

  for (;;) { // one iteration = one game (the DOS game exits after the victory screen)
    const game = new Game(assets, new ClassicView(ui));
    const seed = new URLSearchParams(location.search).get('seed');
    if (seed !== null) game.rng = new Rng(seed === 'dos' ? 0 : Number(seed)); // ?seed=dos = original DOS sequence
    game.dosCompat = seed === 'dos'; // reproduce original quirks that the fixes change (for verification)
    ui.g = game;
    const menus = new Menus(ui, i18n.active ? i18n.menuText(assets.menus) : assets.menus, assets.metrics);
    if (!game.dosCompat) menus.addMenu(i18n.t('lib.menu'), [ // modern addition (left out in ?seed=dos: DOS menu bar 1:1)
      { text: i18n.t('lib.story'), action: () => openLibrary(library, input, 'novella') },
      { text: i18n.t('lib.rulesItem'), action: () => openLibrary(library, input, 'rules') },
    ]);
    ui.menus = menus;
    menus.quitDialog = async () => (await new DialogRunner(ui).run(i18n.dialogText('quit', assets.quitDialog))) === 2;
    let over = false;
    ui.onGameOver = async () => { over = true; game.quit = true; };

    let resume = null;
    try { resume = JSON.parse(sessionStorage.getItem('siboot.resume')); sessionStorage.removeItem('siboot.resume'); } catch { resume = null; }
    const ctl = new Controller(game, ui, menus, persistence);
    if (resume) { // language switch in the middle of a game: continue where we were
      game.initChars();
      game.initGame(1, 1, false);
      Object.assign(game.s, resume.s);
      game.rng.seed = resume.seed >>> 0;
      setLauncherMode(library, false);
      const s = game.s;
      menus.setItem(3, 1, i18n.t(s.narratOn ? 'menu.narrateOff' : 'menu.narrateOn'));
      menus.checkItem(3, { [EXP_DELAY]: 4, [INT_DELAY]: 3, [BEG_DELAY]: 2 }[s.storyDelay], true);
      ctl.redrawAfterLoad();
    } else {
      await showTitle(ui);
      game.initChars();
      setLauncherMode(library, true);
      const onResize = () => setLauncherMode(library, true);
      addEventListener('resize', onResize);
      const opt = await makeOptions(ui);
      removeEventListener('resize', onResize);
      setLauncherMode(library, false);
      game.initGame(opt.level, opt.gameLeng, opt.expert);
      const s = game.s;
      menus.setItem(3, 1, i18n.t(s.narratOn ? 'menu.narrateOff' : 'menu.narrateOn'));
      const delayItem = { [EXP_DELAY]: 4, [INT_DELAY]: 3, [BEG_DELAY]: 2 }[s.storyDelay];
      menus.checkItem(3, delayItem, true);
      ui.redrawMainScreen(false);
      await ui.narrate(1, s.player);
      await ui.narrate(2, s.player);
      game.newWordSet(true);
      ctl.drawIcons();
      ui.cleanOutRect('RoomRect');
      ui.statDisp();
    }
    game.started = true;
    await ctl.run();
    if (!over) { // Quit Game
      ui.qd.fillRect({ left: 0, top: 0, right: 639, bottom: 479 }, { bits: [0, 0, 0, 0, 0, 0, 0, 0], fg: 15, bg: 0 });
      await input.waitClick();
    }
  }
}

/** Opens a book and resolves when the reader is closed (the game waits meanwhile). */
function openLibrary(library, input, book) {
  return new Promise(resolve => { library.onClose = () => { input.flush(); resolve(); }; library.show(book); });
}

/** Floating buttons over the game that open the library at any time. */
function installLibraryLauncher(library) {
  const bar = document.createElement('div');
  bar.className = 'lib-launch';
  const T = k => i18n.t(k);
  bar.innerHTML = `<button data-b="novella" title="The Legacy of Siboot (F1)"><span class="l">${T('lib.readNovella')}</span><span class="s">${T('lib.novella')}</span></button>` +
    `<button data-b="rules" title="Rules of the game (F1)"><span class="l">${T('lib.readRules')}</span><span class="s">${T('lib.rules')}</span></button>` +
    `<button data-lang title="Language / Язык">${i18n.lang === 'en' ? 'RU' : 'EN'}</button>`;
  bar.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if ('lang' in b.dataset) return switchLanguage(i18n.lang === 'en' ? 'ru' : 'en');
    library.show(b.dataset.b);
  });
  document.body.appendChild(bar);
  const place = () => {
    const r = document.getElementById('screen').getBoundingClientRect();
    bar.style.right = Math.max(8, innerWidth - r.right + 8) + 'px';
    bar.style.bottom = Math.max(8, innerHeight - r.bottom + 8) + 'px';
  };
  place(); addEventListener('resize', place);
  library.launcher = { bar, place };
}

/** Switching language reloads the page; a running game is saved first and resumed after. */
function switchLanguage(lang) {
  try { localStorage.setItem('siboot.lang', lang); } catch { /* ignore */ }
  const g = window.__dbg?.ui?.g;
  if (g && g.started && !g.quit) {
    try { sessionStorage.setItem('siboot.resume', JSON.stringify({ s: g.s, seed: g.rng.seed })); } catch { /* ignore */ }
  }
  const u = new URL(location.href); u.searchParams.delete('lang'); location.href = u.toString();
}

/** On the OPTIONS screen the warning asks you to read first: show big buttons under it. */
function setLauncherMode(library, prominent) {
  const { bar, place } = library.launcher;
  bar.classList.toggle('prominent', prominent);
  if (!prominent) { bar.style.left = ''; bar.style.top = ''; bar.style.transform = ''; return place(); }
  const r = document.getElementById('screen').getBoundingClientRect(), k = r.height / 480;
  bar.style.right = ''; bar.style.bottom = '';
  bar.style.left = (r.left + r.width / 2) + 'px';
  bar.style.top = (r.top + 418 * k) + 'px';
  bar.style.transform = 'translate(-50%, -50%)';
}

main().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="color:#c00">${e.stack || e}</pre>`); });
