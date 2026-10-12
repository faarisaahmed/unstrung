// World registry: areas + every room def, keyed by id.
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

const ALL = [...test];

export const ROOMS = Object.fromEntries(ALL.map((r) => [r.id, r]));
export const START_ROOM = 'test_a';
