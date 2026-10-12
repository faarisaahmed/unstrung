// Entity factory: turns room legend specs into live entities.
import { Enemy } from './enemy.js';
import { Projectile } from './projectile.js';
import { Glint, ItemPickup, spawnGlints } from './pickups.js';
import { Spindle, Lever, Gate, LoreTablet, NPC, Beadling, Tangle, Pot, Ferry, Deco, Trigger, Statue, PantheonDoor } from './props.js';
import { ENEMIES } from '../data/enemies/index.js';
import { BOSSES } from '../bosses/index.js';
import { TILE } from '../core/constants.js';

export { Projectile, spawnGlints, Glint };

// marker: {ch, tx, ty, spec}
export function spawnEntity(game, m) {
  const s = m.spec;
  const key = `${game.room.id}:${m.ch}${m.tx},${m.ty}`;
  if (s.ifFlag && !game.save.flags[s.ifFlag]) return null;
  if (s.unlessFlag && game.save.flags[s.unlessFlag]) return null;
  switch (s.e) {
    case 'enemy': {
      const def = ENEMIES[s.id];
      if (!def) { console.warn('Unknown enemy', s.id, 'in', game.room.id); return null; }
      return new Enemy(game, m.tx, m.ty, def, s);
    }
    case 'boss': {
      const B = BOSSES[s.id];
      if (!B) { console.warn('Unknown boss', s.id); return null; }
      return new B(game, m.tx, m.ty, s);
    }
    case 'spindle': return new Spindle(game, m.tx, m.ty, m.ch);
    case 'lever': return new Lever(game, m.tx, m.ty, s);
    case 'gate': return new Gate(game, m.tx, m.ty, s);
    case 'lore': return new LoreTablet(game, m.tx, m.ty, s);
    case 'npc': return new NPC(game, m.tx, m.ty, s);
    case 'item': return new ItemPickup(game, m.tx, m.ty, s, s.key || key);
    case 'beadling': return new Beadling(game, m.tx, m.ty, s.key || key);
    case 'tangle': return game.save.tangle ? new Tangle(game, m.tx * TILE, m.ty * TILE) : null;
    case 'pot': return new Pot(game, m.tx, m.ty, s, s.key || key);
    case 'ferry': return new Ferry(game, m.tx, m.ty, s);
    case 'deco': return new Deco(game, m.tx, m.ty, s);
    case 'trigger': return new Trigger(game, m.tx, m.ty, s);
    case 'statue': return new Statue(game, m.tx, m.ty, s);
    case 'pantheon': return new PantheonDoor(game, m.tx, m.ty, s);
    default:
      console.warn('Unknown entity type', s.e, 'in', game.room.id);
      return null;
  }
}
