// Collectible item types and how they are granted.
import { KNOTS } from './knots.js';
import { ABILITY_INFO } from './abilities.js';

export const ITEMS = {
  ring: { name: 'Gilded Ring', color: '#ffe7a8' },
  bearing: { name: 'Brass Bearing', color: '#ffd29a' },
  marble: { name: 'Glass Marble', color: '#cfe8ff' },
  shellFrag: { name: 'Glass Marble', color: '#cfe8ff' },
  vesselFrag: { name: 'Glass Marble', color: '#cfe8ff' },
  knot: { name: 'Knot', color: '#ffb0b0' },
  notch: { name: 'Length of String', color: '#ffe9b0' },
  ore: { name: 'Pale Tin', color: '#d9e6ff' },
  ability: { name: 'Bead Power', color: '#ffffff' },
  greatBead: { name: 'Great Bead', color: '#e8f0ff' },
  key: { name: 'Key', color: '#ffe08a' },
  relic: { name: 'Relic', color: '#ffe08a' },
  map: { name: 'Map', color: '#f0e0c0' },
  glints: { name: 'Glints', color: '#fff0c0' },
};

export const KEY_ITEMS = {
  lantern: { name: 'Glowwick Lantern', desc: 'A wick that never quite goes out. Lights the dark.' },
  ferryPass: { name: 'Ferry Pass', desc: 'A moth-wing token. The Moth Ferries will carry you.' },
  cryptKey: { name: 'Wax Key', desc: 'A key moulded from candle wax. It opens the Sealed Ossuary.' },
  archiveKey: { name: 'Librarian\'s Seal', desc: 'The sigil of the Silken Archive.' },
  frayedKey: { name: 'Frayed Key', desc: 'A key made of nothing but loose ends. Something, somewhere, is unwoven.' },
  moonKey: { name: 'Moon Key', desc: 'Cold and pale. It fits the lock of the Cradle.' },
  voidThread: { name: 'Void Thread', desc: 'A thread that is not there. Holding it, you feel you could cut anything.' },
  tinsmithMold: { name: 'Tinsmith\'s Mold', desc: 'A delicate casting mold. The Tinsmith would want this.' },
  lintCrown: { name: 'Lint Crown', desc: 'A crown of dust and fluff. Fit for a king of nothing.' },
  echoBell: { name: 'Echo Bell', desc: 'Ring it and the defeated answer. Opens the Hall of Echoes.' },
  wishbone: { name: 'Wishbone', desc: 'An old bird\'s wishbone. The Beadmother asked for one.' },
};

// Apply an item spec {item, id?, value?} to the save + show banner.
export function grantItem(game, spec) {
  const sv = game.save;
  let title = '', desc = '';
  game.sfx('itemGet');
  switch (spec.item) {
    case 'ring': {
      sv.rings = (sv.rings || 0) + 1;
      title = 'Gilded Ring';
      desc = 'A ring of gold leaf settles around Bead like a halo.\nOne more Coat of lacquer. (+1 Coat)';
      game.refreshStats(); sv.hp = sv.maxHp;
      game.message = { title, desc, t: 0, dur: 4, lock: true };
      game.sfx('abilityGet');
      return;
    }
    case 'bearing': {
      sv.bearings = (sv.bearings || 0) + 1;
      title = 'Brass Bearing';
      desc = 'Bead spins truer than ever. (+50 Spin capacity)';
      game.refreshStats();
      break;
    }
    case 'marble': case 'shellFrag': case 'vesselFrag': {
      sv.marbles = (sv.marbles || 0) + 1;
      title = 'Glass Marble';
      desc = `A perfect little world, swirled inside. (${sv.marbles} of 11)\nMother Bobbin collects these in her Marble Jar.`;
      break;
    }
    case 'knot': {
      const k = KNOTS[spec.id];
      if (!sv.knots.owned.includes(spec.id)) sv.knots.owned.push(spec.id);
      title = k ? k.name : spec.id;
      desc = k ? k.desc + '\nEquip Knots while resting at a Spindle.' : '';
      break;
    }
    case 'notch': sv.notches++; title = 'Length of String'; desc = 'Bead\'s thread grows longer. Room for more Knots.'; break;
    case 'ore': sv.items.ore = (sv.items.ore || 0) + 1; title = 'Pale Tin'; desc = 'A rare metal. The Tinsmith can polish your shell with it.'; break;
    case 'ability': {
      sv.abilities[spec.id] = true;
      const a = ABILITY_INFO[spec.id] || { name: spec.id, desc: '' };
      title = a.name; desc = a.desc;
      game.refreshStats();
      game.message = { title, desc, t: 0, dur: 5, lock: true, ability: true };
      game.sfx('abilityGet');
      return;
    }
    case 'greatBead': {
      sv.greatBeads++;
      sv.items['greatBead_' + spec.id] = 1;
      title = 'Great Bead'; desc = `One of the Moon's six Great Beads. (${sv.greatBeads} of 6)`;
      game.message = { title, desc, t: 0, dur: 4.5, lock: true };
      return;
    }
    case 'key': case 'relic': {
      sv.items[spec.id] = 1;
      const k = KEY_ITEMS[spec.id] || { name: spec.id, desc: '' };
      title = k.name; desc = k.desc;
      break;
    }
    case 'map': sv.maps[spec.id] = 1; title = 'Map of ' + (spec.name || spec.id); desc = 'Open the map with Tab or M.'; break;
    case 'glints': sv.glints += spec.value || 50; title = `${spec.value || 50} Glints`; break;
    default: title = spec.item;
  }
  game.message = { title, desc, t: 0, dur: desc ? 3.5 : 2 };
}
