// Enemies of area 'archive' (Silken Archive). See docs/AUTHORING.md
// Indigo & gold palette: ink-dark indigo bodies, parchment pages, gilt thread accents.
export default [
  { id: 'archive_folio', name: 'Errant Folio', area: 'archive', hp: 42, dmg: 1, glints: 7, size: [34, 26],
    behavior: 'flyer', params: { speed: 125, accel: 300, sight: 380 },
    art: { body: 'book', c1: '#3b3577', c3: '#efe3c0', eye: '#e7c96a', centered: true },
    journal: 'A volume that slipped its shelf and learned it could fly. It returns to nothing, and bites whatever tries to reshelve it.', kills: 20 },

  { id: 'archive_scribe', name: 'Quill Scribe', area: 'archive', hp: 62, dmg: 2, glints: 12, size: [36, 50],
    behavior: 'lancer', params: { speed: 38, reach: 120, tele: 0.55, sight: 280 },
    art: { body: 'knight', c1: '#2b2650', c2: '#e7c96a', c3: '#efe8d8', weapon: 'spear', horns: 0 },
    weight: 2,
    journal: 'It copies the same page over and over, and corrects mistakes with the long end of its pen. Visitors count as mistakes.', kills: 15 },

  { id: 'archive_blotling', name: 'Blotling', area: 'archive', hp: 46, dmg: 1, glints: 9, size: [30, 30],
    behavior: 'phaser', params: { interval: 2.3, dash: 430 },
    art: { body: 'jelly', c1: '#120f24', c2: '#3a2f6e', c3: '#5d55b5', eye: '#fff1b5', glow: true, centered: true },
    journal: 'A drop of spilt ink that refused to dry. It soaks through the pages and wells up again wherever you are standing.', kills: 15 },

  { id: 'archive_pagemoth', name: 'Pagemoth', area: 'archive', hp: 40, dmg: 1, glints: 4, size: [24, 18],
    behavior: 'swarm', params: { speed: 165, accel: 560 },
    art: { body: 'moth', c1: '#d8cfae', c2: '#a99a6a', c3: '#efe6cf', eye: '#2b2650', wing: 'moth', centered: true },
    journal: 'They eat only the margins, where the notes were. Whole centuries of second thoughts have gone down their throats.', kills: 30 },

  { id: 'archive_spool', name: 'Spool Sentry', area: 'archive', hp: 58, dmg: 1, glints: 11, size: [30, 40],
    behavior: 'sentinel', params: { open: 1.6, closed: 2.2, speed: 240, count: 3, spread: 0.3, color: '#e7c96a', projArt: 'needle' },
    art: { body: 'spool', c1: '#c8a24a', c2: '#3b3577', eye: '#fff1b5', glow: true },
    weight: 99,
    journal: 'A bobbin of gilt thread set to guard the stacks. It sleeps wound tight and wakes only to spit needles.', kills: 15 },

  { id: 'archive_warden', name: 'Lectern Eye', area: 'archive', hp: 52, dmg: 1, glints: 10, size: [34, 34],
    behavior: 'flyshooter', params: { speed: 90, keep: 230, interval: 2.4, projSpeed: 260, color: '#8079c9', projArt: 'orb' },
    art: { body: 'eyeball', c1: '#3b3577', c2: '#c8a24a', c3: '#efe8d8', centered: true },
    journal: 'The Archive does not trust its readers. These eyes hang above the reading desks and never once blink.', kills: 15 },

  { id: 'archive_mimic', name: 'Mimic Tome', area: 'archive', hp: 64, dmg: 2, glints: 14, size: [36, 28],
    behavior: 'mimic', params: { wake: 100, vx: 210, vy: 600 },
    art: { body: 'book', c1: '#5a2a3a', c3: '#e9dcb8', eye: '#ff6a5a', centered: true },
    weight: 2,
    journal: 'It lies open on the floor as if someone had just been reading it. Someone had.', kills: 12 },

  { id: 'archive_marginworm', name: 'Marginworm', area: 'archive', hp: 44, dmg: 1, glints: 6, size: [30, 18],
    behavior: 'wallcrawler', params: { speed: 62 },
    art: { body: 'grub', c1: '#2b2650', c2: '#8079c9', c3: '#e7c96a', mask: true, segs: 5, eye: '#fff1b5' },
    journal: 'Bookworms grown fat on gilt edging. They circle the shelves forever, reading every spine and nothing else.', kills: 20 },

  { id: 'archive_inkpike', name: 'Inkpike', area: 'archive', hp: 50, dmg: 2, glints: 10, size: [44, 22],
    behavior: 'swimmer', params: { speed: 95, lunge: 380, sight: 280 },
    art: { body: 'fish', c1: '#141127', c2: '#3a2f6e', c3: '#ffe9a0', eye: '#fff1b5', teeth: true, lure: true, glow: true, centered: true },
    journal: 'It hunts in the spilt inkwells by the light of its little gold lure. Everything it eats becomes a footnote.', kills: 12 },

  { id: 'archive_shelfwarden', name: 'Shelfwarden', area: 'archive', hp: 80, dmg: 2, glints: 20, size: [52, 62],
    behavior: 'guard', params: { speed: 50, lunge: 300, reach: 54, tele: 0.45, shield: true },
    art: { body: 'knight', c1: '#211d3f', c2: '#c8a24a', c3: '#efe8d8', weapon: 'shield' },
    weight: 4,
    journal: 'A great keeper with a gilded book-cover for a shield. Strike it from above or behind; it will not let you past the front.', kills: 10 },
];
