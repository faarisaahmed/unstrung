// Bosses of the Rotgut Warrens: Broodmother Gnash (Keeper) and the Stinger Court (optional).
import { Boss, registerMinion } from './boss.js';
import { TAU, clamp, overlap } from '../core/math.js';
import { TILE, VIEW_W, VIEW_H } from '../core/constants.js';
import { INK, eye } from '../art/creatures.js';
import { Entity } from '../entities/base.js';
import { Enemy } from '../entities/enemy.js';
import { registerProjectileArt } from '../entities/projectile.js';

// ---------------------------------------------------------------- shared ink helpers
const col = (white, c) => (white ? '#fff' : c);
function inkStroke(ctx, white, lw = 2.5, c = INK) {
  ctx.strokeStyle = white ? '#fff' : c; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}
function fillInk(ctx, fill, white, lw = 2.5) { ctx.fillStyle = white ? '#fff' : fill; ctx.fill(); inkStroke(ctx, white, lw); }
// additive soft glow; rgb = 'r,g,b'
function glow(ctx, x, y, r, rgb, a = 0.5) {
  if (r <= 0 || a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}
// a jointed insect limb: thick ink under a thinner colored core
function limb(ctx, pts, white, c, lw = 5) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = col(white, INK); ctx.lineWidth = lw + 3; ctx.stroke();
  ctx.strokeStyle = col(white, c); ctx.lineWidth = lw; ctx.stroke();
}
const approach = (v, t, k) => v + (t - v) * k;

