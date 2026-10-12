// Bosses of area 'bastion' (Cogwork Bastion): the Gearwright Colossus and the Automaton Choir.
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

function glow(ctx, x, y, r, rgb, a) {
  if (a <= 0 || r <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}

function rivets(ctx, pts, r, white, col = '#e8c27a') {
  ctx.fillStyle = white ? '#fff' : col;
  for (const [x, y] of pts) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  if (!white) { ctx.fillStyle = INK; for (const [x, y] of pts) { ctx.beginPath(); ctx.arc(x + r * 0.35, y + r * 0.35, r * 0.45, 0, TAU); ctx.fill(); } }
}

function gearPath(ctx, x, y, r, teeth, depth, rot) {
  ctx.beginPath();
  const n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = rot + (i / n) * TAU;
    const rr = (i % 4 === 0 || i % 4 === 1) ? r : r - depth;
    i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
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
registerProjectileArt('gw_gear', (ctx, p, t) => {
  const r = p.r;
  ctx.save(); ctx.translate(p.cx, p.cy);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  if (p.rolling) { ctx.beginPath(); ctx.ellipse(0, r + 1, r * 0.9, 3, 0, 0, TAU); ctx.fill(); }
  const rot = p.spin || 0;
  gearPath(ctx, 0, 0, r, 9, r * 0.24, rot);
  ctx.fillStyle = p.o.color || '#b8863b'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = '#6b4a26';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, TAU); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = '#e8c27a'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) { const a = rot + i * TAU / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.15, Math.sin(a) * r * 0.15); ctx.lineTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); ctx.stroke(); }
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, TAU); ctx.fill();
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

