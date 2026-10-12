# UNSTRUNG — Music Authoring

All music is original and synthesized live by `src/audio/engine.js`; there are no samples.
Songs are plain JS objects played by the step sequencer in `src/audio/music.js`.
**Study `src/audio/tracks/title.js` first**: it is "Bead's Theme", the leitmotif of the whole game.

## Song format
```js
export default {
  bpm: 76,              // tempo; one step = a 16th note
  vol: 0.75,            // overall track volume (0.6–0.85)
  swing: 0,             // 0..0.3 delays every odd 16th (shuffle feel)
  inst: {               // named instrument channels
    harp: { type: 'harp', vol: 0.32, rev: 0.45, dly: 0.12, pan: -0.15, humanize: true },
    bass: { type: 'subbass', vol: 0.32 },
    drums: { type: 'drums', vol: 0.5 },
  },
  pat: {                // patterns: name -> { channel: 'token string' }
    A: { harp: 'D3 A3 D4 F4 ...', bass: 'D2 - - - ...', drums: 'k . h . s . h . k k h . s . h h' },
  },
  seq: ['intro', 'A', 'A', 'B'],   // pattern order
  loop: 1,              // index in seq to loop back to after the end
  once: false,          // true = play once then stop (stingers / endings)
};
```

### Tokens (space-separated, `|` bar lines are ignored)
- `C4`, `F#3`, `Bb5`: a note (octave 4 = middle C).
- `C4+E4+G4`: a chord (several notes at once).
- `-`: hold the previous note one more step.
- `.`: rest.
- Suffix `!` = accent (louder), `?` = ghost (soft): `D5!`, `A4?`.
- Drum channels (`type: 'drums'`) use: `k` kick, `s` snare, `c` clap, `h` closed hat, `o` open hat,
  `x` shaker, `t` low tom, `T` high tom, `r` rim tick, `b` deep taiko boom. Combine with `+`: `k+h`.
- A pattern's length = its longest channel. Shorter channels **repeat** to fill it, so a 16-step drum
  loop under a 128-step melody just loops.
- 16 steps = one 4/4 bar. For 3/4 or 6/8 feels, use 12-step bars.

### Instruments (`type`)
| type | character |
|---|---|
| `harp` / `pluck` / `guitar` | Karplus-Strong plucked string: arpeggios, ostinatos |
| `piano` / `epiano` | soft felt piano / electric piano: melodies |
| `bell` / `celesta` | FM bells, music-box sparkle |
| `marimba` / `kalimba` | wooden / thumb-piano plinks |
| `pad` | slow saw pad |
| `strings` | string section with vibrato |
| `choir` | "ah" choir pad (eerie, holy) |
| `organ` | sine organ |
| `bass` (triangle), `subbass` (sine) | bass |
| `lead` (triangle with vibrato), `square`, `saw` | leads |
| `flute`, `ocarina` | breathy melodic leads |
| `drums` | the drum kit above |

Channel options: `vol` (0.1–0.6), `rev` (reverb send 0–1), `dly` (echo send 0–0.5), `pan` (-1..1),
`oct` (transpose the whole channel by octaves), `cutoff` (filter Hz), `attack`/`release` (pads),
`detune` (pads), `strum` (seconds between chord notes, e.g. 0.03), `humanize: true`, `legato` (0–1, note length scale).

## Style guide
- Think **Hollow Knight / Silksong** (Christopher Larkin): melancholic, string- and piano-led, cavernous
  reverb, with memorable melodic hooks. Each area has its own key, tempo, instrument palette and **a
  hook you could hum after one listen**.
- Every area track should **quote Bead's Theme** (`A4 . D5 . F5 E5 D5`, transposed to the track's key)
  at least once, re-harmonized or re-orchestrated.
- Structure: a 2–8 bar intro, then an A section (8–16 bars) with the hook, then a contrasting B section,
  then A again (often re-orchestrated). Loop. Aim for 60–150 seconds per loop.
- Use real harmony: functional progressions, suspensions, borrowed chords, pedal tones, counter-melodies.
  Voice-lead pads smoothly.
- Exploration tracks are calmer (60–100 bpm, sparse drums or none). Boss tracks are driving
  (130–170 bpm) with drums, ostinato bass, and strings or choir. Keep them catchy, not just noise.
- Keep the mix clean: 3–6 channels, bass under 0.4 vol, leads 0.3–0.45, pads under 0.2.
- Check every token: an invalid note name is silently dropped.
