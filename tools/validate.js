// UNSTRUNG level validator.
//
//   node tools/validate.js                    static checks + reachability for every room + world progression
//   node tools/validate.js --area gardens     only rooms of one area (static + reachability)
//   node tools/validate.js --room gardens_03  one room, verbose
//   node tools/validate.js --world            world progression simulation only
//   flags: --ab sap,dash,...  override ability set for room checks (default: room.req / area default)
//          --quiet  only print problems
//
// Reachability uses the REAL movement code (src/world/movement.js): it simulates Bead with many
// input scripts (walks, jumps of different heights, wall jumps, dashes, double jumps, glides, hooks,
// comet rolls, swims) and records which doors / tiles can be reached from each entry door.
import { ROOMS, START_ROOM, AREAS, LOAD_ERRORS } from '../src/data/world.js';
import { Room } from '../src/world/room.js';
import { makeBead, stepBead } from '../src/world/movement.js';
import { TILE, PHYS, DT } from '../src/core/constants.js';
import { TILE_CHARS, isDoorChar } from '../src/world/tiles.js';
import { ENEMIES } from '../src/data/enemies/index.js';
import { BOSS_INFO } from '../src/data/bossinfo.js';
import { computeLayout, findOverlaps, parseLink } from '../src/world/layout.js';
import { AREA_REQ } from '../src/data/areareq.js';

if (process.env.VALIDATE_EXTRA) await import(process.env.VALIDATE_EXTRA);
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? (args[i + 1] || true) : null; };
const quiet = args.includes('--quiet');
const onlyArea = opt('--area');
const onlyRoom = opt('--room');
const worldOnly = args.includes('--world');
const abOverride = opt('--ab');

const ENTITY_TYPES = new Set(['enemy', 'boss', 'spindle', 'lever', 'gate', 'lore', 'npc', 'item', 'beadling', 'tangle', 'pot', 'ferry', 'deco', 'trigger', 'statue', 'pantheon']);

let errors = 0, warnings = 0;
const err = (m) => { errors++; console.log('  \x1b[31mERROR\x1b[0m ' + m); };
const warn = (m) => { warnings++; if (!quiet) console.log('  \x1b[33mwarn\x1b[0m  ' + m); };
const info = (m) => { if (!quiet) console.log('  ' + m); };

// ------------------------------------------------------------------ static checks
function staticCheck(def) {
  const id = def.id;
  if (!def.area) err(`${id}: missing area`);
  if (!def.tiles || !def.tiles.length) { err(`${id}: no tiles`); return; }
  const w0 = def.tiles[0].length;
  def.tiles.forEach((r, i) => { if (r.length !== w0) warn(`${id}: row ${i} has length ${r.length} (expected ${w0})`); });
  const room = new Room(def);
  if (room.w < 30) err(`${id}: width ${room.w} < 30 (min one screen)`);
  if (room.h < 17) err(`${id}: height ${room.h} < 17 (min one screen)`);
  if (room.w > 160 || room.h > 100) warn(`${id}: very large room ${room.w}x${room.h}`);
  // legend
  for (const m of room.markers) {
    if (!m.spec) { err(`${id}: char '${m.ch}' at ${m.tx},${m.ty} has no legend entry`); continue; }
    const s = m.spec;
    if (!ENTITY_TYPES.has(s.e)) err(`${id}: legend '${m.ch}' unknown entity type '${s.e}'`);
    if (s.e === 'enemy' && !ENEMIES[s.id]) err(`${id}: legend '${m.ch}' unknown enemy id '${s.id}'`);
    if (s.e === 'boss' && !BOSS_INFO[s.id]) err(`${id}: legend '${m.ch}' unknown boss id '${s.id}'`);
  }
  // doors
  const doors = room.doors;
  for (const d of Object.values(doors)) {
    if (d.edge === 'inner') { err(`${id}: door '${d.id}' is not on the room border`); continue; }
    if (!d.link) { err(`${id}: door '${d.id}' (${d.edge}) has no link in doors{}`); continue; }
    const L = parseLink(d.link);
    const target = ROOMS[L.room];
    if (!target) { err(`${id}: door '${d.id}' links to unknown room '${L.room}'`); continue; }
    const tr = new Room(target);
    const td = tr.doors[L.door];
    if (!td) { err(`${id}: door '${d.id}' links to ${L.room}:${L.door} which does not exist`); continue; }
    const opp = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
    if (td.edge !== opp[d.edge]) err(`${id}: door '${d.id}' (${d.edge}) links to ${L.room}:${L.door} on edge '${td.edge}' (needs '${opp[d.edge]}')`);
    const back = td.link && parseLink(td.link);
    if (!back || back.room !== id || back.door !== d.id) err(`${id}: door '${d.id}' -> ${d.link}, but that door links back to '${td.link}'`);
    const sa = d.edge === 'left' || d.edge === 'right' ? d.y1 - d.y0 : d.x1 - d.x0;
    const sb = td.edge === 'left' || td.edge === 'right' ? td.y1 - td.y0 : td.x1 - td.x0;
    if (sa !== sb) warn(`${id}: door '${d.id}' is ${sa + 1} tiles wide but ${d.link} is ${sb + 1}`);
    if ((d.edge === 'left' || d.edge === 'right') && d.y1 - d.y0 < 1) err(`${id}: side door '${d.id}' must be at least 2 tiles tall`);
    if ((d.edge === 'top' || d.edge === 'bottom') && d.x1 - d.x0 < 1) err(`${id}: vertical door '${d.id}' must be at least 2 tiles wide`);
  }
  for (const k of Object.keys(def.doors || {})) if (!doors[k]) err(`${id}: doors{} has '${k}' but no '${k}' cells in tiles`);
}

