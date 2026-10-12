// Enemies of area 'catacombs' (Tallow Catacombs). See docs/AUTHORING.md
// Palette: amber flame on black, tallow cream, old bone. Candle-folk carry their own light,
// which matters in the unlit crypts.
export default [
  {
    id: 'catacombs_wickling', name: 'Wickling', area: 'catacombs', hp: 15, dmg: 1, glints: 3,
    size: [22, 30], behavior: 'crawler', params: { speed: 38 },
    art: { body: 'candle', c1: '#ecdcb4', c2: '#ffcf7a' }, light: 70,
    journal: 'A stub of candle that got up and wandered off. It does not know where it is going, only that it must not stop, or it will go out.',
  },
  {
    id: 'catacombs_tallowhulk', name: 'Tallow Hulk', area: 'catacombs', hp: 34, dmg: 1, glints: 8,
    size: [38, 50], behavior: 'charger', params: { speed: 30, chargeSpeed: 340, sight: 300, tele: 0.6 },
    art: { body: 'candle', c1: '#c79a5c', c2: '#ff8a3c' }, light: 100, weight: 3,
    journal: 'Many candles melted into one great sullen pillar. When it sees movement it lowers its flame and rams, and the drip it leaves behind never quite cools.',
  },
  {
    id: 'catacombs_pyrewick', name: 'Pyrewick', area: 'catacombs', hp: 22, dmg: 1, glints: 5,
    size: [26, 40], behavior: 'shooter',
    params: { interval: 2.6, speed: 260, arc: true, gravity: 700, tele: 0.6, projArt: 'flame', color: '#ffa040' },
    art: { body: 'candle', c1: '#f4ead2', c2: '#ff6a2a' }, light: 90,
    journal: 'A tall votive that flicks pieces of its own flame at intruders. Each one it throws leaves it a little shorter. It seems not to mind.',
  },
  {
    id: 'catacombs_rattleskull', name: 'Rattleskull', area: 'catacombs', hp: 18, dmg: 1, glints: 4,
    size: [28, 24], behavior: 'hopper', params: { interval: 1.5, vx: 150, vy: 560 },
    art: { body: 'skull', c1: '#e6dcc4', eye: '#ffb85c' },
    journal: 'A skull that took to legs once its owner stopped needing it. It hops toward warmth, and Bead is warm.',
  },
  {
    id: 'catacombs_dripling', name: 'Dripling', area: 'catacombs', hp: 16, dmg: 1, glints: 3,
    size: [26, 22], behavior: 'dropper', params: { range: 60, speed: 45 },
    art: { body: 'slug', c1: '#e8c88a', eye: '#ffcf7a', glow: true },
    journal: 'It clings to the ceiling looking like any other bead of wax. When something passes below, it lets go.',
  },
  {
    id: 'catacombs_gravewisp', name: 'Gravewisp', area: 'catacombs', hp: 20, dmg: 1, glints: 4,
    size: [26, 26], behavior: 'phaser', params: { interval: 2.8, dash: 380 },
    art: { body: 'wisp', c1: '#ffb85c', c3: '#fff4d6', centered: true }, light: 80,
    journal: 'The last warmth of a snuffed candle, which forgot to leave. It vanishes and reappears like a thought you keep losing.',
  },
  {
    id: 'catacombs_waxguard', name: 'Wax Guard', area: 'catacombs', hp: 40, dmg: 1, glints: 10,
    size: [40, 54], behavior: 'guard', params: { shield: true, speed: 50, sight: 260, lunge: 300, tele: 0.5 },
    art: { body: 'knight', c1: '#5a4030', c2: '#e8d2a0', weapon: 'shield', eye: '#ffb85c' }, weight: 3,
    journal: 'The crypt keepers sealed themselves in tallow so they could stand watch forever. The wax kept their bodies. It did not keep their reasons.',
  },
  {
    id: 'catacombs_bonecarter', name: 'Bonecarter', area: 'catacombs', hp: 30, dmg: 1, glints: 7,
    size: [42, 40], behavior: 'thrower', params: { interval: 2.6, speed: 380, projArt: 'shard', color: '#e6dcc4' },
    art: { body: 'golem', c1: '#8a7356', c2: '#d9cdb0', eye: '#ffb85c' }, weight: 2,
    journal: 'Its whole life was carrying bones to the ossuary. Now it throws them at anyone who disturbs the stacks, then patiently picks them up again.',
  },
  {
    id: 'catacombs_snuffwing', name: 'Snuffwing', area: 'catacombs', hp: 20, dmg: 1, glints: 4,
    size: [34, 26], behavior: 'flyer', params: { speed: 90, sight: 320 },
    art: { body: 'moth', c1: '#3a2a22', c2: '#7a5a3a', c3: '#cdb48a', eye: '#ffcf7a', glow: true, centered: true },
    journal: 'A sooty moth that smothers candles with its wings and sits in the dark it makes. The keepers counted the wicks each night because of it.',
  },
  {
    id: 'catacombs_widowling', name: 'Widowling', area: 'catacombs', hp: 16, dmg: 1, glints: 3,
    size: [26, 20], behavior: 'wallcrawler', params: { speed: 60 },
    art: { body: 'spider', c1: '#2a1d16', c2: '#ffb85c', c3: '#4a3426', eyes: 4, eye: '#ffcf7a', glow: true },
    journal: 'One of the Wickwidow\'s many children. It spins thread from warm wax and walks the walls of the deep crypts, listening for its mother.',
  },
  {
    id: 'catacombs_taperfish', name: 'Sunken Taper', area: 'catacombs', hp: 24, dmg: 1, glints: 5,
    size: [36, 22], behavior: 'swimmer', params: { speed: 70, lunge: 340 },
    art: { body: 'fish', c1: '#5e5040', c2: '#e9d9b0', c3: '#ffcf7a', lure: true, teeth: true, centered: true }, light: 60,
    journal: 'When the cistern broke into the crypt, the drowned candles learned to swim. It keeps one flame lit on a stalk, and it is not for you.',
  },
];
