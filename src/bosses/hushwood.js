// Bosses of Hushwood: the Sporecap Elder (main, grants Dandelion) and Hush (optional silent owl).
import { Boss, registerMinion } from './boss.js';
import { TAU, clamp } from '../core/math.js';
import { TILE, VIEW_W, VIEW_H } from '../core/constants.js';
import { INK, eye } from '../art/creatures.js';
import { registerProjectileArt } from '../entities/projectile.js';

// ------------------------------------------------------------------ shared helpers
function inkS(ctx, white, lw = 3) { ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }
function fs(ctx, white, fill, lw = 3) { ctx.fillStyle = white ? '#fff' : fill; ctx.fill(); inkS(ctx, white, lw); ctx.stroke(); }
function glow(ctx, x, y, r, color, a = 1) {
  if (!(r > 0)) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha *= a;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}
function pickAttack(boss, list) {
  list = list.filter((a) => a.w > 0);
  if (!list.length) return null;
  const pool = list.length > 1 ? list.filter((a) => a.name !== boss.lastAttack) : list;
  const total = pool.reduce((s, a) => s + a.w, 0);
  let r = Math.random() * total;
  let pk = pool[pool.length - 1];
  for (const a of pool) { r -= a.w; if (r <= 0) { pk = a; break; } }
  boss.lastAttack = pk.name;
  return pk.fn.call(boss);
}
const easeIO = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

// ------------------------------------------------------------------ projectile art
registerProjectileArt('sc_cloud', (ctx, p, t) => {
  const r = p.rect();
  const fade = Math.min(1, p.life * 2) * Math.min(1, p.age * 6);
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  ctx.save();
  ctx.globalAlpha = fade;
  // puffs of lilac spore-smoke with an ink rim
  const puffs = 7;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < puffs; i++) {
      const a = (i / puffs) * TAU + t * 0.4 + p.seed;
      const px = cx + Math.cos(a) * r.w * 0.3, py = cy + Math.sin(a) * r.h * 0.26;
      const pr = Math.min(r.w, r.h) * (0.3 + 0.06 * Math.sin(t * 2 + i));
      ctx.beginPath(); ctx.arc(px, py, pr + (pass ? 0 : 2.5), 0, TAU);
      ctx.fillStyle = pass ? 'rgba(160,120,210,0.55)' : 'rgba(22,20,28,0.55)';
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const a = t * 1.3 + i * 1.05 + p.seed;
    const px = cx + Math.cos(a) * r.w * 0.35, py = cy + Math.sin(a * 1.3) * r.h * 0.3;
    ctx.fillStyle = 'rgba(234,216,255,0.7)';
    ctx.beginPath(); ctx.arc(px, py, 2, 0, TAU); ctx.fill();
  }
  ctx.restore();
});

registerProjectileArt('sc_bomb', (ctx, p, t) => {
  ctx.save();
  ctx.translate(p.cx, p.cy);
  ctx.rotate(p.age * 6);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, p.r + 2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#8e70c4'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e9dcff';
  for (const [x, y, s] of [[-3, -4, 3], [4, 1, 2.2], [-2, 5, 1.8]]) { ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < p.trail.length; i += 2) {
    const q = p.trail[i];
    ctx.fillStyle = `rgba(200,170,255,${0.08 * i})`; ctx.beginPath(); ctx.arc(q.x, q.y, p.r * 0.7, 0, TAU); ctx.fill();
  }
  ctx.restore();
});

// ------------------------------------------------------------------ minions
registerMinion({
  id: 'sporeling', name: 'Sporeling', hp: 12, dmg: 1, size: [26, 28], behavior: 'hopper',
  params: { interval: 1.1, vx: 190, vy: 560, sight: 900 },
  art: { body: 'shroom', c1: '#8b6fc0', c2: '#ead8ff', c3: '#e8dcf0' }, weight: 1,
  journal: 'A child of the Elder, shaken loose from the gills. It hops toward anything warm, wanting to be tucked in.',
});