// ------------------------------------------------------------------ reachability
const NOIN = { x: 0, y: 0, jump: false, jumpP: false, dash: false, dashP: false, dashR: false, abilityP: false };
const clone = (b) => Object.assign({}, b, { hook: b.hook ? Object.assign({}, b.hook) : null });

function buildRoom(def, ab, openFlags, items) {
  const room = new Room(def);
  room.passChars = new Set(['B']);
  if (ab.comet) room.passChars.add('C');
  if (ab.pound) room.passChars.add('G');
  for (const m of room.markers) {
    const s = m.spec;
    if (!s || s.e !== 'gate') continue;
    let open = false;
    if (s.arena) open = true;
    else if (s.flag && openFlags.has(s.flag)) open = true;
    else if (s.item && items.has(s.item)) open = true;
    else if (s.beads && [...items].filter((i) => i.startsWith('greatBead_')).length >= s.beads) open = true;
    if (!open) room.dynamicSolids.push({ x: m.tx * TILE, y: m.ty * TILE, w: (s.w || 1) * TILE, h: (s.h || 3) * TILE, active: true, gate: s });
  }
  return room;
}

function hazardAt(room, b, ab) {
  const hb = { x: b.x + 4, y: b.y + 4, w: b.w - 8, h: b.h - 8 };
  const sp = room.rectHasChar(hb.x, hb.y, hb.w, hb.h, (ch, tx, ty) => {
    if (ch !== '^') return false;
    const rx = tx * TILE + 5, ry = ty * TILE + 5, rw = TILE - 10;
    return hb.x < rx + rw && hb.x + hb.w > rx && hb.y < ry + rw && hb.y + hb.h > ry;
  });
  if (sp) return true;
  if (!ab.shell && room.rectHasChar(hb.x + 2, hb.y + 6, hb.w - 4, hb.h - 6, (ch) => ch === '!')) return true;
  return false;
}

function exitDoor(room, b) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  let edge = null;
  if (cx < 0) edge = 'left'; else if (cx > room.pxW) edge = 'right';
  else if (cy < 0) edge = 'top'; else if (cy > room.pxH) edge = 'bottom';
  if (!edge) return null;
  let best = null, bd = Infinity;
  for (const d of Object.values(room.doors)) {
    if (d.edge !== edge) continue;
    const dist = edge === 'left' || edge === 'right' ? Math.abs(cy - ((d.y0 + d.y1 + 1) / 2) * TILE) : Math.abs(cx - ((d.x0 + d.x1 + 1) / 2) * TILE);
    if (dist < bd) { bd = dist; best = d; }
  }
  return best ? best.id : 'void';
}

function nodeKind(b, ab) {
  if (b.mode === 'hang') return 'hang';
  if (b.mode === 'magnet') return 'mag';
  if (b.mode !== 'normal') return null;
  if (b.inWater) return 'water';
  if (b.grounded) return 'ground';
  if (b.clinging) return 'cling';
  return null;
}

