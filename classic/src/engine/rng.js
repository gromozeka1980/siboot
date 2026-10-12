// RNG identical to the DOS game's: Turbo Pascal 6 System.Random
//   RandSeed := RandSeed * $08088405 + 1;  Random(n) := (RandSeed shr 16) mod n
// and the game's integer Random = 32767 - Random(65535)  (uniform in -32767..32767).
// The DOS build never seeded it (FIX #8): every DOS game starts from RandSeed = 0.
// We seed randomly by default; seed 0 reproduces the original game move for move
// (open the page with ?seed=dos), which is how the remake is verified against DOS.

export class Rng {
  constructor(seed = (Math.random() * 2 ** 32) >>> 0) { this.seed = seed >>> 0; }
  nextSeed() { this.seed = (Math.imul(this.seed, 0x08088405) + 1) >>> 0; return this.seed; }
  tpRandom(n) { return (this.nextSeed() >>> 16) % n; }
  random() { return 32767 - this.tpRandom(65535); }
  next() { return this.tpRandom(65535) / 65535; } // uniform [0,1) for non-original uses
}

// Pascal integer division (truncates toward zero)
export const div = (a, b) => Math.trunc(a / b);
export const mod = (a, b) => a % b;
