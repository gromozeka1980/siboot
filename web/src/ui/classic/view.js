// ClassicView: the engine's presentation interface implemented with the original DOS screens.
// The engine (src/engine) never draws; it calls these semantic methods. Another front-end
// (the modern remake UI) implements the same methods its own way. Every method here reproduces
// the exact DOS drawing sequence it replaced (verified pixel-for-pixel against the original).
//
// Interface (all may be async):
//   narrate(msg, who)            narration window message (engine message number 1..72)
//   status()                     the player's location / company changed
//   refreshRoom()                clear the "room" panel (what the others said) + status()
//   clearCommand()               the player's sentence was sent: clear the composer
//   heard(who, msg)              `who` said something to the player: narrate msg, show the sentence
//   showHeard(who, when?)        show `who`'s sentence to the player (+ the date/time of a reported event)
//   deal(who)                    a deal was executed in the player's dialog; sentence[0] = the other half
//   delay(ticks)                 pause (aborted by a click); 1 tick = 1/60 s
//   feelings(who) / noFeelings() the other character's love/trust/fear bars (who = the interlocutor)
//   face(him, f) / clearFace(him) the interlocutor's expression (only shown when him is the player)
//   evening(), morningTick()     day-cycle backdrop changes
//   storyFile(n, who)            localised raw text of story n
//   story(story, run)            show a story, let the player pick; run(option 1..4) -> {result, errors}
//   midnight(), combatRound()    night begins / next combatant
//   combat(who1, who2, a1, a2)   one mind combat (auras 1..3)
//   defence(attacker, player)    the player picks a defence aura -> 1..3
//   victory(who)                 the game is won by who
//   dawn()                       night is over: back to the day screen

import { rect } from '../../platform/screen.js';
import { Pat } from '../qd.js';
import { div } from '../../engine/rng.js';
import { SNTC_LENG, SubjectA, VerbA, ObjectA1 } from '../../engine/constants.js';

const FULL = rect(0, 0, 639, 479);

export class ClassicView {
  constructor(ui) { this.ui = ui; }
  get s() { return this.ui.g.s; }

  narrate(msg, who) { return this.ui.narrate(msg, who); }
  status() { this.ui.statDisp(); }
  refreshRoom() { this.ui.cleanOutRect('RoomRect'); this.ui.statDisp(); }
  clearCommand() { this.ui.fillArea('ComdRect'); }
  async heard(who, msg) { await this.ui.narrate(msg, who); this.ui.cleanOutRect('RoomRect'); this.ui.plotSntc(who, 236, 186, false); }
  showHeard(who, when) {
    this.ui.cleanOutRect('RoomRect'); this.ui.plotSntc(who, 236, 186, false);
    if (when) this.ui.drawClock(358, 200, when.date, when.time);
  }
  deal(who) {
    const ui = this.ui;
    if (who === this.s.player) { ui.cleanOutRect('PlayRect'); ui.plotSntc(who, 236, 22, false); ui.plotSntc(0, 396, 22, false); }
    else { ui.cleanOutRect('RoomRect'); ui.plotSntc(who, 236, 184, false); ui.plotSntc(0, 396, 184, false); }
  }
  delay(ticks) { return this.ui.myWait(ticks); }
  feelings(who) { this.ui.drawBarGraph(who); }
  noFeelings() { this.ui.fillArea('FeelRect'); }
  face(him, f) { this.ui.makeAFace(him, f); }
  clearFace(him) { if (him === this.s.player) this.ui.fillArea('FaceRect'); }
  evening() { this.ui.makeBack('gray'); }
  morningTick() { this.ui.fillArea('RoomRect'); }
  storyFile(n, who) { return this.ui.storyFile(n, who); }

