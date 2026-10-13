// Enemies of area 'hollows' (Mossbell Hollows). See docs/AUTHORING.md
// Palette: deep teal rock, moss green, verdigris bronze for the bell-creatures.
export default [
  { id: 'hollows_mossgrub', name: 'Mossgrub', area: 'hollows', hp: 10, dmg: 1, glints: 2, size: [32, 20],
    behavior: 'crawler', params: { speed: 42 },
    art: { body: 'grub', c1: '#2f5a4e', c2: '#7fc9a4', c3: '#e8e2d0', eye: '#ffffff', mask: true, segs: 4 },
    journal: 'The Mother\'s smallest children, sent out to graze the moss and bring its warmth home. They do not know they are a long way from home.', kills: 20 },

  { id: 'hollows_rootcharger', name: 'Rootbutt', area: 'hollows', hp: 18, dmg: 1, glints: 5, size: [40, 28],
    behavior: 'charger', params: { speed: 40, chargeSpeed: 360, sight: 300 },
    art: { body: 'beetle', c1: '#1f3b36', c2: '#5f9c8c', c3: '#d8cfb2', eye: '#bff5df', horn: 2 },
    journal: 'It digs by running headfirst at the walls, and it has run at so many walls it can no longer tell them from visitors.', kills: 15 },

  { id: 'hollows_clapper', name: 'Acornhop', area: 'hollows', hp: 18, dmg: 1, glints: 5, size: [30, 34],
    behavior: 'hopper', params: { interval: 1.5, vx: 150, vy: 600 },
    art: { body: 'acorn', c1: '#8a6a3a', c2: '#5d7a3e', eye: '#fff4c0' },
    journal: 'An acorn that sprouted legs instead of roots. Every hop is a dull clonk of its cap, every clonk a question nobody answers.', kills: 15 },

  { id: 'hollows_chimelet', name: 'Fluffwisp', area: 'hollows', hp: 10, dmg: 1, glints: 3, size: [22, 24],
    behavior: 'flyer', params: { speed: 90, sight: 320 },
    art: { body: 'seedpuff', c1: '#e8f5e0', c2: '#6f8f7a', eye: '#2a3a30', glow: true, centered: true },
    journal: 'Seed-puffs that drift in the dark, humming a note too low to hear. They only find their voice when they strike something.', kills: 20 },

  { id: 'hollows_dripling', name: 'Dripling', area: 'hollows', hp: 8, dmg: 1, glints: 2, size: [26, 22],
    behavior: 'dropper', params: { range: 46, speed: 55 },
    art: { body: 'slug', c1: '#3c6e6a', c2: '#a6e6d8', eye: '#ffffff', shell: false },
    journal: 'It clings to the stone pretending to be water about to fall. When something walks beneath, it stops pretending.', kills: 15 },

  { id: 'hollows_mossmoth', name: 'Mossmoth', area: 'hollows', hp: 10, dmg: 1, glints: 3, size: [30, 24],
    behavior: 'swooper', params: { range: 230 },
    art: { body: 'moth', c1: '#355e48', c2: '#9fe0c4', eye: '#e8ffe0', wing: 'moth', centered: true },
    journal: 'Moths of the Hollows fold themselves into the ceiling moss to sleep. They wake in a hurry, and badly.', kills: 15 },

  { id: 'hollows_bellwarden', name: 'Husk Ringer', area: 'hollows', hp: 20, dmg: 1, glints: 8, size: [32, 38],
    behavior: 'guard', params: { speed: 50, sight: 220, lunge: 260 },
    art: { body: 'knight', c1: '#24403a', c2: '#8fbfae', c3: '#e9e4d6', eye: '#000000', weapon: 'nail' },
    journal: 'Once it rang the hours for a kingdom. The kingdom is gone and the hours with it, but the arm still swings.', kills: 12 },

  { id: 'hollows_tollshield', name: 'Toll Warden', area: 'hollows', hp: 25, dmg: 1, glints: 10, size: [34, 40],
    behavior: 'guard', params: { speed: 45, sight: 230, lunge: 240, shield: true, tele: 0.48 },
    art: { body: 'knight', c1: '#2a3f3c', c2: '#b39a5a', c3: '#e9e4d6', eye: '#000000', weapon: 'shield' },
    journal: 'It still guards the old tollgates and demands a fee in a coin nobody has minted in an age. Its bronze shield turns a Bonk aside, so strike it from above or behind.', kills: 10 },

  { id: 'hollows_sporespitter', name: 'Lichen Spitter', area: 'hollows', hp: 14, dmg: 1, glints: 4, size: [28, 28],
    behavior: 'shooter', params: { interval: 2.4, speed: 300, arc: true, gravity: 900, color: '#9fe0c4', projArt: 'glob' },
    art: { body: 'shroom', c1: '#2c5148', c2: '#c9f0b0', eye: '#ffffff' },
    journal: 'A lichen cap with a sour temper. It coughs up a damp glob whenever anything warm comes near.', kills: 15 },

  { id: 'hollows_burrowworm', name: 'Rootworm', area: 'hollows', hp: 14, dmg: 1, glints: 4, size: [24, 40],
    behavior: 'burrower', params: { sight: 220 },
    art: { body: 'worm', c1: '#4a5a3a', c2: '#d9c890', eye: '#ffffff' },
    journal: 'Rootworms swim through soil the way fish swim through water. A trembling of moss is the only warning.', kills: 12 },

  { id: 'hollows_lichencrawler', name: 'Verdigris Tick', area: 'hollows', hp: 12, dmg: 1, glints: 3, size: [26, 22],
    behavior: 'wallcrawler', params: { speed: 50 },
    art: { body: 'spider', c1: '#3a6a5a', c2: '#c0f0d8', eye: '#ffdd88', eyes: 4 },
    journal: 'It feeds on the green crust of old bronze and will walk any wall to find more. It is patient, which is why it is everywhere.', kills: 15 },

  { id: 'hollows_broodsac', name: 'Brood Sac', area: 'hollows', hp: 25, dmg: 1, glints: 12, size: [40, 36],
    behavior: 'spawner', params: { interval: 4, max: 3, child: 'hollows_mossgrub' },
    art: { body: 'jelly', c1: '#3f6b5c', c2: '#d8f5a0', eye: '#ffffff', glow: true },
    journal: 'A swollen pod, warm to the touch, kept by the Mother in her nurseries. Something inside is always nearly ready.', kills: 8 },
];
