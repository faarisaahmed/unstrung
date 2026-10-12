// Enemy registry: merges every area's enemy list into one id -> def map.
// Files load independently so one broken file can't take down the rest.
const AREAS = ['fray', 'town', 'hollows', 'gardens', 'catacombs', 'hushwood', 'bastion', 'cistern', 'kilns', 'mirror', 'bellfry', 'archive', 'warrens', 'frost', 'loom', 'cradle', 'unwoven', 'dunes'];
const lists = await Promise.all(AREAS.map((a) => import(`./${a}.js`)
  .then((m) => m.default || [])
  .catch((e) => { console.error('Enemy file failed:', a, e); return []; })));
export const ENEMY_LIST = lists.flat();
export const ENEMIES = Object.fromEntries(ENEMY_LIST.map((e) => [e.id, e]));