  // ---------------------------------------------------------------- story screen (DOS REvent)
  async story(story, run) {
    const ui = this.ui, qd = ui.qd, g = ui.g;
    ui.mode = 'story';
    try {
      const saved = ui.saveScreen();
      qd.clearRect(0, 0, 639, 479);
      const drawDone = () => { qd.frameRect(DONE); qd.moveTo(15, 212); qd.drawString(ui.i18n.t('story.done')); };
      const drawPrev = () => { qd.frameRect(PREV); qd.moveTo(66, 207); qd.drawString(ui.i18n.t('story.prev1')); qd.moveTo(65, 218); qd.drawString(ui.i18n.t('story.page2')); };
      const drawNext = () => { qd.frameRect(NEXT); qd.moveTo(115, 207); qd.drawString(ui.i18n.t('story.next1')); qd.moveTo(115, 218); qd.drawString(ui.i18n.t('story.page2')); };
      drawDone(); drawPrev(); drawNext();
      if (story.faceWho > 0) ui.drawFace(story.faceWho, 6, 28);
      for (const e of story.errors) await randError(ui, e.id, e.param, '');

      const text = g.dosCompat ? story.text : story.text.replace(/\r/g, ' '); // FIX #13
      let startI = 0, ssIndex = 1, endFlag = false, startFlag = true;
      const saveStart = [];
      const drawStory = () => {
        qd.clearRect(170, 10, 639, 235);
        saveStart[ssIndex] = startI;
        const pg = storyPage(text, startI);
        pg.lines.forEach((line, n) => { qd.moveTo(170, 20 + 15 * (n + 1)); qd.drawString(line); });
        startI = pg.next; endFlag = pg.last;
        startFlag = ssIndex === 1;
      };
      drawStory();
      if (startFlag) qd.fillRect(PREV, Pat.white);
      if (endFlag) qd.fillRect(NEXT, Pat.white);

      story.options.forEach((o, n) => { qd.moveTo(15, 225 + 30 * (n + 1)); qd.drawString(o.title); });
      let optSelect = 1;
      qd.invertRect(optRect(optSelect));

      const doExec = async () => {
        const r = run(optSelect);
        for (const e of r.errors) await randError(ui, e.id, e.id === 3 ? optSelect : e.param, story.options[optSelect - 1].command);
        if (r.result !== null) {
          qd.clearRect(170, 20, 612, 234);
          qd.fillRect(PREV, Pat.white); qd.fillRect(NEXT, Pat.white); qd.fillRect(DONE, Pat.white);
          qd.frameRect(DONE); qd.moveTo(DONE.left + 12, DONE.top + 20); qd.drawString(ui.i18n.t('btn.ok'));
          for (let j = 1; j <= 4; j++) if (j !== optSelect) qd.fillRect(optRect(j, 600), Pat.white);
          wrapResult(r.result).forEach((line, n) => { qd.moveTo(172, 30 + (n + 1) * 20); qd.drawString(line); });
        }
        await ui.input.waitRelease();
        for (;;) {
          const e = await ui.input.nextEvent();
          if (e.type === 'mousedown' && qd.ptInRect(e, DONE) && await ui.rectHit(DONE)) return;
        }
      };

      let myFlag = false;
      while (!myFlag) {
        const e = await ui.input.nextEvent();
        if (e.type !== 'mousedown') continue;
        const pt = { x: e.x, y: e.y };
        if (qd.ptInRect(pt, DONE) && await ui.rectHit(DONE)) { await doExec(); myFlag = true; }
        if (qd.ptInRect(pt, NEXT) && !endFlag && await ui.rectHit(NEXT)) {
          ssIndex++; drawStory(); drawPrev();
          if (endFlag) qd.fillRect(NEXT, Pat.white);
        }
        if (qd.ptInRect(pt, PREV) && !startFlag && await ui.rectHit(PREV)) {
          ssIndex--; startI = saveStart[ssIndex]; endFlag = false; drawStory(); drawNext();
          if (startFlag) qd.fillRect(PREV, Pat.white);
        }
        for (let i = 1; i <= 4; i++) if (i !== optSelect && qd.ptInRect(pt, optRect(i)) && await ui.rectHit(optRect(i))) {
          qd.invertRect(optRect(optSelect)); optSelect = i; qd.invertRect(optRect(optSelect));
        }
      }
      ui.restorePalette();
      ui.restoreScreen(saved);
    } finally { ui.mode = null; }
  }

