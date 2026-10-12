// Sound for the remake, synthesised with WebAudio (no sound files): a slow ambient drone that changes
// between day and night, and short effects. Starts on the first user gesture (browser autoplay rules).

const pref = (k, d) => { try { const v = localStorage.getItem('siboot.sound.' + k); return v === null ? d : v === '1'; } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem('siboot.sound.' + k, v ? '1' : '0'); } catch { /* ignore */ } };

class Sound {
  constructor() { this.music = pref('music', true); this.sfxOn = pref('sfx', true); this.mode = 'day'; this.ctx = null; }

  /** Call from a user gesture. */
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = this.ctx = new C();
    this.out = ctx.createGain(); this.out.gain.value = 0.8; this.out.connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.music ? 0.22 : 0; this.musicBus.connect(this.out);
    this.fxBus = ctx.createGain(); this.fxBus.gain.value = this.sfxOn ? 0.5 : 0; this.fxBus.connect(this.out);
    // (the ambient drone was removed at the player's request; buildDrone() is kept for a future real music track)
  }

  buildDrone() {
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 700; filter.Q.value = 0.7;
    filter.connect(this.musicBus);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05; const lfoGain = ctx.createGain(); lfoGain.gain.value = 300;
    lfo.connect(lfoGain).connect(filter.frequency); lfo.start();
    this.voices = [0, 1, 2, 3].map(i => {
      const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine';
      const g = ctx.createGain(); g.gain.value = 0.18;
      o.connect(g).connect(filter); o.detune.value = (i - 1.5) * 4; o.start();
      return o;
    });
    // soft wind: filtered noise
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
    const ng = ctx.createGain(); ng.gain.value = 0.05;
    n.connect(bp).connect(ng).connect(this.musicBus); n.start();
    this.setMode(this.mode, 0.1);
  }

  /** 'day' (open fifths) or 'night' (low minor chord). */
  setMode(mode, glide = 4) {
    this.mode = mode;
    if (!this.voices) return;
    const chord = mode === 'night' ? [73.4, 87.3, 110, 146.8] : [110, 164.8, 220, 277.2];
    const t = this.ctx.currentTime;
    this.voices.forEach((o, i) => o.frequency.setTargetAtTime(chord[i], t, glide / 3));
  }

  tone(freq, start, dur, type = 'sine', gain = 0.3, to = null) {
    const ctx = this.ctx, t = ctx.currentTime + start;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.fxBus); o.start(t); o.stop(t + dur + 0.05);
  }

  noise(start, dur, freq, gain = 0.4) {
    const ctx = this.ctx, t = ctx.currentTime + start;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const n = ctx.createBufferSource(); n.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = gain;
    n.connect(f).connect(g).connect(this.fxBus); n.start(t);
  }

  /** pick | say | heard | deal | story | night | clash | win | lose | victory */
  play(name) {
    if (!this.ctx || !this.sfxOn) return;
    switch (name) {
      case 'pick': this.tone(880, 0, 0.08, 'sine', 0.15); break;
      case 'say': this.tone(523, 0, 0.18, 'triangle', 0.2); this.tone(784, 0.09, 0.25, 'triangle', 0.18); break;
      case 'heard': this.tone(392, 0, 0.2, 'sine', 0.15); this.tone(330, 0.1, 0.25, 'sine', 0.12); break;
      case 'deal': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.08, 0.35, 'triangle', 0.18)); break;
      case 'story': this.noise(0, 0.35, 1800, 0.25); this.tone(660, 0.1, 0.5, 'sine', 0.1); break;
      case 'night': this.tone(98, 0, 2.5, 'sine', 0.4); this.tone(147, 0.05, 2.2, 'sine', 0.2); break;
      case 'clash': this.noise(0, 0.5, 300, 0.7); this.tone(80, 0, 0.6, 'sine', 0.5, 40); break;
      case 'win': [392, 494, 587].forEach((f, i) => this.tone(f, i * 0.06, 0.6, 'triangle', 0.18)); break;
      case 'lose': this.tone(330, 0, 0.5, 'sine', 0.2, 196); break;
      case 'victory': [262, 330, 392, 523].forEach((f, i) => this.tone(f, i * 0.15, 2.2, 'triangle', 0.18)); break;
    }
  }

  /** Eeyal "voice": one short sung syllable per word, in the timbre of the speaker's species. */
  voice(who, nWords) {
    if (!this.ctx || !this.sfxOn) return;
    const V = VOICES[who] || VOICES[1];
    const n = Math.min(8, Math.max(2, nWords)), seed = who * 7 + nWords;
    for (let i = 0; i < n; i++) {
      const step = V.scale[(seed * (i + 3) + i * i) % V.scale.length];
      const f = V.base * 2 ** (step / 12), at = i * V.gap;
      this.tone(f, at, V.len, V.wave, V.gain, V.glide ? f * V.glide : null);
      if (V.buzz) this.tone(f / 2, at, V.len, 'sawtooth', V.gain * 0.25);
    }
  }

  setMusic(on) { this.music = on; setPref('music', on); if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.5); }
  setSfx(on) { this.sfxOn = on; setPref('sfx', on); if (this.fxBus) this.fxBus.gain.value = on ? 0.5 : 0; }
}

// species timbres (index = character): Jomkar, Klast, Frem, Ripi, Lokweel, Srol, Tayran
const VOICES = {
  1: { base: 220, scale: [0, 3, 5, 7, 10], wave: 'triangle', len: 0.16, gap: 0.12, gain: 0.12, glide: 1.03 },   // Vetvel: warm, soft
  2: { base: 523, scale: [0, 2, 4, 7, 9, 12], wave: 'square', len: 0.07, gap: 0.07, gain: 0.05, glide: 1.3 },  // Kendra: quick, chirpy
  3: { base: 147, scale: [0, 1, 5, 6], wave: 'sawtooth', len: 0.2, gap: 0.16, gain: 0.05 },                   // Gardbore: dry, nasal
  4: { base: 330, scale: [0, 4, 7, 11, 12], wave: 'sine', len: 0.1, gap: 0.09, gain: 0.14, glide: 0.8 },       // Wiki: playful purr
  5: { base: 196, scale: [0, 4, 7, 12], wave: 'triangle', len: 0.22, gap: 0.17, gain: 0.13 },                  // Locksher: round, confident
  6: { base: 392, scale: [0, 2, 3, 7, 8], wave: 'sine', len: 0.12, gap: 0.1, gain: 0.13, glide: 1.12 },        // Zubi: high, hesitant
  7: { base: 98, scale: [0, 5, 7], wave: 'square', len: 0.18, gap: 0.15, gain: 0.04, buzz: true },             // Skordokott: low, clipped
};

export const sound = new Sound();
