// Random events ("stories"): port of DOS REvent (OVL_3B7), reconstruction _ref/dos_src/REvent.pas.
// Split into four layers so the story system can later be modernised independently:
//   1. selectStory  - pick a story by StoryParm (pure)
//   2. parseStory   - text substitution + option extraction (pure)
//   3. execComd     - option command interpreter (state mutation, returns result text)
//   4. randEvent    - runs a story through the view (the DOS screen: ui/classic/view.js)

import { div } from './rng.js';

const CR = 13, BSL = 92; // '\r', '\\'
const OPTN_MAX = 500;

// ------------------------------------------------------------------ 1. selection
const mh = v => Math.max(-1, Math.min(1, div(v, 32)));

/** Returns the chosen story number, or <=0 if none. `random` = g.random (drawn only for eligible slots). */
export function selectStory(s, context, who, random) {
  const P = s.player;
  const LoveMH = mh(s.love[who][P]), TrustMH = mh(s.trust[who][P]), FearMH = mh(s.fear[who][P]);
  let storyNum = -1, i = 1;
  do {
    const t = s.storyParm[i];
    if (t >= 0 && random() > 29000) {
      let x = t % 8;
      if (x === who || x === 0) {
        x = div(t, 8) % 8;
        if (x === context || x === 0) {
          x = div(t, 64) % 4;
          const y = (div(t, 256) % 4) - 1;
          const ok = x === 0 ? true : x === 1 ? LoveMH === y : x === 2 ? TrustMH === y : FearMH === y;
          if (ok && div(t, 1024) === 0) storyNum = i;
        }
      }
    }
    i++;
  } while (!(i === 100 || storyNum >= 0));
  return storyNum;
}

// ------------------------------------------------------------------ 2. parsing
const NO_FACE = [9, 10, 19, 20, 21, 22, 23, 24, 25, 30, 42];
const CHRIS_FACE = [15, 16, 17, 18, 37, 38, 39, 40, 41];

/**
 * Parses raw STORYn text for character `who`. `g` supplies charName/male/species/fiance and s.player.
 * Returns {text, faceWho, options: [{title, command}] (4), parmOps: [{op:'K'|'L', n}], errors}.
 * `text` is exactly the buffer DrawStory pages through (StoryOut[0..LastChar-1]); the slot of the
 * first '\' is left as '\0' (DOS: uninitialised). `command` = OptnComd[i][1..]: command[k-1] = OptnComd[k].
 */
export function parseStory(raw, storyNum, who, g) {
  const P = g.s.player, male = g.male(who);
  const out = []; // StoryOut as char codes
  const errors = [];
  let j = 0, lastChar = 0;
  const concat = str => { for (let i = 0; i < str.length; i++) out[j + i] = str.charCodeAt(i); j += str.length - 1; };
  for (let i = 0; i < raw.length; i++) {
    let capFlag = true;
    const oldJ = j, c = raw.charCodeAt(i);
    switch (raw[i]) {
      case '~': concat('you'); break;
      case '%': concat(g.charName(who)); capFlag = false; break;
      case '@': concat(male ? 'he' : 'she'); break;
      case '#': concat(male ? 'his' : 'hers'); break;
      case '$': concat(male ? 'him' : 'her'); break;
      case '^': concat(male ? 'his' : 'her'); break;
      case '&': concat(g.species(who)); break;
      case '=': concat(g.fiance(P)); break;
      case ']': concat(g.fiance(who)); break;
      case '\\':
        if (lastChar === 0) lastChar = j + 1; // slot j left unwritten
        else { out[j] = c; capFlag = false; }
        break;
      default: out[j] = c; capFlag = false;
    }
    const p = out[oldJ - 3];
    if (capFlag && (p === 46 || p === 63 || p === 33)) { // . ? !
      // FIX #5: only a lowercase letter is capitalised (DOS subtracted 32 from anything)
      if (out[oldJ] >= 97 && out[oldJ] <= 122) out[oldJ] -= 32;
    }
    j++;
  }
  for (let k = 0; k < out.length; k++) if (out[k] === undefined) out[k] = 0;
  const at = k => { if (k >= out.length) throw new Error(`story ${storyNum}: unexpected end of text`); return out[k]; };

  // K/L parameters between the 1st and 2nd '\'
  const parmOps = [];
  j = lastChar;
  do {
    j++;
    const op = at(j);
    if (op === 75 || op === 76) { // 'K' | 'L'
      j++;
      let value = at(j) - 48;
      if (value < 0 || value > 9) errors.push({ id: 4, param: value });
      const t = at(j + 1);
      if (t >= 48 && t <= 57) { value = 10 * value + t - 48; j++; }
      // FIX #3: DOS re-tested StoryOut[j] (now the last digit) so K/L never fired
      parmOps.push({ op: op === 75 ? 'K' : 'L', n: value });
    }
  } while (at(j) !== BSL);
  lastChar = j + 1;
  const text = String.fromCharCode(...out.slice(0, lastChar));

  const options = [];
  j = lastChar + 1;
  for (let i = 1; i <= 4; i++) {
    let title = '';
    do { title += String.fromCharCode(at(j)); j++; } while (at(j) !== CR);
    let command = '';
    j += 2;
    do { j++; command += String.fromCharCode(at(j)); } while (at(j) !== BSL);
    j += 2;
    options.push({ title, command });
  }

  let faceWho = who;
  if (CHRIS_FACE.includes(storyNum)) faceWho = 8;
  if (NO_FACE.includes(storyNum)) faceWho = 0;
  return { num: storyNum, who, text, faceWho, options, parmOps, errors };
}

