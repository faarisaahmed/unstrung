// The in-world game scene: rooms, entities, combat resolution, transitions, rendering.
import { TILE, VIEW_W, VIEW_H, PHYS } from '../core/constants.js';
import { overlap, clamp, TAU, hashStr } from '../core/math.js';
import { Room } from '../world/room.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { FX } from './fx.js';
import { computeStats } from './stats.js';
import { writeSave } from './save.js';
import { renderTerrain } from '../art/terrain.js';
import { styleFor, rgba } from '../art/palettes.js';
import { getBackground, drawBackground } from '../art/backgrounds.js';
import { drawDynamicTiles } from '../art/tilefx.js';
import { drawAmbient, Ambient } from '../art/ambient.js';
import { getForeground, drawForeground } from '../art/foreground.js';
import { spawnEntity, spawnGlints, Projectile } from '../entities/index.js';
import { ROOMS, AREAS, START_ROOM } from '../data/world.js';
import { HUD } from '../ui/hud.js';
import { BOSS_INFO } from '../data/bossinfo.js';
import { Dialogue } from '../ui/dialogue.js';

const terrainCache = new Map();

export class Game {
  constructor(app, save, debugDoor) {
    this.app = app;
    this.input = app.input;
    this.save = save;
    this.stats = computeStats(save);
    this.camera = new Camera();
    this.fx = new FX();
    this.ambient = new Ambient();
    this.hud = new HUD(this);
    this.time = 0;
    this.hitstopT = 0;
    this.flashT = 0; this.flashColor = null; this.flashMax = 0;
    this.fade = 1; this.fadeDir = -1; this.fadeCb = null; this.fadeSpeed = 4;
    this.entities = [];
    this.cutscene = null;
    this.bossBar = null;
    this.areaTitle = null;
    this.message = null;       // item get banner
    this.dialogue = null;      // active dialogue
    this.revealed = new Set();
    this.paused = false;
    this.bossInfo = BOSS_INFO;
    const startRoom = save.room && ROOMS[save.room] ? save.room : START_ROOM;
    let entry = save.spindle && save.spindle.room === startRoom ? { marker: save.spindle.marker } : { spawn: true };
    if (startRoom === '__arena') entry = { spawn: true };
    if (debugDoor) entry = { door: debugDoor };
    else if (startRoom !== START_ROOM && startRoom !== '__arena' && !save.spindle) {
      const r = ROOMS[startRoom];
      const firstDoor = (r.tiles.join('').match(/[0-9]/) || [])[0];
      const hasSpindle = Object.values(r.legend || {}).some((l) => l.e === 'spindle');
      entry = hasSpindle ? { marker: Object.keys(r.legend).find((k) => r.legend[k].e === 'spindle') } : firstDoor ? { door: firstDoor } : { spawn: true };
    }
    this.enterRoomAt(startRoom, entry);
  }

  refreshStats() {
    this.stats = computeStats(this.save);
    const sv = this.save;
    sv.maxHp = 4 + (sv.rings || 0) + this.stats.extraHp;
    sv.maxThread = 100 + (sv.bearings || 0) * 50;
    sv.hp = Math.min(sv.hp, sv.maxHp);
    sv.thread = Math.min(sv.thread, sv.maxThread);
  }

  sfx(name, k) { this.app.audio && this.app.audio.sfx(name, k); }

