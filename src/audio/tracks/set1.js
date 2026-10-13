// Music set 1: The Fray, Spindletown, Mossbell Hollows, Glasswing Gardens, Tallow Catacombs,
// Hushwood, Cogwork Bastion, Gnarlknot, the early-boss theme and the victory stinger.
// Every track quotes Bead's Theme (5-1-3-2-1: `A4 . D5 . F5 E5 D5` in D minor), transposed / re-harmonized.

// ---------------------------------------------------------------- notation helpers
// ext('D5', 4) -> 'D5 - - -' ; ext('.', 3) -> '. . .'
const ext = (tok, n) => [tok, ...Array(n - 1).fill(tok === '.' ? '.' : '-')].join(' ');
// Durations: M('A4:4 D5:4 F5:2 E5:2 D5:4 | .:16') -> step tokens. A token without ':n' lasts 1 step.
const M = (s) => s.split('|').map((bar) => bar.trim().split(/\s+/).filter(Boolean).map((t) => {
  const i = t.lastIndexOf(':');
  return i < 0 ? t : ext(t.slice(0, i), +t.slice(i + 1));
}).join(' ')).join(' | ');
const J = (...parts) => parts.join(' | ');
// Shift every note name in a string by k octaves.
const oct = (s, k) => s.replace(/([A-G][#b]?)(-?\d)/g, (_, n, o) => n + (+o + k));
// Map an index pattern ('0! . 2 - 1 ?') onto a space-separated note list.
const arp = (notes, pat) => {
  const n = notes.split(' ');
  return pat.split(' ').map((p) => {
    const m = /^(\d)([!?]?)$/.exec(p);
    return m ? n[+m[1]] + m[2] : p;
  }).join(' ');
};
// Build a channel from a chord table and a bar list: 'Dm Bb Asus:8,A:8' (a bar may be split).
const comp = (T, bars, fn, barLen = 16) => bars.trim().split(/\s+/).map((bar) => {
  const parts = bar.split(',');
  return parts.map((part) => {
    const [name, l] = part.split(':');
    if (!T[name]) throw new Error('unknown chord ' + name);
    return fn(T[name], l ? +l : barLen / parts.length);
  }).join(' ');
}).join(' | ');
const rest = (bars, len = 16) => Array(bars).fill(ext('.', len)).join(' | ');

// ================================================================ THE FRAY
// D minor, 70 bpm. A music box finds Bead's Theme one fragment at a time:
// intro "A . D", A section "A D" + "F E D" apart, B the theme in Bb major, A' the whole theme.
const FR = {
  Dm: { h: 'D3 A3 D4 F4 A4', p: 'A3+D4+F4', b: 'D2' },
  Bbmaj7: { h: 'Bb2 F3 A3 D4 F4', p: 'A3+D4+F4', b: 'Bb1' },
  Gm6: { h: 'G2 D3 Bb3 E4 G4', p: 'Bb3+D4+E4', b: 'G1' },
  Gm: { h: 'G2 D3 G3 Bb3 D4', p: 'Bb3+D4+G4', b: 'G1' },
  A: { h: 'A2 E3 A3 C#4 E4', p: 'A3+C#4+E4', b: 'A1' },
  Asus: { h: 'A2 E3 A3 D4 E4', p: 'A3+D4+E4', b: 'A1' },
  'F/C': { h: 'C3 F3 A3 C4 F4', p: 'A3+C4+F4', b: 'C2' },
  'Gm/Bb': { h: 'Bb2 G3 Bb3 D4 G4', p: 'Bb3+D4+G4', b: 'Bb1' },
  C: { h: 'C3 G3 C4 E4 G4', p: 'G3+C4+E4', b: 'C2' },
  C7: { h: 'C3 G3 Bb3 E4 G4', p: 'Bb3+C4+E4', b: 'C2' },
  Am7: { h: 'A2 E3 G3 C4 E4', p: 'G3+C4+E4', b: 'A1' },
  Gm7: { h: 'G2 D3 F3 Bb3 D4', p: 'Bb3+D4+F4', b: 'G1' },
  Fmaj7: { h: 'F2 C3 A3 C4 E4', p: 'A3+C4+E4', b: 'F2' },
};
const frHarp = (pat16, pat8) => (c, len) => arp(c.h, len === 16 ? pat16 : pat8);
const frPad = (c, len) => ext(c.p, len);
const frBass = (c, len) => ext(c.b, len);
const frIntro = 'Dm Bbmaj7 Dm Asus:8,A:8';
const frA = 'Dm Bbmaj7 Gm A Dm F/C Gm/Bb Asus:8,A:8';
const frB = 'Bbmaj7 C Am7 Dm Gm7 C7 Fmaj7 Gm6:8,A:8';
const SPARSE = '0 . 1 . 2 . . . 3 . . . 4 . . .';
const FLOW = '0 . 1 . 2 . 3 . 4 . 3 . 2 . 1 .';
const FLOW_B = '0 . 2 . 1 . 3 . 2 . 4 . 3 . 1 .';
const HALF = '0 . 1 . 2 . 3 .';

const fray = {
  bpm: 70,
  vol: 0.74,
  inst: {
    celesta: { type: 'celesta', vol: 0.16, rev: 0.75, dly: 0.3, pan: 0.25 },
    harp: { type: 'harp', vol: 0.25, rev: 0.5, dly: 0.1, pan: -0.2, humanize: true },
    piano: { type: 'piano', vol: 0.36, rev: 0.55, dly: 0.15, pan: 0.05 },
    strings: { type: 'strings', vol: 0.1, rev: 0.7, attack: 1.4, release: 2, cutoff: 1600 },
    bass: { type: 'subbass', vol: 0.24 },
  },
  pat: {
    intro: {
      harp: comp(FR, frIntro, frHarp(SPARSE, '0 . 1 . 2 . . .')),
      celesta: M('.:8 A5:4 D6:4 | .:16 | .:8 A5:4 D6:4 | .:16'),
      strings: comp(FR, frIntro, frPad),
      bass: comp(FR, frIntro, frBass),
    },
    A: {
      harp: comp(FR, frA, frHarp(SPARSE, HALF)),
      piano: M('A4:4 D5:6 .:6 | .:4 F5:4 E5:2 D5:6 | .:4 Bb4:4 A4:2 G4:6 | .:2 E4:2 A4:4 C#5:8 |'
        + ' A4:4 D5:4 F5:8 | G5:4 F5:4 E5:2 C5:6 | D5:6 C5:2 Bb4:8 | A4:12 .:4'),
      celesta: M('.:16 | .:12 D6:4 | .:16 | .:12 E6:4 | .:16 | .:12 C6:4 | .:16 | .:12 E6:4'),
      strings: comp(FR, frA, frPad),
      bass: comp(FR, frA, frBass),
    },
    B: {
      harp: comp(FR, frB, frHarp(FLOW_B, HALF)),
      piano: M('F4:4 Bb4:4 D5:2 C5:2 Bb4:4 | C5:6 D5:2 E5:4 G5:4 | G5:4 E5:4 C5:2 D5:2 E5:4 | F5:4 D5:4 A4:8 |'
        + ' D5:4 G5:4 Bb5:2 A5:2 G5:4 | G5:4 E5:4 C5:4 E5:4 | F5:6 E5:2 C5:8 | Bb4:4 D5:4 C#5:4 E5:4'),
      celesta: M('.:12 D6:4 | .:12 C6:4 | .:12 A5:4 | .:8 A5:4 D6:4 | .:16 | .:12 C6:4 | .:8 A5:4 C6:4 | .:16'),
      strings: comp(FR, frB, frPad),
      bass: comp(FR, frB, frBass),
    },
    Ap: {
      harp: comp(FR, frA, frHarp(FLOW, HALF)),
      piano: M('A4:4 D5:4 F5:2 E5:2 D5:4 | A5:6 G5:2 F5:8 | G5:4 F5:2 D5:2 Bb4:4 D5:4 | A4:4 C#5:4 E5:8 |'
        + ' A4:4 D5:4 F5:2 E5:2 D5:4 | C5:4 F5:4 A5:2 G5:2 F5:4 | G5:4 D5:4 Bb4:2 C5:2 D5:4 | D5:8 C#5:8'),
      celesta: M('A5:4 D6:4 F6:2 E6:2 D6:4 | .:16 | .:16 | .:12 E6:4 |'
        + ' A5:4 D6:4 F6:2 E6:2 D6:4 | C6:4 F6:4 A6:2 G6:2 F6:4 | .:16 | .:16'),
      strings: comp(FR, frA, frPad),
      bass: comp(FR, frA, frBass),
    },
  },
  seq: ['intro', 'A', 'B', 'Ap'],
  loop: 1,
};

// ================================================================ SPINDLETOWN
// F major waltz (12-step bars), 84 bpm. Hook: A4 C5 F5 | E5 . D5 C5 over a falling bass F-E-D-C.
// Bar 5 quotes Bead's Theme (A D F | E D) in the home key's relative minor; D-minor bridge.
const TW = {
  F: { g: 'F2', c: 'A3+C4+F4', b: 'F2' },
  'C/E': { g: 'E2', c: 'G3+C4+E4', b: 'E2' },
  'Bb/D': { g: 'D3', c: 'F3+Bb3+D4', b: 'D2' },
  'F/C': { g: 'C3', c: 'A3+C4+F4', b: 'C2' },
  Dm: { g: 'D3', c: 'A3+D4+F4', b: 'D2' },
  Gm6: { g: 'G2', c: 'Bb3+D4+E4', b: 'G2' },
  C7: { g: 'C3', c: 'G3+Bb3+E4', b: 'C2' },
  'F7/Eb': { g: 'Eb3', c: 'A3+C4+F4', b: 'Eb2' },
  'Bbm7/Db': { g: 'Db3', c: 'F3+Ab3+Db4', b: 'Db2' },
  D7: { g: 'D3', c: 'F#3+A3+C4', b: 'D2' },
  Gm7: { g: 'G2', c: 'F3+Bb3+D4', b: 'G2' },
  'Bb/F': { g: 'F2', c: 'Bb3+D4+F4', b: 'F2' },
  'Dm/C': { g: 'C3', c: 'A3+D4+F4', b: 'C2' },
  Bbmaj7: { g: 'Bb2', c: 'A3+D4+F4', b: 'Bb1' },
  A7: { g: 'A2', c: 'G3+C#4+E4', b: 'A1' },
  'Gm/Bb': { g: 'Bb2', c: 'G3+Bb3+D4', b: 'Bb1' },
  Gm: { g: 'G2', c: 'G3+Bb3+D4', b: 'G2' },
  'Dm/F': { g: 'F2', c: 'A3+D4+F4', b: 'F2' },
  Em7b5: { g: 'E2', c: 'G3+Bb3+D4', b: 'E2' },
  Bb: { g: 'Bb2', c: 'Bb3+D4+F4', b: 'Bb1' },
  'Gm^': { g: 'G2', c: 'Bb3+D4+G4', b: 'G2' },
  'C7^': { g: 'C3', c: 'Bb3+C4+E4', b: 'C2' },
};
// oom-pah-pah: low string on beat 1, chord on beats 2 and 3
const twGuitar = (c, len) => (len === 12 ? `${c.g} - - - ${c.c} - - - ${c.c} - - -`
  : len === 8 ? `${c.g} - - - ${c.c} - - -` : `${c.c} - - -`);
const twBass = (c, len) => ext(c.b, len);
const twPad = (c, len) => ext(c.c, len);
const twIntro = 'F Bb/F F C7';
const twA = 'F C/E Bb/D F/C Dm Gm6 C7 C7 F F7/Eb Bb/D Bbm7/Db F/C D7 Gm7:8,C7:4 F';
const twB = 'Dm Dm/C Bbmaj7 A7 Dm Dm/C Gm/Bb A7 Gm Dm/F Em7b5 A7 Dm Bb Gm^ C7^';
const twHook = 'A4:4 C5:4 F5:4 | E5:6 D5:2 C5:4 | D5:6 C5:2 Bb4:4 | A4:12 |'
  + ' A4:4 D5:4 F5:4 | E5:4 D5:4 Bb4:4 | C5:4 E5:4 G5:4 | Bb5:6 A5:2 G5:4 |'
  + ' A5:4 F5:4 C5:4 | Eb5:6 D5:2 C5:4 | D5:4 F5:4 Bb5:4 | Ab5:6 F5:2 Db5:4 |'
  + ' C5:4 F5:4 A5:4 | F#5:6 E5:2 D5:4 | G5:4 D5:4 C5:2 Bb4:2 | A4:12';

const town = {
  bpm: 84,
  vol: 0.74,
  inst: {
    guitar: { type: 'guitar', vol: 0.3, rev: 0.3, pan: -0.25, strum: 0.025, humanize: true },
    bass: { type: 'bass', vol: 0.26, cutoff: 600 },
    lead: { type: 'lead', vol: 0.32, rev: 0.4, dly: 0.15, pan: 0.15 },
    piano: { type: 'piano', vol: 0.34, rev: 0.45, dly: 0.12, pan: 0.1 },
    strings: { type: 'strings', vol: 0.11, rev: 0.6, attack: 0.8, release: 1.5 },
  },
  pat: {
    intro: {
      guitar: comp(TW, twIntro, twGuitar, 12),
      bass: comp(TW, twIntro, twBass, 12),
      piano: M('A5:4 C6:4 F6:4 | D6:6 C6:2 Bb5:4 | .:12 | E5:4 G5:4 Bb5:4'),
    },
    A: {
      guitar: comp(TW, twA, twGuitar, 12),
      bass: comp(TW, twA, twBass, 12),
      lead: M(twHook),
      piano: M(`${rest(3, 12)} | .:4 C6:2 A5:2 F5:4 | ${rest(11, 12)} | .:4 C6:2 A5:2 F5:4`),
    },
    B: {
      guitar: comp(TW, twB, twGuitar, 12),
      bass: comp(TW, twB, twBass, 12),
      piano: M('D5:6 E5:2 F5:4 | A5:8 G5:2 F5:2 | F5:6 E5:2 D5:4 | C#5:8 E5:4 |'
        + ' D5:6 E5:2 F5:4 | A5:4 C6:4 A5:4 | Bb5:6 A5:2 G5:4 | A5:8 G5:4 |'
        + ' D5:4 G5:4 Bb5:4 | A5:8 F5:4 | G5:4 E5:4 D5:4 | C#5:6 D5:2 E5:4 |'
        + ' F5:6 E5:2 D5:4 | F5:6 D5:2 Bb4:4 | Bb4:4 D5:4 G5:4 | E5:6 C5:2 Bb4:4'),
      strings: comp(TW, twB, twPad, 12),
    },
    Ap: {
      guitar: comp(TW, twA, twGuitar, 12),
      bass: comp(TW, twA, twBass, 12),
      piano: M(twHook),
      // gentle counter-line under the piano
      lead: M('F4?:12 | G4?:12 | F4?:12 | C5?:12 | F4?:12 | G4?:12 | E4?:12 | E4?:4 F4?:4 G4?:4 |'
        + ' A4?:12 | A4?:12 | Bb4?:12 | Bb4?:6 Ab4?:6 | A4?:12 | A4?:6 C5?:6 | Bb4?:8 G4?:4 | F4?:12'),
      strings: comp(TW, twA, twPad, 12),
    },
  },
  seq: ['intro', 'A', 'B', 'Ap'],
  loop: 1,
};

// ================================================================ MOSSBELL HOLLOWS
// A minor, 88 bpm. Walking pizzicato 8ths, a cello hook (A3 E4 . D4 C4 | B3 C4 A3),
// old bells toll; in B the bells ring Bead's Theme in F major, D minor and A minor.
const HO = {
  Am: { z: 'A2 E3 A3 B3 C4 B3 A3 E3', b: 'A1', p: 'E3+A3+C4' },
  'Am^': { z: 'A2 E3 A3 B3 C4 B3 A3 E3', b: 'A1', p: 'A3+C4+E4' },
  F: { z: 'F2 C3 F3 G3 A3 G3 F3 C3', b: 'F1', p: 'F3+A3+C4' },
  E: { z: 'E2 B2 E3 G#3 B3 G#3 E3 B2', b: 'E1', p: 'E3+G#3+B3' },
  Dm: { z: 'D2 A2 D3 E3 F3 E3 D3 A2', b: 'D2', p: 'F3+A3+D4' },
  'Dm^': { z: 'D2 A2 D3 E3 F3 E3 D3 A2', b: 'D2', p: 'A3+D4+F4' },
  E7: { z: 'E2 B2 D3 E3 G#3 E3 D3 B2', b: 'E1', p: 'E3+G#3+D4' },
  'E7^': { z: 'E2 B2 D3 E3 G#3 E3 D3 B2', b: 'E1', p: 'G#3+D4+E4' },
  G: { z: 'G2 D3 G3 A3 B3 A3 G3 D3', b: 'G1', p: 'G3+B3+D4' },
  Em: { z: 'E2 B2 E3 G3 B3 G3 E3 B2', b: 'E1', p: 'G3+B3+E4' },
  'Am/C': { z: 'C3 E3 A3 B3 C4 B3 A3 E3', b: 'C2', p: 'A3+C4+E4' },
  Bm7b5: { z: 'B2 F3 A3 B3 D4 B3 A3 F3', b: 'B1', p: 'A3+D4+F4' },
  'C/E': { z: 'E2 C3 E3 G3 C4 G3 E3 C3', b: 'E1', p: 'G3+C4+E4' },
  Dm7: { z: 'D2 A2 C3 D3 F3 D3 C3 A2', b: 'D2', p: 'F3+A3+C4' },
};
const WALK = '0! . 1 . 2 . 3 . 4 . 5 . 6 . 7 .';
const hoPizz = (pat) => (c) => arp(c.z, pat);
const hoBass = (c, len) => ext(c.b, len);
const hoPad = (c, len) => ext(c.p, len);
const hoIntro = 'Am Am F E';
const hoA = 'Am Am F E Am Am Dm E7 F G Em Am^ Dm^ Am/C Bm7b5 E7^';
const hoB = 'F C/E Dm Am F C/E Dm7 E Am F Dm E7';
const hoHook = 'A3:4 E4:8 D4:2 C4:2 | B3:4 C4:4 A3:8 | A3:4 F4:8 E4:2 D4:2 | C4:4 B3:4 G#3:8 |'
  + ' A3:4 E4:8 D4:2 C4:2 | B3:4 C4:4 E4:8 | F4:4 E4:2 D4:2 A4:8 | G#4:6 E4:2 D4:4 B3:4 |'
  + ' A3:4 C4:4 F4:8 | B3:4 D4:4 G4:8 | B4:6 A4:2 G4:4 E4:4 | A4:4 E4:4 C4:8 |'
  + ' F4:6 E4:2 D4:4 A3:4 | E4:6 D4:2 C4:4 A3:4 | D4:4 F4:4 A4:6 G#4:2 | E4:8 D4:4 B3:4';

const hollows = {
  bpm: 88,
  vol: 0.76,
  inst: {
    pizz: { type: 'pluck', vol: 0.3, rev: 0.35, pan: -0.2, bright: 0.5, cutoff: 3000, humanize: true },
    cello: { type: 'strings', vol: 0.3, rev: 0.5, attack: 0.15, release: 0.6, cutoff: 1700, pan: 0.1 },
    bell: { type: 'bell', vol: 0.16, rev: 0.85, dly: 0.22, pan: 0.3 },
    bass: { type: 'subbass', vol: 0.22 },
    pad: { type: 'pad', vol: 0.1, rev: 0.7, attack: 1.2, release: 1.6, cutoff: 1100 },
  },
  pat: {
    intro: {
      pizz: comp(HO, hoIntro, hoPizz(WALK)),
      bass: comp(HO, hoIntro, hoBass),
      bell: M('A4?:16 | .:16 | C5?:16 | B4?:16'),
    },
    A: {
      pizz: comp(HO, hoA, hoPizz(WALK)),
      bass: comp(HO, hoA, hoBass),
      cello: M(hoHook),
      bell: M('A4?:16 | .:16 | C5?:16 | .:16 | E5?:16 | .:16 | D5?:16 | .:16 |'
        + ' C5?:16 | .:16 | B4?:16 | .:16 | D5?:16 | .:16 | B4?:16 | .:16'),
    },
    B: {
      pizz: comp(HO, hoB, hoPizz('0! . . . 2 . . . 4 . . . 2 . . .')),
      bass: comp(HO, hoB, hoBass),
      bell: M('C5:4 F5:4 A5:2 G5:2 F5:4 | G5:8 E5:8 | A4:4 D5:4 F5:2 E5:2 D5:4 | C5:8 A4:8 |'
        + ' C5:4 F5:4 A5:2 G5:2 F5:4 | G5:4 E5:4 C5:8 | A4:4 D5:4 F5:2 E5:2 D5:4 | G#4:8 B4:8 |'
        + ' E5:4 A5:4 C6:2 B5:2 A5:4 | C6:4 A5:4 F5:8 | F5:4 D5:4 A4:8 | E5:4 D5:4 B4:4 G#4:4'),
      cello: M('A3:16 | G3:16 | F3:16 | E3:16 | A3:8 C4:8 | G3:8 C4:8 | D4:8 C4:8 | B3:16 |'
        + ' C4:16 | A3:16 | A3:8 F3:8 | G#3:8 B3:4 D4:4'),
      pad: comp(HO, hoB, hoPad),
    },
    Ap: {
      pizz: comp(HO, hoA, hoPizz(WALK)),
      bass: comp(HO, hoA, hoBass),
      cello: M(hoHook),
      pad: comp(HO, hoA, hoPad),
      bell: M('A4?:16 | E5?:16 | C5?:16 | B4?:16 | A4?:16 | E5?:16 | D5?:16 | B4?:16 |'
        + ' C5?:16 | D5?:16 | B4?:16 | E5?:16 | D5?:16 | C5?:16 | B4?:16 | B4?:16'),
    },
  },
  seq: ['intro', 'A', 'B', 'Ap'],
  loop: 1,
};

// ================================================================ GLASSWING GARDENS
// E major / C# minor, 96 bpm. Rippling 16th harp, a soaring flute hook
// (G#5 . F#5 E5 B4 | D#5 . E5 F#5); the C# minor B section opens with Bead's Theme.
const GA = {
  E: { h: 'E3 B3 E4 G#4 B4', b: 'E2' },
  'B/D#': { h: 'D#3 B3 D#4 F#4 B4', b: 'D#2' },
  'C#m': { h: 'C#3 G#3 C#4 E4 G#4', b: 'C#2' },
  A: { h: 'A2 E3 A3 C#4 E4', b: 'A1' },
  'E/G#': { h: 'G#2 E3 B3 E4 G#4', b: 'G#1' },
  'F#m7': { h: 'F#2 C#3 A3 C#4 E4', b: 'F#1' },
  Bsus: { h: 'B2 F#3 B3 E4 F#4', b: 'B1' },
  B: { h: 'B2 F#3 B3 D#4 F#4', b: 'B1' },
  'G#m': { h: 'G#2 D#3 G#3 B3 D#4', b: 'G#1' },
  'F#m': { h: 'F#2 C#3 F#3 A3 C#4', b: 'F#1' },
  'G#7': { h: 'G#2 D#3 F#3 B#3 D#4', b: 'G#1' },
  B7: { h: 'B2 F#3 A3 D#4 F#4', b: 'B1' },
};
const RIPPLE = '0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1';
const RIPPLE_B = '0 2 1 3 2 4 3 1 0 2 1 3 2 4 3 1';
const gaHarp = (pat) => (c, len) => arp(c.h, len === 16 ? pat : pat.split(' ').slice(0, 8).join(' '));
const gaBass = (c, len) => (len === 16 ? `${c.b} - - - - - ${c.b} - - - ${c.b} - - - - -` : `${c.b} - - - - - ${c.b} -`);
const gaIntro = 'E C#m A Bsus:8,B:8';
const gaA = 'E B/D# C#m A E/G# A F#m7 Bsus:8,B:8 E B/D# C#m G#m A B A:8,F#m7:8 Bsus:8,B:8';
const gaB = 'C#m A E B C#m A F#m G#7 A B G#m C#m F#m7 G#7 A B7';
const gaHook = 'G#5:6 F#5:2 E5:4 B4:4 | D#5:6 E5:2 F#5:8 | E5:6 D#5:2 C#5:4 G#4:4 | A4:4 B4:4 C#5:8 |'
  + ' B4:4 E5:4 G#5:4 B5:4 | A5:6 G#5:2 E5:4 C#5:4 | F#5:6 E5:2 C#5:4 A4:4 | E5:8 D#5:8 |'
  + ' G#5:6 F#5:2 E5:4 B4:4 | D#5:6 E5:2 F#5:8 | G#5:6 F#5:2 E5:4 C#5:4 | D#5:6 C#5:2 B4:8 |'
  + ' C#5:4 E5:4 A5:8 | B5:6 A5:2 F#5:8 | E5:4 C#5:2 E5:2 F#5:4 A5:4 | F#5:6 E5:2 D#5:8';
const gaPadA = M('G#3+B3+E4:16 | F#3+B3+D#4:16 | G#3+C#4+E4:16 | A3+C#4+E4:16 | G#3+B3+E4:16 | A3+C#4+E4:16 |'
  + ' A3+C#4+E4:16 | B3+E4+F#4:8 B3+D#4+F#4:8 | G#3+B3+E4:16 | F#3+B3+D#4:16 | G#3+C#4+E4:16 | G#3+B3+D#4:16 |'
  + ' A3+C#4+E4:16 | B3+D#4+F#4:16 | A3+C#4+E4:16 | B3+E4+F#4:8 B3+D#4+F#4:8');
const gaDrumA = 'k+x . x? . x . x? . k? . x? . x . x? x?';

const gardens = {
  bpm: 96,
  vol: 0.74,
  inst: {
    harp: { type: 'harp', vol: 0.22, rev: 0.45, dly: 0.08, pan: -0.2, humanize: true },
    flute: { type: 'flute', vol: 0.34, rev: 0.5, dly: 0.18, pan: 0.15 },
    strings: { type: 'strings', vol: 0.12, rev: 0.6, attack: 0.9, release: 1.4 },
    bass: { type: 'subbass', vol: 0.26 },
    drums: { type: 'drums', vol: 0.3, rev: 0.2 },
    piano: { type: 'piano', vol: 0.24, rev: 0.5, pan: -0.05, oct: -1 },
  },
  pat: {
    intro: {
      harp: comp(GA, gaIntro, gaHarp(RIPPLE)),
      bass: comp(GA, gaIntro, gaBass),
      strings: M('G#3+B3+E4:16 | G#3+C#4+E4:16 | A3+C#4+E4:16 | B3+E4+F#4:8 B3+D#4+F#4:8'),
      drums: J(rest(3), 'x? . x? . x . x? . x . x? . x x? x x'),
    },
    A: {
      harp: comp(GA, gaA, gaHarp(RIPPLE)),
      bass: comp(GA, gaA, gaBass),
      flute: M(gaHook),
      strings: gaPadA,
      drums: gaDrumA,
    },
    B: {
      harp: comp(GA, gaB, gaHarp(RIPPLE_B)),
      bass: comp(GA, gaB, gaBass),
      flute: M('G#4:4 C#5:4 E5:2 D#5:2 C#5:4 | E5:4 A5:6 G#5:2 E5:4 | G#5:6 F#5:2 E5:4 B4:4 | D#5:8 F#5:8 |'
        + ' G#4:4 C#5:4 E5:2 D#5:2 C#5:4 | E5:4 A5:4 C#6:8 | C#6:6 B5:2 A5:4 F#5:4 | G#5:12 F#5:4 |'
        + ' E5:4 C#5:2 E5:2 A5:8 | F#5:4 D#5:2 F#5:2 B5:8 | B5:6 G#5:2 D#5:8 | E5:6 D#5:2 C#5:8 |'
        + ' A5:4 F#5:4 C#5:4 E5:4 | F#5:6 D#5:2 B#4:8 | C#5:4 E5:4 A5:6 G#5:2 | F#5:4 D#5:4 B4:4 F#5:4'),
      strings: M('G#3+C#4+E4:16 | A3+C#4+E4:16 | G#3+B3+E4:16 | F#3+B3+D#4:16 | G#3+C#4+E4:16 | A3+C#4+E4:16 |'
        + ' A3+C#4+F#4:16 | G#3+B#3+F#4:16 | A3+C#4+E4:16 | B3+D#4+F#4:16 | B3+D#4+G#4:16 | C#4+E4+G#4:16 |'
        + ' C#4+E4+A4:16 | B#3+D#4+F#4:16 | C#4+E4+A4:16 | B3+D#4+A4:16'),
      drums: 'k+x . x? t? x . x? . k+x . T? . x t? x? x?',
    },
    Ap: {
      harp: comp(GA, gaA, gaHarp(RIPPLE)),
      bass: comp(GA, gaA, gaBass),
      flute: M(gaHook),
      piano: M(gaHook),
      strings: gaPadA,
      drums: gaDrumA,
    },
  },
  seq: ['intro', 'A', 'B', 'Ap'],
  loop: 1,
};

// ================================================================ TALLOW CATACOMBS
// C minor candlelit waltz (12-step bars), 72 bpm. Organ hook with a flickering neighbor note
// (G4 . Ab4 G4 | Eb5 . D5 C5); a music box plays Bead's Theme in B over half-diminished harmony.
const CA = {
  Cm: { l: 'C3', c: 'G3+C4+Eb4', b: 'C2' },
  Ab: { l: 'Ab2', c: 'Ab3+C4+Eb4', b: 'Ab1' },
  G: { l: 'G2', c: 'G3+B3+D4', b: 'G1' },
  Fm: { l: 'F2', c: 'Ab3+C4+F4', b: 'F1' },
  'Cm/Eb': { l: 'Eb3', c: 'G3+C4+Eb4', b: 'Eb2' },
  Dm7b5: { l: 'D3', c: 'Ab3+C4+F4', b: 'D2' },
  G7: { l: 'G2', c: 'G3+B3+F4', b: 'G1' },
  'Cm/Bb': { l: 'Bb2', c: 'G3+C4+Eb4', b: 'Bb1' },
  Db: { l: 'Db3', c: 'Ab3+Db4+F4', b: 'Db2' },
  Eb: { l: 'Eb3', c: 'G3+Bb3+Eb4', b: 'Eb2' },
  'Bb/D': { l: 'D3', c: 'F3+Bb3+D4', b: 'D2' },
  Bb7: { l: 'Bb2', c: 'Ab3+D4+F4', b: 'Bb1' },
  'Dm7b5/Ab': { l: 'Ab2', c: 'C4+D4+F4', b: 'Ab1' },
  'Fm^': { l: 'F2', c: 'C4+F4+Ab4', b: 'F1' },
  'G^': { l: 'G2', c: 'B3+D4+G4', b: 'G1' },
  'Cm^': { l: 'C3', c: 'C4+Eb4+G4', b: 'C2' },
  'Db^': { l: 'Db3', c: 'Db4+F4+Ab4', b: 'Db2' },
  'G7^': { l: 'G2', c: 'B3+D4+F4', b: 'G1' },
};
const caHarp = (c) => `${c.l} - - - ${c.c} - - - ${c.c} - - -`;
const caBass = (c, len) => ext(c.b, len);
const caPad = (suffix = '') => (c, len) => ext(c.c + suffix, len);
const caIntro = 'Cm Cm Ab G';
const caA = 'Cm Cm Ab G Fm Cm/Eb Dm7b5 G7 Cm Cm/Bb Ab G Fm Db G7 Cm';
const caB1 = 'Eb Bb/D Cm Ab Fm Bb7 Eb G7';
const caB2 = 'Cm^ Dm7b5/Ab Fm^ G^ Cm^ Dm7b5/Ab Db^ G7^';
const caHook = 'G4:6 Ab4:2 G4:4 | Eb5:8 D5:2 C5:2 | C5:6 Bb4:2 Ab4:4 | B4:12 |'
  + ' C5:6 Db5:2 C5:4 | G5:8 F5:2 Eb5:2 | F5:6 Eb5:2 D5:4 | B4:6 C5:2 D5:4 |'
  + ' G4:6 Ab4:2 G4:4 | Eb5:8 D5:2 C5:2 | Ab5:6 G5:2 Eb5:4 | D5:12 |'
  + ' C5:4 F5:4 Ab5:4 | F5:6 Eb5:2 Db5:4 | B4:4 D5:4 F5:4 | Eb5:12';

const catacombs = {
  bpm: 72,
  vol: 0.74,
  inst: {
    harp: { type: 'harp', vol: 0.24, rev: 0.55, pan: -0.25, strum: 0.03, humanize: true },
    organ: { type: 'organ', vol: 0.26, rev: 0.65, dly: 0.12, pan: 0.1 },
    choir: { type: 'choir', vol: 0.13, rev: 0.8, attack: 0.9, release: 1.6 },
    bass: { type: 'subbass', vol: 0.24 },
    celesta: { type: 'celesta', vol: 0.18, rev: 0.75, dly: 0.25, pan: 0.3 },
  },
  pat: {
    intro: {
      harp: comp(CA, caIntro, caHarp, 12),
      bass: comp(CA, caIntro, caBass, 12),
      choir: comp(CA, caIntro, caPad(), 12),
      celesta: M('.:12 | .:8 G5?:4 | .:12 | .:8 B5?:4'),
    },
    A: {
      harp: comp(CA, caA, caHarp, 12),
      bass: comp(CA, caA, caBass, 12),
      choir: comp(CA, caA, caPad(), 12),
      organ: M(caHook),
    },
    B: {
      harp: comp(CA, `${caB1} ${caB2}`, caHarp, 12),
      bass: comp(CA, `${caB1} ${caB2}`, caBass, 12),
      organ: J(comp(CA, caB1, caPad('?'), 12), rest(8, 12)),
      choir: J(rest(8, 12), comp(CA, caB2, caPad(), 12)),
      celesta: M('G5:6 F5:2 Eb5:4 | F5:6 Eb5:2 D5:4 | Eb5:6 D5:2 C5:4 | C5:4 Eb5:4 Ab5:4 |'
        + ' Ab5:6 G5:2 F5:4 | D5:4 F5:4 Ab5:4 | G5:12 | F5:4 D5:4 B4:4 |'
        + ' G4:4 C5:4 Eb5:4 | D5:4 C5:8 | C5:4 F5:4 Ab5:4 | G5:6 F5:2 D5:4 |'
        + ' G4:4 C5:4 Eb5:4 | F5:4 D5:4 C5:4 | Db5:6 F5:2 Ab5:4 | G5:6 F5:2 D5:2 B4:2'),
    },
    Ap: {
      harp: comp(CA, caA, caHarp, 12),
      bass: comp(CA, caA, caBass, 12),
      choir: comp(CA, caA, caPad(), 12),
      organ: M(caHook),
      celesta: J(rest(8, 12), M(oct(caHook.split('|').slice(8).join('|'), 1))),
    },
  },
  seq: ['intro', 'A', 'B', 'Ap'],
  loop: 1,
};

// ================================================================ HUSHWOOD
// F# minor lullaby in 6/8 (12-step bars), 64 bpm. Rocking kalimba, a breathing pad, breathy flute;
// the B section sings Bead's Theme as a Lydian-tinged lullaby over Dmaj7.
const HU = {
  'F#m9': { k: 'F#4 A4 C#5 G#5', p: 'A3+C#4+G#4', b: 'F#2' },
  Dmaj7: { k: 'D4 A4 C#5 F#5', p: 'A3+C#4+F#4', b: 'D2' },
  Amaj7: { k: 'A3 E4 G#4 C#5', p: 'G#3+C#4+E4', b: 'A1' },
  'C#sus': { k: 'C#4 G#4 C#5 F#5', p: 'G#3+C#4+F#4', b: 'C#2' },
  'C#': { k: 'C#4 G#4 C#5 E#5', p: 'G#3+C#4+E#4', b: 'C#2' },
  'F#m': { k: 'F#4 A4 C#5 F#5', p: 'A3+C#4+F#4', b: 'F#2' },
  Bm7: { k: 'B3 F#4 A4 D5', p: 'A3+D4+F#4', b: 'B1' },
  'C#7': { k: 'C#4 G#4 B4 E#5', p: 'G#3+B3+E#4', b: 'C#2' },
  'F#m/C#': { k: 'C#4 F#4 A4 C#5', p: 'A3+C#4+F#4', b: 'C#2' },
  E: { k: 'E4 G#4 B4 E5', p: 'G#3+B3+E4', b: 'E2' },
};
const ROCK = '0 . 1 . 2 . 3 . 2 . 1 .';
const ROCK_B = '0 . 2 . 1 . 3 . 1 . 2 .';
const huKal = (pat) => (c, len) => arp(c.k, len === 12 ? pat : pat.split(' ').slice(0, 6).join(' '));
const huPad = (c, len) => ext(c.p, len);
const huBass = (c, len) => ext(c.b, len);
const huIntro = 'F#m9 Dmaj7 Bm7 C#sus:6,C#:6';
const huA1 = 'F#m9 Dmaj7 Amaj7 C#sus:6,C#:6 F#m Dmaj7 Bm7 C#7';
const huA2 = 'Dmaj7 Amaj7 Bm7 F#m/C# Dmaj7 E C#sus:6,C#:6 C#7';
const huB = 'Dmaj7 F#m/C# Bm7 E Dmaj7 F#m/C# Bm7 C#7';
const huMel1 = 'C#5:4 B4:2 A4:6 | A4:4 B4:2 C#5:6 | E5:6 C#5:6 | G#4:8 .:4 |'
  + ' C#5:4 B4:2 A4:6 | A4:4 B4:2 F#5:6 | D5:4 C#5:2 B4:6 | B4:6 G#4:6';
const huMel2 = 'F#5:4 E5:2 C#5:6 | E5:4 C#5:2 A4:6 | D5:4 B4:2 F#4:6 | A4:4 B4:2 C#5:6 |'
  + ' F#5:6 A5:6 | G#5:4 F#5:2 E5:6 | F#5:6 E#5:6 | B4:6 G#4:6';

const hushwood = {
  bpm: 64,
  vol: 0.76,
  inst: {
    kalimba: { type: 'kalimba', vol: 0.18, rev: 0.6, dly: 0.25, pan: -0.25, humanize: true },
    pad: { type: 'pad', vol: 0.13, rev: 0.8, attack: 1.6, release: 2.2, cutoff: 1200, detune: 9 },
    flute: { type: 'flute', vol: 0.3, rev: 0.6, dly: 0.2, pan: 0.15 },
    bass: { type: 'subbass', vol: 0.2 },
    marimba: { type: 'marimba', vol: 0.2, rev: 0.5, pan: 0.05 },
  },
  pat: {
    intro: {
      kalimba: comp(HU, huIntro, huKal(ROCK), 12),
      pad: comp(HU, huIntro, huPad, 12),
      bass: comp(HU, huIntro, huBass, 12),
    },
    A: {
      kalimba: comp(HU, `${huA1} ${huA2}`, huKal(ROCK), 12),
      pad: comp(HU, `${huA1} ${huA2}`, huPad, 12),
      bass: comp(HU, `${huA1} ${huA2}`, huBass, 12),
      flute: M(`${huMel1} | ${huMel2}`),
    },
    B: {
      kalimba: comp(HU, huB, huKal(ROCK_B), 12),
      pad: comp(HU, huB, huPad, 12),
      bass: comp(HU, huB, huBass, 12),
      flute: M('C#5:4 F#5:2 A5:4 G#5:2 | F#5:12 | B4:4 D5:2 F#5:4 E5:2 | B4:6 G#4:6 |'
        + ' C#5:4 F#5:2 A5:4 G#5:2 | F#5:4 C#5:2 A4:6 | D5:6 C#5:2 B4:4 | C#5:6 G#4:6'),
      marimba: M('D3:6 A3:6 | C#3:6 F#3:6 | B2:6 F#3:6 | E3:6 B3:6 | D3:6 A3:6 | C#3:6 F#3:6 | B2:6 F#3:6 | C#3:6 G#3:6'),
    },
    Ap: {
      kalimba: comp(HU, huA1, huKal(ROCK_B), 12),
      pad: comp(HU, huA1, huPad, 12),
      bass: comp(HU, huA1, huBass, 12),
      flute: M(huMel1),
      marimba: M(oct(huMel1, -1)),
    },
  },
  seq: ['intro', 'A', 'B', 'Ap'],
  loop: 1,
};

// ================================================================ COGWORK BASTION
// G minor, 112 bpm. Marimba gears turning in 3+3+3+3+2+2, strings and bass hammering 3+3+2,
// taiko and rim ticks; a heroic saw hook in 3+3+2 that crowns itself with Bead's Theme (bar 13).
const BA = {
  Gm: { m: ['G3', 'D4', 'G4', 'Bb4', 'A4'], s: 'G3+Bb3+D4', b: 'G1' },
  Eb: { m: ['Eb3', 'Bb3', 'Eb4', 'G4', 'F4'], s: 'G3+Bb3+Eb4', b: 'Eb2' },
  F: { m: ['F3', 'C4', 'F4', 'A4', 'G4'], s: 'F3+A3+C4', b: 'F1' },
  D: { m: ['D3', 'A3', 'D4', 'F#4', 'E4'], s: 'F#3+A3+D4', b: 'D2' },
  Cm: { m: ['C3', 'G3', 'C4', 'Eb4', 'D4'], s: 'G3+C4+Eb4', b: 'C2' },
  Bb: { m: ['Bb2', 'F3', 'Bb3', 'D4', 'C4'], s: 'F3+Bb3+D4', b: 'Bb1' },
  Dm: { m: ['D3', 'A3', 'D4', 'F4', 'E4'], s: 'F3+A3+D4', b: 'D2' },
  'Gm/Bb': { m: ['Bb2', 'G3', 'Bb3', 'D4', 'A3'], s: 'G3+Bb3+D4', b: 'Bb1' },
  D7: { m: ['D3', 'A3', 'D4', 'F#4', 'C4'], s: 'F#3+A3+C4', b: 'D2' },
};
// groups of 3,3,3,3,2,2 sixteenths
const baGears = (c) => {
  const [r, f, o, x, y] = c.m;
  return `${r}! ${f} ${o} ${r}! ${f} ${x} ${r}! ${f} ${o} ${r}! ${f} ${y} ${f}! ${o} ${x}! ${o}`;
};
const baHammer = (c) => `${c.s}! - - ${c.s} - - ${c.s} - ${c.s}! - - ${c.s} - - ${c.s} -`;
const baBass = (c) => {
  const hi = oct(c.b, 1);
  return `${c.b}! - - ${c.b} - - ${hi} - ${c.b}! - - ${c.b} - - ${hi} -`;
};
const baIntro = 'Gm Gm Eb D';
const baA = 'Gm Gm Eb F Gm Gm Eb D Cm Bb Eb F Gm Eb Cm D';
const baB = 'Eb F Dm Gm Eb F Bb D Eb Cm Gm/Bb D Eb F Cm D7';
const baHook = 'G4:3 Bb4:3 D5:2 G5:6 F5:2 | D5:3 Bb4:3 C5:2 D5:8 | Eb5:3 D5:3 C5:2 Bb4:6 G4:2 | A4:3 Bb4:3 C5:2 F5:8 |'
  + ' G4:3 Bb4:3 D5:2 G5:6 F5:2 | Bb5:3 A5:3 G5:2 D5:8 | Eb5:3 F5:3 G5:2 Bb5:6 G5:2 | A5:8 F#5:8 |'
  + ' G5:3 Eb5:3 C5:2 G5:8 | F5:3 D5:3 Bb4:2 F5:8 | G5:3 Eb5:3 Bb4:2 G5:4 Bb5:4 | A5:6 G5:2 F5:4 C5:4 |'
  + ' D5:4 G5:4 Bb5:2 A5:2 G5:4 | G5:3 F5:3 Eb5:2 Bb4:8 | C5:3 D5:3 Eb5:2 G5:8 | A5:8 F#5:4 D5:4';

const bastion = {
  bpm: 112,
  vol: 0.72,
  inst: {
    marimba: { type: 'marimba', vol: 0.26, rev: 0.25, pan: -0.2 },
    drums: { type: 'drums', vol: 0.42, rev: 0.2 },
    strings: { type: 'strings', vol: 0.15, rev: 0.35, attack: 0.03, release: 0.2, legato: 0.85, pan: 0.15 },
    lead: { type: 'saw', vol: 0.42, rev: 0.35, dly: 0.15, cutoff: 2400 },
    bass: { type: 'bass', vol: 0.3, legato: 0.8 },
  },
  pat: {
    intro: {
      marimba: comp(BA, baIntro, baGears),
      drums: J(rest(2).replace(/^\./, 'b'), 'r . . r . . r . r . . r . . r .', 'b . . r . . b . r . . b . . r r'),
      bass: J(rest(2), comp(BA, 'Eb D', baBass)),
    },
    A: {
      marimba: comp(BA, baA, baGears),
      strings: comp(BA, baA, baHammer),
      bass: comp(BA, baA, baBass),
      lead: M(baHook),
      drums: 'b . r? r . r? b . s . r? b . r? s r',
    },
    B: {
      marimba: comp(BA, baB, baGears),
      strings: M('G3+Bb3+Eb4:16 | A3+C4+F4:16 | A3+D4+F4:16 | Bb3+D4+G4:16 | Bb3+Eb4+G4:16 | A3+C4+F4:16 |'
        + ' Bb3+D4+F4:16 | A3+D4+F#4:16 | Bb3+Eb4+G4:16 | G3+C4+Eb4:16 | G3+Bb3+D4:16 | F#3+A3+D4:16 |'
        + ' G3+Bb3+Eb4:16 | A3+C4+F4:16 | G3+C4+Eb4:16 | F#3+A3+C4:16'),
      bass: comp(BA, baB, baBass),
      lead: M('Bb4:6 Eb5:2 G5:8 | F5:6 Eb5:2 C5:8 | D5:6 F5:2 A5:8 | G5:12 D5:4 |'
        + ' Eb5:6 G5:2 Bb5:8 | A5:6 G5:2 F5:8 | D5:6 F5:2 Bb5:8 | A5:8 F#5:4 D5:4 |'
        + ' G5:6 F5:2 Eb5:4 Bb4:4 | C5:6 D5:2 Eb5:4 G5:4 | Bb5:6 A5:2 G5:4 D5:4 | F#5:6 G5:2 A5:8 |'
        + ' Bb5:8 G5:4 Eb5:4 | A5:8 F5:4 C5:4 | C5:4 Eb5:4 G5:8 | F#5:4 A5:4 C6:4 A5:4'),
      drums: J('b . . r . . r . s . . r . . r .', 'b . . r . . r . s . . r . . r .',
        'b . . r . . r . s . . r . . r .', 'b . . r . . b . s . b . s s s s'),
    },
    Ap: {
      marimba: comp(BA, baA, baGears),
      strings: comp(BA, baA, baHammer),
      bass: comp(BA, baA, baBass),
      lead: M(baHook),
      drums: 'b+k . h r+k . h b+k . s+h . r b+k . h s+k s',
    },
  },
  seq: ['intro', 'A', 'B', 'Ap'],
  loop: 1,
};

// ================================================================ BOSS: GNARLKNOT
// D minor, 140 bpm. Pounding 16th string ostinato, and a piano hook that is Bead's Theme
// in diminution (A D F E D A), then sequenced through Bb and C; B section augments it.
const GN = {
  Dm: { o: ['D3', 'A3', 'D4', 'F4'], b: 'D2', c: 'D4+F4+A4' },
  Bb: { o: ['Bb2', 'F3', 'Bb3', 'D4'], b: 'Bb1', c: 'D4+F4+Bb4' },
  C: { o: ['C3', 'G3', 'C4', 'E4'], b: 'C2', c: 'C4+E4+G4' },
  A: { o: ['A2', 'E3', 'A3', 'C#4'], b: 'A1', c: 'C#4+E4+A4' },
  Gm: { o: ['G2', 'D3', 'G3', 'Bb3'], b: 'G1', c: 'D4+G4+Bb4' },
  F: { o: ['F2', 'C3', 'F3', 'A3'], b: 'F1', c: 'C4+F4+A4' },
  Eb: { o: ['Eb3', 'Bb3', 'Eb4', 'G4'], b: 'Eb2', c: 'Bb3+Eb4+G4' },
  A7: { o: ['A2', 'E3', 'A3', 'C#4'], b: 'A1', c: 'A3+C#4+G4' },
};
const gnOst = (c) => {
  const [r, f, o, t] = c.o;
  return `${r}! ${r} ${o} ${r} ${f} ${r} ${o} ${r} ${r}! ${r} ${o} ${r} ${t} ${o} ${f} ${o}`;
};
const gnBass = (c) => {
  const hi = oct(c.b, 1);
  return `${c.b}! . ${c.b} . ${hi} . ${c.b} . ${c.b}! . ${c.b} . ${hi} . ${c.b} ${c.b}`;
};
const gnIntro = 'Dm Dm Bb A';
const gnA = 'Dm Bb C A Dm Bb Gm A Dm Bb F C Gm Bb A A';
const gnB = 'Bb Bb Gm A Bb C Dm A Gm Gm Eb A Gm Bb Eb A7';
const gnHook = 'A4!:2 D5:2 F5:2 E5:2 D5:4 A4:4 | D5!:2 F5:2 Bb5:2 A5:2 F5:4 D5:4 | E5!:2 G5:2 C6:2 Bb5:2 G5:4 E5:4 |'
  + ' A5!:4 G5:2 F5:2 E5:4 C#5:4 | A4!:2 D5:2 F5:2 E5:2 D5:4 A4:4 | D5!:2 F5:2 Bb5:2 A5:2 F5:4 D5:4 |'
  + ' G5!:2 Bb5:2 D6:2 C6:2 Bb5:4 G5:4 | A5!:4 E5:4 C#5:2 D5:2 E5:4 | A5!:2 D6:2 F6:2 E6:2 D6:4 A5:4 |'
  + ' Bb5!:4 F5:4 D5:4 F5:4 | C6!:2 A5:2 F5:2 A5:2 C6:4 A5:4 | G5!:4 E5:4 C5:4 E5:4 |'
  + ' Bb5!:2 A5:2 G5:2 A5:2 Bb5:4 D6:4 | D6!:4 C6:2 Bb5:2 F5:8 | C#6!:4 B5:2 A5:2 E5:4 G5:4 |'
  + ' A5!:2 G5:2 F5:2 E5:2 C#5:4 A4:4';
const gnDrumA = 'k . h . s . h k k . h k s . h h';

const bossGnarlknot = {
  bpm: 140,
  vol: 0.72,
  inst: {
    strings: { type: 'strings', vol: 0.16, rev: 0.3, attack: 0.02, release: 0.12, legato: 0.7, pan: -0.15 },
    piano: { type: 'piano', vol: 0.42, rev: 0.35, dly: 0.1, pan: 0.15 },
    drums: { type: 'drums', vol: 0.5, rev: 0.15 },
    bass: { type: 'bass', vol: 0.32, legato: 0.7 },
    choir: { type: 'choir', vol: 0.14, rev: 0.6, attack: 0.3, release: 0.8 },
  },
  pat: {
    intro: {
      strings: comp(GN, gnIntro, gnOst),
      drums: J('b . . . . . . . b . . . . . . .', 'b . . . . . . . b . . . b . b .',
        'b . . . s . . . b . . . s . . .', 'b . s . b . s . s s s s s s s s'),
      bass: J(rest(2), comp(GN, 'Bb A', gnBass)),
      piano: M('.:16 | .:16 | .:16 | A3!:2 D4:2 F4:2 E4:2 D4:4 C#4:4'),
    },
    A: {
      strings: comp(GN, gnA, gnOst),
      bass: comp(GN, gnA, gnBass),
      piano: M(gnHook),
      drums: gnDrumA,
    },
    B: {
      strings: comp(GN, gnB, gnOst),
      bass: comp(GN, gnB, gnBass),
      piano: M('F5!:8 Bb5:8 | D6!:4 C6:4 Bb5:8 | Bb5!:4 A5:2 G5:2 D5:8 | E5!:4 C#5:4 A4:8 |'
        + ' F5!:8 Bb5:8 | C6!:4 Bb5:4 G5:8 | A5!:4 F5:4 D5:8 | C#5!:4 E5:4 A5:8 |'
        + ' D5!:4 G5:4 Bb5:8 | A5!:4 G5:4 D5:8 | G5!:4 Bb5:4 Eb6:8 | C#6!:8 A5:8 |'
        + ' Bb5!:4 A5:2 G5:2 D5:8 | F5!:4 D5:4 Bb4:8 | G5!:4 Eb5:4 Bb4:8 | A4!:4 C#5:4 E5:4 G5:4'),
      choir: M('Bb3+D4+F4:16 | Bb3+D4+F4:16 | Bb3+D4+G4:16 | A3+C#4+E4:16 | Bb3+D4+F4:16 | Bb3+C4+E4:16 |'
        + ' A3+D4+F4:16 | A3+C#4+E4:16 | Bb3+D4+G4:16 | Bb3+D4+G4:16 | Bb3+Eb4+G4:16 | A3+C#4+E4:16 |'
        + ' Bb3+D4+G4:16 | Bb3+D4+F4:16 | Bb3+Eb4+G4:16 | A3+C#4+G4:16'),
      drums: J('b . h . s . h . k . h . s . h .', 'b . h . s . h . k . h k s s s s'),
    },
    Ap: {
      strings: comp(GN, gnA, gnOst),
      bass: comp(GN, gnA, gnBass),
      piano: M(gnHook),
      choir: comp(GN, gnA, (c, len) => ext(c.c, len)),
      drums: gnDrumA,
    },
  },
  seq: ['intro', 'A', 'B', 'Ap'],
  loop: 1,
};

// ================================================================ BOSS (early-game generic)
// E minor, 150 bpm. Galloping string ostinato, choir stabs in 3+3+2, and a saw hook that opens
// with Bead's Theme syncopated (B4 . . E5 . . G5 . F#5 . E5 . B4).
const BO = {
  Em: { o: ['E3', 'B3', 'E4', 'G3'], b: 'E2', c: 'E4+G4+B4' },
  C: { o: ['C3', 'G3', 'C4', 'E3'], b: 'C2', c: 'E4+G4+C5' },
  D: { o: ['D3', 'A3', 'D4', 'F#3'], b: 'D2', c: 'F#4+A4+D5' },
  B: { o: ['B2', 'F#3', 'B3', 'D#3'], b: 'B1', c: 'F#4+B4+D#5' },
  Am: { o: ['A2', 'E3', 'A3', 'C4'], b: 'A1', c: 'E4+A4+C5' },
  B7: { o: ['B2', 'F#3', 'B3', 'D#4'], b: 'B1', c: 'F#4+A4+D#5' },
  Bm: { o: ['B2', 'F#3', 'B3', 'D4'], b: 'B1', c: 'F#4+B4+D5' },
  G: { o: ['G2', 'D3', 'G3', 'B3'], b: 'G1', c: 'G4+B4+D5' },
  'F#m7b5': { o: ['F#3', 'C4', 'F#4', 'A3'], b: 'F#2', c: 'F#4+A4+C5' },
};
const boGallop = (c) => {
  const [r, f, o, t] = c.o;
  return `${r}! . ${r} ${r} ${f} . ${r} ${r} ${o} . ${r} ${r} ${t} . ${f} ${f}`;
};
const boDrive = (c) => {
  const [r, f, o, t] = c.o;
  return `${r}! ${o} ${f} ${o} ${r} ${o} ${f} ${o} ${t} ${o} ${f} ${o} ${r} ${o} ${f} ${o}`;
};
const boStab = (c) => `${c.c}! - . ${c.c} - . ${c.c} - . . . . ${c.c}! - . .`;
const boBass = (c) => {
  const hi = oct(c.b, 1);
  return `${c.b}! - - ${c.b} - - ${hi} - ${c.b}! - - ${c.b} - - ${hi} -`;
};
const boIntro = 'Em Em C B';
const boA = 'Em C D B Em C Am B7 C D Bm Em Am C F#m7b5 B7';
const boB = 'C D Bm Em C D G B7 Am Em C B Am C D B7';
const boHook = 'B4!:3 E5:3 G5:2 F#5:2 E5:2 B4:4 | C5!:3 E5:3 G5:2 A5:2 G5:2 E5:4 | D5!:3 F#5:3 A5:2 G5:2 F#5:2 D5:4 |'
  + ' D#5!:3 F#5:3 B5:2 A5:2 F#5:2 D#5:4 | B4!:3 E5:3 G5:2 F#5:2 E5:2 B4:4 | C5!:3 E5:3 G5:2 A5:2 G5:2 E5:4 |'
  + ' A5!:3 G5:3 E5:2 A5:2 C6:2 A5:4 | B5!:4 A5:4 F#5:4 D#5:4 | G5!:3 E5:3 C5:2 G5:8 | A5!:3 F#5:3 D5:2 A5:8 |'
  + ' B5!:3 F#5:3 D5:2 F#5:4 A5:4 | G5!:6 F#5:2 E5:8 | E5!:3 A5:3 C6:2 B5:2 A5:2 E5:4 |'
  + ' G5!:3 E5:3 C5:2 E5:2 G5:2 C6:4 | C6!:4 A5:4 F#5:4 E5:4 | D#5!:4 F#5:4 A5:4 B5:4';
const boDrumA = 'k . h . s . h k k . h . s . h h';

const boss = {
  bpm: 150,
  vol: 0.72,
  inst: {
    strings: { type: 'strings', vol: 0.16, rev: 0.3, attack: 0.02, release: 0.1, legato: 0.65, pan: -0.2 },
    choir: { type: 'choir', vol: 0.16, rev: 0.5, attack: 0.03, release: 0.35, pan: 0.1 },
    lead: { type: 'saw', vol: 0.42, rev: 0.3, dly: 0.12, pan: 0.15, cutoff: 1900 },
    drums: { type: 'drums', vol: 0.52, rev: 0.15 },
    bass: { type: 'bass', vol: 0.32, legato: 0.75 },
  },
  pat: {
    intro: {
      strings: comp(BO, boIntro, boGallop),
      choir: J(M('E4+G4+B4!:4 .:12'), rest(1), M('E4+G4+B4!:4 .:12'), boStab(BO.B)),
      drums: J('t . . t . . t . t . . t . . t .', 't . . t . . t . t . . t . . t .',
        't . . t . . t . t . . t . . t .', 's . s . s s s s T T T T t t t t'),
      bass: J(rest(3), boBass(BO.B)),
    },
    A: {
      strings: comp(BO, boA, boGallop),
      choir: comp(BO, boA, boStab),
      lead: M(boHook),
      drums: boDrumA,
      bass: comp(BO, boA, boBass),
    },
    B: {
      strings: comp(BO, boB, boDrive),
      choir: comp(BO, boB, (c, len) => ext(c.c, len)),
      lead: M('E5!:8 G5:8 | F#5!:12 A5:4 | B5!:8 F#5:8 | G5!:8 E5:8 | C6!:8 B5:4 G5:4 | A5!:8 F#5:4 D5:4 |'
        + ' G5!:8 B5:8 | F#5!:8 D#5:8 | E5!:4 A5:4 C6:6 B5:2 | B5!:12 G5:4 | G5!:8 E5:8 | D#5!:4 F#5:4 B5:8 |'
        + ' C6!:8 A5:8 | G5!:8 E5:8 | F#5!:8 A5:8 | B5!:4 A5:4 F#5:4 D#5:4'),
      drums: J('k . . . h . . . s . . . h . k .', 'k . . . h . . . s . . . h . k .',
        'k . . . h . . . s . . . h . k .', 'k . t t T . t t s . T T s s s s'),
      bass: comp(BO, boB, (c) => `${c.b}! . ${c.b} . ${c.b} . ${c.b} . ${c.b}! . ${c.b} . ${c.b} . ${oct(c.b, 1)} .`),
    },
    Ap: {
      strings: comp(BO, boA, boDrive),
      choir: comp(BO, boA, boStab),
      lead: M(boHook),
      drums: 'k . h k s . h k k . h k s . h s?',
      bass: comp(BO, boA, boBass),
    },
  },
  seq: ['intro', 'A', 'B', 'Ap'],
  loop: 1,
};

// ================================================================ VICTORY (stinger, ~6 s)
// Bead's Theme rung on bells in D minor, bVI - bVII, then a bright D major (Picardy) resolution.
const victory = {
  bpm: 100,
  vol: 0.8,
  once: true,
  inst: {
    bell: { type: 'bell', vol: 0.2, rev: 0.7, dly: 0.2, pan: 0.15 },
    strings: { type: 'strings', vol: 0.16, rev: 0.6, attack: 0.08, release: 1.6 },
    harp: { type: 'harp', vol: 0.24, rev: 0.5, pan: -0.2 },
    bass: { type: 'subbass', vol: 0.28 },
    choir: { type: 'choir', vol: 0.13, rev: 0.8, attack: 0.25, release: 1.8 },
  },
  pat: {
    V: {
      bell: M('A5:2 D6:2 F6:2 E6:1 D6:1 F6:2 D6:2 E6:2 G6:2 | D6+F#6+A6!:24'),
      strings: M('D4+F4+A4:8 D4+F4+Bb4:4 C4+E4+G4:4 | D4+F#4+A4:24'),
      harp: M('.:16 | D3 A3 D4 F#4 A4 D5 F#5 A5 D6:16'),
      bass: M('D2:8 Bb1:4 C2:4 | D2:24'),
      choir: M('.:16 | A3+D4+F#4:24'),
    },
  },
  seq: ['V'],
  loop: 0,
};

export default {
  fray,
  town,
  hollows,
  gardens,
  catacombs,
  hushwood,
  bastion,
  boss_gnarlknot: bossGnarlknot,
  boss,
  victory,
};
