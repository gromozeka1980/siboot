// Save / Load Game. The DOS version had one fixed slot (siboot.sav + screen.sav) and no file
// dialog; we keep one slot in localStorage and store the complete state (FIX #10) plus the
// RNG seed. The screen is redrawn from state instead of being stored.

const KEY = 'siboot.sav';

export const persistence = {
  async save(g) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, s: g.s, seed: g.rng.seed }));
      return true;
    } catch { return false; }
  },
  async load(g) {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch { /* storage unavailable */ }
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.v !== 1) return false;
    Object.assign(g.s, data.s);
    g.rng.seed = data.seed >>> 0;
    return true;
  },
};
