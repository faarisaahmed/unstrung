// Enemy registry: merges every area's enemy list into one id -> def map.
import fray from './fray.js';

export const ENEMY_LIST = [...fray];
export const ENEMIES = Object.fromEntries(ENEMY_LIST.map((e) => [e.id, e]));
