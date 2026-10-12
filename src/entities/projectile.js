// Projectiles for both Bead (friendly spells) and enemies/bosses.
import { Entity } from './base.js';
import { TAU, overlap } from '../core/math.js';
import { moveX, moveY } from '../world/movement.js';

// opts: friendly, dmg, life, r (radius), art, gravity, pierce, bounce, multi (hits per target),
//       box {w,h,ox,oy} for area spells, follow (entity), color, homing, ignoreWalls, onDie
export class Projectile extends Entity {
  constructor(game, x, y, vx, vy, opts = {}) {
    const r = opts.r ?? 8;
    super(game, x - r, y - r, r * 2, r * 2);
    this.vx = vx; this.vy = vy;
    this.o = opts;
    this.r = r;
    this.life = opts.life ?? 3;
    this.age = 0;
    this.friendly = !!opts.friendly;
    this.harmful = !this.friendly;
    this.damage = opts.dmg ?? 1;
    this.hitMap = new Map();
    this.z = 5;
    this.rot = Math.atan2(vy, vx);
    this.removable = true;
    this.trail = [];
  }

  rect() {
    if (this.o.box) {
      const b = this.o.box, f = this.o.follow;
      const cx = f ? f.cx : this.cx, cy = f ? f.cy : this.cy;
      return { x: cx - b.w / 2 + (b.ox || 0), y: cy + (b.oy ?? -b.h / 2), w: b.w, h: b.h };
    }
    return { x: this.x + this.r * 0.2, y: this.y + this.r * 0.2, w: this.w - this.r * 0.4, h: this.h - this.r * 0.4 };
  }

  update(dt) {
    const g = this.game;
    this.age += dt;
    this.life -= dt;
    if (this.life <= 0) return this.die(false);
    if (this.o.follow) { /* area spell anchored to caster */ }
    else {
      if (this.o.gravity) this.vy += this.o.gravity * dt;
      if (this.o.homing && !this.friendly) {
        const p = g.player;
        const a = Math.atan2(p.cy - this.cy, p.cx - this.cx);
        const sp = Math.hypot(this.vx, this.vy);
        const cur = Math.atan2(this.vy, this.vx);
        let d = a - cur; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        const na = cur + Math.max(-this.o.homing * dt, Math.min(this.o.homing * dt, d));
        this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
      }
      if (this.o.accel) { this.vx *= 1 + this.o.accel * dt; this.vy *= 1 + this.o.accel * dt; }
      if (this.o.ignoreWalls) { this.x += this.vx * dt; this.y += this.vy * dt; }
      else {
        const hx = moveX(this, this.room, this.vx * dt, 0);
        const hy = moveY(this, this.room, this.vy * dt, { dropThrough: true });
        if (hx || hy) {
          if (this.o.bounce && (this.bounces = (this.bounces || 0) + 1) <= this.o.bounce) {
            if (hx) this.vx = -this.vx * 0.8; if (hy) this.vy = -this.vy * 0.7;
          } else return this.die(true);
        }
      }
      this.rot = Math.atan2(this.vy, this.vx);
      this.trail.push({ x: this.cx, y: this.cy });
      if (this.trail.length > 8) this.trail.shift();
    }
    if (this.friendly) {
      const box = this.rect();
      for (const e of g.entities) {
        if (!e.isEnemy || e.dead || !e.hittable) continue;
        const hb = e.hurtbox ? e.hurtbox() : e.rect();
        if (!overlap(box, hb)) continue;
        const n = this.hitMap.get(e) || 0;
        const last = this.lastHitT && this.lastHitT.get(e);
        if (n >= (this.o.multi || 1)) continue;
        if (last !== undefined && this.age - last < 0.12) continue;
        this.hitMap.set(e, n + 1);
        (this.lastHitT = this.lastHitT || new Map()).set(e, this.age);
        e.hurt(this.damage, Math.sign(this.vx) || Math.sign(e.cx - this.cx) || 1, 'spell');
        g.fx.burst(e.cx, e.cy, 6, { color: '#fff4d8', speed: 200, size: 2.5, life: 0.3, g: 0 });
        if (!this.o.pierce && !this.o.box) return this.die(true);
      }
    }
  }

  onBonk(dmg, dir, p) {
    // enemy projectiles marked "parryable" can be bonked away
    if (!this.friendly && this.o.parry) {
      this.vx = -this.vx * 1.2; this.vy = -this.vy; this.friendly = true; this.harmful = false; this.o.pierce = false;
      this.game.sfx('parry');
      return true;
    }
    return false;
  }

  onHitPlayer() { if (!this.o.pierce && !this.o.box) this.die(true); }

  die(impact) {
    if (this.dead) return;
    this.dead = true;
    if (impact) this.game.fx.burst(this.cx, this.cy, 6, { color: this.o.color || '#fff', speed: 150, size: 2.5, life: 0.3 });
    if (this.o.onDie) this.o.onDie(this);
  }

  draw(ctx, t) {
    const art = this.o.art || 'orb';
    const P = PROJ_ART[art] || PROJ_ART.orb;
    P(ctx, this, t);
  }
}

