// Game core: port of the DOS main program (Main.pas / StdRoutines / Init.InitGame).
// Logic follows the reconstructed DOS code line by line. The engine never draws: it calls the
// semantic methods of `view` (interface: ui/classic/view.js), so any front-end can present it.

import {
  SNTC_LENG, HIST_LENG, DLOG_MAX, DAWN, SUNSET, NIGHT, BEG_DELAY, HOW_DEPART, HOW_ARRIVE,
  SubjectA, VerbA, ObjectA1, ObjectA2, SubjectB, VerbB, ObjectB1, ObjectB2, W,
} from './constants.js';
import { createState } from './state.js';
import { Rng, div } from './rng.js';
import { newWordSet } from './words.js';
import { planMove } from './ai.js';
import { midnight } from './combat.js';
import { randEvent } from './events.js';

import { CHARACTERS, LOVE, TRUST, FEAR, STORY_PARM } from '../data/characters.js';

const clamp127 = x => (x < -127 ? -127 : x);

export class Game {
  constructor(data, view) {
    this.data = data;       // {follows1, follows2, strings, stories, dossiers}
    this.view = view;
    this.s = createState();
    this.rng = new Rng();
    this.quit = false;
  }

  random() { return this.rng.random(); }

  // ---------------------------------------------------------------- setup
  initChars() {
    const s = this.s;
    for (let who = 1; who <= 7; who++) {
      const c = CHARACTERS[who];
      [, , , s.loyalty[who], s.integrity[who], s.temper[who], s.revenge[who], s.duty[who],
        s.pride[who], s.secret[who], s.desLiked[who], s.gullble[who]] = c;
      s.interloc[who] = 0; s.charLocn[who] = who; s.doorLock[who] = false; s.dlogIndx[who] = 0;
      s.guestFlg[who] = false; s.helloFlg[who] = true;
      if (who !== s.player) {
        s.sentence[who][SubjectA] = who;
        s.sentence[who][VerbA] = W.Pause;
        s.execTime[who] = 479 + who;
      }
    }
  }

  charName(i) { return i === 8 ? 'Chris Crawford' : CHARACTERS[i][0]; }
  male(i) { return CHARACTERS[i][2]; }
  species(i) { return CHARACTERS[i][1]; }
  fiance(i) { return CHARACTERS[i][12]; }

  /** InitGame (without drawing; the UI draws the frame). */
  initGame(level, gameLeng, expert = false) {
    const s = this.s;
    s.level = level; s.gameLeng = gameLeng;
    // FIX #9: the DOS InitGame reset these, cancelling expert mode chosen on the options screen
    s.narratOn = !expert;
    s.storyDelay = expert ? 0 : BEG_DELAY;
    s.barGraphFlag = false;
    s.diurnal = 'white';
    s.curWord = 0;
    for (let i = 1; i <= SNTC_LENG; i++) {
      for (let j = 1; j <= s.numChars; j++) { s.sentence[j][i] = 0; s.lastSntc[j][i] = 0; }
      s.canclAble[i] = false;
    }
    s.sntcIndx = 0;
    s.storyParm = STORY_PARM.map((v, i) => (i === 0 ? -1 : v));
    while (s.storyParm.length < 100) s.storyParm.push(-1);
    s.aslyn = 0; s.fBetrayals = 0; s.playerDeals = 0; s.dlogCount = 0;
    for (let a = 1; a <= 7; a++) for (let b = 1; b <= 7; b++) {
      s.love[a][b] = LOVE[a][b]; s.trust[a][b] = TRUST[a][b]; s.fear[a][b] = FEAR[a][b];
    }
    s.doorLock[s.player] = false;
    s.time = DAWN; s.day = 1;
    const N = s.numChars, P = s.player;
    const pick3 = () => { let j; do j = Math.abs(div(this.random(), 8192)); while (!(j > 0 && j <= 3)); return j; };
    for (let i = 1; i <= N; i++) {
      for (let j = 1; j <= 3; j++) s.auraCnt[j][i][0] = 8;
      for (let k = 1; k <= 2 * gameLeng; k++) s.auraCnt[pick3()][i][0]--;
      for (let j = 1; j <= 3; j++) s.auraCnt[j][i][i] = s.auraCnt[j][i][0];
      for (let j = 1; j <= N; j++) {
        for (let k = 1; k <= 64; k++) s.nBetray[i][j][k] = false;
        s.nAttack[i][j] = false; s.nBetrayCount[i][j] = 0; s.nAttackCount[i][j] = 0;
        s.beneficence[i][j] = 0; s.visits[i][j] = 0;
      }
    }
    this.shuffleAuraKnowledge();
    for (let i = 1; i <= N; i++) if (i !== P) {
      const lv = Math.min(level, 3); // level 4 (remake): as level 3 except in combat
      const h = 16 * (3 - lv);
      s.love[i][P] = Math.min(127, s.love[i][P] + h);
      s.trust[i][P] = Math.min(127, s.trust[i][P] + h);
      s.fear[P][i] = Math.min(127, s.fear[P][i] + h);
      const m = 4 - lv;
      for (const k of ['loyalty', 'integrity', 'temper', 'revenge', 'duty', 'pride', 'secret', 'desLiked', 'gullble']) s[k][i] *= m;
    }
    s.maxPers = 16 * (4 - Math.min(level, 3));
    s.hist = [];
  }

