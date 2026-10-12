// Lightweight particle system + transient visual effects (slashes, rings, flashes, text).
import { TAU } from '../core/math.js';

export class FX {
  constructor() {
    this.parts = [];
    this.fronts = []; // drawn above entities
  }
  clear() { this.parts.length = 0; this.fronts.length = 0; }

  // Generic particle: {x,y,vx,vy,life,max,size,color,g(gravity),drag,shape,rot,vr,front,glow}
  add(p) {
    p.max = p.life;
    p.rot = p.rot || 0; p.vr = p.vr || 0;
    p.drag = p.drag ?? 0.0;
    (p.front ? this.fronts : this.parts).push(p);
    return p;
  }

  burst(x, y, n, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = opts.angle !== undefined ? opts.angle + (Math.random() - 0.5) * (opts.spread ?? TAU) : Math.random() * TAU;
      const sp = (opts.speed ?? 200) * (0.4 + Math.random() * 0.8);
      this.add({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: (opts.life ?? 0.5) * (0.6 + Math.random() * 0.6),
        size: (opts.size ?? 3) * (0.6 + Math.random() * 0.8),
        color: opts.color ?? '#ffffff', g: opts.g ?? 600, drag: opts.drag ?? 2,
        shape: opts.shape ?? 'dot', front: opts.front ?? true, glow: opts.glow,
        vr: (Math.random() - 0.5) * 12,
      });
    }
  }

  ring(x, y, r0, r1, life, color, width = 3) {
    this.add({ x, y, vx: 0, vy: 0, life, size: 0, color, shape: 'ring', r0, r1, width, front: true });
  }

  slash(x, y, ang, len, color, life = 0.12, flip = 1) {
    this.add({ x, y, vx: 0, vy: 0, life, size: len, color, shape: 'slash', rot: ang, flip, front: true });
  }

  text(x, y, str, color = '#fff', size = 14) {
    this.add({ x, y, vx: 0, vy: -40, life: 1, size, color, shape: 'text', str, front: true, g: 0 });
  }

  update(dt) {
    for (const list of [this.parts, this.fronts]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) { list.splice(i, 1); continue; }
        p.vy += (p.g || 0) * dt;
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d; p.vy *= d;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
    }
  }

  draw(ctx, front) {
    const list = front ? this.fronts : this.parts;
    for (const p of list) {
      const t = p.life / p.max;
      ctx.globalAlpha = Math.min(1, t * 1.5);
      if (p.glow) ctx.globalCompositeOperation = 'lighter';
      switch (p.shape) {
        case 'dot':
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * t), 0, TAU); ctx.fill();
          break;
        case 'shard':
          ctx.fillStyle = p.color;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.beginPath(); ctx.moveTo(-p.size, 0); ctx.lineTo(0, -p.size * 0.4); ctx.lineTo(p.size, 0); ctx.lineTo(0, p.size * 0.4); ctx.fill();
          ctx.restore();
          break;
        case 'streak':
          ctx.strokeStyle = p.color; ctx.lineWidth = p.size * t;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
          break;
        case 'ring': {
          const k = 1 - t;
          ctx.strokeStyle = p.color; ctx.lineWidth = p.width * t;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * (1 - Math.pow(1 - k, 3)), 0, TAU); ctx.stroke();
          break;
        }
        case 'slash': {
          // crescent ink swoosh
          const k = 1 - t;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, p.flip);
          const L = p.size;
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.min(1, t * 2.2);
          ctx.beginPath();
          const a0 = -1.25 + k * 0.4, a1 = 1.25 + k * 0.4;
          ctx.ellipse(0, 0, L * 0.62, L * 0.62, 0, a0, a1);
          ctx.ellipse(-L * 0.16, 0, L * 0.48, L * 0.5, 0, a1, a0, true);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'text':
          ctx.fillStyle = p.color;
          ctx.font = `${p.size}px Georgia, serif`;
          ctx.textAlign = 'center';
          ctx.fillText(p.str, p.x, p.y);
          break;
        case 'leaf':
          ctx.fillStyle = p.color;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, TAU); ctx.fill();
          ctx.restore();
          break;
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }
}
