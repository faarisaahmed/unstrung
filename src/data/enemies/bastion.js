// Enemies of area 'bastion' (The Pinworks). See docs/AUTHORING.md
// Palette: blued steel, cold iron, rust and a horseshoe-magnet red accent. Pins, needles, buttons, bobbins and thimbles.
export default [
  { id: 'bastion_gearling', name: 'Buttonwheel', area: 'bastion', hp: 25, dmg: 1, glints: 5, size: [28, 28],
    behavior: 'roller', params: { speed: 200, hop: 520 },
    art: { body: 'button', c1: '#7f8a96', c2: '#2a2f38', c3: '#c23a2e', eye: '#ffb050', spin: 3 },
    weight: 1, kills: 20,
    journal: 'A loose iron button that lost its coat and decided to keep rolling. It trundles the halls looking for a buttonhole, and will settle for you.' },

  { id: 'bastion_cogguard', name: 'Pin Sentry', area: 'bastion', hp: 42, dmg: 1, glints: 9, size: [34, 46],
    behavior: 'guard', params: { speed: 50, lunge: 300, reach: 48, tele: 0.45, shield: true },
    art: { body: 'knight', c1: '#2f3a4a', c2: '#8a9cb0', c3: '#e4e2dc', eye: '#ffb050', weapon: 'shield', horns: 0 },
    weight: 3, kills: 12,
    journal: 'Wound once, a very long time ago, and still walking its rounds. The brass shield is older than the hand that holds it. Strike from above or behind; it never learned to turn quickly.' },

  { id: 'bastion_lancer', name: 'Needle Lancer', area: 'bastion', hp: 38, dmg: 1, glints: 8, size: [32, 50],
    behavior: 'lancer', params: { speed: 55, reach: 120, tele: 0.55 },
    art: { body: 'knight', c1: '#26303e', c2: '#c3ccd6', c3: '#dcd8d0', eye: '#ff9a3c', weapon: 'spear' },
    weight: 2, kills: 12,
    journal: 'Its thrust is timed to the stroke of a treadle no one has worked in an age. Count the strokes and you will know when to move.' },

  { id: 'bastion_turret', name: 'Bobbin Turret', area: 'bastion', hp: 32, dmg: 1, glints: 6, size: [34, 34],
    behavior: 'spinner', params: { rate: 1.3, speed: 170, arms: 3, interval: 0.55, color: '#ffb050', projArt: 'orb' },
    art: { body: 'bobbin', c1: '#9aa3ad', c2: '#c0462f', c3: '#3a4250', eye: '#ffd08a', spin: 1 },
    weight: 99, kills: 10,
    journal: 'A sentry bobbin bolted to its post, flinging hot wire-sparks in a slow and patient wheel. It does not aim. It does not need to.' },

  { id: 'bastion_bellhop', name: 'Thimblehop', area: 'bastion', hp: 30, dmg: 1, glints: 6, size: [30, 34],
    behavior: 'hopper', params: { interval: 1.4, vx: 170, vy: 600 },
    art: { body: 'thimble', c1: '#a9b1ba', c2: '#5b636e', eye: '#fff1c0' },
    weight: 2, kills: 15,
    journal: 'A tin thimble that learned to hop when the fingers stopped coming. The guild stamped out thousands; with no fingers left to guard, they clank after anyone who passes.' },

  { id: 'bastion_drone', name: 'Rivet Drone', area: 'bastion', hp: 26, dmg: 1, glints: 6, size: [30, 24],
    behavior: 'bomber', params: { speed: 120, interval: 2.4, height: 150 },
    art: { body: 'moth', c1: '#3a4658', c2: '#9fb2c4', eye: '#ff9a3c', wing: 'fly', centered: true, glow: true },
    weight: 1, kills: 15,
    journal: 'Built to carry rivets to the high scaffolds. It still carries them, and still lets them go exactly where it was told: on whatever stands below.' },

  { id: 'bastion_magmite', name: 'Lodemite', area: 'bastion', hp: 25, dmg: 1, glints: 5, size: [24, 18],
    behavior: 'wallcrawler', params: { speed: 60 },
    art: { body: 'mite', c1: '#b8392c', c2: '#d9dde2', eye: '#ffd08a', glow: true },
    weight: 1, kills: 20,
    journal: 'Verdigris given legs. Lodemites cling to copper the way moss clings to stone, and they do not care for anything else that tries to.' },

  { id: 'bastion_pistonfly', name: 'Pistonfly', area: 'bastion', hp: 28, dmg: 1, glints: 6, size: [28, 22],
    behavior: 'dasher', params: { speed: 500, interval: 2.2 },
    art: { body: 'wasp', c1: '#5d7590', c2: '#1e242e', eye: '#ffb050', centered: true, glow: true },
    weight: 1, kills: 15,
    journal: 'All of its life is one stroke of a piston: draw back, hold, release. Wait for the hold and step aside.' },

  { id: 'bastion_stoker', name: 'Stoker', area: 'bastion', hp: 50, dmg: 1, glints: 12, size: [44, 48],
    behavior: 'thrower', params: { interval: 2.4, speed: 420, gravity: 1100, count: 2, projArt: 'flame', color: '#ff8a3d' },
    art: { body: 'golem', c1: '#3a3638', c2: '#8a4a32', eye: '#ff8a3d' },
    weight: 5, kills: 10,
    journal: 'It feeds a furnace that went out before it was built. Its shovel still flings hot clinker at anything that comes near the fire.' },

  { id: 'bastion_core', name: 'Lodestone Sentinel', area: 'bastion', hp: 45, dmg: 1, glints: 12, size: [36, 36],
    behavior: 'sentinel', params: { open: 1.6, closed: 2.4, speed: 230, count: 3, spread: 0.3, color: '#ffd08a', projArt: 'orb' },
    art: { body: 'eyeball', c1: '#c23a2e', c2: '#4a5566', c3: '#e2e4e6' },
    weight: 99, kills: 10,
    journal: 'The watching heart of a guard post. Its iron lids are proof against any Bonk; it opens only to look, and to fire.' },
];
