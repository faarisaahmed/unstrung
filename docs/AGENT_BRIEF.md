# Brief for content agents

You are helping build **UNSTRUNG**, a hand-inked browser metroidvania in the style of Hollow Knight and Silksong,
about **Bead**: a tiny cream-colored ball with two big black eyes and a curl of red thread knotted through its bore, who rolls, jumps and
Bonks (head-butt attack). The game is plain JavaScript ES modules with no build step. The repo is
`/Users/faaris/WORKSPACE/Games/metroidvania`. A dev server is **already running** at http://localhost:8080
(don't start another).

## Read first
- `docs/DESIGN.md`: the game (abilities, numbers, areas, story)
- `docs/AUTHORING.md`: **the** reference for rooms, tiles, entities, movement metrics, enemies, and bosses
- `docs/WORLD.md`: the area plan and the **exact** connector rooms and doors between areas
- `docs/MUSIC.md`: the music format (composers)

## Ground rules
1. **Only edit the files you were assigned.** Many agents are working in parallel on other files. If you
   hit an engine bug or need an engine feature, don't fix it yourself: work around it and describe it in
   your final report.
2. Don't run `git` commands. The lead commits.
3. Keep everything original: no names, characters, text, or music copied from Hollow Knight or anything else.
   Matching the style and quality is the goal.
4. Use your scratchpad directory for screenshots and temp files.

## Tools
- **Validator** (physics-based: simulates Bead's real movement):
  `node tools/validate.js --area <area>` · `--room <id>` · `--room <id> --ab sap,dash`
- **Screenshots** (headless Chrome, 960×540):
  `URL='http://localhost:8080/?room=<roomId>&ab=<abilities|all>' node tools/shot.js <file.png> 1500`
  then look at the PNG with the Read tool. Add `--keys "ArrowRight:800,KeyZ:300"` to move (Z = jump,
  X = attack, C = dash, F = focus/spell, V = ability), or `--eval "js"` to run code in the page
  (`__app.game` is the live game). The tool prints console errors, so fix any your content causes.
  Boss arena: `URL='http://localhost:8080/?boss=<bossId>&area=<area>&ab=<abilities>'`.
- **Music checker**: `node tools/checkmusic.js [trackId...]`
- Ability ids: `sap dash shard glide magnet shell pound comet dbljump shrink hook unravel lantern howl`.

## Quality bar
This should feel like a real, polished, hand-crafted game of the quality of Hollow Knight. Every room,
enemy, boss, track, and line of text should have intent and personality. Prefer fewer, excellent things
over many sloppy ones, while still hitting the requested counts. Verify your work with the tools; don't
just assume it works.

## Final report
When finished, reply with a concise report: what you made (lists), how it meets the brief, the validator
or checker results, and any engine issues or requests.
