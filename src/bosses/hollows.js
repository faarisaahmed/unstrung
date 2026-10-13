// Bosses of area 'hollows': Grandmother Burr (main) and the Brass Beetle (optional).
import { Boss, registerMinion } from './boss.js';
import { TAU, clamp } from '../core/math.js';
import { TILE } from '../core/constants.js';
import { INK, eye, registerPainter } from '../art/creatures.js';
import { registerProjectileArt } from '../entities/projectile.js';

// ------------------------------------------------------------------ shared helpers
// stroke a polyline twice: thick ink, then colour on top (hand-inked limb)
function limb(ctx, pts, lw, col, K) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [c, w] of [[K, lw + 3.5], [col, lw]]) {
    ctx.strokeStyle = c; ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
}
function bez(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}
function glowDot(ctx, x, y, r, col, a = 0.4) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}
const tileOf = (v) => Math.floor(v / TILE);
const MM_SCALE = 1.2;
const BB_SCALE = 1.3;

// a hooked burr spine: a shaft from (x, y) along angle a whose tip curls back into a little barb
function hook(ctx, x, y, a, len, w, col, K, curl = 1) {
  const dx = Math.cos(a), dy = Math.sin(a), px = -dy * curl, py = dx * curl;
  const tx = x + dx * len, ty = y + dy * len;
  const path = () => {
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + dx * len * 0.6 + px * len * 0.1, y + dy * len * 0.6 + py * len * 0.1, tx, ty);
    const b = Math.min(len * 0.26, 7);
    ctx.quadraticCurveTo(tx + px * b + dx * b * 0.3, ty + py * b + dy * b * 0.3, tx + px * b * 1.1 - dx * b * 0.7, ty + py * b * 1.1 - dy * b * 0.7);
    ctx.stroke();
  };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (K) { ctx.strokeStyle = K; ctx.lineWidth = w + 2; path(); }
  ctx.strokeStyle = col; ctx.lineWidth = w; path();
}

// a little burr seed: hooked spiny ball, optionally with a tuft of down
function burrSeed(ctx, r, rot, body, tip, fluff) {
  ctx.save(); ctx.rotate(rot);
  if (fluff) {
    ctx.lineCap = 'round';
    // a little parachute of down
    for (let i = -4; i <= 4; i++) {
      const a = -Math.PI / 2 + i * 0.27, L = r * (2.5 - Math.abs(i) * 0.1);
      const ex = Math.cos(a) * L, ey = Math.sin(a) * L - r * 0.3;
      ctx.strokeStyle = 'rgba(250,244,226,0.9)'; ctx.lineWidth = Math.max(0.9, r * 0.11);
      ctx.beginPath(); ctx.moveTo(0, -r * 0.6); ctx.quadraticCurveTo(ex * 0.4, -r * 0.6 + ey * 0.5, ex, ey);
      for (const d of [-0.6, 0, 0.6]) { ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a + d) * r * 0.5, ey + Math.sin(a + d) * r * 0.5); }
      ctx.stroke();
    }
  }
  const n = r > 8 ? 11 : 8;
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + 0.2; hook(ctx, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, a, r * 0.75, Math.max(1, r * 0.15), tip, INK, i % 2 ? 1 : -1); }
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, r * 0.78 + 1.6, 0, TAU); ctx.fill();
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(30,18,8,0.4)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.78, -0.3, Math.PI * 0.95); ctx.arc(-r * 0.2, -r * 0.2, r * 0.7, Math.PI * 0.85, -0.2, true); ctx.fill();
  ctx.strokeStyle = tip; ctx.lineWidth = Math.max(0.8, r * 0.1);
  for (let i = 0; i < 4; i++) { const a = i * 1.7; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32, r * 0.18, a, a + 2.4); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,240,205,0.6)'; ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.2, r * 0.12, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------ projectile art
// burr seeds shaken loose from Grandmother Burr's down: they float on their fluff
registerProjectileArt('mm_spore', (ctx, p) => {
  const r = p.r, x = p.cx, y = p.cy + Math.sin(p.age * 5 + p.x * 0.03) * 2;
  glowDot(ctx, x, y, r * 2.6, p.o.color || '#f3ead2', 0.3);
  ctx.save(); ctx.translate(x, y);
  burrSeed(ctx, r, Math.sin(p.age * 3 + p.x * 0.01) * 0.4, p.o.fill || '#8a6634', '#d2ae6a', r > 8);
  ctx.restore();
});

// old dried burr clumps knocked down from the roots
registerProjectileArt('mm_pebble', (ctx, p) => {
  ctx.save(); ctx.translate(p.cx, p.cy);
  burrSeed(ctx, p.r * 1.1, p.age * 6, p.o.color || '#5a4326', '#a8864c', false);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-p.r * 0.15, -p.r * 0.55, p.r * 0.48, Math.PI * 1.05, -0.05); ctx.fill();
  ctx.fillStyle = '#7f9a58'; ctx.beginPath(); ctx.arc(-p.r * 0.15, -p.r * 0.5, p.r * 0.38, Math.PI * 1.05, -0.05); ctx.fill();
  ctx.restore();
});

registerProjectileArt('bb_note', (ctx, p, t) => {
  const r = p.r, x = p.cx, y = p.cy;
  glowDot(ctx, x, y, r * 3, '#ffd27a', 0.35);
  // trailing sound arc
  const a = Math.atan2(p.vy, p.vx);
  ctx.strokeStyle = 'rgba(255,220,150,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x - Math.cos(a) * r, y - Math.sin(a) * r, r * 1.6, a + Math.PI - 0.9, a + Math.PI + 0.9); ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d9a649'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#fff1c0'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, TAU); ctx.fill();
});

registerProjectileArt('bb_shard', (ctx, p) => {
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.rot);
  const r = p.r;
  ctx.fillStyle = '#d9a649'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(r * 2.2, 0); ctx.lineTo(-r * 0.6, -r * 0.8); ctx.lineTo(-r * 1.6, 0); ctx.lineTo(-r * 0.6, r * 0.8); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#fff1c0'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(r * 1.6, 0); ctx.lineTo(-r * 0.6, -r * 0.4); ctx.stroke();
  ctx.restore();
});