// Input script builders --------------------------------------------------
function jumpScript(d0, run, hold, d1, extra, ab) {
  return (f, b) => {
    const i = Object.assign({}, NOIN);
    if (f < run) { i.x = d0; return i; }
    const t = f - run;
    i.x = d1;
    if (t === 0) { i.jumpP = true; i.jump = true; }
    else i.jump = t < hold;
    if (extra) {
      if (extra.dash !== undefined && t === extra.dash) { i.dashP = true; i.dash = true; i.x = extra.dashDir ?? d1; }
      if (extra.dbl !== undefined && t === extra.dbl) { i.jumpP = true; i.jump = true; }
      if (extra.dbl !== undefined && t > extra.dbl) i.jump = t < extra.dbl + 40;
      if (extra.dash2 !== undefined && t === extra.dash2) { i.dashP = true; i.dash = true; }
      if (extra.hook !== undefined && t === extra.hook) i.abilityP = true;
      if (extra.glide) i.jump = true;
    }
    return i;
  };
}

function extrasFor(ab, small) {
  const ex = [null];
  if (small) return ex;
  if (ab.dash) for (const t of [4, 16]) for (const dd of [-1, 1]) ex.push({ dash: t, dashDir: dd });
  if (ab.dbljump) for (const t of [12, 24]) ex.push({ dbl: t });
  if (ab.dash && ab.dbljump) { ex.push({ dbl: 14, dash2: 26 }); ex.push({ dash: 8, dbl: 20 }); }
  if (ab.glide) { ex.push({ glide: true }); if (ab.dash) ex.push({ glide: true, dash: 14 }); }
  if (ab.hook) for (const t of [4, 16]) ex.push({ hook: t });
  return ex;
}

