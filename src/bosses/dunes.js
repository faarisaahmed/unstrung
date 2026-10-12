// Bosses of the Dustmote Dunes: The Lint King (Sovereign of Fluff) and the Glint Hoarder (Who Kept Everything).
import { Boss, registerMinion } from './boss.js';
import { TAU, clamp, sign } from '../core/math.js';
import { TILE } from '../core/constants.js';
import { INK, eye, PAINTERS } from '../art/creatures.js';
import { registerProjectileArt } from '../entities/projectile.js';
import { moveX } from '../world/movement.js';

// ---------------------------------------------------------------- shared ink helpers
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
// cloud / fluff outline: scalloped ellipse
function scallop(ctx, cx, cy, rx, ry, n, amp, ph = 0) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = ph + (i / n) * TAU, a1 = ph + ((i + 1) / n) * TAU, am = (a0 + a1) / 2;
    const k = 1 + amp * (0.75 + 0.25 * Math.sin(i * 2.7 + 1));
    if (i === 0) ctx.moveTo(cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry);
    ctx.quadraticCurveTo(cx + Math.cos(am) * rx * k, cy + Math.sin(am) * ry * k, cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry);
  }
  ctx.closePath();
}
function star4(ctx, x, y, r, a = 0) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.22 : r, an = a + (i / 8) * TAU;
    i ? ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr) : ctx.moveTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------- projectile art
registerProjectileArt('lk_button', (ctx, p) => {
  const r = p.r, c = p.o.color || '#c0394e';
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.age * 9 * (p.vx < 0 ? -1 : 1));
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, TAU); ctx.fill();
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r * 0.68, 0, TAU); ctx.stroke();
  ctx.fillStyle = INK;
  for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.78; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, r * 0.13, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(-r * 0.45, -r * 0.45, r * 0.2, 0, TAU); ctx.fill();
  ctx.restore();
});
registerProjectileArt('lk_dust', (ctx, p, t) => {
  const k = p.age / (p.age + p.life);
  const a = Math.min(1, p.age * 6) * (k > 0.8 ? (1 - k) / 0.2 : 1);
  const r = p.r * (0.8 + Math.min(1, p.age * 3) * 0.35);
  ctx.save();
  ctx.globalAlpha = a * 0.92;
  scallop(ctx, p.cx, p.cy, r * 1.08, r * 0.9, 9, 0.35, p.age * 0.8 + p.r);
  ctx.fillStyle = '#9d93a0'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  scallop(ctx, p.cx - r * 0.2, p.cy - r * 0.2, r * 0.6, r * 0.45, 7, 0.35, -p.age);
  ctx.fillStyle = '#d6cdc4'; ctx.fill();
  ctx.strokeStyle = 'rgba(60,50,70,0.5)'; ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const an = p.age * 2 + i * 2.1;
    ctx.beginPath(); ctx.arc(p.cx + Math.cos(an) * r * 0.4, p.cy + Math.sin(an) * r * 0.3, r * 0.25, an, an + 2.4); ctx.stroke();
  }
  ctx.restore();
});
registerProjectileArt('gh_coin', (ctx, p) => {
  const r = p.r, w = Math.abs(Math.cos(p.age * 11 + p.r)) * r + 1.5;
  glow(ctx, p.cx, p.cy, r * 3, '255,210,90', 0.3);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(p.cx, p.cy, w + 2, r + 2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = p.o.color || '#ffcf4a'; ctx.beginPath(); ctx.ellipse(p.cx, p.cy, w, r, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff3b8'; ctx.beginPath(); ctx.ellipse(p.cx - w * 0.25, p.cy - r * 0.3, w * 0.35, r * 0.35, 0, 0, TAU); ctx.fill();
  if (w > r * 0.5) { ctx.strokeStyle = '#a8701a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(p.cx, p.cy, w * 0.6, r * 0.6, 0, 0, TAU); ctx.stroke(); }
});
registerProjectileArt('gh_gem', (ctx, p, t) => {
  const r = p.r, c = p.o.color || '#ff4f6e';
  glow(ctx, p.cx, p.cy, r * 4, '255,120,150', 0.5);
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.age * 4);
  ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.8, -r * 0.2); ctx.lineTo(0, r); ctx.lineTo(-r * 0.8, -r * 0.2); ctx.closePath();
  ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.2); ctx.lineTo(r * 0.8, -r * 0.2); ctx.moveTo(0, -r); ctx.lineTo(-r * 0.25, -r * 0.2); ctx.lineTo(0, r); ctx.lineTo(r * 0.25, -r * 0.2); ctx.lineTo(0, -r);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
});

// ---------------------------------------------------------------- minions
PAINTERS.lk_courtier = function lkCourtier(ctx, e, t, A) {
  const w = e.w, h = e.h, ph = e.anim * 10;
  const sq = e.grounded ? 1 + Math.sin(ph) * 0.05 : 0.9;
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * w * 0.18, -h * 0.2); ctx.lineTo(s * w * 0.22 + Math.sin(ph + s) * 2, 0); ctx.stroke(); }
  scallop(ctx, 0, -h * 0.55, w * 0.48 / sq, h * 0.42 * sq, 11, 0.3, e.anim);
  ctx.fillStyle = A.c1; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  // pink bow
  ctx.fillStyle = A.c2;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-w * 0.08, -h * 0.98); ctx.lineTo(-w * 0.08 + s * w * 0.2, -h * 1.08); ctx.lineTo(-w * 0.08 + s * w * 0.2, -h * 0.86); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  // eyes + snooty brow
  ctx.fillStyle = INK;
  for (const s of [0, 1]) { ctx.beginPath(); ctx.ellipse(w * 0.05 + s * w * 0.2, -h * 0.58, 2.6, 3.6, 0, 0, TAU); ctx.fill(); }
  eye(ctx, w * 0.12, -h * 0.6, 1.4, A.c3 || '#ffe08a', true);
  ctx.beginPath(); ctx.moveTo(w * 0.0, -h * 0.78); ctx.lineTo(w * 0.32, -h * 0.72); ctx.stroke();
};
registerMinion({
  id: 'lk_courtier', name: 'Lint Courtier', hp: 18, dmg: 1, size: [30, 28],
  behavior: 'hopper', params: { interval: 1.0, vx: 200, vy: 560, sight: 900 },
  art: { body: 'lk_courtier', c1: '#cfc5b8', c2: '#e39ab4', c3: '#ffe08a' },
});

PAINTERS.gh_chest = function ghChest(ctx, e, t, A) {
  const w = e.w, h = e.h;
  const open = e.dormant ? 0 : 0.45 + Math.abs(Math.sin(e.anim * 7)) * 0.4;
  const bh = h * 0.6;
  // base
  ctx.beginPath(); ctx.rect(-w / 2, -bh, w, bh);
  ctx.fillStyle = A.c1; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = A.c2;
  for (const x of [-w * 0.36, w * 0.28]) { ctx.fillRect(x, -bh, w * 0.08, bh); ctx.strokeRect(x, -bh, w * 0.08, bh); }
  // mouth interior + teeth when awake
  if (open > 0) {
    ctx.save(); ctx.translate(-w / 2, -bh); ctx.rotate(-open * 0.9);
    ctx.fillStyle = '#2a0f18'; ctx.beginPath(); ctx.rect(0, -h * 0.02, w, h * 0.04); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#3a0f1c'; ctx.beginPath(); ctx.moveTo(-w / 2, -bh); ctx.lineTo(w / 2, -bh); ctx.lineTo(w / 2 - 2, -bh - open * h * 0.5); ctx.lineTo(-w / 2, -bh - open * h * 0.12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = A.c3; ctx.beginPath(); ctx.ellipse(w * 0.05, -bh - 2, w * 0.22, 5, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#f3ead2';
    for (let i = 0; i < 5; i++) { const x = -w / 2 + 4 + i * (w - 8) / 4.5; ctx.beginPath(); ctx.moveTo(x, -bh); ctx.lineTo(x + 3.5, -bh - 7); ctx.lineTo(x + 7, -bh); ctx.fill(); }
    eye(ctx, w * 0.1, -bh - open * h * 0.32, 2.4, '#b6ff7a', true);
    eye(ctx, w * 0.3, -bh - open * h * 0.36, 2.4, '#b6ff7a', true);
  }
  // lid
  ctx.save(); ctx.translate(-w / 2, -bh); ctx.rotate(-open * 0.9);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -h * 0.22); ctx.quadraticCurveTo(w / 2, -h * 0.5, w, -h * 0.22); ctx.lineTo(w, 0); ctx.closePath();
  ctx.fillStyle = A.c1; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = A.c2; ctx.beginPath(); ctx.arc(w / 2, -2, 4, 0, TAU); ctx.fill(); ctx.stroke();
  if (!open) { ctx.fillStyle = INK; ctx.fillRect(w / 2 - 1, 0, 2, 5); }
  ctx.restore();
  if (e.dormant) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, -bh * 0.7, 3, 0, TAU); ctx.fill(); ctx.fillRect(-1.2, -bh * 0.7, 2.4, 7); }
};
registerMinion({
  id: 'gh_mimic', name: 'Hoard Mimic', hp: 30, dmg: 1, size: [40, 34],
  behavior: 'mimic', params: { wake: 150, vx: 230, vy: 600, interval: 0.9, sight: 900 },
  art: { body: 'gh_chest', c1: '#7a4a28', c2: '#e8b84a', c3: '#d65a6a' },
});

