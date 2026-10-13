// Track registry: id -> song definition. Sets load independently.
import title from './title.js';

const sets = await Promise.all(['set1', 'set2', 'set3'].map((n) => import(`./${n}.js`)
  .then((m) => m.default || {})
  .catch((e) => { console.error('Track set failed:', n, e); return {}; })));
export const TRACKS = Object.assign({ title }, ...sets);

// Loudness normalization from offline renders (node tools/rendermusic.js): keeps peaks near ~0.6.
const GAIN = { boss_keeper: 0.5, boss_mid: 0.75, boss_gnarlknot: 0.85, bastion: 0.95, kilns: 0.95 };
for (const [id, k] of Object.entries(GAIN)) if (TRACKS[id]) TRACKS[id] = Object.assign({}, TRACKS[id], { vol: (TRACKS[id].vol ?? 0.8) * k });