// ---------------------------------------------------------------- projectile art
registerProjectileArt('gn_acid', (ctx, p, t) => {
  const c = p.o.color || '#c7e04a';
  for (let i = 0; i < p.trail.length; i++) {
    const q = p.trail[i];
    ctx.globalAlpha = (i / p.trail.length) * 0.5;
    ctx.fillStyle = '#9fb83a';
    ctx.beginPath(); ctx.arc(q.x, q.y + 2, p.r * 0.55 * (i / p.trail.length), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  glow(ctx, p.cx, p.cy, p.r * 3, '200,240,80', 0.35);
  const wob = Math.sin(p.age * 30) * 0.12;
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.ellipse(p.cx, p.cy, p.r * (1 + wob) + 2, p.r * (0.85 - wob) + 2, p.rot, 0, TAU); ctx.fill();
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.ellipse(p.cx, p.cy, p.r * (1 + wob), p.r * (0.85 - wob), p.rot, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(250,255,210,0.8)';
  ctx.beginPath(); ctx.arc(p.cx - p.r * 0.3, p.cy - p.r * 0.35, p.r * 0.28, 0, TAU); ctx.fill();
});
registerProjectileArt('gn_pool', (ctx, p, t) => {
  const r = p.rect();
  const k = p.age / (p.age + p.life);
  const grow = Math.min(1, p.age * 9);
  const a = k > 0.75 ? (1 - k) / 0.25 : 1;
  const cx = r.x + r.w / 2, base = r.y + r.h;
  ctx.globalAlpha = a;
  glow(ctx, cx, base - 4, r.w * 0.7, '190,235,70', 0.3);
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.ellipse(cx, base - 3, r.w * 0.5 * grow + 2, 7, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#a6c43a';
  ctx.beginPath(); ctx.ellipse(cx, base - 3, r.w * 0.5 * grow, 5.5, 0, Math.PI, 0); ctx.fill();
  // bubbles
  for (let i = 0; i < 4; i++) {
    const ph = (t * 1.6 + i * 0.37) % 1;
    const bx = cx + (((i * 53) % 7) / 7 - 0.5) * r.w * 0.8 * grow;
    ctx.strokeStyle = 'rgba(232,255,140,0.9)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(bx, base - 5 - ph * 14, 1.5 + ph * 2.5, 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;
});
registerProjectileArt('gn_rock', (ctx, p) => {
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.age * 6);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, rr = p.r * (i % 2 ? 0.8 : 1.1); i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = '#2c3414'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#6f7f2e'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-p.r * 0.4, -p.r * 0.3); ctx.lineTo(p.r * 0.3, -p.r * 0.5); ctx.stroke();
  ctx.restore();
});

// ---------------------------------------------------------------- minions
registerMinion({
  id: 'gnash_drone', name: 'Brood Drone', hp: 22, dmg: 1, size: [30, 26],
  behavior: 'swarm', params: { speed: 150, accel: 520, sight: 2000 },
  art: { body: 'wasp', c1: '#2e3612', c2: '#c7e04a', eye: '#e8ff88', centered: true }, weight: 1.2,
});
registerMinion({
  id: 'gnash_larva', name: 'Brood Larva', hp: 20, dmg: 1, size: [34, 22],
  behavior: 'hopper', params: { interval: 1.1, vx: 170, vy: 520 },
  art: { body: 'grub', c1: '#7d9230', c2: '#e8ff88', c3: '#ece4cc', mask: true, segs: 4, eye: '#1b200b' }, weight: 1,
});

// An egg sac Gnash flings into the arena. Pops when Bonked; hatches a larva if ignored.
class BroodEgg extends Entity {
  constructor(game, boss, x, y, vx, vy) {
    super(game, x - 17, y - 22, 34, 44);
    this.boss = boss;
    this.vx = vx; this.vy = vy;
    this.isEnemy = true; this.hittable = true; this.harmful = false;
    this.hp = Math.round(16 * (boss.echo ? 1.4 : 1));
    this.hatch = boss.phase >= 3 ? 4.2 : 5.2;
    this.t = 0; this.flashT = 0; this.landed = false; this.z = 2;
    this.seed = Math.random() * 10;
  }
  update(dt) {
    this.t += dt; this.flashT -= dt;
    if (!this.landed) {
      const r = this.physics(dt, 1500, 1100);
      if (r.floor) {
        this.landed = true; this.vx = 0;
        this.game.sfx('drop');
        this.game.fx.burst(this.cx, this.y + this.h, 6, { color: '#9fb83a', speed: 140, angle: -Math.PI / 2, spread: 2.4, size: 2.5, life: 0.4 });
      }
      if (r.hitX) this.vx = 0;
    } else this.physics(dt, 1500, 1100);
    this.hatch -= dt;
    if (this.hatch <= 0) this.hatchOut();
  }
  onBonk(dmg, dir, p) { this.hurt(dmg, dir, 'bonk'); return true; }
  hurt(dmg) {
    if (this.dead) return;
    this.hp -= dmg; this.flashT = 0.1;
    this.game.sfx('hit');
    this.game.fx.burst(this.cx, this.cy, 4, { color: '#c7e04a', speed: 160, size: 2.5, life: 0.3 });
    if (this.hp <= 0) this.pop();
  }
  pop() {
    this.dead = true;
    const g = this.game;
    g.sfx('potBreak');
    g.fx.burst(this.cx, this.cy, 14, { color: '#c7e04a', speed: 260, size: 3.5, life: 0.6 });
    g.fx.burst(this.cx, this.cy, 8, { color: '#ece4cc', speed: 200, size: 3, life: 0.5, shape: 'shard' });
    g.fx.ring(this.cx, this.cy, 6, 44, 0.3, 'rgba(232,255,140,0.8)', 3);
  }
  hatchOut() {
    this.dead = true;
    const g = this.game, b = this.boss;
    g.sfx('burst');
    g.fx.burst(this.cx, this.cy, 12, { color: '#ece4cc', speed: 220, size: 3, life: 0.5, shape: 'shard' });
    g.fx.burst(this.cx, this.cy, 10, { color: '#9fb83a', speed: 180, size: 3, life: 0.5 });
    const larvae = b.minions.filter((m) => !m.dead && m.def && m.def.id === 'gnash_larva').length;
    if (!b.dead && b.mode === 'fight' && larvae < 4) {
      const e = b.summon('gnash_larva', (this.cx - TILE / 2) / TILE, (this.y + this.h) / TILE - 1);
      if (e) { e.facing = e.dirToPlayer(); e.t = 0.6; }
    }
  }
  die() { if (!this.dead) this.pop(); }
  draw(ctx, t) {
    const x = this.cx, by = this.y + this.h;
    const urg = clamp(1 - this.hatch / 5.2, 0, 1);
    const beat = Math.sin(this.t * (5 + urg * 16)) * (0.04 + urg * 0.07);
    const flash = this.flashT > 0;
    ctx.save(); ctx.translate(x, by);
    if (urg > 0.7) ctx.translate(Math.sin(this.t * 60) * urg * 1.5, 0);
    ctx.scale(1 + beat, 1 - beat);
    glow(ctx, 0, -20, 34 + urg * 16, '200,240,90', 0.18 + urg * 0.3);
    // stalk / goo base
    ctx.beginPath(); ctx.ellipse(0, -2, 15, 4, 0, 0, TAU); fillInk(ctx, '#3d4818', flash, 2);
    // sac
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.bezierCurveTo(-22, -4, -20, -40, 0, -44);
    ctx.bezierCurveTo(20, -40, 22, -4, 0, -2);
    ctx.fillStyle = col(flash, 'rgba(160,190,70,0.85)'); ctx.fill();
    // the larva curled inside
    if (!flash) {
      ctx.save(); ctx.clip();
      const wr = Math.sin(this.t * (3 + urg * 8) + this.seed) * 0.4;
      ctx.translate(0, -22); ctx.rotate(wr);
      ctx.fillStyle = 'rgba(40,48,16,0.75)';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0.3, TAU - 0.6); ctx.arc(0, 0, 4, TAU - 0.6, 0.3, true); ctx.fill();
      ctx.fillStyle = 'rgba(236,228,204,0.8)'; ctx.beginPath(); ctx.arc(9, -6, 3.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.bezierCurveTo(-22, -4, -20, -40, 0, -44);
    ctx.bezierCurveTo(20, -40, 22, -4, 0, -2);
    inkStroke(ctx, flash, 2.5);
    // veins
    ctx.strokeStyle = col(flash, 'rgba(232,255,140,0.75)'); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-6, -4); ctx.quadraticCurveTo(-14, -20, -6, -38); ctx.moveTo(6, -4); ctx.quadraticCurveTo(13, -24, 4, -40); ctx.stroke();
    ctx.fillStyle = col(flash, 'rgba(255,255,230,0.6)'); ctx.beginPath(); ctx.ellipse(-7, -32, 3, 6, 0.4, 0, TAU); ctx.fill();
    // cracks as it nears hatching
    if (urg > 0.45) {
      ctx.strokeStyle = col(flash, INK); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(-4, -36); ctx.lineTo(2, -30); ctx.lineTo(-3, -22 + (1 - urg) * 10);
      if (urg > 0.75) { ctx.moveTo(10, -36); ctx.lineTo(5, -28); ctx.lineTo(9, -20); }
      ctx.stroke();
    }
    ctx.restore();
  }
}

// =====================================================================================
// BROODMOTHER GNASH — Queen of the Warrens.
// A bloated hive queen under a pale crown-mask. Burrows, spits acid, births drones,
// charges with open mandibles and lays egg sacs. Phase 3: the abdomen splits — frenzy.
// =====================================================================================
export class Gnash extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'gnash', size: [180, 118], music: 'boss_keeper', glints: 300 });
    this.pose = { rear: 0, mand: 0.15, charge: 0, swell: 0, throat: 0, lift: 0 };
    this.tgt = { rear: 0, mand: 0.15, charge: 0, swell: 0, throat: 0, lift: 0 };
    this.sink = 0;
    this.walk = 0;
    this.mound = null;
    this.frenzy = false;
    this.pendingRoar = 0;
    this.shiver = 0;
    this.bleed = 0;
  }

  // ---------------- animation
  animate(dt) {
    const k = Math.min(1, dt * 10);
    for (const key in this.tgt) this.pose[key] = approach(this.pose[key], this.tgt[key], key === 'mand' ? Math.min(1, dt * 18) : k);
    if (this.shiver > 0) this.shiver -= dt;
    // drool and (in frenzy) acid weeping from the split abdomen
    if (this.sink < 0.3 && this.mode !== 'dormant') {
      if (Math.random() < dt * (this.frenzy ? 6 : 1.8)) {
        const m = this.mouth();
        this.fx.add({ x: m.x, y: m.y + 6, vx: this.facing * 10, vy: 30, life: 0.7, size: 2.4, color: '#c7e04a', g: 700, front: false });
      }
      if (this.frenzy && Math.random() < dt * 8) {
        const a = this.abCenter();
        this.fx.add({ x: a.x + (Math.random() - 0.5) * 80, y: a.y + 20, vx: 0, vy: 20, life: 0.8, size: 2.8, color: '#e8ff88', g: 800, front: false, glow: true });
      }
    }
  }
  idle(dt) { this.animate(dt); this.walk += dt * 0.6; }
  introUpdate(dt, t) {
    this.animate(dt);
    if (t < 0.25) { this.tgt.rear = 0; }
    else if (t < 1.5) { this.tgt.rear = 1; this.tgt.mand = 0.6 + Math.sin(t * 30) * 0.4; this.tgt.swell = 1; this.shiver = 0.1; }
    else { this.tgt.rear = 0; this.tgt.mand = 0.15; this.tgt.swell = 0; }
    if (t > 0.25 && t - dt <= 0.25) { this.sfx('screech'); this.shake(8, 1.0); }
  }
  think(dt) { this.animate(dt); }

  // ---------------- anatomy (world coords)
  mouth() { return { x: this.cx + this.facing * (100 - this.pose.rear * 18), y: this.y + this.h - 62 - this.pose.rear * 40 + this.pose.charge * 18 }; }
  abCenter() { return { x: this.cx - this.facing * 58, y: this.y + this.h - 80 }; }
  abTip() { return { x: this.cx - this.facing * 128, y: this.y + this.h - 104 - this.pose.swell * 10 }; }
  mandBox(reach = 70) {
    const m = this.mouth();
    return { x: this.facing > 0 ? m.x - 20 : m.x - reach + 20, y: m.y - 34, w: reach, h: 64 };
  }
  dust(n = 5, x = this.cx) {
    this.fx.burst(x, this.groundY - 4, n, { color: 'rgba(120,135,60,0.8)', speed: 180, angle: -Math.PI / 2, spread: 2.2, size: 3.5, life: 0.5, g: 500 });
  }

  // ---------------- attack selection
  attackList() {
    const p = this.phase;
    const drones = this.minions.filter((m) => m instanceof Enemy && m.def.id === 'gnash_drone').length;
    const eggs = this.minions.filter((m) => m instanceof BroodEgg || (m.def && m.def.id === 'gnash_larva')).length;
    const near = this.distX() < 230;
    const list = [
      { name: 'charge', w: 3, fn: this.chargeBite },
      { name: 'spit', w: 2.6, fn: this.acidSpit },
      { name: 'burrow', w: 2.2, fn: this.burrow },
      { name: 'snap', w: near ? 3 : 0, fn: this.snap },
      { name: 'brood', w: drones < (p >= 2 ? 3 : 2) ? (p >= 2 ? 1.6 : 1) : 0, fn: this.brood },
      { name: 'eggs', w: eggs < 3 ? (p >= 2 ? 1.8 : 1.1) : 0, fn: this.layEggs },
      { name: 'frenzy', w: p >= 3 ? 2.8 : 0, fn: this.frenzyPounce },
    ];
    return list.filter((a) => a.w > 0);
  }
  chooseAttack() {
    if (this.pendingRoar) { const n = this.pendingRoar; this.pendingRoar = 0; return this.roar(n); }
    return super.chooseAttack();
  }
  onPhase(n) { this.pendingRoar = n; }

  *roar(n) {
    this.facePlayer();
    this.tgt.rear = 1; this.tgt.mand = 1; this.tgt.swell = 1; this.tele = 0.7;
    yield 0.35;
    this.sfx('screech'); this.sfx('bossRoar'); this.shake(10, 0.9);
    this.shiver = 0.9;
    this.fx.ring(this.mouth().x, this.mouth().y, 20, 320, 0.7, 'rgba(232,255,140,0.7)', 6);
    if (n >= 3) {
      this.frenzy = true;
      this.speedMul *= 1.2;
      this.game.flash('rgba(200,240,80,0.35)', 0.5);
      const a = this.abCenter();
      this.fx.burst(a.x, a.y, 30, { color: '#e8ff88', speed: 360, size: 4, life: 0.9, glow: true });
      this.fx.burst(a.x, a.y, 16, { color: INK, speed: 300, size: 5, life: 0.8, shape: 'shard' });
    }
    yield 0.6;
    if (n === 2) {
      // the brood answers her
      for (let i = 0; i < 2; i++) { this.spawnDrone(); yield 0.2; }
    }
    this.tgt.rear = 0; this.tgt.mand = 0.15; this.tgt.swell = 0;
    yield 0.6;
  }

  spawnDrone() {
    const tip = this.abTip();
    const e = this.summon('gnash_drone', (tip.x - TILE / 2) / TILE, (tip.y - TILE / 2) / TILE);
    if (e) { e.vx = -this.facing * 200; e.vy = -220; }
    this.fx.burst(tip.x, tip.y, 8, { color: '#c7e04a', speed: 160, size: 2.5, life: 0.4 });
  }

  // ---- 1. Charging bite: scrape, then barrel across the arena jaws-first
  *chargeBite() {
    this.facePlayer();
    this.tgt.charge = 1; this.tgt.mand = 0.1; this.tele = 0.6;
    this.sfx('charge');
    for (let i = 0; i < 3; i++) { this.dust(4, this.cx - this.facing * 40); this.walk += 1.2; this.shiver = 0.1; yield 0.2; }
    const runs = this.phase >= 3 ? 2 : 1;
    for (let r = 0; r < runs; r++) {
      if (r > 0) {
        // skid, turn, and come back — short but readable wind-up
        this.facing = -this.facing; this.tgt.mand = 0.1; this.tele = 0.45; this.sfx('charge');
        this.dust(6, this.cx);
        yield 0.45;
      }
      this.tgt.mand = 1; this.sfx('screech');
      const sp = (560 + this.phase * 70) * this.speedMul;
      for (;;) {
        this.x += this.facing * sp / 60;
        this.walk += 0.55;
        this.hits.push(this.mandBox(80));
        if (Math.random() < 0.5) this.dust(1, this.cx - this.facing * 60);
        const lo = this.arena.x, hi = this.arena.x + this.arena.w - this.w;
        if (this.x <= lo || this.x >= hi) { this.x = clamp(this.x, lo, hi); break; }
        yield;
      }
      // crash
      this.tgt.mand = 0; this.shake(9, 0.4); this.sfx('slam');
      const wx = this.facing > 0 ? this.x + this.w + 10 : this.x - 10;
      this.fx.burst(wx, this.cy, 16, { color: '#6f7f2e', speed: 300, size: 3.5, life: 0.6 });
      if (this.phase >= 2) this.rockfall(this.phase >= 3 ? 6 : 4);
    }
    this.tgt.charge = 0; this.shiver = 0.5;
    yield 0.9; // stunned against the wall: punish window
    this.tgt.mand = 0.15;
    this.facePlayer();
    yield 0.3;
  }

  // loose clods rain from the ceiling (visible the whole way down)
  rockfall(n) {
    for (let i = 0; i < n; i++) {
      const x = this.rand(this.arena.x + 60, this.arena.x + this.arena.w - 60);
      const y = this.arena.y + 12;
      this.fx.burst(x, y, 4, { color: '#6f7f2e', speed: 60, angle: Math.PI / 2, spread: 1, size: 2.5, life: 0.6 });
      this.fire(x, y, 0, this.rand(-40, 40), { gravity: this.rand(700, 1000), art: 'gn_rock', r: 9, noScale: true, life: 4 });
    }
  }

  // ---- 2. Snap: a quick close-range lunge with the mandibles
  *snap() {
    this.facePlayer();
    const n = this.phase >= 2 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      this.tgt.rear = 0.45; this.tgt.mand = 1; this.tele = 0.45;
      this.sfx('rustle');
      yield 0.45;
      this.tgt.rear = -0.2; this.tgt.charge = 0.8; this.sfx('slash');
      for (let f = 0; f < 10; f++) {
        this.x = clamp(this.x + this.facing * 11 * this.speedMul, this.arena.x, this.arena.x + this.arena.w - this.w);
        this.walk += 0.4;
        if (f > 3) { this.tgt.mand = 0; this.hits.push(this.mandBox(90)); }
        yield;
      }
      this.fx.slash(this.mouth().x, this.mouth().y, this.facing > 0 ? 0 : Math.PI, 90, 'rgba(232,255,140,0.85)', 0.18);
      this.tgt.charge = 0; this.tgt.rear = 0;
      yield 0.35;
      this.facePlayer();
    }
    this.tgt.mand = 0.15;
    yield 0.6;
  }

  // ---- 3. Acid spit: rears, throat glows, a fan of arcing globs that leave burning puddles
  *acidSpit() {
    this.facePlayer();
    const volleys = this.phase >= 2 ? 2 : 1;
    for (let v = 0; v < volleys; v++) {
      this.tgt.rear = 0.8; this.tgt.mand = 1; this.tgt.throat = 1; this.tele = 0.5;
      this.sfx('rustle');
      yield 0.5;
      this.tgt.rear = 0.2; this.sfx('spit'); this.shake(3, 0.2);
      const m = this.mouth();
      const n = this.phase >= 3 ? 6 : this.phase >= 2 ? 5 : 4;
      const g = 1300;
      const spread = 105 + (v % 2) * 40;
      const off = v % 2 ? spread / 2 : 0;
      for (let i = 0; i < n; i++) {
        const tx = clamp(this.player.cx + (i - (n - 1) / 2) * spread + off, this.arena.x + 20, this.arena.x + this.arena.w - 20);
        const T = 0.85 + Math.abs(tx - m.x) / 2400;
        const vx = (tx - m.x) / T;
        const vy = (this.groundY - m.y - 0.5 * g * T * T) / T;
        this.fire(m.x, m.y, vx, vy, { gravity: g, art: 'gn_acid', r: 10, color: '#c7e04a', noScale: true, onDie: (p) => this.acidPool(p) });
      }
      this.fx.burst(m.x, m.y, 10, { color: '#c7e04a', speed: 220, angle: this.facing > 0 ? -0.6 : Math.PI + 0.6, spread: 1.2, size: 3, life: 0.4 });
      this.tgt.throat = 0;
      yield 0.55;
    }
    this.tgt.rear = 0; this.tgt.mand = 0.15;
    yield 0.6;
  }
  acidPool(p) {
    if (this.mode !== 'fight') return;
    const room = this.game.room;
    let sy = null;
    for (let y = p.y + p.h - 6; y < p.y + p.h + 24; y += 2) {
      if (room.rectBlocked(p.cx - 2, y, 4, 2) || room.onewayLanding(p.cx - 2, 4, y - 2, y + 2) !== null) { sy = y; break; }
    }
    if (sy === null) return;
    this.zone(p.cx - 34, sy - 12, 68, 12, this.phase >= 3 ? 1.6 : 1.2, { art: 'gn_pool' });
  }

  // ---- 4. Burrow: dives, a mound hunts Bead, it shudders (tell), then she erupts
  *burrow() {
    this.facePlayer();
    this.tgt.rear = 1; this.tgt.mand = 0.8; this.tele = 0.5; this.sfx('screech');
    yield 0.5;
    const times = this.phase >= 3 ? 2 : 1;
    for (let k = 0; k < times; k++) {
      this.tgt.rear = -0.3; this.tgt.charge = 1;
      this.sfx('rockBreak'); this.shake(5, 0.4);
      for (let f = 0; f <= 24; f++) {
        this.sink = f / 24;
        if (f % 3 === 0) this.dust(5);
        yield;
      }
      this.hittable = false; this.harmful = false;
      this.mound = { x: this.cx, warn: 0 };
      const hunt = this.phase >= 3 ? 0.95 : 1.25;
      const sp = (this.phase >= 2 ? 360 : 300) * this.speedMul;
      for (let t = 0; t < hunt; t += 1 / 60) {
        const d = this.player.cx - this.mound.x;
        this.mound.x += clamp(d, -sp / 60, sp / 60);
        this.mound.x = clamp(this.mound.x, this.arena.x + this.w / 2, this.arena.x + this.arena.w - this.w / 2);
        if (Math.random() < 0.35) this.dust(1, this.mound.x + this.rand(-30, 30));
        yield;
      }
      // the tell: the ground swells and cracks under Bead
      this.mound.warn = 1; this.sfx('warn'); this.shake(3, 0.5);
      this.x = this.mound.x - this.w / 2;
      this.facePlayer();
      yield 0.55;
      // erupt
      this.sfx('burst'); this.sfx('screech'); this.shake(10, 0.45);
      const ex = this.mound.x;
      this.zone(ex - 72, this.groundY - 250, 144, 250, 0.3);
      this.fx.burst(ex, this.groundY, 26, { color: '#6f7f2e', speed: 480, angle: -Math.PI / 2, spread: 1.4, size: 4, life: 0.8 });
      this.fx.burst(ex, this.groundY, 10, { color: INK, speed: 360, angle: -Math.PI / 2, spread: 1.6, size: 5, life: 0.7, shape: 'shard' });
      if (this.phase >= 2) {
        for (let i = 0; i < 4; i++) this.fire(ex, this.groundY - 40, this.rand(-320, 320), this.rand(-760, -560), { gravity: 1400, art: 'gn_rock', r: 9, noScale: true });
      }
      this.mound = null;
      this.tgt.rear = 1; this.tgt.mand = 1; this.tgt.charge = 0;
      for (let f = 0; f <= 10; f++) { this.sink = 1 - f / 10; if (f > 2) this.hits.push(this.bodyBox()); yield; }
      this.sink = 0;
      this.hittable = true; this.harmful = true;
      if (k < times - 1) { yield 0.35; this.tgt.rear = 0.6; this.tele = 0.4; yield 0.4; }
    }
    this.tgt.rear = 0; this.tgt.mand = 0.15;
    this.shiver = 0.6;
    yield 1.0; // half-stuck in the ground: punish window
  }

  // ---- 5. Brood: the abdomen swells and splits out drones
  *brood() {
    this.facePlayer();
    this.tgt.swell = 1; this.tgt.rear = 0.3; this.tele = 0.6;
    this.sfx('buzz');
    yield 0.6;
    const n = this.phase >= 2 ? 3 : 2;
    for (let i = 0; i < n; i++) { this.sfx('burst'); this.spawnDrone(); this.tgt.swell = 0.4; yield 0.18; this.tgt.swell = 1; yield 0.1; }
    this.tgt.swell = 0; this.tgt.rear = 0;
    yield 0.8;
  }

  // ---- 6. Egg sacs: flung across the arena; Bonk them before they hatch
  *layEggs() {
    this.facePlayer();
    this.tgt.swell = 1; this.tgt.lift = 1; this.tele = 0.55;
    this.sfx('rustle');
    yield 0.55;
    const n = this.phase >= 3 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const tip = this.abTip();
      const tx = clamp(this.player.cx + this.rand(-260, 260), this.arena.x + 60, this.arena.x + this.arena.w - 60);
      const T = 0.9;
      const vx = (tx - tip.x) / T;
      const vy = (this.groundY - 20 - tip.y - 0.5 * 1500 * T * T) / T;
      const egg = new BroodEgg(this.game, this, tip.x, tip.y, vx, vy);
      this.game.add(egg); this.minions.push(egg);
      this.sfx('throw');
      this.tgt.swell = 0.3; this.fx.burst(tip.x, tip.y, 6, { color: '#c7e04a', speed: 120, size: 2.5, life: 0.4 });
      yield 0.22;
      this.tgt.swell = 1;
      yield 0.1;
    }
    this.tgt.swell = 0; this.tgt.lift = 0;
    yield 0.8;
  }

  // ---- 7. Frenzy (phase 3): three savage pounces, each splashing acid
  *frenzyPounce() {
    for (let i = 0; i < 3; i++) {
      this.facePlayer();
      this.tgt.charge = 1; this.tgt.mand = 1; this.tele = 0.4;
      this.sfx('rustle'); this.shiver = 0.2;
      yield 0.4;
      this.sfx('leap'); this.tgt.charge = 0; this.tgt.rear = 0.6;
      const tx = this.player.cx;
      const it = this.leapTo(tx, 170 + i * 30, 0.6);
      for (let r = it.next(); !r.done; r = it.next()) { this.walk += 0.3; this.hits.push(this.mandBox(80)); yield; }
      this.sfx('slam'); this.shake(7, 0.3); this.tgt.rear = 0; this.tgt.mand = 0;
      this.dust(10);
      this.shockwave(this.cx, -1, 360, 26, { color: 'rgba(200,240,80,0.85)' });
      this.shockwave(this.cx, 1, 360, 26, { color: 'rgba(200,240,80,0.85)' });
      yield 0.25;
    }
    this.tgt.mand = 0.15;
    yield 1.0;
  }

  bodyBox() {
    if (this.sink > 0.5) return null;
    return { x: this.x + 14, y: this.y + 14 + this.sink * this.h, w: this.w - 28, h: this.h - 14 };
  }

  drawExtra(ctx, t) {
    // burrow mound
    const m = this.mound;
    if (!m) return;
    const gy = this.groundY;
    const sh = m.warn ? Math.sin(t * 70) * 3 : 0;
    const x = m.x + sh;
    if (m.warn) {
      glow(ctx, x, gy, 110, '200,240,80', 0.35 + Math.sin(t * 30) * 0.1);
      ctx.strokeStyle = '#e8ff88'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (const s of [-1, 1]) { ctx.moveTo(x, gy - 2); ctx.lineTo(x + s * 26, gy - 3); ctx.lineTo(x + s * 44, gy - 1); ctx.lineTo(x + s * 70, gy - 2); }
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x - 62, gy + 2);
    ctx.quadraticCurveTo(x - 40, gy - 34 - sh, x, gy - 38);
    ctx.quadraticCurveTo(x + 40, gy - 34 + sh, x + 62, gy + 2);
    ctx.closePath();
    fillInk(ctx, '#232a10', false, 3);
    ctx.strokeStyle = '#4b571f'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - 30, gy - 18); ctx.lineTo(x - 12, gy - 26); ctx.moveTo(x + 8, gy - 30); ctx.lineTo(x + 28, gy - 20); ctx.stroke();
    // crown spikes breaking the surface
    for (const s of [-1, 0, 1]) {
      ctx.beginPath(); ctx.moveTo(x + s * 14 - 5, gy - 34 + Math.abs(s) * 4); ctx.lineTo(x + s * 16, gy - 50 + Math.abs(s) * 6 - m.warn * 8); ctx.lineTo(x + s * 14 + 5, gy - 34 + Math.abs(s) * 4);
      fillInk(ctx, '#ece4cc', false, 2);
    }
  }

  // ---------------- drawing
  drawBody(ctx, t, white) {
    const f = this.facing, P = this.pose, a = this.anim;
    const by = this.y + this.h;
    ctx.save();
    ctx.translate(this.cx, by);
    if (this.sink > 0) {
      ctx.beginPath(); ctx.rect(-500, -1000, 1000, 1000); ctx.clip();
      ctx.translate(0, this.sink * (this.h + 110));
    }
    if (this.shiver > 0) ctx.translate(Math.sin(a * 80) * 2, 0);
    ctx.scale(f, 1);
    const br = Math.sin(a * 2.4);
    const rear = P.rear;

    // whole body tilts up when rearing (pivot at back legs)
    ctx.translate(-40, 0); ctx.rotate(-rear * 0.16 + P.charge * 0.05); ctx.translate(40, 0);

    this.drawLegs(ctx, white, true, a);
    this.drawAbdomen(ctx, white, a, br);
    this.drawWings(ctx, white, a);
    // thorax
    ctx.beginPath(); ctx.ellipse(14, -72, 46, 36, 0.12, 0, TAU);
    fillInk(ctx, '#20260d', white, 3.5);
    if (!white) {
      ctx.strokeStyle = '#56652a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(14, -72, 40, 30, 0.12, -2.7, -0.5); ctx.stroke();
      ctx.strokeStyle = '#3a4418'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(12, -60, 22, -2.5, -0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, -104); ctx.quadraticCurveTo(6, -80, 0, -46); ctx.stroke();
    }
    // spines along the thorax ridge
    for (let i = 0; i < 5; i++) {
      const sx = -22 + i * 12, sy = -102 + Math.abs(i - 2) * 4;
      ctx.beginPath(); ctx.moveTo(sx - 5, sy + 6); ctx.lineTo(sx - 3, sy - 12 - (i === 2 ? 4 : 0)); ctx.lineTo(sx + 5, sy + 6);
      fillInk(ctx, '#2c3414', white, 1.8);
    }
    this.drawLegs(ctx, white, false, a);
    this.drawHead(ctx, white, a, t);
    ctx.restore();
  }

  drawLegs(ctx, white, far, a) {
    const P = this.pose;
    const moving = Math.abs(this.walk);
    for (let i = 0; i < 3; i++) {
      const ph = this.walk * 2 + i * 2.1 + (far ? Math.PI : 0);
      const hip = [-12 + i * 22, -54];
      let fx = [-82, 4, 84][i] + (far ? 14 : 0) + Math.cos(ph) * 10;
      let fy = -Math.max(0, Math.sin(ph)) * 10;
      if (i === 2 && P.rear > 0.2) { fx = 92 + P.rear * 10; fy = -30 * P.rear - Math.sin(a * 12) * 8 * P.rear; }
      if (this.sink > 0) fy -= Math.sin(a * 20 + i) * 6 * this.sink;
      const kx = (hip[0] + fx) / 2 + (i - 1) * 16, ky = -96 - (i === 1 ? 6 : 0) + Math.sin(ph) * 4;
      limb(ctx, [hip, [kx, ky], [fx, fy]], white, far ? '#151a08' : '#323b16', far ? 4.5 : 6.5);
      // knee spur
      ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + 6, ky - 12); inkStroke(ctx, white, 2.5);
      // hooked claw
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + (i === 0 ? -8 : 8), fy - 4);
      inkStroke(ctx, white, 2.5);
      if (!far && !white) {
        ctx.fillStyle = '#6f7f2e'; ctx.beginPath(); ctx.arc(kx, ky, 3, 0, TAU); ctx.fill();
      }
    }
    void moving;
  }

  drawAbdomen(ctx, white, a, br) {
    const P = this.pose;
    const sw = P.swell;
    ctx.save();
    ctx.translate(-56, -80 + br * 2 - P.lift * 10);
    ctx.rotate(-0.26 - P.lift * 0.25 + Math.sin(a * 1.3) * 0.03);
    const rx = 72 + sw * 10 + br * 2, ry = 48 + sw * 9 + br * 1.5;
    if (!white) glow(ctx, 0, 0, rx * 1.4, '170,220,60', 0.12 + sw * 0.15 + (this.frenzy ? 0.12 : 0));
    // ovipositor
    ctx.beginPath(); ctx.moveTo(-rx + 10, -12); ctx.quadraticCurveTo(-rx - 26, -4 - sw * 6, -rx - 34, 6); ctx.quadraticCurveTo(-rx - 14, 10, -rx + 10, 14);
    fillInk(ctx, '#3d4818', white, 2.5);
    // main sac
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    fillInk(ctx, '#46521b', white, 3.5);
    if (!white) {
      ctx.save();
      ctx.beginPath(); ctx.ellipse(0, 0, rx - 2, ry - 2, 0, 0, TAU); ctx.clip();
      // translucent belly
      ctx.fillStyle = 'rgba(160,190,60,0.55)';
      ctx.beginPath(); ctx.ellipse(6, ry * 0.45, rx * 0.85, ry * 0.6, 0, 0, TAU); ctx.fill();
      // eggs glowing inside
      const eggs = [[-40, 10], [-18, 22], [6, 12], [26, 24], [-30, 30], [40, 8], [-4, 34]];
      for (let i = 0; i < eggs.length; i++) {
        const [ex, ey] = eggs[i];
        const pul = 0.5 + 0.5 * Math.sin(a * 3 + i * 1.7);
        glow(ctx, ex, ey, 18, '232,255,140', 0.25 + pul * 0.25 + sw * 0.2);
        ctx.fillStyle = `rgba(236,240,190,${0.55 + pul * 0.3})`;
        ctx.beginPath(); ctx.ellipse(ex, ey, 7, 5, 0.5, 0, TAU); ctx.fill();
      }
      // segment bands
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      for (let i = -2; i <= 2; i++) {
        const x = i * rx * 0.36;
        ctx.beginPath(); ctx.moveTo(x - 10, -ry); ctx.quadraticCurveTo(x + 10, 0, x - 6, ry); ctx.stroke();
      }
      // dorsal plates
      ctx.fillStyle = '#20260d';
      ctx.beginPath(); ctx.ellipse(0, -ry * 0.62, rx * 0.95, ry * 0.42, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#6f7f2e'; ctx.lineWidth = 1.5;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * rx * 0.36, -ry * 0.95, 14, 0.4, Math.PI - 0.4); ctx.stroke(); }
      // the split in frenzy
      if (this.frenzy) {
        ctx.strokeStyle = '#e8ff88'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-rx * 0.7, -4); ctx.lineTo(-rx * 0.4, 4); ctx.lineTo(-rx * 0.1, -6); ctx.lineTo(rx * 0.2, 6); ctx.lineTo(rx * 0.55, -2); ctx.stroke();
        glow(ctx, 0, 0, 50, '232,255,140', 0.35 + 0.15 * Math.sin(a * 9));
      }
      ctx.restore();
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); inkStroke(ctx, false, 3.5);
      // sheen
      ctx.strokeStyle = 'rgba(232,255,180,0.35)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(-6, -4, rx * 0.8, ry * 0.75, 0, -2.6, -1.6); ctx.stroke();
    }
    ctx.restore();
  }

  drawWings(ctx, white, a) {
    const buzz = Math.sin(a * 40) * 0.08 + (this.pose.swell * 0.2);
    for (const k of [0, 1]) {
      ctx.save();
      ctx.translate(-4 + k * 10, -94);
      ctx.rotate(-2.75 + k * 0.25 + buzz * (k ? 1 : -1));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(30, -20, 78, -8);
      ctx.lineTo(70, -2); ctx.lineTo(76, 4); ctx.lineTo(62, 6); ctx.lineTo(66, 12);
      ctx.quadraticCurveTo(30, 16, 0, 0);
      ctx.fillStyle = col(white, k ? 'rgba(210,230,170,0.32)' : 'rgba(210,230,170,0.42)'); ctx.fill();
      inkStroke(ctx, white, 1.6);
      if (!white) { ctx.strokeStyle = 'rgba(22,20,28,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(4, 1); ctx.lineTo(60, -2); ctx.moveTo(20, 4); ctx.lineTo(40, -12); ctx.stroke(); }
      ctx.restore();
    }
  }

  drawHead(ctx, white, a, t) {
    const P = this.pose;
    ctx.save();
    ctx.translate(36, -72);
    ctx.rotate(-P.rear * 0.42 + P.charge * 0.24 + Math.sin(a * 1.7) * 0.03);
    ctx.scale(1.2, 1.2);
    ctx.translate(-36, 72);
    // bristly ruff where head meets thorax
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const an = -Math.PI * 0.5 + (i / 12) * Math.PI * 1.15;
      const rr = i % 2 ? 22 : 31 + Math.sin(a * 3 + i) * 2;
      const px = 40 + Math.cos(an) * rr, py = -72 + Math.sin(an) * rr;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    fillInk(ctx, '#7d8550', white, 2.2);
    // neck
    ctx.beginPath(); ctx.ellipse(40, -72, 16, 18, 0, 0, TAU); fillInk(ctx, '#1b200b', white, 2.5);
    // head capsule
    ctx.beginPath(); ctx.ellipse(66, -72, 28, 24, 0.1, 0, TAU); fillInk(ctx, '#1b200b', white, 3);
    // antennae (behind the mask)
    const sway = Math.sin(a * 2.1) * 6;
    ctx.beginPath();
    ctx.moveTo(56, -96); ctx.bezierCurveTo(48, -140, 10, -150 + sway, -22, -132 + sway);
    ctx.moveTo(66, -98); ctx.bezierCurveTo(70, -146, 40, -168 - sway, 12, -160 - sway);
    inkStroke(ctx, white, 2.5);
    if (!white) { ctx.fillStyle = '#c7e04a'; for (const [x, y] of [[-22, -132 + sway], [12, -160 - sway]]) { ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); } }
    // mandibles
    const open = 0.08 + P.mand * 0.62;
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(84, -64);
      ctx.rotate(s * open);
      ctx.beginPath();
      ctx.moveTo(-4, -6 * s);
      ctx.quadraticCurveTo(26, -20 * s, 48, 6 * s);
      ctx.quadraticCurveTo(32, -1 * s, 18, 1 * s);
      ctx.quadraticCurveTo(6, 3 * s, -4, 7 * s);
      ctx.closePath();
      fillInk(ctx, '#cfc6a2', white, 2.5);
      if (!white) {
        ctx.fillStyle = '#2c3414';
        ctx.beginPath(); ctx.moveTo(-2, -4 * s); ctx.quadraticCurveTo(16, -12 * s, 26, -6 * s); ctx.quadraticCurveTo(14, -2 * s, -2, 4 * s); ctx.fill();
      }
      // serrated inner edge
      ctx.beginPath(); ctx.moveTo(16, 1 * s); ctx.lineTo(21, 7 * s); ctx.lineTo(26, 1 * s); ctx.lineTo(32, 8 * s); ctx.lineTo(38, 3 * s);
      inkStroke(ctx, white, 1.8);
      ctx.restore();
    }
    if (!white && P.throat > 0.05) glow(ctx, 92, -64, 40 * P.throat, '200,240,80', 0.6 * P.throat);
    // pale crown-mask
    const mx = 68, my = -78;
    ctx.beginPath();
    ctx.moveTo(mx - 26, my + 2);
    ctx.lineTo(mx - 30, my - 22); ctx.lineTo(mx - 20, my - 16);
    ctx.lineTo(mx - 16, my - 36); ctx.lineTo(mx - 6, my - 22);
    ctx.lineTo(mx + 2, my - 44); ctx.lineTo(mx + 10, my - 22);
    ctx.lineTo(mx + 20, my - 36); ctx.lineTo(mx + 22, my - 16);
    ctx.lineTo(mx + 32, my - 22); ctx.lineTo(mx + 28, my + 2);
    ctx.quadraticCurveTo(mx + 24, my + 22, mx + 6, my + 26);
    ctx.quadraticCurveTo(mx - 16, my + 24, mx - 26, my + 2);
    fillInk(ctx, '#ece4cc', white, 3);
    if (!white) {
      // carved bands on the crown
      ctx.strokeStyle = '#b9ae8c'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(mx - 22, my - 12); ctx.quadraticCurveTo(mx + 2, my - 18, mx + 26, my - 12); ctx.stroke();
      // eye sockets: three per side, like a hive queen
      ctx.fillStyle = INK;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(mx + s * 11 + 2, my + 2, 7, 10, s * 0.35, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(mx + s * 18 + 2, my - 8, 3, 0, TAU); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(mx + 2, my - 6, 3, 0, TAU); ctx.fill();
      const ec = this.frenzy ? '#f4ff6a' : '#d8ff5a';
      const shape = this.phase >= 2 ? 'angry' : 'round';
      for (const s of [-1, 1]) eye(ctx, mx + s * 11 + 2, my + 4, 3.4, ec, true, shape);
      for (const s of [-1, 1]) eye(ctx, mx + s * 18 + 2, my - 8, 1.4, ec, true);
      eye(ctx, mx + 2, my - 6, 1.4, ec, true);
      // cracks
      if (this.phase >= 2) {
        ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(mx + 10, my - 22); ctx.lineTo(mx + 6, my - 12); ctx.lineTo(mx + 12, my - 6); ctx.lineTo(mx + 8, my + 4); ctx.stroke();
      }
      if (this.phase >= 3) {
        ctx.beginPath(); ctx.moveTo(mx - 16, my - 36); ctx.lineTo(mx - 12, my - 22); ctx.lineTo(mx - 18, my - 14); ctx.moveTo(mx - 6, my + 24); ctx.lineTo(mx - 2, my + 14); ctx.lineTo(mx - 8, my + 10); ctx.stroke();
      }
    }
    ctx.restore();
  }
}

