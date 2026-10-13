// Bosses of the Hall of Echoes: The First Bead — Before the Strand. The secret final boss (Ending C).
import { Boss } from './boss.js';
import { TAU, clamp, sign } from '../core/math.js';
import { VIEW_W, VIEW_H } from '../core/constants.js';
import { INK, eye } from '../art/creatures.js';
import { Entity } from '../entities/base.js';
import { Projectile, registerProjectileArt } from '../entities/projectile.js';
import { moveX } from '../world/movement.js';

function glow(ctx, x, y, r, rgb, a = 0.5) {
  if (r <= 0 || a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };

// the six Great Beads it remembers, as satellites
const SAT_COLS = ['#ff9a4a', '#ffb0e0', '#e0b060', '#9a8fff', '#b6e04a', '#9ff2ff'];

// ---------------------------------------------------------------- projectile art
registerProjectileArt('fb_bead', (ctx, p) => {
  const c = p.o.color || '#fff4d2', r = p.r;
  for (let i = 0; i < p.trail.length; i++) {
    const q = p.trail[i];
    ctx.globalAlpha = (i / p.trail.length) * 0.45; ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(q.x, q.y, r * (i / p.trail.length), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  glow(ctx, p.cx, p.cy, r * 3.2, hexRgb(c), 0.45);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(p.cx, p.cy, r + 2.5, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(p.cx - r * 0.35, p.cy - r * 0.35, 1, p.cx, p.cy, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, c);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.cx, p.cy, r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(22,20,28,0.7)'; ctx.beginPath(); ctx.arc(p.cx + r * 0.15, p.cy + r * 0.1, r * 0.22, 0, TAU); ctx.fill();
});
registerProjectileArt('fb_light', (ctx, p, t) => {
  const r = p.r;
  glow(ctx, p.cx, p.cy, r * 3, '255,236,190', 0.5);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(p.cx, p.cy, r + 2, 0, TAU); ctx.fill();
  ctx.fillStyle = p.o.color || '#fff4d2'; ctx.beginPath(); ctx.arc(p.cx, p.cy, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.cx - r * 0.25, p.cy - r * 0.25, r * 0.4, 0, TAU); ctx.fill();
});
registerProjectileArt('fb_shard', (ctx, p) => {
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.age * 7);
  glow(ctx, 0, 0, p.r * 3, '255,190,240', 0.4);
  ctx.beginPath(); ctx.moveTo(0, -p.r * 1.4); ctx.lineTo(p.r * 0.6, 0); ctx.lineTo(0, p.r * 1.4); ctx.lineTo(-p.r * 0.6, 0); ctx.closePath();
  ctx.fillStyle = '#ffd0f2'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
});
registerProjectileArt('fb_pillar', (ctx, p, t) => {
  const r = p.rect(), k = Math.min(1, p.age * 10), fade = Math.min(1, p.life * 5);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
  g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(0.5, `rgba(255,248,225,${0.9 * fade})`); g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g;
  ctx.fillRect(r.x - 10, r.y + r.h * (1 - k), r.w + 20, r.h * k);
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(255,250,235,${0.6 * fade})`; ctx.lineWidth = 2;
    const x = r.x + r.w / 2 + Math.sin(t * 30 + i * 2) * r.w * 0.35;
    ctx.beginPath(); ctx.moveTo(x, r.y + r.h); ctx.lineTo(x + Math.sin(i) * 8, r.y + r.h * (1 - k)); ctx.stroke();
  }
  ctx.restore();
});
registerProjectileArt('fb_burst', (ctx, p) => {
  const k = p.age / (p.age + p.life), R = p.o.radius || 150;
  const f = p.o.follow || p;
  ctx.save();
  ctx.strokeStyle = `rgba(184,50,62,${0.9 * (1 - k)})`; ctx.lineWidth = 3;
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU + k * 2, L = R * (0.35 + 0.65 * Math.min(1, k * 4));
    ctx.beginPath(); ctx.moveTo(f.cx, f.cy);
    ctx.quadraticCurveTo(f.cx + Math.cos(a + 0.5) * L * 0.6, f.cy + Math.sin(a + 0.5) * L * 0.6, f.cx + Math.cos(a) * L, f.cy + Math.sin(a) * L);
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(255,240,230,${0.8 * (1 - k)})`; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(f.cx, f.cy, R * Math.min(1, k * 4), 0, TAU); ctx.stroke();
  ctx.restore();
});

// A front-layer veil: the arena's darkness (phase 3) and all telegraphs that must read through it.
class Veil extends Entity {
  constructor(game, boss) { super(game, 0, 0, 1, 1); this.boss = boss; this.layer = 'front'; this.z = 9; }
  update() { if (this.boss.dead) this.dead = true; }
  draw(ctx, t) { this.boss.drawVeil(ctx, t); }
}

// =====================================================================================
export class FirstBead extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'firstbead', size: [100, 100], air: true, music: 'boss_firstbead', glints: 0, phases: [0.75, 0.5, 0.25], introTime: 3.4 });
    if (this.dead) return;
    this.noPhysics = true;
    this.R = 50;
    this.y = this.hoverY() - this.h / 2;
    this.sats = SAT_COLS.map((c, i) => ({ c, a: (i / 6) * TAU, rad: 84, target: 84, x: this.cx, y: this.cy, gone: false, free: false, flash: 0, grow: 1 }));
    this.orbitSpeed = 1.1; this.tilt = 0.3; this.tiltT = 0.3; this.satHarm = false;
    this.eyes = 0; this.eyesT = 0;
    this.dark = 0; this.darkT = 0;
    this.trail = []; this.afterimages = false;
    this.cometCharge = 0; this.ghostOrbit = null; this.dashLine = null; this.unravel = null; this.well = null;
    this.pillars = []; this.marks = []; this.poundAim = false; this.halo2 = 0; this.lastArt = null;
    this.veil = null;
  }

  hoverY() { return Math.max(this.arena.y + 80, this.groundY - 230); }
  get midX() { return this.arena.x + this.arena.w / 2; }

  onStart() {
    this.veil = this.game.add(new Veil(this.game, this));
    this.fx.text(this.cx, this.cy - 90, 'Little bead. I was round before anything was strung.', '#fff4d2', 14);
  }
  introUpdate(dt, t) {
    this.eyesT = t > 1.6 ? 1 : 0;
    this.eyes += (this.eyesT - this.eyes) * Math.min(1, dt * 4);
    this.updateSats(dt, t > 0.8 ? 1 : 0.4);
    if (t > 1.6 && t < 1.6 + dt * 1.5) { this.fx.ring(this.cx, this.cy, 40, 420, 1.0, 'rgba(255,244,210,0.8)', 6); this.shake(5, 0.6); }
  }
  idle(dt) { this.updateSats(dt, 0.4); }

  attackList() {
    const P = this.phase;
    return [
      { name: 'sling', w: 2, fn: this.sling },
      { name: 'volley', w: 2, fn: this.volley },
      { name: 'dash', w: 2, fn: this.dashes },
      { name: 'rings', w: 2, fn: this.rings },
      { name: 'comet', w: 2, fn: this.comet, cond: () => P >= 2 },
      { name: 'arts', w: 2.5, fn: this.beadArts, cond: () => P >= 2 },
      { name: 'well', w: 2, fn: this.gravityWell, cond: () => P >= 3 },
      { name: 'starfall', w: 2, fn: this.starfall, cond: () => P >= 4 },
    ];
  }

  // ---------------- satellites
  updateSats(dt, speedK = 1) {
    this.tilt += (this.tiltT - this.tilt) * Math.min(1, dt * 3);
    for (const s of this.sats) {
      s.flash -= dt;
      if (s.gone) continue;
      s.grow = Math.min(1, s.grow + dt * 2);
      if (s.free) continue;
      s.a += this.orbitSpeed * dt * speedK;
      s.rad += (s.target - s.rad) * Math.min(1, dt * 6);
      s.x = this.cx + Math.cos(s.a) * s.rad;
      s.y = this.cy + Math.sin(s.a) * s.rad * this.tilt;
    }
  }
  satBox(s) { return { x: s.x - 10, y: s.y - 10, w: 20, h: 20 }; }

  think(dt) {
    this.updateSats(dt);
    this.eyes += (this.eyesT - this.eyes) * Math.min(1, dt * 6);
    this.dark += (this.darkT - this.dark) * Math.min(1, dt * 1.2);
    if (this.afterimages) this.trail.push({ x: this.cx, y: this.cy, life: 0.3 });
    for (const q of this.trail) q.life -= dt;
    this.trail = this.trail.filter((q) => q.life > 0);
    for (const m of this.marks) m.t -= dt;
    this.marks = this.marks.filter((m) => m.t > 0);
    for (const p of this.pillars) {
      p.t -= dt;
      if (p.t <= 0 && !p.fired) {
        p.fired = true;
        this.zone(p.x - 34, this.groundY - 300, 68, 300, 0.4, { art: 'fb_pillar' });
        this.sfx('howl'); this.shake(4, 0.2);
      }
    }
    this.pillars = this.pillars.filter((p) => p.t > -0.5);
    if (Math.random() < 0.35) this.fx.add({ x: this.cx + this.rand(-40, 40), y: this.cy + this.rand(-40, 40), vx: this.rand(-20, 20), vy: -this.rand(20, 60), life: 1.2, size: 2, color: '#fff4d2', g: -10, glow: true, front: false });
    if (this.well && Math.random() < 0.9) {
      const a = Math.random() * TAU, d = this.rand(180, 420);
      this.fx.add({ x: this.cx + Math.cos(a) * d, y: this.cy + Math.sin(a) * d, vx: -Math.cos(a) * d * 1.6, vy: -Math.sin(a) * d * 1.6, life: 0.6, size: 2, color: 'rgba(200,190,255,0.8)', g: 0, shape: 'streak' });
    }
  }

  // ---------------- helpers
  *glide(cx, cy, speed) {
    cx = clamp(cx, this.arena.x + this.w / 2 + 8, this.arena.x + this.arena.w - this.w / 2 - 8);
    cy = clamp(cy, this.arena.y + this.h / 2, this.groundY - this.h / 2);
    yield* this.moveTo(cx - this.w / 2, cy - this.h / 2, speed);
  }
  open() { this.eyesT = 1; }
  calm() { this.eyesT = 0; }
  farSideX(margin = 380) {
    const p = this.player.cx;
    const left = p - margin, right = p + margin;
    const lOK = left > this.arena.x + 80, rOK = right < this.arena.x + this.arena.w - 80;
    if (lOK && rOK) return Math.abs(left - this.cx) < Math.abs(right - this.cx) ? left : right;
    return lOK ? left : right;
  }

  // ================= 1. ORBIT SLING: the satellites swing out in a great wheel
  *sling() {
    yield* this.glide(clamp(this.player.cx + this.rand(-120, 120), this.arena.x + 320, this.arena.x + this.arena.w - 320), this.hoverY(), 520);
    this.open();
    const maxR = this.phase >= 4 ? 350 : 310;
    this.tiltT = 1; this.tele = 0.75;
    this.ghostOrbit = { r: maxR };
    for (const s of this.sats) s.flash = 0.75;
    this.sfx('charge');
    yield 0.75;
    this.ghostOrbit = null;
    this.satHarm = true; this.sfx('howl');
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.orbitSpeed = dir * (this.phase >= 3 ? 1.15 : 0.95);
    const dur = 2.8;
    for (let t = 0; t < dur; t += 1 / 60) {
      const rr = 84 + (maxR - 84) * Math.sin((t / dur) * Math.PI);
      for (const s of this.sats) { s.target = rr; s.rad = rr; }
      yield;
    }
    this.satHarm = false; this.tiltT = 0.3; this.orbitSpeed = 1.1;
    for (const s of this.sats) s.target = 84;
    this.calm();
    yield 0.6;
  }

  // ================= 2. VOLLEY: each remembered bead is hurled at you
  *volley() {
    this.open(); this.tele = 0.55; this.sfx('charge');
    for (const s of this.sats) s.flash = 0.55;
    yield 0.55;
    const order = this.sats.slice().sort(() => Math.random() - 0.5);
    const twin = this.phase >= 3;
    for (const s of order) {
      if (s.gone) continue;
      this.sfx('shard');
      this.fireAt(s.x, s.y, 640, { art: 'fb_bead', r: 10, color: s.c, life: 3 });
      if (twin) { this.fireAt(s.x, s.y, 640, { art: 'fb_bead', r: 8, color: s.c, life: 3, offset: 0.22 }); this.fireAt(s.x, s.y, 640, { art: 'fb_bead', r: 8, color: s.c, life: 3, offset: -0.22 }); }
      s.gone = true;
      this.fx.burst(s.x, s.y, 6, { color: s.c, speed: 160, size: 2.5, life: 0.3, glow: true });
      yield this.phase >= 4 ? 0.14 : 0.2;
    }
    yield 0.5;
    for (const s of this.sats) { s.gone = false; s.grow = 0; s.rad = 0; s.target = 84; }
    this.calm();
    yield 0.5;
  }

  // ================= 3. DASH: Bead's own Pebble Dash, perfected
  *dashes() {
    const n = this.phase >= 4 ? 3 : this.phase >= 2 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const side = this.player.cx < this.midX ? 1 : -1;
      const sx = side > 0 ? this.arena.x + this.arena.w - 70 : this.arena.x + 70;
      const y = clamp(this.player.cy, this.arena.y + 70, this.groundY - 52);
      yield* this.glide(sx, y, 1000);
      this.open();
      this.dashLine = { y: this.cy, dir: -side };
      this.tele = 0.5; this.sfx('charge');
      yield this.phase >= 4 ? 0.42 : 0.5;
      this.dashLine = null;
      this.sfx('dash'); this.afterimages = true;
      const dir = -side;
      for (let f = 0; f < 200; f++) {
        this.x += dir * 1350 * this.speedMul / 60;
        if (this.x < this.arena.x + 8 || this.x + this.w > this.arena.x + this.arena.w - 8) break;
        yield;
      }
      this.x = clamp(this.x, this.arena.x + 8, this.arena.x + this.arena.w - this.w - 8);
      this.afterimages = false;
      this.shake(5, 0.2); this.sfx('bonkWall');
      this.fx.burst(this.cx + dir * this.R, this.cy, 12, { color: '#fff4d2', speed: 260, size: 3, life: 0.4, glow: true });
      if (this.phase >= 3) for (let k = 0; k < 5; k++) { const a = (dir > 0 ? Math.PI : 0) + (k - 2) * 0.3; this.fire(this.cx, this.cy, Math.cos(a) * 300, Math.sin(a) * 300, { art: 'fb_light', r: 7, life: 3.5 }); }
      yield 0.3;
    }
    this.calm();
    yield 0.45;
  }

  // ================= 4. COMET ROLL: the charged super-roll, smashing the walls
  *comet() {
    const startX = this.farSideX(420);
    yield* this.glide(startX, this.groundY - this.R, 800);
    this.open();
    const dir0 = sign(this.player.cx - this.cx) || 1;
    this.sfx('cometCharge');
    for (let t = 0; t < 0.75; t += 1 / 60) { this.cometCharge = t / 0.75; this.tele = 0.2; yield; }
    const passes = this.phase >= 4 ? 2 : 1;
    let dir = dir0;
    for (let p = 0; p < passes; p++) {
      this.sfx('comet'); this.afterimages = true; this.cometCharge = 1;
      for (let f = 0; f < 200; f++) {
        this.x += dir * 1150 * this.speedMul / 60;
        if (this.x < this.arena.x + 4 || this.x + this.w > this.arena.x + this.arena.w - 4) break;
        if (Math.random() < 0.7) this.fx.add({ x: this.cx - dir * this.R, y: this.groundY - this.rand(4, 60), vx: -dir * this.rand(60, 200), vy: -this.rand(20, 120), life: 0.5, size: 3, color: '#ffd0f2', g: 300, glow: true });
        yield;
      }
      this.x = clamp(this.x, this.arena.x + 4, this.arena.x + this.arena.w - this.w - 4);
      this.afterimages = false;
      this.sfx('crystalBreak'); this.shake(12, 0.4);
      const wx = dir > 0 ? this.arena.x + this.arena.w : this.arena.x;
      this.fx.burst(wx, this.cy, 24, { color: '#ffd0f2', speed: 420, size: 4, life: 0.8, shape: 'shard' });
      for (let k = 0; k < 6; k++) this.fire(this.cx - dir * 20, this.cy - 20, -dir * (120 + k * 85), -this.rand(560, 760), { gravity: 1400, art: 'fb_shard', r: 9, life: 3 });
      dir = -dir;
      if (p < passes - 1) { this.cometCharge = 0.5; this.tele = 0.4; yield 0.4; }
    }
    this.cometCharge = 0;
    yield 0.35;
    yield* this.glide(this.cx, this.hoverY(), 500);
    this.calm();
    yield 0.3;
  }

  // ================= 5. RINGS: the old light, poured out in circles and spirals
  *rings() {
    yield* this.glide(clamp(this.player.cx + this.rand(-200, 200), this.arena.x + 200, this.arena.x + this.arena.w - 200), this.hoverY(), 520);
    this.open(); this.tele = 0.55; this.sfx('charge');
    yield 0.55;
    if (this.phase <= 2) {
      const n = this.phase >= 2 ? 16 : 14, waves = this.phase >= 2 ? 4 : 3;
      const base = Math.random() * TAU;
      for (let k = 0; k < waves; k++) {
        this.sfx('bell');
        this.fireRing(this.cx, this.cy, n, 210, { a0: base + k * (Math.PI / n), art: 'fb_light', r: 7, life: 6 });
        this.fx.ring(this.cx, this.cy, 20, 90, 0.3, 'rgba(255,244,210,0.8)', 4);
        yield 0.6;
      }
    } else {
      const arms = 3, dur = this.phase >= 4 ? 2.6 : 2.2, step = this.phase >= 4 ? 0.14 : 0.12;
      let a = Math.random() * TAU, b = a;
      for (let t = 0; t < dur; t += step) {
        for (let j = 0; j < arms; j++) {
          const an = a + (j / arms) * TAU;
          this.fire(this.cx, this.cy, Math.cos(an) * 160, Math.sin(an) * 160, { art: 'fb_light', r: 7, life: 6 });
        }
        if (this.phase >= 4) for (let j = 0; j < 2; j++) { const an = b + (j / 2) * TAU; this.fire(this.cx, this.cy, Math.cos(an) * 130, Math.sin(an) * 130, { art: 'fb_light', r: 6, life: 7, color: '#ffd0f2' }); }
        a += 0.26; b -= 0.21;
        if (Math.round(t / step) % 4 === 0) this.sfx('blip');
        yield step;
      }
    }
    this.calm();
    yield 0.7;
  }

  // ================= 6. BEAD'S OWN ARTS: Lead Heart, Shard Toss, Unravel, Ink Howl
  *beadArts() {
    const pool = ['pound', 'shard', 'unravel'];
    if (this.phase >= 3) pool.push('howl');
    const opts = pool.filter((k) => k !== this.lastArt);
    const k = this.pick(opts);
    this.lastArt = k;
    if (k === 'pound') yield* this.artPound();
    else if (k === 'shard') yield* this.artShard();
    else if (k === 'unravel') yield* this.artUnravel();
    else yield* this.artHowl();
  }

  *artPound() {
    const n = this.phase >= 4 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      yield* this.glide(this.player.cx, Math.max(this.arena.y + 60, this.groundY - 340), 1000);
      for (let t = 0; t < 0.25; t += 1 / 60) { this.x += clamp(this.player.cx - this.cx, -6, 6); this.x = clamp(this.x, this.arena.x + 8, this.arena.x + this.arena.w - this.w - 8); yield; }
      this.open(); this.poundAim = true; this.tele = 0.45; this.sfx('poundStart');
      yield 0.45;
      this.poundAim = false; this.afterimages = true;
      while (this.y + this.h < this.groundY) { this.y = Math.min(this.groundY - this.h, this.y + 1350 * this.speedMul / 60); yield; }
      this.afterimages = false;
      this.sfx('pound'); this.shake(12, 0.4);
      this.shockwave(this.cx - 30, -1, 460, 32, { color: 'rgba(255,244,210,0.95)' });
      this.shockwave(this.cx + 30, 1, 460, 32, { color: 'rgba(255,244,210,0.95)' });
      this.fx.burst(this.cx, this.groundY, 20, { color: '#fff4d2', speed: 360, angle: -Math.PI / 2, spread: 2.6, size: 3, life: 0.6 });
      yield 0.4;
    }
    yield* this.glide(this.cx, this.hoverY(), 600);
    this.calm();
    yield 0.35;
  }

  *artShard() {
    yield* this.glide(this.farSideX(400), this.groundY - 170, 800);
    this.open(); this.tele = 0.45; this.sfx('charge');
    this.facing = this.player.cx < this.cx ? -1 : 1;
    yield 0.45;
    const n = this.phase >= 4 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      this.facing = this.player.cx < this.cx ? -1 : 1;
      this.sfx('shard');
      this.fireAt(this.cx + this.facing * 50, this.cy, 780, { art: 'shard', r: 10, life: 2.2 });
      if (this.phase >= 3) { this.fireAt(this.cx + this.facing * 50, this.cy, 780, { art: 'shard', r: 8, life: 2.2, offset: 0.25 }); this.fireAt(this.cx + this.facing * 50, this.cy, 780, { art: 'shard', r: 8, life: 2.2, offset: -0.25 }); }
      yield 0.32;
    }
    this.calm();
    yield 0.5;
  }

  *artUnravel() {
    const tx = this.player.cx + (this.player.cx < this.cx ? 90 : -90);
    yield* this.glide(tx, this.groundY - 140, 760);
    this.open(); this.sfx('rustle');
    const R = 165;
    this.unravel = { r: R, k: 0 };
    for (let t = 0; t < 0.75; t += 1 / 60) { this.unravel.k = t / 0.75; this.tele = 0.2; yield; }
    this.unravel = null;
    this.sfx('unravel'); this.shake(8, 0.3);
    this.zone(this.cx - R * 0.85, this.cy - R * 0.85, R * 1.7, R * 1.7, 0.3, { art: 'fb_burst', radius: R, follow: null });
    if (this.phase >= 3) for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; this.fire(this.cx, this.cy, Math.cos(a) * 340, Math.sin(a) * 340, { art: 'needle', r: 7, color: '#e8b0b6', life: 2.5 }); }
    yield 0.6;
    yield* this.glide(this.cx, this.hoverY(), 500);
    this.calm();
    yield 0.3;
  }

  *artHowl() {
    yield* this.glide(this.cx, this.hoverY() - 40, 500);
    this.open(); this.tele = 0.4; this.sfx('charge');
    yield 0.4;
    const n = this.phase >= 4 ? 5 : 4;
    for (let i = 0; i < n; i++) {
      this.pillars.push({ x: clamp(this.player.cx, this.arena.x + 40, this.arena.x + this.arena.w - 40), t: 0.6, max: 0.6, fired: false });
      this.sfx('warn');
      yield 0.38;
    }
    yield 0.7;
    this.calm();
    yield 0.3;
  }

  // ================= 7. GRAVITY WELL: everything falls back toward the first bead
  *gravityWell() {
    yield* this.glide(this.midX, this.groundY - 210, 520);
    this.open(); this.tele = 0.65; this.sfx('charge');
    this.tiltT = 1;
    for (const s of this.sats) { s.target = 112; s.flash = 0.65; }
    this.well = { k: 0 };
    yield 0.65;
    this.satHarm = true; this.sfx('howl');
    this.orbitSpeed = 2.2;
    const dur = 2.8;
    let ringT = 0.2;
    for (let t = 0; t < dur; t += 1 / 60) {
      this.well.k = Math.min(1, t * 2);
      const p = this.player;
      const dx = this.cx - p.cx;
      if (Math.abs(dx) > 16 && !p.dead) moveX(p.b, this.game.room, sign(dx) * Math.min(175, Math.abs(dx) * 1.5) / 60, 0);
      ringT -= 1 / 60;
      if (ringT <= 0) {
        ringT = this.phase >= 4 ? 0.6 : 0.75;
        this.fireRing(this.cx, this.cy, 12, 150, { a0: Math.random() * TAU, art: 'fb_light', r: 7, life: 6, color: '#d8d0ff' });
        this.sfx('bell');
      }
      yield;
    }
    this.well = null; this.satHarm = false; this.tiltT = 0.3; this.orbitSpeed = 1.1;
    for (const s of this.sats) s.target = 84;
    this.calm();
    yield 0.7;
  }

  // ================= 8. STARFALL: the remembered beads rain from above (First Light)
  *starfall() {
    yield* this.glide(this.midX, this.hoverY(), 520);
    this.open(); this.tele = 0.5; this.sfx('charge');
    const A = this.arena, top = A.y + 40;
    const homes = this.sats.map((s, i) => ({ s, x: A.x + (i + 0.5) * A.w / 6, y: top }));
    for (const h of homes) { h.s.free = true; h.x0 = h.s.x; h.y0 = h.s.y; }
    for (let t = 0; t < 0.5; t += 1 / 60) {
      const k = t / 0.5;
      for (const h of homes) { h.s.x = h.x0 + (h.x - h.x0) * k; h.s.y = h.y0 + (h.y - h.y0) * k; }
      yield;
    }
    const step = 96, cols = [];
    for (let x = A.x + 48; x < A.x + A.w - 20; x += step) cols.push(x);
    const waves = 3;
    for (let w = 0; w < waves; w++) {
      const use = cols.filter((_, i) => (i + w) % 3 !== 0);
      for (const x of use) this.marks.push({ x, t: 0.55, max: 0.55 });
      this.sfx('warn');
      for (const h of homes) h.s.flash = 0.55;
      yield 0.55;
      for (const x of use) this.fire(x, top + 6, 0, 240, { gravity: 600, art: 'fb_light', r: 8, life: 3, color: this.pick(SAT_COLS) });
      this.sfx('bell');
      yield 0.4;
    }
    // satellites come home
    for (const h of homes) { h.x0 = h.s.x; h.y0 = h.s.y; }
    for (let t = 0; t < 0.5; t += 1 / 60) {
      const k = t / 0.5;
      for (const h of homes) { h.s.x = h.x0 + (this.cx - h.x0) * k; h.s.y = h.y0 + (this.cy - h.y0) * k; }
      yield;
    }
    for (const s of this.sats) { s.free = false; s.rad = 20; }
    this.calm();
    yield 0.5;
  }

  // ---------------- phases
  onPhase(n) {
    this.co = this.phaseShift(n); this.wait = 0;
    this.satHarm = false; this.ghostOrbit = null; this.dashLine = null; this.unravel = null; this.well = null;
    this.cometCharge = 0; this.poundAim = false; this.afterimages = false; this.tiltT = 0.3; this.orbitSpeed = 1.1;
    for (const s of this.sats) { s.free = false; s.gone = false; s.target = 84; }
  }

  *phaseShift(n) {
    this.hittable = false;
    for (const e of this.game.entities) if (e instanceof Projectile && !e.friendly) e.dead = true;
    this.open();
    yield* this.glide(this.midX, this.hoverY(), 700);
    this.sfx('bossRoar'); this.shake(8, 1.0);
    this.fx.ring(this.cx, this.cy, 40, 520, 1.2, 'rgba(255,244,210,0.85)', 7);
    const lines = {
      2: 'You roll as I once rolled. Then roll faster.',
      3: 'Come, then. Back before the light was made.',
      4: 'Before the Strand there was only this — the first light.',
    };
    this.fx.text(this.cx, this.cy - 90, lines[n] || '', '#fff4d2', 15);
    if (n === 2) this.speedMul *= 1.06;
    if (n === 3) { this.speedMul *= 1.06; this.darkT = 1; }
    if (n === 4) {
      this.speedMul *= 1.1;
      this.game.flash('rgba(255,250,235,0.95)', 1.2);
      this.darkT = 0; this.dark = 0; this.halo2 = 1;
    }
    for (let t = 0; t < 1.4; t += 1 / 60) { this.orbitSpeed = 1.1 + Math.sin(t / 1.4 * Math.PI) * 4; yield; }
    this.orbitSpeed = 1.1;
    this.calm();
    this.hittable = true;
    yield 0.3;
  }

  onDeath() {
    this.darkT = 0; this.satHarm = false; this.unravel = null; this.well = null; this.pillars.length = 0; this.marks.length = 0;
    this.eyesT = 0;
    this.fx.text(this.cx, this.cy - 90, '…how bright you are.', '#fff4d2', 16);
  }
  onFinish() {
    this.darkT = 0; this.dark = 0;
    if (this.veil) this.veil.dead = true;
    this.game.app.ending && this.game.app.ending('C');
  }

  // ---------------- collision
  bodyBox() { const r = this.R * 0.82; return { x: this.cx - r, y: this.cy - r, w: r * 2, h: r * 2 }; }
  hitboxes() {
    const out = [this.bodyBox(), ...this.hits];
    if (this.satHarm) for (const s of this.sats) if (!s.gone) out.push(this.satBox(s));
    return out;
  }

  // ---------------- drawing
  drawVeil(ctx, t) {
    const g = this.game;
    if (this.dark > 0.01) {
      if (!this.dc) { this.dc = document.createElement('canvas'); this.dc.width = VIEW_W; this.dc.height = VIEW_H; }
      const vx = g.camera.viewX, vy = g.camera.viewY;
      const d = this.dc.getContext('2d');
      d.globalCompositeOperation = 'source-over';
      d.clearRect(0, 0, VIEW_W, VIEW_H);
      d.fillStyle = `rgba(4,3,12,${0.94 * this.dark})`;
      d.fillRect(0, 0, VIEW_W, VIEW_H);
      d.globalCompositeOperation = 'destination-out';
      const L = [];
      const p = g.player;
      L.push([p.cx, p.cy, (g.save.abilities.lantern ? 200 : 150) + Math.sin(t * 3) * 5]);
      L.push([this.cx, this.cy, 230]);
      for (const s of this.sats) if (!s.gone) L.push([s.x, s.y, 64]);
      for (const e of g.entities) {
        if (e instanceof Projectile && !e.friendly && !e.dead) {
          if (e.o.box) { const r = e.rect(); L.push([r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.6 + 30]); }
          else L.push([e.cx, e.cy, 42]);
        }
      }
      for (const m of this.marks) L.push([m.x, this.arena.y + 30, 50]);
      for (const pl of this.pillars) L.push([pl.x, this.groundY - 20, 70]);
      for (const [x, y, r] of L) {
        const sx = x - vx, sy = y - vy;
        if (sx < -r || sy < -r || sx > VIEW_W + r || sy > VIEW_H + r) continue;
        const gr = d.createRadialGradient(sx, sy, 0, sx, sy, r);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = gr; d.beginPath(); d.arc(sx, sy, r, 0, TAU); d.fill();
      }
      ctx.drawImage(this.dc, vx, vy);
    }
    this.drawTelegraphs(ctx, t);
  }

  drawTelegraphs(ctx, t) {
    if (this.mode !== 'fight') return;
    const A = this.arena;
    if (this.ghostOrbit) {
      ctx.save(); ctx.strokeStyle = 'rgba(255,244,210,0.5)'; ctx.setLineDash([10, 12]); ctx.lineWidth = 3; ctx.lineDashOffset = -t * 40;
      ctx.beginPath(); ctx.arc(this.cx, this.cy, this.ghostOrbit.r, 0, TAU); ctx.stroke(); ctx.restore();
    }
    if (this.dashLine) {
      const y = this.dashLine.y;
      ctx.save();
      ctx.fillStyle = 'rgba(255,244,210,0.12)'; ctx.fillRect(A.x, y - this.R, A.w, this.R * 2);
      ctx.strokeStyle = 'rgba(255,244,210,0.6)'; ctx.setLineDash([16, 12]); ctx.lineWidth = 2; ctx.lineDashOffset = this.dashLine.dir * t * 120;
      ctx.beginPath(); ctx.moveTo(A.x, y - this.R); ctx.lineTo(A.x + A.w, y - this.R); ctx.moveTo(A.x, y + this.R); ctx.lineTo(A.x + A.w, y + this.R); ctx.stroke();
      ctx.restore();
    }
    if (this.poundAim) {
      ctx.save(); ctx.strokeStyle = 'rgba(255,244,210,0.55)'; ctx.setLineDash([8, 10]); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(this.cx, this.cy + this.R); ctx.lineTo(this.cx, this.groundY); ctx.stroke(); ctx.restore();
      ctx.fillStyle = 'rgba(255,244,210,0.3)'; ctx.beginPath(); ctx.ellipse(this.cx, this.groundY - 2, 50, 8, 0, 0, TAU); ctx.fill();
    }
    if (this.unravel) {
      const k = this.unravel.k, R = this.unravel.r;
      ctx.save();
      ctx.strokeStyle = `rgba(184,50,62,${0.3 + 0.6 * k})`; ctx.lineWidth = 2 + k * 3; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(this.cx, this.cy, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(184,50,62,${0.8 * k})`; ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU - k * 3, L = R * (1 - k * 0.8);
        ctx.beginPath(); ctx.moveTo(this.cx + Math.cos(a) * L, this.cy + Math.sin(a) * L);
        ctx.lineTo(this.cx + Math.cos(a + 0.2) * (L + 18), this.cy + Math.sin(a + 0.2) * (L + 18)); ctx.stroke();
      }
      ctx.restore();
    }
    for (const pl of this.pillars) {
      if (pl.fired) continue;
      const k = 1 - pl.t / pl.max;
      glow(ctx, pl.x, this.groundY - 6, 40 + 30 * k, '255,244,210', 0.35 + 0.4 * k);
      ctx.fillStyle = `rgba(255,248,225,${0.3 + 0.5 * k})`; ctx.beginPath(); ctx.ellipse(pl.x, this.groundY - 3, 34, 6, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255,248,225,${0.25 * k})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pl.x - 34, this.groundY); ctx.lineTo(pl.x - 34, this.groundY - 300 * k); ctx.moveTo(pl.x + 34, this.groundY); ctx.lineTo(pl.x + 34, this.groundY - 300 * k); ctx.stroke();
    }
    for (const m of this.marks) {
      const k = 1 - m.t / m.max;
      glow(ctx, m.x, A.y + 30, 30, '255,244,210', 0.3 + 0.4 * k);
      ctx.save(); ctx.globalAlpha = 0.4 * k; ctx.strokeStyle = '#fff4d2'; ctx.setLineDash([4, 10]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(m.x, A.y + 30); ctx.lineTo(m.x, this.groundY); ctx.stroke(); ctx.restore();
    }
  }

  drawSat(ctx, s, t, white) {
    if (s.gone) return;
    const r = 11 * s.grow;
    if (r < 1) return;
    if (!white) {
      glow(ctx, s.x, s.y, r * (s.flash > 0 ? 5 : 3), hexRgb(s.c), s.flash > 0 ? 0.7 : 0.3);
      if (this.satHarm) glow(ctx, s.x, s.y, r * 2.4, '255,255,255', 0.25);
    }
    ctx.fillStyle = white ? '#fff' : INK; ctx.beginPath(); ctx.arc(s.x, s.y, r + 2.5, 0, TAU); ctx.fill();
    if (white) return;
    const g = ctx.createRadialGradient(s.x - r * 0.35, s.y - r * 0.35, 1, s.x, s.y, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, s.flash > 0 && Math.floor(t * 20) % 2 ? '#ffffff' : s.c); g.addColorStop(1, s.c);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();
    // a strand hole: these were strung once
    ctx.fillStyle = 'rgba(22,20,28,0.75)'; ctx.beginPath(); ctx.ellipse(s.x + r * 0.1, s.y, r * 0.2, r * 0.26, 0, 0, TAU); ctx.fill();
  }

  drawBody(ctx, t, white) {
    const R = this.R, cx = this.cx, cy = this.cy + Math.sin(t * 1.6) * 3;
    const P4 = this.halo2 > 0;
    // satellites behind
    const behind = this.sats.filter((s) => !s.free && Math.sin(s.a) < 0 && this.tilt < 0.9);
    const front = this.sats.filter((s) => !behind.includes(s));
    if (!white) {
      glow(ctx, cx, cy, R * 4.2, P4 ? '255,250,235' : '255,240,210', P4 ? 0.4 : 0.25);
      // afterimages
      for (const q of this.trail) { ctx.globalAlpha = (q.life / 0.3) * 0.35; ctx.fillStyle = this.cometCharge > 0 ? '#ffd0f2' : '#f3eee4'; ctx.beginPath(); ctx.arc(q.x, q.y, R, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      // halo (back half)
      this.drawHalo(ctx, cx, cy, t, true);
    }
    for (const s of behind) this.drawSat(ctx, s, t, white);
    // comet charge aura
    if (!white && this.cometCharge > 0) glow(ctx, cx, cy, R * (1.8 + this.cometCharge * 1.4), '255,200,240', 0.55 * this.cometCharge);
    // the pearl
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
    if (white) ctx.fillStyle = '#fff';
    else {
      const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.08, cx, cy, R);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#f3eee4'); g.addColorStop(0.85, '#d9d2df'); g.addColorStop(1, '#b9b0c8');
      ctx.fillStyle = g;
    }
    ctx.fill();
    if (!white) {
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
      // nacre sheen
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const a = t * 0.4 + i * 2.1;
        ctx.strokeStyle = ['rgba(255,170,220,0.22)', 'rgba(150,230,255,0.2)', 'rgba(255,230,160,0.2)'][i]; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 8, cy + Math.sin(a) * 6, R * 0.8, R * 0.45, a * 0.5, 0, Math.PI); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      // engraved constellations (old gold), turning slowly
      ctx.strokeStyle = 'rgba(200,160,80,0.45)'; ctx.lineWidth = 1.2; ctx.fillStyle = 'rgba(220,180,90,0.7)';
      for (let i = 0; i < 7; i++) {
        const a = t * 0.15 + i * 0.9, rr = R * (0.45 + (i % 3) * 0.15);
        const x1 = cx + Math.cos(a) * rr, y1 = cy + Math.sin(a * 1.3) * rr * 0.8;
        const a2 = a + 0.9, x2 = cx + Math.cos(a2) * rr * 0.9, y2 = cy + Math.sin(a2 * 1.3) * rr * 0.7;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.beginPath(); ctx.arc(x1, y1, 1.6, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
    ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 4; ctx.stroke();
    // face: Bead's own eyes, older and calmer
    const e = this.eyes;
    const f = this.player.cx < cx ? -1 : 1;
    const ex = cx + f * R * 0.12, ey = cy - R * 0.05;
    for (const s of [-1, 1]) {
      const x = ex + s * R * 0.32;
      if (white) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, ey, R * 0.15, R * 0.22, 0, 0, TAU); ctx.fill(); continue; }
      if (e < 0.25) {
        // closed: serene crescents with long lashes
        ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x, ey - R * 0.02, R * 0.14, 0.15, Math.PI - 0.15); ctx.stroke();
        ctx.lineWidth = 1.8;
        for (const k of [0.35, 0.6, 0.85]) { const a = Math.PI * k; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R * 0.14, ey - R * 0.02 + Math.sin(a) * R * 0.14); ctx.lineTo(x + Math.cos(a) * R * 0.22, ey - R * 0.02 + Math.sin(a) * R * 0.22); ctx.stroke(); }
      } else {
        const h = R * 0.24 * e;
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, ey, R * 0.15, h, 0, 0, TAU); ctx.fill();
        eye(ctx, x + f * R * 0.03, ey + R * 0.03, R * 0.07 * e, P4 ? '#ffffff' : '#ffe6a6', true);
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - R * 0.05, ey - h * 0.45, R * 0.05, 0, TAU); ctx.fill();
      }
    }
    if (!white) {
      // a small, patient mouth
      ctx.strokeStyle = 'rgba(22,20,28,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ex, cy + R * 0.3, R * 0.07, 0.3, Math.PI - 0.3); ctx.stroke();
      this.drawHalo(ctx, cx, cy, t, false);
    }
    for (const s of front) this.drawSat(ctx, s, t, white);
  }

  drawHalo(ctx, cx, cy, t, back) {
    const draw = (rx, ry, rot, col, lw) => {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
      ctx.beginPath();
      if (back) ctx.ellipse(0, 0, rx, ry, 0, Math.PI, TAU); else ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI);
      ctx.strokeStyle = INK; ctx.lineWidth = lw + 3; ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
      ctx.restore();
    };
    const R = this.R;
    ctx.save(); ctx.translate(0, -R * 0.55);
    draw(R * 1.25, R * 0.3, -0.18 + Math.sin(t * 0.7) * 0.05, '#ffe6a6', 3);
    ctx.restore();
    if (this.halo2) draw(R * 1.55, R * 0.42, 0.9 + t * 0.3, 'rgba(255,250,235,0.9)', 2);
    if (!back) glow(ctx, cx, cy - R * 0.55 - R * 0.05, R * 1.3, '255,230,166', 0.12);
  }
}

export default { firstbead: FirstBead };
