// Music checker: node tools/checkmusic.js [trackId...]
// Reports invalid tokens, channel lengths, bar alignment, loop duration per track.
import { TRACKS } from '../src/audio/tracks/index.js';
import { noteToMidi } from '../src/audio/engine.js';

const want = process.argv.slice(2);
const DRUMS = new Set(['k', 's', 'c', 'h', 'o', 'x', 't', 'T', 'r', 'b']);
const TYPES = new Set(['harp', 'pluck', 'guitar', 'piano', 'epiano', 'bell', 'celesta', 'marimba', 'kalimba', 'pad', 'strings', 'choir', 'organ', 'bass', 'subbass', 'lead', 'square', 'saw', 'flute', 'ocarina', 'drums']);
let problems = 0;
for (const [id, song] of Object.entries(TRACKS)) {
  if (want.length && !want.includes(id)) continue;
  const out = [];
  if (!song.bpm || !song.inst || !song.pat || !song.seq) { out.push('missing bpm/inst/pat/seq'); }
  for (const [n, d] of Object.entries(song.inst || {})) if (!TYPES.has(d.type)) out.push(`inst ${n}: unknown type '${d.type}'`);
  let totalSteps = 0;
  const patLen = {};
  for (const [pn, pat] of Object.entries(song.pat || {})) {
    let len = 0;
    for (const [ch, str] of Object.entries(pat)) {
      const def = song.inst[ch];
      if (!def) { out.push(`pattern ${pn}: channel '${ch}' not in inst`); continue; }
      const toks = str.replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean);
      len = Math.max(len, toks.length);
      toks.forEach((tok, i) => {
        if (tok === '-' || tok === '.') return;
        const t = tok.replace(/[!?]$/, '');
        for (const p of t.split('+')) {
          if (def.type === 'drums' ? !DRUMS.has(p) : noteToMidi(p) === null) out.push(`pattern ${pn}.${ch} step ${i}: bad token '${tok}'`);
        }
      });
      if (toks.length % 4) out.push(`pattern ${pn}.${ch}: ${toks.length} steps (not a multiple of 4)`);
    }
    for (const [ch, str] of Object.entries(pat)) {
      const n = str.replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean).length;
      if (len % n) out.push(`pattern ${pn}.${ch}: ${n} steps doesn't divide pattern length ${len} (it will loop unevenly)`);
    }
    patLen[pn] = len;
  }
  for (const pn of song.seq || []) { if (!(pn in patLen)) out.push(`seq references missing pattern '${pn}'`); else totalSteps += patLen[pn]; }
  const loopSteps = (song.seq || []).slice(song.loop ?? 0).reduce((s, pn) => s + (patLen[pn] || 0), 0);
  const sec = (st) => (st * 60 / song.bpm / 4).toFixed(0);
  console.log(`${id.padEnd(18)} ${String(song.bpm).padStart(3)} bpm  total ${sec(totalSteps)}s  loop ${sec(loopSteps)}s  ${out.length ? '\x1b[31m' + out.length + ' problems\x1b[0m' : 'ok'}`);
  for (const o of out.slice(0, 15)) console.log('   - ' + o);
  problems += out.length;
}
process.exit(problems ? 1 : 0);
