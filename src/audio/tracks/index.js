// Track registry: id -> song definition. Sets load independently.
import title from './title.js';

const sets = await Promise.all(['set1', 'set2', 'set3'].map((n) => import(`./${n}.js`)
  .then((m) => m.default || {})
  .catch((e) => { console.error('Track set failed:', n, e); return {}; })));
export const TRACKS = Object.assign({ title }, ...sets);