  /** Each character knows exactly one random aura count of every other character. */
  shuffleAuraKnowledge() {
    const s = this.s, N = s.numChars;
    for (let i = 1; i <= N; i++) for (let j = 1; j <= N; j++) if (j !== i) {
      for (let k = 1; k <= 3; k++) s.auraCnt[k][j][i] = -1;
      let k; do k = Math.abs(div(this.random(), 8192)); while (!(k > 0 && k <= 3));
      s.auraCnt[k][j][i] = s.auraCnt[k][j][0];
    }
  }

  // ---------------------------------------------------------------- StdRoutines
  postHist(subj, objt, whoElse) {
    const s = this.s;
    const e = { wrd1: subj, wrd3: objt, date: s.day, time: s.time, know: Array(9).fill(false) };
    e.know[subj] = true;
    if (whoElse > 0) e.know[whoElse] = true;
    if (s.hist.length < HIST_LENG) s.hist.push(e); else s.hist[HIST_LENG - 1] = e;
  }

  initDialog(guest, host) {
    const s = this.s;
    s.charLocn[guest] = host; s.interloc[guest] = host; s.interloc[host] = guest;
    s.dlogIndx[host] = 0; s.dlogIndx[guest] = 0;
    s.loveMood[guest] = s.love[guest][host]; s.trstMood[guest] = s.trust[guest][host]; s.fearMood[guest] = s.fear[guest][host];
    s.loveMood[host] = s.love[host][guest]; s.trstMood[host] = s.trust[host][guest]; s.fearMood[host] = s.fear[host][guest];
    s.doorLock[host] = true;
    s.execTime[host] = s.time + 3; s.sentence[host][VerbA] = W.Pause;
    s.execTime[guest] = s.time + 1; s.sentence[guest][VerbA] = W.Pause;
    for (let j = 1; j <= SNTC_LENG; j++) s.lastSntc[host][j] = 0;
    s.guestFlg[guest] = true; s.helloFlg[guest] = false; s.helloFlg[host] = false;
    s.visits[guest][host]++;
    if (host === s.player || guest === s.player) {
      const j = host === s.player ? guest : host;
      s.lastLove = s.love[j][s.player]; s.lastTrust = s.trust[j][s.player]; s.lastFear = s.fear[j][s.player];
    }
  }

  async unlockDoor(where, how, who) {
    const s = this.s, P = s.player;
    if (s.doorLock[where]) return;
    for (let i = 1; i <= s.numChars; i++) if (s.charLocn[i] === -where) {
      this.initDialog(i, where);
      if (how === HOW_DEPART) {
        if (i === P) { if (this.random() > 0) await randEvent(this, 5, who); else await randEvent(this, 6, where); }
        if (who === P) await randEvent(this, 4, i);
      }
      if (i === P) { this.view.status(); await this.view.narrate(25 + how, who); }
      else if (s.charLocn[i] === s.charLocn[P]) await this.view.narrate(11 + how, i);
      break;
    }
  }

  async endDialog(guest, host) {
    const s = this.s, P = s.player;
    let other = 0;
    if (host === P) other = guest;
    if (guest === P) other = host;
    if (other > 0) {
      if (s.loveMood[other] < 30) s.dlogCount++;
      if (s.dlogCount > 8 && s.storyParm[39] === 1024) s.storyParm[39] = 32;
    }
    s.charLocn[guest] = 0; s.interloc[guest] = 0; s.interloc[host] = 0;
    s.doorLock[host] = false; s.guestFlg[guest] = false;
    s.dlogIndx[host] = 0; s.dlogIndx[guest] = 0;
    for (let j = 1; j <= SNTC_LENG; j++) s.lastSntc[guest][j] = 0;
    await this.unlockDoor(host, HOW_DEPART, guest);
  }