// =====================================================================================
// THE LINT KING — Sovereign of Fluff. Pompous, puffy, and much more dangerous than he looks.
// =====================================================================================
const LK = { hi: '#f4eee4', mid: '#cfc6b8', lo: '#968aa2', cape: '#8c2a3e', capeHi: '#b8435a', ermine: '#f3efe6', slipper: '#5d3a66', silver: '#d0d4de', silverLo: '#8b90a0', gold: '#e6b84c', nose: '#c0394e', eye: '#ffcf5a' };

export class LintKing extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'lintking', size: [116, 112], music: 'boss_optional', glints: 220, introTime: 2.4 });
    if (this.dead) return;
    this.puff = 0; this.sq = 0; this.curl = 0; this.rollAng = 0;
    this.arm = 0; this.sneezeK = 0; this.panic = false; this.crownOn = true; this.crown = null;
    this.marks = [];
    this.dizzy = 0; this.headBack = 0; this.yawn = 0;
    this.fibers = [];
    for (let i = 0; i < 16; i++) {
      const pts = [], a = Math.random() * TAU, rr = 0.15 + Math.random() * 0.7;
      let x = Math.cos(a) * rr, y = Math.sin(a) * rr, d = Math.random() * TAU;
      for (let k = 0; k < 5; k++) { pts.push([x, y]); d += (Math.random() - 0.5) * 2; x += Math.cos(d) * 0.16; y += Math.sin(d) * 0.16; }
      this.fibers.push({ pts, c: ['#8fa3c8', '#d9a0b4', '#b3a796', '#7c7088', '#e4d6a8'][i % 5] });
    }
  }

  bodyR() { return 50 * (1 + 0.45 * this.puff); }

  onStart() { this.facePlayer(); }
  introUpdate(dt, t) {
    // wakes with a start, then puffs up importantly
    this.yawn = t < 0.8 ? Math.sin(t / 0.8 * Math.PI) : 0;
    this.puff = t > 0.9 ? Math.min(0.5, (t - 0.9) * 0.8) * (t > 1.9 ? Math.max(0, 1 - (t - 1.9) * 2) : 1) : 0;
    this.arm = t > 1.0 ? Math.min(1, (t - 1.0) * 2) : 0;
    if (t > 2.2) this.arm = 0;
  }

  attackList() {
    const P = this.phase;
    return [
      { name: 'flop', w: 2, fn: this.bellyflop },
      { name: 'sneeze', w: 2, fn: this.sneeze },
      { name: 'roll', w: 2, fn: this.royalRoll },
      { name: 'buttons', w: 2, fn: this.buttons },
      { name: 'court', w: 1.3, fn: this.summonCourt, cond: () => this.minions.length < (P >= 2 ? 3 : 2) },
      { name: 'decree', w: 1.5, fn: this.decree, cond: () => P >= 2 },
      { name: 'balloon', w: 1.4, fn: this.balloon, cond: () => P >= 2 },
      { name: 'scramble', w: 2, fn: this.scramble, cond: () => P >= 3 },
    ];
  }

  // ---------------- attacks
  *inflateTo(target, frames) {
    const p0 = this.puff;
    for (let i = 1; i <= frames; i++) { this.puff = p0 + (target - p0) * (i / frames); this.sq = Math.sin(i * 0.9) * 0.05; yield; }
    this.sq = 0;
  }

  *bellyflop() {
    this.facePlayer();
    const hops = this.phase >= 3 ? 3 : this.phase >= 2 ? 2 : 1;
    this.tele = 0.6; this.sfx('charge');
    yield* this.inflateTo(1, 36);
    for (let i = 0; i < hops; i++) {
      this.facePlayer();
      this.sq = 0.35;
      if (i > 0) { this.tele = 0.4; yield 0.4; }
      this.sq = -0.25;
      this.sfx('leap');
      yield* this.leapTo(this.player.cx, 250, 0.82);
      this.sq = 0.45;
      this.sfx('slam'); this.shake(10, 0.4);
      this.fx.burst(this.cx, this.groundY, 22, { color: LK.mid, speed: 320, angle: -Math.PI / 2, spread: 2.8, size: 5, life: 0.8, g: 300 });
      this.shockwave(this.cx - 40, -1, 380, 30, { color: 'rgba(214,205,196,0.92)' });
      this.shockwave(this.cx + 40, 1, 380, 30, { color: 'rgba(214,205,196,0.92)' });
      yield 0.12;
      this.sq = 0;
    }
    // deflate with a rude noise
    this.sfx('buzz');
    for (let i = 0; i < 30; i++) { this.puff = Math.max(0, this.puff - 1 / 30); this.fx.add({ x: this.cx - this.facing * this.bodyR(), y: this.cy, vx: -this.facing * this.rand(80, 200), vy: this.rand(-60, 60), life: 0.5, size: 4, color: LK.hi, g: 0, drag: 2 }); yield; }
    yield 0.75;
  }

  *sneeze() {
    this.facePlayer();
    this.sfx('rustle');
    const times = this.phase >= 3 ? 2 : 1;
    for (let s = 0; s < times; s++) {
      if (s > 0) { this.facePlayer(); }
      this.tele = 0.75;
      for (let k = 0; k < 3; k++) {
        this.sneezeK = (k + 1) / 3; this.headBack = (k + 1) / 3;
        const nx = this.cx + this.facing * this.bodyR() * 0.35, ny = this.cy - 34;
        this.fx.text(nx, ny - 20 - k * 10, k < 2 ? 'ah…' : 'AH—', '#f4eee4', 13 + k * 3);
        yield 0.26;
      }
      this.sneezeK = 0; this.headBack = -0.6;
      this.sfx('burst'); this.shake(7, 0.35);
      const nx = this.cx + this.facing * this.bodyR() * 0.7, ny = this.groundY - this.bodyR() * 0.85;
      const n = this.phase >= 2 ? 5 : 4;
      for (let i = 0; i < n; i++) {
        // clouds hug the floor and mid-height; jump over or get behind him
        const vy = i % 2 ? this.rand(10, 50) : this.rand(-40, 0);
        this.fire(nx, ny + (i % 2 ? 26 : -4), this.facing * (180 + i * 70), vy, { art: 'lk_dust', r: 27 + (i % 3) * 4, pierce: true, ignoreWalls: true, accel: -1.25, life: 2.6 + i * 0.15, color: '#cfc5b8' });
      }
      this.fx.burst(nx, ny, 16, { color: LK.mid, speed: 360, angle: this.facing > 0 ? 0 : Math.PI, spread: 1.0, size: 4, life: 0.6, g: 0 });
      yield* this.dashTo(-this.facing, 260, 50);
      yield 0.25;
      this.headBack = 0;
    }
    yield 0.65;
  }

  *royalRoll() {
    this.facePlayer();
    this.tele = 0.6; this.sfx('charge');
    for (let i = 0; i < 36; i++) { this.curl = i / 36; this.sq = 0.2 * (i / 36); yield; }
    this.curl = 1; this.sq = 0;
    const bounces = this.phase;
    for (let b = 0; b < bounces; b++) {
      this.sfx('dash');
      const r = yield* this.dashTo(this.facing, 540 + this.phase * 70);
      if (r === 'wall') {
        this.shake(8, 0.3); this.sfx('slam');
        this.fx.burst(this.facing > 0 ? this.x + this.w : this.x, this.cy, 14, { color: LK.mid, speed: 280, size: 4, life: 0.6 });
        if (this.phase >= 2) for (let i = 0; i < 3; i++) this.fire(this.cx, this.y + 10, -this.facing * (140 + i * 110), -this.rand(520, 640), { gravity: 1300, art: 'lk_button', r: 10, color: this.pick(['#c0394e', '#4e7cc0', '#e6b84c']), parry: true });
      }
      this.facing = -this.facing;
      if (b < bounces - 1) { this.sq = 0.3; this.tele = 0.35; yield 0.35; this.sq = 0; }
    }
    for (let i = 0; i < 12; i++) { this.curl = 1 - i / 12; yield; }
    this.curl = 0; this.dizzy = 0.6;
    yield 0.75;
    this.dizzy = 0;
  }

  *buttons() {
    this.facePlayer();
    this.tele = 0.5; this.sfx('rustle');
    for (let i = 0; i < 30; i++) { this.arm = i / 30; yield; }
    const n = this.phase >= 3 ? 6 : this.phase >= 2 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      this.facePlayer();
      this.arm = i % 2 ? 0.2 : 1;
      this.sfx('throw');
      const p = this.player, x = this.cx + this.facing * 50, y = this.y + 10;
      const T = 0.75 + (i % 3) * 0.12, g = 1300;
      const tx = p.cx + (i - (n - 1) / 2) * 55;
      this.fire(x, y, (tx - x) / T, (p.cy - y) / T - 0.5 * g * T, { gravity: g, noScale: true, art: 'lk_button', r: 10 + (i % 2) * 2, color: this.pick(['#c0394e', '#4e7cc0', '#e6b84c', '#6fae6a']), parry: true, bounce: this.phase >= 2 ? 1 : 0, life: 3 });
      yield 0.2;
    }
    this.arm = 0;
    yield 0.8;
  }

  *summonCourt() {
    this.facePlayer();
    this.tele = 0.6;
    for (let i = 0; i < 36; i++) { this.arm = Math.min(1, i / 18); yield; }
    this.sfx('bell'); this.fx.text(this.cx, this.y - 30, 'ATTEND ME!', '#ffe08a', 16);
    const n = Math.min(this.phase >= 2 ? 3 : 2, (this.phase >= 2 ? 4 : 3) - this.minions.length);
    const ty = Math.round(this.groundY / TILE) - 1;
    for (let i = 0; i < n; i++) {
      const s = i % 2 ? 1 : -1;
      const x = clamp(this.cx + s * (110 + i * 40), this.arena.x + 40, this.arena.x + this.arena.w - 40);
      const m = this.summon('lk_courtier', Math.floor(x / TILE), ty);
      if (m) { m.facing = s; this.fx.burst(m.cx, m.cy, 10, { color: LK.mid, speed: 160, size: 4, life: 0.5 }); }
      yield 0.15;
    }
    this.arm = 0;
    yield 0.9;
  }

  *decree() {
    this.facePlayer();
    this.tele = 0.5;
    for (let i = 0; i < 24; i++) { this.arm = i / 24; yield; }
    this.sfx('bell'); this.fx.text(this.cx, this.y - 30, 'BY ROYAL DECREE!', '#ffe08a', 16);
    const A = this.arena, step = 96;
    const cols = [];
    for (let x = A.x + 48; x < A.x + A.w - 20; x += step) cols.push(x + this.rand(-10, 10));
    for (let wave = 0; wave < 2; wave++) {
      const pick = cols.filter((_, i) => i % 2 === wave);
      for (const x of pick) this.marks.push({ x, t: 0.7, max: 0.7 });
      this.sfx('warn');
      yield 0.7;
      for (const x of pick) this.fire(x, A.y + 10, 0, 150, { gravity: 1100, art: 'lk_button', r: 12, color: this.pick(['#c0394e', '#4e7cc0', '#e6b84c', '#6fae6a']), ignoreWalls: false, life: 2.5 });
      this.sfx('drop');
      yield 0.45;
    }
    this.arm = 0;
    yield 0.7;
  }

  *balloon() {
    this.facePlayer();
    this.tele = 0.85; this.sfx('charge');
    yield* this.inflateTo(1.35, 50);
    // aim: up and toward Bead
    const A = this.arena;
    let ang = Math.atan2(-1, this.dirTo() * 1.1);
    this.aimLine = { ang, t: 0.45 };
    yield 0.45;
    this.aimLine = null;
    this.sfx('buzz'); this.shake(5, 0.3);
    this.noPhysics = true; this.gravity = 0;
    let vx = Math.cos(ang) * 470, vy = Math.sin(ang) * 470;
    const dur = this.phase >= 3 ? 2.4 : 1.9;
    let tt = 0;
    while (tt < dur) {
      tt += 1 / 60;
      this.puff = 1.35 * (1 - tt / dur);
      const s = this.speedMul / 60;
      this.x += vx * s; this.y += vy * s;
      if (this.x < A.x) { this.x = A.x; vx = Math.abs(vx); this.sfx('bonkWall', 0.4); }
      if (this.x + this.w > A.x + A.w) { this.x = A.x + A.w - this.w; vx = -Math.abs(vx); this.sfx('bonkWall', 0.4); }
      if (this.y < A.y + 20) { this.y = A.y + 20; vy = Math.abs(vy); this.sfx('bonkWall', 0.4); }
      if (this.y + this.h > this.groundY) { this.y = this.groundY - this.h; vy = -Math.abs(vy); this.sfx('bonkWall', 0.4); }
      this.facing = vx < 0 ? -1 : 1;
      this.rollAng += 0.18;
      this.fx.add({ x: this.cx - vx * 0.15, y: this.cy - vy * 0.15, vx: -vx * 0.3 + this.rand(-40, 40), vy: -vy * 0.3 + this.rand(-40, 40), life: 0.5, size: 5, color: LK.hi, g: 0, drag: 3 });
      yield;
    }
    this.puff = 0;
    this.noPhysics = false; this.gravity = 2200; this.vx = 0; this.vy = 0;
    // flop down, dazed: the punish window
    for (let i = 0; i < 90 && !this.grounded; i++) yield;
    this.sfx('land'); this.shake(5, 0.2); this.sq = 0.4;
    this.dizzy = 1.3;
    yield 1.3;
    this.dizzy = 0; this.sq = 0;
  }

  *scramble() {
    // panicked crown-hunt: sprints back and forth, kicking up dust
    const runs = 3;
    for (let r = 0; r < runs; r++) {
      this.facePlayer();
      if (r === 0) this.fx.text(this.cx, this.y - 30, 'MY CROWN!', '#ffe08a', 16);
      this.tele = 0.4; this.sq = 0.25; this.sfx('screech');
      yield 0.4;
      this.sq = -0.1;
      let moved = 0;
      const dir = this.facing;
      for (;;) {
        const step = 720 * this.speedMul / 60;
        this.x += dir * step; moved += step;
        if (this.x < this.arena.x || this.x + this.w > this.arena.x + this.arena.w || moved > 900) break;
        if (Math.floor(moved / 150) !== Math.floor((moved - step) / 150)) this.fire(this.cx - dir * 40, this.groundY - 20, 0, 0, { art: 'lk_dust', r: 20, pierce: true, ignoreWalls: true, life: 1.1 });
        yield;
      }
      this.x = clamp(this.x, this.arena.x, this.arena.x + this.arena.w - this.w);
      this.sfx('bonkWall', 0.6);
      this.sq = 0;
      yield 0.2;
    }
    this.dizzy = 0.8;
    yield 0.8;
    this.dizzy = 0;
  }

  onPhase(n) {
    this.sfx('bossRoar'); this.shake(6, 0.6); this.tele = 0.8;
    if (n === 2) this.fx.text(this.cx, this.y - 30, 'HOW DARE YOU!', '#ffe08a', 16);
    if (n === 3 && this.crownOn) {
      this.crownOn = false; this.panic = true;
      this.speedMul *= 1.3;
      const R = this.bodyR();
      this.crown = { x: this.cx, y: this.groundY - R * 2 - 10, vx: -this.facing * 260, vy: -520, rot: 0, vr: 9, landed: false };
      this.sfx('clink');
      this.fx.text(this.cx, this.y - 40, 'MY CROWN!!', '#ffe08a', 18);
    }
  }

  think(dt) {
    for (const m of this.marks) m.t -= dt;
    this.marks = this.marks.filter((m) => m.t > 0);
    if (this.crown && !this.crown.landed) {
      const c = this.crown;
      c.vy += 1600 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
      if (c.x < this.arena.x + 16 || c.x > this.arena.x + this.arena.w - 16) { c.vx = -c.vx * 0.6; c.x = clamp(c.x, this.arena.x + 16, this.arena.x + this.arena.w - 16); }
      if (c.y > this.groundY - 12) {
        c.y = this.groundY - 12;
        if (Math.abs(c.vy) > 220) { c.vy = -c.vy * 0.4; c.vx *= 0.6; this.sfx('clink'); } else { c.landed = true; c.rot = 2.6; }
      }
    }
    if (this.curl > 0.5 && Math.random() < 0.5) this.fx.add({ x: this.cx + this.rand(-30, 30), y: this.groundY - 4, vx: -this.facing * this.rand(30, 120), vy: -this.rand(30, 120), life: 0.6, size: 3, color: this.pick([LK.mid, LK.hi, '#8fa3c8']), g: 200, drag: 1 });
    if (this.curl > 0.5) this.rollAng += 0.28 * this.facing;
    else if (!this.noPhysics) this.rollAng *= 0.9;
    if (this.panic && Math.random() < 0.06) this.fx.add({ x: this.cx + this.rand(-40, 40), y: this.y + 20, vx: this.rand(-80, 80), vy: -this.rand(100, 200), life: 0.6, size: 3, color: '#a8d8ff', g: 700, front: true });
    if (Math.random() < 0.05) this.fx.add({ x: this.cx + this.rand(-40, 40), y: this.cy + this.rand(-40, 40), vx: this.rand(-20, 20), vy: -this.rand(10, 30), life: 1.6, size: 2.5, color: LK.hi, g: -5, drag: 0.5 });
  }

  idle() { if (Math.random() < 0.012) this.fx.text(this.cx + 30, this.y + 10, 'z', '#cfc6b8', 14); }

  bodyBox() {
    const R = this.bodyR();
    const by = this.y + this.h;
    return { x: this.cx - R * 0.88, y: by - R * 1.9, w: R * 1.76, h: R * 1.9 - 4 };
  }

  drawExtra(ctx, t) {
    // ceiling marks for the royal decree
    for (const m of this.marks) {
      const k = m.t / m.max, y0 = this.arena.y + 6;
      ctx.save();
      ctx.globalAlpha = 0.5 * (1 - k) + 0.2;
      ctx.strokeStyle = 'rgba(255,224,138,0.8)'; ctx.setLineDash([6, 8]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(m.x, y0); ctx.lineTo(m.x, y0 + 120 * (1 - k)); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      glow(ctx, m.x, y0 + 8, 26, '255,224,138', 0.5 * (1 - k) + 0.2);
    }
    if (this.aimLine) {
      const a = this.aimLine.ang;
      ctx.save(); ctx.strokeStyle = 'rgba(255,240,210,0.6)'; ctx.setLineDash([10, 10]); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(this.cx, this.cy); ctx.lineTo(this.cx + Math.cos(a) * 260, this.cy + Math.sin(a) * 260); ctx.stroke();
      ctx.restore();
    }
    if (this.crown) {
      const c = this.crown;
      drawThimble(ctx, c.x, c.y, 16, c.rot, false, t);
    }
  }

  drawBody(ctx, t, white) {
    const f = this.facing, cx = this.cx, by = this.y + this.h;
    const R = this.bodyR();
    const br = Math.sin(t * 2.4) * 0.03 * (1 - this.curl);
    const sx = 1 + this.sq * 0.28 + br, sy = 1 - this.sq * 0.24 - br;
    const rx = R * sx, ry = R * sy;
    const cy = by - ry - 2;
    const panicJ = this.panic ? Math.sin(t * 50) * 1.5 : 0;
    // ground shadow
    if (!white) {
      const hgt = Math.max(0, this.groundY - by);
      ctx.fillStyle = `rgba(10,6,4,${0.3 * Math.max(0.2, 1 - hgt / 300)})`;
      ctx.beginPath(); ctx.ellipse(cx, this.groundY - 2, rx * 0.95, 8, 0, 0, TAU); ctx.fill();
    }
    const up = 1 - this.curl;
    // cape (behind)
    if (up > 0.3) {
      ctx.save(); ctx.globalAlpha = Math.min(1, up * 1.5) * (white ? 1 : 1);
      const wv = Math.sin(t * 3) * 6;
      const sx0 = cx - f * rx * 0.1, sy0 = cy - ry * 0.55;
      ctx.beginPath();
      ctx.moveTo(sx0 + f * rx * 0.25, sy0);
      ctx.quadraticCurveTo(cx - f * rx * 1.15, cy - ry * 0.4, cx - f * (rx * 1.25 + wv), by - 4);
      ctx.lineTo(cx - f * rx * 0.2, by - 4);
      ctx.quadraticCurveTo(cx - f * rx * 0.5, cy, sx0 + f * rx * 0.25, sy0);
      ctx.closePath();
      if (!white) { const g = ctx.createLinearGradient(cx, sy0, cx - f * rx, by); g.addColorStop(0, LK.capeHi); g.addColorStop(1, LK.cape); ctx.fillStyle = g; ctx.fill(); inkS(ctx, false, 3); } else fillInk(ctx, '#fff', true, 3);
      // ermine trim
      for (let i = 0; i < 6; i++) {
        const k = i / 5, ex = cx - f * (rx * 0.2 + k * (rx * 1.05 + wv)), ey = by - 7;
        ctx.beginPath(); ctx.arc(ex, ey, 7, 0, TAU); fillInk(ctx, LK.ermine, white, 2);
        if (!white && i % 2 === 0) { ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(ex, ey - 3); ctx.lineTo(ex - 1.5, ey + 2); ctx.lineTo(ex + 1.5, ey + 2); ctx.fill(); }
      }
      ctx.restore();
    }
    // slippers
    if (up > 0.5) {
      const walk = this.dizzy ? Math.sin(t * 12) * 3 : 0;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(cx + s * rx * 0.42 + f * 6 + walk * s, by - 6, 15, 8, 0, 0, TAU); fillInk(ctx, LK.slipper, white, 2.5);
        if (!white) { ctx.fillStyle = LK.gold; ctx.beginPath(); ctx.arc(cx + s * rx * 0.42 + f * 16 + walk * s, by - 9, 3, 0, TAU); ctx.fill(); }
      }
    }
    // back arm
    if (up > 0.5) { ctx.beginPath(); scallop(ctx, cx - f * rx * 0.9, cy + ry * 0.25, 13, 12, 7, 0.35, t); fillInk(ctx, LK.lo, white, 2.5); }
    // body
    ctx.save();
    ctx.translate(panicJ, 0);
    scallop(ctx, cx, cy, rx, ry, 20, 0.2, this.rollAng);
    if (white) ctx.fillStyle = '#fff';
    else { const g = ctx.createRadialGradient(cx - f * rx * 0.25, cy - ry * 0.4, R * 0.1, cx, cy, R * 1.15); g.addColorStop(0, LK.hi); g.addColorStop(0.55, LK.mid); g.addColorStop(1, LK.lo); ctx.fillStyle = g; }
    ctx.fill();
    inkS(ctx, white, 3.5);
    if (!white) {
      ctx.save(); ctx.clip();
      ctx.translate(cx, cy); ctx.rotate(this.rollAng);
      ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (const fb of this.fibers) {
        ctx.strokeStyle = fb.c; ctx.beginPath();
        fb.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * rx, y * ry) : ctx.moveTo(x * rx, y * ry)));
        ctx.stroke();
      }
      // inner fluff tufts
      ctx.strokeStyle = 'rgba(120,108,130,0.5)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 7; i++) { const a = i * 0.9; ctx.beginPath(); ctx.arc(Math.cos(a) * rx * 0.55, Math.sin(a) * ry * 0.55, R * 0.18, a, a + 2.2); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
    // face + arm
    if (up > 0.5) this.drawFace(ctx, t, white, cx + panicJ, cy, rx, ry);
    // crown sits on top (even while rolling, somehow)
    if (this.crownOn) {
      const tilt = -f * 0.28 + Math.sin(t * 2) * 0.05 + (this.curl > 0.5 ? Math.sin(t * 20) * 0.2 : 0);
      drawThimble(ctx, cx + f * rx * 0.12 * up, cy - ry * 0.98 - 14, 17 * (1 + this.puff * 0.15), tilt, white, t);
    }
    if (this.dizzy > 0 && !white) {
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + i * TAU / 3;
        ctx.fillStyle = LK.eye; star4(ctx, cx + Math.cos(a) * 34, cy - ry - 22 + Math.sin(a) * 8, 6, a); ctx.fill();
      }
    }
  }

  drawFace(ctx, t, white, cx, cy, rx, ry) {
    const f = this.facing;
    const hb = this.headBack;
    const fx0 = cx + f * rx * 0.28, fy = cy - ry * 0.12 - hb * 8;
    const asleep = this.mode === 'dormant';
    // brows (thick thread)
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const ex = fx0 + s * rx * 0.21;
      ctx.beginPath();
      if (this.panic) { ctx.moveTo(ex - 9, fy - ry * 0.3); ctx.quadraticCurveTo(ex, fy - ry * 0.42, ex + 9, fy - ry * 0.3); }
      else { ctx.moveTo(ex - s * 10, fy - ry * 0.24 + (s * f > 0 ? -6 : 0)); ctx.lineTo(ex + s * 10, fy - ry * 0.3 + (s * f > 0 ? -8 : 2)); }
      ctx.strokeStyle = col(white, INK); ctx.lineWidth = 5; ctx.stroke();
    }
    // eyes
    for (const s of [-1, 1]) {
      const ex = fx0 + s * rx * 0.21, ey = fy - ry * 0.08;
      if (white) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, 8, 10, 0, 0, TAU); ctx.fill(); continue; }
      if (asleep || this.sneezeK > 0.6) {
        ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath();
        if (asleep) ctx.arc(ex, ey, 7, 0.2, Math.PI - 0.2); else { ctx.moveTo(ex - 7, ey - 5); ctx.lineTo(ex + 3, ey); ctx.lineTo(ex - 7, ey + 5); }
        ctx.stroke(); continue;
      }
      if (this.panic) {
        ctx.fillStyle = '#fbf7ee'; ctx.beginPath(); ctx.arc(ex, ey, 11, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
        eye(ctx, ex + Math.sin(t * 40 + s) * 2, ey + Math.cos(t * 33) * 2, 3, INK);
        continue;
      }
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(ex, ey, 8, 10, 0, 0, TAU); ctx.fill();
      eye(ctx, ex + f * 2, ey + 2, 3.6, this.dizzy ? '#fff' : LK.eye, true);
      // haughty heavy lid
      ctx.fillStyle = LK.mid; ctx.beginPath(); ctx.ellipse(ex, ey - 4, 10, 7, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(ex - 10, ey - 3); ctx.lineTo(ex + 10, ey - 3); ctx.stroke();
    }
    // button nose
    const nr = 9 + this.sneezeK * 5, nx = fx0 + f * 4, ny = fy + ry * 0.14;
    ctx.beginPath(); ctx.arc(nx, ny, nr, 0, TAU); fillInk(ctx, LK.nose, white, 2.5);
    if (!white) {
      ctx.fillStyle = INK; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(nx + s * nr * 0.3, ny, nr * 0.16, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(nx - nr * 0.4, ny - nr * 0.45, nr * 0.22, 0, TAU); ctx.fill();
    }
    // mouth
    const my = ny + nr + 12;
    if (this.panic || this.yawn > 0.2 || this.sneezeK > 0) {
      const o = this.panic ? 8 + Math.sin(t * 30) * 2 : this.yawn > 0.2 ? this.yawn * 12 : 4;
      ctx.beginPath(); ctx.ellipse(nx, my + 2, 9, o, 0, 0, TAU); fillInk(ctx, '#3a1420', white, 2);
    }
    // grand moustache
    const wig = Math.sin(t * 3) * 0.08 + (this.panic ? Math.sin(t * 25) * 0.15 : 0);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(nx, ny + nr * 0.8);
      ctx.bezierCurveTo(nx + s * 14, ny + nr + 10, nx + s * 32, ny + nr + 6, nx + s * 36, ny + nr - 6 - wig * 20 * s);
      ctx.arc(nx + s * 30, ny + nr - 8 - wig * 20 * s, 6, s > 0 ? 0 : Math.PI, s > 0 ? -Math.PI : 0, s < 0);
      ctx.strokeStyle = col(white, INK); ctx.lineWidth = 9; ctx.stroke();
      ctx.strokeStyle = col(white, LK.hi); ctx.lineWidth = 5; ctx.stroke();
    }
    // front arm + needle sceptre
    const ax = cx + f * rx * 0.86, ay = cy + ry * 0.2 - this.arm * 16;
    const ang = -Math.PI / 2 * this.arm - 0.3 + (this.panic ? Math.sin(t * 22) * 0.6 : 0);
    const L = 74;
    const tipx = ax + f * Math.cos(ang) * L, tipy = ay + Math.sin(ang) * L;
    ctx.beginPath(); ctx.moveTo(ax - f * Math.cos(ang) * 14, ay - Math.sin(ang) * 14); ctx.lineTo(tipx, tipy);
    ctx.strokeStyle = col(white, INK); ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = col(white, LK.silver); ctx.lineWidth = 3.5; ctx.stroke();
    // needle eye with red thread
    if (!white) {
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(tipx - f * Math.cos(ang) * 6, tipy - Math.sin(ang) * 6, 1.5, 3.5, ang + Math.PI / 2, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#b8323e'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(tipx - f * Math.cos(ang) * 6, tipy - Math.sin(ang) * 6);
      ctx.bezierCurveTo(tipx + 14 * f, tipy - 16, tipx + 20 * f, tipy + 10 + Math.sin(t * 4) * 6, tipx + 26 * f, tipy + 18);
      ctx.stroke();
      // pearl pommel
      ctx.beginPath(); ctx.arc(ax - f * Math.cos(ang) * 16, ay - Math.sin(ang) * 16, 5, 0, TAU); fillInk(ctx, '#f6efe0', false, 2);
    }
    ctx.beginPath(); scallop(ctx, ax, ay, 14, 12, 7, 0.35, t * 0.5); fillInk(ctx, LK.mid, white, 2.5);
  }
}

