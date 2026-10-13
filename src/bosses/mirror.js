// Bosses of the Mirrored Deep: the Prism Warden (Keeper) and The Reflection (optional).
import { Boss } from './boss.js';
import { TAU, clamp, sign, overlap } from '../core/math.js';
import { INK, eye } from '../art/creatures.js';
import { Projectile, registerProjectileArt } from '../entities/projectile.js';
import { makeBead, stepBead, moveX, moveY } from '../world/movement.js';
import { BeadArt } from '../art/bead.js';
import { PHYS } from '../core/constants.js';

// ---------------------------------------------------------------------------------------------
// shared helpers
const col = (white, c) => (white ? '#fff' : c);
function segHitsRect(x0, y0, x1, y1, r) {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dy = y1 - y0;
  const p = [-dx, dx, -dy, dy], q = [x0 - r.x, r.x + r.w - x0, y0 - r.y, r.y + r.h - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}
function rayEnd(ox, oy, ang, ar, groundY) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  let t = 4000;
  if (dx > 1e-6) t = Math.min(t, (ar.x + ar.w - ox) / dx); else if (dx < -1e-6) t = Math.min(t, (ar.x - ox) / dx);
  if (dy > 1e-6) t = Math.min(t, (groundY - oy) / dy); else if (dy < -1e-6) t = Math.min(t, (ar.y - oy) / dy);
  t = Math.max(0, t);
  return { x: ox + dx * t, y: oy + dy * t };
}
function addMark(boss, m) {
  m.born = boss.clock || 0;
  m.life = (m.life || 0.5) / boss.speedMul;
  m.wait = (m.wait || 0) / boss.speedMul;
  boss.marks.push(m);
  return m;
}
function liveMarks(boss) {
  const now = boss.clock || 0;
  boss.marks = boss.marks.filter((m) => now - m.born < m.life);
  return boss.marks.map((m) => ({ m, age: now - m.born, k: (now - m.born) / m.life }));
}
// one prismatic colour along a hue wheel (soft pastels for this area)
const prism = (h, a = 1, l = 80) => `hsla(${((h % 360) + 360) % 360},90%,${l}%,${a})`;

// a faceted crystal spike (local, base centre at 0,0, pointing up)
function crystal(ctx, w, h, fill, white, lean = 0) {
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2 + lean * 0.3, -h * 0.7); ctx.lineTo(lean, -h); ctx.lineTo(w / 2 + lean * 0.3, -h * 0.72); ctx.lineTo(w / 2, 0); ctx.closePath();
  ctx.fillStyle = col(white, fill); ctx.fill();
  ctx.strokeStyle = col(white, INK); ctx.lineWidth = 2.2; ctx.stroke();
  if (!white) {
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-w * 0.15, -2); ctx.lineTo(-w * 0.15 + lean * 0.25, -h * 0.68); ctx.lineTo(lean, -h); ctx.stroke();
  }
}

// ---------------------------------------------------------------------------------------------
// projectile art
registerProjectileArt('pw_shard', (ctx, p, t) => {
  ctx.save();
  ctx.translate(p.cx, p.cy); ctx.rotate(p.rot + Math.PI / 2);
  const r = p.r;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 3);
  g.addColorStop(0, prism(t * 200 + p.cx, 0.55)); g.addColorStop(1, 'rgba(255,200,240,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 3, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.translate(0, r * 1.6);
  crystal(ctx, r * 1.3, r * 3.4, '#f6e4f7', false);
  ctx.restore();
});
registerProjectileArt('pw_wave', (ctx, p, t) => {
  const r = p.rect();
  const bx = r.x + r.w / 2, by = r.y + r.h + p.r * 0.2;
  const dir = sign(p.vx) || 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(bx, by, 2, bx, by, p.r * 3);
  g.addColorStop(0, 'rgba(255,220,250,0.6)'); g.addColorStop(1, 'rgba(255,180,240,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, p.r * 3, Math.PI, TAU); ctx.fill();
  ctx.restore();
  for (const [ox, hk] of [[-0.6, 0.5], [0.45, 0.65], [0, 1]]) {
    ctx.save(); ctx.translate(bx + ox * p.r * 1.2 * dir, by);
    crystal(ctx, 13, p.r * 2 * hk, ox === 0 ? '#ffe6f8' : '#d9c1ec', false, dir * 4);
    ctx.restore();
  }
});
registerProjectileArt('refl_shard', (ctx, p, t) => {
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.rot);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, p.r * 3);
  g.addColorStop(0, 'rgba(120,230,240,0.55)'); g.addColorStop(1, 'rgba(120,230,240,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, p.r * 3, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#231d2e'; ctx.strokeStyle = '#9ff0f4'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(p.r * 1.8, 0); ctx.lineTo(0, -p.r * 0.7); ctx.lineTo(-p.r * 1.4, 0); ctx.lineTo(0, p.r * 0.7); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(120,230,240,0.45)'; ctx.lineWidth = 2;
  ctx.beginPath(); p.trail.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
});
registerProjectileArt('refl_wave', (ctx, p, t) => {
  const r = p.rect();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(120,220,235,0.5)';
  ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h); ctx.quadraticCurveTo(r.x + r.w * 0.5, r.y - r.h * 0.4, r.x + r.w, r.y + r.h); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#231d2e'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(r.x + 3, r.y + r.h); ctx.quadraticCurveTo(r.x + r.w * 0.5, r.y - r.h * 0.1, r.x + r.w - 3, r.y + r.h); ctx.fill(); ctx.stroke();
});

// ---------------------------------------------------------------------------------------------
// PRISM WARDEN — Keeper of the Many Lights. A crystal knight who walks between reflections.
// P1: crystal pillars, prism beams, mirror-step lunges, plunges from high mirrors, shard volleys.
// P2: steps a mirrored image of itself out of the glass, which mimics every attack (mirrored).
// P3: faster; the prism fans turn while they burn; doubled volleys.
const WARDEN_PAL = {
  main: { armor: '#efe4f6', armor2: '#c9b2dc', under: '#4a3354', gem: '#ffd0f2', eye: '#fff4fd', ink: INK, blade: 'rgba(255,240,252,0.92)' },
  image: { armor: '#3b2d4a', armor2: '#271d33', under: '#140e1a', gem: '#8ff0ff', eye: '#9ff6ff', ink: '#e8d8ff', blade: 'rgba(160,240,255,0.75)' },
};