function analyzeRoom(def, ab, entries, openFlags = new Set(), items = new Set()) {
  const room = buildRoom(def, ab, openFlags, items);
  const W = room.w;
  const result = {};
  for (const entry of entries) {
    const visitedNodes = new Set();
    const tiles = new Set();
    const doors = new Set();
    const queue = [];
    let deaths = 0;
    const markTile = (b) => {
      const tx = Math.floor((b.x + b.w / 2) / TILE), ty = Math.floor((b.y + b.h / 2) / TILE);
      tiles.add(tx + ty * W);
      // also mark tiles the body overlaps (items are touched by overlap)
      tiles.add(Math.floor(b.x / TILE) + Math.floor(b.y / TILE) * W);
      tiles.add(Math.floor((b.x + b.w - 1) / TILE) + Math.floor((b.y + b.h - 1) / TILE) * W);
    };
    const pushNode = (b) => {
      const k = nodeKind(b, ab);
      if (!k) return;
      const tx = Math.floor((b.x + b.w / 2) / TILE), ty = Math.floor((b.y + b.h / 2) / TILE);
      const key = k + (b.small ? 's' : '') + (k === 'cling' ? b.wall : '') + ':' + tx + ',' + ty;
      if (visitedNodes.has(key)) return;
      visitedNodes.add(key);
      queue.push({ kind: k, b: clone(b) });
    };
    // run one script; returns end state
    const run = (b0, script, maxF = 200, opts = {}) => {
      const b = clone(b0);
      const ev = [];
      let lastTile = -1, stuck = 0, lastGround = null;
      for (let f = 0; f < maxF; f++) {
        const i = script(f, b);
        ev.length = 0;
        const ox = b.x, oy = b.y;
        stepBead(b, i, room, ab, DT, ev);
        markTile(b);
        if (hazardAt(room, b, ab)) { deaths++; return null; }
        const ex = exitDoor(room, b);
        if (ex) { if (ex !== 'void') doors.add(ex); return null; }
        if (opts.walk) {
          if (b.grounded) {
            const ctx = Math.floor((b.x + b.w / 2) / TILE);
            const tk = ctx + ',' + Math.floor((b.y + b.h / 2) / TILE);
            if (tk !== lastTile) { lastTile = tk; if (ctx % 2 === 0) pushNode(b); }
            lastGround = clone(b);
          } else if (lastGround) { pushNode(lastGround); lastGround = null; }
          if (b.clinging) pushNode(b);
          if (b.inWater) pushNode(b);
        } else if (f >= 3) {
          const k = nodeKind(b, ab);
          if (k && !(k === 'water' && f < 20)) { pushNode(b); return b; }
        }
        if (Math.abs(b.x - ox) < 0.01 && Math.abs(b.y - oy) < 0.01) { if (++stuck > 15) { pushNode(b); return b; } } else stuck = 0;
      }
      pushNode(b);
      return b;
    };

    // ---- entry state ----
    const b = makeBead(0, 0);
    if (entry === 'spawn') {
      const s = room.spawn || { tx: 2, ty: room.h - 3 };
      b.x = s.tx * TILE + 4; b.y = s.ty * TILE + TILE - PHYS.h; b.grounded = true;
      for (let k = 0; k < 4; k++) stepBead(b, NOIN, room, ab, DT, []);
      pushNode(b);
    } else {
      const d = room.doors[entry];
      if (!d) continue;
      const inward = { left: 1, right: -1, top: 0, bottom: 0 }[d.edge];
      if (d.edge === 'left' || d.edge === 'right') {
        b.x = d.edge === 'left' ? 2 : room.pxW - PHYS.w - 2;
        b.y = (d.y1 + 1) * TILE - PHYS.h - 1;
        b.vx = inward * PHYS.runSpeed;
      } else if (d.edge === 'top') {
        b.x = ((d.x0 + d.x1 + 1) / 2) * TILE - PHYS.w / 2; b.y = 2; b.vy = 100;
      } else {
        b.x = ((d.x0 + d.x1 + 1) / 2) * TILE - PHYS.w / 2; b.y = room.pxH - PHYS.h - 4; b.vy = -900;
      }
      // entry branches: steer in the air / walk in
      const dirs = inward ? [inward, 0] : [-1, 0, 1];
      for (const d1 of dirs) {
        for (const ex of extrasFor(ab, false)) {
          run(b, (f, bb) => {
            const i = Object.assign({}, NOIN, { x: d1, jump: !!(ex && ex.glide) });
            if (ex) {
              if (ex.dash !== undefined && f === ex.dash) { i.dashP = true; i.x = ex.dashDir ?? d1; }
              if (ex.dbl !== undefined && f === ex.dbl) { i.jumpP = true; i.jump = true; }
              if (ex.dbl !== undefined && f > ex.dbl && f < ex.dbl + 40) i.jump = true;
              if (ex.hook !== undefined && f === ex.hook) i.abilityP = true;
            }
            return i;
          }, 160);
          if (d.edge === 'left' || d.edge === 'right') break; // grounded entries: walking in is enough
        }
      }
    }

    // ---- BFS ----
    let iter = 0;
    while (queue.length && iter++ < 4000) {
      const { kind, b: nb } = queue.shift();
      const small = nb.small;
      if (kind === 'ground' || kind === 'water') {
        for (const d of [-1, 1]) run(nb, () => Object.assign({}, NOIN, { x: d }), 260, { walk: true });
        const runs = [[0, 0], [-1, 10], [1, 10]];
        const exs = extrasFor(ab, small);
        for (const [d0, rr] of runs) for (const d1 of [-1, 0, 1]) {
          if (d0 && d1 === -d0) { run(nb, jumpScript(d0, rr, 60, d1, null, ab), 200); continue; }
          for (const h of [6, 14]) run(nb, jumpScript(d0, rr, h, d1, null, ab), 200);
          for (const ex of exs) run(nb, jumpScript(d0, rr, 60, d1, ex, ab), 220);
        }
        // drop through one-way
        run(nb, (f) => Object.assign({}, NOIN, { y: 1, jumpP: f === 0, jump: f < 3 }), 120);
        if (kind === 'water') {
          for (const d of [-1, 0, 1]) run(nb, (f) => Object.assign({}, NOIN, { x: d, jumpP: f % 12 === 0, jump: f % 12 < 6 }), 200, { walk: true });
        }
        if (ab.shrink) {
          const s2 = clone(nb);
          const ev = [];
          stepBead(s2, Object.assign({}, NOIN, { abilityP: true }), room, ab, DT, ev);
          if (s2.small !== nb.small) pushNode(s2);
        }
        if (ab.comet && !small) {
          for (const d of [-1, 1]) for (const jt of [-1, 6, 20, 45]) {
            run(nb, (f) => {
              const i = Object.assign({}, NOIN);
              if (f < 40) { i.y = 1; i.dash = true; i.dashP = f === 0; i.x = f === 0 ? 0 : d; return i; }
              if (f === 40) { i.x = d; return i; }
              if (jt >= 0 && f === 40 + jt) { i.jumpP = true; i.jump = true; }
              if (jt >= 0 && f > 40 + jt) i.jump = true;
              i.x = d;
              return i;
            }, 260);
          }
        }
      } else if (kind === 'cling') {
        const s = nb.wall || 1;
        for (const h of [6, 14, 60]) for (const d1 of [-s, 0, s]) for (const ex of (h === 60 ? extrasFor(ab, small) : [null])) {
          run(nb, (f, bb) => {
            const i = Object.assign({}, NOIN, { x: d1 });
            if (f === 0) { i.jumpP = true; i.jump = true; i.x = s; }
            else i.jump = f < h;
            if (ex) {
              if (ex.dash !== undefined && f === ex.dash) { i.dashP = true; i.x = ex.dashDir ?? d1; }
              if (ex.dbl !== undefined && f === ex.dbl) { i.jumpP = true; i.jump = true; }
              if (ex.dbl !== undefined && f > ex.dbl && f < ex.dbl + 40) i.jump = true;
              if (ex.hook !== undefined && f === ex.hook) i.abilityP = true;
              if (ex.glide) i.jump = true;
            }
            return i;
          }, 200);
        }
        run(nb, () => Object.assign({}, NOIN, { x: s }), 200, { walk: true }); // slide down
        run(nb, () => Object.assign({}, NOIN, { x: -s }), 200);             // let go
        if (ab.comet) for (const jt of [-1, 10, 30]) run(nb, (f) => {
          const i = Object.assign({}, NOIN, { x: s });
          if (f < 40) { i.y = 1; i.dash = true; i.dashP = f === 0; return i; }
          i.x = -s;
          if (jt >= 0 && f >= 40 + jt) { i.jump = true; i.jumpP = f === 40 + jt; }
          return i;
        }, 240);
      } else if (kind === 'hang') {
        for (const h of [6, 14, 60]) for (const d1 of [-1, 0, 1]) for (const ex of (h === 60 ? extrasFor(ab, false) : [null])) run(nb, jumpScript(0, 0, h, d1, ex, ab), 200);
        run(nb, (f) => Object.assign({}, NOIN, { y: 1, jumpP: f === 0, jump: f === 0 }), 150);
      } else if (kind === 'mag') {
        const dirsMove = nb.magnet === 'ceil' ? [{ x: -1 }, { x: 1 }] : [{ y: -1 }, { y: 1 }];
        for (const mv of dirsMove) {
          // travel along the surface and branch jumps every ~0.25s
          const b2 = clone(nb);
          const ev = [];
          for (let f = 0; f < 300; f++) {
            stepBead(b2, Object.assign({}, NOIN, mv), room, ab, DT, ev);
            markTile(b2);
            if (b2.mode !== 'magnet') { pushNode(b2); break; }
            if (f % 12 === 0) pushNode(b2);
          }
        }
        for (const h of [6, 60]) for (const d1 of [-1, 0, 1]) for (const ex of (h === 60 ? extrasFor(ab, false) : [null])) run(nb, jumpScript(0, 0, h, d1, ex, ab), 200);
      }
    }
    result[entry] = { doors, tiles, deaths, nodes: visitedNodes.size };
  }
  return { room, result };
}

