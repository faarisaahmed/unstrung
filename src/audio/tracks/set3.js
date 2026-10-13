// Music set 3: the deep places, the moon, the bosses at the end of the thread, and the endings.
// Default export: { trackId: song }. See docs/MUSIC.md.
//
// Everything here grows out of "Bead's Theme" (title.js): A4 . D5 . F5 E5 D5  (5-1-3-2-1).
// Shorthand used below: M('A4:4 D5:4 r:8') = note:steps (r = rest); bars are separated by '|'
// and each bar is checked for its length (16 steps unless stated) at load time.
import title from './title.js';

// ---------- helpers ----------
function M(s, bar = 16) {
  const out = [];
  s.split('|').forEach((seg, i) => {
    let n = 0;
    for (const t of seg.trim().split(/\s+/).filter(Boolean)) {
      const k = t.lastIndexOf(':');
      const note = k < 0 ? t : t.slice(0, k);
      const len = k < 0 ? 1 : Number(t.slice(k + 1));
      n += len;
      out.push(note === 'r' ? '.' : note);
      for (let j = 1; j < len; j++) out.push(note === 'r' ? '.' : '-');
    }
    if (bar && n % bar) console.warn(`[set3] bar ${i} has ${n} steps: "${seg.trim().slice(0, 50)}"`);
  });
  return out.join(' ');
}
const H = (c, n = 16) => M(`${c}:${n}`, 0);          // hold a note/chord n steps
const R = (n = 16) => M(`r:${n}`, 0);                 // rest n steps
const cat = (...a) => a.join(' | ');
const rep = (s, n) => Array(n).fill(s).join(' | ');
const toks = (s) => s.replace(/\|/g, ' ').trim().split(/\s+/);
const up = (s, n = 1) => s.replace(/([A-G][#b]?)(-?\d)/g, (_, p, o) => p + (Number(o) + n));
const ghost = (s) => toks(s).map((t) => (/^[A-G]/.test(t) && !/[!?]$/.test(t) ? t + '?' : t)).join(' ');
const L = (s) => s.split(' ');
// title-style 16th arpeggio over 6 notes (root, 5th, 8ve, 3rd, 5th, top)
const arp = (s) => { const n = L(s); return [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 4, 3].map((i) => n[i]).join(' '); };
const arpH = (s) => { const n = L(s); return [0, 1, 2, 3, 4, 3, 2, 1].map((i) => n[i]).join(' '); };
// driving 8th-note bass: root root oct root | root root oct root
const drive = (r, o) => M(`${r}:2 ${r}:2 ${o}:2 ${r}:2 ${r}:2 ${r}:2 ${o}:2 ${r}:2`);
const driveH = (r, o) => M(`${r}:2 ${r}:2 ${o}:2 ${r}:2`, 8);
// 16th string ostinato on a triad: r r f r t r f r (x2)
const ost = (r, f, t) => `${r} ${r} ${f} ${r} ${t} ${r} ${f} ${r} ${r} ${r} ${f} ${r} ${t} ${r} ${f} ${r}`;
const ostH = (r, f, t) => `${r} ${r} ${f} ${r} ${t} ${r} ${f} ${r}`;
const O = (s) => ost(...L(s));
const OH = (s) => ostH(...L(s));

// =====================================================================================
// THE LOOM BELOW: D Dorian, 60 bpm. A harp "shuttle" passes up and back across each bar
// like thread across a loom; low choir drones; a distant bell. The slow choir line is Bead's
// Theme (A D F E D) in Dorian colour (B natural, G major IV).
// =====================================================================================
const sh = (s) => { const n = L(s); return M(`${n[0]}:2 ${n[1]}:2 ${n[2]}:2 ${n[3]}:2 ${n[4]}:2 ${n[3]}:2 ${n[2]}:2 ${n[1]}:2`); };
const SH = {
  Dm: 'D4 E4 F4 A4 C5', GD: 'D4 E4 G4 B4 D5', CD: 'D4 E4 G4 C5 E5', Em7: 'D4 E4 G4 B4 E5',
  F: 'C4 F4 G4 A4 C5', CE: 'C4 E4 G4 C5 E5', G: 'D4 G4 A4 B4 D5', Em: 'E4 G4 B4 D5 E5',
};
const loomA = {
  harp: cat(sh(SH.Dm), sh(SH.GD), sh(SH.CD), sh(SH.Dm), sh(SH.Dm), sh(SH.GD), sh(SH.Em7),
    M('D4:2 E4:2 A4:2 D5:2 C5:2 A4:2 E4:2 C4:2')),
  choirLo: cat(H('D3+A3', 96), H('E3+G3+B3'), H('D3+E3+A3', 8) + ' ' + H('C3+E3+A3', 8)),
  bass: cat(H('D2', 96), H('E2'), H('A1')),
};
const loomMelA = M('A4:8 D5:8 | F5:4 E5:4 D5:8 | E5:8 G5:4 E5:4 | D5:16 | A4:8 D5:8 | F5:4 E5:4 D5:4 B4:4 | E5:8 D5:4 B4:4 | D5:8 C5:8');
const loom = {
  bpm: 60,
  vol: 0.78,
  inst: {
    harp: { type: 'harp', vol: 0.3, rev: 0.65, dly: 0.22, pan: -0.2, humanize: true },
    choirLo: { type: 'choir', vol: 0.13, rev: 0.85, attack: 2.5, release: 3, pan: 0.1 },
    choirHi: { type: 'choir', vol: 0.14, rev: 0.8, attack: 0.9, release: 2, pan: -0.05 },
    bell: { type: 'bell', vol: 0.1, rev: 0.9, dly: 0.35, pan: 0.3 },
    bass: { type: 'subbass', vol: 0.3 },
  },
  pat: {
    intro: {
      choirLo: H('D3+A3', 64),
      bass: H('D2', 64),
      bell: M('D6:16 | r:16 | A5:16 | r:16'),
      harp: cat(R(32), sh(SH.Dm), sh(SH.CD)),
    },
    A: { ...loomA, choirHi: loomMelA, bell: M('r:16 | r:16 | r:16 | r:16 | r:8 D6:8 | r:16 | r:16 | r:16') },
    B: {
      harp: cat(sh(SH.F), sh(SH.CE), sh(SH.Dm), sh(SH.G), sh(SH.F), sh(SH.CE), sh(SH.Em),
        M('D4:2 E4:2 A4:2 D5:2 C#5:2 A4:2 E4:2 C#4:2')),
      choirLo: cat(H('F3+A3+C4'), H('E3+G3+C4'), H('D3+F3+A3'), H('D3+G3+B3'), H('F3+A3+C4'), H('E3+G3+C4'),
        H('E3+G3+B3'), H('D3+E3+A3', 8) + ' ' + H('C#3+E3+A3', 8)),
      choirHi: M('C5:4 F5:4 A5:8 | G5:4 E5:4 C5:8 | D5:4 F5:4 A5:4 G5:4 | D5:16 | A5:4 G5:4 F5:8 | E5:8 C5:8 | B4:4 D5:4 E5:8 | D5:8 C#5:8'),
      bass: M('F2:16 | E2:16 | D2:16 | G1:16 | F2:16 | E2:16 | E2:16 | A1:16'),
      bell: M('r:8 C6:8 | r:16 | r:16 | r:16 | r:8 A5:8 | r:16 | r:16 | r:16'),
    },
    // the bell alone carries the theme, the choir falls back to its drone
    A2: { ...loomA, bell: loomMelA },
  },
  seq: ['intro', 'A', 'B', 'A2'],
  loop: 1,
};

// =====================================================================================
// MOON'S CRADLE: D major, 90 bpm. Bead's Theme in major (A D F# E D), a borrowed G minor
// for the ache, and a build: piano -> + choir -> strings take the tune -> full crescendo.
// =====================================================================================
const CR = {
  D: 'D3 A3 D4 F#4 A4 D5', AC: 'C#3 E3 A3 C#4 E4 A4', Bm: 'B2 F#3 B3 D4 F#4 B4', G: 'G2 D3 G3 B3 D4 G4',
  DF: 'F#2 D3 A3 D4 F#4 A4', Gm: 'G2 D3 G3 Bb3 D4 G4', Em7: 'E2 B2 E3 G3 D4', A7: 'A2 E3 A3 C#4 G4',
  A: 'A2 E3 A3 C#4 E4 A4', Fm: 'F#2 C#3 F#3 A3 C#4 F#4', Em: 'E2 B2 E3 G3 B3 D4', As: 'A2 E3 A3 D4 E4 A4',
};
const cradleMel = M('A4:4 D5:4 F#5:2 E5:2 D5:4 | C#5:6 D5:2 E5:8 | F#4:4 B4:4 D5:2 C#5:2 B4:4 | G4:4 A4:4 B4:4 D5:4 | A4:4 D5:4 F#5:2 E5:2 D5:4 | D5:4 G5:4 Bb5:2 A5:2 G5:4 | G5:4 F#5:4 E5:4 C#5:4 | D5:12 r:4');
const cradlePad = cat(H('A3+D4+F#4'), H('A3+C#4+E4'), H('B3+D4+F#4'), H('B3+D4+G4'), H('A3+D4+F#4'), H('Bb3+D4+G4'),
  H('B3+D4+G4', 8) + ' ' + H('A3+C#4+G4', 8), H('A3+D4+F#4'));
const cradleBass = M('D2:16 | C#2:16 | B1:16 | G1:16 | F#1:16 | G1:16 | E2:8 A1:8 | D2:16');
const cradleArp = cat(arp(CR.D), arp(CR.AC), arp(CR.Bm), arp(CR.G), arp(CR.DF), arp(CR.Gm), arpH(CR.Em7) + ' ' + arpH(CR.A7), arp(CR.D));
const cradle = {
  bpm: 90,
  vol: 0.78,
  inst: {
    piano: { type: 'piano', vol: 0.4, rev: 0.5, dly: 0.15, pan: 0.1 },
    harp: { type: 'harp', vol: 0.24, rev: 0.5, dly: 0.1, pan: -0.25, humanize: true },
    strings: { type: 'strings', vol: 0.2, rev: 0.6, attack: 0.25, release: 1.2, pan: 0.05 },
    choir: { type: 'choir', vol: 0.14, rev: 0.8, attack: 1, release: 2 },
    bass: { type: 'subbass', vol: 0.3 },
    drums: { type: 'drums', vol: 0.35, rev: 0.45 },
  },
  pat: {
    intro: {
      harp: cat(arp(CR.D), arp(CR.Bm), arp(CR.G), arp(CR.A)),
      strings: cat(H('A3+D4+F#4'), H('B3+D4+F#4'), H('B3+D4+G4'), H('A3+C#4+E4')),
      bass: M('D2:16 | B1:16 | G1:16 | A1:16'),
    },
    A: { piano: cradleMel, harp: cradleArp, strings: cradlePad, bass: cradleBass },
    A2: {
      piano: cradleMel, harp: cradleArp, strings: cradlePad, choir: cradlePad, bass: cradleBass,
      drums: 'b . . . . . . . . . . . . . . .',
    },
    B: {
      strings: M('B4:4 D5:4 G5:8 | C#5:4 E5:4 A5:8 | F#5:4 A5:4 C#6:8 | D6:4 C#6:4 B5:8 | B5:4 G5:4 D5:4 G5:4 | G5:4 F#5:4 E5:4 D5:4 | E5:8 D5:8 | C#5:8 E5:4 A5:4'),
      choir: cat(H('B3+D4+G4'), H('A3+C#4+E4'), H('A3+C#4+F#4'), H('B3+D4+F#4'), H('B3+D4+G4'), H('B3+E4+G4'), H('A3+D4+E4'), H('A3+C#4+E4')),
      piano: M('B3+D4+G4?:8 B3+D4+G4?:8 | A3+C#4+E4?:8 A3+C#4+E4?:8 | A3+C#4+F#4?:8 A3+C#4+F#4?:8 | B3+D4+F#4?:8 B3+D4+F#4?:8 | B3+D4+G4?:8 B3+D4+G4?:8 | B3+E4+G4?:8 B3+E4+G4?:8 | A3+D4+E4?:8 A3+D4+E4?:8 | A3+C#4+E4?:8 A3+C#4+E4:8'),
      harp: cat(arp(CR.G), arp(CR.A), arp(CR.Fm), arp(CR.Bm), arp(CR.G), arp(CR.Em), arp(CR.As), arp(CR.A)),
      bass: M('G2:16 | A2:16 | F#2:16 | B1:16 | G1:16 | E2:16 | A1:16 | A1:16'),
      drums: rep('b . . . . . . . t . . . . . t .', 7) + ' | t . t . t . T . T . T . T T T T',
    },
    // climax: strings sing the theme, piano rings it an octave higher
    A3: {
      strings: cradleMel, piano: up(cradleMel), choir: cradlePad, harp: cradleArp, bass: cradleBass,
      drums: rep('b . . . t . . . b . . . t . t .', 7) + ' | b . . . . . . . . . . . . . . .',
    },
  },
  seq: ['intro', 'A', 'A2', 'B', 'A3'],
  loop: 1,
};

// =====================================================================================
// THE UNWOVEN: around D, 55 bpm. Detuned pads drift between Dm(b9), Db, Bb(#11) and A7(b5);
// Bead's Theme arrives in broken pieces: cut off, a semitone wrong, reversed, in the wrong key.
// =====================================================================================
const unPadA = cat(H('F3+A3+Eb4', 32), H('F3+Ab3+E4', 32), H('F3+A3+E4', 32), H('Eb3+G3+C#4', 32));
const unPadB = cat(H('D2+A2', 32), H('Db2+Ab2', 32), H('Bb1+F2', 32), H('A1+Eb2', 32));
const unSub = M('D2:32 | Db2:32 | Bb1:32 | A1:32', 32);
const unPianoA = M('A4:4 D5:4 r:8 | r:16 | r:8 F5:2 E5:2 r:4 | r:16 | D5:2 F5:2 E5:12 | r:16 | r:4 C#5:4 A4:8 | r:16');
const unwoven = {
  bpm: 55,
  vol: 0.8,
  inst: {
    padA: { type: 'pad', vol: 0.14, detune: 28, attack: 2.5, release: 3.5, rev: 0.85, cutoff: 1400, pan: -0.2 },
    padB: { type: 'pad', vol: 0.12, detune: 16, attack: 3, release: 3, rev: 0.7, cutoff: 700, pan: 0.2 },
    piano: { type: 'piano', vol: 0.3, rev: 0.9, dly: 0.45, cutoff: 2200, pan: 0.15 },
    bell: { type: 'bell', vol: 0.08, rev: 0.95, dly: 0.4, pan: -0.35 },
    sub: { type: 'subbass', vol: 0.28 },
  },
  pat: {
    intro: {
      padA: H('F3+A3+Eb4', 32) + ' ' + H('F3+Ab3+E4', 32),
      padB: H('D2+A2', 32) + ' ' + H('Db2+Ab2', 32),
      sub: H('D2', 32) + ' ' + H('Db2', 32),
    },
    A: { padA: unPadA, padB: unPadB, sub: unSub, piano: unPianoA, bell: M('r:16 | r:8 D6:8 | r:16 | r:16 | r:16 | r:8 Ab5:8 | r:16 | r:16') },
    B: {
      padA: unPadA, padB: unPadB, sub: unSub,
      // retrograde; the theme in Db; the theme again, ending a semitone flat
      piano: M('D5:2 E5:2 F5:4 D5:4 A4:4 | r:16 | Ab4:4 Db5:4 F5:2 Eb5:2 Db5:4 | r:16 | r:16 | A4:4 D5:4 F5:2 E5:2 Eb5:4 | r:16 | r:12 C#5:4'),
      bell: M('r:16 | r:16 | r:16 | r:8 Ab5:8 | r:16 | r:16 | r:16 | r:8 D6:8'),
    },
    A2: { padA: unPadA, padB: unPadB, sub: unSub, piano: up(unPianoA, -1), bell: M('r:16 | r:16 | r:16 | r:8 Ab5:8 | r:16 | r:16 | r:16 | r:8 D6:8') },
  },
  seq: ['intro', 'A', 'B', 'A2'],
  loop: 1,
};

// =====================================================================================
// DUSTMOTE DUNES: G major, 110 bpm, light swing. Kalimba hook ("da-da-DUM, da-da-DUM"),
// marimba oom-pah, pizzicato, a bass that bounces with chromatic walk-ups. In B the marimba
// plays Bead's Theme in C, A minor and G while the kalimba answers with silly slides.
// =====================================================================================
const off = (c) => `. . ${c} . . . ${c} . . . ${c} . . . ${c} .`;
const offH = (c) => `. . ${c} . . . ${c} .`;
const bb = (r, f, a1, a2) => M(`${r}:2 r:2 ${f}:2 r:2 ${r}:2 r:2 ${a1}:2 ${a2}:2`);
const rf = (r, f) => M(`${r}:2 r:2 ${f}:2 r:2 ${r}:2 r:2 ${f}:2 r:2`);
const DC = { G: 'B3+D4+G4', C: 'C4+E4+G4', D7: 'C4+D4+F#4', E7: 'B3+D4+G#4', Am: 'C4+E4+A4', A7: 'C#4+E4+G4', D: 'A3+D4+F#4' };
const dunesHook = M('D5:1 D5:1 G5:2 r:2 D5:1 D5:1 B5:2 r:2 A5:2 G5:2 | E5:2 G5:2 E5:2 C5:2 r:4 C5:1 D5:1 E5:2 | F#5:2 A5:2 F#5:2 D5:2 C5:2 A4:2 F#4:2 A4:2 | B4:2 G4:2 D4:2 r:2 D4:1 E4:1 F#4:2 G4:2 r:2 | D5:1 D5:1 G5:2 r:2 D5:1 D5:1 B5:2 r:2 A5:2 G5:2 | G#5:2 B5:2 G#5:2 E5:2 D5:2 E5:2 G#5:2 B5:2 | A5:2 G5:2 E5:2 C5:2 D5:2 F#5:2 A5:2 C6:2 | B5:2 A5:1 G5:1 r:2 D5:2 G4:2 r:6');
const dunesA = {
  kal: dunesHook,
  mar: cat(off(DC.G), off(DC.C), off(DC.D7), off(DC.G), off(DC.G), off(DC.E7), offH(DC.Am) + ' ' + offH(DC.D7), off(DC.G)),
  bass: cat(bb('G2', 'D2', 'A2', 'B2'), bb('C3', 'G2', 'B2', 'C#3'), bb('D3', 'A2', 'A2', 'F#2'), bb('G2', 'D2', 'E2', 'F#2'),
    bb('G2', 'D2', 'F#2', 'F2'), bb('E2', 'B1', 'F#2', 'G#2'), M('A2:2 r:2 E2:2 r:2 D3:2 r:2 A2:2 F#2:2'), M('G2:2 r:2 D2:2 r:2 G2:2 r:4 D2:2')),
  drums: 'k . x . r . x . k . x k r . x .',
};
const dunes = {
  bpm: 110,
  vol: 0.74,
  swing: 0.12,
  inst: {
    kal: { type: 'kalimba', vol: 0.4, rev: 0.3, dly: 0.12, pan: 0.15 },
    mar: { type: 'marimba', vol: 0.3, rev: 0.25, pan: -0.2 },
    pizz: { type: 'pluck', vol: 0.26, cutoff: 2200, rev: 0.3, pan: -0.35 },
    bass: { type: 'bass', vol: 0.34, legato: 0.5 },
    drums: { type: 'drums', vol: 0.4, rev: 0.15 },
  },
  pat: {
    intro: {
      pizz: M('G5:2 D5:2 B4:2 G4:2 r:8 | r:8 D4:2 F#4:2 A4:2 C5:2'),
      mar: cat(off(DC.G), off(DC.D7)),
      bass: M('G2:2 r:6 G2:2 r:6 | D2:2 r:6 D2:2 r:2 E2:2 F#2:2'),
      drums: 'k . . . r . . . k . . . r . r r',
    },
    A: dunesA,
    A2: {
      ...dunesA,
      pizz: M('B3:4 D4:4 G4:4 D4:4 | C4:4 E4:4 G4:4 E4:4 | C4:4 D4:4 F#4:4 A4:4 | B3:4 D4:4 G4:4 B4:4 | B3:4 D4:4 G4:4 D4:4 | B3:4 D4:4 G#4:4 E4:4 | C4:4 E4:4 C4:4 F#4:4 | B3:4 D4:4 G4:8'),
    },
    B: {
      mar: M('G4:2 r:2 C5:2 r:2 E5:1 D5:1 C5:2 r:4 | r:16 | E4:2 r:2 A4:2 r:2 C5:1 B4:1 A4:2 r:4 | r:16 | G4:2 r:2 C5:2 r:2 E5:1 D5:1 C5:2 r:2 E5:2 | D5:2 r:2 G5:2 r:2 B5:1 A5:1 G5:2 r:4 | r:16 | r:16'),
      kal: M('r:16 | r:4 B5:1 Bb5:1 A5:1 Ab5:1 G5:2 r:2 D5:2 r:2 | r:16 | r:4 F#5:1 F5:1 E5:1 Eb5:1 D5:2 r:2 A4:2 r:2 | r:16 | r:16 | A5:2 C#6:2 E5:2 G5:2 A5:2 G5:2 E5:2 C#5:2 | D5:1 D5:1 r:2 C6:2 r:2 A5:2 F#5:2 D5:2 C5:2'),
      pizz: cat(off(DC.C), off(DC.G), off(DC.Am), off(DC.D), off(DC.C), off(DC.G), off(DC.A7), off(DC.D7)),
      bass: cat(rf('C3', 'G2'), rf('B2', 'G2'), rf('A2', 'E2'), rf('D3', 'A2'), rf('C3', 'G2'), rf('B2', 'G2'), rf('A2', 'E2'),
        M('D3:2 r:2 A2:2 r:2 C3:2 r:2 B2:2 A2:2')),
      drums: 'k . x . r . x . k . x . r . r r',
    },
  },
  seq: ['intro', 'A', 'A2', 'B', 'A2'],
  loop: 1,
};

// =====================================================================================
// HALL OF ECHOES: C major / A minor, 80 bpm. A four-part organ hymn; in the A-minor verse the
// choir sings Bead's Theme (in A minor, then C major) doubled by bells; then the hymn returns
// with the choir on the tune and tolling bells.
// =====================================================================================
const hymnOrgan = M('E5+C5+G4:8 D5+B4+G4:4 C5+A4+E4:4 | F5+C5+A4:8 E5+C5+G4:8 | D5+A4+F4:4 C5+A4+E4:4 B4+G4+D4:4 C5+G4+E4:4 | D5+C5+G4:8 D5+B4+G4:8 | G5+E5+C5:8 A5+F5+C5:4 G5+E5+C5:4 | F5+D5+A4:8 E5+C5+G4:4 D5+B4+G4:4 | C5+A4+E4:4 E5+C5+G4:4 D5+B4+F4:8 | C5+G4+E4:16');
const hymnBass = M('C3:8 B2:4 A2:4 | F2:8 C3:8 | F2:4 A2:4 G2:4 E2:4 | G2:16 | E2:8 F2:4 C2:4 | D2:8 C2:4 B1:4 | A1:4 G1:12 | C2:16');
const hymnTune = M('E5:8 D5:4 C5:4 | F5:8 E5:8 | D5:4 C5:4 B4:4 C5:4 | D5:16 | G5:8 A5:4 G5:4 | F5:8 E5:4 D5:4 | C5:4 E5:4 D5:8 | C5:16');
const echoes = {
  bpm: 80,
  vol: 0.76,
  inst: {
    organ: { type: 'organ', vol: 0.24, rev: 0.7, attack: 0.08, release: 0.6 },
    choir: { type: 'choir', vol: 0.17, rev: 0.85, attack: 0.5, release: 1.5 },
    bell: { type: 'bell', vol: 0.13, rev: 0.85, dly: 0.2, pan: 0.2 },
    bass: { type: 'subbass', vol: 0.32 },
    drums: { type: 'drums', vol: 0.42, rev: 0.6 },
  },
  pat: {
    intro: { bell: M('G5:8 C5:8 | G5:8 C5:8'), organ: H('C3+G3+C4', 32), bass: H('C2', 32) },
    A: { organ: hymnOrgan, bass: hymnBass },
    B: {
      organ: cat(H('E3+A3+C4'), H('F3+A3+C4'), H('E3+G3+C4'), H('D3+G3+B3'), H('E3+A3+C4'), H('D3+F3+A3'),
        H('E3+A3+B3', 8) + ' ' + H('E3+G#3+B3', 8), H('E3+A3+C4')),
      choir: M('E4:4 A4:4 C5:2 B4:2 A4:4 | C5:8 A4:8 | G4:4 C5:4 E5:2 D5:2 C5:4 | B4:8 D5:8 | E5:4 D5:4 C5:4 B4:4 | D5:4 C5:4 A4:8 | A4:8 G#4:8 | A4:16'),
      bell: M('E5:4 A5:4 C6:2 B5:2 A5:4 | r:16 | G5:4 C6:4 E6:2 D6:2 C6:4 | r:16 | r:16 | r:16 | r:16 | r:16'),
      bass: M('A2:16 | F2:16 | C3:16 | G2:16 | A2:16 | D2:16 | E2:16 | A2:16'),
    },
    A2: {
      organ: hymnOrgan, bass: hymnBass, choir: hymnTune,
      bell: M('C6:16 | r:16 | r:16 | G5:16 | C6:16 | r:16 | r:16 | C6:16'),
      drums: rep('b . . . . . . . . . . . . . . .', 6) + ' | b . . . . . . . t . . . T . T . | b . . . . . . . . . . . . . . .',
    },
    toll: {
      choir: cat(H('E4+G4+C5'), H('E4+A4+C5'), H('F4+A4+C5'), H('D4+G4+B4')),
      organ: cat(H('C3+G3'), H('A2+E3'), H('F2+C3'), H('G2+D3')),
      bass: M('C3:16 | A2:16 | F2:16 | G2:16'),
      bell: M('C6:8 G5:8 | A5:8 E5:8 | F5:8 C6:8 | B5:8 D6:8'),
      drums: 'b . . . . . . . . . . . . . . .',
    },
  },
  seq: ['intro', 'A', 'B', 'A2', 'toll'],
  loop: 1,
};

// =====================================================================================
// THE WEAVER (boss): E minor, 150 bpm. Harp (left) plays the warp on even 16ths, pluck (right)
// the weft on odd 16ths: one continuous interlocking loom. Strings hook; the choir sings Bead's
// Theme in C, then B minor, in the bVI-bVII-v-i section.
// =====================================================================================
const WV = {
  Em: ['E3 B3 E4 B3 G4 B3 E4 B3', 'G5 F#5 E5 B4'], C: ['C3 G3 C4 G3 E4 G3 C4 G3', 'G5 E5 D5 B4'],
  Am: ['A2 E3 A3 E3 C4 E3 A3 E3', 'E5 C5 B4 A4'], B7: ['B2 F#3 B3 F#3 D#4 F#3 A3 F#3', 'F#5 D#5 B4 A4'],
  D: ['D3 A3 D4 A3 F#4 A3 D4 A3', 'A5 F#5 E5 D5'], Bm: ['B2 F#3 B3 F#3 D4 F#3 B3 F#3', 'F#5 D5 C#5 B4'],
  Bs: ['B2 F#3 B3 F#3 E4 F#3 A3 F#3', 'F#5 E5 B4 A4'], G: ['G2 D3 G3 D3 B3 D3 G3 D3', 'B5 A5 G5 D5'],
};
// bars: chord name, or [a, b] for two half-bar chords
const warp = (bars) => bars.map((b) => (Array.isArray(b) ? b : [b, b]).map((c, h) => L(WV[c][0]).slice(h * 4, h * 4 + 4).map((n) => `${n} .`).join(' ')).join(' ')).join(' | ');
const weft = (bars) => bars.map((b) => (Array.isArray(b) ? b : [b, b]).map((c) => L(WV[c][1]).map((n) => `. ${n}`).join(' ')).join(' ')).join(' | ');
const wvA = ['Em', 'C', 'Am', 'B7', 'Em', 'C', ['Am', 'B7'], 'Em'];
const wvB = ['C', 'D', 'Bm', 'Em', 'C', 'D', 'Bs', 'B7'];
const wvHook = M('E5:3 B4:3 E5:2 G5:4 F#5:2 E5:2 | G5:6 E5:2 C5:4 D5:2 E5:2 | A5:3 E5:3 A5:2 C6:4 B5:2 A5:2 | B5:6 A5:2 F#5:4 D#5:4 | E5:3 B4:3 E5:2 G5:4 F#5:2 E5:2 | G5:4 A5:2 B5:2 C6:4 B5:2 G5:2 | A5:4 C6:4 B5:4 D#5:4 | E5:12 r:4');
const wvBassA = cat(drive('E2', 'E3'), drive('C2', 'C3'), drive('A1', 'A2'), drive('B1', 'B2'), drive('E2', 'E3'), drive('C2', 'C3'),
  driveH('A1', 'A2') + ' ' + driveH('B1', 'B2'), drive('E2', 'E3'));
const wvChoirA = cat(H('B3+E4+G4'), H('C4+E4+G4'), H('C4+E4+A4'), H('B3+D#4+A4'), H('B3+E4+G4'), H('C4+E4+G4'),
  H('C4+E4+A4', 8) + ' ' + H('B3+D#4+A4', 8), H('B3+E4+G4'));
const wvDrA = 'k . h . s . h k k . h . s . h h';
const boss_weaver = {
  bpm: 150,
  vol: 0.78,
  inst: {
    harp: { type: 'harp', vol: 0.3, rev: 0.35, pan: -0.45, bright: 0.7 },
    pluck: { type: 'pluck', vol: 0.24, rev: 0.3, pan: 0.45, cutoff: 3500 },
    strings: { type: 'strings', vol: 0.26, attack: 0.04, release: 0.3, rev: 0.45 },
    choir: { type: 'choir', vol: 0.16, attack: 0.3, release: 1, rev: 0.7 },
    bass: { type: 'bass', vol: 0.36, legato: 0.7 },
    drums: { type: 'drums', vol: 0.55, rev: 0.2 },
  },
  pat: {
    intro: {
      harp: warp(['Em', 'Em', 'Em', 'Em']),
      pluck: cat(R(), R(), weft(['Em', 'Em'])),
      choir: H('E3+B3', 64),
      bass: cat(R(), R(), drive('E2', 'E3'), drive('E2', 'E3')),
      drums: cat(R(), R(), R(), 't . t . T . T . t t T T s s s s'),
    },
    A: { harp: warp(wvA), pluck: weft(wvA), strings: wvHook, bass: wvBassA, drums: wvDrA },
    A2: { harp: warp(wvA), pluck: weft(wvA), strings: wvHook, choir: wvChoirA, bass: wvBassA, drums: wvDrA },
    B: {
      harp: warp(wvB), pluck: weft(wvB),
      choir: M('G4:4 C5:4 E5:2 D5:2 C5:4 | F#4:8 A4:8 | F#4:4 B4:4 D5:2 C#5:2 B4:4 | G4:8 E4:8 | G4:4 C5:4 E5:2 D5:2 C5:4 | D5:8 A4:8 | E5:16 | D#5:16'),
      strings: cat(H('E3+G3+C4'), H('F#3+A3+D4'), H('F#3+B3+D4'), H('E3+G3+B3'), H('E3+G3+C4'), H('F#3+A3+D4'), H('E3+F#3+B3'), H('D#3+F#3+A3')),
      bass: cat(drive('C2', 'C3'), drive('D2', 'D3'), drive('B1', 'B2'), drive('E2', 'E3'), drive('C2', 'C3'), drive('D2', 'D3'), drive('B1', 'B2'), drive('B1', 'B2')),
      drums: rep('k . h k s . h . k . h k s . T t', 7) + ' | k . T . T . t . t . s s s s s s',
    },
    bridge: {
      harp: warp(['Em', 'Em', 'Em', 'Em']), pluck: weft(['Em', 'Em', 'Em', 'Em']),
      choir: H('B3+E4+G4', 64),
      strings: M('B3:16 | C4:16 | C#4:16 | D#4:16'),
      bass: rep(drive('E2', 'E3'), 4),
      drums: cat('b . . . t . t . b . . . t . t .', 'b . . . t . t . b . . . t . t .', 'b . t . b . t . b . t . b . t .', 's s s s s s s s s s s s s! s! s! s!'),
    },
  },
  seq: ['intro', 'A', 'A2', 'B', 'bridge', 'A2'],
  loop: 1,
};

// =====================================================================================
// SELENE, THE UNSTRUNG MOON (final boss): D minor, 160 bpm. The title progression
// (i-VI-III-VII...) turned into a war march: the lead hurls Bead's Theme in dotted rhythm,
// the choir answers with Selene's own chant, then the theme rises in D major over bVI-bVII.
// =====================================================================================
const SC = {
  Dm: 'D4 A4 F4', Bb: 'D4 Bb4 F4', F: 'C4 A4 F4', C: 'C4 G4 E4', Gm: 'D4 Bb4 G4', A: 'C#4 A4 E4', A7: 'C#4 A4 G4',
  Eb: 'Eb4 Bb4 G4', D: 'D4 A4 F#4', Bm: 'D4 B4 F#4', G: 'D4 B4 G4', As: 'D4 A4 E4',
};
const seleneMel = M('A4:3 D5:3 F5:2 E5:2 D5:2 A5:4 | Bb5:6 A5:2 G5:2 F5:2 D5:4 | C5:3 F5:3 A5:2 G5:2 F5:2 C6:4 | C6:6 Bb5:2 A5:2 G5:2 E5:4 | A4:3 D5:3 F5:2 E5:2 D5:2 F5:2 A5:2 | D6:6 C6:2 Bb5:4 F5:4 | G5:4 Bb5:4 D6:4 C6:2 Bb5:2 | A5:6 G5:2 F5:2 E5:2 C#5:4');
const seleneStrA = cat(O(SC.Dm), O(SC.Bb), O(SC.F), O(SC.C), O(SC.Dm), O(SC.Bb), O(SC.Gm), O(SC.A));
const seleneChoirA = cat(H('A3+D4+F4'), H('Bb3+D4+F4'), H('A3+C4+F4'), H('G3+C4+E4'), H('A3+D4+F4'), H('Bb3+D4+F4'), H('Bb3+D4+G4'), H('A3+C#4+E4'));
const seleneBassA = cat(drive('D2', 'D3'), drive('Bb1', 'Bb2'), drive('F2', 'F3'), drive('C2', 'C3'), drive('D2', 'D3'), drive('Bb1', 'Bb2'), drive('G1', 'G2'), drive('A1', 'A2'));
const seleneDrA = 'b . h . s . h k k . h . s . h h';
const boss_selene = {
  bpm: 160,
  vol: 0.8,
  inst: {
    choir: { type: 'choir', vol: 0.18, attack: 0.25, release: 1, rev: 0.75 },
    str: { type: 'strings', vol: 0.2, attack: 0.01, release: 0.08, legato: 0.7, rev: 0.35, pan: -0.15 },
    lead: { type: 'saw', vol: 0.5, cutoff: 2400, rev: 0.4, dly: 0.1, pan: 0.1 },
    bell: { type: 'bell', vol: 0.12, rev: 0.8, dly: 0.2, pan: 0.3 },
    bass: { type: 'bass', vol: 0.36, legato: 0.75 },
    drums: { type: 'drums', vol: 0.6, rev: 0.25 },
  },
  pat: {
    intro: {
      choir: H('A3+D4+F4', 32) + ' ' + H('Bb3+D4+F4') + ' ' + H('A3+C#4+E4'),
      str: cat(ghost(O(SC.Dm)), ghost(O(SC.Dm)), O(SC.Bb), O(SC.A)),
      bass: M('D2:32 | Bb1:16 | A1:16', 0),
      drums: cat('b . . . . . . . . . . . b . . .', 'b . . . . . . . . . . . b . . .', 'b . . . . . . . . . . . b . . .', 'b . b . b . b . t t T T s s s s'),
    },
    A: { lead: seleneMel, str: seleneStrA, choir: seleneChoirA, bass: seleneBassA, drums: seleneDrA },
    B: {
      choir: M('G4:4 Bb4:4 D5:6 C5:2 | D5:4 C5:4 A4:8 | Bb4:4 D5:4 F5:8 | E5:8 C#5:8 | G5:4 F5:4 D5:6 Bb4:2 | A4:4 D5:4 F5:8 | G5:8 Eb5:8 | E5:4 C#5:4 E5:4 G5:4'),
      str: cat(O(SC.Gm), O(SC.Dm), O(SC.Bb), O(SC.A), O(SC.Gm), O(SC.Dm), O(SC.Eb), O(SC.A7)),
      bell: M('D6:16 | A5:16 | F5:16 | E5:16 | D6:16 | A5:16 | G5:16 | C#6:16'),
      bass: cat(drive('G1', 'G2'), drive('D2', 'D3'), drive('Bb1', 'Bb2'), drive('A1', 'A2'), drive('G1', 'G2'), drive('D2', 'D3'), drive('Eb2', 'Eb3'), drive('A1', 'A2')),
      drums: 'b . h k s . h . b . h k s . h .',
    },
    // the transformation: Bead's Theme in D major, augmented, over bVI-bVII
    C: {
      lead: M('A4:8 D5:8 | F#5:8 E5:4 D5:4 | D5:4 B4:4 D5:4 G5:4 | E5:8 A5:8 | F#5:8 A5:8 | D6:6 C6:2 Bb5:8 | C6:6 Bb5:2 G5:8 | A5:16'),
      choir: cat(H('A3+D4+F#4'), H('B3+D4+F#4'), H('B3+D4+G4'), H('A3+C#4+E4'), H('A3+D4+F#4'), H('Bb3+D4+F4'), H('G3+C4+E4'), H('A3+D4+E4', 8) + ' ' + H('A3+C#4+E4', 8)),
      str: cat(O(SC.D), O(SC.Bm), O(SC.G), O(SC.A), O(SC.D), O(SC.Bb), O(SC.C), OH(SC.As) + ' ' + OH(SC.A)),
      bass: cat(drive('D2', 'D3'), drive('B1', 'B2'), drive('G1', 'G2'), drive('A1', 'A2'), drive('D2', 'D3'), drive('Bb1', 'Bb2'), drive('C2', 'C3'), drive('A1', 'A2')),
      drums: rep('b . h . s . h k b . h . s . h h', 7) + ' | b . s . s . s s T T T T s s s s',
    },
    // breakdown: booms, the bell walks the theme through Dm, Bb, Gm, A
    brk: {
      choir: cat(H('A3+D4+F4', 32), H('Bb3+D4+F4', 32), H('Bb3+D4+G4', 32), H('A3+C#4+E4', 32)),
      str: ghost(cat(O(SC.Dm), O(SC.Dm), O(SC.Bb), O(SC.Bb), O(SC.Gm), O(SC.Gm), O(SC.A), O(SC.A))),
      bell: M('A4:4 D5:4 F5:2 E5:2 D5:4 | r:16 | F5:4 Bb5:4 D6:2 C6:2 Bb5:4 | r:16 | D5:4 G5:4 Bb5:2 A5:2 G5:4 | r:16 | E5:4 A5:4 C#6:2 B5:2 A5:4 | r:16'),
      bass: M('D2:32 | Bb1:32 | G1:32 | A1:32', 32),
      drums: rep('b . . . . . . . b . . . . . . .', 6) + ' | b . . . b . . . b . b . b . b . | t t t t T T T T s s s s s! s! s! s!',
    },
    A2: {
      lead: seleneMel, str: seleneStrA, choir: up(seleneChoirA), bass: seleneBassA, drums: seleneDrA,
      bell: M('A5:16 | Bb5:16 | A5:16 | G5:16 | A5:16 | Bb5:16 | Bb5:16 | A5:16'),
    },
  },
  seq: ['intro', 'A', 'B', 'C', 'brk', 'A2'],
  loop: 1,
};

// =====================================================================================
// THE HOLLOW THREAD (true final form): C minor / Phrygian, 170 bpm. Relentless 3+3+2 bass,
// Bead's Theme corrupted (G C Eb Db C), then sequenced up a semitone; tritones and b9s.
// =====================================================================================
const ost2 = (a, b, c, d) => `${a} ${b} ${c} ${b} ${a} ${b} ${d} ${b} ${a} ${b} ${c} ${b} ${a} ${b} ${d} ${b}`;
const hb = (r, o) => `${r}! ${r} ${o} ${r}! ${r} ${o} ${r}! ${o} ${r}! ${r} ${o} ${r}! ${r} ${o} ${r}! ${o}`;
const hoStrA = cat(ost2('C5', 'G4', 'Eb5', 'D5'), ost2('Db5', 'Ab4', 'F5', 'Eb5'), ost2('C5', 'G4', 'Eb5', 'D5'), ost2('B4', 'G4', 'F5', 'Ab4'),
  ost2('C5', 'Ab4', 'Eb5', 'C5'), ost2('Db5', 'Ab4', 'F5', 'Eb5'), ost2('B4', 'G4', 'F5', 'Ab4'), ost2('B4', 'G4', 'D5', 'F5'));
const hoBassA = cat(hb('C2', 'C3'), hb('Db2', 'Db3'), hb('C2', 'C3'), hb('G1', 'G2'), hb('Ab1', 'Ab2'), hb('Db2', 'Db3'), hb('G1', 'G2'), hb('G1', 'G2'));
const hoMel = M('G4:3 C5:3 Eb5:2 Db5:2 C5:2 G4:4 | Ab4:3 Db5:3 F5:2 Eb5:2 Db5:2 Ab4:4 | G5:3 F#5:3 G5:2 Eb5:4 C5:4 | Ab5:4 G5:4 F5:4 D5:2 B4:2 | C5:3 Eb5:3 Ab5:2 G5:4 Eb5:4 | F5:3 Ab5:3 Db6:2 C6:4 Ab5:4 | B5:4 Ab5:4 F5:4 D5:4 | G5:2 r:2 G5:2 r:2 G4:2 r:2 B4:2 D5:2');
const hoDrA = 'k . h k s h k h k . h k s h k h';
const boss_hollow = {
  bpm: 170,
  vol: 0.8,
  inst: {
    lead: { type: 'saw', vol: 0.48, cutoff: 1900, rev: 0.3, dly: 0.08, pan: 0.1 },
    str: { type: 'strings', vol: 0.18, attack: 0.01, release: 0.06, legato: 0.6, rev: 0.3, pan: -0.2 },
    choir: { type: 'choir', vol: 0.17, attack: 0.3, release: 0.8, rev: 0.7 },
    bass: { type: 'bass', vol: 0.38, legato: 0.6, cutoff: 1200 },
    drums: { type: 'drums', vol: 0.6, rev: 0.2 },
  },
  pat: {
    intro: {
      bass: rep(hb('C2', 'C3'), 4),
      choir: H('C3+G3+Db4', 64),
      str: cat(R(), R(), ost2('C5', 'G4', 'Eb5', 'D5'), ost2('C5', 'G4', 'Eb5', 'D5')),
      drums: cat(hoDrA, hoDrA, hoDrA, 'k . k . s . k . s s k . s s s s'),
    },
    A: { lead: hoMel, str: hoStrA, bass: hoBassA, drums: hoDrA },
    A2: {
      lead: hoMel, str: hoStrA, bass: hoBassA, drums: hoDrA,
      choir: cat(H('G3+C4+Eb4'), H('Ab3+Db4+F4'), H('G3+C4+Eb4'), H('G3+B3+F4+Ab4'), H('Ab3+C4+Eb4'), H('Ab3+Db4+F4'), H('Ab3+B3+D4+F4'), H('G3+B3+D4')),
    },
    B: {
      lead: M('Eb5:8 C5:8 | D5:8 B4:8 | Eb5:4 F5:4 Ab5:8 | G5:16 | Ab5:8 F5:8 | F#5:8 Eb5:8 | D5:8 G5:8 | Ab5:8 B5:8'),
      choir: cat(H('Ab3+C4+Eb4'), H('G3+B3+D4'), H('Ab3+C4+Eb4'), H('G3+B3+D4'), H('Ab3+C4+F4'), H('F#3+A3+C4+Eb4'), H('G3+B3+D4'), H('Ab3+B3+D4+F4')),
      str: cat(ost2('C5', 'Ab4', 'Eb5', 'C5'), ost2('B4', 'G4', 'D5', 'B4'), ost2('C5', 'Ab4', 'Eb5', 'C5'), ost2('B4', 'G4', 'D5', 'B4'),
        ost2('C5', 'Ab4', 'F5', 'Eb5'), ost2('C5', 'A4', 'Eb5', 'F#5'), ost2('B4', 'G4', 'D5', 'B4'), ost2('B4', 'G4', 'F5', 'Ab4')),
      bass: cat(hb('Ab1', 'Ab2'), hb('G1', 'G2'), hb('Ab1', 'Ab2'), hb('G1', 'G2'), hb('F2', 'F3'), hb('F#2', 'F#3'), hb('G1', 'G2'), hb('G1', 'G2')),
      drums: 'k+h . h . s+h . h k k+h . h . s+h . h h',
    },
    // stabs and silence, then a chromatic climb into the dominant
    hit: {
      lead: M('C5+G5!:3 C5+G5!:3 C5+G5!:2 r:8 | Db5+Ab5!:3 Db5+Ab5!:3 Db5+Ab5!:2 r:8 | C5+F#5!:3 C5+F#5!:3 C5+F#5!:4 C5+F#5!:3 C5+F#5!:3 | B4!:4 D5!:4 F5!:4 Ab5!:4'),
      bass: M('C2!:3 C2!:3 C2!:2 r:8 | Db2!:3 Db2!:3 Db2!:2 r:2 D2:2 Eb2:2 E2:2 | F#2!:3 F#2!:3 F#2!:4 F#2!:3 F#2!:3 | G1 G1 Ab1 A1 Bb1 B1 C2 Db2 D2 Eb2 E2 F2 F#2 G2 G2! G2!'),
      choir: cat(H('C4+Db4+G4'), H('Db4+Ab4'), H('C4+F#4+B4'), H('G3+B3+F4')),
      drums: cat('k+c . . k+c . . k+c . . . . . . . . .', 'k+c . . k+c . . k+c . . . . . s s s s', 'k+c . . k+c . . k+c . . . k+c . . k+c . .', 's s s s s s s s s s s s s! s! s! s!'),
    },
  },
  seq: ['intro', 'A', 'A2', 'B', 'hit', 'A2'],
  loop: 1,
};

// =====================================================================================
// THE UNRAVELLER: B minor, 165 bpm. The A section alternates 7/8 (2+2+3) and 9/8 (2+2+2+3)
// so the downbeat keeps slipping; Bead's Theme (F# B D C# B) is thrown off-balance in it.
// B is in 4/4 with 3+3+3+3+2+2 stabs; C is a 5-note chromatic cell grinding against a 3-step
// pulse (the thread coming apart).
// =====================================================================================
const b7 = (R_, O_, F) => `${R_}! . ${O_} . ${R_}! . ${O_} . ${R_}! . ${O_} . ${F} .`;
const b9 = (R_, O_, F) => `${R_}! . ${O_} . ${R_}! . ${O_} . ${R_}! . ${O_} . ${R_}! . ${O_} . ${F} .`;
const p7 = (c) => `${c}! . . . ${c} . . . ${c}! . . ${c} . .`;
const p9 = (c) => `${c}! . . . ${c} . . . ${c} . . . ${c}! . . ${c} . .`;
const d7 = 'k . h . s . h . k . s . h s';
const d9 = 'k . h . s . h . k . h . s . h . s s';
const UC = { Bm: 'B3+D4+F#4', G: 'B3+D4+G4', A: 'C#4+E4+A4', Em: 'B3+E4+G4', F: 'A#3+C#4+F#4', F7: 'A#3+C#4+E4', Fm: 'A3+C#4+F#4' };
const unPairs = [['Bm', 'G'], ['Bm', 'A'], ['Em', 'F'], ['G', 'F7']];
const UB = { Bm: ['B1', 'B2'], G: ['G1', 'G2'], A: ['A1', 'A2'], Em: ['E2', 'E3'], F: ['F#1', 'F#2'], F7: ['F#1', 'F#2'], Fm: ['F#1', 'F#2'] };
const ubFill = { Bm: 'F#2', G: 'D2', A: 'E2', Em: 'B2', F: 'A#1', F7: 'A#1' };
const unBass = (pairs) => pairs.map(([a, b]) => b7(UB[a][0], UB[a][1], ubFill[a]) + ' ' + b9(UB[b][0], UB[b][1], ubFill[b])).join(' | ');
const unPluck = (pairs) => pairs.map(([a, b]) => p7(UC[a]) + ' ' + p9(UC[b])).join(' | ');
const unDrums = (n) => rep(`${d7} ${d9}`, n);
const unLead = [
  ['F#4:2 B4:2 D5:3 C#5:3 B4:2 F#5:2', 'G5:4 F#5:2 D5:2 B4:4 D5:6'],
  ['F#4:2 B4:2 D5:3 C#5:3 B4:2 A4:2', 'C#5:4 E5:4 A5:4 G5:2 E5:4'],
  ['B4:2 E5:2 G5:3 F#5:3 E5:2 B4:2', 'A#4:4 C#5:4 F#5:4 E5:2 C#5:4'],
  ['D5:2 G5:2 B5:3 A5:3 G5:2 D5:2', 'F#5:6 E5:4 C#5:4 A#4:4'],
].map(([a, b]) => M(a, 14) + ' ' + M(b, 18)).join(' | ');
const pb = (c) => `${c}! . . ${c} . . ${c}! . . ${c} . . ${c}! . ${c} .`;
const bB = (r, o) => `${r}! . . ${r} . . ${o}! . . ${r} . . ${r}! . ${o} .`;
const unBChords = ['G', 'A', 'Fm', 'Bm', 'G', 'A', 'Em', 'F'];
const unMelB = M('B4:6 D5:6 G5:4 | E5:6 C#5:6 A4:4 | C#5:6 F#5:6 A5:4 | B5:6 A5:6 F#5:4 | G5:6 F#5:6 D5:4 | A5:6 G5:6 E5:4 | B5:6 G5:6 E5:4 | F#5:6 E5:6 C#5:4');
const unB = {
  pluck: unBChords.map((c) => pb(UC[c])).join(' | '),
  bass: unBChords.map((c) => bB(UB[c][0], UB[c][1])).join(' | '),
  drums: 'k+h . h s+h . h k+h . h s+h . h k . s s',
};
const chaos = (fn, tail) => Array.from({ length: 60 }, (_, i) => fn(i)).join(' ') + ' ' + tail;
const boss_unraveller = {
  bpm: 165,
  vol: 0.78,
  inst: {
    pluck: { type: 'pluck', vol: 0.3, rev: 0.2, cutoff: 3000, pan: -0.25, bright: 0.8 },
    lead: { type: 'square', vol: 0.45, cutoff: 2200, rev: 0.25, dly: 0.1, pan: 0.1 },
    str: { type: 'strings', vol: 0.2, attack: 0.05, release: 0.3, rev: 0.4, pan: 0.2 },
    bass: { type: 'bass', vol: 0.38, legato: 0.6 },
    drums: { type: 'drums', vol: 0.58, rev: 0.15 },
  },
  pat: {
    intro: { bass: unBass(unPairs.slice(0, 2)), pluck: unPluck(unPairs.slice(0, 2)), drums: unDrums(2) },
    A: { lead: unLead, bass: unBass(unPairs), pluck: unPluck(unPairs), drums: unDrums(4) },
    A2: {
      lead: unLead, bass: unBass(unPairs), pluck: unPluck(unPairs), drums: unDrums(4),
      str: M('D4+F#4+B4:14 D4+G4+B4:18 | D4+F#4+B4:14 C#4+E4+A4:18 | E4+G4+B4:14 C#4+F#4+A#4:18 | D4+G4+B4:14 C#4+E4+A#4:18', 32),
    },
    B: { ...unB, str: unMelB },
    B2: { ...unB, lead: unMelB, str: up(unMelB, -1) },
    C: {
      lead: chaos((i) => ['F#5', 'F5', 'E5', 'D#5', 'D5'][i % 5] + (i % 5 === 0 ? '!' : ''), 'F#4! . F#4! .'),
      pluck: chaos((i) => (i % 3 === 0 ? 'B3+F4' + (i % 6 === 0 ? '!' : '') : '.'), 'A#3+C#4+F#4! . A#3+C#4+F#4! .'),
      bass: chaos((i) => (i % 5 === 0 ? 'F#2!' : i % 5 === 2 ? 'F#3' : '.'), 'F#2! . F#2! .'),
      str: H('F#3+C4', 64),
      drums: chaos((i) => (i % 5 === 0 ? 'k' : i % 5 === 3 ? 's' : i % 2 ? 'h' : '.'), 's s s! s!'),
    },
  },
  seq: ['intro', 'A', 'B', 'A2', 'C', 'B2'],
  loop: 1,
};

// =====================================================================================
// THE FIRST BEAD (secret final boss): D minor, 172 bpm. Weaves every leitmotif:
// A = Bead's Theme, answered a semitone higher over the Neapolitan Eb (terror);
// B = The Weaver's hook and loom over i-VI-iv-V; C = Selene's chant with the Loom's shuttle;
// D = Moon's Cradle melody in D major, at full speed.
// =====================================================================================
const FBD = {
  Dm: 'D4 A4 F4', Eb: 'Eb4 Bb4 G4', A7: 'C#4 A4 G4', Bb: 'D4 Bb4 F4', Gm: 'D4 Bb4 G4', A: 'C#4 A4 E4',
  D: 'D4 A4 F#4', AC: 'C#4 A4 E4', Bm: 'D4 B4 F#4', G: 'D4 B4 G4', Em7: 'D4 B4 G4',
};
// the Weaver's warp+weft, a step lower, merged into one 16th line
const hock = (w, f) => { const a = L(w); const b = L(f); return a.map((n, i) => `${n} ${b[i % 4]}`).join(' '); };
const hockH = (w, f) => { const a = L(w).slice(0, 4); const b = L(f); return a.map((n, i) => `${n} ${b[i % 4]}`).join(' '); };
const FH = {
  Dm: ['D3 A3 D4 A3 F4 A3 D4 A3', 'F5 E5 D5 A4'], Bb: ['Bb2 F3 Bb3 F3 D4 F3 Bb3 F3', 'F5 D5 C5 A4'],
  Gm: ['G2 D3 G3 D3 Bb3 D3 G3 D3', 'D5 Bb4 A4 G4'], A7: ['A2 E3 A3 E3 C#4 E3 G3 E3', 'E5 C#5 A4 G4'],
};
const fbMelA = M('A4:4 D5:4 F5:2 E5:2 D5:4 | Bb4:4 Eb5:4 G5:2 F5:2 Eb5:4 | A4:4 D5:4 F5:2 E5:2 D5:2 F5:2 | E5:4 C#5:4 A4:4 G5:4 | F5:3 D5:3 Bb4:2 D5:4 F5:4 | G5:3 Bb5:3 D6:2 C6:2 Bb5:2 G5:4 | Bb5:4 G5:4 Eb5:4 G5:4 | A5:8 C#5:4 E5:4');
const fbStrA = cat(O(FBD.Dm), O(FBD.Eb), O(FBD.Dm), O(FBD.A7), O(FBD.Bb), O(FBD.Gm), O(FBD.Eb), O(FBD.A));
const fbChoirA = cat(H('A3+D4+F4'), H('Bb3+Eb4+G4'), H('A3+D4+F4'), H('A3+C#4+G4'), H('Bb3+D4+F4'), H('Bb3+D4+G4'), H('Bb3+Eb4+G4'), H('A3+C#4+E4'));
const fbBassA = cat(drive('D2', 'D3'), drive('Eb2', 'Eb3'), drive('D2', 'D3'), drive('A1', 'A2'), drive('Bb1', 'Bb2'), drive('G1', 'G2'), drive('Eb2', 'Eb3'), drive('A1', 'A2'));
const fbDrA = 'b . h k s . h . k . h k s . h h';
const fsh = (s) => { const n = L(s); return M(`${n[0]}:2 ${n[1]}:2 ${n[2]}:2 ${n[3]}:2 ${n[4]}:2 ${n[3]}:2 ${n[2]}:2 ${n[1]}:2`); };
const boss_firstbead = {
  bpm: 172,
  vol: 0.8,
  inst: {
    choir: { type: 'choir', vol: 0.17, attack: 0.25, release: 1, rev: 0.75 },
    str: { type: 'strings', vol: 0.19, attack: 0.01, release: 0.07, legato: 0.7, rev: 0.3, pan: -0.15 },
    lead: { type: 'saw', vol: 0.48, cutoff: 2300, rev: 0.4, dly: 0.1, pan: 0.1 },
    cel: { type: 'celesta', vol: 0.2, rev: 0.7, dly: 0.2, pan: 0.3 },
    bass: { type: 'bass', vol: 0.36, legato: 0.75 },
    drums: { type: 'drums', vol: 0.6, rev: 0.25 },
  },
  pat: {
    intro: {
      cel: M('A4:4 D5:4 F5:2 E5:2 D5:4 | r:16 | Bb4:4 Eb5:4 G5:2 F5:2 Eb5:4 | r:8 C#5:8'),
      choir: H('A3+D4+F4', 32) + ' ' + H('Bb3+Eb4+G4') + ' ' + H('A3+C#4+E4'),
      bass: M('D2:32 | Eb2:16 | A1:16', 0),
      drums: cat('b . . . . . . . b . . . . . . .', 'b . . . . . . . b . . . . . . .', 'b . . . . . . . b . . . . . . .', 'b . b . b . b . t t T T s s s s'),
    },
    A: { lead: fbMelA, str: fbStrA, choir: fbChoirA, bass: fbBassA, drums: fbDrA },
    B: {
      lead: M('D5:3 A4:3 D5:2 F5:4 E5:2 D5:2 | F5:6 D5:2 Bb4:4 C5:2 D5:2 | G5:3 D5:3 G5:2 Bb5:4 A5:2 G5:2 | A5:6 G5:2 E5:4 C#5:4 | D5:3 A4:3 D5:2 F5:4 E5:2 D5:2 | F5:4 G5:2 A5:2 Bb5:4 A5:2 F5:2 | G5:4 Bb5:4 A5:4 C#5:4 | D5:12 r:4'),
      str: cat(hock(...FH.Dm), hock(...FH.Bb), hock(...FH.Gm), hock(...FH.A7), hock(...FH.Dm), hock(...FH.Bb),
        hockH(...FH.Gm) + ' ' + hockH(...FH.A7), hock(...FH.Dm)),
      choir: cat(H('A3+D4+F4'), H('Bb3+D4+F4'), H('Bb3+D4+G4'), H('A3+C#4+G4'), H('A3+D4+F4'), H('Bb3+D4+F4'), H('Bb3+D4+G4', 8) + ' ' + H('A3+C#4+G4', 8), H('A3+D4+F4')),
      bass: cat(drive('D2', 'D3'), drive('Bb1', 'Bb2'), drive('G1', 'G2'), drive('A1', 'A2'), drive('D2', 'D3'), drive('Bb1', 'Bb2'), driveH('G1', 'G2') + ' ' + driveH('A1', 'A2'), drive('D2', 'D3')),
      drums: 'k . h . s . h k k . h . s . h h',
    },
    C: {
      choir: M('G4:4 Bb4:4 D5:6 C5:2 | D5:4 C5:4 A4:8 | Bb4:4 D5:4 F5:8 | E5:8 C#5:8 | G5:4 F5:4 D5:6 Bb4:2 | A4:4 D5:4 F5:8 | G5:8 Eb5:8 | E5:4 C#5:4 E5:4 G5:4'),
      cel: cat(fsh('D5 G5 A5 Bb5 D6'), fsh('D5 E5 F5 A5 D6'), fsh('D5 F5 Bb5 C6 D6'), fsh('C#5 E5 A5 B5 C#6'),
        fsh('D5 G5 A5 Bb5 D6'), fsh('D5 E5 F5 A5 D6'), fsh('D5 Eb5 G5 Bb5 Eb6'), fsh('C#5 E5 G5 A5 C#6')),
      str: cat(O(FBD.Gm), O(FBD.Dm), O(FBD.Bb), O(FBD.A), O(FBD.Gm), O(FBD.Dm), O(FBD.Eb), O(FBD.A7)),
      bass: cat(drive('G1', 'G2'), drive('D2', 'D3'), drive('Bb1', 'Bb2'), drive('A1', 'A2'), drive('G1', 'G2'), drive('D2', 'D3'), drive('Eb2', 'Eb3'), drive('A1', 'A2')),
      drums: 'b . h . s . h . b . h b s . h .',
    },
    D: {
      lead: cradleMel,
      str: cat(O(FBD.D), O(FBD.AC), O(FBD.Bm), O(FBD.G), O(FBD.D), O(FBD.Gm), OH(FBD.Em7) + ' ' + OH(FBD.A7), O(FBD.D)),
      choir: cradlePad,
      bass: cat(drive('D2', 'D3'), drive('C#2', 'C#3'), drive('B1', 'B2'), drive('G1', 'G2'), drive('F#1', 'F#2'), drive('G1', 'G2'), driveH('E2', 'E3') + ' ' + driveH('A1', 'A2'), drive('D2', 'D3')),
      drums: rep('k . h k s . h k k . h k s . k h', 7) + ' | b . s . s . s s T T T T s s s s',
    },
    A2: { lead: fbMelA, str: fbStrA, choir: fbChoirA, bass: fbBassA, drums: fbDrA, cel: up(fbMelA, 1) },
  },
  seq: ['intro', 'A', 'B', 'C', 'D', 'A2'],
  loop: 1,
};

// =====================================================================================
// ENDING A, "RESTRUNG": D minor -> D major, 72 bpm, plays once (~93 s).
// The title melody, unadorned; a bridge for the strings; then the theme in D major,
// slowed to half speed, closing with a minor-plagal "amen" (Gm -> D): bittersweet.
// =====================================================================================
const ending_a = {
  bpm: 72,
  vol: 0.78,
  once: true,
  inst: {
    piano: { type: 'piano', vol: 0.42, rev: 0.6, dly: 0.2, pan: 0.1 },
    harp: { type: 'harp', vol: 0.24, rev: 0.55, dly: 0.12, pan: -0.2, humanize: true },
    pad: { type: 'strings', vol: 0.16, rev: 0.7, attack: 0.8, release: 2 },
    vln: { type: 'strings', vol: 0.24, rev: 0.6, attack: 0.3, release: 1.2, pan: 0.15 },
    bass: { type: 'subbass', vol: 0.3 },
  },
  pat: {
    intro: {
      harp: cat(arp('D3 A3 D4 F4 A4 D5'), arp('Bb2 F3 Bb3 D4 F4 Bb4')),
      pad: cat(H('D4+F4+A4'), H('D4+F4+Bb4')),
      bass: M('D2:16 | Bb1:16'),
    },
    A: { piano: title.pat.A.piano, harp: title.pat.A.harp, pad: title.pat.A.strings, bass: title.pat.A.bass },
    B: {
      vln: M('F5:8 D5:8 | C5:8 A4:4 C5:4 | Bb4:4 D5:4 F5:8 | E5:12 C#5:4 | D5:4 F5:4 A5:8 | G5:8 E5:4 C5:4 | F5:8 E5:4 D5:4 | D5:8 C#5:8'),
      harp: cat(arp('Bb2 F3 Bb3 D4 F4 Bb4'), arp('A2 F3 A3 C4 F4 A4'), arp('G2 D3 G3 Bb3 F4 G4'), arp('A2 E3 A3 C#4 E4 A4'),
        arp('Bb2 F3 Bb3 D4 F4 A4'), arp('C3 G3 C4 E4 G4 C5'), arp('D3 A3 D4 F4 A4 D5'), arpH('A2 E3 A3 D4 E4') + ' ' + arpH('A2 E3 A3 C#4 E4')),
      pad: cat(H('D4+F4+Bb4'), H('C4+F4+A4'), H('D4+F4+G4'), H('C#4+E4+A4'), H('D4+F4+A4'), H('C4+E4+G4'), H('D4+F4+A4'), H('D4+E4+A4', 8) + ' ' + H('C#4+E4+A4', 8)),
      bass: M('Bb1:16 | A1:16 | G1:16 | A1:16 | Bb1:16 | C2:16 | D2:16 | A1:16'),
    },
    C: {
      piano: M('A4:8 D5:8 | F#5:8 E5:4 D5:4 | D5:8 B4:4 G4:4 | A4:8 C#5:4 E5:4 | F#5:8 A5:4 F#5:4 | G5:8 D5:4 B4:4 | D5:8 Bb4:8 | A4:8 D5:8'),
      vln: cat(R(64), M('F#4:8 A4:4 F#4:4 | G4:8 D4:4 B3:4 | D4:8 Bb3:8 | A3:8 D4:8')),
      harp: cat(arp('D3 A3 D4 F#4 A4 D5'), arp('B2 F#3 B3 D4 F#4 B4'), arp('G2 D3 G3 B3 D4 G4'), arp('A2 E3 A3 C#4 E4 A4'),
        arp('F#2 D3 A3 D4 F#4 A4'), arp('G2 D3 G3 B3 D4 G4'), arp('G2 D3 G3 Bb3 D4 G4'), arp('D3 A3 D4 F#4 A4 D5')),
      pad: cat(H('A3+D4+F#4'), H('B3+D4+F#4'), H('B3+D4+G4'), H('A3+C#4+E4'), H('A3+D4+F#4'), H('B3+D4+G4'), H('Bb3+D4+G4'), H('A3+D4+F#4')),
      bass: M('D2:16 | B1:16 | G1:16 | A1:16 | F#1:16 | G1:16 | G1:16 | D2:16'),
    },
    end: {
      piano: H('D3+A3+D4+F#4', 32),
      harp: M('D3:2 A3:2 D4:2 F#4:2 A4:2 D5:2 F#5:2 A5:2 | r:16'),
      pad: H('A3+D4+F#4', 32),
      vln: H('D4', 32),
      bass: H('D2', 32),
    },
  },
  seq: ['intro', 'A', 'B', 'C', 'end'],
  loop: 0,
};

// =====================================================================================
// ENDING B, "UNSTRUNG": F major -> G major, 84 bpm, plays once (~86 s).
// A new, open melody that begins with Bead's Theme in major (C F A G F); the strings
// lift it; a D7 pivot lets the whole song rise a step into G, the moon rising as itself.
// =====================================================================================
const ending_b = {
  bpm: 84,
  vol: 0.78,
  once: true,
  inst: {
    harp: { type: 'harp', vol: 0.26, rev: 0.5, dly: 0.12, pan: -0.25, humanize: true },
    flute: { type: 'flute', vol: 0.36, rev: 0.5, dly: 0.15, pan: 0.15 },
    strings: { type: 'strings', vol: 0.2, rev: 0.6, attack: 0.25, release: 1.2 },
    choir: { type: 'choir', vol: 0.14, rev: 0.8, attack: 0.9, release: 2 },
    bass: { type: 'subbass', vol: 0.3 },
    drums: { type: 'drums', vol: 0.35, rev: 0.5 },
  },
  pat: {
    intro: {
      harp: cat(arp('F2 C3 F3 A3 C4 F4'), arp('D2 A2 D3 F3 A3 D4'), arp('Bb2 F3 Bb3 D4 F4 Bb4'), arp('C3 G3 C4 E4 G4 C5')),
      strings: cat(H('A3+C4+F4'), H('A3+D4+F4'), H('Bb3+D4+F4'), H('G3+C4+E4')),
      bass: M('F2:16 | D2:16 | Bb1:16 | C2:16'),
    },
    A: {
      flute: M('C5:4 F5:4 A5:2 G5:2 F5:4 | A5:6 G5:2 F5:4 D5:4 | D5:4 F5:4 Bb5:6 A5:2 | G5:8 E5:4 C5:4 | C5:4 F5:4 A5:2 G5:2 F5:2 A5:2 | C6:6 A5:2 E5:8 | D6:4 C6:4 Bb5:4 F5:4 | F5:8 E5:8'),
      harp: cat(arp('F2 C3 F3 A3 C4 F4'), arp('D2 A2 D3 F3 A3 D4'), arp('Bb2 F3 Bb3 D4 F4 Bb4'), arp('C3 G3 C4 E4 G4 C5'),
        arp('F2 C3 F3 A3 C4 F4'), arp('A2 E3 A3 C4 E4 A4'), arp('Bb2 F3 Bb3 D4 F4 Bb4'), arpH('C3 G3 C4 F4 G4') + ' ' + arpH('C3 G3 C4 E4 G4')),
      strings: cat(H('A3+C4+F4'), H('A3+D4+F4'), H('Bb3+D4+F4'), H('G3+C4+E4'), H('A3+C4+F4'), H('A3+C4+E4'), H('Bb3+D4+F4'), H('G3+C4+F4', 8) + ' ' + H('G3+C4+E4', 8)),
      bass: M('F2:16 | D2:16 | Bb1:16 | C2:16 | F2:16 | A1:16 | Bb1:16 | C2:16'),
    },
    B: {
      strings: M('D5:4 F5:4 Bb5:8 | C6:4 Bb5:4 G5:8 | A5:8 E5:8 | F5:4 E5:4 D5:8 | D5:4 F5:4 Bb5:6 C6:2 | C6:6 Bb5:2 G5:8 | Bb5:4 A5:4 G5:4 F5:4 | F#5:8 A5:4 C6:4'),
      choir: cat(H('Bb3+D4+F4'), H('C4+E4+G4'), H('C4+E4+A4'), H('D4+F4+A4'), H('Bb3+D4+F4'), H('C4+E4+G4'), H('Bb3+D4+F4'), H('A3+C4+F#4')),
      harp: cat(arp('Bb2 F3 Bb3 D4 F4 Bb4'), arp('C3 G3 C4 E4 G4 C5'), arp('A2 E3 A3 C4 E4 A4'), arp('D3 A3 D4 F4 A4 D5'),
        arp('Bb2 F3 Bb3 D4 F4 Bb4'), arp('C3 G3 C4 E4 G4 C5'), arp('G2 D3 G3 Bb3 F4 G4'), arp('D3 A3 C4 F#4 A4 D5')),
      bass: M('Bb1:16 | C2:16 | A1:16 | D2:16 | Bb1:16 | C2:16 | G1:16 | D2:16'),
      drums: cat(R(), R(), R(), R(), 'b . . . . . . . . . . . . . . .', R(), 'b . . . . . . . . . . . . . . .', 't . . . t . . . T . T . T T T T'),
    },
    C: {
      flute: M('D5:4 G5:4 B5:2 A5:2 G5:4 | B5:6 A5:2 G5:4 E5:4 | E5:4 G5:4 C6:6 B5:2 | A5:8 F#5:4 D5:4 | D5:4 G5:4 B5:2 A5:2 G5:2 B5:2 | D6:6 B5:2 F#5:8 | E6:4 D6:4 C6:4 G5:4 | G5:8 F#5:8'),
      strings: up(M('D5:4 G5:4 B5:2 A5:2 G5:4 | B5:6 A5:2 G5:4 E5:4 | E5:4 G5:4 C6:6 B5:2 | A5:8 F#5:4 D5:4 | D5:4 G5:4 B5:2 A5:2 G5:2 B5:2 | D6:6 B5:2 F#5:8 | E6:4 D6:4 C6:4 G5:4 | G5:8 F#5:8'), -1),
      choir: cat(H('B3+D4+G4'), H('B3+E4+G4'), H('C4+E4+G4'), H('A3+D4+F#4'), H('B3+D4+G4'), H('B3+D4+F#4'), H('C4+E4+G4'), H('A3+D4+G4', 8) + ' ' + H('A3+D4+F#4', 8)),
      harp: cat(arp('G2 D3 G3 B3 D4 G4'), arp('E2 B2 E3 G3 B3 E4'), arp('C3 G3 C4 E4 G4 C5'), arp('D3 A3 D4 F#4 A4 D5'),
        arp('G2 D3 G3 B3 D4 G4'), arp('B2 F#3 B3 D4 F#4 B4'), arp('C3 G3 C4 E4 G4 C5'), arpH('D3 A3 D4 G4 A4') + ' ' + arpH('D3 A3 D4 F#4 A4')),
      bass: M('G1:16 | E2:16 | C2:16 | D2:16 | G1:16 | B1:16 | C2:16 | D2:16'),
      drums: rep('b . . . . . . . t . . . . . t .', 7) + ' | b . . . t . t . T . T . T T T T',
    },
    end: {
      flute: H('G5', 32),
      strings: H('B3+D4+G4', 32),
      choir: H('B3+D4+G4', 32),
      harp: M('G2:2 D3:2 G3:2 B3:2 D4:2 G4:2 B4:2 D5:2 | G5:16'),
      bass: H('G1', 32),
      drums: 'b . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . .',
    },
  },
  seq: ['intro', 'A', 'B', 'C', 'end'],
  loop: 0,
};

// =====================================================================================
// CREDITS: Bead's Theme and variations, D minor/major, 80 bpm, loops (~162 s).
// Theme (piano) -> Waltz in D major (flute, 3/4) -> the title's B strain on strings ->
// the Cradle melody -> the Selene march -> the theme once more, piano and flute together.
// =====================================================================================
const wz = (c) => `. . . . ${c} . . . ${c} . . .`;
const credits = {
  bpm: 80,
  vol: 0.76,
  inst: {
    piano: { type: 'piano', vol: 0.4, rev: 0.5, dly: 0.15, pan: 0.1 },
    harp: { type: 'harp', vol: 0.27, rev: 0.45, dly: 0.12, pan: -0.2, humanize: true, strum: 0.02 },
    strings: { type: 'strings', vol: 0.2, rev: 0.6, attack: 0.3, release: 1.2 },
    flute: { type: 'flute', vol: 0.34, rev: 0.5, dly: 0.15, pan: 0.15 },
    bass: { type: 'subbass', vol: 0.3 },
    drums: { type: 'drums', vol: 0.33, rev: 0.35 },
  },
  pat: {
    intro: {
      harp: cat(arp('D3 A3 D4 F4 A4 D5'), arp('Bb2 F3 Bb3 D4 F4 Bb4')),
      strings: cat(H('D4+F4+A4'), H('D4+F4+Bb4')),
      bass: M('D2:16 | Bb1:16'),
    },
    A1: { piano: title.pat.A.piano, harp: title.pat.A.harp, strings: title.pat.A.strings, bass: title.pat.A.bass },
    waltz: {
      flute: M('A4:4 D5:4 F#5:2 E5:2 | D5:8 A4:4 | B4:4 D5:4 G5:2 F#5:2 | F#5:8 D5:4 | D5:4 F#5:4 B5:2 A5:2 | G5:8 E5:4 | C#5:4 E5:4 A5:2 G5:2 | E5:8 r:4 | A4:4 D5:4 F#5:2 E5:2 | D5:8 A5:4 | B5:4 A5:2 G5:2 D5:4 | Bb5:4 A5:2 G5:2 D5:4 | A5:8 F#5:4 | E5:4 G5:4 C#5:4 | D5:12 | r:12', 12),
      harp: [wz('D4+F#4+A4'), wz('D4+F#4+A4'), wz('D4+G4+B4'), wz('D4+F#4+A4'), wz('D4+F#4+B4'), wz('E4+G4+B4'), wz('C#4+E4+A4'), wz('C#4+E4+A4'),
        wz('D4+F#4+A4'), wz('D4+F#4+A4'), wz('D4+G4+B4'), wz('D4+G4+Bb4'), wz('D4+F#4+A4'), '. . . . E4+G4+B4 . . . C#4+E4+G4 . . .', wz('D4+F#4+A4'), 'D4 F#4 A4 D5 F#5 A5 D6 . . . . .'].join(' | '),
      bass: M('D2:4 r:8 | D2:4 r:8 | G1:4 r:8 | D2:4 r:8 | B1:4 r:8 | E2:4 r:8 | A1:4 r:8 | A1:4 r:8 | D2:4 r:8 | D2:4 r:8 | G1:4 r:8 | G1:4 r:8 | F#1:4 r:8 | E2:4 r:4 A1:4 | D2:4 r:8 | D2:4 r:8', 12),
    },
    B: { strings: title.pat.B.piano, piano: title.pat.B.bells, harp: title.pat.B.harp, bass: title.pat.B.bass },
    cradle: { flute: cradleMel, harp: cradleArp, strings: cradlePad, bass: cradleBass },
    march: {
      strings: seleneMel, harp: title.pat.A.harp, bass: title.pat.A.bass,
      piano: cat(H('D3+A3'), H('Bb2+F3'), H('F2+C3'), H('C3+G3'), H('D3+A3'), H('Bb2+F3'), H('G2+D3'), H('A2+E3')),
      drums: rep('k . . . s . . . k . k . s . . .', 7) + ' | k . . . s . . . k . s . s s s s',
    },
    A3: { piano: title.pat.A.piano, flute: title.pat.A.piano, harp: title.pat.A.harp, strings: title.pat.A.strings, bass: title.pat.A.bass },
  },
  seq: ['intro', 'A1', 'waltz', 'B', 'cradle', 'march', 'A3'],
  loop: 0,
};

export default {
  loom, cradle, unwoven, dunes, echoes,
  boss_weaver, boss_selene, boss_hollow, boss_unraveller, boss_firstbead,
  ending_a, ending_b, credits,
};
