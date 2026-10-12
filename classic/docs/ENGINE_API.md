# Engine ↔ UI API (for porting modules)

Web remake of the DOS game, plain ES modules, no build step. Logic is a line-by-line port of the
reconstructed DOS Pascal in `_ref/dos_src/*.pas` (ground truth), keeping names close to the original
so the port can be audited against it. Everything that blocks in the original (waiting for clicks,
delays) is `async` and must be `await`ed.

## Game object `g` (src/engine/game.js)
- `g.s` — state (src/engine/state.js). Original globals with the same names in camelCase:
  `love[a][b]`, `trust`, `fear`, `loyalty[i]`, `integrity`, `temper`, `revenge`, `duty`, `pride`,
  `secret`, `desLiked`, `gullble`, `loveMood[i]`, `trstMood`, `fearMood`, `beneficence[a][b]`,
  `visits[a][b]`, `maxPers`, `desperation`, `auraCnt[aura 1..3][who 1..7][knower 0..7]`,
  `nBetray[a][b][day]`, `nAttack[a][b]`, `nBetrayCount`, `nAttackCount`,
  `sentence[0..7][1..8]`, `lastSntc[1..7][1..8]`, `dlogHist[who][1..25][1..8]` (fixed slots, never cleared),
  `dlogIndx[who]`, `charLocn[0..7]`, `interloc`, `doorLock`, `guestFlg`, `helloFlg`, `execTime`,
  `day`, `time`, `player`, `numChars`, `level`, `gameLeng`, `storyParm[1..99]`, `aslyn`,
  `fBetrayals`, `playerDeals`, `dlogCount`, `me`, `him`, `foundPlan`, `thatGuy`,
  `lastLove/lastTrust/lastFear`, `barGraphFlag`, `savedFace`, `narratOn`, `storyDelay`, `diurnal`
  ('white'|'gray'|'black' = DiurnalP).
  All arrays are 1-based like the original (index 0 unused unless the original used it).
- History (HstWrd1H/HstWrd3H/HstDateH/HstTimeH/HstKnowH/HistIndx) is `g.s.hist`: a JS array,
  entry = `{wrd1, wrd3, date, time, know: bool[0..8]}`. Original index i (1-based) = `hist[i-1]`,
  `HistIndx` = `hist.length`.
- `g.random()` = original integer `Random` (uniform −32767..32767). Use `div(a,b)` from
  `engine/rng.js` for Pascal `div` (truncates toward zero). `a % b` = Pascal `mod`.
- `g.postHist(subj, objt, whoElse)`, `g.initDialog`, `await g.unlockDoor`, `await g.endDialog`,
  `g.calcTime(who, verb)`, `g.shuffleAuraKnowledge()` (the re-randomise loop used at init and at Midnight),
  `g.charName(i)`, `g.male(i)`, `g.species(i)`, `g.fiance(i)`.
- Constants: `engine/constants.js` (`W.*` word numbers, slot numbers `SubjectA..ObjectB2`, `DAWN`, `SUNSET`, `NIGHT`, `EXP_DELAY` ...).

## UI object `g.ui` (src/ui/draw.js) — DOS drawing semantics, 640x480, colour 0 = white, 15 = black
- `ui.qd` — QuickDraw emulation: `fillRect(r, pat)`, `frameRect(r)`, `invertRect(r)`, `ptInRect(pt, r)`,
  `moveTo(x,y)`, `lineTo(x,y,color)`, `drawString(s, color=15)`, `stringWidth(s)`, `clearRect(l,t,r,b)`.
  Rects are `{left, top, right, bottom}` (use `rect(l,t,r,b)` from `platform/screen.js`);
  frame/invert/ptInRect/fill include right & bottom edges as in DOS BGI.
- `ui.scr` — raw indexed framebuffer (`fill`, `pset`, `line`, `blit`, `save`, `restore`); for effects
  (circles, flood fills) not covered by qd. `ui.circle(x,y,r,color)`, `ui.floodFill(x,y,color,border)`.
- Patterns: `Pat.white`, `Pat.black`, `Pat.gray` (from `ui/qd.js`); `ui.diurnal()` = current DiurnalP pattern.
- `ui.R` — named rects: WordRect, RoomRect, PlayRect, ComdRect, StatRect, FeelRect, FaceRect,
  BkSpRect, DoItRect, CnclRect, OKRect (mutable, e.g. OKRect is swapped by some screens).
- Input: `ui.input` (`await nextEvent()` → `{type:'mousedown'|'mouseup'|'keydown', x, y, key}`,
  `poll()`, `flush()`, `await waitRelease()`, `await waitButton()`, `await waitClick()`,
  `ui.input.mouse` {x,y}, `ui.input.down` = Button). `await ui.myWait(ticks)` (aborts on button),
  `await ui.spinWheel(ticks)` → true if a click arrived. Tick = 1/60 s by default (DOS ran 1/72.8 s).
- Original Globals procedures: `await ui.narrate(msg, who)`, `ui.cleanOutRect(nameOrRect)`,
  `ui.fillArea(name)` (= FillRect(R[name], DiurnalP)), `ui.rightCnct(x,y)`, `ui.downCnct(x,y)`,
  `ui.plotWord(w,x,y)`, `ui.plotSntc(who,x,y,endConnect)`, `ui.drawClock(x,y,day,time)`, `ui.grayRect(r)`,
  `await ui.rectHit(r)`, `ui.statDisp()`, `ui.makeAFace(him, face)`, `await ui.myTranslate(pt)`,
  `await ui.waitForOK()`, `ui.makeBack(patName)`, `ui.drawBarGraph(who)`.
- Images: `ui.drawWordIcon(w,x,y)`, `ui.drawWordText(w,x,y)`, `ui.drawFace(who,x,y)` (158x158 character
  face 1..8; also switches palette to that face's palette like DOS), `ui.drawEmotion(n,x,y)`,
  `ui.restorePalette()`.
- Screen save/restore: `const t = ui.saveScreen(); ... ui.restoreScreen(t)`; `ui.saveTrans()/restoreTrans(t)`
  (TransList used by MyTranslate).
- Text resources: `ui.storyFile(n)` → raw text of STORYn (string, CR line breaks kept),
  `ui.dossierFile(who)` → raw text.
