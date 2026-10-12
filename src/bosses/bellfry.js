// Bosses of Bellfry Heights: Carillon (the Great Bell) and Galeharrow (the storm-bird).
import { Boss, registerMinion } from './boss.js';
import { TAU, clamp, lerp } from '../core/math.js';
import { TILE } from '../core/constants.js';
import { INK, eye } from '../art/creatures.js';
import { registerProjectileArt } from '../entities/projectile.js';
import { moveX } from '../world/movement.js';

// ---------------------------------------------------------------- shared helpers
function scanGround(room, x, y0) {
  for (let y = Math.floor(y0 / TILE) * TILE; y < room.pxH; y += 4) if (room.rectBlocked(x - 2, y, 4, 2)) return y;
  return room.pxH - TILE;
}
function hurtPlayer(boss, srcX) {
  const p = boss.player;
  if (p.dead || p.invuln > 0) return;
  p.hurt(1, srcX);
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
function segDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
  const k = clamp(((px - x0) * dx + (py - y0) * dy) / L2, 0, 1);
  return Math.hypot(px - (x0 + dx * k), py - (y0 + dy * k));
}
// push Bead sideways with collision (wind)
function pushPlayer(boss, dx) {
  const p = boss.player, b = p.b;
  if (p.dead || boss.game.cutscene) return;
  if (b.mode === 'hang' || b.mode === 'hook' || b.mode === 'magnet' || b.mode === 'pound') return;
  moveX(b, boss.game.room, dx, b.grounded ? 10 : 0);
}
const W = (white, c) => (white ? '#fff' : c);

// ---------------------------------------------------------------- minions & projectile art
registerMinion({
  id: 'bellkin', name: 'Bellkin', hp: 34, dmg: 1, size: [30, 32],
  behavior: 'hopper', params: { interval: 1.05, vx: 160, vy: 560 },
  art: { body: 'bell', c1: '#8a6235', c2: '#f2d897', eye: '#ffe2a0' },
  journal: 'Chips of the Great Bell that learned to hop. They ring for their mother when struck.',
});

registerProjectileArt('minibell', (ctx, p, t) => {
  const r = p.r;
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(Math.sin(t * 9 + p.age * 6) * 0.35);
  ctx.beginPath();
  ctx.moveTo(-r * 0.45, -r * 0.9);
  ctx.quadraticCurveTo(0, -r * 1.25, r * 0.45, -r * 0.9);
  ctx.quadraticCurveTo(r * 0.6, r * 0.2, r, r * 0.75);
  ctx.lineTo(-r, r * 0.75);
  ctx.quadraticCurveTo(-r * 0.6, r * 0.2, -r * 0.45, -r * 0.9);
  ctx.fillStyle = '#9a7040'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#f2d897'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.5); ctx.lineTo(r * 0.8, r * 0.5); ctx.stroke();
  ctx.fillStyle = '#f2d897'; ctx.beginPath(); ctx.arc(0, r * 0.95, r * 0.22, 0, TAU); ctx.fill();
  eye(ctx, -r * 0.25, -r * 0.2, 1.8, '#ffe2a0', true); eye(ctx, r * 0.25, -r * 0.2, 1.8, '#ffe2a0', true);
  ctx.restore();
});

registerProjectileArt('gale', (ctx, p, t) => {
  // a crescent of compressed wind
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.rot);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `rgba(200,235,255,${0.55 - i * 0.15})`; ctx.lineWidth = 4 - i;
    ctx.beginPath(); ctx.arc(-i * 7, 0, p.r * 1.3, -1.1, 1.1); ctx.stroke();
  }
  ctx.restore();
});

// ================================================================= CARILLON
// The Great Bell of the Bellfry wakes: a colossal bronze bell with a pale face in its mouth,
// hanging from a ceiling trolley by a chain. Swings, slams, tolls rings of sound, drops its
// children, lashes its clapper. In phase 3 the chain snaps and it rolls and bounces.
const BW = 170, BH = 180;
const BRONZE = { base: '#7a5530', dark: '#3f2a17', mid: '#8a6034', hi: '#c99a52', verd: '#5f9c88', rim: '#ecc77a', hollow: '#120c10' };