// A gear flung in an arc that lands and rolls along the floor.
class RollingGear extends Projectile {
  constructor(game, x, y, vx, vy, opts) {
    super(game, x, y, vx, vy, Object.assign({ art: 'gw_gear', r: 17, life: 7, dmg: 1, pierce: true, color: '#b8863b' }, opts));
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
// GEARWRIGHT COLOSSUS: Engine of the Bastion. An enormous clockwork giant sunk to the waist behind
// the arena. Only its fists, head and chest furnace are in play; the rest looms in the dark.
// =================================================================================================
export class Gearwright extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'gearwright', size: [240, 260], music: 'boss_mid', air: true, glints: 150, introTime: 2.8 });
    if (this.dead) return;
    this.noPhysics = true;
    const A = this.arena;
    this.mx = A.x + A.w / 2;
    this.G = this.groundY = groundAt(game.room, this.mx, ty * TILE);
    this.H = this.G - A.y;
    this.S = clamp(this.H / 540, 0.78, 1.15);
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
  syncRect() { const sy = this.shoulderY(); this.x = this.mx - 120; this.y = sy - 90; this.w = 240; this.h = 260; }
  fistBox(f, inset = 8) {
    const rotd = Math.abs(Math.sin(f.ang)) > 0.7;
    const w = (rotd ? f.h : f.w) - inset * 2, h = ((rotd ? f.w : f.h) * (rotd ? 1 : f.squash)) - inset * 2;
    return { x: f.x - w / 2, y: f.y - h / 2, w, h };
  }

  // ---------- engine hooks ----------
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
    // lock on: knuckles flash
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

  // 3. Gear toss: a shoulder hatch opens and spits gears that bounce once and roll at Bead.
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
      this.game.add(new RollingGear(this.game, h.x, h.y, vx, vy, { floor: this.G, minX: A.x, maxX: A.x + A.w, roll: 200 + 35 * this.phase, r }));
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

  // 5. Furnace heart (phase 2+): the chest opens and fans of white-hot rivets rain out.
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
    const S = this.S, mx = this.mx, sy = this.shoulderY(), G = this.G, A = this.arena;
    const C = (c) => (white ? '#fff' : c);
    const K = white ? '#fff' : INK;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (!white) {
      // far silhouette: smokestacks, flywheels, the mass of shoulders and back
      ctx.fillStyle = '#1a1410';
      for (const s of [-1, 1]) {
        const x = mx + s * 118 * S;
        ctx.fillRect(x - 22 * S, A.y - 40, 44 * S, sy - A.y + 40);
        ctx.fillRect(x - 28 * S, sy - 260 * S, 56 * S, 16 * S);
        // smoke
        for (let i = 0; i < 5; i++) {
          const ph = (t * 0.25 + i * 0.2 + (s > 0 ? 0.1 : 0)) % 1;
          ctx.fillStyle = `rgba(30,24,20,${0.5 * (1 - ph)})`;
          ctx.beginPath(); ctx.arc(x + Math.sin(ph * 6 + i) * 20 * S, A.y + 60 - ph * 80, (16 + ph * 40) * S, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#1a1410';
        // flywheel behind each shoulder
        gearPath(ctx, mx + s * 330 * S, sy - 30 * S, 150 * S, 16, 16 * S, s * t * 0.25);
        ctx.fillStyle = '#1d1712'; ctx.fill();
        ctx.strokeStyle = 'rgba(120,84,44,0.35)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = 'rgba(120,84,44,0.25)'; ctx.lineWidth = 6;
        for (let k = 0; k < 6; k++) { const a = s * t * 0.25 + k * TAU / 6; ctx.beginPath(); ctx.moveTo(mx + s * 330 * S, sy - 30 * S); ctx.lineTo(mx + s * 330 * S + Math.cos(a) * 120 * S, sy - 30 * S + Math.sin(a) * 120 * S); ctx.stroke(); }
      }
      // back mass
      ctx.fillStyle = '#211913';
      ctx.beginPath();
      ctx.moveTo(mx - 400 * S, G + 40);
      ctx.quadraticCurveTo(mx - 420 * S, sy - 40 * S, mx - 250 * S, sy - 110 * S);
      ctx.quadraticCurveTo(mx, sy - 170 * S, mx + 250 * S, sy - 110 * S);
      ctx.quadraticCurveTo(mx + 420 * S, sy - 40 * S, mx + 400 * S, G + 40);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(160,110,60,0.25)'; ctx.lineWidth = 3; ctx.stroke();
      // pit rim glow at the waist
      glow(ctx, mx, G, 360 * S, '255,150,70', 0.12 + 0.04 * Math.sin(t * 2));
    }
    // arms (telescoping pistons from shoulders to fists)
    for (const f of this.fists) {
      const j = this.shoulderJoint(f.side);
      const kx = -Math.sin(f.ang), ky = Math.cos(f.ang);
      const cxp = f.x - kx * f.h * 0.42, cyp = f.y - ky * f.h * 0.42 * f.squash;
      const dx = cxp - j.x, dy = cyp - j.y, L = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      ctx.save(); ctx.translate(j.x, j.y); ctx.rotate(a);
      const segs = [[0, 0.44, 30], [0.38, 0.76, 23], [0.7, 1.0, 17]];
      for (const [a0, a1, th] of segs) {
        const T2 = th * S;
        ctx.fillStyle = C(a0 === 0 ? '#3e2a18' : a0 < 0.5 ? '#4f3720' : '#6b4c2c');
        ctx.beginPath(); ctx.rect(L * a0, -T2, L * (a1 - a0), T2 * 2); ctx.fill();
        ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
        if (!white) { ctx.fillStyle = 'rgba(255,230,170,0.12)'; ctx.fillRect(L * a0 + 3, -T2 + 3, L * (a1 - a0) - 6, T2 * 0.35); }
        // collar
        ctx.fillStyle = C('#3a2a1a'); ctx.beginPath(); ctx.rect(L * a0 - 4, -T2 - 4, 10, T2 * 2 + 8); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 2.5; ctx.stroke();
      }
      ctx.restore();
    }
    // torso
    ctx.fillStyle = C('#3d2b18');
    ctx.beginPath();
    ctx.moveTo(mx - 180 * S, sy - 36 * S);
    ctx.quadraticCurveTo(mx, sy - 70 * S, mx + 180 * S, sy - 36 * S);
    ctx.lineTo(mx + 132 * S, sy + 200 * S);
    ctx.quadraticCurveTo(mx, sy + 236 * S, mx - 132 * S, sy + 200 * S);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = K; ctx.lineWidth = 4; ctx.stroke();
    // waist down into the pit
    ctx.fillStyle = C('#2a1e12');
    ctx.beginPath(); ctx.moveTo(mx - 120 * S, sy + 200 * S); ctx.lineTo(mx - 140 * S, G + 60); ctx.lineTo(mx + 140 * S, G + 60); ctx.lineTo(mx + 120 * S, sy + 200 * S); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (!white) {
      // chest plates, seams and rivets
      ctx.fillStyle = '#4a3520';
      ctx.beginPath(); ctx.moveTo(mx - 150 * S, sy - 26 * S); ctx.quadraticCurveTo(mx, sy - 54 * S, mx + 150 * S, sy - 26 * S); ctx.lineTo(mx + 128 * S, sy + 40 * S); ctx.quadraticCurveTo(mx, sy + 20 * S, mx - 128 * S, sy + 40 * S); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(22,20,28,0.7)'; ctx.lineWidth = 2;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(mx + s * 70 * S, sy + 40 * S); ctx.lineTo(mx + s * 84 * S, sy + 210 * S); ctx.stroke(); }
      const rv = [];
      for (let i = -5; i <= 5; i++) rv.push([mx + i * 26 * S, sy - 34 * S - Math.cos(i / 5 * 1.2) * 12 * S + 12 * S]);
      for (let i = 0; i < 5; i++) for (const s of [-1, 1]) rv.push([mx + s * (122 - i * 5) * S, sy + (60 + i * 30) * S]);
      rivets(ctx, rv, 3 * S, false, '#a8885a');
      // embossed gear emblem on the belly
      gearPath(ctx, mx, sy + 182 * S, 20 * S, 8, 5 * S, t * 0.5);
      ctx.strokeStyle = 'rgba(232,194,122,0.55)'; ctx.lineWidth = 2; ctx.stroke();
      // shoulder hatch (gear chute)
      for (const s of [-1, 1]) {
        const j = this.shoulderJoint(s);
        const hx = j.x - s * 30 * S, hy = j.y - 64 * S;
        const open = s === this.hatchSide ? this.hatch : 0;
        ctx.fillStyle = '#120e0c'; ctx.beginPath(); ctx.arc(hx, hy, 20 * S, 0, TAU); ctx.fill();
        if (open > 0.05) glow(ctx, hx, hy, 40 * S, '255,170,90', 0.6 * open);
        ctx.save(); ctx.translate(hx, hy); ctx.rotate(-s * open * 1.6);
        ctx.fillStyle = '#56402a'; ctx.beginPath(); ctx.arc(s * open * 10 * S, 0, 20 * S, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      }
    }
    // furnace core
    {
      const c = this.corePos(), r = 46 * S;
      ctx.fillStyle = C('#2a1d12'); ctx.beginPath(); ctx.arc(c.x, c.y, r + 10 * S, 0, TAU); ctx.fill();
      ctx.strokeStyle = K; ctx.lineWidth = 4; ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.clip();
      if (!white) {
        const heat = this.coreOpen * (0.8 + 0.2 * Math.sin(t * 14)) + this.coreFlare * 2;
        const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, r);
        g.addColorStop(0, '#fff6d8'); g.addColorStop(0.35, '#ffb35c'); g.addColorStop(1, '#a8361e');
        ctx.fillStyle = g; ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2);
        gearPath(ctx, c.x, c.y, r * 0.6, 8, 6 * S, t * 3); ctx.fillStyle = 'rgba(90,30,10,0.55)'; ctx.fill();
        ctx.globalAlpha = 1;
        void heat;
      } else { ctx.fillStyle = '#fff'; ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2); }
      // shutters
      const o = this.coreOpen * r * 1.05;
      for (const s of [-1, 1]) {
        ctx.fillStyle = C('#56402a');
        ctx.beginPath(); ctx.rect(s > 0 ? c.x + o : c.x - r - o, c.y - r, r, r * 2); ctx.fill();
        ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
        if (!white) rivets(ctx, [[c.x + s * (o + r * 0.5), c.y - r * 0.55], [c.x + s * (o + r * 0.5), c.y + r * 0.55]], 3 * S, false);
      }
      ctx.restore();
      if (!white) {
        const a = this.coreOpen * (0.5 + 0.2 * Math.sin(t * 12)) + this.coreFlare * 1.5;
        glow(ctx, c.x, c.y, r * 3.2, '255,160,80', a * 0.6);
        // furnace seam glow even when closed
        ctx.strokeStyle = `rgba(255,170,90,${0.35 + 0.2 * Math.sin(t * 3)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(c.x, c.y - r); ctx.lineTo(c.x, c.y + r); ctx.stroke();
      }
    }
    // pauldrons
    for (const s of [-1, 1]) {
      const px = mx + s * 182 * S, py = sy - 14 * S;
      ctx.fillStyle = C('#56402a');
      ctx.beginPath(); ctx.ellipse(px, py, 80 * S, 64 * S, s * 0.25, Math.PI * 0.9, Math.PI * 2.1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = K; ctx.lineWidth = 4; ctx.stroke();
      if (!white) {
        ctx.fillStyle = 'rgba(255,230,170,0.1)';
        ctx.beginPath(); ctx.ellipse(px - s * 10 * S, py - 30 * S, 50 * S, 16 * S, s * 0.25, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(22,20,28,0.7)'; ctx.lineWidth = 2;
        for (let k = 1; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(px, py, (80 - k * 20) * S, (64 - k * 18) * S, s * 0.25, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
        const rv = [];
        for (let k = 0; k < 7; k++) { const a = Math.PI * (1.0 + k * 0.14); rv.push([px + Math.cos(a + s * 0.25) * 70 * S, py + Math.sin(a + s * 0.25) * 54 * S]); }
        rivets(ctx, rv, 3.2 * S, false, '#a8885a');
        // exhaust pipe
        ctx.fillStyle = '#3a2a1a'; ctx.fillRect(px + s * 40 * S - 7 * S, py - 86 * S, 14 * S, 40 * S);
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(px + s * 40 * S - 7 * S, py - 86 * S, 14 * S, 40 * S);
      }
    }
    // head
    {
      const h = this.headPos();
      const hr = 46 * S;
      // neck pistons
      ctx.fillStyle = C('#3a2a1a');
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.rect(h.x + s * 22 * S - 7 * S, h.y + 30 * S, 14 * S, sy - h.y - 20 * S); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 2.5; ctx.stroke(); }
      // crest fins
      for (let k = -2; k <= 2; k++) {
        ctx.save(); ctx.translate(h.x, h.y - hr * 0.9); ctx.rotate(k * 0.32 + Math.sin(t * 2 + k) * 0.03);
        ctx.fillStyle = C(k % 2 ? '#6b4c2c' : '#86602f');
        ctx.beginPath(); ctx.moveTo(-7 * S, 0); ctx.lineTo(0, -(46 - Math.abs(k) * 8) * S); ctx.lineTo(7 * S, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = K; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.restore();
      }
      // helmet
      ctx.fillStyle = C('#4a3520');
      ctx.beginPath(); ctx.ellipse(h.x, h.y, hr * 1.12, hr * 1.06, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = K; ctx.lineWidth = 4; ctx.stroke();
      if (!white) rivets(ctx, [[h.x - hr * 0.95, h.y + 6], [h.x + hr * 0.95, h.y + 6], [h.x - hr * 0.7, h.y - hr * 0.7], [h.x + hr * 0.7, h.y - hr * 0.7]], 3 * S, false);
      // pale mask
      const mr = hr * 0.78, my = h.y + 6 * S;
      ctx.fillStyle = C('#ece2cc');
      ctx.beginPath();
      ctx.moveTo(h.x - mr, my - mr * 0.2);
      ctx.quadraticCurveTo(h.x - mr, my - mr * 1.15, h.x, my - mr * 1.15);
      ctx.quadraticCurveTo(h.x + mr, my - mr * 1.15, h.x + mr, my - mr * 0.2);
      ctx.quadraticCurveTo(h.x + mr * 0.85, my + mr * 0.95, h.x, my + mr * 1.1);
      ctx.quadraticCurveTo(h.x - mr * 0.85, my + mr * 0.95, h.x - mr, my - mr * 0.2);
      ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
      if (!white) {
        ctx.fillStyle = INK;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(h.x + s * mr * 0.42, my - mr * 0.25, mr * 0.2, mr * 0.42, s * 0.18, 0, TAU); ctx.fill(); }
        // vent grille mouth
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(h.x + k * 7 * S, my + mr * 0.42); ctx.lineTo(h.x + k * 7 * S, my + mr * 0.78); ctx.stroke(); }
        if (this.phase >= 2) { ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(h.x + mr * 0.15, my - mr * 1.12); ctx.lineTo(h.x + mr * 0.32, my - mr * 0.7); ctx.lineTo(h.x + mr * 0.2, my - mr * 0.45); ctx.lineTo(h.x + mr * 0.34, my - mr * 0.1); ctx.stroke(); }
        if (this.phase >= 3) { ctx.beginPath(); ctx.moveTo(h.x - mr * 0.9, my + mr * 0.1); ctx.lineTo(h.x - mr * 0.55, my + mr * 0.25); ctx.lineTo(h.x - mr * 0.6, my + mr * 0.6); ctx.stroke(); }
        if (this.eyeLit > 0.02) {
          const col = this.phase >= 3 ? '#ff7a4a' : '#ffcf6a';
          const flick = 0.85 + 0.15 * Math.sin(t * 23);
          for (const s of [-1, 1]) {
            ctx.globalAlpha = this.eyeLit * flick;
            eye(ctx, h.x + s * mr * 0.42 + this.look * 2, my - mr * 0.2, 4.5 * S, col, true);
            ctx.globalAlpha = 1;
          }
        }
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

  drawFist(ctx, f, t, white, K) {
    const C = (c) => (white ? '#fff' : c);
    const w = f.w, h = f.h;
    ctx.save();
    ctx.translate(f.x, f.y); ctx.rotate(f.ang); ctx.scale(f.side < 0 ? 1 : -1, f.squash);
    ctx.lineJoin = 'round';
    // cuff
    ctx.fillStyle = C('#3a2a1a');
    ctx.beginPath(); ctx.rect(-w * 0.3, -h * 0.56, w * 0.6, h * 0.24); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
    // back of hand
    ctx.fillStyle = C('#a87a3c');
    ctx.beginPath();
    ctx.moveTo(-w * 0.46, -h * 0.34);
    ctx.quadraticCurveTo(-w * 0.5, -h * 0.4, -w * 0.3, -h * 0.4);
    ctx.lineTo(w * 0.32, -h * 0.4);
    ctx.quadraticCurveTo(w * 0.5, -h * 0.4, w * 0.48, -h * 0.2);
    ctx.lineTo(w * 0.46, h * 0.18);
    ctx.lineTo(-w * 0.48, h * 0.18);
    ctx.closePath(); ctx.fill(); ctx.lineWidth = 4; ctx.stroke();
    // knuckles
    for (let k = 0; k < 4; k++) {
      const kx = -w * 0.36 + k * w * 0.24;
      ctx.fillStyle = C(k % 2 ? '#94693a' : '#b8863b');
      ctx.beginPath(); ctx.ellipse(kx, h * 0.27, w * 0.125, h * 0.22, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
      if (!white) {
        ctx.fillStyle = 'rgba(255,236,190,0.45)'; ctx.beginPath(); ctx.ellipse(kx - w * 0.03, h * 0.2, w * 0.04, h * 0.07, 0, 0, TAU); ctx.fill();
        if (f.glint > 0) glow(ctx, kx, h * 0.38, 26, '255,210,150', Math.min(1, f.glint * 4));
      }
    }
    // thumb
    ctx.fillStyle = C('#94693a');
    ctx.beginPath(); ctx.ellipse(w * 0.46, -h * 0.02, w * 0.12, h * 0.26, -0.25, 0, TAU); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
    if (!white) {
      // plates, rivets, glowing gauge
      ctx.strokeStyle = 'rgba(22,20,28,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-w * 0.42, -h * 0.08); ctx.lineTo(w * 0.4, -h * 0.08); ctx.stroke();
      rivets(ctx, [[-w * 0.38, -h * 0.3], [-w * 0.1, -h * 0.3], [w * 0.18, -h * 0.3], [-w * 0.24, -h * 0.17], [w * 0.04, -h * 0.17], [w * 0.3, -h * 0.17]], 2.8, false);
      const pulse = 0.5 + 0.5 * Math.sin(t * 4 + f.side);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-w * 0.02, -h * 0.47, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = this.phase >= 3 ? '#ff7a4a' : '#ffcf6a'; ctx.beginPath(); ctx.arc(-w * 0.02, -h * 0.47, 3.5 + pulse, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  draw(ctx, t) { drawBossLayers(this, ctx, t); }
}

// =================================================================================================
// THE AUTOMATON CHOIR: Seven Voices, One Song. Seven singing automatons in a gallery of alcoves.
// Only the lead (haloed, lowered on its piston) can be struck. Each 1/7 of health silences a voice.
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
    const A = this.arena;
    this.mx = A.x + A.w / 2;
    this.G = this.groundY = groundAt(game.room, this.mx, ty * TILE);
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
    this.fx.burst(s.x, s.y, 20, { color: '#f0e6d0', speed: 320, size: 3.5, life: 0.7, shape: 'shard' });
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

  onDeath() { this.beams.length = 0; this.staff.length = 0; for (const s of this.singers) { s.mouth = 0; s.extTo = 0; } }

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
      gearPath(ctx, x, ay - 60, 12, 8, 3, (i % 2 ? 1 : -1) * t * 0.6); ctx.fillStyle = '#56402a'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // pipes in the center, breathing with the song
    const loud = this.singers.reduce((a, s) => a + s.mouth, 0) / 7;
    for (let i = -7; i <= 7; i++) {
      if (Math.abs(i) < 2) continue;
      const x = mx + i * 26, hgt = 110 + Math.abs(i) * 10;
      ctx.fillStyle = i % 2 ? '#8a6232' : '#a87a3c';
      ctx.fillRect(x - 10, ay - 128 - hgt, 20, hgt);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(x - 10, ay - 128 - hgt, 20, hgt);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, ay - 128 - hgt * 0.3, 6, 3, 0, 0, TAU); ctx.fill();
      if (loud > 0.02) glow(ctx, x, ay - 128 - hgt * 0.3, 16, '255,220,150', loud * 0.8);
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
      // pitch plaque (colored gem)
      ctx.fillStyle = s.alive ? s.col : '#3a3330'; ctx.beginPath(); ctx.arc(x, y - 104, 7, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    }
  }

  drawBody(ctx, t, white) {
    if (white) { if (this.lead) this.drawSinger(ctx, this.lead, t, true); return; }
    // pistons first (behind the singers)
    for (const s of this.singers) {
      if (s.ext < 0.02) continue;
      const top = this.alcY + 50, bot = s.y + 44;
      ctx.fillStyle = white ? '#fff' : '#6b4a26';
      ctx.fillRect(s.x - 7, top, 14, bot - top);
      ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 2.5; ctx.strokeRect(s.x - 7, top, 14, bot - top);
      if (!white) { ctx.fillStyle = '#3a2a1a'; for (let y = top + 14; y < bot - 6; y += 22) ctx.fillRect(s.x - 9, y, 18, 5); }
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
    ctx.save(); ctx.translate(x, y + 44); ctx.rotate(sway); ctx.scale(1.3, 1.3); ctx.translate(0, -44);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (isLead && !white) glow(ctx, 0, -6, 70, s.rgb, 0.25 + 0.15 * Math.sin(t * 5));
    // wind-up key on the back
    ctx.save(); ctx.translate(0, 4); ctx.scale(Math.cos(s.key), 1);
    ctx.strokeStyle = K; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 0); ctx.stroke();
    ctx.fillStyle = C('#b8863b');
    ctx.beginPath(); ctx.ellipse(-24, 2, 9, 6, 0, 0, TAU); ctx.ellipse(24, 2, 9, 6, 0, 0, TAU); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    // bell skirt body
    ctx.fillStyle = C(s.alive ? '#8a6232' : '#4a3a2c');
    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.quadraticCurveTo(-16, 18, -26, 40);
    ctx.quadraticCurveTo(0, 50, 26, 40);
    ctx.quadraticCurveTo(16, 18, 12, -6);
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
    if (!white) {
      ctx.strokeStyle = s.alive ? s.col : '#5a4a3a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-22, 32); ctx.quadraticCurveTo(0, 40, 22, 32); ctx.stroke();
      rivets(ctx, [[-8, 8], [8, 8], [0, 20]], 2, false);
    }
    // little arms clasped over a hymnal
    ctx.fillStyle = C('#ece2cc'); ctx.strokeStyle = K; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(-9, 4, 18, 12); ctx.fill(); ctx.stroke();
    if (!white) { ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, 16); ctx.stroke(); }
    // head: porcelain mask
    const hy = -24, r = 15;
    ctx.fillStyle = C(s.alive ? '#efe6d2' : '#b8ae9c');
    ctx.beginPath();
    ctx.moveTo(-r, hy);
    ctx.quadraticCurveTo(-r, hy - r * 1.2, 0, hy - r * 1.2);
    ctx.quadraticCurveTo(r, hy - r * 1.2, r, hy);
    ctx.quadraticCurveTo(r * 0.8, hy + r * 1.05, 0, hy + r * 1.1);
    ctx.quadraticCurveTo(-r * 0.8, hy + r * 1.05, -r, hy);
    ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 2.5; ctx.stroke();
    // headdress (each voice is different)
    this.drawCrest(ctx, s, hy - r * 1.15, C, K, t);
    if (!white) {
      ctx.fillStyle = INK;
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 6, hy - 3, 3.2, 5.5, sd * 0.2, 0, TAU); ctx.fill(); }
      if (s.alive) {
        for (const sd of [-1, 1]) eye(ctx, sd * 6, hy - 2, 1.6 + s.glow * 0.8, s.col, s.glow > 0.2 || isLead);
        // singing mouth
        const mo = 1.5 + s.mouth * 5;
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, hy + 9, 3.5, mo, 0, 0, TAU); ctx.fill();
      } else {
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-4, hy + 10); ctx.lineTo(4, hy + 10); ctx.stroke();
        // cracks
        ctx.beginPath(); ctx.moveTo(-2, hy - r * 1.15); ctx.lineTo(2, hy - 8); ctx.lineTo(-3, hy - 1); ctx.lineTo(3, hy + 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r * 0.9, hy - 2); ctx.lineTo(6, hy + 2); ctx.lineTo(8, hy + 9); ctx.stroke();
      }
    }
    // lead halo
    if (isLead) {
      ctx.strokeStyle = white ? '#fff' : `rgba(${s.rgb},0.9)`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(0, hy - r * 1.9, 16, 5, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  drawCrest(ctx, s, y, C, K, t) {
    ctx.fillStyle = C(s.alive ? s.col : '#5a4a3a'); ctx.strokeStyle = K; ctx.lineWidth = 2;
    ctx.beginPath();
    switch (s.i) {
      case 0: ctx.moveTo(-12, y + 4); ctx.lineTo(-8, y - 8); ctx.lineTo(0, y - 2); ctx.lineTo(8, y - 8); ctx.lineTo(12, y + 4); ctx.closePath(); break; // crown
      case 1: ctx.ellipse(0, y - 6, 10, 9, 0, Math.PI, 0); ctx.closePath(); break; // bell cap
      case 2: ctx.moveTo(-6, y + 2); ctx.lineTo(0, y - 22); ctx.lineTo(6, y + 2); ctx.closePath(); break; // spire
      case 3: for (let k = -2; k <= 2; k++) { ctx.moveTo(0, y + 2); ctx.lineTo(k * 7, y - 14 + Math.abs(k) * 3); ctx.lineTo(k * 7 + 3, y - 12 + Math.abs(k) * 3); ctx.closePath(); } break; // fan
      case 4: ctx.arc(0, y - 8, 7, 0, TAU); ctx.moveTo(0, y); ctx.rect(-2, y - 2, 4, 4); break; // orb
      case 5: ctx.moveTo(-3, y + 2); ctx.quadraticCurveTo(-4, y - 18, 10 + Math.sin(t * 3) * 3, y - 20); ctx.quadraticCurveTo(4, y - 8, 3, y + 2); ctx.closePath(); break; // plume
      default: ctx.moveTo(-12, y + 2); ctx.lineTo(-4, y - 12); ctx.lineTo(-2, y); ctx.lineTo(2, y); ctx.lineTo(4, y - 12); ctx.lineTo(12, y + 2); ctx.closePath(); break; // horns
    }
    ctx.fill(); ctx.stroke();
  }

  draw(ctx, t) {
    drawBossLayers(this, ctx, t);
    this.drawExtra(ctx, t);
  }
}

export default { gearwright: Gearwright, choir: AutomatonChoir };
