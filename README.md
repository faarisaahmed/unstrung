# UNSTRUNG

*When the Moon's necklace snapped, her beads fell into the dark and each became a kingdom.
One bead fell last, and smallest, and rolled.*

**UNSTRUNG** is a hand-inked metroidvania about **Bead**, a tiny cream-colored ball with big black eyes and a
curl of red thread knotted through it. Roll, hop and Bonk your way through a vast underground world: earn new powers,
open new paths, and face more than thirty bosses on the way to re-threading the Moon, or setting every bead free.

### ▶ Play in your browser: **https://faarisaahmed.github.io/unstrung/**

No install needed. It runs in any modern desktop browser, with keyboard or gamepad.

![Title](docs/screenshots/title.png)
![Spindletown](docs/screenshots/town.png)
![Gnarlknot](docs/screenshots/boss.png)

## Features
- **19 areas, 330+ hand-designed rooms.** Mossy bell caverns, a glass greenhouse, candle-wax crypts, a clockwork
  bastion, a drowned cistern, glass furnaces, crystal mirrors, bell towers above the clouds, a woven library,
  a hive, an ice shrine, the Loom where the world was woven, the Moon's Cradle, and secrets beyond.
- **13 abilities** that change how you move: wall-cling, dash, glide, magnet-rolling, ink-swimming, ground-pound,
  the Comet Roll, double jump, shrinking, grappling, and three spells.
- **33 bosses**, each with scripted multi-phase attacks, plus Echo rematches and four boss-rush Pantheons.
- **160+ enemy types**, all recorded in a hunter's journal.
- **Original survival loop**: health is Coats of lacquer, and you heal by *Buffing while you roll*. Spin is wound up by speed, not by standing still.
- **40 Knots** tied into Bead's thread, 48 lost Beadlings, Gilded Rings, Bearings, Glass Marbles, Rollmaster techniques, and a
  completion percentage that goes past 100.
- **Three endings.**
- **All original music**, synthesized live from note data, with a recurring leitmotif ("Bead's Theme").
- **Hard but fair**: tight Bonk combat with pogo bounces, a Tangle to recover after death,
  and an optional *Brittle* one-life mode.

## Controls
| | Keyboard | Gamepad |
|---|---|---|
| Roll | ← → / A D | Stick / D-pad |
| Jump (hold: higher; later: glide) | Z / Space | A |
| Bonk (↑/↓ aim, ↓ in air = pogo) | X / J | X |
| Dash (↓ + Dash = Comet Roll) | C / K / Shift | RB |
| Focus (tap: spell, hold while rolling: Buff) | F / L | Y |
| Ability (shrink / hook / ground-pound) | V / I | LB |
| Interact / rest / talk | ↑ | Up |
| Map · Inventory · Pause | Tab · E · Esc | Select · RT · Start |

## How it's made
Plain JavaScript ES modules and the HTML5 canvas, with no engine, no build step and no image or audio files:
- **Art** is drawn procedurally, then run through a WebGL hand-drawn pass: line boil, ink pooling and paper grain. Room terrain is traced from tile grids into wobbly, outlined,
  textured silhouettes, and creatures and bosses are parametric vector drawings.
- **Music and SFX** come from a Web Audio synth: Karplus-Strong harps, FM bells and pianos, string and choir
  pads, drums, and a cavern reverb, all driven by a step sequencer.
- **Levels** are ASCII grids, checked by a physics-based **validator** (`tools/validate.js`) that simulates
  Bead's real movement to prove every door, item and boss is reachable with the right abilities, and that the
  whole game can be completed.

```
npm run dev                      # local server on http://localhost:8080 (no-cache)
node tools/validate.js           # validate every room + simulate world progression
node tools/validate.js --area hollows
node tools/checkmusic.js         # lint the song data
```
Debug URLs: `?room=<roomId>&ab=all` starts in any room; `?boss=<bossId>&area=<area>` opens a boss test arena.

See [`docs/DESIGN.md`](docs/DESIGN.md), [`docs/WORLD.md`](docs/WORLD.md), [`docs/AUTHORING.md`](docs/AUTHORING.md),
[`docs/MUSIC.md`](docs/MUSIC.md) and [`docs/LORE.md`](docs/LORE.md).

## Credits
A game by **faarisaahmed**. Designed, programmed, drawn and scored with Claude.
