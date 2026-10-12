// Headless harness (fake canvas + bot input) shared by tools; originally from the playthrough smoke test: runs the real engine + UI code against a fake canvas and a
// scripted "player" that picks random words, clicks through narrations, stories and combat,
// until somebody wins or the day limit is reached. Catches crashes and endless loops.
//   node tools/test_playthrough.mjs [games=3] [maxDays=40] [seed]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
globalThis.requestAnimationFrame = () => 0;
globalThis.performance ??= { now: () => Date.now() };

const { Screen } = await import('../src/platform/screen.js');
const { Draw } = await import('../src/ui/draw.js');
const { Menus } = await import('../src/ui/menus.js');
const { Controller } = await import('../src/ui/controller.js');
const { BitmapFont } = await import('../src/ui/font.js');
const { Game } = await import('../src/engine/game.js');
const { ClassicView } = await import('../src/ui/classic/view.js');
const { Rng } = await import('../src/engine/rng.js');
const { ObjectB2 } = await import('../src/engine/constants.js');

const A = p => path.join(ROOT, 'assets', p);
const man = JSON.parse(fs.readFileSync(A('manifest.json'), 'utf8'));
const txt = p => fs.readFileSync(A(p), 'latin1');
const blank = (w, h) => ({ w, h, data: new Uint8Array(w * h) });
const conn = new Uint8Array(fs.readFileSync(A('connect.bin')));
const table = off => Array.from({ length: 129 }, (_, w) => (w === 0 ? new Uint8Array(129) : conn.subarray(off + (w - 1) * 129, off + w * 129)));
const assets = {
  palette: man.palettes.main, palettes: man.palettes,
  wordIcon: [null, ...Array.from({ length: 128 }, () => blank(32, 32))],
  wordText: [null, ...Array.from({ length: 128 }, () => blank(32, 32))],
  emotion: [null, ...Array.from({ length: 34 }, () => blank(96, 96))],
  faces: [null, ...Array.from({ length: 8 }, () => ({ img: blank(158, 158), palette: man.palettes.main }))],
  logo: blank(512, 200),
  font: new BitmapFont(JSON.parse(txt(man.fonts.rmn6_13))),
  font19: new BitmapFont(JSON.parse(txt(man.fonts.rmn6_19))),
  strings: [null, ...txt(man.text.strings).split(/\r\n|\r|\n/).slice(1).filter(l => l.trim() !== '')],
  stories: [null, ...Array.from({ length: 44 }, (_, i) => txt(man.text.stories[i + 1]))],
  dossiers: [null, ...Array.from({ length: 8 }, (_, i) => txt(man.text.dossiers[i + 1]))],
  menus: txt(man.text.menus), quitDialog: txt(man.text.dialogs.quit),
  follows1: table(0), follows2: table(16512),
};

const fakeCanvas = { getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) };

/** Input that answers every wait with a click somewhere useful. */
class BotInput {
  constructor(rng) { this.rng = rng; this.queue = []; this.mouse = { x: 0, y: 0 }; this.down = false; this.clicks = 0; this.plan = []; }
  target() {
    if (this.plan.length) return this.plan.shift();
    // story screen: options (y 210+30i) then Done; combat: aura icons (y ~ 195, x 201..281); OK buttons; generic
    const spots = [[30, 205], [100, 250], [100, 280], [100, 310], [100, 340], [217, 211], [257, 211], [297, 211], [32, 176], [116, 150], [300, 300], [320, 405]];
    return spots[Math.floor(this.rng.next() * spots.length)];
  }
  async nextEvent() {
    if (this.queue.length) return this.queue.shift();
    if (++this.clicks > 2e6) throw new Error('too many input requests (endless loop?)');
    const [x, y] = this.target();
    this.mouse = { x, y };
    this.queue.push({ type: 'mouseup', x, y });
    return { type: 'mousedown', x, y };
  }
  poll() { if (!this.queue.length) this.queue.push(...this._click()); return this.queue.shift(); }
  _click() { if (++this.clicks > 2e6) throw new Error('too many input requests'); const [x, y] = this.target(); this.mouse = { x, y }; return [{ type: 'mousedown', x, y }, { type: 'mouseup', x, y }]; }
  flush() { this.queue.length = 0; }
  async waitRelease() { this.down = false; }
  async waitButton() { await this.nextEvent(); this.flush(); }
  async waitClick() { await this.waitButton(); }
  async wait() { return false; }
  changed() { return Promise.resolve(); }
}


/** Builds a headless game: returns {game, ui, input, menus, ctl}. */
export function makeGame({ seed = 0, dosCompat = false, level = 1, leng = 1, botSeed = 1 } = {}) {
  const scr = new Screen(fakeCanvas, assets.palette);
  const input = new BotInput(new Rng(botSeed));
  const ui = new Draw(scr, input, assets.font, assets);
  const game = new Game(assets, new ClassicView(ui));
  game.rng = new Rng(seed); game.dosCompat = dosCompat;
  ui.g = game;
  const menus = new Menus(ui, assets.menus, { width: s => 8 * s.length });
  ui.menus = menus;
  game.initChars();
  game.initGame(level, leng, false);
  ui.redrawMainScreen(false);
  const ctl = new Controller(game, ui, menus, { save: async () => true, load: async () => false });
  game.newWordSet(true);
  return { game, ui, input, menus, ctl };
}
export { assets, BotInput, Rng, ObjectB2 };