  // ---------------------------------------------------------------- night (DOS Combat overlay)
  midnight() { this.ui.qd.fillRect(FULL, Pat.black); }
  combatRound() { this.ui.clearTrans(); } // TransIndx:=0

  async combat(who1, who2, firstAura, secondAura) {
    const ui = this.ui, s = this.s;
    ui.qd.fillRect(FULL, Pat.black);
    let firstWins = true, secondWins = true;
    if (firstAura !== secondAura) {
      firstWins = (firstAura === 1 && secondAura === 2) || (firstAura === 2 && secondAura === 3) ||
        (firstAura === 3 && secondAura === 1);
      secondWins = !firstWins;
    }
    ui.plotWord(who1, 55, 145);
    ui.plotWord(who2, 426, 145);
    makeAura(ui, firstAura, FirstX, FirstY, 0);
    makeAura(ui, secondAura, SecondX, FirstY, 0);
    // (DOS: GetImage snapshots never used; the Mac grow/invert loop is empty and draws nothing; no sound)
    await sleep(START_DELAY_MS);
    if (s.storyDelay !== 0 && !(firstWins && secondWins)) {
      await sleep(LOSER_PAUSE_MS);
      const lx = firstWins ? SecondX : FirstX; // loser's aura erased by growing circles
      for (let k = 1; k <= 30; k++) { await sleep(CIRCLE_STEP_MS); ui.circle(lx, FirstY, k, 15); }
    }
    await ui.spinWheel(SPIN_TICKS);
    ui.qd.fillRect(FULL, Pat.black);
  }

  /** NPC who1 attacks the player: show the situation and let the player pick a defence aura. */
  async defence(who1, who2) {
    const ui = this.ui, s = this.s, qd = ui.qd, A = s.auraCnt, P = s.player;
    ui.mode = 'defence';
    await ui.narrate(10, who1);
    let x = LeftX, y = 78;
    ui.plotWord(who1, x, y);
    for (let j = 1; j <= 3; j++) { x += 39; ui.plotWord(A[j][who1][P] + 104, x, y); x += 32; ui.plotWord(65 + j, x, y); }
    x = LeftX; y += 39;
    ui.plotWord(P, x, y);
    for (let j = 1; j <= 3; j++) { x += 39; ui.plotWord(A[j][P][P] + 104, x, y); x += 32; ui.plotWord(65 + j, x, y); }
    y += 39;
    const S0 = s.sentence[0];
    for (let j = 1; j <= SNTC_LENG; j++) S0[j] = 0;
    S0[SubjectA] = who1; S0[VerbA] = 56; S0[ObjectA1] = who2;
    ui.plotSntc(0, LeftX + 65, y, false);
    y += 39;
    x = LeftX + 7; ui.plotWord(P, x, y); ui.rightCnct(x, y);
    x = LeftX + 207; ui.plotWord(who1, x, y); ui.rightCnct(x - 40, y);
    x = LeftX + 67;
    const dam = [];
    for (let j = 1; j <= 3; j++) {
      if (A[j][P][P] > 0) ui.plotWord(52 + j, x, y);
      dam[j] = rect(x, y, x + 32, y + 32);
      x += 40;
    }
    let cast2 = 0, dumbFlag = false;
    do { // mouse only, no keyboard (same as DOS/Mac)
      let blinked = false;
      for (let j = 1; j <= 3; j++) {
        if (A[j][P][P] > 0) { qd.invertRect(dam[j]); await ui.myWait(BLINK_TICKS); qd.invertRect(dam[j]); blinked = true; }
        const ev = ui.input.poll();
        if (ev && ev.type === 'mousedown') {
          const pt = { x: ev.x, y: ev.y };
          for (let k = 1; k <= 3; k++)
            if (qd.ptInRect(pt, dam[k]) && A[k][P][P] > 0) {
              qd.invertRect(dam[k]); await ui.input.waitRelease(); qd.invertRect(dam[k]);
              dumbFlag = true; cast2 = k;
            }
          await ui.myTranslate(pt);
        }
      }
      // Not a fix: DOS hangs here forever if the player has no aura left; just yield to the browser.
      if (!blinked) await ui.myWait(BLINK_TICKS);
    } while (!dumbFlag);
    ui.mode = null;
    return cast2;
  }

