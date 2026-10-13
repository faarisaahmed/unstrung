// Save data model + localStorage persistence (3 slots).
const KEY = (slot) => `unstrung_slot_${slot}`;

export function newSave(slot, opts = {}) {
  return {
    version: 1, slot, playTime: 0, created: Date.now(),
    room: null, spindle: null, // {room, marker}
    hp: 4, maxHp: 4, thread: 0, maxThread: 100, glints: 0,  // hp = Coats of lacquer, thread = Spin
    abilities: {}, items: {}, knots: { owned: [], equipped: [] }, notches: 3,
    rings: 0, bearings: 0, marbles: 0, polish: 0, beadlings: 0, greatBeads: 0,
    flags: {}, broken: {}, visited: {}, maps: {}, pins: {},
    kills: {}, seenEnemies: {}, lore: {}, tangle: null, deaths: 0,
    ferries: {}, techniques: {}, echoes: {},
    brittle: !!opts.brittle, dead: false, endings: {},
  };
}

export function loadSave(slot) {
  try {
    const raw = localStorage.getItem(KEY(slot));
    if (!raw) return null;
    const s = JSON.parse(raw);
    return Object.assign(newSave(slot), s);
  } catch { return null; }
}

export function writeSave(save) {
  try { localStorage.setItem(KEY(save.slot), JSON.stringify(save)); return true; } catch { return false; }
}

export function deleteSave(slot) {
  try { localStorage.removeItem(KEY(slot)); } catch { /* ignore */ }
}

export function completion(save, totals) {
  // weighted completion % (can exceed 100 with endgame like HK's 112%)
  let pct = 0;
  const ab = Object.keys(save.abilities).length;
  pct += ab * 2;                                     // 13 abilities -> 26
  pct += (save.rings || 0);                           // 6 Gilded Rings
  pct += (save.bearings || 0);                        // 3 Bearings
  pct += Math.floor((save.marbles || 0) / 2);         // 11 Glass Marbles -> 5
  pct += save.knots.owned.length;                    // 40
  pct += save.notches - 3;                           // 8
  pct += save.polish;                                // 4
  pct += Object.keys(save.techniques).length;        // 3
  pct += Object.keys(save.flags).filter((f) => f.startsWith('boss_')).length * 0.5; // ~16
  pct += Object.keys(save.echoes).length * 0.25;     // ~8
  pct += save.endings.A ? 1 : 0;
  return Math.round(pct);
}
