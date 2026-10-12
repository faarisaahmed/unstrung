// Bosses of the Ashen Kilns: Vitrius, the Glassblower (Keeper) and the Cinder Twins (optional).
import { Boss } from './boss.js';
import { TAU, clamp, sign } from '../core/math.js';
import { INK, eye } from '../art/creatures.js';
import { Projectile, registerProjectileArt } from '../entities/projectile.js';

// ---------------------------------------------------------------------------------------------
// shared helpers
const col = (white, c) => (white ? '#fff' : c);
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

// does segment (x0,y0)-(x1,y1) touch rect r?  (Liang-Barsky)
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
// where a ray leaves the arena box (floor = groundY)
function rayEnd(ox, oy, ang, ar, groundY) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  let t = 4000;
  if (dx > 1e-6) t = Math.min(t, (ar.x + ar.w - ox) / dx); else if (dx < -1e-6) t = Math.min(t, (ar.x - ox) / dx);
  if (dy > 1e-6) t = Math.min(t, (groundY - oy) / dy); else if (dy < -1e-6) t = Math.min(t, (ar.y - oy) / dy);
  t = Math.max(0, t);
  return { x: ox + dx * t, y: oy + dy * t };
}
// telegraph marks: drawn by the boss, timed with the boss clock (pauses in hitstop like coroutines)
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

// ---------------------------------------------------------------------------------------------
// projectile art
registerProjectileArt('vit_bubble', (ctx, p, t) => {
  const fuse = p.fuse ?? 1;
  const warn = fuse < 0.55;
  const wob = warn ? Math.sin(t * 60) * 0.12 : Math.sin(t * 7 + p.seed) * 0.05;
  const r = p.r * (1 + wob);
  const cx = p.cx, cy = p.cy;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r * 2.4);
  g.addColorStop(0, warn ? 'rgba(255,230,170,0.55)' : 'rgba(255,150,70,0.35)'); g.addColorStop(1, 'rgba(255,90,30,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 2.4, 0, TAU); ctx.fill();
  ctx.restore();
  // glass skin
  const sk = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  sk.addColorStop(0, 'rgba(255,250,235,0.55)'); sk.addColorStop(0.55, 'rgba(255,170,90,0.35)'); sk.addColorStop(1, 'rgba(200,80,40,0.7)');
  ctx.fillStyle = sk; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * (1 - wob * 0.6), 0, 0, TAU); ctx.fill();
  // molten swirl inside
  ctx.strokeStyle = warn && Math.sin(t * 40) > 0 ? '#fff6d8' : '#ffb347'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 14; i++) {
    const a = i / 14 * TAU * 1.3 + t * 3 + p.seed;
    const rr = r * (0.15 + i / 14 * 0.55);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(cx, cy, r, r * (1 - wob * 0.6), 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.7, -2.6, -1.7); ctx.stroke();
  // little gather nub where it left the pipe
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx + Math.cos(p.seed) * r, cy + Math.sin(p.seed) * r, 2.5, 0, TAU); ctx.fill();
});

registerProjectileArt('vit_shard', (ctx, p, t) => {
  ctx.save();
  ctx.translate(p.cx, p.cy); ctx.rotate(p.rot);
  const r = p.r;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2.6);
  g.addColorStop(0, 'rgba(255,170,80,0.5)'); g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.6, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.moveTo(r * 2.1, 0); ctx.lineTo(r * 0.2, -r * 0.75); ctx.lineTo(-r * 1.5, -r * 0.2); ctx.lineTo(-r * 1.2, r * 0.45); ctx.lineTo(r * 0.3, r * 0.6); ctx.closePath();
  ctx.fillStyle = p.o.color || '#bfe3da'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,250,235,0.85)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(r * 1.5, -r * 0.05); ctx.lineTo(-r * 0.6, -r * 0.25); ctx.stroke();
  ctx.fillStyle = '#ff9a3d';
  ctx.beginPath(); ctx.moveTo(-r * 1.5, -r * 0.2); ctx.lineTo(-r * 0.6, 0); ctx.lineTo(-r * 1.2, r * 0.45); ctx.fill();
  ctx.restore();
});

// glass spikes bursting along the floor
registerProjectileArt('vit_wave', (ctx, p, t) => {
  const r = p.rect();
  const bx = r.x + r.w / 2, by = r.y + r.h + p.r * 0.2;
  const H = p.r * 2.1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(bx, by, 2, bx, by, H * 1.3);
  g.addColorStop(0, 'rgba(255,150,60,0.6)'); g.addColorStop(1, 'rgba(255,90,30,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, H * 1.3, Math.PI, TAU); ctx.fill();
  ctx.restore();
  const dir = sign(p.vx) || 1;
  const spikes = [[-0.55, 0.55, -0.35], [0, 1, 0.12], [0.5, 0.7, 0.4], [-0.25, 0.8, -0.15]];
  for (const [ox, hk, lean] of spikes) {
    const x = bx + ox * p.r * 1.3 * dir;
    const hh = H * hk * (0.9 + 0.1 * Math.sin(t * 30 + ox * 9));
    ctx.beginPath();
    ctx.moveTo(x - 8, by); ctx.lineTo(x + lean * hh * dir, by - hh); ctx.lineTo(x + 8, by); ctx.closePath();
    ctx.fillStyle = '#a9d6cc'; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,245,225,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 3, by - 2); ctx.lineTo(x + lean * hh * dir * 0.8, by - hh * 0.8); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,170,80,0.9)';
  ctx.fillRect(bx - p.r * 1.2, by - 3, p.r * 2.4, 3);
});

// ---------------------------------------------------------------------------------------------
// A floating bubble of molten glass. It drifts after Bead, wobbles as a warning, then bursts into
// a ring of shards. A Bonk pops it early and harmlessly (it cracks cold).
class GlassBubble extends Projectile {
  constructor(game, x, y, vx, vy, o) {
    super(game, x, y, vx, vy, Object.assign({ dmg: 1, r: 15, life: 9, art: 'vit_bubble' }, o));
    this.fuse = o.fuse ?? 2;
    this.boss = o.boss;
    this.hittable = true;
    this.givesThread = false;
    this.seed = Math.random() * TAU;
  }
  hurtbox() { return this.rect(); }
  update(dt) {
    if (this.dead) return;
    this.fuse -= dt;
    const p = this.game.player;
    const dx = p.cx - this.cx, dy = p.cy - 40 - this.cy;
    const d = Math.hypot(dx, dy) || 1;
    const acc = this.fuse < 0.55 ? 0 : 150;
    this.vx += (dx / d) * acc * dt; this.vy += (dy / d) * acc * dt - 30 * dt;
    const sp = Math.hypot(this.vx, this.vy), max = 150;
    if (sp > max) { this.vx *= max / sp; this.vy *= max / sp; }
    if (this.fuse < 0.55) { this.vx *= 0.94; this.vy *= 0.94; }
    super.update(dt);
    if (!this.dead && this.fuse <= 0) this.die(true);
  }
  onBonk() {
    if (this.dead) return false;
    this.popped = true;
    this.dead = true;
    this.game.sfx('glassHit');
    this.game.fx.burst(this.cx, this.cy, 10, { color: '#d8f0ea', speed: 220, size: 3, life: 0.4, shape: 'shard' });
    this.game.fx.ring(this.cx, this.cy, 6, 30, 0.25, 'rgba(255,240,220,0.9)', 2);
    return true;
  }
  die(impact) {
    if (this.dead) return;
    super.die(impact);
    if (this.popped) return;
    const g = this.game, n = this.o.shards || 6;
    g.sfx('glassHit');
    g.fx.burst(this.cx, this.cy, 14, { color: '#ffb347', speed: 260, size: 3, life: 0.45, glow: true });
    g.fx.ring(this.cx, this.cy, 8, 46, 0.3, 'rgba(255,200,140,0.9)', 3);
    const a0 = Math.random() * TAU;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU;
      g.add(new Projectile(g, this.cx, this.cy, Math.cos(a) * 250, Math.sin(a) * 250, { dmg: 1, life: 2.2, r: 8, art: 'vit_shard', color: '#bfe3da' }));
    }
  }
}