const PROJ_ART = {
  none() {},
  orb(ctx, p, t) {
    const c = p.o.color || '#ff8a7a';
    for (let i = 0; i < p.trail.length; i++) {
      const q = p.trail[i];
      ctx.globalAlpha = (i / p.trail.length) * 0.4;
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(q.x, q.y, p.r * (i / p.trail.length), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#16141c';
    ctx.beginPath(); ctx.arc(p.cx, p.cy, p.r + 1.5, 0, TAU); ctx.fill();
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(p.cx, p.cy, p.r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(p.cx - p.r * 0.3, p.cy - p.r * 0.3, p.r * 0.35, 0, TAU); ctx.fill();
  },
  shard(ctx, p, t) {
    ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.rot);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, p.r * 3);
    g.addColorStop(0, 'rgba(255,245,220,0.6)'); g.addColorStop(1, 'rgba(255,245,220,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, p.r * 3, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fff8ea'; ctx.strokeStyle = '#16141c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.r * 1.8, 0); ctx.lineTo(0, -p.r * 0.7); ctx.lineTo(-p.r * 1.4, 0); ctx.lineTo(0, p.r * 0.7); ctx.closePath();
    ctx.stroke(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,250,235,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath();
    p.trail.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.stroke();
  },
  howl(ctx, p, t) {
    const r = p.rect();
    const k = p.age / (p.age + p.life);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(255,245,225,${0.5 * (1 - k)})`; ctx.lineWidth = 3;
      ctx.beginPath();
      const x = r.x + r.w / 2 + Math.sin(t * 30 + i * 2) * 14;
      ctx.moveTo(x, r.y + r.h); ctx.bezierCurveTo(x - 20, r.y + r.h * 0.6, x + 20, r.y + r.h * 0.3, x + Math.sin(i) * 20, r.y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  },
  unravel(ctx, p, t) {
    const k = p.age / (p.age + p.life);
    const cx = p.o.follow.cx, cy = p.o.follow.cy;
    ctx.strokeStyle = `rgba(184,50,62,${0.9 * (1 - k)})`; ctx.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + k * 2;
      const L = 20 + k * 90;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx + Math.cos(a + 0.5) * L * 0.6, cy + Math.sin(a + 0.5) * L * 0.6, cx + Math.cos(a) * L, cy + Math.sin(a) * L);
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(255,240,230,${0.6 * (1 - k)})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 20 + k * 80, 0, TAU); ctx.stroke();
  },
  needle(ctx, p) {
    ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.rot);
    ctx.fillStyle = p.o.color || '#e8e0d0'; ctx.strokeStyle = '#16141c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(p.r * 2, 0); ctx.lineTo(-p.r * 1.5, -p.r * 0.4); ctx.lineTo(-p.r * 1.5, p.r * 0.4); ctx.closePath();
    ctx.stroke(); ctx.fill();
    ctx.restore();
  },
  glob(ctx, p, t) {
    const c = p.o.color || '#a6d94a';
    ctx.fillStyle = '#16141c';
    ctx.beginPath(); ctx.ellipse(p.cx, p.cy, p.r + 1.5, p.r * 0.85 + 1.5, p.rot, 0, TAU); ctx.fill();
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(p.cx, p.cy, p.r, p.r * 0.85, p.rot, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(p.cx - 2, p.cy - 2, p.r * 0.3, 0, TAU); ctx.fill();
  },
  flame(ctx, p, t) {
    ctx.globalCompositeOperation = 'lighter';
    const c = p.o.color || '#ff8a3d';
    for (let i = 0; i < 3; i++) {
      const g = ctx.createRadialGradient(p.cx, p.cy, 0, p.cx, p.cy, p.r * (2 - i * 0.4));
      g.addColorStop(0, i === 2 ? '#fff4d0' : c); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.cx, p.cy, p.r * (2 - i * 0.4), 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  },
  wave(ctx, p, t) {
    const r = p.rect();
    ctx.fillStyle = p.o.color || 'rgba(240,230,210,0.85)';
    ctx.beginPath();
    ctx.moveTo(r.x, r.y + r.h);
    ctx.quadraticCurveTo(r.x + r.w * 0.5, r.y - r.h * 0.3, r.x + r.w, r.y + r.h);
    ctx.fill();
  },
  beam(ctx, p, t) {
    const r = p.rect();
    const k = Math.min(1, p.age * 8);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = p.o.color || 'rgba(255,220,240,0.8)';
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 50);
    ctx.fillRect(r.x, r.y, r.w * (p.o.box && p.o.box.w > p.o.box.h ? k : 1), r.h * (p.o.box && p.o.box.h >= p.o.box.w ? k : 1));
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },
  feather(ctx, p) {
    ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.rot);
    ctx.fillStyle = p.o.color || '#dfe6f5'; ctx.strokeStyle = '#16141c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 0, p.r * 1.8, p.r * 0.55, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-p.r * 1.8, 0); ctx.lineTo(p.r * 1.8, 0); ctx.stroke();
    ctx.restore();
  },
};

export function registerProjectileArt(name, fn) { PROJ_ART[name] = fn; }