// =====================================================================================
// THE STINGER COURT — Three Blades, One Throne.
// Three wasp knights who share one life: Ser Aculeo (lance), Dame Vesk (twin stings) and
// Lady Hymn (bow). They duel Bead one at a time, then two, then all three together.
// =====================================================================================
registerProjectileArt('sc_arrow', (ctx, p) => {
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.rot);
  const L = p.r * 2.6;
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L * 0.7, 0); ctx.stroke();
  ctx.strokeStyle = '#d8c48a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L * 0.7, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L * 1.15, 0); ctx.lineTo(L * 0.55, -4.5); ctx.lineTo(L * 0.62, 0); ctx.lineTo(L * 0.55, 4.5); ctx.closePath();
  ctx.fillStyle = '#f2ead2'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = p.o.color || '#cfd65a';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-L * 0.7, 0); ctx.lineTo(-L * 1.05, s * 5); ctx.lineTo(-L * 0.95, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.restore();
});
registerProjectileArt('sc_blade', (ctx, p, t) => {
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.age * 22);
  glow(ctx, 0, 0, p.r * 2.4, '255,220,150', 0.25);
  for (const s of [0, Math.PI]) {
    ctx.save(); ctx.rotate(s);
    ctx.beginPath(); ctx.moveTo(0, -3); ctx.quadraticCurveTo(p.r * 1.3, -p.r * 0.9, p.r * 1.7, p.r * 0.3); ctx.quadraticCurveTo(p.r * 0.9, -p.r * 0.1, 0, 3); ctx.closePath();
    ctx.fillStyle = '#f2ead2'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,240,210,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.cx, p.cy, p.r * 1.7, 0, TAU); ctx.stroke();
});

