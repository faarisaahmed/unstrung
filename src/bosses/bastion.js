// Bosses of area 'bastion' (The Pinworks): the Treadle Colossus and the Tin Choir.
import { Boss } from './boss.js';
import { Entity } from '../entities/base.js';
import { Projectile, registerProjectileArt } from '../entities/projectile.js';
import { TILE } from '../core/constants.js';
import { TAU, clamp, overlap } from '../core/math.js';
import { INK, eye } from '../art/creatures.js';

// ------------------------------------------------------------------ shared helpers
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const approach = (v, to, rate, dt) => v + (to - v) * Math.min(1, rate * dt);

// first solid tile top below (x, y0)
function groundAt(room, x, y0) {
  const rows = Math.floor(room.pxH / TILE);
  for (let ty = Math.max(0, Math.floor(y0 / TILE)); ty < rows; ty++) if (room.rectBlocked(x - 2, ty * TILE + 2, 4, 4)) return ty * TILE;
  return room.pxH - TILE;
}

// The open space actually enclosed by walls (rooms often have thick walls inside the default arena).
function openArena(room, A, G, x0) {
  const yProbe = G - TILE * 4.5;
  let l = x0, r = x0;
  while (l > A.x && !room.rectBlocked(l - 4, yProbe, 4, 4)) l -= 4;
  while (r < A.x + A.w && !room.rectBlocked(r, yProbe, 4, 4)) r += 4;
  let top = G - 8;
  while (top > A.y && !room.rectBlocked(x0 - 2, top - 4, 4, 4)) top -= 4;
  return { x: l, y: top, w: r - l, h: G - top };
}

// Frame the arena during the fight (floor near the bottom of the screen, like a proper boss stage).
function lockCamera(b, bottom) {
  const room = b.game.room, A = b.arena;
  const top = Math.max(0, A.y - 48);
  b.game.camera.lockRect = { x: 0, y: top, w: room.pxW, h: Math.max(540, Math.min(room.pxH, bottom + 64) - top) };
}

function glow(ctx, x, y, r, rgb, a) {
  if (a <= 0 || r <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}

// slotted brass screw heads
function screws(ctx, pts, r, white, col = '#c9a24a') {
  ctx.fillStyle = white ? '#fff' : col;
  for (const [x, y] of pts) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  if (white) return;
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, r * 0.45);
  ctx.beginPath();
  for (const [x, y] of pts) { ctx.moveTo(x - r * 0.7, y - r * 0.3); ctx.lineTo(x + r * 0.7, y + r * 0.3); }
  ctx.stroke();
}

// a gold decal scroll (the curly filigree painted on antique machines); stroke it after
function scrollPath(ctx, x, y, s, dir, rot = 0) {
  const c = Math.cos(rot), sn = Math.sin(rot);
  const P = (px, py) => [x + (px * c - py * sn) * s * dir, y + (px * sn + py * c) * s];
  const seg = (pts) => { ctx.moveTo(...P(pts[0], pts[1])); for (let i = 2; i < pts.length; i += 6) ctx.bezierCurveTo(...P(pts[i], pts[i + 1]), ...P(pts[i + 2], pts[i + 3]), ...P(pts[i + 4], pts[i + 5])); };
  seg([0, 0, 10, -14, 30, -12, 32, 0, 33, 9, 22, 12, 18, 5, 15, 0, 21, -4, 24, 0]);
  seg([0, 0, -6, 9, -18, 10, -21, 3, -23, -2, -17, -5, -15, -1]);
  seg([12, -9, 12, -16, 18, -20, 22, -18]);
}

// a spoked handwheel: rim, hub and curved spokes (no teeth anywhere)
function handwheel(ctx, x, y, r, rot, rim, spoke, hi) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.strokeStyle = spoke; ctx.lineWidth = r * 0.09;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.16, Math.sin(a) * r * 0.16);
    ctx.quadraticCurveTo(Math.cos(a + 0.35) * r * 0.55, Math.sin(a + 0.35) * r * 0.55, Math.cos(a + 0.15) * r * 0.86, Math.sin(a + 0.15) * r * 0.86); ctx.stroke();
  }
  ctx.strokeStyle = rim; ctx.lineWidth = r * 0.16;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, TAU); ctx.stroke();
  ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, TAU); ctx.fill();
  if (hi) { ctx.strokeStyle = hi; ctx.lineWidth = r * 0.025; ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

// a spool of thread standing on its pin (x, y = bottom centre)
function spool(ctx, x, y, w, h, thread, white, K) {
  const C = (c) => (white ? '#fff' : c);
  const fl = h * 0.12, rw = w * 0.4;
  ctx.lineJoin = 'round';
  // pin
  ctx.fillStyle = C('#8e8c98'); ctx.strokeStyle = K; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.rect(x - w * 0.06, y - h - fl * 1.6, w * 0.12, fl * 1.8); ctx.fill(); ctx.stroke();
  // thread body
  ctx.fillStyle = C(thread);
  ctx.beginPath(); ctx.rect(x - rw, y - h + fl, rw * 2, h - fl * 2); ctx.fill(); ctx.stroke();
  if (!white) {
    ctx.save(); ctx.beginPath(); ctx.rect(x - rw, y - h + fl, rw * 2, h - fl * 2); ctx.clip();
    ctx.strokeStyle = 'rgba(30,6,10,0.4)'; ctx.lineWidth = 1.2;
    for (let yy = y - h + fl + 3; yy < y - fl; yy += 3.5) { ctx.beginPath(); ctx.moveTo(x - rw, yy); ctx.lineTo(x + rw, yy + 1.5); ctx.stroke(); }
    ctx.fillStyle = 'rgba(20,4,8,0.4)'; ctx.fillRect(x + rw * 0.35, y - h, rw, h);
    ctx.fillStyle = 'rgba(255,190,180,0.3)'; ctx.fillRect(x - rw * 0.7, y - h, rw * 0.25, h);
    ctx.restore();
  }
  // wooden flanges
  for (const fy of [y - h + fl * 0.5, y - fl * 0.5]) {
    ctx.fillStyle = C('#8a5a30'); ctx.strokeStyle = K; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x, fy, w * 0.5, fl * 0.75, 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (!white) { ctx.fillStyle = 'rgba(255,220,170,0.3)'; ctx.beginPath(); ctx.ellipse(x - w * 0.12, fy - fl * 0.2, w * 0.26, fl * 0.25, 0, 0, TAU); ctx.fill(); }
  }
}

function playNote(game, midi, type = 'celesta', dur = 0.7, vol = 0.12) {
  try {
    const e = game.app.audio && game.app.audio.fx && game.app.audio.fx.e;
    if (!e || !e.ctx || !e.ready) return;
    e.note(type, midi, e.ctx.currentTime + 0.01, dur, 1, e.sfxBus, { vol, rev: 0.7 });
  } catch (err) { /* audio is optional */ }
}

// An entity drawn behind the terrain on behalf of a boss (looming silhouettes, facades).
class Backdrop extends Entity {
  constructor(game, owner) { super(game, owner.x, owner.y, 1, 1); this.owner = owner; this.layer = 'back'; }
  update() { if (this.owner.dead) this.dead = true; }
  draw(ctx, t) { this.owner.drawBack(ctx, t); }
}

// Common draw: body, flash pass, localized wind-up glow.
function drawBossLayers(b, ctx, t) {
  const dying = b.mode === 'dying';
  if (dying) { ctx.save(); ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6); }
  b.drawBody(ctx, t, false);
  if (b.flashT > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6;
    b.drawBody(ctx, t, true);
    ctx.restore();
  }
  if (b.tele > 0 && b.teleAt) {
    const k = Math.min(1, b.tele / 0.35);
    glow(ctx, b.teleAt.x, b.teleAt.y, b.teleAt.r * (1.15 - 0.15 * k), b.teleAt.rgb || '255,236,200', 0.42 * k);
  }
  if (dying) ctx.restore();
}

// ------------------------------------------------------------------ projectile art
// a big brass coat button, cross-stitched with red thread; it rolls like a wheel
registerProjectileArt('gw_button', (ctx, p) => {
  const r = p.r;
  ctx.save(); ctx.translate(p.cx, p.cy);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  if (p.rolling) { ctx.beginPath(); ctx.ellipse(0, r + 1, r * 0.9, 3, 0, 0, TAU); ctx.fill(); }
  ctx.rotate(p.spin || 0);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, TAU); ctx.fill();
  ctx.fillStyle = p.o.color || '#c9963e'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(60,30,8,0.35)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, TAU); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,236,180,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 0.86, 3.6, 4.9); ctx.stroke();
  const d = r * 0.27, holes = [[-d, -d], [d, -d], [-d, d], [d, d]];
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-d, -d); ctx.lineTo(d, d); ctx.moveTo(d, -d); ctx.lineTo(-d, d); ctx.stroke();
  ctx.strokeStyle = '#c0303c'; ctx.lineWidth = 2.2; ctx.stroke();
  ctx.fillStyle = INK; for (const [x, y] of holes) { ctx.beginPath(); ctx.arc(x, y, r * 0.11, 0, TAU); ctx.fill(); }
  ctx.restore();
});

registerProjectileArt('gw_steam', (ctx, p, t) => {
  const r = p.rect();
  const total = p.age + p.life;
  const k = Math.min(1, p.age / 0.12) * Math.min(1, p.life / 0.2);
  ctx.save();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, `rgba(240,236,226,0)`); g.addColorStop(0.35, `rgba(240,236,226,${0.45 * k})`); g.addColorStop(1, `rgba(255,214,150,${0.75 * k})`);
  ctx.fillStyle = g;
  ctx.fillRect(r.x + r.w * 0.18, r.y, r.w * 0.64, r.h);
  for (let i = 0; i < 12; i++) {
    const ph = ((t * 1.9 + i * 0.137 + total) % 1);
    const y = r.y + r.h - ph * r.h;
    const x = r.x + r.w / 2 + Math.sin(t * 6 + i * 1.7) * r.w * 0.22;
    const rad = r.w * (0.28 + ph * 0.4);
    ctx.fillStyle = `rgba(236,230,218,${0.55 * k * (1 - ph * 0.7)})`;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
  }
  ctx.restore();
});

registerProjectileArt('ch_note', (ctx, p, t) => {
  const c = p.o.color || '#ffd98a';
  glow(ctx, p.cx, p.cy, p.r * 3.2, p.o.rgb || '255,220,150', 0.5);
  ctx.save(); ctx.translate(p.cx, p.cy);
  // stem + flag, swaying
  const sw = Math.sin(t * 10 + p.r) * 0.25;
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p.r * 0.85, 0); ctx.lineTo(p.r * 0.85, -p.r * 2.4); ctx.quadraticCurveTo(p.r * 1.9, -p.r * 1.9 + sw * 8, p.r * 1.7, -p.r * 1.1); ctx.stroke();
  ctx.strokeStyle = c; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.rotate(-0.45);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, 0, p.r * 1.15 + 1.5, p.r * 0.8 + 1.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, p.r * 1.15, p.r * 0.8, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(-p.r * 0.35, -p.r * 0.2, p.r * 0.35, p.r * 0.2, 0, 0, TAU); ctx.fill();
  ctx.restore();
});

// A button flung in an arc that lands and rolls along the floor.
class RollingButton extends Projectile {
  constructor(game, x, y, vx, vy, opts) {
    super(game, x, y, vx, vy, Object.assign({ art: 'gw_button', r: 17, life: 7, dmg: 1, pierce: true, color: '#c9963e' }, opts));
    this.rolling = false; this.spin = Math.random() * TAU; this.flips = 0;
  }
  update(dt) {
    const o = this.o, g = this.game;
    this.age += dt; this.life -= dt;
    if (this.life <= 0) return this.die(true);
    if (!this.rolling) {
      this.vy += 1300 * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.spin += dt * 8 * Math.sign(this.vx || 1);
      if (this.y + this.h >= o.floor) {
        this.y = o.floor - this.h; this.rolling = true;
        const dir = Math.sign(g.player.cx - this.cx) || 1;
        this.vx = dir * o.roll;
        g.sfx('bonkWall', 0.4);
        g.fx.burst(this.cx, o.floor, 6, { color: '#d8b070', speed: 160, angle: -Math.PI / 2, spread: 2.4, size: 2.2, life: 0.35 });
      }
    } else {
      this.x += this.vx * dt;
      this.spin += (this.vx * dt) / this.r;
      if (Math.random() < 0.25) g.fx.add({ x: this.cx - Math.sign(this.vx) * this.r * 0.6, y: o.floor - 2, vx: -this.vx * 0.3, vy: -80 - Math.random() * 80, life: 0.25, size: 1.6, color: '#ffd28a', g: 500, glow: true });
    }
    if (this.x < o.minX || this.x + this.w > o.maxX) {
      this.x = clamp(this.x, o.minX, o.maxX - this.w);
      this.vx = -this.vx;
      if (this.rolling && ++this.flips > 1) return this.die(true);
    }
    this.rot = 0;
  }
}