  // ------------------------------------------------------------------ rooms
  enterRoomAt(roomId, entry) {
    const def = ROOMS[roomId];
    if (!def) throw new Error('Unknown room ' + roomId);
    const prevArea = this.room ? this.room.area : null;
    const room = new Room(def);
    room.breakHits = {};
    // persistent broken tiles
    const broken = this.save.broken[roomId];
    if (broken) for (const k of broken) { const [tx, ty] = k.split(',').map(Number); room.setChar(tx, ty, ' '); }
    this.room = room;
    this.style = styleFor(def.style || def.area);
    this.bg = getBackground(def.style || def.area, this.style);
    this.fg = null;
    let t = terrainCache.get(roomId);
    if (!t || t.brokenCount !== (broken ? broken.length : 0)) {
      t = renderTerrain(room, this.style);
      t.brokenCount = broken ? broken.length : 0;
      terrainCache.set(roomId, t);
      if (terrainCache.size > 8) terrainCache.delete(terrainCache.keys().next().value);
    }
    this.terrain = t;
    // reveal remembered fake walls
    this.revealedHere = new Set((this.save.flags['reveal_' + roomId] || '').split(';').filter(Boolean));
    for (const k of this.revealedHere) this.clearFakeRegion(k, false);

    this.entities = [];
    this.fx.clear();
    this.ambient.reset(this.style);
    this.camera.lockRect = null;
    this.bossBar = null;
    for (const m of room.markers) {
      if (!m.spec) continue;
      const e = spawnEntity(this, m);
      if (e) this.entities.push(e);
    }
    for (const spec of def.entities || []) {
      const e = spawnEntity(this, { ch: spec.key || '', tx: spec.x, ty: spec.y, spec });
      if (e) this.entities.push(e);
    }
    // tangle (death shade)
    const tg = this.save.tangle;
    if (tg && tg.room === roomId) {
      const e = spawnEntity(this, { ch: '', tx: tg.x / TILE, ty: tg.y / TILE, spec: { e: 'tangle' } });
      if (e) this.entities.push(e);
    }

    // place the player
    let px, py, vx = 0, vy = 0;
    if (entry.spawn) {
      const s = room.spawn || { tx: 2, ty: room.h - 3 };
      px = s.tx * TILE + 4; py = s.ty * TILE + TILE - PHYS.h;
    } else if (entry.marker || entry.markerType) {
      const m = (entry.markerType && room.markers.find((mm) => mm.spec && mm.spec.e === entry.markerType)) ||
        room.markers.find((mm) => mm.ch === entry.marker) || room.markers.find((mm) => mm.spec && mm.spec.e === 'spindle');
      const s = m || room.spawn || { tx: 2, ty: room.h - 3 };
      px = s.tx * TILE + 4; py = s.ty * TILE + TILE - PHYS.h;
    } else if (entry.door) {
      const d = room.doors[entry.door];
      if (!d) throw new Error(`Room ${roomId} has no door ${entry.door}`);
      const pv = entry.vel || { vx: 0, vy: 0 };
      if (d.edge === 'left' || d.edge === 'right') {
        px = d.edge === 'left' ? 2 : room.pxW - PHYS.w - 2;
        py = (d.y1 + 1) * TILE - PHYS.h - 1;
        vx = pv.vx; vy = Math.min(pv.vy, 0);
      } else if (d.edge === 'top') {
        px = ((d.x0 + d.x1 + 1) / 2) * TILE - PHYS.w / 2; py = 2;
        vy = Math.max(pv.vy, 100); vx = pv.vx * 0.5;
      } else {
        px = ((d.x0 + d.x1 + 1) / 2) * TILE - PHYS.w / 2; py = room.pxH - PHYS.h - 4;
        vy = -Math.max(900, -pv.vy); vx = pv.vx;
      }
    } else if (entry.pos) {
      px = entry.pos.x; py = entry.pos.y;
    }
    if (!this.player) this.player = new Player(this, px, py);
    const b = this.player.b;
    if (b.small && !entry.keepSmall) { b.small = false; b.w = PHYS.w; b.h = PHYS.h; }
    b.x = px; b.y = py; b.vx = vx; b.vy = vy;
    if (b.mode !== 'normal' && b.mode !== 'dash') b.mode = 'normal';
    b.hook = null; b.magnet = null;
    b.grounded = false;
    this.player.lastSafe = { x: px, y: py };
    this.player.art.tailInit = false;
    this.transitionCooldown = 0.2;
    this.camera.snap({ x: this.player.cx, y: this.player.cy }, room);

    this.save.room = roomId;
    this.save.visited[roomId] = true;
    const area = AREAS[def.area];
    if (area && def.area !== prevArea) {
      this.areaTitle = { name: area.name, sub: area.sub || '', t: 0 };
      if (!this.save.flags['area_' + def.area]) { this.save.flags['area_' + def.area] = 1; this.areaTitle.big = true; }
    }
    this.app.audio && this.app.audio.playMusic(def.music || (area && area.music) || def.area);
    for (const e of this.entities) e.onRoomReady && e.onRoomReady();
  }