export class PrismWarden extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'prismwarden', size: [84, 156], music: 'boss_keeper', glints: 280, introTime: 2.5 });
    this.marks = []; this.timers = []; this.beams = []; this.prisms = [];
    this.clock = 0;
    this.ps = { sword: 0.9, swordC: 0.9, crouch: 0, crouchC: 0, alpha: 1, glow: 0 };
    this.image = null;
    this.imageHarm = false;
    if (this.dead) return;
    const ar = this.arena, gy = this.groundY;
    const hy = Math.max(ar.y + 70, gy - 310);
    this.mirrors = [
      { x: ar.x + 70, y: gy, high: false, glow: 0 },
      { x: ar.x + ar.w - 70, y: gy, high: false, glow: 0 },
      { x: ar.x + ar.w * 0.3, y: hy, high: true, glow: 0 },
      { x: ar.x + ar.w * 0.7, y: hy, high: true, glow: 0 },
    ];
  }

  update(dt) {
    this.clock += dt;
    super.update(dt);
    if (this.mode === 'dying') {
      this.ps.alpha = Math.max(0.2, 1 - (this.dieT || 0) * 0.3);
      if (Math.random() < 0.6) this.fx.burst(this.cx + this.rand(-30, 30), this.cy + this.rand(-60, 60), 1, { color: prism(this.rand(0, 360), 1, 82), speed: 220, size: 3, life: 0.8, shape: 'shard', glow: true });
    }
    for (const m of this.mirrors || []) m.glow = Math.max(0, m.glow - dt * 1.5);
  }

  get mid() { return this.arena.x + this.arena.w / 2; }
  mx(x) { return 2 * this.mid - x; }
  both(fn) { fn(false); if (this.image && this.image.alpha > 0.5 && this.image.down <= 0) fn(true); }
  after(t, fn) { this.timers.push({ t: t / this.speedMul, fn }); }
  rec(t) { return t * (this.phase >= 3 ? 0.72 : this.phase === 2 ? 0.88 : 1); }
  swordTip(ix = false) {
    const f = ix ? -this.facing : this.facing;
    const cx = ix ? this.mx(this.cx) : this.cx;
    const hx = cx + f * 30, hy = this.y + this.h - 92 + this.ps.crouchC * 16;
    const a = this.ps.swordC;
    return { x: hx + f * Math.cos(a) * 112, y: hy + Math.sin(a) * 112 };
  }
  imageBox() {
    const ix = this.mx(this.cx);
    return { x: ix - 26, y: this.y + 20, w: 52, h: this.h - 20 };
  }

  animate(dt) {
    const s = this.ps, k = (r) => 1 - Math.exp(-r * dt);
    s.swordC += (s.sword - s.swordC) * k(10);
    s.crouchC += (s.crouch - s.crouchC) * k(10);
    s.glow = Math.max(0, s.glow - dt * 1.2);
    if (this.image) {
      const im = this.image;
      im.flash -= dt;
      if (im.down > 0) { im.down -= dt; im.alpha = 0; if (im.down <= 0) { im.hp = 3; this.sfx('phase'); this.fx.ring(this.mx(this.cx), this.cy, 50, 6, 0.4, 'rgba(160,240,255,0.9)', 3); } }
      else im.alpha = Math.min(im.target, im.alpha + dt * 0.8);
    }
  }
  idle(dt) { this.animate(dt); }
  introUpdate(dt, t) {
    this.facePlayer();
    if (t < 0.7) this.ps.sword = 1.2;
    else if (t < 1.8) { this.ps.sword = -1.45; this.ps.glow = 1; if (t > 0.72 && t < 0.77) { this.sfx('crystalBreak'); this.shake(6, 0.8); this.fx.ring(this.swordTip().x, this.swordTip().y, 6, 120, 0.6, 'rgba(255,220,250,0.9)', 4); } }
    else this.ps.sword = 0.9;
    this.animate(dt);
  }

  think(dt) {
    this.animate(dt);
    for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0 && !tm.done) { tm.done = true; tm.fn(); } }
    this.timers = this.timers.filter((tm) => !tm.done);
    // beams
    if (this.beams.length) {
      const hb = this.player.hurtbox();
      const R = { x: hb.x - 7, y: hb.y - 7, w: hb.w + 14, h: hb.h + 14 };
      for (const b of this.beams) {
        if (b.follow) { const tp = this.swordTip(b.image); b.x0 = tp.x; b.y0 = tp.y; }
        if (b.ang !== undefined) { const e = rayEnd(b.x0, b.y0, b.ang, this.arena, this.groundY); b.x1 = e.x; b.y1 = e.y; }
        if (b.on && segHitsRect(b.x0, b.y0, b.x1, b.y1, R)) { this.hits.push(hb); }
        if (b.on && b.ang !== undefined && Math.random() < 0.4) this.fx.burst(b.x1, b.y1, 1, { color: prism(this.clock * 300, 1, 85), speed: 180, angle: b.ang + Math.PI, spread: 1.4, size: 2.2, life: 0.35, glow: true });
      }
    }
    // the image is solid only while it is mid-attack
    if (this.image && this.imageHarm && this.image.alpha > 0.5 && this.image.down <= 0) this.hits.push(this.imageBox());
    // prisms bob
    for (const p of this.prisms) { p.rot += dt * 1.2; p.alpha = Math.min(1, p.alpha + dt * 4); }
    // drifting glitter off the armour
    if (Math.random() < 0.3 && this.ps.alpha > 0.5) this.fx.add({ x: this.cx + this.rand(-30, 30), y: this.y + this.rand(10, this.h - 20), vx: this.rand(-10, 10), vy: -this.rand(20, 50), life: 0.9, size: 1.8, color: prism(this.rand(0, 360), 1, 85), g: -10, glow: true, front: false });
  }

  attackList() {
    const d = this.distX(), P = this.phase;
    return [
      { name: 'pillars', w: 2.5, fn: this.pillars },
      { name: 'prism', w: 2.4, fn: this.prismBeam },
      { name: 'lunge', w: d < 420 ? 2.6 : 1.2, fn: this.lunge },
      { name: 'step', w: d > 380 ? 2.2 : 1, fn: this.mirrorStep },
      { name: 'plunge', w: 2, fn: this.plunge },
      { name: 'volley', w: P >= 2 ? 2 : 1.2, fn: this.volley },
    ];
  }

  // ---- building blocks ----
  pillar(x, warn = 0.55) {
    x = clamp(x, this.arena.x + 24, this.arena.x + this.arena.w - 24);
    addMark(this, { type: 'pwarn', x, life: warn });
    this.after(warn, () => {
      if (this.mode !== 'fight') return;
      this.zone(x - 22, this.groundY - 150, 44, 150, 0.55);
      addMark(this, { type: 'pillar', x, life: 0.75, seed: Math.random() * 10 });
      this.sfx('crystalBreak');
      this.fx.burst(x, this.groundY, 8, { color: '#f3dcf5', speed: 260, angle: -Math.PI / 2, spread: 1.4, size: 3, life: 0.5, shape: 'shard' });
      this.after(0.72, () => this.fx.burst(x, this.groundY - 70, 10, { color: '#f3dcf5', speed: 200, size: 3, life: 0.6, shape: 'shard', g: 700 }));
    });
  }
  *vanish() {
    this.sfx('phase');
    this.fx.burst(this.cx, this.cy, 20, { color: '#ffe6fa', speed: 200, size: 2.5, life: 0.5, glow: true, g: -60 });
    for (let a = 1; a > 0; a -= 0.08 * this.speedMul) { this.ps.alpha = a; yield; }
    this.ps.alpha = 0; this.hittable = false; this.harmful = false;
  }
  *appearAt(m, wait = 0.5) {
    m.glow = 1.6;
    addMark(this, { type: 'mglow', m, life: wait });
    this.sfx('warn');
    yield wait;
    this.noPhysics = true;
    if (m.high) { this.x = m.x - this.w / 2; this.y = m.y - this.h / 2 + 10; }
    else { this.x = clamp(m.x - this.w / 2, this.arena.x, this.arena.x + this.arena.w - this.w); this.y = this.groundY - this.h; }
    this.facePlayer();
    this.sfx('phase');
    this.fx.ring(this.cx, this.cy, 70, 8, 0.35, 'rgba(255,230,250,0.9)', 3);
    for (let a = 0; a < 1; a += 0.12 * this.speedMul) { this.ps.alpha = a; yield; }
    this.ps.alpha = 1; this.hittable = true; this.harmful = true;
    if (!m.high) this.noPhysics = false;
  }

  // ---- attacks ----
  *pillars() {
    this.facePlayer();
    this.ps.sword = -1.5; this.ps.glow = 1; this.tele = 0.55; this.sfx('charge');
    yield 0.55;
    this.ps.sword = 1.45; this.ps.crouch = 1; this.shake(6, 0.3); this.sfx('slam');
    this.fx.ring(this.swordTip().x, this.groundY, 8, 90, 0.4, 'rgba(255,220,250,0.9)', 4);
    const march = this.phase >= 2 && Math.random() < 0.5;
    if (march) {
      const dir = this.facing;
      const S = this.image ? 150 : 128;
      for (let i = 0; ; i++) {
        const x = this.cx + dir * (90 + i * S);
        if (x < this.arena.x + 20 || x > this.arena.x + this.arena.w - 20) break;
        this.both((im) => this.pillar(im ? this.mx(x) : x, 0.55 + i * 0.1));
      }
      yield 1.0;
    } else {
      const n = 2 + this.phase;
      for (let i = 0; i < n; i++) {
        const x = this.player.cx;
        this.both((im) => this.pillar(im ? this.mx(x) : x, 0.5));
        yield this.image ? 0.5 : 0.42;
      }
    }
    yield 0.4;
    this.ps.crouch = 0; this.ps.sword = 0.9;
    yield this.rec(0.6);
  }

  *prismBeam() {
    this.facePlayer();
    const ar = this.arena;
    const side = this.player.cx < this.cx ? 1 : -1;
    const px = clamp(this.player.cx + side * this.rand(60, 140), ar.x + 140, ar.x + ar.w - 140);
    const py = Math.max(ar.y + 60, this.groundY - 270);
    const n = this.image ? 3 : this.phase === 1 ? 3 : 4;
    const step = this.image ? 0.46 : 0.42;
    this.prisms = [];
    this.both((im) => this.prisms.push({ x: im ? this.mx(px) : px, y: py, rot: 0, alpha: 0, image: im }));
    this.ps.sword = -0.9; this.ps.glow = 1; this.tele = 0.8; this.sfx('charge');
    yield 0.15;
    this.beams = [];
    for (const pr of this.prisms) {
      const tip = this.swordTip(pr.image);
      this.beams.push({ x0: tip.x, y0: tip.y, x1: pr.x, y1: pr.y, follow: true, image: pr.image, main: true, on: false, prism: pr });
      for (let i = 0; i < n; i++) {
        const a = Math.PI / 2 + (i - (n - 1) / 2) * step;
        this.beams.push({ x0: pr.x, y0: pr.y, ang: a, a0: a, on: false, prism: pr, hue: i * (300 / n) });
      }
    }
    // the sword-to-prism beam follows the blade, so aim once the pose settles
    yield 0.65;
    this.sfx('laser'); this.shake(4, 0.4);
    for (const b of this.beams) b.on = true;
    const T = 0.95, spin = this.phase >= 3 ? this.pick([-1, 1]) * 0.34 : 0;
    for (let t = 0; t < T; t += this.speedMul / 60) {
      for (const b of this.beams) if (b.a0 !== undefined) b.ang = b.a0 + (b.prism.image ? -spin : spin) * (t / T);
      yield;
    }
    this.beams = [];
    this.sfx('crystalBreak');
    for (const pr of this.prisms) this.fx.burst(pr.x, pr.y, 14, { color: '#ffe6fa', speed: 220, size: 3, life: 0.5, shape: 'shard' });
    this.prisms = [];
    this.ps.sword = 0.9;
    yield this.rec(0.8);
  }

  *lunge() {
    this.facePlayer();
    const tx = clamp(this.player.cx, this.arena.x + this.w / 2, this.arena.x + this.arena.w - this.w / 2);
    this.ps.sword = 2.6; this.ps.crouch = 0.8; this.tele = 0.5; this.sfx('charge');
    const dir = this.facing;
    const stopX = tx - dir * 40;
    addMark(this, { type: 'lline', x0: this.cx, x1: stopX + dir * 110, life: 0.5 });
    this.both((im) => { if (im) addMark(this, { type: 'lline', x0: this.mx(this.cx), x1: this.mx(stopX + dir * 110), life: 0.5 }); });
    yield 0.5;
    this.sfx('dash'); this.imageHarm = true;
    this.ps.sword = 0.15;
    const dist = Math.abs(stopX - this.cx);
    if (sign(stopX - this.cx) === dir && dist > 10) yield* this.dashTo(dir, 1100, dist);
    this.ps.sword = -0.3; this.ps.crouch = 0.4;
    this.sfx('slash'); this.shake(5, 0.2);
    this.both((im) => {
      const f = im ? -dir : dir, cx = im ? this.mx(this.cx) : this.cx;
      const x = f > 0 ? cx + 20 : cx - 20 - 140;
      this.zone(x, this.y + 10, 140, this.h - 10, 0.16);
      this.fx.slash(cx + f * 80, this.y + this.h * 0.45, f > 0 ? -0.3 : Math.PI + 0.3, 170, im ? 'rgba(160,240,255,0.9)' : 'rgba(255,235,250,0.95)', 0.22);
    });
    yield 0.3;
    this.imageHarm = false;
    this.ps.crouch = 0; this.ps.sword = 0.9;
    yield this.rec(0.6);
  }

  *mirrorStep() {
    // dissolve and step out of the ground mirror nearest Bead, then lunge
    yield* this.vanish();
    const ground = this.mirrors.filter((m) => !m.high);
    const m = ground.reduce((a, b) => (Math.abs(b.x - this.player.cx) < Math.abs(a.x - this.player.cx) ? b : a));
    yield* this.appearAt(m, 0.5);
    yield 0.1;
    yield* this.lunge();
  }

  *plunge() {
    yield* this.vanish();
    const high = this.mirrors.filter((m) => m.high);
    const m = high.reduce((a, b) => (Math.abs(b.x - this.player.cx) < Math.abs(a.x - this.player.cx) ? b : a));
    yield* this.appearAt(m, 0.5);
    this.noPhysics = true; this.vx = this.vy = 0;
    this.ps.sword = 1.57; this.tele = 0.45;
    const tx = clamp(this.player.cx, this.arena.x + this.w / 2, this.arena.x + this.arena.w - this.w / 2);
    addMark(this, { type: 'line', x0: this.cx, y0: this.cy, x1: tx, y1: this.groundY - 4, life: 0.45 });
    this.both((im) => { if (im) addMark(this, { type: 'line', x0: this.mx(this.cx), y0: this.cy, x1: this.mx(tx), y1: this.groundY - 4, life: 0.45 }); });
    this.sfx('warn');
    yield 0.45;
    this.sfx('dash'); this.imageHarm = true;
    const x0 = this.cx, y0 = this.y, y1 = this.groundY - this.h;
    const D = Math.hypot(tx - x0, y1 - y0), T = Math.max(0.2, D / 1150) / this.speedMul;
    for (let t = 0; t < T; t += 1 / 60) {
      const k = t / T;
      this.x = x0 + (tx - x0) * k - this.w / 2; this.y = y0 + (y1 - y0) * k * k;
      yield;
    }
    this.x = tx - this.w / 2; this.y = y1; this.noPhysics = false;
    this.ps.crouch = 1;
    this.shake(9, 0.4); this.sfx('slam'); this.sfx('crystalBreak');
    this.both((im) => {
      const cx = im ? this.mx(this.cx) : this.cx;
      this.fx.burst(cx, this.groundY, 18, { color: '#f3dcf5', speed: 340, angle: -Math.PI / 2, spread: 2.4, size: 3.5, life: 0.6, shape: 'shard' });
      this.shockwave(cx - 30, -1, 400, 34, { art: 'pw_wave' });
      this.shockwave(cx + 30, 1, 400, 34, { art: 'pw_wave' });
      if (this.phase >= 3) { this.pillar(cx - 170, 0.45); this.pillar(cx + 170, 0.45); }
    });
    yield 0.35;
    this.imageHarm = false;
    this.ps.crouch = 0; this.ps.sword = 0.9;
    yield this.rec(0.7);
  }

  *volley() {
    this.facePlayer();
    this.ps.sword = -1.45; this.ps.glow = 1; this.tele = 0.5; this.sfx('charge');
    const rows = this.phase >= 3 ? 2 : 1;
    const n = this.image ? 6 : 7, S = this.image ? 86 : 74;
    const y = Math.max(this.arena.y + 40, this.groundY - 340);
    let c = this.player.cx;
    for (let r = 0; r < rows; r++) {
      const xs = [];
      for (let i = 0; i < n; i++) xs.push(c + (i - (n - 1) / 2) * S);
      const all = [];
      this.both((im) => xs.forEach((x) => all.push(im ? this.mx(x) : x)));
      const pts = all.filter((x) => x > this.arena.x + 10 && x < this.arena.x + this.arena.w - 10);
      for (const x of pts) addMark(this, { type: 'hshard', x, y, life: 0.62 + 0.6 });
      yield 0.62;
      this.sfx('shard');
      const order = pts.slice().sort((a, b) => (this.facing > 0 ? a - b : b - a));
      for (let i = 0; i < order.length; i++) {
        this.fire(order[i], y + 14, 0, 950, { art: 'pw_shard', r: 8, life: 2 });
        if (i % 2) yield 0.05;
      }
      c += S / 2;
      yield 0.25;
    }
    this.ps.sword = 0.9;
    yield this.rec(0.8);
  }

  onPhase(n) {
    this.sfx('bossRoar'); this.shake(7, 0.7); this.ps.glow = 1;
    if (n === 2) {
      // the reflection steps out of the glass
      this.image = { alpha: 0, target: 0.72, hp: 3, down: 0, flash: 0 };
      this.game.flash('rgba(255,220,250,0.45)', 0.4);
      this.sfx('phase');
      this.fx.ring(this.mx(this.cx), this.cy, 90, 6, 0.6, 'rgba(160,240,255,0.9)', 4);
    }
    if (n === 3) {
      this.speedMul *= 1.15;
      if (this.image) this.image.target = 0.88;
      this.game.flash('rgba(255,220,250,0.35)', 0.35);
    }
  }

  // Bonks that land on the image crack it instead of the Warden
  hitsImage(box) {
    if (!this.image || this.image.alpha < 0.4 || this.image.down > 0 || !box) return false;
    return overlap(box, this.imageBox()) && !overlap(box, this.bodyBox());
  }
  crackImage() {
    const im = this.image;
    im.hp--; im.flash = 0.1;
    this.sfx('glassHit');
    const b = this.imageBox();
    this.fx.burst(b.x + b.w / 2, b.y + b.h / 2, 8, { color: '#9ff6ff', speed: 220, size: 3, life: 0.4, shape: 'shard' });
    if (im.hp <= 0) {
      im.down = 7; im.alpha = 0;
      this.sfx('crystalBreak'); this.shake(5, 0.3);
      this.fx.burst(b.x + b.w / 2, b.y + b.h / 2, 30, { color: '#9ff6ff', speed: 360, size: 4, life: 0.8, shape: 'shard' });
    }
  }
  onBonk(dmg, dir, p) {
    if (!this.hittable) return false;
    if (this.hitsImage(p.attackBox())) { this.crackImage(); return true; }
    return super.onBonk(dmg, dir, p);
  }
  hurt(dmg, dir, src) {
    if (this.mode !== 'fight' || !this.hittable) return;
    let src2 = null;
    if (src === 'spell') {
      const g = this.game;
      const pr = g.entities.find((e) => e instanceof Projectile && e.friendly && !e.dead && overlap(e.rect(), this.imageBox()));
      if (pr) src2 = pr.rect();
    } else if (src === 'comet' || src === 'pound') src2 = this.player.rect();
    if (src2 && this.hitsImage(src2)) { this.crackImage(); return; }
    super.hurt(dmg, dir, src);
  }
  hurtboxes() {
    const r = [this.bodyBox()];
    if (this.image && this.image.alpha > 0.4 && this.image.down <= 0) r.push(this.imageBox());
    return r;
  }
  bodyBox() { return { x: this.cx - 26, y: this.y + 14 + this.ps.crouchC * 14, w: 52, h: this.h - 14 - this.ps.crouchC * 14 }; }
  hitboxes() {
    if (!this.harmful) return [...this.hits];
    return [this.bodyBox(), ...this.hits];
  }

  onDeath() {
    this.beams = []; this.prisms = []; this.timers = []; this.marks = [];
    this.ps.alpha = 1; this.noPhysics = false;
    if (this.image) { const b = this.imageBox(); this.fx.burst(b.x + b.w / 2, b.y + b.h / 2, 30, { color: '#9ff6ff', speed: 360, size: 4, life: 0.8, shape: 'shard' }); this.image = null; }
    if (this.y + this.h < this.groundY - 4) this.y = this.groundY - this.h;
  }
  onFinish() {
    const g = this.game;
    for (let i = 0; i < 40; i++) g.fx.burst(this.cx, this.cy, 1, { color: prism(i * 9, 1, 82), speed: 520, size: 5, life: 1.6, shape: 'shard', glow: true, g: 400 });
    g.fx.ring(this.cx, this.cy, 30, 380, 1.1, 'rgba(255,230,250,0.9)', 8);
    g.sfx('crystalBreak');
  }

  // ------------------------------------------------------------------ drawing
  drawBody(ctx, t, white) {
    if (!white) {
      this.drawMirrors(ctx, t);
      this.drawMarksBack(ctx, t);
      if (this.image && this.image.alpha > 0.01 && this.mode !== 'dying') {
        ctx.save(); ctx.globalAlpha = this.image.alpha;
        this.drawWarden(ctx, t, this.image.flash > 0, this.mx(this.cx), -this.facing, WARDEN_PAL.image);
        ctx.restore();
      }
    }
    if (this.ps.alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha *= this.ps.alpha;
    this.drawWarden(ctx, t, white, this.cx, this.facing, WARDEN_PAL.main);
    ctx.restore();
  }

  drawMirrors(ctx, t) {
    for (const m of this.mirrors || []) {
      const W = m.high ? 64 : 76, H = m.high ? 120 : 180;
      const x = m.x, top = m.high ? m.y - H / 2 + Math.sin(t * 1.3 + x) * 4 : m.y - H;
      ctx.save();
      // glow when he is about to step out
      if (m.glow > 0) {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, top + H / 2, 4, x, top + H / 2, H);
        g.addColorStop(0, `rgba(255,220,250,${Math.min(0.7, m.glow * 0.5)})`); g.addColorStop(1, 'rgba(255,200,240,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, top + H / 2, H, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      // arched pane
      const arch = () => {
        ctx.beginPath();
        ctx.moveTo(x - W / 2, top + H); ctx.lineTo(x - W / 2, top + W / 2); ctx.arc(x, top + W / 2, W / 2, Math.PI, TAU); ctx.lineTo(x + W / 2, top + H); ctx.closePath();
      };
      arch();
      const sg = ctx.createLinearGradient(x - W / 2, top, x + W / 2, top + H);
      sg.addColorStop(0, 'rgba(225,205,240,0.75)'); sg.addColorStop(0.45, 'rgba(140,110,165,0.7)'); sg.addColorStop(1, 'rgba(60,42,75,0.9)');
      ctx.fillStyle = sg; ctx.fill();
      // a faint, wrong reflection of Bead's world: soft vertical streaks
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(255,240,252,0.18)'; ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) { const sx = x - W / 2 + 10 + i * (W - 20) / 3; ctx.beginPath(); ctx.moveTo(sx, top + H); ctx.lineTo(sx + 14, top); ctx.stroke(); }
      ctx.restore();
      arch();
      // reflected sheen sweeping across
      ctx.save(); ctx.clip();
      const sw = ((t * 0.35 + x * 0.001) % 1.6) - 0.3;
      ctx.fillStyle = 'rgba(255,235,250,0.22)';
      ctx.beginPath(); ctx.moveTo(x - W / 2 + sw * W * 2, top); ctx.lineTo(x - W / 2 + sw * W * 2 + 18, top); ctx.lineTo(x - W / 2 + sw * W * 2 - 40, top + H); ctx.lineTo(x - W / 2 + sw * W * 2 - 58, top + H); ctx.fill();
      if (m.glow > 0) { ctx.fillStyle = `rgba(255,240,252,${Math.min(0.8, m.glow * 0.6)})`; ctx.fillRect(x - W / 2, top, W, H); }
      ctx.restore();
      arch();
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = '#c792c9'; ctx.lineWidth = 2; ctx.stroke();
      // crystal crown on the frame
      ctx.save(); ctx.translate(x, top + 4); crystal(ctx, 12, 26, '#f3dcf5', false); ctx.translate(-14, 6); crystal(ctx, 9, 16, '#d9c1ec', false, -3); ctx.translate(28, 0); crystal(ctx, 9, 16, '#d9c1ec', false, 3); ctx.restore();
      if (!m.high) {
        ctx.save(); ctx.translate(x - W / 2 - 4, top + H); crystal(ctx, 12, 30, '#d9c1ec', false, -4); ctx.translate(W + 8, 0); crystal(ctx, 12, 24, '#d9c1ec', false, 4); ctx.restore();
      }
      ctx.restore();
    }
  }

  drawWarden(ctx, t, white, cx, f, P) {
    const s = this.ps, by = this.y + this.h, an = this.anim;
    const cr = s.crouchC * 16, breath = Math.sin(an * 2.2) * 1.5;
    const ink = col(white, P.ink);
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(f, 1);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // ---- cape of light (behind)
    if (!white) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = prism(an * 40 + i * 50, 0.13, 75);
        ctx.beginPath();
        const sx = -10 - i * 3, sy = -126 + cr;
        ctx.moveTo(sx, sy);
        const w1 = Math.sin(an * 2 + i) * 8, w2 = Math.sin(an * 2.6 + i * 1.7) * 10;
        ctx.quadraticCurveTo(-48 - i * 6 + w1, -80 + cr, -40 - i * 8 + w2, -4);
        ctx.lineTo(-14 - i * 4 + w2 * 0.5, -6);
        ctx.quadraticCurveTo(-20, -70 + cr, sx + 14, sy + 4);
        ctx.fill();
      }
      ctx.restore();
    }
    // ---- legs
    const hip = -66 + cr;
    const leg = (x, back) => {
      ctx.beginPath();
      ctx.moveTo(x - 9, hip); ctx.lineTo(x + 9, hip); ctx.lineTo(x + 11, hip / 2 + 4); ctx.lineTo(x + 7, -6); ctx.lineTo(x + 16, 0); ctx.lineTo(x - 12, 0); ctx.lineTo(x - 8, -6); ctx.lineTo(x - 11, hip / 2 + 4); ctx.closePath();
      ctx.fillStyle = col(white, back ? P.armor2 : P.armor); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.stroke();
      // knee crystal
      ctx.beginPath(); ctx.moveTo(x - 6, hip / 2); ctx.lineTo(x + 2, hip / 2 - 9); ctx.lineTo(x + 10, hip / 2); ctx.lineTo(x + 2, hip / 2 + 6); ctx.closePath();
      ctx.fillStyle = col(white, P.gem); ctx.fill(); ctx.stroke();
    };
    leg(-14, true);
    leg(12, false);
    // ---- tasset / skirt of crystal plates
    ctx.beginPath();
    ctx.moveTo(-26, hip - 6); ctx.lineTo(26, hip - 6); ctx.lineTo(30, hip + 16); ctx.lineTo(16, hip + 10); ctx.lineTo(4, hip + 20); ctx.lineTo(-8, hip + 10); ctx.lineTo(-22, hip + 18); ctx.closePath();
    ctx.fillStyle = col(white, P.armor2); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.stroke();
    // ---- torso: faceted breastplate
    const sh = -126 + cr + breath;
    ctx.beginPath();
    ctx.moveTo(-30, sh); ctx.lineTo(32, sh); ctx.lineTo(26, sh + 34); ctx.lineTo(18, hip - 4); ctx.lineTo(-18, hip - 4); ctx.lineTo(-26, sh + 34); ctx.closePath();
    if (white) ctx.fillStyle = '#fff';
    else {
      const g = ctx.createLinearGradient(-30, sh, 30, hip);
      g.addColorStop(0, P.armor); g.addColorStop(1, P.armor2);
      ctx.fillStyle = g;
    }
    ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.stroke();
    if (!white) {
      ctx.strokeStyle = P === WARDEN_PAL.main ? 'rgba(120,90,140,0.55)' : 'rgba(200,240,255,0.4)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-26, sh + 34); ctx.lineTo(0, sh + 22); ctx.lineTo(26, sh + 34); ctx.moveTo(0, sh + 22); ctx.lineTo(0, hip - 4); ctx.moveTo(-18, sh); ctx.lineTo(0, sh + 22); ctx.lineTo(18, sh); ctx.stroke();
      // prismatic glints moving over the facets
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const k = (an * 0.4 + i / 3) % 1;
        ctx.strokeStyle = prism(an * 90 + i * 120, 0.55, 78); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-24 + k * 48, sh + 4); ctx.lineTo(-30 + k * 48, sh + 30); ctx.stroke();
      }
      ctx.restore();
    }
    // heart gem
    const gy = sh + 22;
    if (!white) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(0, gy, 1, 0, gy, 26 + s.glow * 20);
      gg.addColorStop(0, prism(an * 120, 0.9, 88)); gg.addColorStop(1, 'rgba(255,200,240,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, gy, 26 + s.glow * 20, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.beginPath(); ctx.moveTo(0, gy - 10); ctx.lineTo(8, gy); ctx.lineTo(0, gy + 11); ctx.lineTo(-8, gy); ctx.closePath();
    ctx.fillStyle = col(white, P.gem); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.stroke();
    // ---- back pauldron cluster
    ctx.save(); ctx.translate(-26, sh + 4); ctx.rotate(-0.5); crystal(ctx, 12, 26, P.armor2, white, -3); ctx.rotate(0.45); crystal(ctx, 10, 20, P.armor, white); ctx.restore();
    // ---- head: faceted helm with a tall crest
    const hx = 4, hy = sh - 20 + Math.sin(an * 2.2 + 0.5) * 0.8;
    ctx.save(); ctx.translate(hx - 2, hy - 18);
    crystal(ctx, 12, 36 + Math.sin(an * 3) * 1.5, P.gem, white, -6);
    ctx.translate(-10, 4); crystal(ctx, 9, 22, P.armor2, white, -6);
    ctx.translate(20, 0); crystal(ctx, 9, 20, P.armor2, white, 2);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(hx - 15, hy + 6); ctx.lineTo(hx - 14, hy - 12); ctx.lineTo(hx - 4, hy - 22); ctx.lineTo(hx + 10, hy - 20); ctx.lineTo(hx + 17, hy - 8); ctx.lineTo(hx + 15, hy + 10); ctx.lineTo(hx + 4, hy + 18); ctx.lineTo(hx - 8, hy + 14); ctx.closePath();
    ctx.fillStyle = col(white, P.armor); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 2.8; ctx.stroke();
    if (!white) {
      // dark visor & glowing eyes
      ctx.fillStyle = P === WARDEN_PAL.main ? INK : '#0b0810';
      ctx.beginPath(); ctx.moveTo(hx - 9, hy - 4); ctx.lineTo(hx + 15, hy - 6); ctx.lineTo(hx + 13, hy + 4); ctx.lineTo(hx - 7, hy + 5); ctx.closePath(); ctx.fill();
      const er = 2.2 + s.glow * 1.2 + (this.tele > 0 ? 0.8 : 0);
      eye(ctx, hx - 1, hy, er, P.eye, true, 'slit');
      eye(ctx, hx + 9, hy - 1, er, P.eye, true, 'slit');
      ctx.strokeStyle = P === WARDEN_PAL.main ? 'rgba(120,90,140,0.6)' : 'rgba(200,240,255,0.4)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(hx + 4, hy + 6); ctx.lineTo(hx + 4, hy + 16); ctx.stroke();
    }
    // ---- sword arm + crystal greatsword
    const handX = 30, handY = -92 + cr;
    const a = s.swordC;
    const tip = { x: handX + Math.cos(a) * 112, y: handY + Math.sin(a) * 112 };
    const nx = -Math.sin(a), ny = Math.cos(a);
    // blade
    ctx.beginPath();
    ctx.moveTo(handX + Math.cos(a) * 14 + nx * 7, handY + Math.sin(a) * 14 + ny * 7);
    ctx.lineTo(tip.x - Math.cos(a) * 18 + nx * 6, tip.y - Math.sin(a) * 18 + ny * 6);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(tip.x - Math.cos(a) * 18 - nx * 6, tip.y - Math.sin(a) * 18 - ny * 6);
    ctx.lineTo(handX + Math.cos(a) * 14 - nx * 7, handY + Math.sin(a) * 14 - ny * 7);
    ctx.closePath();
    ctx.fillStyle = col(white, P.blade); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.stroke();
    if (!white) {
      ctx.strokeStyle = prism(an * 150, 0.8, 80); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(handX + Math.cos(a) * 18, handY + Math.sin(a) * 18); ctx.lineTo(tip.x - Math.cos(a) * 12, tip.y - Math.sin(a) * 12); ctx.stroke();
      if (s.glow > 0.05 || this.tele > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const tg = ctx.createRadialGradient(tip.x, tip.y, 1, tip.x, tip.y, 30);
        tg.addColorStop(0, 'rgba(255,245,252,0.9)'); tg.addColorStop(1, 'rgba(255,200,240,0)');
        ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(tip.x, tip.y, 30, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    // crossguard + hilt
    ctx.strokeStyle = ink; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(handX + Math.cos(a) * 12 + nx * 13, handY + Math.sin(a) * 12 + ny * 13); ctx.lineTo(handX + Math.cos(a) * 12 - nx * 13, handY + Math.sin(a) * 12 - ny * 13); ctx.stroke();
    ctx.strokeStyle = col(white, P.armor2); ctx.lineWidth = 3; ctx.stroke();
    // arm
    ctx.strokeStyle = ink; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(18, sh + 8); ctx.quadraticCurveTo(30, sh + 24, handX, handY); ctx.stroke();
    ctx.strokeStyle = col(white, P.armor); ctx.lineWidth = 7.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(handX, handY, 6.5, 0, TAU); ctx.fillStyle = col(white, P.armor2); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 2.2; ctx.stroke();
    // front pauldron
    ctx.save(); ctx.translate(22, sh + 2); ctx.rotate(0.4); crystal(ctx, 14, 30, P.armor, white, 4); ctx.rotate(0.5); crystal(ctx, 10, 20, P.gem, white); ctx.restore();
    // orbiting shards
    if (!white) {
      for (let i = 0; i < 3; i++) {
        const oa = an * 1.6 + i * TAU / 3;
        const ox = Math.cos(oa) * 46, oy = sh + 20 + Math.sin(oa) * 12;
        ctx.save(); ctx.translate(ox, oy); ctx.rotate(oa * 0.5);
        ctx.globalAlpha *= Math.sin(oa) > 0 ? 1 : 0.55;
        crystal(ctx, 6, 14, P.gem, false);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  drawMarksBack(ctx, t) {
    const gy = this.groundY;
    for (const { m, age, k } of liveMarks(this)) {
      if (m.type === 'pwarn') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(m.x, gy, 1, m.x, gy, 40);
        g.addColorStop(0, `rgba(255,220,250,${0.3 + 0.6 * k})`); g.addColorStop(1, 'rgba(255,200,240,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(m.x, gy, 40, 18, 0, Math.PI, TAU); ctx.fill();
        ctx.restore();
        // crystal tips peeking out of the floor
        ctx.save(); ctx.translate(m.x, gy + 2);
        crystal(ctx, 10, 6 + 12 * k, '#f3dcf5', false);
        ctx.translate(-12, 0); crystal(ctx, 7, 4 + 8 * k, '#d9c1ec', false, -2);
        ctx.translate(24, 0); crystal(ctx, 7, 4 + 8 * k, '#d9c1ec', false, 2);
        ctx.restore();
      } else if (m.type === 'pillar') {
        const rise = Math.min(1, age / 0.07), shatter = k > 0.82;
        if (shatter) continue;
        const H = 150 * rise;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(m.x, gy - H / 2, 4, m.x, gy - H / 2, H * 0.8);
        g.addColorStop(0, 'rgba(255,220,250,0.35)'); g.addColorStop(1, 'rgba(255,200,240,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, gy - H / 2, H * 0.8, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.translate(m.x, gy + 2);
        ctx.save(); ctx.translate(-14, 0); crystal(ctx, 18, H * 0.6, '#d9c1ec', false, -8); ctx.restore();
        ctx.save(); ctx.translate(15, 0); crystal(ctx, 16, H * 0.5, '#d9c1ec', false, 7); ctx.restore();
        crystal(ctx, 26, H, '#f6e8f8', false, Math.sin(m.seed) * 4);
        ctx.restore();
      } else if (m.type === 'lline') {
        ctx.strokeStyle = `rgba(255,225,250,${0.4 + 0.5 * Math.abs(Math.sin(t * 18))})`; ctx.lineWidth = 2.5;
        ctx.setLineDash([12, 8]);
        ctx.beginPath(); ctx.moveTo(m.x0, gy - 6); ctx.lineTo(m.x1, gy - 6); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(m.x1, gy - 20); ctx.lineTo(m.x1 + sign(m.x1 - m.x0) * 10, gy - 6); ctx.lineTo(m.x1, gy + 6); ctx.stroke();
      } else if (m.type === 'line') {
        ctx.strokeStyle = `rgba(255,225,250,${0.4 + 0.5 * Math.abs(Math.sin(t * 18))})`; ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath(); ctx.moveTo(m.x0, m.y0); ctx.lineTo(m.x1, m.y1); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.ellipse(m.x1, gy - 2, 42, 8, 0, 0, TAU); ctx.stroke();
      } else if (m.type === 'hshard') {
        // a shard condenses in the air above, glinting, then falls
        const form = Math.min(1, age / (0.62 / this.speedMul));
        if (form >= 1) continue;
        ctx.save(); ctx.translate(m.x, m.y + 30);
        ctx.globalAlpha = 0.4 + 0.6 * form;
        ctx.rotate(Math.PI);
        crystal(ctx, 9, 12 + 18 * form, '#f6e4f7', false);
        ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,230,250,${0.06 + 0.1 * form})`;
        ctx.fillRect(m.x - 5, m.y + 30, 10, gy - m.y - 30);
        ctx.restore();
      }
    }
  }

  drawExtra(ctx, t) {
    // prisms & beams on top
    for (const p of this.prisms) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = p.alpha;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 50);
      g.addColorStop(0, p.image ? 'rgba(160,240,255,0.6)' : 'rgba(255,230,250,0.6)'); g.addColorStop(1, 'rgba(255,200,240,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 50, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.rotate(Math.sin(p.rot) * 0.3);
      ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(18, 13); ctx.lineTo(-18, 13); ctx.closePath();
      ctx.fillStyle = p.image ? 'rgba(120,200,220,0.8)' : 'rgba(255,240,252,0.85)'; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = prism(t * 200, 0.9, 75); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, 13); ctx.moveTo(-9, -3); ctx.lineTo(18, 13); ctx.stroke();
      ctx.restore();
    }
    for (const b of this.beams) {
      if (!isFinite(b.x1)) continue;
      ctx.save(); ctx.lineCap = 'round';
      if (!b.on) {
        ctx.setLineDash([9, 9]); ctx.lineDashOffset = -t * 60;
        ctx.strokeStyle = b.main ? 'rgba(255,240,252,0.55)' : prism(b.hue || 0, 0.35 + 0.35 * Math.abs(Math.sin(t * 14)), 80);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        const hue = b.main ? 320 : (b.hue || 0) + t * 60;
        const fl = 1 + Math.sin(t * 60 + (b.hue || 0)) * 0.15;
        for (const [w, a, l] of [[22 * fl, 0.22, 70], [11 * fl, 0.55, 80], [4, 1, 96]]) {
          ctx.strokeStyle = b.main ? `rgba(255,${200 + (l - 70) * 2},${240},${a})` : prism(hue, a, l); ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke();
        }
      }
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------------------------------------
// THE REFLECTION — "Bead, Again". A dark mirror-Bead with glowing eyes and a cold thread. It
// moves with Bead's own body (the real movement code) and fights the way Bead does: dashes,
// Bonks, pogo-dives, shard tosses, wall-jumps, ground pounds and comet rolls — and sometimes it
// simply does whatever Bead did last.
export class Reflection extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'reflection', size: [24, 24], music: 'boss_optional', glints: 220, introTime: 2.0 });
    this.noPhysics = true;
    this.b = makeBead(this.x, this.y);
    this.b.facing = -1;
    this.ab = { sap: true, dash: true, glide: true, dbljump: true, speedMul: 1.08 };
    this.inp = { x: 0, y: 0, jump: false, jumpP: false, dash: false, dashP: false, dashR: false, abilityP: false };
    this.art = new BeadArt();
    this.ev = [];
    this.atk = null;
    this.ctl = null;
    this.marks = []; this.clock = 0;
    this.stunT = 0;
    this.cue = 0;
    this.lastAct = null; this.pSwing = 0; this.sawSpell = false;
    this.eyeOpen = 0;
  }

  // ---- body plumbing ----
  update(dt) {
    this.clock += dt;
    super.update(dt);
    if (this.mode === 'dormant') this.art.update(dt, { b: this.b });
  }
  sync() { const b = this.b; this.x = b.x; this.y = b.y; this.w = b.w; this.h = b.h; }
  physicsStep(dt) {
    const b = this.b, room = this.game.room, inp = this.inp;
    if (this.stunT > 0) { this.stunT -= dt; inp.x = 0; }
    if (this.ctl === 'comet') {
      b.vy = 0;
      let hit = moveX(b, room, this.cometDir * PHYS.cometSpeed * this.speedMul * dt, 0);
      const ar = this.arena;
      if (b.x < ar.x || b.x + b.w > ar.x + ar.w) { b.x = clamp(b.x, ar.x, ar.x + ar.w - b.w); hit = true; }
      if (Math.random() < 0.8) this.fx.add({ x: b.x + b.w / 2, y: b.y + b.h / 2 + this.rand(-8, 8), vx: -this.cometDir * 80, vy: this.rand(-30, 30), life: 0.35, size: 3, color: 'rgba(120,220,235,0.8)', g: 0, glow: true });
      if (hit) {
        this.ctl = null; b.mode = 'normal'; b.vx = -this.cometDir * 220; b.vy = -260;
        this.sfx('bonkWall'); this.shake(5, 0.2);
        this.fx.burst(b.x + b.w / 2 + this.cometDir * 12, b.y + b.h / 2, 10, { color: '#9ff0f4', speed: 220, size: 3, life: 0.4, shape: 'shard' });
      }
    } else if (this.ctl === 'pound') {
      b.vx = 0; b.vy = PHYS.poundSpeed;
      const r = moveY(b, room, b.vy * dt, {});
      if (r === 'floor') {
        this.ctl = null; b.mode = 'normal'; b.vy = 0; b.grounded = true;
        this.onPoundLand();
      }
    } else {
      this.ev.length = 0;
      stepBead(b, inp, room, this.ab, dt, this.ev);
      for (const e of this.ev) this.onMoveEvent(e);
    }
    inp.jumpP = false; inp.dashP = false; inp.abilityP = false;
    // keep inside the arena
    const ar = this.arena;
    if (b.x < ar.x) { b.x = ar.x; b.vx = Math.max(0, b.vx); }
    if (b.x + b.w > ar.x + ar.w) { b.x = ar.x + ar.w - b.w; b.vx = Math.min(0, b.vx); }
    if (b.y > this.groundY + 40) { b.y = this.groundY - b.h; b.vy = 0; }
    this.sync();
    this.art.update(dt, { b });
  }
  onMoveEvent(e) {
    const g = this.game;
    switch (e.type) {
      case 'jump': g.sfx('jump'); this.art.impulse(0.75, 1.3); break;
      case 'dbljump': g.sfx('dbljump'); this.art.impulse(0.7, 1.35); g.fx.ring(this.cx, this.cy + 10, 4, 26, 0.3, 'rgba(120,220,235,0.9)', 2); break;
      case 'walljump': g.sfx('jump'); this.art.impulse(1.25, 0.8); break;
      case 'dash': g.sfx('dash'); this.art.impulse(1.3, 0.8); g.fx.burst(this.cx - e.dir * 10, this.cy, 6, { color: 'rgba(60,50,80,0.8)', speed: 80, angle: e.dir > 0 ? Math.PI : 0, spread: 1, size: 2.5, life: 0.25, g: 0 }); break;
      case 'land': if (e.vy > 380) this.art.impulse(1.3, 0.7); break;
    }
  }
  neutral() { const i = this.inp; i.x = 0; i.y = 0; i.jump = false; i.dash = false; }
  press(k) { this.inp[k + 'P'] = true; this.inp[k] = true; }
  face() { this.b.facing = this.dirTo(); }
  signal(t, kind = 'cue') {
    // telegraph: eyes flare, a cold glint, a ring tightening around it
    this.cue = t / this.speedMul; this.cueKind = kind;
    this.tele = t;
    this.sfx('charge');
    this.fx.ring(this.cx, this.cy, 46, 14, Math.min(0.45, t), 'rgba(150,235,245,0.9)', 2.5);
  }

  bonk(dir) {
    this.atk = { t: 0, dir, hold: dir === 'down' };
    this.sfx('swing');
    const b = this.b, f = b.facing;
    if (dir === 'side') this.fx.slash(this.cx + f * 30, this.cy, f > 0 ? 0 : Math.PI, 56, 'rgba(120,220,235,0.9)', 0.14);
    else if (dir === 'down') this.fx.slash(this.cx, this.cy + 30, Math.PI / 2, 52, 'rgba(120,220,235,0.9)', 0.14);
    else this.fx.slash(this.cx, this.cy - 30, -Math.PI / 2, 52, 'rgba(120,220,235,0.9)', 0.14);
  }
  atkBox() {
    const a = this.atk, b = this.b;
    if (!a || (!a.hold && a.t > 0.13)) return null;
    if (a.dir === 'up') return { x: b.x + b.w / 2 - 20, y: b.y - 44, w: 40, h: 50 };
    if (a.dir === 'down') return { x: b.x + b.w / 2 - 19, y: b.y + b.h - 6, w: 38, h: 46 };
    return b.facing > 0 ? { x: b.x + b.w - 4, y: b.y - 6, w: 46, h: b.h + 12 } : { x: b.x - 42, y: b.y - 6, w: 46, h: b.h + 12 };
  }

  idle(dt) { this.eyeOpen = 0; }
  introUpdate(dt, t) {
    this.b.facing = this.dirTo();
    this.eyeOpen = Math.min(1, Math.max(0, (t - 0.7) * 3));
    if (t > 0.7 && t < 0.75) { this.sfx('phase'); this.fx.ring(this.cx, this.cy, 4, 70, 0.6, 'rgba(150,235,245,0.9)', 3); this.shake(4, 0.5); }
    this.neutral();
  }
  onStart() { this.b.facing = this.dirTo(); }

  think(dt) {
    const p = this.player, b = this.b;
    this.eyeOpen = 1;
    this.cue = Math.max(0, this.cue - dt);
    // remember what Bead did last
    for (const e of p.ev) {
      const m = { jump: 'jump', dbljump: 'jump', walljump: 'wall', dash: 'dash', poundStart: 'pound', comet: 'comet' }[e.type];
      if (m) this.lastAct = m;
    }
    if (p.swing !== this.pSwing) { this.pSwing = p.swing; this.lastAct = p.attackDir === 'down' ? 'pogo' : 'bonk'; }
    if (p.spellCd > 0.3) { if (!this.sawSpell) { this.sawSpell = true; this.lastAct = 'shard'; } } else this.sawSpell = false;
    // attacks
    if (this.atk) {
      this.atk.t += dt;
      const box = this.atkBox();
      if (box) {
        this.hits.push(box);
        if (this.atk.dir === 'down' && overlap(box, p.hurtbox())) {
          // pogo off Bead's head
          b.vy = -PHYS.pogoVel; b.jumping = false; b.airDashes = 1; b.airJumps = 1;
          this.atk.hold = false; this.atk.t = 0.2; this.pogoed = true;
          this.art.impulse(0.8, 1.2);
        }
        if (this.atk.hold && b.grounded) { this.atk.hold = false; this.atk.t = 0.13; }
      }
      if (!this.atk.hold && this.atk.t > 0.22) this.atk = null;
    }
    if (this.phase >= 3 && Math.random() < 0.5) this.art.trail.push({ x: this.cx, y: this.cy, life: 0.18, r: 12 });
    // cold wisps
    if (Math.random() < 0.15) this.fx.add({ x: this.cx + this.rand(-8, 8), y: this.cy + this.rand(-8, 8), vx: this.rand(-10, 10), vy: -this.rand(20, 40), life: 0.7, size: 2, color: 'rgba(120,220,235,0.7)', g: -20, glow: true, front: false });
  }

  // clash: two Bonks meeting ring off each other
  onBonk(dmg, dir, p) {
    if (!this.hittable) return false;
    const mine = this.atkBox(), theirs = p.attackBox();
    if (mine && theirs && overlap(mine, theirs)) {
      this.sfx('parry');
      this.game.hitstop(0.08);
      const mx = (Math.max(mine.x, theirs.x) + Math.min(mine.x + mine.w, theirs.x + theirs.w)) / 2;
      const my = (Math.max(mine.y, theirs.y) + Math.min(mine.y + mine.h, theirs.y + theirs.h)) / 2;
      this.fx.burst(mx, my, 12, { color: '#fff', speed: 300, size: 2.5, life: 0.25, shape: 'streak', g: 0 });
      this.fx.ring(mx, my, 4, 34, 0.2, 'rgba(255,255,255,0.95)', 3);
      p.b.vx = -p.b.facing * 320;
      this.b.vx = -this.b.facing * 320;
      this.atk = null;
      return false;
    }
    this.hurt(dmg, dir, 'bonk');
    if (dir) { this.b.vx = dir * 260; this.stunT = 0.08; }
    return true;
  }

  bodyBox() { return { x: this.cx - 15, y: this.cy - 15, w: 30, h: 30 }; }
  hitboxes() { return [{ x: this.cx - 10, y: this.cy - 10, w: 20, h: 20 }, ...this.hits]; }

  attackList() {
    const d = this.distX(), P = this.phase;
    return [
      { name: 'lunge', w: d < 380 ? 3 : 1.5, fn: this.lunge },
      { name: 'hop', w: 2.6, fn: this.hopBonk },
      { name: 'shard', w: d > 200 ? 2.4 : 0.8, fn: this.shardToss },
      { name: 'pound', w: 1.7, fn: this.poundDive },
      { name: 'wall', w: 1.4, fn: this.wallDance },
      { name: 'comet', w: P >= 2 ? 2 : 0, fn: this.comet },
      { name: 'mirror', w: 1.3, fn: this.mirrorDance },
      { name: 'copy', w: this.lastAct ? 2.4 : 0, fn: this.copycat },
      { name: 'evade', w: d < 80 ? 3 : 0, fn: this.evade },
    ];
  }
  rec(t) { return t * (this.phase >= 3 ? 0.65 : this.phase === 2 ? 0.82 : 1); }

  onPhase(n) {
    this.sfx('bossRoar'); this.shake(5, 0.5);
    this.fx.ring(this.cx, this.cy, 4, 90, 0.6, 'rgba(150,235,245,0.9)', 4);
    if (n === 2) this.ab.speedMul = 1.14;
    if (n === 3) { this.ab.speedMul = 1.2; this.speedMul *= 1.12; this.game.flash('rgba(120,220,235,0.3)', 0.3); }
  }

  *waitGround(maxT = 1.2) { for (let t = 0; t < maxT && !this.b.grounded; t += 1 / 60) yield; }

  *lunge() {
    yield* this.waitGround();
    this.neutral(); this.face();
    this.signal(0.38); this.art.impulse(1.35, 0.7);
    yield 0.38;
    const dir = this.dirTo();
    this.b.facing = dir;
    this.inp.x = dir; this.press('dash');
    yield;
    this.inp.x = 0;
    for (let i = 0; i < 16; i++) {
      if (Math.abs(this.player.cx - this.cx) < 58 && Math.abs(this.player.cy - this.cy) < 40) break;
      if (this.b.mode !== 'dash' && i > 2) break;
      yield;
    }
    this.b.facing = this.dirTo();
    this.bonk(this.player.cy < this.cy - 30 ? 'up' : 'side');
    yield 0.25;
    if (this.phase >= 2 && Math.random() < 0.5) {
      // follow-through: hop over and pogo
      yield* this.hopBonk(true);
      return;
    }
    yield this.rec(0.45);
  }

  *runBonk() {
    yield* this.waitGround();
    for (let t = 0; t < 1.4; t += 1 / 60) {
      if (Math.abs(this.player.cx - this.cx) < 70) break;
      this.inp.x = this.dirTo();
      yield;
    }
    this.neutral(); this.face();
    this.signal(0.35);
    yield 0.35;
    this.inp.x = this.dirTo(); this.b.facing = this.inp.x;
    this.bonk('side');
    yield 0.12;
    this.inp.x = 0;
    this.bonk('side');
    yield this.rec(0.5);
  }

  *diveAt() {
    // from the apex: hang a moment on a dark dandelion (the tell), then a pogo-dive
    this.inp.jump = true;
    this.signal(0.36);
    for (let t = 0; t < 0.36 / this.speedMul; t += 1 / 60) {
      const dx = this.player.cx - this.cx;
      this.inp.x = Math.abs(dx) > 10 ? sign(dx) : 0;
      yield;
    }
    this.inp.jump = false; this.inp.x = 0;
    this.pogoed = false;
    this.bonk('down');
    for (let t = 0; t < 1.5 && this.atk && this.atk.hold; t += 1 / 60) yield;
  }

  *hopBonk(skipCue) {
    yield* this.waitGround();
    if (!skipCue) { this.neutral(); this.face(); this.signal(0.35); yield 0.35; }
    const chain = this.phase >= 2 ? 2 : 1;
    this.inp.x = this.dirTo(); this.press('jump');
    for (let c = 0; c < chain; c++) {
      for (let t = 0; t < 1.3; t += 1 / 60) {
        const dx = this.player.cx - this.cx;
        this.inp.x = Math.abs(dx) > 8 ? sign(dx) : 0;
        if (this.b.vy > -60 && Math.abs(dx) < 60 && this.player.cy > this.cy + 10) break;
        if (this.b.grounded && t > 0.1) break;
        yield;
      }
      if (this.b.grounded) break;
      yield* this.diveAt();
      if (!this.pogoed) break;
      this.inp.jump = true; // ride the pogo
      yield 0.12;
    }
    this.neutral();
    yield this.rec(0.45);
  }

  *poundDive() {
    yield* this.waitGround();
    this.neutral(); this.face();
    this.signal(0.35);
    yield 0.35;
    this.inp.x = this.dirTo(); this.press('jump');
    for (let t = 0; t < 1.0; t += 1 / 60) {
      const dx = this.player.cx - this.cx;
      this.inp.x = Math.abs(dx) > 10 ? sign(dx) : 0;
      if (this.b.vy > -80 && t > 0.15) break;
      yield;
    }
    // hang, then slam down
    this.inp.jump = true; this.inp.x = 0;
    this.signal(0.4, 'pound');
    for (let t = 0; t < 0.4 / this.speedMul; t += 1 / 60) { this.b.vy = Math.min(this.b.vy, 30); yield; }
    this.neutral();
    this.sfx('poundStart');
    this.ctl = 'pound'; this.b.mode = 'pound'; this.art.impulse(0.7, 1.3);
    for (let t = 0; t < 2 && this.ctl; t += 1 / 60) yield;
    yield this.rec(0.5);
  }
  onPoundLand() {
    this.sfx('pound'); this.shake(6, 0.25); this.art.impulse(1.5, 0.6);
    this.fx.burst(this.cx, this.b.y + this.b.h, 14, { color: '#9ff0f4', speed: 260, angle: -Math.PI / 2, spread: 3, size: 3, life: 0.5 });
    const sp = 380 + this.phase * 30;
    this.shockwave(this.cx - 10, -1, sp, 24, { art: 'refl_wave' });
    this.shockwave(this.cx + 10, 1, sp, 24, { art: 'refl_wave' });
  }

  *shardToss() {
    yield* this.waitGround();
    this.neutral(); this.face();
    this.signal(0.4);
    yield 0.4;
    this.throwShard();
    if (this.phase >= 2) {
      yield 0.2;
      this.press('jump'); this.inp.x = 0;
      for (let t = 0; t < 0.8 && this.b.vy < -60; t += 1 / 60) yield;
      this.face(); this.inp.jump = true;
      this.signal(0.35);
      yield 0.35;
      this.throwShard();
      this.inp.jump = false;
    }
    yield this.rec(0.6);
  }
  throwShard() {
    const f = this.b.facing = this.dirTo();
    this.sfx('shard');
    this.fire(this.cx + f * 10, this.cy, f * 640, 0, { art: 'refl_shard', r: 9, life: 2.5 });
    this.b.vx -= f * 120;
  }

  *wallDance() {
    yield* this.waitGround();
    const ar = this.arena;
    const wdir = this.cx - ar.x < ar.x + ar.w - this.cx ? -1 : 1;
    this.neutral();
    for (let t = 0; t < 2.5; t += 1 / 60) {
      this.inp.x = wdir;
      const far = wdir < 0 ? this.b.x - ar.x : ar.x + ar.w - this.b.x - this.b.w;
      if (far > 200 && this.b.dashCd <= 0 && this.b.grounded && this.dirTo() !== wdir) this.press('dash');
      if (this.b.wall === wdir || (wdir < 0 ? this.b.x - ar.x < 6 : ar.x + ar.w - this.b.x - this.b.w < 6)) break;
      yield;
    }
    // climb: jump into the wall, then wall-jump back into it
    this.press('jump');
    for (let hop = 0; hop < 2; hop++) {
      for (let t = 0; t < 0.6; t += 1 / 60) { this.inp.x = wdir; this.inp.jump = this.b.vy < 0; if (this.b.clinging) break; yield; }
      if (!this.b.clinging) break;
      this.press('jump'); this.inp.x = -wdir;
      yield 0.1;
      this.inp.x = wdir;
    }
    for (let t = 0; t < 0.6 && !this.b.clinging && !this.b.grounded; t += 1 / 60) { this.inp.x = wdir; yield; }
    this.inp.x = wdir;
    this.signal(0.4);
    yield 0.4;
    // spring off toward Bead
    this.press('jump'); this.inp.x = -wdir;
    yield 0.12;
    for (let t = 0; t < 1.2; t += 1 / 60) {
      const dx = this.player.cx - this.cx;
      this.inp.x = Math.abs(dx) > 8 ? sign(dx) : 0;
      this.inp.jump = this.b.vy < 0;
      if (Math.abs(dx) < 60 && this.player.cy > this.cy + 10) break;
      if (this.b.grounded) break;
      if (Math.abs(this.player.cy - this.cy) < 30 && Math.abs(dx) < 220 && this.b.airDashes > 0) {
        // level with Bead: air-dash Bonk
        this.inp.x = sign(dx); this.press('dash'); yield; this.inp.x = 0;
        for (let i = 0; i < 12 && Math.abs(this.player.cx - this.cx) > 56; i++) yield;
        this.b.facing = this.dirTo(); this.bonk('side');
        break;
      }
      yield;
    }
    if (!this.b.grounded && !this.atk) yield* this.diveAt();
    this.neutral();
    yield this.rec(0.5);
  }

  *comet() {
    yield* this.waitGround();
    this.neutral(); this.face();
    const runs = this.phase >= 3 ? 2 : 1;
    for (let r = 0; r < runs; r++) {
      this.cometDir = r === 0 ? this.dirTo() : -this.cometDir;
      this.b.facing = this.cometDir;
      this.charging = true; this.signal(r ? 0.42 : 0.55, 'comet'); this.sfx('cometCharge');
      yield r ? 0.42 : 0.55;
      this.charging = false;
      this.sfx('comet'); this.shake(3, 0.2);
      this.ctl = 'comet'; this.b.mode = 'comet';
      for (let t = 0; t < 3 && this.ctl; t += 1 / 60) yield;
      yield* this.waitGround(0.8);
    }
    yield this.rec(0.6);
  }

  *mirrorDance() {
    // for a breath it simply mirrors Bead across the arena, jump for jump
    this.neutral();
    this.fx.ring(this.cx, this.cy, 6, 50, 0.4, 'rgba(150,235,245,0.8)', 2);
    const mid = this.arena.x + this.arena.w / 2, p = this.player;
    for (let t = 0; t < 1.7; t += 1 / 60) {
      const tx = 2 * mid - p.cx;
      this.inp.x = Math.abs(tx - this.cx) > 14 ? sign(tx - this.cx) : 0;
      if (!this.inp.x) this.b.facing = -p.b.facing;
      if (p.ev.some((e) => e.type === 'jump' || e.type === 'dbljump' || e.type === 'walljump')) this.press('jump');
      this.inp.jump = p.b.vy < 0 || p.b.gliding;
      if (p.ev.some((e) => e.type === 'dash')) { this.inp.x = -(p.b.dashDir || p.b.facing); this.press('dash'); }
      yield;
    }
    this.neutral();
    yield* this.lunge();
  }

  *copycat() {
    const act = this.lastAct;
    this.neutral();
    this.sfx('phase');
    this.fx.ring(this.cx, this.cy, 60, 4, 0.4, 'rgba(255,255,255,0.9)', 2);
    addMark(this, { type: 'copy', life: 0.5 });
    yield 0.25;
    switch (act) {
      case 'dash': yield* this.lunge(); break;
      case 'jump': case 'pogo': yield* this.hopBonk(); break;
      case 'wall': yield* this.wallDance(); break;
      case 'pound': yield* this.poundDive(); break;
      case 'comet': yield* this.comet(); break;
      case 'shard': yield* this.shardToss(); break;
      default: yield* this.runBonk();
    }
  }

  *evade() {
    const ar = this.arena, away = -this.dirTo();
    const room = away < 0 ? this.cx - ar.x : ar.x + ar.w - this.cx;
    this.neutral();
    if (room > 150) {
      this.inp.x = away; this.press('dash'); yield; this.inp.x = 0;
      yield 0.25;
    } else {
      // cornered: vault over Bead
      this.inp.x = -away; this.press('jump');
      for (let t = 0; t < 0.3; t += 1 / 60) { this.inp.x = -away; yield; }
      this.press('dash'); yield; this.inp.x = 0;
      yield 0.3;
    }
    yield* this.waitGround(0.8);
    yield* this.shardToss();
  }

  onDeath() { this.atk = null; this.ctl = null; this.b.mode = 'normal'; this.marks = []; }

  // ------------------------------------------------------------------ drawing
  drawBody(ctx, time, white) {
    const b = this.b, art = this.art;
    const r = b.w / 2 + 1;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    if (!white) {
      // afterimages
      for (const t of art.trail) {
        ctx.globalAlpha = (t.life / 0.18) * 0.4;
        ctx.fillStyle = b.mode === 'comet' ? 'rgba(120,220,235,0.9)' : '#2a2236';
        ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // cold thread tail
      ctx.strokeStyle = '#4fd0cf'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(art.tail[0].x, art.tail[0].y);
      for (let i = 1; i < art.tail.length; i++) { const a = art.tail[i - 1], q = art.tail[i]; ctx.quadraticCurveTo(a.x, a.y, (a.x + q.x) / 2, (a.y + q.y) / 2); }
      ctx.stroke();
      // dark dandelion while it glides
      if (b.gliding) {
        ctx.strokeStyle = 'rgba(40,30,55,0.95)'; ctx.lineWidth = 1;
        const x = cx, y = cy - r;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 14); ctx.stroke();
        for (let i = 0; i < 14; i++) {
          const a = -Math.PI + (i / 13) * Math.PI + Math.sin(time * 6 + i) * 0.05;
          const L = 12 + (i % 2) * 3, ex = x + Math.cos(a) * L, ey = y - 14 + Math.sin(a) * L * 0.8;
          ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(ex, ey); ctx.stroke();
          ctx.fillStyle = 'rgba(120,220,235,0.9)'; ctx.beginPath(); ctx.arc(ex, ey, 1.6, 0, TAU); ctx.fill();
        }
      }
      // telegraph aura
      if (this.cue > 0 || this.charging) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const k = this.charging ? 1 : Math.min(1, this.cue * 4);
        const g = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 3.2);
        g.addColorStop(0, `rgba(150,235,245,${0.55 * k})`); g.addColorStop(1, 'rgba(150,235,245,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 3.2, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    ctx.save();
    ctx.translate(cx, cy + (1 - art.sqy) * r * 0.9);
    ctx.scale(art.sqx, art.sqy);
    // body
    if (white) ctx.fillStyle = '#fff';
    else {
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#5a4d6c'); g.addColorStop(0.7, '#2a2236'); g.addColorStop(1, '#141019');
      ctx.fillStyle = g;
    }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    if (!white) {
      // seam (cold stitches)
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
      ctx.rotate(art.roll);
      ctx.strokeStyle = 'rgba(150,235,245,0.45)'; ctx.lineWidth = 1.1; ctx.setLineDash([2.2, 2.2]);
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.45, r * 1.05, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      // mirror cracks as it weakens
      if (this.phase >= 2) {
        ctx.strokeStyle = 'rgba(200,250,255,0.75)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.5); ctx.lineTo(-r * 0.2, -r * 0.1); ctx.lineTo(-r * 0.45, r * 0.4);
        if (this.phase >= 3) { ctx.moveTo(-r * 0.2, -r * 0.1); ctx.lineTo(r * 0.5, -r * 0.6); ctx.moveTo(r * 0.2, r * 0.3); ctx.lineTo(r * 0.7, r * 0.5); }
        ctx.stroke();
      }
    }
    // outline + a pale mirror rim so it reads against the dark
    ctx.strokeStyle = col(white, INK); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    if (!white) {
      ctx.strokeStyle = 'rgba(200,190,230,0.7)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, r - 1.5, -2.6, -1.2); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,220,235,0.5)';
      ctx.beginPath(); ctx.arc(0, 0, r - 1.5, 0.4, 1.4); ctx.stroke();
    }
    // face: glowing eyes where Bead's are dark
    if (!white) {
      const f = b.facing;
      const lookY = Math.max(-2, Math.min(2.5, b.vy / 350));
      const ex = f * r * 0.22, ey = -r * 0.08 + lookY, er = r * 0.2;
      for (const s of [-1, 1]) {
        const exx = ex + s * r * 0.36 + (s === f ? f * 0.6 : 0);
        if (this.eyeOpen < 0.5) {
          ctx.strokeStyle = 'rgba(150,235,245,0.7)'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(exx - er * 0.7, ey); ctx.quadraticCurveTo(exx, ey + er * 0.5, exx + er * 0.7, ey); ctx.stroke();
        } else {
          const hot = this.cue > 0 || this.charging;
          eye(ctx, exx, ey, er * 0.7, hot ? '#ffffff' : '#bff4ff', true);
          ctx.fillStyle = hot ? '#ffffff' : '#d8fbff';
          ctx.beginPath(); ctx.ellipse(exx, ey, er * 0.82, er * 1.25, 0, 0, TAU); ctx.fill();
          // its glint sits low and on the wrong side: a mirror of Bead's
          ctx.fillStyle = '#141019';
          ctx.beginPath(); ctx.arc(exx + er * 0.25, ey + er * 0.5, er * 0.3, 0, TAU); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  drawExtra(ctx, t) {
    for (const { m, k } of liveMarks(this)) {
      if (m.type === 'copy') {
        // a mirrored ripple: it is about to do what you just did
        ctx.strokeStyle = `rgba(200,250,255,${0.8 * (1 - k)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(this.cx, this.cy, 30 * (1 - k) + 8, 40 * (1 - k) + 10, 0, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(this.cx, this.cy - 50 * (1 - k) - 14); ctx.lineTo(this.cx, this.cy + 50 * (1 - k) + 14); ctx.stroke();
      }
    }
  }
}

export default { prismwarden: PrismWarden, reflection: Reflection };
