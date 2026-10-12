// "Bead's Theme" — the main leitmotif (D minor: i - VI - III - VII ... V).
// Motif: A4 . D5 . F5 E5 D5 — every area track quotes it somewhere.
const arpDm = 'D3 A3 D4 F4 A4 F4 D4 A3 D3 A3 D4 F4 A4 D5 A4 F4';
const arpBb = 'Bb2 F3 Bb3 D4 F4 D4 Bb3 F3 Bb2 F3 Bb3 D4 F4 Bb4 F4 D4';
const arpF = 'F2 C3 F3 A3 C4 A3 F3 C3 F2 C3 F3 A3 C4 F4 C4 A3';
const arpC = 'C3 G3 C4 E4 G4 E4 C4 G3 C3 G3 C4 E4 G4 C5 G4 E4';
const arpGm = 'G2 D3 G3 Bb3 D4 Bb3 G3 D3 G2 D3 G3 Bb3 D4 G4 D4 Bb3';
const arpA = 'A2 E3 A3 C#4 E4 C#4 A3 E3 A2 E3 A3 C#4 E4 A4 E4 C#4';
const hold = (c) => c + ' - - - - - - - - - - - - - - -';

export default {
  bpm: 76,
  vol: 0.75,
  inst: {
    harp: { type: 'harp', vol: 0.32, rev: 0.45, dly: 0.12, pan: -0.15, humanize: true },
    piano: { type: 'piano', vol: 0.42, rev: 0.5, dly: 0.18, pan: 0.1 },
    strings: { type: 'strings', vol: 0.18, rev: 0.6, attack: 0.5, release: 1.2 },
    bass: { type: 'subbass', vol: 0.32 },
    bells: { type: 'celesta', vol: 0.12, rev: 0.7, dly: 0.3 },
    choir: { type: 'choir', vol: 0.16, rev: 0.8, attack: 1.0, release: 2 },
  },
  pat: {
    intro: {
      harp: [arpDm, arpBb, arpF, arpC].join(' | '),
      strings: [hold('D4+F4+A4'), hold('D4+F4+Bb4'), hold('C4+F4+A4'), hold('C4+E4+G4')].join(' | '),
      bass: [hold('D2'), hold('Bb1'), hold('F2'), hold('C2')].join(' | '),
    },
    A: {
      harp: [arpDm, arpBb, arpF, arpC, arpDm, arpBb, arpGm, arpA].join(' | '),
      piano: [
        'A4 - - - D5 - - - F5 - E5 - D5 - - -',
        'C5 - D5 - Bb4 - - - F4 - - - - - - -',
        'A4 - - - C5 - - - F5 - E5 - F5 - G5 -',
        'E5 - - - - - - - C5 - D5 - E5 - - -',
        'F5 - - - E5 - D5 - A5 - - - G5 - F5 -',
        'F5 - - - D5 - - - Bb4 - C5 - D5 - - -',
        'D5 - - - Bb4 - A4 - G4 - - - A4 - Bb4 -',
        'A4 - - - - - - - C#5 - - - E5 - - -',
      ].join(' | '),
      strings: [hold('D4+F4+A4'), hold('D4+F4+Bb4'), hold('C4+F4+A4'), hold('C4+E4+G4'),
        hold('D4+F4+A4'), hold('D4+F4+Bb4'), hold('D4+G4+Bb4'), hold('C#4+E4+A4')].join(' | '),
      bass: [hold('D2'), hold('Bb1'), hold('F2'), hold('C2'), hold('D2'), hold('Bb1'), hold('G1'), hold('A1')].join(' | '),
    },
    B: {
      harp: [arpBb, arpF, arpC, arpDm, arpBb, arpF, arpGm, arpA].join(' | '),
      piano: [
        'D5 - - - F5 - - - Bb5 - A5 - G5 - F5 -',
        'A5 - - - - - - - F5 - G5 - A5 - - -',
        'G5 - - - E5 - - - C5 - D5 - E5 - G5 -',
        'F5 - - - - - E5 - D5 - - - - - - -',
        'D5 - - - F5 - - - Bb5 - A5 - G5 - F5 -',
        'C6 - - - A5 - - - F5 - G5 - A5 - - -',
        'Bb5 - - - A5 - G5 - D5 - - - G5 - - -',
        'A5 - - - - - - - - - - - - - - -',
      ].join(' | '),
      bells: [
        '. . . . . . . . D6 . . . . . . .',
        '. . . . . . . . C6 . . . . . . .',
        '. . . . . . . . E6 . . . . . . .',
        '. . . . . . . . A5 . . . . . . .',
        '. . . . . . . . D6 . . . . . . .',
        '. . . . . . . . F6 . . . . . . .',
        '. . . . . . . . D6 . . . . . . .',
        '. . . . . . . . C#6 . . . E6 . . .',
      ].join(' | '),
      choir: [hold('Bb3+D4+F4'), hold('A3+C4+F4'), hold('G3+C4+E4'), hold('A3+D4+F4'),
        hold('Bb3+D4+F4'), hold('A3+C4+F4'), hold('G3+Bb3+D4'), hold('A3+C#4+E4')].join(' | '),
      strings: [hold('D4+F4+Bb4'), hold('C4+F4+A4'), hold('C4+E4+G4'), hold('D4+F4+A4'),
        hold('D4+F4+Bb4'), hold('C4+F4+A4'), hold('D4+G4+Bb4'), hold('C#4+E4+A4')].join(' | '),
      bass: [hold('Bb1'), hold('F2'), hold('C2'), hold('D2'), hold('Bb1'), hold('F2'), hold('G1'), hold('A1')].join(' | '),
    },
  },
  seq: ['intro', 'A', 'A', 'B', 'A'],
  loop: 1,
};
