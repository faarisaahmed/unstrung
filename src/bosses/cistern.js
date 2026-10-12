// Bosses of area 'cistern' (Brine Cistern): Gullet the leviathan eel and the Brine Matron.
import { Boss, registerMinion } from './boss.js';
import { Projectile, registerProjectileArt } from '../entities/projectile.js';
import { TILE } from '../core/constants.js';
import { TAU, clamp } from '../core/math.js';
import { INK, eye } from '../art/creatures.js';

// ------------------------------------------------------------------ shared helpers
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const approach = (v, to, rate, dt) => v + (to - v) * Math.min(1, rate * dt);

function groundAt(room, x, y0) {
  const rows = Math.floor(room.pxH / TILE);
  for (let ty = Math.max(0, Math.floor(y0 / TILE)); ty < rows; ty++) if (room.rectBlocked(x - 2, ty * TILE + 2, 4, 4)) return ty * TILE;
  return room.pxH - TILE;
}

// Top of the water ('~' or '!') inside the arena, or null if the arena is dry.
function waterSurface(room, A) {
  let best = null;
  for (let i = 1; i < 8; i++) {
    const x = A.x + (A.w * i) / 8;
    for (let y = A.y + TILE / 2; y < A.y + A.h; y += TILE) {
      const c = room.charAtPx(x, y);
      if (c === '~' || c === '!') { const top = Math.floor(y / TILE) * TILE; best = best === null ? top : Math.max(best, top); break; }
    }
  }
  return best;
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

function drawBossLayers(b, ctx, t) {
  const dying = b.mode === 'dying';
  if (dying) { ctx.save(); ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5); }
  b.drawBody(ctx, t, false);
  if (b.flashT > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6;
    b.drawBody(ctx, t, true);
    ctx.restore();
  }
  if (b.tele > 0 && b.teleAt) {
    const k = Math.min(1, b.tele / 0.35);
    glow(ctx, b.teleAt.x, b.teleAt.y, b.teleAt.r * (1.15 - 0.15 * k), b.teleAt.rgb || '220,250,255', 0.45 * k);
  }
  if (dying) ctx.restore();
  if (b.drawExtra) b.drawExtra(ctx, t);
}

