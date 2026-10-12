// Bosses of area 'gardens': Petalmaw (main) and the Twin Glassmoths (optional).
import { Boss } from './boss.js';
import { TAU, clamp, lerp } from '../core/math.js';
import { INK, eye } from '../art/creatures.js';
import { registerProjectileArt } from '../entities/projectile.js';

// ------------------------------------------------------------------ helpers
function glowDot(ctx, x, y, r, col, a = 0.4) {
  if (r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}
function limb(ctx, pts, lw, col, K) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [c, w] of [[K, lw + 4], [col, lw]]) {
    ctx.strokeStyle = c; ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
}
// pointed petal from the origin outward along +x
function petalPath(ctx, len, wid) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.3, -wid, len * 0.85, -wid * 0.8, len, 0);
  ctx.bezierCurveTo(len * 0.85, wid * 0.8, len * 0.3, wid, 0, 0);
  ctx.closePath();
}
function leafPath(ctx, len, wid, curl = 0.2) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.3, -wid, len * 0.75, -wid * (0.9 + curl), len, -wid * curl * 2);
  ctx.bezierCurveTo(len * 0.7, wid * 0.5, len * 0.3, wid * 0.6, 0, 0);
  ctx.closePath();
}
const bezPt = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
};

// ------------------------------------------------------------------ projectile art
registerProjectileArt('pm_seed', (ctx, p) => {
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.age * 9);
  const r = p.r;
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.3 + 2, r + 2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = p.o.color || '#5b3a24'; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.3, r, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#efe0b8'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-r, 0); ctx.quadraticCurveTo(0, -r * 0.5, r, 0); ctx.stroke();
  ctx.fillStyle = '#d8e86c'; ctx.beginPath(); ctx.arc(r * 0.9, 0, 2, 0, TAU); ctx.fill();
  ctx.restore();
});

registerProjectileArt('pm_petal', (ctx, p, t) => {
  ctx.save(); ctx.translate(p.cx, p.cy);
  ctx.rotate(Math.sin(p.age * 4 + p.x * 0.05) * 0.9 + p.age * 1.5);
  const r = p.r;
  ctx.fillStyle = p.o.color || '#d0587a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.translate(-r * 1.1, 0);
  petalPath(ctx, r * 2.4, r * 0.75); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,235,220,0.7)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(r * 0.3, 0); ctx.lineTo(r * 1.9, 0); ctx.stroke();
  ctx.restore();
});

registerProjectileArt('gm_light', (ctx, p) => {
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.rot);
  const r = p.r;
  glowDot(ctx, 0, 0, r * 3.2, p.o.color || '#fff6c8', 0.55);
  ctx.fillStyle = '#fffdf0'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(r * 2, 0); ctx.lineTo(0, -r * 0.65); ctx.lineTo(-r * 1.3, 0); ctx.lineTo(0, r * 0.65); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = p.o.color || '#ffe9a0'; ctx.beginPath(); ctx.moveTo(r * 1.2, 0); ctx.lineTo(0, -r * 0.3); ctx.lineTo(-r * 0.6, 0); ctx.lineTo(0, r * 0.3); ctx.fill();
  ctx.restore();
});

