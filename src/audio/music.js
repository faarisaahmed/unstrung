// Step sequencer that plays song definitions (see docs/MUSIC.md for the format).
import { noteToMidi } from './engine.js';
import { TRACKS } from './tracks/index.js';

// Parse one track string into events: [{step, notes:[midi|drum], len, vel}]
function parseTrack(str, isDrum, oct = 0) {
  const toks = str.replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean);
  const events = [];
  let last = null;
  toks.forEach((tok, i) => {
    if (tok === '-') { if (last) last.len++; return; }
    if (tok === '.') { last = null; return; }
    let vel = 1;
    if (tok.endsWith('!')) { vel = 1.35; tok = tok.slice(0, -1); }
    else if (tok.endsWith('?')) { vel = 0.55; tok = tok.slice(0, -1); }
    const parts = tok.split('+');
    const notes = isDrum ? parts : parts.map((p) => noteToMidi(p)).filter((m) => m !== null).map((m) => m + oct * 12);
    const ev = { step: i, notes, len: 1, vel };
    events.push(ev);
    last = ev;
  });
  return { events, length: toks.length };
}

export function compile(song) {
  const pats = {};
  for (const [name, pat] of Object.entries(song.pat)) {
    let len = 0;
    const tracks = {};
    for (const [inst, str] of Object.entries(pat)) {
      const def = song.inst[inst];
      if (!def) continue;
      const t = parseTrack(str, def.type === 'drums', def.oct || 0);
      tracks[inst] = t;
      len = Math.max(len, t.length);
    }
    pats[name] = { tracks, length: len || song.steps || 16 };
  }
  return pats;
}

export class Music {
  constructor(engine) {
    this.e = engine;
    this.cache = {};
    this.cur = null;     // {id, song, pats, gain, seqIdx, step, nextTime}
    this.timer = null;
    this.wanted = null;
  }

  play(id, opts = {}) {
    if (!this.e.ctx) { this.wanted = id; return; }
    if (this.cur && this.cur.id === id && !this.cur.stopping) return;
    const song = TRACKS[id];
    if (!song) { if (id) console.warn('No track', id); this.stop(1); return; }
    if (!this.cache[id]) this.cache[id] = compile(song);
    const ctx = this.e.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(this.e.musicBus);
    const fadeIn = opts.fade ?? 1.2;
    gain.gain.setTargetAtTime(song.vol ?? 0.8, ctx.currentTime + 0.05, fadeIn / 3);
    this.stop(opts.fadeOut ?? 1.2);
    this.cur = {
      id, song, pats: this.cache[id], gain, seqIdx: 0, step: 0,
      nextTime: ctx.currentTime + 0.1 + (opts.delay || 0),
    };
    this.ensureTimer();
  }

  stop(fade = 1) {
    if (!this.cur) return;
    const c = this.cur;
    c.stopping = true;
    const ctx = this.e.ctx;
    c.gain.gain.cancelScheduledValues(ctx.currentTime);
    c.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, Math.max(0.05, fade / 4));
    setTimeout(() => { try { c.gain.disconnect(); } catch { /* */ } }, fade * 1000 + 3000);
    this.cur = null;
  }

  ensureTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 25);
  }

  tick() {
    const c = this.cur;
    if (!c || !this.e.ctx) return;
    const ctx = this.e.ctx;
    const song = c.song;
    const spb = 60 / song.bpm / 4; // 16th-note step
    // avoid scheduling a giant backlog after the tab was hidden
    if (c.nextTime < ctx.currentTime - 0.5) c.nextTime = ctx.currentTime + 0.05;
    while (c.nextTime < ctx.currentTime + 0.15) {
      const patName = song.seq[c.seqIdx];
      const pat = c.pats[patName];
      if (!pat) { c.seqIdx = 0; break; }
      const swing = song.swing && c.step % 2 === 1 ? spb * song.swing : 0;
      for (const [inst, tr] of Object.entries(pat.tracks)) {
        const def = song.inst[inst];
        const local = c.step % tr.length;
        for (const ev of tr.events) {
          if (ev.step !== local) continue;
          const t = c.nextTime + swing + (def.humanize ? Math.random() * 0.012 : 0);
          if (def.type === 'drums') for (const d of ev.notes) this.e.drum(d, t, ev.vel, c.gain, def);
          else {
            ev.notes.forEach((m, k) => {
              const strum = def.strum ? k * def.strum : 0;
              this.e.note(def.type, m, t + strum, ev.len * spb * (def.legato ?? 0.95), ev.vel, c.gain, def);
            });
          }
        }
      }
      c.nextTime += spb;
      c.step++;
      if (c.step >= pat.length) {
        c.step = 0;
        c.seqIdx++;
        if (c.seqIdx >= song.seq.length) {
          if (song.once) { this.stop(2); return; }
          c.seqIdx = song.loop ?? 0;
        }
      }
    }
  }
}