  async victory(whoWon) {
    const ui = this.ui, qd = ui.qd;
    ui.mode = 'victory';
    // ShowFaceScreen(WhoWon,197,117): clear, face palette, fill index 9, 160x160 face at (241,162)
    ui.scr.fill(rect(0, 0, 640, 480), 9);
    ui.drawFace(whoWon, 241, 162);
    const name = ui.i18n.name(whoWon, 'nom', ui.g);
    ui.drawText(WIN_FONT, name, 320 - div(ui.textWidth(WIN_FONT, name), 2), 147, 0);            // baseline
    const title = ui.i18n.t('victory.title');
    ui.drawText(WIN_FONT, title, 320 - div(ui.textWidth(WIN_FONT, title), 2), 346, 0);
    const ok = rect(290, 394, 350, 419);
    qd.fillRect(ok, Pat.white);
    qd.frameRect(ok);
    const x = div(ok.right - ok.left, 2) + ok.left - div(ui.textWidth(WIN_FONT, 'OK'), 2);
    const y = div(ok.bottom - ok.top, 2) + ok.top + div(ui.fontHeight(WIN_FONT), 2);
    ui.drawText(WIN_FONT, 'OK', x, y, 15);
    for (let okFlag = false; !okFlag;) {
      const ev = await ui.input.nextEvent();
      if (ev.type === 'keydown' && ev.key === 'Enter') {
        qd.invertRect(ok); await ui.myWait(BLINK_TICKS); qd.invertRect(ok);
        okFlag = true;
      }
      if (ev.type === 'mousedown' && qd.ptInRect(ev, ok)) {
        qd.invertRect(ok); await ui.input.waitRelease(); qd.invertRect(ok);
        okFlag = true;
      }
    }
    await ui.gameOver(whoWon); // DOS: Halt(0)
  }

  dawn() {
    this.ui.clearTrans();
    this.ui.redrawMainScreen(); // FillRect(ScreenRect,white), DrawMenuBar, frame lines, StatDisp
  }
}

// ------------------------------------------------------------------ story layout helpers (DOS)

/** Splits the P result text into lines of <=39 chars as DOS ExecComd did (each drawn padded to 63). */
export function wrapResult(text) {
  const c = text + '\r';
  const lines = [];
  let i = 0;
  do {
    const line = [];
    let j = 0;
    do { line[j] = c[i]; j++; i++; } while (!(j === 39 || c[i] === '\r'));
    if (c[i] !== '\r') {
      do { i--; j--; line[j] = ' '; } while (!(c[i] === ' ' || i <= 0));
      while (c[i] === ' ') i++; // FIX #6: DOS started the continuation line AT the blank
    }
    lines.push(line.join('').padEnd(63));
  } while (c[i] !== '\r');
  return lines;
}

/** One DrawStory page from text[startI]: 14 lines, each text[StartI..EndI] with EndI = last blank before
 *  StartI+50, drawn padded to 70. Returns {lines, next (StartI of the next page), last (EndFlag)}. */
export function storyPage(text, startI) {
  const lines = [];
  let last = false;
  for (let lineNum = 1; lineNum < 15 && !last; lineNum++) {
    let endI = startI + 50;
    if (endI >= text.length) { last = true; endI = text.length; }
    do endI--; while (text[endI] !== ' ' && endI > startI);
    lines.push(text.slice(startI, endI + 1).padEnd(70));
    startI = endI + 1;
  }
  return { lines, next: startI, last };
}