// ------------------------------------------------------------------ minions
// Burrling: a tiny prickly burr baby in a knitted bonnet, toddling on two nubs
registerPainter('burrling', (ctx, e, t, A) => {
  const ph = (e.anim || 0) * 14, bob = Math.abs(Math.sin(ph)) * 1.6;
  const r = 9.5, cy = -r - 3 - bob;
  const K = INK;
  // stubby feet
  for (const s of [-1, 1]) {
    const fx = s * 4 + Math.sin(ph + (s > 0 ? 0 : Math.PI)) * 2.5;
    ctx.fillStyle = A.c3 || '#e9dcc0'; ctx.strokeStyle = K; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(fx, -2.2, 3.6, 2.4, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.save(); ctx.translate(0, cy);
  // hooks all round, bristling as it runs
  const n = 13, L = 6.5 + bob;
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + Math.sin(t * 6 + i) * 0.05; hook(ctx, Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75, a, L, 1.4, A.c2 || '#c9a25e', K, i % 2 ? 1 : -1); }
  ctx.fillStyle = K; ctx.beginPath(); ctx.arc(0, 0, r + 1.8, 0, TAU); ctx.fill();
  ctx.fillStyle = A.c1 || '#8a6634'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
  ctx.fillStyle = 'rgba(30,18,8,0.42)'; ctx.beginPath(); ctx.arc(-3, -3, r * 1.05, 0, TAU); ctx.arc(0, 0, r * 1.4, 0, TAU, true); ctx.fill();
  ctx.restore();
  // knitted bonnet tied under the chin
  ctx.fillStyle = A.c3 || '#e9dcc0'; ctx.strokeStyle = K; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(-1, -1, r + 1.5, Math.PI * 0.95, Math.PI * 1.75); ctx.quadraticCurveTo(-1, -3, -5, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (A.c3 !== '#ffffff') {
    ctx.strokeStyle = 'rgba(160,90,100,0.7)'; ctx.lineWidth = 1;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(-1, -1, r - 1 - k * 2.5, Math.PI * 1.05, Math.PI * 1.65); ctx.stroke(); }
    ctx.fillStyle = '#c96f7e'; ctx.beginPath(); ctx.arc(-6, 5, 1.8, 0, TAU); ctx.fill();
  }
  // big shiny eyes and a tiny pout
  for (const [ex, er] of [[2, 2.8], [7.2, 2.5]]) {
    ctx.fillStyle = K; ctx.beginPath(); ctx.arc(ex, -0.5, er, 0, TAU); ctx.fill();
    ctx.fillStyle = A.eye || '#fff4dc'; ctx.beginPath(); ctx.arc(ex - 0.8, -1.4, er * 0.45, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = K; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(5, 4.4, 1.4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  ctx.fillStyle = 'rgba(230,120,120,0.45)'; ctx.beginPath(); ctx.arc(8.5, 2.5, 1.6, 0, TAU); ctx.fill();
  ctx.restore();
});

registerMinion({
  id: 'mm_broodling', name: 'Burrling', hp: 8, dmg: 1, size: [28, 18],
  behavior: 'crawler', params: { speed: 72, noLedge: true },
  art: { body: 'burrling', c1: '#8a6634', c2: '#d2ae6a', c3: '#e9dcc0', eye: '#fff4dc' },
  journal: 'Grandmother Burr\'s littlest. They hatch prickly and warm, and stick to anything that rolls.', kills: 10,
});

// =================================================================== GRANDMOTHER BURR
// First real boss: Bead has only jump, Bonk, pogo and Mend. Huge telegraphs, everything jumpable.
export class MossMother extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'mossmother', size: [184, 124], music: 'boss', glints: 90, introTime: 2.4 });
    this.p = { squash: 0, rear: 0, withdraw: 0, puff: 0, birth: 0, charge: 0, jaw: 0, wake: 0 };
    this.pt = Object.assign({}, this.p);
    this.walkPh = 0; this.spinAng = 0; this.dazed = 0; this.queue = [];
    this.crack = 0; this.blink = 0; this.marks = [];
  }

  update(dt) { super.update(dt); this.animate(dt); }

  animate(dt) {
    const P = this.p, T = this.pt, k = 1 - Math.exp(-dt * 11);
    for (const key in T) P[key] += (T[key] - P[key]) * k;
    this.moving = Math.abs(this.vx) > 5 || this.dashing;
    if (this.moving) this.walkPh += dt * (this.dashing ? 22 : 12);
    if (this.spinning) this.spinAng += dt * (this.dashing ? 26 : 16);
    if (this.dazed > 0) this.dazed -= dt;
    for (const m of this.marks) m.t -= dt;
    this.marks = this.marks.filter((m) => m.t > 0);
    this.blink -= dt;
    if (this.blink < -3 - Math.random() * 3) this.blink = 0.14;
    const g = this.game;
    if (this.mode === 'dormant' || this.dead) return;
    // seed-down puffing from her bun
    if (P.puff > 0.4 && Math.random() < 0.5) {
      const [vx, vy] = this.toWorld(-12, -this.lift() - 98);
      g.fx.burst(vx, vy, 1, { color: '#f3ead2', speed: 90, angle: -Math.PI / 2, spread: 1.2, size: 4, life: 0.6, g: -60, glow: true });
    }
    // charging dust
    if (this.dashing && Math.random() < 0.7) {
      g.fx.burst(this.cx - this.facing * this.w * 0.4, this.groundY - 4, 1, { color: '#6b5a3e', speed: 160, angle: -Math.PI / 2 - this.facing * 0.9, spread: 0.8, size: 4, life: 0.5 });
    }
    // drifting seed-down
    if (Math.random() < 0.05) {
      g.fx.burst(this.cx + this.rand(-50, 50), this.y + 10, 1, { color: '#f3ead2', speed: 20, angle: -Math.PI / 2, spread: 1, size: 2, life: 1.4, g: -15, glow: true, front: false });
    }
  }

  lift() { return 20 - this.p.squash * 12; }
  toWorld(lx, ly) { return [this.cx + lx * MM_SCALE * this.facing, this.y + this.h + ly * MM_SCALE]; }

  idle() { this.pt.wake = 0; }
  onStart() { this.pt.wake = 1; this.pt.rear = 1; this.pt.jaw = 1; }
  introUpdate(dt, t) {
    if (t > 0.5 && t < 0.55) { this.sfx('screech'); this.shake(5, 0.8); }
    if (t > 0.5 && Math.random() < 0.3) this.fx.burst(this.cx + this.facing * 60, this.y + 30, 1, { color: '#f3ead2', speed: 140, size: 3, life: 0.6, glow: true });
    if (t > 1.7) { this.pt.rear = 0; this.pt.jaw = 0; }
  }

  chooseAttack() {
    if (this.queue.length) { const fn = this.queue.shift(); return fn.call(this); }
    return super.chooseAttack();
  }

  attackList() {
    const far = this.distX() > 380;
    const maxBrood = this.phase >= 2 ? 3 : 2;
    return [
      { name: 'walk', w: far ? 1.4 : 0.4, fn: this.walk },
      { name: 'slam', w: 3, fn: this.slam },
      { name: 'charge', w: 2.4, fn: this.charge },
      { name: 'spores', w: 1.8, fn: this.spores },
      { name: 'brood', w: 1.4, fn: this.brood, cond: () => this.minions.length < maxBrood },
      { name: 'spin', w: 2.6, fn: this.spin, cond: () => this.phase >= 3 },
    ];
  }

  // short repositioning shuffle toward Bead (not an attack, but she is heavy to touch)
  *walk() {
    this.facePlayer();
    const T = this.rand(0.5, 0.9);
    for (let t = 0; t < T && !this.hitWall; t += 1 / 60) { this.vx = this.facing * (95 + this.phase * 25); yield; }
    this.vx = 0;
    yield 0.2;
  }

  // BELLY-SLAM: squat, leap onto Bead, crash down (phase 2+: shockwaves; phase 3: twice)
  *slam() {
    const n = this.phase >= 3 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      this.facePlayer();
      this.pt.squash = 1; this.pt.jaw = 0.6;
      this.tele = i ? 0.4 : 0.6;
      this.sfx('charge');
      yield i ? 0.4 : 0.6;
      this.pt.squash = 0; this.pt.jaw = 0;
      this.sfx('leap');
      this.airborne = true;
      yield* this.leapTo(this.player.cx, 250, 0.95);
      this.airborne = false;
      this.p.squash = 1.1; this.pt.squash = 0;
      this.sfx('slam'); this.shake(9, 0.4);
      this.zone(this.x - 24, this.groundY - 26, this.w + 48, 26, 0.12);
      for (const s of [-1, 1]) this.fx.burst(this.cx + s * this.w * 0.45, this.groundY - 4, 10, { color: '#6b5a3e', speed: 260, angle: -Math.PI / 2 + s * 0.9, spread: 0.9, size: 4, life: 0.6 });
      this.fx.burst(this.cx, this.y + 20, 8, { color: '#8aa65a', speed: 180, size: 3, life: 0.8, g: 500 });
      if (this.phase >= 2) { this.shockwave(this.cx - this.w / 2, -1, 340, 28, { color: 'rgba(226,206,160,0.85)' }); this.shockwave(this.cx + this.w / 2, 1, 340, 28, { color: 'rgba(226,206,160,0.85)' }); }
      yield i < n - 1 ? 0.3 : 0.8 - this.phase * 0.08;
    }
  }

  // CHARGE: rear up and paw the ground, then barrel into the wall. Dazed on impact (an opening).
  *charge() {
    this.facePlayer();
    this.pt.rear = 1; this.pt.jaw = 1;
    this.tele = 0.7;
    this.sfx('screech');
    for (let i = 0; i < 3; i++) {
      this.fx.burst(this.cx - this.facing * 50, this.groundY - 4, 4, { color: '#6b5a3e', speed: 150, angle: -Math.PI / 2 - this.facing * 0.7, spread: 0.6, size: 3.5, life: 0.4 });
      yield 0.23;
    }
    this.pt.rear = 0; this.pt.charge = 1; this.pt.jaw = 0.3;
    this.sfx('charge');
    this.dashing = true;
    const r = yield* this.dashTo(this.facing, 470 + this.phase * 65);
    this.dashing = false; this.pt.charge = 0;
    if (r === 'wall') {
      this.shake(10, 0.45); this.sfx('slam');
      const wx = this.facing > 0 ? this.x + this.w : this.x;
      this.fx.burst(wx, this.cy, 14, { color: '#8aa65a', speed: 280, size: 3.5, life: 0.6 });
      this.dazed = 1.0;
      if (this.phase >= 2) {
        // the bump shakes old dried burrs loose from the ceiling (they fall from high up = readable)
        const xs = [this.player.cx, this.player.cx + this.rand(130, 200), this.player.cx - this.rand(130, 200)];
        if (this.phase >= 3) xs.push(this.player.cx + this.rand(-420, 420));
        for (const x of xs) {
          const px = clamp(x, this.arena.x + 20, this.arena.x + this.arena.w - 20);
          this.fx.burst(px, this.arena.y + 4, 6, { color: '#6b5a3e', speed: 90, angle: Math.PI / 2, spread: 1, size: 3, life: 0.6 });
          this.fire(px, this.arena.y + 12, 0, 40, { gravity: 820, art: 'mm_pebble', r: 10, life: 3, color: '#5a4326' });
          this.marks.push({ x: px, t: 1.1, max: 1.1 });
        }
      }
      this.facing = -this.facing;
      yield 1.0;
    } else {
      this.facing = -this.facing;
      yield 0.6;
    }
  }

  // SEED PUFFS: her down bun swells, then floaty burr seeds arc up and drift down. Bonk them back!
  *spores() {
    this.facePlayer();
    this.pt.puff = 1;
    this.tele = 0.55;
    this.sfx('rustle');
    yield 0.55;
    const n = 3 + this.phase;
    const [vx, vy] = this.toWorld(-12, -this.lift() - 98);
    this.sfx('burst');
    this.fx.burst(vx, vy, 14, { color: '#f3ead2', speed: 160, angle: -Math.PI / 2, spread: 1.6, size: 5, life: 0.8, g: -40, glow: true });
    const dir = this.dirTo();
    for (let i = 0; i < n; i++) {
      const spread = (i / (n - 1) - 0.5) * 2;
      const burst = this.phase >= 3;
      this.fire(vx, vy, dir * 90 + spread * 230 + this.rand(-30, 30), this.rand(-470, -390), {
        gravity: 260, art: 'mm_spore', r: 11, life: 6, color: '#f3ead2', parry: true,
        onDie: burst ? (p) => { if (p.cy > this.groundY - 40 && this.mode === 'fight') this.fireRing(p.cx, p.cy - 6, 5, 150, { art: 'mm_spore', r: 6, life: 0.9, a0: Math.PI, color: '#f3ead2' }); } : null,
      });
    }
    yield 0.45;
    this.pt.puff = 0;
    yield 0.7;
  }

  // BROOD: the shawl lifts and Burrlings tumble out
  *brood() {
    this.facePlayer();
    this.pt.birth = 1;
    this.tele = 0.6;
    this.sfx('rustle');
    yield 0.65;
    const cap = this.phase >= 2 ? 3 : 2;
    const n = Math.min(this.phase >= 3 ? 2 : this.phase >= 2 ? 2 : 1, cap - this.minions.length);
    for (let i = 0; i < n; i++) {
      const e = this.summon('mm_broodling', tileOf(this.cx), tileOf(this.groundY - 1));
      if (e) {
        const [px, py] = this.toWorld(-30 + i * 22, -this.lift() - 70);
        e.x = clamp(px - e.w / 2, this.arena.x + 4, this.arena.x + this.arena.w - e.w - 4); e.y = py;
        e.vy = -480; e.facing = i % 2 ? this.facing : -this.facing;
      }
      this.sfx('spit');
      this.fx.burst(this.cx - this.facing * 20, this.y + 10, 8, { color: '#ece4cf', speed: 160, size: 3, life: 0.5 });
      yield 0.3;
    }
    this.pt.birth = 0;
    yield 0.8;
  }

  // BURR-ROLL (phase 3): tucks into a bristling ball and ricochets across the hollow, wall to wall
  *spin() {
    this.facePlayer();
    this.pt.withdraw = 1;
    this.tele = 0.75;
    this.sfx('charge');
    yield 0.4;
    this.spinning = true;
    yield 0.4;
    const passes = 3;
    for (let i = 0; i < passes; i++) {
      this.facing = this.dirTo();
      if (i) { this.tele = 0.4; this.sfx('charge'); yield 0.4; }
      this.dashing = true;
      const r = yield* this.dashTo(this.facing, 560 + (this.echo ? 40 : 0));
      this.dashing = false;
      if (r === 'wall') {
        this.shake(7, 0.3); this.sfx('slam');
        for (let k = 0; k < 3; k++) this.fire(this.cx, this.y + 20, -this.facing * this.rand(120, 340), -this.rand(420, 620), { gravity: 1100, art: 'mm_pebble', r: 8, life: 3 });
      }
    }
    this.spinning = false;
    this.pt.withdraw = 0;
    this.dazed = 1.2;
    yield 1.2;
  }

  onPhase(n) {
    this.sfx('bossRoar');
    this.shake(7, 0.7);
    this.tele = 0.9;
    this.crack = n - 1;
    this.speedMul *= 1.08;
    this.fx.burst(this.cx, this.y + 30, 24, { color: '#8aa65a', speed: 300, size: 4, life: 0.9 });
    this.fx.ring(this.cx, this.cy, 20, 200, 0.6, 'rgba(240,228,196,0.8)', 5);
    if (n === 3) this.queue.push(this.brood, this.spin);
  }

  onDeath() { this.pt.withdraw = 0; this.pt.rear = 1; this.pt.jaw = 1; this.spinning = false; }

  bodyBox() {
    if (this.spinning) return { x: this.x + 32, y: this.y + this.h - 110, w: this.w - 64, h: 110 };
    return { x: this.x + 14, y: this.y + 18, w: this.w - 28, h: this.h - 18 };
  }

  drawExtra(ctx, t) {
    // growing shadows where loosened burrs will land
    for (const m of this.marks) {
      const k = 1 - m.t / m.max;
      ctx.fillStyle = `rgba(0,0,0,${0.2 + 0.35 * k})`;
      ctx.beginPath(); ctx.ellipse(m.x, this.groundY - 2, 6 + 12 * k, 3 + 2 * k, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(240,228,196,${0.5 * k})`; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // dazed stars
    if (this.dazed > 0 && this.mode === 'fight') {
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + i * TAU / 3;
        const x = this.cx + this.facing * 40 + Math.cos(a) * 26, y = this.y - 8 + Math.sin(a) * 7;
        glowDot(ctx, x, y, 10, '#f3ead2', 0.5);
        ctx.fillStyle = '#fff6dc'; ctx.beginPath();
        for (let k = 0; k < 8; k++) { const r = k % 2 ? 1.6 : 4.5, b = k / 8 * TAU + t * 3; ctx.lineTo(x + Math.cos(b) * r, y + Math.sin(b) * r); }
        ctx.fill();
      }
    }
  }

  drawBody(ctx, t, white) {
    const C = (c) => (white ? '#fff' : c);
    const K = white ? '#fff' : INK;
    const P = this.p, f = this.facing, S = MM_SCALE;
    const cx = this.cx, by = this.y + this.h;
    // ground shadow (shrinks when she is airborne)
    if (!white) {
      const air = Math.max(0, this.groundY - by);
      const k = 1 / (1 + air / 200);
      ctx.fillStyle = `rgba(0,0,0,${0.4 * k})`;
      ctx.beginPath(); ctx.ellipse(cx, this.groundY - 2, 92 * k, 12 * k, 0, 0, TAU); ctx.fill();
    }
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(f * S, S);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (this.spinning) { this.drawBall(ctx, t, C, K, white); ctx.restore(); return; }

    const lift = this.lift();
    const breath = Math.sin(t * 2.2) * 0.025;
    // pivot around the rear when rearing / ducking into a charge
    const tilt = -P.rear * 0.2 + P.charge * 0.07;
    ctx.translate(-50, 0); ctx.rotate(tilt); ctx.translate(50, 0);
    const R = 54;
    // her hooks stand on end when she winds up, charges or curls
    const bristle = clamp(Math.max(P.charge, P.rear * 0.7, P.squash * 0.5, P.withdraw, P.puff * 0.35), 0, 1);

    // ---- stubby legs in knitted stockings (far pair first)
    const air = this.airborne;
    const legRow = (far) => {
      for (const [i, lx] of far ? [[0, -32], [2, 12]] : [[1, -12], [3, 32]]) {
        const ph = this.walkPh * 0.85 + (i % 2) * Math.PI;
        const step = this.moving ? Math.sin(ph) * 7 : 0;
        const up = this.moving ? Math.max(0, Math.cos(ph)) * 5 : 0;
        const top = -lift - 6;
        const foot = air ? [lx - 5, -lift * 0.3] : [lx + step, -up - 3];
        limb(ctx, [[lx, top], [lx + step * 0.4, (top + foot[1]) / 2], foot], 11, C(far ? '#9c8a74' : '#e3d5b8'), K);
        if (!white) {
          ctx.strokeStyle = far ? '#6e3d46' : '#a8566a'; ctx.lineWidth = 3;
          for (const k of [0.35, 0.65]) { const y = top + (foot[1] - top) * k, x = lx + (foot[0] - lx) * k; ctx.beginPath(); ctx.moveTo(x - 4.5, y); ctx.lineTo(x + 4.5, y); ctx.stroke(); }
        }
        // little round boot
        ctx.fillStyle = C(far ? '#2e2018' : '#4a3122'); ctx.strokeStyle = K; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(foot[0] + 3, foot[1] + 0.5, 8, 5, 0, 0, TAU); ctx.fill(); ctx.stroke();
        if (!white && !far) { ctx.fillStyle = 'rgba(255,230,190,0.35)'; ctx.beginPath(); ctx.ellipse(foot[0] + 1, foot[1] - 2, 3.5, 1.4, 0, 0, TAU); ctx.fill(); }
      }
    };
    legRow(true);

    // ---- the burr herself: a ball of hooked spines, squashing from the base
    ctx.save();
    ctx.translate(0, -lift - 2);
    ctx.scale(1 + P.squash * 0.1 + P.birth * 0.03, 1 - P.squash * 0.13 + breath + P.birth * 0.05);
    ctx.translate(0, -R);
    this.drawBurr(ctx, t, C, K, white, R, bristle, 0);
    this.drawShawl(ctx, t, C, K, white, R);
    // fluffy white bun of seed-down on her crown, a crochet hook stuck through it
    {
      const o = 1 + P.puff * 0.55, bx = -10, byy = -R - 2;
      if (!white && P.puff > 0.1) glowDot(ctx, bx, byy - 6, 34 * P.puff, '#fff3d8', 0.5);
      ctx.strokeStyle = K; ctx.lineWidth = 5.5;
      ctx.beginPath(); ctx.moveTo(bx - 22, byy - 14); ctx.lineTo(bx + 18, byy + 6); ctx.stroke();
      ctx.strokeStyle = C('#c9a25e'); ctx.lineWidth = 3; ctx.stroke();
      for (let i = 0; i < 15; i++) {
        const a = -Math.PI / 2 + (i / 14 - 0.5) * 3, L = (17 + (i * 5) % 7) * o;
        ctx.strokeStyle = C('rgba(250,244,226,0.9)'); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(bx, byy); ctx.quadraticCurveTo(bx + Math.cos(a) * L * 0.6 + Math.sin(t * 2 + i) * 1.5, byy + Math.sin(a) * L * 0.5, bx + Math.cos(a) * L, byy - 4 + Math.sin(a) * L);
        ctx.stroke();
        const ex = bx + Math.cos(a) * L, ey = byy - 4 + Math.sin(a) * L;
        ctx.beginPath(); for (const d of [-0.7, 0, 0.7]) { ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a + d) * 4, ey + Math.sin(a + d) * 4); } ctx.stroke();
      }
      ctx.fillStyle = C('#efe6d0'); ctx.strokeStyle = K; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) { const a = (i / 14) * TAU, rr = (11 + (i % 2) * 1.6) * o; i ? ctx.lineTo(bx + Math.cos(a) * rr, byy - 4 + Math.sin(a) * rr * 0.85) : ctx.moveTo(bx + Math.cos(a) * rr, byy - 4 + Math.sin(a) * rr * 0.85); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if (!white) {
        ctx.fillStyle = 'rgba(150,130,100,0.35)'; ctx.beginPath(); ctx.ellipse(bx + 2, byy, 9 * o, 4 * o, 0, 0, Math.PI); ctx.fill();
        ctx.strokeStyle = 'rgba(160,140,110,0.6)'; ctx.lineWidth = 1;
        for (const k of [-0.5, 0.4, 1.4]) { ctx.beginPath(); ctx.arc(bx, byy - 4, 6 * o, k, k + 1.4); ctx.stroke(); }
      }
      // the hook's head pokes out in front of the bun
      ctx.strokeStyle = K; ctx.lineWidth = 5.5; ctx.beginPath(); ctx.moveTo(bx + 4, byy - 2); ctx.lineTo(bx + 18, byy + 6); ctx.stroke();
      ctx.strokeStyle = C('#c9a25e'); ctx.lineWidth = 3; ctx.stroke();
      hook(ctx, bx + 18, byy + 6, 0.5, 5, 2.6, C('#c9a25e'), K, -1);
    }
    this.drawFace(ctx, t, C, K, white, R);
    ctx.restore();

    legRow(false);
    ctx.restore();
  }

  // the ball of burr: hooked spines behind, a wobbly brown body, moss tufts. Origin at its centre.
  drawBurr(ctx, t, C, K, white, R, bristle, rot) {
    // two layers of hooks: a dark, longer back row and a lighter front row, shorter underneath
    for (const back of [true, false]) {
      const n = back ? 30 : 36;
      for (let i = 0; i < n; i++) {
        const a = ((i + (back ? 0.5 : 0)) / n) * TAU + Math.sin(t * 3 + i * 1.7) * 0.02 + rot;
        const under = Math.max(0, Math.sin(a - rot)) * (rot ? 0 : 0.45);
        const len = (back ? 17 : 11) + ((i * 7) % 5) * 1.4;
        hook(ctx, Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8, a + (i % 2 ? 0.1 : -0.1), (R * 0.2 + len * (1 + bristle * 0.6)) * (1 - under), back ? 2.6 : 2.2,
          C(back ? '#4e3a20' : i % 3 ? '#8a6a3a' : '#a8844c'), K, (i % 2 ? 1 : -1) * (1 - bristle * 0.5));
      }
    }
    const ball = () => {
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * TAU;
        const rr = R * (1 + 0.035 * Math.sin(i * 3.7) + 0.025 * Math.sin(i * 1.3));
        i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
    };
    ball(); ctx.fillStyle = C('#6e5530'); ctx.fill();
    if (!white) {
      ctx.save(); ball(); ctx.clip();
      // olive mottling, then a carpet of little hooks
      ctx.fillStyle = 'rgba(122,112,56,0.5)';
      for (const [x, y, r] of [[-20, -18, 20], [18, 22, 16], [-28, 24, 13], [26, -30, 12]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
      for (let i = 0; i < 34; i++) {
        const rr = R * 0.95 * Math.sqrt((i + 0.5) / 34), a = i * 2.39996 + rot;
        hook(ctx, Math.cos(a) * rr, Math.sin(a) * rr, a + 1.1, 7, 1.6, i % 2 ? '#a8864c' : '#8c6c3c', 'rgba(26,18,10,0.55)', i % 2 ? 1 : -1);
      }
      // painted shadow crescent + light hatching on the dark side
      ctx.fillStyle = 'rgba(20,12,6,0.45)';
      ctx.beginPath(); ctx.arc(0, 0, R * 1.1, -0.35, Math.PI * 0.95); ctx.arc(-R * 0.25, -R * 0.3, R * 1.12, Math.PI * 0.88, -0.3, true); ctx.fill();
      ctx.strokeStyle = 'rgba(20,12,6,0.35)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 9; i++) { const a = 0.1 + i * 0.3, x = Math.cos(a) * R * 0.86, y = Math.sin(a) * R * 0.86; ctx.beginPath(); ctx.moveTo(x - 4, y + 4); ctx.lineTo(x + 3, y - 5); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(232,206,150,0.55)'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.8, -2.65, -1.75); ctx.stroke();
      ctx.restore();
    }
    // brushy ink outline: pressure heavier on the shadow side, with stray barbs
    ctx.strokeStyle = K;
    for (let i = 0; i < 28; i++) {
      const a0 = (i / 28) * TAU, a1 = a0 + (TAU / 28) * 1.2;
      ctx.lineWidth = 3 + 2.2 * Math.max(0, Math.sin(a0 + 0.6));
      const rr = R * (1 + 0.035 * Math.sin(i * 3.7 * 24 / 28));
      ctx.beginPath(); ctx.arc(0, 0, rr, a0, a1); ctx.stroke();
    }
    // moss tufts
    for (const [a, s] of [[0.15, 0.7], [1.75, 0.9], [2.45, 0.75]]) {
      const ax = Math.cos(a + rot) * R * 0.9, ay = Math.sin(a + rot) * R * 0.9;
      const blobs = [[0, 0, 8], [-7, 3, 6], [7, 2, 6.5], [1, -5, 5.5]];
      ctx.fillStyle = K; for (const [x, y, r] of blobs) { ctx.beginPath(); ctx.arc(ax + x * s, ay + y * s, (r + 2.2) * s, 0, TAU); ctx.fill(); }
      blobs.forEach(([x, y, r], k) => { ctx.fillStyle = C(k % 2 ? '#5f8a4a' : '#6f9a52'); ctx.beginPath(); ctx.arc(ax + x * s, ay + y * s, r * s, 0, TAU); ctx.fill(); });
      if (!white) {
        ctx.fillStyle = '#a8c870';
        for (const [x, y] of [[-2, -3], [-8, 1], [5, -1]]) { ctx.beginPath(); ctx.arc(ax + x * s, ay + y * s, 1.6 * s, 0, TAU); ctx.fill(); }
        ctx.fillStyle = 'rgba(20,30,12,0.4)'; ctx.beginPath(); ctx.arc(ax + 2 * s, ay + 3 * s, 6 * s, 0.1, Math.PI - 0.1); ctx.fill();
      }
    }
  }

  // a knitted plum shawl with a doily edge, draped over her back, tasselled at the point
  drawShawl(ctx, t, C, K, white, R) {
    const P = this.p;
    const aF = -0.98, aB = 2.72;
    const Fx = Math.cos(aF) * (R + 3), Fy = Math.sin(aF) * (R + 3);
    const lift = P.birth * 14;
    const Tx = -R * 1.04 - lift * 0.4, Ty = R * 0.78 - lift;
    const c2 = [-R * 0.2, R * 0.45 - lift * 0.5], c1 = [R * 0.18, -R * 0.2];
    const shawl = () => {
      ctx.beginPath(); ctx.moveTo(Fx, Fy);
      ctx.arc(0, 0, R + 3, aF, aB, true);
      ctx.lineTo(Tx, Ty);
      ctx.bezierCurveTo(c2[0], c2[1], c1[0], c1[1], Fx, Fy);
      ctx.closePath();
    };
    // doily scallops along the hem (drawn first, so only their lace edge shows past the hem)
    const hem = [];
    for (let i = 0; i <= 12; i++) {
      const k = i / 12, u = 1 - k;
      const x = u * u * u * Tx + 3 * u * u * k * c2[0] + 3 * u * k * k * c1[0] + k * k * k * Fx;
      const y = u * u * u * Ty + 3 * u * u * k * c2[1] + 3 * u * k * k * c1[1] + k * k * k * Fy;
      hem.push([x, y]);
    }
    ctx.fillStyle = K; for (const [x, y] of hem) { ctx.beginPath(); ctx.arc(x, y, 6.6, 0, TAU); ctx.fill(); }
    ctx.fillStyle = C('#ece0c4'); for (const [x, y] of hem) { ctx.beginPath(); ctx.arc(x, y, 4.6, 0, TAU); ctx.fill(); }
    shawl(); ctx.fillStyle = C('#9a4f5c'); ctx.fill();
    if (!white) {
      ctx.save(); shawl(); ctx.clip();
      // knit rows of little V stitches
      ctx.strokeStyle = 'rgba(70,24,36,0.55)'; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let row = 0, y = -R - 8; y < R + 8; y += 6, row++) {
        for (let x = -R - 12 + (row % 2) * 3; x < R + 8; x += 6) { ctx.moveTo(x - 2.2, y - 2); ctx.lineTo(x, y + 1.2); ctx.lineTo(x + 2.2, y - 2); }
      }
      ctx.stroke();
      // a darker cable stripe and a painted shadow toward the hem
      ctx.strokeStyle = 'rgba(214,160,150,0.55)'; ctx.lineWidth = 3; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.arc(0, 0, R * 0.78, -1.15, 2.6, true); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(40,10,22,0.38)';
      ctx.beginPath(); ctx.moveTo(Tx, Ty); ctx.bezierCurveTo(c2[0], c2[1], c1[0], c1[1], Fx, Fy); ctx.lineTo(Fx - 16, Fy - 4); ctx.bezierCurveTo(c1[0] - 18, c1[1] - 16, c2[0] - 16, c2[1] - 16, Tx - 6, Ty - 18); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,214,214,0.3)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, R - 1, -2.7, -1.6); ctx.stroke();
      ctx.restore();
      // lace holes in the doily edge
      ctx.fillStyle = '#5a3a3a';
      for (let i = 0; i < hem.length; i++) {
        const [x, y] = hem[i], [x2, y2] = hem[Math.min(hem.length - 1, i + 1)], [x1, y1] = hem[Math.max(0, i - 1)];
        let nx = -(y2 - y1), ny = x2 - x1; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
        if (nx + ny < 0) { nx = -nx; ny = -ny; }
        ctx.beginPath(); ctx.arc(x + nx * 2.6, y + ny * 2.6, 1.3, 0, TAU); ctx.fill();
      }
    }
    shawl(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
    // little burr babies riding under the hem (they wriggle before tumbling out)
    for (const [bx, byy, s] of [[-R * 0.5, R * 0.62, 1], [-R * 0.16, R * 0.5, 0.85]]) {
      const pop = P.birth * 9 * s, wig = Math.sin(t * (4 + P.birth * 14) + bx) * (0.6 + P.birth * 2);
      ctx.save(); ctx.translate(bx + wig, byy - pop); ctx.scale(s * (0.75 + P.birth * 0.25), s * (0.75 + P.birth * 0.25));
      for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; hook(ctx, Math.cos(a) * 6, Math.sin(a) * 6, a, 5, 1.4, C('#c9a25e'), K, i % 2 ? 1 : -1); }
      ctx.fillStyle = C('#8a6634'); ctx.strokeStyle = K; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); ctx.stroke();
      if (!white) { ctx.fillStyle = INK; for (const ex of [1.5, 5]) { ctx.beginPath(); ctx.arc(ex, -1, 1.5, 0, TAU); ctx.fill(); } ctx.fillStyle = '#fff4dc'; for (const ex of [1, 4.5]) { ctx.beginPath(); ctx.arc(ex, -1.6, 0.6, 0, TAU); ctx.fill(); } }
      ctx.restore();
    }
    // tassel at the point
    const sw = Math.sin(t * 2.6) * 4 + (this.moving ? -6 : 0) + P.charge * -6;
    ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(Tx, Ty); ctx.quadraticCurveTo(Tx + sw * 0.3, Ty + 6, Tx + sw * 0.6, Ty + 10); ctx.stroke();
    const tx = Tx + sw * 0.6, ty = Ty + 10;
    ctx.fillStyle = C('#ece0c4'); ctx.strokeStyle = K; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(tx, ty, 4, 0, TAU); ctx.fill(); ctx.stroke();
    for (let k = -2; k <= 2; k++) {
      ctx.strokeStyle = K; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(tx + k * 1.6, ty + 3); ctx.lineTo(tx + k * 2.6 + sw * 0.3, ty + 15); ctx.stroke();
      ctx.strokeStyle = C(k % 2 ? '#c96f7e' : '#ece0c4'); ctx.lineWidth = 1.6; ctx.stroke();
    }
  }

  // round spectacles, bushy brows over sleepy lids: kind, but she will not be hurried
  drawFace(ctx, t, C, K, white, R) {
    const P = this.p;
    const fx = R * 0.5, fy = R * 0.06 - P.charge * 4;
    const shut = this.mode === 'dormant' || this.blink > 0 || P.withdraw > 0.3;
    const cross = clamp(this.crack + P.rear * 1.5 + P.charge * 1.5 + (this.tele > 0 ? 0.6 : 0), 0, 3);
    // soft fawn muzzle
    ctx.fillStyle = C('#a8865a');
    ctx.beginPath(); ctx.ellipse(fx, fy + 6, 24, 21, 0, 0, TAU); ctx.fill();
    if (!white) {
      ctx.fillStyle = 'rgba(40,24,10,0.3)'; ctx.beginPath(); ctx.ellipse(fx + 3, fy + 15, 18, 9, 0, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = 'rgba(22,16,10,0.6)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(fx, fy + 6, 24, 21, 0, 0.3, 2.6); ctx.stroke();
      // rosy cheeks
      ctx.fillStyle = 'rgba(214,104,104,0.4)';
      for (const x of [fx - 15, fx + 16]) { ctx.beginPath(); ctx.ellipse(x, fy + 9, 5.5, 3.5, 0, 0, TAU); ctx.fill(); }
    }
    const slip = this.crack >= 2 ? 3 : 0;
    const eyes = [[fx - 10, fy - 2, 8.5], [fx + 10, fy - 2, 7.6]];
    for (const [ex, ey, lr] of eyes) {
      // eye: a beady dark bead under a heavy, sleepy lid
      if (!white) {
        if (shut) {
          ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(ex, ey - 1, 4, 0.3, Math.PI - 0.3); ctx.stroke();
        } else {
          ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(ex, ey, 3.8, 4.4, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = this.tele > 0 ? '#ffd88a' : '#fff4dc'; ctx.beginPath(); ctx.arc(ex - 1.2, ey - 1.6, 1.3, 0, TAU); ctx.fill();
          ctx.fillStyle = '#7a5c34'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.ellipse(ex, ey, 4.6, 5, 0, Math.PI * 1.04, Math.PI * 1.96); ctx.lineTo(ex + 4.6, ey - 1.2 + cross * 0.4); ctx.lineTo(ex - 4.6, ey - 1.2 + cross * 0.4); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(ex - 4.8, ey - 1 + cross * 0.4); ctx.lineTo(ex + 4.8, ey - 1 + cross * 0.4); ctx.stroke();
        }
      }
      // spectacles: gold wire rims, a sliver of glass glint
      const sx = ex, sy = ey + slip;
      ctx.strokeStyle = K; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(sx, sy, lr, 0, TAU); ctx.stroke();
      ctx.strokeStyle = C('#d9b25c'); ctx.lineWidth = 2; ctx.stroke();
      if (!white) {
        ctx.fillStyle = 'rgba(210,232,240,0.18)'; ctx.beginPath(); ctx.arc(sx, sy, lr - 1, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(sx, sy, lr - 2.6, -2.5, -1.7); ctx.stroke();
      }
    }
    // bridge + temple arm hooked back into her spines
    ctx.strokeStyle = K; ctx.lineWidth = 3.6;
    ctx.beginPath(); ctx.moveTo(fx - 2, fy - 3 + slip); ctx.quadraticCurveTo(fx, fy - 6 + slip, fx + 2.4, fy - 3 + slip); ctx.moveTo(fx - 18.5, fy - 4 + slip); ctx.lineTo(fx - 32, fy - 9); ctx.stroke();
    ctx.strokeStyle = C('#d9b25c'); ctx.lineWidth = 1.6; ctx.stroke();
    if (!white && this.crack >= 1) {
      const [ex, ey, lr] = eyes[1];
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ex - lr * 0.7, ey + slip - lr * 0.5); ctx.lineTo(ex, ey + slip + 1); ctx.lineTo(ex + lr * 0.4, ey + slip + lr * 0.8); ctx.moveTo(ex, ey + slip + 1); ctx.lineTo(ex + lr * 0.8, ey + slip - 1); ctx.stroke();
    }
    // bushy white brows that knit together when she is cross
    for (const [s, ex] of [[-1, eyes[0][0]], [1, eyes[1][0]]]) {
      const inner = -s, y0 = fy - 13;
      const yi = y0 + cross * 1.6, yo = y0 - 1.5 - cross * 0.8;
      const x0 = ex + inner * 7, x1 = ex - inner * 8;
      ctx.strokeStyle = K; ctx.lineWidth = 6.5; ctx.beginPath(); ctx.moveTo(x0, yi); ctx.quadraticCurveTo(ex, y0 - 4, x1, yo); ctx.stroke();
      ctx.strokeStyle = C('#efe6d0'); ctx.lineWidth = 3.6; ctx.stroke();
      if (!white) { ctx.strokeStyle = '#efe6d0'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x1, yo); ctx.lineTo(x1 - inner * 4, yo - 3); ctx.moveTo(ex - inner * 3, y0 - 2); ctx.lineTo(ex - inner * 4, y0 - 6); ctx.stroke(); }
    }
    // a seed-knob nose
    ctx.fillStyle = C('#7a5530'); ctx.strokeStyle = K; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(fx + 1, fy + 6, 4.6, 3.8, 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (!white) { ctx.fillStyle = 'rgba(255,230,190,0.55)'; ctx.beginPath(); ctx.arc(fx - 0.5, fy + 4.6, 1.4, 0, TAU); ctx.fill(); }
    // mouth: a pursed little frown, or an indignant 'O' with one brave tooth
    const jaw = P.jaw;
    if (jaw > 0.15) {
      ctx.fillStyle = C('#2a1410'); ctx.strokeStyle = K; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(fx + 1, fy + 15 + jaw * 2, 4 + jaw * 2, 2 + jaw * 5, 0, 0, TAU); ctx.fill(); ctx.stroke();
      if (!white) { ctx.fillStyle = '#f4ead2'; ctx.fillRect(fx - 1, fy + 13 + jaw * 2 - jaw * 4, 3, 3.2); }
    } else if (!white) {
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(fx - 5, fy + 17); ctx.quadraticCurveTo(fx + 1, fy + 13, fx + 7, fy + 17); ctx.stroke();
    }
  }

  // tucked up and rolling: shawl wrapped tight, every hook bristling
  drawBall(ctx, t, C, K, white) {
    const R = 50;
    ctx.save(); ctx.translate(0, -R - 2);
    this.drawBurr(ctx, t, C, K, white, R, 1, this.spinAng);
    ctx.rotate(this.spinAng);
    this.drawShawl(ctx, t, C, K, white, R);
    ctx.restore();
    // motion streaks
    if (!white && this.dashing) {
      ctx.strokeStyle = 'rgba(240,228,196,0.5)'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, -R - 2, R + 22 + i * 6, Math.PI * 0.6 + i * 0.1, Math.PI * 1.15 + i * 0.1); ctx.stroke(); }
    }
  }
}

// =================================================================== BRASS BEETLE
// Optional. A beetle whose shell is an old bronze bell. Bead has Sticky Sap + Pebble Dash.
export class BrassBeetle extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'brassbeetle', size: [150, 128], music: 'boss', glints: 140, introTime: 2.2 });
    this.p = { curl: 0, rear: 0, glow: 0, lunge: 0, crouch: 0, wake: 0 };
    this.pt = Object.assign({}, this.p);
    this.rollAng = 0; this.walkPh = 0; this.clap = 0; this.clapV = 0;
    this.marks = []; this.queue = []; this.crack = 0;
  }

  update(dt) { super.update(dt); this.animate(dt); }

  animate(dt) {
    const P = this.p, T = this.pt, k = 1 - Math.exp(-dt * 12);
    for (const key in T) P[key] += (T[key] - P[key]) * k;
    this.moving = Math.abs(this.vx) > 5 || this.dashing;
    if (this.moving) this.walkPh += dt * 16;
    if (this.rolling) this.rollAng += dt * (this.dashing ? 18 : 10) * this.facing;
    // clapper pendulum
    this.clapV += (-this.clap * 40 - this.clapV * 3) * dt;
    this.clap += this.clapV * dt;
    for (const m of this.marks) m.t -= dt;
    this.marks = this.marks.filter((m) => m.t > -0.3);
    if (this.mode === 'dormant' || this.dead) return;
    if (this.dashing && this.grounded !== false && Math.random() < 0.8) {
      this.fx.burst(this.cx - this.facing * 30, this.groundY - 3, 1, { color: '#ffd27a', speed: 220, angle: -Math.PI / 2 - this.facing * 1.1, spread: 0.7, size: 2, life: 0.35, glow: true });
    }
    if (P.glow > 0.3 && Math.random() < 0.4) this.fx.burst(this.cx + this.rand(-40, 40), this.y + this.rand(10, 60), 1, { color: '#ffd27a', speed: 40, size: 2, life: 0.5, g: -40, glow: true });
  }

  toWorld(lx, ly) { return [this.cx + lx * BB_SCALE * this.facing, this.y + this.h + ly * BB_SCALE]; }
  ring(force = 1) { this.clapV += 9 * force * (Math.random() < 0.5 ? -1 : 1); }

  onStart() { this.pt.wake = 1; }
  introUpdate(dt, t) {
    if (t > 0.3 && t < 0.35) { this.pt.rear = 0.7; this.pt.glow = 1; }
    if (t > 0.9 && t < 0.95) { this.sfx('bell'); this.ring(1.5); this.fx.ring(this.cx, this.cy, 30, 260, 0.8, 'rgba(255,210,122,0.8)', 6); this.shake(5, 0.5); }
    if (t > 1.6) { this.pt.rear = 0; this.pt.glow = 0; }
  }

  chooseAttack() {
    if (this.queue.length) return this.queue.shift().call(this);
    return super.chooseAttack();
  }

  attackList() {
    const near = this.distX() < 200;
    return [
      { name: 'roll', w: 3, fn: this.roll },
      { name: 'toll', w: 2.2, fn: this.toll },
      { name: 'hop', w: 2, fn: this.hop },
      { name: 'horn', w: near ? 3 : 0.3, fn: this.horn },
      { name: 'chimes', w: 2, fn: this.chimes, cond: () => this.phase >= 2 },
      { name: 'skitter', w: this.distX() > 420 ? 1 : 0.2, fn: this.skitter },
    ];
  }

  *skitter() {
    this.facePlayer();
    for (let t = 0; t < 0.6 && !this.hitWall; t += 1 / 60) { this.vx = this.facing * 170; yield; }
    this.vx = 0; yield 0.2;
  }

  // ROLL & RICOCHET: curls into a spinning bell-ball and caroms wall to wall, clanging on each hit
  *roll() {
    this.facePlayer();
    this.pt.curl = 1; this.rolling = true;
    this.tele = 0.65;
    this.sfx('charge');
    yield 0.65;
    const bounces = this.phase;
    let dir = this.facing;
    for (let i = 0; i <= bounces; i++) {
      this.facing = dir;
      this.dashing = true;
      const r = yield* this.dashTo(dir, 640 + this.phase * 50);
      this.dashing = false;
      if (r !== 'wall') break;
      const wx = dir > 0 ? this.x + this.w : this.x;
      this.sfx('bell'); this.ring(1); this.shake(6, 0.25);
      this.fx.ring(wx, this.cy, 10, 120, 0.4, 'rgba(255,210,122,0.9)', 4);
      this.fx.burst(wx, this.cy, 10, { color: '#ffd27a', speed: 260, size: 2.5, life: 0.4, glow: true });
      if (this.phase >= 2) {
        // a fan of notes thrown back out of the wall
        for (let k = 0; k < 4; k++) {
          const a = (dir > 0 ? Math.PI + 0.35 : -0.35) + (k / 3 - 0.5) * 1.2;
          this.fire(wx - dir * 10, this.cy - 10, Math.cos(a) * 240, Math.sin(a) * 240 - 80, { art: 'bb_note', r: 8, life: 3, color: '#ffd27a' });
        }
      }
      dir = -dir;
      const last = i === bounces;
      if (last && this.phase >= 2) {
        // final ricochet: high bounce off the wall onto Bead
        this.facing = dir;
        this.tele = 0.4; yield 0.4;
        this.sfx('leap');
        yield* this.leapTo(this.player.cx, 280, 0.9);
        this.landClang(true);
        break;
      }
      yield 0.08;
    }
    this.pt.curl = 0; this.rolling = false;
    this.facePlayer();
    yield 0.85;
  }

  landClang(big) {
    this.sfx('bell'); this.sfx('slam'); this.ring(1.4); this.shake(8, 0.35);
    this.fx.ring(this.cx, this.groundY - 20, 20, 200, 0.5, 'rgba(255,210,122,0.85)', 5);
    this.fx.burst(this.cx, this.groundY - 4, 14, { color: '#8a6a3a', speed: 260, angle: -Math.PI / 2, spread: 2.4, size: 3.5, life: 0.5 });
    this.zone(this.x - 16, this.groundY - 24, this.w + 32, 24, 0.12);
    if (big || this.phase >= 2) for (const s of [-1, 1]) this.shockwave(this.cx + s * this.w * 0.4, s, 400, 30, { color: 'rgba(255,214,140,0.9)' });
  }

  // TOLL: rears back and rings. Rings of brass notes radiate out (gaps to slip through).
  *toll() {
    this.facePlayer();
    this.pt.rear = 1; this.pt.glow = 1;
    this.tele = 0.7;
    this.clapV -= 6;
    this.sfx('charge');
    yield 0.7;
    const n = 9 + this.phase * 2;
    const waves = this.phase >= 2 ? 2 : 1;
    for (let w = 0; w < waves; w++) {
      const [mx, my] = this.toWorld(26, -60);
      this.sfx('bell'); this.ring(2); this.shake(5, 0.3);
      this.fx.ring(mx, my, 20, 340, 0.7, 'rgba(255,210,122,0.75)', 8);
      this.fireRing(mx, my, n, 220, { art: 'bb_note', r: 9, life: 4.5, color: '#ffd27a', a0: w * Math.PI / n + this.rand(0, 0.3), ignoreWalls: false });
      if (this.phase >= 3) for (const s of [-1, 1]) this.shockwave(this.cx + s * 50, s, 360, 28, { color: 'rgba(255,214,140,0.9)' });
      this.pt.rear = 0.6;
      yield 0.5;
      this.pt.rear = 1;
    }
    this.pt.rear = 0; this.pt.glow = 0;
    yield 0.75;
  }

  // HOP: a heavy telegraphed hop that clangs on landing
  *hop() {
    const n = this.phase >= 3 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      this.facePlayer();
      this.pt.crouch = 1; this.tele = 0.5;
      yield 0.5;
      this.pt.crouch = 0; this.sfx('leap');
      yield* this.leapTo(this.player.cx, 240, 0.85);
      this.landClang(false);
      yield 0.45;
    }
    yield 0.4;
  }

  // HORN TOSS: lowers its head, scoots forward and flicks the horn up
  *horn() {
    this.facePlayer();
    this.pt.lunge = -1; this.pt.crouch = 0.6;
    this.tele = 0.5; this.sfx('rustle');
    yield 0.5;
    this.pt.lunge = 1; this.pt.crouch = 0; this.sfx('thrust');
    yield* this.dashTo(this.facing, 520, 120);
    const reach = 90;
    const x = this.facing > 0 ? this.x + this.w - 20 : this.x - reach + 20;
    this.zone(x, this.groundY - 130, reach, 130, 0.16);
    this.fx.slash(this.cx + this.facing * (this.w / 2 + 30), this.groundY - 70, -Math.PI / 2 + this.facing * 0.6, 130, 'rgba(255,230,180,0.9)', 0.2, this.facing);
    yield 0.35;
    this.pt.lunge = 0;
    yield 0.6;
  }

  // CHIMEFALL (phase 2+): rings at the ceiling; glinting columns mark where bronze shards will drop
  *chimes() {
    this.facePlayer();
    this.pt.rear = 1.3; this.pt.glow = 1;
    this.tele = 0.5; this.sfx('charge');
    yield 0.5;
    this.sfx('bell'); this.ring(2);
    this.fx.ring(this.cx, this.y, 20, 260, 0.6, 'rgba(255,210,122,0.75)', 6);
    const waves = this.phase >= 3 ? 2 : 1;
    for (let w = 0; w < waves; w++) {
      const xs = [this.player.cx];
      const k = 5;
      const gap = 150;
      const off = this.rand(-40, 40);
      for (let i = 1; i <= k; i++) xs.push(this.player.cx + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * gap + off);
      const cols = xs.map((x) => clamp(x, this.arena.x + 20, this.arena.x + this.arena.w - 20));
      for (const x of cols) this.marks.push({ x, t: 0.6 });
      yield 0.6;
      this.sfx('drop');
      for (const x of cols) this.fire(x, this.arena.y + 12, 0, 260, { gravity: 1300, art: 'bb_shard', r: 8, life: 3, color: '#ffd27a' });
      yield 0.45;
    }
    this.pt.rear = 0; this.pt.glow = 0;
    yield 0.7;
  }

  onPhase(n) {
    this.sfx('bossRoar'); this.sfx('bell');
    this.ring(2.5); this.shake(7, 0.7); this.tele = 0.9;
    this.crack = n - 1;
    this.speedMul *= 1.07;
    this.fx.ring(this.cx, this.cy, 20, 300, 0.8, 'rgba(255,210,122,0.85)', 7);
    this.fx.burst(this.cx, this.cy, 20, { color: '#d9a649', speed: 320, size: 3, life: 0.7, shape: 'shard' });
    if (n === 3) this.queue.push(this.toll);
  }

  onDeath() { this.pt.curl = 0; this.rolling = false; this.pt.rear = 0.8; }

  bodyBox() {
    if (this.p.curl > 0.5) return { x: this.x + 16, y: this.y + this.h - 116, w: this.w - 32, h: 116 };
    return { x: this.x + 12, y: this.y + 10, w: this.w - 24, h: this.h - 10 };
  }

  drawExtra(ctx, t) {
    // falling-shard warning columns
    for (const m of this.marks) {
      if (m.t <= 0) continue;
      const a = 0.25 + 0.25 * Math.sin(t * 30);
      const top = this.arena.y, bot = this.groundY;
      const g = ctx.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, `rgba(255,214,140,${a + 0.2})`); g.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = g; ctx.fillRect(m.x - 9, top, 18, bot - top);
      glowDot(ctx, m.x, top + 10, 22, '#ffd27a', 0.7);
    }
  }

  drawBody(ctx, t, white) {
    const C = (c) => (white ? '#fff' : c);
    const K = white ? '#fff' : INK;
    const P = this.p, f = this.facing, cx = this.cx, by = this.y + this.h, S = BB_SCALE;
    if (!white) {
      const air = Math.max(0, this.groundY - by), k = 1 / (1 + air / 200);
      ctx.fillStyle = `rgba(0,0,0,${0.4 * k})`; ctx.beginPath(); ctx.ellipse(cx, this.groundY - 2, 84 * k, 10 * k, 0, 0, TAU); ctx.fill();
    }
    ctx.save(); ctx.translate(cx, by); ctx.scale(f * S, S);
    if (P.curl > 0.5) { this.drawBall(ctx, t, C, K, white); ctx.restore(); return; }
    const lift = 30 - P.crouch * 10;
    // ---- legs: bent beetle legs, knee up above the lip, bronze-shod feet
    const leg = (ax, k, far) => {
      const ph = this.walkPh + k * 2 + (far ? Math.PI : 0);
      const step = this.moving ? Math.sin(ph) * 10 : Math.sin(t * 2 + k) * 1.2;
      const up = this.moving ? Math.max(0, Math.cos(ph)) * 7 : 0;
      const out = ax > 0 ? 1 : ax < 0 ? -1 : 0.3;
      const knee = [ax + out * 16 + step * 0.3, -lift - 12 - up * 0.5];
      const foot = [ax + out * 24 + step, -up];
      limb(ctx, [[ax, -lift + 2], knee, foot], far ? 3.5 : 5, C(far ? '#24180b' : '#3e2b14'), K);
      ctx.fillStyle = C(far ? '#6e4f22' : '#c89a48');
      ctx.beginPath(); ctx.moveTo(foot[0] - 4, foot[1]); ctx.lineTo(foot[0] + 6 * out, foot[1] - 1); ctx.lineTo(foot[0], foot[1] - 6); ctx.closePath(); ctx.fill();
    };
    for (let k = 0; k < 3; k++) leg(-30 + k * 28, k, true);
    // ---- bell body
    ctx.save();
    ctx.translate(0, -lift);
    ctx.translate(-34, 0); ctx.rotate(-P.rear * 0.45 + P.lunge * 0.12); ctx.translate(34, 0);
    ctx.scale(1, 1 + Math.sin(t * 2.5) * 0.015);
    // interior + clapper (seen beneath the lip)
    ctx.beginPath(); ctx.ellipse(0, 0, 50, 9 + P.rear * 10, 0, 0, TAU); ctx.fillStyle = C('#140d06'); ctx.fill();
    ctx.save(); ctx.translate(0, -30); ctx.rotate(this.clap * 0.6);
    ctx.strokeStyle = K; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 34); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 38, 9, 0, TAU); ctx.fillStyle = C('#6e4f22'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 2.5; ctx.stroke();
    if (!white && P.glow > 0.05) glowDot(ctx, 0, 38, 30, '#ffd27a', P.glow * 0.8);
    ctx.restore();
    const bellPath = () => {
      ctx.beginPath();
      ctx.moveTo(-56, 0);
      ctx.quadraticCurveTo(-42, -10, -40, -36);
      ctx.bezierCurveTo(-40, -70, -22, -80, 0, -80);
      ctx.bezierCurveTo(22, -80, 40, -70, 40, -36);
      ctx.quadraticCurveTo(42, -10, 56, 0);
      ctx.closePath();
    };
    // crown loop (canon)
    ctx.beginPath(); ctx.ellipse(0, -86, 10, 9, 0, 0, TAU); ctx.strokeStyle = K; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = C('#a07a3a'); ctx.lineWidth = 4; ctx.stroke();
    bellPath();
    if (white) ctx.fillStyle = '#fff';
    else {
      const gr = ctx.createLinearGradient(-56, 0, 56, 0);
      gr.addColorStop(0, '#4a3214'); gr.addColorStop(0.3, '#c0903e'); gr.addColorStop(0.62, '#e8bd66'); gr.addColorStop(1, '#5a3d18');
      ctx.fillStyle = gr;
    }
    ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 4; ctx.stroke();
    if (!white) {
      ctx.save(); bellPath(); ctx.clip();
      // elytra seam: the bell is really two wing-cases
      ctx.strokeStyle = 'rgba(22,20,28,0.85)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-6, -80); ctx.quadraticCurveTo(-10, -40, -4, 2); ctx.stroke();
      // bands + rivets
      ctx.lineWidth = 2;
      for (const y of [-14, -56]) { ctx.beginPath(); ctx.moveTo(-60, y + 4); ctx.quadraticCurveTo(0, y - 6, 60, y + 4); ctx.stroke(); }
      ctx.fillStyle = '#fff1c0';
      for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.arc(i * 10, -9 - Math.abs(i) * 0.3, 1.6, 0, TAU); ctx.fill(); }
      // engraved bead-on-a-thread glyph
      ctx.strokeStyle = 'rgba(22,20,28,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(14, -36, 7, 0, TAU); ctx.moveTo(-30, -44); ctx.bezierCurveTo(-18, -30, -2, -50, 7, -38); ctx.stroke();
      ctx.fillStyle = 'rgba(22,20,28,0.5)'; ctx.beginPath(); ctx.arc(12, -38, 1.5, 0, TAU); ctx.arc(17, -38, 1.5, 0, TAU); ctx.fill();
      // verdigris: patina pooling under the bands and dripping down
      ctx.fillStyle = 'rgba(95,170,148,0.8)';
      for (const [x, y, w, l] of [[-30, -52, 9, 18], [22, -52, 7, 12], [34, -10, 8, 8], [-16, -10, 6, 7], [-36, -10, 5, 6], [6, -76, 8, 10]]) {
        ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.7, y + l * 0.8, x, y + l); ctx.quadraticCurveTo(x + w * 0.7, y + l * 0.8, x + w, y); ctx.closePath(); ctx.fill();
      }
      // shine
      ctx.strokeStyle = 'rgba(255,241,192,0.6)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(22, -72); ctx.quadraticCurveTo(30, -46, 34, -18); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, -76); ctx.quadraticCurveTo(18, -70, 22, -66); ctx.stroke();
      if (this.crack >= 1) { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-30, -74); ctx.lineTo(-22, -60); ctx.lineTo(-30, -48); ctx.lineTo(-24, -36); ctx.stroke(); }
      if (this.crack >= 2) { ctx.beginPath(); ctx.moveTo(44, -4); ctx.lineTo(30, -16); ctx.lineTo(34, -28); ctx.moveTo(30, -16); ctx.lineTo(20, -18); ctx.stroke(); }
      ctx.restore();
      // ring glow + vibration lines
      if (P.glow > 0.05) {
        glowDot(ctx, 0, -40, 110, '#ffd27a', P.glow * 0.35);
        ctx.strokeStyle = `rgba(255,220,150,${0.6 * P.glow})`; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { const o = (t * 60 + i * 12) % 36; ctx.beginPath(); ctx.ellipse(0, -36, 58 + o, 50 + o, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
      }
    }
    // lip rim
    ctx.beginPath(); ctx.ellipse(0, 0, 57, 7, 0, 0, TAU); ctx.fillStyle = C('#c89a48'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
    if (!white) { ctx.strokeStyle = 'rgba(255,241,192,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, -1, 50, 4, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    ctx.restore();

    // ---- thorax collar + head under the front lip
    const hx = 54 + P.lunge * 14, hy = -lift - 10 + P.crouch * 6 + P.lunge * 6 - P.rear * 12;
    ctx.beginPath(); ctx.ellipse(40 + P.lunge * 6, -lift - 8 - P.rear * 6, 18, 14, -0.3, 0, TAU);
    ctx.fillStyle = C('#3e2b14'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(P.lunge * 0.25 - P.rear * 0.2);
    // feathered antennae
    for (const s of [0, 1]) {
      const sw = Math.sin(t * 3 + s * 2) * 4;
      const ex = -10 + s * 16 + sw, ey = -46 - s * 4;
      ctx.strokeStyle = K; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6 + s * 6, -18);
      ctx.quadraticCurveTo(-16 + s * 10 + sw, -38, ex, ey); ctx.stroke();
      ctx.fillStyle = C('#d9a649');
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(ex - 2 + k * 2, ey + 2 - k * 3, 3.5, 2, 0.6, 0, TAU); ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke(); }
    }
    // great horn rising off the brow
    ctx.beginPath(); ctx.moveTo(4, -16); ctx.bezierCurveTo(22, -24, 32, -44, 24, -70 - P.lunge * 6);
    ctx.bezierCurveTo(20, -46, 14, -32, -6, -20); ctx.closePath();
    ctx.fillStyle = C('#ede6d4'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
    if (!white) {
      ctx.fillStyle = '#d9a649'; ctx.beginPath(); ctx.moveTo(24, -70 - P.lunge * 6); ctx.lineTo(21, -56); ctx.lineTo(28, -57); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(22,20,28,0.35)'; ctx.lineWidth = 1.2;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(6 + k * 5, -22 - k * 8); ctx.lineTo(14 + k * 4, -24 - k * 9); ctx.stroke(); }
    }
    // pale mask
    ctx.beginPath();
    ctx.moveTo(-14, -6);
    ctx.quadraticCurveTo(-14, -22, 2, -22); ctx.quadraticCurveTo(18, -22, 20, -6);
    ctx.quadraticCurveTo(20, 10, 4, 16); ctx.quadraticCurveTo(-12, 10, -14, -6);
    ctx.fillStyle = C('#ede6d4'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
    if (!white) {
      ctx.fillStyle = INK;
      for (const [ex, s] of [[-4, -1], [10, 1]]) { ctx.beginPath(); ctx.ellipse(ex, -6, 4, 6.5, s * -0.25, 0, TAU); ctx.fill(); }
      const ec = this.crack >= 2 ? '#fff0b0' : '#ffcf6a';
      eye(ctx, -4, -5, 2.2 + this.crack * 0.4, ec, true); eye(ctx, 10, -5, 2.2 + this.crack * 0.4, ec, true);
      ctx.fillStyle = 'rgba(160,150,130,0.4)'; ctx.beginPath(); ctx.ellipse(3, 9, 8, 3, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
    for (let k = 0; k < 3; k++) leg(-36 + k * 32, k + 0.5, false);
    ctx.restore();
  }
  drawBall(ctx, t, C, K, white) {
    const R = 46;
    ctx.save(); ctx.translate(0, -R - 1);
    ctx.save(); ctx.rotate(this.rollAng);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU);
    if (white) ctx.fillStyle = '#fff';
    else { const gr = ctx.createRadialGradient(-14, -16, 4, 0, 0, R); gr.addColorStop(0, '#f0c66e'); gr.addColorStop(0.5, '#b98a3c'); gr.addColorStop(1, '#4a3214'); ctx.fillStyle = gr; }
    ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 4; ctx.stroke();
    if (!white) {
      ctx.strokeStyle = 'rgba(22,20,28,0.75)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, R - 3, 12, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 12, R - 3, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(95,160,140,0.75)';
      for (const [x, y, r] of [[-20, -18, 7], [16, 22, 8], [24, -12, 5]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#fff1c0';
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * (R - 10), Math.sin(a) * (R - 10), 1.8, 0, TAU); ctx.fill(); }
      // horn tip poking out
    }
    ctx.beginPath(); ctx.moveTo(R - 6, -8); ctx.lineTo(R + 12, -2); ctx.lineTo(R - 6, 6); ctx.closePath();
    ctx.fillStyle = C('#ede6d4'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    if (!white) {
      ctx.fillStyle = 'rgba(255,241,192,0.5)'; ctx.beginPath(); ctx.ellipse(-16, -20, 12, 6, -0.6, 0, TAU); ctx.fill();
      if (this.dashing) {
        ctx.strokeStyle = 'rgba(255,214,140,0.55)'; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, R + 6 + i * 6, Math.PI * 0.65 + i * 0.1, Math.PI * 1.2 + i * 0.1); ctx.stroke(); }
      }
    }
    ctx.restore();
  }
}

export default { mossmother: MossMother, brassbeetle: BrassBeetle };
