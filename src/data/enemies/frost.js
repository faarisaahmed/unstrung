// Enemies of area 'frost' (Frostlit Reliquary). See docs/AUTHORING.md
// Late tier: hp 50–90, dmg 1–2. Palette: ink-blue rock, rime cyan, snow white, one warm accent per creature.
export default [
  { id: 'frost_icicle', name: 'Hangfang', area: 'frost', hp: 50, dmg: 2, glints: 9, size: [20, 40],
    behavior: 'dropper', params: { range: 70, speed: 70 },
    art: { body: 'icicle', c1: '#c4efff', eye: '#1d5a86' }, weight: 2,
    journal: 'It grows from the ceiling like any icicle, a drop at a time, and waits for something warm to pass beneath. It does not mind waiting. It has been waiting since before the pilgrims came.', kills: 15 },

  { id: 'frost_wisp', name: 'Breathwisp', area: 'frost', hp: 50, dmg: 1, glints: 8, size: [26, 26],
    behavior: 'flyer', params: { speed: 120, accel: 280, sight: 380, bob: 10 },
    art: { body: 'wisp', c1: '#bff6ff', c2: '#5fc8e8', eye: '#ffffff', glow: true, centered: true }, weight: 1,
    journal: 'The last breath of a pilgrim, frozen before it could leave. It drifts toward warmth as if hoping to be breathed back in.', kills: 20 },

  { id: 'frost_pilgrim', name: 'Rimebound Pilgrim', area: 'frost', hp: 80, dmg: 2, glints: 14, size: [34, 50],
    behavior: 'lancer', params: { speed: 45, sight: 300, reach: 120, tele: 0.6 },
    art: { body: 'knight', c1: '#2b4a5e', c2: '#8fd0e8', c3: '#e8f8ff', eye: '#ffffff', weapon: 'spear', horns: 0 }, weight: 4,
    journal: 'They walked here to keep their relics cold forever, and the cold kept them instead. They still guard the niches, though they no longer remember which one is theirs.', kills: 12 },

  { id: 'frost_hopper', name: 'Drifthop', area: 'frost', hp: 50, dmg: 1, glints: 8, size: [30, 28],
    behavior: 'hopper', params: { interval: 1.1, vx: 210, vy: 700 },
    art: { body: 'hopper', c1: '#e6f6ff', c2: '#7fb8d4', eye: '#1a2c3c' }, weight: 1,
    journal: 'A snowbank with legs. It hides in the drifts with only its eyes showing and springs at anything that crunches.', kills: 20 },

  { id: 'frost_crab', name: 'Glazeback Crab', area: 'frost', hp: 70, dmg: 2, glints: 12, size: [44, 30],
    behavior: 'charger', params: { speed: 40, chargeSpeed: 420, sight: 340, tele: 0.5 },
    art: { body: 'crab', c1: '#3f8fb0', c2: '#d8f6ff', c3: '#eefcff', eye: '#ffd27a' }, weight: 5,
    journal: 'Its shell is a layer of clear ice over a layer of clear ice over something very angry. It cannot stop on the shrine floors, so it simply does not try.', kills: 15 },

  { id: 'frost_moth', name: 'Rime Moth', area: 'frost', hp: 50, dmg: 1, glints: 7, size: [24, 20],
    behavior: 'swarm', params: { speed: 180, accel: 640 },
    art: { body: 'moth', c1: '#dff4ff', c2: '#9ad8ee', eye: '#ffffff', wing: 'moth', glow: true, centered: true }, weight: 1,
    journal: 'Frost forms on its wings in the shape of the lamp it was flying toward when the shrine went cold. They flutter in loose rings around nothing at all.', kills: 25 },

  { id: 'frost_votive', name: 'Votive Lantern', area: 'frost', hp: 60, dmg: 1, glints: 12, size: [36, 40],
    behavior: 'sentinel', params: { open: 1.6, closed: 2.2, speed: 240, count: 3, spread: 0.32, color: '#bff6ff', projArt: 'shard' },
    art: { body: 'lantern', c1: '#5d7f92', c2: '#d8f6ff', c3: '#eefcff', eye: '#7fe6ff', glow: true }, weight: 99,
    journal: 'A shrine lantern rimed shut. When its shutters open, it gives no light; it sheds slivers of the cold it has been holding. Strike it while it gapes, or come down on it hard.', kills: 10 },

  { id: 'frost_yeti', name: 'Hoarfell', area: 'frost', hp: 90, dmg: 2, glints: 22, size: [64, 58],
    behavior: 'stalker', params: { speed: 165, jump: 760 },
    art: { body: 'beast', c1: '#e9f5fb', c2: '#9cc8dc', c3: '#f6fbff', eye: '#ff6a4a', glow: true }, weight: 6,
    journal: 'Shaggy, white and enormous, it keeps the shrine the way a dog keeps a house. It has eaten every pilgrim that ever tried to leave, and none that came to stay.', kills: 8 },

  { id: 'frost_spitter', name: 'Hailmouth', area: 'frost', hp: 55, dmg: 1, glints: 10, size: [34, 34],
    behavior: 'shooter', params: { interval: 1.8, speed: 300, count: 3, spread: 0.22, tele: 0.5, color: '#d8f6ff', projArt: 'shard' },
    art: { body: 'crystal', c1: '#7fd6f0', c2: '#eefcff', eye: '#1d5a86', n: 5 }, weight: 99,
    journal: 'A cluster of rime that learned to open. It coughs hail in tidy fans and never misses the same way twice.', kills: 12 },

  { id: 'frost_snail', name: 'Frostback', area: 'frost', hp: 60, dmg: 1, glints: 9, size: [32, 26],
    behavior: 'wallcrawler', params: { speed: 60 },
    art: { body: 'snail', c1: '#a9d3e4', c2: '#3c6f88', eye: '#ffffff' }, weight: 2,
    journal: 'It circles the reliquary niches one frozen inch at a time, polishing the ice with its foot. The pilgrims thought it holy. It is mostly hungry.', kills: 15 },
];
