// Bosses of area 'loom' (The Loom Below): THE WEAVER, who made the Strand.
// Also exports small shared helpers (line hazards, backdrops, overlays) used by cradle.js and unwoven.js.
import { Boss, registerMinion } from './boss.js';
import { Entity } from '../entities/base.js';
import { TILE, VIEW_W, VIEW_H } from '../core/constants.js';
import { TAU, clamp } from '../core/math.js';
import { INK, eye } from '../art/creatures.js';

const DT = 1 / 60;

// =================================================================================================
// Shared helpers
// =================================================================================================
export const lerp = (a, b, k) => a + (b - a) * k;
export const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
export const easeOut = (k) => 1 - Math.pow(1 - k, 3);

export function glow(ctx, x, y, r, rgb, a) {
  if (a <= 0 || r <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${Math.min(1, a)})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}

export function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy || 1;
  const k = clamp(((px - x1) * dx + (py - y1) * dy) / L, 0, 1);
  return Math.hypot(px - (x1 + dx * k), py - (y1 + dy * k));
}

// The full line through (x,y) at angle `ang`, clipped to rect A. Returns [x1,y1,x2,y2].
export function clipLine(x, y, ang, A) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  let t0 = -1e5, t1 = 1e5;
  if (Math.abs(dx) > 1e-6) { let a = (A.x - x) / dx, b = (A.x + A.w - x) / dx; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
  if (Math.abs(dy) > 1e-6) { let a = (A.y - y) / dy, b = (A.y + A.h - y) / dy; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
  return [x + dx * t0, y + dy * t0, x + dx * t1, y + dy * t1];
}

// A ray from (x,y) at `ang`, stopped at the edge of rect A.
export function rayEnd(x, y, ang, A) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  let t1 = 1e5;
  if (dx > 1e-6) t1 = Math.min(t1, (A.x + A.w - x) / dx); else if (dx < -1e-6) t1 = Math.min(t1, (A.x - x) / dx);
  if (dy > 1e-6) t1 = Math.min(t1, (A.y + A.h - y) / dy); else if (dy < -1e-6) t1 = Math.min(t1, (A.y - y) / dy);
  t1 = Math.max(0, t1);
  return [x + dx * t1, y + dy * t1];
}

