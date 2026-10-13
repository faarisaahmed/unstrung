// Bosses of area 'cradle' (Moon's Cradle): SELENE, the Unstrung Moon, and THE HOLLOW THREAD.
import { Boss } from './boss.js';
import { Entity } from '../entities/base.js';
import { Projectile, registerProjectileArt } from '../entities/projectile.js';
import { TILE, VIEW_W, VIEW_H } from '../core/constants.js';
import { TAU, clamp, overlap } from '../core/math.js';
import { INK, eye } from '../art/creatures.js';
import { Strand, Overlay, glow, lerp, ease, segDist, rayEnd, clipLine } from './loom.js';

const DT = 1 / 60;
const SILVER = '222,230,255';
const VOID = '200,150,255';

// ------------------------------------------------------------------ projectile art
registerProjectileArt('sl_star', (ctx, p, t) => {
  const r = p.r;
  for (let i = 0; i < p.trail.length; i++) {
    const q = p.trail[i], k = i / p.trail.length;
    ctx.fillStyle = `rgba(255,244,210,${0.35 * k})`;
    ctx.beginPath(); ctx.arc(q.x, q.y, r * 0.5 * k, 0, TAU); ctx.fill();
  }
  glow(ctx, p.cx, p.cy, r * 3.2, '255,240,200', 0.55);
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(t * 4 + p.r);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU, rr = i % 2 ? r * 0.38 : r * 1.25;
    i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = '#fff7de'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
});

registerProjectileArt('sl_crescent', (ctx, p, t) => {
  const r = p.r;
  glow(ctx, p.cx, p.cy, r * 2.6, p.friendly ? '255,240,200' : SILVER, 0.5);
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.spin || 0);
  ctx.beginPath();
  ctx.arc(0, 0, r, -1.9, 1.9);
  ctx.arc(-r * 0.45, 0, r * 0.82, 1.45, -1.45, true);
  ctx.closePath();
  ctx.fillStyle = p.friendly ? '#fff1c4' : '#eef2ff'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke();
  ctx.restore();
});

registerProjectileArt('ht_loop', (ctx, p, t) => {
  const r = p.r;
  glow(ctx, p.cx, p.cy, r * 2.5, VOID, 0.35);
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(t * 9);
  ctx.strokeStyle = '#05030a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.7, 0, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.7, r, 0.6, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(230,200,255,0.8)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.7, 0, 0, TAU); ctx.stroke();
  ctx.restore();
});

registerProjectileArt('ht_barb', (ctx, p) => {
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.rot);
  glow(ctx, 0, 0, p.r * 2.4, VOID, 0.3);
  ctx.fillStyle = '#07040c'; ctx.strokeStyle = 'rgba(230,200,255,0.9)'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(p.r * 2, 0); ctx.lineTo(-p.r * 1.2, -p.r * 0.6); ctx.lineTo(-p.r * 0.6, 0); ctx.lineTo(-p.r * 1.2, p.r * 0.6); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
});

// A crescent blade that flies out, slows, and returns. Bonk it to send it back into the moon.
class Crescent extends Projectile {
  constructor(game, x, y, ang, owner, speed = 720) {
    super(game, x, y, Math.cos(ang) * speed, Math.sin(ang) * speed, { art: 'sl_crescent', r: 17, life: 3.4, dmg: 1, pierce: true, ignoreWalls: true, parry: true, color: '#eef2ff' });
    this.ux = Math.cos(ang); this.uy = Math.sin(ang); this.s = speed; this.owner = owner; this.spin = 0;
  }
  update(dt) {
    this.spin += dt * 14;
    if (this.friendly) return super.update(dt);
    if (this.owner && (this.owner.dead || this.owner.mode !== 'fight')) return this.die(true);
    this.age += dt; this.life -= dt;
    if (this.life <= 0) return this.die(false);
    this.s -= 820 * dt;
    this.vx = this.ux * this.s; this.vy = this.uy * this.s;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.trail.push({ x: this.cx, y: this.cy }); if (this.trail.length > 8) this.trail.shift();
  }
  onBonk(dmg, dir, p) {
    if (this.friendly) return false;
    const b = this.owner;
    this.friendly = true; this.harmful = false;
    this.damage = 45;
    this.o.pierce = false; this.o.life = 2; this.life = 2;
    const a = Math.atan2(b.cy - this.cy, b.cx - this.cx);
    this.vx = Math.cos(a) * 980; this.vy = Math.sin(a) * 980;
    this.game.sfx('parry');
    this.game.hitstop(0.08);
    this.game.fx.ring(this.cx, this.cy, 6, 50, 0.3, 'rgba(255,240,200,0.9)', 3);
    return true;
  }
}

