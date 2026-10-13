// Offline-renders the first N seconds of tracks through the real synth and reports levels.
// usage: node tools/rendermusic.js [trackId...] [--secs 20]
import puppeteer from 'puppeteer-core';
const args = process.argv.slice(2);
const si = args.indexOf('--secs');
const secs = si >= 0 ? Number(args[si + 1]) : 16;
const ids = args.filter((a, i) => !a.startsWith('--') && i !== si + 1);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const page = await browser.newPage();
await page.goto('http://localhost:8080/tools/blank.html', { timeout: 120000 }).catch(() => {});
const res = await page.evaluate(async (ids, secs) => {
  const { AudioEngine } = await import('/src/audio/engine.js');
  const { compile } = await import('/src/audio/music.js');
  const { TRACKS } = await import('/src/audio/tracks/index.js');
  const out = [];
  for (const id of (ids.length ? ids : Object.keys(TRACKS))) {
    const song = TRACKS[id];
    const rate = 22050;
    const ctx = new OfflineAudioContext(2, rate * secs, rate);
    const e = new AudioEngine();
    // minimal init against the offline context
    e.ctx = ctx;
    e.master = ctx.createGain(); e.master.connect(ctx.destination); e.master.gain.value = 0.8;
    e.musicBus = ctx.createGain(); e.musicBus.connect(e.master);
    e.sfxBus = e.musicBus;
    e.reverb = ctx.createConvolver(); e.reverb.buffer = e.makeImpulse(2, 2.6); e.reverb.connect(e.master);
    e.delay = ctx.createDelay(1.5); e.delay.delayTime.value = 0.36; e.delay.connect(e.master);
    e.noiseBuf = e.makeNoise(2);
    const pats = compile(song);
    const spb = 60 / song.bpm / 4;
    let t = 0.05, seqIdx = 0, step = 0;
    const g = ctx.createGain(); g.gain.value = song.vol ?? 0.8; g.connect(e.musicBus);
    const perInst = {};
    while (t < secs - 0.5) {
      const pat = pats[song.seq[seqIdx]];
      if (!pat) break;
      for (const [inst, tr] of Object.entries(pat.tracks)) {
        const def = song.inst[inst];
        const local = step % tr.length;
        for (const ev of tr.events) {
          if (ev.step !== local) continue;
          perInst[inst] = (perInst[inst] || 0) + 1;
          if (def.type === 'drums') for (const d of ev.notes) e.drum(d, t, ev.vel, g, def);
          else for (const m of ev.notes) e.note(def.type, m, t, ev.len * spb * (def.legato ?? 0.95), ev.vel, g, def);
        }
      }
      t += spb; step++;
      if (step >= pat.length) { step = 0; seqIdx++; if (seqIdx >= song.seq.length) { if (song.once) break; seqIdx = song.loop ?? 0; } }
    }
    const buf = await ctx.startRendering();
    const d = buf.getChannelData(0);
    let peak = 0, sum = 0, silentWin = 0, wins = 0;
    const W = rate / 2;
    for (let i = 0; i < d.length; i += W) {
      let s = 0;
      for (let j = i; j < Math.min(d.length, i + W); j++) { const v = Math.abs(d[j]); s += v * v; if (v > peak) peak = v; }
      const rms = Math.sqrt(s / W); wins++; if (rms < 0.004) silentWin++; sum += rms;
    }
    out.push({ id, peak: +peak.toFixed(3), rms: +(sum / wins).toFixed(4), silentPct: Math.round(100 * silentWin / wins), events: perInst });
  }
  return out;
}, ids, secs);
for (const r of res) console.log(`${r.id.padEnd(16)} peak ${String(r.peak).padEnd(6)} rms ${String(r.rms).padEnd(7)} silent ${String(r.silentPct).padStart(3)}%  ${Object.entries(r.events).map(([k, v]) => k + ':' + v).join(' ')}`);
await browser.close();