// A line hazard: shows a thin flickering warning, then becomes a thick lethal line, then fades.
// o: {x1,y1,x2,y2, warn, live, fade, width, rgb, core, dmg, style:'thread'|'beam'|'void'|'needle', owner,
//     track(s,dt) to move endpoints, onLive(s), sfx}
export class Strand extends Entity {
  constructor(game, o) {
    super(game, o.x1, o.y1, 1, 1);
    this.o = Object.assign({ warn: 0.6, live: 0.45, fade: 0.25, width: 12, rgb: '255,255,255', core: '#ffffff', dmg: 1, style: 'thread' }, o);
    this.x1 = o.x1; this.y1 = o.y1; this.x2 = o.x2; this.y2 = o.y2;
    this.t = 0; this.z = 4; this.damage = this.o.dmg; this.state = 'warn';
    this.owner = o.owner || null;
    this.seed = Math.random() * 10;
  }
  get cx() { return (this.x1 + this.x2) / 2; }
  get cy() { return (this.y1 + this.y2) / 2; }
  end() { if (this.t < this.o.warn + this.o.live) this.o.live = Math.max(0, this.t - this.o.warn); }
  update(dt) {
    const o = this.o;
    this.t += dt;
    if (this.owner && (this.owner.dead || this.owner.mode === 'dying' || this.owner.mode === 'transform')) { this.dead = true; return; }
    if (o.track) o.track(this, dt);
    const w = o.warn, l = w + o.live;
    const st = this.t < w ? 'warn' : this.t < l ? 'live' : 'fade';
    if (st !== this.state) {
      this.state = st;
      if (st === 'live') {
        if (o.onLive) o.onLive(this);
        if (o.sfx !== false) this.game.sfx(o.sfx || 'whip');
      }
    }
    this.harmful = st === 'live';
    if (this.t > l + o.fade) this.dead = true;
  }
  hitboxes() {
    if (!this.harmful) return [];
    const p = this.game.player, hb = p.hurtbox();
    const d = segDist(p.cx, p.cy, this.x1, this.y1, this.x2, this.y2);
    return d < this.o.width * 0.5 + Math.min(hb.w, hb.h) * 0.45 ? [hb] : [];
  }
  draw(ctx, t) {
    const o = this.o;
    const { x1, y1, x2, y2 } = this;
    ctx.save();
    ctx.lineCap = 'round';
    if (this.state === 'warn') {
      const k = this.t / o.warn;
      const fl = 0.35 + 0.35 * Math.sin(t * 40 + this.seed) * (k > 0.7 ? 1 : 0.4);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${o.rgb},${(0.12 + 0.3 * k) * (0.7 + fl)})`;
      ctx.lineWidth = o.width * (0.4 + 1.1 * k);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = `rgba(${o.rgb},${0.5 + 0.4 * k})`;
      ctx.lineWidth = 1.2;
      ctx.setLineDash(o.style === 'void' ? [3, 9] : [10, 8]);
      ctx.lineDashOffset = -t * 120;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.setLineDash([]);
      // glints at the anchors
      for (const [x, y] of [[x1, y1], [x2, y2]]) glow(ctx, x, y, 10 + 10 * k, o.rgb, 0.5 * k);
    } else {
      const fk = this.state === 'fade' ? 1 - (this.t - o.warn - o.live) / o.fade : 1;
      const born = Math.min(1, (this.t - o.warn) / 0.06);
      const W = o.width * fk * (0.6 + 0.4 * born);
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
      if (o.style === 'void') {
        ctx.strokeStyle = `rgba(${o.rgb},${0.55 * fk})`; ctx.lineWidth = W * 2.4;
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = `rgba(6,2,12,${0.95 * fk})`; ctx.lineWidth = W;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = `rgba(255,240,255,${0.8 * fk})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x1 + nx * W * 0.5, y1 + ny * W * 0.5); ctx.lineTo(x2 + nx * W * 0.5, y2 + ny * W * 0.5); ctx.stroke();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${o.rgb},${0.28 * fk})`; ctx.lineWidth = W * 3;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = `rgba(${o.rgb},${0.7 * fk})`; ctx.lineWidth = W;
        // taut thread vibrates
        const amp = o.style === 'thread' ? 3 * fk : 0;
        ctx.beginPath(); ctx.moveTo(x1, y1);
        const n = 14;
        for (let i = 1; i <= n; i++) {
          const k = i / n, s = Math.sin(k * Math.PI) * Math.sin(t * 70 + k * 9) * amp;
          ctx.lineTo(x1 + (x2 - x1) * k + nx * s, y1 + (y2 - y1) * k + ny * s);
        }
        ctx.stroke();
        ctx.strokeStyle = o.core; ctx.globalAlpha = fk; ctx.lineWidth = Math.max(1.5, W * 0.3);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }
    ctx.restore();
  }
}

// Draws behind the terrain on behalf of a boss: owner.drawBack(ctx, t)
export class Backdrop extends Entity {
  constructor(game, owner) { super(game, owner.x, owner.y, 1, 1); this.owner = owner; this.layer = 'back'; }
  update() { if (this.owner.dead) this.dead = true; }
  draw(ctx, t) { this.owner.drawBack(ctx, t); }
}

// Draws above entities at a given z on behalf of a boss: owner.drawOver(ctx, t)
export class Overlay extends Entity {
  constructor(game, owner, z = 4.5) { super(game, owner.x, owner.y, 1, 1); this.owner = owner; this.z = z; }
  update() { if (this.owner.dead) this.dead = true; }
  draw(ctx, t) { this.owner.drawOver(ctx, t); }
}

// Two-bone IK: returns the elbow point given shoulder, tip, lengths and bend side.
export function ik(sx, sy, tx, ty, L1, L2, bend) {
  const dx = tx - sx, dy = ty - sy;
  const d = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1, L1 + L2 - 1);
  const a = Math.atan2(dy, dx);
  const c = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
  const b = Math.acos(c) * bend;
  return { x: sx + Math.cos(a + b) * L1, y: sy + Math.sin(a + b) * L1, tx: sx + Math.cos(a) * d, ty: sy + Math.sin(a) * d };
}

// =================================================================================================
// THE WEAVER — Who Made the Strand
// A colossal, many-armed weaver hanging from her own thread in front of the first loom. She is
// serene; she is not fighting Bead so much as correcting a flaw in the cloth.
// =================================================================================================
registerMinion({
  id: 'weaver_snarl', name: 'Loose Snarl', hp: 32, dmg: 1, size: [30, 30],
  behavior: 'hopper', params: { interval: 1.05, vx: 230, vy: 660, sight: 600 },
  art: { body: 'yarn', c1: '#efeff4', c2: 'rgba(20,20,28,0.55)', eye: '#16141c' },
  journal: 'A mistake the Weaver pulls out of her cloth and lets fall. It hops after the nearest other mistake.',
});

const W_RGB = '238,240,255';

export class Weaver extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'weaver', size: [150, 150], music: 'boss_weaver', air: true, glints: 400, introTime: 3.0 });
    if (this.dead) return;
    this.noPhysics = true;
    const A = this.arena;
    this.G = this.groundY;
    this.mid = A.x + A.w / 2;
    this.hy = Math.max(A.y + 150, this.G - 285);      // hanging height (body centre)
    this.lowY = this.G - 175;                          // resting / weaving height
    this.topY = A.y + 70;
    this.setC(clamp(this.cx, A.x + 200, A.x + A.w - 200), this.topY);
    this.pose = 'idle';
    this.poseK = 0;       // 0..1 blend to the current pose
    this.eyesOpen = 0;    // 0 closed .. 1 open
    this.crack = 0;
    this.shed = 0;        // phase-3 brokenness of the loom
    this.twang = 0;       // loom string vibration
    this.spin = 0;        // shuttle spin
    this.count = 0;
    this.woven = [];
    this.hairs = [];
    this.lean = 0;
    // eight arms: shoulders around the thorax
    this.arms = [];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        this.arms.push({ s, i, L1: 150 + (i === 1 || i === 2 ? 30 : 0), L2: 170 + (i === 1 || i === 2 ? 40 : 0), tip: null, tgt: null, glow: 0, rate: 9, front: i % 2 === 1 });
      }
    }
    for (const a of this.arms) { const r = this.restTip(a, 0); a.tip = { x: r.x, y: r.y }; }
  }

  setC(x, y) { this.x = x - this.w / 2; this.y = y - this.h / 2; }

  shoulder(a) {
    const sx = this.cx + a.s * (16 + a.i * 4);
    const sy = this.cy - 34 + a.i * 16;
    return { x: sx, y: sy };
  }

  restTip(a, t) {
    const sw = Math.sin(t * 1.3 + a.i * 1.7 + a.s) * 12;
    const ang = [-1.05, -0.45, 0.25, 0.85][a.i];
    const R = [250, 300, 300, 250][a.i];
    if (this.pose === 'shuttle') {
      // arms folded along the body like a shuttle
      const k = [-0.25, -0.1, 0.1, 0.25][a.i];
      return { x: this.cx - this.facing * 70 + a.s * 10, y: this.cy + k * 90 + sw * 0.2 };
    }
    if (this.pose === 'weave') {
      const k = a.i / 3;
      return { x: this.cx + a.s * (90 + 60 * Math.sin(t * 6 + a.i * 1.4 + (a.s > 0 ? 1.6 : 0))), y: this.cy + 50 + k * 60 + Math.cos(t * 6 + a.i) * 18 };
    }
    if (this.pose === 'raise') {
      return { x: this.cx + a.s * (90 + a.i * 70), y: this.cy - 200 + a.i * 30 + sw };
    }
    return { x: this.cx + a.s * Math.cos(ang) * R + a.s * sw * 0.3, y: this.cy + Math.sin(ang) * R + sw };
  }

  // ---------- life ----------
  onRoomReady() {}
  update(dt) {
    super.update(dt);
    if (this.dead) return;
    if (!this.prop) { this.prop = this.game.add(new Backdrop(this.game, this)); }
    this.animate(dt);
    if (this.mode === 'dying') {
      // her thread has snapped: she falls, arms flailing
      this.vy = (this.vy || 0) + 1600 * dt;
      const ny = Math.min(this.y + this.vy * dt, this.G - this.h + 20);
      if (ny >= this.G - this.h + 20 && this.vy > 200) { this.shake(10, 0.4); this.sfx('slam'); this.fx.burst(this.cx, this.G, 30, { color: '#e8e8f0', speed: 380, angle: -Math.PI / 2, spread: 2.8, size: 3, life: 0.8 }); this.vy = -this.vy * 0.2; }
      this.y = ny;
    }
  }

  animate(dt) {
    const t = this.anim;
    this.twang = Math.max(0, this.twang - dt * 1.5);
    this.spin += dt * (this.pose === 'shuttle' ? 30 : 0);
    for (const a of this.arms) {
      const r = a.tgt || this.restTip(a, t);
      const k = Math.min(1, a.rate * dt);
      a.tip.x += (r.x - a.tip.x) * k; a.tip.y += (r.y - a.tip.y) * k;
      a.glow = Math.max(0, a.glow - dt * 2);
    }
    // woven platforms
    for (const w of this.woven) {
      w.t += dt;
      if (w.t > w.life && !w.gone) { w.gone = true; w.solid.active = false; this.fx.burst(w.x + w.w / 2, w.y, 10, { color: '#e8e8f0', speed: 140, size: 2, life: 0.5, g: 300 }); }
    }
    const room = this.game.room;
    this.woven = this.woven.filter((w) => {
      if (w.t > w.life + 0.6) { const i = room.dynamicSolids.indexOf(w.solid); if (i >= 0) room.dynamicSolids.splice(i, 1); return false; }
      return true;
    });
  }

  introUpdate(dt, t) {
    // descends on her thread from the dark above
    const k = ease(Math.min(1, t / 2.4));
    this.setC(this.cx, lerp(this.topY, this.hy, k));
    if (t > 1.6) this.eyesOpen = Math.min(1, (t - 1.6) / 0.6) * 0.25;
    if (t > 2.3 && !this.introRing) {
      this.introRing = true;
      this.twang = 1;
      this.fx.ring(this.cx, this.cy, 20, 380, 0.9, 'rgba(240,240,255,0.8)', 5);
      this.sfx('bell');
    }
  }
  onStart() { this.facePlayer(); }

  // ---------- attack selection ----------
  onPhase(n) { this.pendingPhase = Math.max(this.pendingPhase || 0, n); }
  chooseAttack() {
    if (this.pendingPhase) { const n = this.pendingPhase; this.pendingPhase = 0; return this.phaseShift(n); }
    this.count++;
    if (this.count % (this.phase >= 3 ? 5 : 4) === 0) return this.restWeave();
    return super.chooseAttack();
  }
  attackList() {
    const P = this.phase;
    return [
      { name: 'warp', w: 3, fn: this.warpLines },
      { name: 'needles', w: 3, fn: this.needleVolley },
      { name: 'pierce', w: 2.5, fn: this.armPierce },
      { name: 'shuttle', w: 2, fn: this.shuttleCharge },
      { name: 'tangles', w: this.minions.length < 2 ? 1.2 : 0, fn: this.summonTangles },
      { name: 'floor', w: P >= 2 ? 2.5 : 0, fn: this.weaveFloor },
      { name: 'pattern', w: P >= 3 ? 2.5 : 0, fn: this.thePattern },
    ];
  }

  // coroutine: glide the body centre to (x,y) over T seconds
  *glide(x, y, T) {
    const x0 = this.cx, y0 = this.cy;
    const A = this.arena;
    x = clamp(x, A.x + 120, A.x + A.w - 120);
    const n = Math.max(1, Math.round(T / this.speedMul / DT));
    for (let i = 1; i <= n; i++) {
      const k = ease(i / n);
      this.setC(lerp(x0, x, k), lerp(y0, y, k));
      this.lean = clamp((x - x0) / 400, -1, 1) * Math.sin(k * Math.PI);
      yield;
    }
    this.lean = 0;
  }

  line(o) { return this.game.add(new Strand(this.game, Object.assign({ owner: this, rgb: W_RGB, style: 'thread' }, o))); }
  vLine(x, warn, live = 0.45, width = 14) {
    const A = this.arena;
    return this.line({ x1: x, y1: A.y, x2: x, y2: this.G, warn, live, width, sfx: 'laser' });
  }

  // ---------- attacks ----------
  // Taut warp threads: telegraphed, then they sing like wire.
  *warpLines() {
    const P = this.phase, A = this.arena, p = this.player;
    yield* this.glide(clamp(p.cx + this.rand(-160, 160), A.x + 200, A.x + A.w - 200), this.hy, 0.5);
    this.pose = 'raise'; this.tele = 0.5;
    this.sfx('rustle');
    yield 0.35;
    const waves = P >= 2 ? 2 : 1;
    const warn = P >= 3 ? 0.62 : 0.75;
    for (let w = 0; w < waves; w++) {
      const base = this.player.cx;
      const gap = 230;
      const off = w === 0 ? 0 : gap / 2;
      const xs = [];
      for (let i = -3; i <= 3; i++) {
        const x = base + off + i * gap;
        if (x > A.x + 10 && x < A.x + A.w - 10) xs.push(x);
      }
      for (const x of xs) this.vLine(x, warn);
      this.twang = 1;
      for (const a of this.arms) a.glow = 1;
      yield w === waves - 1 ? warn + 0.2 : warn * 0.55;
    }
    // phase 3: a diagonal cross-hatch follows
    if (P >= 3) {
      const p2 = this.player;
      const B = { x: A.x, y: A.y, w: A.w, h: this.G - A.y };
      for (const ang of [Math.PI / 3, Math.PI * 2 / 3]) {
        const [x1, y1, x2, y2] = clipLine(p2.cx, p2.cy, ang, B);
        this.line({ x1, y1, x2, y2, warn: 0.7, live: 0.4, width: 14, sfx: 'laser' });
      }
      yield 1.1;
    }
    this.pose = 'idle';
    yield P >= 3 ? 0.4 : 0.6;
  }

  // Arms point and flick needle fans.
  *needleVolley() {
    const P = this.phase, A = this.arena, p = this.player;
    const tx = clamp(p.cx + (p.cx < this.mid ? 260 : -260), A.x + 200, A.x + A.w - 200);
    yield* this.glide(tx, this.hy + 30, 0.55);
    const vol = P >= 3 ? 3 : P >= 2 ? 2 : 1;
    for (let v = 0; v < vol; v++) {
      this.facePlayer();
      const use = this.arms.filter((a) => a.i === 1 || a.i === 2 || (P >= 2 && a.i === 0));
      for (const a of use) {
        const sh = this.shoulder(a);
        const ang = Math.atan2(this.player.cy - sh.y, this.player.cx - sh.x);
        a.tgt = { x: sh.x + Math.cos(ang) * 200 + a.s * 30, y: sh.y + Math.sin(ang) * 200 };
        a.glow = 1;
      }
      this.tele = 0.45;
      this.sfx('charge');
      yield 0.45;
      this.sfx('throw');
      for (const a of use) {
        const ang0 = Math.atan2(this.player.cy - a.tip.y, this.player.cx - a.tip.x);
        const n = P >= 2 ? 3 : 3, spread = 0.2;
        for (let i = 0; i < n; i++) {
          const ang = ang0 + (i - (n - 1) / 2) * spread + (a.s * 0.04);
          this.fire(a.tip.x, a.tip.y, Math.cos(ang) * 470, Math.sin(ang) * 470, { art: 'needle', color: '#f6f6ff', r: 7, life: 3, homing: P >= 3 ? 0.6 : 0 });
        }
        this.fx.burst(a.tip.x, a.tip.y, 5, { color: '#fff', speed: 160, size: 2, life: 0.25, glow: true });
        a.tgt = null;
        yield 0.06;
      }
      yield P >= 3 ? 0.3 : 0.45;
    }
    // phase 2+: needles rain from the cloth above
    if (P >= 2) {
      const n = P >= 3 ? 9 : 6;
      const xs = [];
      for (let i = 0; i < n; i++) xs.push(this.player.cx + (i - (n - 1) / 2) * 105 + this.rand(-20, 20));
      for (const x of xs) this.fx.ring(x, A.y + 40, 4, 18, 0.5, 'rgba(240,240,255,0.8)', 2);
      this.sfx('warn');
      yield 0.45;
      for (const x of xs) { if (x > A.x && x < A.x + A.w) this.fire(x, A.y + 40, 0, 520, { art: 'needle', color: '#f6f6ff', r: 7, life: 3, gravity: 500 }); yield 0.04; }
    }
    yield 0.5;
  }

  // Long arms spear down at Bead, one after another.
  *armPierce() {
    const P = this.phase;
    yield* this.glide(this.player.cx + this.rand(-120, 120), this.hy - 20, 0.5);
    const n = 3 + (P >= 2 ? 1 : 0) + (P >= 3 ? 1 : 0);
    const order = [3, 4, 0, 7, 2, 5, 1, 6];
    for (let i = 0; i < n; i++) {
      const a = this.arms[order[i % order.length]];
      const p = this.player;
      const tx = p.cx, ty = Math.min(this.G - 6, p.cy + 30);
      const sh = this.shoulder(a);
      // pull back
      a.tgt = { x: sh.x + a.s * 80, y: sh.y - 140 }; a.glow = 1; a.rate = 12;
      const ang = Math.atan2(ty - sh.y, tx - sh.x);
      const [ex, ey] = rayEnd(sh.x, sh.y, ang, { x: this.arena.x, y: this.arena.y, w: this.arena.w, h: this.G - this.arena.y });
      const warn = P >= 3 ? 0.42 : 0.5;
      this.line({
        x1: sh.x, y1: sh.y, x2: ex, y2: ey, warn, live: 0.2, fade: 0.2, width: 12, style: 'needle', sfx: 'thrust',
        onLive: () => { a.tgt = { x: ex, y: ey }; a.rate = 40; this.shake(4, 0.15); this.fx.burst(ex, ey, 10, { color: '#f0f0f8', speed: 260, angle: ang + Math.PI, spread: 1.6, size: 2.6, life: 0.4 }); },
        track: (s) => { const q = this.shoulder(a); s.x1 = q.x; s.y1 = q.y; },
      });
      yield warn * 0.62;
    }
    yield 0.75;
    for (const a of this.arms) { a.tgt = null; a.rate = 9; }
    yield 0.35;
  }

  // She becomes the shuttle and hurls across the warp.
  *shuttleCharge() {
    const P = this.phase, A = this.arena, p = this.player;
    const side = p.cx < this.mid ? 1 : -1;            // start on the far side from Bead
    const sx = side > 0 ? A.x + A.w - 130 : A.x + 130;
    yield* this.glide(sx, this.hy - 40, 0.6);
    const lanes = P >= 2 ? [this.G - 52, this.G - 215] : [this.G - 52];
    if (P >= 3) lanes.push(this.G - 52);
    let dir = -side;
    for (let li = 0; li < lanes.length; li++) {
      const ly = lanes[li];
      this.facing = dir;
      this.pose = 'shuttle';
      yield* this.glide(this.cx, ly, 0.35);
      // lane telegraph
      const warn = li === 0 ? 0.65 : 0.5;
      this.tele = warn;
      this.sfx('charge');
      this.laneWarn = { y: ly, t: warn, max: warn, dir };
      yield warn;
      this.laneWarn = null;
      this.sfx('dash'); this.shake(4, 0.2);
      this.charging = true;
      yield* this.dashTo(dir, 980 + P * 60);
      this.charging = false;
      this.shake(8, 0.3); this.sfx('slam');
      this.fx.burst(dir > 0 ? A.x + A.w : A.x, ly, 16, { color: '#e8e8f0', speed: 300, angle: dir > 0 ? Math.PI : 0, spread: 1.6, size: 3, life: 0.5 });
      if (P >= 2) for (let i = 0; i < 5; i++) this.fire(this.cx, ly, -dir * this.rand(120, 360), -this.rand(380, 640), { art: 'needle', color: '#f6f6ff', r: 7, gravity: 1100, life: 3 });
      dir = -dir;
      yield 0.25;
    }
    this.pose = 'idle';
    yield* this.glide(this.cx, this.hy, 0.6);
    yield 0.3;
  }

  // Tangles fall from her spinnerets.
  *summonTangles() {
    this.pose = 'weave'; this.tele = 0.5;
    this.sfx('rustle');
    yield 0.5;
    const n = this.phase >= 2 ? 3 : 2;
    for (let i = 0; i < n && this.minions.length < 4; i++) {
      const x = clamp(this.cx + (i - (n - 1) / 2) * 140, this.arena.x + 60, this.arena.x + this.arena.w - 60);
      this.summon('weaver_snarl', Math.floor(x / TILE), Math.floor(this.G / TILE) - 1, { facing: x < this.player.cx ? 1 : -1 });
      this.fx.burst(x, this.G - 15, 8, { color: '#efeff4', speed: 160, size: 2.5, life: 0.4 });
      this.sfx('drop');
      yield 0.25;
    }
    this.pose = 'idle';
    yield 0.8;
  }

  // Phase 2+: weave platforms, then pull the floor-warp taut.
  *weaveFloor() {
    const P = this.phase, A = this.arena, p = this.player;
    yield* this.glide(clamp(p.cx, A.x + 220, A.x + A.w - 220), this.hy - 30, 0.45);
    this.pose = 'weave';
    this.sfx('rustle');
    const pw = 120;
    const xs = [-260, 0, 260].map((d) => clamp(p.cx + d - pw / 2, A.x + 8, A.x + A.w - pw - 8));
    const py = this.G - 128;
    const room = this.game.room;
    for (const x of xs) {
      const solid = { x, y: py, w: pw, h: 10, oneway: true, active: true };
      room.dynamicSolids.push(solid);
      this.woven.push({ x, y: py, w: pw, t: 0, life: 3.4, solid });
      this.fx.burst(x + pw / 2, py, 6, { color: '#fff', speed: 120, size: 2, life: 0.3, glow: true });
      yield 0.12;
    }
    // the floor warp
    const warn = P >= 3 ? 1.0 : 1.15;
    this.line({ x1: A.x, y1: this.G - 9, x2: A.x + A.w, y2: this.G - 9, warn, live: 0.95, width: 18, sfx: 'laser', onLive: () => { this.shake(5, 0.6); this.twang = 1; } });
    this.sfx('warn');
    yield warn * 0.6;
    if (P >= 3) {
      // and a needle spray to keep Bead honest up there
      for (let i = -2; i <= 2; i++) this.fire(this.cx, this.cy + 40, i * 120, 360, { art: 'needle', color: '#f6f6ff', r: 7, life: 3, gravity: 300 });
    }
    yield warn * 0.4 + 1.1;
    this.pose = 'idle';
    yield 0.4;
  }

  // Phase 3: the whole pattern, row after row.
  *thePattern() {
    const A = this.arena;
    yield* this.glide(this.mid, this.hy - 40, 0.6);
    this.pose = 'raise'; this.tele = 0.6;
    this.game.flash('rgba(240,240,255,0.25)', 0.3);
    this.sfx('bell'); this.twang = 1;
    yield 0.5;
    const gap = 200;
    const base = this.player.cx;
    for (let w = 0; w < 4; w++) {
      const off = (w % 2) * gap / 2;
      for (let x = base + off - gap * 6; x < base + gap * 6; x += gap) if (x > A.x + 8 && x < A.x + A.w - 8) this.vLine(x, 0.62, 0.32, 13);
      this.twang = 1;
      yield 0.92;
    }
    this.pose = 'idle';
    yield 0.3;
    yield* this.restWeave(1.8);
  }

  // Exposed: she sinks to mend the cloth.
  *restWeave(T = 1.4) {
    yield* this.glide(clamp(this.player.cx + this.rand(-200, 200), this.arena.x + 220, this.arena.x + this.arena.w - 220), this.lowY, 0.7);
    this.pose = 'weave';
    yield T;
    this.pose = 'idle';
    yield* this.glide(this.cx, this.hy, 0.6);
  }

  // ---------- phases ----------
  *phaseShift(n) {
    this.pose = 'raise';
    this.harmless = true;
    yield* this.glide(this.mid, this.hy - 60, 0.5);
    this.game.hitstop(0.25);
    this.game.flash('rgba(255,255,255,0.85)', 0.7);
    this.shake(12, 1.0);
    this.sfx('bossRoar'); this.sfx('bell');
    this.twang = 1;
    this.fx.ring(this.cx, this.cy, 30, 600, 1.1, 'rgba(255,255,255,0.9)', 7);
    this.fx.burst(this.cx, this.cy, 40, { color: '#f4f4ff', speed: 420, size: 3, life: 1.0, glow: true, g: 0 });
    if (n === 2) {
      this.eyesOpen = 1;
      this.speedMul *= 1.08;
    } else {
      this.eyesOpen = 1; this.crack = 1; this.shed = 1;
      this.speedMul *= 1.12;
      this.fx.burst(this.cx, this.cy, 30, { color: INK, speed: 380, size: 5, life: 1.0, shape: 'shard' });
    }
    yield 1.1;
    this.pose = 'idle';
    this.harmless = false;
    yield 0.3;
  }

  onDeath() {
    this.pose = 'idle'; this.charging = false; this.laneWarn = null; this.vy = -100;
    for (const a of this.arms) { a.tgt = null; a.rate = 4; }
    for (const e of this.game.entities) if (e.owner === this && e !== this.prop) e.dead = true;
    for (const w of this.woven) w.life = Math.min(w.life, w.t);
    this.eyesOpen = 0;
  }

  // ---------- collision ----------
  bodyBox() {
    if (this.pose === 'shuttle') return { x: this.cx - 95, y: this.cy - 30, w: 190, h: 60 };
    return { x: this.cx - 58, y: this.cy - 75, w: 116, h: 135 };
  }
  hitboxes() {
    if (this.harmless) return this.hits;
    return [this.bodyBox(), ...this.hits];
  }

  // ---------- drawing ----------
  drawBack(ctx, t) {
    // The first loom: two great posts, a breast beam, and the warp falling into the dark.
    const A = this.arena, G = this.G;
    const top = A.y + 26, L = A.x + 40, R = A.x + A.w - 40;
    ctx.save();
    ctx.globalAlpha = 0.85;
    // warp threads
    const n = Math.floor((R - L) / 26);
    for (let i = 0; i <= n; i++) {
      const x = L + (i / n) * (R - L);
      const broken = this.shed && (i * 37 % 11) < 3;
      const vib = Math.sin(t * 50 + i) * this.twang * 4;
      ctx.strokeStyle = i % 5 === 0 ? 'rgba(230,230,245,0.22)' : 'rgba(210,210,230,0.11)';
      ctx.lineWidth = i % 5 === 0 ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(x, top + 30);
      if (broken) {
        const by = top + 120 + (i * 53 % 200);
        ctx.quadraticCurveTo(x + vib + Math.sin(t + i) * 8, (top + by) / 2, x + Math.sin(t * 1.4 + i) * 16, by);
      } else ctx.quadraticCurveTo(x + vib, (top + G) / 2, x, G);
      ctx.stroke();
    }
    // the woven cloth band at the top (the Strand's pattern)
    const clothH = 70;
    ctx.fillStyle = 'rgba(12,12,18,0.85)';
    ctx.fillRect(L, top + 30, R - L, clothH);
    ctx.strokeStyle = 'rgba(235,235,250,0.22)'; ctx.lineWidth = 1.2;
    for (let x = L; x < R; x += 22) {
      ctx.beginPath(); ctx.moveTo(x, top + 34); ctx.lineTo(x + 11, top + 30 + clothH / 2); ctx.lineTo(x, top + 26 + clothH); ctx.stroke();
    }
    // moon motif woven into the cloth: a row of beads on a thread
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(L, top + 30 + clothH / 2); ctx.lineTo(R, top + 30 + clothH / 2); ctx.stroke();
    for (let x = L + 40, i = 0; x < R - 20; x += 120, i++) {
      ctx.fillStyle = i % 4 === 0 ? 'rgba(255,250,235,0.5)' : 'rgba(220,220,235,0.25)';
      ctx.beginPath(); ctx.arc(x, top + 30 + clothH / 2, i % 4 === 0 ? 9 : 5, 0, TAU); ctx.fill();
    }
    // posts and beam
    ctx.fillStyle = '#0a0a0e'; ctx.strokeStyle = 'rgba(200,200,220,0.25)'; ctx.lineWidth = 2;
    ctx.fillRect(L - 30, top, R - L + 60, 30); ctx.strokeRect(L - 30, top, R - L + 60, 30);
    for (const x of [L - 30, R - 6]) { ctx.fillRect(x, top, 36, G - top); ctx.strokeRect(x, top, 36, G - top); }
    // carved rings on the posts
    for (const x of [L - 12, R + 12]) for (let y = top + 80; y < G - 20; y += 90) {
      ctx.strokeStyle = 'rgba(220,220,240,0.18)'; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  drawExtra(ctx, t) {
    // woven platforms
    for (const w of this.woven) {
      const k = Math.min(1, w.t / 0.35);
      const fade = w.gone ? Math.max(0, 1 - (w.t - w.life) / 0.6) : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      const x0 = w.x, x1 = w.x + w.w * k;
      ctx.fillStyle = 'rgba(232,232,244,0.9)';
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(x0, w.y, x1 - x0, 9); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(30,30,40,0.6)'; ctx.lineWidth = 1;
      for (let x = x0 + 6; x < x1 - 2; x += 8) { ctx.beginPath(); ctx.moveTo(x, w.y + 1); ctx.lineTo(x + 4, w.y + 8); ctx.stroke(); }
      // anchor threads up to her
      ctx.strokeStyle = 'rgba(240,240,255,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, w.y); ctx.lineTo(this.cx, this.cy + 40); ctx.moveTo(x1, w.y); ctx.lineTo(this.cx, this.cy + 40); ctx.stroke();
      if (w.life - w.t < 0.8 && !w.gone) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 30); ctx.strokeStyle = '#fff'; ctx.strokeRect(x0, w.y, x1 - x0, 9); }
      ctx.restore();
    }
    // shuttle lane telegraph
    if (this.laneWarn) {
      const L = this.laneWarn, A = this.arena;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${W_RGB},${0.08 + 0.1 * Math.sin(t * 30)})`;
      ctx.fillRect(A.x, L.y - 30, A.w, 60);
      ctx.strokeStyle = `rgba(${W_RGB},0.6)`; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -L.dir * t * 300; ctx.lineWidth = 1.5;
      for (const y of [L.y - 30, L.y + 30]) { ctx.beginPath(); ctx.moveTo(A.x, y); ctx.lineTo(A.x + A.w, y); ctx.stroke(); }
      ctx.restore();
    }
    // speed streaks while charging
    if (this.charging) {
      for (let i = 0; i < 3; i++) this.fx.add({ x: this.cx - this.facing * 90, y: this.cy + this.rand(-24, 24), vx: -this.facing * 300, vy: 0, life: 0.25, size: 2, color: 'rgba(240,240,255,0.8)', g: 0, shape: 'streak', front: false });
    }
  }

  drawArm(ctx, a, white, t) {
    const sh = this.shoulder(a);
    const bend = a.s * (a.i < 2 ? -1 : 1) * (this.pose === 'shuttle' ? 0.3 : 1);
    const j = ik(sh.x, sh.y, a.tip.x, a.tip.y, a.L1, a.L2, bend);
    const col = white ? '#fff' : INK;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = col; ctx.lineWidth = a.front ? 7 : 6;
    ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(j.x, j.y); ctx.stroke();
    ctx.lineWidth = a.front ? 5 : 4;
    ctx.beginPath(); ctx.moveTo(j.x, j.y); ctx.lineTo(j.tx, j.ty); ctx.stroke();
    if (!white) {
      ctx.strokeStyle = a.front ? '#3b3946' : '#2a2833'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(sh.x, sh.y - 1); ctx.lineTo(j.x, j.y - 1); ctx.lineTo(j.tx, j.ty - 1); ctx.stroke();
    }
    // joint
    ctx.fillStyle = white ? '#fff' : '#d9d5ca';
    ctx.beginPath(); ctx.arc(j.x, j.y, a.front ? 4.5 : 3.5, 0, TAU); ctx.fill();
    if (!white) { ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke(); }
    // needle tip
    const ang = Math.atan2(j.ty - j.y, j.tx - j.x);
    const nl = 26;
    ctx.fillStyle = white ? '#fff' : '#f2f2f8'; ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(j.tx - Math.cos(ang) * 4 + Math.cos(ang + 1.57) * 3, j.ty - Math.sin(ang) * 4 + Math.sin(ang + 1.57) * 3);
    ctx.lineTo(j.tx + Math.cos(ang) * nl, j.ty + Math.sin(ang) * nl);
    ctx.lineTo(j.tx - Math.cos(ang) * 4 - Math.cos(ang + 1.57) * 3, j.ty - Math.sin(ang) * 4 - Math.sin(ang + 1.57) * 3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (!white && a.glow > 0) glow(ctx, j.tx + Math.cos(ang) * nl, j.ty + Math.sin(ang) * nl, 22, W_RGB, a.glow * 0.8);
  }

  drawBody(ctx, t, white) {
    const cx = this.cx, cy = this.cy;
    const W = (c) => (white ? '#fff' : c);
    const A = this.arena;
    ctx.save();
    // her own thread, up into the dark
    if (this.mode !== 'dying') {
      ctx.strokeStyle = white ? '#fff' : 'rgba(240,240,255,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, A.y - 40); ctx.lineTo(cx + this.lean * 10, cy - 110); ctx.stroke();
    }
    if (!white) glow(ctx, cx, cy, 190, '210,215,255', 0.12 + 0.08 * Math.sin(t * 1.3) + this.eyesOpen * 0.08);

    if (this.pose === 'shuttle' && this.poseDraw !== false) {
      this.drawShuttle(ctx, t, white);
      ctx.restore();
      return;
    }
    // back arms
    for (const a of this.arms) if (!a.front) this.drawArm(ctx, a, white, t);

    // abdomen: a great spinning-sac behind and above
    ctx.save();
    ctx.translate(cx + this.lean * 12, cy - 60);
    ctx.rotate(this.lean * 0.15 + Math.sin(t * 0.8) * 0.04);
    ctx.beginPath(); ctx.ellipse(0, -10, 72, 84, 0, 0, TAU);
    ctx.fillStyle = W('#111017'); ctx.fill();
    ctx.strokeStyle = W(INK); ctx.lineWidth = 3.5; ctx.stroke();
    if (!white) {
      ctx.save();
      ctx.clip();
      // woven herringbone
      ctx.strokeStyle = 'rgba(232,232,246,0.28)'; ctx.lineWidth = 1.4;
      for (let y = -100; y < 80; y += 14) {
        ctx.beginPath();
        for (let x = -80; x <= 80; x += 16) ctx.lineTo(x, y + ((x / 16) % 2 ? 7 : 0));
        ctx.stroke();
      }
      // pale chevron markings
      ctx.fillStyle = 'rgba(240,238,230,0.75)';
      for (let i = 0; i < 4; i++) {
        const y = -60 + i * 26, w = 34 - i * 5;
        ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(0, y + 12); ctx.lineTo(w, y); ctx.lineTo(0, y + 6); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();

    // robe/thorax, draped like cloth with hanging tassels
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy - 40);
    ctx.quadraticCurveTo(cx - 54, cy + 20, cx - 42 + Math.sin(t * 2) * 4, cy + 74);
    ctx.lineTo(cx + 42 + Math.sin(t * 2 + 1) * 4, cy + 74);
    ctx.quadraticCurveTo(cx + 54, cy + 20, cx + 34, cy - 40);
    ctx.closePath();
    ctx.fillStyle = W('#1d1b25'); ctx.fill();
    ctx.strokeStyle = W(INK); ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = W('#e6e4ee'); ctx.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) {
      const x = cx - 38 + i * 9.5;
      const L = 18 + (i * 7 % 13) + Math.sin(t * 3 + i) * 3;
      ctx.beginPath(); ctx.moveTo(x, cy + 74); ctx.quadraticCurveTo(x + Math.sin(t * 2.5 + i) * 5, cy + 74 + L * 0.6, x + Math.sin(t * 2 + i * 1.3) * 7, cy + 74 + L); ctx.stroke();
    }
    if (!white) {
      ctx.strokeStyle = 'rgba(230,230,245,0.25)'; ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(cx - 40 + i * 4, cy - 30 + i * 18); ctx.lineTo(cx + 40 - i * 4, cy - 30 + i * 18); ctx.stroke(); }
    }

    // front arms
    for (const a of this.arms) if (a.front) this.drawArm(ctx, a, white, t);

    // crown of heddle-needles behind the mask
    const mx = cx + this.lean * 6, my = cy - 4;
    ctx.strokeStyle = W('#e8e6f0'); ctx.lineWidth = 2;
    for (let i = -4; i <= 4; i++) {
      const a = -Math.PI / 2 + i * 0.22;
      const L = 58 + (i % 2 ? 0 : 14) + (this.crack ? Math.sin(t * 9 + i) * 3 : 0);
      ctx.beginPath(); ctx.moveTo(mx + Math.cos(a) * 30, my - 6 + Math.sin(a) * 30); ctx.lineTo(mx + Math.cos(a) * L, my - 6 + Math.sin(a) * L); ctx.stroke();
      ctx.fillStyle = W('#ffffff'); ctx.beginPath(); ctx.arc(mx + Math.cos(a) * L, my - 6 + Math.sin(a) * L, 2.5, 0, TAU); ctx.fill();
    }
    this.drawMask(ctx, mx, my, t, white);
    ctx.restore();
  }

  drawMask(ctx, mx, my, t, white) {
    const rw = 30, rh = 42;
    if (!white) glow(ctx, mx, my, 70, '255,255,250', 0.25 + 0.2 * this.eyesOpen);
    ctx.beginPath();
    ctx.moveTo(mx, my - rh);
    ctx.bezierCurveTo(mx + rw * 1.2, my - rh, mx + rw * 1.1, my + rh * 0.5, mx, my + rh);
    ctx.bezierCurveTo(mx - rw * 1.1, my + rh * 0.5, mx - rw * 1.2, my - rh, mx, my - rh);
    ctx.fillStyle = white ? '#fff' : '#f3efe6'; ctx.fill();
    ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 3; ctx.stroke();
    if (white) return;
    // soft shading on one side
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(160,150,170,0.18)'; ctx.fillRect(mx + 6, my - rh, rw, rh * 2);
    ctx.restore();
    // forehead mark: a single bead on a thread
    ctx.strokeStyle = 'rgba(40,36,50,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mx, my - rh + 4); ctx.lineTo(mx, my - 18); ctx.stroke();
    ctx.fillStyle = '#b8323e'; ctx.beginPath(); ctx.arc(mx, my - 22, 3, 0, TAU); ctx.fill();
    // eyes
    const eo = this.eyesOpen;
    for (const s of [-1, 1]) {
      const ex = mx + s * 12, ey = my - 4;
      if (eo < 0.3) {
        ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.arc(ex, ey - 3, 7, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
        // lashes of thread
        ctx.lineWidth = 1;
        for (let k = 0; k < 3; k++) { const a = 0.35 * Math.PI + k * 0.15 * Math.PI; ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * 7, ey - 3 + Math.sin(a) * 7); ctx.lineTo(ex + Math.cos(a) * 11, ey - 3 + Math.sin(a) * 11); ctx.stroke(); }
      } else {
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.ellipse(ex, ey, 7, 9 * eo, s * 0.15, 0, TAU); ctx.fill();
        eye(ctx, ex, ey, 3, '#ffffff', true);
      }
    }
    // mouth: a small closed stitch
    ctx.strokeStyle = 'rgba(30,26,40,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(mx - 6, my + 22); ctx.quadraticCurveTo(mx, my + 25, mx + 6, my + 22); ctx.stroke();
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(mx + i * 4, my + 20); ctx.lineTo(mx + i * 4, my + 26); ctx.stroke(); }
    if (this.crack) {
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(mx + 8, my - rh + 2); ctx.lineTo(mx + 3, my - 20); ctx.lineTo(mx + 10, my - 8); ctx.lineTo(mx + 4, my + 6); ctx.lineTo(mx + 12, my + 20); ctx.stroke();
      // a tear of thread
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(mx + 12, my + 4); ctx.quadraticCurveTo(mx + 16 + Math.sin(t * 3) * 3, my + 30, mx + 12 + Math.sin(t * 2) * 6, my + 60); ctx.stroke();
    }
  }

  drawShuttle(ctx, t, white) {
    // she folds into a great boat-shaped shuttle, the mask at the prow
    const cx = this.cx, cy = this.cy, f = this.facing;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(f, 1);
    ctx.beginPath();
    ctx.moveTo(100, 0);
    ctx.quadraticCurveTo(40, -34, -60, -26);
    ctx.quadraticCurveTo(-110, -14, -120, 0);
    ctx.quadraticCurveTo(-110, 14, -60, 26);
    ctx.quadraticCurveTo(40, 34, 100, 0);
    ctx.fillStyle = white ? '#fff' : '#18161f'; ctx.fill();
    ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 3.5; ctx.stroke();
    if (!white) {
      // bobbin window with spinning thread
      ctx.fillStyle = '#e9e7f0';
      ctx.beginPath(); ctx.ellipse(-20, 0, 34, 11, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(30,30,40,0.7)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) { const x = -50 + ((i * 11 + this.spin * 20) % 60); ctx.beginPath(); ctx.moveTo(x, -9); ctx.lineTo(x + 6, 9); ctx.stroke(); }
      // trailing thread
      ctx.strokeStyle = 'rgba(240,240,255,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-120, 0); ctx.quadraticCurveTo(-180, Math.sin(t * 20) * 10, -260, 0); ctx.stroke();
    }
    // arms folded as oars
    ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      const x = -50 + i * 26, sw = Math.sin(t * 25 + i) * 6;
      ctx.beginPath(); ctx.moveTo(x, -22); ctx.lineTo(x - 30, -44 + sw); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, 22); ctx.lineTo(x - 30, 44 - sw); ctx.stroke();
    }
    ctx.restore();
    // mask at the prow (kept upright)
    this.drawMask(ctx, cx + f * 70, cy - 2, t, white);
  }
}

export default { weaver: Weaver };