registerProjectileArt('gm_umbra', (ctx, p, t) => {
  const r = p.r, x = p.cx, y = p.cy;
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#2a1840';
  for (let i = 0; i < p.trail.length; i++) { const q = p.trail[i]; ctx.beginPath(); ctx.arc(q.x, q.y, r * (i / p.trail.length) * 0.9, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = INK; ctx.beginPath();
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + p.age * 3, rr = r * (1.15 + (i % 2) * 0.35 + Math.sin(p.age * 9 + i) * 0.1); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.fill();
  ctx.fillStyle = '#3a2058'; ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, TAU); ctx.fill();
  eye(ctx, x - r * 0.3, y - r * 0.1, 2, '#e9a8ff', true); eye(ctx, x + r * 0.3, y - r * 0.1, 2, '#e9a8ff', true);
  ctx.restore();
});

// =================================================================== PETALMAW
// Main boss of the Gardens; Bead has Sticky Sap. Phase 1 rooted, phase 2 uprooted on root-legs,
// phase 3 frenzied. Reward: Pebble Dash.
export class Petalmaw extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'petalmaw', size: [150, 250], music: 'boss', glints: 160, introTime: 2.4 });
    this.p = { jaw: 0, rear: 0, lunge: 0, lift: 0, shiver: 0, tilt: 0, crouch: 0, wake: 0 };
    this.pt = Object.assign({}, this.p);
    this.rooted = true;
    this.walkPh = 0;
    this.lashes = []; this.spikes = [];
    this.queue = [];
    this.frenzy = 0;
    this.blink = 0;
  }

  update(dt) { super.update(dt); this.animate(dt); }

  animate(dt) {
    const P = this.p, T = this.pt, k = 1 - Math.exp(-dt * 10);
    for (const key in T) P[key] += (T[key] - P[key]) * k;
    this.moving = Math.abs(this.vx) > 5;
    if (this.moving) this.walkPh += dt * 9;
    this.blink -= dt; if (this.blink < -2.5 - Math.random() * 3) this.blink = 0.15;
    if (this.mode !== 'fight') { this.lashes.length = 0; this.spikes.length = 0; }
    // vine lashes along the floor
    for (const L of this.lashes) {
      L.t += dt * this.speedMul;
      if (L.state === 'tele' && L.t > L.tele) { L.state = 'out'; L.t = 0; this.sfx('whip'); this.shake(3, 0.2); }
      else if (L.state === 'out') { L.len = Math.min(L.max, L.max * (L.t / 0.22)); if (L.t > 0.5) { L.state = 'back'; L.t = 0; } }
      else if (L.state === 'back') { L.len = L.max * Math.max(0, 1 - L.t / 0.35); if (L.t > 0.35) L.dead = true; }
      if (L.state !== 'tele' && L.len > 10) {
        const x0 = L.x, x1 = L.x + L.dir * L.len;
        this.hits.push({ x: Math.min(x0, x1), y: this.groundY - 26, w: Math.abs(x1 - x0), h: 26 });
        if (Math.random() < 0.5) this.fx.burst(x1, this.groundY - 4, 1, { color: '#6a5a3a', speed: 120, angle: -Math.PI / 2, spread: 1.4, size: 3, life: 0.4 });
      } else if (L.state === 'tele' && Math.random() < 0.4) {
        this.fx.burst(L.x + L.dir * Math.random() * L.max, this.groundY - 2, 1, { color: '#6a5a3a', speed: 70, angle: -Math.PI / 2, spread: 0.8, size: 2.5, life: 0.35 });
      }
    }
    this.lashes = this.lashes.filter((L) => !L.dead);
    // thorn spikes erupting from the floor
    for (const s of this.spikes) {
      s.t += dt * this.speedMul;
      if (s.t > s.tele && !s.up) { s.up = true; this.sfx('thrust'); this.fx.burst(s.x, this.groundY - 4, 8, { color: '#6a5a3a', speed: 200, angle: -Math.PI / 2, spread: 1.2, size: 3.5, life: 0.5 }); }
      if (s.up) {
        const k2 = s.t - s.tele;
        s.h = k2 < 0.1 ? s.H * k2 / 0.1 : k2 < 0.45 ? s.H : Math.max(0, s.H * (1 - (k2 - 0.45) / 0.25));
        if (s.h > 12) this.hits.push({ x: s.x - 18, y: this.groundY - s.h, w: 36, h: s.h });
        if (k2 > 0.7) s.dead = true;
      }
    }
    this.spikes = this.spikes.filter((s) => !s.dead);
    if (this.mode === 'fight' && Math.random() < 0.06) {
      const [hx, hy] = this.headWorld();
      this.fx.burst(hx + this.rand(-50, 50), hy + this.rand(-40, 40), 1, { color: '#efffa8', speed: 20, size: 2, life: 1.2, g: -10, glow: true, front: false });
    }
  }

  // head position in local units (origin = base of the stalk, +x = facing)
  headLocal() {
    const P = this.p, t = this.anim;
    const base = this.rooted ? 0 : -this.legLift();
    const x = 26 + Math.sin(t * 1.3) * 8 - P.rear * 40 + P.lunge * 120 + P.tilt * -10;
    const y = base - 182 - Math.sin(t * 1.9) * 5 - P.rear * 20 + P.lunge * 128 + P.crouch * 20;
    return [x, y];
  }
  legLift() { return 66 - this.p.crouch * 20; }
  headWorld() { const [x, y] = this.headLocal(); return [this.cx + x * this.facing, this.y + this.h + y]; }

  hurtboxes() {
    const [hx, hy] = this.headWorld();
    const by = this.y + this.h, top = hy + 40;
    const boxes = [{ x: hx - 56, y: hy - 56, w: 112, h: 112 }];
    if (by - top > 10) boxes.push({ x: this.cx - 22, y: top, w: 44, h: by - top });
    if (!this.rooted) boxes.push({ x: this.cx - 48, y: by - this.legLift() - 44, w: 96, h: 64 });
    return boxes;
  }
  hurtbox() { return this.hurtboxes()[0]; }
  hitboxes() {
    const [hx, hy] = this.headWorld();
    const by = this.y + this.h, top = hy + 44;
    const boxes = [{ x: hx - 46, y: hy - 46, w: 92, h: 92 }];
    if (by - top > 10) boxes.push({ x: this.cx - 16, y: top, w: 32, h: by - top - (this.rooted ? 6 : this.legLift() * 0.5) });
    if (!this.rooted) boxes.push({ x: this.cx - 40, y: by - this.legLift() - 36, w: 80, h: 52 });
    return boxes.concat(this.hits);
  }

  onStart() { this.pt.wake = 1; this.pt.rear = 1; this.pt.jaw = 1; }
  introUpdate(dt, t) {
    if (t > 0.6 && t < 0.65) { this.sfx('screech'); this.shake(6, 1); }
    if (t > 0.6 && t < 1.6 && Math.random() < 0.5) {
      const [hx, hy] = this.headWorld();
      this.fx.burst(hx, hy, 2, { color: '#d0587a', speed: 260, size: 4, life: 0.8, shape: 'shard', g: 300 });
    }
    if (t > 1.8) { this.pt.rear = 0; this.pt.jaw = 0; }
  }

  chooseAttack() {
    if (this.queue.length) return this.queue.shift().call(this);
    return super.chooseAttack();
  }

  attackList() {
    const near = this.distX() < 240;
    if (this.rooted) {
      return [
        { name: 'lash', w: 3, fn: this.lash },
        { name: 'seeds', w: 2.4, fn: this.seeds },
        { name: 'rain', w: 1.6, fn: this.petalRain },
        { name: 'bite', w: near ? 3.2 : 0.2, fn: this.bite },
      ];
    }
    return [
      { name: 'stomp', w: 2.6, fn: this.stomp },
      { name: 'stride', w: this.distX() > 300 ? 2.4 : 0.8, fn: this.stride },
      { name: 'lash', w: 2, fn: this.lash },
      { name: 'seeds', w: 1.8, fn: this.seeds },
      { name: 'rain', w: 1.2, fn: this.petalRain },
      { name: 'bite', w: near ? 2.4 : 0.2, fn: this.bite },
      { name: 'thorns', w: this.phase >= 3 ? 2.4 : 0, fn: this.thorns },
    ].filter((a) => a.w > 0);
  }

  // VINE LASH: the floor cracks along a line, then a thorned vine whips out along it. Jump!
  *lash() {
    this.facePlayer();
    this.pt.rear = 0.5; this.pt.shiver = 1;
    this.tele = 0.6;
    this.sfx('rustle');
    const both = this.phase >= 3;
    const max = this.rooted ? 560 : 620;
    this.lashes.push({ x: this.cx + this.facing * 30, dir: this.facing, max, len: 0, t: 0, tele: 0.6, state: 'tele' });
    if (both) this.lashes.push({ x: this.cx - this.facing * 30, dir: -this.facing, max: max * 0.8, len: 0, t: 0, tele: 0.85, state: 'tele' });
    yield 0.6;
    this.pt.rear = 0; this.pt.shiver = 0; this.pt.jaw = 0.6;
    yield 0.6;
    this.pt.jaw = 0;
    if (this.phase >= 2 && Math.random() < 0.5) {
      // a second, delayed lash from the other side of the stalk
      this.facePlayer();
      this.lashes.push({ x: this.cx + this.facing * 30, dir: this.facing, max, len: 0, t: 0, tele: 0.5, state: 'tele' });
      this.tele = 0.5;
      yield 1.0;
    }
    yield 0.5;
  }

  // SEED SPIT: head reels back, swells, then spits a volley of arcing seeds
  *seeds() {
    this.facePlayer();
    const volleys = this.phase >= 3 ? 2 : 1;
    for (let v = 0; v < volleys; v++) {
      this.pt.rear = 1; this.pt.jaw = 0.3;
      this.tele = 0.55; this.sfx('charge');
      yield 0.55;
      this.pt.rear = -0.2; this.pt.jaw = 1;
      this.sfx('spit');
      const [hx, hy] = this.headWorld();
      const n = this.phase >= 2 ? 5 : 3;
      const p = this.player;
      for (let i = 0; i < n; i++) {
        const tx = p.cx + (i - (n - 1) / 2) * 120 + this.rand(-20, 20);
        const T = 1.0 + this.rand(-0.1, 0.15), G = 1100;
        const vx = (tx - hx) / T, vy = (this.groundY - 10 - hy) / T - 0.5 * G * T;
        const burst = this.phase >= 2;
        this.fire(hx + this.facing * 30, hy + 10, vx, vy, {
          gravity: G, art: 'pm_seed', r: 9, life: 4, noScale: true,
          onDie: burst ? (pr) => {
            if (this.mode !== 'fight' || pr.cy < this.groundY - 50) return;
            this.sfx('burst', 0.5);
            for (const a of [-2.2, -1.57, -0.94]) this.fire(pr.cx, pr.cy - 6, Math.cos(a) * 260, Math.sin(a) * 260, { gravity: 900, art: 'needle', color: '#d8e86c', r: 5, life: 1.2 });
          } : null,
        });
      }
      this.fx.burst(hx + this.facing * 40, hy + 10, 10, { color: '#d8e86c', speed: 220, angle: this.facing > 0 ? 0 : Math.PI, spread: 1.2, size: 3, life: 0.4 });
      yield 0.4;
      this.pt.rear = 0; this.pt.jaw = 0;
      yield 0.35;
    }
    yield 0.6;
  }

  // PETAL RAIN: shakes its bloom; petals fall from the glass roof in staggered rows
  *petalRain() {
    this.pt.tilt = 1; this.pt.shiver = 1; this.pt.jaw = 0.5;
    this.tele = 0.65; this.sfx('rustle');
    yield 0.65;
    this.sfx('burst');
    const [hx, hy] = this.headWorld();
    this.fx.burst(hx, hy - 30, 24, { color: this.petalCol(), speed: 420, angle: -Math.PI / 2, spread: 1.2, size: 5, life: 0.8, shape: 'shard', g: 200 });
    const rows = this.phase >= 2 ? 2 : 1;
    const gap = this.phase >= 3 ? 104 : 120;
    for (let r = 0; r < rows; r++) {
      const off = this.rand(0, gap) + r * gap / 2;
      for (let x = this.arena.x + off; x < this.arena.x + this.arena.w - 10; x += gap) {
        const drift = Math.sin(x * 0.03) * 30;
        this.fire(x, this.arena.y + 14, drift, this.rand(115, 150), { art: 'pm_petal', r: 10, life: 7, color: this.petalCol(), noScale: false });
      }
      yield 0.7;
    }
    this.pt.tilt = 0; this.pt.shiver = 0; this.pt.jaw = 0;
    yield 0.8;
  }

  // BITE: rears with jaws agape, then slams its head down in front. It sticks for a moment.
  *bite() {
    this.facePlayer();
    this.pt.rear = 1; this.pt.jaw = 1;
    this.tele = 0.55; this.sfx('screech');
    yield 0.55;
    this.pt.rear = 0; this.pt.lunge = 1; this.pt.jaw = 0.1;
    yield 0.12;
    this.sfx('slam'); this.shake(6, 0.25);
    const [hx, hy] = this.headWorld();
    this.zone(hx - 60, hy - 50, 120, 100, 0.15);
    this.fx.burst(hx, this.groundY - 6, 12, { color: '#6a5a3a', speed: 240, angle: -Math.PI / 2, spread: 2, size: 3.5, life: 0.5 });
    yield 0.75;   // stuck: the bloom is low and open to Bonks
    this.pt.lunge = 0;
    yield 0.6;
  }

  // ---- uprooted moves
  *uproot() {
    this.pt.rear = 1; this.pt.jaw = 1; this.pt.shiver = 1;
    this.tele = 1.2; this.sfx('bossRoar'); this.shake(8, 1.4);
    for (let i = 0; i < 12; i++) {
      this.fx.burst(this.cx + this.rand(-90, 90), this.groundY - 4, 3, { color: '#6a5a3a', speed: 260, angle: -Math.PI / 2, spread: 1.2, size: 4, life: 0.7 });
      yield 0.1;
    }
    this.rooted = false;
    this.sfx('slam');
    this.fx.burst(this.cx, this.groundY - 10, 30, { color: '#4a3a22', speed: 380, angle: -Math.PI / 2, spread: 2.2, size: 5, life: 0.9, shape: 'shard' });
    this.pt.rear = 0; this.pt.jaw = 0; this.pt.shiver = 0;
    yield 0.8;
  }

  *stomp() {
    const n = this.phase >= 3 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      this.facePlayer();
      this.pt.crouch = 1; this.tele = 0.5; this.sfx('charge');
      yield 0.5;
      this.pt.crouch = -0.3; this.sfx('leap');
      yield* this.leapTo(this.player.cx, 230, 0.9);
      this.pt.crouch = 0.6;
      this.sfx('slam'); this.shake(9, 0.4);
      this.zone(this.x - 10, this.groundY - 24, this.w + 20, 24, 0.12);
      for (const s of [-1, 1]) this.shockwave(this.cx + s * 50, s, 380, 30, { color: 'rgba(216,232,108,0.85)' });
      this.fx.burst(this.cx, this.groundY - 4, 16, { color: '#6a5a3a', speed: 280, angle: -Math.PI / 2, spread: 2.4, size: 4, life: 0.6 });
      yield 0.25;
      this.pt.crouch = 0;
      yield 0.35;
    }
    yield 0.5;
  }

  *stride() {
    this.facePlayer();
    const T = this.rand(0.9, 1.4);
    for (let t = 0; t < T && !this.hitWall; t += 1 / 60) {
      this.vx = this.facing * (150 + this.phase * 25);
      if (this.distX() < 160) break;
      yield;
    }
    this.vx = 0;
    if (this.distX() < 260) yield* this.bite();
    else yield 0.3;
  }

  // THORN BURST (phase 3): cracks race toward Bead, then thorned roots erupt one by one
  *thorns() {
    this.facePlayer();
    this.pt.crouch = 0.8; this.pt.jaw = 1; this.tele = 0.5; this.sfx('rustle');
    yield 0.4;
    const dir = this.facing;
    for (let i = 0; i < 7; i++) {
      const x = this.cx + dir * (110 + i * 115);
      if (x < this.arena.x + 10 || x > this.arena.x + this.arena.w - 10) break;
      this.spikes.push({ x, t: 0, tele: 0.5, H: 120, h: 0 });
      yield 0.14;
    }
    this.pt.crouch = 0; this.pt.jaw = 0;
    yield 1.1;
  }

  petalCol() { return this.frenzy ? '#e0304a' : '#d0587a'; }

  onPhase(n) {
    this.speedMul *= 1.07;
    if (n === 2) { this.queue.length = 0; this.queue.push(this.uproot); }
    if (n === 3) {
      this.frenzy = 1; this.speedMul *= 1.08;
      this.sfx('bossRoar'); this.shake(8, 0.8); this.tele = 1;
      const [hx, hy] = this.headWorld();
      this.fx.burst(hx, hy, 30, { color: '#e0304a', speed: 380, size: 5, life: 0.9, shape: 'shard', g: 300 });
      this.fx.ring(hx, hy, 30, 260, 0.7, 'rgba(255,120,140,0.8)', 6);
      this.queue.push(this.thorns);
    }
  }

  onDeath() { this.lashes.length = 0; this.spikes.length = 0; this.pt.jaw = 1; this.pt.rear = 1; this.pt.lunge = 0; }

  drawExtra(ctx, t) {
    const gy = this.groundY;
    for (const L of this.lashes) {
      if (L.state === 'tele') {
        // cracked, glowing seam in the floor
        const k = L.t / L.tele;
        ctx.strokeStyle = `rgba(239,255,168,${0.25 + 0.45 * k})`; ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) { const x = L.x + L.dir * L.max * i / 24; ctx.lineTo(x, gy - 2 - (i % 2) * 3); }
        ctx.stroke();
        continue;
      }
      // the vine itself
      const n = Math.max(2, Math.floor(L.len / 16));
      const pts = [];
      for (let i = 0; i <= n; i++) { const d = L.len * i / n; pts.push([L.x + L.dir * d, gy - 12 - Math.sin(d * 0.05 - t * 20) * 6 * (i / n)]); }
      limb(ctx, pts, 12, '#3f6a2e', INK);
      ctx.strokeStyle = '#79a85b'; ctx.lineWidth = 3; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - 3) : ctx.moveTo(x, y - 3))); ctx.stroke();
      // thorns
      ctx.fillStyle = '#efe6cf'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      for (let i = 1; i < pts.length; i += 2) {
        const [x, y] = pts[i], s = i % 4 === 1 ? -1 : 1;
        ctx.beginPath(); ctx.moveTo(x - 5, y + s * 5); ctx.lineTo(x + L.dir * 4, y + s * 15); ctx.lineTo(x + 5, y + s * 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // biting tip
      const [tx, ty] = pts[pts.length - 1];
      ctx.save(); ctx.translate(tx, ty); ctx.scale(L.dir, 1);
      ctx.beginPath(); ctx.moveTo(-4, -10); ctx.quadraticCurveTo(18, -14, 22, 0); ctx.quadraticCurveTo(18, 12, -4, 10); ctx.closePath();
      ctx.fillStyle = this.petalCol(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore();
    }
    for (const s of this.spikes) {
      if (!s.up) {
        const k = s.t / s.tele;
        ctx.fillStyle = `rgba(239,255,168,${0.2 + 0.5 * k})`;
        ctx.beginPath(); ctx.ellipse(s.x, gy - 2, 22, 5, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(s.x - 18, gy - 1); ctx.lineTo(s.x - 6, gy - 5); ctx.lineTo(s.x + 4, gy - 1); ctx.lineTo(s.x + 16, gy - 4); ctx.stroke();
        continue;
      }
      if (s.h < 2) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(s.x - 40, gy - 200, 80, 200); ctx.clip();
      ctx.beginPath(); ctx.moveTo(s.x - 20, gy); ctx.quadraticCurveTo(s.x - 12, gy - s.h * 0.6, s.x + 2, gy - s.h); ctx.quadraticCurveTo(s.x + 6, gy - s.h * 0.5, s.x + 20, gy); ctx.closePath();
      ctx.fillStyle = '#3f6a2e'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#efe6cf'; ctx.lineWidth = 1.5;
      for (let i = 1; i < 4; i++) {
        const y = gy - s.h * i / 4, x = s.x - 10 + i * 3, sd = i % 2 ? -1 : 1;
        ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + sd * 14, y - 8); ctx.lineTo(x, y + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawBody(ctx, t, white) {
    const C = (c) => (white ? '#fff' : c);
    const K = white ? '#fff' : INK;
    const P = this.p, f = this.facing;
    const cx = this.cx, by = this.y + this.h;
    const [hx, hy] = this.headLocal();
    const shiv = P.shiver * Math.sin(t * 50) * 2;
    if (!white) {
      const air = Math.max(0, this.groundY - by), k = 1 / (1 + air / 200);
      ctx.fillStyle = `rgba(0,0,0,${0.4 * k})`; ctx.beginPath(); ctx.ellipse(cx, this.groundY - 2, 100 * k, 11 * k, 0, 0, TAU); ctx.fill();
    }
    ctx.save(); ctx.translate(cx, by); ctx.scale(f, 1);
    const baseY = this.rooted ? 0 : -this.legLift();

    // ---- roots: spread into the soil (rooted) or walking legs (uprooted)
    if (this.rooted) {
      for (let i = 0; i < 6; i++) {
        const s = i < 3 ? -1 : 1, k = i % 3;
        const ex = s * (60 + k * 34), sw = Math.sin(t * 1.5 + i) * 2;
        limb(ctx, [[s * 10, -14], [s * (30 + k * 12), -10 + k * 2 + sw], [ex, 2]], 7 - k * 1.5, C('#5a4a2a'), K);
      }
      // soil mound
      ctx.beginPath(); ctx.ellipse(0, 2, 70, 14, 0, Math.PI, TAU); ctx.fillStyle = C('#2b2416'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
    } else {
      for (let i = 0; i < 5; i++) {
        const far = i % 2 === 1;
        const ph = this.walkPh + i * 1.3;
        const step = this.moving ? Math.sin(ph) * 16 : Math.sin(t * 1.6 + i) * 3;
        const up = this.moving ? Math.max(0, Math.cos(ph)) * 10 : 0;
        const ax = -32 + i * 16, ex = -62 + i * 31 + step;
        const kx = ax + (ax > 0 ? 26 : -26) + step * 0.3;
        limb(ctx, [[ax, baseY + 10], [kx, baseY + 26 - P.crouch * 10], [(ax + ex) / 2 + step * 0.5, baseY + 52], [ex, -up]], far ? 6 : 8, C(far ? '#3e3320' : '#5a4a2a'), K);
        ctx.fillStyle = C('#3e3320'); ctx.beginPath(); ctx.moveTo(ex - 6, -up); ctx.lineTo(ex + 10, -up + 1); ctx.lineTo(ex + 2, -up - 5); ctx.closePath(); ctx.fill();
      }
      // root bulb
      ctx.beginPath(); ctx.ellipse(0, baseY + 2, 48, 30, 0, 0, TAU);
      ctx.fillStyle = C('#4a3c22'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3.5; ctx.stroke();
      if (!white) {
        ctx.strokeStyle = 'rgba(22,20,28,0.45)'; ctx.lineWidth = 1.5;
        for (const a of [-0.6, 0, 0.6]) { ctx.beginPath(); ctx.ellipse(0, baseY + 2, 40, 22, a, 0.3, 2.6); ctx.stroke(); }
        ctx.fillStyle = 'rgba(30,24,14,0.9)'; for (const [x, y] of [[-20, 10], [14, 18], [26, -4]]) { ctx.beginPath(); ctx.arc(x, baseY + y, 3, 0, TAU); ctx.fill(); }
      }
    }

    // ---- big base leaves
    const leaf = (x, y, ang, len, wid, col) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      leafPath(ctx, len, wid); ctx.fillStyle = C(col); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
      if (!white) { ctx.strokeStyle = 'rgba(22,20,28,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(len * 0.5, -wid * 0.35, len * 0.95, -wid * 0.35); ctx.stroke();
        for (let i = 1; i < 4; i++) { const lx = len * i / 4.5; ctx.beginPath(); ctx.moveTo(lx, -wid * 0.18 * i / 2); ctx.lineTo(lx + len * 0.12, -wid * 0.55); ctx.stroke(); } }
      ctx.restore();
    };
    const lsw = Math.sin(t * 1.4) * 0.06;
    leaf(-6, baseY - 10, Math.PI + 0.35 + lsw, 92, 30, '#335a28');
    leaf(6, baseY - 14, -0.5 - lsw, 84, 26, '#3f6a2e');

    // ---- stalk: braided vine from base to head
    const p0 = [0, baseY - 8], p3 = [hx - 8, hy + 50];
    const sway = Math.sin(t * 1.3) * 18;
    const p1 = [-30 + sway * 0.4, baseY - 70], p2 = [hx - 40 + sway, hy + 120];
    const stalkPts = []; for (let i = 0; i <= 16; i++) stalkPts.push(bezPt(p0, p1, p2, p3, i / 16));
    limb(ctx, stalkPts, 34, C('#2f5426'), K);
    if (!white) {
      for (const [col, off, w] of [['#4f8a3a', 0, 4], ['#79a85b', Math.PI, 2.5]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
        stalkPts.forEach(([x, y], i) => { const o = Math.sin(i * 1.2 + off) * 8; i ? ctx.lineTo(x + o, y) : ctx.moveTo(x + o, y); });
        ctx.stroke();
      }
    }
    // thorns along the stalk
    for (let i = 2; i < stalkPts.length - 2; i += 2) {
      const [x, y] = stalkPts[i], [x2, y2] = stalkPts[i + 1];
      const a = Math.atan2(y2 - y, x2 - x) + (i % 4 ? Math.PI / 2 : -Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 12 - 4, y + Math.sin(a) * 12);
      ctx.lineTo(x + Math.cos(a) * 24, y + Math.sin(a) * 24); ctx.lineTo(x + Math.cos(a) * 12 + 4, y + Math.sin(a) * 12 + 4); ctx.closePath();
      ctx.fillStyle = C('#efe6cf'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 1.8; ctx.stroke();
    }
    // a small leaf midway
    const mid = stalkPts[8];
    leaf(mid[0] - 6, mid[1], Math.PI + 0.9 + lsw * 2, 46, 15, '#3f6a2e');

    // ---- head
    ctx.save();
    ctx.translate(hx + shiv, hy);
    ctx.rotate(-P.rear * 0.25 + P.lunge * 0.55 - P.tilt * 0.6 + Math.sin(t * 1.1) * 0.05);
    const open = 1 + P.jaw * 0.15 + Math.sin(t * 2) * 0.02;
    const pc = this.petalCol();
    // sepals (green collar leaves) behind
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.rotate(Math.PI * 0.35 + i * 0.25); ctx.translate(30, 0);
      petalPath(ctx, 54, 14); ctx.fillStyle = C('#335a28'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore();
    }
    // back petals (darker), then front petals
    for (const [ring, n, len, wid, col, rot] of [[0, 10, 92, 30, white ? '#fff' : this.frenzy ? '#8a1f34' : '#8e3452', 0.31], [1, 9, 78, 28, pc, 0]]) {
      for (let i = 0; i < n; i++) {
        const a = rot + i / n * TAU + Math.sin(t * 1.7 + i) * 0.04 + (ring ? t * 0.05 : -t * 0.03);
        const L = len * open * (1 + Math.sin(t * 3 + i * 2) * 0.03);
        ctx.save(); ctx.rotate(a); ctx.scale(0.82, 1); ctx.translate(18, 0);
        petalPath(ctx, L, wid);
        if (white) ctx.fillStyle = '#fff';
        else { const g = ctx.createLinearGradient(0, 0, L, 0); g.addColorStop(0, ring ? '#5a1830' : '#3a1020'); g.addColorStop(0.45, col); g.addColorStop(1, ring ? '#f6dccf' : col); ctx.fillStyle = g; }
        ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
        if (!white && ring) {
          ctx.strokeStyle = 'rgba(40,10,20,0.45)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(L * 0.5, -3, L * 0.85, 0); ctx.stroke();
          ctx.fillStyle = 'rgba(40,10,20,0.6)';
          for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(L * (0.3 + k * 0.12), (k % 2 ? 5 : -5), 1.8, 0, TAU); ctx.fill(); }
        }
        ctx.restore();
      }
    }
    // the face: maw + bony mask
    ctx.save(); ctx.scale(0.9, 1); ctx.translate(8, 0);
    const R = 44;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = C('#3a1020'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3.5; ctx.stroke();
    // mouth (opens downward)
    const mo = 6 + P.jaw * 26;
    ctx.beginPath(); ctx.ellipse(0, 12, 32, mo, 0, 0, TAU); ctx.fillStyle = C('#12060a'); ctx.fill();
    if (!white && P.jaw > 0.2) {
      glowDot(ctx, 0, 14, 26 * P.jaw, '#efffa8', 0.6 * P.jaw);
      ctx.fillStyle = '#d8e86c';
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(-12 + k * 6, 14 + Math.sin(t * 6 + k) * 3, 2, 0, TAU); ctx.fill(); }
    }
    // teeth (top and bottom rows)
    ctx.fillStyle = C('#f3ead6'); ctx.strokeStyle = K; ctx.lineWidth = 1.5;
    for (let k = 0; k < 7; k++) {
      const x = -26 + k * 8.6;
      const yt = 12 - mo * Math.sqrt(Math.max(0, 1 - (x / 32) ** 2));
      const yb = 12 + mo * Math.sqrt(Math.max(0, 1 - (x / 32) ** 2));
      ctx.beginPath(); ctx.moveTo(x - 3.5, yt - 1); ctx.lineTo(x, yt + 8); ctx.lineTo(x + 3.5, yt - 1); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 3, yb + 1); ctx.lineTo(x + 1, yb - 7); ctx.lineTo(x + 4, yb + 1); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // pale mask plate over the upper face
    ctx.beginPath();
    ctx.moveTo(-36, -4);
    ctx.quadraticCurveTo(-40, -36, -14, -42);
    ctx.lineTo(-8, -52); ctx.lineTo(-2, -43); ctx.lineTo(6, -54); ctx.lineTo(12, -42);
    ctx.quadraticCurveTo(38, -36, 36, -4);
    ctx.quadraticCurveTo(26, 12 - mo * 0.6, 0, 10 - mo * 0.7);
    ctx.quadraticCurveTo(-26, 12 - mo * 0.6, -36, -4);
    ctx.closePath();
    ctx.fillStyle = C('#efe6cf'); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 3; ctx.stroke();
    if (!white) {
      const eo = this.blink > 0 || this.mode === 'dormant' ? 0.18 : 1;
      ctx.fillStyle = INK;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 14, -18, 8, 11 * eo, s * 0.35, 0, TAU); ctx.fill(); }
      const ec = this.frenzy ? '#ffd0a0' : '#efffa8';
      if (eo > 0.5) for (const s of [-1, 1]) eye(ctx, s * 14 + 1, -16, 3.6 + this.frenzy, ec, true, this.frenzy ? 'angry' : 'round');
      if (this.phase >= 2) { ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(4, -50); ctx.lineTo(0, -36); ctx.lineTo(6, -28); ctx.stroke(); }
      if (this.frenzy) { ctx.beginPath(); ctx.moveTo(-34, -10); ctx.lineTo(-24, -6); ctx.lineTo(-22, 2); ctx.stroke(); }
    }
    ctx.restore();
    ctx.restore();
    ctx.restore();
  }
}


// =================================================================== TWIN GLASSMOTHS
// Optional. Lumen & Lacuna: two stained-glass moths, one boss, one shared health pool.
// One holds the LIGHT role (beams, prism shards), the other the SHADOW role (blink-dashes, umbra orbs).
// Every few attacks (and at each phase) they spiral together and trade roles.
// Bead has Sticky Sap, Pebble Dash, Dandelion and Lodestone.
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function mix(a, b, k, alpha = 1) {
  const A = hex(a), B = hex(b);
  return `rgba(${Math.round(lerp(A[0], B[0], k))},${Math.round(lerp(A[1], B[1], k))},${Math.round(lerp(A[2], B[2], k))},${alpha})`;
}
const MOTH = {
  // [light, shadow]
  pane1: ['#fff8e0', '#4a2f78'], pane2: ['#ffd36a', '#2a1c4a'], pane3: ['#ffeab0', '#7448a6'],
  fur: ['#efe4c8', '#2c2438'], furHi: ['#fffaf0', '#4a3a60'], abd: ['#d8c69c', '#231b30'],
  glow: ['#fff3c0', '#c58cff'], eye: ['#fff4b0', '#e9a8ff'],
};

export class Glassmoths extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'glassmoths', size: [70, 60], air: true, music: 'boss', glints: 180, introTime: 2.6 });
    this.noPhysics = true;
    const cy = this.groundY - 250;
    this.moths = [0, 1].map((i) => ({
      idx: i, name: i ? 'Lacuna' : 'Lumen', role: i ? 'shadow' : 'light', roleK: i,
      x: this.cx + (i ? 110 : -110), y: cy - 40, vx: 0, vy: 0,
      sx: this.cx + (i ? 110 : -110), sy: cy - 40, retarget: 0,
      alpha: 1, tele: 0, flashT: 0, locked: false, flap: i * 1.7, aim: null, rest: 0, facing: i ? -1 : 1, ghost: false,
    }));
    this.beams = [];
    this.queue = [];
    this.sinceSwap = 0;
    this.crack = 0;
  }

  get light() { return this.moths.find((m) => m.role === 'light'); }
  get shadow() { return this.moths.find((m) => m.role === 'shadow'); }
  get midX() { return this.arena.x + this.arena.w / 2; }

  update(dt) { super.update(dt); this.animate(dt); }

  animate(dt) {
    const g = this.game, p = this.player, A = this.arena;
    for (const m of this.moths) {
      m.flap += dt * (m.role === 'shadow' ? 11 : 8) * (this.mode === 'dormant' ? 0.4 : 1);
      m.flashT -= dt; if (m.tele > 0) m.tele -= dt;
      m.roleK += ((m.role === 'shadow' ? 1 : 0) - m.roleK) * (1 - Math.exp(-dt * 4));
      if (this.mode === 'dying') {
        m.vy = Math.min(m.vy + 500 * dt, 300); m.vx *= 0.98;
        m.x += m.vx * dt; m.y = Math.min(m.y + m.vy * dt, this.groundY - 26);
        m.alpha = Math.min(1, m.alpha + dt * 2);
        continue;
      }
      if (this.mode === 'fight' && !m.locked) {
        m.retarget -= dt; m.rest -= dt;
        if (m.retarget <= 0 && m.rest <= 0) this.pickStation(m);
      }
      if (!m.locked) {
        const wob = Math.sin(this.anim * 1.3 + m.idx * 2) * 18;
        const ax = (m.sx + wob - m.x) * 7 - m.vx * 4.2, ay = (m.sy + Math.sin(this.anim * 2.1 + m.idx) * 10 - m.y) * 7 - m.vy * 4.2;
        m.vx += ax * dt; m.vy += ay * dt;
        m.x += m.vx * dt; m.y += m.vy * dt;
      }
      m.x = clamp(m.x, A.x + 40, A.x + A.w - 40);
      m.y = clamp(m.y, A.y + 40, this.groundY - 26);
      if (this.mode !== 'dormant') m.facing = p.cx < m.x ? -1 : 1;
      // ambient motes: glints of light / curls of shadow
      if (this.mode !== 'dormant' && Math.random() < 0.15 * m.alpha) {
        const sh = m.roleK > 0.5;
        g.fx.burst(m.x + this.rand(-40, 40), m.y + this.rand(-20, 30), 1, { color: sh ? '#5b3a8a' : '#fff1c4', speed: 30, size: sh ? 4 : 2, life: 0.9, g: sh ? 30 : -20, glow: !sh, front: false });
      }
    }
    // keep the boss entity centred between the twins (bars, death fx, camera)
    const mx = (this.moths[0].x + this.moths[1].x) / 2, my = (this.moths[0].y + this.moths[1].y) / 2;
    this.x = mx - this.w / 2; this.y = my - this.h / 2;
    // beams
    for (const b of this.beams) {
      b.t += dt * this.speedMul;
      if (!b.on && b.t >= b.tele) { b.on = true; this.sfx('laser'); this.shake(3, 0.15); }
      if (b.on) {
        if (this.mode === 'fight') {
          if (b.kind === 'v') this.hits.push({ x: b.x - b.w / 2, y: A.y, w: b.w, h: this.groundY - A.y });
          else this.hits.push({ x: A.x, y: b.y - b.w / 2, w: A.w, h: b.w });
        }
        if (b.kind === 'v' && Math.random() < 0.6) g.fx.burst(b.x, this.groundY - 4, 1, { color: '#fff1c4', speed: 220, angle: -Math.PI / 2, spread: 2, size: 2.5, life: 0.4, glow: true });
        if (b.t > b.tele + b.dur) b.dead = true;
      }
      if (this.mode !== 'fight') b.dead = true;
    }
    this.beams = this.beams.filter((b) => !b.dead);
  }

  pickStation(m) {
    const p = this.player, A = this.arena;
    const other = this.moths[1 - m.idx];
    let side = other.sx < p.cx ? 1 : -1;
    if (Math.random() < 0.25) side = -side;
    const light = m.role === 'light';
    m.sx = clamp(p.cx + side * this.rand(170, 320), A.x + 70, A.x + A.w - 70);
    m.sy = this.groundY - (light ? this.rand(250, 320) : this.rand(190, 250));
    m.retarget = this.rand(1.4, 2.2);
  }
  station(m, x, y, hold = 1.5) {
    const A = this.arena;
    m.sx = clamp(x, A.x + 60, A.x + A.w - 60); m.sy = clamp(y, A.y + 50, this.groundY - 40); m.retarget = hold;
  }
  *settle(m, maxT = 1) {
    for (let t = 0; t < maxT; t += 1 / 60) { if (Math.hypot(m.sx - m.x, m.sy - m.y) < 30) break; yield; }
  }

  box(m, pad) { return { x: m.x - pad[0], y: m.y - pad[1], w: pad[0] * 2, h: pad[1] * 2 }; }
  hurtboxes() { return this.moths.filter((m) => m.alpha > 0.5).map((m) => this.box(m, [38, 30])); }
  hurtbox() { return this.hurtboxes()[0] || null; }
  hitboxes() { return this.moths.filter((m) => m.alpha > 0.5).map((m) => ({ x: m.x - 24, y: m.y - 30, w: 48, h: 62 })).concat(this.hits); }

  hurt(dmg, dir, src) {
    if (this.hittable && this.mode === 'fight') {
      const p = this.player;
      const vis = this.moths.filter((m) => m.alpha > 0.5);
      const m = vis.sort((a, b) => Math.hypot(a.x - p.cx, a.y - p.cy) - Math.hypot(b.x - p.cx, b.y - p.cy))[0];
      if (m) { m.flashT = 0.1; this.fx.burst(m.x, m.y, 4, { color: m.roleK > 0.5 ? '#c58cff' : '#fff1c4', speed: 200, size: 3, life: 0.4, shape: 'shard' }); }
    }
    super.hurt(dmg, dir, src);
  }

  idle() { for (const m of this.moths) { m.sx = m.x; m.sy = m.y; } }
  onStart() {
    for (const m of this.moths) { m.tele = 1.2; this.station(m, this.cx + (m.idx ? 220 : -220), this.groundY - (m.idx ? 230 : 300), 2.6); }
  }
  introUpdate(dt, t) {
    if (t > 0.8 && t < 0.85) { this.sfx('glassHit'); this.sfx('phase'); for (const m of this.moths) this.fx.ring(m.x, m.y, 10, 120, 0.6, m.idx ? 'rgba(197,140,255,0.8)' : 'rgba(255,243,192,0.9)', 4); }
  }

  chooseAttack() {
    if (this.queue.length) return this.queue.shift().call(this);
    this.sinceSwap++;
    return super.chooseAttack();
  }

  attackList() {
    if (this.sinceSwap > 3) return [{ name: 'swap', fn: this.swap }];
    return [
      { name: 'pillars', w: 2, fn: this.pillars },
      { name: 'prism', w: 1.8, fn: this.prism },
      { name: 'sweep', w: 1.6, fn: this.sweep },
      { name: 'dash', w: 2.4, fn: this.dash },
      { name: 'shade', w: 1.6, fn: this.shade },
      { name: 'eclipse', w: 2.6, fn: this.eclipse, cond: () => this.phase >= 3 },
    ];
  }

  // ---- LIGHT: pillars of light stab down from the glass roof (thin flickering lines first)
  pushPillars(waves) {
    const p = this.player, A = this.arena;
    for (let w = 0; w < waves; w++) {
      const base = p.cx + (w % 2 ? 95 : 0) + this.rand(-20, 20);
      for (let k = -2; k <= 2; k++) {
        const x = base + k * 190;
        if (x < A.x + 20 || x > A.x + A.w - 20) continue;
        this.beams.push({ kind: 'v', x, w: 46, t: -w * 0.75, tele: 0.75, dur: 0.35 });
      }
    }
  }
  *pillars() {
    const L = this.light;
    this.station(L, this.player.cx + this.rand(-120, 120), this.arena.y + 90, 2.5);
    L.tele = 0.8; this.sfx('charge');
    const waves = Math.min(3, this.phase);
    this.pushPillars(waves);
    yield 0.75 * waves + 0.6;
    yield 0.5;
  }

  // ---- LIGHT: a fan of prism shards
  *prism() {
    const L = this.light, p = this.player;
    this.station(L, p.cx + (L.x < p.cx ? -260 : 260), this.groundY - 230, 2.5);
    yield* this.settle(L, 0.6);
    L.tele = 0.55; this.sfx('charge');
    yield 0.55;
    const volleys = this.phase >= 2 ? 2 : 1;
    for (let v = 0; v < volleys; v++) {
      this.sfx('glassHit');
      for (let i = -2; i <= 2; i++) this.fireAt(L.x, L.y, 340, { art: 'gm_light', r: 9, life: 3.5, offset: i * 0.2 + (v ? 0.1 : 0), color: '#ffe9a0' });
      this.fx.ring(L.x, L.y, 6, 60, 0.3, 'rgba(255,243,192,0.9)', 3);
      yield 0.45;
    }
    yield 0.6;
  }

  // ---- LIGHT: from a wall, a horizontal beam sweeps across - low (jump it) or chest-high (stay down)
  *sweep() {
    const L = this.light, p = this.player, A = this.arena;
    const low = Math.random() < 0.55;
    const side = p.cx < this.midX ? 1 : -1;
    const wx = side > 0 ? A.x + A.w - 50 : A.x + 50;
    const y = low ? this.groundY - 30 : this.groundY - 104;
    this.station(L, wx, this.groundY - 260, 3);
    yield* this.settle(L, 0.8);
    this.station(L, wx, y - (low ? 40 : 0), 3);
    yield* this.settle(L, 0.6);
    L.tele = 0.8; this.sfx('charge');
    this.beams.push({ kind: 'h', y, w: 34, t: 0, tele: 0.8, dur: 0.42 });
    yield 1.3;
    L.rest = 0.6;
    yield 0.4;
  }

  // ---- SHADOW: fades out, reappears with a dark aim-line through Bead, then blink-dashes along it
  *dash() {
    const D = this.shadow, A = this.arena;
    const n = this.phase;
    D.locked = true;
    for (let i = 0; i < n; i++) {
      this.sfx('phase');
      for (let k = 0; k < 16; k++) { D.alpha = 1 - (k / 16) * 0.92; yield; }
      const p = this.player;
      const room = (dir) => (dir > 0 ? A.x + A.w - p.cx : p.cx - A.x);
      const side = room(1) > room(-1) ? 1 : -1;
      D.x = clamp(p.cx + side * this.rand(280, 340), A.x + 50, A.x + A.w - 50);
      D.y = clamp(p.cy - this.rand(50, 150), A.y + 50, this.groundY - 60);
      D.vx = D.vy = 0;
      const ang = Math.atan2(p.cy - D.y, p.cx - D.x);
      D.aim = { x: D.x, y: D.y, a: ang };
      D.tele = 0.55;
      for (let k = 0; k < 12; k++) { D.alpha = 0.08 + (k / 12) * 0.92; yield; }
      D.alpha = 1;
      yield 0.4;
      this.sfx('dash');
      D.aim = null;
      const c = Math.cos(ang), s = Math.sin(ang);
      for (let d = 0; d < 780;) {
        const st = 960 * this.speedMul / 60;
        D.x += c * st; D.y += s * st; d += st;
        if (Math.random() < 0.8) this.fx.burst(D.x, D.y, 1, { color: '#2a1840', speed: 40, size: 7, life: 0.5, g: 0, front: false });
        if (D.x < A.x + 40 || D.x > A.x + A.w - 40 || D.y > this.groundY - 30 || D.y < A.y + 40) break;
        yield;
      }
      D.vx = c * 200; D.vy = s * 200;
      yield 0.25;
    }
    // winded: hovers low for a moment (an opening)
    D.locked = false;
    this.station(D, D.x, this.groundY - 150, 1.2); D.rest = 1.1;
    yield 1.0;
  }

  // ---- SHADOW: looses slow, gently homing umbra orbs
  *shade() {
    const D = this.shadow, p = this.player;
    this.station(D, p.cx + this.rand(-220, 220), this.groundY - 300, 2.5);
    yield* this.settle(D, 0.7);
    D.tele = 0.55; this.sfx('charge');
    yield 0.55;
    const n = this.phase >= 3 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.55;
      this.fire(D.x, D.y, Math.cos(a) * 170, Math.sin(a) * 170, { art: 'gm_umbra', r: 10, life: 3.4, homing: 1.4, color: '#c58cff', ignoreWalls: true });
      this.sfx('spit', 0.6);
      yield 0.12;
    }
    yield 0.9;
  }

  // ---- BOTH (phase 3): pillars fall while the shadow dashes
  *eclipse() {
    const L = this.light;
    this.station(L, this.midX, this.arena.y + 90, 3);
    L.tele = 0.8; this.sfx('charge');
    this.pushPillars(2);
    yield* this.dash();
  }

  // ---- SWAP: they spiral together and trade light for shadow
  *swap() {
    this.sinceSwap = 0;
    const cx = clamp(this.player.cx, this.arena.x + 200, this.arena.x + this.arena.w - 200), cy = this.groundY - 290;
    for (const m of this.moths) { m.locked = true; m.alpha = 1; m.aim = null; m.tele = 1.4; }
    this.sfx('charge');
    const R = 70;
    let a = Math.atan2(this.moths[0].y - cy, this.moths[0].x - cx);
    const start = this.moths.map((m) => [m.x, m.y]);
    const T = 1.2;
    for (let t = 0; t < T; t += 1 / 60) {
      a += 0.09 * this.speedMul;
      const k = Math.min(1, t / 0.5);
      this.moths.forEach((m, i) => {
        const ox = cx + Math.cos(a + i * Math.PI) * R, oy = cy + Math.sin(a + i * Math.PI) * R * 0.6;
        m.x = lerp(start[i][0], ox, k); m.y = lerp(start[i][1], oy, k);
      });
      if (Math.random() < 0.5) this.fx.burst(cx + this.rand(-R, R), cy + this.rand(-30, 30), 1, { color: Math.random() < 0.5 ? '#fff1c4' : '#7448a6', speed: 60, size: 3, life: 0.6, glow: true });
      yield;
    }
    this.sfx('glassHit'); this.sfx('phase'); this.shake(4, 0.3);
    this.fx.ring(cx, cy, 20, 220, 0.6, 'rgba(255,243,192,0.9)', 5);
    for (const m of this.moths) m.role = m.role === 'light' ? 'shadow' : 'light';
    if (this.phase >= 2) {
      const n = 12;
      for (let i = 0; i < n; i++) {
        const ang = i / n * TAU + a;
        this.fire(cx, cy, Math.cos(ang) * 190, Math.sin(ang) * 190, i % 2 ? { art: 'gm_light', r: 7, life: 3.5, color: '#ffe9a0' } : { art: 'gm_umbra', r: 9, life: 3.5, ignoreWalls: true });
      }
    }
    for (const m of this.moths) { m.locked = false; m.vx = (m.x - cx) * 3; m.vy = (m.y - cy) * 3; this.pickStation(m); }
    yield 0.9;
  }

  onPhase(n) {
    this.crack = n - 1;
    this.speedMul *= 1.07;
    this.sfx('bossRoar');
    this.shake(6, 0.6);
    for (const m of this.moths) { m.tele = 0.9; this.fx.ring(m.x, m.y, 10, 160, 0.6, 'rgba(255,255,255,0.8)', 5); }
    this.queue.push(this.swap);
  }

  onDeath() {
    this.beams.length = 0;
    for (const m of this.moths) {
      m.locked = true; m.aim = null; m.alpha = 1; m.vy = -120; m.vx = this.rand(-60, 60);
      this.fx.burst(m.x, m.y, 24, { color: m.roleK > 0.5 ? '#7448a6' : '#fff1c4', speed: 300, size: 4, life: 1, shape: 'shard', glow: true });
    }
  }

  // tele glow is per-moth, so skip the base glow; draw beams under the moths
  draw(ctx, t) {
    const tele = this.tele; this.tele = 0;
    this.drawBeams(ctx, t);
    super.draw(ctx, t);
    this.tele = tele;
  }

  drawBeams(ctx, t) {
    const A = this.arena, gy = this.groundY;
    for (const b of this.beams) {
      if (b.t < 0) continue;
      const vert = b.kind === 'v';
      if (!b.on) {
        const k = b.t / b.tele;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,243,192,${(0.15 + 0.5 * k) * (0.7 + 0.3 * Math.sin(t * 40))})`;
        ctx.lineWidth = 2 + k * 3;
        ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 120;
        ctx.beginPath();
        if (vert) { ctx.moveTo(b.x, A.y); ctx.lineTo(b.x, gy); } else { ctx.moveTo(A.x, b.y); ctx.lineTo(A.x + A.w, b.y); }
        ctx.stroke(); ctx.setLineDash([]);
        if (vert) glowDot(ctx, b.x, gy - 4, 26 * k + 4, '#fff3c0', 0.6); else glowDot(ctx, this.light.x, b.y, 30 * k + 6, '#fff3c0', 0.7);
        ctx.restore();
        continue;
      }
      const k = Math.min(1, (b.t - b.tele) / 0.06), fade = Math.min(1, (b.tele + b.dur - b.t) / 0.12);
      const W = b.w * k;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const [ww, col] of [[W * 1.8, 'rgba(255,220,140,0.25)'], [W, 'rgba(255,240,190,0.6)'], [W * 0.45, 'rgba(255,255,245,0.95)']]) {
        ctx.fillStyle = col; ctx.globalAlpha = fade;
        if (vert) ctx.fillRect(b.x - ww / 2, A.y, ww, gy - A.y); else ctx.fillRect(A.x, b.y - ww / 2, A.w, ww);
      }
      ctx.restore();
      ctx.save(); ctx.globalAlpha = fade * 0.9; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      if (vert) { ctx.beginPath(); ctx.moveTo(b.x - W / 2, A.y); ctx.lineTo(b.x - W / 2, gy); ctx.moveTo(b.x + W / 2, A.y); ctx.lineTo(b.x + W / 2, gy); ctx.stroke(); }
      ctx.restore();
    }
  }

  drawExtra(ctx, t) {
    // shadow dash aim lines
    for (const m of this.moths) {
      if (!m.aim) continue;
      const { x, y, a } = m.aim;
      const L = 780;
      ctx.save();
      ctx.strokeStyle = `rgba(150,90,220,${0.35 + 0.3 * Math.sin(t * 30)})`; ctx.lineWidth = 6;
      ctx.setLineDash([16, 10]); ctx.lineDashOffset = t * 200;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.stroke();
      ctx.strokeStyle = 'rgba(22,20,28,0.6)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
  }

  drawBody(ctx, t, white) {
    const flashOnly = white && this.moths.some((m) => m.flashT > 0);
    // draw the shadow role first so the light one glows on top
    const order = [...this.moths].sort((a, b) => b.roleK - a.roleK);
    for (const m of order) {
      if (flashOnly && m.flashT <= 0) continue;
      this.drawMoth(ctx, t, m, white);
    }
  }

  drawMoth(ctx, t, m, white) {
    const k = m.roleK;
    const C = (pair, a = 1) => (white ? '#fff' : mix(pair[0], pair[1], k, a));
    const K = white ? '#fff' : INK;
    const flap = Math.sin(m.flap);
    ctx.save();
    ctx.translate(m.x, m.y + Math.sin(m.flap * 0.5) * 2);
    ctx.globalAlpha = m.alpha;
    // aura
    if (!white) {
      if (k < 0.5) glowDot(ctx, 0, 0, 120, '#fff3c0', 0.28 * (1 - k * 2) + Math.max(0, m.tele) * 0.5);
      else {
        const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 110);
        g.addColorStop(0, `rgba(30,14,48,${0.5 * (k - 0.5) * 2})`); g.addColorStop(1, 'rgba(30,14,48,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 110, 0, TAU); ctx.fill();
        if (m.tele > 0) glowDot(ctx, 0, 0, 90, '#c58cff', Math.min(0.7, m.tele));
      }
      if (m.tele > 0 && k < 0.5) {
        ctx.strokeStyle = `rgba(255,243,192,${Math.min(0.8, m.tele)})`; ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t * 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 60, Math.sin(a) * 60); ctx.lineTo(Math.cos(a) * 80, Math.sin(a) * 80); ctx.stroke(); }
      }
    }
    // ---- wings (hind first, then fore), mirrored left/right
    const wing = (side, fore) => {
      ctx.save();
      ctx.scale(side, 1);
      const lift = fore ? -0.15 - flap * 0.45 : 0.35 - flap * 0.3;
      ctx.translate(6, fore ? -6 : 6);
      ctx.rotate(lift);
      ctx.scale(1, 0.92 + flap * 0.08);
      const path = () => {
        ctx.beginPath();
        if (fore) {
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(24, -40, 70, -62, 104, -52);
          ctx.quadraticCurveTo(112, -30, 96, -12);
          ctx.bezierCurveTo(70, 6, 30, 12, 0, 6);
        } else {
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(30, -6, 70, 4, 76, 30);
          ctx.quadraticCurveTo(70, 56, 40, 58);
          ctx.bezierCurveTo(18, 52, 4, 30, 0, 8);
        }
        ctx.closePath();
      };
      path();
      if (white) { ctx.fillStyle = '#fff'; ctx.fill(); }
      else {
        ctx.save(); path(); ctx.clip();
        // stained-glass panes
        const pa = lerp(0.9, 0.78, k);
        const cols = [C(MOTH.pane1, pa), C(MOTH.pane2, pa), C(MOTH.pane3, pa)];
        const N = fore ? 5 : 4;
        for (let i = 0; i < N; i++) {
          const a0 = (fore ? -1.25 : -0.3) + i * (fore ? 0.34 : 0.42), a1 = a0 + (fore ? 0.34 : 0.42);
          for (let r = 0; r < 2; r++) {
            ctx.beginPath(); ctx.moveTo(0, 0);
            const r0 = r ? 60 : 0, r1 = r ? 140 : 60;
            ctx.arc(0, 0, r1, a0, a1); if (r) ctx.arc(0, 0, r0, a1, a0, true);
            ctx.closePath();
            ctx.fillStyle = cols[(i + r * 2 + (fore ? 0 : 1)) % 3]; ctx.fill();
          }
        }
        // lead lines
        ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
        for (let i = 0; i <= N; i++) {
          const a = (fore ? -1.25 : -0.3) + i * (fore ? 0.34 : 0.42);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 140, Math.sin(a) * 140); ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(0, 0, 60, -2, 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, fore ? 90 : 46, -2, 2); ctx.stroke();
        // ocellus: Lumen bears a sun, Lacuna a crescent (they keep their marks when roles swap)
        if (fore) {
          const ox = 66, oy = -30;
          ctx.fillStyle = C(['#16141c', '#efe4c8']); ctx.beginPath(); ctx.arc(ox, oy, 11, 0, TAU); ctx.fill();
          ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = C(MOTH.eye);
          if (m.idx === 0) { ctx.beginPath(); ctx.arc(ox, oy, 5, 0, TAU); ctx.fill(); }
          else { ctx.beginPath(); ctx.arc(ox, oy, 6, 0, TAU); ctx.fill(); ctx.fillStyle = C(['#16141c', '#efe4c8']); ctx.beginPath(); ctx.arc(ox + 3, oy - 2, 5, 0, TAU); ctx.fill(); }
        }
        // gloss
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(fore ? 20 : 14, fore ? -22 : 14); ctx.quadraticCurveTo(fore ? 50 : 34, fore ? -44 : 18, fore ? 80 : 50, fore ? -46 : 36); ctx.stroke();
        ctx.restore();
      }
      path(); ctx.strokeStyle = K; ctx.lineWidth = 3.2; ctx.stroke();
      // fringe on the trailing edge
      if (!white && fore) {
        ctx.strokeStyle = C(MOTH.furHi, 0.8); ctx.lineWidth = 1.2;
        for (let i = 0; i < 6; i++) { const x = 30 + i * 12, y = 8 - i * 3.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 6); ctx.stroke(); }
      }
      ctx.restore();
    };
    for (const side of [-1, 1]) wing(side, false);
    for (const side of [-1, 1]) wing(side, true);

    // ---- abdomen (segmented, tapering)
    for (let i = 4; i >= 0; i--) {
      const y = 12 + i * 8, r = 12 - i * 1.6;
      ctx.beginPath(); ctx.ellipse(Math.sin(t * 2 + i * 0.5) * i * 0.6, y, r, 6.5, 0, 0, TAU);
      ctx.fillStyle = C(i % 2 ? MOTH.abd : MOTH.fur); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 2; ctx.stroke();
    }
    // ---- thorax with fluffy ruff
    ctx.beginPath(); ctx.ellipse(0, 0, 15, 17, 0, 0, TAU); ctx.fillStyle = C(MOTH.fur); ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = K;
    for (let i = 0; i < 11; i++) { const a = Math.PI * (0.95 + i * 0.11); ctx.beginPath(); ctx.arc(Math.cos(a) * 16, -12 + Math.sin(a) * 8, 7.5, 0, TAU); ctx.fill(); }
    for (let i = 0; i < 11; i++) { const a = Math.PI * (0.95 + i * 0.11); ctx.fillStyle = C(i % 2 ? MOTH.fur : MOTH.furHi); ctx.beginPath(); ctx.arc(Math.cos(a) * 16, -12 + Math.sin(a) * 8, 5.5, 0, TAU); ctx.fill(); }
    // ---- feathered antennae
    for (const s of [-1, 1]) {
      const sw = Math.sin(t * 2.4 + s + m.idx) * 3;
      const ex = s * 30 + sw, ey = -62;
      ctx.strokeStyle = K; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(s * 5, -30);
      ctx.quadraticCurveTo(s * 10, -54, ex, ey); ctx.stroke();
      ctx.strokeStyle = C(MOTH.furHi, 0.9); ctx.lineWidth = 1.3;
      for (let i = 1; i < 7; i++) {
        const q = i / 7;
        const px = lerp(s * 5, ex, q) + s * Math.sin(q * 3) * 4, py = lerp(-30, ey, q);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + s * 7, py + 3); ctx.moveTo(px, py); ctx.lineTo(px - s * 5, py - 4); ctx.stroke();
      }
    }
    // ---- pale mask with glowing eyes
    const hx = m.facing * 2;
    ctx.beginPath();
    ctx.moveTo(hx - 14, -24);
    ctx.quadraticCurveTo(hx - 15, -40, hx, -40);
    ctx.quadraticCurveTo(hx + 15, -40, hx + 14, -24);
    ctx.quadraticCurveTo(hx + 11, -12, hx, -10);
    ctx.quadraticCurveTo(hx - 11, -12, hx - 14, -24);
    ctx.fillStyle = white ? '#fff' : '#efe8d8'; ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 2.5; ctx.stroke();
    if (!white) {
      ctx.fillStyle = INK;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + s * 6, -26, 4.5, 6.5, s * -0.3, 0, TAU); ctx.fill(); }
      const ec = mix(MOTH.eye[0], MOTH.eye[1], k);
      for (const s of [-1, 1]) eye(ctx, hx + s * 6 + m.facing, -25, 2.2 + this.crack * 0.3, ec, true);
      if (this.crack >= 1) { ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(hx + 3, -40); ctx.lineTo(hx + 1, -33); ctx.lineTo(hx + 4, -30); ctx.stroke(); }
      if (this.crack >= 2) { ctx.beginPath(); ctx.moveTo(hx - 13, -20); ctx.lineTo(hx - 8, -17); ctx.stroke(); }
    }
    ctx.restore();
  }
}

export default { petalmaw: Petalmaw, glassmoths: Glassmoths };
