// Derive combat stats from the save (polish level, equipped knots).
import { KNOTS } from '../data/knots.js';

export function computeStats(save) {
  const s = {
    damage: 5 + save.polish * 4,
    attackCd: 0.38,
    reach: 1,
    threadGain: 11,
    mendCost: 33,
    mendTime: 0.9,
    mendAmount: 1,
    spellCost: 33,
    spellMul: 1,
    invuln: 1.3,
    damageTaken: 1,
    glintMul: 1,
    speedMul: 1,
    contactDamage: 0,     // ram damage at speed (Comet / knots)
    thorns: 0,
    extraHp: 0,
    flags: {},
  };
  for (const id of save.knots.equipped) {
    const k = KNOTS[id];
    if (k && k.apply) k.apply(s, save);
  }
  return s;
}