function abilitiesFor(def) {
  if (abOverride) return Object.fromEntries(abOverride.split(',').filter(Boolean).map((a) => [a, true]));
  const req = def.req || (AREA_REQ[def.area] || []);
  return Object.fromEntries(req.map((a) => [a, true]));
}

function roomReport(def) {
  const ab = abilitiesFor(def);
  const room0 = new Room(def);
  const entries = Object.keys(room0.doors);
  if (room0.spawn) entries.push('spawn');
  if (!entries.length) return;
  const { room, result } = analyzeRoom(def, ab, entries);
  const allDoors = Object.keys(room0.doors);
  const abStr = Object.keys(ab).join(',') || 'none';
  let problems = 0;
  // each door should be able to reach at least one OTHER door (no dead ends unless declared)
  const deadEnds = new Set(def.deadEnd ? (Array.isArray(def.deadEnd) ? def.deadEnd : [def.deadEnd]) : []);
  const oneWay = def.oneWay || {}; // {fromDoor: true} entries allowed to be unable to exit
  for (const e of entries) {
    const r = result[e];
    if (!r) continue;
    const others = [...r.doors].filter((d) => d !== e);
    if (allDoors.length > 1 && others.length === 0 && !deadEnds.has(e) && !oneWay[e]) {
      err(`${def.id}: from ${e === 'spawn' ? 'spawn' : 'door ' + e} no other door is reachable [ab: ${abStr}]`); problems++;
    }
  }
  // doors that can never be reached from any entry
  for (const d of allDoors) {
    const reached = entries.some((e) => e !== d && result[e] && result[e].doors.has(d));
    if (!reached && allDoors.length > 1 && !(def.lockedDoors || []).includes(d)) {
      warn(`${def.id}: door ${d} can't be reached from any other entry [ab: ${abStr}] (fine if it is a one-way drop or needs a later ability; list it in lockedDoors to silence)`);
    }
  }
  // markers (items, beadlings, levers, spindles, npcs, lore, bosses) reachable?
  const union = new Set();
  for (const e of entries) if (result[e]) for (const t of result[e].tiles) union.add(t);
  for (const m of room0.markers) {
    if (!m.spec) continue;
    const t = m.spec.e;
    if (!['item', 'beadling', 'lever', 'spindle', 'npc', 'lore', 'boss', 'ferry'].includes(t)) continue;
    const near = [[0, 0], [0, -1], [1, 0], [-1, 0], [0, 1], [1, -1], [-1, -1]].some(([dx, dy]) => union.has(m.tx + dx + (m.ty + dy) * room.w));
    if (!near && !(m.spec.needs)) warn(`${def.id}: ${t}${m.spec.id ? ' ' + m.spec.id : ''}${m.spec.item ? ' (' + m.spec.item + ')' : ''} at ${m.tx},${m.ty} not reachable [ab: ${abStr}]${m.spec.needs ? '' : ' (add needs:[...] to the legend if it needs a later ability)'}`);
  }
  if (!quiet || problems) {
    const summary = entries.map((e) => `${e}->{${[...(result[e]?.doors || [])].join(',')}}`).join(' ');
    info(`${def.id} [${abStr}] ${room0.w}x${room0.h}: ${summary}`);
  }
}