function drawThimble(ctx, x, y, s, rot, white, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  // body
  ctx.beginPath();
  ctx.moveTo(-s, s * 0.7);
  ctx.lineTo(-s * 0.78, -s * 0.55);
  ctx.quadraticCurveTo(0, -s * 1.15, s * 0.78, -s * 0.55);
  ctx.lineTo(s, s * 0.7);
  ctx.closePath();
  if (white) ctx.fillStyle = '#fff';
  else { const g = ctx.createLinearGradient(-s, 0, s, 0); g.addColorStop(0, LK.silverLo); g.addColorStop(0.35, '#f4f6fb'); g.addColorStop(1, LK.silverLo); ctx.fillStyle = g; }
  ctx.fill(); inkS(ctx, white, 2.5);
  if (!white) {
    ctx.fillStyle = 'rgba(40,40,60,0.45)';
    for (let r = 0; r < 4; r++) for (let c = -2; c <= 2; c++) {
      const yy = -s * 0.5 + r * s * 0.3, xx = c * s * 0.3 * (0.75 + r * 0.08);
      ctx.beginPath(); ctx.arc(xx, yy, 1.6, 0, TAU); ctx.fill();
    }
  }
  // gold band + jewel
  ctx.beginPath(); ctx.rect(-s * 1.05, s * 0.45, s * 2.1, s * 0.4); fillInk(ctx, LK.gold, white, 2);
  ctx.beginPath(); ctx.moveTo(0, s * 0.3); ctx.lineTo(s * 0.22, s * 0.65); ctx.lineTo(0, s * 1.0); ctx.lineTo(-s * 0.22, s * 0.65); ctx.closePath(); fillInk(ctx, '#d0304e', white, 1.5);
  // crown points
  for (const k of [-0.75, 0, 0.75]) {
    ctx.beginPath(); ctx.moveTo(k * s - 4, -s * 0.62 - (k ? 0 : s * 0.18)); ctx.lineTo(k * s, -s * 0.98 - (k ? 0 : s * 0.25)); ctx.lineTo(k * s + 4, -s * 0.62 - (k ? 0 : s * 0.18));
    fillInk(ctx, LK.gold, white, 1.5);
  }
  ctx.restore();
  if (!white && t !== undefined) { ctx.fillStyle = 'rgba(255,255,240,0.8)'; star4(ctx, x - s * 0.3, y - s * 0.4, 4 + Math.sin(t * 5) * 2, t); ctx.fill(); }
}

