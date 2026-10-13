// Bosses of area 'unwoven' (The Unwoven): THE UNRAVELLER, End of Every Thread.
import { Boss } from './boss.js';
import { Entity } from '../entities/base.js';
import { Projectile, registerProjectileArt } from '../entities/projectile.js';
import { VIEW_W, VIEW_H } from '../core/constants.js';
import { TAU, clamp } from '../core/math.js';
import { Strand, Overlay, glow, lerp, clipLine, rayEnd } from './loom.js';

const DT = 1 / 60;
const VIO = '208,123,255';
const PALE = '#f0c8ff';
const VOIDC = '#07040c';

registerProjectileArt('ur_hook', (ctx, p, t) => {
  ctx.save();
  ctx.strokeStyle = `rgba(${VIO},0.5)`; ctx.lineWidth = 1.2;
  ctx.beginPath(); p.trail.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
  glow(ctx, p.cx, p.cy, p.r * 3, VIO, 0.5);
  ctx.translate(p.cx, p.cy); ctx.rotate(p.rot);
  ctx.strokeStyle = VOIDC; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-p.r * 1.4, 0); ctx.lineTo(p.r, 0); ctx.arc(p.r * 0.4, p.r * 0.6, p.r * 0.75, -1.2, 2.2); ctx.stroke();
  ctx.strokeStyle = PALE; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.restore();
});

registerProjectileArt('ur_end', (ctx, p, t) => {
  // a loose end, wriggling
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.rot);
  glow(ctx, 0, 0, p.r * 2.5, VIO, 0.3);
  ctx.strokeStyle = VOIDC; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p.r * 1.5, 0);
  for (let i = 1; i <= 6; i++) ctx.lineTo(p.r * 1.5 - i * p.r * 0.6, Math.sin(t * 25 + i * 1.3) * p.r * 0.35);
  ctx.stroke();
  ctx.strokeStyle = PALE; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
});

class Hook extends Projectile {
  constructor(game, x, y, vx, vy, owner) {
    super(game, x, y, vx, vy, { art: 'ur_hook', r: 9, life: 2, dmg: 1, ignoreWalls: true });
    this.owner = owner;
  }
  onHitPlayer(p) { if (this.owner.mode === 'fight') this.owner.attachTether(); super.onHitPlayer(p); }
}

