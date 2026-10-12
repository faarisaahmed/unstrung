// Procedural sound effects. Each recipe builds short-lived nodes on the SFX bus.
import { mtof } from './engine.js';

export class SFX {
  constructor(engine) { this.e = engine; this.last = {}; }

  osc(type, f0, f1, t, dur, vol, o = {}) {
    const ctx = this.e.ctx;
    const osc = ctx.createOscillator(); osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); n = f; }
    n.connect(g);
    this.e.out(g, this.e.sfxBus, o.rev ?? 0.15, 0, o.pan || 0);
    osc.start(t); osc.stop(t + dur + 0.05);
    return osc;
  }

  noise(t, dur, vol, o = {}) {
    const ctx = this.e.ctx;
    const n = ctx.createBufferSource(); n.buffer = this.e.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f0 || 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.a || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g);
    this.e.out(g, this.e.sfxBus, o.rev ?? 0.12, 0, o.pan || 0);
    n.start(t, Math.random() * 1.5); n.stop(t + dur + 0.05);
  }

  play(name, k = 1) {
    const e = this.e;
    if (!e.ctx || !e.ready) return;
    const ctx = e.ctx, t = ctx.currentTime + 0.005;
    // rate-limit spammy sounds
    const now = performance.now();
    const minGap = { hit: 30, glint: 25, blip: 30, clink: 40, land: 60, spit: 40, swim: 80 }[name] || 0;
    if (minGap && this.last[name] && now - this.last[name] < minGap) return;
    this.last[name] = now;
    const R = (a, b) => a + Math.random() * (b - a);
    switch (name) {
      case 'jump': this.osc('sine', 300, 520, t, 0.12, 0.18); this.noise(t, 0.08, 0.05, { f0: 2000 }); break;
      case 'dbljump': this.osc('sine', 500, 900, t, 0.16, 0.16); this.osc('triangle', 750, 1300, t + 0.03, 0.15, 0.08, { rev: 0.4 }); break;
      case 'land': this.noise(t, 0.09, 0.12 * k + 0.04, { f0: 400, type: 'lowpass' }); this.osc('sine', 120, 60, t, 0.08, 0.15 * k); break;
      case 'swing': this.noise(t, 0.12, 0.13, { f0: R(1800, 2400), f1: 600, q: 1.2 }); break;
      case 'hit': this.osc('square', 220, 90, t, 0.09, 0.12, { lp: 1800 }); this.noise(t, 0.1, 0.22, { f0: 900, q: 0.8 }); this.osc('sine', 90, 50, t, 0.12, 0.25); break;
      case 'clink': this.osc('triangle', 2200, 1900, t, 0.12, 0.12, { rev: 0.3 }); this.osc('sine', 3300, 3100, t, 0.08, 0.06); break;
      case 'bonkRock': this.noise(t, 0.12, 0.25, { f0: 500, q: 1 }); this.osc('sine', 140, 70, t, 0.1, 0.2); break;
      case 'rockBreak': this.noise(t, 0.4, 0.35, { f0: 700, f1: 150, type: 'lowpass' }); this.osc('sine', 80, 40, t, 0.3, 0.3); break;
      case 'crystalBreak':
        for (let i = 0; i < 6; i++) this.osc('sine', R(1800, 4200), R(1500, 3800), t + i * 0.025, 0.4, 0.06, { rev: 0.6 });
        this.noise(t, 0.3, 0.2, { f0: 5000, type: 'highpass' }); break;
      case 'bonkWall': this.osc('sine', 160, 60, t, 0.15, 0.3 * k + 0.05); this.noise(t, 0.12, 0.2 * k, { f0: 600 }); break;
      case 'dash': this.noise(t, 0.18, 0.18, { f0: 600, f1: 3000, q: 0.8 }); break;
      case 'hurt':
        this.osc('sawtooth', 400, 80, t, 0.35, 0.18, { lp: 1500 });
        this.noise(t, 0.3, 0.3, { f0: 1200, f1: 200 }); this.osc('sine', 60, 30, t, 0.4, 0.4); break;
      case 'enemyDie': this.noise(t, 0.35, 0.3, { f0: 1600, f1: 200, q: 0.7 }); this.osc('sine', 300, 50, t, 0.3, 0.2); break;
      case 'glint': {
        const m = 84 + [0, 4, 7, 12][Math.floor(Math.random() * 4)];
        this.osc('sine', mtof(m), mtof(m), t, 0.2, 0.07, { rev: 0.3 });
        this.osc('triangle', mtof(m + 12), mtof(m + 12), t + 0.03, 0.15, 0.03); break;
      }
      case 'mendStart': this.osc('sine', 220, 330, t, 0.6, 0.08, { a: 0.3, rev: 0.6 }); break;
      case 'mend': [60, 64, 67, 72].forEach((m, i) => this.osc('sine', mtof(m + 12), mtof(m + 12), t + i * 0.04, 0.6, 0.08, { rev: 0.7 })); break;
      case 'shard': this.osc('triangle', 900, 300, t, 0.25, 0.15, { rev: 0.4 }); this.noise(t, 0.2, 0.15, { f0: 3000, f1: 800 }); break;
      case 'howl': this.osc('sawtooth', 150, 600, t, 0.5, 0.12, { lp: 1200, rev: 0.6 }); this.noise(t, 0.5, 0.2, { f0: 400, f1: 2000 }); break;
      case 'unravel': this.noise(t, 0.5, 0.3, { f0: 300, f1: 4000 }); this.osc('sine', 100, 400, t, 0.4, 0.2, { rev: 0.5 }); break;
      case 'poundStart': this.osc('sine', 600, 200, t, 0.12, 0.12); break;
      case 'pound': this.osc('sine', 90, 30, t, 0.5, 0.5); this.noise(t, 0.4, 0.4, { f0: 300, type: 'lowpass' }); break;
      case 'cometCharge': this.osc('sine', 200, 800, t, 0.55, 0.12, { a: 0.4, rev: 0.4 }); break;
      case 'comet': this.noise(t, 0.6, 0.3, { f0: 300, f1: 2000, q: 0.6 }); this.osc('sawtooth', 120, 240, t, 0.4, 0.1, { lp: 800 }); break;
      case 'hook': this.noise(t, 0.15, 0.15, { f0: 4000, f1: 1500 }); this.osc('triangle', 800, 1200, t, 0.1, 0.06); break;
      case 'hang': this.osc('sine', 500, 450, t, 0.1, 0.12); break;
      case 'magnet': this.osc('square', 180, 180, t, 0.12, 0.05, { lp: 700 }); break;
      case 'shrink': this.osc('sine', 800, 1600, t, 0.15, 0.12); break;
      case 'grow': this.osc('sine', 1400, 600, t, 0.15, 0.12); break;
      case 'swim': this.noise(t, 0.2, 0.1, { f0: 600, f1: 300, type: 'lowpass' }); break;
      case 'secret': [67, 71, 74, 79].forEach((m, i) => this.osc('triangle', mtof(m), mtof(m), t + i * 0.09, 0.4, 0.08, { rev: 0.6 })); break;
      case 'death': this.osc('sawtooth', 300, 40, t, 1.4, 0.2, { lp: 900, rev: 0.7 }); this.noise(t, 1.2, 0.3, { f0: 800, f1: 100 }); break;
      case 'rest': [55, 59, 62, 67, 71].forEach((m, i) => e.note('harp', m + 12, t + i * 0.12, 1, 0.6, e.sfxBus, { vol: 0.25, rev: 0.6 })); break;
      case 'itemGet': [72, 76, 79, 84].forEach((m, i) => e.note('bell', m, t + i * 0.1, 1, 0.5, e.sfxBus, { vol: 0.18, rev: 0.6 })); break;
      case 'abilityGet':
        [60, 67, 72, 76, 79, 84].forEach((m, i) => e.note('bell', m, t + i * 0.14, 1.5, 0.6, e.sfxBus, { vol: 0.2, rev: 0.8 }));
        e.note('choir', 48, t, 2.5, 0.6, e.sfxBus, { vol: 0.25, rev: 0.8 }); break;
      case 'unlock': [67, 72].forEach((m, i) => e.note('bell', m, t + i * 0.1, 0.6, 0.5, e.sfxBus, { vol: 0.15 })); break;
      case 'lever': this.noise(t, 0.15, 0.25, { f0: 800 }); this.osc('square', 140, 90, t + 0.05, 0.15, 0.08, { lp: 600 }); break;
      case 'gateOpen': this.noise(t, 0.8, 0.2, { f0: 300, q: 2 }); this.osc('sawtooth', 70, 90, t, 0.8, 0.06, { lp: 300 }); break;
      case 'gateClose': this.osc('sine', 80, 40, t, 0.4, 0.4); this.noise(t, 0.3, 0.3, { f0: 500 }); break;
      case 'talk': this.osc('sine', 600, 700, t, 0.08, 0.05); break;
      case 'blip': { const v = k || 0; this.osc('triangle', 300 + v * 80 + R(0, 60), 300 + v * 80, t, 0.04, 0.04); break; }
      case 'tick': this.osc('sine', 1200, 1200, t, 0.03, 0.06); break;
      case 'menuOpen': this.osc('sine', 400, 600, t, 0.15, 0.08, { rev: 0.4 }); break;
      case 'menuClose': this.osc('sine', 600, 400, t, 0.15, 0.08, { rev: 0.4 }); break;
      case 'confirm': this.osc('triangle', 660, 660, t, 0.1, 0.1); this.osc('triangle', 990, 990, t + 0.06, 0.12, 0.08); break;
      case 'deny': this.osc('square', 200, 150, t, 0.15, 0.06, { lp: 800 }); break;
      case 'buy': [76, 84].forEach((m, i) => this.osc('sine', mtof(m), mtof(m), t + i * 0.06, 0.2, 0.1)); break;
      case 'charge': this.noise(t, 0.25, 0.15, { f0: 400, f1: 900 }); break;
      case 'leap': this.osc('sine', 200, 500, t, 0.2, 0.1); break;
      case 'screech': this.osc('sawtooth', 1200, 700, t, 0.3, 0.06, { lp: 3000 }); break;
      case 'spit': this.noise(t, 0.15, 0.2, { f0: 1200, f1: 500 }); this.osc('sine', 300, 150, t, 0.1, 0.08); break;
      case 'slash': this.noise(t, 0.15, 0.2, { f0: 2500, f1: 800 }); break;
      case 'thrust': this.noise(t, 0.12, 0.2, { f0: 3000, f1: 1200 }); break;
      case 'drop': this.osc('sine', 700, 200, t, 0.25, 0.08); break;
      case 'burst': this.noise(t, 0.3, 0.3, { f0: 300, f1: 900, type: 'lowpass' }); break;
      case 'explode': this.noise(t, 0.6, 0.45, { f0: 1200, f1: 80, type: 'lowpass' }); this.osc('sine', 70, 30, t, 0.6, 0.5); break;
      case 'phase': this.osc('sine', 300, 1200, t, 0.4, 0.08, { rev: 0.8 }); break;
      case 'buzz': this.osc('sawtooth', 160, 200, t, 0.45, 0.06, { lp: 1200 }); break;
      case 'throw': this.noise(t, 0.15, 0.15, { f0: 1500, f1: 600 }); break;
      case 'whip': this.noise(t, 0.15, 0.25, { f0: 4000, f1: 900 }); break;
      case 'rustle': this.noise(t, 0.3, 0.1, { f0: 3000, q: 0.5 }); break;
      case 'parry': this.osc('triangle', 1500, 2500, t, 0.25, 0.2, { rev: 0.5 }); this.noise(t, 0.1, 0.3, { f0: 5000 }); break;
      case 'glassHit': this.osc('sine', 2600, 2400, t, 0.3, 0.1, { rev: 0.5 }); break;
      case 'beadling': [72, 76, 79, 84, 88].forEach((m, i) => this.osc('sine', mtof(m), mtof(m), t + i * 0.07, 0.3, 0.08, { rev: 0.5 })); break;
      case 'tangleHit': this.osc('sawtooth', 200, 120, t, 0.2, 0.08, { lp: 900 }); break;
      case 'tangleFree': [60, 63, 67, 72].forEach((m, i) => this.osc('triangle', mtof(m), mtof(m), t + i * 0.08, 0.5, 0.08, { rev: 0.6 })); break;
      case 'potBreak': this.noise(t, 0.2, 0.25, { f0: 1500 }); this.osc('triangle', 900, 400, t, 0.1, 0.06); break;
      case 'bossRoar':
        this.osc('sawtooth', 110, 70, t, 1.2, 0.25, { lp: 700, rev: 0.6 });
        this.osc('sawtooth', 165, 100, t, 1.2, 0.15, { lp: 900, rev: 0.6 });
        this.noise(t, 1.2, 0.3, { f0: 500, f1: 200, q: 0.6, rev: 0.5 }); break;
      case 'bossHit': this.osc('square', 150, 60, t, 0.12, 0.14, { lp: 1200 }); this.noise(t, 0.12, 0.25, { f0: 700 }); this.osc('sine', 70, 40, t, 0.15, 0.3); break;
      case 'bossDie':
        this.noise(t, 2.5, 0.5, { f0: 2000, f1: 60, type: 'lowpass', rev: 0.8 });
        this.osc('sine', 120, 25, t, 2.5, 0.5); break;
      case 'slam': this.osc('sine', 100, 35, t, 0.45, 0.5); this.noise(t, 0.35, 0.4, { f0: 600, type: 'lowpass' }); break;
      case 'laser': this.osc('sawtooth', 900, 1100, t, 0.6, 0.06, { lp: 4000 }); this.noise(t, 0.6, 0.1, { f0: 6000, type: 'highpass' }); break;
      case 'warn': this.osc('square', 880, 880, t, 0.08, 0.05, { lp: 2000 }); this.osc('square', 880, 880, t + 0.12, 0.08, 0.05, { lp: 2000 }); break;
      case 'bell': e.note('bell', 55 + Math.floor(R(0, 3)) * 5, t, 2, 0.8, e.sfxBus, { vol: 0.3, rev: 0.7 }); break;
      case 'splash': this.noise(t, 0.4, 0.25, { f0: 1200, f1: 300, type: 'lowpass' }); break;
      default: break;
    }
  }
}
