// Bosses of Spindletown: The Rollmaster Trio (Spin, Rebound, Cyclone) — the dojo's grand duel.
// One shared life, three bodies. Each master duels Bead alone, then all three fight together.
import { Boss } from './boss.js';
import { TAU, clamp, sign } from '../core/math.js';
import { INK, eye } from '../art/creatures.js';
import { registerProjectileArt } from '../entities/projectile.js';
import { moveX } from '../world/movement.js';

const col = (white, c) => (white ? '#fff' : c);
function inkS(ctx, white, lw = 3) { ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
function fillInk(ctx, fill, white, lw = 3) { ctx.fillStyle = white ? '#fff' : fill; ctx.fill(); inkS(ctx, white, lw); }
function glow(ctx, x, y, r, rgb, a = 0.5) {
  if (r <= 0 || a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}

const ORDER = ['spin', 'rebound', 'cyclone'];
const PAL = {
  spin: { a: '#c8343c', b: '#f3e7cf', dark: '#6e1820', eye: '#ffd56a', rgb: '255,200,110', band: '#f3efe6', name: 'Spin' },
  rebound: { a: '#2fa58c', b: '#1d5f54', hi: '#a6f2dc', eye: '#e9ff7a', rgb: '190,255,150', name: 'Rebound' },
  cyclone: { a: '#eef2fa', b: '#a9bbe0', dark: '#55699c', eye: '#9ff2ff', rgb: '160,235,255', crest: '#4f6fc0', name: 'Cyclone' },
};
const LINES = {
  spin: ['Spin. Steady as the axle.', '…a clean strike.'],
  rebound: ['Rebound! I bend, I never break!', 'Ha! You hit like a boulder!'],
  cyclone: ['Cyclone. Be the wind, little bead.', '…the breeze yields.'],
};

// ---------------------------------------------------------------- projectile art
registerProjectileArt('rm_top', (ctx, p, t) => {
  const r = p.r;
  ctx.save(); ctx.translate(p.cx, p.cy + Math.sin(p.age * 30) * 0.8);
  ctx.beginPath(); ctx.moveTo(-r, -r * 0.1); ctx.quadraticCurveTo(0, -r * 1.1, r, -r * 0.1); ctx.lineTo(0, r); ctx.closePath();
  ctx.fillStyle = '#c8343c'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#f3e7cf';
  for (let i = 0; i < 4; i++) { const u = ((i / 4 + p.age * 3) % 1) * 2 - 1; ctx.beginPath(); ctx.ellipse(u * r, 0, r * 0.18 * Math.sqrt(1 - u * u) + 0.5, r * 1.2, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = INK; ctx.fillRect(-1.5, -r * 1.05, 3, -r * 0.4);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,220,170,0.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(p.cx, p.cy + r * 0.2, r * 1.5, r * 0.35, 0, 0, Math.PI); ctx.stroke();
});
registerProjectileArt('rm_pellet', (ctx, p) => {
  const r = p.r;
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(p.cx, p.cy, r + 2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2fa58c'; ctx.beginPath(); ctx.arc(p.cx, p.cy, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#1d5f54'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.cx, p.cy, r * 0.7, p.age * 8, p.age * 8 + 2.5); ctx.stroke();
  ctx.fillStyle = 'rgba(230,255,245,0.8)'; ctx.beginPath(); ctx.arc(p.cx - r * 0.35, p.cy - r * 0.35, r * 0.3, 0, TAU); ctx.fill();
});

// =====================================================================================
export class RollmasterTrio extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'rollmasters', size: [68, 68], air: true, music: 'boss_optional', glints: 300, phases: [0.8, 0.6, 0.4], introTime: 2.8 });
    if (this.dead) return;
    this.noPhysics = true;
    const A = this.arena, gy = this.groundY;
    const mk = (kind, x, state) => ({
      kind, x, y: kind === 'cyclone' && state === 'active' ? gy - 150 : gy - 34, vx: 0, vy: 0, r: 34, ang: 0, spinV: kind === 'spin' ? 6 : 0,
      facing: -1, sq: 0, state, phys: true, bouncy: false, grounded: true, drive: false, flashT: 0, tele: 0, busy: false, co: null, wait: 0,
      bow: 0, aim: null, last: null, trail: [], hitWall: 0, wing: 0, seed: Math.random() * 10,
    });
    this.ms = [mk('spin', this.cx, 'active'), mk('rebound', this.benchX('rebound'), 'bench'), mk('cyclone', this.benchX('cyclone'), 'bench')];
    this.byKind = {}; for (const m of this.ms) this.byKind[m.kind] = m;
    this.focus = this.ms[0];
    this.marker = null; this.twister = null; this.wind = null; this.turn = 0;
  }

  benchX(kind) {
    const A = this.arena;
    return kind === 'rebound' ? A.x + 54 : kind === 'cyclone' ? A.x + A.w - 54 : A.x + A.w - 128;
  }
  activeList() { return this.ms.filter((m) => m.state === 'active'); }
  faceM(m) { m.facing = this.player.cx < m.x ? -1 : 1; }
  mbox(m) { const r = m.r * 0.82; return { x: m.x - r, y: m.y - r, w: r * 2, h: r * 2 }; }

  // ---------------- combat plumbing (three bodies, one life)
  hurtboxes() { return this.mode === 'fight' && this.hittable ? this.activeList().map((m) => this.mbox(m)) : []; }
  hurtbox() { const a = this.activeList()[0]; return a ? this.mbox(a) : { x: -9999, y: -9999, w: 1, h: 1 }; }
  hitboxes() { return this.mode === 'fight' && this.hittable ? [...this.activeList().map((m) => this.mbox(m)), ...this.hits] : [...this.hits]; }
  hurt(dmg, dir, src) {
    if (!this.hittable || this.mode !== 'fight') return;
    const p = this.player;
    let best = null, bd = 1e9;
    for (const m of this.activeList()) { const d = Math.hypot(m.x - p.cx, m.y - p.cy); if (d < bd) { bd = d; best = m; } }
    if (best) { best.flashT = 0.1; this.fx.burst(best.x, best.y, 5, { color: PAL[best.kind].eye, speed: 200, size: 2.5, life: 0.3 }); }
    super.hurt(dmg, dir, src);
  }

  // ---------------- per-master coroutine runner (support attacks in the finale)
  stepRunner(m, dt) {
    if (!m.co) return;
    if (m.wait > 0) { m.wait -= dt; return; }
    const r = m.co.next();
    if (r.done) m.co = null;
    else if (typeof r.value === 'number') m.wait = r.value / this.speedMul;
  }

  mPhys(m, dt) {
    const A = this.arena, gy = this.groundY;
    if (m.state === 'bench') {
      m.vx = 0; m.vy = 0; m.x += (this.benchX(m.kind) - m.x) * Math.min(1, dt * 3);
      m.y += (gy - m.r - m.y) * Math.min(1, dt * 5);
      return;
    }
    if (!m.phys) return;
    const flyer = m.kind === 'cyclone';
    if (!flyer) m.vy = Math.min(m.vy + 2100 * dt, 1400);
    m.x += m.vx * dt; m.y += m.vy * dt;
    m.hitWall = 0;
    if (m.x - m.r < A.x) { m.x = A.x + m.r; m.hitWall = -1; m.vx = m.bouncy ? Math.abs(m.vx) * 0.9 : 0; }
    if (m.x + m.r > A.x + A.w) { m.x = A.x + A.w - m.r; m.hitWall = 1; m.vx = m.bouncy ? -Math.abs(m.vx) * 0.9 : 0; }
    if (m.y - m.r < A.y) { m.y = A.y + m.r; m.vy = Math.abs(m.vy) * 0.5; }
    m.grounded = false;
    if (m.y + m.r >= gy) {
      m.y = gy - m.r;
      if (m.bouncy && m.vy > 260) { m.vy = -m.vy * 0.55; m.sq = 0.35; } else m.vy = 0;
      m.grounded = true;
      if (!m.drive) m.vx *= Math.pow(0.004, dt);
    }
    if (flyer && !m.drive) { m.vx *= Math.pow(0.05, dt); m.vy *= Math.pow(0.05, dt); }
  }

  // idle footwork between attacks: keep a respectful duelling distance
  drift(m, dt) {
    if (m.busy || m.state !== 'active' || m.bow) return;
    const p = this.player, d = p.cx - m.x, ad = Math.abs(d);
    let want = 0;
    if (ad < 150) want = -sign(d) * 150; else if (ad > 430) want = sign(d) * 150;
    if (this.phase >= 4) {
      // spread out so the three don't stack
      for (const o of this.activeList()) if (o !== m && Math.abs(o.x - m.x) < 110) want += sign(m.x - o.x || 1) * 120;
    }
    m.vx += (want - m.vx) * Math.min(1, dt * 4);
    if (m.kind === 'cyclone') {
      const hy = this.groundY - 150 + Math.sin(this.anim * 2 + m.seed) * 14;
      m.vy += ((hy - m.y) * 3 - m.vy) * Math.min(1, dt * 4);
    }
    if (ad > 30) m.facing = sign(d);
  }

  think(dt) {
    for (const m of this.ms) {
      this.stepRunner(m, dt);
      this.drift(m, dt);
      this.mPhys(m, dt);
      m.flashT -= dt; if (m.tele > 0) m.tele -= dt;
      m.ang += (m.kind === 'spin' ? m.spinV : m.kind === 'cyclone' ? 3 + m.spinV : m.vx / m.r) * dt;
      m.sq *= Math.pow(0.004, dt);
      const sp = Math.hypot(m.vx, m.vy);
      if (m.state === 'active' && (sp > 450 || m.dashFx)) m.trail.push({ x: m.x, y: m.y, life: 0.22 });
      for (const q of m.trail) q.life -= dt;
      m.trail = m.trail.filter((q) => q.life > 0);
      if (m.kind === 'spin' && m.spinV > 20 && m.grounded && Math.random() < 0.6) this.fx.add({ x: m.x + this.rand(-6, 6), y: this.groundY - 2, vx: this.rand(-200, 200), vy: -this.rand(60, 220), life: 0.3, size: 2, color: '#ffd56a', g: 900, glow: true, shape: 'streak' });
      if (m.kind === 'cyclone' && m.state === 'active' && Math.random() < 0.25) this.fx.add({ x: m.x + this.rand(-40, 40), y: m.y + this.rand(-40, 40), vx: this.rand(-60, 60), vy: this.rand(-30, 30), life: 0.6, size: 3, color: '#eef2fa', g: 40, shape: 'leaf' });
    }
    const L = this.focus && this.focus.state === 'active' ? this.focus : (this.activeList()[0] || this.ms[0]);
    this.x = L.x - this.w / 2; this.y = L.y - this.h / 2;
  }

  onStart() { for (const m of this.ms) m.facing = this.player.cx < m.x ? -1 : 1; }
  introUpdate(dt, t) {
    for (const m of this.ms) {
      m.bow = t > 0.5 && t < 1.7 ? Math.sin((t - 0.5) / 1.2 * Math.PI) : 0;
      m.ang += (m.kind === 'spin' ? 6 : 1) * dt;
    }
    if (t < 1 / 60 + dt) this.fx.text(this.ms[0].x, this.ms[0].y - 70, 'Three masters. One duel. Bow, little bead.', '#f3e7cf', 14);
    const L = this.ms[0]; this.x = L.x - this.w / 2; this.y = L.y - this.h / 2;
  }

  // ---------------- director
  chooseAttack() { return this.director(); }

  pickFor(m, finale) {
    const near = Math.abs(this.player.cx - m.x) < 300;
    const L = {
      spin: [['dash', 3, this.spinDash], ['drill', 2, this.drill], ['whirl', near ? 3 : 1, this.whirl], ['tops', 2, this.tops]],
      rebound: [['bounces', 2, this.bounces], ['ricochet', 3, this.ricochet], ['slam', 2, this.megaSlam], ['pellets', finale ? 1 : 2, this.pellets]],
      cyclone: [['gust', 2, this.gust], ['tornado', 2, this.tornado], ['fan', 2, this.featherFan], ['dive', 2, this.dive]],
    }[m.kind].filter((a) => a[0] !== m.last);
    const tot = L.reduce((s, a) => s + a[1], 0);
    let r = Math.random() * tot;
    for (const a of L) { r -= a[1]; if (r <= 0) { m.last = a[0]; this.lastAttack = m.kind + ':' + a[0]; return a[2].call(this, m); } }
    m.last = L[0][0]; return L[0][2].call(this, m);
  }
  supportFor(m) { return m.kind === 'spin' ? this.tops(m) : m.kind === 'rebound' ? this.pellets(m) : this.featherFan(m); }

  *run(m, gen) { m.busy = true; this.focus = m; yield* gen; m.busy = false; m.drive = false; }

  *director() {
    const act = this.activeList();
    if (!act.length) { yield 0.5; return; }
    if (this.phase < 4) {
      yield* this.run(act[0], this.pickFor(act[0]));
      yield 0.25;
      return;
    }
    this.turn = (this.turn + 1 + (Math.random() < 0.3 ? 1 : 0)) % 3;
    const m = this.ms[this.turn];
    const others = act.filter((o) => o !== m && !o.co && !o.busy);
    if (others.length && Math.random() < 0.65) { const s = this.pick(others); s.co = this.run(s, this.supportFor(s)); s.wait = 0.35; }
    yield* this.run(m, this.pickFor(m, true));
    yield 0.35;
  }

  // ---------------- movement sub-coroutines
  *mArc(m, tx, ty, time, height = 180) {
    m.phys = false;
    const x0 = m.x, y0 = m.y, T = time / this.speedMul;
    tx = clamp(tx, this.arena.x + m.r, this.arena.x + this.arena.w - m.r);
    for (let t = 0; t < T; t += 1 / 60) {
      const k = t / T;
      m.x = x0 + (tx - x0) * k;
      m.y = y0 + (ty - y0) * k - 4 * height * k * (1 - k);
      yield;
    }
    m.x = tx; m.y = ty; m.vx = 0; m.vy = 0; m.phys = true;
  }
  *mMove(m, tx, ty, speed) {
    m.phys = false;
    for (let f = 0; f < 400; f++) {
      const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy), st = speed * this.speedMul / 60;
      if (d <= st) break;
      m.x += dx / d * st; m.y += dy / d * st;
      yield;
    }
    m.x = tx; m.y = ty; m.vx = 0; m.vy = 0; m.phys = true;
  }

  // ================= SPIN — the striped top
  *spinDash(m) {
    this.faceM(m);
    m.tele = 0.55; this.sfx('charge');
    for (let i = 0; i < 33; i++) { m.spinV = 6 + i * 1.2; yield; }
    const bounces = this.phase >= 4 ? 0 : 1;
    m.drive = true;
    for (let b = 0; b <= bounces; b++) {
      this.sfx('dash');
      for (let f = 0; f < 240; f++) { m.vx = m.facing * 720 * this.speedMul; yield; if (m.hitWall) break; }
      m.vx = 0;
      this.sfx('slam'); this.shake(6, 0.25);
      this.fx.burst(m.x + m.facing * m.r, m.y, 12, { color: '#ffd56a', speed: 300, size: 2.5, life: 0.4, glow: true });
      m.facing = -m.facing;
      if (b < bounces) { m.tele = 0.35; yield 0.35; }
    }
    m.drive = false;
    for (let i = 0; i < 20; i++) { m.spinV = Math.max(6, m.spinV - 2); yield; }
    yield 0.5;
  }

  *drill(m) {
    this.faceM(m);
    m.sq = 0.4; m.tele = 0.4; this.sfx('rustle');
    yield 0.4;
    this.sfx('leap'); m.spinV = 30;
    const top = Math.max(this.arena.y + m.r + 30, this.groundY - 320);
    yield* this.mArc(m, this.player.cx, top, 0.5, 80);
    m.phys = false;
    for (let t = 0; t < 0.5; t += 1 / 60) { m.x += clamp(this.player.cx - m.x, -6, 6) * this.speedMul; m.x = clamp(m.x, this.arena.x + m.r, this.arena.x + this.arena.w - m.r); yield; }
    m.tele = 0.38; this.sfx('warn'); m.drillAim = true;
    yield 0.38;
    m.drillAim = false; m.dashFx = true;
    while (m.y + m.r < this.groundY) { m.y = Math.min(this.groundY - m.r, m.y + 1250 * this.speedMul / 60); yield; }
    m.dashFx = false; m.phys = true; m.vy = 0;
    this.sfx('slam'); this.shake(10, 0.35); m.sq = 0.5;
    this.shockwave(m.x - 20, -1, 400, 30, { color: 'rgba(255,214,140,0.9)' });
    this.shockwave(m.x + 20, 1, 400, 30, { color: 'rgba(255,214,140,0.9)' });
    this.fx.burst(m.x, this.groundY, 16, { color: '#f3e7cf', speed: 320, angle: -Math.PI / 2, spread: 2.6, size: 3, life: 0.5 });
    yield this.phase >= 4 ? 0.35 : 0.55;
    m.spinV = 6;
  }

  *whirl(m) {
    this.faceM(m);
    m.drive = true;
    for (let f = 0; f < 50 && Math.abs(this.player.cx - m.x) > 100; f++) { m.vx = m.facing * 400; yield; }
    m.vx = 0; m.drive = false;
    const n = this.phase >= 4 ? 2 : 3;
    for (let k = 0; k < n; k++) {
      m.tele = 0.45; m.spinV = 28; this.sfx('rustle');
      yield 0.45;
      this.sfx('slash'); this.shake(3, 0.15);
      this.fx.ring(m.x, m.y, 30, 110, 0.3, 'rgba(255,214,140,0.9)', 5);
      this.fx.slash(m.x - 60, m.y, Math.PI, 110, 'rgba(255,240,210,0.9)', 0.2, 1);
      this.fx.slash(m.x + 60, m.y, 0, 110, 'rgba(255,240,210,0.9)', 0.2, -1);
      for (let f = 0; f < 12; f++) { this.hits.push({ x: m.x - 100, y: m.y - 64, w: 200, h: 98 }); yield; }
      m.spinV = 10;
      yield 0.28;
    }
    m.spinV = 6;
    yield 0.45;
  }

  *tops(m) {
    this.faceM(m);
    m.tele = 0.45; m.sq = 0.25; this.sfx('rustle');
    yield 0.45;
    const n = this.phase >= 4 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      this.faceM(m);
      this.sfx('throw');
      this.fire(m.x + m.facing * m.r, this.groundY - 12, m.facing * (250 + i * 110), 0, { art: 'rm_top', r: 12, bounce: 1, life: 4.5 });
      yield 0.28;
    }
    yield 0.45;
  }

  // ================= REBOUND — the rubber ball
  *bounces(m) {
    const n = this.phase >= 4 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      this.faceM(m);
      m.sq = 0.45; m.tele = 0.36; this.sfx('rustle');
      yield 0.36;
      m.sq = -0.35; this.sfx('jump');
      yield* this.mArc(m, this.player.cx + this.rand(-20, 20), this.groundY - m.r, 0.62, 210);
      m.sq = 0.5; this.sfx('land'); this.shake(4, 0.2);
      this.shockwave(m.x - 16, -1, 340, 22, { color: 'rgba(170,240,210,0.9)' });
      this.shockwave(m.x + 16, 1, 340, 22, { color: 'rgba(170,240,210,0.9)' });
      yield 0.12;
    }
    yield 0.5;
  }

  *ricochet(m) {
    this.faceM(m);
    const p = this.player;
    const a = Math.atan2(p.cy - m.y - 80, p.cx - m.x);
    m.aim = a; m.sq = 0.55; m.tele = 0.65; this.sfx('charge');
    yield 0.65;
    m.aim = null; this.sfx('dash');
    m.phys = false; m.dashFx = true;
    const A = this.arena, sp = 760 * this.speedMul;
    let vx = Math.cos(a) * sp, vy = Math.sin(a) * sp, hits = 0;
    const maxHits = this.phase >= 4 ? 4 : 5;
    for (let f = 0; f < 420 && hits < maxHits; f++) {
      m.x += vx / 60; m.y += vy / 60; m.vx = vx; m.vy = vy;
      let hit = false;
      if (m.x - m.r < A.x) { m.x = A.x + m.r; vx = Math.abs(vx); hit = true; }
      if (m.x + m.r > A.x + A.w) { m.x = A.x + A.w - m.r; vx = -Math.abs(vx); hit = true; }
      if (m.y - m.r < A.y) { m.y = A.y + m.r; vy = Math.abs(vy); hit = true; }
      if (m.y + m.r > this.groundY) { m.y = this.groundY - m.r; vy = -Math.abs(vy); hit = true; }
      if (hit) { hits++; m.sq = 0.45; this.sfx('bonkWall', 0.6); this.shake(3, 0.12); this.fx.ring(m.x, m.y, 10, 60, 0.25, 'rgba(170,240,210,0.9)', 4); }
      yield;
    }
    m.dashFx = false;
    m.phys = true; m.vx = vx * 0.25; m.vy = vy * 0.25; m.bouncy = true;
    for (let f = 0; f < 90 && !(m.grounded && Math.abs(m.vy) < 1); f++) yield;
    m.bouncy = false;
    yield 0.55;
  }

  *megaSlam(m) {
    this.faceM(m);
    m.sq = 0.7; m.tele = 0.6; this.sfx('charge');
    yield 0.6;
    this.sfx('leap'); m.sq = -0.5;
    m.phys = false;
    const top = this.arena.y - 120;
    while (m.y > top) { m.y -= 1500 / 60; yield; }
    this.marker = { x: this.player.cx, lock: false };
    for (let t = 0; t < 0.85; t += 1 / 60) {
      this.marker.x += clamp(this.player.cx - this.marker.x, -8, 8) * this.speedMul;
      this.marker.x = clamp(this.marker.x, this.arena.x + m.r, this.arena.x + this.arena.w - m.r);
      m.x = this.marker.x; yield;
    }
    this.marker.lock = true; this.sfx('warn');
    yield 0.42;
    m.dashFx = true;
    while (m.y + m.r < this.groundY) { m.y = Math.min(this.groundY - m.r, m.y + 1600 * this.speedMul / 60); yield; }
    m.dashFx = false;
    this.marker = null;
    m.phys = true; m.vy = 0; m.sq = 0.75;
    this.sfx('slam'); this.shake(12, 0.45);
    this.shockwave(m.x - 20, -1, 470, 34, { color: 'rgba(170,240,210,0.9)' });
    this.shockwave(m.x + 20, 1, 470, 34, { color: 'rgba(170,240,210,0.9)' });
    if (this.phase >= 4) for (let i = 0; i < 4; i++) this.fire(m.x, m.y - 20, (i - 1.5) * 180, -560, { gravity: 1200, bounce: 2, art: 'rm_pellet', r: 9, life: 3.5 });
    yield 0.65;
  }

  *pellets(m) {
    this.faceM(m);
    m.sq = 0.35; m.tele = 0.45; this.sfx('rustle');
    yield 0.45;
    const n = this.phase >= 4 ? 3 : 4;
    for (let i = 0; i < n; i++) {
      this.faceM(m);
      this.sfx('spit'); m.sq = 0.3;
      this.fire(m.x + m.facing * 20, m.y - 20, m.facing * (160 + i * 95), -540, { gravity: 1200, bounce: 3, art: 'rm_pellet', r: 9, life: 4.5 });
      yield 0.14;
    }
    yield 0.45;
  }

  // ================= CYCLONE — the feathered wind
  *gust(m) {
    this.faceM(m);
    m.tele = 0.55; m.wing = 1; this.sfx('rustle');
    yield 0.55;
    this.sfx('howl');
    const f = m.facing;
    this.wind = { dir: f, x: m.x };
    const lanes = [this.groundY - 14, this.groundY - 64, this.groundY - 118];
    const order = [0, 2, 1, 0, 1, 2, 0];
    let li = 0, ft = 0;
    const dur = this.phase >= 4 ? 1.2 : 1.5;
    for (let t = 0; t < dur; t += 1 / 60) {
      const p = this.player;
      if (sign(p.cx - m.x) === f && !p.dead) moveX(p.b, this.game.room, f * 240 / 60, 0);
      ft -= 1 / 60;
      if (ft <= 0) {
        ft = 0.24;
        const y = lanes[order[li++ % order.length]];
        this.fire(m.x + f * 30, y, f * 560, 0, { art: 'feather', r: 8, color: '#eef2fa', ignoreWalls: true, life: 3.2 });
      }
      if (Math.random() < 0.9) this.fx.add({ x: m.x + f * this.rand(30, 600), y: this.groundY - this.rand(5, 220), vx: f * this.rand(500, 800), vy: 0, life: 0.35, size: 2, color: 'rgba(220,235,255,0.7)', g: 0, shape: 'streak' });
      m.wing = 1 + Math.sin(t * 40) * 0.3;
      yield;
    }
    this.wind = null; m.wing = 0;
    yield 0.5;
  }

  *tornado(m) {
    yield* this.mMove(m, m.x, this.groundY - m.r, 600);
    this.faceM(m);
    m.tele = 0.6; this.sfx('charge');
    this.twister = { m, h: 0 };
    for (let i = 0; i < 36; i++) { this.twister.h = 180 * i / 36; m.spinV = i; yield; }
    this.sfx('howl');
    const passes = this.phase === 3 ? 2 : 1;
    let dir = sign(this.player.cx - m.x) || m.facing;
    m.phys = false;
    for (let pss = 0; pss < passes; pss++) {
      for (let f = 0; f < 400; f++) {
        m.x += dir * 330 * this.speedMul / 60;
        if (m.x - m.r < this.arena.x || m.x + m.r > this.arena.x + this.arena.w) { m.x = clamp(m.x, this.arena.x + m.r, this.arena.x + this.arena.w - m.r); break; }
        this.hits.push({ x: m.x - 30, y: this.groundY - this.twister.h, w: 60, h: this.twister.h });
        if (Math.random() < 0.8) this.fx.add({ x: m.x + this.rand(-40, 40), y: this.groundY - this.rand(0, 180), vx: this.rand(-60, 60), vy: -this.rand(100, 300), life: 0.5, size: 2.5, color: 'rgba(220,235,255,0.8)', g: 0, shape: 'leaf' });
        yield;
      }
      dir = -dir;
      if (pss < passes - 1) { m.tele = 0.4; for (let i = 0; i < 24; i++) { this.hits.push({ x: m.x - 30, y: this.groundY - this.twister.h, w: 60, h: this.twister.h }); yield; } }
    }
    for (let i = 0; i < 20; i++) { this.twister.h = 180 * (1 - i / 20); yield; }
    this.twister = null; m.spinV = 0;
    m.phys = true;
    yield* this.mMove(m, m.x, this.groundY - 150, 420);
    yield 0.4;
  }

  *featherFan(m) {
    yield* this.mMove(m, clamp(m.x, this.arena.x + 80, this.arena.x + this.arena.w - 80), Math.max(this.arena.y + 60, this.groundY - 230), 520);
    this.faceM(m);
    m.tele = 0.45; m.wing = 1; this.sfx('rustle');
    yield 0.45;
    const volleys = this.phase >= 4 ? 1 : 2;
    for (let v = 0; v < volleys; v++) {
      this.sfx('throw');
      for (let i = 0; i < 5; i++) this.fireAt(m.x, m.y, 420, { offset: (i - 2) * 0.2 + (v ? 0.1 : 0), art: 'feather', r: 8, color: '#eef2fa', life: 3 });
      m.wing = 1.4;
      yield 0.45;
      m.wing = 1;
    }
    m.wing = 0;
    yield 0.35;
  }

  *dive(m) {
    yield* this.mMove(m, m.x, Math.max(this.arena.y + 60, this.groundY - 300), 560);
    this.faceM(m);
    const tx = clamp(this.player.cx, this.arena.x + m.r, this.arena.x + this.arena.w - m.r);
    m.aim = Math.atan2(this.groundY - m.r - m.y, tx - m.x);
    m.tele = 0.55; m.wing = 1.2; this.sfx('screech');
    yield 0.55;
    m.aim = null; m.dashFx = true; this.sfx('dash');
    yield* this.mMove(m, tx, this.groundY - m.r, 980);
    m.dashFx = false; m.sq = 0.5;
    this.sfx('slam'); this.shake(8, 0.3);
    this.fx.burst(m.x, this.groundY, 18, { color: '#eef2fa', speed: 320, angle: -Math.PI / 2, spread: 2.6, size: 4, life: 0.7, shape: 'leaf', g: 300 });
    if (this.phase >= 3) for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.36; this.fire(m.x, m.y - 10, Math.cos(a) * 380, Math.sin(a) * 380, { art: 'feather', r: 8, color: '#eef2fa', life: 2.5 }); }
    yield 0.4;
    m.wing = 0;
    yield* this.mMove(m, m.x, this.groundY - 150, 360);
    yield 0.3;
  }

  // ---------------- phases: a master bows out, the next steps in
  onPhase(n) {
    this.sfx('bossRoar'); this.shake(5, 0.5);
    this.co = this.transition(n); this.wait = 0;
    this.marker = null; this.twister = null; this.wind = null; this.hits.length = 0;
    for (const m of this.ms) { m.co = null; m.busy = false; m.drive = false; m.phys = true; m.aim = null; m.dashFx = false; m.drillAim = false; m.tele = 0; m.wing = 0; m.bouncy = false; m.spinV = m.kind === 'spin' ? 6 : 0; }
    if (n >= 4) this.speedMul *= 1.08;
  }

  *transition(n) {
    this.hittable = false;
    const roster = n <= 3 ? [ORDER[n - 1]] : ORDER.slice();
    const leaving = this.activeList().filter((m) => !roster.includes(m.kind));
    const arriving = this.ms.filter((m) => roster.includes(m.kind) && m.state !== 'active');
    for (const m of leaving) {
      m.bow = 1; this.focus = m;
      this.fx.text(m.x, m.y - 60, LINES[m.kind][1], '#f3e7cf', 13);
    }
    yield 0.9;
    for (const m of leaving) {
      m.bow = 0;
      yield* this.mArc(m, this.benchX(m.kind), this.groundY - m.r, 0.6, 150);
      m.state = 'bench';
    }
    const A = this.arena, p = this.player;
    let slot = 0;
    for (const m of arriving) {
      m.state = 'active';
      this.focus = m;
      const side = p.cx < A.x + A.w / 2 ? 1 : -1;
      const tx = clamp(p.cx + side * (260 + slot * 140), A.x + 60, A.x + A.w - 60);
      const ty = m.kind === 'cyclone' ? this.groundY - 150 : this.groundY - m.r;
      this.sfx('leap');
      yield* this.mArc(m, tx, ty, 0.7, 200);
      m.facing = p.cx < m.x ? -1 : 1;
      slot++;
      if (n <= 3) { this.fx.text(m.x, m.y - 64, LINES[m.kind][0], '#f3e7cf', 14); }
    }
    if (n >= 4) this.fx.text(A.x + A.w / 2, this.groundY - 260, 'Together, then — as it was always meant to end!', '#ffe6a6', 15);
    for (const m of this.activeList()) m.bow = 1;
    yield 0.9;
    for (const m of this.ms) m.bow = 0;
    this.hittable = true;
    yield 0.2;
  }

  onDeath() { for (const m of this.ms) { m.bow = 1; m.co = null; } this.marker = null; this.twister = null; this.wind = null; }

  // ---------------- drawing
  drawExtra(ctx, t) {
    if (this.marker) {
      const k = this.marker.lock ? 1 : 0.5;
      ctx.fillStyle = `rgba(10,20,18,${0.25 + 0.25 * k})`;
      ctx.beginPath(); ctx.ellipse(this.marker.x, this.groundY - 2, 40 + Math.sin(t * 20) * 4 * k, 8, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = this.marker.lock ? 'rgba(233,255,122,0.9)' : 'rgba(170,240,210,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(this.marker.x, this.groundY - 2, 46, 10, 0, 0, TAU); ctx.stroke();
      if (this.marker.lock) { ctx.fillStyle = '#e9ff7a'; ctx.font = 'bold 22px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('!', this.marker.x, this.groundY - 30); }
    }
    if (this.twister) {
      const m = this.twister.m, h = this.twister.h, gy = this.groundY;
      ctx.save();
      for (let i = 0; i < 9; i++) {
        const k = i / 8, y = gy - k * h, w = 18 + k * 34;
        const off = Math.sin(t * 12 + i * 0.8) * 6 * k;
        ctx.strokeStyle = `rgba(220,235,255,${0.75 - k * 0.3})`; ctx.lineWidth = 4 - k * 2;
        ctx.beginPath(); ctx.ellipse(m.x + off, y, w, 6 + k * 4, 0, t * 10 + i, t * 10 + i + 4.4); ctx.stroke();
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(m.x - 18, gy); ctx.quadraticCurveTo(m.x - 30, gy - h * 0.6, m.x - 52, gy - h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(m.x + 18, gy); ctx.quadraticCurveTo(m.x + 30, gy - h * 0.6, m.x + 52, gy - h); ctx.stroke();
      ctx.restore();
    }
    // aim lines for telegraphed launches
    for (const m of this.ms) {
      if (m.aim !== null && m.aim !== undefined) {
        ctx.save(); ctx.strokeStyle = `rgba(${PAL[m.kind].rgb},0.7)`; ctx.setLineDash([12, 10]); ctx.lineWidth = 3;
        ctx.lineDashOffset = -t * 60;
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + Math.cos(m.aim) * 300, m.y + Math.sin(m.aim) * 300); ctx.stroke();
        ctx.restore();
      }
      if (m.drillAim) {
        ctx.save(); ctx.strokeStyle = 'rgba(255,214,106,0.6)'; ctx.setLineDash([6, 8]); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(m.x, m.y + m.r); ctx.lineTo(m.x, this.groundY); ctx.stroke(); ctx.restore();
      }
    }
  }

  drawBody(ctx, t, white) {
    const list = [...this.ms].sort((a, b) => (a.state === 'bench' ? 0 : 1) - (b.state === 'bench' ? 0 : 1));
    for (const m of list) {
      if (white && m.flashT <= 0) continue;
      if (!white) {
        for (const q of m.trail) { ctx.globalAlpha = (q.life / 0.22) * 0.3; ctx.fillStyle = m.kind === 'rebound' ? PAL.rebound.a : m.kind === 'spin' ? PAL.spin.a : PAL.cyclone.b; ctx.beginPath(); ctx.arc(q.x, q.y, m.r, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      ctx.save();
      if (m.state === 'bench' && !white) ctx.globalAlpha = 0.6;
      this.drawMaster(ctx, m, t, white);
      ctx.restore();
    }
  }

  drawMaster(ctx, m, t, white) {
    const P = PAL[m.kind], r = m.r, f = m.facing;
    const benched = m.state === 'bench';
    const idleHop = m.kind === 'rebound' && m.state === 'active' && !m.busy && m.grounded && !m.bow ? Math.abs(Math.sin(t * 6)) * 8 : 0;
    const sq = m.sq + (benched ? 0.15 : 0);
    const sx = 1 + sq * 0.35, sy = 1 - sq * 0.3;
    const bx = m.x, by = m.y + r - idleHop; // bottom anchor
    // shadow
    if (!white) {
      const hgt = Math.max(0, this.groundY - (m.y + r));
      ctx.fillStyle = `rgba(0,0,0,${0.3 * Math.max(0.15, 1 - hgt / 260)})`;
      ctx.beginPath(); ctx.ellipse(m.x, this.groundY - 1, r * 0.9 * Math.max(0.4, 1 - hgt / 400), 6, 0, 0, TAU); ctx.fill();
    }
    // telegraph glow
    if (!white && m.tele > 0) glow(ctx, m.x, m.y, r * 2.6, P.rgb, Math.min(0.5, m.tele + 0.15));
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(f * m.bow * 0.45);
    ctx.scale(sx, sy);
    ctx.translate(0, -r);
    if (m.kind === 'spin') this.drawSpin(ctx, m, t, white, r, f);
    else if (m.kind === 'rebound') this.drawRebound(ctx, m, t, white, r, f);
    else this.drawCyclone(ctx, m, t, white, r, f);
    ctx.restore();
  }

  face(ctx, m, t, white, r, f, style) {
    const P = PAL[m.kind];
    const closed = m.bow > 0.3 || m.state === 'bench' || (this.mode === 'dormant');
    const ex = f * r * 0.28, ey = -r * 0.08;
    for (const s of [-1, 1]) {
      const x = ex + s * r * 0.27, y = ey;
      if (white) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.12, r * 0.17, 0, 0, TAU); ctx.fill(); continue; }
      if (closed || (style === 'calm' && !m.busy && m.tele <= 0)) {
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y + 1, r * 0.11, 0.15, Math.PI - 0.15); ctx.stroke();
        continue;
      }
      ctx.fillStyle = INK;
      ctx.beginPath();
      if (style === 'stern') ctx.ellipse(x, y, r * 0.14, r * 0.12, s * f * -0.25, 0, TAU);
      else ctx.ellipse(x, y, r * 0.13, r * 0.18, 0, 0, TAU);
      ctx.fill();
      eye(ctx, x + f * r * 0.03, y + r * 0.02, r * 0.055, P.eye, true);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(x - r * 0.04, y - r * 0.07, r * 0.035, 0, TAU); ctx.fill();
    }
    if (white) return;
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    if (style === 'stern') {
      for (const s of [-1, 1]) { const x = ex + s * r * 0.27; ctx.beginPath(); ctx.moveTo(x - r * 0.14, ey - r * 0.2 - (s * f < 0 ? 0 : 3)); ctx.lineTo(x + r * 0.14, ey - r * 0.2 - (s * f < 0 ? 3 : 0)); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(ex - r * 0.1, ey + r * 0.3); ctx.lineTo(ex + r * 0.1, ey + r * 0.3); ctx.stroke();
    } else if (style === 'grin') {
      ctx.beginPath(); ctx.arc(ex, ey + r * 0.2, r * 0.18, 0.2, Math.PI - 0.2); ctx.fillStyle = '#3a1420'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(ex - r * 0.1, ey + r * 0.22, r * 0.2, r * 0.06);
    } else {
      ctx.beginPath(); ctx.arc(ex, ey + r * 0.24, r * 0.06, 0, Math.PI); ctx.stroke();
    }
  }

  drawSpin(ctx, m, t, white, r, f) {
    const P = PAL.spin;
    const R = r * 0.86, cy = -r * 0.12;
    // spindle point
    ctx.beginPath(); ctx.moveTo(-R * 0.45, cy + R * 0.7); ctx.lineTo(0, r); ctx.lineTo(R * 0.45, cy + R * 0.7); ctx.closePath();
    fillInk(ctx, '#d9c9a6', white, 2.5);
    // body
    ctx.beginPath(); ctx.ellipse(0, cy, R * 1.08, R, 0, 0, TAU);
    if (white) ctx.fillStyle = '#fff'; else { const g = ctx.createRadialGradient(-R * 0.3, cy - R * 0.4, R * 0.1, 0, cy, R * 1.1); g.addColorStop(0, '#e8565c'); g.addColorStop(1, P.dark); ctx.fillStyle = g; }
    ctx.fill();
    if (!white) {
      ctx.save(); ctx.clip();
      ctx.fillStyle = P.b;
      for (let i = 0; i < 6; i++) {
        const u = ((i / 6 + m.ang / TAU) % 1 + 1) % 1 * 2 - 1;
        const w = R * 0.2 * Math.sqrt(Math.max(0, 1 - u * u)) + 0.5;
        ctx.beginPath(); ctx.ellipse(u * R * 1.08, cy, w, R * 1.1, 0, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(-R * 0.35, cy - R * 0.45, R * 0.45, R * 0.25, -0.4, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.beginPath(); ctx.ellipse(0, cy, R * 1.08, R, 0, 0, TAU); inkS(ctx, white, 3.5);
    // knob
    ctx.beginPath(); ctx.rect(-5, cy - R - 12, 10, 14); fillInk(ctx, '#d9c9a6', white, 2.5);
    ctx.beginPath(); ctx.arc(0, cy - R - 13, 6, 0, TAU); fillInk(ctx, P.a, white, 2.5);
    // headband with fluttering tails
    const hy = cy - R * 0.45;
    ctx.beginPath(); ctx.ellipse(0, hy, R * 0.98, R * 0.16, 0, 0, TAU);
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, cy, R * 1.08, R, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = col(white, P.band); ctx.fillRect(-R * 1.2, hy - R * 0.12, R * 2.4, R * 0.24);
    ctx.strokeStyle = col(white, INK); ctx.lineWidth = 2; ctx.strokeRect(-R * 1.2, hy - R * 0.12, R * 2.4, R * 0.24);
    if (!white) { ctx.fillStyle = P.a; ctx.beginPath(); ctx.arc(f * R * 0.3, hy, R * 0.08, 0, TAU); ctx.fill(); }
    ctx.restore();
    const wv = Math.sin(t * 9 + m.seed) * 5 + (m.spinV > 15 ? Math.sin(t * 30) * 6 : 0);
    for (const k of [0, 1]) {
      ctx.beginPath(); ctx.moveTo(-f * R * 0.95, hy);
      ctx.quadraticCurveTo(-f * (R * 1.3 + k * 8), hy - 6 + wv * 0.5, -f * (R * 1.7 + k * 10), hy + 6 + k * 10 + wv);
      ctx.strokeStyle = col(white, INK); ctx.lineWidth = 7; ctx.stroke();
      ctx.strokeStyle = col(white, P.band); ctx.lineWidth = 4; ctx.stroke();
    }
    ctx.save(); ctx.translate(0, cy); this.face(ctx, m, t, white, R, f, 'stern'); ctx.restore();
  }

  drawRebound(ctx, m, t, white, r, f) {
    const P = PAL.rebound;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
    if (white) ctx.fillStyle = '#fff'; else { const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r); g.addColorStop(0, P.hi); g.addColorStop(0.45, P.a); g.addColorStop(1, P.b); ctx.fillStyle = g; }
    ctx.fill();
    if (!white) {
      ctx.save(); ctx.clip(); ctx.rotate(m.ang);
      ctx.strokeStyle = P.b; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.45, r * 1.1, 0, 0, TAU); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.5, r * 0.22, r * 0.12, -0.6, 0, TAU); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); inkS(ctx, white, 3.5);
    // black belt
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
    ctx.fillStyle = col(white, '#1b1820'); ctx.fillRect(-r, r * 0.3, r * 2, r * 0.22);
    if (!white) { ctx.fillStyle = '#c8343c'; ctx.fillRect(-f * r * 0.7 - 4, r * 0.3, 8, r * 0.22); }
    ctx.restore();
    const kx = -f * r * 0.55, ky = r * 0.42, wv = Math.sin(t * 8 + m.seed) * 4;
    ctx.beginPath(); ctx.ellipse(kx, ky, 6, 5, 0, 0, TAU); fillInk(ctx, '#1b1820', white, 2);
    for (const k of [0, 1]) {
      ctx.beginPath(); ctx.moveTo(kx, ky); ctx.quadraticCurveTo(kx - f * (10 + k * 4), ky + 10, kx - f * (8 + k * 12), ky + 20 + wv * (k ? 1 : -1));
      ctx.strokeStyle = col(white, INK); ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = col(white, '#2a2630'); ctx.lineWidth = 4; ctx.stroke();
    }
    this.face(ctx, m, t, white, r, f, 'grin');
  }

  drawCyclone(ctx, m, t, white, r, f) {
    const P = PAL.cyclone;
    // wind rings behind
    if (!white) {
      ctx.strokeStyle = 'rgba(200,225,255,0.55)'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(0, r * 0.1 + i * 10 - 5, r * (1.45 + i * 0.25), r * 0.38, 0, m.ang * 2 + i * 2, m.ang * 2 + i * 2 + 3.6); ctx.stroke(); }
    }
    // tail feathers + wings
    const wg = m.wing || 0;
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * r * 0.8, -r * 0.05); ctx.rotate(s * (0.5 + wg * 0.6 + Math.sin(t * (wg ? 26 : 5) + s) * 0.2));
      ctx.beginPath(); ctx.ellipse(s * r * 0.35, 0, r * 0.55, r * 0.2, 0, 0, TAU); fillInk(ctx, P.b, white, 2.5);
      ctx.restore();
    }
    // body with feather scales
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
    if (white) ctx.fillStyle = '#fff'; else { const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r); g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, P.a); g.addColorStop(1, P.b); ctx.fillStyle = g; }
    ctx.fill();
    if (!white) {
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(85,105,156,0.55)'; ctx.lineWidth = 1.5;
      for (let row = 0; row < 4; row++) for (let i = -3; i <= 3; i++) {
        const x = i * r * 0.32 + (row % 2) * r * 0.16, y = r * 0.05 + row * r * 0.24;
        ctx.beginPath(); ctx.arc(x, y, r * 0.17, 0.2, Math.PI - 0.2); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); inkS(ctx, white, 3.5);
    // crest of three plumes
    for (let i = -1; i <= 1; i++) {
      const a = -Math.PI / 2 + i * 0.4 - f * 0.25 + Math.sin(t * 4 + i) * 0.08;
      ctx.save(); ctx.translate(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); ctx.rotate(a + Math.PI / 2);
      ctx.beginPath(); ctx.ellipse(0, -r * 0.35, r * 0.13, r * 0.42, 0, 0, TAU); fillInk(ctx, i ? P.b : P.crest, white, 2.5);
      if (!white) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * 0.7); ctx.stroke(); }
      ctx.restore();
    }
    // scarf
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
    ctx.fillStyle = col(white, P.crest); ctx.beginPath(); ctx.ellipse(0, r * 0.55, r * 1.05, r * 0.16, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = col(white, INK); ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    const wv = Math.sin(t * 10 + m.seed) * 6;
    ctx.beginPath(); ctx.moveTo(-f * r * 0.7, r * 0.6); ctx.quadraticCurveTo(-f * r * 1.3, r * 0.5 + wv, -f * r * 1.7, r * 0.75 - wv);
    ctx.strokeStyle = col(white, INK); ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = col(white, P.crest); ctx.lineWidth = 5; ctx.stroke();
    this.face(ctx, m, t, white, r, f, 'calm');
  }
}

export default { rollmasters: RollmasterTrio };