  calcTime(who, verb) {
    const s = this.s;
    let t = 1;
    if (verb === W.Wait) t = 57;
    if (verb === W.Go) {
      t = 30;
      for (let j = 1; j <= SNTC_LENG; j++) s.lastSntc[who][j] = 0;
      s.charLocn[who] = 0;
      s.doorLock[who] = true;
    }
    if (verb >= 53 && verb <= 55) t = 1439 - s.time;
    s.execTime[who] = s.time + t;
  }

  // ---------------------------------------------------------------- sentence building
  newWordSet(flag) { newWordSet(this.s, this.data, flag, this.dosCompat); }

  plunkDown() {
    const s = this.s, S = s.sentence[s.player];
    s.sntcIndx++;
    const x = S[VerbA], y = S[VerbB];
    if (s.sntcIndx % 4 === ObjectA1) s.curWord = Math.abs(s.sntcIndx === ObjectA1 ? x : y);
    if (s.sntcIndx !== ObjectA2 || s.curWord === W.That || Math.abs(x) === W.Reveal) this.newWordSet(s.sntcIndx % 4 !== ObjectA1);
    else { s.iconCount = 0; s.curWord = 0; }
  }

  /** Player picked word w (TakeInput inner part). */
  chooseWord(w) {
    const s = this.s;
    s.curWord = w;
    s.sentence[s.player][s.sntcIndx + 1] = w;
    do {
      this.plunkDown();
      if (s.sntcIndx < ObjectB2) s.canclAble[s.sntcIndx + 1] = s.iconCount > 1;
    } while (s.iconCount === 0 && s.sntcIndx !== ObjectB2);
    if (s.sntcIndx === ObjectB2) s.iconCount = 0;
  }

  /** BackSpWord logic (after the button was confirmed). */
  backSpace() {
    const s = this.s, S = s.sentence[s.player];
    do {
      S[s.sntcIndx] = 0;
      if (s.sntcIndx < ObjectB2) s.canclAble[s.sntcIndx + 1] = false;
      s.sntcIndx--;
    } while (!(s.canclAble[s.sntcIndx + 1] || s.sntcIndx === 1));
    s.curWord = Math.abs(S[s.sntcIndx]);
    if (s.sntcIndx === SubjectA) s.curWord = s.player;
    if (s.sntcIndx % 4 === ObjectA1) s.curWord = Math.abs(s.sntcIndx === ObjectA1 ? S[VerbA] : S[VerbB]);
    this.newWordSet(s.sntcIndx % 4 !== ObjectA1);
  }

  endSntc() {
    const s = this.s;
    s.curWord = 0;
    for (let i = 1; i <= SNTC_LENG; i++) { s.sentence[s.player][i] = 0; s.canclAble[i] = false; }
    s.sntcIndx = 0;
    this.newWordSet(true);
  }