// =================================================================================================
// SELENE, THE UNSTRUNG MOON
// The moon herself, hanging low over the Cradle, with hands spun of silver thread. She wants her
// last bead back on the string. That bead is Bead.
// =================================================================================================
export class Selene extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'selene', size: [240, 240], music: 'boss_selene', air: true, glints: 300, introTime: 3.6 });
    if (this.dead) return;
    this.noPhysics = true;
    const A = this.arena;
    this.G = this.groundY;
    this.R = 132;
    this.floorRef = this.G;
    this.hold = false;
    this.lum = 0.35;        // brightness
    this.eyeOpen = 0;
    this.third = 0;         // the forehead eye that casts beams
    this.crack = 0;         // 0, 1, 2
    this.shadow = 0; this.shadowTo = 0;
    this.dim = 0; this.dimTo = 0;
    this.weep = 0;
    this.unravel = 0;
    this.pull = 0;
    this.yank = null;
    this.count = 0;
    this.fans = [];
    this.marks = [];
    this.beads = [];
    this.setC(clamp(this.cx, A.x + 200, A.x + A.w - 200), A.y + this.R * 0.2);
    this.hands = [-1, 1].map((s) => ({ s, x: this.cx + s * 230, y: this.cy + 80, tx: null, ty: null, rate: 5, open: 0.5, rot: Math.PI / 2, harm: false, rest: false, glow: 0, crescent: 0 }));
  }

  setC(x, y) { this.x = x - this.w / 2; this.y = y - this.h / 2; }
  restY() { return clamp(this.floorRef - 290, this.arena.y + this.R * 0.55, this.G - this.R - 150); }

  // ---------- life ----------
  update(dt) {
    if (this.mode === 'transform') { this.updateTransform(dt); return; }
    super.update(dt);
    if (this.dead) return;
    if (!this.over) this.over = this.game.add(new Overlay(this.game, this, 3.6));
    this.animate(dt);
  }

  animate(dt) {
    const p = this.player, A = this.arena, R = this.R;
    if (p.b.grounded) this.floorRef = p.b.y + p.b.h;
    if ((this.mode === 'fight') && !this.hold) {
      const tx = clamp(p.cx, A.x + R + 30, A.x + A.w - R - 30);
      const k = 1 - Math.exp(-dt * 1.1);
      this.setC(lerp(this.cx, tx, k), lerp(this.cy, this.restY(), k));
    }
    this.shadow += (this.shadowTo - this.shadow) * Math.min(1, dt * 2);
    this.dim += (this.dimTo - this.dim) * Math.min(1, dt * 2.5);
    this.weep = Math.max(0, this.weep - dt * 0.3);
    const t = this.anim;
    for (const h of this.hands) {
      const tx = h.tx ?? this.cx + h.s * (R + 105 + Math.sin(t * 0.9 + h.s) * 14);
      const ty = h.ty ?? this.cy + 70 + Math.sin(t * 1.3 + h.s * 2) * 16;
      if (h.rate > 0) { const k = Math.min(1, h.rate * dt); h.x += (tx - h.x) * k; h.y += (ty - h.y) * k; }
      h.glow = Math.max(0, h.glow - dt * 1.5);
      if (h.tx === null && !h.harm) h.rot += (Math.PI / 2 + h.s * 0.35 - h.rot) * Math.min(1, dt * 4);
    }
    for (const b of this.beads) { b.a += dt * b.w; }
    for (const f of this.fans) f.t -= dt;
    this.fans = this.fans.filter((f) => f.t > 0);
    for (const m of this.marks) m.t -= dt;
    this.marks = this.marks.filter((m) => m.t > -0.2);
  }

  think(dt) {
    const p = this.player, b = p.b;
    // gravity pulse: the moon lifts and draws Bead in
    if (this.pull > 0) {
      this.pull -= dt;
      if (!p.dead && b.mode !== 'hook') {
        const dx = this.cx - p.cx;
        b.vx = clamp(b.vx + Math.sign(dx) * 1150 * dt, -420, 420);
        if (b.vy > -260) b.vy -= 1750 * dt;
        if (Math.random() < 0.4) this.fx.add({ x: p.cx + this.rand(-30, 30), y: p.cy + 20, vx: 0, vy: -120, life: 0.4, size: 1.6, color: 'rgba(220,230,255,0.9)', g: 0, glow: true, front: true });
      }
    }
    // a silver thread caught Bead: reel it in
    if (this.yank) {
      this.yank.t -= dt;
      const h = this.yank.hand;
      if (!p.dead && b.mode !== 'hook') {
        const a = Math.atan2(h.y - p.cy, h.x - p.cx);
        b.vx = Math.cos(a) * 560; b.vy = Math.sin(a) * 560;
        if (b.mode === 'dash' || b.mode === 'comet') b.mode = 'normal';
      }
      if (this.yank.t <= 0) this.yank = null;
    }
  }

  introUpdate(dt, t) {
    const k = ease(Math.min(1, t / 2.8));
    this.setC(lerp(this.cx, clamp(this.player.cx, this.arena.x + 200, this.arena.x + this.arena.w - 200), dt * 1.2), lerp(this.arena.y + this.R * 0.2, this.restY(), k));
    this.lum = 0.35 + 0.65 * k;
    if (t > 2.0) this.eyeOpen = Math.min(1, (t - 2.0) / 0.8) * 0.6;
    if (t > 2.6 && !this.introRing) {
      this.introRing = true;
      this.fx.ring(this.cx, this.cy, this.R, this.R + 420, 1.2, 'rgba(225,232,255,0.8)', 6);
      this.game.flash('rgba(225,232,255,0.4)', 0.5);
      this.sfx('bell');
    }
  }
  idle() { this.lum = 0.35; }

  // ---------- selection ----------
  onPhase(n) { this.pendingPhase = Math.max(this.pendingPhase || 0, n); }
  chooseAttack() {
    this.hold = false;
    if (this.pendingPhase) { const n = this.pendingPhase; this.pendingPhase = 0; return this.phaseShift(n); }
    this.count++;
    if (this.count % 4 === 0) return this.descend();
    return super.chooseAttack();
  }
  attackList() {
    const P = this.phase;
    return [
      { name: 'beam', w: 3, fn: this.moonbeam },
      { name: 'stars', w: 2.5, fn: this.starfall },
      { name: 'crescents', w: P >= 2 ? 2.5 : 1.5, fn: this.crescents },
      { name: 'pulse', w: 1.8, fn: this.gravityPulse },
      { name: 'thread', w: 2.5, fn: this.threadLines },
      { name: 'slam', w: 2.5, fn: this.handSlam },
      { name: 'clap', w: P >= 2 ? 2 : 1.2, fn: this.clap },
      { name: 'eclipse', w: P >= 3 ? 2.2 : 0, fn: this.eclipse },
    ];
  }

  *glide(x, y, T) {
    this.hold = true;
    const x0 = this.cx, y0 = this.cy, A = this.arena;
    x = clamp(x, A.x + this.R + 20, A.x + A.w - this.R - 20);
    const n = Math.max(1, Math.round(T / this.speedMul / DT));
    for (let i = 1; i <= n; i++) { const k = ease(i / n); this.setC(lerp(x0, x, k), lerp(y0, y, k)); yield; }
  }
  *frames(T, fn) {
    const n = Math.max(1, Math.round(T / this.speedMul / DT));
    for (let i = 1; i <= n; i++) { if (fn) fn(i / n); yield; }
  }
  line(o) { return this.game.add(new Strand(this.game, Object.assign({ owner: this, rgb: SILVER, style: 'beam' }, o))); }
  floorBox() { const A = this.arena; return { x: A.x, y: A.y, w: A.w, h: this.G - A.y }; }

  // ---------- attacks ----------
  // A beam of moonlight from her brow, sweeping across the floor. The fan shows where it will go.
  *moonbeam() {
    const P = this.phase, p = this.player;
    this.hold = true;
    const twin = P >= 2 && (P >= 3 ? Math.random() < 0.6 : Math.random() < 0.5);
    const beams = [];
    const ox = this.cx, oy = this.cy - this.R * 0.35;
    const angAt = (gx, o) => Math.atan2(this.G - o.y, gx - o.x);
    if (!twin) {
      const dir = p.cx < this.cx ? -1 : 1;
      const o = { x: ox, y: oy };
      beams.push({ o, a0: angAt(this.cx - dir * 50, o), a1: angAt(p.cx + dir * 240, o) });
    } else {
      for (const s of [-1, 1]) {
        const o = { x: this.cx + s * this.R * 0.36, y: this.cy - 8 };
        beams.push({ o, a0: angAt(this.cx + s * 480, o), a1: angAt(this.cx + s * 75, o) });
      }
    }
    this.third = 1; this.eyeOpen = 1;
    const warn = P >= 3 ? 0.75 : 0.9;
    for (const b of beams) this.fans.push({ x: b.o.x, y: b.o.y, a0: b.a0, a1: b.a1, t: warn, max: warn });
    this.tele = warn; this.sfx('charge');
    yield warn;
    const sweep = 1.25;
    for (const b of beams) {
      this.line({
        x1: b.o.x, y1: b.o.y, x2: b.o.x, y2: this.G, warn: 0.08, live: sweep, fade: 0.3, width: 34, sfx: 'laser',
        track: (s) => {
          const k = clamp((s.t - 0.08) / sweep, 0, 1);
          const a = lerp(b.a0, b.a1, ease(k));
          const [ex, ey] = rayEnd(b.o.x, b.o.y, a, this.floorBox());
          s.x1 = b.o.x; s.y1 = b.o.y; s.x2 = ex; s.y2 = ey;
          if (s.state === 'live' && Math.random() < 0.6) this.fx.burst(ex, ey - 4, 1, { color: '#f0f4ff', speed: 180, angle: -Math.PI / 2, spread: 2, size: 2.2, life: 0.4, glow: true });
        },
      });
    }
    this.shake(4, sweep);
    yield sweep + 0.25;
    // phase 3: the single beam comes back the other way
    if (P >= 3 && !twin) {
      const b = beams[0];
      this.fans.push({ x: b.o.x, y: b.o.y, a0: b.a1, a1: b.a0, t: 0.55, max: 0.55 });
      yield 0.55;
      this.line({
        x1: b.o.x, y1: b.o.y, x2: b.o.x, y2: this.G, warn: 0.06, live: 1.0, fade: 0.3, width: 34, sfx: 'laser',
        track: (s) => { const k = clamp((s.t - 0.06) / 1.0, 0, 1); const a = lerp(b.a1, b.a0, ease(k)); const [ex, ey] = rayEnd(b.o.x, b.o.y, a, this.floorBox()); s.x2 = ex; s.y2 = ey; },
      });
      yield 1.3;
    }
    this.third = 0; this.eyeOpen = 0.6;
    yield 0.45;
  }

  // Stars fall from the dark above, each foretold by a glint.
  *starfall(waves) {
    const P = this.phase, A = this.arena;
    waves = waves || (P >= 3 ? 3 : P >= 2 ? 2 : 1);
    this.eyeOpen = 1; this.tele = 0.5;
    this.sfx('bell');
    yield 0.3;
    for (let w = 0; w < waves; w++) {
      const p = this.player;
      const n = 6 + P;
      const xs = [p.cx];
      let tries = 0;
      while (xs.length < n && tries++ < 80) {
        const x = p.cx + this.rand(-470, 470);
        if (x < A.x + 16 || x > A.x + A.w - 16) continue;
        if (xs.every((q) => Math.abs(q - x) > 82)) xs.push(x);
      }
      const topY = Math.max(A.y + 10, this.game.camera.viewY - 30);
      for (const x of xs) this.marks.push({ x, y: topY + 40, t: 0.7, max: 0.7, kind: 'star' });
      this.sfx('warn');
      yield 0.7;
      for (const x of xs) {
        this.fire(x, topY, this.rand(-20, 20), 760, {
          art: 'sl_star', r: 11, life: 3, color: '#fff4c8',
          onDie: P >= 2 ? (q) => {
            if (q.cy < this.G - 40 || this.mode !== 'fight') return;
            for (const s of [-1, 1]) this.fire(q.cx, this.G - 9, s * 250, 0, { art: 'orb', r: 6, life: 0.9, color: '#fff1c0' });
          } : null,
        });
      }
      yield P >= 3 ? 0.4 : 0.55;
    }
    this.eyeOpen = 0.6;
    yield 0.5;
  }

  // Her hands shape crescents and hurl them. They come back. Bonk one to return it to her.
  *crescents() {
    const P = this.phase;
    const n = P >= 3 ? 3 : P >= 2 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const h = this.hands[(i + (this.player.cx > this.cx ? 1 : 0)) % 2];
      h.tx = this.cx + h.s * (this.R + 70); h.ty = this.cy + 40; h.rate = 8;
      h.crescent = 1; h.glow = 1; h.open = 1;
      this.tele = 0.5; this.sfx('charge');
      yield P >= 3 ? 0.42 : 0.5;
      const p = this.player;
      const a = Math.atan2(p.cy - h.y, p.cx - h.x);
      this.game.add(new Crescent(this.game, h.x, h.y, a, this, 760 * Math.sqrt(this.speedMul)));
      this.sfx('throw');
      h.crescent = 0; h.tx = null; h.ty = null; h.rate = 5; h.open = 0.5;
      yield 0.45;
    }
    yield 1.2;
  }

  // She breathes in: everything floats toward her. Then she breathes out stars.
  *gravityPulse() {
    const P = this.phase;
    this.hold = true;
    this.eyeOpen = 1;
    for (let i = 0; i < 3; i++) this.fx.ring(this.cx, this.cy, 420 - i * 60, this.R, 0.6, 'rgba(225,232,255,0.5)', 3);
    this.tele = 0.6; this.sfx('phase');
    yield 0.6;
    this.pull = 1.5;
    this.pulling = true;
    yield 1.5;
    this.pulling = false;
    this.tele = 0.45;
    this.fx.ring(this.cx, this.cy, this.R + 40, this.R, 0.45, 'rgba(255,245,220,0.9)', 5);
    this.sfx('warn');
    yield 0.45;
    const n = 12 + P * 2;
    const a0 = Math.random() * TAU;
    this.fireRing(this.cx, this.cy, n, 250, { art: 'sl_star', r: 9, color: '#fff4c8', ignoreWalls: true, life: 4, a0 });
    this.shake(6, 0.4); this.sfx('burst');
    if (P >= 3) { yield 0.4; this.fireRing(this.cx, this.cy, n, 250, { art: 'sl_star', r: 9, color: '#fff4c8', ignoreWalls: true, life: 4, a0: a0 + Math.PI / n }); }
    this.eyeOpen = 0.6;
    yield 0.9;
  }

  // Silver threads aimed at Bead. If one catches, she reels her bead in.
  *threadLines() {
    const P = this.phase;
    const n = P;
    for (let i = 0; i < n; i++) {
      const h = this.hands[i % 2];
      h.tx = this.cx + h.s * (this.R + 150); h.ty = this.cy - 30 + i * 30; h.rate = 6; h.glow = 1; h.open = 0;
      const warn = 0.85;
      let aim = 0;
      this.line({
        x1: h.x, y1: h.y, x2: h.x, y2: h.y, warn, live: 0.32, fade: 0.25, width: 9, style: 'thread', sfx: 'whip',
        track: (s) => {
          const p = this.player;
          if (s.t < warn * 0.68) aim = Math.atan2(p.cy - h.y, p.cx - h.x);
          h.rot = aim;
          const [ex, ey] = rayEnd(h.x, h.y, aim, this.floorBox());
          s.x1 = h.x; s.y1 = h.y; s.x2 = ex; s.y2 = ey;
          if (s.state === 'live' && !s.caught && p.invuln <= 0 && segDist(p.cx, p.cy, s.x1, s.y1, s.x2, s.y2) < 18) {
            s.caught = true; this.yank = { t: 0.4, hand: h };
          }
        },
      });
      this.sfx('rustle');
      yield 0.32;
    }
    yield 1.1;
    for (const h of this.hands) { h.tx = null; h.ty = null; h.rate = 5; h.open = 0.5; }
    yield 0.3;
  }

  // A hand of thread rises over Bead and comes down like a falling sky.
  *handSlam() {
    const P = this.phase;
    const n = P >= 3 ? 3 : P >= 2 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const h = this.hands[(i + (this.player.cx > this.cx ? 1 : 0)) % 2];
      h.open = 1; h.glow = 1; h.rate = 7;
      const hy = this.G - 250;
      const warn = P >= 3 ? 0.5 : 0.62;
      this.sfx('rustle');
      yield* this.frames(warn, (k) => {
        if (k < 0.7) h.tx = clamp(this.player.cx, this.arena.x + 60, this.arena.x + this.arena.w - 60);
        h.ty = hy; h.rot = Math.PI / 2;
        h.slamWarn = k;
      });
      h.slamWarn = 0;
      h.rate = 0; h.harm = true;
      const y0 = h.y, x = h.tx;
      yield* this.frames(0.12, (k) => { h.x = x; h.y = lerp(y0, this.G - 34, k * k); });
      this.shake(9, 0.35); this.sfx('slam');
      this.zone(x - 90, this.G - 46, 180, 46, 0.12);
      this.fx.burst(x, this.G, 18, { color: '#e8eeff', speed: 340, angle: -Math.PI / 2, spread: 2.6, size: 3, life: 0.6, glow: true });
      this.fx.ring(x, this.G - 10, 10, 120, 0.4, 'rgba(225,232,255,0.8)', 4);
      if (P >= 2) { this.shockwave(x, -1, 430, 30, { color: 'rgba(225,232,255,0.9)' }); this.shockwave(x, 1, 430, 30, { color: 'rgba(225,232,255,0.9)' }); }
      h.harm = false; h.rest = true;
      yield P >= 3 ? 0.55 : 0.9;
      h.rest = false; h.tx = null; h.ty = null; h.rate = 5; h.open = 0.5;
      yield 0.15;
    }
    yield 0.5;
  }

  // Both hands sweep in along the floor and meet; in phase 3 they sweep back out higher.
  *clap() {
    const P = this.phase, A = this.arena, p = this.player;
    const mx = clamp(p.cx, A.x + 120, A.x + A.w - 120);
    const L = [this.hands[0], this.hands[1]];
    const ly = this.G - 36;
    for (const h of L) { h.tx = clamp(mx + h.s * 540, A.x + 40, A.x + A.w - 40); h.ty = ly; h.rate = 6; h.open = 1; h.rot = h.s > 0 ? Math.PI : 0; }
    yield 0.55;
    for (const h of L) h.glow = 1;
    this.clapWarn = { y: ly, x0: L[0].tx, x1: L[1].tx, t: 0.55 };
    this.tele = 0.55; this.sfx('charge');
    yield 0.55;
    this.clapWarn = null;
    for (const h of L) { h.rate = 0; h.harm = true; }
    this.sfx('whip');
    const sp = 820 * this.speedMul;
    for (;;) {
      let done = true;
      for (const h of L) {
        const goal = mx - h.s * 40;
        const d = goal - h.x;
        if (Math.abs(d) > sp * DT) { h.x += Math.sign(d) * sp * DT; done = false; } else h.x = goal;
        h.y = ly;
      }
      if (done) break;
      yield;
    }
    this.shake(8, 0.3); this.sfx('slam');
    this.fx.burst(mx, ly, 20, { color: '#eef2ff', speed: 300, size: 3, life: 0.5, glow: true });
    this.fx.ring(mx, ly, 10, 90, 0.35, 'rgba(225,232,255,0.9)', 4);
    for (const h of L) h.harm = false;
    yield 0.35;
    if (P >= 3) {
      const hy = this.G - 152;
      for (const h of L) { h.ty = hy; h.rate = 10; }
      yield 0.2;
      this.clapWarn = { y: hy, x0: mx - 560, x1: mx + 560, t: 0.45 };
      for (const h of L) h.glow = 1;
      yield 0.45;
      this.clapWarn = null;
      for (const h of L) { h.rate = 0; h.harm = true; }
      this.sfx('whip');
      yield* this.frames(0.7, () => { for (const h of L) { h.x += h.s * sp * DT; h.y = hy; } });
      for (const h of L) h.harm = false;
    }
    for (const h of L) { h.tx = null; h.ty = null; h.rate = 4; h.open = 0.5; }
    yield 0.7;
  }

  // Phase 3: she covers her own face with shadow. Only the falling stars give light.
  *eclipse() {
    const A = this.arena;
    yield* this.glide(clamp(this.player.cx, A.x + 300, A.x + A.w - 300), this.restY() - 40, 0.6);
    this.shadowTo = 1; this.dimTo = 0.78;
    this.sfx('bossRoar'); this.shake(6, 1.0);
    yield 0.9;
    for (let w = 0; w < 2; w++) {
      yield* this.starfall(1);
      if (w === 0) {
        const h = this.hands[this.player.cx < this.cx ? 0 : 1];
        h.crescent = 1; h.glow = 1; yield 0.45;
        const p = this.player;
        this.game.add(new Crescent(this.game, h.x, h.y, Math.atan2(p.cy - h.y, p.cx - h.x), this, 760));
        this.sfx('throw'); h.crescent = 0;
      }
    }
    yield 0.6;
    this.shadowTo = 0.45; this.dimTo = 0;
    yield* this.descend(1.9);
  }

  // Tired, she sinks low enough to touch.
  *descend(T) {
    const A = this.arena;
    T = T || (this.phase >= 3 ? 1.4 : 1.8);
    yield* this.glide(clamp(this.player.cx + this.rand(-150, 150), A.x + 200, A.x + A.w - 200), this.G - this.R * 0.62 - 20, 0.9);
    this.weep = 1; this.eyeOpen = 0;
    for (const h of this.hands) { h.ty = this.G - 30; h.tx = this.cx + h.s * (this.R + 60); h.rate = 3; h.rest = true; }
    this.sfx('bell');
    yield T;
    for (const h of this.hands) { h.tx = null; h.ty = null; h.rest = false; h.rate = 5; }
    this.eyeOpen = 0.6;
    yield* this.glide(this.cx, this.restY(), 0.7);
    this.hold = false;
  }

  *phaseShift(n) {
    const A = this.arena;
    yield* this.glide(clamp(this.player.cx, A.x + 300, A.x + A.w - 300), this.restY() - 30, 0.5);
    this.harmless = true;
    for (const h of this.hands) { h.harm = false; h.rest = false; h.tx = null; h.ty = null; }
    this.game.hitstop(0.3);
    this.game.flash('rgba(230,236,255,0.9)', 0.9);
    this.shake(14, 1.2);
    this.sfx('bossRoar'); this.sfx('bell');
    this.fx.ring(this.cx, this.cy, this.R, this.R + 600, 1.2, 'rgba(230,236,255,0.9)', 8);
    this.fx.burst(this.cx, this.cy, 50, { color: '#f2f5ff', speed: 460, size: 3.2, life: 1.2, glow: true, g: 0 });
    if (n === 2) {
      this.crack = 1;
      for (let i = 0; i < 6; i++) this.beads.push({ a: (i / 6) * TAU, w: 0.6, r: this.R + 46, s: 7 + (i % 2) * 3 });
      this.speedMul *= 1.06;
    } else {
      this.crack = 2; this.unravel = 1; this.shadowTo = 0.45;
      if (!this.beads.length) for (let i = 0; i < 6; i++) this.beads.push({ a: (i / 6) * TAU, w: 0.6, r: this.R + 46, s: 7 });
      for (const b of this.beads) { b.w = 1.6; b.r += 40; }
      this.fx.burst(this.cx, this.cy - 20, 30, { color: INK, speed: 380, size: 5, life: 1.0, shape: 'shard' });
      this.speedMul *= 1.1;
    }
    yield 1.4;
    this.harmless = false;
    yield 0.2;
  }

  // ---------- death / transformation ----------
  beginDeath() {
    const g = this.game;
    if (!this.echo && g.save.items && g.save.items.voidThread) {
      this.mode = 'transform';
      this.tfT = 0;
      this.hittable = false; this.harmful = false; this.co = null;
      this.pull = 0; this.yank = null; this.pulling = false; this.dimTo = 0.5;
      this.fans = []; this.marks = []; this.clapWarn = null;
      for (const h of this.hands) { h.harm = false; h.rest = false; h.tx = null; h.ty = null; h.rate = 2; }
      for (const m of this.minions) if (!m.dead) m.die(0);
      for (const e of g.entities) if (e instanceof Projectile && !e.friendly) e.dead = true;
      g.hitstop(0.5);
      g.flash('rgba(255,255,255,0.95)', 1.0);
      g.camera.shake(12, 3.2);
      g.sfx('bossDie');
      g.cutscene = { kind: 'bossIntro' };
      g.player.locked = true;
      g.app.audio && g.app.audio.stopMusic(0.4);
      return;
    }
    super.beginDeath();
  }

  updateTransform(dt) {
    const g = this.game;
    this.anim += dt; this.tfT += dt; this.flashT -= dt;
    this.animate(dt);
    const T = this.tfT;
    this.crack = 2;
    this.shadowTo = Math.min(1, T / 2.4);
    // black thread pours from the crack
    if (T > 0.6 && Math.random() < 0.8) {
      this.fx.add({ x: this.cx + this.rand(-14, 14), y: this.cy - this.R * 0.2 + this.rand(-40, 40), vx: this.rand(-200, 200), vy: this.rand(-200, 120), life: 0.9, size: 3 + Math.random() * 3, color: '#05030a', g: 0, drag: 1, shape: 'shard', front: true });
    }
    if (T > 1.2 && !this.tf1) { this.tf1 = true; this.sfx('screech'); g.flash('rgba(0,0,0,0.6)', 0.5); g.camera.shake(8, 1); }
    if (T > 2.6 && !this.tf2) {
      this.tf2 = true;
      g.flash('rgba(255,255,255,1)', 1.2);
      g.hitstop(0.35);
      this.sfx('explode'); this.sfx('crystalBreak');
      g.fx.burst(this.cx, this.cy, 60, { color: '#eef2ff', speed: 520, size: 7, life: 1.6, shape: 'shard', g: 500 });
      g.fx.burst(this.cx, this.cy, 40, { color: '#05030a', speed: 420, size: 6, life: 1.4, shape: 'shard', front: true, g: 0 });
      g.fx.ring(this.cx, this.cy, 20, 700, 1.3, 'rgba(255,255,255,0.9)', 10);
    }
    if (T > 2.75) {
      // the moon is gone; what was inside her is not
      const A = this.arena;
      delete g.save.flags.boss_hollowthread;
      const tx = Math.floor((A.x + A.w / 2) / TILE);
      const ty = Math.floor(clamp(this.cy, A.y + 120, this.G - 160) / TILE);
      const h = new HollowThread(g, tx, ty, { fromSelene: true });
      if (!h.dead) { g.add(h); h.startFight(); }
      g.cutscene = null;
      this.dead = true;
    }
  }

  onDeath() {
    this.pull = 0; this.yank = null; this.fans = []; this.marks = []; this.clapWarn = null; this.dimTo = 0;
    this.eyeOpen = 0; this.weep = 1;
    for (const h of this.hands) { h.harm = false; h.rest = false; h.tx = this.cx + h.s * 120; h.ty = this.cy + 160; h.rate = 1; }
  }
  onFinish() {
    this.game.app.ending && this.game.app.ending('A');
  }

  // ---------- collision ----------
  moonBox() { const r = this.R * 0.78; return { x: this.cx - r, y: this.cy - r, w: r * 2, h: r * 2 }; }
  handBox(h) { return { x: h.x - 40, y: h.y - 34, w: 80, h: 68 }; }
  hurtboxes() {
    if (this.mode !== 'fight') return [];
    const L = [this.moonBox()];
    for (const h of this.hands) if (h.rest) L.push(this.handBox(h));
    return L;
  }
  hurtbox() { return this.moonBox(); }
  hitboxes() {
    if (this.harmless) return this.hits;
    const L = [...this.hits];
    for (const h of this.hands) if (h.harm) L.push(this.handBox(h));
    return L;
  }

  // ---------- drawing ----------
  drawOver(ctx, t) {
    if (this.dim > 0.01) {
      const cam = this.game.camera, vx = cam.viewX, vy = cam.viewY, p = this.player;
      if (!this.darkC) { this.darkC = document.createElement('canvas'); this.darkC.width = VIEW_W; this.darkC.height = VIEW_H; }
      const d = this.darkC.getContext('2d');
      d.globalCompositeOperation = 'source-over';
      d.clearRect(0, 0, VIEW_W, VIEW_H);
      d.fillStyle = `rgba(3,4,12,${this.dim})`; d.fillRect(0, 0, VIEW_W, VIEW_H);
      d.globalCompositeOperation = 'destination-out';
      const holes = [{ x: p.cx - vx, y: p.cy - vy, r: 190 }];
      for (const m of this.marks) holes.push({ x: m.x - vx, y: this.G - vy, r: 60 });
      for (const hl of holes) {
        const g = d.createRadialGradient(hl.x, hl.y, 0, hl.x, hl.y, hl.r);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = g; d.beginPath(); d.arc(hl.x, hl.y, hl.r, 0, TAU); d.fill();
      }
      ctx.drawImage(this.darkC, vx, vy);
      // the eclipsed moon's corona stays visible
      glow(ctx, this.cx, this.cy, this.R * 1.5, '230,236,255', 0.25 * this.dim);
      ctx.strokeStyle = `rgba(240,244,255,${0.7 * this.dim})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.cx, this.cy, this.R + 2, 0, TAU); ctx.stroke();
    }
    // star warnings are drawn above the dark
    for (const m of this.marks) {
      const k = 1 - Math.max(0, m.t) / m.max;
      glow(ctx, m.x, m.y, 16 + 14 * k, '255,240,200', 0.4 + 0.4 * k);
      ctx.strokeStyle = `rgba(255,240,200,${0.1 + 0.25 * k})`; ctx.lineWidth = 2 + 6 * k;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x, this.G); ctx.stroke();
      ctx.fillStyle = `rgba(255,240,200,${0.3 + 0.5 * k})`;
      ctx.beginPath(); ctx.ellipse(m.x, this.G - 2, 10 + 16 * k, 3, 0, 0, TAU); ctx.fill();
    }
  }

  drawExtra(ctx, t) {
    // beam fans
    for (const f of this.fans) {
      const k = 1 - f.t / f.max;
      const B = this.floorBox();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${SILVER},${0.05 + 0.1 * k})`;
      ctx.beginPath(); ctx.moveTo(f.x, f.y);
      const steps = 16;
      for (let i = 0; i <= steps; i++) { const a = lerp(f.a0, f.a1, i / steps); const [ex, ey] = rayEnd(f.x, f.y, a, B); ctx.lineTo(ex, ey); }
      ctx.closePath(); ctx.fill();
      const [sx, sy] = rayEnd(f.x, f.y, f.a0, B), [ex, ey] = rayEnd(f.x, f.y, f.a1, B);
      ctx.strokeStyle = `rgba(${SILVER},${0.5 + 0.4 * Math.sin(t * 30)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(sx, sy); ctx.stroke();
      ctx.setLineDash([8, 8]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.setLineDash([]);
      // arrow along the floor showing the sweep direction
      const dir = Math.sign(ex - sx) || 1;
      ctx.strokeStyle = `rgba(${SILVER},0.6)`; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const x = lerp(sx, ex, ((t * 1.5 + i / 3) % 1));
        ctx.beginPath(); ctx.moveTo(x - dir * 8, this.G - 14); ctx.lineTo(x, this.G - 8); ctx.lineTo(x - dir * 8, this.G - 2); ctx.stroke();
      }
      ctx.restore();
    }
    // clap lane
    if (this.clapWarn) {
      const c = this.clapWarn;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${SILVER},${0.07 + 0.07 * Math.sin(t * 30)})`;
      ctx.fillRect(c.x0, c.y - 36, c.x1 - c.x0, 72);
      ctx.restore();
    }
    // slam shadows
    for (const h of this.hands) if (h.slamWarn) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${SILVER},${0.12 + 0.25 * h.slamWarn})`;
      ctx.beginPath(); ctx.ellipse(h.x, this.G - 3, 40 + 50 * h.slamWarn, 6, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${SILVER},0.25)`; ctx.lineWidth = 80;
      ctx.globalAlpha = 0.3 * h.slamWarn;
      ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x, this.G); ctx.stroke();
      ctx.restore();
    }
    // gravity pulse: orbiting dust
    if (this.pulling) {
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * TAU, r = this.R + 300;
        this.fx.add({ x: this.cx + Math.cos(a) * r, y: this.cy + Math.sin(a) * r, vx: -Math.cos(a) * 420, vy: -Math.sin(a) * 420, life: 0.6, size: 2, color: 'rgba(225,232,255,0.8)', g: 0, shape: 'streak', front: false });
      }
    }
    // yank thread
    if (this.yank) {
      const p = this.player, h = this.yank.hand;
      ctx.strokeStyle = 'rgba(235,240,255,0.95)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(p.cx, p.cy); ctx.stroke();
    }
  }

  drawHand(ctx, h, t, white) {
    const col = white ? '#fff' : '#e6ecff';
    // wrist threads trailing back to the moon
    if (this.mode !== 'dying' || true) {
      ctx.strokeStyle = white ? '#fff' : `rgba(${SILVER},0.35)`; ctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) {
        const a = Math.atan2(h.y - this.cy, h.x - this.cx) + (i - 1.5) * 0.12;
        const sx = this.cx + Math.cos(a) * this.R * 0.95, sy = this.cy + Math.sin(a) * this.R * 0.95;
        ctx.beginPath(); ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo((sx + h.x) / 2 + Math.sin(t * 2 + i) * 20, (sy + h.y) / 2 + 30, h.x, h.y);
        ctx.stroke();
      }
    }
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.rot - Math.PI / 2);
    if (!white) glow(ctx, 0, 10, 70, SILVER, 0.18 + 0.5 * h.glow + (h.rest ? 0.1 : 0));
    const open = h.open;
    const fingers = [];
    for (let i = 0; i < 5; i++) {
      const thumb = i === 0;
      const sp = (i - 2) * (0.22 + 0.18 * open) + (thumb ? -0.5 * h.s : 0);
      const L = thumb ? 34 : 48 + (i === 2 ? 8 : 0);
      const bx = (i - 2) * 9, by = 22;
      const curl = (1 - open) * 0.9 + Math.sin(t * 2 + i) * 0.05;
      const ex = bx + Math.sin(sp) * L, ey = by + Math.cos(sp) * L * (1 - curl * 0.45);
      fingers.push([bx, by, bx + Math.sin(sp) * L * 0.6 + curl * 8, by + Math.cos(sp) * L * 0.6, ex, ey]);
    }
    const unr = this.unravel;
    for (const pass of white ? [0] : [0, 1]) {
      ctx.strokeStyle = white ? '#fff' : pass === 0 ? INK : col;
      ctx.lineWidth = pass === 0 ? 6 : 2.2;
      ctx.lineCap = 'round';
      // palm: woven loops
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.ellipse(0, 4, 24 - k * 4, 26 - k * 3, k * 0.4 + Math.sin(t + k) * 0.05, 0, TAU); ctx.stroke();
        if (pass === 0) break;
      }
      for (const f of fingers) { ctx.beginPath(); ctx.moveTo(f[0], f[1]); ctx.quadraticCurveTo(f[2], f[3], f[4], f[5]); ctx.stroke(); }
    }
    if (!white) {
      // fingertips
      ctx.fillStyle = '#ffffff';
      for (const f of fingers) { ctx.beginPath(); ctx.arc(f[4], f[5], 2.4, 0, TAU); ctx.fill(); }
      // fraying loose threads in phase 3
      if (unr) {
        ctx.strokeStyle = `rgba(${SILVER},0.5)`; ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-20 + i * 8, -18); ctx.quadraticCurveTo(-24 + i * 9 + Math.sin(t * 4 + i) * 8, -40, -20 + i * 8 + Math.sin(t * 3 + i) * 14, -60); ctx.stroke(); }
      }
      if (h.crescent) {
        ctx.save(); ctx.translate(0, 40);
        glow(ctx, 0, 0, 50, '255,250,230', 0.6);
        ctx.fillStyle = '#f4f6ff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 18, -1.9, 1.9); ctx.arc(-8, 0, 15, 1.45, -1.45, true); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  drawBody(ctx, t, white) {
    const cx = this.cx, cy = this.cy, R = this.R;
    const lum = this.lum;
    ctx.save();
    if (!white) {
      glow(ctx, cx, cy, R * 2.6, '200,215,255', 0.2 * lum * (1 - this.shadow * 0.6));
      glow(ctx, cx, cy, R * 1.5, '235,240,255', 0.25 * lum * (1 - this.shadow * 0.7));
      // orbiting beads of the broken necklace
      for (const b of this.beads) {
        const x = cx + Math.cos(b.a) * b.r, y = cy + Math.sin(b.a) * b.r * 0.55;
        ctx.fillStyle = '#efe8d6'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, b.s, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, b.s * 0.3, 0, TAU); ctx.fill();
      }
    }
    // hands behind? no: in front, but the far one first
    // the moon
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
    if (white) { ctx.fillStyle = '#fff'; ctx.fill(); }
    else {
      const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
      g.addColorStop(0, `rgba(250,251,255,${0.6 + 0.4 * lum})`); g.addColorStop(0.7, `rgba(222,227,242,${0.5 + 0.5 * lum})`); g.addColorStop(1, '#a9b0cc');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R - 2, 0, TAU); ctx.clip();
      // maria and craters
      ctx.fillStyle = 'rgba(140,148,182,0.28)';
      for (const [a, d, r] of [[0.6, 0.55, 34], [2.2, 0.6, 26], [3.6, 0.45, 40], [5.0, 0.7, 20], [4.2, 0.2, 14], [1.4, 0.85, 16]]) {
        ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * d * R, cy + Math.sin(a) * d * R, r, r * 0.8, a, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(120,128,160,0.35)'; ctx.lineWidth = 1.5;
      for (const [a, d, r] of [[0.3, 0.75, 9], [2.8, 0.78, 7], [5.6, 0.5, 6]]) { ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d * R, cy + Math.sin(a) * d * R, r, 0, TAU); ctx.stroke(); }
      // eclipse shadow
      if (this.shadow > 0.01) {
        const sx = cx + (1 - this.shadow) * R * 2.1;
        ctx.fillStyle = 'rgba(8,8,20,0.88)';
        ctx.beginPath(); ctx.arc(sx, cy - (1 - this.shadow) * 20, R * 1.02, 0, TAU); ctx.fill();
      }
      ctx.restore();
      this.drawFace(ctx, t);
    }
    ctx.restore();
    // hands
    for (const h of this.hands) this.drawHand(ctx, h, t, white);
  }

  drawFace(ctx, t) {
    const cx = this.cx, cy = this.cy, R = this.R;
    const eo = this.eyeOpen;
    const lit = 1 - this.shadow * 0.6;
    // eyes
    for (const s of [-1, 1]) {
      const ex = cx + s * R * 0.36, ey = cy - 8;
      if (eo < 0.15) {
        ctx.strokeStyle = INK; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(ex, ey - 8, 20, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
      } else {
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.ellipse(ex, ey, 20, 6 + 14 * eo, s * 0.12, 0, TAU); ctx.fill();
        eye(ctx, ex, ey, 4 + 2 * eo, '#ffffff', true);
        // heavy lid
        ctx.strokeStyle = INK; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(ex, ey + 10, 24, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
      }
      // tears of thread
      if (this.weep > 0 || this.crack) {
        ctx.strokeStyle = `rgba(250,252,255,${0.5 + 0.5 * this.weep})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ex + s * 6, ey + 12);
        ctx.quadraticCurveTo(ex + s * 10 + Math.sin(t * 2 + s) * 4, ey + 50, ex + s * 6 + Math.sin(t * 1.5 + s) * 6, ey + 70 + this.weep * 30);
        ctx.stroke();
      }
    }
    // forehead eye (beams)
    if (this.third > 0) {
      const fy = cy - R * 0.35;
      glow(ctx, cx, fy, 60, '240,244,255', 0.8 * this.third);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(cx, fy, 10, 16 * this.third, 0, 0, TAU); ctx.fill();
      eye(ctx, cx, fy, 4, '#ffffff', true);
    } else {
      ctx.strokeStyle = 'rgba(40,40,60,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy - R * 0.35 - 12); ctx.lineTo(cx, cy - R * 0.35 + 12); ctx.stroke();
    }
    // mouth
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (this.third > 0 || this.pulling) { ctx.ellipse(cx, cy + R * 0.38, 12, 9 + (this.pulling ? 6 : 0), 0, 0, TAU); ctx.fillStyle = '#20202e'; ctx.fill(); }
    else { ctx.moveTo(cx - 18, cy + R * 0.4); ctx.quadraticCurveTo(cx, cy + R * 0.34, cx + 18, cy + R * 0.4); }
    ctx.stroke();
    // the necklace across her chin, snapped
    ctx.strokeStyle = 'rgba(184,50,62,0.9)'; ctx.lineWidth = 2;
    const ny = cy + R * 0.58;
    ctx.beginPath(); ctx.moveTo(cx - R * 0.8, ny - 20); ctx.quadraticCurveTo(cx - R * 0.4, ny + 14, cx - 8, ny + 6); ctx.quadraticCurveTo(cx - 4, ny + 26 + Math.sin(t * 2) * 4, cx - 10, ny + 46); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + R * 0.8, ny - 20); ctx.quadraticCurveTo(cx + R * 0.4, ny + 14, cx + 8, ny + 6); ctx.quadraticCurveTo(cx + 12, ny + 22 + Math.sin(t * 2 + 1) * 4, cx + 6, ny + 34); ctx.stroke();
    // the gap where the last bead should sit
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.setLineDash([3, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, ny + 8, 9, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (this.beads.length === 0) {
      for (const k of [-0.62, -0.42, -0.24, 0.24, 0.42, 0.62]) {
        const x = cx + k * R, y = ny + (Math.abs(k) < 0.3 ? 2 : -6 - (Math.abs(k) - 0.4) * 50);
        ctx.fillStyle = '#efe8d6'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); ctx.stroke();
      }
    }
    // cracks
    if (this.crack) {
      ctx.strokeStyle = INK; ctx.lineWidth = this.crack > 1 ? 4 : 2.5;
      ctx.beginPath(); ctx.moveTo(cx + 20, cy - R); ctx.lineTo(cx + 8, cy - R * 0.62); ctx.lineTo(cx + 26, cy - R * 0.4); ctx.lineTo(cx + 4, cy - R * 0.12); ctx.stroke();
      if (this.crack > 1) {
        ctx.beginPath(); ctx.moveTo(cx + 4, cy - R * 0.12); ctx.lineTo(cx + 18, cy + R * 0.15); ctx.lineTo(cx - 6, cy + R * 0.3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 26, cy - R * 0.4); ctx.lineTo(cx + R * 0.6, cy - R * 0.5); ctx.stroke();
        glow(ctx, cx + 12, cy - R * 0.4, 30, VOID, 0.3 + 0.2 * Math.sin(t * 5));
      }
    }
    void lit;
  }
}

// =================================================================================================
// THE HOLLOW THREAD — What Was Always Missing
// When Bead carries the Void Thread into the Cradle, the moon cracks and this pours out: the
// absence the Strand was spun around. A serpent of black thread with a hollow white mask.
// =================================================================================================

// A hollow copy of Bead that replays Bead's own movement a moment late.
class BeadEcho extends Entity {
  constructor(game, owner, delay, life) {
    super(game, 0, 0, 22, 22);
    this.owner = owner; this.delay = delay; this.life = life; this.t = 0; this.z = 4; this.damage = 1;
    this.pos();
  }
  pos() {
    const H = this.owner.hist;
    const i = Math.max(0, H.length - 1 - Math.round(this.delay / DT));
    const s = H[i] || { x: this.owner.player.cx, y: this.owner.player.cy };
    this.x = s.x - 11; this.y = s.y - 11; this.atk = s.atk; this.face = s.f;
  }
  update(dt) {
    this.t += dt;
    if (this.owner.dead || this.owner.mode !== 'fight' || this.t > this.life) { this.dead = true; this.game.fx.burst(this.cx, this.cy, 8, { color: '#05030a', speed: 140, size: 3, life: 0.4, shape: 'shard' }); return; }
    this.pos();
    this.harmful = this.t > 0.55 && this.t < this.life - 0.2;
  }
  hitboxes() {
    const L = [{ x: this.x + 3, y: this.y + 3, w: 16, h: 16 }];
    if (this.atk) L.push(this.atk);
    return L;
  }
  draw(ctx, t) {
    const a = Math.min(1, this.t / 0.55) * Math.min(1, (this.life - this.t) / 0.2);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a) * (this.harmful ? 1 : 0.5);
    glow(ctx, this.cx, this.cy, 30, VOID, 0.3);
    // trailing thread tail
    ctx.strokeStyle = '#05030a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(this.cx - this.face * 8, this.cy + 4); ctx.quadraticCurveTo(this.cx - this.face * 18, this.cy + 10 + Math.sin(t * 10) * 3, this.cx - this.face * 26, this.cy + 6); ctx.stroke();
    ctx.fillStyle = '#07050c'; ctx.strokeStyle = 'rgba(230,205,255,0.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(this.cx, this.cy, 11, 0, TAU); ctx.fill(); ctx.stroke();
    for (const s of [-1, 1]) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(this.cx + this.face * 2 + s * 4, this.cy - 2, 2.6, 0, TAU); ctx.stroke(); }
    if (this.atk) {
      ctx.fillStyle = 'rgba(10,6,18,0.85)';
      const r = this.atk; ctx.beginPath(); ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(220,190,255,0.8)'; ctx.stroke();
    }
    ctx.restore();
  }
}

class BindLoop extends Projectile {
  constructor(game, x, y, vx, vy, owner) {
    super(game, x, y, vx, vy, { art: 'ht_loop', r: 13, life: 3.2, dmg: 1, homing: 1.3, ignoreWalls: true });
    this.owner = owner;
  }
  onHitPlayer(p) { this.owner.bindT = 1.1; this.game.sfx('tangleHit'); super.onHitPlayer(p); }
}

export class HollowThread extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'hollowthread', size: [56, 56], music: 'boss_hollow', air: true, glints: 0, introTime: 2.8 });
    if (this.dead) return;
    this.noPhysics = true;
    this.G = this.groundY;
    this.hd = -Math.PI / 2;        // heading
    this.sp = 0;                   // speed
    this.path = [];
    this.nSeg = 30; this.gap = 15;
    this.segs = [];
    this.hist = [];
    this.bindT = 0;
    this.count = 0;
    this.under = false;
    this.maskOpen = 0;             // mask split (phase 3)
    this.jaw = 0;
    this.aim = null;
    this.limp = 0;
    this.orbitA = 0;
    for (let i = 0; i < 60; i++) this.path.push({ x: this.cx, y: this.cy + i * 4 });
    this.rebuild();
  }

  // ---------- body ----------
  rebuild() {
    const P = this.path;
    const segs = [];
    let need = this.gap, acc = 0;
    let px = this.cx, py = this.cy;
    for (let i = P.length - 1; i >= 0 && segs.length < this.nSeg; i--) {
      const q = P[i];
      let d = Math.hypot(q.x - px, q.y - py);
      while (d >= need && segs.length < this.nSeg) {
        const k = need / d;
        px += (q.x - px) * k; py += (q.y - py) * k;
        segs.push({ x: px, y: py });
        d = Math.hypot(q.x - px, q.y - py);
        need = this.gap;
      }
      need -= d; acc += d; px = q.x; py = q.y;
    }
    while (segs.length < this.nSeg) segs.push({ x: px, y: py });
    this.segs = segs;
  }

  update(dt) {
    super.update(dt);
    if (this.dead) return;
    const last = this.path[this.path.length - 1];
    if (!last || Math.hypot(last.x - this.cx, last.y - this.cy) > 3) {
      this.path.push({ x: this.cx, y: this.cy });
      if (this.path.length > 400) this.path.shift();
    }
    this.rebuild();
    // record Bead for the echoes
    const p = this.player;
    this.hist.push({ x: p.cx, y: p.cy, f: p.b.facing, atk: p.attackBox() });
    if (this.hist.length > 200) this.hist.shift();
    this.jaw = Math.max(0, this.jaw - dt * 2);
    if (this.mode === 'dying') this.limp = Math.min(1, this.limp + dt);
  }

  think(dt) {
    const b = this.player.b;
    if (this.bindT > 0) {
      this.bindT -= dt;
      b.vx = clamp(b.vx, -120, 120);
      if (b.vy < -420) b.vy = -420;
      if (b.mode === 'dash' || b.mode === 'comet') b.mode = 'normal';
    }
  }

  introUpdate(dt, t) {
    // pours out of the broken moon in a spiral, then turns its mask on Bead
    const A = this.arena;
    const c = { x: A.x + A.w / 2, y: Math.min(this.G - 230, this.spec.fromSelene ? this.cy : this.G - 260) };
    if (!this.introC) this.introC = { x: this.cx, y: this.cy };
    const r = 40 + t * 90;
    const a = t * 5;
    this.setC(this.introC.x + Math.cos(a) * r * 0.9, this.introC.y + Math.sin(a) * r * 0.5);
    this.hd = a + Math.PI / 2;
    if (t > 2.2) this.jaw = 1;
    if (t > 2.3 && !this.introScream) {
      this.introScream = true;
      this.sfx('screech'); this.game.flash('rgba(0,0,0,0.7)', 0.5); this.shake(10, 0.8);
      this.fx.ring(this.cx, this.cy, 10, 500, 0.9, 'rgba(210,170,255,0.8)', 6);
    }
    void c;
  }

  setC(x, y) { this.x = x - this.w / 2; this.y = y - this.h / 2; }

  // ---------- movement primitives ----------
  clampIn(margin = 40) {
    const A = this.arena;
    this.setC(clamp(this.cx, A.x + margin, A.x + A.w - margin), clamp(this.cy, A.y + margin, this.under ? this.G + 200 : this.G - 24));
  }
  // steer toward a target for T seconds (or until within `stop` px)
  *steer(getT, speed, turn, T, stop = 0) {
    const n = Math.round(T / this.speedMul / DT);
    for (let i = 0; i < n; i++) {
      const tg = getT();
      const want = Math.atan2(tg.y - this.cy, tg.x - this.cx);
      let d = want - this.hd; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
      this.hd += clamp(d, -turn * DT, turn * DT);
      const s = speed * this.speedMul;
      this.setC(this.cx + Math.cos(this.hd) * s * DT, this.cy + Math.sin(this.hd) * s * DT);
      this.clampIn();
      if (stop && Math.hypot(tg.x - this.cx, tg.y - this.cy) < stop) return;
      yield;
    }
  }
  *straight(ang, speed, T) {
    this.hd = ang;
    const n = Math.round(T / this.speedMul / DT);
    for (let i = 0; i < n; i++) {
      this.setC(this.cx + Math.cos(ang) * speed * this.speedMul * DT, this.cy + Math.sin(ang) * speed * this.speedMul * DT);
      this.clampIn(30);
      yield;
    }
  }
  // circle Bead at a distance
  *prowl(T, r = 250) {
    const p = this.player;
    this.orbitA = Math.atan2(this.cy - p.cy, this.cx - p.cx);
    const dir = Math.random() < 0.5 ? -1 : 1;
    yield* this.steer(() => { this.orbitA += dir * DT * 2.2; return { x: p.cx + Math.cos(this.orbitA) * r, y: Math.min(this.G - 70, p.cy - 60 + Math.sin(this.orbitA) * r * 0.6) }; }, 520, 6, T);
  }

  // ---------- selection ----------
  onPhase(n) { this.pendingPhase = Math.max(this.pendingPhase || 0, n); }
  chooseAttack() {
    if (this.pendingPhase) { const n = this.pendingPhase; this.pendingPhase = 0; return this.phaseShift(n); }
    this.count++;
    if (this.count % 5 === 0) return this.gasp();
    return super.chooseAttack();
  }
  attackList() {
    const P = this.phase;
    const echoes = this.game.entities.some((e) => e instanceof BeadEcho && !e.dead);
    return [
      { name: 'lash', w: 3.5, fn: this.lash },
      { name: 'bind', w: 2, fn: this.bind },
      { name: 'dive', w: 2.2, fn: this.dive },
      { name: 'mirror', w: echoes ? 0 : 2, fn: this.mirror },
      { name: 'shed', w: 2, fn: this.shed },
      { name: 'cut', w: 2.5, fn: this.cut },
      { name: 'frenzy', w: P >= 3 ? 2.5 : 0, fn: this.frenzy },
    ];
  }
  line(o) { return this.game.add(new Strand(this.game, Object.assign({ owner: this, rgb: VOID, style: 'void' }, o))); }

  // ---------- attacks ----------
  // Rears back, then strikes in a straight line through where Bead was.
  *lash(times) {
    const P = this.phase;
    times = times || (P >= 3 ? 3 : P >= 2 ? 2 : 1);
    yield* this.prowl(0.45);
    for (let i = 0; i < times; i++) {
      const p = this.player;
      // rear back away from Bead
      const away = Math.atan2(this.cy - p.cy, this.cx - p.cx);
      const warn = i === 0 ? 0.5 : 0.38;
      this.tele = warn; this.jaw = 1; this.sfx('rustle');
      let aim = 0;
      yield* this.frames(warn, (k) => {
        this.setC(this.cx + Math.cos(away) * 90 * DT / warn, this.cy + Math.sin(away) * 90 * DT / warn);
        this.clampIn();
        if (k < 0.75) aim = Math.atan2(this.player.cy - this.cy, this.player.cx - this.cx);
        this.hd = aim;
        this.aim = { a: aim, k };
      });
      this.aim = null;
      this.sfx('whip');
      this.jaw = 1;
      yield* this.straight(aim, 1350, 0.36);
      this.shake(3, 0.12);
      // curl away
      yield* this.steer(() => ({ x: this.arena.x + this.arena.w / 2, y: this.G - 300 }), 600, 7, 0.22);
    }
    yield 0.25;
  }

  *frames(T, fn) {
    const n = Math.max(1, Math.round(T / this.speedMul / DT));
    for (let i = 1; i <= n; i++) { fn(i / n); yield; }
  }

  // Loops of void thread that cling. Bound, Bead can barely move.
  *bind() {
    const P = this.phase;
    yield* this.prowl(0.4, 300);
    this.tele = 0.45; this.jaw = 1; this.sfx('charge');
    yield 0.45;
    const n = P >= 2 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const p = this.player;
      const a = Math.atan2(p.cy - this.cy, p.cx - this.cx) + (i - (n - 1) / 2) * 0.5;
      this.game.add(new BindLoop(this.game, this.cx, this.cy, Math.cos(a) * 330, Math.sin(a) * 330, this));
      this.sfx('throw');
      yield 0.12;
    }
    yield* this.prowl(0.6, 300);
    // strike while Bead is caught
    if (this.bindT > 0) yield* this.lash(1);
    yield 0.2;
  }

  // Dives into the floor. The floor comes undone in places. Then it bursts up under Bead.
  *dive() {
    const P = this.phase, A = this.arena;
    const p = this.player;
    const dx = clamp(p.cx + (p.cx < A.x + A.w / 2 ? 300 : -300), A.x + 80, A.x + A.w - 80);
    yield* this.steer(() => ({ x: dx, y: this.G - 260 }), 700, 7, 0.6, 30);
    this.tele = 0.4; this.sfx('charge');
    yield 0.4;
    this.under = true;
    this.hittable = false;
    yield* this.straight(Math.PI / 2, 1200, 0.5);
    this.shake(7, 0.3); this.sfx('rockBreak');
    this.fx.burst(this.cx, this.G, 18, { color: '#0a0612', speed: 300, angle: -Math.PI / 2, spread: 2, size: 4, life: 0.6, shape: 'shard' });
    // the floor unravels in bands around Bead
    const pc = this.player.cx;
    const band = 170, gap = 120;
    const off = this.rand(0, band + gap);
    const warn = P >= 3 ? 0.65 : 0.8;
    for (let x = pc - 700 - off; x < pc + 700; x += band + gap) {
      const x0 = Math.max(A.x, x), x1 = Math.min(A.x + A.w, x + band);
      if (x1 - x0 < 30) continue;
      this.line({ x1: x0, y1: this.G - 7, x2: x1, y2: this.G - 7, warn, live: 1.3, fade: 0.3, width: 14, sfx: 'laser' });
    }
    yield warn + 0.25;
    // eruption under Bead
    const ex = clamp(this.player.cx, A.x + 40, A.x + A.w - 40);
    this.erupt = { x: ex, t: 0.5 };
    this.sfx('warn');
    yield 0.5;
    this.erupt = null;
    this.setC(ex, this.G + 140);
    this.path.push({ x: ex, y: this.G + 300 });
    this.hittable = true;
    this.sfx('burst'); this.shake(9, 0.4);
    this.fx.burst(ex, this.G, 24, { color: '#0a0612', speed: 420, angle: -Math.PI / 2, spread: 1.2, size: 4, life: 0.7, shape: 'shard' });
    yield* this.straight(-Math.PI / 2, 1250, 0.4);
    this.under = false;
    if (P >= 2) { for (let i = -2; i <= 2; i++) this.fire(this.cx, this.cy, i * 140, -120 + Math.abs(i) * 40, { art: 'ht_barb', r: 7, gravity: 900, life: 3 }); }
    yield* this.steer(() => ({ x: this.cx + Math.cos(this.hd + 1) * 200, y: this.G - 320 }), 600, 5, 0.4);
    yield 0.4;
  }

  // It learns Bead. Hollow copies replay Bead's movement a moment behind.
  *mirror() {
    const P = this.phase;
    yield* this.prowl(0.3);
    this.tele = 0.55; this.jaw = 1; this.maskFlash = 1;
    this.sfx('phase');
    this.fx.ring(this.player.cx, this.player.cy, 60, 10, 0.5, 'rgba(210,170,255,0.8)', 3);
    yield 0.55;
    const delays = P >= 2 ? [0.85, 1.6] : [1.0];
    for (const d of delays) this.game.add(new BeadEcho(this.game, this, d, 5 + d));
    yield* this.prowl(0.9);
  }

  // Sweeps over Bead and sheds barbs from its whole length.
  *shed() {
    const A = this.arena, p = this.player;
    const P = this.phase;
    const dir = p.cx < A.x + A.w / 2 ? 1 : -1;
    const y = Math.max(A.y + 60, Math.min(p.cy, this.G - 30) - 300);
    const sx = clamp(p.cx - dir * 520, A.x + 40, A.x + A.w - 40);
    yield* this.steer(() => ({ x: sx, y }), 900, 9, 0.8, 40);
    yield* this.straight(dir > 0 ? 0 : Math.PI, 1000, 0.95);
    this.glowSegs = 1; this.sfx('warn');
    yield* this.steer(() => ({ x: this.cx + dir * 200, y: y - 30 }), 260, 3, 0.45);
    for (let i = 4; i < this.segs.length; i += P >= 2 ? 3 : 4) {
      const s = this.segs[i];
      this.fire(s.x, s.y, 0, 280, { art: 'ht_barb', r: 7, gravity: 700, life: 3 });
    }
    this.glowSegs = 0; this.sfx('spit');
    yield 0.6;
  }

  // Splits space with void cuts through Bead.
  *cut() {
    const P = this.phase;
    yield* this.prowl(0.35, 330);
    const n = P >= 3 ? 5 : P >= 2 ? 4 : 3;
    this.maskFlash = 1; this.jaw = 1;
    const B = { x: this.arena.x, y: this.arena.y, w: this.arena.w, h: this.G - this.arena.y };
    let a = Math.random() * Math.PI;
    for (let i = 0; i < n; i++) {
      const p = this.player;
      a += Math.PI / 2 + this.rand(-0.5, 0.5);
      const [x1, y1, x2, y2] = clipLine(p.cx, p.cy, a, B);
      this.line({ x1, y1, x2, y2, warn: P >= 3 ? 0.5 : 0.58, live: 0.22, fade: 0.25, width: 16, sfx: 'slash', onLive: () => this.shake(4, 0.12) });
      yield 0.34;
    }
    yield 0.6;
  }

  // Phase 3: everything at once, fast.
  *frenzy() {
    this.sfx('screech');
    yield* this.lash(3);
    yield* this.cut();
    yield* this.dive();
  }

  // After a long string of attacks it sags, mask low, and can be struck.
  *gasp() {
    const A = this.arena;
    const x = clamp(this.player.cx + this.rand(-200, 200), A.x + 80, A.x + A.w - 80);
    yield* this.steer(() => ({ x, y: this.G - 40 }), 700, 8, 0.7, 20);
    this.limp = 1;
    this.sfx('rustle');
    yield* this.frames(this.phase >= 3 ? 1.2 : 1.5, (k) => { this.setC(this.cx + Math.sin(k * 20) * 0.6, this.G - 34); this.hd = Math.PI / 2 + Math.sin(k * 6) * 0.3; });
    this.limp = 0;
    yield* this.steer(() => ({ x: this.cx, y: this.G - 300 }), 650, 6, 0.5);
  }

  *phaseShift(n) {
    this.harmless = true;
    const A = this.arena;
    yield* this.steer(() => ({ x: A.x + A.w / 2, y: this.G - 300 }), 800, 8, 0.6, 30);
    this.game.hitstop(0.3);
    this.game.flash('rgba(0,0,0,0.85)', 0.8);
    this.shake(14, 1.0);
    this.sfx('screech'); this.sfx('bossRoar');
    this.fx.ring(this.cx, this.cy, 10, 600, 1.0, 'rgba(210,170,255,0.9)', 8);
    this.fx.burst(this.cx, this.cy, 40, { color: '#05030a', speed: 480, size: 5, life: 1.1, shape: 'shard', g: 0 });
    if (n >= 3) { this.maskOpen = 1; this.nSeg = 38; this.speedMul *= 1.12; }
    else { this.crack = 1; this.nSeg = 34; this.speedMul *= 1.08; }
    yield* this.frames(1.2, (k) => { this.hd += 0.25; this.setC(this.cx + Math.cos(this.hd) * 4, this.cy + Math.sin(this.hd) * 4); });
    this.harmless = false;
  }

  onDeath() { this.aim = null; this.erupt = null; this.bindT = 0; this.under = false; }
  onFinish() {
    const g = this.game;
    g.save.flags.boss_selene = 1;
    g.app.ending && g.app.ending('B');
  }

  // ---------- collision ----------
  headBox() { return { x: this.cx - 26, y: this.cy - 26, w: 52, h: 52 }; }
  hurtboxes() {
    if (this.mode !== 'fight' || this.under) return [];
    const L = [this.headBox()];
    for (let i = 1; i < 7; i++) { const s = this.segs[i]; if (s.y < this.G) L.push({ x: s.x - 12, y: s.y - 12, w: 24, h: 24 }); }
    return L;
  }
  hurtbox() { return this.headBox(); }
  hitboxes() {
    if (this.harmless || this.limp) return this.hits;
    const L = [];
    if (this.cy < this.G + 10) L.push({ x: this.cx - 20, y: this.cy - 20, w: 40, h: 40 });
    for (let i = 3; i < this.segs.length - 2; i += 2) {
      const s = this.segs[i];
      if (s.y < this.G - 4) L.push({ x: s.x - 7, y: s.y - 7, w: 14, h: 14 });
    }
    return L.concat(this.hits);
  }

  // ---------- drawing ----------
  drawExtra(ctx, t) {
    if (this.aim) {
      const [ex, ey] = rayEnd(this.cx, this.cy, this.aim.a, { x: this.arena.x, y: this.arena.y, w: this.arena.w, h: this.G - this.arena.y });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${VOID},${0.2 + 0.4 * this.aim.k})`; ctx.lineWidth = 2 + 10 * this.aim.k;
      ctx.setLineDash([12, 10]); ctx.lineDashOffset = -t * 200;
      ctx.beginPath(); ctx.moveTo(this.cx, this.cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.restore();
    }
    if (this.erupt) {
      const k = 1 - this.erupt.t;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, this.erupt.x, this.G, 70, VOID, 0.5 + 0.3 * Math.sin(t * 40));
      ctx.restore();
      ctx.strokeStyle = '#05030a'; ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.5; ctx.beginPath(); ctx.moveTo(this.erupt.x, this.G); ctx.lineTo(this.erupt.x + Math.cos(a) * (30 + 20 * k), this.G + Math.sin(a) * 18); ctx.stroke(); }
      this.erupt.t = Math.max(0, this.erupt.t - DT);
    }
    // binding loops around Bead
    if (this.bindT > 0) {
      const p = this.player;
      ctx.strokeStyle = '#05030a'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(p.cx, p.cy, 18, 7, t * 3 + i * 1.05, 0, TAU); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(220,190,255,0.7)'; ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(p.cx, p.cy, 18, 7, t * 3 + i * 1.05, 0, TAU); ctx.stroke(); }
    }
  }

  drawBody(ctx, t, white) {
    const A = this.arena;
    ctx.save();
    // never draw below the floor (when diving)
    ctx.beginPath(); ctx.rect(A.x - 200, A.y - 600, A.w + 400, this.G - A.y + 600); ctx.clip();
    const segs = this.segs;
    const lim = this.limp;
    const dieK = this.mode === 'dying' ? Math.min(1, this.dieT / 2) : 0;
    const pts = [{ x: this.cx, y: this.cy }, ...segs].map((s, i) => ({
      x: s.x + Math.sin(t * 9 + i * 0.7) * (2 + i * 0.12) + (dieK ? Math.sin(i * 12.9) * 60 * dieK : 0),
      y: s.y + Math.cos(t * 7 + i * 0.6) * (2 + i * 0.1) + (dieK ? (Math.cos(i * 7.3) * 30 + i * 4) * dieK : 0),
    }));
    // body: braided black thread
    if (!white) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${VOID},0.12)`; ctx.lineWidth = 34; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
      ctx.restore();
    }
    const N = pts.length;
    for (let i = N - 1; i > 0; i--) {
      const a = pts[i], b = pts[i - 1];
      const w = 4 + 15 * (1 - i / N);
      ctx.strokeStyle = white ? '#fff' : '#05030a'; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    if (!white) {
      // three strands twisting along the body
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = k === 0 ? 'rgba(235,215,255,0.55)' : 'rgba(150,100,200,0.45)'; ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < N - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
          const w = (4 + 15 * (1 - i / N)) * 0.4 * Math.sin(i * 0.9 + k * 2.1 + t * 6);
          const x = a.x + Math.cos(ang) * w, y = a.y + Math.sin(ang) * w;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      // loose fibres
      ctx.strokeStyle = 'rgba(5,3,10,0.9)'; ctx.lineWidth = 1.2;
      for (let i = 2; i < N; i += 3) {
        const q = pts[i];
        const a = t * 2 + i;
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.quadraticCurveTo(q.x + Math.cos(a) * 14, q.y + Math.sin(a) * 14, q.x + Math.cos(a + 0.8) * 22, q.y + Math.sin(a + 0.8) * 22 + 6); ctx.stroke();
      }
      if (this.glowSegs) for (let i = 4; i < segs.length; i += this.phase >= 2 ? 3 : 4) glow(ctx, segs[i].x, segs[i].y, 18, VOID, 0.7);
      // frayed tail
      const tl = pts[N - 1];
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.quadraticCurveTo(tl.x + Math.sin(t * 3 + i) * 20, tl.y + 10, tl.x + Math.sin(t * 2 + i * 1.3) * 30, tl.y + 26); ctx.stroke(); }
    }
    ctx.restore();
    this.drawMask(ctx, t, white, lim);
  }

  drawMask(ctx, t, white, lim) {
    const x = this.cx, y = this.cy;
    let a = this.hd + Math.PI / 2;
    // keep the mask mostly upright: lean only partly into the heading
    let d = a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
    const rot = clamp(d, -1.0, 1.0) * 0.45 + (lim ? 0.5 : 0);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    if (!white) glow(ctx, 0, 0, 80, this.maskOpen ? '255,255,255' : VOID, 0.35 + 0.25 * (this.maskFlash || 0));
    this.maskFlash = Math.max(0, (this.maskFlash || 0) - DT * 1.5);
    const split = this.maskOpen ? 7 + Math.sin(t * 6) * 2 : 0;
    for (const side of split ? [-1, 1] : [0]) {
      ctx.save();
      if (side) {
        ctx.translate(side * split, 0); ctx.rotate(side * 0.08);
        ctx.beginPath(); ctx.rect(side < 0 ? -60 : 0, -60, 60, 120); ctx.clip();
      }
      ctx.beginPath();
      ctx.moveTo(0, -34);
      ctx.bezierCurveTo(26, -34, 28, 6, 18, 24);
      ctx.quadraticCurveTo(0, 38 + this.jaw * 8, -18, 24);
      ctx.bezierCurveTo(-28, 6, -26, -34, 0, -34);
      ctx.fillStyle = white ? '#fff' : '#f7f4ee'; ctx.fill();
      ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 3; ctx.stroke();
      if (!white) {
        // hollow eyes: there is nothing behind them
        for (const s of [-1, 1]) {
          ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.ellipse(s * 10, -6, 7.5, 11, s * -0.25, 0, TAU); ctx.fill();
          ctx.strokeStyle = `rgba(${VOID},0.8)`; ctx.lineWidth = 1; ctx.stroke();
        }
        // hollow mouth
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(0, 16, 5, 3 + this.jaw * 5, 0, 0, TAU); ctx.fill();
        // two horns of thread
        ctx.strokeStyle = INK; ctx.lineWidth = 3;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 14, -30); ctx.quadraticCurveTo(s * 30, -52, s * 22 + Math.sin(t * 4 + s) * 4, -70); ctx.stroke(); }
        if (this.crack) { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, -34); ctx.lineTo(2, -18); ctx.lineTo(-3, -8); ctx.stroke(); }
      }
      ctx.restore();
    }
    if (split && !white) {
      // the white light of nothing between the halves
      glow(ctx, 0, 0, 40, '255,255,255', 0.6);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-split * 0.6, -30, split * 1.2, 56);
    }
    ctx.restore();
  }
}

export default { selene: Selene, hollowthread: HollowThread };
