// Enemy registry: merges every area's enemy list into one id -> def map.
import fray from './fray.js';
import town from './town.js';
import hollows from './hollows.js';
import gardens from './gardens.js';
import catacombs from './catacombs.js';
import hushwood from './hushwood.js';
import bastion from './bastion.js';
import cistern from './cistern.js';
import kilns from './kilns.js';
import mirror from './mirror.js';
import bellfry from './bellfry.js';
import archive from './archive.js';
import warrens from './warrens.js';
import frost from './frost.js';
import loom from './loom.js';
import cradle from './cradle.js';
import unwoven from './unwoven.js';
import dunes from './dunes.js';

export const ENEMY_LIST = [...fray, ...town, ...hollows, ...gardens, ...catacombs, ...hushwood, ...bastion, ...cistern, ...kilns, ...mirror, ...bellfry, ...archive, ...warrens, ...frost, ...loom, ...cradle, ...unwoven, ...dunes];
export const ENEMIES = Object.fromEntries(ENEMY_LIST.map((e) => [e.id, e]));