  transition(door) {
    const link = door.link;
    if (!link) return;
    const [rid, did] = link.split(':');
    const b = this.player.b;
    const vel = { vx: b.vx, vy: b.vy };
    const keepSmall = b.small;
    this.startFade(() => {
      this.enterRoomAt(rid, { door: did, vel, keepSmall });
      if (keepSmall && !this.player.b.small) { /* grows on entering */ }
    }, 6);
  }

  startFade(cb, speed = 4) {
    if (this.fadeCb) return;
    this.fadeDir = 1; this.fadeCb = cb; this.fadeSpeed = speed;
  }

  checkDoors() {
    if (this.fadeCb || this.transitionCooldown > 0) return;
    const p = this.player, room = this.room, b = p.b;
    const cx = p.cx, cy = p.cy;
    let edge = null;
    if (cx < 0) edge = 'left'; else if (cx > room.pxW) edge = 'right';
    else if (cy < 0) edge = 'top'; else if (cy > room.pxH) edge = 'bottom';
    if (!edge) return;
    let best = null, bd = Infinity;
    for (const d of Object.values(room.doors)) {
      if (d.edge !== edge) continue;
      const dist = edge === 'left' || edge === 'right'
        ? Math.abs(cy - ((d.y0 + d.y1 + 1) / 2) * TILE)
        : Math.abs(cx - ((d.x0 + d.x1 + 1) / 2) * TILE);
      if (dist < bd) { bd = dist; best = d; }
    }
    if (best && best.link) this.transition(best);
    else {
      // no linked door: keep the player inside
      b.x = clamp(b.x, 0, room.pxW - b.w);
      b.y = clamp(b.y, -b.h, room.pxH - b.h);
      if (edge === 'bottom') this.player.hurt(1, undefined, { hazard: true });
    }
  }

  // ------------------------------------------------------------------ world events
  onTileBroken(tx, ty, ch) {
    const id = this.room.id;
    (this.save.broken[id] = this.save.broken[id] || []).push(tx + ',' + ty);
    const x = tx * TILE + TILE / 2, y = ty * TILE + TILE / 2;
    const col = ch === 'C' ? '#ffd0f2' : this.style.rim;
    this.fx.burst(x, y, 8, { color: col, speed: 220, size: 4, life: 0.6, shape: 'shard', g: 900 });
    this.sfx(ch === 'C' ? 'crystalBreak' : 'rockBreak');
    this.camera.shake(4, 0.15);
  }

