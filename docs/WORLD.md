# UNSTRUNG — World Plan

Rough geography (north is up). Spindletown sits on the surface; everything else is below or beside it.

```
                    [ Moon's Cradle ]              [ Bellfry Heights ]
                           |                               |
  [Dunes]   [ The Fray ]—[ Spindletown ]—————————————[ Hushwood ]
               |               | (well)                    |  (chasm)
  [ Glasswing Gardens ]—[ Mossbell Hollows ]——————[ Cogwork Bastion ]
          |   \                |   |    \                   |
          |  [ Tallow Catacombs ]—[ Brine Cistern ]——[ Ashen Kilns ]
          |          |                  |    \             |
  [ Frostlit Reliquary ]—[ Rotgut Warrens ]  [ Mirrored Deep ]—[ Silken Archive ]
                              \                         /
                             [ The Loom Below ]—[ The Unwoven ]
```

## Progression tiers
| tier | abilities on entry | areas |
|---|---|---|
| T0 | none | Fray, Spindletown, Mossbell Hollows (upper) → **Mother Mossbug → Sticky Sap** |
| T1 | sap | Glasswing Gardens (**Petalmaw → Dash**) and Tallow Catacombs (**Wickwidow → Shard Toss**), in either order. Deep catacombs are dark: buy the **Glowwick Lantern** in town (180 Glints). |
| T2 | sap, dash | Hushwood (**Sporecap → Dandelion glide**), upper Brine Cistern |
| T3 | + glide (+ shard, lantern) | Cogwork Bastion (**Gearwright → Lodestone**) |
| T4 | + magnet | Brine Cistern depths (**Gullet → Glass Shell**) |
| T5 | + shell | Ashen Kilns (**Vitrius → Lead Heart**, Great Bead 1) |
| T6 | + pound | Mirrored Deep (**Prism Warden → Comet Roll**, Great Bead 2) |
| T7 | + comet | Bellfry Heights (**Carillon → Bubble Hop**, GB3) and Silken Archive (**Quill → Pinhole**, GB4), in either order |
| T8 | + dbljump + shrink | Rotgut Warrens (**Gnash → Spool Line**, GB5) |
| T9 | + hook | Frostlit Reliquary (**Rimehorn → Unravel**, GB6) |
| End | all + 6 Great Beads | Loom Below (**Weaver → Moon Key**) → Moon's Cradle (**Selene**, ending) |
| Post | all | The Unwoven (Frayed Key), Dustmote Dunes (secret), Hall of Echoes (after ending) |

## Cross-area connectors (EXACT ids — both sides must exist and link to each other)
Door digit, edge, and the requirement for actually passing through.

| # | room (area) | door/edge | ↔ room (area) | door/edge | requirement / notes |
|---|---|---|---|---|---|
| 1 | `fray_exit` (fray) | 9 right | `town_gate` (town) | 9 left | none |
| 2 | `town_well` (town) | 9 bottom | `hollows_well` (hollows) | 9 top | none: Bead drops down the well. Hollows must offer a way back up (a lever-opened lift shortcut is fine). |
| 3 | `hollows_westgate` (hollows) | 9 left | `gardens_entry` (gardens) | 9 right | **sap**: hollows_westgate is reached only after a wall-climb |
| 4 | `hollows_southpit` (hollows) | 9 bottom | `catacombs_entry` (catacombs) | 9 top | **sap**: hollows_southpit needs a wall climb back up |
| 5 | `hollows_eastgate` (hollows) | 9 right | `hushwood_entry` (hushwood) | 9 left | **dash**: a wide gap in hollows_eastgate |
| 6 | `hushwood_chasm` (hushwood) | 8 bottom | `bastion_entry` (bastion) | 8 top | **glide**: the fall ends on spikes unless you glide to a side ledge in bastion_entry |
| 7 | `hollows_drain` (hollows) | 8 bottom | `cistern_entry` (cistern) | 8 top | **dash** |
| 8 | `catacombs_flooded` (catacombs) | 8 right | `cistern_westpipe` (cistern) | 8 left | sap |
| 9 | `cistern_inkgate` (cistern) | 9 right | `kilns_entry` (kilns) | 9 left | **shell**: an ink-flooded tunnel |
| 10 | `bastion_furnace` (bastion) | 9 bottom | `kilns_chimney` (kilns) | 8 top | an ink moat inside kilns_chimney blocks progress without **shell** |
| 11 | `kilns_crackfloor` (kilns) | 7 bottom | `mirror_entry` (mirror) | 9 top | **pound**: `G` cracked floor |
| 12 | `cistern_abyss` (cistern) | 7 bottom | `mirror_lake` (mirror) | 8 top | **pound** |
| 13 | `hushwood_canopy` (hushwood) | 9 top | `bellfry_base` (bellfry) | 9 bottom | **comet**: a `C` crystal seal |
| 14 | `town_spire` (town) | 8 top | `bellfry_town` (bellfry) | 8 bottom | **comet**: a `C` crystal seal in town_spire |
| 15 | `mirror_eastgate` (mirror) | 7 right | `archive_entry` (archive) | 9 left | **comet** |
| 16 | `hollows_crystal` (hollows) | 7 bottom | `archive_lift` (archive) | 8 top | **comet**: `C` blocks in hollows_crystal |
| 17 | `catacombs_crawl` (catacombs) | 7 bottom | `warrens_entry` (warrens) | 9 top | **shrink**: an `H` crawlspace in catacombs_crawl |
| 18 | `archive_undercroft` (archive) | 7 bottom | `warrens_archive` (warrens) | 8 top | **dbljump** |
| 19 | `warrens_west` (warrens) | 7 left | `frost_entry` (frost) | 9 right | **hook** |
| 20 | `gardens_deep` (gardens) | 7 bottom | `frost_gardens` (frost) | 8 top | **hook** (alternate route) |
| 21 | `hollows_heart` (hollows) | 5 bottom | `loom_entry` (loom) | 9 top | gate `{e:'gate', beads:6}` in hollows_heart above the shaft |
| 22 | `town_moongate` (town) | 7 top | `cradle_entry` (cradle) | 9 bottom | gate `{item:'moonKey'}` in town_moongate |
| 23 | `loom_void` (loom) | 7 left | `unwoven_entry` (unwoven) | 9 right | gate `{item:'frayedKey'}` in loom_void |
| 24 | `fray_secret` (fray) | 8 top | `dunes_entry` (dunes) | 9 bottom | **dbljump + shrink** (secret) |
| 25 | `town_hall` (town) | 8 right | `echoes_entry` (echoes) | 9 left | gate `{item:'echoBell'}` (given after Ending A) |
| 26 | `bastion_westlift` (bastion) | 7 left | `hollows_eastlow` (hollows) | 6 right | **glide** (return route) |
| 27 | `gardens_catapass` (gardens) | 8 bottom | `catacombs_westtop` (catacombs) | 6 top | **dash** |