// A copy of the Unraveller. One bonk unmakes it.
class Copy extends Entity {
  constructor(game, owner, x, y, delay, kind) {
    super(game, x - owner.w / 2, y - owner.h / 2, owner.w, owner.h);
    this.owner = owner; this.t = -delay; this.kind = kind; this.z = 3; this.isEnemy = true; this.hittable = false;
    this.damage = 1; this.facing = 1; this.alpha = 0; this.state = 'appear'; this.seed = Math.random() * 10;
    this.def = { id: 'unraveller_copy', glints: 0 };
    this.tele = 0;
  }
  update(dt) {
    const o = this.owner, p = this.game.player;
    if (o.dead || o.mode !== 'fight') { this.vanish(); return; }
    this.t += dt;
    if (this.t < 0) return;
    this.facing = p.cx < this.cx ? -1 : 1;
    if (this.state === 'appear') {
      this.alpha = Math.min(1, this.t / 0.4);
      this.hittable = this.t > 0.2;
      if (this.t > 0.55) { this.state = 'tele'; this.t = 0; this.tele = 1; this.aim = Math.atan2(p.cy - this.cy, p.cx - this.cx); this.game.sfx('charge'); }
    } else if (this.state === 'tele') {
      if (this.t < 0.32) this.aim = Math.atan2(p.cy - this.cy, p.cx - this.cx);
      if (this.t > 0.55) {
        this.state = 'act'; this.t = 0; this.tele = 0;
        if (this.kind === 'slash') {
          const B = o.box();
          const [x1, y1, x2, y2] = clipLine(this.cx, this.cy, this.aim, B);
          o.line({ x1, y1, x2, y2, warn: 0.45, live: 0.2, width: 14, sfx: 'slash' });
        } else this.game.sfx('dash');
      }
    } else if (this.state === 'act') {
      if (this.kind === 'dash') {
        this.harmful = true;
        this.x += Math.cos(this.aim) * 900 * dt; this.y += Math.sin(this.aim) * 900 * dt;
        this.y = Math.min(this.y, o.G - this.h);
        if (Math.random() < 0.6) this.game.fx.add({ x: this.cx, y: this.cy + this.owner.rand(-40, 40), vx: 0, vy: 0, life: 0.3, size: 3, color: 'rgba(7,4,12,0.8)', g: 0, front: false });
      }
      if (this.t > (this.kind === 'dash' ? 0.42 : 0.9)) { this.harmful = false; this.state = 'fade'; this.t = 0; }
    } else if (this.state === 'fade') {
      this.alpha = Math.max(0, 1 - this.t / 0.35); this.hittable = false;
      if (this.t > 0.35) this.dead = true;
    }
  }
  vanish() {
    if (this.dead) return;
    this.dead = true;
    this.game.fx.burst(this.cx, this.cy, 16, { color: VOIDC, speed: 260, size: 4, life: 0.6, shape: 'shard', g: 0 });
    this.game.fx.ring(this.cx, this.cy, 10, 70, 0.4, `rgba(${VIO},0.8)`, 3);
  }
  onBonk() { if (!this.hittable) return false; this.game.sfx('tangleFree'); this.vanish(); return true; }
  hurt() { if (this.hittable) this.vanish(); }
  hurtbox() { return { x: this.x + 14, y: this.y + 20, w: this.w - 28, h: this.h - 30 }; }
  hitboxes() { return this.harmful ? [{ x: this.x + 18, y: this.y + 24, w: this.w - 36, h: this.h - 40 }] : []; }
  draw(ctx, t) {
    if (this.t < 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha * 0.92;
    this.owner.drawFigure(ctx, this.cx, this.y + this.h, t + this.seed, false, { facing: this.facing, arm: this.state === 'tele' ? 1 : 0, copy: true });
    ctx.restore();
  }
}

// =================================================================================================
// THE UNRAVELLER — End of Every Thread
// A figure made of nothing but loose ends. It does not weave; it undoes. It remembers where it
// was a moment ago and goes back there, and it pulls the thread out of anything that gets close.
// =================================================================================================
export class Unraveller extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'unraveller', size: [90, 200], music: 'boss_unraveller', air: true, glints: 500, introTime: 3.0 });
    if (this.dead) return;
    this.noPhysics = true;
    this.G = this.groundY;
    this.hover = 16;
    this.y = this.G - this.h - this.hover;
    this.past = [];
    this.count = 0;
    this.alpha = 0;
    this.dark = 0; this.darkTo = 0.55;
    this.arm = 0;      // raised arm pose 0..1
    this.bristle = 0;  // threads standing on end
    this.tether = null;
    this.ghosts = [];
    this.hunch = 0;
    this.eyeFlash = 0;
    this.blinkK = 1;   // 1 = solid, 0 = gone
  }

  box() { const A = this.arena; return { x: A.x, y: A.y, w: A.w, h: this.G - A.y }; }
  line(o) { return this.game.add(new Strand(this.game, Object.assign({ owner: this, rgb: VIO, style: 'void' }, o))); }
  setC(x, y) { this.x = x - this.w / 2; this.y = y - this.h / 2; }
  floorCY() { return this.G - this.h / 2 - this.hover; }

  // ---------- life ----------
  update(dt) {
    super.update(dt);
    if (this.dead) return;
    if (!this.over) this.over = this.game.add(new Overlay(this.game, this, 3.5));
    this.dark += (this.darkTo - this.dark) * Math.min(1, dt * 1.5);
    this.eyeFlash = Math.max(0, this.eyeFlash - dt * 2);
    for (const g of this.ghosts) g.t -= dt;
    this.ghosts = this.ghosts.filter((g) => g.t > 0);
    if (this.mode === 'fight') {
      this.past.push({ x: this.cx, y: this.cy });
      if (this.past.length > 420) this.past.shift();
    }
    if (this.mode === 'dying') { this.darkTo = 0; this.blinkK = Math.max(0, 1 - this.dieT / 2.2); }
  }

  think(dt) {
    // the tether: thread pulled out of Bead
    const T = this.tether;
    if (!T) return;
    this.arm = Math.max(this.arm, 0.5);
    const p = this.player, sv = this.game.save;
    T.t -= dt;
    const d = Math.hypot(p.cx - this.cx, p.cy - this.cy);
    const drain = (this.phase >= 3 ? 30 : 22) * dt;
    T.acc += drain;
    if (T.acc >= 1) { const n = Math.floor(T.acc); T.acc -= n; sv.thread = Math.max(0, sv.thread - n); }
    if (Math.random() < 0.7) {
      const k = Math.random();
      this.fx.add({ x: lerp(p.cx, this.handX(), k), y: lerp(p.cy, this.handY(), k), vx: (this.handX() - p.cx) * 1.2, vy: (this.handY() - p.cy) * 1.2, life: 0.35, size: 2, color: '#b8323e', g: 0, front: true });
    }
    if (d > 560 || T.t <= 0 || T.hits >= 2 || p.dead) {
      if (T.t <= 0 && sv.thread === 0 && !p.dead) p.hurt(1, this.cx);   // nothing left to pull: it pulls Bead
      this.tether = null;
      this.sfx('tangleFree');
      this.fx.burst(p.cx, p.cy, 10, { color: '#b8323e', speed: 200, size: 2, life: 0.5 });
    }
  }
  attachTether() {
    if (this.tether) return;
    this.tether = { t: 2.6, acc: 0, hits: 0 };
    this.sfx('tangleHit');
  }
  onHurt() { if (this.tether) this.tether.hits++; }
  // where the leading hand is, matching drawFigure()
  handX() { const r = this.arm, f = this.facing; return this.cx + f * (30 + 30 + 34 * r + 12 + 32 * r); }
  handY() { const r = this.arm; return this.y + this.hunch * 34 + 60 + 64 - 110 * r + 44 - 76 * r; }

  introUpdate(dt, t) {
    this.alpha = Math.min(1, t / 1.8);
    this.darkTo = 0.55 * Math.min(1, t / 2);
    if (t > 2.0 && !this.introFx) {
      this.introFx = true;
      this.eyeFlash = 1;
      this.game.flash('rgba(20,0,40,0.7)', 0.6);
      this.fx.ring(this.cx, this.cy, 20, 480, 1.0, `rgba(${VIO},0.8)`, 6);
      this.sfx('phase');
    }
  }
  idle() { this.alpha = 0.25 + 0.1 * Math.sin(this.anim * 2); this.facePlayer(); }

  // ---------- selection ----------
  onPhase(n) { this.pendingPhase = Math.max(this.pendingPhase || 0, n); }
  chooseAttack() {
    this.arm = 0; this.bristle = 0;
    if (this.pendingPhase) { const n = this.pendingPhase; this.pendingPhase = 0; return this.phaseShift(n); }
    this.count++;
    if (this.count % 5 === 0) return this.fray();
    return super.chooseAttack();
  }
  attackList() {
    const P = this.phase;
    const copies = this.game.entities.some((e) => e instanceof Copy && !e.dead);
    return [
      { name: 'slash', w: 3, fn: this.voidSlash },
      { name: 'blink', w: 2.5, fn: this.blinkCut },
      { name: 'copies', w: copies ? 0 : 2, fn: this.copies },
      { name: 'rewind', w: this.past.length > 240 ? 2.2 : 0, fn: this.rewind },
      { name: 'unthread', w: this.tether ? 0 : 2, fn: this.unthread },
      { name: 'burst', w: this.distX() < 260 ? 2.5 : 0.4, fn: this.burst },
      { name: 'end', w: P >= 3 ? 2.2 : 0, fn: this.endOfThreads },
    ];
  }

  *drift(T) {
    // glide along the floor to keep a wary distance
    const p = this.player, A = this.arena;
    const want = clamp(p.cx + (this.cx < p.cx ? -260 : 260), A.x + 60, A.x + A.w - 60);
    const n = Math.round(T / this.speedMul / DT);
    for (let i = 0; i < n; i++) {
      this.setC(this.cx + (want - this.cx) * 0.04, lerp(this.cy, this.floorCY(), 0.1));
      this.facePlayer();
      yield;
    }
  }
  *blinkTo(x, y) {
    this.sfx('phase');
    this.fx.burst(this.cx, this.cy, 14, { color: VOIDC, speed: 220, size: 4, life: 0.5, shape: 'shard', g: 0 });
    for (let i = 0; i <= 10; i++) { this.blinkK = 1 - i / 10; yield; }
    this.hittable = false;
    const A = this.arena;
    this.setC(clamp(x, A.x + 50, A.x + A.w - 50), clamp(y, A.y + this.h / 2, this.floorCY()));
    this.facePlayer();
    yield 0.12;
    this.fx.ring(this.cx, this.cy, 70, 10, 0.3, `rgba(${VIO},0.8)`, 3);
    for (let i = 0; i <= 10; i++) { this.blinkK = i / 10; yield; }
    this.hittable = true;
  }

  // ---------- attacks ----------
  // Cuts through the arena itself.
  *voidSlash() {
    const P = this.phase;
    yield* this.drift(0.4);
    this.arm = 1; this.tele = 0.45; this.eyeFlash = 1;
    this.sfx('rustle');
    yield 0.3;
    const n = P >= 3 ? 4 : P >= 2 ? 3 : 2;
    const B = this.box();
    let a = Math.random() * Math.PI;
    for (let i = 0; i < n; i++) {
      const p = this.player;
      a += Math.PI / 2.3 + this.rand(-0.3, 0.3);
      const pair = P >= 2 && i === n - 1;
      for (const da of pair ? [-0.5, 0.5] : [0]) {
        const [x1, y1, x2, y2] = clipLine(p.cx, p.cy, a + da, B);
        this.line({ x1, y1, x2, y2, warn: P >= 3 ? 0.52 : 0.62, live: 0.22, width: 16, sfx: 'slash', onLive: () => this.shake(5, 0.15) });
      }
      yield P >= 3 ? 0.3 : 0.4;
    }
    yield 0.6;
    this.arm = 0;
    yield 0.3;
  }

  // Vanishes and reappears behind Bead, already cutting.
  *blinkCut() {
    const P = this.phase;
    const reps = P >= 3 ? 3 : P >= 2 ? 2 : 1;
    for (let r = 0; r < reps; r++) {
      const p = this.player;
      const side = p.b.facing > 0 ? -1 : 1;
      yield* this.blinkTo(p.cx + side * 150, this.floorCY());
      this.facePlayer();
      this.arm = 1; this.tele = 0.45; this.eyeFlash = 1;
      const reach = 230;
      const x = this.facing > 0 ? this.cx : this.cx - reach;
      const cy0 = this.y + this.h - 60;
      this.cutWarn = { x, y: cy0, w: reach, t: 0 };
      this.sfx('charge');
      yield P >= 3 ? 0.42 : 0.5;
      this.cutWarn = null;
      this.zone(x, cy0 - 50, reach, 104, 0.16);
      this.fx.slash(this.cx + this.facing * reach * 0.5, cy0, this.facing > 0 ? 0 : Math.PI, reach, `rgba(${VIO},0.9)`, 0.22);
      this.sfx('slash'); this.shake(4, 0.15);
      this.arm = 0;
      yield 0.45;
    }
    yield 0.35;
  }

  // Splits into several of itself. The copies are hollow: one bonk and they come apart.
  *copies() {
    const P = this.phase, A = this.arena;
    this.tele = 0.5; this.eyeFlash = 1;
    this.sfx('phase');
    yield 0.4;
    const p = this.player;
    const n = P >= 2 ? 3 : 2;
    const spots = [];
    for (let i = 0; i < n + 1; i++) {
      const a = Math.PI + (i / n) * Math.PI;
      spots.push({ x: clamp(p.cx + Math.cos(a) * 300, A.x + 60, A.x + A.w - 60), y: Math.min(this.floorCY(), p.cy + Math.sin(a) * 200) });
    }
    // which one is real
    const real = Math.floor(Math.random() * spots.length);
    const kinds = ['dash', 'slash'];
    let k = 0;
    for (let i = 0; i < spots.length; i++) {
      if (i === real) continue;
      this.game.add(new Copy(this.game, this, spots[i].x, spots[i].y, 0.12 * k, kinds[k % 2]));
      k++;
    }
    yield* this.blinkTo(spots[real].x, spots[real].y);
    // the real one acts too
    this.arm = 1; this.tele = 0.5; this.sfx('charge');
    yield 0.55;
    const pp = this.player;
    const aim = Math.atan2(pp.cy - this.cy, pp.cx - this.cx);
    const [x1, y1, x2, y2] = clipLine(this.cx, this.cy, aim, this.box());
    this.line({ x1, y1, x2, y2, warn: 0.45, live: 0.22, width: 16, sfx: 'slash' });
    yield 1.2;
    this.arm = 0;
    yield* this.blinkTo(this.cx, this.floorCY());
    yield 0.3;
  }

  // Goes back to where it was. The way back is a cut.
  *rewind() {
    const P = this.phase;
    const H = this.past;
    const pts = [];
    for (const s of [1.1, 2.2, 3.3, 4.4]) {
      const i = H.length - 1 - Math.round(s / DT);
      if (i >= 0) pts.push(H[i]);
    }
    if (pts.length < 2) { yield 0.2; return; }
    // ghosts appear where it was
    for (const q of pts) this.ghosts.push({ x: q.x, y: q.y, t: 1.6 });
    this.eyeFlash = 1; this.tele = 0.6;
    this.sfx('phase');
    let prev = { x: this.cx, y: this.cy };
    const warn = 0.7, step = 0.17;
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i];
      if (Math.hypot(q.x - prev.x, q.y - prev.y) > 30) this.line({ x1: prev.x, y1: prev.y, x2: q.x, y2: q.y, warn: warn + i * step, live: 0.22, width: 20, sfx: 'slash' });
      prev = q;
    }
    yield warn;
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i];
      this.setC(q.x, q.y);
      this.fx.ring(q.x, q.y, 60, 10, 0.25, `rgba(${VIO},0.8)`, 3);
      this.sfx('phase');
      if (P >= 2) this.fireRing(q.x, q.y, 6, 210, { art: 'ur_end', r: 7, life: 2.5, ignoreWalls: true, a0: i * 0.5 });
      yield step;
    }
    this.past.length = 0;
    yield 0.5;
    yield* this.blinkTo(this.cx, this.floorCY());
  }

  // Throws a hook of void thread. If it catches, the Unraveller pulls the thread out of Bead.
  *unthread() {
    yield* this.drift(0.4);
    this.facePlayer();
    this.arm = 1; this.tele = 0.5; this.eyeFlash = 1;
    this.sfx('charge');
    yield 0.5;
    const n = this.phase >= 2 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const p = this.player;
      const a = Math.atan2(p.cy - this.handY(), p.cx - this.handX()) + (i - (n - 1) / 2) * 0.32;
      this.game.add(new Hook(this.game, this.handX(), this.handY(), Math.cos(a) * 560, Math.sin(a) * 560, this));
    }
    this.sfx('throw');
    yield 0.6;
    if (this.tether) {
      // while tethered it keeps its distance and cuts at Bead
      yield* this.drift(0.5);
      if (this.tether && this.phase >= 2) {
        const p = this.player;
        const [x1, y1, x2, y2] = clipLine(p.cx, p.cy, Math.random() * Math.PI, this.box());
        this.line({ x1, y1, x2, y2, warn: 0.6, live: 0.22, width: 16, sfx: 'slash' });
      }
      yield 1.0;
    }
    this.arm = 0;
    yield 0.4;
  }

  // Every loose end stands up at once.
  *burst() {
    const P = this.phase;
    this.bristle = 1; this.tele = 0.5;
    this.sfx('rustle');
    yield 0.5;
    const R = 150;
    this.zone(this.cx - R, this.cy - R, R * 2, R * 2, 0.18);
    this.fx.ring(this.cx, this.cy, 20, R + 20, 0.3, `rgba(${VIO},0.9)`, 8);
    this.fx.burst(this.cx, this.cy, 30, { color: VOIDC, speed: 380, size: 4, life: 0.5, shape: 'shard', g: 0 });
    this.sfx('burst'); this.shake(6, 0.25);
    if (P >= 2) this.fireRing(this.cx, this.cy, 10, 260, { art: 'ur_end', r: 7, life: 2.5, ignoreWalls: true, a0: Math.random() });
    this.bristle = 0;
    yield 0.8;
  }

  // Phase 3: it rises into the dark, and every way out is cut, again and again.
  *endOfThreads() {
    const A = this.arena;
    yield* this.blinkTo(clamp(this.player.cx, A.x + 300, A.x + A.w - 300), Math.max(A.y + 120, this.G - 360));
    this.darkTo = 0.92;
    this.sfx('bossRoar'); this.shake(8, 1.0); this.eyeFlash = 1;
    yield 0.7;
    const B = this.box();
    let a0 = Math.random() * TAU;
    for (let r = 0; r < 3; r++) {
      this.arm = 1;
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * TAU;
        const [ex, ey] = rayEnd(this.cx, this.cy, a, B);
        this.line({ x1: this.cx, y1: this.cy, x2: ex, y2: ey, warn: 0.75, live: 0.24, width: 15, sfx: i === 0 ? 'slash' : false });
      }
      a0 += Math.PI / n;
      yield 1.0;
    }
    this.arm = 0;
    this.darkTo = 0.8;
    yield* this.fray(2.0);
  }

  // Comes apart at the hem for a moment: exposed.
  *fray(T) {
    T = T || (this.phase >= 3 ? 1.4 : 1.6);
    yield* this.blinkTo(clamp(this.player.cx + this.rand(-220, 220), this.arena.x + 80, this.arena.x + this.arena.w - 80), this.floorCY() + 30);
    this.hunch = 1;
    this.sfx('tangleFree');
    yield* this.frames(T, () => { if (Math.random() < 0.3) this.fx.add({ x: this.cx + this.rand(-30, 30), y: this.y + this.h - 10, vx: this.rand(-40, 40), vy: -this.rand(20, 80), life: 1, size: 2.5, color: VOIDC, g: -20, shape: 'shard', front: false }); });
    this.hunch = 0;
    this.setC(this.cx, this.floorCY());
    yield 0.2;
  }
  *frames(T, fn) {
    const n = Math.max(1, Math.round(T / this.speedMul / DT));
    for (let i = 1; i <= n; i++) { fn(i / n); yield; }
  }

  *phaseShift(n) {
    this.harmless = true;
    this.tether = null;
    this.game.hitstop(0.3);
    this.game.flash('rgba(30,0,50,0.9)', 0.9);
    this.shake(14, 1.1);
    this.sfx('bossRoar'); this.sfx('screech');
    this.fx.ring(this.cx, this.cy, 20, 700, 1.2, `rgba(${VIO},0.9)`, 8);
    this.fx.burst(this.cx, this.cy, 50, { color: VOIDC, speed: 520, size: 5, life: 1.2, shape: 'shard', g: 0 });
    this.eyeFlash = 1;
    if (n === 2) { this.darkTo = 0.72; this.speedMul *= 1.08; }
    else { this.darkTo = 0.82; this.speedMul *= 1.12; }
    yield* this.frames(1.3, (k) => { this.bristle = Math.sin(k * Math.PI); });
    this.bristle = 0;
    this.harmless = false;
    yield 0.2;
  }

  onDeath() {
    this.tether = null; this.cutWarn = null; this.ghosts = []; this.arm = 0; this.bristle = 1; this.hunch = 1;
    for (const e of this.game.entities) if (e instanceof Copy) e.vanish();
  }

  // ---------- collision ----------
  bodyBox() { return { x: this.x + 16, y: this.y + 22 + this.hunch * 30, w: this.w - 32, h: this.h - 34 - this.hunch * 30 }; }
  hurtbox() { return this.blinkK < 0.5 ? null : this.bodyBox(); }
  hitboxes() {
    if (this.harmless || this.hunch || this.blinkK < 0.6) return this.hits;
    return [{ x: this.x + 24, y: this.y + 34, w: this.w - 48, h: this.h - 50 }, ...this.hits];
  }

  // ---------- drawing ----------
  drawOver(ctx, t) {
    const cam = this.game.camera, vx = cam.viewX, vy = cam.viewY, p = this.player;
    const D = this.dark;
    if (D > 0.01) {
      if (!this.darkC) { this.darkC = document.createElement('canvas'); this.darkC.width = VIEW_W; this.darkC.height = VIEW_H; }
      const d = this.darkC.getContext('2d');
      d.globalCompositeOperation = 'source-over';
      d.clearRect(0, 0, VIEW_W, VIEW_H);
      // darkness is deepest around the Unraveller itself
      const bx = this.cx - vx, by = this.cy - vy;
      d.fillStyle = `rgba(4,2,8,${D * 0.55})`; d.fillRect(0, 0, VIEW_W, VIEW_H);
      const g0 = d.createRadialGradient(bx, by, 0, bx, by, 520);
      g0.addColorStop(0, `rgba(4,2,8,${D * 0.85})`); g0.addColorStop(0.5, `rgba(4,2,8,${D * 0.5})`); g0.addColorStop(1, 'rgba(4,2,8,0)');
      d.fillStyle = g0; d.fillRect(0, 0, VIEW_W, VIEW_H);
      d.globalCompositeOperation = 'destination-out';
      const lr = this.game.save.abilities.lantern ? 230 : 170;
      const hl = { x: p.cx - vx, y: p.cy - vy };
      const g = d.createRadialGradient(hl.x, hl.y, 0, hl.x, hl.y, lr);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g; d.beginPath(); d.arc(hl.x, hl.y, lr, 0, TAU); d.fill();
      ctx.drawImage(this.darkC, vx, vy);
    }
    // eyes in the dark, its own and the copies'
    if (this.mode !== 'dormant' || this.alpha > 0) {
      const figs = [this, ...this.game.entities.filter((e) => e instanceof Copy && !e.dead && e.t >= 0)];
      for (const f of figs) {
        const a = (f === this ? this.blinkK * Math.max(this.alpha, this.mode === 'fight' ? 1 : 0) : f.alpha);
        if (a <= 0.02) continue;
        const hx = f.cx + (f.facing || 1) * 3, hy = f.y + 30 + (f === this ? this.hunch * 34 : 0);
        glow(ctx, hx, hy, 34, VIO, 0.45 * a + (f === this ? this.eyeFlash * 0.5 : (f.tele || 0) * 0.5));
        ctx.globalAlpha = a;
        ctx.fillStyle = '#fff';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + s * 7, hy, 2.4, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
    }
    // ghosts of where it was
    for (const g of this.ghosts) {
      const a = Math.min(1, g.t / 0.4) * 0.6;
      ctx.save(); ctx.globalAlpha = a;
      this.drawFigure(ctx, g.x, g.y + this.h / 2, t, false, { ghost: true, facing: 1 });
      ctx.restore();
    }
    // tether
    if (this.tether) {
      const hx = this.handX(), hy = this.handY();
      ctx.save();
      ctx.strokeStyle = 'rgba(184,50,62,0.95)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.cx, p.cy);
      ctx.quadraticCurveTo((p.cx + hx) / 2 + Math.sin(t * 20) * 10, (p.cy + hy) / 2 + 20, hx, hy); ctx.stroke();
      ctx.strokeStyle = `rgba(${VIO},0.6)`; ctx.lineWidth = 6; ctx.globalCompositeOperation = 'lighter'; ctx.stroke();
      ctx.restore();
      const d = Math.hypot(p.cx - this.cx, p.cy - this.cy);
      // how far until it snaps
      ctx.strokeStyle = `rgba(${VIO},${0.2 + 0.3 * (d / 560)})`; ctx.setLineDash([4, 6]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(this.cx, this.cy, 560, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  drawExtra(ctx, t) {
    if (this.cutWarn) {
      const c = this.cutWarn;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${VIO},${0.12 + 0.1 * Math.sin(t * 35)})`;
      ctx.fillRect(c.x, c.y - 50, c.w, 104);
      ctx.restore();
    }
  }

  drawBody(ctx, t, white) {
    const a = this.mode === 'dormant' ? this.alpha : this.mode === 'intro' ? this.alpha : 1;
    ctx.save();
    ctx.globalAlpha *= a * this.blinkK;
    this.drawFigure(ctx, this.cx, this.y + this.h, t, white, { facing: this.facing, arm: this.arm, bristle: this.bristle, hunch: this.hunch });
    ctx.restore();
  }

  // The figure: a long hood and cloak of hanging loose ends, a void where the face should be.
  drawFigure(ctx, cx, by, t, white, o = {}) {
    const f = o.facing || 1;
    const H = this.h, hunch = o.hunch || 0, br = o.bristle || 0;
    const top = by - H + hunch * 34;
    const col = white ? '#fff' : VOIDC;
    // it never quite holds still: thin slices of it slip sideways
    const slip = (y) => (white ? 0 : Math.sin(Math.floor(t * 7) * 12.9898 + Math.floor(y / 14) * 78.233) > 0.93 ? Math.sin(t * 50 + y) * 7 : 0);
    // halo of loose ends behind
    if (!white && !o.ghost) {
      glow(ctx, cx, top + 44, 140, VIO, 0.14 + 0.14 * br);
      ctx.strokeStyle = 'rgba(7,4,12,0.85)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 26; i++) {
        const ang = (i / 26) * TAU + Math.sin(t * 0.5 + i) * 0.08;
        const L = 56 + ((i * 37) % 34) + br * 70 + Math.sin(t * 3 + i) * 6;
        const x0 = cx + Math.cos(ang) * 28, y0 = top + 44 + Math.sin(ang) * 28;
        ctx.beginPath(); ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(x0 + Math.cos(ang + 0.4) * L * 0.6, y0 + Math.sin(ang + 0.4) * L * 0.6, cx + Math.cos(ang) * (28 + L), top + 44 + Math.sin(ang) * (28 + L) + 6);
        ctx.stroke();
      }
    }
    // hanging threads below the cloak hem
    const hemY = top + H * 0.55;
    const n = 30;
    const hw = 40 + hunch * 12;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const x0 = cx + (k - 0.5) * hw * 2;
      const len = (by - hemY) - 4 - ((i * 13) % 9) * 5;
      const sway = Math.sin(t * 2.2 + i * 0.8) * 8;
      const x1 = x0 + (k - 0.5) * 30 + sway + (k - 0.5) * 70 * br;
      const y1 = hemY + len - br * 24;
      ctx.strokeStyle = col; ctx.lineWidth = white ? 4 : (i % 3 === 0 ? 3 : 2);
      ctx.beginPath(); ctx.moveTo(x0, hemY - 4);
      ctx.bezierCurveTo(x0, hemY + len * 0.35, x1 - sway * 0.7, hemY + len * 0.7, x1, y1);
      ctx.stroke();
      if (!white && i % 4 === 1) { ctx.strokeStyle = `rgba(${VIO},0.4)`; ctx.lineWidth = 1; ctx.stroke(); }
    }
    // the cloak: a tall hood falling to a ragged hem
    ctx.beginPath();
    const tipX = cx - f * 16 + Math.sin(t * 1.3) * 4, tipY = top - 18;
    ctx.moveTo(tipX, tipY);
    ctx.quadraticCurveTo(cx + 34 + slip(top), top + 6, cx + 30, top + 40);
    ctx.quadraticCurveTo(cx + 52 + slip(top + 60), top + 70, cx + hw + 4, hemY);
    for (let i = 0; i <= 10; i++) {
      const x = cx + hw + 4 - (i / 10) * (hw * 2 + 8);
      const y = hemY + (i % 2 ? 14 : 0) + Math.sin(t * 3 + i) * 3;
      ctx.lineTo(x + slip(y), y);
    }
    ctx.quadraticCurveTo(cx - 52 + slip(top + 60), top + 70, cx - 30, top + 40);
    ctx.quadraticCurveTo(cx - 34 + slip(top), top + 6, tipX, tipY);
    ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    if (!white) {
      ctx.strokeStyle = `rgba(${VIO},0.45)`; ctx.lineWidth = 1.2; ctx.stroke();
      // threads woven down the cloak, coming loose
      ctx.strokeStyle = 'rgba(160,100,210,0.28)'; ctx.lineWidth = 1;
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo(cx + i * 4, top + 40);
        ctx.quadraticCurveTo(cx + i * 9 + slip(top + 80 + i), top + 90, cx + i * 10, hemY + 4);
        ctx.stroke();
      }
    }
    // arms: long sleeves of thread ending in loose fingers
    for (const s of [-1, 1]) {
      const raised = s === f ? (o.arm || 0) : 0;
      const sx = cx + s * 30, sy = top + 60;
      const ex = sx + s * (30 + 34 * raised), ey = sy + 64 - 110 * raised;
      const hx = ex + s * (12 + 32 * raised), hy = ey + 44 - 76 * raised;
      ctx.strokeStyle = col; ctx.lineWidth = white ? 7 : 6;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(ex, ey, hx, hy); ctx.stroke();
      ctx.lineWidth = white ? 3 : 1.8;
      for (let k = 0; k < 5; k++) {
        const ang = Math.atan2(hy - ey, hx - ex) + (k - 2) * 0.3;
        const L = 26 + (k % 2) * 10 + Math.sin(t * 6 + k + s) * 3;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + Math.cos(ang + 0.3) * L * 0.6, hy + Math.sin(ang + 0.3) * L * 0.6, hx + Math.cos(ang) * L, hy + Math.sin(ang) * L); ctx.stroke();
      }
      if (!white && raised) glow(ctx, hx, hy, 34, VIO, 0.55 * raised);
    }
    // the void face: an emptier black, rimmed with violet
    if (!white) {
      const fx = cx + f * 3, fy = top + 30;
      ctx.beginPath(); ctx.ellipse(fx, fy, 15, 22, 0, 0, TAU);
      ctx.fillStyle = '#000'; ctx.fill();
      ctx.strokeStyle = `rgba(${VIO},0.95)`; ctx.lineWidth = 1.6; ctx.stroke();
      glow(ctx, fx, fy, 26, VIO, 0.18);
      if (o.ghost || o.copy) {
        ctx.fillStyle = '#fff';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(fx + s * 7, fy, 2, 0, TAU); ctx.fill(); }
      }
    }
  }
}

export default { unraveller: Unraveller };