// ---------------------------------------------------------------------------------------------
// VITRIUS — The Glassblower. Keeper of the Ashen Kilns: a towering golem of blown glass with a
// molten heart sloshing inside, a blowpipe forever at his lips.
// Phase 1: bubbles, shard rain, beam sweep, ground pound, leap. Phase 2: doubled patterns.
// Phase 3: his glass body cracks, light leaks out, he speeds up and adds the Shatterburst.
export class Vitrius extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'vitrius', size: [140, 214], music: 'boss_keeper', glints: 260, introTime: 2.6 });
    this.ps = { pipe: -0.12, pipeC: -0.12, raise: 0, raiseC: 0, crouch: 0, crouchC: 0, blow: 0, glow: 0, glowC: 0, walk: 0, stepPh: 0, flare: 0 };
    this.beam = null;
    this.marks = [];
    this.clock = 0;
    this.crack = 0;
  }

  update(dt) {
    this.clock += dt;
    super.update(dt);
    if (this.mode === 'dying') {
      this.ps.flare = Math.min(1, this.ps.flare + dt);
      if (Math.random() < 0.6) {
        const c = this.corePos();
        this.fx.burst(c.x + this.rand(-50, 50), c.y + this.rand(-50, 50), 1, { color: this.pick(['#ffb347', '#fff1c8', '#bfe3da']), speed: 260, size: 3.5, life: 0.7, shape: 'shard', glow: true });
      }
    }
  }

  // ---- pose & geometry ----
  animate(dt) {
    const s = this.ps, k = (r) => 1 - Math.exp(-r * dt);
    s.pipeC += (s.pipe - s.pipeC) * k(7);
    s.raiseC += (s.raise - s.raiseC) * k(9);
    s.crouchC += (s.crouch - s.crouchC) * k(10);
    s.glowC += (s.glow - s.glowC) * k(6);
    s.blow = Math.max(0, s.blow - dt * 3);
    if (s.walk) {
      const before = Math.floor(s.stepPh / Math.PI);
      s.stepPh += dt * 7 * this.speedMul;
      if (Math.floor(s.stepPh / Math.PI) !== before) { this.shake(2.5, 0.12); this.sfx('land', 0.8); this.fx.burst(this.cx + this.rand(-40, 40), this.groundY, 4, { color: 'rgba(120,70,50,0.8)', speed: 80, angle: -Math.PI / 2, spread: 2, size: 2.5, life: 0.4 }); }
    } else s.stepPh *= 0.9;
  }
  get lift() { return this.ps.crouchC * 24; }
  pivot() { return { x: this.cx + this.facing * 18, y: this.y + this.h - 180 + this.lift }; }
  pipeTip() {
    const p = this.pivot(), a = this.ps.pipeC;
    return { x: p.x + this.facing * Math.cos(a) * 122, y: p.y + Math.sin(a) * 122 };
  }
  corePos() { return { x: this.cx, y: this.y + this.h - 108 + this.lift }; }
  worldAng(a) { return this.facing > 0 ? a : Math.PI - a; }
  rec(t) { return t * (this.phase >= 3 ? 0.72 : this.phase === 2 ? 0.88 : 1); }

  idle(dt) {
    // dormant: absorbed in his work, turning a small gather on the pipe
    this.ps.glow = 0.5 + 0.3 * Math.sin(this.anim * 1.7);
    if (Math.sin(this.anim * 1.3) > 0.97) this.ps.blow = 0.6;
    this.animate(dt);
  }
  onStart() { this.ps.glow = 1; }
  introUpdate(dt, t) {
    if (t < 0.6) { this.ps.pipe = -0.12; }
    else if (t < 1.9) { this.ps.raise = 1; this.ps.pipe = -1.1; this.ps.flare = 0.8; if (t > 0.65 && t < 0.7) { this.shake(9, 0.9); this.sfx('glassHit'); } }
    else { this.ps.raise = 0; this.ps.pipe = -0.12; this.ps.flare = 0; }
    this.animate(dt);
  }

  think(dt) {
    this.animate(dt);
    const s = this.ps;
    // drips of molten glass from the gather, rising embers from the shoulders
    if (Math.random() < 0.08 + s.glowC * 0.2) {
      const t = this.pipeTip();
      this.fx.add({ x: t.x, y: t.y + 4, vx: this.rand(-10, 10), vy: 20, life: 0.8, size: 2.6, color: '#ffb347', g: 900, glow: true, front: false });
    }
    if (Math.random() < 0.25) {
      this.fx.add({ x: this.cx + this.rand(-50, 50), y: this.y + 70 + this.lift, vx: this.rand(-15, 15), vy: -this.rand(40, 90), life: 1.2, size: 1.8, color: '#ff8a3d', g: -20, glow: true, front: false });
    }
    if (this.phase >= 3 && Math.random() < 0.2) {
      const c = this.corePos();
      this.fx.add({ x: c.x + this.rand(-40, 40), y: c.y + this.rand(-40, 30), vx: this.rand(-40, 40), vy: -this.rand(20, 60), life: 0.6, size: 2, color: '#fff1c8', g: 0, glow: true });
    }
    // the blowpipe beam
    if (this.beam && this.beam.on) {
      const o = this.pipeTip();
      const e = rayEnd(o.x, o.y, this.beam.ang, this.arena, this.groundY);
      this.beam.o = o; this.beam.e = e;
      const hb = this.player.hurtbox();
      const R = { x: hb.x - 9, y: hb.y - 9, w: hb.w + 18, h: hb.h + 18 };
      if (segHitsRect(o.x, o.y, e.x, e.y, R)) this.hits.push(hb);
      if (Math.random() < 0.7) this.fx.burst(e.x, e.y, 2, { color: this.pick(['#ffb347', '#fff1c8']), speed: 260, angle: this.beam.ang + Math.PI, spread: 1.6, size: 2.5, life: 0.4, glow: true });
    } else if (this.beam) {
      const o = this.pipeTip();
      this.beam.o = o; this.beam.e = rayEnd(o.x, o.y, this.beam.ang, this.arena, this.groundY);
    }
  }

  attackList() {
    const d = this.distX(), P = this.phase;
    return [
      { name: 'bubbles', w: 2.4, fn: this.bubbles },
      { name: 'rain', w: 2, fn: this.shardRain },
      { name: 'beam', w: d > 200 ? 2.4 : 1.2, fn: this.beamSweep },
      { name: 'pound', w: d < 280 ? 3 : 1, fn: this.groundPound },
      { name: 'leap', w: d > 420 ? 2.6 : 0.9, fn: this.leapSlam },
      { name: 'burst', w: P >= 3 ? 2.2 : 0, fn: this.shatterBurst },
      { name: 'stride', w: d < 150 || d > 640 ? 1.6 : 0, fn: this.stride },
    ];
  }

  *walkTo(x, speed, maxT) {
    x = clamp(x, this.arena.x + this.w / 2 + 8, this.arena.x + this.arena.w - this.w / 2 - 8);
    for (let t = 0; t < maxT; t += 1 / 60) {
      const dx = x - this.cx;
      if (Math.abs(dx) < 10) break;
      this.facing = sign(dx);
      this.vx = sign(dx) * speed * this.speedMul;
      this.ps.walk = 1;
      yield;
    }
    this.vx = 0; this.ps.walk = 0;
  }

  *stride() {
    const p = this.player, mid = this.arena.x + this.arena.w / 2;
    const want = this.distX() < 150 ? (p.cx < mid ? p.cx + 300 : p.cx - 300) : p.cx - this.dirTo() * 300;
    yield* this.walkTo(want, this.phase >= 3 ? 150 : 110, 1.6);
    this.facePlayer();
    yield this.rec(0.3);
  }

  *bubbles() {
    this.facePlayer();
    this.ps.pipe = -0.5; this.ps.glow = 1; this.tele = 0.6; this.sfx('charge');
    yield 0.6;
    const n = this.phase === 1 ? 2 : this.phase === 2 ? 3 : 4;
    for (let i = 0; i < n; i++) {
      this.ps.blow = 1; this.sfx('spit');
      const t = this.pipeTip();
      this.game.add(new GlassBubble(this.game, t.x, t.y, this.facing * this.rand(120, 220), this.rand(-170, -50), {
        fuse: (1.8 + i * 0.32) / this.speedMul, boss: this, shards: this.phase >= 2 ? 8 : 6, r: 15 + (i % 2) * 3,
      }));
      this.fx.ring(t.x, t.y, 4, 24, 0.25, 'rgba(255,200,140,0.9)', 2);
      yield 0.4;
    }
    this.ps.glow = 0.2; this.ps.pipe = -0.12;
    yield this.rec(1.0);
  }

  *shardRain() {
    this.facePlayer();
    this.ps.pipe = -1.35; this.ps.glow = 1; this.ps.crouch = 0.3; this.tele = 0.6; this.sfx('charge');
    yield 0.6;
    const t = this.pipeTip();
    this.ps.blow = 1; this.ps.crouch = 0;
    this.sfx('burst'); this.shake(5, 0.4);
    this.fx.burst(t.x, t.y, 26, { color: '#ffb347', speed: 620, angle: -Math.PI / 2, spread: 0.6, size: 3.5, life: 0.6, g: 200, glow: true });
    const waves = this.phase >= 2 ? 2 : 1;
    const S = this.phase >= 3 ? 124 : 146;
    let anchor = this.player.cx;
    const a0 = this.arena.x + 20, a1 = this.arena.x + this.arena.w - 20;
    for (let w = 0; w < waves; w++) {
      const xs = [];
      for (let x = anchor - Math.floor((anchor - a0) / S) * S; x <= a1; x += S) xs.push(x);
      for (const x of xs) addMark(this, { type: 'shadow', x, life: 1.25, fall: 0.8 });
      yield 0.8;
      this.sfx('drop');
      for (const x of xs) this.fire(x, this.arena.y + 16, 0, 650, { art: 'vit_shard', r: 9, gravity: 1800, life: 2, color: '#bfe3da' });
      anchor += S / 2;
    }
    this.ps.pipe = -0.12; this.ps.glow = 0.2;
    yield this.rec(1.0);
  }

  *beamSweep() {
    this.facePlayer();
    const variant = this.phase === 1 ? this.pick(['high', 'low']) : 'both';
    this.ps.crouch = 0.6;
    const pv = { y: this.y + this.h - 180 + 0.6 * 24 };
    const Hp = this.groundY - pv.y;
    const aUp = -0.85, aMid = Math.atan2(Hp - 95, 1150), aLow = Math.atan2(Hp, 330);
    let a0, a1, a2 = null;
    if (variant === 'high') { a0 = aUp; a1 = aMid; }
    else if (variant === 'low') { a0 = aMid; a1 = aLow; }
    else { a0 = aUp; a1 = aMid; a2 = aLow; }
    this.ps.pipe = a0; this.ps.glow = 1;
    this.tele = 0.7; this.sfx('warn');
    this.beam = { ang: this.worldAng(a0), on: false };
    for (let t = 0; t < 0.7; t += this.speedMul / 60) { this.beam.ang = this.worldAng(this.ps.pipeC); yield; }
    this.ps.pipeC = a0; this.beam.ang = this.worldAng(a0);
    this.beam.on = true; this.sfx('laser'); this.shake(4, 0.3);
    yield* this.sweep(a0, a1, 0.9);
    if (a2 !== null) {
      this.sfx('warn');
      yield 0.3;
      this.sfx('laser');
      yield* this.sweep(a1, a2, this.phase >= 3 ? 0.65 : 0.8);
    }
    yield 0.12;
    this.beam = null; this.ps.glow = 0.2; this.ps.crouch = 0; this.ps.pipe = -0.12;
    yield this.rec(0.9);
  }
  *sweep(a0, a1, T) {
    for (let t = 0; t <= T; t += this.speedMul / 60) {
      const a = a0 + (a1 - a0) * ease(Math.min(1, t / T));
      this.ps.pipe = this.ps.pipeC = a;
      this.beam.ang = this.worldAng(a);
      if (Math.random() < 0.3) this.shake(2, 0.1);
      yield;
    }
  }

  *groundPound() {
    this.facePlayer();
    const reps = this.phase >= 2 ? 2 : 1;
    for (let r = 0; r < reps; r++) {
      this.ps.raise = 1; this.ps.pipe = -1.15; this.tele = r ? 0.5 : 0.65; this.sfx('charge');
      yield r ? 0.5 : 0.65;
      this.ps.raise = 0; this.ps.raiseC = 0.25; this.ps.crouch = 1;
      yield 0.05;
      this.shake(11, 0.5); this.sfx('slam'); this.sfx('glassHit');
      const fx0 = this.cx + this.facing * 78;
      this.zone(fx0 - 60, this.groundY - 46, 120, 46, 0.15);
      this.fx.burst(fx0, this.groundY, 20, { color: '#bfe3da', speed: 380, angle: -Math.PI / 2, spread: 2.4, size: 3.5, life: 0.6, shape: 'shard' });
      this.fx.ring(fx0, this.groundY, 10, 120, 0.4, 'rgba(255,190,120,0.8)', 4);
      const sp = 360 + this.phase * 45 + r * 70;
      this.shockwave(this.x + 10, -1, sp, 44, { art: 'vit_wave', color: '#ffb347' });
      this.shockwave(this.x + this.w - 10, 1, sp, 44, { art: 'vit_wave', color: '#ffb347' });
      if (this.phase >= 3) {
        for (const vx of [-380, -190, 190, 380]) this.fire(fx0, this.groundY - 70, vx, -760, { art: 'vit_shard', r: 8, gravity: 1500, life: 3, color: '#bfe3da' });
      }
      yield 0.45;
      this.ps.crouch = 0;
      if (r < reps - 1) yield 0.15;
    }
    this.ps.pipe = -0.12;
    yield this.rec(0.8);
  }

  *leapSlam() {
    const hops = this.phase >= 3 ? 2 : 1;
    for (let h = 0; h < hops; h++) {
      this.facePlayer();
      this.ps.crouch = 1; this.ps.pipe = 0.3; this.tele = 0.55; this.sfx('charge');
      const tx = clamp(this.player.cx, this.arena.x + this.w / 2, this.arena.x + this.arena.w - this.w / 2);
      const T = this.phase >= 3 ? 0.85 : 1.0;
      addMark(this, { type: 'land', x: tx, w: this.w, life: 0.55 + T });
      yield 0.55;
      this.ps.crouch = 0; this.ps.raise = 0.7; this.ps.pipe = -0.6; this.sfx('leap');
      const maxH = Math.max(120, this.groundY - this.h - this.arena.y - 20);
      yield* this.leapTo(tx, Math.min(300, maxH), T);
      this.ps.raise = 0; this.ps.crouch = 0.9; this.ps.crouchC = 0.9;
      this.shake(12, 0.5); this.sfx('slam'); this.sfx('glassHit');
      this.fx.burst(this.cx, this.groundY, 24, { color: '#bfe3da', speed: 420, angle: -Math.PI / 2, spread: 2.8, size: 3.5, life: 0.6, shape: 'shard' });
      const sp = 400 + this.phase * 40;
      this.shockwave(this.x + 10, -1, sp, 40, { art: 'vit_wave', color: '#ffb347' });
      this.shockwave(this.x + this.w - 10, 1, sp, 40, { art: 'vit_wave', color: '#ffb347' });
      yield 0.5;
      this.ps.crouch = 0; this.ps.pipe = -0.12;
    }
    yield this.rec(0.7);
  }

  *shatterBurst() {
    this.facePlayer();
    this.ps.raise = 0.45; this.ps.flare = 1; this.tele = 0.85; this.sfx('charge'); this.sfx('warn');
    yield 0.85;
    const c = this.corePos();
    const n = 14, a0 = this.rand(0, TAU);
    for (let k = 0; k < 2; k++) {
      this.ps.blow = 1;
      this.fireRing(c.x, c.y, n, 240, { art: 'vit_shard', r: 9, life: 4, color: '#bfe3da', a0: a0 + k * Math.PI / n });
      this.sfx('glassHit'); this.shake(7, 0.3);
      this.fx.ring(c.x, c.y, 20, 140, 0.4, 'rgba(255,220,160,0.9)', 5);
      yield 0.55;
    }
    this.ps.flare = 0; this.ps.raise = 0;
    yield this.rec(0.9);
  }

  onPhase(n) {
    if (n === 2) {
      this.sfx('bossRoar'); this.shake(7, 0.7); this.tele = 0.8; this.ps.blow = 1;
    }
    if (n === 3) {
      this.crack = 1;
      this.speedMul *= 1.2;
      this.sfx('glassHit'); this.sfx('bossRoar');
      this.shake(12, 1.0);
      this.game.flash('rgba(255,170,90,0.45)', 0.4);
      const c = this.corePos();
      this.fx.burst(c.x, c.y, 30, { color: '#d8f0ea', speed: 380, size: 4, life: 0.8, shape: 'shard' });
      this.fx.ring(c.x, c.y, 20, 200, 0.6, 'rgba(255,200,140,0.9)', 6);
    }
  }

  onDeath() {
    this.beam = null; this.marks = [];
    this.ps.raise = 1; this.ps.pipe = -1.3; this.crack = 1;
    this.game.flash('rgba(255,190,120,0.7)', 0.7);
  }
  onFinish() {
    const g = this.game, c = this.corePos();
    g.fx.burst(c.x, c.y, 60, { color: '#bfe3da', speed: 560, size: 6, life: 1.6, shape: 'shard', front: true, g: 900 });
    g.fx.burst(c.x, c.y, 40, { color: '#ffb347', speed: 420, size: 4, life: 1.4, glow: true, g: 300 });
    g.fx.ring(c.x, c.y, 30, 420, 1.2, 'rgba(255,200,140,0.9)', 8);
    g.camera.shake(14, 1.2);
    g.sfx('glassHit'); g.sfx('explode');
  }

  bodyBox() {
    const L = this.lift;
    return { x: this.cx - 50, y: this.y + this.h - 200 + L, w: 100, h: 200 - L };
  }

  // ------------------------------------------------------------------ drawing
  drawBody(ctx, t, white) {
    const s = this.ps, f = this.facing;
    const by = this.y + this.h, L = this.lift;
    const breath = Math.sin(this.anim * 2.1) * 2;
    const dying = this.mode === 'dying';
    const flare = Math.max(s.flare, dying ? Math.min(1, (this.dieT || 0) / 1.5) : 0);
    const ink = col(white, INK);
    const glass = col(white, '#7fa9a2'), glassHi = col(white, '#cfeee6'), iron = col(white, '#2e2420');

    if (!white) {
      // furnace halo
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const c = this.corePos();
      const R = 150 + flare * 80 + Math.sin(this.anim * 3) * 6;
      const g = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, R);
      g.addColorStop(0, `rgba(255,140,60,${0.22 + flare * 0.25})`); g.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.fill();
      ctx.restore();
      // ground shadow
      ctx.fillStyle = 'rgba(10,4,2,0.45)';
      ctx.beginPath(); ctx.ellipse(this.cx, this.groundY + 2, 80, 10, 0, 0, TAU); ctx.fill();
    }

    ctx.save();
    ctx.translate(this.cx, by);
    ctx.scale(f, 1);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    const sw = s.walk || Math.abs(s.stepPh) > 0.01 ? Math.sin(s.stepPh) : 0;
    const legTop = -64 + L;
    // ---- legs (back first)
    const leg = (x, lift, back) => {
      const top = legTop, foot = -Math.max(0, lift) * 14;
      ctx.beginPath();
      ctx.moveTo(x - 17, top); ctx.lineTo(x + 17, top);
      ctx.lineTo(x + 20, foot - 12); ctx.quadraticCurveTo(x + 22, foot, x + 26, foot);
      ctx.lineTo(x - 22, foot); ctx.quadraticCurveTo(x - 21, foot - 6, x - 20, foot - 12); ctx.closePath();
      ctx.fillStyle = white ? '#fff' : back ? '#5d827c' : glass; ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.stroke();
      if (!white) {
        ctx.strokeStyle = 'rgba(230,250,245,0.45)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 10, top + 6); ctx.lineTo(x - 13, foot - 14); ctx.stroke();
      }
      // iron greave band + boot
      ctx.fillStyle = iron;
      ctx.beginPath(); ctx.rect(x - 20, (top + foot) / 2 - 5, 40, 9); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 24, foot); ctx.lineTo(x - 22, foot - 9); ctx.lineTo(x + 24, foot - 9); ctx.lineTo(x + 30, foot); ctx.closePath(); ctx.fill(); ctx.stroke();
    };
    leg(-30, -sw, true);

    // ---- back arm
    const sh = { x: -36, y: -150 + L + breath };
    let bh;
    if (s.raiseC > 0.02) bh = { x: -58 + (-20 + 58) * s.raiseC, y: (-78 + L) + (-262 + L + 78 - L) * s.raiseC };
    else bh = { x: -60 + Math.sin(this.anim * 1.6) * 3, y: -80 + L + Math.sin(this.anim * 2.1) * 3 };
    this.drawArm(ctx, sh, bh, -1, white, true);

    leg(28, sw, false);

    // ---- torso: the vessel
    const cy = -112 + L + breath * 0.5;
    const RX = 62, RY = 56;
    // a mane of half-blown glass spines along his back
    for (let i = 0; i < 5; i++) {
      const a = -1.85 - i * 0.24;
      const len = 18 + ((i * 37) % 5) * 5 + Math.sin(this.anim * 2 + i) * 2;
      const bx = Math.cos(a) * RX * 0.92, byy = cy + Math.sin(a) * RY * 0.92;
      const tx = Math.cos(a + 0.2) * (RX + len), ty = cy + Math.sin(a + 0.2) * (RY + len);
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(a + 1.57) * 9, byy + Math.sin(a + 1.57) * 9);
      ctx.quadraticCurveTo((bx + tx) / 2 + 6, (byy + ty) / 2 - 4, tx, ty);
      ctx.lineTo(bx - Math.cos(a + 1.57) * 9, byy - Math.sin(a + 1.57) * 9);
      ctx.closePath();
      ctx.fillStyle = white ? '#fff' : i % 2 ? 'rgba(120,170,160,0.85)' : 'rgba(160,205,195,0.85)'; ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.stroke();
      if (!white) {
        ctx.strokeStyle = 'rgba(255,170,90,0.7)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(bx, byy); ctx.lineTo(bx + (tx - bx) * 0.5, byy + (ty - byy) * 0.5); ctx.stroke();
      }
    }
    ctx.beginPath(); ctx.ellipse(0, cy, RX, RY, 0, 0, TAU);
    if (white) { ctx.fillStyle = '#fff'; ctx.fill(); }
    else {
      const gg = ctx.createRadialGradient(-18, cy - 20, 6, 0, cy, RX);
      gg.addColorStop(0, 'rgba(120,90,80,0.85)'); gg.addColorStop(1, 'rgba(36,18,16,0.92)');
      ctx.fillStyle = gg; ctx.fill();
      // molten pool in the bottom, sloshing
      ctx.save();
      ctx.beginPath(); ctx.ellipse(0, cy, RX - 3, RY - 3, 0, 0, TAU); ctx.clip();
      const lvl = cy + 4 - flare * 12;
      const tilt = Math.sin(this.anim * 1.9) * 6 + (this.vx || 0) * 0.02 * f;
      ctx.beginPath();
      ctx.moveTo(-RX, lvl - tilt);
      for (let i = 0; i <= 12; i++) {
        const x = -RX + i * (RX * 2 / 12);
        ctx.lineTo(x, lvl - tilt * (1 - i / 6) + Math.sin(this.anim * 5 + i * 0.9) * 2.5);
      }
      ctx.lineTo(RX, cy + RY); ctx.lineTo(-RX, cy + RY); ctx.closePath();
      const lg = ctx.createLinearGradient(0, lvl - 10, 0, cy + RY);
      lg.addColorStop(0, '#ffcf6a'); lg.addColorStop(0.35, '#ff8a3d'); lg.addColorStop(1, '#a8361a');
      ctx.fillStyle = lg; ctx.fill();
      // rising bubbles
      ctx.fillStyle = 'rgba(255,240,200,0.8)';
      for (let i = 0; i < 6; i++) {
        const ph = (this.anim * 0.6 + i * 0.37) % 1;
        const bx = Math.sin(i * 2.7) * 34, byy = cy + RY - 6 - ph * (RY + 4 - (lvl - cy) - 6);
        ctx.beginPath(); ctx.arc(bx, byy, 2 + (i % 3), 0, TAU); ctx.fill();
      }
      ctx.restore();
      // the heart: white-hot core
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const cr = 24 + Math.sin(this.anim * 4.2) * 3 + s.blow * 8 + flare * 12;
      const cg = ctx.createRadialGradient(4, cy + 4, 2, 4, cy + 4, cr * 1.6);
      cg.addColorStop(0, '#fffbe6'); cg.addColorStop(0.35, '#ffcf6a'); cg.addColorStop(0.7, 'rgba(255,120,40,0.6)'); cg.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(4, cy + 4, cr * 1.6, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = ink; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.ellipse(0, cy, RX, RY, 0, 0, TAU); ctx.stroke();
    // sheen
    if (!white) {
      ctx.strokeStyle = 'rgba(240,255,250,0.7)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, cy, RX - 9, RY - 9, 0, -2.75, -1.95); ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, cy, RX - 18, RY - 18, 0, -2.6, -2.25); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,255,250,0.3)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(0, cy, RX - 6, RY - 6, 0, 0.25, 0.9); ctx.stroke();
    }
    // iron cage straps
    ctx.strokeStyle = ink; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-22, cy - RY + 4); ctx.quadraticCurveTo(-48, cy, -26, cy + RY - 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(24, cy - RY + 4); ctx.quadraticCurveTo(50, cy, 28, cy + RY - 3); ctx.stroke();
    ctx.strokeStyle = iron; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-22, cy - RY + 4); ctx.quadraticCurveTo(-48, cy, -26, cy + RY - 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(24, cy - RY + 4); ctx.quadraticCurveTo(50, cy, 28, cy + RY - 3); ctx.stroke();
    // rivets
    ctx.fillStyle = col(white, '#c45a33');
    for (const [x, y] of [[-35, cy - 26], [-39, cy + 6], [-33, cy + 34], [37, cy - 26], [41, cy + 6], [35, cy + 34]]) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill(); }
    // pelvis band
    ctx.fillStyle = iron; ctx.strokeStyle = ink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-46, cy + RY - 10, 92, 14, 5); ctx.fill(); ctx.stroke();

    // ---- scorched leather apron
    {
      const ay = cy + RY - 4, flap = Math.sin(this.anim * 3.1) * 3 + (this.vx || 0) * -0.02;
      ctx.beginPath();
      ctx.moveTo(-26, ay); ctx.lineTo(30, ay);
      ctx.quadraticCurveTo(34 + flap, ay + 26, 30 + flap * 1.5, ay + 46);
      ctx.lineTo(18 + flap * 1.5, ay + 42); ctx.lineTo(8 + flap * 1.5, ay + 48); ctx.lineTo(-4 + flap, ay + 41); ctx.lineTo(-16 + flap, ay + 47);
      ctx.quadraticCurveTo(-26 + flap, ay + 24, -26, ay);
      ctx.closePath();
      ctx.fillStyle = col(white, '#4a2a1e'); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.stroke();
      if (!white) {
        ctx.fillStyle = 'rgba(20,8,4,0.55)';
        ctx.beginPath(); ctx.ellipse(10 + flap, ay + 30, 7, 4, 0.4, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-8 + flap, ay + 16, 4, 3, -0.3, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(200,140,100,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(-21, ay + 4); ctx.quadraticCurveTo(-20 + flap, ay + 24, -12 + flap, ay + 42); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // ---- neck + collar
    const ny = cy - RY + 2;
    ctx.beginPath();
    ctx.moveTo(-16, ny + 4); ctx.lineTo(-11, ny - 22); ctx.lineTo(11, ny - 22); ctx.lineTo(16, ny + 4); ctx.closePath();
    ctx.fillStyle = white ? '#fff' : 'rgba(110,150,145,0.9)'; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = iron;
    ctx.beginPath(); ctx.roundRect(-24, ny - 4, 48, 10, 4); ctx.fill(); ctx.stroke();
    // ---- head: glass globe with a fired-clay mask
    const hx = 4, hy = ny - 40;
    ctx.beginPath(); ctx.arc(hx, hy, 24, 0, TAU);
    if (white) { ctx.fillStyle = '#fff'; ctx.fill(); }
    else {
      const hg = ctx.createRadialGradient(hx - 8, hy - 8, 2, hx, hy, 24);
      hg.addColorStop(0, 'rgba(150,120,100,0.9)'); hg.addColorStop(1, 'rgba(40,20,18,0.95)');
      ctx.fillStyle = hg; ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const eg = ctx.createRadialGradient(hx, hy + 6, 1, hx, hy + 6, 20);
      eg.addColorStop(0, `rgba(255,150,60,${0.35 + flare * 0.4})`); eg.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(hx, hy + 6, 20, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hx, hy, 24, 0, TAU); ctx.stroke();
    // iron crown-tongs
    ctx.strokeStyle = ink; ctx.lineWidth = 4;
    for (const a of [-2.3, -1.57, -0.84]) {
      ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * 22, hy + Math.sin(a) * 22); ctx.lineTo(hx + Math.cos(a) * 34, hy + Math.sin(a) * 34 - 4); ctx.stroke();
    }
    ctx.fillStyle = col(white, '#c45a33');
    for (const a of [-2.3, -1.57, -0.84]) { ctx.beginPath(); ctx.arc(hx + Math.cos(a) * 34, hy + Math.sin(a) * 34 - 4, 3, 0, TAU); ctx.fill(); }
    // mask (front of the globe)
    const mx = hx + 9, my = hy + 1;
    ctx.beginPath();
    ctx.moveTo(mx - 13, my - 6);
    ctx.quadraticCurveTo(mx - 12, my - 20, mx + 2, my - 19);
    ctx.quadraticCurveTo(mx + 15, my - 17, mx + 15, my - 3);
    ctx.quadraticCurveTo(mx + 14, my + 12, mx + 3, my + 16);
    ctx.quadraticCurveTo(mx - 11, my + 12, mx - 13, my - 6);
    ctx.fillStyle = col(white, '#e9dcc6'); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.stroke();
    if (!white) {
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(mx - 5, my - 5, 3.6, 6, 0.25, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(mx + 7, my - 5, 3.6, 6, -0.25, 0, TAU); ctx.fill();
      const ec = flare > 0.5 || this.tele > 0 ? '#fff4c8' : '#ffb347';
      eye(ctx, mx - 5, my - 4, 2.2 + flare, ec, true);
      eye(ctx, mx + 7, my - 4, 2.2 + flare, ec, true);
      // scorch lines
      ctx.strokeStyle = 'rgba(120,60,40,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mx - 9, my + 4); ctx.lineTo(mx - 5, my + 10); ctx.stroke();
    }

    // ---- blowpipe (from the mouth)
    const pv = { x: 18, y: -180 + L };
    const a = s.pipeC;
    const tip = { x: pv.x + Math.cos(a) * 122, y: pv.y + Math.sin(a) * 122 };
    ctx.strokeStyle = ink; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(pv.x - 4, pv.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    ctx.strokeStyle = col(white, '#5a4840'); ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(pv.x - 4, pv.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    if (!white) {
      ctx.strokeStyle = 'rgba(255,200,150,0.5)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(pv.x + Math.cos(a) * 20, pv.y + Math.sin(a) * 20 - 1.5); ctx.lineTo(tip.x - Math.cos(a) * 10, tip.y - Math.sin(a) * 10 - 1.5); ctx.stroke();
      // red-hot last third
      ctx.strokeStyle = `rgba(255,110,50,${0.4 + s.glowC * 0.5})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(pv.x + Math.cos(a) * 85, pv.y + Math.sin(a) * 85); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    }
    // gather at the tip
    const gr = 7 + s.glowC * 5 + s.blow * 7 + Math.sin(this.anim * 6) * 1;
    if (!white) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const tg = ctx.createRadialGradient(tip.x, tip.y, 1, tip.x, tip.y, gr * 3.2);
      tg.addColorStop(0, 'rgba(255,240,200,0.9)'); tg.addColorStop(0.4, `rgba(255,150,60,${0.3 + s.glowC * 0.4})`); tg.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(tip.x, tip.y, gr * 3.2, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(tip.x + Math.cos(a) * gr * 0.6, tip.y + Math.sin(a) * gr * 0.6, gr, 0, TAU);
    ctx.fillStyle = col(white, '#ffb347'); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.stroke();
    if (!white) { ctx.fillStyle = '#fff4d0'; ctx.beginPath(); ctx.arc(tip.x + Math.cos(a) * gr * 0.6 - 2, tip.y + Math.sin(a) * gr * 0.6 - 2, gr * 0.35, 0, TAU); ctx.fill(); }

    // ---- front arm: holds the pipe, or raised for a slam
    const fs = { x: 38, y: -150 + L + breath };
    const grip = { x: pv.x + Math.cos(a) * 58, y: pv.y + Math.sin(a) * 58 + 6 };
    const fh = { x: grip.x + (24 - grip.x) * s.raiseC, y: grip.y + (-262 + L - grip.y) * s.raiseC };
    this.drawArm(ctx, fs, fh, 1, white, false);

    // ---- cracks (phase 3 / death): light spills out
    const ck = dying ? 1 + Math.min(2, (this.dieT || 0) * 1.5) : this.crack;
    if (ck > 0) this.drawCracks(ctx, cy, hx, hy, ck, white);
    ctx.restore();
  }

  drawArm(ctx, sh, hand, side, white, back) {
    const mx = (sh.x + hand.x) / 2, my = (sh.y + hand.y) / 2;
    const dx = hand.x - sh.x, dy = hand.y - sh.y, d = Math.hypot(dx, dy) || 1;
    const bend = Math.max(0, 70 - d * 0.4);
    const ex = mx + (dy / d) * bend * side * -1, ey = my - (dx / d) * bend * side * -1 + bend * 0.4;
    const kx = 0.25 * sh.x + 0.5 * ex + 0.25 * hand.x, ky = 0.25 * sh.y + 0.5 * ey + 0.25 * hand.y; // elbow on the curve
    ctx.lineCap = 'round';
    ctx.strokeStyle = col(white, INK); ctx.lineWidth = 23;
    ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.quadraticCurveTo(ex, ey, hand.x, hand.y); ctx.stroke();
    ctx.strokeStyle = white ? '#fff' : back ? '#5d827c' : '#7fa9a2'; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.quadraticCurveTo(ex, ey, hand.x, hand.y); ctx.stroke();
    if (!white) {
      ctx.strokeStyle = 'rgba(235,255,250,0.5)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sh.x - 3, sh.y - 4); ctx.quadraticCurveTo(ex - 4, ey - 5, hand.x - 3, hand.y - 5); ctx.stroke();
      // ember glow at the elbow joint
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,130,50,0.35)'; ctx.beginPath(); ctx.arc(kx, ky, 10, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // iron elbow ring + shoulder plate
    ctx.fillStyle = col(white, '#2e2420'); ctx.strokeStyle = col(white, INK); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(kx, ky, 7, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(sh.x, sh.y - 2, 17, 12, 0, 0, TAU); ctx.fill(); ctx.stroke();
    // fist
    ctx.beginPath(); ctx.arc(hand.x, hand.y, 14, 0, TAU);
    ctx.fillStyle = white ? '#fff' : back ? '#6b938c' : '#8fbab2'; ctx.fill(); ctx.stroke();
    if (!white) { ctx.strokeStyle = 'rgba(240,255,250,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hand.x, hand.y, 9, -2.6, -1.6); ctx.stroke(); }
  }

  drawCracks(ctx, cy, hx, hy, k, white) {
    const C = [
      [[-22, cy - 52], [-10, cy - 30], [-20, cy - 12], [-6, cy + 8], [-14, cy + 22]],
      [[30, cy - 46], [18, cy - 24], [30, cy - 6], [22, cy + 10]],
      [[-58, cy - 6], [-38, cy - 2], [-44, cy + 16], [-28, cy + 24]],
      [[hx - 8, hy - 22], [hx + 1, hy - 10], [hx - 6, hy + 2]],
      [[52, cy + 10], [36, cy + 18], [40, cy + 36]],
      [[0, cy - 55], [6, cy - 40], [-2, cy - 30], [8, cy - 18]],
    ];
    const n = Math.min(C.length, Math.ceil(3 + (k - 1) * 3));
    for (let i = 0; i < n; i++) {
      const pts = C[i];
      ctx.strokeStyle = col(white, INK); ctx.lineWidth = 3;
      ctx.beginPath(); pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      if (!white) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,190,110,${0.55 + 0.35 * Math.sin(this.anim * 9 + i)})`; ctx.lineWidth = 1.6;
        ctx.beginPath(); pts.forEach(([x, y], j) => (j ? ctx.lineTo(x + 1, y) : ctx.moveTo(x + 1, y))); ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawExtra(ctx, t) {
    // telegraphs
    for (const { m, age, k } of liveMarks(this)) {
      if (m.type === 'shadow') {
        const warnK = Math.min(1, age / m.fall);
        const x = m.x, gy = this.groundY;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const cg = ctx.createLinearGradient(0, this.arena.y, 0, gy);
        cg.addColorStop(0, `rgba(255,200,130,${0.25 + 0.25 * warnK})`); cg.addColorStop(1, `rgba(255,120,50,${0.06 + 0.12 * warnK})`);
        ctx.fillStyle = cg;
        ctx.fillRect(x - 9, this.arena.y, 18, gy - this.arena.y);
        ctx.restore();
        if (age < m.fall) {
          ctx.setLineDash([6, 10]); ctx.lineDashOffset = -age * 60;
          ctx.strokeStyle = `rgba(255,210,150,${0.3 + 0.4 * warnK})`; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x, this.arena.y + 20); ctx.lineTo(x, gy - 4); ctx.stroke();
          ctx.setLineDash([]); ctx.lineDashOffset = 0;
        }
        ctx.fillStyle = `rgba(12,4,2,${0.25 + 0.5 * warnK})`;
        ctx.beginPath(); ctx.ellipse(x, gy - 1, 8 + 12 * warnK, 3 + 2 * warnK, 0, 0, TAU); ctx.fill();
        // glint at the ceiling where the shard forms
        if (age < m.fall) {
          const sy = this.arena.y + 2, L = 10 + 22 * warnK;
          ctx.beginPath(); ctx.moveTo(x - 6, sy); ctx.lineTo(x + 6, sy); ctx.lineTo(x + 1, sy + L); ctx.lineTo(x - 1, sy + L); ctx.closePath();
          ctx.fillStyle = '#bfe3da'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = `rgba(255,250,230,${0.4 + 0.6 * Math.abs(Math.sin(age * 20))})`;
          ctx.beginPath(); ctx.arc(x, sy + L * 0.5, 2.5, 0, TAU); ctx.fill();
        }
      } else if (m.type === 'land') {
        const gy = this.groundY;
        ctx.fillStyle = `rgba(12,4,2,${0.2 + 0.4 * Math.min(1, k * 1.5)})`;
        ctx.beginPath(); ctx.ellipse(m.x, gy - 1, m.w * 0.55 * (0.4 + 0.6 * Math.min(1, k * 1.5)), 9, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(255,160,80,${0.6 * (1 - k)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(m.x, gy - 1, m.w * 0.6, 11, 0, 0, TAU); ctx.stroke();
      }
    }
    // the beam
    const b = this.beam;
    if (b && b.o && b.e) {
      const { o, e } = b;
      ctx.save();
      ctx.lineCap = 'round';
      if (!b.on) {
        ctx.setLineDash([10, 12]);
        ctx.strokeStyle = `rgba(255,170,90,${0.35 + 0.35 * Math.abs(Math.sin(t * 14))})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(e.x, e.y); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.globalCompositeOperation = 'lighter';
        const fl = 1 + Math.sin(t * 50) * 0.12;
        for (const [w, c] of [[34 * fl, 'rgba(255,90,30,0.22)'], [20 * fl, 'rgba(255,140,60,0.5)'], [10, 'rgba(255,210,130,0.85)'], [4, 'rgba(255,255,240,1)']]) {
          ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(e.x, e.y); ctx.stroke();
        }
        const g = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, 46);
        g.addColorStop(0, 'rgba(255,240,200,0.9)'); g.addColorStop(1, 'rgba(255,100,40,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, 46, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------------------------------------
// CINDER TWINS — Ash & Ember, two burning acrobats who share one life between them.
// Ash is a smouldering blade-dancer who dashes and dives; Ember is a flame-caster who lobs fire
// and raises pillars. They combo, cross, swap places, fling each other, and link into a fire wheel.
const TWIN_PAL = {
  ash: { body: '#2a2630', wrap: '#8f8794', mask: '#d8d0c6', eye: '#ffcf7a', flame: ['rgba(150,150,170,0.55)', 'rgba(255,140,60,0.75)', '#ffe0a0'], trail: 'rgba(170,165,180,0.35)', paint: '#4a4250' },
  ember: { body: '#6e1c12', wrap: '#e0702c', mask: '#f4e3c4', eye: '#fff3b0', flame: ['rgba(255,90,30,0.6)', 'rgba(255,170,60,0.85)', '#fff4c8'], trail: 'rgba(255,140,60,0.35)', paint: '#c42a1a' },
};

class Twin {
  constructor(boss, kind, cx) {
    this.boss = boss; this.kind = kind;
    this.w = 46; this.h = kind === 'ash' ? 80 : 86;
    this.x = cx - this.w / 2; this.y = boss.groundY - this.h;
    this.vx = 0; this.vy = 0; this.facing = -1;
    this.grounded = true; this.air = false;
    this.co = null; this.wait = 0;
    this.anim = Math.random() * 5;
    this.rot = 0; this.pose = 'idle'; this.flash = 0; this.tele = 0; this.hover = 0; this.hoverC = 0;
    this.trail = []; this.hidden = false; this.trailOn = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  box() {
    if (this.pose === 'dash') return { x: this.x + 2, y: this.y + this.h * 0.4, w: this.w - 4, h: this.h * 0.6 };
    return { x: this.x + 8, y: this.y + 8, w: this.w - 16, h: this.h - 10 };
  }
}

registerProjectileArt('cin_glob', (ctx, p, t) => {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < p.trail.length; i++) {
    const q = p.trail[i], k = i / p.trail.length;
    ctx.fillStyle = `rgba(255,${100 + 80 * k},40,${0.25 * k})`;
    ctx.beginPath(); ctx.arc(q.x, q.y, p.r * (0.5 + k), 0, TAU); ctx.fill();
  }
  const g = ctx.createRadialGradient(p.cx, p.cy, 1, p.cx, p.cy, p.r * 2.2);
  g.addColorStop(0, '#fff4c8'); g.addColorStop(0.35, '#ffb347'); g.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.cx, p.cy, p.r * 2.2, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.cx, p.cy, p.r * 0.75, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#ff8a3d'; ctx.fill();
  ctx.fillStyle = '#fff4c8'; ctx.beginPath(); ctx.arc(p.cx - 2, p.cy - 2, p.r * 0.3, 0, TAU); ctx.fill();
});

registerProjectileArt('cin_wave', (ctx, p, t) => {
  const r = p.rect();
  const bx = r.x + r.w / 2, by = r.y + r.h + p.r * 0.2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const hh = p.r * (2.4 - i * 0.6) * (0.85 + 0.15 * Math.sin(t * 40 + i));
    const g = ctx.createLinearGradient(0, by - hh, 0, by);
    g.addColorStop(0, 'rgba(255,200,100,0)'); g.addColorStop(1, i === 2 ? 'rgba(255,250,220,0.9)' : 'rgba(255,120,40,0.6)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(bx - p.r * 1.2, by); ctx.quadraticCurveTo(bx - p.r * 0.3, by - hh * 0.5, bx + (sign(p.vx) || 1) * p.r * 0.4, by - hh); ctx.quadraticCurveTo(bx + p.r * 0.3, by - hh * 0.4, bx + p.r * 1.2, by); ctx.fill();
  }
  ctx.restore();
});

export class CinderTwins extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'cindertwins', size: [60, 60], music: 'boss_optional', glints: 220, introTime: 2.2 });
    this.noPhysics = true;
    this.marks = [];
    this.clock = 0;
    const mid = this.cx;
    this.ash = new Twin(this, 'ash', mid - 70);
    this.ember = new Twin(this, 'ember', mid + 70);
    this.twins = [this.ash, this.ember];
    this.wheel = null;
  }

  update(dt) {
    this.clock += dt;
    super.update(dt);
    if (this.mode === 'dormant' || this.mode === 'dying') for (const t of this.twins) this.twinPhysics(t, dt);
    if (this.mode === 'dying') {
      for (const t of this.twins) {
        t.pose = 'fall';
        if (Math.random() < 0.4) this.fx.burst(t.cx, t.cy, 1, { color: TWIN_PAL[t.kind].wrap, speed: 120, size: 3, life: 0.6, g: -200, glow: true });
      }
    }
    this.syncCenter();
  }
  syncCenter() {
    const a = this.ash, e = this.ember;
    if (this.wheel) { this.x = this.wheel.x - this.w / 2; this.y = this.wheel.y - this.h / 2; return; }
    this.x = (a.cx + e.cx) / 2 - this.w / 2; this.y = (a.cy + e.cy) / 2 - this.h / 2;
  }
  introUpdate(dt, t) {
    for (const tw of this.twins) {
      tw.facing = this.player.cx < tw.cx ? -1 : 1;
      if (t > 0.3 && t < 1.2) { tw.pose = 'tumble'; tw.rot = (t - 0.3) / 0.9 * TAU * (tw.kind === 'ash' ? -1 : 1); tw.y = this.groundY - tw.h - Math.sin((t - 0.3) / 0.9 * Math.PI) * 90; }
      else { tw.rot = 0; tw.pose = t > 1.2 ? 'cast' : 'idle'; tw.y = this.groundY - tw.h; }
      tw.anim += dt;
    }
    if (t > 1.2 && t < 1.25) { this.sfx('burst'); this.fx.burst(this.ember.cx, this.ember.y, 14, { color: '#ffb347', speed: 260, size: 3, life: 0.5, glow: true, g: -100 }); }
  }

  // ---- twin runtime ----
  run(t, gen) { t.co = gen; t.wait = 0; }
  *join() { while (this.ash.co || this.ember.co) yield; }
  stepTwin(t, dt) {
    if (t.wait > 0) t.wait -= dt;
    else if (t.co) {
      let guard = 0;
      while (t.wait <= 0 && t.co && guard++ < 20) {
        const r = t.co.next();
        if (r.done) { t.co = null; break; }
        if (typeof r.value === 'number') { t.wait += r.value / this.speedMul; break; }
        break;
      }
    }
  }
  twinPhysics(t, dt) {
    t.anim += dt;
    t.flash -= dt; if (t.tele > 0) t.tele -= dt;
    t.hoverC += (t.hover - t.hoverC) * Math.min(1, dt * 6);
    if (!t.air) {
      t.vy = Math.min(t.vy + 2400 * dt, 1400);
      t.x += t.vx * dt; t.y += t.vy * dt;
      const floor = this.groundY - t.h - t.hoverC;
      if (t.y >= floor) { t.y = floor; t.vy = 0; t.grounded = true; } else t.grounded = false;
    }
    const ar = this.arena;
    if (t.x < ar.x) { t.x = ar.x; t.vx = 0; }
    if (t.x + t.w > ar.x + ar.w) { t.x = ar.x + ar.w - t.w; t.vx = 0; }
    if (t.trailOn) t.trail.push({ x: t.x, y: t.y, rot: t.rot, life: 0.25, pose: t.pose, facing: t.facing });
    for (const q of t.trail) q.life -= dt;
    t.trail = t.trail.filter((q) => q.life > 0);
  }
  face(t) { t.facing = this.player.cx < t.cx ? -1 : 1; }
  other(t) { return t === this.ash ? this.ember : this.ash; }

  think(dt) {
    for (const t of this.twins) { this.stepTwin(t, dt); this.twinPhysics(t, dt); }
    if (this.wheel) {
      const w = this.wheel;
      w.ang += (w.vx / w.r) * dt;
      if (Math.random() < 0.8) this.fx.add({ x: w.x + this.rand(-w.r, w.r), y: w.y + this.rand(-w.r, w.r), vx: -w.vx * 0.2, vy: -this.rand(40, 120), life: 0.5, size: 3, color: this.pick(['#ffb347', '#ff6a2a', '#9a93a6']), g: -100, glow: true, front: false });
    }
    // ember particles off both
    for (const t of this.twins) {
      if (t.hidden) continue;
      if (Math.random() < 0.35) {
        const P = TWIN_PAL[t.kind];
        this.fx.add({ x: t.cx + this.rand(-6, 6), y: t.y + 4, vx: this.rand(-20, 20), vy: -this.rand(50, 110), life: 0.7, size: 2, color: t.kind === 'ash' ? this.pick(['#a8a2b0', '#ff9a4a']) : this.pick(['#ffb347', '#ffe08a']), g: -40, glow: t.kind !== 'ash' || Math.random() < 0.5, front: false });
        void P;
      }
    }
  }

  hurtboxes() {
    if (this.wheel) return [this.wheelBox()];
    return this.twins.filter((t) => !t.hidden).map((t) => t.box());
  }
  hurtbox() { return this.hurtboxes()[0] || { x: this.x, y: this.y, w: 1, h: 1 }; }
  hitboxes() { return [...this.hurtboxes(), ...this.hits]; }
  wheelBox() { const w = this.wheel; return { x: w.x - w.r * 0.85, y: w.y - w.r * 0.85, w: w.r * 1.7, h: w.r * 1.7 }; }

  hurt(dmg, dir, src) {
    if (!this.hittable || this.mode !== 'fight') return;
    // flash whichever twin was struck (nearest to Bead)
    const p = this.player;
    let best = null, bd = 1e9;
    for (const t of this.twins) { const d = Math.hypot(t.cx - p.cx, t.cy - p.cy); if (d < bd) { bd = d; best = t; } }
    if (src === 'pound' && !this.wheel && bd > 110) return;
    if (best) best.flash = 0.1;
    super.hurt(dmg, dir, src);
    if (!this.wheel) this.flashT = 0; // the struck twin flashes on its own
  }

  attackList() {
    const P = this.phase;
    return [
      { name: 'dashVolley', w: 3, fn: this.dashVolley },
      { name: 'vault', w: 2.5, fn: this.vaultDive },
      { name: 'pillars', w: 2, fn: this.pillars },
      { name: 'cross', w: 1.8, fn: this.swapCross },
      { name: 'catapult', w: P >= 2 ? 2.5 : 0, fn: this.catapult },
      { name: 'wheel', w: P >= 2 ? 2 : 0, fn: this.fireWheel },
    ];
  }
  rec(t) { return t * (this.phase >= 3 ? 0.7 : this.phase === 2 ? 0.85 : 1); }

  // ---- twin moves ----
  *tLeap(t, tx, height, T) {
    const ar = this.arena;
    tx = clamp(tx, ar.x + t.w / 2 + 4, ar.x + ar.w - t.w / 2 - 4);
    t.air = true; t.pose = 'tumble';
    const x0 = t.cx, y0 = t.y, y1 = this.groundY - t.h;
    const dur = T / this.speedMul;
    const spin = sign(tx - x0) || t.facing;
    for (let s = 0; s < dur; s += 1 / 60) {
      const k = s / dur;
      t.x = x0 + (tx - x0) * k - t.w / 2;
      t.y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * height;
      t.rot = k * TAU * spin;
      yield;
    }
    t.x = tx - t.w / 2; t.y = y1; t.rot = 0; t.air = false; t.vy = 0; t.pose = 'idle';
    this.fx.burst(t.cx, this.groundY, 5, { color: 'rgba(160,110,90,0.7)', speed: 90, angle: -Math.PI / 2, spread: 2.4, size: 2, life: 0.3 });
  }
  *tDash(t, dir, speed, maxDist) {
    t.pose = 'dash'; t.facing = dir; t.trailOn = true;
    let moved = 0;
    const ar = this.arena;
    for (;;) {
      const step = speed * this.speedMul / 60;
      t.x += dir * step; moved += step;
      if (Math.random() < 0.9) this.fx.add({ x: t.cx - dir * 14, y: t.y + t.h * this.rand(0.3, 0.9), vx: -dir * this.rand(40, 120), vy: -this.rand(20, 80), life: 0.45, size: 3, color: this.pick(TWIN_PAL[t.kind].flame), g: -150, glow: true });
      if (t.x <= ar.x || t.x + t.w >= ar.x + ar.w) { t.x = clamp(t.x, ar.x, ar.x + ar.w - t.w); break; }
      if (moved >= maxDist) break;
      yield;
    }
    t.trailOn = false; t.pose = 'skid';
  }
  *tAway(t, dist = 360) {
    // tumble to a spot `dist` from Bead (on the roomier side)
    const p = this.player, ar = this.arena;
    let tx = p.cx + (t.cx < p.cx ? -dist : dist);
    if (tx < ar.x + 40 || tx > ar.x + ar.w - 40) tx = p.cx + (t.cx < p.cx ? dist : -dist);
    if (Math.abs(tx - t.cx) > 60) yield* this.tLeap(t, tx, 110, 0.5);
    this.face(t);
  }

  *ashDash(t, n) {
    for (let i = 0; i < n; i++) {
      this.face(t);
      t.pose = 'crouch'; t.tele = 0.45; this.sfx('charge');
      yield 0.45;
      this.sfx('dash');
      const dir = t.facing;
      yield* this.tDash(t, dir, 780 + this.phase * 40, Math.abs(this.player.cx - t.cx) + 170);
      yield 0.25;
      t.pose = 'idle';
      if (i < n - 1) yield 0.15;
    }
  }
  *ashVault(t) {
    this.face(t);
    t.pose = 'crouch'; t.tele = 0.4; this.sfx('charge');
    yield 0.4;
    this.sfx('leap');
    // arc to a perch above Bead
    const ar = this.arena;
    const px = clamp(this.player.cx - t.facing * 60, ar.x + 40, ar.x + ar.w - 40);
    const py = Math.max(ar.y + 30, this.groundY - 290);
    t.air = true; t.pose = 'tumble';
    const x0 = t.x, y0 = t.y, T = 0.5 / this.speedMul;
    for (let s = 0; s < T; s += 1 / 60) {
      const k = ease(s / T);
      t.x = x0 + (px - t.w / 2 - x0) * k; t.y = y0 + (py - y0) * k - Math.sin(k * Math.PI) * 40;
      t.rot = k * TAU * -t.facing;
      yield;
    }
    t.rot = 0; t.pose = 'aim'; this.face(t);
    // lock the dive line, telegraph it
    const tx = this.player.cx, ty = this.groundY - t.h / 2;
    addMark(this, { type: 'line', x0: t.cx, y0: t.cy, x1: tx, y1: ty, life: 0.42 });
    t.tele = 0.42; this.sfx('warn');
    yield 0.42;
    this.sfx('dash');
    const dx = tx - t.cx, dy = ty - t.cy, d = Math.hypot(dx, dy) || 1;
    const sp = 980 * this.speedMul;
    t.pose = 'dive'; t.trailOn = true;
    t.rot = Math.atan2(dy, Math.abs(dx)) * 0.6;
    for (;;) {
      t.x += dx / d * sp / 60; t.y += dy / d * sp / 60;
      if (t.y + t.h >= this.groundY) { t.y = this.groundY - t.h; break; }
      if (t.x <= ar.x || t.x + t.w >= ar.x + ar.w) { t.x = clamp(t.x, ar.x, ar.x + ar.w - t.w); }
      yield;
    }
    t.air = false; t.rot = 0; t.trailOn = false; t.pose = 'skid';
    this.shake(5, 0.25); this.sfx('slam');
    this.fx.burst(t.cx, this.groundY, 14, { color: '#ffb347', speed: 300, angle: -Math.PI / 2, spread: 2.6, size: 3, life: 0.5, glow: true });
    if (this.phase >= 2) {
      this.shockwave(t.cx - 10, -1, 360, 30, { art: 'cin_wave' });
      this.shockwave(t.cx + 10, 1, 360, 30, { art: 'cin_wave' });
    }
    yield 0.35;
    t.pose = 'idle';
  }
  *ashTaunt(t, dur) {
    yield* this.tAway(t, 300);
    t.pose = 'idle';
    yield dur;
  }

  *emberVolley(t, n) {
    yield* this.tAway(t, 380);
    t.hover = 26; t.pose = 'cast'; t.tele = 0.5; this.sfx('charge');
    yield 0.5;
    for (let i = 0; i < n; i++) {
      this.face(t);
      this.sfx('spit');
      const hx = t.cx + t.facing * 18, hy = t.y + 12;
      this.fireAt(hx, hy, 330, { art: 'cin_glob', r: 10, life: 4, color: '#ff8a3d', offset: (i - (n - 1) / 2) * 0.12 });
      this.fx.burst(hx, hy, 5, { color: '#ffb347', speed: 120, size: 2.5, life: 0.3, glow: true });
      yield 0.24;
    }
    t.hover = 0;
    yield 0.3;
    t.pose = 'idle';
  }
  *emberLob(t) {
    yield* this.tAway(t, 340);
    t.pose = 'cast'; t.tele = 0.45; this.sfx('charge');
    yield 0.45;
    const n = this.phase >= 3 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      this.sfx('throw');
      const tx = this.player.cx + (i - (n - 1) / 2) * 110;
      const T = 0.9, G = 1100;
      const vx = (tx - t.cx) / T, vy = (this.groundY - 10 - t.y) / T - 0.5 * G * T;
      this.fire(t.cx, t.y + 10, vx, vy, { art: 'cin_glob', r: 11, gravity: G, life: 3, color: '#ff8a3d', noScale: true,
        onDie: (pr) => { this.fx.burst(pr.cx, pr.cy, 10, { color: '#ffb347', speed: 200, angle: -Math.PI / 2, spread: 2, size: 3, life: 0.4, glow: true }); } });
      yield 0.2;
    }
    yield 0.3;
    t.pose = 'idle';
  }
  *emberPillars(t) {
    // to the middle-ish, arms high
    const ar = this.arena, mid = ar.x + ar.w / 2;
    const tx = clamp(t.cx + (mid - t.cx) * 0.6, ar.x + 120, ar.x + ar.w - 120);
    if (Math.abs(tx - t.cx) > 60) yield* this.tLeap(t, tx, 120, 0.55);
    this.face(t);
    t.pose = 'raise'; t.tele = 0.6; this.sfx('charge');
    yield 0.35;
    const sets = this.phase >= 2 ? 2 : 1;
    for (let s = 0; s < sets; s++) {
      const S = 128, off = s * S / 2;
      const steps = [];
      for (let i = 0; ; i++) {
        const d = 70 + off + i * S;
        const xs = [t.cx - d, t.cx + d].filter((x) => x > ar.x + 16 && x < ar.x + ar.w - 16);
        if (!xs.length) break;
        steps.push(xs);
      }
      steps.forEach((xs, i) => xs.forEach((x) => addMark(this, { type: 'fwarn', x, wait: i * 0.09, life: i * 0.09 + 0.6 })));
      yield 0.6;
      for (const xs of steps) {
        for (const x of xs) {
          this.zone(x - 20, this.groundY - 200, 40, 200, 0.4);
          addMark(this, { type: 'fpillar', x, life: 0.5 });
        }
        this.sfx('burst'); this.shake(2, 0.1);
        yield 0.09;
      }
      yield 0.3;
    }
    t.pose = 'idle';
    yield 0.2;
  }
  *emberRing(t) {
    t.hover = 40; t.pose = 'raise'; t.tele = 0.5; this.sfx('charge');
    yield 0.5;
    const rings = this.phase >= 3 ? 2 : 1, n = 10, a0 = this.rand(0, TAU);
    for (let r = 0; r < rings; r++) {
      this.fireRing(t.cx, t.cy - 6, n, 220, { art: 'cin_glob', r: 9, life: 4, color: '#ff8a3d', a0: a0 + r * Math.PI / n });
      this.sfx('burst');
      yield 0.5;
    }
    t.hover = 0; t.pose = 'idle';
  }

  // ---- combos ----
  *dashVolley() {
    this.run(this.ash, this.ashDash(this.ash, this.phase >= 3 ? 2 : 1));
    this.run(this.ember, this.emberVolley(this.ember, this.phase === 1 ? 3 : 4));
    yield* this.join();
    yield this.rec(0.6);
  }
  *vaultDive() {
    this.run(this.ash, this.ashVault(this.ash));
    this.run(this.ember, this.phase >= 2 ? this.emberLob(this.ember) : this.ashTaunt(this.ember, 0.4));
    yield* this.join();
    yield this.rec(0.6);
  }
  *pillars() {
    this.run(this.ember, this.emberPillars(this.ember));
    this.run(this.ash, this.ashTaunt(this.ash, 0.2));
    yield* this.join();
    if (this.phase >= 3) { this.run(this.ash, this.ashDash(this.ash, 1)); yield* this.join(); }
    yield this.rec(0.6);
  }
  *swapCross() {
    // Ash and Ember take opposite walls with Bead between, then cross through each other
    const ar = this.arena;
    const L = ar.x + 50, R = ar.x + ar.w - 50;
    const ashLeft = Math.abs(this.ash.cx - L) + Math.abs(this.ember.cx - R) < Math.abs(this.ash.cx - R) + Math.abs(this.ember.cx - L);
    this.run(this.ash, this.tLeap(this.ash, ashLeft ? L : R, 140, 0.6));
    this.run(this.ember, this.tLeap(this.ember, ashLeft ? R : L, 140, 0.6));
    yield* this.join();
    for (const t of this.twins) { this.face(t); t.facing = t.cx < ar.x + ar.w / 2 ? 1 : -1; t.pose = 'crouch'; t.tele = 0.55; }
    this.sfx('charge'); this.sfx('warn');
    yield 0.55;
    this.sfx('dash');
    const dist = ar.w - 100;
    const sp = 640 + this.phase * 40;
    this.run(this.ash, this.tDash(this.ash, this.ash.facing, sp, dist));
    this.run(this.ember, this.tDash(this.ember, this.ember.facing, sp * 0.82, dist));
    yield* this.join();
    for (const t of this.twins) { t.pose = 'idle'; this.face(t); }
    yield this.rec(0.7);
  }
  *catapult() {
    const a = this.ash, e = this.ember;
    // Ash runs to Ember, Ember cups her hands
    e.pose = 'catch'; e.tele = 0.6; this.face(e);
    const side = sign(a.cx - e.cx) || 1;
    const dist = Math.abs(a.cx - (e.cx + side * 30));
    if (dist > 20) { this.sfx('dash'); yield* this.tDash(a, -side, 700, dist); }
    a.pose = 'crouch';
    yield 0.25;
    // launch
    this.sfx('leap'); this.sfx('burst');
    e.pose = 'raise';
    a.air = true; a.pose = 'tumble'; a.trailOn = true;
    this.fx.burst(e.cx, e.y, 16, { color: '#ffb347', speed: 300, angle: -Math.PI / 2, spread: 1, size: 3, life: 0.5, glow: true });
    for (let s = 0; s < 0.45; s += 1 / 60) { a.y -= 1500 * this.speedMul / 60; a.rot += 0.5; yield; }
    a.hidden = true; a.trailOn = false;
    this.run(e, this.emberRing(e));
    const tx = clamp(this.player.cx, this.arena.x + 30, this.arena.x + this.arena.w - 30);
    addMark(this, { type: 'meteor', x: tx, life: 0.75 });
    this.sfx('warn');
    yield 0.75;
    a.hidden = false; a.x = tx - a.w / 2; a.y = this.arena.y - a.h; a.pose = 'dive'; a.rot = 0; a.trailOn = true;
    for (;;) {
      a.y += 1500 * this.speedMul / 60;
      if (a.y + a.h >= this.groundY) { a.y = this.groundY - a.h; break; }
      yield;
    }
    a.air = false; a.trailOn = false; a.pose = 'skid';
    this.shake(9, 0.4); this.sfx('slam'); this.sfx('explode');
    this.fx.burst(a.cx, this.groundY, 26, { color: '#ffb347', speed: 380, angle: -Math.PI / 2, spread: 2.4, size: 3.5, life: 0.6, glow: true });
    this.shockwave(a.cx - 12, -1, 400, 32, { art: 'cin_wave' });
    this.shockwave(a.cx + 12, 1, 400, 32, { art: 'cin_wave' });
    yield* this.join();
    yield 0.3;
    a.pose = 'idle';
    yield this.rec(0.6);
  }
  *fireWheel() {
    const a = this.ash, e = this.ember, ar = this.arena;
    // meet away from Bead
    const meet = clamp(this.player.cx < ar.x + ar.w / 2 ? ar.x + ar.w - 140 : ar.x + 140, ar.x + 60, ar.x + ar.w - 60);
    this.run(a, this.tLeap(a, meet - 24, 120, 0.55));
    this.run(e, this.tLeap(e, meet + 24, 120, 0.55));
    yield* this.join();
    a.facing = 1; e.facing = -1; a.pose = e.pose = 'catch';
    this.sfx('charge');
    yield 0.25;
    a.hidden = e.hidden = true;
    const r = 52;
    this.wheel = { x: meet, y: this.groundY - r, r, vx: 0, ang: 0, spin: 0 };
    this.tele = 0.6; this.sfx('warn');
    for (let s = 0; s < 0.6 / this.speedMul; s += 1 / 60) { this.wheel.vx = sign(this.player.cx - meet) * 40 * s; yield; }
    const passes = this.phase >= 3 ? 3 : 2;
    let dir = sign(this.player.cx - meet) || 1;
    const sp = 560 + this.phase * 50;
    this.sfx('dash');
    for (let pss = 0; pss < passes; pss++) {
      for (;;) {
        this.wheel.vx = dir * sp * this.speedMul;
        this.wheel.x += this.wheel.vx / 60;
        if (this.wheel.x - r <= ar.x || this.wheel.x + r >= ar.x + ar.w) {
          this.wheel.x = clamp(this.wheel.x, ar.x + r, ar.x + ar.w - r);
          break;
        }
        yield;
      }
      this.shake(6, 0.25); this.sfx('slam');
      this.fx.burst(this.wheel.x + dir * r, this.wheel.y, 14, { color: '#ffb347', speed: 280, size: 3, life: 0.5, glow: true });
      dir = -dir;
      if (pss < passes - 1) { this.wheel.vx = 0; yield 0.35; }
    }
    // split apart
    const w = this.wheel;
    this.wheel = null;
    a.hidden = e.hidden = false;
    a.x = w.x - 30 - a.w / 2; e.x = w.x + 30 - e.w / 2;
    a.y = this.groundY - a.h; e.y = this.groundY - e.h;
    this.sfx('burst');
    this.run(a, this.tLeap(a, w.x - 160, 100, 0.5));
    this.run(e, this.tLeap(e, w.x + 160, 100, 0.5));
    yield* this.join();
    yield this.rec(0.7);
  }

  onPhase(n) {
    this.sfx('bossRoar'); this.shake(6, 0.6);
    for (const t of this.twins) { t.tele = 0.8; this.fx.burst(t.cx, t.cy, 18, { color: '#ffb347', speed: 280, size: 3, life: 0.6, glow: true }); }
    if (n === 3) { this.speedMul *= 1.15; this.game.flash('rgba(255,140,60,0.35)', 0.35); }
  }
  onDeath() {
    this.marks = [];
    if (this.wheel) {
      const w = this.wheel; this.wheel = null;
      this.ash.hidden = this.ember.hidden = false;
      this.ash.x = w.x - 40; this.ember.x = w.x + 10;
    }
    for (const t of this.twins) { t.hidden = false; t.air = false; t.co = null; t.hover = 0; t.rot = 0; }
  }

  // ------------------------------------------------------------------ drawing
  drawBody(ctx, time, white) {
    if (!white) this.drawMarksBack(ctx, time);
    // afterimages
    if (!white) {
      for (const t of this.twins) {
        for (const q of t.trail) {
          ctx.globalAlpha = (q.life / 0.25) * 0.35;
          this.drawTwin(ctx, Object.assign(Object.create(Twin.prototype), t, { x: q.x, y: q.y, rot: q.rot, pose: q.pose, facing: q.facing, flash: 0, tele: 0 }), time, false, true);
        }
      }
      ctx.globalAlpha = 1;
    }
    if (this.wheel) this.drawWheel(ctx, time, white);
    for (const t of this.twins) if (!t.hidden) this.drawTwin(ctx, t, time, white || t.flash > 0);
  }

  drawWheel(ctx, time, white) {
    const w = this.wheel;
    ctx.save();
    ctx.translate(w.x, w.y);
    if (!white) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, w.r * 2.2);
      g.addColorStop(0, 'rgba(255,230,160,0.7)'); g.addColorStop(0.5, 'rgba(255,120,40,0.35)'); g.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, w.r * 2.2, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.rotate(w.ang);
    // flame tongues around the rim
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      const L = w.r + 10 + Math.sin(time * 20 + i * 1.7) * 5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.2) * w.r, Math.sin(a - 0.2) * w.r);
      ctx.quadraticCurveTo(Math.cos(a) * (L + 6), Math.sin(a) * (L + 6), Math.cos(a + 0.25) * L, Math.sin(a + 0.25) * L);
      ctx.lineTo(Math.cos(a + 0.2) * w.r, Math.sin(a + 0.2) * w.r);
      ctx.fillStyle = white ? '#fff' : i % 2 ? '#ff8a3d' : '#9a93a6'; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, w.r, 0, TAU);
    ctx.fillStyle = col(white, '#3a1a14'); ctx.fill();
    ctx.strokeStyle = col(white, INK); ctx.lineWidth = 3; ctx.stroke();
    // the two of them curled together: two masks opposite
    for (const [k, a] of [['ash', 0], ['ember', Math.PI]]) {
      const P = TWIN_PAL[k];
      const mx = Math.cos(a) * w.r * 0.45, my = Math.sin(a) * w.r * 0.45;
      ctx.beginPath(); ctx.arc(mx, my, 13, 0, TAU);
      ctx.fillStyle = col(white, P.mask); ctx.fill(); ctx.strokeStyle = col(white, INK); ctx.lineWidth = 2; ctx.stroke();
      if (!white) {
        ctx.save(); ctx.translate(mx, my); ctx.rotate(-w.ang);
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.ellipse(-4, -1, 2.6, 4.4, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(5, -1, 2.6, 4.4, 0, 0, TAU); ctx.fill();
        eye(ctx, -4, -1, 1.6, P.eye, true); eye(ctx, 5, -1, 1.6, P.eye, true);
        ctx.restore();
      }
      ctx.strokeStyle = col(white, P.wrap); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, w.r * 0.8, a + 0.6, a + 2.4); ctx.stroke();
    }
    ctx.restore();
  }

  drawTwin(ctx, t, time, white, ghost) {
    const P = TWIN_PAL[t.kind];
    const h = t.h, an = t.anim;
    ctx.save();
    ctx.translate(t.cx, t.y + h);
    if (t.rot) { ctx.translate(0, -h / 2); ctx.rotate(t.rot); ctx.translate(0, h / 2); }
    ctx.scale(t.facing, 1);
    const SC = t.h / 60; ctx.scale(SC, SC); // limbs are authored at 60px tall
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const ink = ghost ? P.trail : col(white, INK);
    const pose = t.pose;
    const bob = pose === 'idle' ? Math.sin(an * 5) * 2 : 0;
    // pose table: hip height, lean, legs [knee, foot] x2, arms [elbow, hand] x2
    let hipY = -26, lean = 0, legs, arms;
    const run = Math.sin(an * 14);
    switch (pose) {
      case 'crouch': hipY = -16; lean = 0.35; legs = [[10, -10, 6, 0], [-8, -6, -12, 0]]; arms = [[-10, -30, -22, -24], [-6, -32, -18, -20]]; break;
      case 'dash': hipY = -13; lean = 1.15; legs = [[-12, -16, -26, -12], [-6, -10, -22, -4]]; arms = [[10, -30, 24, -30], [-12, -34, -26, -38]]; break;
      case 'skid': hipY = -18; lean = -0.35; legs = [[12, -8, 20, 0], [-6, -10, -4, 0]]; arms = [[-14, -30, -24, -40], [8, -36, 18, -44]]; break;
      case 'aim': hipY = -26; lean = 0.2; legs = [[6, -16, 2, -6], [-8, -14, -14, -4]]; arms = [[14, -38, 26, -32], [-10, -40, -20, -48]]; break;
      case 'dive': hipY = -26; lean = 0.6; legs = [[-6, -16, -14, -8], [-2, -12, -6, -2]]; arms = [[16, -30, 28, -16], [10, -34, 26, -22]]; break;
      case 'cast': hipY = -27; lean = -0.1; legs = [[5, -14, 6, 0], [-6, -14, -8, 0]]; arms = [[14, -44, 26, -54 + Math.sin(an * 12) * 3], [10, -42, 24, -40]]; break;
      case 'raise': hipY = -28; lean = -0.05; legs = [[6, -14, 9, 0], [-6, -14, -9, 0]]; arms = [[8, -56, 6, -72], [-8, -56, -6, -72]]; break;
      case 'catch': hipY = -18; lean = 0.25; legs = [[12, -10, 14, 0], [-10, -10, -14, 0]]; arms = [[14, -24, 24, -16], [10, -26, 22, -12]]; break;
      case 'tumble': hipY = -30; lean = 0; legs = [[10, -30, 2, -22], [6, -24, -2, -18]]; arms = [[10, -40, 6, -30], [4, -42, 2, -32]]; break;
      case 'fall': hipY = -10; lean = 0.9; legs = [[10, -6, 18, 0], [-6, -4, 2, 0]]; arms = [[14, -14, 24, -2], [6, -12, 16, 0]]; break;
      default: legs = [[5 + run * 0, -13, 7, 0], [-5, -13, -8, 0]]; arms = [[10, -36 + bob, 14, -24 + bob], [-10, -36 + bob, -14, -24 + bob]];
    }
    if (t.hoverC > 2 && (pose === 'cast' || pose === 'raise')) { legs = [[4, -16, 2, -6], [-4, -14, -6, -4]]; }
    hipY += bob;
    const hip = { x: 0, y: hipY };
    const nk = { x: Math.sin(lean) * 26, y: hipY - Math.cos(lean) * 26 };
    // scarf (flutters behind)
    const sc = ghost ? P.trail : col(white, P.wrap);
    ctx.strokeStyle = sc; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(nk.x, nk.y + 2);
    for (let i = 1; i <= 5; i++) ctx.lineTo(nk.x - i * 7 - (pose === 'dash' ? i * 4 : 0), nk.y + 2 + Math.sin(an * 10 - i) * 3 * i * 0.5 + i * 2);
    ctx.stroke();
    // head flame plume (behind head)
    const hd = { x: nk.x + Math.sin(lean) * 10, y: nk.y - 11 };
    if (!white && !ghost) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const fh = (t.kind === 'ember' ? 30 : 22) * (1 - i * 0.22) * (1 + Math.sin(an * 17 + i * 2) * 0.12) * (1 + (t.tele > 0 ? 0.5 : 0));
        ctx.fillStyle = P.flame[i];
        ctx.beginPath();
        ctx.moveTo(hd.x - 9 + i * 3, hd.y - 2);
        ctx.quadraticCurveTo(hd.x - 14 - Math.sin(an * 9 + i) * 4, hd.y - fh * 0.6, hd.x - 8 - (pose === 'dash' ? 16 : 4) + Math.sin(an * 13 + i) * 4, hd.y - fh);
        ctx.quadraticCurveTo(hd.x + 2, hd.y - fh * 0.5, hd.x + 9 - i * 3, hd.y - 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // legs
    ctx.strokeStyle = ink; ctx.lineWidth = 6;
    for (const [kx, ky, fx, fy] of legs) {
      ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.quadraticCurveTo(kx, ky + bob * 0.5, fx, fy); ctx.stroke();
    }
    if (!ghost) {
      ctx.strokeStyle = col(white, P.body); ctx.lineWidth = 3;
      for (const [kx, ky, fx, fy] of legs) { ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.quadraticCurveTo(kx, ky + bob * 0.5, fx, fy); ctx.stroke(); }
    }
    // torso (teardrop)
    ctx.beginPath();
    const px = -Math.cos(lean), py = -Math.sin(lean);
    ctx.moveTo(hip.x + px * 5, hip.y + py * 5);
    ctx.quadraticCurveTo(hip.x + px * 14 + (nk.x - hip.x) * 0.5, hip.y + py * 14 + (nk.y - hip.y) * 0.5, nk.x + px * 8, nk.y + py * 8);
    ctx.lineTo(nk.x - px * 8, nk.y - py * 8);
    ctx.quadraticCurveTo(hip.x - px * 12 + (nk.x - hip.x) * 0.5, hip.y - py * 12 + (nk.y - hip.y) * 0.5, hip.x - px * 5, hip.y - py * 5);
    ctx.closePath();
    ctx.fillStyle = ghost ? P.trail : col(white, P.body); ctx.fill();
    if (!ghost) { ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.stroke(); }
    // wraps across the torso
    if (!ghost) {
      ctx.strokeStyle = col(white, P.wrap); ctx.lineWidth = 2.5;
      for (const k of [0.35, 0.6]) {
        const wx = hip.x + (nk.x - hip.x) * k, wy = hip.y + (nk.y - hip.y) * k;
        ctx.beginPath(); ctx.moveTo(wx + px * 9, wy + py * 9 + 2); ctx.lineTo(wx - px * 9, wy - py * 9 - 2); ctx.stroke();
      }
    }
    // arms
    ctx.strokeStyle = ink; ctx.lineWidth = 5;
    for (const [ex, ey, hx, hy] of arms) {
      ctx.beginPath(); ctx.moveTo(nk.x, nk.y + 3); ctx.quadraticCurveTo(ex, ey, hx, hy); ctx.stroke();
    }
    if (!ghost) {
      // burning hands
      for (const [, , hx, hy] of arms) {
        if (!white && (t.kind === 'ember' || pose === 'dash' || t.tele > 0)) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const r = (t.kind === 'ember' ? 9 : 6) * (1 + Math.sin(an * 20 + hx) * 0.15) * (t.tele > 0 ? 1.5 : 1);
          const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
          g.addColorStop(0, '#fff4c8'); g.addColorStop(0.4, P.flame[1]); g.addColorStop(1, 'rgba(255,60,20,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, r, 0, TAU); ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = col(white, P.body); ctx.strokeStyle = col(white, INK); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(hx, hy, 3, 0, TAU); ctx.fill(); ctx.stroke();
      }
    }
    // head + mask
    ctx.beginPath(); ctx.ellipse(hd.x, hd.y, 10, 11.5, lean * 0.5, 0, TAU);
    ctx.fillStyle = ghost ? P.trail : col(white, P.mask); ctx.fill();
    if (!ghost) {
      ctx.strokeStyle = col(white, INK); ctx.lineWidth = 2.5; ctx.stroke();
      if (!white) {
        // paint: Ash has a grey ash-smear, Ember a red flame stroke
        ctx.strokeStyle = P.paint; ctx.lineWidth = 2;
        ctx.beginPath();
        if (t.kind === 'ash') { ctx.moveTo(hd.x - 7, hd.y + 6); ctx.lineTo(hd.x + 3, hd.y + 9); }
        else { ctx.moveTo(hd.x + 1, hd.y - 10); ctx.quadraticCurveTo(hd.x - 2, hd.y - 5, hd.x + 2, hd.y - 2); }
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.ellipse(hd.x + 1, hd.y, 2.8, 4.4, 0.15, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(hd.x + 7.5, hd.y, 2.4, 4, -0.15, 0, TAU); ctx.fill();
        const er = t.tele > 0 ? 2.4 : 1.7;
        eye(ctx, hd.x + 1, hd.y, er, P.eye, true, t.kind === 'ash' ? 'angry' : 'round');
        eye(ctx, hd.x + 7.5, hd.y, er * 0.9, P.eye, true, t.kind === 'ash' ? 'angry' : 'round');
        if (t.kind === 'ash') { ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hd.x - 3, hd.y - 11); ctx.lineTo(hd.x - 1, hd.y - 5); ctx.lineTo(hd.x - 4, hd.y - 2); ctx.stroke(); }
      }
    }
    ctx.restore();
  }

  drawMarksBack(ctx, time) {
    for (const { m, age, k } of liveMarks(this)) {
      const gy = this.groundY;
      if (m.type === 'fwarn') {
        if (age < m.wait) continue;
        const kk = Math.min(1, (age - m.wait) / Math.max(0.01, m.life - m.wait));
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(m.x, gy, 1, m.x, gy, 34);
        g.addColorStop(0, `rgba(255,190,90,${0.3 + 0.5 * kk})`); g.addColorStop(1, 'rgba(255,90,30,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(m.x, gy, 34, 14, 0, Math.PI, TAU); ctx.fill();
        ctx.fillStyle = `rgba(255,140,60,${0.08 + 0.12 * kk})`;
        ctx.fillRect(m.x - 18, gy - 200, 36, 200);
        ctx.restore();
        ctx.strokeStyle = `rgba(255,200,120,${0.5 + 0.5 * Math.abs(Math.sin(time * 18))})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(m.x - 14, gy - 1); ctx.lineTo(m.x - 4, gy - 4); ctx.lineTo(m.x + 3, gy - 1); ctx.lineTo(m.x + 14, gy - 3); ctx.stroke();
      } else if (m.type === 'fpillar') {
        const rise = Math.min(1, k * 6), fall = k > 0.7 ? (1 - k) / 0.3 : 1;
        const H = 200 * rise;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const wd = (26 - i * 7) * fall;
          const g = ctx.createLinearGradient(0, gy - H, 0, gy);
          g.addColorStop(0, 'rgba(255,200,100,0)'); g.addColorStop(0.3, i === 2 ? 'rgba(255,250,220,0.9)' : 'rgba(255,140,50,0.55)'); g.addColorStop(1, i === 2 ? '#fff4d0' : 'rgba(255,90,30,0.8)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(m.x - wd, gy);
          ctx.quadraticCurveTo(m.x - wd * 0.8 + Math.sin(time * 30 + i) * 4, gy - H * 0.6, m.x + Math.sin(time * 20 + i * 2) * 6, gy - H);
          ctx.quadraticCurveTo(m.x + wd * 0.8 + Math.sin(time * 27 + i) * 4, gy - H * 0.6, m.x + wd, gy);
          ctx.fill();
        }
        ctx.restore();
      } else if (m.type === 'line') {
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = `rgba(255,190,110,${0.4 + 0.5 * Math.abs(Math.sin(time * 16))})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(m.x0, m.y0); ctx.lineTo(m.x1, m.y1); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.ellipse(m.x1, gy - 1, 22, 6, 0, 0, TAU); ctx.stroke();
      } else if (m.type === 'meteor') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,140,60,${0.06 + 0.16 * k})`;
        ctx.fillRect(m.x - 20, this.arena.y, 40, gy - this.arena.y);
        ctx.restore();
        ctx.fillStyle = `rgba(10,4,2,${0.3 + 0.4 * k})`;
        ctx.beginPath(); ctx.ellipse(m.x, gy - 1, 14 + 16 * k, 5, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(255,190,110,${0.5 + 0.5 * Math.abs(Math.sin(time * 18))})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(m.x, gy - 1, 34, 9, 0, 0, TAU); ctx.stroke();
      }
    }
  }
}

export default { vitrius: Vitrius, cindertwins: CinderTwins };
