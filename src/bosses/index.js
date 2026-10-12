// Boss registry: id -> class. Each area file default-exports { bossId: BossClass }.
import { Gnarlknot } from './fray.js';

const AREAS = ['town', 'hollows', 'gardens', 'catacombs', 'hushwood', 'bastion', 'cistern', 'kilns', 'mirror', 'bellfry', 'archive', 'warrens', 'frost', 'loom', 'cradle', 'unwoven', 'dunes', 'echoes'];
const maps = await Promise.all(AREAS.map((a) => import(`./${a}.js`)
  .then((m) => m.default || {})
  .catch((e) => { console.error('Boss file failed:', a, e); return {}; })));
export const BOSSES = Object.assign({ gnarlknot: Gnarlknot }, ...maps);
