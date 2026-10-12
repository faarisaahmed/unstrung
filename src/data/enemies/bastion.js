// Enemies of area 'bastion' (Cogwork Bastion). See docs/AUTHORING.md
// Palette: blackened iron, brass, copper verdigris, with furnace-orange eyes as the one hot accent.
export default [
  { id: 'bastion_gearling', name: 'Gearling', area: 'bastion', hp: 25, dmg: 1, glints: 5, size: [28, 28],
    behavior: 'roller', params: { speed: 200, hop: 520 },
    art: { body: 'gear', c1: '#c08a3e', c2: '#3a2614', eye: '#ffb050', teeth: 9, spin: 3 },
    weight: 1, kills: 20,
    journal: 'A loose cog that forgot which machine it belonged to and decided it belonged to itself. It rolls the halls looking for something to turn.' },

  { id: 'bastion_cogguard', name: 'Cogwarden', area: 'bastion', hp: 42, dmg: 1, glints: 9, size: [34, 46],
    behavior: 'guard', params: { speed: 50, lunge: 300, reach: 48, tele: 0.45, shield: true },
    art: { body: 'knight', c1: '#5a4632', c2: '#c9a15a', c3: '#e9dcc0', eye: '#ffb050', weapon: 'shield', horns: 0 },
    weight: 3, kills: 12,
    journal: 'Wound once, a very long time ago, and still walking its rounds. The brass shield is older than the hand that holds it. Strike from above or behind; it never learned to turn quickly.' },

  { id: 'bastion_lancer', name: 'Hour Lancer', area: 'bastion', hp: 38, dmg: 1, glints: 8, size: [32, 50],
    behavior: 'lancer', params: { speed: 55, reach: 120, tele: 0.55 },
    art: { body: 'knight', c1: '#3f3428', c2: '#e2b46a', c3: '#d8cdb4', eye: '#ff9a3c', weapon: 'spear' },
    weight: 2, kills: 12,
    journal: 'Its thrust is timed to the tick of a clock no one has wound in an age. Count the ticks and you will know when to move.' },

  { id: 'bastion_turret', name: 'Spinwheel', area: 'bastion', hp: 32, dmg: 1, glints: 6, size: [34, 34],
    behavior: 'spinner', params: { rate: 1.3, speed: 170, arms: 3, interval: 0.55, color: '#ffb050', projArt: 'orb' },
    art: { body: 'gear', c1: '#8a5a2e', c2: '#2a1a10', eye: '#ffd08a', teeth: 6, spin: 1 },
    weight: 99, kills: 10,
    journal: 'A sentry gear bolted to its post, flinging sparks in a slow and patient wheel. It does not aim. It does not need to.' },

  { id: 'bastion_bellhop', name: 'Toller', area: 'bastion', hp: 30, dmg: 1, glints: 6, size: [30, 34],
    behavior: 'hopper', params: { interval: 1.4, vx: 170, vy: 600 },
    art: { body: 'bell', c1: '#b07a3a', c2: '#ffe0a0', eye: '#fff1c0' },
    weight: 2, kills: 15,
    journal: 'A small automaton bell that rings itself by jumping. The guild made hundreds to call the shifts; with no shifts left to call, they ring for anyone who passes.' },

  { id: 'bastion_drone', name: 'Rivet Drone', area: 'bastion', hp: 26, dmg: 1, glints: 6, size: [30, 24],
    behavior: 'bomber', params: { speed: 120, interval: 2.4, height: 150 },
    art: { body: 'moth', c1: '#6b5238', c2: '#d9a35a', eye: '#ff9a3c', wing: 'fly', centered: true, glow: true },
    weight: 1, kills: 15,
    journal: 'Built to carry rivets to the high scaffolds. It still carries them, and still lets them go exactly where it was told: on whatever stands below.' },

  { id: 'bastion_magmite', name: 'Lodemite', area: 'bastion', hp: 25, dmg: 1, glints: 5, size: [24, 18],
    behavior: 'wallcrawler', params: { speed: 60 },
    art: { body: 'mite', c1: '#4f8a78', c2: '#c97a3a', eye: '#ffd08a', glow: true },
    weight: 1, kills: 20,
    journal: 'Verdigris given legs. Lodemites cling to copper the way moss clings to stone, and they do not care for anything else that tries to.' },

  { id: 'bastion_pistonfly', name: 'Pistonfly', area: 'bastion', hp: 28, dmg: 1, glints: 6, size: [28, 22],
    behavior: 'dasher', params: { speed: 500, interval: 2.2 },
    art: { body: 'wasp', c1: '#a8743a', c2: '#2c2118', eye: '#ffb050', centered: true, glow: true },
    weight: 1, kills: 15,
    journal: 'All of its life is one stroke of a piston: draw back, hold, release. Wait for the hold and step aside.' },

  { id: 'bastion_stoker', name: 'Stoker', area: 'bastion', hp: 50, dmg: 1, glints: 12, size: [44, 48],
    behavior: 'thrower', params: { interval: 2.4, speed: 420, gravity: 1100, count: 2, projArt: 'flame', color: '#ff8a3d' },
    art: { body: 'golem', c1: '#4a3626', c2: '#2a1d14', eye: '#ff8a3d' },
    weight: 5, kills: 10,
    journal: 'It feeds a furnace that went out before it was built. Its shovel still flings hot clinker at anything that comes near the fire.' },

  { id: 'bastion_core', name: 'Sentinel Core', area: 'bastion', hp: 45, dmg: 1, glints: 12, size: [36, 36],
    behavior: 'sentinel', params: { open: 1.6, closed: 2.4, speed: 230, count: 3, spread: 0.3, color: '#ffd08a', projArt: 'orb' },
    art: { body: 'eyeball', c1: '#ff9a3c', c2: '#b5824a', c3: '#e8dcc2' },
    weight: 99, kills: 10,
    journal: 'The watching heart of a guard post. Its brass lids are proof against any Bonk; it opens only to look, and to fire.' },
];