const COURT = [
  { kind: 'lance', name: 'Ser Aculeo', sash: '#a8322e', stripe: '#d9b13a', eye: '#ffb347' },
  { kind: 'blades', name: 'Dame Vesk', sash: '#6b3fa0', stripe: '#e48a3a', eye: '#ff7a4a' },
  { kind: 'bow', name: 'Lady Hymn', sash: '#2f8a86', stripe: '#cfd65a', eye: '#e8ff88' },
];
const sgn = (v) => (v < 0 ? -1 : 1);

export class StingerCourt extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'stingercourt', size: [44, 62], music: 'boss_optional', air: true, glints: 340 });
    this.noPhysics = true;
    const A = this.arena;
    this.perchY = Math.max(A.y + 90, this.groundY - 380);
    this.knights = COURT.map((d, i) => ({
      ...d, i,
      perch: { x: A.x + A.w * (0.3 + i * 0.2), y: this.perchY },
      x: A.x + A.w * (0.3 + i * 0.2), y: this.perchY,
      vy: 0, rot: 0,
      role: 'bench', co: null, wait: 0, tele: 0, flashT: 0, facing: -1,
      anim: i * 2.3, benchT: 3 - i, turnDmg: 0, turnN: 0, last: null, armed: true,
      pose: { aim: -1.1, couch: 0, slash: 0, spin: 0, whirl: 0, draw: 0, raise: 0, lean: 0, cross: 0 },
    }));
    this.lines = [];
    this.marks = [];
    this.triad = null;
    this.triadT = 4;
    this.updateCentroid();
  }

  // ---------------- helpers
  kbox(k) { return { x: k.x - 24, y: k.y - 44, w: 48, h: 82 }; }
  activeKnights() { return this.knights.filter((k) => k.role === 'active'); }
  updateCentroid() {
    const ks = this.knights.filter((k) => k.role === 'active' || k.role === 'entering');
    const L = ks.length ? ks : this.knights;
    let x = 0, y = 0; for (const k of L) { x += k.x; y += k.y; }
    this.x = x / L.length - this.w / 2; this.y = y / L.length - this.h / 2;
  }
  clampK(k) {
    const A = this.arena;
    k.x = clamp(k.x, A.x + 20, A.x + A.w - 20);
    k.y = clamp(k.y, A.y + 50, this.groundY - 44);
  }
  faceP(k) { k.facing = this.player.cx < k.x ? -1 : 1; }
  *flyTo(k, x, y, sp, maxT = 2) {
    const A = this.arena;
    x = clamp(x, A.x + 24, A.x + A.w - 24); y = clamp(y, A.y + 50, this.groundY - 44);
    for (let t = 0; t < maxT; t += 1 / 60) {
      const dx = x - k.x, dy = y - k.y, d = Math.hypot(dx, dy);
      const step = sp * this.speedMul / 60 * Math.min(1, 0.3 + d / 110);
      if (d <= step || d < 2) { k.x = x; k.y = y; return; }
      k.x += dx / d * step; k.y += dy / d * step;
      if (Math.abs(dx) > 30) k.facing = sgn(dx);
      k.pose.lean = clamp(dx / d * 0.25, -0.25, 0.25) * k.facing;
      yield;
    }
  }
  prefer(k) {
    const p = this.player, side = sgn(k.x - p.cx);
    if (k.kind === 'lance') return [p.cx + side * 230, p.cy - 30];
    if (k.kind === 'blades') return [p.cx + side * 140, p.cy - 50];
    return [p.cx + side * 320, this.arena.y + 150];
  }
  *drift(k, time) {
    for (let t = 0; t < time; t += 1 / 60) {
      const [tx, ty] = this.prefer(k);
      k.x += clamp((tx - k.x) * 0.04, -4, 4) * this.speedMul;
      k.y += clamp((ty - k.y) * 0.04, -4, 4) * this.speedMul;
      this.clampK(k); this.faceP(k);
      k.pose.lean *= 0.9;
      yield;
    }
  }
  lineTele(x1, y1, x2, y2, t, color = '255,220,140') { this.lines.push({ x1, y1, x2, y2, t, max: t, color }); }

  // ---------------- lifecycle
  idle(dt) { this.animK(dt); }
  introUpdate(dt, t) {
    this.animK(dt);
    for (const k of this.knights) { k.pose.raise = t > 0.3 + k.i * 0.3 ? 1 : 0; this.faceP(k); }
    if (t > 1.8) for (const k of this.knights) k.pose.raise = 0;
  }
  think(dt) { this.animK(dt); }
  animK(dt) {
    for (const k of this.knights) {
      k.anim += dt; k.flashT -= dt; if (k.tele > 0) k.tele -= dt;
      if (k.role === 'bench') {
        k.benchT += dt;
        k.x += (k.perch.x - k.x) * Math.min(1, dt * 4);
        k.y += (k.perch.y - k.y) * Math.min(1, dt * 4);
        k.pose.lean *= 0.9;
        if (this.mode !== 'dying') this.faceP(k);
      }
    }
    for (const l of this.lines) l.t -= dt;
    this.lines = this.lines.filter((l) => l.t > 0);
    for (const m of this.marks) {
      m.t -= dt;
      if (m.t <= 0 && !m.fired) {
        m.fired = true;
        if (this.mode === 'fight') this.fire(m.x, this.arena.y + 8, 0, 1150, { art: 'sc_arrow', r: 7, color: '#cfd65a', noScale: true, life: 2 });
      }
    }
    this.marks = this.marks.filter((m) => !m.fired);
    if (this.mode === 'fight' || this.mode === 'intro' || this.mode === 'dormant') this.updateCentroid();
  }
  update(dt) {
    super.update(dt);
    if (this.mode === 'dying') {
      for (const k of this.knights) {
        k.vy += 1500 * dt; k.y = Math.min(k.y + k.vy * dt, this.groundY - 22);
        k.rot += dt * 3 * (k.i - 1 || 1);
        if (k.y >= this.groundY - 22) k.rot *= 0.8;
      }
    }
  }
  onDeath() { this.lines = []; this.marks = []; for (const k of this.knights) { k.vy = -300; k.co = null; } }

  runCoroutine(dt) {
    this.direct(dt);
    for (const k of this.knights) {
      if (k.wait > 0) { k.wait -= dt; continue; }
      if (!k.co) { k.co = this.nextFor(k); if (!k.co) continue; }
      const r = k.co.next();
      if (r.done) k.co = null;
      else if (typeof r.value === 'number') k.wait += r.value / this.speedMul;
    }
  }

  direct(dt) {
    const K = this.knights;
    const want = Math.min(3, this.phase);
    const benchPick = () => K.filter((b) => b.role === 'bench').sort((a, b) => b.benchT - a.benchT)[0];
    // rotation: a knight who has fought long enough bows out for a fresh one
    if (this.phase < 3) {
      for (const k of K) {
        if (k.role === 'active' && !k.co && (k.turnDmg >= 150 || k.turnN >= 4)) {
          const nb = benchPick();
          if (!nb) break;
          k.role = 'leaving'; k.co = this.leave(k); k.wait = 0;
          nb.role = 'entering'; nb.co = this.enter(nb); nb.wait = 0;
        }
      }
    }
    const fielded = K.filter((k) => k.role !== 'bench' && k.role !== 'leaving').length;
    if (fielded < want) {
      const nb = benchPick();
      if (nb) { nb.role = 'entering'; nb.co = this.enter(nb); nb.wait = 0; }
    }
    if (this.phase >= 3) {
      this.triadT -= dt;
      if (this.triadT <= 0 && !this.triad) this.triad = 'pending';
      if (this.triad === 'pending' && K.every((k) => k.role === 'active' && !k.co)) {
        this.triad = null; this.triadT = 11;
        const by = (kind) => K.find((k) => k.kind === kind);
        by('lance').co = this.triadLance(by('lance'));
        by('blades').co = this.triadBlades(by('blades'));
        by('bow').co = this.triadBow(by('bow'));
        this.sfx('bossRoar');
      }
    }
  }

  nextFor(k) {
    if (k.role !== 'active' || this.triad) return null;
    return this.knightTurn(k);
  }

  *knightTurn(k) {
    const atk = this.pickAttack(k);
    k.turnN++;
    yield* atk.call(this, k);
    yield* this.drift(k, this.rand(0.45, 0.85) / (this.phase >= 3 ? 1.25 : 1) + (this.phase >= 2 ? 0.25 : 0));
  }

  pickAttack(k) {
    const p = this.phase;
    const d = Math.hypot(this.player.cx - k.x, this.player.cy - k.y);
    let list;
    if (k.kind === 'lance') list = [['charge', 3, this.lanceCharge], ['dive', 2.4, this.lanceDive], ['sweep', d < 220 ? 2.5 : 0.4, this.lanceSweep]];
    else if (k.kind === 'blades') list = [['whirl', 3, this.whirl], ['flurry', d < 320 ? 2.6 : 1.2, this.flurry], ['toss', p >= 2 ? 2.2 : 0.8, this.bladeToss]];
    else list = [['volley', 3, this.volley], ['rain', 2.2, this.arrowRain], ['evade', d < 170 ? 3.5 : 0, this.evade]];
    list = list.filter((a) => a[1] > 0 && (a[0] !== k.last || list.length === 1));
    let r = Math.random() * list.reduce((s, a) => s + a[1], 0);
    for (const a of list) { r -= a[1]; if (r <= 0) { k.last = a[0]; return a[2]; } }
    k.last = list[0][0]; return list[0][2];
  }

  *enter(k) {
    this.sfx('buzz');
    const p = this.player, A = this.arena;
    const side = p.cx < A.x + A.w / 2 ? 1 : -1;
    yield* this.flyTo(k, p.cx + side * this.rand(220, 300), this.groundY - 150, 760);
    this.faceP(k);
    k.pose.raise = 1; k.tele = 0.55;
    this.sfx('slash');
    this.fx.text(k.x, k.y - 70, k.name, '#f2e6b8', 15);
    this.fx.ring(k.x, k.y, 6, 60, 0.4, 'rgba(255,230,160,0.8)', 3);
    yield 0.6;
    k.pose.raise = 0;
    k.role = 'active'; k.turnDmg = 0; k.turnN = 0;
    yield 0.25;
  }
  *leave(k) {
    this.resetPose(k);
    this.sfx('buzz');
    yield* this.flyTo(k, k.perch.x, k.perch.y, 700, 3);
    k.role = 'bench'; k.benchT = 0;
  }
  resetPose(k) { Object.assign(k.pose, { aim: -1.1, couch: 0, slash: 0, whirl: 0, draw: 0, raise: 0, lean: 0, cross: 0 }); k.armed = true; }

  // ======== SER ACULEO — the Lance
  lanceBox(k, len = 132) {
    const a = k.pose.aim, c = Math.cos(a) * k.facing, s = Math.sin(a);
    const tx = k.x + c * (len - 14), ty = k.y - 6 + s * (len - 14);
    return { x: tx - 22, y: ty - 14, w: 44, h: 28 };
  }
  *lanceCharge(k) {
    const p = this.player, A = this.arena;
    const side = sgn(k.x - p.cx);
    yield* this.flyTo(k, p.cx + side * 300, clamp(p.cy - 6, A.y + 40, this.groundY - 30), 680, 1.2);
    k.facing = -side; k.pose.aim = 0; k.pose.couch = 1; k.tele = 0.55;
    this.sfx('charge');
    for (let t = 0; t < 0.55; t += 1 / 60) {
      if (t < 0.3) k.y += (clamp(this.player.cy - 6, A.y + 40, this.groundY - 30) - k.y) * 0.08;
      k.x -= k.facing * 0.7;
      yield;
    }
    yield* this.lanceRun(k, 900);
    k.pose.couch = 0;
    yield 0.45;
    k.pose.aim = -1.1;
  }
  *lanceRun(k, speed) {
    this.sfx('thrust');
    const A = this.arena;
    for (let f = 0; f < 240; f++) {
      k.x += k.facing * speed * this.speedMul / 60;
      this.hits.push(this.lanceBox(k), this.kbox(k));
      if (f % 2 === 0) this.fx.add({ x: k.x - k.facing * 20, y: k.y + (Math.random() - 0.5) * 20, vx: -k.facing * 60, vy: 0, life: 0.3, size: 2, color: 'rgba(255,230,160,0.8)', g: 0, shape: 'streak', front: false });
      if (k.x < A.x + 24 || k.x > A.x + A.w - 24) break;
      yield;
    }
    this.clampK(k);
    this.shake(3, 0.15);
  }
  *lanceDive(k) {
    const A = this.arena;
    yield* this.flyTo(k, this.player.cx, A.y + 90, 720, 1.2);
    k.pose.aim = Math.PI / 2; k.tele = 0.5;
    this.sfx('warn');
    for (let t = 0; t < 0.5; t += 1 / 60) {
      if (t < 0.32) k.x += (this.player.cx - k.x) * 0.1;
      k.y -= 0.6;
      yield;
    }
    this.sfx('thrust');
    for (let f = 0; f < 120; f++) {
      k.y += 1150 * this.speedMul / 60;
      this.hits.push(this.lanceBox(k, 110), this.kbox(k));
      if (k.y >= this.groundY - 56) { k.y = this.groundY - 56; break; }
      yield;
    }
    this.sfx('slam'); this.shake(6, 0.3);
    this.fx.burst(k.x, this.groundY, 14, { color: '#d9b13a', speed: 280, angle: -Math.PI / 2, spread: 2.4, size: 3, life: 0.5 });
    this.zone(k.x - 40, this.groundY - 36, 80, 36, 0.15);
    if (this.phase >= 2) { this.shockwave(k.x, -1, 400, 26, { color: 'rgba(240,210,120,0.9)' }); this.shockwave(k.x, 1, 400, 26, { color: 'rgba(240,210,120,0.9)' }); }
    yield 0.6; // lance stuck: open
    k.pose.aim = -1.1;
    yield* this.flyTo(k, k.x, k.y - 90, 400, 0.5);
  }
  *lanceSweep(k) {
    const p = this.player;
    yield* this.flyTo(k, p.cx + sgn(k.x - p.cx) * 90, p.cy - 16, 600, 0.8);
    this.faceP(k);
    k.pose.aim = -1.6; k.tele = 0.45; this.sfx('rustle');
    yield 0.45;
    this.sfx('whip');
    for (let f = 0; f < 9; f++) {
      k.pose.aim = -1.6 + (f / 8) * 2.3;
      this.hits.push(this.lanceBox(k));
      yield;
    }
    this.fx.slash(k.x + k.facing * 70, k.y, k.facing > 0 ? 0.3 : Math.PI - 0.3, 150, 'rgba(255,230,160,0.85)', 0.18);
    yield 0.45;
    k.pose.aim = -1.1;
  }

  // ======== DAME VESK — of Two Stings
  *whirl(k) {
    const n = this.phase >= 3 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      this.faceP(k);
      k.pose.cross = 1; k.tele = i ? 0.4 : 0.5; this.sfx('charge');
      const p = this.player;
      const tx = p.cx, ty = p.cy;
      this.lineTele(k.x, k.y, tx, ty, i ? 0.4 : 0.5, '255,170,120');
      yield i ? 0.4 : 0.5;
      k.pose.cross = 0; k.pose.whirl = 1; this.sfx('slash');
      const d = Math.hypot(tx - k.x, ty - k.y) || 1;
      let vx = (tx - k.x) / d * 660, vy = (ty - k.y) / d * 660;
      let moved = 0;
      while (moved < 520) {
        k.x += vx * this.speedMul / 60; k.y += vy * this.speedMul / 60;
        moved += 660 * this.speedMul / 60;
        if (k.y > this.groundY - 44) { k.y = this.groundY - 44; vy = -Math.abs(vy) * 0.6; this.fx.burst(k.x, this.groundY, 4, { color: '#e48a3a', speed: 160, size: 2.5, life: 0.3 }); }
        const ox = k.x; this.clampK(k); if (ox !== k.x) break;
        k.pose.spin += 0.55;
        this.hits.push({ x: k.x - 48, y: k.y - 50, w: 96, h: 96 });
        yield;
      }
      k.pose.whirl = 0;
      yield 0.35;
    }
    yield 0.3;
  }
  *flurry(k) {
    const p = this.player;
    yield* this.flyTo(k, p.cx + sgn(k.x - p.cx) * 80, p.cy - 10, 720, 0.9);
    const n = this.phase >= 2 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      this.faceP(k);
      k.pose.slash = -1; k.tele = 0.35; this.sfx('rustle');
      yield 0.35;
      k.pose.slash = 1; this.sfx('slash');
      k.x += k.facing * 22;
      const x = k.facing > 0 ? k.x : k.x - 124;
      this.zone(x, k.y - 52, 124, 96, 0.14);
      this.fx.slash(k.x + k.facing * 62, k.y - 6, k.facing > 0 ? 0 : Math.PI, 130, 'rgba(255,200,160,0.9)', 0.16, i % 2 ? 1 : -1);
      yield 0.12;
      k.pose.slash = 0;
      yield 0.08;
    }
    yield 0.55;
  }
  *bladeToss(k) {
    this.faceP(k);
    k.pose.slash = -1; k.tele = 0.5; this.sfx('rustle');
    yield 0.5;
    k.pose.slash = 1; k.armed = false; this.sfx('throw');
    const blades = [-0.32, 0.32].map((off) => this.fireAt(k.x, k.y, 560, { art: 'sc_blade', r: 13, ignoreWalls: true, life: 4, offset: off, noScale: true }));
    for (let t = 0; t < 2.6; t += 1 / 60) {
      for (const b of blades) {
        if (b.dead) continue;
        if (t > 0.6) {
          const dx = k.x - b.cx, dy = k.y - b.cy, d = Math.hypot(dx, dy) || 1;
          b.vx += (dx / d * 720 - b.vx) * 0.06; b.vy += (dy / d * 720 - b.vy) * 0.06;
          if (d < 26) { b.dead = true; this.sfx('clink'); }
        } else { b.vx *= 0.985; b.vy *= 0.985; }
      }
      if (blades.every((b) => b.dead)) break;
      k.pose.slash *= 0.9;
      yield;
    }
    for (const b of blades) b.dead = true;
    k.armed = true; k.pose.slash = 0;
    yield 0.3;
  }

  // ======== LADY HYMN — the Bow
  bowAim(k) { const p = this.player; return Math.atan2(p.cy - k.y, Math.abs(p.cx - k.x)); }
  *volley(k) {
    const [tx, ty] = this.prefer(k);
    yield* this.flyTo(k, tx, ty, 620, 1.0);
    this.faceP(k);
    k.tele = 0.6; this.sfx('rustle');
    for (let t = 0; t < 0.6; t += 1 / 60) {
      k.pose.draw = Math.min(1, t / 0.45);
      if (t < 0.42) { this.faceP(k); k.pose.aim = this.bowAim(k); }
      if (t > 0.1 && Math.abs(t - 0.3) < 1 / 120) {
        const a = k.pose.aim, c = Math.cos(a) * k.facing, s = Math.sin(a);
        this.lineTele(k.x, k.y, k.x + c * 700, k.y + s * 700, 0.3, '232,255,140');
      }
      yield;
    }
    const n = this.phase >= 3 ? 5 : 3;
    this.sfx('throw');
    for (let i = 0; i < n; i++) {
      const a = k.pose.aim + (i - (n - 1) / 2) * 0.13;
      const c = Math.cos(a) * k.facing, s = Math.sin(a);
      this.fire(k.x + c * 20, k.y + s * 20, c * 640, s * 640, { art: 'sc_arrow', r: 7, color: '#cfd65a' });
    }
    k.pose.draw = 0; k.x -= k.facing * 8;
    yield 0.5;
    k.pose.aim = 0;
  }
  *arrowRain(k) {
    const A = this.arena;
    yield* this.flyTo(k, clamp(this.player.cx + sgn(k.x - this.player.cx) * 200, A.x + 80, A.x + A.w - 80), A.y + 120, 620, 1.0);
    k.pose.aim = -1.35; k.tele = 0.5; this.sfx('rustle');
    for (let t = 0; t < 0.5; t += 1 / 60) { k.pose.draw = Math.min(1, t / 0.4); yield; }
    k.pose.draw = 0; this.sfx('throw');
    this.fire(k.x, k.y - 20, k.facing * 120, -900, { art: 'sc_arrow', r: 7, color: '#cfd65a', ignoreWalls: true, life: 0.5, noScale: true });
    yield 0.25;
    const n = this.phase >= 2 ? 7 : 5;
    const gap = this.phase >= 2 ? 96 : 120;
    const x0 = this.player.cx + this.rand(-30, 30);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * gap;
      const x = x0 + off;
      if (x < A.x + 10 || x > A.x + A.w - 10) continue;
      this.marks.push({ x, t: 0.85 + Math.abs(off) / 1600, max: 0.85 + Math.abs(off) / 1600 });
    }
    this.sfx('warn');
    yield 0.7;
    k.pose.aim = 0;
  }
  *evade(k) {
    this.faceP(k);
    k.tele = 0.35; k.pose.draw = 0.5; this.sfx('buzz');
    yield 0.35;
    const away = -k.facing;
    const A = this.arena;
    const tx = clamp(k.x + away * 240, A.x + 40, A.x + A.w - 40), ty = Math.max(A.y + 60, k.y - 140);
    const x0 = k.x, y0 = k.y;
    for (let f = 0; f < 18; f++) {
      const u = (f + 1) / 18;
      k.x = x0 + (tx - x0) * u; k.y = y0 + (ty - y0) * u - Math.sin(u * Math.PI) * 40;
      k.pose.lean = -u * 0.6;
      if (f === 9) {
        this.faceP(k); k.pose.aim = this.bowAim(k);
        const a = k.pose.aim, c = Math.cos(a) * k.facing, s = Math.sin(a);
        this.fire(k.x, k.y, c * 700, s * 700, { art: 'sc_arrow', r: 7, color: '#cfd65a' });
        this.sfx('throw');
      }
      yield;
    }
    k.pose.lean = 0; k.pose.draw = 0;
    yield 0.4;
  }

  // ======== phase 3: the Triad Strike — telegraphed lines, staggered
  *triadLance(k) {
    const p = this.player, A = this.arena;
    const side = p.cx > A.x + A.w / 2 ? -1 : 1;
    const sx = side < 0 ? A.x + 30 : A.x + A.w - 30;
    yield* this.flyTo(k, sx, clamp(p.cy - 6, A.y + 40, this.groundY - 30), 900, 1.0);
    k.facing = side < 0 ? 1 : -1; k.pose.aim = 0; k.pose.couch = 1; k.tele = 0.8;
    this.lineTele(k.x, k.y, k.x + k.facing * 2000, k.y, 0.8, '255,200,120');
    yield 0.8;
    yield* this.lanceRun(k, 980);
    k.pose.couch = 0; k.pose.aim = -1.1;
    yield 0.7;
  }
  *triadBlades(k) {
    const A = this.arena;
    const p = this.player;
    yield* this.flyTo(k, p.cx > A.x + A.w / 2 ? A.x + A.w - 120 : A.x + 120, A.y + 80, 900, 1.0);
    this.faceP(k); k.pose.cross = 1; k.tele = 1.0;
    yield 0.45;
    const tx = this.player.cx, ty = this.player.cy;
    this.lineTele(k.x, k.y, tx, ty, 0.6, '255,170,120');
    yield 0.6;
    k.pose.cross = 0; k.pose.whirl = 1; this.sfx('slash');
    const d = Math.hypot(tx - k.x, ty - k.y) || 1;
    const vx = (tx - k.x) / d * 700, vy = (ty - k.y) / d * 700;
    for (let f = 0; f < 70; f++) {
      k.x += vx / 60; k.y += vy / 60; k.pose.spin += 0.55;
      const ox = k.x, oy = k.y; this.clampK(k);
      this.hits.push({ x: k.x - 48, y: k.y - 50, w: 96, h: 96 });
      if (ox !== k.x || oy !== k.y) break;
      yield;
    }
    k.pose.whirl = 0;
    yield 0.7;
  }
  *triadBow(k) {
    const A = this.arena;
    yield* this.flyTo(k, A.x + A.w / 2, A.y + 60, 900, 1.0);
    k.tele = 1.4;
    for (let t = 0; t < 1.4; t += 1 / 60) { this.faceP(k); k.pose.aim = this.bowAim(k); k.pose.draw = Math.min(1, t / 1.0); yield; }
    this.sfx('throw');
    for (let i = 0; i < 5; i++) {
      const a = k.pose.aim + (i - 2) * 0.16, c = Math.cos(a) * k.facing, s = Math.sin(a);
      this.fire(k.x, k.y, c * 600, s * 600, { art: 'sc_arrow', r: 7, color: '#cfd65a' });
    }
    k.pose.draw = 0;
    yield 0.6;
  }

  onPhase(n) {
    this.sfx('bossRoar'); this.shake(6, 0.6);
    if (n >= 3) { this.speedMul *= 1.1; this.triadT = 3; }
    for (const k of this.knights) if (k.role === 'bench') { this.fx.ring(k.x, k.y, 6, 70, 0.5, 'rgba(255,230,160,0.8)', 3); }
  }

  // ---------------- combat plumbing (several bodies, one life)
  hurtboxes() { return this.mode === 'fight' ? this.activeKnights().map((k) => this.kbox(k)) : []; }
  hurtbox() { const a = this.activeKnights()[0]; return a ? this.kbox(a) : null; }
  hitboxes() { return [...this.knights.filter((k) => k.role === 'active').map((k) => this.kbox(k)), ...this.hits]; }
  onBonk(dmg, dir, p) {
    const ab = p.attackBox();
    this._hitK = (ab && this.activeKnights().find((k) => overlap(ab, this.kbox(k)))) || null;
    return super.onBonk(dmg, dir, p);
  }
  hurt(dmg, dir, src) {
    if (src === 'pound') {
      const p = this.player;
      const k = this.activeKnights().find((q) => Math.abs(q.x - p.cx) < 90 && Math.abs(q.y - p.cy) < 60);
      if (!k) return;
      this._hitK = k;
    }
    super.hurt(dmg, dir, src);
  }
  onHurt(dmg) {
    let k = this._hitK; this._hitK = null;
    if (!k) {
      const p = this.player;
      let best = 1e9;
      for (const q of this.activeKnights()) { const d = Math.hypot(q.x - p.cx, q.y - p.cy); if (d < best) { best = d; k = q; } }
    }
    if (k) { k.flashT = 0.12; k.turnDmg += dmg; }
  }

  // ---------------- drawing
  drawBody(ctx, t, white) {
    if (!white) this.drawThrones(ctx, t);
    // benched knights first (behind), then the fighters
    const order = [...this.knights].sort((a, b) => (a.role === 'bench' ? 0 : 1) - (b.role === 'bench' ? 0 : 1));
    for (const k of order) {
      if (white && !(k.flashT > 0) && this.mode !== 'dying') continue;
      this.drawKnight(ctx, k, t, white);
    }
  }
  drawThrones(ctx, t) {
    const top = this.arena.y - 20;
    for (const k of this.knights) {
      const x = k.perch.x, y = k.perch.y - 50;
      ctx.strokeStyle = INK; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.quadraticCurveTo(x + 6, (top + y) / 2, x, y); ctx.stroke();
      ctx.strokeStyle = '#4b3a1c'; ctx.lineWidth = 2.5; ctx.stroke();
      // a hanging honeycomb seat
      for (const [dx, dy] of [[-14, 0], [14, 0], [0, -12], [0, 12]]) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; const px = x + dx + Math.cos(a) * 10, py = y + dy + Math.sin(a) * 10; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.closePath();
        ctx.fillStyle = k.role === 'bench' ? '#6b5320' : '#3a2e14'; ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      }
      if (k.role === 'bench') glow(ctx, x, y, 34, '255,210,120', 0.12 + 0.05 * Math.sin(t * 2 + k.i));
    }
  }
  drawKnight(ctx, k, t, white) {
    const P = k.pose, a = k.anim;
    const bob = k.role === 'bench' || P.whirl ? Math.sin(a * 2) * 2 : Math.sin(a * 3.2) * 3.5;
    ctx.save();
    ctx.translate(k.x, k.y + bob);
    if (k.rot) ctx.rotate(k.rot);
    ctx.scale(k.facing * 1.4, 1.4);
    if (!white && k.tele > 0) glow(ctx, 0, -6, 70, '255,225,160', Math.min(0.45, k.tele));
    if (!white && k.role === 'active') glow(ctx, 0, -10, 46, '255,210,140', 0.08);
    ctx.rotate(P.lean + (P.whirl ? 0.25 : 0));
    const dead = this.mode === 'dying';
    // wings
    const flap = dead ? 0 : Math.sin(a * 55);
    for (const [ox, base] of [[-2, -2.05], [2, -2.45]]) {
      ctx.save(); ctx.translate(ox - 4, -16); ctx.rotate(base + flap * 0.28);
      ctx.beginPath(); ctx.ellipse(18, 0, 22, 7, 0, 0, TAU);
      ctx.fillStyle = col(white, 'rgba(235,240,215,0.38)'); ctx.fill(); inkStroke(ctx, white, 1.4);
      ctx.restore();
    }
    // cape
    const cw = Math.sin(a * 4) * 3;
    ctx.beginPath();
    ctx.moveTo(-6, -20); ctx.quadraticCurveTo(-18, -2, -22 + cw, 18);
    ctx.lineTo(-17 + cw, 14); ctx.lineTo(-14 + cw, 22); ctx.lineTo(-9 + cw, 15); ctx.lineTo(-5, 18);
    ctx.quadraticCurveTo(-2, 0, 2, -18); ctx.closePath();
    fillInk(ctx, '#1d1712', white, 2);
    // striped abdomen hanging back
    ctx.save(); ctx.translate(-7, 14); ctx.rotate(0.45 + Math.sin(a * 2.2) * 0.06);
    ctx.beginPath(); ctx.ellipse(0, 4, 9, 15, 0, 0, TAU);
    fillInk(ctx, k.stripe, white, 2.2);
    if (!white) {
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, 4, 8, 14, 0, 0, TAU); ctx.clip();
      ctx.fillStyle = INK; for (const yy of [-4, 4, 12]) ctx.fillRect(-10, yy, 20, 3.5);
      ctx.restore();
    }
    ctx.beginPath(); ctx.moveTo(-3, 17); ctx.lineTo(0, 27); ctx.lineTo(3, 17); fillInk(ctx, '#efe6cf', white, 1.5);
    ctx.restore();
    // legs
    ctx.beginPath();
    ctx.moveTo(-2, 6); ctx.lineTo(-6 + Math.sin(a * 5) * 2, 18); ctx.lineTo(-3, 28);
    ctx.moveTo(4, 6); ctx.lineTo(6 + Math.sin(a * 5 + 1) * 2, 18); ctx.lineTo(9, 27);
    inkStroke(ctx, white, 2.4);
    // back weapon arm
    if (k.kind === 'blades' && k.armed && !P.whirl) this.drawBlade(ctx, -6, -6, (P.slash > 0 ? 0.4 : P.slash < 0 ? -2.6 : -2.2) + P.cross * 1.2, white, 0.85);
    // cuirass
    ctx.beginPath();
    ctx.moveTo(-10, -20); ctx.quadraticCurveTo(0, -24, 11, -19);
    ctx.quadraticCurveTo(13, -6, 8, 6); ctx.quadraticCurveTo(0, 9, -8, 6);
    ctx.quadraticCurveTo(-13, -6, -10, -20); ctx.closePath();
    fillInk(ctx, '#2a2620', white, 2.4);
    if (!white) {
      ctx.strokeStyle = '#c9a64a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-8, -17); ctx.quadraticCurveTo(0, -20, 9, -16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(0, 5); ctx.stroke();
      // sash
      ctx.strokeStyle = k.sash; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-10, -16); ctx.lineTo(9, 3); ctx.stroke();
    }
    // pauldron
    ctx.beginPath(); ctx.ellipse(6, -17, 7, 5, -0.3, 0, TAU); fillInk(ctx, '#3a3428', white, 2);
    // head: pale helm-mask
    ctx.save(); ctx.translate(5, -31);
    if (k.kind === 'lance') {
      ctx.beginPath(); ctx.moveTo(-4, -10); ctx.quadraticCurveTo(-10, -26, -20, -34 + Math.sin(a * 3) * 2); ctx.quadraticCurveTo(-6, -24, 2, -11);
      fillInk(ctx, '#d9b13a', white, 1.8);
    } else if (k.kind === 'blades') {
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 5, -9); ctx.quadraticCurveTo(s * 12 - 4, -22, s * 4 - 8, -28); ctx.quadraticCurveTo(s * 6 - 2, -18, s * 1, -10); fillInk(ctx, '#efe6cf', white, 1.6); }
    }
    ctx.beginPath();
    ctx.moveTo(-9, -2);
    ctx.quadraticCurveTo(-10, -13, 0, -13); ctx.quadraticCurveTo(10, -13, 10, -3);
    ctx.quadraticCurveTo(11, 6, 6, 11); ctx.lineTo(4, 16); ctx.lineTo(1, 10);
    ctx.quadraticCurveTo(-7, 8, -9, -2);
    fillInk(ctx, '#efe6cf', white, 2.2);
    if (k.kind === 'bow') {
      ctx.beginPath(); ctx.moveTo(-11, 6); ctx.quadraticCurveTo(-14, -14, 2, -16); ctx.quadraticCurveTo(12, -16, 12, -6); ctx.quadraticCurveTo(4, -10, -4, -6); ctx.quadraticCurveTo(-8, 0, -11, 6);
      fillInk(ctx, k.sash, white, 1.8);
    }
    if (!white) {
      ctx.fillStyle = INK;
      for (const [ex, r] of [[5, 0], [-2, 0]]) { ctx.beginPath(); ctx.ellipse(ex, -2, 2.6, 4.2, 0.35, 0, TAU); ctx.fill(); }
      const ec = dead ? '#555' : k.eye;
      eye(ctx, 5.4, -1.5, 1.6, ec, !dead, 'angry'); eye(ctx, -1.6, -1.5, 1.6, ec, !dead, 'angry');
      // mandible points
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(7, 8); ctx.lineTo(10, 12); ctx.moveTo(2, 9); ctx.lineTo(2, 13); ctx.stroke();
    }
    ctx.restore();
    // front weapon arm
    if (k.kind === 'lance') this.drawLance(ctx, k, white);
    else if (k.kind === 'blades') {
      if (P.whirl) {
        for (const s of [0, Math.PI]) this.drawBlade(ctx, 0, -4, P.spin + s, white, 1.1);
        if (!white) { ctx.strokeStyle = 'rgba(255,200,160,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -4, 34, 0, TAU); ctx.stroke(); }
      } else if (k.armed) this.drawBlade(ctx, 10, -6, (P.slash > 0 ? 0.6 : P.slash < 0 ? -2.0 : -0.7) - P.cross * 1.2, white, 1);
    } else this.drawBow(ctx, k, white);
    // arm
    ctx.beginPath(); ctx.moveTo(5, -16); ctx.lineTo(11, -8); ctx.lineTo(13, -4); inkStroke(ctx, white, 3);
    ctx.restore();
  }
  drawBlade(ctx, x, y, ang, white, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(20, -8, 40, 2); ctx.quadraticCurveTo(22, 0, 0, 3); ctx.closePath();
    fillInk(ctx, '#f2ead2', white, 1.8);
    ctx.beginPath(); ctx.moveTo(-2, -5); ctx.lineTo(-2, 6); inkStroke(ctx, white, 3, '#c9a64a');
    ctx.restore();
  }
  drawLance(ctx, k, white) {
    const P = k.pose;
    ctx.save(); ctx.translate(10, -4); ctx.rotate(P.aim);
    const ext = P.couch * 8;
    ctx.beginPath(); ctx.moveTo(-34 + ext, 0); ctx.lineTo(70 + ext, 0); inkStroke(ctx, white, 5);
    ctx.beginPath(); ctx.moveTo(-34 + ext, 0); ctx.lineTo(70 + ext, 0); inkStroke(ctx, white, 2.5, '#8a6a3a');
    // vamplate
    ctx.beginPath(); ctx.moveTo(4 + ext, -9); ctx.lineTo(16 + ext, -3); ctx.lineTo(16 + ext, 3); ctx.lineTo(4 + ext, 9); ctx.closePath();
    fillInk(ctx, '#d9b13a', white, 1.8);
    // the sting
    ctx.beginPath(); ctx.moveTo(66 + ext, -5); ctx.lineTo(96 + ext, 0); ctx.lineTo(66 + ext, 5); ctx.closePath();
    fillInk(ctx, '#f2ead2', white, 1.8);
    if (!white) {
      ctx.fillStyle = k.sash;
      ctx.beginPath(); ctx.moveTo(52 + ext, -2); ctx.lineTo(40 + ext, -14 + Math.sin(k.anim * 9) * 3); ctx.lineTo(46 + ext, -2); ctx.fill();
      if (k.tele > 0) glow(ctx, 92 + ext, 0, 18, '255,240,200', 0.6);
    }
    ctx.restore();
  }
  drawBow(ctx, k, white) {
    const P = k.pose;
    ctx.save(); ctx.translate(12, -6); ctx.rotate(P.aim);
    const pull = P.draw * 16;
    ctx.beginPath(); ctx.moveTo(-2, -26); ctx.quadraticCurveTo(14, -14, 6, 0); ctx.quadraticCurveTo(14, 14, -2, 26);
    inkStroke(ctx, white, 5);
    ctx.beginPath(); ctx.moveTo(-2, -26); ctx.quadraticCurveTo(14, -14, 6, 0); ctx.quadraticCurveTo(14, 14, -2, 26);
    inkStroke(ctx, white, 2.4, '#7a5a2a');
    ctx.strokeStyle = col(white, '#efe6cf'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-2, -26); ctx.lineTo(-2 - pull, 0); ctx.lineTo(-2, 26); ctx.stroke();
    if (P.draw > 0.1) {
      ctx.beginPath(); ctx.moveTo(-2 - pull, 0); ctx.lineTo(26, 0); inkStroke(ctx, white, 2, '#d8c48a');
      ctx.beginPath(); ctx.moveTo(32, 0); ctx.lineTo(24, -3.5); ctx.lineTo(24, 3.5); ctx.closePath(); fillInk(ctx, '#f2ead2', white, 1.2);
      if (!white && k.tele > 0) glow(ctx, 30, 0, 16, '232,255,140', 0.6);
    }
    ctx.restore();
  }

  drawExtra(ctx, t) {
    // telegraph lines
    for (const l of this.lines) {
      const k = l.t / l.max;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${l.color},${0.15 + 0.45 * (1 - k)})`;
      ctx.lineWidth = 2 + (1 - k) * 3;
      ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 80;
      ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
      ctx.restore();
    }
    // arrow-rain marks on the floor
    for (const m of this.marks) {
      const k = clamp(1 - m.t / m.max, 0, 1);
      const gy = this.groundY;
      glow(ctx, m.x, gy - 4, 30, '232,255,140', 0.2 + 0.3 * k);
      ctx.strokeStyle = `rgba(232,255,140,${0.4 + 0.5 * k})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(m.x - 14, gy - 2); ctx.lineTo(m.x + 14, gy - 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(m.x, gy - 6 - (1 - k) * 30); ctx.lineTo(m.x, gy - 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(m.x - 5, gy - 12); ctx.lineTo(m.x, gy - 4); ctx.lineTo(m.x + 5, gy - 12); ctx.stroke();
    }
  }
}

export default { gnash: Gnash, stingercourt: StingerCourt };
