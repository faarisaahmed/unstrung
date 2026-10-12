// Enemies of area 'cistern' (Brine Cistern). See docs/AUTHORING.md
// Palette: deep blues (#0e1d33 .. #4f7fb3) with cold pale accents; the depths add copper and ink-black.
export default [
  { id: 'cistern_glassfin', name: 'Glassfin', area: 'cistern', hp: 20, dmg: 1, glints: 4, size: [34, 20],
    behavior: 'swimmer', params: { speed: 80, lunge: 340, sight: 240 },
    art: { body: 'fish', c1: '#9cc8e8', c2: '#4f7fb3', eye: '#0b1424', teeth: true, centered: true },
    journal: 'So clear you can count its bones as it bites. It patrols the still water in slow, patient circles and forgets nothing that falls in.' },

  { id: 'cistern_lurker', name: 'Lanternmaw', area: 'cistern', hp: 42, dmg: 1, glints: 9, size: [54, 34], weight: 2,
    behavior: 'swimmer', params: { speed: 60, lunge: 420, sight: 300 },
    art: { body: 'fish', c1: '#121a2c', c2: '#26344f', c3: '#9ff0ff', eye: '#9ff0ff', glow: true, lure: true, teeth: true, centered: true },
    journal: 'It hangs its little lamp in the ink and waits for something lost to swim toward the light. Divers learned to fear any glow below them.' },

  { id: 'cistern_bellmoon', name: 'Bellmoon', area: 'cistern', hp: 22, dmg: 1, glints: 4, size: [30, 30],
    behavior: 'orbiter', params: { radius: 64, speed: 2.0 },
    art: { body: 'jelly', c1: '#4f7fb3', c2: '#7fc4ff', c3: '#e6f4ff', eye: '#0b1424', centered: true },
    journal: 'A drifting bell of jelly that rings without sound. It swings around the same arch forever, as if keeping time for a choir long drowned.' },

  { id: 'cistern_stinglet', name: 'Stinglet', area: 'cistern', hp: 20, dmg: 1, glints: 3, size: [22, 22],
    behavior: 'flyer', params: { speed: 95, accel: 280, sight: 320 },
    art: { body: 'jelly', c1: '#2b7a8c', c2: '#7af0d0', c3: '#d8fff4', eye: '#7af0d0', glow: true, centered: true, scale: 0.9 },
    journal: 'A small, curious jelly that has learned to swim through air. It follows warmth, and Bead is the warmest thing in the Cistern.' },

  { id: 'cistern_sluicecrab', name: 'Sluicecrab', area: 'cistern', hp: 24, dmg: 1, glints: 4, size: [36, 24],
    behavior: 'crawler', params: { speed: 55 },
    art: { body: 'crab', c1: '#3c5e86', c2: '#c9dff2', eye: '#ffffff' },
    journal: 'It scrubs the sluice walls clean of barnacles and anything else that clings. Its claws were made for scraping, not for mercy.' },

  { id: 'cistern_ramclaw', name: 'Ramclaw', area: 'cistern', hp: 48, dmg: 1, glints: 12, size: [58, 40], weight: 3,
    behavior: 'charger', params: { speed: 40, chargeSpeed: 400, sight: 340, tele: 0.5 },
    art: { body: 'crab', c1: '#b5824a', c2: '#e3b07a', eye: '#ffe0a0', glow: true },
    journal: 'A crab grown huge on the copper scale of the bellows, its shell gone green and gold. It charges the echo of its own footsteps.' },

  { id: 'cistern_barnacle', name: 'Spitbarnacle', area: 'cistern', hp: 30, dmg: 1, glints: 6, size: [32, 26], weight: 99,
    behavior: 'sentinel', params: { open: 1.6, closed: 2.2, speed: 220, count: 3, spread: 0.32, color: '#bfe4ff', projArt: 'glob' },
    art: { body: 'crystal', c1: '#33475f', c2: '#d5e2ee', eye: '#bfe4ff', n: 4 },
    journal: 'A clump of shells that opens only to spit. Bonking it while closed is pointless; wait for the mouths to show, or drop on it like a stone.' },

  { id: 'cistern_pipeeel', name: 'Pipe Eel', area: 'cistern', hp: 30, dmg: 1, glints: 6, size: [26, 34], weight: 99,
    behavior: 'lasher', params: { range: 130, tele: 0.5 },
    art: { body: 'worm', c1: '#1c3350', c2: '#3a6a94', c3: '#d7e8f5', eye: '#ffcf6a' },
    journal: 'It lives in the mouth of a pipe and lunges at the shadows that pass. Nobody has ever seen how long it really is.' },

  { id: 'cistern_drip', name: 'Drip', area: 'cistern', hp: 20, dmg: 1, glints: 3, size: [28, 18],
    behavior: 'dropper', params: { range: 54, speed: 45 },
    art: { body: 'slug', c1: '#5a86a8', c2: '#a8d4ee', eye: '#e6f4ff' },
    journal: 'A soft grey slug that hangs from the vaults like a bead of condensation. It lets go the moment something warm passes underneath.' },

  { id: 'cistern_inkblob', name: 'Inkblot', area: 'cistern', hp: 26, dmg: 1, glints: 5, size: [28, 28],
    behavior: 'hopper', params: { interval: 1.4, vx: 160, vy: 600 },
    art: { body: 'ball', c1: '#0b0d18', c2: '#2e3e66', eye: '#8fd8ff', spikes: true },
    journal: 'A droplet of the black ink that learned to bounce. Where it lands, it leaves a stain that never quite dries.' },

  { id: 'cistern_warden', name: 'Drowned Warden', area: 'cistern', hp: 46, dmg: 1, glints: 14, size: [38, 50], weight: 3,
    behavior: 'guard', params: { speed: 50, sight: 240, lunge: 300, reach: 50, tele: 0.45, shield: true },
    art: { body: 'knight', c1: '#25405f', c2: '#9fb6c9', c3: '#cfe3f0', eye: '#7fc4ff', weapon: 'shield', horns: 0 },
    journal: 'A keeper of the sluice gates who never left his post as the water rose. His shield is a valve wheel, and he still turns it every hour.' },
];