const DONE = rect(10, 194, 50, 224), PREV = rect(60, 194, 100, 224), NEXT = rect(110, 194, 150, 224);
const optRect = (i, right = 512) => rect(0, 210 + 30 * i, right, 230 + 30 * i);

async function randError(ui, id, param, command) {
  const qd = ui.qd, r = rect(80, 240, 400, 300);
  qd.fillRect(r, Pat.white); qd.frameRect(r);
  qd.moveTo(84, 260); qd.drawString(`Report Random Event Error #${id} Class:0`);
  qd.moveTo(84, 276);
  qd.drawString({ 1: 'Cannot find Story', 2: 'Cannot read Story', 3: 'Unterminated Command',
    4: 'F-comd has bad operand', 5: 'final X-Value:', 6: 'Bad string: ' + command.slice(0, 30) }[id]);
  qd.drawString(String(param));
  qd.moveTo(84, 292); qd.drawString('Press Mouse to continue.');
  await ui.input.waitButton();
}

// ------------------------------------------------------------------ combat graphics (DOS)

// timings (DOS used CPU busy loops / 72.84 Hz ticks; ui ticks are 1/60 s)
const START_DELAY_MS = 10;    // FOR i:=1 TO 6000 DO ;
const LOSER_PAUSE_MS = 800;   // FOR i:=1 TO 30000 DO FOR j:=1 TO 10 ...
const CIRCLE_STEP_MS = 25;    // FOR i:=1 TO 13000 ... before each erasing circle (30 steps)
const BLINK_TICKS = 8;        // MyWait(10) = 137 ms
const SPIN_TICKS = 99;        // SpinWheel(120) = 1.65 s
const FirstX = 194, FirstY = 156, SecondX = 314, LeftX = 134;
const WIN_FONT = 'rmn6_19';
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** MakeAura: outline in `color`, then BGI flood fill (DOS; always called with color 0). */
export function makeAura(ui, which, X, Y, color) {
  let px, py;
  const moveTo = (x, y) => { px = x; py = y; };
  const lineRel = (...d) => {
    for (let i = 0; i < d.length; i += 2) { ui.scr.line(px, py, px + d[i], py + d[i + 1], color); px += d[i]; py += d[i + 1]; }
  };
  switch (which) {
    case 1: // tanaga
      if (color === 15) ui.floodFill(X - 17, Y + 2, 15, 15); // dead in DOS
      moveTo(X - 20, Y);
      lineRel(9, 0, 21, -21, 0, 38, 8, 6, -15, 0, 0, -25, -9, 9, 0, 7, -14, -14);
      if (color === 0) { ui.floodFill(X + 6, Y + 20, color, color); ui.floodFill(X - 17, Y + 2, color, color); }
      break;
    case 2: // katsin
      moveTo(X - 19, Y + 2);
      lineRel(0, -5, 15, 0, -9, -9, 0, -4, 4, 0, 9, 9, 0, -15, 5, 0, 0, 15, 9, -9, 4, 0, 0, 4,
        -9, 9, 15, 0, 0, 5, -15, 0, 9, 9, 0, 4, -4, 0, -9, -9, 0, 15, -5, 0, 0, -15,
        -9, 9, -4, 0, 0, -4, 9, -9, -15, 0);
      ui.floodFill(X, Y, color, color);
      break;
    case 3: // shial: DOS FrameOval uses full rect width as radius -> r = 24, 20, 6
      ui.circle(X, Y, 24, color); ui.circle(X, Y, 20, color); ui.circle(X, Y, 6, color);
      ui.floodFill(X, Y, color, color);
      ui.floodFill(X - 22, Y, color, color);
      ui.floodFill(X + 22, Y, color, color);
      break;
  }
}
