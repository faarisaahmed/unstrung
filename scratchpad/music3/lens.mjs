import set from '../../src/audio/tracks/set3.js';
import { noteToMidi } from '../../src/audio/engine.js';
for (const [id, s] of Object.entries(set)) {
  for (const [pn, p] of Object.entries(s.pat)) {
    const L = Object.fromEntries(Object.entries(p).map(([c, v]) => [c, v.replace(/\|/g, ' ').trim().split(/\s+/).length]));
    const mx = Math.max(...Object.values(L));
    const odd = Object.entries(L).filter(([c, n]) => n !== mx);
    if (odd.length) console.log(id, pn, mx, JSON.stringify(odd));
    // range check
    for (const [c, v] of Object.entries(p)) { if (s.inst[c].type === 'drums') continue;
      const ms = v.replace(/\|/g,' ').split(/\s+/).flatMap(t=>t.replace(/[!?]$/,'').split('+')).map(noteToMidi).filter(x=>x!==null);
      if (ms.length) { const lo=Math.min(...ms), hi=Math.max(...ms); if (hi>93||lo<28) console.log('range', id, pn, c, lo, hi); } }
  }
  console.log(id, 'channels', Object.keys(s.inst).length);
}