export class Carillon extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'carillon', size: [BW, BH], music: 'boss_keeper', air: true, glints: 320, introTime: 2.6 });
    if (this.dead) return;
    this.noPhysics = true;
    const A = this.arena, room = game.room;
    this.groundY = scanGround(room, A.x + A.w / 2, A.y + A.h * 0.45);
    this.px = clamp(this.cx, A.x + BW, A.x + A.w - BW);
    this.py = A.y + 4;
    this.restLen = Math.max(110, this.groundY - 128 - 0.6 * BH - this.py);
    this.len = this.restLen;
    this.ang = 0; this.angV = 0;
    this.rot = 0;
    this.loose = false;        // phase 3: chain snapped
    this.lying = 0;            // 0 upright .. 1 lying on its side
    this.swinging = false;
    this.awake = 0;
    this.mouthGlow = 0;
    this.clap = { ang: 0, v: 0 };
    this.lashS = null;         // { x0,y0, tx,ty, k(extension 0..1), aim(0..1), locked }
    this.rings = [];
    this.marks = [];           // falling-bell warnings { x, t, dur }
    this.shadow = 0;           // slam shadow strength
    this.arcTele = null;
    this.jit = 0;
    this.crack = 0;
    this.chainBits = [];
    this.place();
  }

  // ---------- placement ----------
  place() {
    if (!this.loose) {
      this.bx = this.px + Math.sin(this.ang) * this.len;
      this.by = this.py + Math.cos(this.ang) * this.len;
      this.rot = -this.ang;
    }
    this.x = this.bx - this.w / 2 + (this.jit ? (Math.random() - 0.5) * this.jit : 0);
    this.y = this.by - this.h / 2;
  }
  ext(rot) { return Math.abs(Math.cos(rot)) * 0.58 * BH + Math.abs(Math.sin(rot)) * 0.5 * BW; }
  mouth() { // world point at the centre of the bell's mouth
    const c = Math.cos(this.rot), s = Math.sin(this.rot), ly = 0.5 * BH;
    return { x: this.bx - s * ly, y: this.by + c * ly };
  }
  crownTop() {
    const c = Math.cos(this.rot), s = Math.sin(this.rot), ly = -0.72 * BH;
    return { x: this.bx - s * ly, y: this.by + c * ly };
  }

  idle(dt) {
    this.ang = Math.sin(this.anim * 0.7) * 0.025;
    this.clapUpdate(dt);
    this.place();
  }
  introUpdate(dt, t) {
    this.awake = clamp((t - 0.4) / 1.0, 0, 1);
    this.ang = Math.sin(t * 9) * 0.06 * clamp(1.4 - t * 0.5, 0, 1);
    if (t > 0.5 && !this.introRang) { this.introRang = 1; this.sfx('bell'); this.mouthGlow = 1; this.rings.push(this.mkRing(0, 340, [], { harm: false, th: 8, life: 1.5 })); }
    if (Math.random() < 0.3) this.dustFromCeiling(this.rand(this.arena.x, this.arena.x + this.arena.w));
    this.clapUpdate(dt);
    this.updateRings(dt, false);
    this.place();
  }
  onStart() { this.awake = 0; }

  dustFromCeiling(x) {
    this.fx.add({ x, y: this.arena.y + 4, vx: this.rand(-10, 10), vy: this.rand(40, 120), life: 1.2, size: 2, color: 'rgba(200,190,170,0.6)', g: 300, front: false });
  }

  clapUpdate(dt) {
    // clapper lags behind the swing
    const target = -this.angV * 0.35 + Math.sin(this.anim * 1.7) * 0.05;
    this.clap.v += (target - this.clap.ang) * 40 * dt; this.clap.v *= 0.92;
    this.clap.ang = clamp(this.clap.ang + this.clap.v * dt, -0.7, 0.7);
    if (this.mouthGlow > 0) this.mouthGlow = Math.max(0, this.mouthGlow - dt * 1.6);
  }

  think(dt) {
    this.clapUpdate(dt);
    if (!this.swinging && !this.loose && !this.manual) {
      // settle the pendulum
      this.angV += (-this.ang * 9 - this.angV * 3) * dt;
      this.ang += this.angV * dt + Math.sin(this.anim * 0.9) * 0.0006;
    }
    this.place();
    this.updateRings(dt, true);
    // falling-bell warnings
    for (const m of this.marks) m.t += dt;
    this.marks = this.marks.filter((m) => m.t < m.dur);
    // clapper lash hitboxes
    const L = this.lashS;
    if (L && L.k > 0.05) {
      const m = this.mouth();
      const ex = m.x + (L.tx - m.x) * L.k, ey = m.y + (L.ty - m.y) * L.k;
      const n = Math.ceil(Math.hypot(ex - m.x, ey - m.y) / 24);
      for (let i = 1; i <= n; i++) {
        const k = i / n, r = i === n ? 22 : 11;
        this.hits.push({ x: m.x + (ex - m.x) * k - r, y: m.y + (ey - m.y) * k - r, w: r * 2, h: r * 2 });
      }
    }
    if (this.chainBits.length) this.chainBits = this.chainBits.filter((c) => (c.t += dt) < 1.6);
  }

  // ---------- rings of sound ----------
  mkRing(r0, speed, gaps, opts = {}) {
    const m = this.mouth();
    return { x: opts.x ?? m.x, y: opts.y ?? m.y, r: r0, v: speed, th: opts.th ?? 16, gaps, gw: opts.gw ?? 0.34, harm: opts.harm ?? true, life: opts.life ?? 4 };
  }
  updateRings(dt, harmful) {
    const p = this.player;
    for (const R of this.rings) {
      R.r += R.v * dt * this.speedMul; R.life -= dt;
      if (!harmful || !R.harm) continue;
      const d = Math.hypot(p.cx - R.x, p.cy - R.y);
      if (Math.abs(d - R.r) < R.th / 2 + 8) {
        const a = Math.atan2(p.cy - R.y, p.cx - R.x);
        if (!R.gaps.some((g) => Math.abs(angDiff(a, g)) < R.gw + 0.02)) hurtPlayer(this, R.x);
      }
    }
    this.rings = this.rings.filter((R) => R.life > 0 && R.r < 1400);
  }

  // ---------- coroutine helpers ----------
  *during(sec, fn) {
    const T = sec / this.speedMul;
    for (let t = 0; t < T; t += 1 / 60) { fn(t / T, t); yield; }
    fn(1, T);
  }
  *slidePivot(x, speed = 380) {
    const A = this.arena;
    x = clamp(x, A.x + BW * 0.7, A.x + A.w - BW * 0.7);
    while (Math.abs(this.px - x) > 2) {
      const step = Math.sign(x - this.px) * Math.min(Math.abs(x - this.px), speed * this.speedMul / 60);
      this.px += step;
      this.angV -= step * 0.012; // the bell lags behind the trolley
      yield;
    }
  }

  attackList() {
    if (this.loose) {
      return [
        { name: 'roll', w: 3, fn: this.roll },
        { name: 'bounce', w: 2.5, fn: this.bounce },
        { name: 'toll', w: 2, fn: this.toll },
        { name: 'lash', w: this.distX() < 380 ? 2 : 0.7, fn: this.lash },
        { name: 'rain', w: 1.2, fn: this.bellRain },
      ];
    }
    return [
      { name: 'swing', w: 2.5, fn: this.swing },
      { name: 'toll', w: 2, fn: this.toll },
      { name: 'slam', w: 2.5, fn: this.slam },
      { name: 'lash', w: this.distX() < 420 ? 2.5 : 0.8, fn: this.lash },
      { name: 'rain', w: this.phase >= 2 ? 1.6 : 1, fn: this.bellRain },
    ];
  }

  // ----- Toll Swing: the chain lengthens and the bell sweeps the hall like a pendulum
  *swing() {
    const A = this.arena;
    yield* this.slidePivot(A.x + A.w / 2, 420);
    const low = this.phase >= 2 || Math.random() < 0.55;
    const len1 = low ? Math.max(this.restLen, this.groundY - 22 - 0.6 * BH - this.py) : this.restLen + 30;
    const room = Math.min(this.px - A.x, A.x + A.w - this.px) - 96 - BW * 0.55;
    const amp = clamp(Math.asin(clamp(room / len1, 0.2, 0.95)), 0.35, 1.05);
    const dir = this.dirTo();
    const startAng = -dir * amp;
    this.swinging = true;
    this.arcTele = { len: len1, amp, k: 0 };
    this.sfx('charge');
    this.tele = 0.8;
    const a0 = this.ang, l0 = this.len;
    yield* this.during(0.85, (k) => {
      const e = k * k * (3 - 2 * k);
      this.ang = lerp(a0, startAng, e); this.len = lerp(l0, len1, e);
      this.arcTele.k = k;
      this.jit = k > 0.7 ? 3 : 0;
    });
    this.jit = 0;
    this.arcTele = null;
    yield 0.12;
    const halves = this.phase >= 2 ? 3 : 2;
    const Th = 0.95;
    let lastHalf = 0;
    this.sfx('whip');
    yield* this.during(Th * halves, (k, t) => {
      const ph = (k * halves) * Math.PI;
      const prev = this.ang;
      this.ang = startAng * Math.cos(ph);
      this.angV = (this.ang - prev) * 60;
      const half = Math.floor(k * halves + 0.001);
      if (half !== lastHalf && half < halves) { lastHalf = half; this.knell(); }
      if (Math.abs(this.angV) > 1.2 && Math.random() < 0.6) {
        this.fx.add({ x: this.bx + this.rand(-60, 60), y: this.by + this.rand(-60, 60), vx: -this.angV * 60, vy: 0, life: 0.3, size: 2, color: 'rgba(235,240,255,0.6)', shape: 'streak', g: 0, front: false });
      }
    });
    this.knell();
    const a1 = this.ang;
    yield* this.during(0.9, (k) => { const e = k * k * (3 - 2 * k); this.ang = lerp(a1, 0, e); this.len = lerp(len1, this.restLen, e); });
    this.angV = 0;
    this.swinging = false;
    yield 0.5;
  }
  knell() {
    this.sfx('bell'); this.mouthGlow = 1; this.shake(3, 0.2);
    this.rings.push(this.mkRing(10, 330, [], { harm: false, th: 6, life: 1.2 }));
    if (this.phase >= 2 && this.minions.length < 3 && Math.random() < 0.5) this.dropBell(this.rand(this.arena.x + 60, this.arena.x + this.arena.w - 60), 0.7);
  }

  // ----- Great Toll: rings of sound with gaps to slip through
  *toll() {
    this.facePlayer();
    this.tele = 0.65;
    this.sfx('warn');
    const n = this.phase + 1;
    const a0 = this.ang;
    yield* this.during(0.65, (k) => {
      this.mouthGlow = k; this.jit = k * 3;
      if (!this.loose) this.ang = a0 + Math.sin(k * Math.PI) * 0.12 * -this.dirTo();
    });
    this.jit = 0;
    for (let i = 0; i < n; i++) {
      const m = this.mouth();
      const pa = Math.atan2(this.player.cy - m.y, this.player.cx - m.x);
      const g1 = pa + this.pick([-1, 1]) * this.rand(0.25, 0.55);
      const gaps = [g1, g1 + Math.PI * this.rand(0.7, 1.3)];
      this.rings.push(this.mkRing(BW * 0.4, 210 + this.phase * 25, gaps, { th: 18, gw: this.phase >= 3 ? 0.3 : 0.34 }));
      this.sfx('bell'); this.mouthGlow = 1; this.shake(5, 0.25);
      if (!this.loose) this.angV += (i % 2 ? 1 : -1) * 0.6;
      this.fx.ring(m.x, m.y, 20, 140, 0.4, 'rgba(255,230,170,0.8)', 5);
      yield 0.8;
    }
    yield 0.7;
  }

  // ----- Bell-Drop Slam: the trolley hunts Bead, then the chain lets go
  *slam() {
    this.manual = true;
    this.sfx('rustle');
    const l0 = this.len;
    // hoist and track
    const track = 1.0;
    yield* this.during(track, (k) => {
      const target = clamp(this.player.cx, this.arena.x + BW * 0.6, this.arena.x + this.arena.w - BW * 0.6);
      const step = clamp(target - this.px, -440 * this.speedMul / 60, 440 * this.speedMul / 60);
      this.px += step;
      this.ang = clamp(this.ang * 0.9 - step * 0.004, -0.3, 0.3);
      this.len = lerp(l0, this.restLen - 50, Math.min(1, k * 2));
      this.shadow = k;
    });
    // final warning
    this.tele = 0.45; this.sfx('warn');
    yield* this.during(0.45, (k) => { this.jit = 4; this.ang *= 0.85; this.shadow = 1; });
    this.jit = 0; this.ang = 0;
    // fall
    let v = 300;
    const target = this.groundY - 0.58 * BH - this.py;
    while (this.len < target) { v += 3200 / 60; this.len = Math.min(target, this.len + v / 60 * this.speedMul); yield; }
    this.shadow = 0;
    this.impact(this.phase >= 2 ? 3 : 0);
    yield 1.0;
    // reel back up
    this.sfx('rustle');
    yield* this.during(1.0, (k) => { const e = k * k * (3 - 2 * k); this.len = lerp(target, this.restLen, e); });
    this.manual = false;
    yield 0.45;
  }
  impact(bells = 0) {
    this.sfx('slam'); this.sfx('bell'); this.shake(11, 0.5);
    this.mouthGlow = 1;
    const sp = 380 + this.phase * 40;
    this.shockwave(this.cx - 40, -1, sp, 36, { color: 'rgba(236,199,122,0.9)' });
    this.shockwave(this.cx + 40, 1, sp, 36, { color: 'rgba(236,199,122,0.9)' });
    this.fx.burst(this.cx, this.groundY, 22, { color: '#cfc4ad', speed: 360, angle: -Math.PI / 2, spread: 2.6, size: 4, life: 0.7 });
    this.fx.ring(this.cx, this.groundY - 10, 30, 220, 0.5, 'rgba(255,230,170,0.7)', 6);
    for (let i = 0; i < bells; i++) this.dropBell(this.rand(this.arena.x + 60, this.arena.x + this.arena.w - 60), 0.75 + i * 0.25);
    for (let i = 0; i < 10; i++) this.dustFromCeiling(this.rand(this.arena.x, this.arena.x + this.arena.w));
  }

  // ----- Bell Rain: its children fall from the rafters
  *bellRain() {
    this.tele = 0.5; this.sfx('bell'); this.mouthGlow = 1;
    if (!this.loose) this.angV += 1.2 * this.dirTo();
    this.shake(5, 0.6);
    yield 0.5;
    const n = 4 + this.phase;
    const A = this.arena, xs = [clamp(this.player.cx, A.x + 30, A.x + A.w - 30)];
    let guard = 0;
    while (xs.length < n && guard++ < 200) {
      const x = this.rand(A.x + 40, A.x + A.w - 40);
      if (xs.every((q) => Math.abs(q - x) > 95)) xs.push(x);
    }
    for (const x of xs) { this.dropBell(x, 0.7); yield 0.2; }
    yield 1.1;
  }
  dropBell(x, warn = 0.7) {
    this.marks.push({ x, t: 0, dur: warn });
    const g = this.game;
    setTimeout(() => {
      if (this.mode !== 'fight' || g.room !== this.room) return;
      this.fire(x, this.arena.y + 14, 0, 60, {
        gravity: 1500, art: 'minibell', r: 15, life: 4, color: '#ecc77a',
        onDie: (p) => {
          if (this.mode !== 'fight') return;
          this.sfx('clink');
          g.fx.burst(p.cx, p.cy, 8, { color: '#ecc77a', speed: 200, size: 2.5, life: 0.4 });
          g.fx.ring(p.cx, p.cy, 4, 40, 0.3, 'rgba(255,230,170,0.8)', 2);
          if (this.phase >= 2 && this.minions.length < 2 && Math.random() < 0.45) {
            const e = this.summon('bellkin', Math.floor(p.cx / TILE), Math.floor((this.groundY - 1) / TILE));
            if (e) e.facing = this.player.cx < e.cx ? -1 : 1;
          }
        },
      });
    }, (warn * 1000) / this.speedMul);
  }

  // ----- Clapper Lash: the tongue of the bell whips out at Bead
  *lash() {
    this.facePlayer();
    const reps = this.phase >= 2 ? 2 : 1;
    for (let r = 0; r < reps; r++) {
      const L = this.lashS = { tx: this.player.cx, ty: this.player.cy, k: 0, aim: 0, locked: false };
      this.tele = 0.55; this.sfx('rustle');
      const tele = r === 0 ? 0.6 : 0.45;
      yield* this.during(tele, (k) => {
        L.aim = k;
        if (k < 0.7) { L.tx = this.player.cx; L.ty = this.player.cy; } else L.locked = true;
        this.mouthGlow = Math.max(this.mouthGlow, k * 0.8);
      });
      // extend toward the locked point, overshooting to full reach
      const m = this.mouth();
      const d = Math.hypot(L.tx - m.x, L.ty - m.y) || 1;
      const reach = Math.min(420, d + 60);
      L.tx = m.x + (L.tx - m.x) / d * reach; L.ty = m.y + (L.ty - m.y) / d * reach;
      L.ty = Math.min(L.ty, this.groundY - 12);
      this.sfx('whip');
      yield* this.during(0.1, (k) => { L.k = k; });
      this.shake(4, 0.15);
      this.fx.burst(L.tx, L.ty, 8, { color: '#ecc77a', speed: 200, size: 2.5, life: 0.35 });
      yield 0.28;
      yield* this.during(0.3, (k) => { L.k = 1 - k; });
      this.lashS = null;
      yield 0.15;
    }
    yield 0.55;
  }

  // ---------- phases ----------
  onPhase(n) {
    if (n === 2) {
      this.crack = 1; this.sfx('bossRoar'); this.shake(7, 0.7); this.tele = 0.8; this.mouthGlow = 1;
      this.rings.push(this.mkRing(10, 420, [], { harm: false, th: 8, life: 1.4 }));
    }
    if (n === 3) {
      this.co = this.snap(); this.wait = 0;
    }
  }

  *snap() {
    this.lashS = null; this.swinging = false; this.manual = true; this.arcTele = null; this.shadow = 0;
    this.hittable = false;
    this.crack = 2;
    this.sfx('bossRoar'); this.tele = 1;
    const a0 = this.ang;
    yield* this.during(1.0, (k) => { this.jit = 2 + k * 6; this.ang = a0 * (1 - k) + Math.sin(k * 40) * 0.05; if (Math.random() < 0.4) this.dustFromCeiling(this.px + this.rand(-30, 30)); });
    this.jit = 0;
    // SNAP
    this.sfx('slam'); this.sfx('bell'); this.shake(12, 0.6);
    this.game.flash('rgba(255,240,210,0.5)', 0.25);
    const top = this.crownTop();
    for (let i = 0; i < 12; i++) this.chainBits.push({ x: lerp(this.px, top.x, i / 12), y: lerp(this.py, top.y, i / 12), vx: this.rand(-160, 160), vy: this.rand(-300, 50), r: this.rand(0, TAU), t: 0 });
    this.chainStub = { x: this.px, len: Math.min(140, this.len * 0.4) };
    this.loose = true;
    let vy = 0, vr = this.rand(-1.5, 1.5);
    const rot1 = 0;
    for (;;) {
      vy += 2600 / 60; this.by += vy / 60; this.rot += vr / 60;
      if (this.by + this.ext(this.rot) >= this.groundY) break;
      yield;
    }
    this.by = this.groundY - this.ext(this.rot);
    this.impact(3);
    // rock upright
    const r0 = this.rot;
    yield* this.during(0.7, (k) => { this.rot = lerp(r0, rot1, k) + Math.sin(k * 14) * 0.12 * (1 - k); this.by = this.groundY - this.ext(this.rot); });
    this.rot = 0; this.by = this.groundY - this.ext(0);
    this.manual = false;
    this.hittable = true;
    yield 0.6;
  }

  // ----- (phase 3) Roll: tips onto its side and rolls, hopping over Bead
  *roll() {
    const dir = this.dirTo();
    this.facing = dir;
    this.tele = 0.6; this.sfx('charge');
    const goal = -dir * Math.PI / 2;
    yield* this.during(0.55, (k) => { this.rot = goal * (k * k); this.by = this.groundY - this.ext(this.rot); this.jit = k > 0.6 ? 3 : 0; });
    this.jit = 0;
    this.sfx('slam'); this.shake(5, 0.2);
    yield 0.2;
    const sp = (420 + (this.phase > 3 ? 40 : 0)) * this.speedMul;
    let vy = 0, air = false, hopCd = 0, spin = 0;
    const A = this.arena;
    for (let guard = 0; guard < 600; guard++) {
      hopCd -= 1 / 60;
      this.bx += dir * sp / 60;
      spin += dir * sp / 60 / (BW * 0.5);
      const ahead = (this.player.cx - this.bx) * dir;
      if (!air && hopCd <= 0 && ahead > 0 && ahead < 210 && this.player.cy > this.groundY - 260) {
        air = true; vy = -1060; hopCd = 0.9; this.sfx('leap');
        this.fx.burst(this.bx, this.groundY, 10, { color: '#cfc4ad', speed: 200, angle: -Math.PI / 2, spread: 2, size: 3, life: 0.5 });
      }
      if (air) {
        vy += 2300 / 60; this.by += vy / 60;
        if (this.by + this.ext(this.rot) >= this.groundY && vy > 0) {
          air = false; this.by = this.groundY - this.ext(this.rot); this.sfx('slam'); this.shake(6, 0.25); this.sfx('bell');
          this.shockwave(this.bx - dir * 30, -dir, 360, 28, { color: 'rgba(236,199,122,0.85)' });
        }
      } else {
        this.by = this.groundY - this.ext(this.rot) + Math.abs(Math.sin(spin * 2)) * -3;
        if (Math.random() < 0.5) this.fx.add({ x: this.bx - dir * 60, y: this.groundY - 2, vx: -dir * 80, vy: -40, life: 0.4, size: 3, color: 'rgba(200,190,170,0.5)', g: 100, front: false });
      }
      this.rot = goal + Math.sin(spin) * 0.1;
      const edge = dir > 0 ? A.x + A.w - this.bx : this.bx - A.x;
      if (edge < BH * 0.6 && !air) break;
      yield;
    }
    // wall crash
    this.bx = dir > 0 ? A.x + A.w - BH * 0.6 : A.x + BH * 0.6;
    this.impact(2);
    // bounce back and right itself
    let vx = -dir * 260; vy = -700;
    const r0 = this.rot;
    for (let i = 0; i < 300; i++) {
      vy += 2300 / 60; this.bx += vx / 60; this.by += vy / 60;
      this.rot = lerp(r0, 0, Math.min(1, i / 40));
      if (vy > 0 && this.by + this.ext(this.rot) >= this.groundY) break;
      yield;
    }
    this.rot = 0; this.by = this.groundY - this.ext(0);
    this.sfx('slam'); this.shake(5, 0.2);
    yield 0.75;
  }

  // ----- (phase 3) Bounce: great hops onto Bead, ringing on each landing
  *bounce() {
    const n = 3;
    const A = this.arena;
    for (let i = 0; i < n; i++) {
      this.facePlayer();
      this.tele = 0.45;
      const target = clamp(this.player.cx, A.x + BW * 0.6, A.x + A.w - BW * 0.6);
      this.landX = target;
      yield* this.during(i === 0 ? 0.5 : 0.38, (k) => { this.squash = Math.sin(k * Math.PI) * 0.12; });
      this.squash = 0;
      this.sfx('leap');
      const x0 = this.bx, y0 = this.by, T = 0.85, H = 280;
      const spin = (target > x0 ? 1 : -1) * TAU;
      yield* this.during(T, (k) => {
        this.bx = lerp(x0, target, k);
        this.by = y0 - H * 4 * k * (1 - k);
        this.rot = spin * (k * k * (3 - 2 * k));
      });
      this.rot = 0; this.by = this.groundY - this.ext(0); this.landX = null;
      this.sfx('slam'); this.sfx('bell'); this.shake(8, 0.3); this.mouthGlow = 1;
      this.shockwave(this.bx - 50, -1, 400, 32, { color: 'rgba(236,199,122,0.9)' });
      this.shockwave(this.bx + 50, 1, 400, 32, { color: 'rgba(236,199,122,0.9)' });
      this.fx.burst(this.bx, this.groundY, 14, { color: '#cfc4ad', speed: 300, angle: -Math.PI / 2, spread: 2.6, size: 3.5, life: 0.6 });
      yield 0.45;
    }
    yield 0.6;
  }

  onDeath() {
    this.rings = []; this.lashS = null; this.marks = []; this.arcTele = null; this.shadow = 0;
    this.sfx('bell');
  }

  bodyBox() {
    const r = this.rot, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
    const hw = 0.4 * BW, hh = 0.48 * BH;
    const ex = (c * hw + s * hh) * (1 - 0.15 * s * c * 2), ey = (s * hw + c * hh) * (1 - 0.15 * s * c * 2);
    const oy = this.loose ? 0 : -0.02 * BH;
    return { x: this.bx - ex, y: this.by - ey + oy, w: ex * 2, h: ey * 2 };
  }

  // ---------- drawing ----------
  drawBody(ctx, t, white) {
    // chain (or its snapped stub)
    if (!this.loose) this.drawChain(ctx, this.px, this.py, this.crownTop().x, this.crownTop().y, white, t);
    else if (this.chainStub) this.drawChain(ctx, this.chainStub.x, this.py, this.chainStub.x + Math.sin(t * 1.3) * 10, this.py + this.chainStub.len, white, t);
    // trolley yoke
    this.drawYoke(ctx, this.loose ? this.chainStub?.x ?? this.px : this.px, this.py, white);
    // bell
    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
    ctx.rotate(this.rot);
    if (this.squash) ctx.scale(1 + this.squash, 1 - this.squash);
    this.drawBell(ctx, t, white);
    ctx.restore();
  }

  drawYoke(ctx, x, y, white) {
    ctx.fillStyle = W(white, '#2c2a33'); ctx.strokeStyle = W(white, INK); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x - 34, y - 6, 68, 18, 4); ctx.fill(); ctx.stroke();
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * 22, y - 4, 8, 0, TAU); ctx.fill(); ctx.stroke(); }
    if (!white) { ctx.fillStyle = '#8c7a5a'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * 22, y - 4, 2.5, 0, TAU); ctx.fill(); } }
  }

  drawChain(ctx, x0, y0, x1, y1, white, t) {
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.floor(L / 13));
    const a = Math.atan2(y1 - y0, x1 - x0);
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const x = lerp(x0, x1, k), y = lerp(y0, y1, k);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.strokeStyle = W(white, INK); ctx.lineWidth = 5;
      ctx.beginPath();
      if (i % 2) ctx.ellipse(0, 0, 9, 5, 0, 0, TAU); else ctx.ellipse(0, 0, 9, 1.5, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = W(white, i % 2 ? '#5d5866' : '#4a4652'); ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore();
    }
  }

  bellPath(ctx) {
    const w = BW, h = BH;
    ctx.beginPath();
    ctx.moveTo(-0.27 * w, -0.5 * h);
    ctx.quadraticCurveTo(0, -0.64 * h, 0.27 * w, -0.5 * h);
    ctx.bezierCurveTo(0.37 * w, -0.4 * h, 0.3 * w, 0.02 * h, 0.37 * w, 0.28 * h);
    ctx.quadraticCurveTo(0.43 * w, 0.44 * h, 0.52 * w, 0.5 * h);
    ctx.quadraticCurveTo(0.53 * w, 0.57 * h, 0.42 * w, 0.57 * h);
    ctx.quadraticCurveTo(0, 0.63 * h, -0.42 * w, 0.57 * h);
    ctx.quadraticCurveTo(-0.53 * w, 0.57 * h, -0.52 * w, 0.5 * h);
    ctx.quadraticCurveTo(-0.43 * w, 0.44 * h, -0.37 * w, 0.28 * h);
    ctx.bezierCurveTo(-0.3 * w, 0.02 * h, -0.37 * w, -0.4 * h, -0.27 * w, -0.5 * h);
    ctx.closePath();
  }

  drawBell(ctx, t, white) {
    const w = BW, h = BH;
    const inkC = W(white, INK);
    // crown loop (canon)
    ctx.lineWidth = 9; ctx.strokeStyle = inkC;
    ctx.beginPath(); ctx.ellipse(0, -0.64 * h, 0.1 * w, 0.085 * h, 0, Math.PI, TAU); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = W(white, BRONZE.mid);
    ctx.beginPath(); ctx.ellipse(0, -0.64 * h, 0.1 * w, 0.085 * h, 0, Math.PI, TAU); ctx.stroke();
    // clapper (behind the face)
    const ca = this.clap.ang;
    const clx = Math.sin(ca) * 0.62 * h, cly = -0.05 * h + Math.cos(ca) * 0.68 * h;
    if (!this.lashS) {
      ctx.strokeStyle = inkC; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(0, -0.05 * h); ctx.lineTo(clx, cly); ctx.stroke();
      ctx.strokeStyle = W(white, '#4f3a22'); ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(clx, cly + 6, 0.075 * w, 0, TAU);
      ctx.fillStyle = W(white, BRONZE.mid); ctx.fill(); ctx.strokeStyle = inkC; ctx.lineWidth = 3; ctx.stroke();
      if (!white) { ctx.fillStyle = BRONZE.rim; ctx.beginPath(); ctx.arc(clx - 4, cly + 2, 3, 0, TAU); ctx.fill(); }
    }
    // body
    this.bellPath(ctx);
    if (white) ctx.fillStyle = '#fff';
    else {
      const g = ctx.createLinearGradient(-0.55 * w, 0, 0.55 * w, 0);
      g.addColorStop(0, BRONZE.dark); g.addColorStop(0.28, BRONZE.hi); g.addColorStop(0.42, BRONZE.mid);
      g.addColorStop(0.8, BRONZE.base); g.addColorStop(1, BRONZE.dark);
      ctx.fillStyle = g;
    }
    ctx.fill();
    if (!white) {
      ctx.save(); this.bellPath(ctx); ctx.clip();
      // verdigris weeping from the bands
      ctx.globalAlpha = 0.55;
      for (const [vx, vy, vr] of [[-0.25, -0.2, 0.16], [0.18, 0.1, 0.12], [0.05, -0.38, 0.1], [-0.3, 0.3, 0.12], [0.3, -0.15, 0.09]]) {
        const gx = ctx.createRadialGradient(vx * w, vy * h, 0, vx * w, vy * h, vr * w);
        gx.addColorStop(0, BRONZE.verd); gx.addColorStop(1, 'rgba(95,156,136,0)');
        ctx.fillStyle = gx; ctx.fillRect(vx * w - vr * w, vy * h - vr * w, vr * w * 2, vr * w * 2);
      }
      ctx.globalAlpha = 0.5; ctx.strokeStyle = BRONZE.verd; ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const x = -0.3 * w + i * 0.1 * w;
        ctx.beginPath(); ctx.moveTo(x, -0.3 * h); ctx.lineTo(x + Math.sin(i * 3) * 3, -0.3 * h + (20 + (i * 17) % 30)); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // engraved bands with runes
      ctx.strokeStyle = 'rgba(40,26,14,0.85)'; ctx.lineWidth = 1.6;
      for (const by of [-0.36, -0.3, 0.2, 0.26]) {
        ctx.beginPath(); ctx.moveTo(-0.5 * w, by * h); ctx.quadraticCurveTo(0, by * h + 0.05 * h, 0.5 * w, by * h); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(40,26,14,0.8)';
      for (let i = 0; i < 9; i++) {
        const x = -0.28 * w + i * 0.07 * w, y = -0.33 * h + 0.012 * h * Math.sin(i);
        ctx.fillRect(x, y - 3, 2, 6); if (i % 2) ctx.fillRect(x - 2, y - 1, 6, 2);
      }
      // shine
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,230,170,0.35)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-0.2 * w, -0.48 * h); ctx.bezierCurveTo(-0.28 * w, -0.2 * h, -0.24 * w, 0.1 * h, -0.34 * w, 0.4 * h); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
    this.bellPath(ctx);
    ctx.strokeStyle = inkC; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();

    // the hollow mouth with the pale face inside
    ctx.beginPath();
    ctx.moveTo(-0.4 * w, 0.565 * h);
    ctx.bezierCurveTo(-0.34 * w, 0.2 * h, -0.26 * w, -0.08 * h, 0, -0.1 * h);
    ctx.bezierCurveTo(0.26 * w, -0.08 * h, 0.34 * w, 0.2 * h, 0.4 * w, 0.565 * h);
    ctx.quadraticCurveTo(0, 0.62 * h, -0.4 * w, 0.565 * h);
    ctx.fillStyle = W(white, BRONZE.hollow); ctx.fill();
    if (!white) {
      // warm glow from within when it rings
      const gl = 0.25 + this.mouthGlow * 0.6 + (this.tele > 0 ? 0.3 : 0);
      const g = ctx.createRadialGradient(0, 0.3 * h, 4, 0, 0.3 * h, 0.4 * w);
      g.addColorStop(0, `rgba(255,200,120,${gl * 0.5})`); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.fill();
    }
    ctx.strokeStyle = inkC; ctx.lineWidth = 2.5; ctx.stroke();
    this.drawFace(ctx, 0, 0.27 * h, 0.2 * w, t, white);
    // lip highlight
    ctx.strokeStyle = W(white, BRONZE.rim); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-0.48 * w, 0.54 * h); ctx.quadraticCurveTo(0, 0.6 * h, 0.48 * w, 0.54 * h); ctx.stroke();
    // cracks
    if (this.crack && !white) {
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0.22 * w, -0.5 * h); ctx.lineTo(0.27 * w, -0.32 * h); ctx.lineTo(0.2 * w, -0.2 * h); ctx.lineTo(0.3 * w, -0.05 * h); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,190,110,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      if (this.crack >= 2) {
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-0.3 * w, -0.42 * h); ctx.lineTo(-0.22 * w, -0.25 * h); ctx.lineTo(-0.32 * w, -0.1 * h); ctx.lineTo(-0.26 * w, 0.05 * h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0.1 * w, -0.56 * h); ctx.lineTo(0.06 * w, -0.45 * h); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,170,90,0.7)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  drawFace(ctx, x, y, r, t, white) {
    // long pale mask with a bell-shaped brow
    ctx.beginPath();
    ctx.moveTo(x - r, y - r * 0.2);
    ctx.quadraticCurveTo(x - r * 1.05, y - r * 1.3, x, y - r * 1.35);
    ctx.quadraticCurveTo(x + r * 1.05, y - r * 1.3, x + r, y - r * 0.2);
    ctx.quadraticCurveTo(x + r * 0.85, y + r * 1.0, x, y + r * 1.25);
    ctx.quadraticCurveTo(x - r * 0.85, y + r * 1.0, x - r, y - r * 0.2);
    ctx.fillStyle = W(white, '#ece5d3'); ctx.fill();
    ctx.strokeStyle = W(white, INK); ctx.lineWidth = 2.5; ctx.stroke();
    if (white) return;
    // grooves
    ctx.strokeStyle = 'rgba(60,50,40,0.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x - r * 0.6, y + r * 0.55); ctx.quadraticCurveTo(x, y + r * 0.8, x + r * 0.6, y + r * 0.55); ctx.stroke();
    const open = this.mode === 'dormant' ? 0 : this.mode === 'intro' ? this.awake : 1;
    const col = this.phase >= 3 ? '#ff8f5a' : this.phase >= 2 ? '#ffc070' : '#ffe2a0';
    for (const s of [-1, 1]) {
      const ex = x + s * r * 0.42, ey = y - r * 0.25;
      if (open < 0.1) {
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(ex, ey - 2, r * 0.22, 0.2, Math.PI - 0.2); ctx.stroke();
      } else {
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.24, r * 0.42 * open, s * 0.18, 0, TAU); ctx.fill();
        const look = clamp((this.player.cx - this.cx) / 300, -1, 1) * r * 0.08;
        eye(ctx, ex + look, ey + r * 0.06, r * 0.1 * (1 + this.mouthGlow * 0.4), col, true);
      }
    }
    // a vertical seam like a bell's tongue
    ctx.strokeStyle = 'rgba(60,50,40,0.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y + r * 0.1); ctx.lineTo(x, y + r * 0.5); ctx.stroke();
    if (this.phase >= 2) {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x + r * 0.15, y - r * 1.3); ctx.lineTo(x + r * 0.05, y - r * 0.85); ctx.lineTo(x + r * 0.2, y - r * 0.6); ctx.stroke();
    }
  }

  drawExtra(ctx, t) {
    const A = this.arena;
    // swing telegraph: the dotted arc the bell will sweep
    if (this.arcTele) {
      const T = this.arcTele;
      ctx.save();
      ctx.strokeStyle = `rgba(255,225,160,${0.2 + 0.45 * T.k})`; ctx.lineWidth = 3; ctx.setLineDash([10, 12]); ctx.lineDashOffset = -t * 60;
      ctx.beginPath();
      ctx.arc(this.px, this.py, T.len + 0.58 * BH, Math.PI / 2 - T.amp, Math.PI / 2 + T.amp);
      ctx.stroke();
      ctx.restore();
    }
    // slam shadow
    if (this.shadow > 0) {
      ctx.fillStyle = `rgba(10,8,14,${0.25 + 0.35 * this.shadow})`;
      ctx.beginPath(); ctx.ellipse(this.bx, this.groundY - 2, BW * 0.55 * (0.5 + 0.5 * this.shadow), 9, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255,220,150,${0.5 * this.shadow})`; ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (this.landX != null) {
      ctx.fillStyle = 'rgba(10,8,14,0.4)';
      ctx.beginPath(); ctx.ellipse(this.landX, this.groundY - 2, BW * 0.5, 8, 0, 0, TAU); ctx.fill();
    }
    // falling-bell warnings: dust streams and a ringed spot on the floor
    for (const m of this.marks) {
      const k = m.t / m.dur;
      ctx.fillStyle = `rgba(210,200,180,${0.5 * (1 - k * 0.3)})`;
      for (let i = 0; i < 6; i++) {
        const yy = A.y + ((t * 220 + i * 47) % 140);
        ctx.fillRect(m.x - 6 + ((i * 7) % 12), yy, 2, 4);
      }
      ctx.strokeStyle = `rgba(255,220,150,${0.3 + 0.5 * k})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(m.x, this.groundY - 2, 22 * (1.4 - k * 0.4), 5, 0, 0, TAU); ctx.stroke();
    }
    // rings of sound
    for (const R of this.rings) {
      const fade = clamp(R.life / 0.6, 0, 1) * clamp(1 - R.r / 1300, 0, 1);
      if (fade <= 0 || R.r < 2) continue;
      const draw = (col, lw) => {
        ctx.strokeStyle = col; ctx.lineWidth = lw;
        if (!R.gaps.length) { ctx.beginPath(); ctx.arc(R.x, R.y, R.r, 0, TAU); ctx.stroke(); return; }
        const gs = R.gaps.map((g) => ((g % TAU) + TAU) % TAU).sort((a, b) => a - b);
        for (let i = 0; i < gs.length; i++) {
          const a0 = gs[i] + R.gw, a1 = (i + 1 < gs.length ? gs[i + 1] : gs[0] + TAU) - R.gw;
          if (a1 > a0) { ctx.beginPath(); ctx.arc(R.x, R.y, R.r, a0, a1); ctx.stroke(); }
        }
      };
      ctx.globalAlpha = fade;
      if (R.harm) {
        draw(INK, R.th + 4);
        draw('#c9974e', R.th);
        ctx.globalCompositeOperation = 'lighter';
        draw('rgba(255,230,170,0.55)', R.th * 0.4);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.globalCompositeOperation = 'lighter';
        draw('rgba(255,230,170,0.5)', R.th);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
    }
    // clapper lash
    const L = this.lashS;
    if (L) {
      const m = this.mouth();
      if (L.k <= 0.02) {
        ctx.save();
        ctx.strokeStyle = L.locked ? 'rgba(255,140,90,0.85)' : `rgba(255,225,160,${0.3 + L.aim * 0.4})`;
        ctx.lineWidth = L.locked ? 2.5 : 1.5; ctx.setLineDash([6, 8]);
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(L.tx, L.ty); ctx.stroke();
        ctx.restore();
      }
      const ex = m.x + (L.tx - m.x) * L.k, ey = m.y + (L.ty - m.y) * L.k;
      const pullback = L.k <= 0.02 ? 1 : 0;
      const bx = pullback ? m.x : ex, by = pullback ? m.y - 10 : ey;
      this.drawChain(ctx, m.x, m.y, bx, by, false, t);
      ctx.beginPath(); ctx.arc(bx, by, 0.09 * BW, 0, TAU);
      ctx.fillStyle = BRONZE.mid; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = BRONZE.rim; ctx.beginPath(); ctx.arc(bx - 4, by - 4, 4, 0, TAU); ctx.fill();
    }
    // flying chain links after the snap
    for (const c of this.chainBits) {
      const x = c.x + c.vx * c.t, y = c.y + c.vy * c.t + 900 * c.t * c.t;
      if (y > this.groundY) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(c.r + c.t * 8);
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 0, 8, 4, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#5d5866'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
  }
}

// ================================================================= GALEHARROW
// A storm given the shape of a bird: ragged cloud-feathers, a long beaked skull,
// and eyes like the lit windows of a far-off tower. It never lands.
const GALE = { body: '#2f3a52', dark: '#1c2234', mid: '#47567a', edge: '#a9bedb', bone: '#e8e3d4', eye: '#a8f0ff' };

export class Galeharrow extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'galeharrow', size: [140, 112], music: 'boss_optional', air: true, glints: 260, introTime: 2.3 });
    if (this.dead) return;
    this.noPhysics = true;
    const A = this.arena;
    this.groundY = scanGround(game.room, A.x + A.w / 2, A.y + A.h * 0.45);
    this.homeY = Math.max(A.y + 70, this.groundY - 300);
    this.x = clamp(this.x, A.x + 40, A.x + A.w - this.w - 40);
    this.y = this.homeY - this.h / 2;
    this.tx = this.cx; this.ty = this.homeY; this.drift = true;
    this.flap = 0; this.flapRate = 7;
    this.spread = 0;       // wings spread wide (telegraph pose)
    this.dive = 0;         // body tilt during dives
    this.gust = null;      // { dir, str, t, tele, dur }
    this.streaks = [];
    this.tornados = [];
    this.bolts = [];
    this.aim = null;
    this.trailPts = [];
  }

  idle(dt) { this.hover(dt, 0.5); }
  introUpdate(dt, t) {
    this.spread = Math.sin(clamp(t / 1.6, 0, 1) * Math.PI);
    this.ty = this.homeY - Math.sin(t * 2) * 20;
    this.hover(dt, 2);
    if (t > 0.6 && t < 0.65) this.sfx('screech');
    if (Math.random() < 0.6) this.spawnStreak(this.rand(-1, 1) < 0 ? -1 : 1, 0.4);
    this.updateStreaks(dt);
  }

  hover(dt, k = 3) {
    if (!this.drift) return;
    const bob = Math.sin(this.anim * 2.2) * 10;
    this.x += (this.tx - this.cx) * Math.min(1, k * dt);
    this.y += (this.ty + bob - this.cy) * Math.min(1, k * dt);
  }

  think(dt) {
    const p = this.player, A = this.arena;
    this.hover(dt, 2.5);
    this.flap += dt * this.flapRate;
    this.trailPts.push({ x: this.cx, y: this.cy }); if (this.trailPts.length > 14) this.trailPts.shift();
    // gusts
    const G = this.gust;
    if (G) {
      G.t += dt;
      const active = G.t > G.tele;
      if (Math.random() < (active ? 0.9 : 0.35)) this.spawnStreak(G.dir, active ? 1 : 0.4);
      if (active) {
        let dir = G.dir;
        if (G.flipAt && G.t > G.flipAt) dir = -dir;
        G.cur = dir;
        pushPlayer(this, dir * G.str * Math.min(1, (G.t - G.tele) * 3) * dt);
      }
      if (G.t > G.tele + G.dur) this.gust = null;
    }
    this.updateStreaks(dt);
    // tornado columns
    for (const T of this.tornados) {
      T.t += dt;
      if (T.t > T.tele) {
        const k = T.t - T.tele;
        T.x += clamp(p.cx - T.x, -1, 1) * T.vx * dt;
        T.x = clamp(T.x, A.x + T.w / 2, A.x + A.w - T.w / 2);
        if (k < T.dur) {
          this.hits.push({ x: T.x - T.w * 0.35, y: A.y, w: T.w * 0.7, h: this.groundY - A.y });
          const d = p.cx - T.x;
          if (Math.abs(d) < 230 && Math.abs(d) > 20) pushPlayer(this, -Math.sign(d) * 110 * (1 - Math.abs(d) / 230) * dt);
        }
      }
    }
    this.tornados = this.tornados.filter((T) => T.t < T.tele + T.dur + 0.5);
    // lightning
    for (const B of this.bolts) {
      B.t += dt;
      if (B.t > B.tele && !B.struck) { B.struck = true; this.sfx('laser'); this.shake(5, 0.2); this.fx.burst(B.x, this.groundY, 10, { color: '#e8f6ff', speed: 260, angle: -Math.PI / 2, spread: 2.4, size: 2.5, life: 0.4, glow: true }); }
      if (B.t > B.tele && B.t < B.tele + 0.22) this.hits.push({ x: B.x - 20, y: this.arena.y, w: 40, h: this.groundY - this.arena.y });
    }
    this.bolts = this.bolts.filter((B) => B.t < B.tele + 0.5);
    // swoop / dive streaks
    if (this.dive && Math.random() < 0.8) this.fx.add({ x: this.cx + this.rand(-30, 30), y: this.cy + this.rand(-20, 20), vx: -this.vx * 0.3, vy: -this.vy * 0.3, life: 0.3, size: 2, color: 'rgba(220,240,255,0.7)', shape: 'streak', g: 0, front: false });
  }

  spawnStreak(dir, a = 1) {
    const A = this.arena, cam = this.game.camera;
    const vx0 = cam.viewX ?? A.x, vy0 = cam.viewY ?? A.y;
    this.streaks.push({
      x: dir > 0 ? vx0 - 120 + Math.random() * 300 : vx0 + 960 + 120 - Math.random() * 300,
      y: vy0 + Math.random() * 540, len: 40 + Math.random() * 110, v: dir * (700 + Math.random() * 500), a, t: 0,
    });
  }
  updateStreaks(dt) {
    for (const s of this.streaks) { s.x += s.v * dt; s.t += dt; }
    this.streaks = this.streaks.filter((s) => s.t < 1.6);
  }

  *during(sec, fn) {
    const T = sec / this.speedMul;
    for (let t = 0; t < T; t += 1 / 60) { fn(t / T, t); yield; }
    fn(1, T);
  }
  *flyTo(x, y, time) {
    this.drift = false;
    const x0 = this.cx, y0 = this.cy;
    time = Math.max(time, Math.hypot(x - x0, y - y0) / 950);
    yield* this.during(time, (k) => {
      const e = k * k * (3 - 2 * k);
      const nx = lerp(x0, x, e), ny = lerp(y0, y, e);
      this.vx = (nx - this.cx) * 60; this.vy = (ny - this.cy) * 60;
      this.x = nx - this.w / 2; this.y = ny - this.h / 2;
      if (Math.abs(this.vx) > 5) this.facing = Math.sign(this.vx);
    });
    this.vx = this.vy = 0;
    this.tx = this.cx; this.ty = this.cy; this.drift = true;
  }
  sideX(side) { const A = this.arena; return side < 0 ? A.x + 130 : A.x + A.w - 130; }

  attackList() {
    const p3 = this.phase >= 3;
    return [
      { name: 'gust', w: this.gust ? 0 : 2.2, fn: this.galeAtk },
      { name: 'feathers', w: 2.2, fn: this.featherStorm },
      { name: 'dive', w: 2.4, fn: this.diveBomb },
      { name: 'tornado', w: this.tornados.length ? 0 : (this.phase >= 2 ? 2.2 : 1.4), fn: this.tornadoAtk },
      { name: 'swoop', w: 1.6, fn: this.swoop },
      { name: 'thunder', w: p3 ? 1.8 : (this.phase >= 2 ? 0.8 : 0), fn: this.thunder },
    ];
  }

  // ----- Gale: wind streaks gather, then a gust shoves Bead sideways while feathers ride it
  *galeAtk() {
    const A = this.arena;
    const dir = this.player.cx < A.x + A.w / 2 ? -1 : 1; // blow Bead toward the nearer wall
    const side = -dir;
    yield* this.flyTo(this.sideX(side), this.homeY - 20, 0.7);
    this.facing = dir;
    this.spread = 1; this.tele = 0.7; this.sfx('screech');
    this.gust = { dir, str: 205 + this.phase * 25, t: 0, tele: 0.75, dur: 2.6 + this.phase * 0.3, flipAt: this.phase >= 3 ? 0.75 + 1.4 : 0 };
    yield 0.75;
    this.flapRate = 16;
    const n = 3 + this.phase;
    for (let i = 0; i < n; i++) {
      // feathers ride the wind at varying heights: a gap is always left
      const gapRow = Math.floor(Math.random() * 4);
      for (let r = 0; r < 4; r++) {
        if (r === gapRow) continue;
        const y = this.groundY - 20 - r * 46;
        this.fire(this.cx + dir * 40, y, dir * 330, 0, { art: 'feather', color: GALE.edge, r: 8, life: 5, ignoreWalls: true });
      }
      this.sfx('throw');
      yield 0.6 + (this.phase >= 3 ? 0 : 0.15);
    }
    while (this.gust) yield;
    this.flapRate = 7; this.spread = 0;
    yield 0.4;
  }

  // ----- Feather Storm: wings flare, then fans of razor feathers
  *featherStorm() {
    this.facePlayer();
    this.ty = this.homeY - 30;
    this.spread = 1; this.tele = 0.6; this.sfx('rustle');
    yield 0.6;
    const volleys = this.phase >= 2 ? 4 : 3;
    for (let v = 0; v < volleys; v++) {
      this.facePlayer();
      const n = 5 + this.phase;
      const base = Math.atan2(this.player.cy - this.cy, this.player.cx - this.cx);
      if (this.phase >= 3 && v % 2) {
        this.fireRing(this.cx, this.cy, 14, 240, { art: 'feather', color: GALE.edge, r: 8, a0: base + 0.22, life: 4 });
      } else {
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.2 + (v % 2 ? 0.1 : 0);
          this.fire(this.cx, this.cy, Math.cos(a) * 360, Math.sin(a) * 360, { art: 'feather', color: GALE.edge, r: 8, life: 4 });
        }
      }
      this.sfx('throw');
      this.flap += 1.5;
      yield 0.55;
    }
    this.spread = 0;
    yield 0.6;
  }

  // ----- Dive-bomb: locks a line on Bead and drops like a stone
  *diveBomb() {
    const reps = this.phase >= 2 ? 2 : 1;
    for (let r = 0; r < reps; r++) {
      const A = this.arena;
      const sx = clamp(this.player.cx + this.pick([-1, 1]) * this.rand(160, 260), A.x + 90, A.x + A.w - 90);
      yield* this.flyTo(sx, Math.max(A.y + 70, this.groundY - 360), 0.5);
      this.facePlayer();
      this.aim = { x: this.player.cx, y: this.groundY, k: 0, locked: false };
      this.tele = 0.6; this.sfx('screech'); this.spread = 1;
      yield* this.during(r ? 0.5 : 0.65, (k) => {
        this.aim.k = k;
        if (k < 0.65) this.aim.x = this.player.cx; else this.aim.locked = true;
      });
      this.spread = 0; this.drift = false;
      const x0 = this.cx, y0 = this.cy, x1 = this.aim.x, y1 = this.groundY - this.h * 0.4;
      const d = Math.hypot(x1 - x0, y1 - y0), sp = 1150 * this.speedMul;
      this.dive = Math.atan2(y1 - y0, x1 - x0);
      this.facing = x1 >= x0 ? 1 : -1;
      this.vx = (x1 - x0) / d * sp; this.vy = (y1 - y0) / d * sp;
      this.sfx('dash');
      for (let s = 0; s < d; s += sp / 60) { this.x += this.vx / 60; this.y += this.vy / 60; yield; }
      this.x = x1 - this.w / 2; this.y = y1 - this.h / 2;
      this.aim = null;
      this.sfx('slam'); this.shake(8, 0.35);
      this.fx.burst(this.cx, this.groundY, 18, { color: '#dfe8f5', speed: 340, angle: -Math.PI / 2, spread: 2.6, size: 3, life: 0.5 });
      this.fx.ring(this.cx, this.groundY - 10, 10, 160, 0.4, 'rgba(220,240,255,0.8)', 5);
      this.shockwave(this.cx - 30, -1, 430, 30, { color: 'rgba(210,235,255,0.85)', art: 'wave' });
      this.shockwave(this.cx + 30, 1, 430, 30, { color: 'rgba(210,235,255,0.85)', art: 'wave' });
      this.dive = 0; this.vx = this.vy = 0;
      yield 0.55;
      yield* this.flyTo(this.cx, this.homeY, 0.6);
    }
    yield 0.4;
  }

  // ----- Tornado: dust spirals on the floor, then columns of wind that wander toward Bead
  *tornadoAtk() {
    const A = this.arena;
    this.tele = 0.6; this.spread = 1; this.flapRate = 14; this.sfx('rustle');
    const n = this.phase >= 3 ? 3 : this.phase >= 2 ? 2 : 1;
    const xs = [];
    const px = this.player.cx;
    xs.push(clamp(px + this.pick([-1, 1]) * 230, A.x + 60, A.x + A.w - 60));
    if (n >= 2) xs.push(clamp(px - (xs[0] - px), A.x + 60, A.x + A.w - 60));
    if (n >= 3) xs.push(px < A.x + A.w / 2 ? A.x + A.w - 90 : A.x + 90);
    for (const x of xs) this.tornados.push({ x, w: 76, t: 0, tele: 0.9, dur: 3.6, vx: 70 + this.phase * 12 });
    yield 0.9;
    this.sfx('burst');
    yield 1.0;
    this.flapRate = 7; this.spread = 0;
    yield 0.5;
  }

  // ----- Swoop: a screaming arc that sweeps the floor from wall to wall
  *swoop() {
    const A = this.arena;
    const side = this.player.cx < A.x + A.w / 2 ? 1 : -1;
    const xa = this.sideX(side), xb = this.sideX(-side);
    const top = Math.max(A.y + 70, this.groundY - 340);
    yield* this.flyTo(xa, top, 0.6);
    this.facing = -side;
    this.tele = 0.65; this.sfx('screech'); this.spread = 1;
    this.aim = { swoop: true, xa, xb, top, k: 0 };
    yield* this.during(0.65, (k) => { this.aim.k = k; });
    this.aim = null; this.spread = 0;
    this.drift = false;
    const low = this.groundY - this.h * 0.42;
    this.sfx('dash');
    let px = this.cx, py = this.cy;
    yield* this.during(1.25, (k) => {
      const x = lerp(xa, xb, k), y = top + (low - top) * Math.sin(Math.PI * k);
      this.vx = (x - px) * 60; this.vy = (y - py) * 60; px = x; py = y;
      this.x = x - this.w / 2; this.y = y - this.h / 2;
      this.dive = Math.atan2(this.vy, Math.abs(this.vx)) * 0.6 * this.facing;
    });
    this.dive = 0; this.vx = this.vy = 0;
    this.tx = this.cx; this.ty = this.homeY; this.drift = true;
    if (this.phase >= 2) { this.facePlayer(); for (let i = -1; i <= 1; i++) this.fireAt(this.cx, this.cy, 300, { art: 'gale', r: 12, offset: i * 0.3, life: 3, ignoreWalls: true }); this.sfx('throw'); }
    yield 0.8;
  }

  // ----- Thunderhead (phase 2+): storm-light falls in telegraphed columns
  *thunder() {
    this.ty = this.homeY - 40; this.tele = 0.5; this.spread = 1; this.sfx('warn');
    yield 0.5;
    const A = this.arena;
    const waves = this.phase >= 3 ? 3 : 2;
    for (let w = 0; w < waves; w++) {
      const base = this.player.cx;
      const xs = [base, base - 190, base + 190, base - 380, base + 380].filter((x) => x > A.x + 20 && x < A.x + A.w - 20);
      const off = w % 2 ? 95 : 0;
      for (const x of xs) this.bolts.push({ x: clamp(x + off, A.x + 20, A.x + A.w - 20), t: 0, tele: 0.7 });
      yield 0.85;
    }
    this.spread = 0;
    yield 0.6;
  }

  onPhase(n) {
    this.sfx('screech'); this.shake(7, 0.6); this.tele = 0.8;
    if (n === 3) this.game.flash('rgba(220,240,255,0.35)', 0.3);
  }
  onDeath() { this.gust = null; this.tornados = []; this.bolts = []; this.aim = null; this.dive = 0; }

  bodyBox() { return { x: this.cx - 50, y: this.cy - 40, w: 100, h: 84 }; }

  // ---------- drawing ----------
  drawBody(ctx, t, white) {
    const cx = this.cx, cy = this.cy;
    // wind streamers trailing behind
    if (!white && this.trailPts.length > 2) {
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = `rgba(190,225,255,${0.16 - k * 0.04})`; ctx.lineWidth = 10 - k * 3;
        ctx.beginPath();
        this.trailPts.forEach((q, i) => {
          const wob = Math.sin(t * 6 + i * 0.7 + k * 2) * (6 + k * 6);
          i ? ctx.lineTo(q.x - this.facing * (14 - i) * 3, q.y + wob + k * 8) : ctx.moveTo(q.x, q.y + wob);
        });
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(this.facing * 1.15, 1.15);
    ctx.rotate(this.dive ? this.dive * this.facing * 0.8 : Math.sin(t * 1.3) * 0.05);
    const flap = Math.sin(this.flap) * (1 - this.spread * 0.75);
    // far wing
    this.drawWing(ctx, -6, -18, -1, flap, white, t, 0.82);
    // tail streamers
    for (let i = 0; i < 4; i++) {
      const sw = Math.sin(t * 5 + i) * 10;
      ctx.beginPath();
      ctx.moveTo(-40, 6 + i * 3);
      ctx.quadraticCurveTo(-90, 18 + i * 8 + sw, -140 - i * 12, 10 + i * 12 + sw * 1.6);
      ctx.quadraticCurveTo(-95, 26 + i * 8 + sw, -40, 14 + i * 3);
      ctx.fillStyle = W(white, i % 2 ? GALE.mid : GALE.body); ctx.fill();
      ctx.strokeStyle = W(white, INK); ctx.lineWidth = 2; ctx.stroke();
    }
    // talons
    ctx.strokeStyle = W(white, INK); ctx.lineWidth = 4;
    for (const s of [-1, 1]) {
      const reach = this.dive ? 18 : 0;
      ctx.beginPath(); ctx.moveTo(s * 10, 28); ctx.lineTo(s * 14 + 6, 50 + reach); ctx.stroke();
      ctx.lineWidth = 2.5;
      for (const c of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(s * 14 + 6, 50 + reach); ctx.quadraticCurveTo(s * 14 + 6 + c * 8, 58 + reach, s * 14 + 6 + c * 10 + 3, 62 + reach); ctx.stroke(); }
      ctx.lineWidth = 4;
    }
    // ragged storm body
    ctx.beginPath();
    const n = 22;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const rag = i % 2 ? 0.86 : 1.06 + Math.sin(t * 7 + i) * 0.04;
      const rx = 56 * rag, ry = 40 * rag;
      ctx.lineTo(Math.cos(a) * rx - 6, Math.sin(a) * ry + 4);
    }
    ctx.closePath();
    if (white) ctx.fillStyle = '#fff';
    else { const g = ctx.createLinearGradient(0, -40, 0, 44); g.addColorStop(0, GALE.mid); g.addColorStop(1, GALE.dark); ctx.fillStyle = g; }
    ctx.fill(); ctx.strokeStyle = W(white, INK); ctx.lineWidth = 3; ctx.stroke();
    if (!white) {
      // swirl of wind across the chest
      ctx.strokeStyle = 'rgba(200,230,255,0.45)'; ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.arc(-4, 6, 14 + k * 9, t * 3 + k * 2, t * 3 + k * 2 + 2.2); ctx.stroke();
      }
      if (this.phase >= 3) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(230,245,255,${0.5 + 0.5 * Math.sin(t * 30)})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-30, -10); ctx.lineTo(-12, 2); ctx.lineTo(-20, 8); ctx.lineTo(2, 22); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    // near wing
    this.drawWing(ctx, 4, -14, 1, flap, white, t, 1);
    // neck + skull-mask head
    ctx.save();
    ctx.translate(42, -22 + Math.sin(t * 2.2) * 2);
    ctx.rotate(-0.15);
    // crest
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(-6, -6 + i * 2);
      ctx.quadraticCurveTo(-30 - i * 6, -26 + i * 6 + Math.sin(t * 6 + i) * 3, -48 - i * 7, -18 + i * 9);
      ctx.quadraticCurveTo(-26, -8 + i * 4, -4, 2 + i * 2);
      ctx.fillStyle = W(white, i % 2 ? GALE.edge : GALE.mid); ctx.fill();
      ctx.strokeStyle = W(white, INK); ctx.lineWidth = 1.5; ctx.stroke();
    }
    // skull
    ctx.beginPath();
    ctx.moveTo(-14, -2);
    ctx.quadraticCurveTo(-14, -24, 6, -24);
    ctx.quadraticCurveTo(22, -24, 28, -12);
    ctx.lineTo(62, -2);                    // long hooked beak
    ctx.quadraticCurveTo(68, 4, 60, 10);
    ctx.quadraticCurveTo(58, 4, 50, 4);
    ctx.lineTo(24, 8);
    ctx.quadraticCurveTo(10, 18, -6, 12);
    ctx.quadraticCurveTo(-16, 8, -14, -2);
    ctx.fillStyle = W(white, GALE.bone); ctx.fill();
    ctx.strokeStyle = W(white, INK); ctx.lineWidth = 2.5; ctx.stroke();
    if (!white) {
      ctx.strokeStyle = 'rgba(40,40,50,0.5)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(26, -4); ctx.lineTo(56, 1); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(6, -8, 8, 9, 0.2, 0, TAU); ctx.fill();
      eye(ctx, 7, -8, this.tele > 0 ? 4 : 3, this.phase >= 3 ? '#e6fbff' : GALE.eye, true);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(-4, 4, 2, 3, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }

  drawWing(ctx, x, y, side, flap, white, t, alpha) {
    // side: -1 far wing (drawn behind), 1 near wing. Wing arcs up/down with the flap.
    ctx.save();
    ctx.translate(x, y);
    const up = 0.55 + flap * 0.85 + this.spread * 0.55;
    ctx.rotate(up + (side < 0 ? 0.22 : 0));
    ctx.scale(1, side < 0 ? 0.85 : 1);
    if (!white) ctx.globalAlpha = alpha;
    const L = 190 + this.spread * 30;
    // arm
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-L * 0.3, -50, -L * 0.55, -36);
    ctx.quadraticCurveTo(-L * 0.8, -30, -L, -10);
    // primaries: ragged fingers
    for (let i = 0; i < 7; i++) {
      const k = i / 6;
      const fx = -L + k * L * 0.75, fy = -10 + 22 + Math.sin(t * 9 + i) * 3 + k * 26;
      ctx.lineTo(fx - 14 + k * 4, fy + 18 - k * 4);
      ctx.lineTo(fx + 10, fy - 4);
    }
    ctx.quadraticCurveTo(-L * 0.15, 24, 0, 14);
    ctx.closePath();
    if (white) ctx.fillStyle = '#fff';
    else { const g = ctx.createLinearGradient(0, -40, -L, 40); g.addColorStop(0, side < 0 ? GALE.dark : GALE.body); g.addColorStop(1, GALE.mid); ctx.fillStyle = g; }
    ctx.fill();
    ctx.strokeStyle = W(white, INK); ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
    if (!white) {
      ctx.strokeStyle = this.tele > 0 && this.spread > 0.5 ? 'rgba(220,250,255,0.9)' : 'rgba(169,190,219,0.6)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const k = i / 5;
        ctx.beginPath(); ctx.moveTo(-L * 0.25 - k * L * 0.1, -20 + k * 6); ctx.quadraticCurveTo(-L * 0.6 + k * 30, -10 + k * 18, -L * 0.9 + k * L * 0.6, 18 + k * 22); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawExtra(ctx, t) {
    const A = this.arena;
    // wind streaks
    if (this.streaks.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const s of this.streaks) {
        const a = Math.min(1, s.t * 4) * Math.max(0, 1 - s.t / 1.6) * 0.45 * s.a;
        ctx.strokeStyle = `rgba(220,238,255,${a})`; ctx.lineWidth = 2;
        const dir = Math.sign(s.v);
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.quadraticCurveTo(s.x - dir * s.len * 0.5, s.y + Math.sin(s.t * 8) * 4, s.x - dir * s.len, s.y); ctx.stroke();
      }
      ctx.restore();
    }
    // tornado columns
    for (const T of this.tornados) {
      const tele = T.t < T.tele, k = T.t - T.tele;
      const fade = tele ? T.t / T.tele : clamp(1 - (k - T.dur) / 0.5, 0, 1);
      const top = tele ? this.groundY - 60 * (T.t / T.tele) : A.y;
      const H = this.groundY - top;
      ctx.save();
      ctx.globalAlpha = fade;
      // dusty swirl at the base during telegraph
      for (let i = 0; i < (tele ? 6 : 16); i++) {
        const yy = this.groundY - (i / 16) * H;
        const wid = (T.w * 0.25 + (i / 16) * T.w * 0.75) * (tele ? 0.7 : 1);
        const ph = t * 9 + i * 0.8;
        ctx.strokeStyle = tele ? 'rgba(210,200,180,0.6)' : (i % 2 ? 'rgba(220,235,255,0.55)' : 'rgba(150,170,200,0.55)');
        ctx.lineWidth = tele ? 2 : 3;
        ctx.beginPath(); ctx.ellipse(T.x + Math.sin(ph * 0.6) * 6, yy, wid, 7 + i * 0.4, 0, ph % TAU, (ph % TAU) + 4.2); ctx.stroke();
      }
      if (!tele) {
        ctx.strokeStyle = 'rgba(22,20,28,0.5)'; ctx.lineWidth = 2;
        for (let s = -1; s <= 1; s += 2) {
          ctx.beginPath();
          for (let i = 0; i <= 16; i++) {
            const yy = this.groundY - (i / 16) * H, wid = T.w * 0.25 + (i / 16) * T.w * 0.75;
            const x = T.x + s * wid + Math.sin(t * 6 + i) * 4;
            i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    // lightning columns
    for (const B of this.bolts) {
      if (B.t < B.tele) {
        const k = B.t / B.tele;
        ctx.save(); ctx.setLineDash([4, 10]); ctx.lineDashOffset = -t * 80;
        ctx.strokeStyle = `rgba(220,245,255,${0.2 + 0.5 * k})`; ctx.lineWidth = 1 + k * 2;
        ctx.beginPath(); ctx.moveTo(B.x, A.y); ctx.lineTo(B.x, this.groundY); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = `rgba(220,245,255,${0.3 * k})`;
        ctx.beginPath(); ctx.ellipse(B.x, this.groundY - 2, 22, 5, 0, 0, TAU); ctx.fill();
      } else {
        const k = (B.t - B.tele) / 0.5;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let j = 0; j < 2; j++) {
          ctx.strokeStyle = j ? `rgba(255,255,255,${1 - k})` : `rgba(150,220,255,${0.7 * (1 - k)})`; ctx.lineWidth = j ? 3 : 12;
          ctx.beginPath(); ctx.moveTo(B.x, A.y);
          for (let y = A.y; y < this.groundY; y += 36) ctx.lineTo(B.x + (Math.sin(y * 13.1 + B.x) * 14), y);
          ctx.lineTo(B.x, this.groundY); ctx.stroke();
        }
        ctx.restore();
      }
    }
    // dive / swoop telegraphs
    const a = this.aim;
    if (a && !a.swoop) {
      ctx.save(); ctx.setLineDash([8, 10]); ctx.lineDashOffset = -t * 90;
      ctx.strokeStyle = a.locked ? 'rgba(255,150,120,0.9)' : `rgba(220,245,255,${0.3 + a.k * 0.4})`; ctx.lineWidth = a.locked ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(this.cx, this.cy); ctx.lineTo(a.x, a.y); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = a.locked ? 'rgba(255,150,120,0.9)' : 'rgba(220,245,255,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(a.x, a.y - 2, 30 - a.k * 10, 6, 0, 0, TAU); ctx.stroke();
    } else if (a && a.swoop) {
      ctx.save(); ctx.setLineDash([8, 12]); ctx.lineDashOffset = -t * 90;
      ctx.strokeStyle = `rgba(220,245,255,${0.25 + a.k * 0.5})`; ctx.lineWidth = 2.5;
      ctx.beginPath();
      const low = this.groundY - this.h * 0.42;
      for (let i = 0; i <= 30; i++) {
        const k = i / 30, x = lerp(a.xa, a.xb, k), y = a.top + (low - a.top) * Math.sin(Math.PI * k);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke(); ctx.restore();
    }
  }
}

export default { carillon: Carillon, galeharrow: Galeharrow };