// ==================================================================================================
// SPORECAP ELDER — The Softest Voice. An ancient mushroom with a drowsy pale face. Everything he does
// is a lullaby: lingering spore clouds, a sleep pulse you must dash through, spore-bomb lobs,
// sporelings, and a heavy cap-slam that bounces. Under his broad brim it is safe and quiet.
// ==================================================================================================
export class SporecapElder extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'sporecap', size: [180, 196], music: 'boss_mid', glints: 160, introTime: 2.6 });
    if (this.dead) return;
    this.light = 200;
    this.squash = 0; this.inhale = 0; this.awake = 0; this.walkT = 0; this.mouth = 0; this.eyeOpen = 0.2;
    this.marks = []; this.rings = []; this.inhaleV = 0;
    this.dt = 1 / 60; this.moteT = 0;
  }

  update(dt) {
    this.dt = dt;
    super.update(dt);
    if (this.dead) return;
    this.squash *= Math.pow(0.02, dt);
    const targetEye = this.mode === 'dormant' ? 0.05 : this.eyeWide ? 1 : (this.phase >= 3 ? 0.55 : 0.32);
    this.eyeOpen += (targetEye - this.eyeOpen) * Math.min(1, dt * 6);
    this.mouth += ((this.mouthOpen ? 1 : 0) - this.mouth) * Math.min(1, dt * 8);
    this.inhaleV = (this.inhaleV || 0) + (this.inhale - (this.inhaleV || 0)) * Math.min(1, dt * 5);
    // constant drifting spores from under the cap
    this.moteT -= dt;
    if (this.moteT <= 0 && this.mode !== 'dying') {
      this.moteT = this.mode === 'dormant' ? 0.25 : 0.08;
      this.fx.add({ x: this.cx + this.rand(-110, 110), y: this.y + this.h - 110 + this.rand(-6, 6), vx: this.rand(-20, 20), vy: this.rand(10, 40), life: this.rand(1.5, 2.6), size: this.rand(1.2, 2.4), color: 'rgba(220,200,255,0.8)', g: -12, drag: 0.5, glow: true, front: false });
    }
  }

  idle(dt) { this.walkT += dt * 0.3; }
  introUpdate(dt, t) {
    this.awake = clamp(t / 1.6, 0, 1);
    if (t > 1.0 && t < 1.05) { this.eyeWide = true; this.mouthOpen = true; this.sfx('rustle'); }
    if (t > 2.0) { this.eyeWide = false; this.mouthOpen = false; }
  }

  think(dt) {
    const p = this.player;
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i];
      m.t += dt;
      if (m.t >= m.dur) { this.marks.splice(i, 1); if (m.done) m.done(); }
    }
    // sleep pulse rings: harmless only while dashing through them
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.r += r.speed * this.speedMul * dt;
      if (r.r > r.max) { this.rings.splice(i, 1); continue; }
      const d = Math.hypot(p.cx - r.x, p.cy - r.y);
      if (Math.abs(d - r.r) < 15 && p.invuln <= 0 && !p.dead && p.b.mode !== 'dash') {
        p.hurt(1, r.x);
        this.fx.burst(p.cx, p.cy, 10, { color: '#ead8ff', speed: 160, size: 2.5, life: 0.5, glow: true });
      }
    }
  }
  addMark(m) { this.marks.push(Object.assign({ t: 0 }, m)); }
  onDeath() { this.marks.length = 0; this.rings.length = 0; this.eyeWide = false; this.mouthOpen = true; }

  chooseAttack() {
    const d = this.distX(), p = this.phase;
    return pickAttack(this, [
      { name: 'amble', w: d > 380 ? 2 : 0.4, fn: this.amble },
      { name: 'clouds', w: 2.5, fn: this.clouds },
      { name: 'pulse', w: 2, fn: this.pulse },
      { name: 'bombs', w: 2.5, fn: this.bombs },
      { name: 'sporelings', w: p >= 2 && this.minions.length < 3 ? 1.5 : (this.minions.length < 1 ? 0.6 : 0), fn: this.sporelings },
      { name: 'slam', w: 2.2, fn: this.capSlam },
    ]);
  }

  faceX() { return this.cx + this.facing * 14; }
  faceY() { return this.y + this.h - 66; }
  get L() { return this.arena.x; }
  get R() { return this.arena.x + this.arena.w; }

  // brim protects: contact damage only from the stalk and the cap above the brim
  hitboxes() {
    const s = this.squash * 30;
    return [
      { x: this.cx - 46, y: this.y + this.h - 112 + s, w: 92, h: 112 - s },
      { x: this.cx - 112, y: this.y + 6 + s, w: 224, h: this.h - 122 },
      ...this.hits,
    ];
  }
  hurtbox() { return { x: this.cx - 112, y: this.y + 6, w: 224, h: this.h - 6 }; }

  // --------------------------------------------------------------- attacks
  *amble() {
    this.facePlayer();
    let t = 0;
    const dur = this.rand(0.9, 1.4);
    while (t < dur) {
      t += this.dt;
      this.vx = this.facing * (70 + this.phase * 15);
      this.walkT += this.dt * 3;
      yield;
    }
    this.vx = 0;
    yield 0.2;
  }

  *clouds() {
    this.facePlayer();
    this.inhale = 1; this.tele = 0.6; this.mouthOpen = true;
    this.sfx('rustle');
    yield 0.6;
    this.inhale = 0;
    this.sfx('burst');
    const n = 2 + this.phase;
    const G = this.groundY;
    const xs = [];
    const p = this.player;
    xs.push(clamp(p.cx, this.L + 70, this.R - 70));
    for (let tries = 0; xs.length < n && tries < 40; tries++) {
      const x = this.rand(this.L + 70, this.R - 70);
      if (xs.every((o) => Math.abs(o - x) > 230)) xs.push(x);
    }
    const life = 2.6 + this.phase * 0.5;
    xs.forEach((x, i) => {
      const air = i > 0 && i % 2 === 0;
      const w = 118, h = 92;
      const y = air ? G - 210 : G - h;
      this.addMark({ kind: 'cloud', x, y: y + h / 2, w, h, dur: 0.65 + i * 0.12, done: () => {
        const z = this.zone(x - w / 2, y, w, h, life, { art: 'sc_cloud' });
        z.seed = Math.random() * 6;
      } });
    });
    for (let i = 0; i < 18; i++) this.fx.add({ x: this.faceX(), y: this.faceY() + 10, vx: this.facing * this.rand(80, 260), vy: this.rand(-80, 40), life: 0.9, size: this.rand(3, 6), color: 'rgba(190,160,235,0.55)', g: -20, drag: 2, front: false });
    yield 0.4;
    this.mouthOpen = false;
    yield 0.7;
  }

  *pulse() {
    this.facePlayer();
    this.eyeWide = true; this.tele = 0.8;
    this.sfx('warn');
    // spores spiral inward while he gathers the lullaby
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * TAU, d = this.rand(120, 200);
      this.fx.add({ x: this.faceX() + Math.cos(a) * d, y: this.faceY() + Math.sin(a) * d, vx: -Math.cos(a) * d * 1.3, vy: -Math.sin(a) * d * 1.3, life: 0.7, size: 2.5, color: '#ead8ff', g: 0, drag: 0, glow: true });
    }
    yield 0.8;
    const n = this.phase >= 3 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const fx = this.faceX(), fy = this.faceY();
      const max = Math.hypot(Math.max(fx - this.L, this.R - fx), Math.max(fy - this.arena.y, this.groundY - fy)) + 60;
      this.rings.push({ x: fx, y: fy, r: 30, speed: 320, max });
      this.sfx('bell');
      this.shake(3, 0.3);
      this.mouthOpen = true;
      if (k < n - 1) { this.tele = 0.55; yield 0.7; }
    }
    yield 0.6;
    this.eyeWide = false; this.mouthOpen = false;
    yield 0.5;
  }

  *bombs() {
    this.facePlayer();
    this.inhale = 0.6; this.tele = 0.5;
    this.sfx('charge');
    yield 0.5;
    this.inhale = 0; this.squash = 0.4;
    const n = 2 + this.phase;
    const p = this.player;
    for (let i = 0; i < n; i++) {
      const tx = clamp(p.cx + (i - (n - 1) / 2) * 120 + this.rand(-25, 25), this.L + 20, this.R - 20);
      const x0 = this.cx + this.rand(-50, 50), y0 = this.y + 30;
      const T = 1.0 + i * 0.06, g = 1000;
      const ty = this.groundY - 10;
      this.fire(x0, y0, (tx - x0) / T, (ty - y0) / T - 0.5 * g * T, { gravity: g, art: 'sc_bomb', r: 10, life: 3, onDie: (pr) => this.bombBurst(pr) });
      this.sfx('spit');
      yield 0.08;
    }
    yield 1.1;
  }
  bombBurst(pr) {
    if (pr.life <= 0 || this.mode !== 'fight') return;
    this.sfx('burst');
    this.fx.burst(pr.cx, pr.cy, 14, { color: '#c6a8f0', speed: 200, size: 3, life: 0.5, glow: true });
    const z = this.zone(pr.cx - 34, pr.cy - 40, 68, 52, 0.9, { art: 'sc_cloud' });
    z.seed = Math.random() * 6;
    if (this.phase >= 2) for (let i = 0; i < 4; i++) {
      const a = -Math.PI * (0.15 + i * 0.233);
      this.fire(pr.cx, pr.cy - 10, Math.cos(a) * 130, Math.sin(a) * 130, { art: 'orb', color: '#c6a8f0', r: 6, life: 1.3 });
    }
  }

  *sporelings() {
    this.tele = 0.5; this.inhale = 0.8;
    this.sfx('rustle');
    const ty = Math.floor((this.groundY - 1) / TILE);
    const xs = [this.cx - 160, this.cx + 160].map((x) => clamp(x, this.L + 40, this.R - 40));
    for (const x of xs) this.addMark({ kind: 'sprout', x, y: this.groundY, dur: 0.6, done: () => { const m = this.summon('sporeling', Math.floor(x / TILE), ty); if (m) m.facing = m.dirToPlayer(); } });
    yield 0.6;
    this.inhale = 0;
    yield 0.8;
  }

  *capSlam() {
    this.facePlayer();
    const bounces = this.phase;
    for (let b = 0; b < bounces; b++) {
      this.squash = 1; this.tele = b === 0 ? 0.55 : 0.4;
      this.sfx('charge');
      yield b === 0 ? 0.55 : 0.4;
      this.sfx('leap');
      yield* this.leapTo(this.player.cx, 260, 0.85);
      this.squash = 1.2;
      this.sfx('slam'); this.shake(9, 0.4);
      this.fx.burst(this.cx, this.groundY, 24, { color: '#b8a0dc', speed: 320, angle: -Math.PI / 2, spread: 2.8, size: 3.5, life: 0.7 });
      if (this.phase >= 2) {
        this.shockwave(this.cx - 80, -1, 380, 30, { color: 'rgba(210,180,255,0.9)' });
        this.shockwave(this.cx + 80, 1, 380, 30, { color: 'rgba(210,180,255,0.9)' });
      }
      for (let i = 0; i < 10; i++) this.fx.add({ x: this.cx + this.rand(-110, 110), y: this.y + this.h - 110, vx: this.rand(-60, 60), vy: this.rand(-80, 0), life: 1.5, size: 3, color: 'rgba(220,200,255,0.8)', g: -10, drag: 1, glow: true });
      this.facePlayer();
    }
    yield 0.9;
  }

  onPhase(n) {
    this.sfx('bossRoar'); this.shake(5, 0.6); this.tele = 0.9;
    this.fx.burst(this.cx, this.y + 50, 30, { color: '#ead8ff', speed: 260, size: 3, life: 1, glow: true });
    if (n === 3) this.speedMul *= 1.1;
  }

  // --------------------------------------------------------------- drawing
  drawExtra(ctx, t) {
    for (const m of this.marks) {
      const k = m.t / m.dur;
      ctx.save();
      if (m.kind === 'cloud') {
        ctx.globalAlpha = 0.25 + 0.35 * k;
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = 'rgba(214,180,255,0.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(m.x, m.y, m.w * 0.5 * (0.5 + 0.5 * k), m.h * 0.5 * (0.5 + 0.5 * k), 0, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        glow(ctx, m.x, m.y, m.w * 0.5 * k, 'rgba(180,140,230,0.6)', 0.6);
      } else if (m.kind === 'sprout') {
        ctx.fillStyle = `rgba(22,20,28,${0.6 * k})`;
        ctx.beginPath(); ctx.ellipse(m.x, m.y - 2, 20 * k + 6, 5, 0, 0, TAU); ctx.fill();
        for (let i = 0; i < 3; i++) { ctx.fillStyle = '#b8a0dc'; ctx.beginPath(); ctx.arc(m.x + Math.sin(t * 30 + i * 2) * 14 * k, m.y - 6 - ((t * 80 + i * 13) % 20), 2, 0, TAU); ctx.fill(); }
      }
      ctx.restore();
    }
    // sleep rings
    for (const r of this.rings) {
      const fade = Math.min(1, (r.max - r.r) / 300);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = INK; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(230,214,255,0.95)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(190,150,255,0.35)'; ctx.lineWidth = 22;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      // drowsy 'z' glyphs riding the ring
      ctx.fillStyle = 'rgba(245,236,255,0.9)'; ctx.font = 'italic 16px Georgia, serif'; ctx.textAlign = 'center';
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + r.r * 0.002; ctx.fillText('z', r.x + Math.cos(a) * (r.r - 16), r.y + Math.sin(a) * (r.r - 16) + 5); }
      ctx.restore();
    }
  }

  drawBody(ctx, t, white) {
    const f = this.facing;
    const cx = this.cx, by = this.y + this.h;
    const breathe = Math.sin(t * 1.4) * 0.03 + this.inhaleV * 0.08;
    const sq = this.squash;
    const sway = Math.sin(t * 0.9) * 0.025;
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(f, 1);
    const stalkTop = -112 + sq * 26;
    // ---- root feet
    for (let i = 0; i < 5; i++) {
      const x = -46 + i * 23, w = Math.sin(t * 2 + i) * 2 + (this.vx ? Math.sin(this.walkT * 6 + i * 2) * 5 : 0);
      ctx.beginPath(); ctx.moveTo(x - 9, -14); ctx.quadraticCurveTo(x - 10 + w, -2, x - 4 + w * 1.5 + (i - 2) * 5, 2); ctx.quadraticCurveTo(x + 6 + w, -2, x + 9, -14); ctx.closePath();
      fs(ctx, white, '#b9a7cf', 2.5);
    }
    // ---- stalk
    ctx.save();
    ctx.rotate(sway);
    ctx.beginPath();
    ctx.moveTo(-52 - sq * 8, -8);
    ctx.bezierCurveTo(-60 - sq * 10, stalkTop * 0.5, -36, stalkTop * 0.8, -40, stalkTop);
    ctx.lineTo(40, stalkTop);
    ctx.bezierCurveTo(36, stalkTop * 0.8, 60 + sq * 10, stalkTop * 0.5, 52 + sq * 8, -8);
    ctx.quadraticCurveTo(0, 2, -52 - sq * 8, -8);
    fs(ctx, white, '#e4d9ec', 3.5);
    if (!white) {
      const g = ctx.createLinearGradient(-55, 0, 55, 0);
      g.addColorStop(0, 'rgba(90,60,130,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(90,60,130,0.25)');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(110,80,150,0.4)'; ctx.lineWidth = 1.6;
      for (const x of [-34, -20, 22, 36]) { ctx.beginPath(); ctx.moveTo(x, -12); ctx.quadraticCurveTo(x * 1.1, stalkTop * 0.5, x * 0.85, stalkTop + 10); ctx.stroke(); }
    }
    // ---- the face: pale, old, drowsy
    const fx0 = 16, fy0 = stalkTop + 44;
    ctx.beginPath();
    ctx.moveTo(fx0 - 30, fy0 - 22);
    ctx.quadraticCurveTo(fx0 - 32, fy0 + 14, fx0 - 14, fy0 + 30);
    ctx.quadraticCurveTo(fx0, fy0 + 38, fx0 + 16, fy0 + 30);
    ctx.quadraticCurveTo(fx0 + 34, fy0 + 14, fx0 + 32, fy0 - 22);
    ctx.quadraticCurveTo(fx0, fy0 - 30, fx0 - 30, fy0 - 22);
    fs(ctx, white, '#f4efe8', 3);
    if (!white) {
      // brow wrinkles
      ctx.strokeStyle = 'rgba(22,20,28,0.4)'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(fx0 - 14, fy0 - 20 + i * 4); ctx.quadraticCurveTo(fx0, fy0 - 23 + i * 4, fx0 + 16, fy0 - 20 + i * 4); ctx.stroke(); }
      // eyes under heavy lids
      const open = this.eyeOpen;
      for (const s of [-1, 1]) {
        const ex = fx0 + s * 13, ey = fy0 - 6;
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.ellipse(ex, ey, 7.5, 9, 0, 0, TAU); ctx.fill();
        if (open > 0.08) eye(ctx, ex, ey + 2 - (1 - open) * 2, 2.6 + open * 1.4, this.phase >= 3 ? '#fff0ff' : '#d6b4ff', true);
        // the lid comes down from above
        ctx.fillStyle = '#e8e0ea';
        ctx.beginPath(); ctx.ellipse(ex, ey - 9 + (1 - open) * 2, 8.5, 9 * (1 - open) + 0.5, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ex - 8, ey - 9 + 18 * (1 - open) * 0.5 + 0); ctx.quadraticCurveTo(ex, ey - 5 + 16 * (1 - open) * 0.6, ex + 8, ey - 9 + 18 * (1 - open) * 0.5); ctx.stroke();
      }
      // small round sleepy mouth
      const mo = this.mouth;
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(fx0 + 2, fy0 + 16, 3 + mo * 3, 1.5 + mo * 6, 0, 0, TAU); ctx.fill();
      // rosy spore-cheeks
      ctx.fillStyle = 'rgba(200,140,220,0.3)';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(fx0 + s * 20, fy0 + 8, 6, 4, 0, 0, TAU); ctx.fill(); }
    }
    // ---- mycelium beard, swaying to the ground
    const bc = white ? '#fff' : '#d8cce8';
    for (let i = 0; i < 9; i++) {
      const x = fx0 - 18 + i * 4.5;
      const L = 40 + (i % 3) * 10 + Math.sin(i * 1.7) * 6;
      const sw = Math.sin(t * 1.3 + i * 0.6) * 6;
      ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.moveTo(x, fy0 + 26); ctx.quadraticCurveTo(x + sw * 0.5, fy0 + 26 + L * 0.5, x + sw, fy0 + 26 + L); ctx.stroke();
      ctx.strokeStyle = bc; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(x, fy0 + 26); ctx.quadraticCurveTo(x + sw * 0.5, fy0 + 26 + L * 0.5, x + sw, fy0 + 26 + L); ctx.stroke();
    }
    // ---- a gnarled root cane in a rooty hand
    const caneX = 64 + Math.sin(t * 0.9) * 2;
    ctx.beginPath(); ctx.moveTo(caneX - 4, -2); ctx.quadraticCurveTo(caneX + 6, stalkTop * 0.5, caneX - 2, stalkTop * 0.8); ctx.quadraticCurveTo(caneX - 10, stalkTop * 0.95, caneX - 2, stalkTop * 1.02);
    ctx.lineTo(caneX + 4, stalkTop * 0.98); ctx.quadraticCurveTo(caneX - 2, stalkTop * 0.9, caneX + 5, stalkTop * 0.8); ctx.quadraticCurveTo(caneX + 13, stalkTop * 0.5, caneX + 4, -2); ctx.closePath();
    fs(ctx, white, '#6b5743', 2.5);
    ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(38, stalkTop * 0.55); ctx.quadraticCurveTo(52, stalkTop * 0.5, caneX + 2, stalkTop * 0.62); ctx.stroke();
    ctx.strokeStyle = white ? '#fff' : '#cbbbe0'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(38, stalkTop * 0.55); ctx.quadraticCurveTo(52, stalkTop * 0.5, caneX + 2, stalkTop * 0.62); ctx.stroke();
    // ---- skirt (annulus) under the cap
    ctx.beginPath();
    ctx.moveTo(-44, stalkTop + 4);
    for (let i = 0; i <= 8; i++) ctx.lineTo(-44 + i * 11, stalkTop + 14 + (i % 2 ? 6 : 0) + Math.sin(t * 2 + i) * 1.5);
    ctx.lineTo(44, stalkTop + 4); ctx.closePath();
    fs(ctx, white, '#d3c4e6', 2.5);
    ctx.restore();

    // ---- the great cap
    ctx.save();
    ctx.translate(0, stalkTop + 6);
    ctx.rotate(sway * 1.5);
    const cw = 128 * (1 + sq * 0.12 + breathe * 0.5), ch = 96 * (1 - sq * 0.25 + breathe);
    // gills underside
    ctx.beginPath(); ctx.ellipse(0, 0, cw * 0.96, 16, 0, 0, Math.PI); ctx.closePath();
    fs(ctx, white, '#c9b6e6', 3);
    if (!white) {
      ctx.strokeStyle = 'rgba(90,60,130,0.6)'; ctx.lineWidth = 1.2;
      for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(i * 4, 2); ctx.lineTo(i * cw * 0.09, 14 - Math.abs(i) * 0.6); ctx.stroke(); }
      glow(ctx, 0, 10, cw * 0.8, 'rgba(200,170,255,0.35)', 0.5 + 0.3 * Math.sin(t * 2));
    }
    // dome
    ctx.beginPath();
    ctx.moveTo(-cw, 2);
    ctx.bezierCurveTo(-cw * 1.02, -ch * 0.9, -cw * 0.45, -ch * 1.12, 0, -ch * 1.1);
    ctx.bezierCurveTo(cw * 0.45, -ch * 1.12, cw * 1.02, -ch * 0.9, cw, 2);
    // scalloped rim
    for (let i = 0; i <= 12; i++) { const x = cw - (i / 12) * cw * 2; ctx.quadraticCurveTo(x + cw / 12, 10, x, 2); }
    ctx.closePath();
    fs(ctx, white, '#5e4688', 4);
    if (!white) {
      const g = ctx.createRadialGradient(-cw * 0.3, -ch * 0.8, 6, 0, -ch * 0.4, cw * 1.1);
      g.addColorStop(0, 'rgba(190,160,240,0.6)'); g.addColorStop(0.5, 'rgba(120,90,170,0.1)'); g.addColorStop(1, 'rgba(20,10,40,0.45)');
      ctx.fillStyle = g; ctx.fill();
      // pale spots that softly glow
      const SP = [[-0.55, -0.55, 0.13], [-0.1, -0.85, 0.11], [0.38, -0.62, 0.15], [0.7, -0.25, 0.08], [-0.82, -0.18, 0.07], [0.05, -0.38, 0.08], [-0.32, -0.25, 0.06]];
      SP.forEach(([x, y, r], i) => {
        const gl = 0.5 + 0.5 * Math.sin(t * 1.6 + i * 1.3);
        glow(ctx, x * cw, y * ch, r * cw * 2.4, 'rgba(234,216,255,0.6)', gl * (this.phase >= 2 ? 1 : 0.6));
        ctx.beginPath(); ctx.ellipse(x * cw, y * ch, r * cw, r * cw * 0.8, x * 0.4, 0, TAU);
        ctx.fillStyle = '#eadfff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      });
      // tiny mushrooms + moss growing on the cap
      for (const [x, s] of [[-0.62, 1], [0.52, 0.8], [0.66, 0.6]]) {
        const px = x * cw, py = -ch * (0.9 - Math.abs(x) * 0.55) + 4;
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.fillStyle = '#e8dcf0';
        ctx.beginPath(); ctx.rect(px - 2 * s, py - 10 * s, 4 * s, 10 * s); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(px, py - 10 * s, 8 * s, 6 * s, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#9e7fd6'; ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(120,170,110,0.5)';
      for (let i = 0; i < 9; i++) { const x = -cw * 0.8 + i * cw * 0.2; ctx.beginPath(); ctx.arc(x, -ch * 0.25 - Math.sin(i) * 6 + 18, 3, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    ctx.restore();
  }
}

// ==================================================================================================
// HUSH — The Owl Without a Sound. Fades into the dark between strikes; swoops in arcs, throws feather
// volleys, rains feathers, and her silent screech dims the whole wood so only her eyes remain.
// ==================================================================================================
export class Hush extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'hush', size: [136, 124], music: 'boss_mid', air: true, glints: 220, introTime: 2.6 });
    if (this.dead) return;
    this.noPhysics = true;
    this.light = 160;
    this.G = this.findFloor();
    this.groundY = this.G;
    this.hoverY = this.G - 220;
    this.x = this.arena.x + this.arena.w / 2 - this.w / 2;
    this.y = Math.max(this.arena.y + 10, this.G - 380);
    this.alpha = 0; this.eyeVis = 0.35; this.wing = 0; this.flapT = 0; this.flapSpeed = 1; this.eyeFlash = 0;
    this.beak = 0; this.talon = 0; this.dim = 0; this.dimT = 0; this.screechK = 0; this.lean = 0;
    this.marks = []; this.dt = 1 / 60; this.featherT = 0;
  }
  // the base finds ground under the spawn tile; an air boss may start high, so scan the column
  findFloor() {
    const room = this.game.room;
    for (let y = Math.floor(this.cy); y < room.pxH; y += 2) if (room.rectBlocked(this.cx - 2, y, 4, 2)) return y;
    return this.groundY;
  }

  update(dt) {
    this.dt = dt;
    super.update(dt);
    if (this.dead) return;
    this.flapT += dt * this.flapSpeed * (2 + this.wing * 6);
    if (this.eyeFlash > 0) this.eyeFlash -= dt;
    // the dark lingers, then lifts
    if (this.dimT > 0) { this.dimT -= dt; this.dim = Math.min(1, this.dim + dt * 2.5); } else this.dim = Math.max(0, this.dim - dt * 1.2);
    if (this.mode === 'dying') this.dim = Math.max(0, this.dim - dt * 3);
    const vis = this.alpha > 0.5 && this.mode === 'fight';
    this.hittable = vis; this.harmful = vis;
    // shed a silent feather now and then
    this.featherT -= dt;
    if (this.featherT <= 0 && this.alpha > 0.4 && this.mode !== 'dying') {
      this.featherT = this.rand(0.5, 1.1);
      this.fx.add({ x: this.cx + this.rand(-40, 40), y: this.cy + 20, vx: this.rand(-20, 20), vy: 30, life: 2.2, size: 5, color: 'rgba(120,100,160,0.8)', g: 20, drag: 1.5, shape: 'leaf', front: false });
    }
  }

  idle(dt) { this.y = Math.max(this.arena.y + 10, this.G - 380) + Math.sin(this.anim * 0.8) * 4; }
  introUpdate(dt, t) {
    if (t < 0.6) { this.eyeVis = 0.35 + Math.sin(t * 12) * 0.2; return; }
    if (t < 0.7) { this.eyeFlash = 0.3; }
    const k = clamp((t - 0.6) / 1.6, 0, 1);
    this.alpha = k;
    this.wing = Math.sin(k * Math.PI) * 0.9 + 0.1;
    const y0 = Math.max(this.arena.y + 10, this.G - 380);
    this.y = y0 + (this.hoverY - this.h / 2 - y0) * easeIO(k);
    this.facePlayer();
  }
  onStart() { this.sfx('phase'); }

  think(dt) {
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i];
      m.t += dt;
      if (m.t >= m.dur) { this.marks.splice(i, 1); if (m.done) m.done(); }
    }
    if (this.hovering) {
      this.y += Math.sin(this.anim * 2.2) * 0.5;
    }
  }
  addMark(m) { this.marks.push(Object.assign({ t: 0 }, m)); }
  onDeath() { this.marks.length = 0; this.alpha = 1; this.dimT = 0; this.wing = 1; }

  get L() { return this.arena.x; }
  get R() { return this.arena.x + this.arena.w; }

  chooseAttack() {
    const p = this.phase;
    return pickAttack(this, [
      { name: 'swoop', w: 3, fn: this.swoop },
      { name: 'volley', w: 2.5, fn: this.volley },
      { name: 'screech', w: this.dimT <= 0 ? (p >= 2 ? 2.2 : 1.2) : 0, fn: this.screech },
      { name: 'rain', w: 2, fn: this.rain },
      { name: 'dive', w: p >= 2 ? 2.2 : 0, fn: this.dive },
      { name: 'reposition', w: 0.6, fn: this.reposition },
    ]);
  }

  *flyTo(x, y, time) {
    const x0 = this.x, y0 = this.y;
    x = clamp(x, this.L, this.R - this.w); y = clamp(y, this.arena.y, this.G - this.h);
    let t = 0;
    this.lean = Math.sign(x - x0) * 0.15;
    while (t < time) {
      t += this.dt * this.speedMul;
      const k = easeIO(Math.min(1, t / time));
      this.x = x0 + (x - x0) * k; this.y = y0 + (y - y0) * k;
      yield;
    }
    this.lean = 0;
  }
  *fade(to, time) {
    const a0 = this.alpha;
    let t = 0;
    while (t < time) { t += this.dt; this.alpha = a0 + (to - a0) * Math.min(1, t / time); yield; }
    this.alpha = to;
  }

  *reposition() {
    this.wing = 0.7;
    const p = this.player;
    const side = p.cx < this.cx ? 1 : -1;
    yield* this.flyTo(p.cx + side * this.rand(160, 280) - this.w / 2, this.hoverY - this.h / 2 + this.rand(-30, 20), 0.7);
    this.facePlayer(); this.wing = 0.15;
    yield 0.3;
  }

  // vanish, reappear at the edge of the arena, then sweep an arc that dips to Bead's height
  *swoop() {
    const passes = this.phase >= 3 ? 2 : 1;
    this.sfx('phase');
    yield* this.fade(0.04, 0.35);
    let fromLeft = this.player.cx > this.L + this.arena.w / 2;
    for (let k = 0; k < passes; k++) {
      const x0 = fromLeft ? this.L + 20 : this.R - 20 - this.w;
      const x2 = fromLeft ? this.R - 20 - this.w : this.L + 20;
      const yTop = Math.max(this.arena.y + 10, this.G - 330);
      this.x = x0; this.y = yTop;
      this.facing = fromLeft ? 1 : -1;
      yield 0.25;
      // eyes open in the dark: the tell
      const px = clamp(this.player.cx, this.L + 80, this.R - 80) - this.w / 2;
      const yLow = this.G - this.h;
      const cxp = 2 * px - (x0 + x2) / 2, cyp = 2 * yLow - yTop;
      this.path = { x0, y0: yTop, cx: cxp, cy: cyp, x2, y2: yTop, t: 0 };
      this.eyeFlash = 0.5; this.tele = 0.5; this.wing = 1;
      this.sfx('warn');
      yield* this.fade(1, 0.5);
      const T = 1.15 - this.phase * 0.08;
      let t = 0;
      let dropT = 0;
      this.sfx('dash');
      while (t < T) {
        t += this.dt * this.speedMul;
        const q = Math.min(1, t / T);
        const a = (1 - q) * (1 - q), b = 2 * (1 - q) * q, c = q * q;
        this.x = a * x0 + b * cxp + c * x2;
        this.y = a * yTop + b * cyp + c * yTop;
        this.wing = 0.35 + 0.3 * Math.abs(Math.sin(q * Math.PI));
        this.lean = (q - 0.5) * 0.8 * this.facing;
        this.path.t = q;
        if (this.phase >= 3 && (dropT -= this.dt) <= 0) { dropT = 0.16; this.fire(this.cx, this.cy, 0, 140, { art: 'feather', color: '#cfc6e6', r: 7, life: 3, gravity: 300 }); }
        yield;
      }
      this.path = null; this.lean = 0;
      fromLeft = !fromLeft;
      if (k < passes - 1) { yield* this.fade(0.04, 0.3); }
    }
    this.wing = 0.6;
    yield* this.flyTo(this.cx - this.w / 2 + (this.cx < this.L + this.arena.w / 2 ? 120 : -120), this.hoverY - this.h / 2, 0.6);
    this.wing = 0.15;
    yield 0.4;
  }

  *volley() {
    this.facePlayer();
    this.hovering = true;
    this.wing = 1; this.tele = 0.5; this.eyeFlash = 0.4;
    this.sfx('rustle');
    yield 0.5;
    const waves = this.phase >= 2 ? 2 : 1;
    const n = this.phase >= 3 ? 7 : 5;
    for (let w = 0; w < waves; w++) {
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 0.2 + (w ? 0.1 : 0);
        this.fireAt(this.cx + this.facing * 20, this.cy, 300 + this.phase * 30, { offset: off, art: 'feather', color: '#d9d2ee', r: 8, life: 4 });
      }
      this.sfx('throw');
      this.wing = 0.2;
      if (w < waves - 1) { yield 0.25; this.wing = 1; this.tele = 0.35; yield 0.35; }
    }
    this.hovering = false;
    yield 0.8;
  }

  // the silent screech: no sound at all, only the wood going dark
  *screech() {
    this.facePlayer();
    this.hovering = true;
    this.beak = 1; this.wing = 0.9; this.tele = 0.6; this.eyeFlash = 0.6;
    yield 0.6;
    this.screechK = 1;
    for (let i = 0; i < 3; i++) this.fx.ring(this.cx + this.facing * 10, this.cy - 12, 10 + i * 20, 340 + i * 60, 0.9 + i * 0.2, 'rgba(200,180,240,0.5)', 5 - i);
    this.dimT = 4.5 + this.phase * 0.5;
    yield 0.6;
    this.beak = 0; this.screechK = 0; this.hovering = false;
    yield 0.3;
    // something always follows into the dark
    yield* (Math.random() < 0.6 ? this.swoop() : this.rain());
  }

  *rain() {
    this.wing = 0.8;
    yield* this.flyTo(clamp(this.player.cx, this.L + 200, this.R - 200) - this.w / 2, this.arena.y + 20, 0.6);
    this.wing = 1; this.tele = 0.5; this.eyeFlash = 0.3; this.hovering = true;
    this.sfx('rustle');
    yield 0.4;
    const n = 7 + this.phase * 2;
    // evenly spaced curtain, offset at random: there is always a lane ~70px wide to slip into
    const gap = 96;
    const base = this.player.cx + this.rand(-gap / 2, gap / 2);
    const xs = [];
    for (let i = 0; i < n; i++) {
      const x = base + (i - (n - 1) / 2) * gap;
      if (x > this.L + 10 && x < this.R - 10) xs.push(x);
    }
    xs.sort(() => Math.random() - 0.5);
    xs.forEach((x, i) => {
      this.addMark({ kind: 'feather', x, y: this.arena.y + 8, dur: 0.45 + i * 0.05, done: () => this.fire(x, this.arena.y + 14, 0, 420 + this.phase * 30, { art: 'feather', color: '#d9d2ee', r: 8, life: 3 }) });
    });
    this.wing = 0.3;
    yield 1.1;
    this.hovering = false;
    yield* this.flyTo(this.x, this.hoverY - this.h / 2, 0.5);
    yield 0.3;
  }

  *dive() {
    this.wing = 0.8;
    const yTop = Math.max(this.arena.y + 10, this.G - 360);
    yield* this.flyTo(this.player.cx - this.w / 2, yTop, 0.5);
    this.talon = 1; this.eyeFlash = 0.6; this.tele = 0.7; this.wing = 1;
    this.sfx('warn');
    let t = 0;
    while (t < 0.55) { t += this.dt; this.x += clamp(this.player.cx - this.cx, -420 * this.dt, 420 * this.dt); this.x = clamp(this.x, this.L, this.R - this.w); yield; }
    const mark = { kind: 'dive', x: this.cx, y: this.G, dur: 0.35 };
    this.addMark(mark);
    yield 0.35;
    this.wing = 0.1;
    let vy = 500;
    this.sfx('dash');
    while (this.y + this.h < this.G) {
      vy = Math.min(1600, vy + 4000 * this.dt);
      this.y = Math.min(this.G - this.h, this.y + vy * this.dt * this.speedMul);
      yield;
    }
    this.sfx('slam'); this.shake(8, 0.35);
    this.fx.burst(this.cx, this.G, 18, { color: '#b8a8d8', speed: 280, angle: -Math.PI / 2, spread: 2.6, size: 3, life: 0.6 });
    if (this.phase >= 3) {
      this.shockwave(this.cx - 30, -1, 380, 28, { color: 'rgba(210,200,240,0.9)' });
      this.shockwave(this.cx + 30, 1, 380, 28, { color: 'rgba(210,200,240,0.9)' });
    }
    this.wing = 0.9;
    yield 0.7;
    this.talon = 0;
    yield* this.flyTo(this.x, this.hoverY - this.h / 2, 0.6);
    this.wing = 0.15;
    yield 0.3;
  }

  onPhase(n) {
    this.eyeFlash = 0.8; this.tele = 0.8;
    this.shake(5, 0.5);
    this.fx.ring(this.cx, this.cy, 10, 300, 1.0, 'rgba(210,190,250,0.6)', 5);
    if (n === 3) this.speedMul *= 1.1;
  }

  bodyBox() {
    const sw = this.path ? 6 : 0;
    return { x: this.x + 22 - sw, y: this.y + 8, w: this.w - 44 + sw * 2, h: this.h - 14 };
  }

  // --------------------------------------------------------------- drawing
  drawEyes(ctx, t, alpha) {
    const f = this.facing;
    const hx = this.cx + f * 9, hy = this.cy - 32 + Math.sin(t * 2.2) * 3;
    const flash = Math.max(0, this.eyeFlash);
    ctx.save();
    ctx.globalAlpha = alpha;
    for (const s of [-1, 1]) {
      const ex = hx + s * 19 + f * 3, ey = hy + 3;
      glow(ctx, ex, ey, 18 + flash * 40, 'rgba(255,236,170,0.9)', 0.7);
      ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(ex, ey, 4.5 + flash * 2, 0, TAU); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + f * 0.8, ey, 1.6, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  drawExtra(ctx, t) {
    // the silent screech: the wood goes dark around Bead
    if (this.dim > 0.01) {
      const cam = this.game.camera, p = this.player;
      const vx = cam.viewX, vy = cam.viewY;
      const g = ctx.createRadialGradient(p.cx, p.cy, 50, p.cx, p.cy, 190);
      g.addColorStop(0, 'rgba(6,4,12,0)'); g.addColorStop(1, `rgba(6,4,12,${0.93 * this.dim})`);
      ctx.fillStyle = g;
      ctx.fillRect(vx - 20, vy - 20, VIEW_W + 40, VIEW_H + 40);
      // only her eyes remain
      if (this.mode !== 'dying') this.drawEyes(ctx, t, Math.max(0.6, this.alpha) * this.dim);
    } else if (this.alpha < 0.5 && this.mode !== 'dying') {
      this.drawEyes(ctx, t, this.mode === 'dormant' ? this.eyeVis : Math.max(0.25, this.eyeFlash > 0 ? 1 : 0.25));
    }
    // marks (drawn above the dark so every tell stays readable)
    for (const m of this.marks) {
      const k = m.t / m.dur;
      ctx.save();
      if (m.kind === 'feather') {
        glow(ctx, m.x, m.y + 6, 14 + 10 * k, 'rgba(230,220,255,0.9)', 0.4 + 0.5 * k);
        ctx.strokeStyle = `rgba(230,220,255,${0.15 + 0.2 * k})`; ctx.lineWidth = 2; ctx.setLineDash([4, 10]);
        ctx.beginPath(); ctx.moveTo(m.x, m.y + 10); ctx.lineTo(m.x, this.G); ctx.stroke();
      } else if (m.kind === 'dive') {
        ctx.fillStyle = `rgba(8,6,14,${0.3 + 0.4 * k})`;
        ctx.beginPath(); ctx.ellipse(m.x, m.y - 2, 36, 7, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(230,220,255,${0.3 + 0.5 * k})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(m.x, m.y - 2, 46 - 12 * k, 9 - 2 * k, 0, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }
    // the swoop's path, ghosted ahead of her while her eyes open
    if (this.path && this.path.t === 0) {
      const P = this.path;
      ctx.save();
      ctx.strokeStyle = 'rgba(220,210,250,0.28)'; ctx.lineWidth = 3; ctx.setLineDash([3, 12]);
      ctx.beginPath(); ctx.moveTo(P.x0 + this.w / 2, P.y0 + this.h / 2); ctx.quadraticCurveTo(P.cx + this.w / 2, P.cy + this.h / 2, P.x2 + this.w / 2, P.y2 + this.h / 2); ctx.stroke();
      ctx.restore();
    }
  }

  drawBody(ctx, t, white) {
    const a = this.mode === 'dying' ? 1 : this.alpha;
    if (a <= 0.01) return;
    const f = this.facing;
    const cx = this.cx, cy = this.cy + Math.sin(t * 2.2) * 3;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(cx, cy);
    ctx.rotate(this.lean);
    ctx.scale(f * 1.45, 1.45);
    const wing = this.wing;
    const flap = Math.sin(this.flapT) * (0.25 + wing * 0.35);
    const plum = '#2f2547', plum2 = '#463a68', pale = '#efe9f5';
    // ---- wings (far wing first, then body, then near wing)
    const drawWing = (side, far) => {
      ctx.save();
      ctx.translate(side * 20, -16);
      ctx.scale(side, 1);
      ctx.rotate(-0.3 - wing * 0.9 + flap * (far ? 0.8 : 1));
      const span = 40 + wing * 110, depth = 56 - wing * 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(span * 0.4, -depth * 0.35, span * 0.85, -depth * 0.2, span, depth * 0.05);
      // primaries: fingered trailing edge
      const fingers = 6;
      for (let i = 0; i < fingers; i++) {
        const q = i / fingers;
        const fx1 = span * (1 - q * 0.75), fy1 = depth * (0.15 + q * 0.75);
        ctx.quadraticCurveTo(fx1 + 6, fy1 - 4, fx1 - span * 0.06, fy1 + 10 - q * 4);
      }
      ctx.quadraticCurveTo(span * 0.1, depth * 0.95, 0, depth * 0.6);
      ctx.closePath();
      fs(ctx, white, far ? '#231c38' : plum2, 3);
      if (!white) {
        ctx.strokeStyle = 'rgba(210,200,240,0.28)'; ctx.lineWidth = 1.5;
        for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(span * 0.12 * i, depth * 0.1); ctx.quadraticCurveTo(span * 0.15 * i, depth * 0.4, span * 0.1 * i, depth * 0.75); ctx.stroke(); }
        // pale bars across the coverts
        ctx.fillStyle = 'rgba(220,210,245,0.35)';
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(span * (0.25 + i * 0.16), depth * 0.18, 5, 2.5, 0.4, 0, TAU); ctx.fill(); }
      }
      ctx.restore();
    };
    drawWing(-1, true);
    // ---- tail
    ctx.beginPath(); ctx.moveTo(-12, 30); ctx.lineTo(-16, 52); ctx.lineTo(-4, 46); ctx.lineTo(0, 56); ctx.lineTo(6, 46); ctx.lineTo(14, 50); ctx.lineTo(12, 30); ctx.closePath();
    fs(ctx, white, '#241d38', 2.5);
    // ---- talons
    const tl = this.talon;
    for (const s of [-1, 1]) {
      const tx = s * 12 + tl * 4, ty = 36 + tl * 12;
      ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(s * 10, 26); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.strokeStyle = white ? '#fff' : '#bfb2a0'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(s * 10, 26); ctx.lineTo(tx, ty); ctx.stroke();
      for (const d of [-1, 0, 1]) {
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + d * 7 + 3, ty + 4 + tl * 3, tx + d * 6 + 2, ty + 9 + tl * 4);
        inkS(ctx, white, 2.5); ctx.stroke();
      }
    }
    // ---- body
    ctx.beginPath(); ctx.ellipse(0, 6, 38, 36, 0, 0, TAU);
    fs(ctx, white, plum, 3.5);
    if (!white) {
      ctx.beginPath(); ctx.ellipse(6, 12, 24, 26, 0, 0, TAU);
      ctx.fillStyle = '#5c4e82'; ctx.fill();
      // chevron breast feathers
      ctx.strokeStyle = 'rgba(235,225,250,0.55)'; ctx.lineWidth = 1.6;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3 - (r === 3 ? 1 : 0); c++) {
        const x = -6 + c * 10 + (r % 2) * 5, y = 0 + r * 8;
        ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x, y + 3); ctx.lineTo(x + 3, y); ctx.stroke();
      }
    }
    // ---- head
    const hx = 6, hy = -24;
    // ear tufts
    for (const s of [-1, 1]) {
      const tw = Math.sin(t * 2 + s) * 2;
      ctx.beginPath(); ctx.moveTo(hx + s * 26, hy - 14); ctx.quadraticCurveTo(hx + s * 32, hy - 34, hx + s * 30 + tw, hy - 50); ctx.quadraticCurveTo(hx + s * 18, hy - 36, hx + s * 6, hy - 26); ctx.closePath();
      fs(ctx, white, plum, 2.5);
    }
    ctx.beginPath(); ctx.ellipse(hx, hy, 34, 30, 0, 0, TAU);
    fs(ctx, white, plum, 3.5);
    // pale heart-shaped facial disc
    ctx.beginPath();
    ctx.moveTo(hx, hy - 16);
    ctx.bezierCurveTo(hx + 10, hy - 30, hx + 34, hy - 22, hx + 28, hy + 2);
    ctx.bezierCurveTo(hx + 24, hy + 18, hx + 8, hy + 26, hx, hy + 30);
    ctx.bezierCurveTo(hx - 8, hy + 26, hx - 24, hy + 18, hx - 28, hy + 2);
    ctx.bezierCurveTo(hx - 34, hy - 22, hx - 10, hy - 30, hx, hy - 16);
    fs(ctx, white, pale, 3);
    if (!white) {
      // ruff lines
      ctx.strokeStyle = 'rgba(120,100,160,0.35)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 7; i++) { const a2 = 0.3 + i * 0.4; ctx.beginPath(); ctx.moveTo(hx + Math.cos(a2) * 8, hy + 4 + Math.sin(a2) * 6); ctx.lineTo(hx + Math.cos(a2) * 22, hy + 4 + Math.sin(a2) * 18); ctx.stroke(); }
      // deep eye wells
      ctx.fillStyle = INK;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + s * 13, hy + 2, 10, 11, s * -0.2, 0, TAU); ctx.fill(); }
      const flash = Math.max(0, this.eyeFlash);
      for (const s of [-1, 1]) {
        eye(ctx, hx + s * 13 + 2, hy + 2, 4.5 + flash * 2, '#ffe9a8', true);
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(hx + s * 13 + 2.8, hy + 2, 1.7, 0, TAU); ctx.fill();
      }
      // brow ridge (stern)
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(hx - 24, hy - 10); ctx.quadraticCurveTo(hx - 10, hy - 6, hx, hy - 12); ctx.quadraticCurveTo(hx + 10, hy - 6, hx + 24, hy - 10); ctx.stroke();
    }
    // beak (opens wide for the silent screech)
    const bo = this.beak;
    ctx.beginPath(); ctx.moveTo(hx - 5, hy + 10); ctx.quadraticCurveTo(hx + 2, hy + 8, hx + 5, hy + 10); ctx.quadraticCurveTo(hx + 3, hy + 18 - bo * 4, hx, hy + 21 - bo * 4); ctx.quadraticCurveTo(hx - 3, hy + 16, hx - 5, hy + 10);
    fs(ctx, white, '#c9b48a', 2);
    if (bo > 0) {
      ctx.beginPath(); ctx.moveTo(hx - 4, hy + 18); ctx.quadraticCurveTo(hx, hy + 18 + bo * 10, hx + 4, hy + 18); ctx.closePath();
      fs(ctx, white, '#a8926a', 2);
      if (!white) { ctx.fillStyle = '#1a0f1e'; ctx.beginPath(); ctx.ellipse(hx, hy + 17, 3, 2 * bo, 0, 0, TAU); ctx.fill(); }
    }
    drawWing(1, false);
    ctx.restore();
  }
}

export default { sporecap: SporecapElder, hush: Hush };
