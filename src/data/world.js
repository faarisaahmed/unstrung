// World registry: areas + every room def, keyed by id.
import fray from './rooms/fray.js';
import town from './rooms/town.js';
import hollows from './rooms/hollows.js';
import gardens from './rooms/gardens.js';
import catacombs from './rooms/catacombs.js';
import hushwood from './rooms/hushwood.js';
import bastion from './rooms/bastion.js';
import cistern from './rooms/cistern.js';
import kilns from './rooms/kilns.js';
import mirror from './rooms/mirror.js';
import bellfry from './rooms/bellfry.js';
import archive from './rooms/archive.js';
import warrens from './rooms/warrens.js';
import frost from './rooms/frost.js';
import loom from './rooms/loom.js';
import cradle from './rooms/cradle.js';
import unwoven from './rooms/unwoven.js';
import dunes from './rooms/dunes.js';
import echoes from './rooms/echoes.js';
import test from './rooms/test.js';

export const AREAS = {
  fray: { name: 'The Fray', sub: 'Where the strand snapped', music: 'fray' },
  hollows: { name: 'Mossbell Hollows', sub: 'Caverns of the old bells', music: 'hollows' },
  town: { name: 'Spindletown', sub: 'Last lamps above the dark', music: 'town' },
  gardens: { name: 'Glasswing Gardens', sub: 'The greenhouse of the moths', music: 'gardens' },
  catacombs: { name: 'Tallow Catacombs', sub: 'Where the wax remembers', music: 'catacombs' },
  hushwood: { name: 'Hushwood', sub: 'Speak softly', music: 'hushwood' },
  bastion: { name: 'Cogwork Bastion', sub: 'The engine that guards nothing', music: 'bastion' },
  cistern: { name: 'Brine Cistern', sub: 'The drowned reservoir', music: 'cistern' },
  kilns: { name: 'Ashen Kilns', sub: 'The glassmakers\' furnace', music: 'kilns' },
  mirror: { name: 'Mirrored Deep', sub: 'Every bead, twice', music: 'mirror' },
  bellfry: { name: 'Bellfry Heights', sub: 'Above the clouds, the bells', music: 'bellfry' },
  archive: { name: 'Silken Archive', sub: 'All that was woven is kept', music: 'archive' },
  warrens: { name: 'Rotgut Warrens', sub: 'The hive beneath', music: 'warrens' },
  frost: { name: 'Frostlit Reliquary', sub: 'The cold shrine', music: 'frost' },
  loom: { name: 'The Loom Below', sub: 'Where the world was woven', music: 'loom' },
  cradle: { name: 'Moon\'s Cradle', sub: 'The way up', music: 'cradle' },
  unwoven: { name: 'The Unwoven', sub: '', music: 'unwoven' },
  dunes: { name: 'Dustmote Dunes', sub: 'The kingdom of fluff', music: 'dunes' },
  echoes: { name: 'Hall of Echoes', sub: 'They answer', music: 'echoes' },
};

const ALL = [...fray, ...town, ...hollows, ...gardens, ...catacombs, ...hushwood, ...bastion, ...cistern, ...kilns, ...mirror, ...bellfry, ...archive, ...warrens, ...frost, ...loom, ...cradle, ...unwoven, ...dunes, ...echoes, ...test];

export const ROOMS = Object.fromEntries(ALL.map((r) => [r.id, r]));
// The game starts in the Fray. (Falls back to the engine test room until the Fray exists.)
export const START_ROOM = ROOMS.fray_cradle ? 'fray_cradle' : 'test_a';
