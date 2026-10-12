// Bosses of area 'hollows': Mother Mossbug (main) and the Brass Beetle (optional).
import { Boss, registerMinion } from './boss.js';
import { TAU, clamp } from '../core/math.js';
import { TILE } from '../core/constants.js';
import { INK, eye } from '../art/creatures.js';
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

// ------------------------------------------------------------------ projectile art
registerProjectileArt('mm_spore', (ctx, p, t) => {
  const r = p.r, x = p.cx, y = p.cy + Math.sin(p.age * 5 + p.x * 0.03) * 2;
  glowDot(ctx, x, y, r * 2.8, p.o.color || '#bff5df', 0.35);
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU + p.age * 1.5;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8);
    ctx.lineTo(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35); ctx.stroke();
  }
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, TAU); ctx.fill();
  ctx.fillStyle = p.o.fill || '#5fae88'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(220,255,236,0.75)';
  for (const [dx, dy, s] of [[-0.3, -0.3, 0.3], [0.35, 0.1, 0.16], [-0.05, 0.4, 0.13]]) { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, r * s, 0, TAU); ctx.fill(); }
});

registerProjectileArt('mm_pebble', (ctx, p) => {
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.age * 6);
  ctx.fillStyle = INK; ctx.beginPath();
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, rr = p.r * (1.1 + (i % 2) * 0.25); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.fill();
  ctx.fillStyle = p.o.color || '#4f6e64'; ctx.beginPath();
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, rr = p.r * (0.85 + (i % 2) * 0.25); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.fill();
  ctx.fillStyle = '#7fbf8c'; ctx.beginPath(); ctx.arc(-p.r * 0.2, -p.r * 0.45, p.r * 0.45, Math.PI, 0); ctx.fill();
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
registerMinion({
  id: 'mm_broodling', name: 'Mossbug Broodling', hp: 8, dmg: 1, size: [28, 18],
  behavior: 'crawler', params: { speed: 72, noLedge: true },
  art: { body: 'grub', c1: '#3c6457', c2: '#7fbf8c', c3: '#ece4cf', eye: '#bff5df', mask: true, segs: 3 },
  journal: 'Mother Mossbug\'s littlest. They hatch hungry and warm, and follow anything that rolls.', kills: 10,
});

// =================================================================== MOTHER MOSSBUG
// First real boss: Bead has only jump, Bonk, pogo and Mend. Huge telegraphs, everything jumpable.
export class MossMother extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'mossmother', size: [184, 124], music: 'boss', glints: 90, introTime: 2.4 });
    this.p = { squash: 0, rear: 0, withdraw: 0, puff: 0, birth: 0, charge: 0, jaw: 0, wake: 0 };
    this.pt = Object.assign({}, this.p);
    this.walkPh = 0; this.spinAng = 0; this.dazed = 0; this.queue = [];
    this.crack = 0; this.blink = 0;
  }

  update(dt) { super.update(dt); this.animate(dt); }

  animate(dt) {
    const P = this.p, T = this.pt, k = 1 - Math.exp(-dt * 11);
    for (const key in T) P[key] += (T[key] - P[key]) * k;
    this.moving = Math.abs(this.vx) > 5 || this.dashing;
    if (this.moving) this.walkPh += dt * (this.dashing ? 22 : 12);
    if (this.spinning) this.spinAng += dt * (this.dashing ? 26 : 16);
    if (this.dazed > 0) this.dazed -= dt;
    this.blink -= dt;
    if (this.blink < -3 - Math.random() * 3) this.blink = 0.14;
    const g = this.game;
    if (this.mode === 'dormant' || this.dead) return;
    // vents puffing
    if (P.puff > 0.4 && Math.random() < 0.5) {
      const [vx, vy] = this.toWorld(-12, -this.lift() - 98);
      g.fx.burst(vx, vy, 1, { color: '#9fe0c4', speed: 90, angle: -Math.PI / 2, spread: 1.2, size: 4, life: 0.6, g: -60, glow: true });
    }
    // charging dust
    if (this.dashing && Math.random() < 0.7) {
      g.fx.burst(this.cx - this.facing * this.w * 0.4, this.groundY - 4, 1, { color: '#5f7d72', speed: 160, angle: -Math.PI / 2 - this.facing * 0.9, spread: 0.8, size: 4, life: 0.5 });
    }
    // drifting spore motes from the moss
    if (Math.random() < 0.05) {
      g.fx.burst(this.cx + this.rand(-50, 50), this.y + 10, 1, { color: '#bff5df', speed: 20, angle: -Math.PI / 2, spread: 1, size: 2, life: 1.4, g: -15, glow: true, front: false });
    }
  }

  lift() { return 20 - this.p.squash * 12; }
  toWorld(lx, ly) { return [this.cx + lx * MM_SCALE * this.facing, this.y + this.h + ly * MM_SCALE]; }

  idle() { this.pt.wake = 0; }
  onStart() { this.pt.wake = 1; this.pt.rear = 1; this.pt.jaw = 1; }
  introUpdate(dt, t) {
    if (t > 0.5 && t < 0.55) { this.sfx('screech'); this.shake(5, 0.8); }
    if (t > 0.5 && Math.random() < 0.3) this.fx.burst(this.cx + this.facing * 60, this.y + 30, 1, { color: '#9fe0c4', speed: 140, size: 3, life: 0.6, glow: true });
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
      for (const s of [-1, 1]) this.fx.burst(this.cx + s * this.w * 0.45, this.groundY - 4, 10, { color: '#5f7d72', speed: 260, angle: -Math.PI / 2 + s * 0.9, spread: 0.9, size: 4, life: 0.6 });
      this.fx.burst(this.cx, this.y + 20, 8, { color: '#7fbf8c', speed: 180, size: 3, life: 0.8, g: 500 });
      if (this.phase >= 2) { this.shockwave(this.cx - this.w / 2, -1, 340, 28, { color: 'rgba(159,224,196,0.85)' }); this.shockwave(this.cx + this.w / 2, 1, 340, 28, { color: 'rgba(159,224,196,0.85)' }); }
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
      this.fx.burst(this.cx - this.facing * 50, this.groundY - 4, 4, { color: '#5f7d72', speed: 150, angle: -Math.PI / 2 - this.facing * 0.7, spread: 0.6, size: 3.5, life: 0.4 });
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
      this.fx.burst(wx, this.cy, 14, { color: '#7fbf8c', speed: 280, size: 3.5, life: 0.6 });
      this.dazed = 1.0;
      if (this.phase >= 2) {
        // the bump shakes loose mossy pebbles from the ceiling (they fall from high up = readable)
        const xs = [this.player.cx, this.player.cx + this.rand(130, 200), this.player.cx - this.rand(130, 200)];
        if (this.phase >= 3) xs.push(this.player.cx + this.rand(-420, 420));
        for (const x of xs) {
          const px = clamp(x, this.arena.x + 20, this.arena.x + this.arena.w - 20);
          this.fx.burst(px, this.arena.y + 4, 6, { color: '#5f7d72', speed: 90, angle: Math.PI / 2, spread: 1, size: 3, life: 0.6 });
          this.fire(px, this.arena.y + 12, 0, 40, { gravity: 820, art: 'mm_pebble', r: 10, life: 3, color: '#4f6e64' });
        }
      }
      this.facing = -this.facing;
      yield 1.0;
    } else {
      this.facing = -this.facing;
      yield 0.6;
    }
  }

  // SPORE PUFFS: vents swell, then floaty spores arc up and drift down. Bonk them back!
  *spores() {
    this.facePlayer();
    this.pt.puff = 1;
    this.tele = 0.55;
    this.sfx('rustle');
    yield 0.55;
    const n = 3 + this.phase;
    const [vx, vy] = this.toWorld(-12, -this.lift() - 98);
    this.sfx('burst');
    this.fx.burst(vx, vy, 14, { color: '#9fe0c4', speed: 160, angle: -Math.PI / 2, spread: 1.6, size: 5, life: 0.8, g: -40, glow: true });
    const dir = this.dirTo();
    for (let i = 0; i < n; i++) {
      const spread = (i / (n - 1) - 0.5) * 2;
      const burst = this.phase >= 3;
      this.fire(vx, vy, dir * 90 + spread * 230 + this.rand(-30, 30), this.rand(-470, -390), {
        gravity: 260, art: 'mm_spore', r: 11, life: 6, color: '#bff5df', parry: true,
        onDie: burst ? (p) => { if (p.cy > this.groundY - 40 && this.mode === 'fight') this.fireRing(p.cx, p.cy - 6, 5, 150, { art: 'mm_spore', r: 6, life: 0.9, a0: Math.PI, color: '#bff5df' }); } : null,
      });
    }
    yield 0.45;
    this.pt.puff = 0;
    yield 0.7;
  }

  // BROOD: the shell lifts and broodlings tumble out
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

  // SHELL-SPIN (phase 3): withdraws and ricochets across the hollow, wall to wall
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
    this.fx.burst(this.cx, this.y + 30, 24, { color: '#7fbf8c', speed: 300, size: 4, life: 0.9 });
    this.fx.ring(this.cx, this.cy, 20, 200, 0.6, 'rgba(191,245,223,0.8)', 5);
    if (n === 3) this.queue.push(this.brood, this.spin);
  }

  onDeath() { this.pt.withdraw = 0; this.pt.rear = 1; this.pt.jaw = 1; this.spinning = false; }

  bodyBox() {
    if (this.spinning) return { x: this.x + 32, y: this.y + this.h - 110, w: this.w - 64, h: 110 };
    return { x: this.x + 14, y: this.y + 18, w: this.w - 28, h: this.h - 18 };
  }

  drawExtra(ctx, t) {
    // dazed stars
    if (this.dazed > 0 && this.mode === 'fight') {
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + i * TAU / 3;
        const x = this.cx + this.facing * 40 + Math.cos(a) * 26, y = this.y - 8 + Math.sin(a) * 7;
        glowDot(ctx, x, y, 10, '#bff5df', 0.5);
        ctx.fillStyle = '#efffe8'; ctx.beginPath();
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
      ctx.beginPath(); ctx.ellipse(cx, this.groundY - 2, 104 * k, 12 * k, 0, 0, TAU); ctx.fill();
    }
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(f * S, S);
    if (this.spinning) { this.drawBall(ctx, t, C, K, white); ctx.restore(); return; }

    const lift = this.lift();
    const breath = Math.sin(t * 2.2) * 0.025;
    // pivot around the rear when rearing / ducking into a charge
    const tilt = -P.rear * 0.2 + P.charge * 0.07;
    ctx.translate(-66, 0); ctx.rotate(tilt); ctx.translate(66, 0);

    // ---- many little legs in a rippling wave (far row first)
    const air = this.airborne;
    const legRow = (far) => {
      for (let i = 0; i < 7; i++) {
        const ax = -58 + i * 18 + (far ? 6 : 0);
        const ph = this.walkPh - i * 0.9 + (far ? Math.PI : 0);
        const step = this.moving ? Math.sin(ph) * 7 : Math.sin(t * 2 + i * 0.8) * 1.2;
        const up = this.moving ? Math.max(0, Math.cos(ph)) * 5 : 0;
        const top = -lift + 2;
        const foot = air ? [ax - 6, -lift * 0.35] : [ax + step + 4, -up];
        const knee = [ax + 9 + step * 0.4, top + (foot[1] - top) * 0.4 - 4];
        limb(ctx, [[ax, top], knee, foot], far ? 3.5 : 4.5, C(far ? '#17292a' : '#2f4b43'), K);
        if (!white && !far) { ctx.fillStyle = '#cfc5a8'; ctx.beginPath(); ctx.arc(foot[0] + 1, foot[1] - 1, 2, 0, TAU); ctx.fill(); }
      }
    };
    legRow(true);

    // pale ribbed belly peeking under the rim
    ctx.beginPath(); ctx.ellipse(-4, -lift + 1, 76, 9, 0, 0, TAU);
    ctx.fillStyle = C('#b9ae92'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();

    // head behind the shell while withdrawing
    if (P.withdraw > 0.4) this.drawHead(ctx, t, C, K, white, lift);

    // ---- shell: segmented woodlouse dome under a thick moss blanket
    ctx.save();
    ctx.translate(-6, -lift - 2);
    ctx.scale(1 + P.squash * 0.1 + P.birth * 0.03, 1 - P.squash * 0.13 + breath + P.birth * 0.07);
    const RX = 80, RY = 98;
    const domeY = (x) => -RY * Math.sqrt(Math.max(0, 1 - (x / RX) ** 2));
    const dome = () => { ctx.beginPath(); ctx.ellipse(0, 0, RX, RY, 0, Math.PI, TAU); ctx.quadraticCurveTo(0, 12, -RX, 0); ctx.closePath(); };
    // moss fringe bumps (drawn first, so only their outer halves show beyond the dome)
    const bumps = [];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI * (1.12 + i * 0.0475);
      const wob = Math.sin(i * 2.7) * 3;
      bumps.push([Math.cos(a) * (RX - 4 + wob), Math.sin(a) * (RY - 4 + wob), 10 + ((i * 7) % 5) + Math.sin(t * 2 + i) * 0.5]);
    }
    ctx.fillStyle = K;
    for (const [x, y, r] of bumps) { ctx.beginPath(); ctx.arc(x, y, r + 3, 0, TAU); ctx.fill(); }
    bumps.forEach(([x, y, r], i) => { ctx.fillStyle = C(i % 3 ? '#3f7a52' : '#4f8a5e'); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); });
    // dome
    dome();
    if (white) ctx.fillStyle = '#fff';
    else { const gr = ctx.createLinearGradient(0, -RY, 0, 8); gr.addColorStop(0, '#3e6d5f'); gr.addColorStop(1, '#122823'); ctx.fillStyle = gr; }
    ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 4; ctx.stroke();
    if (!white) {
      ctx.save(); dome(); ctx.clip();
      // plate seams with pale leading-edge highlights
      for (const x of [-56, -30, -4, 22, 48]) {
        const ty = domeY(x);
        ctx.strokeStyle = 'rgba(191,245,223,0.16)'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(x + 7, 2); ctx.quadraticCurveTo(x + 13, ty * 0.5, x + 5, ty); ctx.stroke();
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(x + 2, 2); ctx.quadraticCurveTo(x + 8, ty * 0.5, x, ty); ctx.stroke();
      }
      // moss blanket over the top
      ctx.beginPath(); ctx.moveTo(-RX - 5, -RY - 10);
      for (let i = 0; i <= 20; i++) {
        const x = -RX + i * (RX * 2 / 20);
        const y = domeY(x) * 0.6 + Math.sin(i * 1.9) * 5 + (i % 2) * 4;
        ctx.lineTo(x, Math.min(y, -6));
      }
      ctx.lineTo(RX + 5, -RY - 10); ctx.closePath();
      ctx.fillStyle = '#3f7a52'; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#5f9c6c';
      for (let i = 0; i < 14; i++) { const x = -66 + i * 10 + Math.sin(i * 3) * 4; ctx.beginPath(); ctx.arc(x, domeY(x) * 0.8 - 6 + Math.sin(i * 5) * 6, 5 + (i % 3) * 2, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#8fd0a0';
      for (let i = 0; i < 12; i++) { const x = -60 + i * 11; ctx.beginPath(); ctx.arc(x, domeY(x) * 0.9 - 2 + Math.sin(i * 7) * 4, 2.5 + (i % 2), 0, TAU); ctx.fill(); }
      ctx.restore();
      // highlights on the fringe bumps
      bumps.forEach(([x, y, r]) => { ctx.fillStyle = '#7fbf8c'; ctx.beginPath(); ctx.arc(x - 2, y - 2, r * 0.45, Math.PI, TAU); ctx.fill(); });
      // tiny pale flowers
      for (const i of [3, 8, 13]) {
        const [x, y] = bumps[i];
        for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + t * 0.4; ctx.fillStyle = '#f2eedc'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 3.2, y - 6 + Math.sin(a) * 3.2, 2.2, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#e8c86a'; ctx.beginPath(); ctx.arc(x, y - 6, 1.8, 0, TAU); ctx.fill();
      }
    } else {
      // keep the flash silhouette solid over the fringe
      bumps.forEach(([x, y, r]) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); });
    }
    // brood pods nestled in the moss (back half)
    for (const [px, py, s] of [[-50, -58, 1], [-26, -78, 0.85], [-64, -30, 0.8]]) {
      const sw = s * (1 + P.birth * 0.4 + Math.sin(t * 3 + px) * 0.05);
      ctx.beginPath(); ctx.ellipse(px, py, 11 * sw, 9 * sw, -0.5, 0, TAU);
      ctx.fillStyle = C('rgba(232,226,200,0.95)'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 2; ctx.stroke();
      if (!white) {
        ctx.strokeStyle = 'rgba(60,100,87,0.9)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(px, py, 5 * sw, 0.5 + t * 0.8, 4 + t * 0.8); ctx.stroke();
        glowDot(ctx, px + 2, py - 1, 10 * sw, '#bff5df', 0.25 + P.birth * 0.5);
      }
    }
    // spore vents (chimneys poking through the moss)
    for (const [vx, vy] of [[-12, -96], [16, -93]]) {
      const o = 1 + P.puff * 0.7;
      ctx.beginPath(); ctx.moveTo(vx - 6 * o, vy + 8); ctx.lineTo(vx - 5 * o, vy); ctx.lineTo(vx + 5 * o, vy); ctx.lineTo(vx + 6 * o, vy + 8); ctx.closePath();
      ctx.fillStyle = C('#5f9c8c'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(vx, vy, 5 * o, 2.5 * o, 0, 0, TAU); ctx.fillStyle = C('#cfe9dc'); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C('#0b1614'); ctx.beginPath(); ctx.ellipse(vx, vy, 3 * o, 1.4 * o, 0, 0, TAU); ctx.fill();
      if (!white && P.puff > 0.1) glowDot(ctx, vx, vy - 4, 20 * P.puff, '#bff5df', 0.6);
    }
    // hanging moss strands off the rim
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const x = -66 + i * 25 + (i % 2) * 6, L = 6 + ((i * 13) % 9) + P.squash * 4;
      const sw = Math.sin(t * 2.4 + i * 1.3) * 3 + (this.moving ? -4 : 0);
      ctx.strokeStyle = K; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, -4); ctx.quadraticCurveTo(x + sw * 0.5, L * 0.6, x + sw, L); ctx.stroke();
      ctx.strokeStyle = C('#4d8a5e'); ctx.lineWidth = 2; ctx.stroke();
    }
    // the old bell she carries, hanging off her rump
    const ba = Math.sin(t * 2.6) * 0.35 + (this.moving ? 0.3 : 0);
    ctx.save(); ctx.translate(-76, -12); ctx.rotate(ba);
    ctx.strokeStyle = K; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4, 14); ctx.quadraticCurveTo(-5, 24, -9, 28); ctx.lineTo(9, 28); ctx.quadraticCurveTo(5, 24, 4, 14); ctx.closePath();
    ctx.fillStyle = C('#a07a3a'); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    if (!white) { ctx.fillStyle = 'rgba(95,160,140,0.8)'; ctx.beginPath(); ctx.arc(-2, 22, 2.5, 0, TAU); ctx.fill(); }
    ctx.fillStyle = C('#5f9c8c'); ctx.beginPath(); ctx.arc(0, 30, 2.5, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.restore();

    if (P.withdraw <= 0.4) this.drawHead(ctx, t, C, K, white, lift);
    legRow(false);
    ctx.restore();
  }
  drawHead(ctx, t, C, K, white, lift) {
    const P = this.p;
    const sc = 1 - P.withdraw * 0.45;
    const hx = 76 - P.withdraw * 58 + P.charge * 6, hy = -lift - 38 - P.rear * 8 + P.charge * 12 + Math.sin(t * 2.2) * 1.5;
    ctx.save(); ctx.translate(hx, hy); ctx.scale(sc, sc);
    // antennae sweeping back over the shell
    for (const s of [0, 1]) {
      const sw = Math.sin(t * 1.8 + s * 1.7) * 6;
      const ex = -30 - s * 22 + sw, ey = -60 - s * 6 - P.rear * 14;
      ctx.strokeStyle = K; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(4 - s * 8, -24); ctx.bezierCurveTo(14 - s * 6, -52, -8 - s * 10 + sw, -66, ex, ey); ctx.stroke();
      ctx.strokeStyle = C('#2f4b43'); ctx.lineWidth = 1.8; ctx.stroke();
      if (!white) glowDot(ctx, ex, ey, 9, '#bff5df', 0.5 * P.wake + 0.1);
      ctx.fillStyle = C('#bff5df'); ctx.beginPath(); ctx.arc(ex, ey, 3, 0, TAU); ctx.fill();
    }
    // fur hood
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = i / 16 * TAU, r = (i % 2 ? 30 : 35) + Math.sin(t * 3 + i) * 0.8;
      ctx.lineTo(Math.cos(a) * r - 6, Math.sin(a) * r * 0.9 + 2);
    }
    ctx.closePath(); ctx.fillStyle = C('#20352f'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
    // mandibles (far one darker)
    const jaw = P.jaw;
    for (const s of [0, 1]) {
      ctx.save(); ctx.translate(8 + s * 10, 20 - s * 2); ctx.rotate(0.25 + jaw * (s ? 0.55 : -0.35));
      ctx.beginPath(); ctx.moveTo(-6, -2); ctx.quadraticCurveTo(14, -4, 20, 10); ctx.quadraticCurveTo(8, 4, -4, 6); ctx.closePath();
      ctx.fillStyle = C(s ? '#d8cfb6' : '#9c947f'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
    // pale mask
    ctx.save(); ctx.translate(6, -2); ctx.scale(0.86, 1);
    const r = 25;
    ctx.beginPath();
    ctx.moveTo(-r, 2);
    ctx.quadraticCurveTo(-r - 2, -r * 0.9, -r * 0.62, -r * 1.05);
    ctx.quadraticCurveTo(-r * 0.6, -r * 1.45, -r * 0.35, -r * 1.5);   // little ear-nub
    ctx.quadraticCurveTo(-r * 0.3, -r * 1.15, 0, -r * 1.15);
    ctx.quadraticCurveTo(r * 0.3, -r * 1.15, r * 0.35, -r * 1.5);
    ctx.quadraticCurveTo(r * 0.6, -r * 1.45, r * 0.62, -r * 1.05);
    ctx.quadraticCurveTo(r + 2, -r * 0.9, r, 2);
    ctx.quadraticCurveTo(r * 0.75, r * 0.95, 0, r * 1.05);
    ctx.quadraticCurveTo(-r * 0.75, r * 0.95, -r, 2);
    ctx.fillStyle = C('#ede6d4'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
    if (!white) {
      // brow shading + eye holes
      ctx.fillStyle = 'rgba(160,150,130,0.35)';
      ctx.beginPath(); ctx.ellipse(0, r * 0.65, r * 0.55, r * 0.25, 0, 0, TAU); ctx.fill();
      const open = this.mode === 'dormant' ? 0.15 : this.blink > 0 ? 0.2 : 1;
      ctx.fillStyle = INK;
      for (const s of [-1, 1]) {
        ctx.save(); ctx.translate(s * r * 0.42, -r * 0.05); ctx.rotate(s * -0.25);
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.25, r * 0.42 * open, 0, 0, TAU); ctx.fill();
        ctx.restore();
        if (open > 0.5) eye(ctx, s * r * 0.42 + 1, -r * 0.02, 3.2 + this.crack * 0.6, this.crack >= 2 ? '#e8fff4' : '#bff5df', true);
      }
      // cracks
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      if (this.crack >= 1) { ctx.beginPath(); ctx.moveTo(r * 0.1, -r * 1.12); ctx.lineTo(r * 0.02, -r * 0.7); ctx.lineTo(r * 0.16, -r * 0.48); ctx.stroke(); }
      if (this.crack >= 2) { ctx.beginPath(); ctx.moveTo(-r * 0.92, r * 0.2); ctx.lineTo(-r * 0.6, r * 0.38); ctx.lineTo(-r * 0.62, r * 0.66); ctx.moveTo(-r * 0.6, r * 0.38); ctx.lineTo(-r * 0.3, r * 0.45); ctx.stroke(); }
    }
    ctx.restore();
    ctx.restore();
  }

  drawBall(ctx, t, C, K, white) {
    const R = 50;
    ctx.save(); ctx.translate(0, -R - 2); ctx.rotate(this.spinAng);
    // moss bumps all around
    const n = 14;
    ctx.fillStyle = K;
    for (let i = 0; i < n; i++) { const a = i / n * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * (R - 4), Math.sin(a) * (R - 4), 12.5, 0, TAU); ctx.fill(); }
    for (let i = 0; i < n; i++) { const a = i / n * TAU; ctx.fillStyle = C(i % 2 ? '#4d8a5e' : '#5f9c6c'); ctx.beginPath(); ctx.arc(Math.cos(a) * (R - 4), Math.sin(a) * (R - 4), 10, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, 0, R - 6, 0, TAU);
    if (white) ctx.fillStyle = '#fff';
    else { const gr = ctx.createRadialGradient(-12, -12, 4, 0, 0, R); gr.addColorStop(0, '#4b7d6d'); gr.addColorStop(1, '#16302a'); ctx.fillStyle = gr; }
    ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3.5; ctx.stroke();
    if (!white) {
      ctx.strokeStyle = 'rgba(10,20,20,0.75)'; ctx.lineWidth = 2;
      for (const k of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.ellipse(0, 0, R - 8, (R - 8) * Math.abs(k) + 3, k * 2, 0, TAU); ctx.stroke(); }
      for (const [px, py] of [[-16, -18], [20, 8], [-6, 24]]) {
        ctx.fillStyle = 'rgba(232,226,200,0.9)'; ctx.beginPath(); ctx.ellipse(px, py, 8, 6, 0.3, 0, TAU); ctx.fill();
        glowDot(ctx, px, py, 10, '#bff5df', 0.4);
      }
    }
    ctx.restore();
    // motion streaks
    if (!white && this.dashing) {
      ctx.strokeStyle = 'rgba(191,245,223,0.5)'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, -R - 2, R + 8 + i * 6, Math.PI * 0.6 + i * 0.1, Math.PI * 1.15 + i * 0.1); ctx.stroke(); }
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