  // ---------------------------------------------------------------- execution
  /** Executes the sentence of character who; returns true if the player can resume play. */
  async execSntc(who) {
    const s = this.s, view = this.view, P = s.player;
    let result = true;
    if (who === P) view.clearCommand();
    const M = s.sentence[who].slice();
    const [, MSubjA, MVerbA, MObjA1, MObjA2, MSubjB, MVerbB, MObjB1, MObjB2] = M;
    const OtherG = s.interloc[who];
    let L = Array(9).fill(0);
    if (OtherG > 0) L = s.lastSntc[OtherG].slice();
    const [, LSubjA, LVerbA, LObjA1, LObjA2, LSubjB, LVerbB, LObjB1, LObjB2] = L;

    const drawStnc = n => view.heard(who, n);
    const ifDrawSntc = async n => { if (OtherG === P) await drawStnc(n); };
    const askOrReveal = async (n1, n2) => {
      if (s.charLocn[MObjA1] === s.charLocn[who]) {
        if (who === P) await view.narrate(n1, MObjA1);
        await ifDrawSntc(n2);
      }
    };
    const execDeal = async () => {
      if (LSubjA === P) await view.narrate(7, LObjA1);
      this.postHist(LSubjA, LObjA2, LObjA1);
      this.postHist(LObjA1, LObjB1, LSubjA);
      s.auraCnt[LObjB2 - 35][LObjB1][LSubjA] = s.auraCnt[LObjB2 - 35][LObjB1][LObjA1];
      s.auraCnt[LSubjB - 35][LObjA2][LObjA1] = s.auraCnt[LSubjB - 35][LObjA2][LSubjA];
      s.beneficence[who][OtherG]++;
      if (who === P || OtherG === P) {
        const S = s.sentence[who], Z = s.sentence[0];
        S[VerbA] = W.Reveal; S[ObjectA1] = LSubjA; S[ObjectA2] = W.That; S[SubjectB] = LObjB1;
        S[VerbB] = LObjB2; S[ObjectB1] = s.auraCnt[LObjB2 - 35][LObjB1][LObjA1] + 104;
        Z[SubjectA] = LSubjA; Z[VerbA] = W.Reveal; Z[ObjectA1] = LObjA1; Z[ObjectA2] = W.That;
        Z[SubjectB] = LObjA2; Z[VerbB] = LSubjB; Z[ObjectB1] = s.auraCnt[LSubjB - 35][LObjA2][LSubjA] + 104;
        view.deal(who);
        if (who === P) { if (s.love[LObjA2][P] > 0) s.fBetrayals++; }
        else if (s.love[LObjB1][P] > 0) s.fBetrayals++;
        await view.delay(s.storyDelay);
        if (s.fBetrayals > 8 && s.storyParm[37] === 1024) s.storyParm[37] = 8;
        s.playerDeals++;
      }
    };

    if (MVerbA !== W.Pause) {
      for (let i = 1; i <= SNTC_LENG; i++) s.lastSntc[who][i] = s.sentence[who][i];
      if (OtherG > 0) {
        // fixed 25-slot memory, never cleared between dialogs (the AI reads stale slots too)
        const h = s.dlogHist[who];
        let x = s.dlogIndx[who] + 1;
        if (x > DLOG_MAX) { x = DLOG_MAX; for (let j = 2; j <= DLOG_MAX; j++) h[j - 1] = h[j].slice(); }
        s.dlogIndx[who] = x;
        h[x] = s.sentence[who].slice();
        if (who === P && s.charLocn[who] !== who) await randEvent(this, 2, OtherG);
        if (who === P && s.charLocn[who] === who) await randEvent(this, 3, OtherG);
      }
    }

    switch (MVerbA) {
      case W.Greet:
        s.helloFlg[who] = true;
        await ifDrawSntc(4);
        if (who === P) await view.narrate(25, MObjA1);
        break;
      case W.Goodbye: {
        s.helloFlg[who] = true;
        if (!s.guestFlg[who] && OtherG !== P) {
          s.love[OtherG][who] = clamp127(s.love[OtherG][who] - 4);
          s.trust[OtherG][who] = clamp127(s.trust[OtherG][who] - 4);
        }
        if (who === P) { await view.narrate(29, OtherG); view.refreshRoom(); }
        if (OtherG === P) { await drawStnc(30); await view.delay(s.storyDelay); view.refreshRoom(); }
        if (s.guestFlg[who]) await this.endDialog(who, OtherG); else await this.endDialog(OtherG, who);
        break;
      }
      case W.SayFeel:
        await ifDrawSntc(MObjA2 - 79);
        if (who === P) await view.narrate(MObjA2 - 57, OtherG);
        break;
      case W.Accuse:
        if (MVerbB === W.Betray) {
          if (who === P) await view.narrate(19, MObjA1);
          await ifDrawSntc(18);
          const i = s.hist.findIndex(e => e.wrd1 === MObjA1 && e.wrd3 === who && e.know[who]);
          if (i >= 0) s.hist.splice(i, 1); // purge the memory
        } else if (MVerbB === W.BBetray) {
          s.nBetrayCount[MSubjB][who]--;
          await ifDrawSntc(54);
          if (who === P) await view.narrate(56, MObjA1);
        } else if (MVerbB === W.BAttack) {
          s.nAttackCount[MSubjB][who]--;
          await ifDrawSntc(53);
          if (who === P) await view.narrate(55, MObjA1);
        }
        break;
      case W.Reveal: await askOrReveal(6, 8); break;
      case W.Beg: await askOrReveal(33, 16); break;
      case W.Threat: await askOrReveal(15, 17); break;
      case W.Go: {
        const where = MObjA1 - 56;
        if (who === P) {
          let x = 0;
          for (let i = 1; i <= s.numChars; i++) if (i !== P && s.charLocn[i] === 0) x = i;
          if (x > 0) await randEvent(this, 1, x);
        }
        if (!s.doorLock[where] || who === where) {
          s.charLocn[who] = where; s.interloc[who] = 0;
          if (s.charLocn[P] === where && who !== P) { await view.narrate(12, who); view.refreshRoom(); }
          s.doorLock[where] = false;
          for (let i = 1; i <= s.numChars; i++) if (i !== who && s.charLocn[i] === where) this.initDialog(who, i);
          if (who === P) { if (where !== P) await view.narrate(5, where); else await view.narrate(14, P); }
          await this.unlockDoor(where, HOW_ARRIVE, who);
        } else {
          s.charLocn[who] = -where;
          if (who === P) await view.narrate(34, where);
        }
        if (who === P) view.refreshRoom();
        break;
      }
      case 53: case 54: case 55: await midnight(this); break;
      case W.Tell: case W.Answer: {
        await ifDrawSntc(MVerbA === W.Tell ? 49 : 50);
        if (MSubjB === W.Nobody && MObjA1 === P) view.showHeard(who);
        const e = s.hist.find(e => e.wrd1 === MSubjB && e.wrd3 === MObjB1 && !e.know[MObjA1] && e.know[who]);
        if (e) {
          if (MObjA1 === P) view.showHeard(who, { date: e.date, time: e.time });
          e.know[MObjA1] = true;
          if (MObjA1 === MObjB1 && s.nBetray[MSubjB][MObjB1][e.date]) {
            s.nBetrayCount[MSubjB][MObjB1]++;
            s.trust[MObjB1][MSubjB] = clamp127(s.trust[MObjB1][MSubjB] - 16 * (4 - Math.min(s.level, 3)));
          }
        }
        s.beneficence[who][OtherG] += LVerbA === W.Ask ? 1 : 2;
        if (MSubjB <= 7 && who !== MSubjB) this.postHist(who, MSubjB, MObjA1);
        break;
      }
      case W.Agree: await execDeal(); break;
      case W.Reject: await ifDrawSntc(11); break;
      case W.Ask: await askOrReveal(3, 24); break;
      case W.Wait: await ifDrawSntc(0); break;
      case W.NBetray:
        await ifDrawSntc(51);
        s.nBetray[who][MObjA1][s.day] = true;
        if (who === P) await view.narrate(71, MObjA1);
        break;
      case W.NAttack:
        await ifDrawSntc(52);
        s.nAttack[who][MObjA1] = true;
        if (who === P) await view.narrate(72, MObjA1);
        break;
    }

    if (MVerbA === W.Pause) {
      if (who !== P) { s.me = who; await planMove(this); this.calcTime(who, s.sentence[who][VerbA]); }
      result = true;
    } else if (s.sentence[who][VerbA] !== W.Pause) { // kluge for InitDialog
      const S = s.sentence[who];
      S[VerbA] = W.Pause; S[ObjectA1] = 3;
      for (let j = 4; j <= SNTC_LENG; j++) S[j] = 0;
      s.execTime[who] = s.time + 3;
      result = false;
      if (OtherG === P) {
        s.barGraphFlag = true;
        view.feelings(who);
        s.lastLove = s.love[who][P]; s.lastTrust = s.trust[who][P]; s.lastFear = s.fear[who][P];
      }
    }
    // wake up anybody killing time in the same location
    for (let i = 1; i <= s.numChars; i++)
      if (i !== who && s.charLocn[i] === s.charLocn[who] && s.charLocn[i] > 0 && s.sentence[i][VerbA] === W.Wait) {
        s.sentence[i][VerbA] = W.Pause; s.execTime[i] = s.time + 1;
      }
    if (who === P) {
      view.status();
      if (OtherG === 0) { view.noFeelings(); s.barGraphFlag = false; }
    }
    return result;
  }

  async execMove() {
    const s = this.s, view = this.view, P = s.player;
    this.calcTime(P, s.sentence[P][VerbA]);
    let done = false;
    do {
      s.time++;
      if (s.time === SUNSET) await view.narrate(9, P);
      if (s.time === NIGHT) view.evening();
      if (s.time <= 485) view.morningTick();
      if (s.execTime[P] <= s.time) done = await this.execSntc(P);
      for (let i = 1; i <= s.numChars; i++) if (i !== P && s.execTime[i] <= s.time) await this.execSntc(i);
    } while (!done);
  }
}

export { HOW_DEPART, HOW_ARRIVE, ObjectB2 };
