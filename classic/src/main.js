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
import { Rng } from './engine/rng.js';
import { EXP_DELAY, BEG_DELAY, INT_DELAY } from './engine/constants.js';
import { installCursor } from './ui/cursor.js';

async function main() {
  const canvas = document.getElementById('screen');
  const assets = await loadAssets();
  const screen = new Screen(canvas, assets.palette);
  const input = new Input(canvas);
  installCursor(canvas, assets.cursor);
  const ui = new Draw(screen, input, assets.font, assets);
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
    const game = new Game(assets, ui);
    const seed = new URLSearchParams(location.search).get('seed');
    if (seed !== null) game.rng = new Rng(seed === 'dos' ? 0 : Number(seed)); // ?seed=dos = original DOS sequence
    game.dosCompat = seed === 'dos'; // reproduce original quirks that the fixes change (for verification)
    ui.g = game;
    const menus = new Menus(ui, assets.menus, assets.metrics);
    ui.menus = menus;
    menus.quitDialog = async () => (await new DialogRunner(ui).run(assets.quitDialog)) === 2;
    let over = false;
    ui.onGameOver = async () => { over = true; game.quit = true; };

    await showTitle(ui);
    game.initChars();
    const opt = await makeOptions(ui);
    game.initGame(opt.level, opt.gameLeng, opt.expert);
    const s = game.s;
    menus.setItem(3, 1, s.narratOn ? 'Narrate Off' : 'Narrate On');
    const delayItem = { [EXP_DELAY]: 4, [INT_DELAY]: 3, [BEG_DELAY]: 2 }[s.storyDelay];
    menus.checkItem(3, delayItem, true);
    ui.redrawMainScreen(false);
    await ui.narrate(1, s.player);
    await ui.narrate(2, s.player);

    const ctl = new Controller(game, ui, menus, persistence);
    game.newWordSet(true);
    ctl.drawIcons();
    ui.cleanOutRect('RoomRect');
    ui.statDisp();
    await ctl.run();
    if (!over) { // Quit Game
      ui.qd.fillRect({ left: 0, top: 0, right: 639, bottom: 479 }, { bits: [0, 0, 0, 0, 0, 0, 0, 0], fg: 15, bg: 0 });
      await input.waitClick();
    }
  }
}

main().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="color:#c00">${e.stack || e}</pre>`); });