// ------------------------------------------------------------------ world progression
function worldSim() {
  console.log('\n== World progression simulation ==');
  const ab = {};
  const items = new Set();
  const flags = new Set();
  let beads = 0;
  const log = [];
  const cache = new Map();
  const analysis = (def, entry) => {
    const key = def.id + '|' + entry + '|' + Object.keys(ab).sort().join(',') + '|' + [...flags].sort().join(',') + '|' + [...items].sort().join(',');
    if (cache.has(key)) return cache.get(key);
    let res = analyzeRoom(def, ab, [entry], flags, items);
    // levers inside the room open gates in the same pass
    const r0 = res.result[entry];
    if (r0) {
      let opened = false;
      for (const m of res.room.markers) {
        if (m.spec && m.spec.e === 'lever' && r0.tiles.has(m.tx + m.ty * res.room.w) && !flags.has(m.spec.flag)) { flags.add(m.spec.flag); opened = true; }
      }
      if (opened) res = analyzeRoom(def, ab, [entry], flags, items);
    }
    cache.set(key, res);
    return res;
  };
  let changed = true, round = 0;
  let visitedRooms = new Set();
  while (changed && round++ < 40) {
    changed = false;
    const seen = new Set();
    const queue = [[START_ROOM, ROOMS[START_ROOM] && new Room(ROOMS[START_ROOM]).spawn ? 'spawn' : Object.keys(new Room(ROOMS[START_ROOM]).doors)[0]]];
    visitedRooms = new Set();
    while (queue.length) {
      const [rid, entry] = queue.shift();
      const k = rid + ':' + entry;
      if (seen.has(k)) continue;
      seen.add(k);
      const def = ROOMS[rid];
      if (!def) continue;
      if (def.dark && !ab.lantern && def.darkLocked !== false) continue;
      visitedRooms.add(rid);
      const { room, result } = analysis(def, entry);
      const r = result[entry];
      if (!r) continue;
      for (const did of r.doors) {
        const d = room.doors[did];
        const L = d && parseLink(d.link);
        if (L && ROOMS[L.room]) queue.push([L.room, L.door]);
      }
      // collect
      for (const m of room.markers) {
        const s = m.spec;
        if (!s) continue;
        const reached = [[0, 0], [0, -1], [1, 0], [-1, 0], [0, 1]].some(([dx, dy]) => r.tiles.has(m.tx + dx + (m.ty + dy) * room.w));
        if (!reached) continue;
        const grants = [];
        if (s.e === 'item') grants.push(s);
        if (s.e === 'boss' && BOSS_INFO[s.id]) { grants.push(...BOSS_INFO[s.id].reward); if (!flags.has('boss_' + s.id)) { flags.add('boss_' + s.id); changed = true; log.push(`  defeat ${s.id} in ${rid}`); } }
        if (s.grants) grants.push(...s.grants);
        if (s.e === 'lever' && !flags.has(s.flag)) { flags.add(s.flag); changed = true; }
        if (s.e === 'trigger' && s.flag && !flags.has(s.flag)) { flags.add(s.flag); changed = true; }
        for (const gr of grants) {
          if (gr.item === 'ability' && !ab[gr.id]) { ab[gr.id] = true; changed = true; log.push(`+ ability ${gr.id.padEnd(8)} (${rid})`); }
          if ((gr.item === 'key' || gr.item === 'relic') && !items.has(gr.id)) { items.add(gr.id); changed = true; log.push(`+ item ${gr.id} (${rid})`); }
          if (gr.item === 'greatBead' && !items.has('greatBead_' + gr.id)) { items.add('greatBead_' + gr.id); beads++; changed = true; log.push(`+ GREAT BEAD ${gr.id} (${beads}/6) (${rid})`); if (beads >= 6) flags.add('strand_complete'); }
        }
      }
    }
  }
  console.log(log.join('\n'));
  const all = Object.keys(ROOMS).filter((id) => !id.startsWith('test_'));
  const unreached = all.filter((id) => !visitedRooms.has(id));
  console.log(`\nRooms reached: ${visitedRooms.size}/${all.length}`);
  if (unreached.length) {
    const byArea = {};
    for (const id of unreached) (byArea[ROOMS[id].area] = byArea[ROOMS[id].area] || []).push(id);
    for (const [a, ids] of Object.entries(byArea)) console.log(`  unreached in ${a}: ${ids.join(', ')}`);
  }
  const required = ['sap', 'dash', 'shard', 'glide', 'magnet', 'shell', 'pound', 'comet', 'dbljump', 'shrink', 'hook', 'unravel'];
  const missing = required.filter((a) => !ab[a]);
  if (missing.length) err(`world: abilities never obtainable: ${missing.join(', ')}`);
  if (!flags.has('boss_selene')) warn('world: Selene (final boss) not reachable');
  return { ab, flags, items };
}