// =================================================================================================
// TREADLE COLOSSUS: Who Sews Without Thread. An antique sewing machine grown into a giant, sunk to the
// waist behind the arena. Only its presser feet, lamp-head and bobbin case are in play; the rest looms in the dark.
// =================================================================================================
export class Gearwright extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'gearwright', size: [240, 260], music: 'boss_mid', air: true, glints: 150, introTime: 2.8 });
    if (this.dead) return;
    this.noPhysics = true;
    let A = this.arena;
    this.mx = A.x + A.w / 2;
    this.G = this.groundY = groundAt(game.room, this.mx, ty * TILE);
    if (!this.spec.arena) A = this.arena = openArena(game.room, A, this.G, this.mx);
    this.mx = A.x + A.w / 2;
    // only what fits on screen above the floor counts (the camera shows ~470px above Bead's feet)
    this.H = Math.min(this.G - A.y, 470);
    this.S = clamp(this.H / 520, 0.78, 1.1);
    this.baseSpeed = this.speedMul;
    this.slump = 1; this.slumpTo = 1;
    this.coreOpen = 0; this.coreTo = 0; this.coreFlare = 0;
    this.hatch = 0; this.hatchTo = 0; this.hatchSide = 1;
    this.eyeLit = 0; this.look = 0; this.vent = 0; this.sink = 0;
    this.count = 0;
    const reach = Math.min(330, A.w * 0.24);
    this.reach = reach;
    this.fists = [-1, 1].map((s) => ({ side: s, x: this.mx + s * reach, y: this.G - 46, w: 108, h: 94, mode: 'home', harm: false, ang: 0, squash: 1, shadow: 0, glint: 0, rest: true }));
    const n = Math.max(5, Math.round(A.w / 230));
    this.vents = [];
    for (let i = 0; i < n; i++) this.vents.push({ x: A.x + (i + 0.5) * (A.w / n), warn: 0, blast: 0 });
    this.syncRect();
  }

  // ---------- geometry ----------
  shoulderY() { return this.G - this.H * 0.58 + ease(this.slump) * 185 * this.S + this.sink; }
  headPos() {
    const S = this.S, sy = this.shoulderY();
    return { x: this.mx + this.look * 16 * S, y: sy - 84 * S + Math.sin(this.anim * 1.6) * 3 + this.slump * 22 * S };
  }
  corePos() { return { x: this.mx, y: this.shoulderY() + 98 * this.S }; }
  shoulderJoint(s) { return { x: this.mx + s * 206 * this.S, y: this.shoulderY() + 18 * this.S }; }
  homeOf(f) { return { x: this.mx + f.side * this.reach, y: this.G - 236 + Math.sin(this.anim * 1.8 + f.side) * 7 }; }
  syncRect() { const sy = this.shoulderY(); this.x = this.mx - 120; this.w = 240; this.h = 260; this.y = Math.min(sy - 90, this.G - 80 - this.h / 2); }
  fistBox(f, inset = 8) {
    const rotd = Math.abs(Math.sin(f.ang)) > 0.7;
    const w = (rotd ? f.h : f.w) - inset * 2, h = ((rotd ? f.w : f.h) * (rotd ? 1 : f.squash)) - inset * 2;
    return { x: f.x - w / 2, y: f.y - h / 2, w, h };
  }

  // ---------- engine hooks ----------
  onStart() { lockCamera(this, this.G); }
  finish() { this.game.camera.lockRect = null; super.finish(); }

  update(dt) {
    this.dt = dt;
    if (!this.prop && !this.dead) this.prop = this.game.add(new Backdrop(this.game, this));
    super.update(dt);
    if (this.mode === 'dying') this.animate(dt);
  }
  idle(dt) { this.animate(dt); }
  introUpdate(dt, t) {
    if (t > 0.35) this.slumpTo = 0;
    if (t > 0.9) { this.eyeLit = Math.min(1, this.eyeLit + dt * 3); if (!this.litOnce) { this.litOnce = true; this.sfx('slam'); this.shake(8, 0.6); this.ventSteam(1.4); } }
    if (t > 1.2) for (const f of this.fists) { f.rest = false; }
    this.animate(dt);
  }
  think(dt) { this.animate(dt); }

  hurtboxes() {
    if (this.mode !== 'fight') return [];
    const S = this.S, out = this.fists.map((f) => this.fistBox(f, 4));
    const h = this.headPos();
    out.push({ x: h.x - 50 * S, y: h.y - 56 * S, w: 100 * S, h: 104 * S });
    if (this.coreOpen > 0.6) { const c = this.corePos(); out.push({ x: c.x - 46 * S, y: c.y - 46 * S, w: 92 * S, h: 92 * S }); }
    return out;
  }
  hurtbox() { return this.hurtboxes()[0] || { x: this.x, y: this.y, w: this.w, h: this.h }; }
  hitboxes() {
    const out = [];
    for (const f of this.fists) if (f.harm) out.push(this.fistBox(f, 10));
    return out.concat(this.hits);
  }

  onBonk(dmg, dir, p) {
    if (!this.hittable) return false;
    const ab = p.attackBox();
    this.coreHit = false;
    if (ab && this.coreOpen > 0.6) {
      const c = this.corePos(), S = this.S;
      if (overlap(ab, { x: c.x - 46 * S, y: c.y - 46 * S, w: 92 * S, h: 92 * S })) this.coreHit = true;
    }
    if (ab && !this.coreHit) {
      for (const f of this.fists) if (overlap(ab, this.fistBox(f, 4))) { this.fx.burst(p.cx + p.b.facing * 28, p.cy, 5, { color: '#ffd28a', speed: 240, size: 2, life: 0.3, glow: true }); break; }
    }
    return super.onBonk(dmg, dir, p);
  }
  hurt(dmg, dir, src) {
    if (this.coreHit && src === 'bonk') {
      dmg = Math.round(dmg * 1.5);
      const c = this.corePos();
      this.fx.burst(c.x, c.y, 10, { color: '#ffb35c', speed: 280, size: 3, life: 0.45, glow: true });
      this.coreFlare = Math.max(this.coreFlare, 0.15);
    }
    this.coreHit = false;
    super.hurt(dmg, dir, src);
  }

  onPhase(n) {
    this.speedMul = this.baseSpeed * (1 + 0.1 * (n - 1));
    this.sfx('bossRoar'); this.shake(9, 0.9);
    this.ventSteam(1.6);
    this.teleAt = { ...this.headPos(), r: 160 }; this.tele = 0.8;
    const h = this.headPos();
    this.fx.burst(h.x, h.y, 18, { color: '#ffcf6a', speed: 320, size: 3, life: 0.7, glow: true });
  }

  onDeath() { this.slumpTo = 1; this.coreTo = 1; for (const f of this.fists) { f.mode = 'home'; f.harm = false; f.rest = true; } this.vents.forEach((v) => { v.warn = 0; }); }

  // ---------- per-frame animation (secondary motion) ----------
  animate(dt) {
    const fight = this.mode === 'fight';
    this.slump = approach(this.slump, this.slumpTo, this.mode === 'dying' ? 1.2 : 3.2, dt);
    this.coreOpen = approach(this.coreOpen, this.coreTo, 5, dt);
    this.hatch = approach(this.hatch, this.hatchTo, 7, dt);
    this.coreFlare = Math.max(0, this.coreFlare - dt);
    this.vent = Math.max(0, this.vent - dt);
    this.look = approach(this.look, clamp((this.player.cx - this.mx) / 500, -1, 1), 2, dt);
    if (this.mode === 'dying') {
      this.sink += dt * 70 * Math.min(1, this.dieT);
      this.eyeLit = Math.max(0, this.eyeLit - dt * 0.5) * (Math.random() < 0.1 ? 0.3 : 1);
      if (Math.random() < 0.3) { const c = this.corePos(); this.fx.burst(c.x + this.rand(-120, 120), c.y + this.rand(-160, 60), 2, { color: '#ffb35c', speed: 200, size: 2.5, life: 0.6, glow: true }); }
    }
    for (const f of this.fists) {
      f.glint = Math.max(0, f.glint - dt);
      if (f.mode === 'home') {
        const h = f.rest ? { x: this.mx + f.side * this.reach, y: this.G - f.h / 2 } : this.homeOf(f);
        f.x = approach(f.x, h.x, 3.5, dt); f.y = approach(f.y, h.y, 3.5, dt);
        f.ang = approach(f.ang, 0, 6, dt); f.squash = approach(f.squash, 1, 6, dt); f.shadow = approach(f.shadow, 0, 6, dt);
      }
    }
    if (fight) {
      for (const v of this.vents) {
        if (v.warn > 0) {
          v.warn -= dt;
          if (Math.random() < 0.5) this.fx.add({ x: v.x + this.rand(-18, 18), y: this.G - 4, vx: this.rand(-20, 20), vy: -this.rand(60, 160), life: 0.5, size: this.rand(3, 6), color: 'rgba(235,228,214,0.6)', g: -40, front: false });
          if (v.warn <= 0) {
            v.blast = 0.7;
            this.zone(v.x - 34, this.G - 290, 68, 290, 0.7, { art: 'gw_steam' });
            this.sfx('burst'); this.shake(3, 0.15);
            this.fx.burst(v.x, this.G - 6, 8, { color: '#fff1d8', speed: 260, angle: -Math.PI / 2, spread: 0.8, size: 3, life: 0.5 });
          }
        }
        v.blast = Math.max(0, v.blast - dt);
      }
    }
    if (this.vent > 0 && Math.random() < 0.7) {
      for (const s of [-1, 1]) {
        const j = this.shoulderJoint(s);
        this.fx.add({ x: j.x - s * 40 * this.S, y: j.y - 70 * this.S, vx: s * this.rand(20, 90), vy: -this.rand(80, 200), life: 0.9, size: this.rand(5, 10), color: 'rgba(230,224,212,0.45)', g: -60, drag: 1, front: false });
      }
    }
    if (this.phase >= 3 && fight && Math.random() < 0.15) {
      const c = this.corePos();
      this.fx.add({ x: c.x + this.rand(-140, 140) * this.S, y: c.y + this.rand(-120, 40) * this.S, vx: this.rand(-60, 60), vy: this.rand(-120, 0), life: 0.5, size: 1.8, color: '#ffb35c', g: 400, glow: true, front: false });
    }
    this.syncRect();
  }

  ventSteam(t) { this.vent = Math.max(this.vent, t); }

  // ---------- attack selection ----------
  attackList() {
    const ph = this.phase;
    return [
      { name: 'slam', w: 3, fn: this.slam },
      { name: 'sweep', w: 2, fn: this.sweep },
      { name: 'gears', w: 2, fn: this.gears },
      { name: 'vents', w: 2, fn: this.ventAttack },
      { name: 'furnace', w: 2, fn: this.furnace, cond: () => ph >= 2 },
      { name: 'clap', w: 2.5, fn: this.clap, cond: () => ph >= 3 },
    ];
  }
  chooseAttack() {
    this.count++;
    if (this.count === 1) return this.opener();
    if (this.count % (this.phase >= 2 ? 4 : 5) === 0) { this.lastAttack = 'overheat'; return this.overheat(); }
    return super.chooseAttack();
  }

  *opener() { yield 0.4; }

  *fistMove(f, x, y, dur) {
    const x0 = f.x, y0 = f.y, T = dur / this.speedMul;
    let t = 0;
    while (t < T) { t += this.dt; const k = ease(Math.min(1, t / T)); f.x = lerp(x0, x, k); f.y = lerp(y0, y, k); yield; }
  }

  // 1. Hammer slam: a fist hunts Bead from above, its shadow marks the spot, then drops.
  *slam() {
    const n = this.phase >= 3 ? 3 : this.phase >= 2 ? 2 : 1;
    let f = this.fists[this.player.cx < this.mx ? 0 : 1];
    for (let i = 0; i < n; i++) {
      yield* this.slamOnce(f, i === n - 1);
      f = this.fists[f.side < 0 ? 1 : 0];
    }
    yield 0.4;
  }
  *slamOnce(f, last) {
    const A = this.arena;
    f.mode = 'script';
    this.sfx('charge');
    const T = (this.phase >= 3 ? 0.62 : 0.78) / this.speedMul;
    const hy = this.G - Math.min(400, this.H - 60);
    let t = 0;
    while (t < T) {
      t += this.dt;
      f.x = approach(f.x, clamp(this.player.cx, A.x + f.w / 2, A.x + A.w - f.w / 2), 5, this.dt);
      f.y = approach(f.y, hy, 6, this.dt);
      f.shadow = Math.min(1, t / T);
      yield;
    }
    // lock on: the foot flashes
    f.glint = 0.3; this.teleAt = { x: f.x, y: f.y, r: 120, rgb: '255,200,140' }; this.tele = 0.3;
    this.sfx('warn');
    yield 0.24;
    f.harm = true;
    let vy = 400;
    while (f.y + f.h / 2 < this.G) { vy += 6000 * this.dt; f.y = Math.min(this.G - f.h / 2, f.y + vy * this.dt); yield; }
    f.harm = false; f.shadow = 0;
    this.impact(f.x, f.w);
    if (this.phase >= 2) {
      this.shockwave(f.x - f.w / 2 + 6, -1, 380, 30, { color: 'rgba(255,214,150,0.9)' });
      this.shockwave(f.x + f.w / 2 - 6, 1, 380, 30, { color: 'rgba(255,214,150,0.9)' });
    }
    yield last ? 1.0 : 0.4;
    f.mode = 'home';
  }
  impact(x, w) {
    this.zone(x - w / 2 - 14, this.G - 40, w + 28, 40, 0.1);
    this.sfx('slam'); this.shake(10, 0.35);
    this.fx.burst(x, this.G, 18, { color: '#c8a46a', speed: 340, angle: -Math.PI / 2, spread: 2.6, size: 3.5, life: 0.6 });
    this.fx.burst(x, this.G, 8, { color: '#ffd28a', speed: 420, angle: -Math.PI / 2, spread: 2.2, size: 1.8, life: 0.4, glow: true });
    this.fx.ring(x, this.G - 10, 10, w, 0.3, 'rgba(255,240,210,0.7)', 4);
  }

  // 2. Floor sweep: a fist grinds along the floor from one wall to the other (jump or glide over).
  *sweep() {
    const A = this.arena;
    const s = this.player.cx < this.mx ? 1 : -1; // start on the far side
    const f = this.fists[s < 0 ? 0 : 1];
    f.mode = 'script';
    const passes = this.phase >= 3 ? 2 : 1;
    let side = s;
    const low = this.G - (f.h * 0.72) / 2;
    yield* this.fistMove(f, side < 0 ? A.x + f.w / 2 + 4 : A.x + A.w - f.w / 2 - 4, low, 0.55);
    for (let i = 0; i < passes; i++) {
      // grind telegraph
      this.sfx('charge');
      let t = 0;
      const T = (i === 0 ? 0.7 : 0.5) / this.speedMul;
      while (t < T) {
        t += this.dt;
        f.squash = approach(f.squash, 0.72, 10, this.dt);
        f.ang = approach(f.ang, side * 0.22, 8, this.dt);
        f.x += Math.sin(t * 70) * 0.8;
        f.glint = 0.1;
        if (Math.random() < 0.6) this.fx.add({ x: f.x - side * f.w * 0.4, y: this.G - 3, vx: -side * this.rand(80, 260), vy: -this.rand(60, 260), life: 0.35, size: 1.8, color: '#ffd28a', g: 900, glow: true });
        yield;
      }
      this.teleAt = { x: f.x, y: f.y, r: 100, rgb: '255,200,140' }; this.tele = 0.2;
      const dir = -side, sp = (560 + 70 * (this.phase - 1)) * this.speedMul;
      f.harm = true;
      const end = dir > 0 ? A.x + A.w - f.w / 2 - 4 : A.x + f.w / 2 + 4;
      this.sfx('slash');
      while (dir > 0 ? f.x < end : f.x > end) {
        f.x = dir > 0 ? Math.min(end, f.x + sp * this.dt) : Math.max(end, f.x - sp * this.dt);
        if (Math.random() < 0.9) this.fx.add({ x: f.x - dir * f.w * 0.45, y: this.G - 3, vx: -dir * this.rand(60, 300), vy: -this.rand(80, 320), life: 0.4, size: 2, color: '#ffd28a', g: 900, glow: true });
        yield;
      }
      f.harm = false;
      this.sfx('slam'); this.shake(7, 0.3);
      this.fx.burst(end + dir * f.w / 2, f.y, 14, { color: '#c8a46a', speed: 260, size: 3, life: 0.5 });
      side = dir;
      yield 0.3;
    }
    yield 0.35;
    f.mode = 'home';
    yield 0.4;
  }

  // 3. Button toss: a shoulder hatch opens and spits brass buttons that bounce once and roll at Bead.
  *gears() {
    const A = this.arena;
    this.hatchSide = this.player.cx < this.mx ? -1 : 1;
    this.hatchTo = 1;
    const hp = this.hatchPos();
    this.teleAt = { x: hp.x, y: hp.y, r: 90, rgb: '255,190,120' }; this.tele = 0.55;
    this.sfx('charge');
    yield 0.55;
    const n = 2 + this.phase;
    for (let i = 0; i < n; i++) {
      const h = this.hatchPos();
      const tx = clamp(this.player.cx + (i - (n - 1) / 2) * 190 + this.rand(-40, 40), A.x + 40, A.x + A.w - 40);
      const T = 0.95, g = 1300, r = 17;
      const vx = (tx - h.x) / T, vy = (this.G - r - h.y) / T - 0.5 * g * T;
      this.game.add(new RollingButton(this.game, h.x, h.y, vx, vy, { floor: this.G, minX: A.x, maxX: A.x + A.w, roll: 200 + 35 * this.phase, r }));
      this.sfx('throw');
      this.fx.burst(h.x, h.y, 5, { color: '#fff1d8', speed: 160, size: 3, life: 0.4 });
      yield 0.22;
    }
    this.hatchTo = 0;
    yield 1.0;
  }
  hatchPos() { const j = this.shoulderJoint(this.hatchSide); return { x: j.x - this.hatchSide * 30 * this.S, y: j.y - 64 * this.S }; }

  // 4. Steam vents: floor grates hiss, glow, then erupt in scalding columns.
  *ventAttack() {
    const vs = this.vents;
    const near = vs.reduce((a, v) => (Math.abs(v.x - this.player.cx) < Math.abs(a.x - this.player.cx) ? v : a), vs[0]);
    this.ventSteam(0.8);
    this.sfx('burst');
    if (this.phase >= 3 && Math.random() < 0.55) {
      // rolling eruption across the floor, starting from the far side
      const order = this.player.cx < this.mx ? vs.slice().reverse() : vs.slice();
      order.forEach((v, i) => { v.warn = 0.8 + i * 0.26; });
      yield 0.8 + vs.length * 0.26 + 0.5;
    } else {
      const pool = vs.filter((v) => v !== near).sort(() => Math.random() - 0.5);
      const pick = [near, ...pool.slice(0, this.phase >= 2 ? 3 : 2)];
      pick.forEach((v, i) => { v.warn = 0.8 + i * 0.12; });
      yield 1.0;
      if (this.phase >= 2) {
        // second wave follows Bead
        const n2 = vs.reduce((a, v) => (Math.abs(v.x - this.player.cx) < Math.abs(a.x - this.player.cx) ? v : a), vs[0]);
        n2.warn = Math.max(n2.warn, 0.75);
        yield 0.9;
      }
      yield 0.6;
    }
  }

  // 5. Bobbin heart (phase 2+): the slide plates open and fans of white-hot pins rain out.
  *furnace() {
    this.slumpTo = 0.4; this.coreTo = 1;
    this.sfx('charge');
    const c0 = this.corePos();
    this.teleAt = { x: c0.x, y: c0.y, r: 150, rgb: '255,170,90' }; this.tele = 0.75;
    yield 0.75;
    const vol = this.phase >= 3 ? 4 : 3;
    for (let v = 0; v < vol; v++) {
      this.coreFlare = 0.38; this.sfx('warn');
      yield 0.38;
      const c = this.corePos(), n = 9;
      for (let i = 0; i < n; i++) {
        const a = 0.12 + (i + (v % 2) * 0.5) / n * (Math.PI - 0.24);
        this.fire(c.x, c.y, Math.cos(a) * 290, Math.sin(a) * 290, { art: 'needle', color: '#ffcf8a', r: 7, life: 3 });
      }
      this.sfx('laser'); this.shake(4, 0.15);
      this.fx.burst(c.x, c.y, 10, { color: '#ffb35c', speed: 260, size: 2.5, life: 0.4, glow: true });
      yield 0.45;
    }
    yield* this.overheatBody(1.8);
  }

  // Overheat: slumps forward, venting. Head (and in phase 2+, the furnace) are open to punishment.
  *overheat() { yield* this.overheatBody(this.phase >= 2 ? 2.0 : 2.4); }
  *overheatBody(dur) {
    this.slumpTo = 1; this.coreTo = this.phase >= 2 ? 1 : 0;
    this.ventSteam(dur);
    this.sfx('burst');
    for (const f of this.fists) { f.mode = 'home'; f.rest = true; }
    yield dur;
    this.slumpTo = 0; this.coreTo = 0;
    for (const f of this.fists) f.rest = false;
    this.sfx('charge');
    yield 0.7;
  }

  // 6. Clap (phase 3): both fists come in from the walls at Bead's height and smash together.
  *clap() {
    const A = this.arena, p = this.player;
    const low = !!p.b.grounded;
    const fy = low ? this.G - 54 : clamp(p.cy, this.G - 260, this.G - 150);
    const [fl, fr] = this.fists;
    fl.mode = fr.mode = 'script';
    const gl = this.fistMove(fl, A.x + fl.h / 2 + 4, fy, 0.6), gr = this.fistMove(fr, A.x + A.w - fr.h / 2 - 4, fy, 0.6);
    for (let t = 0; t < 0.6 / this.speedMul + 0.02; t += this.dt) {
      gl.next(); gr.next();
      fl.ang = approach(fl.ang, -Math.PI / 2, 8, this.dt); fr.ang = approach(fr.ang, Math.PI / 2, 8, this.dt);
      yield;
    }
    // tremble + glint, then lock the meeting point
    this.sfx('charge');
    let t = 0;
    while (t < 0.5 / this.speedMul) { t += this.dt; fl.glint = fr.glint = 0.1; fl.y += Math.sin(t * 80) * 0.6; fr.y -= Math.sin(t * 80) * 0.6; yield; }
    const meet = clamp(p.cx, A.x + 150, A.x + A.w - 150);
    this.sfx('slash');
    fl.harm = fr.harm = true;
    const sp = 1050 * this.speedMul;
    while (fl.x < meet - fl.h / 2 || fr.x > meet + fr.h / 2) {
      fl.x = Math.min(meet - fl.h / 2, fl.x + sp * this.dt);
      fr.x = Math.max(meet + fr.h / 2, fr.x - sp * this.dt);
      yield;
    }
    fl.harm = fr.harm = false;
    this.sfx('slam'); this.shake(12, 0.4);
    this.fx.ring(meet, fy, 10, 140, 0.35, 'rgba(255,236,200,0.9)', 5);
    this.fx.burst(meet, fy, 22, { color: '#ffd28a', speed: 420, size: 2.4, life: 0.5, glow: true });
    this.zone(meet - 30, fy - 50, 60, 100, 0.1);
    if (low) { this.shockwave(meet - 20, -1, 420, 30, { color: 'rgba(255,214,150,0.9)' }); this.shockwave(meet + 20, 1, 420, 30, { color: 'rgba(255,214,150,0.9)' }); }
    else for (let i = 0; i < 6; i++) this.fire(meet, fy, this.rand(-260, 260), this.rand(-420, -200), { gravity: 1100, art: 'needle', color: '#ffcf8a', r: 6, life: 3 });
    yield 0.8;
    fl.mode = fr.mode = 'home';
    yield 0.5;
  }

  // ---------- drawing ----------
  drawBack(ctx, t) {
    this.paintColossus(ctx, t, false);
    if (this.flashT > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45; this.paintColossus(ctx, t, true); ctx.restore(); }
  }

  paintColossus(ctx, t, white) {
    const S = this.S, mx = this.mx, sy = this.shoulderY(), G = this.G;
    const C = (c) => (white ? '#fff' : c);
    const K = white ? '#fff' : INK;
    const IRON = '#26232b', IRON2 = '#34303a', GOLD = '#c9a24a', STEEL = '#a4a2ae';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const h = this.headPos(), hr = 46 * S;
    if (!white) {
      // far silhouette: the great handwheel turning behind its right shoulder
      const wx = mx + 330 * S, wy = sy - 30 * S;
      handwheel(ctx, wx, wy, 160 * S, t * 0.5 * (this.mode === 'dying' ? 0.2 : 1), '#1c191d', '#1a171b', 'rgba(200,160,96,0.22)');
      // and a tall spool pin on the left, a dim spool of spare thread on it
      ctx.fillStyle = '#1a171b'; ctx.fillRect(mx - 318 * S, sy - 250 * S, 16 * S, 260 * S);
      ctx.globalAlpha = 0.55; spool(ctx, mx - 310 * S, sy - 150 * S, 120 * S, 120 * S, '#4a1a20', false, INK); ctx.globalAlpha = 1;
      // back mass
      ctx.fillStyle = '#1c191d';
      ctx.beginPath();
      ctx.moveTo(mx - 400 * S, G + 40);
      ctx.quadraticCurveTo(mx - 420 * S, sy - 40 * S, mx - 250 * S, sy - 110 * S);
      ctx.quadraticCurveTo(mx, sy - 170 * S, mx + 250 * S, sy - 110 * S);
      ctx.quadraticCurveTo(mx + 420 * S, sy - 40 * S, mx + 400 * S, G + 40);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(200,160,96,0.22)'; ctx.lineWidth = 3; ctx.stroke();
      // pit rim glow at the waist
      glow(ctx, mx, G, 360 * S, '255,150,70', 0.12 + 0.04 * Math.sin(t * 2));
    }
    // arms: telescoping needle bars, polished steel in black iron collars
    for (const f of this.fists) {
      const j = this.shoulderJoint(f.side);
      const kx = -Math.sin(f.ang), ky = Math.cos(f.ang);
      const cxp = f.x - kx * f.h * 0.42, cyp = f.y - ky * f.h * 0.42 * f.squash;
      const dx = cxp - j.x, dy = cyp - j.y, L = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      ctx.save(); ctx.translate(j.x, j.y); ctx.rotate(a);
      const segs = [[0, 0.44, 22], [0.38, 0.76, 17], [0.7, 1.0, 12]];
      segs.forEach(([a0, a1, th], i) => {
        const T2 = th * S;
        ctx.fillStyle = C(['#6e6c78', '#86848f', '#9e9ca8'][i]);
        ctx.beginPath(); ctx.rect(L * a0, -T2, L * (a1 - a0), T2 * 2); ctx.fill();
        ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
        if (!white) {
          ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(L * a0 + 3, -T2 * 0.6, L * (a1 - a0) - 6, T2 * 0.22);
          ctx.fillStyle = 'rgba(10,8,14,0.35)'; ctx.fillRect(L * a0 + 2, T2 * 0.35, L * (a1 - a0) - 4, T2 * 0.6);
        }
        // collar with a gold ring
        ctx.fillStyle = C(IRON); ctx.beginPath(); ctx.rect(L * a0 - 5, -T2 - 5, 12, T2 * 2 + 10); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 2.5; ctx.stroke();
        if (!white) { ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(L * a0 + 1, -T2 - 3); ctx.lineTo(L * a0 + 1, T2 + 3); ctx.stroke(); }
      });
      ctx.restore();
    }
    // red thread: from the spool, through the take-up lever on the lamp, down to each needle
    const spX = mx - 168 * S, spY = sy - 66 * S;
    const lever = { x: h.x + 34 * S, y: h.y - hr * 0.95 + Math.sin(t * 3.2) * 9 * S };
    if (!white) {
      const thread = (pts, sag) => {
        for (const [c, w] of [[INK, 3.2], ['#c0303c', 1.6]]) {
          ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
          ctx.quadraticCurveTo((pts[0] + pts[2]) / 2, (pts[1] + pts[3]) / 2 + sag, pts[2], pts[3]); ctx.stroke();
        }
      };
      thread([spX, spY - 100 * S, lever.x, lever.y], -20 * S);
      for (const f of this.fists) {
        const kx = -Math.sin(f.ang), ky = Math.cos(f.ang);
        thread([lever.x, lever.y, f.x - kx * f.h * 0.5, f.y - ky * f.h * 0.5 * f.squash], 30 * S);
      }
    }
    // torso: the cast-iron body of the machine
    const torso = () => {
      ctx.beginPath();
      ctx.moveTo(mx - 180 * S, sy - 36 * S);
      ctx.quadraticCurveTo(mx, sy - 70 * S, mx + 180 * S, sy - 36 * S);
      ctx.lineTo(mx + 132 * S, sy + 200 * S);
      ctx.quadraticCurveTo(mx, sy + 236 * S, mx - 132 * S, sy + 200 * S);
      ctx.closePath();
    };
    torso(); ctx.fillStyle = C(IRON); ctx.fill();
    ctx.strokeStyle = K; ctx.lineWidth = 4; ctx.stroke();
    // waist down into the pit
    ctx.fillStyle = C('#1c1a20');
    ctx.beginPath(); ctx.moveTo(mx - 120 * S, sy + 200 * S); ctx.lineTo(mx - 140 * S, G + 60); ctx.lineTo(mx + 140 * S, G + 60); ctx.lineTo(mx + 120 * S, sy + 200 * S); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (!white) {
      ctx.save(); torso(); ctx.clip();
      // painted japanning: a cool sheen on the left, a shadow on the right, a little hatching
      ctx.fillStyle = 'rgba(150,150,190,0.12)'; ctx.beginPath(); ctx.ellipse(mx - 90 * S, sy + 40 * S, 70 * S, 150 * S, 0.15, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(mx + 150 * S, sy + 100 * S, 80 * S, 200 * S, 0.1, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) { const y = sy + (20 + i * 20) * S; ctx.beginPath(); ctx.moveTo(mx + (112 - i * 2) * S, y); ctx.lineTo(mx + (126 - i * 2) * S, y - 12 * S); ctx.stroke(); }
      ctx.restore();
      // gold pinstripe border and filigree scrolls
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx - 160 * S, sy - 24 * S); ctx.quadraticCurveTo(mx, sy - 56 * S, mx + 160 * S, sy - 24 * S);
      ctx.lineTo(mx + 118 * S, sy + 192 * S); ctx.quadraticCurveTo(mx, sy + 222 * S, mx - 118 * S, sy + 192 * S); ctx.closePath(); ctx.stroke();
      ctx.lineWidth = 2.6 * S; ctx.beginPath();
      for (const s of [-1, 1]) {
        scrollPath(ctx, mx + s * 62 * S, sy - 10 * S, 1.7 * S, s, s * 0.1);
        scrollPath(ctx, mx + s * 74 * S, sy + 150 * S, 1.2 * S, s, -0.5);
        scrollPath(ctx, mx + s * 100 * S, sy + 60 * S, 0.9 * S, -s, 1.4);
      }
      ctx.stroke();
      ctx.fillStyle = GOLD;
      for (const s of [-1, 1]) for (const [lx, ly] of [[88, -22], [104, 30], [62, 170], [96, 118]]) { ctx.beginPath(); ctx.ellipse(mx + s * lx * S, sy + ly * S, 5 * S, 2.4 * S, s * 0.7, 0, TAU); ctx.fill(); }
      // maker's plate on the belly
      ctx.fillStyle = '#d8bb6a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(mx, sy + 176 * S, 30 * S, 13 * S, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#7a5a20'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(mx, sy + 176 * S, 24 * S, 9 * S, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#5a3a14'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx - 14 * S, sy + 176 * S); ctx.lineTo(mx + 12 * S, sy + 176 * S); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(mx + 13 * S, sy + 176 * S, 2.5 * S, 1.5 * S, 0, 0, TAU); ctx.stroke();
      // shoulder hatches: bobbin-winder ports that spit buttons
      for (const s of [-1, 1]) {
        const j = this.shoulderJoint(s);
        const hx = j.x - s * 30 * S, hy = j.y - 64 * S;
        const open = s === this.hatchSide ? this.hatch : 0;
        ctx.fillStyle = '#0e0c10'; ctx.beginPath(); ctx.arc(hx, hy, 20 * S, 0, TAU); ctx.fill();
        if (open > 0.05) glow(ctx, hx, hy, 40 * S, '255,170,90', 0.6 * open);
        ctx.strokeStyle = STEEL; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hx, hy, 21 * S, 0, TAU); ctx.stroke();
        ctx.save(); ctx.translate(hx, hy); ctx.rotate(-s * open * 1.6);
        ctx.fillStyle = IRON2; ctx.beginPath(); ctx.arc(s * open * 10 * S, 0, 19 * S, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(s * open * 10 * S, 0, 13 * S, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    }
    // the bobbin case: two chrome slide plates over a white-hot bobbin
    {
      const c = this.corePos(), r = 46 * S;
      ctx.fillStyle = C(STEEL); ctx.beginPath(); ctx.arc(c.x, c.y, r + 10 * S, 0, TAU); ctx.fill();
      ctx.strokeStyle = K; ctx.lineWidth = 4; ctx.stroke();
      if (!white) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y, r + 5 * S, -2.6, -1.2); ctx.stroke(); }
      ctx.save(); ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.clip();
      if (!white) {
        const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, r);
        g.addColorStop(0, '#fff6d8'); g.addColorStop(0.35, '#ffb35c'); g.addColorStop(1, '#a8361e');
        ctx.fillStyle = g; ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2);
        // the bobbin, spinning: flange with holes, a hub, thread wound round
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(t * 3);
        ctx.fillStyle = 'rgba(120,40,16,0.5)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.66, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(190,40,50,0.8)'; ctx.lineWidth = 2;
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(0, 0, r * (0.34 + k * 0.08), 0, TAU); ctx.stroke(); }
        ctx.fillStyle = 'rgba(255,240,210,0.85)';
        for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2, r * 0.06, 0, TAU); ctx.fill(); }
        ctx.fillStyle = 'rgba(90,30,10,0.8)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.08, 0, TAU); ctx.fill();
        ctx.restore();
      } else { ctx.fillStyle = '#fff'; ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2); }
      // slide plates
      const o = this.coreOpen * r * 1.05;
      for (const s of [-1, 1]) {
        const px = s > 0 ? c.x + o : c.x - r - o;
        ctx.fillStyle = C('#8e8c98');
        ctx.beginPath(); ctx.rect(px, c.y - r, r, r * 2); ctx.fill();
        ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
        if (!white) {
          ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(px + r * 0.15, c.y - r, r * 0.12, r * 2);
          ctx.strokeStyle = 'rgba(40,36,50,0.6)'; ctx.lineWidth = 1.5;
          for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(px + r * 0.35, c.y + k * r * 0.22); ctx.lineTo(px + r * 0.8, c.y + k * r * 0.22); ctx.stroke(); }
          screws(ctx, [[c.x + s * (o + r * 0.6), c.y - r * 0.7], [c.x + s * (o + r * 0.6), c.y + r * 0.7]], 3 * S, false);
        }
      }
      ctx.restore();
      if (!white) {
        const a = this.coreOpen * (0.5 + 0.2 * Math.sin(t * 12)) + this.coreFlare * 1.5;
        glow(ctx, c.x, c.y, r * 3.2, '255,160,80', a * 0.6);
        // the seam glows even when closed
        ctx.strokeStyle = `rgba(255,170,90,${0.35 + 0.2 * Math.sin(t * 3)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(c.x, c.y - r); ctx.lineTo(c.x, c.y + r); ctx.stroke();
      }
    }
    // shoulder caps: rounded cast iron, pinstriped
    for (const s of [-1, 1]) {
      const px = mx + s * 182 * S, py = sy - 14 * S;
      const cap = () => { ctx.beginPath(); ctx.ellipse(px, py, 80 * S, 64 * S, s * 0.25, Math.PI * 0.9, Math.PI * 2.1); ctx.closePath(); };
      cap(); ctx.fillStyle = C(IRON2); ctx.fill();
      ctx.strokeStyle = K; ctx.lineWidth = 4; ctx.stroke();
      if (!white) {
        ctx.fillStyle = 'rgba(200,200,240,0.13)';
        ctx.beginPath(); ctx.ellipse(px - s * 10 * S, py - 30 * S, 50 * S, 16 * S, s * 0.25, 0, TAU); ctx.fill();
        ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(px, py, 66 * S, 50 * S, s * 0.25, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
        ctx.lineWidth = 2.2 * S; ctx.beginPath(); scrollPath(ctx, px - s * 4 * S, py - 22 * S, 1.1 * S, -s, s * 0.25); ctx.stroke();
        const sc = [];
        for (let k = 0; k < 5; k++) { const a = Math.PI * (1.08 + k * 0.21); sc.push([px + Math.cos(a + s * 0.25) * 72 * S, py + Math.sin(a + s * 0.25) * 56 * S]); }
        screws(ctx, sc, 3.4 * S, false);
      }
    }
    // the big spool of red thread on its pin atop the left shoulder; a bobbin winder on the right
    spool(ctx, spX, spY, 78 * S, 92 * S, '#a82834', white, K);
    {
      const bx = mx + 196 * S, byy = sy - 82 * S;
      ctx.fillStyle = C(IRON2); ctx.strokeStyle = K; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.rect(bx - 8 * S, byy, 16 * S, 34 * S); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(bx, byy); ctx.rotate(t * 2);
      ctx.fillStyle = C('#5a3020'); ctx.beginPath(); ctx.arc(0, 0, 17 * S, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C(STEEL); ctx.beginPath(); ctx.arc(0, 0, 11 * S, 0, TAU); ctx.fill(); ctx.stroke();
      if (!white) { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-9 * S, 0); ctx.lineTo(9 * S, 0); ctx.stroke(); }
      ctx.restore();
    }
    // head: the lamp housing, one great lamp of an eye
    {
      // neck: two iron struts
      ctx.fillStyle = C(IRON2);
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.rect(h.x + s * 22 * S - 7 * S, h.y + 30 * S, 14 * S, sy - h.y - 20 * S); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 2.5; ctx.stroke(); }
      // take-up lever bobbing on the crown, thread through its eye
      ctx.strokeStyle = K; ctx.lineWidth = 9 * S;
      ctx.beginPath(); ctx.moveTo(h.x + 8 * S, h.y - hr * 0.6); ctx.lineTo(lever.x, lever.y); ctx.stroke();
      ctx.strokeStyle = C(STEEL); ctx.lineWidth = 5 * S; ctx.stroke();
      ctx.fillStyle = C(STEEL); ctx.strokeStyle = K; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(lever.x, lever.y, 6 * S, 0, TAU); ctx.fill(); ctx.stroke();
      if (!white) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(lever.x, lever.y, 2.5 * S, 0, TAU); ctx.fill(); }
      // tension discs on the brow
      ctx.fillStyle = C(STEEL); ctx.strokeStyle = K; ctx.lineWidth = 2;
      for (const k of [0, 1]) { ctx.beginPath(); ctx.ellipse(h.x - 36 * S + k * 6 * S, h.y - hr * 0.72, 4 * S, 11 * S, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
      // housing: a domed lamp hood, wider at the skirt
      const hood = () => {
        ctx.beginPath();
        ctx.moveTo(h.x - hr * 1.18, h.y + hr * 0.62);
        ctx.quadraticCurveTo(h.x - hr * 1.2, h.y - hr * 1.12, h.x, h.y - hr * 1.12);
        ctx.quadraticCurveTo(h.x + hr * 1.2, h.y - hr * 1.12, h.x + hr * 1.18, h.y + hr * 0.62);
        ctx.quadraticCurveTo(h.x, h.y + hr * 0.95, h.x - hr * 1.18, h.y + hr * 0.62);
        ctx.closePath();
      };
      hood(); ctx.fillStyle = C(IRON2); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 4; ctx.stroke();
      if (!white) {
        ctx.save(); hood(); ctx.clip();
        ctx.fillStyle = 'rgba(170,170,215,0.2)'; ctx.beginPath(); ctx.ellipse(h.x - hr * 0.5, h.y - hr * 0.6, hr * 0.55, hr * 0.32, -0.4, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(220,220,255,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(h.x, h.y + hr * 0.2, hr * 1.1, -2.7, -1.9); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(h.x + hr * 0.9, h.y + hr * 0.2, hr * 0.5, hr, 0, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = GOLD; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(h.x - hr * 1.02, h.y + hr * 0.5); ctx.quadraticCurveTo(h.x, h.y + hr * 0.78, h.x + hr * 1.02, h.y + hr * 0.5); ctx.stroke();
        ctx.lineWidth = 2 * S; ctx.beginPath(); scrollPath(ctx, h.x - hr * 0.2, h.y - hr * 0.86, 0.8 * S, -1); scrollPath(ctx, h.x + hr * 0.2, h.y - hr * 0.86, 0.8 * S, 1); ctx.stroke();
        screws(ctx, [[h.x - hr * 0.98, h.y + hr * 0.25], [h.x + hr * 0.98, h.y + hr * 0.25]], 3 * S, false);
      }
      // the lamp: a bezel of brass round a glass lens
      const lr = hr * 0.66, ly = h.y - hr * 0.06;
      ctx.fillStyle = C('#b8913e'); ctx.strokeStyle = K; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(h.x, ly, lr + 7 * S, 0, TAU); ctx.fill(); ctx.stroke();
      if (!white) { ctx.strokeStyle = 'rgba(255,240,190,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h.x, ly, lr + 4 * S, -2.6, -1.3); ctx.stroke(); }
      ctx.fillStyle = C('#1a1418'); ctx.beginPath(); ctx.arc(h.x, ly, lr, 0, TAU); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 2.5; ctx.stroke();
      if (!white) {
        const lit = this.eyeLit, col = this.phase >= 3 ? '255,122,74' : '255,207,106';
        const flick = 0.85 + 0.15 * Math.sin(t * 23);
        if (lit > 0.02) {
          ctx.save(); ctx.beginPath(); ctx.arc(h.x, ly, lr, 0, TAU); ctx.clip();
          const g = ctx.createRadialGradient(h.x + this.look * 6 * S, ly, 1, h.x, ly, lr);
          g.addColorStop(0, `rgba(255,250,230,${lit * flick})`); g.addColorStop(0.4, `rgba(${col},${0.9 * lit * flick})`); g.addColorStop(1, `rgba(${col},${0.15 * lit})`);
          ctx.fillStyle = g; ctx.fillRect(h.x - lr, ly - lr, lr * 2, lr * 2);
          // a dark pupil ringed by a glowing filament, following Bead
          const ix = h.x + this.look * lr * 0.35;
          ctx.strokeStyle = `rgba(255,248,220,${0.9 * lit})`; ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.arc(ix, ly, lr * 0.42, 0, TAU); ctx.stroke();
          ctx.fillStyle = `rgba(40,12,6,${0.9 * lit})`; ctx.beginPath(); ctx.arc(ix, ly, lr * 0.26, 0, TAU); ctx.fill();
          ctx.fillStyle = `rgba(255,255,255,${0.8 * lit})`; ctx.beginPath(); ctx.arc(ix - lr * 0.1, ly - lr * 0.1, lr * 0.07, 0, TAU); ctx.fill();
          ctx.restore();
          glow(ctx, h.x, ly, lr * 2.4, col, 0.35 * lit * flick);
        }
        // a heavy visor lid, lowered into a scowl
        ctx.fillStyle = IRON; ctx.strokeStyle = INK; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(h.x - lr - 9 * S, ly - lr * 0.55); ctx.quadraticCurveTo(h.x, ly - lr * 1.4, h.x + lr + 9 * S, ly - lr * 0.55);
        ctx.lineTo(h.x + lr * 0.7, ly - lr * 0.32 - this.slump * 6 * S); ctx.quadraticCurveTo(h.x, ly - lr * 0.62, h.x - lr * 0.7, ly - lr * 0.32 - this.slump * 6 * S); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = GOLD; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(h.x - lr * 0.8, ly - lr * 0.62); ctx.quadraticCurveTo(h.x, ly - lr * 1.12, h.x + lr * 0.8, ly - lr * 0.62); ctx.stroke();
        // glass glint and the cracks of battle
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h.x, ly, lr * 0.8, 2.4, 3.1); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.4;
        if (this.phase >= 2) { ctx.beginPath(); ctx.moveTo(h.x + lr * 0.2, ly - lr * 0.3); ctx.lineTo(h.x + lr * 0.45, ly + lr * 0.1); ctx.lineTo(h.x + lr * 0.3, ly + lr * 0.4); ctx.moveTo(h.x + lr * 0.45, ly + lr * 0.1); ctx.lineTo(h.x + lr * 0.8, ly + lr * 0.2); ctx.stroke(); }
        if (this.phase >= 3) { ctx.beginPath(); ctx.moveTo(h.x - lr * 0.9, ly + lr * 0.2); ctx.lineTo(h.x - lr * 0.5, ly + lr * 0.35); ctx.lineTo(h.x - lr * 0.55, ly + lr * 0.75); ctx.stroke(); }
        // needle-plate grille for a mouth
        const my = h.y + hr * 0.62;
        ctx.fillStyle = '#9a98a4'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.rect(h.x - 20 * S, my - 7 * S, 40 * S, 12 * S); ctx.fill(); ctx.stroke();
        ctx.fillStyle = this.phase >= 3 ? `rgba(255,122,74,${0.5 + 0.3 * Math.sin(t * 8)})` : INK;
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.rect(h.x + k * 7 * S - 1.6 * S, my - 4.5 * S, 3.2 * S, 7 * S); ctx.fill(); }
      }
    }
  }

  drawBody(ctx, t, white) {
    const G = this.G, K = white ? '#fff' : INK;
    if (!white) {
      // vents in the floor
      for (const v of this.vents) {
        const hot = v.warn > 0 ? 1 - Math.min(1, v.warn / 0.8) : 0;
        ctx.fillStyle = '#1a1512'; ctx.fillRect(v.x - 30, G - 5, 60, 7);
        ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(v.x - 30, G - 5, 60, 7);
        ctx.fillStyle = v.warn > 0 || v.blast > 0 ? `rgba(255,${170 - hot * 60},80,${0.5 + hot * 0.5})` : 'rgba(255,170,90,0.18)';
        for (let k = -2; k <= 2; k++) ctx.fillRect(v.x + k * 11 - 3, G - 4, 6, 4);
        if (v.warn > 0) glow(ctx, v.x, G - 6, 40 + hot * 30, '255,170,90', 0.25 + hot * 0.4);
      }
      // slam shadows
      for (const f of this.fists) {
        if (f.shadow <= 0.01) continue;
        const k = f.shadow;
        ctx.fillStyle = `rgba(8,6,10,${0.55 * k})`;
        ctx.beginPath(); ctx.ellipse(f.x, G - 2, f.w * (0.3 + 0.35 * k), 9, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(255,180,110,${0.7 * k})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(f.x, G - 2, f.w * (0.3 + 0.35 * k), 9, 0, 0, TAU); ctx.stroke();
      }
    }
    for (const f of this.fists) this.drawFist(ctx, f, t, white, K);
  }

  // each "fist" is a presser foot on the end of a needle bar: clamp, shank, two-toed foot, threaded needle
  drawFist(ctx, f, t, white, K) {
    const C = (c) => (white ? '#fff' : c);
    const w = f.w, h = f.h;
    ctx.save();
    ctx.translate(f.x, f.y); ctx.rotate(f.ang); ctx.scale(f.side < 0 ? 1 : -1, f.squash);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // clamp collar with its thumbscrew
    ctx.fillStyle = C('#8e8c98'); ctx.strokeStyle = K; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.rect(-w * 0.2, -h * 0.56, w * 0.4, h * 0.2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.rect(w * 0.2, -h * 0.5, w * 0.08, h * 0.07); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C('#b8913e'); ctx.beginPath(); ctx.ellipse(w * 0.32, -h * 0.465, w * 0.06, h * 0.1, 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (!white) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-w * 0.16, -h * 0.53, w * 0.05, h * 0.14); }
    // shank: black iron, gold pinstripe, a jewel lamp that pulses
    const shank = () => {
      ctx.beginPath();
      ctx.moveTo(-w * 0.26, -h * 0.38); ctx.lineTo(w * 0.26, -h * 0.38);
      ctx.quadraticCurveTo(w * 0.36, -h * 0.1, w * 0.3, h * 0.1);
      ctx.lineTo(-w * 0.3, h * 0.1);
      ctx.quadraticCurveTo(-w * 0.36, -h * 0.1, -w * 0.26, -h * 0.38);
      ctx.closePath();
    };
    shank(); ctx.fillStyle = C('#2e2a34'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3.5; ctx.stroke();
    if (!white) {
      ctx.save(); shank(); ctx.clip();
      ctx.fillStyle = 'rgba(170,170,220,0.16)'; ctx.fillRect(-w * 0.26, -h * 0.38, w * 0.14, h * 0.5);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(w * 0.14, -h * 0.38, w * 0.2, h * 0.5);
      ctx.restore();
      ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-w * 0.21, -h * 0.32); ctx.lineTo(w * 0.21, -h * 0.32); ctx.quadraticCurveTo(w * 0.29, -h * 0.1, w * 0.24, h * 0.04); ctx.lineTo(-w * 0.24, h * 0.04); ctx.quadraticCurveTo(-w * 0.29, -h * 0.1, -w * 0.21, -h * 0.32); ctx.stroke();
      ctx.lineWidth = 1.8; ctx.beginPath(); scrollPath(ctx, w * 0.12, -h * 0.08, 0.36, -1, 0.3); ctx.stroke();
      const pulse = 0.5 + 0.5 * Math.sin(t * 4 + f.side);
      ctx.fillStyle = '#b8913e'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-w * 0.15, -h * 0.17, 8, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = this.phase >= 3 ? '#ff7a4a' : '#ffcf6a'; ctx.beginPath(); ctx.arc(-w * 0.15, -h * 0.17, 3.5 + pulse, 0, TAU); ctx.fill();
    }
    // ankle hinge
    ctx.fillStyle = C('#8e8c98'); ctx.strokeStyle = K; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.rect(-w * 0.17, h * 0.07, w * 0.34, h * 0.13); ctx.fill(); ctx.stroke();
    if (!white) screws(ctx, [[w * 0.09, h * 0.135]], 3.2, false, '#dcdae4');
    // the presser foot: a broad polished sole split into two toes, tips curling up at the sides
    const sole = () => {
      ctx.beginPath();
      ctx.moveTo(-w * 0.4, h * 0.18);
      ctx.lineTo(w * 0.4, h * 0.18);
      ctx.quadraticCurveTo(w * 0.52, h * 0.18, w * 0.5, h * 0.3);
      ctx.quadraticCurveTo(w * 0.49, h * 0.49, w * 0.36, h * 0.49);
      ctx.lineTo(w * 0.05, h * 0.49); ctx.lineTo(w * 0.05, h * 0.32); ctx.lineTo(-w * 0.05, h * 0.32); ctx.lineTo(-w * 0.05, h * 0.49);
      ctx.lineTo(-w * 0.36, h * 0.49);
      ctx.quadraticCurveTo(-w * 0.49, h * 0.49, -w * 0.5, h * 0.3);
      ctx.quadraticCurveTo(-w * 0.52, h * 0.18, -w * 0.4, h * 0.18);
      ctx.closePath();
    };
    sole(); ctx.fillStyle = C('#a4a2ae'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3.5; ctx.stroke();
    if (!white) {
      ctx.save(); sole(); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-w * 0.45, h * 0.21, w * 0.9, h * 0.04);
      ctx.fillStyle = 'rgba(20,18,28,0.38)'; ctx.fillRect(-w * 0.5, h * 0.39, w, h * 0.12);
      ctx.strokeStyle = 'rgba(20,18,28,0.55)'; ctx.lineWidth = 1.4;
      for (let k = -4; k <= 4; k++) { if (!k) continue; const x = k * w * 0.1; ctx.beginPath(); ctx.moveTo(x, h * 0.41); ctx.lineTo(x + 3, h * 0.49); ctx.stroke(); }
      ctx.restore();
      if (f.glint > 0) for (const s of [-1, 1]) glow(ctx, s * w * 0.27, h * 0.44, 34, '255,210,150', Math.min(1, f.glint * 4));
    }
    // the needle, through the slot, red thread in its eye
    ctx.strokeStyle = K; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, -h * 0.4); ctx.lineTo(0, h * 0.47); ctx.stroke();
    ctx.strokeStyle = C('#dcdae4'); ctx.lineWidth = 4.5; ctx.stroke();
    if (!white) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-1, -h * 0.3); ctx.lineTo(-1, h * 0.3); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, h * 0.36, 1.3, 3.6, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#c0303c'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(0, h * 0.36); ctx.quadraticCurveTo(w * 0.1, h * 0.42, w * 0.06, h * 0.54); ctx.stroke();
    }
    ctx.restore();
  }

  draw(ctx, t) { drawBossLayers(this, ctx, t); }
}

// =================================================================================================
// THE TIN CHOIR: Seven Voices, One Song. Seven thimble-headed tin singers in felt robes, in a gallery of alcoves.
// Only the lead (hooped, lowered on its rod) can be struck. Each 1/7 of health silences a voice.
// =================================================================================================
const CHOIR_SCALE = [50, 53, 55, 57, 60, 62, 65]; // D minor pentatonic, low to high
const CHOIR_COLORS = [
  ['#d27a5a', '255,150,110'], ['#d8a24a', '255,200,110'], ['#b8c45a', '220,240,130'], ['#6fc4a8', '140,240,210'],
  ['#6aa6e0', '140,200,255'], ['#9a86e0', '190,170,255'], ['#e07ab8', '255,160,220'],
];

export class AutomatonChoir extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'choir', size: [200, 120], music: 'boss_mid', air: true, glints: 160, introTime: 3.0 });
    if (this.dead) return;
    this.noPhysics = true;
    let A = this.arena;
    this.mx = A.x + A.w / 2;
    this.G = this.groundY = groundAt(game.room, this.mx, ty * TILE);
    if (!this.spec.arena) A = this.arena = openArena(game.room, A, this.G, this.mx);
    this.mx = A.x + A.w / 2;
    this.H = this.G - A.y;
    this.alcY = this.G - Math.min(this.H * 0.6, 316);
    this.leadY = this.G - 122;
    this.baseSpeed = this.speedMul;
    this.singers = [];
    for (let i = 0; i < 7; i++) {
      const x = A.x + A.w * (0.12 + i * (0.76 / 6));
      this.singers.push({ i, x, y: this.alcY, ext: 0, extTo: 0, mouth: 0, glow: 0, alive: true, crack: 0, sway: Math.random() * TAU, key: Math.random() * TAU, midi: CHOIR_SCALE[i], col: CHOIR_COLORS[i][0], rgb: CHOIR_COLORS[i][1], aim: null, fall: 0 });
    }
    this.lead = null;
    this.silenced = 0;
    this.beams = [];      // {x1,y1,x2,y2,warn,live,w,rgb}
    this.staff = [];      // {k, warn, live, rgb}
    this.glyphs = [];     // floating note glyphs
    this.metro = 0; this.metroDir = 1;
    this.songs = 0;
    this.x = A.x + A.w * 0.1; this.w = A.w * 0.8; this.y = this.alcY - 70; this.h = 140;
  }

  get beat() { return [0.5, 0.44, 0.38][this.phase - 1]; }
  alive() { return this.singers.filter((s) => s.alive); }
  staffY(k) { return this.G - 14 - k * 58; }

  onStart() { lockCamera(this, this.G); }
  finish() { this.game.camera.lockRect = null; super.finish(); }

  update(dt) {
    this.dt = dt;
    if (!this.prop && !this.dead) this.prop = this.game.add(new Backdrop(this.game, this));
    super.update(dt);
    if (this.mode === 'dying') this.animate(dt);
  }
  idle(dt) { this.animate(dt); }
  introUpdate(dt, t) {
    // the choir wakes one by one, a rising arpeggio
    const k = Math.floor(t / 0.28);
    if (k < 7 && this.introK !== k) {
      this.introK = k;
      const s = this.singers[k];
      s.mouth = 1; s.glow = 1; playNote(this.game, s.midi + 12, 'celesta', 1.2, 0.14);
      this.glyph(s.x, s.y - 80, s.col);
    }
    if (t > 2.1 && !this.leadChosen) { this.leadChosen = true; this.setLead(this.singers[3]); playNote(this.game, 62, 'choir', 1.6, 0.1); }
    this.animate(dt);
  }
  think(dt) { this.animate(dt); }

  setLead(s) {
    if (this.lead) this.lead.extTo = 0;
    this.lead = s;
    if (s) { s.extTo = 1; this.sfx('bell'); }
  }
  leadBox() {
    const s = this.lead;
    if (!s || s.ext < 0.75 || !s.alive) return null;
    return { x: s.x - 30, y: s.y - 70, w: 60, h: 114 };
  }
  hurtboxes() { const b = this.mode === 'fight' ? this.leadBox() : null; return b ? [b] : []; }
  hurtbox() { return this.leadBox() || { x: -9999, y: -9999, w: 0, h: 0 }; }
  hitboxes() { return this.hits; }

  hurt(dmg, dir, src) {
    if (!this.leadBox()) return;
    super.hurt(dmg, dir, src);
    if (this.mode !== 'fight') return;
    const n = Math.min(6, Math.floor((1 - this.hp / this.maxHp) * 7));
    while (this.silenced < n) { this.silenced++; this.silence(this.lead); }
  }

  silence(s) {
    if (!s || !s.alive) return;
    s.alive = false; s.extTo = 0; s.mouth = 0; s.crack = 1;
    this.sfx('glassHit'); this.sfx('explode'); this.shake(7, 0.4);
    this.fx.burst(s.x, s.y, 20, { color: '#cfd0d8', speed: 320, size: 3.5, life: 0.7, shape: 'shard' });
    this.fx.burst(s.x, s.y, 12, { color: '#ffd28a', speed: 260, size: 2, life: 0.5, glow: true });
    playNote(this.game, s.midi - 12, 'bell', 2, 0.16);
    const rest = this.alive();
    // the remaining voices close ranks
    this.lead = null;
    if (rest.length) {
      const next = rest.slice().sort((a, b) => Math.abs(a.x - this.player.cx) - Math.abs(b.x - this.player.cx))[Math.min(rest.length - 1, 1 + Math.floor(Math.random() * 2))] || rest[0];
      this.pendingLead = next;
    }
    this.co = this.regroup();
    this.wait = 0;
    this.beams.length = 0;
    for (const st of this.staff) st.warn = Math.min(st.warn, 0); // let live ones finish, cancel pending
    this.staff = this.staff.filter((st) => st.live > 0);
  }
  *regroup() {
    yield 0.9;
    if (this.pendingLead && this.pendingLead.alive) this.setLead(this.pendingLead);
    this.pendingLead = null;
    yield 0.9;
  }

  onBonk(dmg, dir, p) { return super.onBonk(dmg, dir, p); }

  onPhase(n) {
    this.speedMul = this.baseSpeed * (1 + 0.08 * (n - 1));
    this.sfx('bossRoar');
    for (const s of this.alive()) { s.glow = 1; s.mouth = 1; }
    [62, 65, 69].forEach((m) => playNote(this.game, m + (n - 2) * 2, 'choir', 1.5, 0.08));
    this.shake(5, 0.6);
  }

  onDeath() {
    this.beams.length = 0; this.staff.length = 0;
    for (const s of this.singers) {
      s.mouth = 0; s.extTo = 0;
      if (s.alive) {
        s.alive = false; s.crack = 1;
        this.fx.burst(s.x, s.y - 30, 24, { color: '#cfd0d8', speed: 340, size: 3.5, life: 0.8, shape: 'shard' });
        this.fx.burst(s.x, s.y - 30, 16, { color: '#ffd28a', speed: 300, size: 2, life: 0.6, glow: true });
      }
    }
    // the last chord, unresolved
    [50, 57, 62, 65].forEach((m) => playNote(this.game, m, 'choir', 2.2, 0.08));
  }

  glyph(x, y, col) { this.glyphs.push({ x, y, vx: this.rand(-20, 20), vy: -this.rand(40, 70), life: 1.4, max: 1.4, col, rot: this.rand(-0.3, 0.3), kind: Math.random() < 0.5 ? 1 : 2 }); }

  animate(dt) {
    this.metro += dt / this.beat * this.metroDir;
    if (this.metro > 1) { this.metro = 1; this.metroDir = -1; if (this.mode === 'fight') this.sfx('tick'); }
    if (this.metro < -1) { this.metro = -1; this.metroDir = 1; if (this.mode === 'fight') this.sfx('tick'); }
    for (const s of this.singers) {
      s.ext = approach(s.ext, s.extTo, 4, dt);
      s.y = lerp(this.alcY, this.leadY, ease(s.ext));
      s.mouth = Math.max(0, s.mouth - dt * 2.2);
      s.glow = Math.max(0, s.glow - dt * 1.8);
      s.key += dt * (s.alive ? 3 : 0.2);
      if (!s.alive && Math.random() < 0.04) this.fx.add({ x: s.x + this.rand(-10, 10), y: s.y - 20, vx: this.rand(-10, 10), vy: -this.rand(20, 50), life: 1, size: this.rand(3, 6), color: 'rgba(60,54,50,0.5)', g: -20, front: false });
    }
    // beams: warn -> live
    for (const b of this.beams) {
      if (b.warn > 0) { b.warn -= dt; if (b.warn <= 0) { b.live = b.dur; this.sfx('laser'); } }
      else if (b.live > 0) {
        b.live -= dt;
        const dx = b.x2 - b.x1, dy = b.y2 - b.y1, L = Math.hypot(dx, dy), n = Math.ceil(L / 18);
        for (let i = 0; i <= n; i++) { const k = i / n; this.hits.push({ x: b.x1 + dx * k - b.w / 2, y: b.y1 + dy * k - b.w / 2, w: b.w, h: b.w }); }
      }
    }
    this.beams = this.beams.filter((b) => b.warn > 0 || b.live > 0);
    for (const st of this.staff) {
      if (st.warn > 0) { st.warn -= dt; if (st.warn <= 0) { st.live = st.dur; playNote(this.game, st.midi + 12, 'celesta', 0.5, 0.13); } }
      else if (st.live > 0) {
        st.live -= dt;
        const y = this.staffY(st.k);
        this.hits.push({ x: this.arena.x, y: y - 10, w: this.arena.w, h: 20 });
      }
    }
    this.staff = this.staff.filter((st) => st.warn > 0 || st.live > 0);
    for (const g of this.glyphs) { g.life -= dt; g.x += g.vx * dt; g.y += g.vy * dt; g.vx += Math.sin(g.life * 5) * 30 * dt; }
    this.glyphs = this.glyphs.filter((g) => g.life > 0);
    // player bonking a silent / non-lead singer: clink feedback
    const p = this.player, ab = p.attackBox && p.attackBox();
    if (ab && this.mode === 'fight' && p.swing !== this.clinkSwing) {
      for (const s of this.singers) {
        if (s === this.lead && this.leadBox()) continue;
        if (overlap(ab, { x: s.x - 30, y: s.y - 70, w: 60, h: 114 })) {
          this.clinkSwing = p.swing; this.sfx('clink');
          this.fx.burst(s.x, s.y, 5, { color: '#fff', speed: 180, size: 2, life: 0.2 });
          break;
        }
      }
    }
  }

  // ---- note helpers ----
  sing(s, strength = 1) {
    s.mouth = 1; s.glow = Math.max(s.glow, strength);
    playNote(this.game, s.midi + 12, 'celesta', 0.6, 0.12);
    if (Math.random() < 0.7) this.glyph(s.x + this.rand(-10, 10), s.y - 80, s.col);
  }
  mouthPos(s) { return { x: s.x, y: s.y - 44 }; }

  attackList() {
    const ph = this.phase;
    return [
      { name: 'aria', w: 3, fn: this.aria },
      { name: 'staff', w: 3, fn: this.staffSong },
      { name: 'round', w: 2, fn: this.round },
      { name: 'scale', w: 2, fn: this.scaleRun },
      { name: 'chord', w: 2.5, fn: this.chord, cond: () => ph >= 2 },
      { name: 'harmony', w: 2.5, fn: this.harmony, cond: () => ph >= 3 },
    ];
  }
  chooseAttack() {
    if (!this.alive().length) return null;
    this.songs++;
    // rotate the lead every two songs
    if (this.songs > 1 && this.songs % 2 === 1) return this.changeLead();
    return super.chooseAttack();
  }
  *changeLead() {
    const pool = this.alive().filter((s) => s !== this.lead);
    if (!pool.length) { yield 0.2; return; }
    const next = this.pick(pool);
    if (this.lead) this.lead.extTo = 0;
    this.lead = null;
    yield 0.45;
    // the conductor's chime: next lead lights up before descending
    next.glow = 1; this.sing(next);
    yield 0.25;
    this.setLead(next);
    yield 0.6;
  }

  // 1. Aria: the lead sings a solo; each note bursts in a ring of notes, rotated each time.
  *aria() {
    const s = this.lead; if (!s) { yield 0.3; return; }
    const notes = 3 + this.phase;
    for (let i = 0; i < notes; i++) {
      // telegraph: mouth gathers light
      s.glow = 1;
      this.teleAt = { x: s.x, y: s.y - 44, r: 90, rgb: s.rgb }; this.tele = 0.4;
      yield 0.4;
      if (!s.alive || this.lead !== s) return;
      this.sing(s);
      const m = this.mouthPos(s), n = 9 + this.phase;
      this.fireRing(m.x, m.y, n, 165, { art: 'ch_note', color: s.col, rgb: s.rgb, r: 7, life: 4.5, a0: (i % 2) * Math.PI / n + 0.15 });
      this.fx.ring(m.x, m.y, 8, 60, 0.3, `rgba(${s.rgb},0.8)`, 3);
      yield this.beat;
    }
    yield 0.7;
  }

  // 2. The staff: five horizontal lines across the hall; low notes light low lines (jump them),
  //    high notes light high lines (stay low). Telegraphed as ghost lines, struck on the beat.
  *staffSong() {
    const voices = this.alive();
    const len = 4 + this.phase;
    let prev = -1;
    for (let i = 0; i < len; i++) {
      let s = this.pick(voices);
      let k = Math.min(4, Math.floor(s.i * 5 / 7));
      if (k === prev && voices.length > 1) { s = this.pick(voices); k = Math.min(4, Math.floor(s.i * 5 / 7)); }
      prev = k;
      this.sing(s, 0.8);
      const warn = this.beat * 1.6;
      this.staff.push({ k, warn: warn / this.speedMul, live: 0, dur: 0.28, midi: s.midi, rgb: s.rgb });
      // phase 3 occasionally doubles with an octave line
      if (this.phase >= 3 && k >= 2 && Math.random() < 0.4) this.staff.push({ k: k - 2 >= 1 ? k - 2 : 4, warn: warn / this.speedMul, live: 0, dur: 0.28, midi: s.midi + 12, rgb: s.rgb });
      yield this.beat;
    }
    yield this.beat * 2 + 0.6;
  }

  // 3. Round: voices answer each other left-to-right, each blooming a slow ring from its alcove.
  *round() {
    const vs = this.alive().slice();
    if (Math.random() < 0.5) vs.reverse();
    for (const s of vs) {
      s.glow = 1;
      this.teleAt = { x: s.x, y: s.y - 44, r: 70, rgb: s.rgb }; this.tele = 0.35;
      yield 0.35;
      this.sing(s);
      const m = this.mouthPos(s), n = 8;
      this.fireRing(m.x, m.y, n, 120 + this.phase * 10, { art: 'ch_note', color: s.col, rgb: s.rgb, r: 7, life: 5, a0: Math.PI / 8 + s.i * 0.3 });
      yield Math.max(0.05, this.beat - 0.35);
    }
    yield 1.0;
  }

  // 4. Scale run: a column of light falls from each alcove in turn (up the scale, then back down in phase 2+).
  *scaleRun() {
    let vs = this.alive().slice().sort((a, b) => a.i - b.i);
    if (this.player.cx > this.mx) vs.reverse();
    const seq = this.phase >= 2 ? vs.concat(vs.slice(0, -1).reverse()) : vs;
    const lead = this.lead;
    for (const s of seq) {
      const top = s.y + 46, bot = this.G;
      this.beams.push({ x1: s.x, y1: top, x2: s.x, y2: bot, w: 50, warn: 0.6 / this.speedMul, live: 0, dur: 0.3, rgb: s.rgb });
      this.sing(s, 0.9);
      if (lead && lead.alive && this.phase >= 2 && s === seq[Math.floor(seq.length / 2)]) {
        const m = this.mouthPos(lead);
        this.fireAt(m.x, m.y, 220, { art: 'ch_note', color: lead.col, rgb: lead.rgb, r: 7, life: 4 });
      }
      yield this.beat * 0.6;
    }
    yield 1.0;
  }

  // 5. Chord (phase 2+): three voices aim long beams at Bead together; move once the lines lock.
  *chord() {
    const vs = this.alive().sort(() => Math.random() - 0.5).slice(0, Math.min(3, this.alive().length));
    for (const s of vs) s.glow = 1;
    const p = this.player;
    const tx = p.cx, ty = p.cy;
    for (const s of vs) {
      const m = this.mouthPos(s);
      const a = Math.atan2(ty - m.y, tx - m.x);
      const L = 1600;
      this.beams.push({ x1: m.x, y1: m.y, x2: m.x + Math.cos(a) * L, y2: m.y + Math.sin(a) * L, w: 26, warn: 0.75 / this.speedMul, live: 0, dur: 0.4, rgb: s.rgb, aim: true });
      this.sing(s, 1);
    }
    this.sfx('warn');
    yield 1.3;
    if (this.phase >= 3) {
      // a second chord, answering
      const vs2 = this.alive().filter((s) => !vs.includes(s)).slice(0, 3);
      for (const s of vs2) {
        const m = this.mouthPos(s);
        const a = Math.atan2(this.player.cy - m.y, this.player.cx - m.x);
        this.beams.push({ x1: m.x, y1: m.y, x2: m.x + Math.cos(a) * 1600, y2: m.y + Math.sin(a) * 1600, w: 26, warn: 0.7 / this.speedMul, live: 0, dur: 0.4, rgb: s.rgb, aim: true });
        this.sing(s, 1);
      }
      if (vs2.length) yield 1.2;
    }
    yield 0.4;
  }

  // 6. Harmony (phase 3): the staff melody and the lead's aria at once.
  *harmony() {
    yield* this.parallel(this.staffSong(), this.aria());
  }

  *parallel(...gens) {
    const waits = gens.map(() => 0);
    const live = gens.slice();
    while (live.some(Boolean)) {
      for (let i = 0; i < live.length; i++) {
        const g = live[i]; if (!g) continue;
        if (waits[i] > 0) { waits[i] -= this.dt; continue; }
        const r = g.next();
        if (r.done) live[i] = null;
        else if (typeof r.value === 'number') waits[i] = r.value / this.speedMul;
      }
      yield;
    }
  }

  // ---------- drawing ----------
  drawBack(ctx, t) {
    const A = this.arena, G = this.G, mx = this.mx, ay = this.alcY;
    ctx.lineJoin = 'round';
    // organ facade / gallery wall
    const fx0 = A.x + A.w * 0.05, fw = A.w * 0.9;
    ctx.fillStyle = '#241a12';
    ctx.fillRect(fx0, ay - 120, fw, 180);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(fx0, ay - 120, fw, 180);
    // cornice + rail
    for (const [yy, hh] of [[ay - 128, 12], [ay + 56, 10]]) {
      ctx.fillStyle = '#6b4c2c'; ctx.fillRect(fx0 - 10, yy, fw + 20, hh);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(fx0 - 10, yy, fw + 20, hh);
      ctx.fillStyle = 'rgba(255,230,170,0.15)'; ctx.fillRect(fx0 - 8, yy + 2, fw + 16, 3);
    }
    // pillars between alcoves
    for (let i = 0; i < 6; i++) {
      const x = (this.singers[i].x + this.singers[i + 1].x) / 2;
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 9, ay - 116, 18, 172);
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(x - 9, ay - 116, 18, 172);
      ctx.strokeStyle = 'rgba(232,194,122,0.25)'; ctx.beginPath(); ctx.moveTo(x - 3, ay - 110); ctx.lineTo(x - 3, ay + 50); ctx.stroke();
      // a little tomato pincushion bristling with pins
      for (let k = -1; k <= 1; k++) { const a = -Math.PI / 2 + k * 0.6 + (i % 2) * 0.2; ctx.strokeStyle = '#cfd0d8'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, ay - 60); ctx.lineTo(x + Math.cos(a) * 19, ay - 60 + Math.sin(a) * 19); ctx.stroke(); ctx.fillStyle = CHOIR_COLORS[(i + k + 7) % 7][0]; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 19, ay - 60 + Math.sin(a) * 19, 2.6, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#8a3036'; ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.ellipse(x, ay - 58, 13, 10, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(30,8,10,0.55)'; ctx.lineWidth = 1.2; for (const k of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(x, ay - 68); ctx.quadraticCurveTo(x + k * 1.6, ay - 58, x, ay - 48); ctx.stroke(); }
      ctx.fillStyle = '#5a7a3a'; ctx.beginPath(); ctx.ellipse(x, ay - 68, 5, 2, 0, 0, TAU); ctx.fill();
    }
    // pipes in the center, breathing with the song
    const loud = this.singers.reduce((a, s) => a + s.mouth, 0) / 7;
    for (let i = -7; i <= 7; i++) {
      if (Math.abs(i) < 2) continue;
      const x = mx + i * 26, hgt = 110 + Math.abs(i) * 10;
      // organ pipes: great needles standing point-down, singing through their eyes
      const top = ay - 128 - hgt;
      ctx.fillStyle = i % 2 ? '#8e8c98' : '#a4a2ae';
      ctx.beginPath(); ctx.moveTo(x - 8, ay - 128); ctx.lineTo(x - 8, top + 10); ctx.quadraticCurveTo(x - 8, top, x, top); ctx.quadraticCurveTo(x + 8, top, x + 8, top + 10); ctx.lineTo(x + 8, ay - 128); ctx.closePath();
      ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x - 5, top + 8, 2.5, hgt - 10);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 3, top + 8, 4, hgt - 10);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, top + 18, 3, 9, 0, 0, TAU); ctx.fill();
      if (loud > 0.02) glow(ctx, x, top + 18, 16, '255,220,150', loud * 0.8);
    }
    // metronome (rhythm made visible)
    {
      const px = mx, py = Math.max(A.y + 20, ay - 300);
      const baseY = ay - 134;
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath(); ctx.moveTo(px - 34, baseY); ctx.lineTo(px - 18, Math.max(A.y + 8, py - 10)); ctx.lineTo(px + 18, Math.max(A.y + 8, py - 10)); ctx.lineTo(px + 34, baseY); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
      const ang = this.metro * 0.55;
      const L = (baseY - Math.max(A.y + 8, py)) * 0.85;
      ctx.save(); ctx.translate(px, baseY - 8); ctx.rotate(ang);
      ctx.strokeStyle = '#e8c27a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -L); ctx.stroke();
      ctx.fillStyle = '#e8c27a'; ctx.beginPath(); ctx.rect(-8, -L * 0.7, 16, 12); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
    // alcoves
    for (const s of this.singers) {
      const x = s.x, y = ay;
      ctx.fillStyle = '#120d0a';
      ctx.beginPath(); ctx.moveTo(x - 46, y + 52); ctx.lineTo(x - 46, y - 44); ctx.arc(x, y - 44, 46, Math.PI, 0); ctx.lineTo(x + 46, y + 52); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#8a6232'; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      if (s.alive) glow(ctx, x, y - 10, 70, s.rgb, 0.12 + s.glow * 0.35);
      // pedestal and piston
      ctx.fillStyle = '#5a3d22'; ctx.fillRect(x - 30, y + 44, 60, 12); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(x - 30, y + 44, 60, 12);
      // pitch plaque: a button in this voice's colour
      ctx.fillStyle = s.alive ? s.col : '#3a3330'; ctx.beginPath(); ctx.arc(x, y - 104, 7, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = INK; for (const dx of [-2, 2]) { ctx.beginPath(); ctx.arc(x + dx, y - 104, 1.2, 0, TAU); ctx.fill(); }
    }
  }

  drawBody(ctx, t, white) {
    if (white) { if (this.lead) this.drawSinger(ctx, this.lead, t, true); return; }
    // lift rods first (behind the singers)
    for (const s of this.singers) {
      if (s.ext < 0.02) continue;
      const top = this.alcY + 50, bot = s.y + 44;
      ctx.fillStyle = '#8e8c98';
      ctx.fillRect(s.x - 6, top, 12, bot - top);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(s.x - 6, top, 12, bot - top);
      // a steel rod wound with thread in this voice's colour
      ctx.save(); ctx.beginPath(); ctx.rect(s.x - 6, top, 12, bot - top); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(s.x - 4, top, 2.5, bot - top);
      ctx.strokeStyle = s.alive ? s.col : '#5a4a44'; ctx.lineWidth = 2;
      for (let y = top + 6; y < bot + 6; y += 7) { ctx.beginPath(); ctx.moveTo(s.x - 7, y); ctx.lineTo(s.x + 7, y - 5); ctx.stroke(); }
      ctx.restore();
    }
    for (const s of this.singers) this.drawSinger(ctx, s, t, false);
  }

  drawExtra(ctx, t) {
    const A = this.arena;
    // staff lines
    for (const st of this.staff) {
      const y = this.staffY(st.k);
      if (st.warn > 0) {
        const k = 1 - Math.min(1, st.warn / 0.6);
        ctx.strokeStyle = `rgba(${st.rgb},${0.15 + 0.45 * k})`; ctx.lineWidth = 2;
        ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 60;
        ctx.beginPath(); ctx.moveTo(A.x, y); ctx.lineTo(A.x + A.w, y); ctx.stroke();
        ctx.setLineDash([]);
        // note heads on the line
        for (let x = A.x + 60; x < A.x + A.w; x += 240) { ctx.fillStyle = `rgba(${st.rgb},${0.3 + 0.5 * k})`; ctx.beginPath(); ctx.ellipse(x + (t * 40) % 240, y, 7, 5, -0.4, 0, TAU); ctx.fill(); }
      } else if (st.live > 0) {
        const a = Math.min(1, st.live / 0.1);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(${st.rgb},${0.45 * a})`; ctx.fillRect(A.x, y - 14, A.w, 28);
        ctx.fillStyle = `rgba(255,250,235,${0.9 * a})`; ctx.fillRect(A.x, y - 4, A.w, 8);
        ctx.restore();
      }
    }
    // beams
    for (const b of this.beams) {
      if (b.warn > 0) {
        const k = 1 - Math.min(1, b.warn / 0.6);
        ctx.strokeStyle = `rgba(${b.rgb},${0.2 + 0.6 * k})`; ctx.lineWidth = b.aim ? 1.5 + k * 2 : 2;
        if (!b.aim) { ctx.setLineDash([6, 6]); ctx.lineDashOffset = t * 80; }
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.setLineDash([]);
        if (!b.aim) { ctx.fillStyle = `rgba(${b.rgb},${0.15 * k})`; ctx.fillRect(b.x1 - b.w / 2, b.y1, b.w, b.y2 - b.y1); }
      } else {
        const a = Math.min(1, b.live / 0.1);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(${b.rgb},${0.5 * a})`; ctx.lineWidth = b.w * 1.4;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.strokeStyle = `rgba(255,250,235,${0.9 * a})`; ctx.lineWidth = b.w * 0.45; ctx.stroke();
        ctx.restore();
      }
    }
    // floating note glyphs
    for (const g of this.glyphs) {
      const a = Math.min(1, g.life / g.max * 1.5);
      ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.rot); ctx.globalAlpha = a;
      ctx.fillStyle = g.col; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 6, 4.5, -0.4, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5, -1); ctx.lineTo(5, -18); ctx.stroke();
      if (g.kind === 2) { ctx.beginPath(); ctx.ellipse(17, -4, 6, 4.5, -0.4, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(22, -5); ctx.lineTo(22, -22); ctx.lineTo(5, -18); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(5, -18); ctx.quadraticCurveTo(13, -12, 11, -5); ctx.stroke(); }
      ctx.restore();
    }
  }

  drawSinger(ctx, s, t, white) {
    const C = (c) => (white ? '#fff' : c), K = white ? '#fff' : INK;
    const isLead = s === this.lead && s.alive;
    const sway = s.alive ? Math.sin(t * 2 + s.sway) * 0.05 : 0.18;
    const x = s.x, y = s.y + (s.alive ? Math.sin(t * 3 + s.sway) * 1.5 : 6);
    const col = s.alive ? s.col : '#5a4a44';
    ctx.save(); ctx.translate(x, y + 44); ctx.rotate(sway); ctx.scale(1.3, 1.3); ctx.translate(0, -44);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (isLead && !white) glow(ctx, 0, -6, 70, s.rgb, 0.25 + 0.15 * Math.sin(t * 5));
    // felt choir robe, a bell that flares to a blanket-stitched hem
    const robe = () => {
      ctx.beginPath();
      ctx.moveTo(-11, -8);
      ctx.quadraticCurveTo(-17, 18, -26, 40);
      ctx.quadraticCurveTo(-13, 45, 0, 43); ctx.quadraticCurveTo(13, 45, 26, 40);
      ctx.quadraticCurveTo(17, 18, 11, -8);
      ctx.closePath();
    };
    robe(); ctx.fillStyle = C(s.alive ? '#4a3346' : '#33292e'); ctx.fill();
    if (!white) {
      ctx.save(); robe(); ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.moveTo(8, -8); ctx.quadraticCurveTo(14, 20, 20, 46); ctx.lineTo(30, 46); ctx.lineTo(16, -8); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,240,0.08)'; ctx.fillRect(-20, -8, 9, 54);
      // the stole in this voice's colour, hanging down the front
      ctx.fillStyle = col;
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 3, -8); ctx.lineTo(sd * 9, -8); ctx.lineTo(sd * 13, 42); ctx.lineTo(sd * 5, 42); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = 'rgba(20,10,20,0.5)'; ctx.lineWidth = 1;
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 3, -8); ctx.lineTo(sd * 5, 42); ctx.moveTo(sd * 9, -8); ctx.lineTo(sd * 13, 42); ctx.stroke(); }
      // felt fuzz: light hatching
      ctx.strokeStyle = 'rgba(20,10,20,0.35)';
      for (let i = 0; i < 6; i++) { const yy = 6 + i * 6; ctx.beginPath(); ctx.moveTo(14 + i * 1.1, yy); ctx.lineTo(18 + i * 1.1, yy - 4); ctx.stroke(); }
      ctx.restore();
    }
    robe(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
    if (!white) {
      // blanket stitch along the hem
      ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const k = i / 10, hx = -23 + k * 46, hy = 38.5 + Math.sin(k * Math.PI) * 3.5;
        ctx.moveTo(hx, hy); ctx.lineTo(hx, hy - 4); if (i < 10) ctx.lineTo(hx + 4.6, hy - 4 + (Math.sin((k + 0.1) * Math.PI) - Math.sin(k * Math.PI)) * 3.5);
      }
      ctx.stroke();
      // a pin holding the stole
      ctx.strokeStyle = '#cfd0d8'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-9, 24); ctx.lineTo(3, 20); ctx.stroke();
      ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.arc(-9.5, 24.2, 1.8, 0, TAU); ctx.fill();
    }
    // tuning-fork staff in the right hand (it hums when they sing)
    {
      const hum = s.alive ? s.mouth * Math.sin(t * 60) * 1.2 : 0;
      ctx.strokeStyle = K; ctx.lineWidth = 4.4;
      ctx.beginPath(); ctx.moveTo(19, 40); ctx.lineTo(19, -16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(19, -16); ctx.quadraticCurveTo(14 - hum, -20, 15 - hum, -38); ctx.moveTo(19, -16); ctx.quadraticCurveTo(24 + hum, -20, 23 + hum, -38); ctx.stroke();
      ctx.strokeStyle = C(s.alive ? '#d8b45c' : '#7a6a4a'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(19, 40); ctx.lineTo(19, -16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(19, -16); ctx.quadraticCurveTo(14 - hum, -20, 15 - hum, -38); ctx.moveTo(19, -16); ctx.quadraticCurveTo(24 + hum, -20, 23 + hum, -38); ctx.stroke();
      if (!white && s.mouth > 0.2) {
        ctx.strokeStyle = `rgba(${s.rgb},${0.7 * s.mouth})`; ctx.lineWidth = 1.2;
        for (const r of [6, 10]) { ctx.beginPath(); ctx.arc(19, -32, r, -0.7, 0.7); ctx.stroke(); ctx.beginPath(); ctx.arc(19, -32, r, Math.PI - 0.7, Math.PI + 0.7); ctx.stroke(); }
      }
    }
    // tin arms holding sheet music made of stitched cloth
    ctx.strokeStyle = K; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-9, -4); ctx.quadraticCurveTo(-15, 6, -9, 10); ctx.moveTo(9, -4); ctx.quadraticCurveTo(16, 4, 18, 8); ctx.stroke();
    ctx.strokeStyle = C('#b8b6c0'); ctx.lineWidth = 2.6; ctx.stroke();
    const droop = s.alive ? 0 : 4;
    ctx.fillStyle = C('#ece2cc'); ctx.strokeStyle = K; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-11, 2); ctx.lineTo(11, 1); ctx.lineTo(11 - droop * 0.4, 17 + droop); ctx.lineTo(7, 16 + droop); ctx.lineTo(4, 18 + droop); ctx.lineTo(0, 16.5 + droop); ctx.lineTo(-4, 18 + droop); ctx.lineTo(-8, 16 + droop); ctx.lineTo(-11, 17 + droop * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (!white) {
      ctx.strokeStyle = 'rgba(70,40,40,0.75)'; ctx.lineWidth = 0.9; ctx.setLineDash([1.6, 1.4]);
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-9, 5 + k * 2.6); ctx.lineTo(9, 4.6 + k * 2.6); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.fillStyle = s.alive ? col : '#6a5a4a';
      ctx.beginPath(); ctx.ellipse(-3, 11, 1.8, 1.3, -0.4, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(4, 8.5, 1.8, 1.3, -0.4, 0, TAU); ctx.fill();
      ctx.strokeStyle = s.alive ? col : '#6a5a4a'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-1.4, 11); ctx.lineTo(-1.4, 5); ctx.lineTo(5.6, 3.6); ctx.lineTo(5.6, 8.5); ctx.stroke();
      // tin hands
      ctx.fillStyle = '#b8b6c0'; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
      for (const [hx, hy] of [[-10, 9], [18, 8]]) { ctx.beginPath(); ctx.arc(hx, hy, 2.8, 0, TAU); ctx.fill(); ctx.stroke(); }
    }
    // head: a tin thimble, dimpled at the crown, face pressed into the side
    const hy = -24;
    const thimble = () => {
      ctx.beginPath();
      ctx.moveTo(-15, hy + 15);
      ctx.lineTo(-13, hy - 10);
      ctx.quadraticCurveTo(-13, hy - 21, 0, hy - 21);
      ctx.quadraticCurveTo(13, hy - 21, 13, hy - 10);
      ctx.lineTo(15, hy + 15);
      ctx.quadraticCurveTo(0, hy + 18, -15, hy + 15);
      ctx.closePath();
    };
    thimble(); ctx.fillStyle = C(s.alive ? '#bab8c4' : '#7e7a80'); ctx.fill();
    if (!white) {
      ctx.save(); thimble(); ctx.clip();
      // dimples in rows round the crown
      ctx.fillStyle = 'rgba(40,36,56,0.45)';
      for (let row = 0; row < 3; row++) for (let k = -4; k <= 4; k++) {
        const dx = k * 3.2 + (row % 2) * 1.6, dy = hy - 17 + row * 3.4;
        if (Math.abs(dx) > 12 - (2 - row) * 1.5) continue;
        ctx.beginPath(); ctx.arc(dx, dy, 0.95, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = 'rgba(30,26,40,0.35)'; ctx.fillRect(6, hy - 22, 12, 40);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-10, hy - 14, 2.6, 24);
      ctx.restore();
    }
    thimble(); ctx.strokeStyle = K; ctx.lineWidth = 2.5; ctx.stroke();
    // rolled rim
    ctx.fillStyle = C(s.alive ? '#d0ced8' : '#8a8690'); ctx.strokeStyle = K; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-16, hy + 12); ctx.quadraticCurveTo(0, hy + 15, 16, hy + 12); ctx.lineTo(16, hy + 16); ctx.quadraticCurveTo(0, hy + 19.5, -16, hy + 16); ctx.closePath(); ctx.fill(); ctx.stroke();
    this.drawCrest(ctx, s, hy - 20, C, K, t);
    if (!white) {
      ctx.fillStyle = INK;
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 5.5, hy - 4, 3, 4.6, sd * 0.15, 0, TAU); ctx.fill(); }
      if (s.alive) {
        for (const sd of [-1, 1]) eye(ctx, sd * 5.5, hy - 3.5, 1.5 + s.glow * 0.8, s.col, s.glow > 0.2 || isLead);
        // singing mouth
        const mo = 1.4 + s.mouth * 4;
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, hy + 6, 3, mo, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(214,104,120,0.4)'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 9, hy + 3, 2.4, 1.5, 0, 0, TAU); ctx.fill(); }
      } else {
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-3.5, hy + 7); ctx.lineTo(3.5, hy + 7); ctx.stroke();
        // dents and split seams
        ctx.beginPath(); ctx.moveTo(-2, hy - 20); ctx.lineTo(2, hy - 12); ctx.lineTo(-3, hy - 6); ctx.lineTo(2, hy + 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(13.5, hy - 2); ctx.lineTo(8, hy + 2); ctx.lineTo(10, hy + 9); ctx.stroke();
        ctx.fillStyle = 'rgba(30,26,40,0.4)'; ctx.beginPath(); ctx.ellipse(-8, hy - 12, 3.5, 2.2, 0.4, 0, TAU); ctx.fill();
      }
    }
    // the lead wears an embroidery hoop for a halo
    if (isLead) {
      const ry = hy - 40 - (s.i === 2 ? 8 : 0);
      ctx.strokeStyle = K; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(0, ry, 17, 5, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = white ? '#fff' : '#c89a5a'; ctx.lineWidth = 2.6; ctx.stroke();
      if (!white) {
        ctx.strokeStyle = `rgba(${s.rgb},0.9)`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, ry, 14, 3.4, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#d8b45c'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.rect(14, ry - 3, 5, 5); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // each voice wears a different sewing-box topper
  drawCrest(ctx, s, y, C, K, t) {
    const col = C(s.alive ? s.col : '#5a4a44');
    const pin = (x0, y0, x1, y1, r) => {
      ctx.strokeStyle = K; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = C('#cfd0d8'); ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = col; ctx.strokeStyle = K; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(x1, y1, r, 0, TAU); ctx.fill(); ctx.stroke();
    };
    const needle = (x0, y0, x1, y1) => {
      ctx.strokeStyle = K; ctx.lineWidth = 4.6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = C('#dcdae4'); ctx.lineWidth = 2.4; ctx.stroke();
      const a = Math.atan2(y1 - y0, x1 - x0), ex = x1 - Math.cos(a) * 3.5, ey = y1 - Math.sin(a) * 3.5;
      ctx.fillStyle = K; ctx.beginPath(); ctx.ellipse(ex, ey, 2.2, 0.8, a, 0, TAU); ctx.fill();
    };
    switch (s.i) {
      case 0: for (const k of [-1, 0, 1]) pin(k * 3, y + 2, k * 8, y - 10 - (k ? 0 : 4), 3); break; // crown of pins
      case 1: { // a button cap
        ctx.fillStyle = col; ctx.strokeStyle = K; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, y - 3, 11, 5, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = K; for (const dx of [-2.5, 2.5]) { ctx.beginPath(); ctx.arc(dx, y - 3.5, 1.2, 0, TAU); ctx.fill(); }
        break;
      }
      case 2: needle(0, y + 4, 0, y - 22); break; // a needle spire
      case 3: for (let k = -2; k <= 2; k++) pin(0, y + 3, k * 7, y - 13 + Math.abs(k) * 3, 2.6); break; // fan of pins
      case 4: { // a yarn pom-pom
        ctx.fillStyle = col; ctx.strokeStyle = K; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, y - 7, 8, 0, TAU); ctx.fill(); ctx.stroke();
        if (s.alive && K !== '#fff') { ctx.strokeStyle = 'rgba(20,20,40,0.45)'; ctx.lineWidth = 1; for (const a of [-0.6, 0, 0.6]) { ctx.beginPath(); ctx.ellipse(0, y - 7, 7, 3.5, a + 0.8, 0, TAU); ctx.stroke(); } }
        break;
      }
      case 5: // a feather plume
        ctx.fillStyle = col; ctx.strokeStyle = K; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-3, y + 2); ctx.quadraticCurveTo(-4, y - 18, 10 + Math.sin(t * 3) * 3, y - 20); ctx.quadraticCurveTo(4, y - 8, 3, y + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      default: needle(-3, y + 4, -12, y - 14); needle(3, y + 4, 12, y - 14); break; // crossed needles
    }
  }

  draw(ctx, t) {
    drawBossLayers(this, ctx, t);
    this.drawExtra(ctx, t);
  }
}

export default { gearwright: Gearwright, choir: AutomatonChoir };
