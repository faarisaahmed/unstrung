// Abilities the player is guaranteed to have when first entering each area (by the intended
// progression). Rooms are validated with this set unless they declare their own `req: [...]`.
const T0 = [];
const T1 = ['sap'];
const T2 = ['sap', 'dash'];
const T3 = [...T2, 'glide', 'shard', 'lantern'];
const T4 = [...T3, 'magnet'];
const T5 = [...T4, 'shell'];
const T6 = [...T5, 'pound'];
const T7 = [...T6, 'comet'];
const T8 = [...T7, 'dbljump', 'shrink'];
const T9 = [...T8, 'hook'];
const ALL = [...T9, 'unravel'];

export const AREA_REQ = {
  fray: T0, town: T0, hollows: T0,
  gardens: T1, catacombs: T1,
  hushwood: T2,
  bastion: [...T2, 'glide'],
  cistern: [...T2, 'glide'],
  kilns: T5,
  mirror: T6,
  bellfry: T7, archive: T7,
  warrens: T8,
  frost: T9,
  loom: ALL, cradle: ALL, unwoven: ALL, dunes: ALL, echoes: ALL,
};
export const TIERS = { T0, T1, T2, T3, T4, T5, T6, T7, T8, T9, ALL };
