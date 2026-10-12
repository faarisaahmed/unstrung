// Enemies of area 'kilns' (Ashen Kilns). See docs/AUTHORING.md
// Late tier: hp 35-70, dmg 1-2. Palette: soot black, ember red, molten amber, smoked glass.
export default [
  { id: 'kilns_emberwisp', name: 'Ember Wisp', area: 'kilns', hp: 35, dmg: 1, glints: 6, size: [26, 26],
    behavior: 'flyer', params: { speed: 125, accel: 380, sight: 380, bob: 10 },
    art: { body: 'wisp', c1: '#ff7a32', c3: '#fff1c0', centered: true },
    journal: 'A spark that left the furnace and forgot to go out. It drifts toward anything cooler than itself, hoping to be warmed by it.', kills: 20 },

  { id: 'kilns_glassgolem', name: 'Glass Golem', area: 'kilns', hp: 70, dmg: 2, glints: 16, size: [52, 60],
    behavior: 'guard', params: { speed: 42, sight: 300, lunge: 300, reach: 62, tele: 0.55, shield: true },
    art: { body: 'golem', c1: '#a8583a', c2: '#4a1c12', eye: '#ffd08a' }, weight: 5,
    journal: 'Poured from the dregs of a failed batch and set to guard the racks. Its face is too thick to crack; strike it where the glass ran thin, from above or behind.', kills: 10 },

  { id: 'kilns_slagcrawler', name: 'Slag Crawler', area: 'kilns', hp: 40, dmg: 1, glints: 7, size: [40, 24],
    behavior: 'crawler', params: { speed: 38 },
    art: { body: 'slug', c1: '#2e1610', c2: '#ff6a2a', c3: '#ffb070', shell: true, eye: '#ffcf7a', glow: true }, weight: 2,
    journal: 'It eats the cooled waste the glassmakers swept aside. The cracks along its back still glow with what it has swallowed.', kills: 20 },

  { id: 'kilns_kilntaper', name: 'Kiln Taper', area: 'kilns', hp: 38, dmg: 1, glints: 9, size: [26, 46],
    behavior: 'shooter', params: { interval: 2.4, speed: 430, count: 3, spread: 0.22, arc: true, gravity: 1000, color: '#ff9a3d', projArt: 'flame', tele: 0.55 },
    art: { body: 'candle', c1: '#d9b48a', c2: '#ff8a3d', eye: '#3a1208' }, weight: 99,
    journal: 'A votive candle lit so long it learned to aim. It spits its own flame in three gobbets, then waits, guttering, to grow more.', kills: 15 },

  { id: 'kilns_culletcrab', name: 'Cullet Crab', area: 'kilns', hp: 48, dmg: 1, glints: 10, size: [44, 30],
    behavior: 'charger', params: { speed: 40, chargeSpeed: 430, sight: 330, tele: 0.5 },
    art: { body: 'crab', c1: '#e3a878', c2: '#ff7a3a', eye: '#fff1c0', glow: true }, weight: 2,
    journal: 'Its shell is a heap of broken glass glued with its own spit. It runs sideways into anything, and the sound it makes is like a dropped tray.', kills: 15 },

  { id: 'kilns_cinderbat', name: 'Cinder Bat', area: 'kilns', hp: 35, dmg: 1, glints: 6, size: [36, 26],
    behavior: 'swooper', params: { speed: 300, sight: 300, range: 240 },
    art: { body: 'bat', c1: '#2a0f0a', c2: '#7a2a18', eye: '#ffb070', centered: true },
    journal: 'It roosts in the soot of the chimneys where the heat is worst. When it drops, a little rain of ash falls with it.', kills: 20 },

  { id: 'kilns_glassfin', name: 'Glassfin', area: 'kilns', hp: 45, dmg: 2, glints: 11, size: [46, 26],
    behavior: 'swimmer', params: { speed: 95, lunge: 420, sight: 280 },
    art: { body: 'fish', c1: '#ffcf7a', c2: '#ff6a2a', c3: '#fff1c0', teeth: true, lure: true, eye: '#3a1208', centered: true },
    journal: 'It swims in molten glass the way other fish swim in water. Pull one out and it hardens mid-thrash; the monks keep them as paperweights.', kills: 12 },

  { id: 'kilns_bellowsjelly', name: 'Bellows Jelly', area: 'kilns', hp: 40, dmg: 1, glints: 9, size: [40, 38],
    behavior: 'bomber', params: { speed: 105, interval: 2.3, height: 160, sight: 420 },
    art: { body: 'jelly', c1: '#c4452a', c2: '#ff9a5a', c3: '#ffe0b0', eye: '#2a0806', centered: true },
    journal: 'A sac of hot air that breathes in at the furnace mouths and floats away full. It drops globs of glass when it gets too heavy, and it is always too heavy above you.', kills: 15 },

  { id: 'kilns_cinderling', name: 'Cinderling', area: 'kilns', hp: 35, dmg: 2, glints: 7, size: [28, 28],
    behavior: 'exploder', params: { speed: 55, rush: 250, sight: 260, fuse: 0.6, radius: 72 },
    art: { body: 'ball', c1: '#4a1a10', c2: '#ff7a2a', spikes: true, eye: '#ffd08a' },
    journal: 'A bead of slag that rolled out of the fire still burning. Like you, it is small and round. Unlike you, it wants only to burst.', kills: 15 },

  { id: 'kilns_sculpture', name: 'Unfinished Sculpture', area: 'kilns', hp: 60, dmg: 2, glints: 14, size: [46, 46],
    behavior: 'mimic', params: { wake: 110, interval: 1.1, vx: 230, vy: 640 },
    art: { body: 'crystal', c1: '#6a2a1a', c2: '#ffc890', n: 4, eye: '#ff5a2a' }, weight: 3,
    journal: 'The glassmakers left a figure half-blown when the fires went wrong. It stood on its plinth for an age, waiting to be finished. It has decided to finish whoever comes near.', kills: 10 },
];