/** Applies K/L parameter ops to StoryParm (only reachable with FIX #3). */
export function applyParmOps(s, ops) {
  for (const { op, n } of ops) s.storyParm[n] = op === 'K' ? Math.abs(s.storyParm[n]) : -Math.abs(s.storyParm[n]);
}

// ------------------------------------------------------------------ 3. interpreter
const i16 = v => (v << 16) >> 16; // TP Integer arithmetic wraps

/**
 * ExecComd: runs an option's command string for (who, storyNum), mutating s.
 * Returns {result: string|null (text after 'P' up to the CR), errors: [{id, param}], terminated}.
 */
export function execComd(s, command, who, storyNum, dosCompat = false) {
  const P = s.player;
  const errors = [];
  // DOS: x,y,z,t and Register are uninitialised stack words -> 0
  let x = 0, y = 0, z = 0, t = 0, register = 0, value = 0, result = null, term = false;
  const ch = k => (k >= 1 && k <= command.length ? command.charCodeAt(k - 1) : 0);
  const push = n => { t = z; z = y; y = x; x = n; };
  const pop = () => { x = y; y = z; z = t; };
  let i = 1;
  const readNum = () => {
    i++;
    value = ch(i) - 48;
    if (value < 0 || value > 9) errors.push({ id: 4, param: value });
    const n = ch(i + 1);
    if (n >= 48 && n <= 57) { value = 10 * value + n - 48; i++; }
  };
  const skipToCR = () => { do i++; while (i < OPTN_MAX && ch(i) !== CR); };
  while (i < OPTN_MAX && !term) {
    const c = String.fromCharCode(ch(i));
    switch (c) {
      case '0': case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9':
        i--; readNum(); push(value); break;
      case 'A': push(s.love[who][P]); break;
      case 'D': push(i16(-s.fear[who][P])); break;
      case 'T': push(s.trust[who][P]); break;
      case 'E': push(s.temper[who]); break;
      case 'G': push(s.gullble[who]); break;
      case 'I': push(s.pride[who]); break;
      case 'N': case 'W': push(0); break;
      case 'a': s.love[who][P] = x; pop(); break; // no clamping (as DOS)
      case 'd': s.fear[who][P] = i16(-x); pop(); break;
      case 't': s.trust[who][P] = x; pop(); break;
      case '+': y = i16(x + y); pop(); break;
      case '-': y = i16(y - x); pop(); break;
      case '*': y = i16(Math.imul(y, x)); pop(); break;
      case '/':
        if (x === 0) throw new Error(`story ${storyNum}: division by zero (DOS runtime error 200)`);
        y = i16(div(y, x)); pop(); break;
      case 'X': [x, y] = [y, x]; break;
      case 'R': { const tmp = x; pop(); t = tmp; break; }
      case 'M': push(register); break;
      case 'm': register = x; break;
      case 'B': if (x >= 0) { skipToCR(); i += 2; } break;
      case 'S': skipToCR(); break;
      case 'P': {
        const start = i + 1;
        let e = start;
        while (e < OPTN_MAX && ch(e) !== CR) e++;
        result = command.slice(start - 1, e - 1);
        i = e;
        do i++; while (i < OPTN_MAX && ch(i) !== BSL);
        i--;
        break;
      }
      case 'F': readNum(); break;
      case 'C':
        readNum();
        for (let j = 1; j <= s.numChars; j++) { // includes the player
          s.love[j][P] = Math.max(-127, s.love[j][P] - value);
          s.trust[j][P] = Math.max(-127, s.trust[j][P] - value);
          s.fear[j][P] = Math.max(-127, s.fear[j][P] - value);
        }
        break;
      case 'H': {
        s.aslyn = i16(s.aslyn + x);
        // FIX #4: used stories (-1) stay used; DOS Abs() turned them into 1 (= enabled for character 1)
        const set = j => { if (dosCompat || s.storyParm[j] !== -1) s.storyParm[j] = s.aslyn < 8 ? Math.abs(s.storyParm[j]) : -Math.abs(s.storyParm[j]); };
        if (storyNum < 23) for (let j = storyNum + 1; j <= 23; j++) set(j);
        if (storyNum === 23 && s.aslyn < 8 && (dosCompat || s.storyParm[44] !== -1)) s.storyParm[44] = Math.abs(s.storyParm[44]);
        break;
      }
      case 'J': x = i16(-x); break;
      case 'Q':
        for (let j = 1; j <= s.numChars; j++) for (let k = 1; k <= 3; k++) s.auraCnt[k][j][P] = s.auraCnt[k][j][0];
        break;
      case '\\': term = true; break;
      default: errors.push({ id: 6, param: 0 });
    }
    i++;
  }
  if (!term) errors.push({ id: 3, param: 0 }); // param = OptSelect, filled in by the caller
  return { result, errors, terminated: term };
}

