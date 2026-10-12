// Web Audio synth engine: buses, reverb, instruments. All sound is generated, no samples.
export const NOTE_NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteToMidi(n) {
  // "C4", "Eb3", "F#5"
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
  if (!m) return null;
  let v = NOTE_NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return v + (Number(m[3]) + 1) * 12;
}
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.ksCache = new Map();
    this.settings = { master: 0.8, music: 0.7, sfx: 0.85 };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem('unstrung_audio') || '{}')); } catch { /* */ }
  }

  // Must be called from a user gesture
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    // reverb send
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(3.2, 2.6);
    this.revGain = ctx.createGain(); this.revGain.gain.value = 0.55;
    this.reverb.connect(this.revGain); this.revGain.connect(this.master);
    // a dark echo for melodic delay sends
    this.delay = ctx.createDelay(1.5); this.delay.delayTime.value = 0.36;
    this.delayFb = ctx.createGain(); this.delayFb.gain.value = 0.32;
    this.delayLp = ctx.createBiquadFilter(); this.delayLp.type = 'lowpass'; this.delayLp.frequency.value = 2400;
    this.delay.connect(this.delayLp); this.delayLp.connect(this.delayFb); this.delayFb.connect(this.delay);
    this.delayOut = ctx.createGain(); this.delayOut.gain.value = 0.4;
    this.delayLp.connect(this.delayOut); this.delayOut.connect(this.master);
    this.delayOut.connect(this.reverb);
    this.noiseBuf = this.makeNoise(2);
    this.applySettings();
    this.ready = true;
  }

  applySettings() {
    if (!this.ctx) return;
    this.master.gain.value = this.settings.master;
    this.musicBus.gain.value = this.settings.music;
    this.sfxBus.gain.value = this.settings.sfx;
    try { localStorage.setItem('unstrung_audio', JSON.stringify(this.settings)); } catch { /* */ }
  }

  makeImpulse(seconds, decay) {
    const ctx = this.ctx, rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // early reflections + diffuse tail with gentle high damping
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < rate * 0.02 ? 0.3 : 1);
      }
      // simple one-pole lowpass to darken the tail
      let y = 0;
      for (let i = 0; i < len; i++) { y += (d[i] - y) * (0.25 + 0.6 * (1 - i / len)); d[i] = y; }
    }
    return buf;
  }

  makeNoise(seconds) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Karplus-Strong plucked string buffer, cached per midi note + brightness
  ksBuffer(midi, bright = 0.5, seconds = 2.2) {
    const key = midi + ':' + bright;
    if (this.ksCache.has(key)) return this.ksCache.get(key);
    const ctx = this.ctx, rate = ctx.sampleRate;
    const f = mtof(midi);
    const N = Math.max(2, Math.round(rate / f));
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * bright);
    // pre-filter the excitation for a softer pluck
    for (let k = 0; k < 2 - Math.round(bright * 2); k++) for (let i = 1; i < N; i++) ring[i] = (ring[i] + ring[i - 1]) * 0.5;
    const damp = 0.996 - (midi > 72 ? (midi - 72) * 0.0006 : 0);
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const a = ring[idx], b = ring[(idx + 1) % N];
      const v = (a + b) * 0.5 * damp;
      d[i] = a;
      ring[idx] = v;
      idx = (idx + 1) % N;
    }
    this.ksCache.set(key, buf);
    return buf;
  }

  env(g, t, a, d, s, r, dur, peak = 1) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * s, t + a, d / 3);
    const end = t + Math.max(dur, a);
    g.gain.setTargetAtTime(0.0001, end, r / 4);
    return end + r;
  }

  // Generic voice output: gain -> (bus) and sends
  out(node, bus, rev = 0.3, dly = 0, pan = 0) {
    const ctx = this.ctx;
    let n = node;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; n.connect(p); n = p; }
    n.connect(bus);
    if (rev > 0) { const s = ctx.createGain(); s.gain.value = rev; n.connect(s); s.connect(this.reverb); }
    if (dly > 0) { const s = ctx.createGain(); s.gain.value = dly; n.connect(s); s.connect(this.delay); }
  }

  // ---- Instruments ----
  // opts: {vol, rev, dly, pan, bright, cutoff, detune}
  note(type, midi, t, dur, vel = 1, bus, o = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const f = mtof(midi);
    const vol = (o.vol ?? 0.5) * vel;
    const g = ctx.createGain();
    let stopAt;
    switch (type) {
      case 'harp': case 'pluck': case 'guitar': {
        const src = ctx.createBufferSource();
        src.buffer = this.ksBuffer(midi, type === 'guitar' ? 0.2 : o.bright ?? 0.6, type === 'guitar' ? 1.6 : 2.4);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.cutoff || (type === 'guitar' ? 2600 : 5200);
        src.connect(lp); lp.connect(g);
        g.gain.setValueAtTime(vol * 1.2, t);
        const len = Math.max(dur + 0.6, type === 'harp' ? 2.2 : 1.4);
        g.gain.setTargetAtTime(0.0001, t + len * 0.7, 0.2);
        src.start(t); src.stop(t + len + 0.5);
        stopAt = t + len + 0.5;
        break;
      }
      case 'piano': case 'epiano': {
        // felt-piano: sine + soft 2nd partial, FM shimmer, fast-decaying hammer
        const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain();
        o1.frequency.value = f; o2.frequency.value = f * 2.001; m.frequency.value = f * (type === 'epiano' ? 1 : 3.999);
        mg.gain.setValueAtTime(f * (type === 'epiano' ? 1.6 : 0.7), t); mg.gain.exponentialRampToValueAtTime(f * 0.02, t + 0.8);
        m.connect(mg); mg.connect(o1.frequency);
        const g2 = ctx.createGain(); g2.gain.value = 0.18;
        o2.connect(g2); g2.connect(g); o1.connect(g);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.cutoff || 3200;
        const outG = ctx.createGain(); g.connect(lp); lp.connect(outG);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006);
        g.gain.setTargetAtTime(vol * 0.25, t + 0.01, 0.35);
        g.gain.setTargetAtTime(0.0001, t + Math.max(dur, 0.1), 0.18);
        const end = t + Math.max(dur, 0.1) + 1.2;
        for (const osc of [o1, o2, m]) { osc.start(t); osc.stop(end); }
        this.out(outG, bus, o.rev ?? 0.35, o.dly ?? 0, o.pan || 0);
        return end;
      }
      case 'bell': case 'celesta': {
        const ratio = type === 'bell' ? 3.5 : 4;
        const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain();
        c.frequency.value = f; m.frequency.value = f * ratio;
        mg.gain.setValueAtTime(f * (type === 'bell' ? 2.2 : 0.8), t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 1.6);
        m.connect(mg); mg.connect(c.frequency); c.connect(g);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * 0.8, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (type === 'bell' ? 3.2 : 1.4));
        const end = t + (type === 'bell' ? 3.3 : 1.5);
        c.start(t); m.start(t); c.stop(end); m.stop(end);
        stopAt = end;
        break;
      }
      case 'pad': case 'strings': case 'choir': case 'organ': {
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.value = o.cutoff || (type === 'choir' ? 1400 : type === 'strings' ? 2600 : 1800);
        lp.Q.value = type === 'choir' ? 4 : 0.7;
        const voices = type === 'organ' ? [1, 2, 4] : [-(o.detune ?? 7), 0, o.detune ?? 7];
        const oscs = [];
        voices.forEach((d, i) => {
          const osc = ctx.createOscillator();
          osc.type = type === 'organ' ? 'sine' : type === 'choir' ? 'sawtooth' : 'sawtooth';
          if (type === 'organ') osc.frequency.value = f * d; else { osc.frequency.value = f; osc.detune.value = d; }
          if (type === 'strings' || type === 'choir') {
            const lfo = ctx.createOscillator(), lg = ctx.createGain();
            lfo.frequency.value = 5 + i * 0.3; lg.gain.value = type === 'choir' ? 6 : 4;
            lfo.connect(lg); lg.connect(osc.detune); oscs.push(lfo);
          }
          const vg = ctx.createGain(); vg.gain.value = type === 'organ' ? [0.6, 0.25, 0.12][i] : 0.33;
          osc.connect(vg); vg.connect(lp); oscs.push(osc);
        });
        let chain = lp;
        if (type === 'choir') {
          // second formant
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 2;
          lp.connect(bp); const mixg = ctx.createGain(); mixg.gain.value = 1.4; bp.connect(mixg); chain = mixg;
        }
        chain.connect(g);
        const atk = o.attack ?? (type === 'pad' ? 0.6 : type === 'organ' ? 0.02 : 0.18);
        const rel = o.release ?? (type === 'pad' ? 1.2 : 0.5);
        const end = this.env(g, t, atk, 0.4, 0.85, rel, dur, vol * 0.5);
        for (const osc of oscs) { osc.start(t); osc.stop(end + 0.2); }
        stopAt = end;
        break;
      }
      case 'bass': case 'subbass': {
        const osc = ctx.createOscillator(); osc.type = type === 'subbass' ? 'sine' : 'triangle';
        osc.frequency.value = f;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.cutoff || 900;
        osc.connect(lp); lp.connect(g);
        const end = this.env(g, t, 0.008, 0.2, 0.7, 0.12, dur, vol);
        osc.start(t); osc.stop(end + 0.1);
        stopAt = end;
        this.out(g, bus, o.rev ?? 0.05, 0, o.pan || 0);
        return end;
      }
      case 'lead': case 'square': case 'saw': {
        const osc = ctx.createOscillator(); osc.type = type === 'lead' ? 'triangle' : type;
        osc.frequency.value = f;
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + 0.4);
        lfo.connect(lg); lg.connect(osc.frequency);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.cutoff || 2600;
        osc.connect(lp); lp.connect(g);
        const end = this.env(g, t, 0.02, 0.2, 0.75, 0.15, dur, vol * (type === 'lead' ? 0.9 : 0.35));
        osc.start(t); lfo.start(t); osc.stop(end + 0.1); lfo.stop(end + 0.1);
        stopAt = end;
        break;
      }
      case 'flute': case 'ocarina': {
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f;
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.01, t + 0.35);
        lfo.connect(lg); lg.connect(osc.frequency);
        osc.connect(g);
        if (type === 'flute') {
          const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 3;
          const ng = ctx.createGain(); ng.gain.value = 0.08;
          n.connect(bp); bp.connect(ng); ng.connect(g); n.start(t, Math.random()); n.stop(t + dur + 0.4);
        } else {
          const o3 = ctx.createOscillator(); o3.frequency.value = f * 3; const g3 = ctx.createGain(); g3.gain.value = 0.05; o3.connect(g3); g3.connect(g); o3.start(t); o3.stop(t + dur + 0.4);
        }
        const end = this.env(g, t, 0.05, 0.2, 0.8, 0.2, dur, vol);
        osc.start(t); lfo.start(t); osc.stop(end + 0.1); lfo.stop(end + 0.1);
        stopAt = end;
        break;
      }
      case 'marimba': case 'kalimba': {
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f;
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * (type === 'marimba' ? 4 : 5.4);
        const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.25, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        o2.connect(g2); g2.connect(g); osc.connect(g);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (type === 'marimba' ? 0.7 : 1.2));
        const end = t + 1.3;
        osc.start(t); o2.start(t); osc.stop(end); o2.stop(end);
        stopAt = end;
        break;
      }
      default: return;
    }
    this.out(g, bus, o.rev ?? 0.3, o.dly ?? 0, o.pan || 0);
    return stopAt;
  }

  // ---- Drums ----
  drum(kind, t, vel = 1, bus, o = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const vol = (o.vol ?? 0.6) * vel;
    const g = ctx.createGain();
    switch (kind) {
      case 'k': { // kick
        const osc = ctx.createOscillator(); osc.type = 'sine';
        osc.frequency.setValueAtTime(130, t); osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        g.gain.setValueAtTime(vol * 1.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(g); osc.start(t); osc.stop(t + 0.4);
        break;
      }
      case 's': case 'c': { // snare / clap
        const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
        const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = kind === 'c' ? 1500 : 1800; hp.Q.value = 0.8;
        n.connect(hp); hp.connect(g);
        g.gain.setValueAtTime(vol * 0.8, t); g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'c' ? 0.15 : 0.2));
        n.start(t, Math.random()); n.stop(t + 0.25);
        if (kind === 's') {
          const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(220, t); osc.frequency.exponentialRampToValueAtTime(140, t + 0.08);
          const og = ctx.createGain(); og.gain.setValueAtTime(vol * 0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
          osc.connect(og); og.connect(g); osc.start(t); osc.stop(t + 0.12);
        }
        break;
      }
      case 'h': case 'o': case 'x': { // closed hat / open hat / shaker
        const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = kind === 'x' ? 5000 : 7000;
        n.connect(hp); hp.connect(g);
        const len = kind === 'o' ? 0.25 : kind === 'x' ? 0.06 : 0.04;
        g.gain.setValueAtTime(vol * (kind === 'x' ? 0.25 : 0.35), t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
        n.start(t, Math.random()); n.stop(t + len + 0.02);
        break;
      }
      case 't': case 'T': { // tom low/high
        const osc = ctx.createOscillator();
        const f0 = kind === 't' ? 110 : 170;
        osc.frequency.setValueAtTime(f0, t); osc.frequency.exponentialRampToValueAtTime(f0 * 0.6, t + 0.25);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(g); osc.start(t); osc.stop(t + 0.4);
        break;
      }
      case 'r': { // rim / wood tick
        const osc = ctx.createOscillator(); osc.type = 'square'; osc.frequency.value = 900;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 6;
        osc.connect(bp); bp.connect(g);
        g.gain.setValueAtTime(vol * 0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        osc.start(t); osc.stop(t + 0.06);
        break;
      }
      case 'b': { // deep taiko boom
        const osc = ctx.createOscillator();
        osc.frequency.setValueAtTime(90, t); osc.frequency.exponentialRampToValueAtTime(38, t + 0.4);
        const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
        const ng = ctx.createGain(); ng.gain.setValueAtTime(vol * 0.6, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        n.connect(lp); lp.connect(ng); ng.connect(g); n.start(t, Math.random()); n.stop(t + 0.35);
        g.gain.setValueAtTime(vol * 1.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        osc.connect(g); osc.start(t); osc.stop(t + 0.85);
        break;
      }
      default: return;
    }
    this.out(g, bus, o.rev ?? 0.15, 0, o.pan || 0);
  }
}
