// Screen-space ambient particles (dust, spores, rain, embers, snow...) with parallax.
import { VIEW_W, VIEW_H } from '../core/constants.js';
import { TAU } from '../core/math.js';
import { rgba } from './palettes.js';

const KINDS = {
  lint: { n: 40, vy: [-6, 10], vx: [-8, 8], size: [1, 2.6], color: 'accent', a: 0.35, wobble: 1 },
  spores: { n: 55, vy: [-14, -3], vx: [-6, 6], size: [1, 2.4], color: 'glow', a: 0.5, wobble: 1.5, glow: true },
  rain: { n: 90, vy: [700, 900], vx: [-60, -40], size: [1, 1.5], color: 'accent', a: 0.25, streak: true },
  pollen: { n: 50, vy: [-4, 10], vx: [6, 18], size: [1, 2.5], color: 'glow', a: 0.5, wobble: 2, glow: true },
  embers: { n: 45, vy: [-60, -20], vx: [-10, 10], size: [1, 2.2], color: 'glow', a: 0.7, wobble: 2, glow: true },
  sparks: { n: 25, vy: [-40, 30], vx: [-20, 20], size: [0.8, 1.6], color: 'glow', a: 0.7, glow: true, blink: true },
  bubbles: { n: 35, vy: [-40, -15], vx: [-4, 4], size: [1.5, 3.5], color: 'accent', a: 0.4, ring: true, wobble: 1 },
  glitter: { n: 50, vy: [-8, 8], vx: [-8, 8], size: [0.8, 2], color: 'glow', a: 0.8, glow: true, blink: true },
  wind: { n: 40, vy: [-10, 10], vx: [-260, -160], size: [1, 1.5], color: 'accent', a: 0.25, streak: true },
  pages: { n: 18, vy: [5, 20], vx: [-10, 10], size: [3, 5], color: 'accent', a: 0.35, leaf: true, wobble: 2 },
  snow: { n: 70, vy: [25, 60], vx: [-15, 5], size: [1, 2.8], color: 'accent', a: 0.7, wobble: 1.5 },
  void: { n: 40, vy: [-20, -5], vx: [-5, 5], size: [1, 3], color: 'accent', a: 0.5, glow: true, wobble: 1 },
};

export class Ambient {
  constructor() { this.parts = []; this.kind = null; }

  reset(style) {
    const k = KINDS[style.particles] || KINDS.lint;
    if (this.kind === k && this.parts.length) return;
    this.kind = k;
    this.parts = [];
    for (let i = 0; i < k.n; i++) this.parts.push(this.spawn(k, style, true));
  }

  spawn(k, style, anywhere) {
    const rnd = (r) => r[0] + Math.random() * (r[1] - r[0]);
    return {
      x: Math.random() * VIEW_W, y: anywhere ? Math.random() * VIEW_H : (k.vy[0] > 0 ? -10 : VIEW_H + 10),
      vx: rnd(k.vx), vy: rnd(k.vy), s: rnd(k.size), depth: 0.3 + Math.random() * 1.0,
      ph: Math.random() * TAU, color: style[k.color] || '#fff', front: Math.random() < 0.25,
    };
  }

  update(dt, cam, style) {
    const k = this.kind; if (!k) return;
    const dx = cam.x - (this.lastX ?? cam.x), dy = cam.y - (this.lastY ?? cam.y);
    this.lastX = cam.x; this.lastY = cam.y;
    for (const p of this.parts) {
      p.ph += dt * 2;
      p.x += (p.vx + (k.wobble ? Math.sin(p.ph) * 10 * k.wobble : 0)) * dt - dx * p.depth;
      p.y += p.vy * dt - dy * p.depth;
      if (p.x < -20) p.x += VIEW_W + 40; if (p.x > VIEW_W + 20) p.x -= VIEW_W + 40;
      if (p.y < -20) p.y += VIEW_H + 40; if (p.y > VIEW_H + 20) p.y -= VIEW_H + 40;
    }
  }
}

export function drawAmbient(ctx, amb, camX, camY, front) {
  const k = amb.kind; if (!k) return;
  if (k.glow) ctx.globalCompositeOperation = 'lighter';
  for (const p of amb.parts) {
    if (p.front !== front) continue;
    let a = k.a * (front ? 1 : 0.6);
    if (k.blink) a *= 0.5 + 0.5 * Math.sin(p.ph * 3);
    ctx.globalAlpha = Math.max(0, a);
    const s = p.s * (front ? 1.4 : 1);
    if (k.streak) {
      ctx.strokeStyle = p.color; ctx.lineWidth = s;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
    } else if (k.ring) {
      ctx.strokeStyle = p.color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, s * 1.5, 0, TAU); ctx.stroke();
    } else if (k.leaf) {
      ctx.fillStyle = p.color;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ph);
      ctx.fillRect(-s, -s * 0.7, s * 2, s * 1.4); ctx.restore();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
