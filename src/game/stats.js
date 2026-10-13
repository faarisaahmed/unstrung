// Derive combat stats from the save (polish level, equipped knots).
import { KNOTS } from '../data/knots.js';

export function computeStats(save) {
  const s = {
    damage: 5 + save.polish * 4,
    attackCd: 0.38,
    reach: 1,
    threadGain: 8,        // Spin per Bonk hit
    rollGain: 15,         // Spin per second while rolling at speed
    mendCost: 40,         // Spin per Coat buffed back
    mendTime: 0.8,        // seconds of rolling + Focus per Coat
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