Doors 5–9 are reserved for these connectors. Use 1–4 (and spare digits) for links inside an area.
Make the connector doors **3 tiles** tall or wide (wider/taller shafts are fine if both sides match).

## Area briefs
Room counts are targets (±3). `main boss room`: `<area>_boss`, optional boss room: `<area>_boss2`.

| area | rooms | enemies | spindles | beadlings | lore ids | NPC ids to place | collectibles to place |
|---|---|---|---|---|---|---|---|
| hollows | 28 | 12 | 4 | 5 | hollows_1..4 | `burl_hollows`, `bellkeeper` | shellFrag ×2, vesselFrag ×1, knot `spoolheart`, map |
| gardens | 24 | 11 | 3 | 4 | gardens_1..4 | `mothmaid` | shellFrag, knot `sharpedge`, knot `briarknot`, map |
| catacombs | 22 | 11 | 3 | 3 | catacombs_1..4 | `chandler` | shellFrag, knot `quickmend`, knot `shardsong`, map |
| hushwood | 20 | 10 | 2 | 3 | hushwood_1..4 | `hushling`, `rollmaster_rebound` | shellFrag, knot `steadyhands`, map |
| bastion | 22 | 10 | 3 | 3 | bastion_1..4 | `tinkerbot` | shellFrag, knot `dashmaster`, map |
| cistern | 22 | 11 | 3 | 3 | cistern_1..4 | `diver` | shellFrag, knot `sorrowsong`, key `cryptKey` (needs magnet), map |
| kilns | 20 | 10 | 2 | 3 | kilns_1..4 | `glassmonk`, `burl_kilns` | shellFrag, knot `leadshell`, map |
| mirror | 20 | 10 | 2 | 3 | mirror_1..4 | `twinseer` | notch, knot `cometheart`, map |
| bellfry | 22 | 10 | 3 | 3 | bellfry_1..4 | `ringer`, `rollmaster_cyclone` | shellFrag, ore, knot `bouncyknot`, map |
| archive | 20 | 10 | 2 | 3 | archive_1..4 | `librarian` | vesselFrag, knot `thriftyspool`, knot `quickcast`, map |
| warrens | 22 | 12 | 3 | 5 | warrens_1..4 | `hivedeserter` | vesselFrag, knot `vengeful`, knot `longline`, key `frayedKey` (needs unravel, hidden), map |
| frost | 18 | 10 | 2 | 3 | frost_1..4 | `frozenpilgrim` | shellFrag, knot `brittleknot`, map |
| loom | 12 | 8 | 2 | 2 | loom_1..4 | `weaverecho`, `burl_loom` | map |
| cradle | 10 | 6 | 2 | 0 | cradle_1..3 | `moonchild` | – |
| unwoven | 10 | 8 | 1 | 1 | unwoven_1..2 | – | – |
| dunes | 10 | 6 | 1 | 1 | dunes_1..2 | `lintjester` | – |
| echoes | 8 | 0 | 1 | 0 | echoes_1 | `echokeeper` | – |

Fray (tutorial, 14 rooms) and Spindletown (hub, 10 rooms) are built by the lead.
Spindletown NPCs: `bobbin` (shop), `tinsmith` (polish), `beadmother` (Beadling rewards), `gossamer` (ferry), `elder`, `rollmaster_spin`.

Every area also has: a **Moth Ferry** (`{e:'ferry', id:'<area>'}`) near a spindle, and a **map** item
(`{e:'item', item:'map', id:'<area>', name:'<Area Name>'}`) near the entrance.

Optional bosses must be gated behind later abilities (backtracking):
brassbeetle (dash), glassmoths (magnet), ossuaryknight (key cryptKey), hush (glide), choir (comet),
brinematron (shell), cindertwins (comet), reflection (dbljump), galeharrow (shrink), inkwraith (hook),
stingercourt (unravel), sentinel (unravel).