// =====================================================================================
// GLINT HOARDER — Who Kept Everything. A greedy beast wearing a mountain of glints for a shell.
// =====================================================================================
const GH = { skin: '#3a2633', skinHi: '#5c3d4e', skinLo: '#1f141c', claw: '#efe2c4', gold: '#ffcf4a', goldLo: '#b07a1e', goldHi: '#fff1a8', eye: '#b6ff7a', mouth: '#2a0f18' };

export class GlintHoarder extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'hoarder', size: [150, 104], music: 'boss_optional', glints: 400, introTime: 2.2 });
    if (this.dead) return;
    this.rear = 0; this.mouth = 0; this.sink = 1; this.claw = 0; this.spin = 0; this.dig = 0;
    this.hidden = false; this.mound = null; this.marks = []; this.pulling = 0; this.shellShake = 0;
    // the hoard: coins and treasures heaped on its back (dome coords u∈[-1,1], v∈[0,1])
    this.coins = [];
    for (let i = 0; i < 70; i++) {
      const v = Math.pow(Math.random(), 0.8), umax = Math.sqrt(Math.max(0, 1 - v * v));
      const u = (Math.random() * 2 - 1) * umax * 0.95;
      this.coins.push({ u, v, tilt: Math.random() * 0.9 + 0.1, rot: (Math.random() - 0.5) * 1.2, kind: Math.random() < 0.12 ? 'gem' : 'coin', c: this.pick(['#ff4f6e', '#55d6ff', '#7dff9a', '#c48aff']) });
    }
    this.coins.sort((a, b) => (b.v - a.v));
    this.sparkles = [0, 1, 2, 3, 4].map((i) => ({ i: Math.floor(Math.random() * 70), ph: Math.random() * TAU }));
  }

  onStart() { this.facePlayer(); }
  idle() { if (Math.random() < 0.05) this.fx.add({ x: this.cx + this.rand(-60, 60), y: this.groundY - this.rand(4, 30), vx: 0, vy: -20, life: 0.6, size: 2.5, color: GH.goldHi, g: 0, glow: true }); }
  introUpdate(dt, t) {
    // bursts up out of its own hoard
    this.sink = Math.max(0, 1 - Math.max(0, t - 0.4) * 1.4);
    if (t > 0.4 && t < 1.2 && Math.random() < 0.6) this.fx.add({ x: this.cx + this.rand(-70, 70), y: this.groundY - 4, vx: this.rand(-200, 200), vy: -this.rand(200, 500), life: 0.9, size: 3, color: this.pick([GH.gold, GH.goldHi]), g: 1200, shape: 'shard' });
    this.mouth = t > 1.3 && t < 2.0 ? Math.sin((t - 1.3) / 0.7 * Math.PI) : 0;
    this.rear = this.mouth * 0.6;
  }

  attackList() {
    const P = this.phase, near = this.distX() < 230;
    return [
      { name: 'shower', w: 2, fn: this.shower },
      { name: 'mimics', w: 1.2, fn: this.mimics, cond: () => this.minions.length < 2 + (P >= 2 ? 1 : 0) },
      { name: 'burrow', w: 2, fn: this.burrow },
      { name: 'rain', w: 1.5, fn: this.coinRain },
      { name: 'gobble', w: near ? 1 : 2, fn: this.gobble },
      { name: 'claws', w: near ? 3 : 0.6, fn: this.claws },
      { name: 'jackpot', w: 2, fn: this.jackpot, cond: () => P >= 3 },
    ];
  }

  coinColor() { return this.pick(['#ffcf4a', '#ffd966', '#f2b632']); }

  *shower() {
    this.facePlayer();
    this.tele = 0.6; this.sfx('glint');
    for (let i = 0; i < 36; i++) { this.rear = i / 36; this.shellShake = 1; if (i % 6 === 0) this.sfx('glint'); yield; }
    this.shellShake = 0;
    const n = this.phase >= 3 ? 12 : this.phase >= 2 ? 10 : 8;
    const g = 1200;
    const waves = this.phase >= 2 ? 2 : 1;
    for (let w = 0; w < waves; w++) {
      this.sfx('burst'); this.shake(4, 0.2);
      const off = w ? 0.5 : 0;
      for (let i = 0; i < n; i++) {
        // evenly spaced landing spots ~ 110px apart in front, with a gap pattern you can stand in
        const land = (i + 0.4 + off) * 105;
        const T = 1.0;
        const x0 = this.cx, y0 = this.y + 10;
        this.fire(x0, y0, this.facing * land / T, (this.groundY - 10 - y0) / T - 0.5 * g * T, { gravity: g, noScale: true, art: 'gh_coin', r: 8, color: this.coinColor(), life: 2.5 });
      }
      yield 0.55;
    }
    for (let i = 0; i < 20; i++) { this.rear = 1 - i / 20; yield; }
    yield 0.6;
  }

  *mimics() {
    this.facePlayer();
    this.tele = 0.6;
    for (let i = 0; i < 36; i++) { this.mouth = Math.min(1, i / 18); this.rear = this.mouth * 0.5; yield; }
    this.sfx('screech'); this.fx.text(this.cx, this.y - 30, 'MINE! ALL MINE!', '#ffe08a', 15);
    const n = Math.min(this.phase >= 2 ? 3 : 2, 3 - this.minions.length);
    for (let i = 0; i < n; i++) {
      const x = clamp(this.player.cx + (i - (n - 1) / 2) * 200 + this.rand(-30, 30), this.arena.x + 50, this.arena.x + this.arena.w - 50);
      const m = this.summon('gh_mimic', Math.floor(x / TILE), Math.floor((this.arena.y + 40) / TILE));
      if (m) { m.vx = 0; m.vy = 200; this.fx.burst(m.cx, m.cy, 8, { color: GH.gold, speed: 160, size: 3, life: 0.4 }); }
      yield 0.2;
    }
    for (let i = 0; i < 20; i++) { this.mouth = 1 - i / 20; this.rear = this.mouth * 0.5; yield; }
    yield 0.8;
  }

  *burrow() {
    this.facePlayer();
    this.tele = 0.5; this.dig = 1; this.sfx('rustle');
    for (let i = 0; i < 30; i++) { if (i % 3 === 0) this.fx.add({ x: this.cx + this.facing * 60, y: this.groundY - 4, vx: -this.facing * this.rand(100, 300), vy: -this.rand(200, 450), life: 0.7, size: 3, color: this.pick([GH.gold, GH.goldHi]), g: 1200, shape: 'shard' }); yield; }
    this.hidden = true; this.hittable = false;
    this.sfx('drop');
    for (let i = 0; i < 20; i++) { this.sink = i / 20; yield; }
    this.sink = 1; this.dig = 0;
    // a mound of glints tunnels toward Bead
    this.mound = { x: this.cx, bulge: 0 };
    const dur = this.phase >= 2 ? 1.6 : 1.3;
    for (let tt = 0; tt < dur; tt += 1 / 60) {
      const dx = this.player.cx - this.mound.x;
      this.mound.x += clamp(dx, -7, 7) * this.speedMul;
      this.mound.x = clamp(this.mound.x, this.arena.x + 80, this.arena.x + this.arena.w - 80);
      this.hits.push({ x: this.mound.x - 26, y: this.groundY - 16, w: 52, h: 16 });
      if (Math.random() < 0.5) this.fx.add({ x: this.mound.x + this.rand(-20, 20), y: this.groundY - 6, vx: this.rand(-80, 80), vy: -this.rand(100, 250), life: 0.5, size: 2.5, color: GH.gold, g: 1000, shape: 'shard' });
      yield;
    }
    // bulge: the warning
    this.sfx('warn');
    for (let tt = 0; tt < 0.6; tt += 1 / 60) {
      this.mound.bulge = tt / 0.6;
      this.hits.push({ x: this.mound.x - 26, y: this.groundY - 16, w: 52, h: 16 });
      if (Math.random() < 0.7) this.fx.add({ x: this.mound.x + this.rand(-60, 60), y: this.groundY - 4, vx: 0, vy: -this.rand(80, 220), life: 0.5, size: 2.5, color: GH.goldHi, g: 0, glow: true });
      yield;
    }
    // erupt
    this.x = clamp(this.mound.x - this.w / 2, this.arena.x, this.arena.x + this.arena.w - this.w);
    this.mound = null;
    this.facePlayer();
    this.sfx('slam'); this.shake(10, 0.4);
    this.zone(this.cx - 75, this.groundY - 220, 150, 220, 0.3);
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i - 3.5) * 0.22;
      this.fire(this.cx, this.groundY - 60, Math.cos(a) * 560, Math.sin(a) * 760, { gravity: 1300, art: 'gh_coin', r: 7, color: this.coinColor(), life: 2.5 });
    }
    for (let i = 0; i < 10; i++) { this.sink = 1 - i / 10; this.rear = 1 - i / 10; yield; }
    this.sink = 0; this.rear = 0;
    this.hidden = false; this.hittable = true;
    yield 0.9;
  }

  *coinRain() {
    this.facePlayer();
    this.tele = 0.55;
    for (let i = 0; i < 30; i++) { this.rear = i / 30; this.mouth = i / 30; yield; }
    this.sfx('throw');
    const top = this.arena.y + 12;
    const gem = this.fire(this.cx + this.facing * 70, this.y, 0, -1100, { art: 'gh_gem', r: 14, ignoreWalls: true, life: Math.max(0.15, (this.y - top) / 1100), noScale: true });
    void gem;
    for (let i = 0; i < 16; i++) { this.mouth = 1 - i / 16; this.rear = 1 - i / 16; yield; }
    this.sfx('crystalBreak');
    const A = this.arena, step = 88;
    const cols = [];
    for (let x = A.x + 40; x < A.x + A.w - 20; x += step) cols.push(x);
    const waves = this.phase >= 2 ? 3 : 2;
    for (let w = 0; w < waves; w++) {
      const use = cols.filter((_, i) => (i + w) % 3 !== 0);
      for (const x of use) this.marks.push({ x, t: 0.6, max: 0.6 });
      yield 0.6;
      for (const x of use) this.fire(x + this.rand(-6, 6), top + 8, 0, 120, { gravity: 1000, art: 'gh_coin', r: 9, color: this.coinColor(), life: 2.2 });
      this.sfx('glint');
      yield 0.35;
    }
    yield 0.7;
  }

  *gobble() {
    this.facePlayer();
    this.tele = 0.55; this.sfx('screech');
    for (let i = 0; i < 33; i++) { this.mouth = i / 33; yield; }
    // inhale: drags Bead (and loose coins) toward the maw. Run or jump over its back.
    this.pulling = 1; this.sfx('howl');
    const dur = this.phase >= 2 ? 1.6 : 1.3;
    const f = this.facing;
    for (let tt = 0; tt < dur; tt += 1 / 60) {
      const p = this.player;
      const mx = this.cx + f * 90;
      const d = mx - p.cx;
      if (sign(-d) === f && Math.abs(d) < 640 && !p.dead) {
        const pull = (this.phase >= 3 ? 225 : 195) * (1 - Math.abs(d) / 800);
        moveX(p.b, this.game.room, sign(d) * pull / 60, 0);
      }
      if (Math.random() < 0.8) {
        const px = mx + f * this.rand(80, 500), py = this.groundY - this.rand(10, 220);
        this.fx.add({ x: px, y: py, vx: (mx - px) * 2.2, vy: (this.y + 50 - py) * 2.2, life: 0.45, size: 2, color: 'rgba(255,240,200,0.8)', g: 0, shape: 'streak' });
      }
      yield;
    }
    this.pulling = 0;
    // CHOMP
    this.mouth = 0;
    this.sfx('slam'); this.shake(6, 0.25);
    const x = f > 0 ? this.x + this.w - 30 : this.x - 110;
    this.zone(x, this.groundY - 110, 140, 104, 0.16);
    this.fx.slash(this.cx + f * 110, this.groundY - 60, f > 0 ? 0 : Math.PI, 120, 'rgba(255,230,160,0.9)', 0.2);
    yield 0.8;
  }

  *claws() {
    const n = this.phase >= 3 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      this.facePlayer();
      this.claw = -1; this.tele = 0.42; this.sfx('rustle');
      yield 0.42;
      this.claw = 1; this.sfx('slash');
      for (let k = 0; k < 8; k++) { this.x = clamp(this.x + this.facing * 14 * this.speedMul, this.arena.x, this.arena.x + this.arena.w - this.w); yield; }
      const reach = 130;
      const x = this.facing > 0 ? this.x + this.w - 30 : this.x - reach + 30;
      this.zone(x, this.groundY - 96, reach, 80, 0.15);
      this.fx.slash(this.cx + this.facing * (this.w / 2 + 40), this.groundY - 56, this.facing > 0 ? 0 : Math.PI, 130, 'rgba(255,214,120,0.95)', 0.18, i % 2 ? -1 : 1);
      yield 0.28;
      this.claw = 0;
    }
    yield 0.6;
  }

  *jackpot() {
    this.facePlayer();
    this.tele = 0.75; this.sfx('charge');
    for (let i = 0; i < 45; i++) { this.shellShake = 1; this.rear = i / 45 * 0.5; yield; }
    this.shellShake = 0; this.spin = 1;
    this.sfx('bell');
    const n = 22;
    for (let k = 0; k < n; k++) {
      const sweep = Math.sin(k * 0.42) * 1.25;
      for (const s of [-1, 1]) {
        const a = -Math.PI / 2 + s * Math.abs(sweep) * 0.9 + s * 0.15;
        this.fire(this.cx, this.y + 10, Math.cos(a) * 330, Math.sin(a) * 420, { gravity: 520, art: 'gh_coin', r: 7, color: this.coinColor(), life: 3 });
      }
      if (k % 3 === 0) this.sfx('glint');
      yield 0.11;
    }
    this.spin = 0; this.rear = 0;
    yield 0.9;
  }

  onPhase(n) {
    this.sfx('bossRoar'); this.shake(7, 0.7); this.tele = 0.8;
    if (n === 2) { this.speedMul *= 1.1; this.fx.text(this.cx, this.y - 30, 'THIEF!', '#ffe08a', 18); }
    if (n === 3) {
      this.speedMul *= 1.12;
      this.coins.splice(0, 20);
      this.fx.burst(this.cx, this.y + 20, 30, { color: GH.gold, speed: 400, size: 4, life: 1, shape: 'shard', g: 900 });
      this.fx.text(this.cx, this.y - 30, 'MY HOARD!!', '#ffe08a', 18);
    }
  }

  think(dt) {
    for (const m of this.marks) m.t -= dt;
    this.marks = this.marks.filter((m) => m.t > 0);
    if (!this.hidden && Math.random() < 0.08) {
      const c = this.coins[Math.floor(Math.random() * this.coins.length)];
      if (c) this.fx.add({ x: this.cx + c.u * 70, y: this.y + 40 - c.v * 50, vx: 0, vy: -15, life: 0.5, size: 2, color: GH.goldHi, g: 0, glow: true });
    }
    if (this.phase >= 3 && Math.random() < 0.15 && !this.hidden) this.fx.add({ x: this.cx + this.rand(-10, 10), y: this.y + 20, vx: this.rand(-40, 40), vy: -this.rand(40, 90), life: 0.7, size: 3, color: '#ff8aa0', g: -20, glow: true });
  }

  hurtboxes() {
    if (this.hidden || this.mode !== 'fight') return [];
    return [this.bodyBox()];
  }
  hurtbox() { return this.hidden ? { x: -9999, y: -9999, w: 1, h: 1 } : this.bodyBox(); }
  hitboxes() { return this.hidden ? [...this.hits] : [this.bodyBox(), ...this.hits]; }
  bodyBox() { return { x: this.x + 14, y: this.y + 8 + this.sink * this.h, w: this.w - 28, h: Math.max(4, this.h - 8 - this.sink * this.h) }; }

  drawExtra(ctx, t) {
    for (const m of this.marks) {
      const k = m.t / m.max, y0 = this.arena.y + 8;
      glow(ctx, m.x, y0 + 6, 28, '255,214,110', 0.6 * (1 - k) + 0.2);
      ctx.fillStyle = 'rgba(255,240,180,0.9)'; star4(ctx, m.x, y0 + 8, 7 + 4 * Math.sin(t * 20), t * 3); ctx.fill();
      ctx.save(); ctx.globalAlpha = 0.35 * (1 - k); ctx.strokeStyle = '#ffe08a'; ctx.setLineDash([4, 8]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(m.x, y0); ctx.lineTo(m.x, this.groundY); ctx.stroke(); ctx.restore();
    }
    if (this.mound) {
      const m = this.mound, b = m.bulge || 0, gy = this.groundY;
      const w = 34 + b * 40, h = 14 + b * 18 + Math.sin(t * 40) * b * 3;
      ctx.beginPath(); ctx.ellipse(m.x, gy, w, h, 0, Math.PI, 0); fillInk(ctx, GH.goldLo, false, 3);
      for (let i = 0; i < 7; i++) {
        const u = (i / 6 - 0.5) * 1.6, x = m.x + u * w * 0.8, y = gy - h * Math.sqrt(Math.max(0, 1 - u * u * 0.6)) * 0.8;
        ctx.beginPath(); ctx.ellipse(x, y + 3, 7, 4, (i - 3) * 0.2, 0, TAU); fillInk(ctx, GH.gold, false, 1.5);
      }
      if (b > 0) glow(ctx, m.x, gy - 10, 60 + b * 40, '255,210,100', 0.5 * b);
    }
  }

  drawBody(ctx, t, white) {
    const f = this.facing, cx = this.cx, by = this.y + this.h;
    const sinkPx = this.sink * (this.h + 20);
    if (this.sink >= 0.99) {
      if (this.mode === 'dormant' && !white) {
        // a sleeping hoard: just a heap of glints with two eyes peeking
        ctx.beginPath(); ctx.ellipse(cx, this.groundY, 90, 30, 0, Math.PI, 0); fillInk(ctx, GH.goldLo, false, 3);
        for (let i = 0; i < 14; i++) { const u = (i / 13 - 0.5) * 1.7, x = cx + u * 80; ctx.beginPath(); ctx.ellipse(x, this.groundY - 22 * Math.sqrt(Math.max(0, 1 - u * u * 0.33)) + 4, 9, 5, u, 0, TAU); fillInk(ctx, GH.gold, false, 1.5); }
        if (Math.sin(t * 0.7) > -0.6) for (const s of [0, 1]) eye(ctx, cx + f * (50 + s * 14), this.groundY - 14, 2.5, GH.eye, true);
      }
      return;
    }
    ctx.save();
    // clip at the floor so it can sink into the hoard
    ctx.beginPath(); ctx.rect(cx - 400, this.groundY - 800, 800, 800); ctx.clip();
    ctx.translate(0, sinkPx);
    // rear up pivot around the hind end
    const px = cx - f * 60;
    ctx.translate(px, by); ctx.rotate(-f * this.rear * 0.3); ctx.translate(-px, -by);
    const step = this.claw ? 0 : Math.sin(t * 4) * 3;
    // legs
    for (const [lx, ph] of [[-48, 0], [-20, 2], [28, 1], [56, 3]]) {
      const x = cx + f * lx, sw = Math.sin(t * 5 + ph) * 3;
      ctx.beginPath(); ctx.moveTo(x - 9, by - 30); ctx.lineTo(x - 10 + sw, by - 6); ctx.lineTo(x + 10 + sw, by - 6); ctx.lineTo(x + 9, by - 30); ctx.closePath();
      fillInk(ctx, GH.skinLo, white, 2.5);
      for (let c = -1; c <= 1; c++) { ctx.beginPath(); ctx.moveTo(x + c * 6 + sw + f * 4, by - 7); ctx.lineTo(x + c * 6 + sw + f * 10, by); ctx.lineTo(x + c * 6 + sw, by - 3); fillInk(ctx, GH.claw, white, 1.5); }
    }
    // tail with a coin purse
    ctx.beginPath(); ctx.moveTo(cx - f * 70, by - 40);
    ctx.quadraticCurveTo(cx - f * 110, by - 30 + Math.sin(t * 3) * 6, cx - f * 108, by - 64 + Math.sin(t * 3) * 8);
    ctx.strokeStyle = col(white, INK); ctx.lineWidth = 11; ctx.stroke(); ctx.strokeStyle = col(white, GH.skin); ctx.lineWidth = 6; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx - f * 108, by - 70 + Math.sin(t * 3) * 8, 10, 12, 0, 0, TAU); fillInk(ctx, '#7a3a4a', white, 2);
    // belly
    ctx.beginPath(); ctx.ellipse(cx + f * 6, by - 34, 74, 30, 0, 0, TAU);
    fillInk(ctx, GH.skin, white, 3.5);
    // the hoard shell (dome of glints)
    const shake = this.shellShake ? Math.sin(t * 60) * 2 : 0;
    const dx = cx - f * 6 + shake, dy = by - 46, RX = 80, RY = 66;
    ctx.beginPath(); ctx.ellipse(dx, dy, RX, RY, 0, Math.PI, 0); ctx.closePath();
    if (white) ctx.fillStyle = '#fff'; else { const g = ctx.createLinearGradient(0, dy - RY, 0, dy); g.addColorStop(0, '#d89a2a'); g.addColorStop(1, '#6a4410'); ctx.fillStyle = g; }
    ctx.fill(); inkS(ctx, white, 3.5);
    if (!white) {
      ctx.save(); ctx.beginPath(); ctx.ellipse(dx, dy, RX + 6, RY + 8, 0, Math.PI, 0); ctx.closePath(); ctx.clip();
      for (const c of this.coins) {
        const x = dx + c.u * RX * 0.92, y = dy - c.v * RY * 0.95 + 4;
        if (c.kind === 'gem') {
          ctx.save(); ctx.translate(x, y); ctx.rotate(c.rot);
          ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, -1); ctx.lineTo(0, 7); ctx.lineTo(-6, -1); ctx.closePath();
          ctx.fillStyle = c.c; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-2, -4, 2, 3);
          ctx.restore();
        } else {
          ctx.beginPath(); ctx.ellipse(x, y, 9, 9 * c.tilt + 2, c.rot, 0, TAU);
          ctx.fillStyle = GH.gold; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
          ctx.beginPath(); ctx.ellipse(x, y, 5.5, (9 * c.tilt + 2) * 0.6, c.rot, 0, TAU); ctx.strokeStyle = GH.goldLo; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = GH.goldHi; ctx.beginPath(); ctx.ellipse(x - 3, y - 2, 2.5, 1.5, c.rot, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
      // stolen trinkets: a goblet and a tiny bell
      const gx = dx - f * 30, gy = dy - RY * 0.86;
      ctx.beginPath(); ctx.moveTo(gx - 10, gy - 16); ctx.quadraticCurveTo(gx, gy + 4, gx + 10, gy - 16); ctx.closePath(); fillInk(ctx, '#e8e6f0', false, 2);
      ctx.beginPath(); ctx.moveTo(gx, gy - 6); ctx.lineTo(gx, gy + 6); ctx.moveTo(gx - 6, gy + 6); ctx.lineTo(gx + 6, gy + 6); inkS(ctx, false, 2.5);
      const bx = dx + f * 40, bby = dy - RY * 0.62;
      ctx.beginPath(); ctx.moveTo(bx - 9, bby + 6); ctx.quadraticCurveTo(bx - 8, bby - 10, bx, bby - 10); ctx.quadraticCurveTo(bx + 8, bby - 10, bx + 9, bby + 6); ctx.closePath(); fillInk(ctx, '#c99a52', false, 2);
      // twinkles
      for (const s of this.sparkles) {
        const c = this.coins[s.i % this.coins.length]; if (!c) continue;
        const k = Math.max(0, Math.sin(t * 3 + s.ph));
        if (k > 0.2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,250,220,${k})`; star4(ctx, dx + c.u * RX * 0.9, dy - c.v * RY * 0.9, 4 + k * 6, t); ctx.fill(); ctx.restore(); }
      }
      // phase 3: the cracked hoard shows a burning heart-gem
      if (this.phase >= 3) {
        const hx = dx, hy = dy - RY * 0.45, pul = 1 + Math.sin(t * 6) * 0.1;
        glow(ctx, hx, hy, 50 * pul, '255,90,120', 0.55);
        ctx.beginPath(); ctx.moveTo(hx, hy - 14 * pul); ctx.lineTo(hx + 12 * pul, hy); ctx.lineTo(hx, hy + 14 * pul); ctx.lineTo(hx - 12 * pul, hy); ctx.closePath(); fillInk(ctx, '#ff4f6e', false, 2.5);
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(hx - 40, dy - RY * 0.9); ctx.lineTo(hx - 18, hy - 8); ctx.lineTo(hx - 26, hy + 6); ctx.lineTo(hx - 10, hy + 22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hx + 34, dy - RY * 0.85); ctx.lineTo(hx + 16, hy - 4); ctx.lineTo(hx + 24, hy + 14); ctx.stroke();
      }
    }
    // head and snout
    const hx = cx + f * 70, hy = by - 50 - this.dig * -10;
    const m = this.mouth;
    ctx.save(); ctx.translate(hx, hy); ctx.scale(f, 1);
    // lower jaw
    ctx.save(); ctx.rotate(m * 0.55);
    ctx.beginPath(); ctx.moveTo(-6, 6); ctx.quadraticCurveTo(30, 22, 62, 10); ctx.lineTo(60, 4); ctx.quadraticCurveTo(28, 8, -6, -2); ctx.closePath();
    fillInk(ctx, GH.skinHi, white, 3);
    if (!white && m > 0.15) { ctx.fillStyle = '#f3ead2'; for (let i = 0; i < 5; i++) { const x = 12 + i * 10; ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x + 3, -2); ctx.lineTo(x + 6, 6); ctx.fill(); } }
    ctx.restore();
    if (!white && m > 0.15) { ctx.fillStyle = GH.mouth; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(60, -2); ctx.lineTo(60 * Math.cos(m * 0.55), 60 * Math.sin(m * 0.55) + 6); ctx.closePath(); ctx.fill(); glow(ctx, 30, 6, 30 * m, '255,200,90', 0.25 * m); }
    // upper head / snout
    ctx.beginPath();
    ctx.moveTo(-20, 10); ctx.quadraticCurveTo(-22, -30, 8, -30); ctx.quadraticCurveTo(40, -26, 66, -4); ctx.quadraticCurveTo(70, 4, 62, 6); ctx.quadraticCurveTo(30, 2, -20, 10); ctx.closePath();
    fillInk(ctx, GH.skin, white, 3.5);
    // nose
    ctx.beginPath(); ctx.ellipse(64, -2, 6, 5, 0, 0, TAU); fillInk(ctx, '#1a0f16', white, 2);
    if (!white) {
      // gold tooth + teeth on the upper jaw
      ctx.fillStyle = '#f3ead2'; for (let i = 0; i < 4; i++) { const x = 18 + i * 11; ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x + 3, 11); ctx.lineTo(x + 6, 4); ctx.fill(); }
      ctx.fillStyle = GH.gold; ctx.beginPath(); ctx.moveTo(40, 4); ctx.lineTo(43, 12); ctx.lineTo(46, 4); ctx.fill();
      // ear
      ctx.beginPath(); ctx.moveTo(-8, -24); ctx.quadraticCurveTo(-26, -46, -30, -30 + Math.sin(t * 2) * 3); ctx.quadraticCurveTo(-24, -22, -10, -18); fillInk(ctx, GH.skinHi, false, 2.5);
      // beady eye + gold monocle
      const ex = 20, ey = -14;
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(ex, ey, 7, 6, 0, 0, TAU); ctx.fill();
      eye(ctx, ex + 1.5, ey, 3.2, this.phase >= 3 ? '#ffd24a' : GH.eye, true);
      ctx.strokeStyle = GH.gold; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(ex, ey, 10, 0, TAU); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ex, ey, 11.5, 0, TAU); ctx.stroke();
      ctx.strokeStyle = GH.gold; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ex - 6, ey + 8); ctx.quadraticCurveTo(ex - 14, ey + 24, ex - 26, ey + 20 + Math.sin(t * 3) * 3); ctx.stroke();
      // greedy brow
      ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(8, -26); ctx.lineTo(32, -20 + (this.claw || this.pulling ? 4 : 0)); ctx.stroke();
    } else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(20, -14, 8, 0, TAU); ctx.fill(); }
    ctx.restore();
    // forearm + claw (front)
    const cl = this.claw;
    const ax = cx + f * (54 + cl * 34), ay = by - 30 - (cl < 0 ? 20 : 0);
    ctx.beginPath(); ctx.moveTo(cx + f * 30, by - 40); ctx.quadraticCurveTo(cx + f * 46, ay - 10, ax, ay);
    ctx.strokeStyle = col(white, INK); ctx.lineWidth = 15; ctx.stroke(); ctx.strokeStyle = col(white, GH.skinHi); ctx.lineWidth = 9; ctx.stroke();
    for (let c = -1; c <= 1; c++) {
      ctx.beginPath(); ctx.moveTo(ax, ay + c * 5); ctx.quadraticCurveTo(ax + f * 14, ay + c * 7 - 4, ax + f * 20, ay + c * 8 + 4); ctx.lineTo(ax + f * 6, ay + c * 5 + 3); ctx.closePath();
      fillInk(ctx, GH.claw, white, 1.5);
    }
    if (!white) { ctx.strokeStyle = GH.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(ax - f * 8, ay, 3, 7, 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
    if (this.spin && !white) glow(ctx, cx, this.y + 20, 120, '255,210,100', 0.25);
    void step;
  }
}

export default { lintking: LintKing, hoarder: GlintHoarder };
