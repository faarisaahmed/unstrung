// Enemies of area 'mirror' (Mirrored Deep). See docs/AUTHORING.md
// Late tier: hp 35-75, dmg 1-2. Palette: bruise-violet ink bodies, pink-white prism accents.
export default [
  {
    id: 'mirror_shardcrab', name: 'Shardcrab', area: 'mirror', hp: 40, dmg: 1, glints: 8, size: [42, 30],
    behavior: 'crawler', params: { speed: 62 },
    art: { body: 'crystal', c1: '#4a2c52', c2: '#ffc9ee', eye: '#ff7ac8', n: 4 }, weight: 2,
    journal: 'It grows its own back from the cavern walls, one facet a year. Strike the soft legs; the crystal only laughs at you.',
    kills: 20,
  },
  {
    id: 'mirror_prismeye', name: 'Prism Eye', area: 'mirror', hp: 44, dmg: 1, glints: 10, size: [38, 38],
    behavior: 'spinner', params: { rate: 1.1, speed: 165, arms: 3, interval: 0.55, sight: 440, projArt: 'shard', color: '#ffc4ec' },
    art: { body: 'eyeball', c1: '#ff7fcf', c2: '#c792c9', c3: '#fff3fb' }, weight: 99,
    journal: 'A lens that never learned to blink. It throws back every light it has ever seen, in slow, turning spokes.',
    kills: 12,
  },
  {
    id: 'mirror_shardwing', name: 'Shardwing', area: 'mirror', hp: 36, dmg: 1, glints: 8, size: [34, 28],
    behavior: 'flyshooter', params: { speed: 115, keep: 230, interval: 2.6, projSpeed: 270, count: 3, spread: 0.24, projArt: 'shard', color: '#ffe0f6' },
    art: { body: 'moth', wing: 'bat', c1: '#3a2340', c2: '#f7b8e4', c3: '#fff2fb', eye: '#ff6ac0', glow: true, centered: true },
    journal: 'Its wings are glass, and it sheds them in fans of three. Whatever it throws, it grows back by morning.',
    kills: 18,
  },
  {
    id: 'mirror_mimic', name: 'Facet Mimic', area: 'mirror', hp: 52, dmg: 2, glints: 14, size: [46, 40],
    behavior: 'mimic', params: { wake: 95, vx: 230, vy: 600, interval: 1.0, sight: 420 },
    art: { body: 'crystal', c1: '#2d1c33', c2: '#ffe3f6', eye: '#ff3f9a', n: 5 }, weight: 2,
    journal: 'It sits among the true crystals and is lovelier than any of them. That is how you know.',
    kills: 10,
  },
  {
    id: 'mirror_glitter', name: 'Glitter Mote', area: 'mirror', hp: 35, dmg: 1, glints: 4, size: [18, 18],
    behavior: 'swarm', params: { speed: 185, accel: 640, sight: 360 },
    art: { body: 'wisp', c1: '#ff9fdc', c3: '#ffffff', centered: true },
    journal: 'Dust that caught the light once and refused to let go. They gather in clouds and dazzle anything that stays still.',
    kills: 30,
  },
  {
    id: 'mirror_facetback', name: 'Facetback', area: 'mirror', hp: 64, dmg: 2, glints: 16, size: [54, 38],
    behavior: 'guard', params: { speed: 48, sight: 250, lunge: 300, reach: 50, tele: 0.48, shield: true },
    art: { body: 'beetle', c1: '#3a2340', c2: '#ffd0f2', c3: '#f6e6f2', eye: '#ff5ab4', horn: 2, spikes: true, glow: true }, weight: 4,
    journal: 'Its face is a polished pane. Strike it there and you only strike yourself. Come from above, or come from behind.',
    kills: 12,
  },
  {
    id: 'mirror_doppel', name: 'Doppelbead', area: 'mirror', hp: 40, dmg: 1, glints: 9, size: [26, 26],
    behavior: 'roller', params: { speed: 240, hop: 560, sight: 380 },
    art: { body: 'ball', c1: '#efe6d6', c2: '#c792c9', eye: '#ff3f6a' }, weight: 1,
    journal: 'Something round and pale, rolling the way you roll. It wears your shape like a borrowed coat and does not know why it is angry.',
    kills: 20,
  },
  {
    id: 'mirror_glassknight', name: 'Glass Lancer', area: 'mirror', hp: 75, dmg: 2, glints: 22, size: [46, 64],
    behavior: 'lancer', params: { speed: 46, sight: 300, reach: 130, tele: 0.6 },
    art: { body: 'knight', weapon: 'spear', c1: '#2d1c33', c2: '#ffd0f2', c3: '#fff6fc', eye: '#ff7ac8', glow: true }, weight: 5,
    journal: 'The Warden\'s honour guard stand their watch in the hall of mirrors, each beside its own reflection. The reflections have stood longer.',
    kills: 8,
  },
  {
    id: 'mirror_glimmerfish', name: 'Glimmerfish', area: 'mirror', hp: 38, dmg: 1, glints: 8, size: [40, 24],
    behavior: 'swimmer', params: { speed: 80, lunge: 380, sight: 280 },
    art: { body: 'fish', c1: '#e39ad2', c2: '#fff0fb', c3: '#ffffff', eye: '#3a2340', teeth: true, lure: true, centered: true },
    journal: 'The pools of the Deep show the sky that was never there. The glimmerfish swim in that sky, and bite anyone who looks too long.',
    kills: 15,
  },
  {
    id: 'mirror_gleamghost', name: 'Gleamghost', area: 'mirror', hp: 46, dmg: 1, glints: 12, size: [34, 34],
    behavior: 'phaser', params: { interval: 2.2, dash: 460, sight: 420 },
    art: { body: 'jelly', c1: '#f7c6ea', c2: '#ffe9f8', c3: '#ffffff', eye: '#3a2340', centered: true },
    journal: 'A reflection that walked out of its mirror and could not find the way back in. It appears beside you, the way your own face does in glass.',
    kills: 14,
  },
];
