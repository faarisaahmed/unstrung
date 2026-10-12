// Enemies of area 'gardens' (Glasswing Gardens). See docs/AUTHORING.md
// Palette: deep greenhouse greens, gold pollen, one hot accent per creature.
export default [
  {
    id: 'gardens_aphid', name: 'Sapsipper', area: 'gardens', hp: 15, dmg: 1, glints: 2,
    size: [18, 16], behavior: 'swarm', params: { speed: 150, accel: 520 },
    art: { body: 'fly', c1: '#9fd36a', c2: '#e9f7a0', eye: '#ff9b5a', centered: true, glow: true },
    journal: 'They drink the sap that weeps from cracked stems and never stop to swallow. Where one buzzes, a dozen more are already listening.',
  },
  {
    id: 'gardens_lanternmoth', name: 'Lanternmoth', area: 'gardens', hp: 18, dmg: 1, glints: 3,
    size: [34, 30], behavior: 'orbiter', params: { radius: 44, speed: 1.5 },
    art: { body: 'moth', wing: 'moth', c1: '#3a2e14', c2: '#ffd86a', c3: '#fff4c0', eye: '#fff7d0', glow: true, centered: true, scale: 1.1 },
    journal: 'It circles the same warm spot of air until its wings wear thin, mistaking a crack of daylight for the Moon. Its soft back has carried many a clever traveller over the thorns.',
  },
  {
    id: 'gardens_snapbloom', name: 'Snapbloom', area: 'gardens', hp: 26, dmg: 1, glints: 4,
    size: [34, 48], behavior: 'lasher', params: { range: 130, tele: 0.5 },
    art: { body: 'flower', c1: '#d9465a', c2: '#ffe27a', c3: '#3f6b2a' },
    weight: 99,
    journal: 'A crimson bloom with a whip for a stem. The gardeners planted it to keep pests off the seedlings, and it never learned the difference.',
  },
  {
    id: 'gardens_leafhopper', name: 'Leafhopper', area: 'gardens', hp: 18, dmg: 1, glints: 3,
    size: [30, 26], behavior: 'hopper', params: { interval: 1.4, vx: 180, vy: 640 },
    art: { body: 'hopper', c1: '#5f9c3a', c2: '#c9e86a', c3: '#efe8d8' },
    journal: 'All legs and appetite. It leaps at shadows, at falling petals, at its own reflection in the glass.',
  },
  {
    id: 'gardens_thornback', name: 'Thornback', area: 'gardens', hp: 30, dmg: 1, glints: 5,
    size: [40, 28], behavior: 'crawler', params: { speed: 42 },
    art: { body: 'beetle', c1: '#2f4a22', c2: '#a7c957', c3: '#d8e86c', eye: '#ffe27a', spikes: true, horn: 2 },
    weight: 3,
    journal: 'It grows its own briars and wears them like a cloak. Strike it from the front and you will feel every one of them.',
  },
  {
    id: 'gardens_pitcher', name: 'Pollen Pitcher', area: 'gardens', hp: 22, dmg: 1, glints: 4,
    size: [32, 38], behavior: 'shooter',
    params: { interval: 2.5, arc: true, speed: 380, gravity: 900, count: 3, spread: 0.35, tele: 0.55, projArt: 'glob', color: '#e8d24a' },
    art: { body: 'shroom', c1: '#7aa83a', c2: '#ffe27a', c3: '#d6e7a8' },
    weight: 99,
    journal: 'A pitcher plant gone sour. It coughs up clots of sticky golden pollen at anything that disturbs its sleep.',
  },
  {
    id: 'gardens_glassbat', name: 'Glasswing', area: 'gardens', hp: 16, dmg: 1, glints: 3,
    size: [34, 24], behavior: 'swooper', params: { range: 230, sight: 300 },
    art: { body: 'bat', c1: '#1f2a20', c2: 'rgba(205,245,225,0.55)', eye: '#efffa8', centered: true },
    journal: 'Its wings are so thin that light passes straight through them. You see the Glasswing only in the instant before it strikes.',
  },
  {
    id: 'gardens_mantis', name: 'Mantis Lancer', area: 'gardens', hp: 38, dmg: 1, glints: 8,
    size: [42, 58], behavior: 'lancer', params: { speed: 48, reach: 125, tele: 0.5, sight: 300 },
    art: { body: 'mantis', c1: '#6fae3e', c2: '#f2e9b8', c3: '#c9e86a', eye: '#ffef9a', glow: true },
    weight: 3,
    journal: 'The last of the garden wardens, still keeping the court by the old laws. It bows before every thrust, and that bow is the only warning you will get.',
  },
  {
    id: 'gardens_dartwing', name: 'Dartwing', area: 'gardens', hp: 20, dmg: 1, glints: 4,
    size: [32, 26], behavior: 'dasher', params: { speed: 500, interval: 2.2 },
    art: { body: 'wasp', c1: '#2b2a18', c2: '#e8b83a', eye: '#ff5a3a', centered: true },
    journal: 'It hangs perfectly still in the pollen haze, then crosses the whole greenhouse in a single breath. It never stings twice in the same place.',
  },
  {
    id: 'gardens_panesnail', name: 'Pane Snail', area: 'gardens', hp: 24, dmg: 1, glints: 4,
    size: [30, 22], behavior: 'wallcrawler', params: { speed: 38 },
    art: { body: 'snail', c1: '#c7dcb0', c2: 'rgba(190,240,230,0.75)', eye: '#16141c' },
    weight: 2,
    journal: 'It grazes the algae off the greenhouse glass and grows a shell of the same glass in return. It cares nothing for which way is up.',
  },
  {
    id: 'gardens_rootlurker', name: 'Rootlurker', area: 'gardens', hp: 28, dmg: 1, glints: 5,
    size: [30, 34], behavior: 'burrower', params: { sight: 220, speed: 130, up: 1.1 },
    art: { body: 'worm', c1: '#5a4a2a', c2: '#a7c957', c3: '#efe8d8', eye: '#ffd86a' },
    journal: 'It sleeps among the roots of the old beds and wakes for any footstep above. The loose soil always shivers first.',
  },
];