// ------------------------------------------------------------------ projectile art
registerProjectileArt('gl_spout', (ctx, p, t) => {
  const r = p.rect();
  const k = Math.min(1, p.age / 0.1) * Math.min(1, p.life / 0.2);
  const h = r.h * Math.min(1, p.age / 0.12);
  const y0 = r.y + r.h - h;
  ctx.save();
  ctx.fillStyle = `rgba(22,20,28,${0.9 * k})`;
  ctx.beginPath(); ctx.moveTo(r.x + 4, r.y + r.h); ctx.quadraticCurveTo(r.x + r.w * 0.2, y0 + 20, r.x + r.w / 2, y0); ctx.quadraticCurveTo(r.x + r.w * 0.8, y0 + 20, r.x + r.w - 4, r.y + r.h); ctx.closePath(); ctx.fill();
  const g = ctx.createLinearGradient(0, y0, 0, r.y + r.h);
  g.addColorStop(0, `rgba(230,250,255,${0.95 * k})`); g.addColorStop(1, `rgba(90,170,200,${0.9 * k})`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(r.x + 8, r.y + r.h); ctx.quadraticCurveTo(r.x + r.w * 0.25, y0 + 22, r.x + r.w / 2, y0 + 4); ctx.quadraticCurveTo(r.x + r.w * 0.75, y0 + 22, r.x + r.w - 8, r.y + r.h); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${0.7 * k})`; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) { const x = r.x + r.w * (0.3 + i * 0.2) + Math.sin(t * 20 + i) * 3; ctx.beginPath(); ctx.moveTo(x, y0 + 20 + i * 10); ctx.lineTo(x, r.y + r.h); ctx.stroke(); }
  // crown of spray
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.4; ctx.fillStyle = `rgba(235,250,255,${0.85 * k})`; ctx.beginPath(); ctx.arc(r.x + r.w / 2 + Math.cos(a) * 18, y0 + 6 + Math.sin(a) * 10 + Math.sin(t * 30 + i) * 3, 5, 0, TAU); ctx.fill(); }
  ctx.restore();
});

registerProjectileArt('gl_wave', (ctx, p, t) => {
  const r = p.rect();
  const d = Math.sign(p.vx) || 1;
  const x0 = r.x, x1 = r.x + r.w, y1 = r.y + r.h, top = r.y - 4;
  const front = d > 0 ? x1 : x0, back = d > 0 ? x0 : x1;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(back - d * 20, y1);
  ctx.quadraticCurveTo(back + d * r.w * 0.3, top + 6, front - d * 8, top);
  ctx.quadraticCurveTo(front + d * 6, top + 4, front, y1);
  ctx.closePath();
  ctx.fillStyle = 'rgba(70,150,180,0.9)'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(235,250,255,0.9)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(back + d * r.w * 0.2, top + 14); ctx.quadraticCurveTo(back + d * r.w * 0.5, top + 2, front - d * 6, top + 2); ctx.stroke();
  for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(235,250,255,0.8)'; ctx.beginPath(); ctx.arc(front - d * (4 + i * 6), top - 2 + Math.sin(t * 25 + i) * 3, 2.5, 0, TAU); ctx.fill(); }
  ctx.restore();
});

registerProjectileArt('bm_bubble', (ctx, p, t) => {
  const r = p.r * (1 + Math.sin(p.age * 9 + (p.ph || 0)) * 0.06);
  ctx.save();
  ctx.fillStyle = 'rgba(150,220,235,0.28)';
  ctx.beginPath(); ctx.arc(p.cx, p.cy, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(210,250,255,0.9)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(p.cx, p.cy, r - 2.5, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(p.cx - r * 0.35, p.cy - r * 0.4, r * 0.18, 0, TAU); ctx.fill();
  ctx.restore();
});

registerProjectileArt('bm_tide', (ctx, p, t) => {
  const r = p.rect();
  const d = p.o.dir || 1;
  const front = d > 0 ? r.x + r.w : r.x, back = d > 0 ? r.x - 60 : r.x + r.w + 60;
  const y1 = r.y + r.h, top = r.y;
  ctx.save();
  // body of the wave with a curling lip
  ctx.beginPath();
  ctx.moveTo(back, y1);
  ctx.quadraticCurveTo(back + d * 40, top + r.h * 0.4, front - d * 26, top);
  ctx.quadraticCurveTo(front + d * 10, top - 6, front + d * 4, top + 22);
  ctx.quadraticCurveTo(front - d * 14, top + 26, front - d * 6, top + 38);
  ctx.quadraticCurveTo(front + d * 6, top + 60, front + d * 2, y1);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, top, 0, y1);
  g.addColorStop(0, '#5fb4c8'); g.addColorStop(1, '#1d4a62');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
  // foam
  ctx.strokeStyle = 'rgba(240,252,255,0.95)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(front - d * 50, top + 14); ctx.quadraticCurveTo(front - d * 20, top + 2, front + d * 2, top + 18); ctx.stroke();
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) { const yy = top + 30 + i * 14; ctx.beginPath(); ctx.moveTo(back + d * (30 + i * 10), yy + 10); ctx.quadraticCurveTo(back + d * (60 + i * 12), yy, front - d * (20 + i * 4), yy + 4 + Math.sin(t * 8 + i) * 3); ctx.stroke(); }
  for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(240,252,255,0.85)'; ctx.beginPath(); ctx.arc(front - d * (i * 9) + Math.sin(t * 20 + i) * 3, top - 4 + Math.cos(t * 17 + i * 2) * 4, 3, 0, TAU); ctx.fill(); }
  ctx.restore();
});

// Slow, wobbling, buoyant bubble.
class Bubble extends Projectile {
  constructor(game, x, y, vx, vy, opts) {
    super(game, x, y, vx, vy, Object.assign({ art: 'bm_bubble', r: 11, life: 4.6, dmg: 1, color: '#bfefff' }, opts));
    this.ph = Math.random() * TAU;
  }
  update(dt) {
    this.age += dt; this.life -= dt;
    if (this.life <= 0) return this.die(true);
    this.vy = Math.min(this.vy + (this.o.g ?? 240) * dt, this.o.term ?? 75);
    this.vx *= 1 - 0.7 * dt;
    const wob = Math.sin(this.age * 5 + this.ph) * 28;
    this.x += (this.vx + wob) * dt; this.y += this.vy * dt;
    if (this.room.rectBlocked(this.x + 3, this.y + 3, this.w - 6, this.h - 6)) return this.die(true);
  }
  die(impact) {
    if (this.dead) return;
    this.dead = true;
    this.game.fx.ring(this.cx, this.cy, 2, this.r * 1.6, 0.2, 'rgba(210,250,255,0.9)', 2);
    if (impact) this.game.fx.burst(this.cx, this.cy, 4, { color: '#d8f6ff', speed: 120, size: 2, life: 0.25 });
  }
}

// =================================================================================================
// GULLET — The Cistern Leviathan. A vast eel that lives under the water line (or, in a dry arena,
// beneath the floor). Its head drives a path; the body follows that path exactly, so every breach
// draws a readable arc. Phase 2 climbs the walls and drops from the ceiling.
// =================================================================================================
const G_SEG = 28, G_SP = 19;

export class Gullet extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'gullet', size: [90, 70], music: 'boss_mid', air: true, glints: 170, introTime: 3.0 });
    if (this.dead) return;
    this.noPhysics = true;
    const A = this.arena, room = game.room;
    this.mx = A.x + A.w / 2;
    this.floor = groundAt(room, this.mx, ty * TILE);
    const ws = waterSurface(room, A);
    this.W = ws !== null && ws < this.floor ? ws : this.floor;
    this.groundY = this.W;
    this.deep = Math.max(this.W, this.floor) + 160;
    this.baseSpeed = this.speedMul;
    this.hx = this.mx; this.hy = this.deep;
    this.ha = 0; this.jaw = 0; this.jawTo = 0; this.tilt = 0; this.bulge = 0;
    this.path = [];
    for (let k = 0; k < 160; k++) this.path.push({ x: this.hx - k * 5, y: this.deep });
    this.segs = [];
    this.ripples = [];
    this.spouts = [];
    this.tail = null;
    this.flip = 1;
    this.prevHy = this.hy;
    this.count = 0;
    this.layoutBody();
    this.syncRect();
  }

  radius(i) { const k = i / (G_SEG - 1); return 31 * (1 - k * 0.8) + (i < 3 ? 3 - i : 0); }

  // ---------- body ----------
  layoutBody() {
    const h = { x: this.hx, y: this.hy };
    const p0 = this.path[0];
    if (!p0 || Math.hypot(h.x - p0.x, h.y - p0.y) >= 3) this.path.unshift(h);
    else { p0.x = h.x; p0.y = h.y; }
    if (this.path.length > 420) this.path.length = 420;
    const segs = [];
    let need = 34, acc = 0;
    for (let j = 1; j < this.path.length && segs.length < G_SEG; j++) {
      const a = this.path[j - 1], b = this.path[j];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      while (d > 0 && acc + d >= need && segs.length < G_SEG) {
        const k = (need - acc) / d;
        segs.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
        need += G_SP;
      }
      acc += d;
    }
    while (segs.length < G_SEG) { const l = segs[segs.length - 1] || h; segs.push({ x: l.x - 4, y: l.y }); }
    for (let i = 0; i < segs.length; i++) segs[i].r = this.radius(i);
    this.segs = segs;
    const s0 = segs[0];
    this.ha = Math.atan2(h.y - s0.y, h.x - s0.x);
    // keep the mask on top: hysteresis on facing
    const c = Math.cos(this.ha);
    if (c > 0.2) this.flip = 1; else if (c < -0.2) this.flip = -1;
  }
  syncRect() { this.x = this.hx - 45; this.y = this.hy - 35; this.w = 90; this.h = 70; }
  headOut() { return this.hy < this.W - 6; }

  hurtboxes() {
    if (this.mode !== 'fight') return [];
    const out = [];
    if (this.hy < this.W + 10) out.push({ x: this.hx - 46, y: this.hy - 38, w: 92, h: 76 });
    for (let i = 1; i < this.segs.length; i += 2) {
      const s = this.segs[i];
      if (s.y < this.W - 4 && s.y > this.arena.y - 40) out.push({ x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 });
    }
    if (this.tail && this.tail.rise > 0.2) out.push(...this.tailBoxes());
    return out;
  }
  hurtbox() { return this.hurtboxes()[0] || { x: -9999, y: -9999, w: 0, h: 0 }; }
  hitboxes() {
    const out = [];
    if (this.hy < this.W - 4) out.push({ x: this.hx - 38, y: this.hy - 28, w: 76, h: 56 });
    for (let i = 0; i < this.segs.length; i += 2) {
      const s = this.segs[i];
      if (s.y < this.W - 6) { const r = s.r * 0.8; out.push({ x: s.x - r, y: s.y - r, w: r * 2, h: r * 2 }); }
    }
    if (this.tail && this.tail.rise > 0.2) out.push(...this.tailBoxes());
    return out.concat(this.hits);
  }
  tailPts() {
    const T = this.tail, L = 210 * T.rise;
    const bx = T.x, by = this.W + 10;
    const tx = bx + Math.sin(T.ang) * L, ty = by - Math.cos(T.ang) * L;
    const cx = bx + Math.sin(T.ang * 0.5) * L * 0.55 - T.dir * 20, cy = by - Math.cos(T.ang * 0.5) * L * 0.55;
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const k = i / 8;
      pts.push({ x: (1 - k) * (1 - k) * bx + 2 * (1 - k) * k * cx + k * k * tx, y: (1 - k) * (1 - k) * by + 2 * (1 - k) * k * cy + k * k * ty, r: 20 * (1 - k * 0.7) });
    }
    return pts;
  }
  tailBoxes() {
    return this.tailPts().filter((p, i) => i % 2 === 0 && p.y < this.W - 4).map((p) => ({ x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 }));
  }

  // ---------- engine hooks ----------
  update(dt) {
    this.dt = dt;
    super.update(dt);
    if (this.mode === 'dying') this.dyingStep(dt);
  }
  idle(dt) { this.animate(dt); }
  introUpdate(dt, t) {
    // a single great breach across the middle of the arena
    const A = this.arena, x0 = this.mx - 280, x1 = this.mx + 280;
    if (t < 0.7) { this.hx = x0 - 60; this.hy = this.deep; if (!this.introRip) { this.introRip = true; this.ripple(x0, 0.8, 1.4); this.ripple(x1, 0.8, 0.8); } }
    else if (t < 2.3) {
      const k = (t - 0.7) / 1.6;
      const apex = Math.min(300, this.W - A.y - 110);
      this.hx = lerp(x0, x1, k); this.hy = this.W + 80 - 4 * k * (1 - k) * (apex + 80);
      this.jawTo = k > 0.3 && k < 0.6 ? 1 : 0;
      if (k > 0.3 && !this.introRoar) { this.introRoar = true; this.shake(8, 0.8); }
    } else { this.hx = approach(this.hx, x1 + 120, 4, dt); this.hy = approach(this.hy, this.deep, 4, dt); }
    this.animate(dt);
  }
  think(dt) { this.animate(dt); }

  onPhase(n) {
    this.speedMul = this.baseSpeed * (1 + 0.1 * (n - 1));
    this.sfx('bossRoar'); this.shake(8, 0.7);
    this.ripple(this.hx, 0.8, 1.6);
  }
  onDeath() {
    this.tail = null; this.spouts.length = 0;
    this.dieFrom = { x: clamp(this.hx, this.arena.x + 120, this.arena.x + this.arena.w - 120) };
    this.jawTo = 1;
  }
  dyingStep(dt) {
    // rears up out of the water, thrashes, and collapses across the surface
    const k = this.dieT;
    const tx = this.dieFrom.x + Math.sin(k * 9) * 30 * Math.max(0, 1 - k / 1.6);
    const ty = k < 0.9 ? this.W - 230 : this.W - 230 + Math.min(1, (k - 0.9) / 0.9) * 196;
    this.hx = approach(this.hx, tx, 5, dt); this.hy = approach(this.hy, ty, 5, dt);
    if (k > 1.5) this.jawTo = 0.3;
    this.animate(dt);
  }

  // ---------- per-frame ----------
  animate(dt) {
    const A = this.arena;
    this.hx = clamp(this.hx, A.x + 30, A.x + A.w - 30);
    this.hy = Math.max(this.hy, A.y + 40);
    this.jaw = approach(this.jaw, this.jawTo, 14, dt);
    this.bulge = Math.max(0, this.bulge - dt * 1.5);
    this.tilt = approach(this.tilt, this.tiltTo || 0, 6, dt);
    this.layoutBody();
    // splashes where the head crosses the surface
    if ((this.prevHy - this.W) * (this.hy - this.W) < 0) this.splash(this.hx, Math.abs(this.hy - this.prevHy) / Math.max(dt, 1e-3));
    this.prevHy = this.hy;
    const tl = this.segs[this.segs.length - 1];
    if (this.prevTail && (this.prevTail - this.W) * (tl.y - this.W) < 0) this.splash(tl.x, 300, 0.5);
    this.prevTail = tl.y;
    for (const r of this.ripples) r.life -= dt;
    this.ripples = this.ripples.filter((r) => r.life > 0);
    if (this.mode === 'fight') {
      for (const s of this.spouts) {
        if (s.warn > 0) {
          s.warn -= dt;
          if (Math.random() < 0.6) this.fx.add({ x: s.x + this.rand(-20, 20), y: this.W - 2, vx: this.rand(-30, 30), vy: -this.rand(80, 220), life: 0.4, size: this.rand(2, 4), color: 'rgba(200,240,250,0.85)', g: 700 });
          if (s.warn <= 0) {
            this.zone(s.x - 30, this.W - s.h, 60, s.h, 0.6, { art: 'gl_spout' });
            this.splash(s.x, 600, 1); this.shake(3, 0.12);
          }
        }
      }
      this.spouts = this.spouts.filter((s) => s.warn > 0);
    }
    // ambient: bubbles rising where the head lurks
    if (this.hy > this.W && Math.random() < 0.05 && this.mode !== 'dormant') this.ripple(this.hx + this.rand(-30, 30), 0.6, 0.4);
    // dripping water from the emerged body
    if (Math.random() < 0.35) {
      const s = this.segs[Math.floor(Math.random() * this.segs.length)];
      if (s.y < this.W - 20) this.fx.add({ x: s.x, y: s.y + s.r * 0.6, vx: 0, vy: 40, life: 0.6, size: 1.8, color: 'rgba(170,225,240,0.8)', g: 900 });
    }
    this.syncRect();
  }

  splash(x, speed = 500, scale = 1) {
    const n = Math.round(10 * scale);
    this.fx.burst(x, this.W - 2, n, { color: '#d8f4ff', speed: Math.min(520, 160 + speed * 0.4), angle: -Math.PI / 2, spread: 1.6, size: 3 * scale + 1, life: 0.6, g: 900 });
    this.fx.ring(x, this.W, 6, 50 * scale + 20, 0.35, 'rgba(210,245,255,0.8)', 3);
    this.sfx('splash');
  }
  ripple(x, life = 0.7, size = 1) { this.ripples.push({ x, life, max: life, size }); }

  // ---------- movement helpers ----------
  *headTo(x, y, speed) {
    for (;;) {
      const dx = x - this.hx, dy = y - this.hy, d = Math.hypot(dx, dy);
      const step = speed * this.speedMul * this.dt;
      if (d <= step) { this.hx = x; this.hy = y; return; }
      this.hx += (dx / d) * step; this.hy += (dy / d) * step;
      yield;
    }
  }
  // quadratic bezier from current head pos through control (cx,cy) to (x,y) at ~speed px/s
  *headCurve(cx, cy, x, y, speed) {
    const x0 = this.hx, y0 = this.hy;
    const L = Math.hypot(cx - x0, cy - y0) + Math.hypot(x - cx, y - cy);
    const T = L / (speed * this.speedMul);
    let t = 0;
    while (t < T) {
      t += this.dt; const k = Math.min(1, t / T), m = 1 - k;
      this.hx = m * m * x0 + 2 * m * k * cx + k * k * x; this.hy = m * m * y0 + 2 * m * k * cy + k * k * y;
      yield;
    }
  }
  *submergeTo(x) {
    if (this.hy < this.W + 60) yield* this.headTo(this.hx + (x > this.hx ? 40 : -40), this.deep, 800);
    yield* this.headTo(x, this.deep, 1100);
  }
  roomy(x) { const A = this.arena; return x - A.x > A.x + A.w - x ? -1 : 1; }

  // ---------- attacks ----------
  attackList() {
    const ph = this.phase;
    return [
      { name: 'breach', w: 3, fn: this.breach },
      { name: 'strike', w: 3, fn: this.strike },
      { name: 'spit', w: 2, fn: this.spit },
      { name: 'geysers', w: 2, fn: this.geysers },
      { name: 'tail', w: 2.5, fn: this.tailSlam },
      { name: 'wall', w: 3, fn: this.wallClimb, cond: () => ph >= 2 },
    ];
  }
  chooseAttack() { if (++this.count === 1) return this.breach(); return super.chooseAttack(); }

  // 1. Breach: ripples mark where it will burst out and where it will dive back in.
  *breach() {
    const A = this.arena, p = this.player;
    const n = this.phase >= 3 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const x0 = clamp(p.cx + this.rand(-30, 30), A.x + 90, A.x + A.w - 90);
      const dir = this.roomy(x0);
      const x1 = clamp(x0 + dir * (440 + 40 * this.phase), A.x + 60, A.x + A.w - 60);
      yield* this.submergeTo(x0 - dir * 70);
      this.ripple(x0, 0.75, 1.4); this.ripple(x1, 0.75, 0.9);
      this.sfx('rustle');
      yield 0.75;
      const apex = Math.min(310, this.W - A.y - 110);
      const T = 1.1 / this.speedMul;
      let t = 0;
      this.jawTo = 1;
      while (t < T) {
        t += this.dt; const k = Math.min(1, t / T);
        this.hx = lerp(x0 - dir * 30, x1, k); this.hy = this.W + 70 - 4 * k * (1 - k) * (apex + 70);
        if (k > 0.55) this.jawTo = 0;
        yield;
      }
      if (this.phase >= 2) for (let j = 0; j < 6; j++) this.fire(x1, this.W - 10, this.rand(-260, 260), -this.rand(380, 600), { gravity: 1100, art: 'glob', color: '#9fe0f0', r: 7, life: 3 });
      yield* this.headTo(x1 + dir * 60, this.deep, 900);
      yield i < n - 1 ? 0.2 : 0.6;
    }
  }

  // 2. Strike: rises beside Bead, rears with jaws wide, then lunges and dives through where Bead stood.
  *strike() {
    const A = this.arena, p = this.player;
    let s = p.cx < this.mx ? 1 : -1;
    let xr = p.cx + s * 330;
    if (xr < A.x + 80 || xr > A.x + A.w - 80) { s = -s; xr = p.cx + s * 330; }
    xr = clamp(xr, A.x + 80, A.x + A.w - 80);
    yield* this.submergeTo(xr);
    this.ripple(xr, 0.5, 1.1);
    yield 0.5;
    yield* this.headTo(xr, this.W - 150, 900);
    this.jawTo = 1; this.tiltTo = 0;
    this.teleAt = { x: this.hx, y: this.hy, r: 110 }; this.tele = this.phase >= 3 ? 0.45 : 0.55;
    this.sfx('screech');
    // sway while aiming
    let t = 0; const T = (this.phase >= 3 ? 0.45 : 0.55) / this.speedMul;
    while (t < T) { t += this.dt; this.hx = xr + Math.sin(t * 18) * 3 + (xr < p.cx ? -1 : 1) * 30 * (t / T); this.hy = this.W - 150 - 20 * (t / T); yield; }
    const tx = clamp(p.cx, A.x + 40, A.x + A.w - 40), ty = clamp(p.cy, A.y + 60, this.W - 16);
    const dir = tx < this.hx ? -1 : 1;
    this.sfx('whip');
    yield* this.headCurve(lerp(this.hx, tx, 0.5), Math.min(this.hy, ty) - 60, tx, ty, 1100);
    this.jawTo = 0; this.sfx('slash');
    this.zone(tx - 40, ty - 30, 80, 60, 0.12);
    this.fx.slash(tx, ty, dir > 0 ? 0 : Math.PI, 70, 'rgba(220,250,255,0.9)', 0.15);
    yield* this.headCurve(tx + dir * 60, ty + 10, tx + dir * 110, this.deep, 800);
    yield 0.45;
  }

  // 3. Spit: rises like a pillar and lobs heavy water globs at Bead.
  *spit() {
    const A = this.arena, p = this.player;
    const xr = clamp(p.cx + (p.cx < this.mx ? 1 : -1) * this.rand(280, 420), A.x + 80, A.x + A.w - 80);
    yield* this.submergeTo(xr);
    this.ripple(xr, 0.45, 1);
    yield 0.45;
    yield* this.headTo(xr, this.W - 170, 800);
    const vols = this.phase >= 3 ? 2 : 1;
    for (let v = 0; v < vols; v++) {
      this.bulge = 1; this.jawTo = 0.4;
      this.teleAt = { x: this.hx, y: this.hy, r: 90 }; this.tele = 0.5;
      this.sfx('charge');
      yield 0.5;
      this.jawTo = 1;
      const n = this.phase >= 2 ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const tx = this.player.cx + (i - (n - 1) / 2) * 90, T = 0.95, g = 1000;
        const mx = this.hx + Math.cos(this.ha) * 40, my = this.hy;
        this.fire(mx, my, (tx - mx) / T, (this.W - my) / T - 0.5 * g * T, { gravity: g, art: 'glob', color: '#9fe0f0', r: 10, life: 3 });
      }
      this.sfx('spit');
      yield 0.25; this.jawTo = 0;
      yield 0.5;
    }
    yield* this.headTo(xr, this.deep, 700);
    yield 0.3;
  }

  // 4. Geysers: bubbling marks on the surface erupt into tall columns of water.
  *geysers() {
    const A = this.arena, p = this.player;
    yield* this.submergeTo(clamp(p.cx, A.x + 60, A.x + A.w - 60));
    const h = Math.min(280, this.W - A.y - 40);
    if (this.phase >= 3 && Math.random() < 0.5) {
      const dir = p.cx < this.mx ? 1 : -1;
      const n = Math.floor(A.w / 160);
      for (let i = 0; i < n; i++) {
        const x = dir > 0 ? A.x + 60 + i * 160 : A.x + A.w - 60 - i * 160;
        this.spouts.push({ x, warn: 0.75 + i * 0.16, h });
      }
      yield 0.75 + n * 0.16 + 0.6;
    } else {
      const xs = [clamp(p.cx, A.x + 40, A.x + A.w - 40)];
      const extra = this.phase >= 2 ? 4 : 2;
      for (let i = 0; i < extra; i++) xs.push(clamp(p.cx + this.pick([-1, 1]) * this.rand(140, 420), A.x + 40, A.x + A.w - 40));
      xs.forEach((x, i) => this.spouts.push({ x, warn: 0.8 + i * 0.1, h }));
      yield 1.5;
      if (this.phase >= 2) { this.spouts.push({ x: clamp(this.player.cx, A.x + 40, A.x + A.w - 40), warn: 0.7, h }); yield 1.2; }
    }
    yield 0.4;
  }

  // 5. Tail slam: the tail rises from the water, cocks back, and slams the surface, sending waves out.
  *tailSlam() {
    const A = this.arena, p = this.player;
    const n = this.phase;
    for (let i = 0; i < n; i++) {
      const dir = p.cx < this.mx ? -1 : 1; // slam toward Bead's side
      const xt = clamp(p.cx - dir * 200 + this.rand(-30, 30), A.x + 60, A.x + A.w - 60);
      const hit = clamp(xt + dir * 205, A.x + 40, A.x + A.w - 40);
      yield* this.submergeTo(xt - dir * 260);
      this.ripple(xt, 0.5, 1); this.ripple(hit, 1.1, 1.2);
      yield 0.4;
      this.tail = { x: xt, rise: 0, ang: 0, dir };
      let t = 0;
      while (t < 0.4) { t += this.dt; this.tail.rise = ease(Math.min(1, t / 0.4)); this.tail.ang = -dir * 0.3 * this.tail.rise; yield; }
      this.teleAt = { x: xt - dir * 40, y: this.W - 200, r: 110 }; this.tele = 0.5;
      this.sfx('charge');
      t = 0;
      while (t < 0.5 / this.speedMul) { t += this.dt; this.tail.ang = approach(this.tail.ang, -dir * 0.55, 6, this.dt); yield; }
      // slam
      t = 0;
      const a0 = this.tail.ang;
      while (t < 0.16) { t += this.dt; this.tail.ang = lerp(a0, dir * 1.45, Math.min(1, t / 0.16)); yield; }
      this.zone(hit - 70, this.W - 50, 140, 50, 0.12);
      this.splash(hit, 900, 1.6); this.shake(9, 0.35); this.sfx('slam');
      const sp = 360 + 50 * this.phase, wh = this.phase >= 3 ? 26 : 22;
      for (const d of [-1, 1]) this.fire(hit + d * 50, this.W - wh, d * sp, 0, { art: 'gl_wave', r: wh, life: 3.5, pierce: true, noScale: false });
      yield 0.35;
      t = 0;
      while (t < 0.3) { t += this.dt; this.tail.rise = 1 - t / 0.3; yield; }
      this.tail = null;
      yield 0.25;
    }
    yield 0.4;
  }

  // 6. Wall climb (phase 2+): slithers up a wall and across the ceiling, then drops onto Bead.
  *wallClimb() {
    const A = this.arena, p = this.player;
    const s = p.cx < this.mx ? 1 : -1;
    const wx = s < 0 ? A.x + 34 : A.x + A.w - 34;
    const top = Math.max(A.y + 64, this.W - 380);
    yield* this.submergeTo(wx);
    this.ripple(wx, 0.6, 1.3);
    this.sfx('rustle');
    yield 0.6;
    yield* this.headTo(wx, top + 40, 720);
    yield* this.headCurve(wx, top, wx - s * 60, top, 600);
    // crawl along the ceiling, tracking Bead
    let t = 0;
    while (t < 1.1 && Math.abs(this.hx - p.cx) > 20) {
      t += this.dt;
      this.hx += Math.sign(p.cx - this.hx) * 520 * this.speedMul * this.dt; this.hy = top + Math.sin(t * 12) * 4;
      yield;
    }
    if (this.phase >= 3) {
      this.jawTo = 1; this.teleAt = { x: this.hx, y: this.hy, r: 90 }; this.tele = 0.4; yield 0.4;
      for (let i = -1; i <= 1; i++) this.fireAt(this.hx, this.hy + 20, 300, { art: 'glob', color: '#9fe0f0', r: 9, offset: i * 0.25, life: 3 });
      this.sfx('spit'); this.jawTo = 0;
      yield 0.3;
    }
    // hang, aim, drop
    this.jawTo = 1;
    const tx = clamp(p.cx, A.x + 50, A.x + A.w - 50);
    this.dropX = tx; this.dropT = 0.6;
    this.teleAt = { x: this.hx, y: this.hy, r: 120 }; this.tele = 0.6;
    this.sfx('screech');
    t = 0;
    while (t < 0.6 / this.speedMul) { t += this.dt; this.hx = approach(this.hx, tx, 10, this.dt); this.hy = top + 14 * (t / 0.6); yield; }
    this.dropT = 0;
    yield* this.headTo(tx, this.W - 6, 1250);
    this.jawTo = 0;
    this.shake(8, 0.3); this.sfx('slam');
    for (const d of [-1, 1]) this.fire(tx + d * 40, this.W - 22, d * 380, 0, { art: 'gl_wave', r: 22, life: 3.5, pierce: true });
    yield* this.headTo(tx + 10, this.deep, 900);
    yield 0.5;
  }

  // ---------- drawing ----------
  drawBody(ctx, t, white) {
    const A = this.arena;
    ctx.save();
    ctx.beginPath(); ctx.rect(A.x - 64, A.y - 300, A.w + 128, this.W - A.y + 300); ctx.clip();
    this.paintEel(ctx, t, white ? 'white' : 'normal');
    ctx.restore();
    if (!white && this.floor > this.W + 4) {
      ctx.save();
      ctx.beginPath(); ctx.rect(A.x - 64, this.W, A.w + 128, this.floor - this.W); ctx.clip();
      ctx.globalAlpha = 0.55;
      this.paintEel(ctx, t, 'shadow');
      ctx.restore();
    }
  }

  paintEel(ctx, t, mode) {
    const white = mode === 'white', shadow = mode === 'shadow';
    const C = (c) => (white ? '#fff' : shadow ? '#0a1820' : c);
    const K = white ? '#fff' : shadow ? '#0a1820' : INK;
    const segs = this.segs;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // normals
    const L = [], R = [];
    let hx = this.hx, hy = this.hy;
    const nrm = [];
    for (let i = 0; i < segs.length; i++) {
      const a = i === 0 ? { x: hx, y: hy } : segs[i - 1];
      const b = segs[i];
      let dx = a.x - b.x, dy = a.y - b.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      // dorsal side: perpendicular, chosen so the back is up when travelling right (flip handles left)
      const nx = dy * this.flip, ny = -dx * this.flip;
      nrm.push({ nx, ny, dx, dy });
      const und = Math.sin(t * 6 - i * 0.5) * 1.5;
      L.push({ x: b.x + nx * (b.r + und), y: b.y + ny * (b.r + und) });
      R.push({ x: b.x - nx * b.r, y: b.y - ny * b.r });
    }
    // dorsal fin (behind the body)
    if (!shadow) {
      ctx.fillStyle = C('#4a95a0');
      ctx.beginPath();
      const f0 = 2, f1 = segs.length - 3;
      ctx.moveTo(L[f0].x, L[f0].y);
      for (let i = f0; i <= f1; i++) {
        const s = segs[i], n = nrm[i];
        const fh = (16 + 10 * Math.sin(i * 0.6)) * (1 - i / segs.length) + 6 + Math.sin(t * 7 - i * 0.7) * 3;
        ctx.lineTo(s.x + n.nx * (s.r + fh), s.y + n.ny * (s.r + fh));
      }
      ctx.lineTo(L[f1].x, L[f1].y);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = K; ctx.lineWidth = 2.5; ctx.stroke();
      if (!white) {
        ctx.strokeStyle = 'rgba(22,20,28,0.6)'; ctx.lineWidth = 1.5;
        for (let i = f0 + 1; i < f1; i += 2) {
          const s = segs[i], n = nrm[i];
          const fh = (16 + 10 * Math.sin(i * 0.6)) * (1 - i / segs.length) + 6;
          ctx.beginPath(); ctx.moveTo(s.x + n.nx * s.r, s.y + n.ny * s.r); ctx.lineTo(s.x + n.nx * (s.r + fh), s.y + n.ny * (s.r + fh)); ctx.stroke();
        }
      }
    }
    // tail fluke
    {
      const e = segs[segs.length - 1], n = nrm[nrm.length - 1];
      ctx.fillStyle = C('#3c7d8c');
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      const sw = Math.sin(t * 6) * 0.3;
      ctx.quadraticCurveTo(e.x - n.dx * 30 + n.nx * 30, e.y - n.dy * 30 + n.ny * 30, e.x - n.dx * 46 + n.nx * (40 + sw * 20), e.y - n.dy * 46 + n.ny * (40 + sw * 20));
      ctx.quadraticCurveTo(e.x - n.dx * 30, e.y - n.dy * 30, e.x - n.dx * 46 - n.nx * (34 - sw * 20), e.y - n.dy * 46 - n.ny * (34 - sw * 20));
      ctx.quadraticCurveTo(e.x - n.dx * 24 - n.nx * 20, e.y - n.dy * 24 - n.ny * 20, e.x, e.y);
      ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 2.5; ctx.stroke();
    }
    // body ribbon
    ctx.beginPath();
    ctx.moveTo(L[0].x, L[0].y);
    for (let i = 1; i < L.length; i++) ctx.lineTo(L[i].x, L[i].y);
    for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y);
    ctx.closePath();
    ctx.fillStyle = C('#275a66'); ctx.fill();
    ctx.strokeStyle = K; ctx.lineWidth = 3.5; ctx.stroke();
    if (!white && !shadow) {
      // wet highlight along the back
      ctx.strokeStyle = 'rgba(170,235,240,0.35)'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < segs.length - 2; i++) { const s = segs[i], n = nrm[i]; const px = s.x + n.nx * s.r * 0.6, py = s.y + n.ny * s.r * 0.6; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
    }
    if (!white && !shadow) {
      // pale belly
      ctx.strokeStyle = '#7fa9a8'; ctx.lineWidth = 1;
      ctx.fillStyle = '#6f9c9c';
      ctx.beginPath();
      for (let i = 0; i < segs.length; i++) { const s = segs[i], n = nrm[i]; const px = s.x - n.nx * s.r * 0.45, py = s.y - n.ny * s.r * 0.45; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      for (let i = segs.length - 1; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(R[0].x, R[0].y); for (let i = 1; i < R.length; i++) ctx.lineTo(R[i].x, R[i].y); ctx.stroke();
      // ring bands
      ctx.strokeStyle = 'rgba(22,20,28,0.55)'; ctx.lineWidth = 1.6;
      for (let i = 1; i < segs.length - 1; i += 2) { ctx.beginPath(); ctx.moveTo(L[i].x, L[i].y); ctx.quadraticCurveTo(segs[i].x - nrm[i].dx * 6, segs[i].y - nrm[i].dy * 6, R[i].x, R[i].y); ctx.stroke(); }
      // glowing spots along the flank
      const pulse = 0.55 + 0.45 * Math.sin(t * 3);
      for (let i = 2; i < segs.length - 2; i += 2) {
        const s = segs[i], n = nrm[i];
        const px = s.x + n.nx * s.r * 0.35, py = s.y + n.ny * s.r * 0.35;
        const pp = 0.5 + 0.5 * Math.sin(t * 4 - i * 0.6);
        ctx.fillStyle = `rgba(160,250,255,${0.5 + 0.5 * pp})`;
        ctx.beginPath(); ctx.arc(px, py, Math.max(1.5, s.r * 0.16), 0, TAU); ctx.fill();
        if (i % 4 === 0) glow(ctx, px, py, s.r * 0.9, '120,240,255', 0.25 * pp * pulse);
      }
    }
    this.paintHead(ctx, t, white, shadow, C, K);
    if (this.tail) this.paintTail(ctx, t, C, K, white, shadow);
  }

  paintHead(ctx, t, white, shadow, C, K) {
    ctx.save();
    ctx.translate(this.hx, this.hy);
    ctx.rotate(this.ha + this.tilt);
    ctx.scale(1.2, this.flip < 0 ? -1.2 : 1.2);
    const jaw = this.jaw * 0.75;
    // barbels
    if (!shadow) {
      ctx.strokeStyle = C('#9cc8c4'); ctx.lineWidth = 2;
      for (const k of [0, 1]) {
        ctx.beginPath(); ctx.moveTo(40, 10 + k * 4);
        ctx.bezierCurveTo(30, 40 + k * 10 + Math.sin(t * 5 + k) * 8, -10, 46 + Math.sin(t * 4 + k) * 10, -40 - k * 14, 36 + Math.sin(t * 3 + k * 2) * 12);
        ctx.stroke();
      }
    }
    // lower jaw (hinged)
    ctx.save(); ctx.translate(-20, 8); ctx.rotate(jaw);
    ctx.fillStyle = C('#2a5262');
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(66, 2); ctx.quadraticCurveTo(70, 12, 60, 16); ctx.quadraticCurveTo(20, 22, -4, 14); ctx.closePath();
    ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
    if (!white && !shadow) {
      ctx.fillStyle = '#f2ecdc';
      for (let i = 0; i < 7; i++) { const x = 8 + i * 8.5; ctx.beginPath(); ctx.moveTo(x, 1 + i * 0.1); ctx.lineTo(x + 3, -9 + (i % 2) * 3); ctx.lineTo(x + 6, 1.5); ctx.closePath(); ctx.fill(); }
    }
    ctx.restore();
    // mouth interior
    if (this.jaw > 0.05 && !white && !shadow) {
      ctx.fillStyle = '#3a0f1a';
      ctx.beginPath(); ctx.moveTo(-18, 6); ctx.lineTo(56, 6); ctx.lineTo(56 * Math.cos(jaw) - 20, 8 + 56 * Math.sin(jaw)); ctx.closePath(); ctx.fill();
      glow(ctx, 20, 10 + jaw * 20, 26, '120,240,255', 0.4 * this.jaw);
    }
    // skull
    const bl = 1 + this.bulge * 0.12;
    ctx.fillStyle = C('#2c5c6a');
    ctx.beginPath();
    ctx.moveTo(-46, -20 * bl);
    ctx.quadraticCurveTo(-10, -40 * bl, 30, -24);
    ctx.quadraticCurveTo(58, -16, 66, 2);
    ctx.lineTo(-18, 8);
    ctx.quadraticCurveTo(-40, 22 * bl, -50, 10);
    ctx.closePath();
    ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3.5; ctx.stroke();
    if (!white && !shadow) {
      // upper teeth
      ctx.fillStyle = '#f2ecdc';
      for (let i = 0; i < 8; i++) { const x = -10 + i * 9; ctx.beginPath(); ctx.moveTo(x, 6.5); ctx.lineTo(x + 3, 15 - (i % 2) * 3); ctx.lineTo(x + 6, 6); ctx.closePath(); ctx.fill(); }
      // gill slits
      ctx.strokeStyle = 'rgba(22,20,28,0.8)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-38 + i * 7, -8); ctx.quadraticCurveTo(-41 + i * 7, 2, -37 + i * 7, 10); ctx.stroke(); }
    }
    // pale bony mask plate across the brow
    ctx.fillStyle = C('#e9e3d2');
    ctx.beginPath();
    ctx.moveTo(-30, -24 * bl);
    ctx.quadraticCurveTo(-4, -44 * bl, 30, -26);
    ctx.quadraticCurveTo(52, -18, 58, -4);
    ctx.quadraticCurveTo(30, -2, 14, -4);
    ctx.quadraticCurveTo(-10, -2, -26, -10);
    ctx.closePath();
    ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
    // crest spines behind the mask
    ctx.fillStyle = C('#e9e3d2');
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(-30 - i * 6, -22 + i * 2); ctx.lineTo(-44 - i * 8, -40 + i * 6 + Math.sin(t * 5 + i) * 2); ctx.lineTo(-34 - i * 6, -16 + i * 2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 2; ctx.stroke();
    }
    if (!white && !shadow) {
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(14, -18, 9, 6.5, -0.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(36, -14, 5, 4, -0.2, 0, TAU); ctx.fill();
      eye(ctx, 15, -18, 3.6, '#a8f8ff', true);
      eye(ctx, 36, -14, 2, '#a8f8ff', true);
      // mask ridge lines
      ctx.strokeStyle = 'rgba(22,20,28,0.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-20, -18); ctx.quadraticCurveTo(-2, -30, 4, -26); ctx.stroke();
      if (this.phase >= 2) { ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(-6, -36); ctx.lineTo(0, -26); ctx.lineTo(-4, -16); ctx.stroke(); }
      if (this.phase >= 3) { ctx.beginPath(); ctx.moveTo(40, -20); ctx.lineTo(46, -10); ctx.lineTo(52, -8); ctx.stroke(); }
    }
    ctx.restore();
  }

  paintTail(ctx, t, C, K, white, shadow) {
    const pts = this.tailPts();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // fluke at the tip
    const e = pts[pts.length - 1], q = pts[pts.length - 2];
    const a = Math.atan2(e.y - q.y, e.x - q.x);
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
    ctx.fillStyle = C('#3c7d8c');
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(20, -10, 46, -38 + Math.sin(t * 8) * 4); ctx.quadraticCurveTo(28, 0, 46, 38 - Math.sin(t * 8) * 4); ctx.quadraticCurveTo(20, 10, -6, 0); ctx.fill();
    ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i], n = pts[i + 1];
        ctx.strokeStyle = pass === 0 ? K : C('#1f4352');
        ctx.lineWidth = pass === 0 ? p.r * 2 + 6 : p.r * 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(n.x, n.y); ctx.stroke();
      }
    }
    if (!white && !shadow) {
      for (let i = 1; i < pts.length - 1; i += 2) { const p = pts[i]; ctx.fillStyle = 'rgba(160,250,255,0.8)'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, TAU); ctx.fill(); }
    }
  }

  drawExtra(ctx, t) {
    // surface ripples (telegraphs)
    for (const r of this.ripples) {
      const k = 1 - r.life / r.max;
      for (let i = 0; i < 3; i++) {
        const kk = (k + i / 3) % 1;
        ctx.strokeStyle = `rgba(200,245,255,${0.7 * (1 - kk) * Math.min(1, r.life * 4)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(r.x, this.W - 2, (12 + kk * 60) * r.size, (3 + kk * 6) * r.size, 0, 0, TAU); ctx.stroke();
      }
      if (Math.random() < 0.3 * r.size) this.fx.add({ x: r.x + this.rand(-16, 16) * r.size, y: this.W - 2, vx: 0, vy: -this.rand(40, 120), life: 0.35, size: this.rand(1.5, 3), color: 'rgba(210,245,255,0.8)', g: 300 });
    }
    // spout warnings
    for (const s of this.spouts) {
      const k = 1 - Math.min(1, s.warn / 0.8);
      ctx.fillStyle = `rgba(200,245,255,${0.25 + 0.4 * k})`;
      ctx.beginPath(); ctx.ellipse(s.x, this.W - 2, 18 + 14 * k, 5 + 2 * k, 0, 0, TAU); ctx.fill();
    }
    // drop column marker
    if (this.dropT > 0) {
      ctx.strokeStyle = 'rgba(200,245,255,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([8, 10]); ctx.lineDashOffset = -t * 60;
      ctx.beginPath(); ctx.moveTo(this.hx, this.hy + 30); ctx.lineTo(this.hx, this.W); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  draw(ctx, t) { drawBossLayers(this, ctx, t); }
}

// =================================================================================================
// BRINE MATRON — Mother of Tides. A great whelk-shelled hermit mother. Bubble curtains, tidal waves,
// a brood of crablings, and a shell she retreats into (then only a pogo from above gets through).
// =================================================================================================
registerMinion({
  id: 'matron_brood', name: 'Brineling', hp: 14, dmg: 1, size: [30, 22], behavior: 'hopper',
  params: { interval: 1.1, vx: 170, vy: 460, sight: 600 },
  art: { body: 'crab', c1: '#c96a50', c2: '#f0b090', c3: '#efe6d6', eye: '#bff6ff', glow: true }, weight: 1,
  journal: 'Each one hatched with a shell too big for it, and each one scuttles straight at whatever upsets its mother.',
});

export class BrineMatron extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'brinematron', size: [160, 128], music: 'boss_mid', glints: 180, introTime: 2.6 });
    if (this.dead) return;
    this.baseSpeed = this.speedMul;
    this.withdrawn = 1; this.withdrawTo = 1;
    this.claw = 0; this.clawTo = 0;   // -1 slammed, 0 rest, 1 raised
    this.rear = 0; this.rearTo = 0;
    this.siphon = 0;
    this.spin = 0; this.rolling = false;
    this.walk = 0;
    this.hitsTaken = 0;
    this.swells = [];
    this.marks = [];
  }

  // ---------- engine hooks ----------
  update(dt) {
    this.dt = dt;
    super.update(dt);
    if (this.mode === 'dying') { this.withdrawTo = 0.5; this.animate(dt); }
  }
  idle(dt) { this.animate(dt); }
  introUpdate(dt, t) {
    if (t > 0.6) this.withdrawTo = 0;
    if (t > 1.2 && t < 2.2) { this.clawTo = 1; this.rearTo = 1; } else if (t >= 2.2) { this.clawTo = 0; this.rearTo = 0; }
    if (t > 1.3 && !this.introBub) { this.introBub = true; this.sfx('splash'); this.fx.burst(this.mouth().x, this.mouth().y, 14, { color: '#d8f6ff', speed: 220, size: 3, life: 0.6, g: -200 }); }
    this.animate(dt);
  }
  think(dt) { this.animate(dt); }

  animate(dt) {
    this.withdrawn = approach(this.withdrawn, this.withdrawTo, 7, dt);
    this.claw = approach(this.claw, this.clawTo, this.clawTo < 0 ? 30 : 8, dt);
    this.rear = approach(this.rear, this.rearTo, 6, dt);
    this.siphon = Math.max(0, this.siphon - dt * 1.5);
    this.walk += Math.abs(this.vx) * dt * 0.06;
    if (this.rolling) this.spin += (this.vx || this.rollV || 0) * dt / 60;
    else this.spin = approach(this.spin, Math.round(this.spin / TAU) * TAU, 8, dt);
    for (const s of this.swells) s.t -= dt;
    this.swells = this.swells.filter((s) => s.t > 0);
    for (const m of this.marks) {
      m.t -= dt;
      if (m.t > 0 && Math.random() < 0.25) this.fx.add({ x: m.x + this.rand(-6, 6), y: this.arena.y + 4, vx: 0, vy: 80, life: 0.6, size: 2, color: 'rgba(200,190,170,0.8)', g: 400 });
      if (m.t <= 0 && !m.fired) {
        m.fired = true;
        this.fire(m.x, this.arena.y + 10, 0, 520, { gravity: 900, art: 'needle', color: '#e6dccb', r: 8, life: 3 });
      }
    }
    this.marks = this.marks.filter((m) => !m.fired);
    if (this.mode === 'fight' && Math.random() < 0.04) {
      const m = this.mouth();
      this.fx.add({ x: m.x, y: m.y, vx: this.facing * 20, vy: -40, life: 1.2, size: this.rand(2, 4), color: 'rgba(200,240,250,0.6)', g: -60 });
    }
  }

  mouth() { return { x: this.cx + this.facing * (62 + this.rear * 6), y: this.y + this.h - 54 - this.rear * 22 }; }

  bodyBox() { return { x: this.x + 12, y: this.y + 12, w: this.w - 24, h: this.h - 12 }; }
  hitboxes() {
    const b = this.bodyBox();
    // when tucked in and still, the shell's crown is safe to land on for a pogo
    const body = this.withdrawn > 0.5 && !this.rolling ? { x: b.x, y: b.y + 26, w: b.w, h: b.h - 26 } : b;
    return [body, ...this.hits];
  }
  shielded(p) { return this.withdrawn > 0.5 && !(p.attackDir === 'down' && p.cy < this.y + 20); }
  hurt(dmg, dir, src) {
    if (this.withdrawn > 0.5 && src !== 'bonk') {
      if (this.mode === 'fight') { this.sfx('clink'); this.fx.burst(this.cx, this.y + 20, 6, { color: '#fff', speed: 180, size: 2, life: 0.2 }); }
      return;
    }
    super.hurt(dmg, dir, src);
    if (this.withdrawn < 0.5) this.hitsTaken++;
    if (this.withdrawn > 0.5) this.fx.burst(this.cx, this.y + 10, 8, { color: '#f2e6d0', speed: 220, size: 3, life: 0.4, shape: 'shard' });
  }

  onPhase(n) {
    this.speedMul = this.baseSpeed * (1 + 0.1 * (n - 1));
    this.sfx('bossRoar'); this.shake(7, 0.7);
    this.rearTo = 1; this.clawTo = 1;
    setTimeout(() => { if (!this.dead) { this.rearTo = 0; if (this.clawTo === 1) this.clawTo = 0; } }, 700);
    this.fx.burst(this.mouth().x, this.mouth().y, 18, { color: '#d8f6ff', speed: 260, size: 3, life: 0.7, g: -150 });
  }
  onDeath() { this.rolling = false; this.vx = 0; this.marks.length = 0; this.swells.length = 0; }

  // ---------- attacks ----------
  attackList() {
    const ph = this.phase, alive = this.minions.filter((m) => !m.dead).length;
    return [
      { name: 'bubbles', w: 3, fn: this.bubbles },
      { name: 'claw', w: this.distX() < 300 ? 3.5 : 1.2, fn: this.crush },
      { name: 'tide', w: 2, fn: this.tide },
      { name: 'brood', w: 1.5, fn: this.brood, cond: () => alive < 2 },
      { name: 'retreat', w: 2, fn: this.retreat, cond: () => ph >= 2 },
      { name: 'rain', w: 2, fn: this.rain, cond: () => ph >= 3 },
    ];
  }
  chooseAttack() {
    if (this.hitsTaken >= 9) { this.hitsTaken = 0; this.lastAttack = 'retreat'; return this.retreat(); }
    return super.chooseAttack();
  }

  // 1. Bubble barrage: the siphon swells, then a fountain of heavy bubbles drifts down over the arena.
  *bubbles() {
    this.facePlayer();
    this.rearTo = 1; this.siphon = 1;
    const m0 = this.mouth();
    this.teleAt = { x: m0.x, y: m0.y, r: 80 }; this.tele = 0.55;
    this.sfx('charge');
    yield 0.55;
    const waves = this.phase >= 2 ? 2 : 1;
    for (let w = 0; w < waves; w++) {
      const n = 9 + this.phase * 2;
      for (let i = 0; i < n; i++) {
        const m = this.mouth();
        const a = -Math.PI / 2 + this.facing * (0.15 + (i / (n - 1)) * 1.1) + this.rand(-0.06, 0.06);
        const sp = this.rand(260, 420);
        this.game.add(new Bubble(this.game, m.x, m.y, Math.cos(a) * sp, Math.sin(a) * sp, { r: this.rand(9, 13), life: 4.2 + this.rand(0, 0.8) }));
        if (i % 3 === 0) this.sfx('splash');
        yield 0.05;
      }
      if (w < waves - 1) { this.facing = -this.facing; this.siphon = 1; yield 0.45; }
    }
    if (this.phase >= 3) {
      const m = this.mouth();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; this.game.add(new Bubble(this.game, m.x, m.y - 20, Math.cos(a) * 240, Math.sin(a) * 240, { r: 9, g: 120, term: 50, life: 3 })); }
    }
    this.rearTo = 0;
    yield 1.0;
  }

  // 2. Claw crush: scuttles in, raises the great claw (open), and brings it down in front of her.
  *crush() {
    this.facePlayer();
    let t = 0;
    while (t < 1.0 && this.distX() > 150) {
      this.facePlayer();
      if (this.hitWall) break;
      this.vx = this.facing * 240 * this.speedMul; t += this.dt; yield;
    }
    this.vx = 0;
    this.facePlayer();
    this.clawTo = 1; this.rearTo = 0.6;
    const cp = this.clawPos();
    this.teleAt = { x: cp.x, y: cp.y, r: 90 }; this.tele = 0.5;
    this.sfx('charge');
    yield 0.5;
    const n = this.phase >= 3 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      this.clawTo = -1; this.rearTo = 0;
      const fx = this.facing > 0 ? this.x + this.w - 20 : this.x - 120;
      this.zone(fx, this.groundY - 76, 140, 76, 0.14);
      this.sfx('slam'); this.shake(8, 0.3);
      this.fx.burst(this.cx + this.facing * 100, this.groundY, 14, { color: '#d8f6ff', speed: 280, angle: -Math.PI / 2, spread: 2.4, size: 3, life: 0.5 });
      if (this.phase >= 2) this.shockwave(this.cx + this.facing * 120, this.facing, 400, 30, { color: 'rgba(200,240,250,0.9)' });
      yield 0.4;
      if (i < n - 1) { this.facePlayer(); this.clawTo = 1; this.teleAt = { ...this.clawPos(), r: 80 }; this.tele = 0.38; yield 0.38; }
    }
    this.clawTo = 0;
    yield 0.6;
  }
  clawPos() { return { x: this.cx + this.facing * (100 - this.claw * 10), y: this.groundY - 40 - Math.max(0, this.claw) * 90 }; }

  // 3. Tidal wave: water swells at a wall, then a curling wave sweeps the floor (jump it).
  *tide() {
    const A = this.arena, p = this.player;
    this.rearTo = 1; this.clawTo = 1;
    this.sfx('bossRoar');
    const first = p.cx < this.mx() ? 1 : -1;  // wave from the wall farther from Bead
    const dirs = this.phase >= 3 ? [first, first, -first] : this.phase >= 2 ? [first, -first] : [first];
    const gaps = this.phase >= 3 ? [0, 0.75, 1.0] : [0, 1.1];
    for (let i = 0; i < dirs.length; i++) {
      const d = dirs[i];
      const x = d > 0 ? A.x : A.x + A.w;
      this.swells.push({ x, d, t: 0.9, max: 0.9 });
      this.shake(3, 0.9); this.sfx('splash');
      yield 0.9;
      const sp = (330 + 30 * this.phase) * Math.sqrt(this.speedMul);
      const h = 92, w = 96;
      this.game.add(new Projectile(this.game, x + d * w / 2, this.groundY, d * sp, 0, { art: 'bm_tide', r: 0, box: { w, h, oy: -h }, life: (A.w + w) / sp, pierce: true, ignoreWalls: true, dmg: 1, dir: d }));
      this.sfx('slam');
      if (i < dirs.length - 1) yield Math.max(0, gaps[i + 1] - 0.9);
    }
    this.rearTo = 0; this.clawTo = 0;
    yield 1.4;
  }
  mx() { return this.arena.x + this.arena.w / 2; }

  // 4. Brood: knocks on her shell and crablings spill out of the aperture.
  *brood() {
    this.facePlayer();
    this.rearTo = 0.5;
    this.teleAt = { x: this.cx, y: this.y + 40, r: 110 }; this.tele = 0.5;
    this.sfx('rustle');
    yield 0.5;
    const n = this.phase >= 2 ? 3 : 2;
    const ty = Math.floor(this.groundY / TILE) - 1;
    for (let i = 0; i < n; i++) {
      const tx = Math.floor((this.cx + this.facing * (70 + i * 26)) / TILE);
      const e = this.summon('matron_brood', tx, ty);
      if (e) { e.facing = this.facing; e.vx = this.facing * 200; e.vy = -300; }
      this.sfx('spit');
      yield 0.25;
    }
    this.rearTo = 0;
    yield 0.7;
  }

  // 5. Retreat: withdraws into the shell (armoured: only a pogo from above lands), rolls wall to wall
  //    in phase 2+, then sits spraying bubbles while Bead bounces on her crown.
  *retreat() {
    this.withdrawTo = 1; this.clawTo = 0; this.rearTo = 0;
    this.sfx('rustle');
    this.teleAt = { x: this.cx, y: this.cy, r: 120 }; this.tele = 0.45;
    yield 0.5;
    if (this.phase >= 2) {
      const rolls = this.phase >= 3 ? 2 : 1;
      for (let r = 0; r < rolls; r++) {
        this.facePlayer();
        // rattle in place: the roll is coming
        let t = 0;
        while (t < 0.45 / this.speedMul) { t += this.dt; this.spin = Math.sin(t * 40) * 0.12; yield; }
        this.rolling = true; this.rollV = this.facing * 520;
        this.sfx('dash');
        const res = yield* this.dashTo(this.facing, 500 + 60 * (this.phase - 2));
        this.rolling = false; this.rollV = 0;
        if (res === 'wall') {
          this.shake(9, 0.35); this.sfx('slam');
          this.fx.burst(this.facing > 0 ? this.x + this.w : this.x, this.cy, 14, { color: '#d8cbb0', speed: 260, size: 3, life: 0.5 });
          if (this.phase >= 3) this.dropBarnacles(3);
        }
        yield 0.35;
      }
    }
    // spray from the aperture while armoured
    const dur = 2.4;
    let t = 0, k = 0;
    while (t < dur) {
      t += this.dt;
      if (t > k * 0.32) {
        k++;
        const m = { x: this.cx + this.facing * 60, y: this.y + this.h - 46 };
        this.game.add(new Bubble(this.game, m.x, m.y, this.facing * this.rand(240, 340), -this.rand(60, 200), { r: 10, life: 3.2 }));
        if (this.phase >= 3) this.game.add(new Bubble(this.game, this.cx - this.facing * 60, m.y, -this.facing * this.rand(240, 340), -this.rand(60, 200), { r: 10, life: 3.2 }));
        this.sfx('splash');
      }
      yield;
    }
    this.withdrawTo = 0;
    this.sfx('rustle');
    yield 0.7;
  }
  dropBarnacles(n) {
    const A = this.arena;
    for (let i = 0; i < n; i++) this.marks.push({ x: clamp(this.player.cx + this.rand(-260, 260), A.x + 30, A.x + A.w - 30), t: 0.75 + i * 0.12 });
  }

  // 6. Spire rain (phase 3): she rattles the cistern; barnacles drop from the ceiling where dust falls.
  *rain() {
    const A = this.arena, p = this.player;
    this.rearTo = 1; this.clawTo = 1;
    this.shake(5, 0.6); this.sfx('slam');
    yield 0.3;
    for (let w = 0; w < 2; w++) {
      const xs = [clamp(p.cx, A.x + 30, A.x + A.w - 30)];
      while (xs.length < 6) {
        const x = this.rand(A.x + 30, A.x + A.w - 30);
        if (xs.every((q) => Math.abs(q - x) > 90)) xs.push(x);
      }
      xs.forEach((x, i) => this.marks.push({ x, t: 0.8 + i * 0.06 }));
      yield 1.0;
    }
    this.rearTo = 0; this.clawTo = 0;
    yield 0.9;
  }

  // ---------- drawing ----------
  drawBody(ctx, t, white) {
    const C = (c) => (white ? '#fff' : c), K = white ? '#fff' : INK;
    const f = this.facing, bx = this.cx, by = this.y + this.h;
    const out = 1 - this.withdrawn;
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(f, 1);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (!white) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 90, 8, 0, 0, TAU); ctx.fill(); }
    // walking legs (behind the shell)
    if (out > 0.05) {
      ctx.strokeStyle = K; ctx.lineWidth = 6;
      for (let i = 0; i < 4; i++) {
        const ph = this.walk * 6 + i * 1.7;
        const lift = Math.max(0, Math.sin(ph)) * 10 * (Math.abs(this.vx) > 10 ? 1 : 0.15);
        const hx = 20 + i * 12, hy = -30;
        const fx = hx + (i - 1.5) * 26 * out + Math.cos(ph) * 6, fy = -lift;
        const kx = (hx + fx) / 2 + 14, ky = hy - 26 * out;
        for (const pass of [0, 1]) {
          ctx.strokeStyle = pass ? C(i % 2 ? '#a5503e' : '#b85e46') : K; ctx.lineWidth = pass ? 4 : 7.5;
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(lerp(hx, kx, out), lerp(hy, ky, out)); ctx.lineTo(lerp(hx, fx, out), lerp(hy, fy, out)); ctx.stroke();
        }
      }
    }
    // small pincer (behind)
    if (out > 0.05) this.paintClaw(ctx, t, 62, -76 - this.rear * 16, 0.55 * out, -0.5 + Math.sin(t * 2) * 0.1, C, K, white, 0.3 + 0.2 * Math.sin(t * 3));
    // shell (rotates when rolling)
    ctx.save();
    ctx.translate(-14, -62);
    ctx.rotate(this.spin);
    this.paintShell(ctx, t, C, K, white);
    ctx.restore();
    // body emerging from the aperture
    if (out > 0.05) {
      ctx.save();
      ctx.translate(46, -48 - this.rear * 18);
      ctx.scale(out, out);
      // fleshy body
      ctx.fillStyle = C('#c9705a');
      ctx.beginPath(); ctx.ellipse(4, 6, 30, 26, 0.2, 0, TAU); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
      // siphon
      const sw = this.siphon;
      ctx.fillStyle = C('#e0a080');
      ctx.beginPath(); ctx.moveTo(18, 14); ctx.quadraticCurveTo(34, 18 + sw * 4, 40 + sw * 4, 6 - sw * 4); ctx.lineTo(32, 0); ctx.quadraticCurveTo(26, 8, 14, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (sw > 0.05 && !white) glow(ctx, 38, 4, 22, '170,240,255', sw * 0.7);
      // eye stalks
      for (const s of [-1, 1]) {
        const ex = 6 + s * 9 + Math.sin(t * 2.4 + s) * 2, ey = -38 + Math.cos(t * 3 + s) * 2;
        ctx.strokeStyle = K; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(4 + s * 6, -16); ctx.quadraticCurveTo(4 + s * 12, -28, ex, ey); ctx.stroke();
        ctx.strokeStyle = C('#d8907a'); ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = C('#1a1420'); ctx.beginPath(); ctx.arc(ex, ey, 5.5, 0, TAU); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 2; ctx.stroke();
        if (!white) eye(ctx, ex + 1, ey, 2.6, '#a8f8ff', true);
      }
      // pale mask with coronet
      const mr = 19;
      ctx.fillStyle = C('#ede5d3');
      ctx.beginPath();
      ctx.moveTo(-mr + 4, -4);
      ctx.quadraticCurveTo(-mr + 2, -mr - 6, 6, -mr - 6);
      ctx.quadraticCurveTo(mr + 10, -mr - 6, mr + 8, -4);
      ctx.quadraticCurveTo(mr + 4, mr, 6, mr + 4);
      ctx.quadraticCurveTo(-mr + 6, mr, -mr + 4, -4);
      ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = C('#ede5d3');
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(6 + i * 7 - 3, -mr - 4); ctx.lineTo(6 + i * 8, -mr - 14 + Math.abs(i) * 3); ctx.lineTo(6 + i * 7 + 3, -mr - 4); ctx.closePath(); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 1.8; ctx.stroke(); }
      if (!white) {
        ctx.fillStyle = INK;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(6 + s * 8, -4, 4.2, 7.5, s * 0.15, 0, TAU); ctx.fill(); }
        for (const s of [-1, 1]) eye(ctx, 6 + s * 8, -3, 1.8, '#a8f8ff', true);
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(6, 10, 4, 0.2, Math.PI - 0.2); ctx.stroke();
        if (this.phase >= 2) { ctx.beginPath(); ctx.moveTo(14, -mr - 4); ctx.lineTo(10, -12); ctx.lineTo(14, -6); ctx.stroke(); }
      }
      ctx.restore();
      // great claw (front)
      const cl = this.claw;
      const cx = 88 - Math.max(0, cl) * 12 + Math.max(0, -cl) * 20, cy = -30 - Math.max(0, cl) * 86 + Math.max(0, -cl) * 16;
      const open = cl > 0.3 ? 0.9 : cl < -0.3 ? 0.05 : 0.25 + 0.15 * Math.sin(t * 2.5);
      ctx.strokeStyle = K; ctx.lineWidth = 11;
      ctx.beginPath(); ctx.moveTo(50, -36 - this.rear * 14); ctx.quadraticCurveTo(70, -40 - cl * 30, cx - 14, cy + 6); ctx.stroke();
      ctx.strokeStyle = C('#b85e46'); ctx.lineWidth = 7; ctx.stroke();
      this.paintClaw(ctx, t, cx, cy, out, cl > 0 ? -0.9 * cl : cl < 0 ? 0.5 : 0, C, K, white, open);
    } else if (!white) {
      // peeking eyes in the dark aperture
      const blink = Math.sin(t * 1.3) > 0.95 ? 0.2 : 1;
      ctx.save(); ctx.translate(-14, -62); ctx.rotate(this.spin);
      for (const s of [-1, 1]) { ctx.save(); ctx.translate(58, 22 + s * 9); ctx.scale(1, blink); eye(ctx, 0, 0, 3, '#a8f8ff', true); ctx.restore(); }
      ctx.restore();
    }
    ctx.restore();
  }

  paintClaw(ctx, t, x, y, s, rot, C, K, white, open) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    // palm
    ctx.fillStyle = C('#d07a5c');
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 22, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3.5; ctx.stroke();
    // fixed finger
    ctx.fillStyle = C('#e89a78');
    ctx.beginPath(); ctx.moveTo(18, 6); ctx.quadraticCurveTo(52, 10, 60, -2); ctx.quadraticCurveTo(46, 20, 14, 18); ctx.closePath(); ctx.fill(); ctx.stroke();
    // moving finger (dactyl)
    ctx.save(); ctx.translate(18, -6); ctx.rotate(-open * 0.8);
    ctx.fillStyle = C('#e89a78');
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(30, -14, 44, 2); ctx.quadraticCurveTo(30, -2, 0, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (!white) { ctx.fillStyle = '#f6e6d6'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(12 + i * 10, 4, 2, 0, TAU); ctx.fill(); } }
    ctx.restore();
    if (!white) {
      ctx.fillStyle = 'rgba(255,230,210,0.4)'; ctx.beginPath(); ctx.ellipse(-6, -8, 12, 5, -0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = INK; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-14 + i * 8, 8 - (i % 2) * 4, 1.6, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }

  paintShell(ctx, t, C, K, white) {
    // whelk: body whorl in front, spire tapering up and back
    const whorls = [
      { x: -84, y: -72, rx: 13, ry: 10, a: -0.6 },
      { x: -70, y: -58, rx: 22, ry: 15, a: -0.55 },
      { x: -48, y: -38, rx: 36, ry: 25, a: -0.5 },
    ];
    for (const w of whorls) {
      ctx.fillStyle = C('#cdbb9c');
      ctx.beginPath(); ctx.ellipse(w.x, w.y, w.rx, w.ry, w.a, 0, TAU); ctx.fill();
      ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
      if (!white) {
        ctx.strokeStyle = '#8a6e5a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(w.x, w.y, w.rx * 0.7, w.ry * 0.55, w.a, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        // knobs along the shoulder
        ctx.fillStyle = '#e8dcc4';
        for (let k = 0; k < 3; k++) {
          const a = w.a - Math.PI / 2 + (k - 1) * 0.6;
          const px = w.x + Math.cos(a) * w.rx * 0.95, py = w.y + Math.sin(a) * w.ry * 0.95;
          ctx.beginPath(); ctx.moveTo(px - 4, py + 2); ctx.lineTo(px + Math.cos(a) * 9, py + Math.sin(a) * 9); ctx.lineTo(px + 4, py + 2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
        }
      }
    }
    // body whorl
    ctx.fillStyle = C('#d8c7a6');
    ctx.beginPath(); ctx.ellipse(0, 0, 72, 58, -0.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = K; ctx.lineWidth = 4; ctx.stroke();
    if (!white) {
      // bands
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 72, 58, -0.3, 0, TAU); ctx.clip();
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = i % 2 ? 'rgba(138,110,90,0.75)' : 'rgba(110,80,70,0.5)'; ctx.lineWidth = 7 - i;
        ctx.beginPath(); ctx.ellipse(-20 + i * 4, -6 + i * 10, 80, 40 - i * 4, -0.3, Math.PI * 1.05, Math.PI * 1.85); ctx.stroke();
      }
      // algae on the lower whorl
      ctx.fillStyle = 'rgba(60,125,120,0.55)';
      ctx.beginPath(); ctx.ellipse(-10, 46, 70, 22, -0.1, 0, TAU); ctx.fill();
      ctx.restore();
      // spiral suture
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(-26, -16, 42, 30, -0.45, Math.PI * 0.95, Math.PI * 1.75); ctx.stroke();
      // knobs on the shoulder of the body whorl
      ctx.fillStyle = '#efe4cc';
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI * 0.95 + k * 0.33 - 0.3;
        const px = Math.cos(a) * 66, py = Math.sin(a) * 52;
        const rx = Math.cos(a - 0.3), ry = Math.sin(a - 0.3);
        ctx.beginPath(); ctx.moveTo(px - 5, py + 3); ctx.lineTo(px + rx * 14, py + ry * 14); ctx.lineTo(px + 5, py + 3); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      }
      // barnacles
      for (const [x, y, r] of [[-40, 20, 7], [-52, 4, 5], [18, -40, 6], [-30, -60, 5], [-60, -48, 4]]) {
        ctx.fillStyle = '#e8e2d6'; ctx.beginPath(); ctx.moveTo(x - r, y + r * 0.5); ctx.lineTo(x - r * 0.5, y - r * 0.6); ctx.lineTo(x + r * 0.5, y - r * 0.6); ctx.lineTo(x + r, y + r * 0.5); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, y - r * 0.5, r * 0.3, r * 0.15, 0, 0, TAU); ctx.fill();
      }
      // dangling kelp from the spire
      ctx.strokeStyle = '#3f7f78'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const x0 = -70 + i * 14, y0 = -58 + i * 10;
        ctx.beginPath(); ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(x0 - 10 + Math.sin(t * 2 + i) * 6, y0 + 20, x0 - 20 + Math.sin(t * 2.4 + i) * 8, y0 + 40, x0 - 14 + Math.sin(t * 1.8 + i) * 10, y0 + 56 - i * 8);
        ctx.stroke();
      }
    }
    // aperture with a flared pale lip
    ctx.fillStyle = C('#f2dcc4');
    ctx.beginPath(); ctx.ellipse(52, 18, 26, 38, 0.15, 0, TAU); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.fillStyle = C('#1a1420');
    ctx.beginPath(); ctx.ellipse(56, 20, 16, 28, 0.15, 0, TAU); ctx.fill();
    if (!white) {
      ctx.strokeStyle = 'rgba(232,170,150,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(52, 18, 21, 33, 0.15, -1.2, 1.4); ctx.stroke();
    }
  }

  drawExtra(ctx, t) {
    const A = this.arena, G = this.groundY;
    // tide swells at the walls
    for (const s of this.swells) {
      const k = 1 - s.t / s.max;
      const h = 20 + k * 80, w = 40 + k * 60;
      const x0 = s.d > 0 ? s.x : s.x - w;
      ctx.fillStyle = 'rgba(60,140,170,0.8)';
      ctx.beginPath(); ctx.moveTo(x0, G); ctx.quadraticCurveTo(x0 + w / 2, G - h * 1.3, x0 + w, G); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(240,252,255,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0 + w * 0.2, G - h * 0.55); ctx.quadraticCurveTo(x0 + w / 2, G - h * 0.75, x0 + w * 0.8, G - h * 0.55); ctx.stroke();
      if (Math.random() < 0.5) this.fx.add({ x: x0 + Math.random() * w, y: G - h * 0.6, vx: s.d * 40, vy: -this.rand(60, 180), life: 0.5, size: 2.5, color: 'rgba(220,248,255,0.85)', g: 600 });
    }
    // falling-barnacle dust marks
    for (const m of this.marks) {
      const k = 1 - Math.min(1, m.t / 0.8);
      ctx.fillStyle = `rgba(10,8,14,${0.25 + 0.35 * k})`;
      ctx.beginPath(); ctx.ellipse(m.x, G - 2, 10 + 8 * k, 4, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(230,220,200,${0.2 + 0.3 * k})`; ctx.lineWidth = 1.5; ctx.setLineDash([4, 8]);
      ctx.beginPath(); ctx.moveTo(m.x, A.y); ctx.lineTo(m.x, G); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  draw(ctx, t) { drawBossLayers(this, ctx, t); }
}

export default { gullet: Gullet, brinematron: BrineMatron };
