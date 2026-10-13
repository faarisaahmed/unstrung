# UNSTRUNG — Game Design Document

> *"When the Moon's necklace snapped, her beads fell into the dark and each became a kingdom.
> One bead fell last, and smallest, and rolled."*

## 1. Pitch

UNSTRUNG is a hand-drawn, ink-and-moonlight metroidvania about **Bead**: a tiny, round,
cream-coloured creature with two big black eyes and a loose end of thread for a tail.
Bead can only roll and hop at first. Across a huge interconnected underworld, Bead gains
the powers of the scattered beads, unlocks new routes, and fights 30+ bosses on the way
to re-threading (or freeing) the Moon.

Pillars:
1. **Tight, hard, fair combat**: Hollow Knight–style melee ("Bonk"), pogo, spells, and focus-healing ("Mend").
2. **Being a ball**: a round body, momentum on slopes, squash & stretch, ram damage at speed,
   shrinking into crawlspaces, sticking to magnetic surfaces, and comet-rolling through crystal.
3. **A vast world locked by abilities**: 19 areas and ~350 rooms. Shortcuts, secrets,
   breakable walls, and optional bosses everywhere.
4. **Melancholy, catchy music**: every area has its own leitmotif. The hero's motif
   (the "Bead Theme") returns in every track.

## 2. Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | Arrows / WASD | Stick / D-pad |
| Jump (hold for height, glide when unlocked) | Z / Space | A |
| Bonk (attack; ↑/↓ for directional, ↓ in air = pogo) | X / J | X |
| Dash (hold on ground/wall to charge Comet Roll) | C / K / Shift | RB / B |
| Focus: tap = spell, hold *while rolling* = Buff (heal) | F / L | Y |
| Ability: shrink (ground), grapple (air, near hook), ground-pound (air) | V / I | LB |
| Map | Tab / M | Select |
| Inventory | E / Q | RT |
| Pause | Esc / Enter | Start |

## 3. Core numbers

- Tile = 32 px. Viewport = 960×540 px (30×16.9 tiles).
- Bead: 24×24 px hitbox (shrunk: 12×12).
- Max single jump: clears **4 tiles** up. Max gap on flat ground (no dash): **5 tiles**.
- Dash ≈ 4 tiles. Double jump adds ≈ 3.5 tiles. Wall slide and wall jump work on any wall except ice.
- Health is **Coats** of lacquer, shown as glossy beads strung on Bead's red thread. Start with 4, max 10.
  Each **Gilded Ring** (6 in the world, found whole, never in pieces) adds a Coat.
- The resource is **Spin**. Bead winds it up by **rolling fast** (and a little by Bonking). Max 100,
  +50 per **Brass Bearing** (3 in the world).
- **Buffing** (healing): hold Focus *while rolling at speed* and Bead polishes a scratched Coat back
  (40 Spin, ~0.8 s). Standing still doesn't heal: Bead heals by staying on the move.
  Tapping Focus casts a spell (33 Spin).
- **Glass Marbles** (11) are a collection. Bobbin's Marble Jar trades them for rewards, the last of which is a Ring.
- **Knots** are strung on Bead's tail and take up **string length**; Lengths of String extend the tail.
- Currency is **Glints**. On death you drop them in a **Tangle** at the death spot. Touch it to recover them.
  A new death before you recover the Tangle loses them for good.
- Bonk damage: 5 → 9 → 13 → 17 → 21 (Polish upgrades from the Tinsmith).

## 4. Abilities (in intended order)

| # | Ability | Source | Opens |
|---|---|---|---|
| 0 | Roll, Jump, Bonk, Mend | start | — |
| 1 | **Sticky Sap**: wall cling & wall jump | Mother Mossbug (Hollows) | vertical shafts everywhere |
| 2 | **Pebble Dash**: horizontal dash | Petalmaw (Gardens) | long gaps |
| 3 | **Shard Toss**: spell projectile | Wickwidow (Catacombs) | spell-switches, ranged |
| 4 | **Dandelion**: hold jump to glide; rides updrafts | Sporecap Elder (Hushwood) | updraft chimneys, huge gaps |
| 5 | **Lodestone**: cling & roll along magnetic (M) walls & ceilings | Gearwright Colossus (Bastion) | magnetic rails |
| 6 | **Glass Shell**: swim through acid / ink | Gullet (Cistern) | ink lakes |
| 7 | **Lead Heart**: ground pound; breaks cracked floors (G) | Vitrius (Kilns) | cracked floors |
| 8 | **Comet Roll**: charged super-roll; smashes crystal (C) | Prism Warden (Mirrored Deep) | crystal walls, huge horizontal gaps |
| 9 | **Bubble Hop**: double jump | Carillon (Bellfry) | high ledges |
| 10 | **Pinhole**: shrink to fit crawlspaces (H) | Archivist Quill (Archive) | crawlspaces |
| 11 | **Spool Line**: zip to hooks (O) and hang | Broodmother Gnash (Warrens) | hook chains |
| 12 | **Unravel**: radial thread burst spell | Rimehorn (Frost) | — |
| — | **Glowwick Lantern**: light in dark rooms | Spindletown shop (180 Glints) | dark areas |
| — | **Ink Howl** (up-spell), **Comet Bonk**, etc. | optional | — |