// ------------------------------------------------------------------ main
let defs = Object.values(ROOMS);
if (onlyArea) defs = defs.filter((d) => d.area === onlyArea);
if (onlyRoom) defs = defs.filter((d) => d.id === onlyRoom);
const t0 = Date.now();
for (const e of LOAD_ERRORS) err('FILE FAILED TO LOAD: ' + e);
if (!worldOnly) {
  console.log(`== Static checks (${defs.length} rooms) ==`);
  for (const d of defs) staticCheck(d);
  console.log('\n== Reachability ==');
  for (const d of defs) roomReport(d);
}
if (!onlyArea && !onlyRoom) {
  worldSim();
  const { pos, issues } = computeLayout(ROOMS, START_ROOM);
  const mism = issues.filter((i) => i.type === 'mismatch');
  const disc = issues.filter((i) => i.type === 'disconnected' && !i.a.startsWith('test_'));
  if (mism.length) { console.log(`\nMap layout: ${mism.length} loop mismatches (rooms whose door geometry disagrees)`); for (const m of mism.slice(0, 20)) console.log(`  ${m.a}:${m.door} -> ${m.b} off by (${m.dx}, ${m.dy}) tiles`); }
  if (disc.length) console.log(`Map: ${disc.length} rooms not connected to start: ${disc.map((d) => d.a).join(', ')}`);
  const ov = findOverlaps(ROOMS, pos);
  if (ov.length) { console.log(`Map: ${ov.length} overlapping room pairs`); for (const o of ov.slice(0, 20)) console.log(`  ${o.a} overlaps ${o.b} (${o.ox}x${o.oy})`); }
}
console.log(`\n${errors} errors, ${warnings} warnings  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
process.exit(errors ? 1 : 0);
