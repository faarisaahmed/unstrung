// Enemies of area 'hushwood'. See docs/AUTHORING.md
// Hushwood: a silent fungal forest. Most things here are asleep, or pretending to be.
// Palette: violet caps, pale gills, one cold glow per creature.
export default [
  {
    id: 'hushwood_drowsecap', name: 'Drowsecap', area: 'hushwood', hp: 20, dmg: 1, glints: 4,
    size: [32, 34], behavior: 'crawler', params: { speed: 34 },
    art: { body: 'shroom', c1: '#7a5bb0', c2: '#e6d4ff', c3: '#e9dfcf', eye: '#ffffff' },
    journal: 'A little cap that walks in its sleep. It never wakes, not even when it bumps into you, which it will.', kills: 20,
  },
  {
    id: 'hushwood_puffbud', name: 'Puffbud', area: 'hushwood', hp: 26, dmg: 1, glints: 6,
    size: [34, 34], behavior: 'sentinel', params: { open: 1.6, closed: 2.6, count: 3, spread: 0.32, speed: 170, color: '#d6b4ff', projArt: 'orb' },
    art: { body: 'flower', c1: '#5d3f8f', c2: '#d6b4ff', c3: '#2b1d45', eye: '#ead8ff', glow: true },
    weight: 99,
    journal: 'A shut bud that breathes out slow lilac spores when something warm comes near. Wait for it to open its mouth, then answer.', kills: 15,
  },
  {
    id: 'hushwood_burrbeast', name: 'Slumbering Burrbeast', area: 'hushwood', hp: 42, dmg: 1, glints: 12,
    size: [58, 40], behavior: 'mimic', params: { wake: 110, vx: 230, vy: 600, interval: 1.0 },
    art: { body: 'beast', c1: '#3b2b5c', c2: '#b393e8', c3: '#e2d6f5', eye: '#ffe08a', glow: true },
    weight: 3,
    journal: 'Moss grows on its back because it has not moved in years. Step softly past it. Softer than that.', kills: 10,
  },
  {
    id: 'hushwood_hushmoth', name: 'Hushmoth', area: 'hushwood', hp: 18, dmg: 1, glints: 4,
    size: [34, 26], behavior: 'flyer', params: { speed: 80, accel: 220, sight: 300, bob: 10 },
    art: { body: 'moth', wing: 'moth', c1: '#9b86c9', c2: '#f2e8ff', c3: '#5a4685', eye: '#cdb6ff', centered: true, glow: true },
    journal: 'Its wings are lined with dust that swallows sound. You will not hear it arrive.', kills: 20,
  },
  {
    id: 'hushwood_dozeslug', name: 'Dozeslug', area: 'hushwood', hp: 24, dmg: 1, glints: 5,
    size: [30, 22], behavior: 'wallcrawler', params: { speed: 30 },
    art: { body: 'slug', shell: true, c1: '#4e3b78', c2: '#c9a8f5', c3: '#f0e6ff', eye: '#ffffff' },
    weight: 2,
    journal: 'It glides up the stalks so slowly it seems painted on. The trail it leaves glows for a night and a day.', kills: 15,
  },
  {
    id: 'hushwood_owlet', name: 'Mute Owlet', area: 'hushwood', hp: 22, dmg: 1, glints: 5,
    size: [30, 30], behavior: 'swooper', params: { speed: 300, sight: 300, range: 240 },
    art: { body: 'bird', c1: '#6b5a8e', c2: '#e8dcff', c3: '#2d2340', eye: '#ffd76a', centered: true, glow: true },
    journal: 'Owlets of the Hushwood are born without a voice. They hunt by falling, which makes no sound at all.', kills: 15,
  },
  {
    id: 'hushwood_sporemote', name: 'Sporemote', area: 'hushwood', hp: 18, dmg: 1, glints: 2,
    size: [20, 20], behavior: 'swarm', params: { speed: 140, accel: 480 },
    art: { body: 'wisp', c1: '#b38cff', c2: '#f4ecff', eye: '#ffffff', centered: true, glow: true },
    journal: 'A spore that has decided to be an animal. It drifts in clouds, and the clouds are hungry.', kills: 25,
  },
  {
    id: 'hushwood_mycoworm', name: 'Mycelium Worm', area: 'hushwood', hp: 34, dmg: 1, glints: 8,
    size: [36, 40], behavior: 'burrower', params: { sight: 220, speed: 120, up: 1.1 },
    art: { body: 'worm', c1: '#d9c7f0', c2: '#8b74b8', c3: '#3a2b55', eye: '#2a1d40' },
    weight: 3,
    journal: 'The pale thread that holds the forest together has a mouth at one end. Watch the moss for trembling.', kills: 12,
  },
  {
    id: 'hushwood_dreamhopper', name: 'Dreamhopper', area: 'hushwood', hp: 28, dmg: 1, glints: 6,
    size: [30, 30], behavior: 'leaper', params: { interval: 1.6, vx: 140, vy: 520, leap: 760, sight: 300 },
    art: { body: 'hopper', c1: '#46336e', c2: '#9be0d0', c3: '#e8e0f5', eye: '#9be0d0', glow: true },
    journal: 'It hops in its sleep, dreaming of a pond that dried up long ago. When it dreams of you, it leaps.', kills: 15,
  },
  {
    id: 'hushwood_puffball', name: 'Hushpuff', area: 'hushwood', hp: 18, dmg: 1, glints: 5,
    size: [28, 28], behavior: 'exploder', params: { speed: 40, rush: 210, sight: 240, fuse: 0.8, radius: 70 },
    art: { body: 'ball', spikes: true, c1: '#8f6fc4', c2: '#f1e2ff', c3: '#3a2b55', eye: '#ffffff' },
    journal: 'A ripe puffball that rolls toward warmth and bursts into a silent violet cloud. It does not mind. That was the plan.', kills: 15,
  },
];
