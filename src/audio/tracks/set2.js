// Music set 2: Cistern, Kilns, Mirrored Deep, Bellfry, Archive, Warrens, Frost + three boss themes.
// Every track quotes Bead's Theme (5 . 1 . 3 2 1 in the track's key); see the comments per track.

// ---- helpers -------------------------------------------------------------
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SH = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FL = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const midi = (n) => {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
  return PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
};
const name = (m, flats) => (flats ? FL : SH)[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const mapTok = (str, fn) => str.split(/\s+/).map((tok) => {
  if (!tok || tok === '-' || tok === '.' || tok === '|') return tok;
  const suf = /[!?]$/.test(tok) ? tok.slice(-1) : '';
  return fn(suf ? tok.slice(0, -1) : tok) + suf;
}).join(' ');
/** transpose every note of a token string by `semi` semitones */
const tr = (str, semi, flats = false) => mapTok(str, (b) => b.split('+').map((n) => name(midi(n) + semi, flats)).join('+'));
/** double every (single) note at `semi` semitones */
const dbl = (str, semi, flats = false) => mapTok(str, (b) => b + '+' + b.split('+').map((n) => name(midi(n) + semi, flats)).join('+'));
const H = (tok, n = 16) => [tok, ...Array(n - 1).fill('-')].join(' ');
const R = (n = 16) => Array(n).fill('.').join(' ');
const holds = (list, n = 16) => list.map((c) => H(c, n)).join(' | ');
const J = (list) => list.join(' | ');

// ==========================================================================
// BRINE CISTERN: Bb minor, 80 bpm. Drowned reservoir. Electric piano hook rising a sixth and
// falling back like a slow wave; celesta drips on the off-beats; Bead's Theme surfaces in B (bar 3).
// ==========================================================================
const cistern = (() => {
  const keys = (a, b, c, d) => `${a} - ${b} - ${c} - ${d} - ${c} - ${b} - ${c} - ${b} -`;
  const drip = (a, b) => `. . . . . . ${a} . . . . . . . ${b} .`;
  const K = {
    Bbm: keys('Bb2', 'F3', 'Bb3', 'Db4'), Gbm7: keys('Gb2', 'Db3', 'F3', 'Bb3'), Db: keys('Db3', 'Ab3', 'Db4', 'F4'),
    Ab: keys('Ab2', 'Eb3', 'Ab3', 'C4'), Gb: keys('Gb2', 'Db3', 'Gb3', 'Bb3'), Ebm: keys('Eb3', 'Gb3', 'Bb3', 'Eb4'),
    F: keys('F2', 'C3', 'F3', 'A3'), BbmAb: keys('Ab2', 'F3', 'Bb3', 'Db4'), DbF: keys('F2', 'Db3', 'Ab3', 'Db4'),
  };
  const melA = J([
    'F4 - - - Db5 - - - - - C5 - Db5 - - -',
    'Bb4 - - - - - - - Ab4 - Bb4 - F4 - - -',
    'Ab4 - - - F5 - - - - - Eb5 - Db5 - - -',
    'C5 - - - - - Bb4 - Ab4 - - - Eb4 - - -',
    'F4 - - - Db5 - - - - - C5 - Db5 - F5 -',
    'Gb5 - - - F5 - - - Db5 - - - Bb4 - - -',
    'Bb4 - - - Gb4 - - - Eb5 - - - Db5 - C5 -',
    'C5 - - - - - - - A4 - - - - - - -',
  ]);
  const melB = J([
    'Db5 - - - F5 - - - - - Eb5 - Db5 - Bb4 -',
    'C5 - - - - - - - Eb5 - - - Ab4 - - -',
    'F4 - - - Bb4 - - - Db5 - C5 - Bb4 - - -', // Bead's Theme
    'Db5 - - - - - - - F4 - Ab4 - Bb4 - - -',
    'Bb4 - - - Db5 - - - Gb5 - - - F5 - - -',
    'F5 - - - - - - - Eb5 - Db5 - - - - -',
    'Eb5 - - - Gb5 - - - F5 - Eb5 - Db5 - - -',
    'C5 - - - - - - - A4 - - - C5 - - -',
  ]);
  const strA = holds(['F3+Bb3+Db4', 'F3+Bb3+Db4', 'F3+Ab3+Db4', 'Eb3+Ab3+C4', 'F3+Bb3+Db4', 'Gb3+Bb3+Db4', 'Gb3+Bb3+Eb4', 'F3+A3+C4']);
  const subA = holds(['Bb1', 'Gb1', 'Db2', 'Ab1', 'Bb1', 'Gb1', 'Eb2', 'F1']);
  const keysA = J([K.Bbm, K.Gbm7, K.Db, K.Ab, K.Bbm, K.Gb, K.Ebm, K.F]);
  return {
    bpm: 80,
    vol: 0.75,
    inst: {
      ep: { type: 'epiano', vol: 0.36, rev: 0.55, dly: 0.25, pan: 0.12, humanize: true },
      keys: { type: 'epiano', vol: 0.17, rev: 0.5, dly: 0.08, pan: -0.2, cutoff: 2200, role: 'pad' },
      cel: { type: 'celesta', vol: 0.13, rev: 0.8, dly: 0.4, pan: 0.35 },
      str: { type: 'strings', vol: 0.14, rev: 0.7, attack: 1.2, release: 2, role: 'pad' },
      sub: { type: 'subbass', vol: 0.34, role: 'pad' },
    },
    pat: {
      intro: {
        keys: J([K.Bbm, K.Gbm7, K.Ebm, K.F]),
        str: holds(['F3+Bb3+Db4', 'F3+Bb3+Db4', 'Gb3+Bb3+Eb4', 'F3+A3+C4']),
        sub: holds(['Bb1', 'Gb1', 'Eb2', 'F1']),
        cel: J([drip('F6', 'Db6'), drip('Bb5', 'F6'), drip('Gb6', 'Eb6'), drip('C6', 'A5')]),
      },
      A: {
        ep: melA, keys: keysA, str: strA, sub: subA,
        cel: J([drip('F6', 'Db6'), drip('Bb5', 'F6'), drip('Ab5', 'F6'), drip('Eb6', 'C6'),
          drip('Db6', 'F6'), drip('Db6', 'Bb5'), drip('Gb6', 'Eb6'), drip('C6', 'A5')]),
      },
      B: {
        ep: melB,
        keys: J([K.Gbm7, K.Ab, K.Bbm, K.BbmAb, K.Gb, K.DbF, K.Ebm, K.F]),
        str: holds(['F3+Bb3+Db4', 'Eb3+Ab3+C4', 'F3+Bb3+Db4', 'F3+Bb3+Db4', 'Gb3+Bb3+Db4', 'F3+Ab3+Db4', 'Gb3+Bb3+Eb4', 'F3+A3+C4']),
        sub: holds(['Gb1', 'Ab1', 'Bb1', 'Ab1', 'Gb1', 'F1', 'Eb2', 'F1']),
        cel: J([drip('Bb5', 'F6'), drip('Eb6', 'C6'), R(), drip('F6', 'Db6'),
          drip('Db6', 'Bb5'), drip('Ab5', 'F6'), drip('Gb6', 'Eb6'), drip('C6', 'A5')]),
      },
      // A': the celesta doubles the hook an octave up, like light on the water
      A2: { ep: melA, keys: keysA, str: strA, sub: subA, cel: tr(melA, 12, true) },
    },
    seq: ['intro', 'A', 'B', 'A2'],
    loop: 1,
  };
})();

// ==========================================================================
// ASHEN KILNS: E minor, 120 bpm. Low saw ostinato, taiko and anvil, choir, fierce strings.
// B opens with Bead's Theme over Cmaj7, then answers it in A minor (bar 5).
// ==========================================================================
const kilns = (() => {
  const ost = (r, f, o) => `${r}! ${r}? ${o} ${r}? ${f} ${r}? ${o} ${r} ${r}! ${r}? ${o} ${r}? ${f} ${o} ${f} ${r}?`;
  const O = { Em: ost('E2', 'B2', 'E3'), C: ost('C2', 'G2', 'C3'), D: ost('D2', 'A2', 'D3'), Am: ost('A1', 'E2', 'A2'), B: ost('B1', 'F#2', 'B2'), Bm: ost('B1', 'F#2', 'B2') };
  const melA = J([
    'E5 - - - - - B4 - - - E5 - F#5 - G5 -',
    'F#5 - - - E5 - - - D5 - - - B4 - - -',
    'C5 - - - - - E5 - - - G5 - A5 - G5 -',
    'F#5 - - - - - - - E5 - D5 - A4 - - -',
    'A4 - - - C5 - - - E5 - - - A5 - - -',
    'G5 - - - - - E5 - - - C5 - D5 - E5 -',
    'F#5 - - - - - D#5 - - - B4 - - - D#5 -',
    'B4 - - - - - D#5 - F#5 - - - A5 - - -',
  ]);
  const melB = J([
    'B4 - - - E5 - - - G5 - F#5 - E5 - - -', // Bead's Theme over Cmaj7
    'F#5 - - - - - - - A5 - - - D5 - - -',
    'D5 - - - F#5 - - - B5 - - - A5 - - -',
    'G5 - - - - - - - - - - - E5 - - -',
    'E5 - - - A5 - - - C6 - B5 - A5 - - -', // ...answered in A minor
    'A5 - - - F#5 - - - D5 - - - E5 - F#5 -',
    'G5 - - - - - E5 - - - C5 - E5 - G5 -',
    'F#5 - - - - - - - D#5 - - - B4 - - -',
  ]);
  const choirA = holds(['E4+G4+B4', 'E4+G4+B4', 'E4+G4+C5', 'D4+F#4+A4', 'E4+A4+C5', 'E4+G4+C5', 'D#4+F#4+B4', 'D#4+F#4+B4']);
  const sawA = J([O.Em, O.Em, O.C, O.D, O.Am, O.C, O.B, O.B]);
  return {
    bpm: 120,
    vol: 0.72,
    inst: {
      saw: { type: 'saw', vol: 0.2, cutoff: 850, rev: 0.12, legato: 0.7, role: 'pad' },
      str: { type: 'strings', vol: 0.32, rev: 0.4, attack: 0.08, release: 0.4 },
      choir: { type: 'choir', vol: 0.15, rev: 0.75, attack: 0.6, release: 1.5, role: 'pad' },
      dr: { type: 'drums', vol: 0.55, rev: 0.3 },
    },
    pat: {
      intro: {
        saw: J([O.Em, O.Em, O.C, O.B]),
        choir: J([R(), R(), H('E4+G4+C5'), H('D#4+F#4+B4')]),
        dr: 'b! . . . . . . . b . . . . . r .',
      },
      A: { saw: sawA, str: melA, choir: choirA, dr: 'b! . r . T . r . b . b r T . r r' },
      // A': strings in octaves, busier forge
      A2: { saw: sawA, str: dbl(melA, -12), choir: choirA, dr: 'b! . r r T . r . b r b r T T r r' },
      B: {
        saw: J([O.C, O.D, O.Bm, O.Em, O.Am, O.D, O.C, O.B]),
        str: melB,
        choir: holds(['E4+G4+B4', 'D4+F#4+A4', 'D4+F#4+B4', 'E4+G4+B4', 'E4+A4+C5', 'D4+F#4+A4', 'E4+G4+C5', 'D#4+F#4+B4']),
        dr: 'b! . . . r . . . b . . . T . r .',
      },
    },
    seq: ['intro', 'A', 'A2', 'B', 'A2'],
    loop: 1,
  };
})();

// ==========================================================================
// MIRRORED DEEP: G# minor / B major, 84 bpm. The celesta states Bead's Theme; the bell answers
// with its exact diatonic mirror image (C#6 G#5 E5 F#5 G#5) over C#m. In bars 5-8 the voices
// move simultaneously in strict mirror; B section: celesta arpeggios up while bells fall down.
// ==========================================================================
const mirror = (() => {
  const mir = (a, b, c, d, e) => ({
    cel: `${a} . ${b} . ${c} . ${d} . ${e} . ${d} . ${c} . ${b} .`,
    bell: `. ${e} . ${d} . ${c} . ${b} . ${a} . ${b} . ${c} . ${d}`,
  });
  const harpArp = (a, b, c, d) => `${a} . ${b} . ${c} . ${d} . ${c} . ${b} . ${d} . ${c} .`;
  const celA = J([
    'D#5 - - - G#5 - - - B5 - A#5 - G#5 - - -', // Bead's Theme
    R(),
    'E6 - - - B5 - - - G#5 - - - E5 - - -',
    R(),
    'G#5 - A#5 - B5 - - - B5 - A#5 - G#5 - - -',
    'A#5 - - - - - - - C#6 - - - A#5 - - -',
    'G#5 - - - B5 - - - C#6 - - - B5 - - -',
    'A#5 - - - - - - - G5 - - - A#5 - - -',
  ]);
  const bellA = J([
    R(),
    'C#6 - - - G#5 - - - E5 - F#5 - G#5 - - -', // ...and its mirror
    R(),
    'B4 - - - E5 - - - G#5 - - - B5 - - -',
    'G#5 - F#5 - E5 - - - E5 - F#5 - G#5 - - -',
    'F#5 - - - - - - - D#5 - - - F#5 - - -',
    'G#5 - - - E5 - - - D#5 - - - E5 - - -',
    'D#5 - - - - - - - A#4 - - - D#5 - - -',
  ]);
  const choirA = holds(['D#4+G#4+B4', 'E4+G#4+C#5', 'E4+G#4+B4', 'E4+G#4+B4', 'E4+G#4+B4', 'F#4+A#4+C#5', 'E4+G#4+C#5', 'D#4+G4+A#4']);
  const subA = holds(['G#1', 'C#2', 'E2', 'C#2', 'E2', 'F#2', 'C#2', 'D#2']);
  const Bset = [
    mir('B4', 'D#5', 'F#5', 'B5', 'D#6'), mir('G#4', 'B4', 'D#5', 'G#5', 'B5'), mir('G#4', 'B4', 'E5', 'G#5', 'B5'),
    mir('A#4', 'C#5', 'F#5', 'A#5', 'C#6'), mir('B4', 'D#5', 'F#5', 'B5', 'D#6'), mir('B4', 'E5', 'G#5', 'B5', 'E6'),
    mir('G#4', 'B4', 'C#5', 'E5', 'G#5'), mir('A#4', 'D#5', 'G5', 'A#5', 'D#6'),
  ];
  const introSet = [mir('G#4', 'B4', 'D#5', 'G#5', 'B5'), mir('A#4', 'D#5', 'G5', 'A#5', 'D#6')];
  return {
    bpm: 84,
    vol: 0.78,
    inst: {
      cel: { type: 'celesta', vol: 0.3, rev: 0.6, dly: 0.28, pan: -0.3 },
      bell: { type: 'bell', vol: 0.16, rev: 0.7, dly: 0.18, pan: 0.3 },
      harp: { type: 'harp', vol: 0.16, rev: 0.55, pan: 0.05, role: 'pad' },
      choir: { type: 'choir', vol: 0.14, rev: 0.85, attack: 1.2, release: 2.5, role: 'pad' },
      sub: { type: 'subbass', vol: 0.28, role: 'pad' },
    },
    pat: {
      intro: {
        cel: J(introSet.map((m) => m.cel)), bell: J(introSet.map((m) => m.bell)),
        choir: holds(['D#4+G#4+B4', 'D#4+G4+A#4']), sub: holds(['G#1', 'D#2']),
      },
      A: { cel: celA, bell: bellA, choir: choirA, sub: subA },
      B: {
        cel: J(Bset.map((m) => m.cel)), bell: J(Bset.map((m) => m.bell)),
        choir: holds(['D#4+F#4+B4', 'D#4+G#4+B4', 'E4+G#4+B4', 'F#4+A#4+C#5', 'F#4+B4+D#5', 'G#4+B4+E5', 'G#4+B4+E5', 'G4+A#4+D#5']),
        sub: holds(['B1', 'G#1', 'E2', 'F#2', 'D#2', 'E2', 'C#2', 'D#2']),
      },
      A2: {
        cel: celA, bell: bellA, choir: choirA, sub: subA,
        harp: J([harpArp('G#2', 'D#3', 'G#3', 'B3'), harpArp('C#3', 'G#3', 'C#4', 'E4'), harpArp('E2', 'B2', 'E3', 'G#3'), harpArp('C#3', 'G#3', 'B3', 'E4'),
          harpArp('E2', 'B2', 'E3', 'G#3'), harpArp('F#2', 'C#3', 'F#3', 'A#3'), harpArp('C#3', 'G#3', 'C#4', 'E4'), harpArp('D#2', 'A#2', 'D#3', 'G3')]),
      },
    },
    seq: ['intro', 'A', 'B', 'A2'],
    loop: 1,
  };
})();

// ==========================================================================
// BELLFRY HEIGHTS: Eb major, 100 bpm, 3/4 (12-step bars). Flute hook leaping up the tower,
// harp waltz, bell peals, strings soaring in B. Bead's Theme on the flute in B (bars 9 and 13).
// ==========================================================================
const bellfry = (() => {
  const B12 = (s) => s; // readability marker for 12-step bars
  const waltz = (c) => `. . . . ${c} . . . ${c} . . .`;
  const peal = (a, b, c) => `. . . . . . ${a} . ${b} . ${c} .`;
  const W = { Eb: 'G3+Bb3+Eb4', BbD: 'F3+Bb3+D4', Cm: 'G3+C4+Eb4', Ab: 'Ab3+C4+Eb4', Bb: 'F3+Bb3+D4', Bb7: 'F3+Ab3+D4', GB: 'G3+B3+D4', Gm: 'G3+Bb3+D4', Fm7: 'F3+Ab3+Eb4', Bbs4: 'F3+Bb3+Eb4' };
  const chA = ['Eb', 'BbD', 'Cm', 'Ab', 'Eb', 'Ab', 'Bb', 'Bb7', 'Eb', 'BbD', 'Cm', 'GB', 'Cm', 'Ab', 'Bb7', 'Eb'];
  const chB = ['Ab', 'Bb', 'Gm', 'Cm', 'Fm7', 'Bb', 'Eb', 'Bb7', 'Eb', 'Cm', 'Ab', 'Bb', 'Eb', 'Ab', 'Bbs4', 'Bb7'];
  const melA = J([
    'Bb4 - - - Eb5 - - - G5 - Bb5 -',
    'Bb5 - - - - - - - F5 - - -',
    'G5 - - - - - Eb5 - C6 - - -',
    'C6 - - - - - Bb5 - Ab5 - - -',
    'G5 - - - - - - - Bb5 - - -',
    'C6 - - - - - Ab5 - - - F5 -',
    'F5 - - - - - - - D5 - Eb5 -',
    'F5 - - - - - - - . . . .',
    'Bb4 - - - Eb5 - - - G5 - Bb5 -',
    'Bb5 - - - - - - - D6 - - -',
    'Eb6 - - - - - - - C6 - - -',
    'B5 - - - - - D6 - - - B5 -',
    'C6 - - - - - G5 - - - Eb5 -',
    'Ab5 - - - - - C6 - Bb5 - Ab5 -',
    'Bb5 - - - - - Ab5 - - - F5 -',
    'Eb5 - - - - - - - - - - -',
  ]);
  const bellsA = J([R(12), peal('F6', 'D6', 'Bb5'), R(12), peal('Eb6', 'C6', 'Ab5'), R(12), peal('Eb6', 'C6', 'Ab5'), R(12), peal('F6', 'D6', 'Bb5'),
    R(12), peal('F6', 'D6', 'Bb5'), R(12), peal('G6', 'D6', 'B5'), R(12), peal('Eb6', 'C6', 'Ab5'), R(12), peal('G6', 'Eb6', 'Bb5')]);
  const bassA = holds(['Eb2', 'D2', 'C2', 'Ab1', 'G1', 'Ab1', 'Bb1', 'Bb1', 'Eb2', 'D2', 'C2', 'B1', 'C2', 'Ab1', 'Bb1', 'Eb2'], 12);
  const strBmel = J([
    'C5 - - - - - Eb5 - - - Ab5 -',
    'F5 - - - - - D5 - - - Bb4 -',
    'Bb4 - - - - - D5 - - - G5 -',
    'G5 - - - - - - - - - Eb5 -',
    'F5 - - - - - Ab5 - - - C6 -',
    'D6 - - - - - - - Bb5 - - -',
    'Eb6 - - - - - - - - - - -',
    'D6 - - - - - C6 - Bb5 - Ab5 -',
  ]);
  const flB = J([
    R(12), R(12), R(12), R(12), R(12), R(12), R(12), R(12),
    'Bb4 - - - Eb5 - - - G5 - F5 -', // Bead's Theme
    'Eb5 - - - - - - - - - G5 -',
    'Ab5 - - - - - - - G5 - F5 -',
    'F5 - - - - - - - D5 - - -',
    'Bb4 - - - Eb5 - - - G5 - Bb5 -',
    'C6 - - - - - - - Ab5 - - -',
    'Bb5 - - - - - F5 - - - Eb5 -',
    'F5 - - - - - D5 - - - Ab4 -',
  ]);
  return {
    bpm: 100,
    vol: 0.76,
    bar: 12,
    inst: {
      fl: { type: 'flute', vol: 0.36, rev: 0.5, dly: 0.2, pan: 0.1 },
      str: { type: 'strings', vol: 0.2, rev: 0.6, attack: 0.5, release: 1.2 },
      bell: { type: 'bell', vol: 0.1, rev: 0.75, dly: 0.15, pan: -0.35 },
      harp: { type: 'harp', vol: 0.2, rev: 0.4, pan: -0.1, strum: 0.012, role: 'pad' },
      bass: { type: 'bass', vol: 0.3, role: 'pad' },
    },
    pat: {
      intro: {
        bell: J([B12('Eb6 . Bb5 . G5 . Eb5 . . . . .'), 'Eb6 . C6 . Ab5 . Eb5 . . . . .', 'G6 . Eb6 . Bb5 . G5 . . . . .', 'F6 . D6 . Bb5 . Ab5 . . . . .']),
        str: holds(['G3+Bb3+Eb4', 'Ab3+C4+Eb4', 'G3+Bb3+Eb4', 'F3+Ab3+D4'], 12),
        bass: holds(['Eb2', 'Ab1', 'Eb2', 'Bb1'], 12),
        harp: J([R(12), R(12), waltz(W.Eb), waltz(W.Bb7)]),
      },
      A: {
        fl: melA, bell: bellsA, bass: bassA,
        harp: J(chA.map((c) => waltz(W[c]))),
        str: holds(chA.map((c) => W[c]), 12),
      },
      B: {
        str: J([strBmel, holds(chB.slice(8).map((c) => W[c]), 12)]),
        fl: flB,
        harp: J(chB.map((c) => waltz(W[c]))),
        bass: holds(['Ab1', 'Bb1', 'G1', 'C2', 'F1', 'Bb1', 'Eb2', 'Bb1', 'Eb2', 'C2', 'Ab1', 'Bb1', 'G1', 'Ab1', 'Bb1', 'Bb1'], 12),
        bell: J([R(12), peal('F6', 'D6', 'Bb5'), R(12), peal('G6', 'Eb6', 'C6'), R(12), peal('F6', 'D6', 'Bb5'), R(12), R(12),
          R(12), peal('G6', 'Eb6', 'C6'), R(12), peal('F6', 'D6', 'Bb5'), R(12), peal('Eb6', 'C6', 'Ab5'), R(12), peal('F6', 'D6', 'Ab5')]),
      },
      // A': strings soar with the flute an octave below
      A2: {
        fl: melA, bell: bellsA, bass: bassA,
        harp: J(chA.map((c) => waltz(W[c]))),
        str: tr(melA, -12, true),
      },
    },
    seq: ['intro', 'A', 'B', 'A2'],
    loop: 1,
  };
})();

// ==========================================================================
// SILKEN ARCHIVE: F minor, 92 bpm. A fugue exposition: the subject opens with Bead's Theme
// (C5 F5 Ab5 G5 F5), the harp answers in C minor against a countersubject, organ pedals beneath,
// a clock ticks. B: organ chorale in Db with the harp weaving 16ths like a loom.
// ==========================================================================
const archive = (() => {
  const loom = (a, b, c, d) => `${a} ${b} ${c} ${b} ${d} ${b} ${c} ${b} ${a} ${b} ${c} ${b} ${d} ${b} ${c} ${b}`;
  const subj = ['C5 . F5 . Ab5 G5 F5 . E5 . F5 . G5 . C5 .', 'Db5 . C5 . Bb4 . Ab4 . G4 . C5 . F4 . . .'];
  const ans = ['G4 . C5 . Eb5 D5 C5 . B4 . C5 . D5 . G4 .', 'Ab4 . G4 . F4 . Eb4 . D4 . G4 . C4 . . .'];
  const cs = ['Eb5 - - - - - - - D5 - - - F5 - Eb5 D5', 'C5 - - - - - - - B4 - - - C5 - - -'];
  const csF = ['Ab4 - - - - - - - G4 - - - Bb4 - Ab4 G4', 'F4 - - - - - - - E4 - - - F4 - - -'];
  const episodeP = ['F5 . Db5 . Bb4 . Db5 . G5 . Eb5 . Bb4 . Eb5 .', 'Eb5 . C5 . Ab4 . C5 . E5 . C5 . G4 . Bb4 .'];
  const episodeH = ['Bb2 . . . F3 . . . Eb3 . . . Bb2 . . .', 'Ab2 . . . Eb3 . . . C3 . . . G2 . . .'];
  const orgA = J([H('F2'), H('F2'), H('C2'), H('C2'), H('F2'), H('F2'), H('Bb1+F2', 8) + ' ' + H('Eb2+Bb2', 8), H('Ab1+Eb2', 8) + ' ' + H('C2+G2', 8)]);
  const clock = 'r . . . r? . . . r . . . r? . . .';
  return {
    bpm: 92,
    vol: 0.78,
    inst: {
      pno: { type: 'piano', vol: 0.4, rev: 0.4, dly: 0.06, pan: -0.15, humanize: true },
      harp: { type: 'harp', vol: 0.3, rev: 0.4, pan: 0.2 },
      org: { type: 'organ', vol: 0.15, rev: 0.6, role: 'pad' },
      tick: { type: 'drums', vol: 0.22, rev: 0.35, pan: 0.3 },
    },
    pat: {
      intro: {
        org: J([H('F2+C3'), H('F2+C3')]),
        harp: J(['F2 . . . . . . . C3 . . . . . . .', 'F2 . . . . . . . C3 . . . G2 . . .']),
        tick: clock,
      },
      A: {
        pno: J([...subj, ...cs, ...subj, ...episodeP]),
        harp: J([R(), R(), ...ans, ...csF, ...episodeH]),
        org: orgA, tick: clock,
      },
      B: {
        pno: J([
          'Ab4 - - - Db5 - - - F5 - - - Eb5 - Db5 -',
          'Db5 - - - - - - - - - C5 - Bb4 - - -',
          'Bb4 - - - Eb5 - - - G5 - - - F5 - Eb5 -',
          'Eb5 - - - - - - - C5 - - - . . . .',
          'Ab4 - - - Db5 - - - F5 - - - Ab5 - - -',
          'G5 - - - F5 - - - Db5 - - - Bb4 - - -',
          'G4 - - - C5 - - - E5 - - - G5 - - -',
          'Bb5 - - - - - - - G5 - - - E5 - - -',
        ]),
        harp: J([loom('Db3', 'Ab3', 'Db4', 'F4'), loom('Bb2', 'F3', 'Bb3', 'Db4'), loom('Eb3', 'Bb3', 'Eb4', 'G4'), loom('Ab2', 'Eb3', 'Ab3', 'C4'),
          loom('Db3', 'Ab3', 'Db4', 'F4'), loom('G2', 'Db3', 'F3', 'Bb3'), loom('C3', 'G3', 'C4', 'E4'), loom('C3', 'G3', 'Bb3', 'E4')]),
        org: holds(['Db2+F3+Ab3', 'Bb1+F3+Bb3', 'Eb2+G3+Bb3', 'Ab1+Ab3+C4', 'Db2+Ab3+Db4', 'G1+G3+Db4', 'C2+G3+C4', 'C2+G3+Bb3']),
        tick: 'r . . . r? . . . r . . . r? . r? .',
      },
      // A': voice exchange: harp leads the subject low, piano answers high
      A2: {
        harp: J([tr(subj[0], -12, true), tr(subj[1], -12, true), tr(cs[0], -12, true), tr(cs[1], -12, true), ...csF, ...episodeH]),
        pno: J([R(), R(), tr(ans[0], 12, true), tr(ans[1], 12, true), ...subj, ...episodeP]),
        org: orgA, tick: clock,
      },
    },
    seq: ['intro', 'A', 'B', 'A2'],
    loop: 1,
  };
})();

// ==========================================================================
// ROTGUT WARRENS: C# minor, 104 bpm. Buzzing pluck ostinato over a chromatic lament bass,
// rim-tick insects, detuned string clusters, a skittering lead. B twists Bead's Theme with a
// Phrygian D natural before playing it straight (bar 3).
// ==========================================================================
const warrens = (() => {
  const os = (a, b, c, d) => `${a}! ${a}? ${a}? ${b} ${a}? ${a}? ${c} ${a}? ${a}! ${a}? ${a}? ${b} ${a}? ${d} ${c} ${b}`;
  const O = {
    Cm: os('C#4', 'E4', 'G#4', 'D4'), A: os('C#4', 'E4', 'A4', 'D4'), G: os('C4', 'D#4', 'G#4', 'A4'),
    D: os('D4', 'F#4', 'A4', 'C#4'), Ab: os('A3', 'C#4', 'E4', 'D4'),
  };
  const bassF = (r) => `${r}! - - - - - - - ${r} - - - . . ${r}? .`;
  const leadA = J([
    '. . G#4 - A4 - G#4 - . . E4 - D#4 - E4 -',
    R(),
    '. . G#4 - A4 - G#4 - . . B4 - A4 - G#4 -',
    '. . . . . . . . E4 - - - - - - -',
    '. . A4 - C#5 - E5 - . . D5 - C#5 - - -',
    '. . . . . . . . G#4 - - - - - - -',
    '. . C5 - D#5 - G#5 - . . A5 - G#5 - - -',
    R(),
  ]);
  const plA = J([O.Cm, O.Cm, O.Cm, O.Cm, O.A, O.A, O.G, O.G]);
  const bassA = J(['C#2', 'C2', 'B1', 'Bb1', 'A1', 'A1', 'G#1', 'G#1'].map(bassF));
  const strA = holds(['E3+G#3+C#4', 'E3+G#3+C#4', 'E3+G#3+B3+C#4', 'E3+G#3+A#3+C#4', 'E3+A3+C#4', 'E3+G#3+A3+C#4', 'D#3+G#3+C4', 'D#3+F#3+A3+C4']);
  return {
    bpm: 104,
    vol: 0.74,
    inst: {
      buzz: { type: 'pluck', vol: 0.22, bright: 0.95, cutoff: 3800, rev: 0.25, pan: -0.25, role: 'pad' },
      bass: { type: 'bass', vol: 0.32, cutoff: 600, role: 'pad' },
      str: { type: 'strings', vol: 0.11, rev: 0.65, attack: 0.9, release: 1.4, detune: 16, role: 'pad' },
      lead: { type: 'lead', vol: 0.28, rev: 0.5, dly: 0.25, pan: 0.2 },
      tick: { type: 'drums', vol: 0.42, rev: 0.25, pan: 0.15 },
    },
    pat: {
      intro: {
        buzz: J([O.Cm, O.Cm, O.Cm, O.Cm]),
        bass: J([H('C#2'), H('C#2'), H('C#2'), H('C#2')]),
        str: J([R(), R(), H('C#4+D4'), H('C#4+D4')]),
        tick: 'r . r? r? . r . . r . . r r? . r .',
      },
      A: { buzz: plA, bass: bassA, str: strA, lead: leadA, tick: 'k+r . r r? . r . r? r . k r r? . r .' },
      // A': the lead drops an octave and the strings climb, the hive grows closer
      A2: { buzz: plA, bass: bassA, str: tr(strA, 12), lead: tr(leadA, -12), tick: 'k+r . r r? r? r . r? k+r . k r r? r r r?' },
      B: {
        buzz: J([O.Cm, O.D, O.Cm, O.G, O.Ab, O.D, O.G, O.G]),
        bass: J(['C#2', 'D2', 'C#2', 'C2', 'A1', 'D2', 'G#1', 'G#1'].map(bassF)),
        str: holds(['E3+G#3+C#4+D4', 'D3+F#3+A3+C#4', 'E3+G#3+C#4+D#4', 'D#3+G#3+C4', 'E3+A3+C#4', 'F#3+A3+D4+Eb4', 'D#3+G#3+C4', 'D#3+F#3+A3+C4']),
        lead: J([
          'G#4 - - - C#5 - - - E5 - D5 - C#5 - - -', // Bead's Theme, Phrygian
          'D5 - - - - - - - A4 - - - F#4 - - -',
          'G#4 - - - C#5 - - - E5 - D#5 - C#5 - - -', // ...and straight
          'C5 - - - - - - - D#5 - - - G#4 - - -',
          'E4 - - - A4 - - - C#5 - B4 - A4 - - -',
          'D5 - - - - - - - A4 - - - - - - -',
          'C5 - - - D#5 - - - G#5 - - - A5 - - -',
          'G#5 - - - - - - - . . . . . . . .',
        ]),
        tick: 'k . r . r? r . r k . r . r? r r? r',
      },
    },
    seq: ['intro', 'A', 'A2', 'B', 'A2'],
    loop: 1,
  };
})();

// ==========================================================================
// FROSTLIT RELIQUARY: E minor, 70 bpm. Glacial: the pad holds G-B-E while the bass moves
// beneath it. Celesta hook falls like snow; in B the strings sing Bead's Theme over Cmaj7
// (bar 1), then again over Fmaj7, a Phrygian chill (bar 5), as the choir planes down in sevenths.
// ==========================================================================
const frost = (() => {
  const celA = J([
    'B5 - - - - - G5 - F#5 - - - - - - -',
    'E5 - - - - - - - G5 - - - B5 - - -',
    'C6 - - - - - B5 - A5 - - - - - - -',
    'E5 - - - - - - - D#5 - - - - - - -',
    'G5 - - - - - B5 - E6 - - - - - - -',
    'D6 - - - - - - - B5 - - - - - - -',
    'C6 - - - - - - - A5 - - - G5 - - -',
    'F#5 - - - - - - - D#5 - - - - - - -',
  ]);
  const strA = J([H('G3+B3+F#4'), H('G3+B3+E4'), H('G3+B3+E4'), H('A3+B3+E4', 8) + ' ' + H('A3+B3+D#4', 8),
    H('G3+B3+E4'), H('G3+B3+D4'), H('G3+C4+E4'), H('F#3+A3+D#4')]);
  const subA = holds(['E2', 'C2', 'A1', 'B1', 'E2', 'C2', 'A1', 'B1']);
  const spark = (a, b) => `. . . . ${a} . . . . . ${b} . . . . .`;
  return {
    bpm: 70,
    vol: 0.8,
    inst: {
      cel: { type: 'celesta', vol: 0.32, rev: 0.75, dly: 0.35, pan: 0.15 },
      vln: { type: 'strings', vol: 0.24, rev: 0.7, attack: 0.35, release: 1.2, pan: -0.1 },
      str: { type: 'strings', vol: 0.15, rev: 0.75, attack: 1.5, release: 2.5, role: 'pad' },
      choir: { type: 'choir', vol: 0.12, rev: 0.9, attack: 1.5, release: 3, role: 'pad' },
      sub: { type: 'subbass', vol: 0.28, role: 'pad' },
    },
    pat: {
      intro: {
        str: holds(['G3+B3+F#4', 'G3+B3+E4']),
        sub: holds(['E2', 'C2']),
        cel: J(['. . . . . . . . F#6 . . . . . . .', '. . . . . . . . E6 . . . B5 . . .']),
      },
      A: { cel: celA, str: strA, sub: subA },
      B: {
        vln: J([
          'B4 - - - E5 - - - G5 - F#5 - E5 - - -', // Bead's Theme over Cmaj7
          'D5 - - - - - - - F#5 - - - - - - -',
          'E5 - - - - - - - C5 - D5 - E5 - - -',
          'D5 - - - - - - - B4 - - - - - - -',
          'E5 - - - A5 - - - C6 - B5 - A5 - - -', // ...over Fmaj7
          'B5 - - - - - - - F#5 - - - G5 - - -',
          'A5 - - - - - - - E5 - - - C5 - - -',
          'D#5 - - - - - - - B4 - - - - - - -',
        ]),
        choir: holds(['E4+G4+B4', 'D4+F#4+A4', 'C4+E4+G4', 'B3+D4+F#4', 'A3+C4+E4', 'B3+E4+G4', 'A3+C4+E4', 'A3+D#4+F#4']),
        sub: holds(['C2', 'B1', 'A1', 'G1', 'F1', 'E1', 'F1', 'B1']),
        cel: J([spark('G6', 'E6'), spark('F#6', 'D6'), spark('E6', 'C6'), spark('D6', 'B5'),
          spark('E6', 'A5'), spark('F#6', 'B5'), spark('E6', 'A5'), spark('D#6', 'B5')]),
      },
      // A': the hook in celesta and low violins together, with the choir breathing beneath
      A2: {
        cel: celA, vln: tr(celA, -12), str: strA, sub: subA,
        choir: holds(['E4+B4', 'E4+B4', 'E4+B4', 'B3+F#4', 'E4+B4', 'E4+B4', 'E4+A4', 'B3+F#4']),
      },
    },
    seq: ['intro', 'A', 'B', 'A2'],
    loop: 1,
  };
})();

// ==========================================================================
// BOSS (MID): C minor, 155 bpm. A chugging staccato-string riff, soaring strings, choir chant of
// Bead's Theme in B (bars 1, 3 transposed to F minor, 5).
// ==========================================================================
const boss_mid = (() => {
  const riff = (r, t, f, s) => `${r}! - . ${r} ${t} - . ${r} ${f} - . ${r} ${s} - ${f} ${t}`;
  const F = {
    Cm: riff('C4', 'Eb4', 'G4', 'Bb4'), Ab: riff('Ab3', 'C4', 'Eb4', 'F4'), Bb: riff('Bb3', 'D4', 'F4', 'Ab4'),
    Fm: riff('F3', 'Ab3', 'C4', 'Eb4'), G: riff('G3', 'B3', 'D4', 'F4'), Db: riff('Db4', 'F4', 'Ab4', 'C5'),
  };
  const bm = (r, o) => `${r} . ${o} . ${r} ${r} ${o} . ${r} . ${o} . ${r} ${r} ${o} ${r}`;
  const BS = { Cm: bm('C2', 'C3'), Ab: bm('Ab1', 'Ab2'), Bb: bm('Bb1', 'Bb2'), Fm: bm('F1', 'F2'), G: bm('G1', 'G2'), Db: bm('Db2', 'Db3') };
  const C = { Cm: 'G3+C4+Eb4', Ab: 'Ab3+C4+Eb4', Bb: 'Bb3+D4+F4', Fm: 'Ab3+C4+F4', G: 'G3+B3+D4', Db: 'Ab3+Db4+F4' };
  const chA = ['Cm', 'Cm', 'Ab', 'Bb', 'Cm', 'Cm', 'Fm', 'G'];
  const chB = ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Ab', 'Db', 'G'];
  const melA = J([
    'G5 - - - - - - - Eb5 - F5 - G5 - - -',
    'C6 - - - Bb5 - - - G5 - - - - - - -',
    'C6 - - - Ab5 - - - Eb5 - - - F5 - - -',
    'D6 - - - - - - - Bb5 - - - F5 - - -',
    'G5 - - - - - - - Eb5 - F5 - G5 - - -',
    'C6 - - - - - - - Eb6 - - - D6 - - -',
    'C6 - - - Ab5 - - - F5 - - - Ab5 - - -',
    'G5 - - - - - - - B5 - - - D6 - - -',
  ]);
  const chantB = J([
    'G4 - - - C5 - - - Eb5 - D5 - C5 - - -', // Bead's Theme
    'C5 - - - - - - - Eb5 - - - - - - -',
    'C5 - - - F5 - - - Ab5 - G5 - F5 - - -',
    'G5 - - - - - - - D5 - - - B4 - - -',
    'G4 - - - C5 - - - Eb5 - D5 - C5 - - -',
    'Eb5 - - - - - - - C5 - - - Ab4 - - -',
    'Db5 - - - - - - - F5 - - - Ab5 - - -',
    'G5 - - - - - - - F5 - - - D5 - B4 -',
  ]);
  const riffB = J(chB.map((c) => F[c]));
  const bassB = J(chB.map((c) => BS[c]));
  return {
    bpm: 155,
    vol: 0.72,
    inst: {
      stac: { type: 'strings', vol: 0.22, attack: 0.01, release: 0.08, legato: 0.6, rev: 0.2, cutoff: 3000, pan: -0.15, role: 'pad' },
      str: { type: 'strings', vol: 0.32, attack: 0.05, release: 0.3, rev: 0.35, pan: 0.15 },
      choir: { type: 'choir', vol: 0.2, rev: 0.6, attack: 0.15, release: 0.8 },
      bass: { type: 'bass', vol: 0.34, role: 'pad' },
      dr: { type: 'drums', vol: 0.55, rev: 0.15 },
    },
    pat: {
      intro: { stac: J([F.Cm, F.Cm]), bass: J([BS.Cm, BS.Cm]), dr: 'b! . . . b . . . b . . . b . b .' },
      A: {
        stac: J(chA.map((c) => F[c])), bass: J(chA.map((c) => BS[c])), str: melA,
        choir: holds(chA.map((c) => C[c])), dr: 'k! . h . s . h k . k h . s . h s?',
      },
      A2: {
        stac: J(chA.map((c) => F[c])), bass: J(chA.map((c) => BS[c])), str: dbl(melA, -12, true),
        choir: holds(chA.map((c) => C[c])), dr: 'k! . h k s . h k . k h . s s? h s',
      },
      B: {
        stac: riffB, bass: bassB, choir: chantB,
        str: holds(['Eb6', 'C6', 'C6', 'B5', 'C6', 'C6', 'Db6', 'B5']),
        dr: 'k+b . h . s . h . k . h k s . h .',
      },
      B2: {
        stac: riffB, bass: bassB, choir: chantB, str: tr(chantB, 12, true),
        dr: 'k+b . h k s . h k k+b . h k s . s s',
      },
    },
    seq: ['intro', 'A', 'A2', 'B', 'B2', 'A2'],
    loop: 1,
  };
})();

// ==========================================================================
// BOSS (GREAT BEAD KEEPERS): D minor, 160 bpm. Bead's Theme made heroic: dotted, driven, then
// sequenced up through C major (A), augmented in the choir (B), and finally blazing in D MAJOR
// (break) before plunging back to the minor.
// ==========================================================================
const boss_keeper = (() => {
  const ost = (r, f, o) => `${r}! ${r} ${f} ${r} ${o} ${r} ${f} ${r} ${r}! ${r} ${f} ${r} ${o} ${f} ${o} ${f}`;
  const O = {
    Dm: ost('D3', 'A3', 'D4'), Bb: ost('Bb2', 'F3', 'Bb3'), C: ost('C3', 'G3', 'C4'), A: ost('A2', 'E3', 'A3'),
    Gm: ost('G2', 'D3', 'G3'), DmC: ost('C3', 'F3', 'A3'), D: ost('D3', 'A3', 'D4'), G: ost('G2', 'D3', 'G3'),
    DA: ost('A2', 'F#3', 'D4'), A7: ost('A2', 'E3', 'G3'),
  };
  const CH = { Dm: 'D4+F4+A4', Bb: 'D4+F4+Bb4', C: 'E4+G4+C5', A: 'C#4+E4+A4', Gm: 'D4+G4+Bb4' };
  const chA = ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A'];
  const heroA = J([
    'A4! - - D5 - - F5 - E5 - D5 - A5 - - -', // Bead's Theme, heroic
    'Bb5 - - - - - - - F5 - G5 - F5 - D5 -',
    'G4 - - C5 - - E5 - D5 - C5 - G5 - - -', // ...sequenced into C major
    'A5 - - - G5 - - - E5 - - - C#5 - - -',
    'A4! - - D5 - - F5 - E5 - D5 - A5 - - -',
    'D6 - - - - - - - Bb5 - C6 - D6 - - -',
    'G5 - - - Bb5 - - - D6 - - - Bb5 - - -',
    'A5 - - - - - - - C#6 - - - E6 - - -',
  ]);
  const choirB = J([
    'A4 - - - - - - - D5 - - - - - - -', // augmented theme
    'F5 - - - - - - - E5 - - - D5 - - -',
    'F5 - - - - - - - D5 - - - - - - -',
    'E5 - - - - - - - C#5 - - - - - - -',
    'A4 - - - - - - - D5 - - - - - - -',
    'F5 - - - - - - - E5 - - - D5 - - -',
    'G5 - - - - - - - Bb5 - - - - - - -',
    'A5 - - - - - - - - - - - - - - -',
  ]);
  const ostA = J(chA.map((c) => O[c]));
  const subA = holds(['D2', 'Bb1', 'C2', 'A1', 'D2', 'Bb1', 'G1', 'A1']);
  const choirA = holds(chA.map((c) => CH[c]));
  const ostB = J(['Dm', 'DmC', 'Bb', 'A', 'Dm', 'DmC', 'Gm', 'A'].map((c) => O[c]));
  const subB = holds(['D2', 'C2', 'Bb1', 'A1', 'D2', 'C2', 'G1', 'A1']);
  return {
    bpm: 160,
    vol: 0.72,
    inst: {
      hero: { type: 'strings', vol: 0.34, attack: 0.05, release: 0.35, rev: 0.4, pan: 0.1 },
      ost: { type: 'strings', vol: 0.2, attack: 0.01, release: 0.08, legato: 0.55, rev: 0.15, cutoff: 2000, pan: -0.15, role: 'pad' },
      choir: { type: 'choir', vol: 0.2, rev: 0.7, attack: 0.3, release: 1 },
      sub: { type: 'subbass', vol: 0.34, role: 'pad' },
      dr: { type: 'drums', vol: 0.6, rev: 0.25 },
    },
    pat: {
      intro: {
        ost: J([O.Dm, O.Dm, O.Dm, O.A]),
        choir: holds(['D4+A4', 'D4+A4', 'D4+F4+A4', 'C#4+E4+A4']),
        hero: J([R(), R(), 'A4 - - - - - - - D5 - - - - - - -', 'E5 - - - - - - - C#5 - - - - - - -']),
        sub: holds(['D2', 'D2', 'D2', 'A1']),
        dr: J(['b! . . . . . . . b . . . . . . .', 'b! . . . . . . . b . . . b . . .', 'b! . . . b . . . b . . . b . . .', 'b! . b . b . b . T T t t T T t t']),
      },
      A: { hero: heroA, ost: ostA, choir: choirA, sub: subA, dr: 'b+k! . h . s . h k b . h k s . h .' },
      A2: { hero: dbl(heroA, -12), ost: ostA, choir: choirA, sub: subA, dr: 'b+k! . h k s . h k b . k k s T t t' },
      B: {
        choir: choirB, ost: ostB, sub: subB,
        hero: J([R(), R(), R(), R(), H('D6'), H('C6'), 'Bb5 - - - - - - - D6 - - - - - - -', 'C#6 - - - - - - - E6 - - - - - - -']),
        dr: 'b! . h . s . h . b . b h s . h h',
      },
      B2: { choir: choirB, ost: ostB, sub: subB, hero: dbl(choirB, -12), dr: 'b! . h k s . h k b . b h s . s s' },
      brk: {
        hero: J([
          'A4 - - - D5 - - - F#5 - E5 - D5 - - -', // the theme in D major, triumphant
          'B4 - - - D5 - - - G5 - F#5 - E5 - - -',
          'F#5 - - - - - - - A5 - - - D6 - - -',
          'C#6 - - - - - - - A5 - - - G5 - E5 -',
        ]),
        choir: holds(['F#4+A4+D5', 'G4+B4+D5', 'F#4+A4+D5', 'E4+G4+C#5']),
        ost: J([O.D, O.G, O.DA, O.A7]),
        sub: holds(['D2', 'G1', 'A1', 'A1']),
        dr: J(['b! . . . . . . . b . . . b . . .', 'b! . . . . . . . b . . . b . . .', 'b! . . . b . . . b . . . b . . .', 'b! . b . b . b . s s s s s! s! s! s!']),
      },
    },
    seq: ['intro', 'A', 'A2', 'B', 'B2', 'brk', 'A2'],
    loop: 1,
  };
})();

// ==========================================================================
// BOSS (OPTIONAL): A minor, 165 bpm. Harp racing up and down two octaves, pizzicato off-beats,
// 3+3+2 drums. The syncopated hook IS Bead's Theme (E5 A5 C6 B5 A5), grinning.
// ==========================================================================
const boss_optional = (() => {
  const run = (l) => [...l, ...l.slice(0, 7).reverse(), l[1]].join(' ');
  const RN = {
    Am: run(['A2', 'C3', 'E3', 'A3', 'C4', 'E4', 'A4', 'C5']), F: run(['F2', 'A2', 'C3', 'F3', 'A3', 'C4', 'F4', 'A4']),
    Dm: run(['D2', 'F2', 'A2', 'D3', 'F3', 'A3', 'D4', 'F4']), E: run(['E2', 'G#2', 'B2', 'E3', 'G#3', 'B3', 'E4', 'G#4']),
    B7: run(['B2', 'D#3', 'F#3', 'A3', 'B3', 'D#4', 'F#4', 'A4']), G: run(['G2', 'B2', 'D3', 'G3', 'B3', 'D4', 'G4', 'B4']),
    Em: run(['E2', 'G2', 'B2', 'E3', 'G3', 'B3', 'E4', 'G4']), C: run(['C3', 'E3', 'G3', 'C4', 'E4', 'G4', 'C5', 'E5']),
    E7: run(['E2', 'G#2', 'B2', 'D3', 'E3', 'G#3', 'B3', 'D4']),
  };
  const pz = (c) => `. . ${c} . . . ${c} . . . ${c} . . ${c} . .`;
  const PZ = { Am: 'C4+E4', F: 'C4+F4', Dm: 'D4+F4', E: 'D4+G#4', B7: 'D#4+A4', G: 'B3+D4', Em: 'E4+G4', C: 'E4+G4', E7: 'D4+G#4' };
  const bs = (r, o) => `${r} . . ${o} . . ${r} . . ${o} . . ${r} . ${o} .`;
  const BS = { Am: bs('A1', 'A2'), F: bs('F1', 'F2'), Dm: bs('D2', 'D3'), E: bs('E1', 'E2'), B7: bs('B1', 'B2'), G: bs('G1', 'G2'), Em: bs('E1', 'E2'), C: bs('C2', 'C3'), E7: bs('E1', 'E2') };
  const chA = ['Am', 'F', 'Dm', 'E', 'Am', 'F', 'B7', 'E'];
  const chB = ['F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'E7'];
  const melA = J([
    'E5 - - A5 - - C6 - B5 - A5 - G#5 - A5 -', // Bead's Theme, syncopated
    'C6 - - A5 - - F5 - - - - - E5 - F5 -',
    'D5 - - F5 - - A5 - - - G5 - F5 - E5 -',
    'G#5 - - - B5 - - - E6 - - - D6 - B5 -',
    'E5 - - A5 - - C6 - B5 - A5 - - - - -',
    'A5 - - C6 - - F6 - - - E6 - D6 - C6 -',
    'D#6 - - B5 - - F#5 - - - A5 - - - - -',
    'G#5 - - - - - - - E5 - - - . . . .',
  ]);
  const melB = J([
    'A5 - - - C6 - - - A5 - G5 - F5 - - -',
    'G5 - - - B5 - - - D6 - - - B5 - - -',
    'B5 - - G5 - - E5 - - - F#5 - G5 - - -',
    'A5 - - - - - - - E5 - - - C5 - - -',
    'F5 - - A5 - - D6 - - - C6 - A5 - - -',
    'B5 - - G5 - - D5 - - - G5 - B5 - - -',
    'C6 - - - - - - - E6 - - - G5 - - -',
    'G#5 - - - B5 - - - D6 - - - E6 - - -',
  ]);
  const lay = (ch) => ({ harp: J(ch.map((c) => RN[c])), pizz: J(ch.map((c) => pz(PZ[c]))), bass: J(ch.map((c) => BS[c])) });
  const drA = 'k+h . h k . h s+h . h k+h . h s+h . k h?';
  return {
    bpm: 165,
    vol: 0.72,
    inst: {
      harp: { type: 'harp', vol: 0.24, rev: 0.3, pan: -0.25, bright: 0.75, role: 'pad' },
      str: { type: 'strings', vol: 0.32, attack: 0.03, release: 0.2, rev: 0.3, pan: 0.15 },
      pizz: { type: 'pluck', vol: 0.2, rev: 0.2, pan: 0.35, role: 'pad' },
      bass: { type: 'bass', vol: 0.34, role: 'pad' },
      dr: { type: 'drums', vol: 0.55, rev: 0.15 },
    },
    pat: {
      intro: { harp: J([RN.Am, RN.E]), bass: J([BS.Am, BS.E]), dr: J(['k . . k . . s . . k . . s . k .', 'k . . k . . s . . k . . s s s! s!']) },
      A: { ...lay(chA), str: melA, dr: drA },
      A2: { ...lay(chA), str: dbl(melA, -12), dr: 'k+h . h k+h . h s+h . h k+h . k s+h . k+h s?' },
      B: { ...lay(chB), str: melB, dr: 'k+h . h . s+h . h k . h k+h . s+h . h .' },
      B2: { ...lay(chB), str: dbl(melB, -12), dr: 'k+h . h k s+h . h k . h k+h . s+h . s s?' },
      brk: {
        harp: J(['E3 F3 F#3 G3 G#3 A3 A#3 B3 C4 C#4 D4 D#4 E4 F4 F#4 G4', 'G#4 G4 F#4 F4 E4 D#4 D4 C#4 C4 B3 A#3 A3 G#3 G3 F#3 F3', H('E3'), R()]),
        str: J([R(), R(), 'E5+G#5+B5! . . E5+G#5+B5 . . E5+G#5+B5! . . . . . . . . .', 'D6! - - - B5 - - - G#5 - - - B5 - D6 -']),
        bass: J([BS.E, BS.E, BS.E, BS.E7]),
        dr: J(['k . . k . . s . . k . . s . k .', 'k . . k . . s . . k . . s . k .', 'T . . T . . t . . T . . t . t .', 'T . T . t . t . s s s s s! . s! .']),
      },
    },
    seq: ['intro', 'A', 'A2', 'B', 'B2', 'brk', 'A2'],
    loop: 1,
  };
})();

export default { cistern, kilns, mirror, bellfry, archive, warrens, frost, boss_mid, boss_keeper, boss_optional };