  hitBreakable(tx, ty) {
    const room = this.room, k = tx + ',' + ty;
    room.breakHits[k] = (room.breakHits[k] || 0) + 1;
    this.sfx('bonkRock');
    this.fx.burst(tx * TILE + 16, ty * TILE + 16, 5, { color: this.style.rim, speed: 160, size: 3, life: 0.4, shape: 'shard', g: 800 });
    if (room.breakHits[k] >= 3) {
      // break the whole connected chunk of B
      const stack = [[tx, ty]], seen = new Set();
      while (stack.length) {
        const [x, y] = stack.pop(), kk = x + ',' + y;
        if (seen.has(kk) || room.charAt(x, y) !== 'B' || !room.inBounds(x, y)) continue;
        seen.add(kk);
        room.setChar(x, y, ' ');
        this.onTileBroken(x, y, 'B');
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    }
  }

  onPound(x, y) {
    for (const e of this.entities) {
      if (e.isEnemy && !e.dead && Math.abs(e.cx - x) < 90 && Math.abs(e.cy - y) < 50) {
        e.hurt(this.stats.damage * 1.5, Math.sign(e.cx - x) || 1, 'pound');
      }
      if (e.onPound) e.onPound(x, y);
    }
  }

  castSpell(kind, p) {
    const s = this.stats;
    if (kind === 'shard') {
      const up = this.save.abilities.shardUp;
      const angs = s.flags.tripleShard ? [-0.16, 0, 0.16] : [0];
      for (const a of angs) {
        this.entities.push(new Projectile(this, p.cx + p.b.facing * 10, p.cy, Math.cos(a) * p.b.facing * 820, Math.sin(a) * 820, {
          friendly: true, dmg: (up ? 30 : 15) * s.spellMul * (angs.length > 1 ? 0.6 : 1), pierce: true, art: 'shard', life: 1.2, r: up ? 14 : 10,
        }));
      }
      p.b.vx -= p.b.facing * 120;
      this.sfx('shard');
    } else if (kind === 'howl') {
      this.entities.push(new Projectile(this, p.cx, p.cy - 20, 0, 0, {
        friendly: true, dmg: 13 * s.spellMul, multi: 3, art: 'howl', life: 0.45, r: 0, box: { w: 70, h: 170, oy: -170 }, follow: p,
      }));
      this.sfx('howl');
    } else if (kind === 'unravel') {
      this.entities.push(new Projectile(this, p.cx, p.cy, 0, 0, {
        friendly: true, dmg: 12 * s.spellMul, multi: 3, art: 'unravel', life: 0.5, r: 0, box: { w: 180, h: 180, oy: -90 }, follow: p,
      }));
      this.camera.shake(4, 0.2);
      this.sfx('unravel');
    }
  }

  // Rollmaster techniques: friendly hit-zones that follow Bead
  technique(kind, p) {
    const s = this.stats, d = p.bonkDamage();
    if (kind === 'spin') {
      this.entities.push(new Projectile(this, p.cx, p.cy, 0, 0, { friendly: true, dmg: d * 2.5, multi: 1, art: 'unravel', life: 0.3, r: 0, box: { w: 130, h: 80, oy: -40 }, follow: p }));
      p.art.impulse(1.3, 0.8);
      this.sfx('slash'); this.camera.shake(3, 0.15);
    } else if (kind === 'rebound') {
      const f = p.b.facing;
      this.entities.push(new Projectile(this, p.cx, p.cy, 0, 0, { friendly: true, dmg: d * 2, multi: 1, art: 'none', life: 0.18, r: 0, box: { w: 110, h: 44, ox: f * 60, oy: -22 }, follow: p }));
      this.fx.slash(p.cx + f * 60, p.cy, f > 0 ? 0 : Math.PI, 110, 'rgba(255,240,210,0.95)', 0.2);
      p.b.vx = -f * 380; p.b.vy = -420;
      this.sfx('thrust');
    } else if (kind === 'cyclone') {
      this.entities.push(new Projectile(this, p.cx, p.cy, 0, 0, { friendly: true, dmg: d * 1.2, multi: 4, art: 'unravel', life: 0.55, r: 0, box: { w: 110, h: 110, oy: -70 }, follow: p }));
      p.b.vy = -640; p.b.mode = 'normal';
      this.sfx('howl'); this.camera.shake(3, 0.2);
    }
  }

  briarBurst(p) {
    this.add(new Projectile(this, p.cx, p.cy, 0, 0, { friendly: true, dmg: 12, multi: 1, art: 'unravel', life: 0.35, r: 0, box: { w: 150, h: 150, oy: -75 }, follow: p }));
  }

  // Passive knot effects that tick every frame
  updateKnots(dt) {
    const p = this.player, fl = this.stats.flags, sv = this.save, b = p.b;
    if (fl.regen) {
      const still = b.grounded && Math.abs(b.vx) < 1 && p.attackT < 0 && sv.hp < sv.maxHp && !this.enemiesNear(p.cx, p.cy, 200);
      this.regenT = still ? (this.regenT || 0) + dt : 0;
      if (this.regenT > 10) { this.regenT = 0; sv.hp++; this.sfx('mend'); this.fx.ring(p.cx, p.cy, 6, 34, 0.4, '#fff3d6', 3); }
    }
    if (fl.orbitals) {
      p.orbitals = p.orbitals || [0, 1, 2].map((i) => ({ a: i * 2.094, x: p.cx, y: p.cy, hit: new Map() }));
      for (const o of p.orbitals) {
        o.a += dt * 3;
        o.x = p.cx + Math.cos(o.a) * 42; o.y = p.cy + Math.sin(o.a) * 30;
        for (const e of this.entities) {
          if (!e.isEnemy || e.dead || !e.hittable) continue;
          const hbs = e.hurtboxes ? e.hurtboxes() : [e.hurtbox ? e.hurtbox() : e.rect()];
          if (hbs.some((hb) => hb && o.x > hb.x && o.x < hb.x + hb.w && o.y > hb.y && o.y < hb.y + hb.h)) {
            const last = o.hit.get(e) || 0;
            if (this.time - last > 0.6) { o.hit.set(e, this.time); e.hurt(4, Math.sign(e.cx - p.cx) || 1, 'spell'); }
          }
        }
      }
    } else p.orbitals = null;
  }

  // ---------------- Hall of Echoes: rematches and pantheons in a generated arena
  startEcho(queue, opts) {
    this.echo = { queue, opts, returnRoom: this.room.id, returnPos: { x: this.player.b.x, y: this.player.b.y }, hp: this.save.hp };
    this.startFade(() => this.loadEchoArena(), 2);
  }

  loadEchoArena() {
    const id = this.echo.queue[0];
    const W = 60, H = 22, rows = [];
    for (let y = 0; y < H; y++) {
      let r = '';
      for (let x = 0; x < W; x++) r += (x === 0 || x === W - 1 || y === 0 || y >= H - 2) ? '#' : ' ';
      rows.push(r);
    }
    const put = (x, y, str) => { rows[y] = rows[y].slice(0, x) + str + rows[y].slice(x + str.length); };
    put(10, H - 7, '======'); put(W - 16, H - 7, '======'); put(26, H - 11, '========');
    put(6, H - 3, '@'); put(W - 12, H - 3, 'K');
    ROOMS.__echo = { id: '__echo', area: 'echoes', name: 'Echo', tiles: rows, legend: { K: { e: 'boss', id, echo: true } }, doors: {}, music: 'echoes' };
    this.save.hp = this.save.maxHp; this.save.thread = this.save.maxThread;
    this.enterRoomAt('__echo', { spawn: true });
  }

  onEchoWin(boss) {
    const e = this.echo;
    if (!e) return;
    e.queue.shift();
    setTimeout(() => {
      if (!this.echo) return;
      if (e.queue.length) { this.startFade(() => this.loadEchoArena(), 1.5); return; }
      if (e.opts.kind === 'pantheon') {
        this.save.flags['pantheon' + e.opts.id + '_clear'] = 1;
        this.save.flags['pantheon_' + e.opts.id] = 1;
        this.message = { title: 'Pantheon Cleared', desc: 'The echoes fall quiet.', t: 0, dur: 4 };
      }
      this.leaveEcho();
    }, 2600);
  }

  leaveEcho() {
    const e = this.echo;
    this.echo = null;
    this.startFade(() => {
      this.save.hp = this.save.maxHp;
      this.player.dead = false;
      this.enterRoomAt(e.returnRoom, { pos: e.returnPos });
      writeSave(this.save);
    }, 2);
  }

  onHazard() {
    const p = this.player;
    p.pendingHazard = true;
    p.locked = true;
    this.startFade(() => {
      const s = p.lastSafe;
      p.b.x = s.x; p.b.y = s.y; p.b.vx = 0; p.b.vy = 0; p.b.mode = 'normal';
      p.locked = false; p.pendingHazard = false; p.stun = 0;
      this.camera.snap({ x: p.cx, y: p.cy }, this.room);
    }, 7);
  }

  onPlayerDeath() {
    const p = this.player, sv = this.save;
    p.dead = true;
    if (this.echo) {   // dying to an Echo costs nothing
      this.sfx('death');
      this.fx.burst(p.cx, p.cy, 30, { color: '#f1e9d2', speed: 340, size: 4, life: 1.2, g: 200 });
      setTimeout(() => this.leaveEcho(), 1500);
      return;
    }
    sv.deaths++;
    this.sfx('death');
    this.fx.burst(p.cx, p.cy, 30, { color: '#f1e9d2', speed: 340, size: 4, life: 1.2, g: 200 });
    this.app.audio && this.app.audio.stopMusic(1.2);
    if (sv.brittle) {
      sv.dead = true;
      writeSave(sv);
      this.cutscene = { t: 0, kind: 'brittleDeath' };
      setTimeout(() => this.app.toTitle(), 4000);
      return;
    }
    // drop glints into a tangle (lost if an older tangle was never recovered)
    sv.tangle = sv.glints > 0 || sv.tangle ? { room: this.room.id, x: p.cx, y: p.cy - 10, glints: sv.glints } : null;
    sv.glints = 0;
    this.deathT = 0;
    setTimeout(() => {
      this.startFade(() => {
        p.dead = false;
        sv.hp = sv.maxHp; sv.thread = 0;
        p.invuln = 1;
        const sp = sv.spindle;
        this.enterRoomAt(sp ? sp.room : START_ROOM, sp ? { marker: sp.marker } : { spawn: true });
        writeSave(sv);
      }, 1.5);
    }, 1400);
  }

  rest(spindle) {
    const sv = this.save;
    sv.spindle = { room: this.room.id, marker: spindle.marker };
    sv.hp = sv.maxHp;
    this.refreshStats();
    sv.hp = sv.maxHp;
    writeSave(sv);
    // respawn enemies
    this.sfx('rest');
  }

  writeSave() { writeSave(this.save); }

  hitstop(t) { this.hitstopT = Math.max(this.hitstopT, t); }
  flash(color, t) { this.flashColor = color; this.flashT = t; this.flashMax = t; }

  enemiesNear(x, y, r) {
    for (const e of this.entities) if (e.isEnemy && !e.dead && Math.abs(e.cx - x) < r + e.w / 2 && Math.abs(e.cy - y) < r + e.h / 2) return true;
    return false;
  }

  clearFakeRegion(key, save = true) {
    const [sx, sy] = key.split(',').map(Number);
    const room = this.room;
    const stack = [[sx, sy]], seen = new Set();
    const ctx = this.terrain.canvas.getContext('2d');
    while (stack.length) {
      const [x, y] = stack.pop(), k = x + ',' + y;
      if (seen.has(k) || !room.inBounds(x, y) || room.grid[y][x] !== '*') continue;
      seen.add(k);
      ctx.clearRect(x * TILE - 2, y * TILE - 2, TILE + 4, TILE + 4);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    if (save) {
      this.revealedHere.add(key);
      this.save.flags['reveal_' + room.id] = [...this.revealedHere].join(';');
      this.sfx('secret');
    }
  }

  // ------------------------------------------------------------------ update
  update(dt) {
    this.time += dt;
    this.updateFade(dt);
    if (this.flashT > 0) this.flashT -= dt;
    if (this.areaTitle) { this.areaTitle.t += dt; if (this.areaTitle.t > 4.5) this.areaTitle = null; }
    if (this.message) { this.message.t += dt; if (this.message.t > this.message.dur) this.message = null; }
    this.save.playTime += dt;
    if (this.transitionCooldown > 0) this.transitionCooldown -= dt;

    if (this.dialogue) { this.dialogue.update(dt); }
    if (this.hitstopT > 0) { this.hitstopT -= dt; return; }

    const p = this.player;
    p.locked = !!(this.dialogue || this.cutscene || this.fadeCb || p.pendingHazard || (this.message && this.message.lock));
    // menus
    if (!this.dialogue && !this.cutscene && !p.dead && !this.fadeCb && !(this.message && this.message.lock)) {
      const inp = this.input;
      if (inp.pressed('pause')) { inp.eatAll(); this.app.openPause(); return; }
      if (inp.pressed('map')) { inp.eatAll(); this.app.openMap(); return; }
      if (inp.pressed('inventory')) {
        inp.eatAll();
        const rs = this.restSpindle;
        if (rs && rs.resting && this.entities.includes(rs) && rs.near()) this.app.openBench(rs);
        else this.app.openInventory();
        return;
      }
    }
    if (!p.dead) p.update(dt);

    this.updateKnots(dt);
    // entities
    for (const e of this.entities) if (!e.dead) e.update(dt);
    this.resolveCombat();
    for (let i = this.entities.length - 1; i >= 0; i--) if (this.entities[i].dead && this.entities[i].removable !== false) this.entities.splice(i, 1);
    for (const e of this.pendingAdds || []) this.entities.push(e);
    this.pendingAdds = [];

    // fake wall reveal: player overlapping a fake wall cell
    const fw = this.room.rectHasChar(p.b.x + 4, p.b.y + 4, p.b.w - 8, p.b.h - 8, (ch) => ch === '*');
    if (fw) {
      const key = fw.tx + ',' + fw.ty;
      let known = false;
      for (const k of this.revealedHere) if (k === key) known = true;
      if (!known) this.revealFake(fw.tx, fw.ty);
    }

    this.checkDoors();
    const lookY = (p.b.grounded && this.input.down('down') && Math.abs(p.b.vx) < 5 && p.b.mode === 'normal') ? 120 :
      (p.b.grounded && this.input.down('up') && Math.abs(p.b.vx) < 5 && p.mending <= 0) ? -120 : 0;
    this.camera.follow({ x: p.cx, y: p.cy }, this.room, dt, p.b.facing, p.b.vy, lookY);
    if (this.app.options && !this.app.options.shake) { this.camera.ox = 0; this.camera.oy = 0; }
    this.fx.update(dt);
    this.ambient.update(dt, this.camera, this.style);
  }

  // Entities inside an unrevealed fake-wall (`*`) region stay hidden
  hiddenBySecret(e) {
    const room = this.room;
    const tx = Math.floor(e.cx / TILE), ty = Math.floor(e.cy / TILE);
    if (!room.inBounds(tx, ty) || room.grid[ty][tx] !== '*') return false;
    return !this.revealedHere.has(tx + ',' + ty);
  }

  revealFake(tx, ty) {
    // find the region's canonical key (first cell in flood order)
    const room = this.room, stack = [[tx, ty]], seen = new Set();
    let minKey = null;
    while (stack.length) {
      const [x, y] = stack.pop(), k = x + ',' + y;
      if (seen.has(k) || !room.inBounds(x, y) || room.grid[y][x] !== '*') continue;
      seen.add(k);
      if (!minKey || y * 10000 + x < minKey[1] * 10000 + minKey[0]) minKey = [x, y];
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    for (const k of seen) this.revealedHere.add(k);
    this.clearFakeRegion(tx + ',' + ty);
  }

  updateFade(dt) {
    if (this.fadeDir > 0) {
      this.fade = Math.min(1, this.fade + dt * this.fadeSpeed);
      if (this.fade >= 1) {
        const cb = this.fadeCb; this.fadeCb = null;
        this.fadeDir = -1;
        if (cb) cb();
      }
    } else if (this.fadeDir < 0) {
      this.fade = Math.max(0, this.fade - dt * this.fadeSpeed);
    }
  }

  resolveCombat() {
    const p = this.player;
    if (p.dead) return;
    const ab = p.attackBox();
    const hb = p.hurtbox();
    const b = p.b;
    for (const e of this.entities) {
      if (e.dead) continue;
      // player attack -> entity
      if (ab && e.hittable && e.lastSwing !== p.swing) {
        const hbs = e.hurtboxes ? e.hurtboxes() : [e.hurtbox ? e.hurtbox() : e.rect()];
        const box = hbs.find((r) => r && overlap(ab, r));
        if (box) {
          e.lastSwing = p.swing;
          const dir = p.attackDir === 'side' ? b.facing : 0;
          const res = e.onBonk ? e.onBonk(p.bonkDamage(), dir, p) : null;
          if (res !== false && e.isEnemy && !e.isBoss) {
            if (this.stats.flags.burn) e.burnT = 3;
            if (this.stats.flags.chill) e.chillT = 2.5;
          }
          if (res !== false) {
            p.onAttackHit(e);
            if (e.isEnemy) {
              this.hitstop(0.045);
              const hx = clamp(p.cx + (p.attackDir === 'side' ? b.facing * 26 : 0), box.x, box.x + box.w);
              const hy = clamp(p.cy + (p.attackDir === 'up' ? -26 : p.attackDir === 'down' ? 26 : 0), box.y, box.y + box.h);
              this.fx.burst(hx, hy, 6, { color: '#fffaf0', speed: 260, size: 2.4, life: 0.25, g: 0, shape: 'streak' });
              this.fx.ring(hx, hy, 4, 26, 0.18, 'rgba(255,255,255,0.9)', 2.5);
            }
          }
        }
      }
      // ram damage while comet rolling
      if ((b.mode === 'comet' || (b.mode === 'dash' && this.stats.flags.dashRam)) && e.isEnemy && e.hittable && (e.ramT || 0) <= 0 &&
          (e.hurtboxes ? e.hurtboxes() : [e.hurtbox ? e.hurtbox() : e.rect()]).some((r) => r && overlap(p.rect(), r))) {
        e.ramT = 0.3;
        e.hurt(this.stats.damage * (b.mode === 'comet' ? 2 : 1), b.mode === 'comet' ? b.cometDir : b.dashDir, 'comet');
      }
      // entity -> player
      if (e.harmful && p.invuln <= 0) {
        const boxes = e.hitboxes ? e.hitboxes() : [e.rect()];
        for (const box of boxes) {
          if (box && overlap(hb, box)) {
            p.hurt(e.damage || 1, e.isBoss && box !== boxes[0] ? box.x + box.w / 2 : e.cx);
            if (e.onHitPlayer) e.onHitPlayer(p);
            break;
          }
        }
      }
      // touch interactions
      if (e.onTouch && overlap(p.rect(), e.rect())) e.onTouch(p);
    }
  }

  add(e) { (this.pendingAdds = this.pendingAdds || []).push(e); return e; }

  // ------------------------------------------------------------------ draw
  draw(ctx, ui) {
    ui = ui || ctx;
    const cam = this.camera, room = this.room;
    const cx = cam.viewX, cy = cam.viewY;
    drawBackground(ctx, this.bg, cx, cy, room.pxW, room.pxH, this.time);
    drawAmbient(ctx, this.ambient, cx, cy, false);

    ctx.save();
    ctx.translate(-cx, -cy);
    // rock beyond the room edges (small rooms / camera clamping)
    ctx.fillStyle = this.style.rock;
    if (cx < 0) ctx.fillRect(cx, cy, -cx, VIEW_H);
    if (cy < 0 && !room.def.sky) ctx.fillRect(cx, cy, VIEW_W, -cy);
    if (cx + VIEW_W > room.pxW) ctx.fillRect(room.pxW, cy, cx + VIEW_W - room.pxW, VIEW_H);
    if (cy + VIEW_H > room.pxH) ctx.fillRect(cx, room.pxH, VIEW_W, cy + VIEW_H - room.pxH);
    // behind-terrain entities (e.g., background props)
    for (const e of this.entities) if (e.layer === 'back') e.draw(ctx, this.time);
    ctx.drawImage(this.terrain.canvas, cx, cy, VIEW_W, VIEW_H, cx, cy, VIEW_W, VIEW_H);
    drawDynamicTiles(ctx, room, cx, cy, this.time, this.style, this.player);
    this.fx.draw(ctx, false);
    const sorted = this.entities.filter((e) => e.layer !== 'back' && e.layer !== 'front' && !this.hiddenBySecret(e)).sort((a, b) => (a.z || 0) - (b.z || 0));
    for (const e of sorted) {
      try { e.draw(ctx, this.time); }
      catch (err) { if (!e.__drawErr) { e.__drawErr = 1; console.error('draw failed', e.constructor.name, err); } ctx.restore && 0; }
    }
    if (!this.player.dead) this.player.draw(ctx, this.time);
    for (const e of this.entities) if (e.layer === 'front') e.draw(ctx, this.time);
    this.fx.draw(ctx, true);
    ctx.restore();

    drawAmbient(ctx, this.ambient, cx, cy, true);
    if (!room.def.noForeground) drawForeground(ctx, this.fg || (this.fg = getForeground(this.style)), cx, cy, room.pxH);
    if (room.def.dark) this.drawDarkness(ctx, cx, cy);
    // vignette
    const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (this.flashT > 0) {
      ctx.globalAlpha = this.flashT / this.flashMax;
      ctx.fillStyle = this.flashColor; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(4,4,8,${this.fade})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    this.hud.draw(ui);
    if (this.fade > 0 && ui !== ctx) {
      ui.fillStyle = `rgba(4,4,8,${this.fade * 0.85})`;
      ui.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  drawDarkness(ctx, cx, cy) {
    if (!this.darkCanvas) {
      this.darkCanvas = document.createElement('canvas');
      this.darkCanvas.width = VIEW_W; this.darkCanvas.height = VIEW_H;
    }
    const d = this.darkCanvas.getContext('2d');
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, VIEW_W, VIEW_H);
    d.fillStyle = 'rgba(2,2,5,0.96)';
    d.fillRect(0, 0, VIEW_W, VIEW_H);
    d.globalCompositeOperation = 'destination-out';
    const lights = [];
    const lr = (this.save.abilities.lantern ? 230 : 70) + (this.stats.flags.firefly ? 110 : 0);
    lights.push({ x: this.player.cx - cx, y: this.player.cy - cy, r: lr + Math.sin(this.time * 3) * 4 });
    for (const e of this.entities) if (e.light && !e.dead) lights.push({ x: e.cx - cx, y: e.cy - cy, r: e.light });
    for (const l of lights) {
      const g = d.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g;
      d.beginPath(); d.arc(l.x, l.y, l.r, 0, TAU); d.fill();
    }
    ctx.drawImage(this.darkCanvas, 0, 0);
  }
}