// ------------------------------------------------------------------ 4. running a story

/** RandEvent(Context, Who): maybe shows a story for character `who` in `context` (1..6). */
export async function randEvent(g, context, who) {
  const s = g.s, view = g.view;
  if (who > s.numChars) return;
  const storyNum = selectStory(s, context, who, () => g.random());
  if (storyNum <= 0 || storyNum >= 45) return;

  const story = parseStory(view.storyFile(storyNum, who), storyNum, who, g);
  s.storyParm[storyNum] = -1;
  if (!g.dosCompat) applyParmOps(s, story.parmOps); // FIX #3 (dosCompat: K/L never fire, as in DOS)
  // FIX #16: story 26 (Kendra evades sin-bearing) lacks the K block that would enable its sequels 27-29 (advice from
  // Gardbore, Wiki, Zubi), as story 30 enables 31-36; nothing else ever enables them
  if (!g.dosCompat && storyNum === 26) for (const n of [27, 28, 29]) if (s.storyParm[n] !== -1) s.storyParm[n] = Math.abs(s.storyParm[n]);
  await view.story(story, opt => {
    const r = execComd(s, story.options[opt - 1].command, who, storyNum, g.dosCompat);
    // FIX #15: story 44 (Aslyn brings everyone's aura counts) is enabled by the H opcode only when the story is 23 -
    // but no answer of story 23 contains H, so 44 never came (Mac and DOS alike). Apply that rule after story 23.
    if (!g.dosCompat && storyNum === 23 && s.aslyn < 8 && s.storyParm[44] !== -1) s.storyParm[44] = Math.abs(s.storyParm[44]);
    return r;
  });
}
