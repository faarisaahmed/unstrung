// Enemies of area 'dunes' (Dustmote Dunes, post-game secret). See docs/AUTHORING.md
// Palette: warm lint browns and dusty cream, with one loud accent per creature
// (button red, penny copper, royal purple, mote gold).
export default [
  {
    id: 'dunes_lintweevil', name: 'Lint Weevil', area: 'dunes', hp: 70, dmg: 2, glints: 14,
    size: [46, 30], behavior: 'charger', params: { speed: 55, chargeSpeed: 430, sight: 360, tele: 0.42 },
    art: { body: 'beetle', c1: '#8a6f4a', c2: '#d8c29a', c3: '#efe2c4', eye: '#ffe3a0', horn: 2 },
    weight: 2,
    journal: 'A weevil that eats lint and is therefore mostly lint. It charges because it cannot see where it is going, and it cannot see because of the lint.',
    kills: 12,
  },
  {
    id: 'dunes_dustbunny', name: 'Dust Bunny', area: 'dunes', hp: 60, dmg: 2, glints: 12,
    size: [34, 34], behavior: 'roller', params: { speed: 240, hop: 560, sight: 380 },
    art: { body: 'ball', c1: '#cdb892', c2: '#8f7a58', eye: '#ff5a4a', spikes: true },
    journal: 'Gathered in corners, then gathered into a grudge. The dunes make it faster: never meet one at the bottom of a slope.',
    kills: 15,
  },
  {
    id: 'dunes_buttonsentry', name: 'Button Sentry', area: 'dunes', hp: 110, dmg: 2, glints: 24,
    size: [44, 58], behavior: 'guard', params: { speed: 60, sight: 340, lunge: 320, reach: 52, tele: 0.45, shield: true },
    art: { body: 'knight', c1: '#3a2c1c', c2: '#b8342c', c3: '#efe2c4', eye: '#ffe3a0', weapon: 'shield', horns: 0 },
    weight: 4,
    journal: 'Sworn to the Lint King, it carries a coat button as a shield and is very proud of the four holes. Strike it from above; its loyalty does not extend to looking up.',
    kills: 10,
  },
  {
    id: 'dunes_motemoth', name: 'Motemoth', area: 'dunes', hp: 60, dmg: 2, glints: 12,
    size: [36, 30], behavior: 'flyer', params: { speed: 150, accel: 420, sight: 420 },
    art: { body: 'moth', c1: '#b49a6c', c2: '#ffe3a0', eye: '#fff1c8', wing: 'moth', glow: true, centered: true },
    journal: 'It drinks the gold out of the light that slips between the floorboards. Where a sunbeam falls, a Motemoth is never far.',
    kills: 15,
  },
  {
    id: 'dunes_fluffworm', name: 'Fluffworm', area: 'dunes', hp: 85, dmg: 2, glints: 18,
    size: [36, 36], behavior: 'burrower', params: { sight: 280, speed: 170, up: 1.0 },
    art: { body: 'worm', c1: '#7a5f3e', c2: '#d8c29a', c3: '#efe2c4', eye: '#ffe3a0' },
    journal: 'Swims through loose fluff as a fish swims through water. The drift ripples once before it bites: watch the drift.',
    kills: 12,
  },
  {
    id: 'dunes_pennymimic', name: 'Penny Mimic', area: 'dunes', hp: 90, dmg: 2, glints: 40,
    size: [38, 26], behavior: 'mimic', params: { wake: 100, vx: 230, vy: 600, interval: 0.9 },
    art: { body: 'crab', c1: '#b8692e', c2: '#f2b46a', c3: '#ffe3a0', eye: '#fff1c8' },
    weight: 2,
    journal: 'It lies flat, shines, and waits for greed. The Glint Hoarder keeps them as guard dogs, or perhaps they keep him.',
    kills: 10,
  },
];