## 5. World (19 areas)

| id | Area | Theme / palette | Main boss → reward | Optional bosses |
|---|---|---|---|---|
| fray | The Fray | tutorial, frayed cloth caves, pale blue-grey | Gnarlknot → path opens | — |
| hollows | Mossbell Hollows | hub caverns, moss and old bells, teal | Mother Mossbug → Sticky Sap | Brass Beetle |
| town | Spindletown | surface town in the rain, warm lamps | — (shops, NPCs) | Rollmaster Trio (late) |
| gardens | Glasswing Gardens | overgrown glass greenhouse, green and gold | Petalmaw → Pebble Dash | Twin Glassmoths |
| catacombs | Tallow Catacombs | candle-wax crypts, amber on black | Wickwidow → Shard Toss | Ossuary Knight |
| hushwood | Hushwood | silent fungal forest, violet spores | Sporecap Elder → Dandelion | Hush |
| bastion | Cogwork Bastion | brass gears and magnets, copper | Gearwright Colossus → Lodestone | Automaton Choir |
| cistern | Brine Cistern | flooded reservoir, ink-water, deep blue | Gullet → Glass Shell | Brine Matron |
| kilns | Ashen Kilns | glass furnaces, ember red | Vitrius → Lead Heart + Great Bead | Cinder Twins |
| mirror | Mirrored Deep | crystal caverns, pink-white prisms | Prism Warden → Comet Roll + Great Bead | The Reflection |
| bellfry | Bellfry Heights | windy bell towers above the clouds | Carillon → Bubble Hop + Great Bead | Galeharrow |
| archive | Silken Archive | library of woven records, indigo and gold | Archivist Quill → Pinhole + Great Bead | Inkwraith |
| warrens | Rotgut Warrens | hive/burrows, dark, sickly green | Broodmother Gnash → Spool Line + Great Bead | Stinger Court |
| frost | Frostlit Reliquary | ice shrine, slippery, icy cyan | Rimehorn → Unravel + Great Bead | Frostbound Sentinel |
| loom | The Loom Below | abyss of ancient looms, black and white | The Weaver → Moon Key | — |
| cradle | Moon's Cradle | ascent to the moon, silver | Selene, the Unstrung Moon → **Ending A** | — |
| unwoven | The Unwoven | void realm (post-key) | The Unraveller → Void Thread | — |
| dunes | Dustmote Dunes | secret lint desert | Lint King | Glint Hoarder |
| echoes | Hall of Echoes | endgame boss-rush sanctum | The First Bead (final secret) | all bosses (Echo) |

## 6. Story & endings

- **Ending A, "Restrung"**: defeat Selene with all 6 Great Beads. Bead becomes the clasp of the
  necklace and the moon is whole again, but Bead is gone. (main ending, ~10 h)
- **Ending B, "Unstrung"**: hold the Void Thread from the Unwoven during the Selene fight.
  This triggers phase 3, *The Hollow Thread*. Bead cuts the strand and every bead is free.
  The moon rises over the kingdoms as itself. (true ending)
- **Ending C, "First Light"**: clear all four Echo Pantheons, then beat The First Bead.

Full lore: [LORE.md](LORE.md).

## 7. Completion (100%+, ~60 h)

- 12 abilities + 3 spells (+ spell upgrades)
- 6 Gilded Rings, 3 Brass Bearings, 11 Glass Marbles
- 40 Knots and 8 Lengths of String
- 4 Polish upgrades
- 3 Rollmaster techniques
- 48 lost **Beadlings** to rescue (Beadmother rewards)
- 160 bestiary entries (each enemy needs a kill count)
- 33 bosses, with an Echo (harder) rematch for each
- 4 Pantheons + Brittle Mode (one life)
- 60 lore tablets ("Threadscripts")

## 8. Death, rest, travel

- **Spindles** are benches. Rest to heal, save, and swap Knots.
- **Moth Ferries** are fast-travel stations. Unlock each one by finding it, plus the ferry pass in Spindletown.
- Hazards (spikes, acid) cost 1 Shell and return Bead to the last safe ground.
