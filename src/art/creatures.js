// Parametric hand-inked creature painters. Each painter draws in a local frame:
// origin at the creature's bottom-center (ground creatures) or center (flyers, `centered: true`),
// facing +x. Size comes from e.w / e.h. A = art params {c1, c2, c3, eye, ...}.
import { TAU } from '../core/math.js';

export const INK = '#16141c';

function ink(ctx, lw = 2) { ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }
function fillInk(ctx, fill, lw = 2) {
  ctx.fillStyle = fill; ctx.fill();
  ink(ctx, lw * 1.1); ctx.stroke();
  // a faint, slightly offset second pass: the wobble of a hand retracing its line
  ctx.save(); ctx.translate(0.7, 0.5); ctx.globalAlpha *= 0.3; ink(ctx, lw * 0.6); ctx.stroke(); ctx.restore();
}

export function eye(ctx, x, y, r, color = '#fff', glow = false, shape = 'round') {
  if (glow) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  if (shape === 'slit') ctx.ellipse(x, y, r * 0.55, r * 1.2, 0, 0, TAU);
  else if (shape === 'angry') { ctx.moveTo(x - r, y - r * 0.6); ctx.lineTo(x + r, y - r * 0.1); ctx.lineTo(x + r * 0.6, y + r * 0.8); ctx.lineTo(x - r * 0.8, y + r * 0.6); }
  else ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function legs(ctx, n, w, y, len, phase, lw = 2, spread = 1) {
  ink(ctx, lw);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n);
    const sw = Math.sin(phase + i * 2.1) * 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + sw + 3 * spread, y + len * 0.4, x + sw * 1.5 - 2 * spread, y + len);
    ctx.stroke();
  }
}

function spikesArc(ctx, cx, cy, rx, ry, a0, a1, n, len, fill) {
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (i + 0.5) / n;
    const bx = cx + Math.cos(a) * rx, by = cy + Math.sin(a) * ry;
    const tx = cx + Math.cos(a) * (rx + len), ty = cy + Math.sin(a) * (ry + len);
    const px = -Math.sin(a) * 3, py = Math.cos(a) * 3;
    ctx.beginPath(); ctx.moveTo(bx + px, by + py); ctx.lineTo(tx, ty); ctx.lineTo(bx - px, by - py); ctx.closePath();
    fillInk(ctx, fill, 1.5);
  }
}

function wings(ctx, x, y, w, h, flap, fill, alpha = 0.8, style = 'moth') {
  ctx.globalAlpha = alpha;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(s * 0.2 - flap * 0.9 * (s > 0 ? 1 : 0.7));
    ctx.beginPath();
    if (style === 'fly') ctx.ellipse(-w * 0.2, -h * 0.5, w * 0.5, h * 0.3, -0.5, 0, TAU);
    else if (style === 'bat') {
      ctx.moveTo(0, 0); ctx.lineTo(-w * 0.3, -h); ctx.lineTo(-w * 0.6, -h * 0.5); ctx.lineTo(-w, -h * 0.7);
      ctx.lineTo(-w * 0.8, 0); ctx.lineTo(-w * 0.4, -h * 0.15); ctx.closePath();
    } else ctx.ellipse(-w * 0.35, -h * 0.45, w * 0.6, h * 0.55, -0.6, 0, TAU);
    fillInk(ctx, fill, 1.5);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// Pale HK-style mask face
function mask(ctx, x, y, r, A, f = 1) {
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.quadraticCurveTo(x - r, y - r * 1.2, x, y - r * 1.25);
  ctx.quadraticCurveTo(x + r, y - r * 1.2, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.8, y + r, x, y + r * 1.05);
  ctx.quadraticCurveTo(x - r * 0.8, y + r, x - r, y);
  fillInk(ctx, A.c3 || '#efe8d8');
  ctx.fillStyle = INK;
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(x + s * r * 0.38 + f * 1, y - r * 0.05, r * 0.24, r * 0.38, s * 0.15, 0, TAU); ctx.fill();
  }
  if (A.eye && A.eye !== INK) {
    for (const s of [-1, 1]) eye(ctx, x + s * r * 0.38 + f, y - r * 0.05, r * 0.11, A.eye, true);
  }
}

export const PAINTERS = {
  // fuzzy lint ball with stubby legs
  mite(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 12;
    legs(ctx, 4, w * 0.7, -h * 0.25, h * 0.3, ph, 1.6);
    const bob = Math.abs(Math.sin(ph)) * 2;
    ctx.beginPath();
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const r = (i % 2 ? 0.9 : 1.08);
      ctx.lineTo(Math.cos(a) * w * 0.48 * r, -h * 0.55 - bob + Math.sin(a) * h * 0.45 * r);
    }
    fillInk(ctx, A.c1);
    eye(ctx, w * 0.18, -h * 0.6 - bob, Math.max(2, w * 0.08), A.eye || '#fff', !!A.glow);
    if (A.c2) { ctx.fillStyle = A.c2; ctx.beginPath(); ctx.arc(-w * 0.15, -h * 0.75 - bob, w * 0.1, 0, TAU); ctx.fill(); }
  },

  grub(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 8;
    const segs = A.segs || 4;
    for (let i = segs - 1; i >= 0; i--) {
      const x = -w * 0.35 + (i / (segs - 1)) * w * 0.65;
      const sq = 1 + Math.sin(ph - i) * 0.08;
      const r = h * (0.38 + i * 0.04) * sq;
      ctx.beginPath(); ctx.ellipse(x, -r, r * 1.05, r, 0, 0, TAU);
      fillInk(ctx, i === segs - 1 ? (A.c2 || A.c1) : A.c1);
    }
    const hx = w * 0.32, hr = h * 0.42;
    if (A.mask) mask(ctx, hx + 2, -hr, hr * 0.85, A);
    else eye(ctx, hx + hr * 0.3, -hr * 1.1, Math.max(2, hr * 0.2), A.eye || '#fff', !!A.glow);
    if (A.spikes) spikesArc(ctx, 0, -h * 0.4, w * 0.35, h * 0.4, Math.PI * 1.1, Math.PI * 1.9, 4, h * 0.3, A.c2 || A.c1);
  },

  beetle(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 10;
    legs(ctx, 3, w * 0.6, -h * 0.3, h * 0.3, ph, 2);
    // shell
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -h * 0.3);
    ctx.quadraticCurveTo(-w * 0.48, -h * 1.05, w * 0.05, -h * 0.98);
    ctx.quadraticCurveTo(w * 0.4, -h * 0.9, w * 0.36, -h * 0.3);
    ctx.closePath();
    fillInk(ctx, A.c1);
    ctx.strokeStyle = A.c2 || 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-w * 0.1, -h * 0.95); ctx.quadraticCurveTo(-w * 0.05, -h * 0.6, -w * 0.15, -h * 0.32); ctx.stroke();
    // head
    ctx.beginPath(); ctx.ellipse(w * 0.4, -h * 0.42, w * 0.17, h * 0.22, 0, 0, TAU);
    fillInk(ctx, A.c3 || A.c1);
    if (A.horn) {
      ctx.beginPath(); ctx.moveTo(w * 0.45, -h * 0.55); ctx.quadraticCurveTo(w * 0.65, -h * (0.7 + A.horn * 0.15), w * 0.58, -h * (0.95 + A.horn * 0.2));
      ctx.quadraticCurveTo(w * 0.55, -h * 0.7, w * 0.36, -h * 0.58); fillInk(ctx, A.c3 || '#efe8d8', 1.5);
    }
    eye(ctx, w * 0.47, -h * 0.45, Math.max(1.8, h * 0.07), A.eye || '#fff', !!A.glow);
    if (A.spikes) spikesArc(ctx, -w * 0.05, -h * 0.35, w * 0.42, h * 0.62, Math.PI * 1.05, Math.PI * 1.85, 5, h * 0.22, A.c2 || A.c1);
  },

  slug(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 5;
    const st = Math.sin(ph) * 0.06;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, 0);
    ctx.quadraticCurveTo(-w * 0.45, -h * 0.5, 0, -h * (0.55 + st));
    ctx.quadraticCurveTo(w * 0.45, -h * 0.9, w * 0.5, -h * 0.25);
    ctx.lineTo(w * 0.5, 0); ctx.closePath();
    fillInk(ctx, A.c1);
    // eyestalks
    ink(ctx, 1.8);
    for (const s of [0, 1]) {
      const bx = w * (0.38 + s * 0.08), tx = bx + 4 + s * 3, ty = -h * (1.05 + Math.sin(ph + s) * 0.05);
      ctx.beginPath(); ctx.moveTo(bx, -h * 0.6); ctx.lineTo(tx, ty); ctx.stroke();
      eye(ctx, tx, ty, 2.4, A.eye || '#fff', !!A.glow);
    }
    if (A.shell) {
      ctx.beginPath(); ctx.arc(-w * 0.08, -h * 0.65, h * 0.48, 0, TAU);
      fillInk(ctx, A.c2 || '#b39a7a');
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let a = 0; a < 10; a += 0.2) ctx.lineTo(-w * 0.08 + Math.cos(a) * a * h * 0.045, -h * 0.65 + Math.sin(a) * a * h * 0.045);
      ctx.stroke();
    }
  },

  moth(ctx, e, t, A) {
    const w = e.w, h = e.h;
    const flap = Math.sin(e.anim * 14) * 0.5 + 0.5;
    wings(ctx, -w * 0.05, -h * 0.05, w * 0.9, h * 1.0, flap, A.c2 || A.c1, 0.9, A.wing || 'moth');
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.22, h * 0.36, 0.15, 0, TAU);
    fillInk(ctx, A.c1);
    ctx.beginPath(); ctx.arc(w * 0.18, -h * 0.25, w * 0.15, 0, TAU);
    fillInk(ctx, A.c3 || A.c1);
    ink(ctx, 1.4);
    ctx.beginPath(); ctx.moveTo(w * 0.22, -h * 0.36); ctx.quadraticCurveTo(w * 0.3, -h * 0.65, w * 0.42, -h * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.15, -h * 0.38); ctx.quadraticCurveTo(w * 0.15, -h * 0.7, w * 0.26, -h * 0.72); ctx.stroke();
    eye(ctx, w * 0.24, -h * 0.25, Math.max(2, w * 0.06), A.eye || '#fff', !!A.glow);
  },

  fly(ctx, e, t, A) {
    const w = e.w, h = e.h;
    const flap = Math.sin(e.anim * 40) * 0.5 + 0.5;
    wings(ctx, -w * 0.05, -h * 0.2, w * 0.7, h * 0.8, flap, 'rgba(230,240,255,0.6)', 0.7, 'fly');
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.4, h * 0.34, 0, 0, TAU);
    fillInk(ctx, A.c1);
    if (A.stinger) { ctx.beginPath(); ctx.moveTo(-w * 0.38, -2); ctx.lineTo(-w * 0.62, 2); ctx.lineTo(-w * 0.36, 4); fillInk(ctx, A.c2 || '#ddd', 1.4); }
    if (A.c2) { ctx.strokeStyle = A.c2; ctx.lineWidth = 2; for (const k of [-0.1, 0.12]) { ctx.beginPath(); ctx.moveTo(w * k, -h * 0.3); ctx.lineTo(w * k, h * 0.3); ctx.stroke(); } }
    eye(ctx, w * 0.25, -h * 0.06, Math.max(2, h * 0.14), A.eye || '#ff9b7a', !!A.glow);
  },

  spider(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 12;
    ink(ctx, 2);
    for (let i = 0; i < 4; i++) {
      for (const s of [-1, 1]) {
        const bx = s * w * 0.1, by = -h * 0.45;
        const sw = Math.sin(ph + i * 1.5 + (s > 0 ? 1 : 0)) * 3;
        const kx = s * w * (0.3 + i * 0.05), ky = -h * (0.8 - i * 0.05);
        const fx = s * w * (0.32 + i * 0.07) + sw, fy = 0;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
      }
    }
    ctx.beginPath(); ctx.ellipse(-w * 0.12, -h * 0.55, w * 0.26, h * 0.3, 0, 0, TAU);
    fillInk(ctx, A.c1);
    ctx.beginPath(); ctx.ellipse(w * 0.15, -h * 0.45, w * 0.16, h * 0.2, 0, 0, TAU);
    fillInk(ctx, A.c3 || A.c1);
    if (A.c2) { ctx.fillStyle = A.c2; ctx.beginPath(); ctx.arc(-w * 0.14, -h * 0.6, w * 0.08, 0, TAU); ctx.fill(); }
    for (let i = 0; i < (A.eyes || 2); i++) eye(ctx, w * 0.2 + (i % 2) * 4, -h * 0.5 + Math.floor(i / 2) * 3 - 1, 1.6, A.eye || '#ff6a5a', !!A.glow);
  },

  jelly(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 3;
    const pulse = 1 + Math.sin(ph * 2) * 0.08;
    ctx.globalAlpha = 0.9;
    ink(ctx, 1.5);
    for (let i = 0; i < 5; i++) {
      const x = -w * 0.3 + i * w * 0.15;
      ctx.strokeStyle = A.c2 || A.c1;
      ctx.beginPath(); ctx.moveTo(x, h * 0.05);
      ctx.bezierCurveTo(x + Math.sin(ph + i) * 6, h * 0.3, x - Math.sin(ph + i) * 6, h * 0.5, x + Math.sin(ph * 1.3 + i) * 4, h * 0.65);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.05, w * 0.48 * pulse, h * 0.42 / pulse, 0, Math.PI, 0);
    ctx.quadraticCurveTo(0, h * 0.18, -w * 0.48 * pulse, -h * 0.05);
    const g = ctx.createRadialGradient(0, -h * 0.2, 2, 0, -h * 0.1, w * 0.5);
    g.addColorStop(0, A.c3 || '#ffffff'); g.addColorStop(1, A.c1);
    fillInk(ctx, g, 1.8);
    ctx.globalAlpha = 1;
    eye(ctx, w * 0.12, -h * 0.18, 2.2, A.eye || INK, !!A.glow);
    eye(ctx, -w * 0.08, -h * 0.18, 2.2, A.eye || INK, !!A.glow);
  },

  // husk-like masked bug, optionally armed
  knight(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 9;
    const walk = Math.sin(ph) * 2;
    ink(ctx, 2.5);
    ctx.beginPath(); ctx.moveTo(-w * 0.15, -h * 0.25); ctx.lineTo(-w * 0.18 + walk, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.12, -h * 0.25); ctx.lineTo(w * 0.15 - walk, 0); ctx.stroke();
    // cloak/body
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, -h * 0.2);
    ctx.quadraticCurveTo(-w * 0.45, -h * 0.65, -w * 0.15, -h * 0.72);
    ctx.lineTo(w * 0.2, -h * 0.72);
    ctx.quadraticCurveTo(w * 0.42, -h * 0.55, w * 0.32, -h * 0.18);
    ctx.quadraticCurveTo(0, -h * 0.1, -w * 0.35, -h * 0.2);
    fillInk(ctx, A.c1);
    // weapon
    if (A.weapon) {
      const atk = e.state === 'attack' ? 1 : e.state === 'tele' ? -0.6 : 0;
      ctx.save(); ctx.translate(w * 0.25, -h * 0.45); ctx.rotate(-0.6 + atk * 1.2);
      if (A.weapon === 'spear') { ink(ctx, 2.5); ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(w * 0.9, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(w * 0.9, -4); ctx.lineTo(w * 1.1, 0); ctx.lineTo(w * 0.9, 4); fillInk(ctx, A.c2 || '#ddd', 1.5); }
      else if (A.weapon === 'shield') { ctx.rotate(0.6 - atk * 1.2); ctx.beginPath(); ctx.ellipse(4, 2, w * 0.12, h * 0.32, 0, 0, TAU); fillInk(ctx, A.c2 || '#998', 2); }
      else { ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(w * 0.6, -1); ctx.lineTo(w * 0.62, 2); ctx.lineTo(0, 3); fillInk(ctx, A.c2 || '#e0dccf', 1.5); }
      ctx.restore();
    }
    // horns + mask
    const hy = -h * 0.8;
    if (A.horns !== 0) {
      ctx.beginPath();
      ctx.moveTo(-w * 0.12, hy - h * 0.1); ctx.quadraticCurveTo(-w * 0.22, hy - h * 0.32, -w * 0.08, hy - h * 0.4);
      ctx.quadraticCurveTo(-w * 0.08, hy - h * 0.25, -w * 0.02, hy - h * 0.12);
      ctx.moveTo(w * 0.14, hy - h * 0.1); ctx.quadraticCurveTo(w * 0.26, hy - h * 0.32, w * 0.12, hy - h * 0.4);
      ctx.quadraticCurveTo(w * 0.12, hy - h * 0.25, w * 0.06, hy - h * 0.12);
      fillInk(ctx, A.c3 || '#efe8d8', 1.5);
    }
    mask(ctx, w * 0.02, hy, Math.min(w, h) * 0.2, A);
  },

  snail(ctx, e, t, A) { PAINTERS.slug(ctx, e, t, Object.assign({}, A, { shell: true })); },

  hopper(ctx, e, t, A) {
    const w = e.w, h = e.h;
    const crouch = e.state === 'tele' ? 0.75 : e.grounded === false ? 1.1 : 1;
    ink(ctx, 2.2);
    ctx.beginPath(); ctx.moveTo(-w * 0.25, -h * 0.25); ctx.quadraticCurveTo(-w * 0.5, -h * 0.4 * crouch, -w * 0.4, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.2, -h * 0.25); ctx.lineTo(w * 0.28, 0); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -h * 0.45 * crouch, w * 0.42, h * 0.38 * crouch, -0.15, 0, TAU);
    fillInk(ctx, A.c1);
    ctx.beginPath(); ctx.ellipse(-w * 0.05, -h * 0.35 * crouch, w * 0.3, h * 0.18, -0.1, 0, Math.PI);
    ctx.fillStyle = A.c2 || 'rgba(255,255,255,0.2)'; ctx.fill();
    for (const s of [0, 1]) {
      ctx.beginPath(); ctx.arc(w * (0.18 + s * 0.16), -h * 0.78 * crouch, w * 0.1, 0, TAU);
      fillInk(ctx, A.c3 || '#efe8d8', 1.6);
      eye(ctx, w * (0.2 + s * 0.16), -h * 0.78 * crouch, w * 0.05, INK);
    }
  },

  worm(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 6;
    const up = e.emerge ?? 1;
    ctx.save();
    ctx.beginPath(); ctx.rect(-w, -h * 2, w * 2, h * 2); ctx.clip();
    const segs = 6;
    for (let i = segs - 1; i >= 0; i--) {
      const k = i / (segs - 1);
      const y = -h * k * up;
      const x = Math.sin(ph + k * 3) * w * 0.12;
      const r = w * (0.42 - k * 0.12);
      ctx.beginPath(); ctx.arc(x, y - r * 0.5, r, 0, TAU);
      fillInk(ctx, i % 2 ? A.c1 : (A.c2 || A.c1));
    }
    const hx = Math.sin(ph + 3) * w * 0.12, hy = -h * up - w * 0.15;
    // jaws
    ctx.beginPath(); ctx.moveTo(hx - w * 0.3, hy); ctx.lineTo(hx - w * 0.1, hy - w * 0.45); ctx.lineTo(hx, hy - w * 0.1);
    ctx.lineTo(hx + w * 0.1, hy - w * 0.45); ctx.lineTo(hx + w * 0.3, hy); fillInk(ctx, A.c3 || '#efe8d8', 1.5);
    eye(ctx, hx - w * 0.12, hy + 2, 2.4, A.eye || '#ff8a5a', true);
    eye(ctx, hx + w * 0.12, hy + 2, 2.4, A.eye || '#ff8a5a', true);
    ctx.restore();
  },

  shroom(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 8;
    const sq = e.state === 'tele' ? 0.8 : 1 + Math.sin(ph) * 0.04;
    ink(ctx, 2);
    ctx.beginPath(); ctx.moveTo(-w * 0.12, -h * 0.05); ctx.lineTo(-w * 0.16 + Math.sin(ph) * 2, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.12, -h * 0.05); ctx.lineTo(w * 0.16 - Math.sin(ph) * 2, 0); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-w * 0.2, -h * 0.55 * sq, w * 0.4, h * 0.5 * sq, 6);
    fillInk(ctx, A.c3 || '#e8dcc6');
    ctx.beginPath(); ctx.ellipse(0, -h * 0.55 * sq, w * 0.5, h * 0.4, 0, Math.PI, 0);
    ctx.quadraticCurveTo(0, -h * 0.45 * sq, -w * 0.5, -h * 0.55 * sq);
    fillInk(ctx, A.c1);
    ctx.fillStyle = A.c2 || 'rgba(255,255,255,0.5)';
    for (const [x, y, r] of [[-0.2, -0.75, 0.07], [0.15, -0.82, 0.05], [0.28, -0.62, 0.04]]) { ctx.beginPath(); ctx.arc(w * x, h * y * sq, w * r, 0, TAU); ctx.fill(); }
    eye(ctx, w * 0.08, -h * 0.35 * sq, 2.2, INK); eye(ctx, -w * 0.06, -h * 0.35 * sq, 2.2, INK);
  },

  crystal(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 10;
    legs(ctx, 3, w * 0.7, -h * 0.25, h * 0.25, ph, 2);
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, -h * 0.25); ctx.lineTo(-w * 0.3, -h * 0.6); ctx.lineTo(w * 0.3, -h * 0.6); ctx.lineTo(w * 0.45, -h * 0.25); ctx.closePath();
    fillInk(ctx, A.c1);
    const n = A.n || 3;
    for (let i = 0; i < n; i++) {
      const x = -w * 0.25 + (i / Math.max(1, n - 1)) * w * 0.5;
      const ht = h * (0.45 + ((i * 37) % 10) / 25);
      ctx.beginPath(); ctx.moveTo(x - w * 0.08, -h * 0.58); ctx.lineTo(x + (i - 1) * 3, -h * 0.58 - ht); ctx.lineTo(x + w * 0.08, -h * 0.58); ctx.closePath();
      fillInk(ctx, A.c2 || '#ffd0f2', 1.5);
    }
    eye(ctx, w * 0.3, -h * 0.42, 2.2, A.eye || '#fff', true);
  },

  gear(ctx, e, t, A) {
    const w = e.w, h = e.h, r = Math.min(w, h) * 0.45;
    const rot = e.anim * (A.spin || 2);
    ctx.save(); ctx.translate(0, A.centered ? 0 : -r); ctx.rotate(rot);
    ctx.beginPath();
    const teeth = A.teeth || 8;
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * TAU;
      const rr = i % 2 ? r * 0.82 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); fillInk(ctx, A.c1);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, TAU); fillInk(ctx, A.c2 || '#3a2a1a', 1.5);
    ctx.restore();
    eye(ctx, 0, A.centered ? 0 : -r, r * 0.2, A.eye || '#ffb050', true);
  },

  fish(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 10;
    const tail = Math.sin(ph) * 0.4;
    ctx.save(); ctx.translate(-w * 0.4, 0); ctx.rotate(tail);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-w * 0.25, -h * 0.35); ctx.lineTo(-w * 0.2, 0); ctx.lineTo(-w * 0.25, h * 0.35); ctx.closePath();
    fillInk(ctx, A.c2 || A.c1, 1.5); ctx.restore();
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.45, h * 0.38, 0, 0, TAU);
    fillInk(ctx, A.c1);
    if (A.teeth) {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(w * (0.22 + i * 0.05), h * 0.05); ctx.lineTo(w * (0.24 + i * 0.05), h * 0.15); ctx.lineTo(w * (0.26 + i * 0.05), h * 0.05); ctx.fill(); }
    }
    if (A.lure) {
      ink(ctx, 1.4); ctx.beginPath(); ctx.moveTo(w * 0.2, -h * 0.3); ctx.quadraticCurveTo(w * 0.5, -h * 0.9, w * 0.6, -h * 0.5); ctx.stroke();
      eye(ctx, w * 0.6, -h * 0.5, 3, A.c3 || '#bfe4ff', true);
    }
    eye(ctx, w * 0.25, -h * 0.1, Math.max(2, h * 0.1), A.eye || '#fff', !!A.glow);
  },

  bird(ctx, e, t, A) {
    const w = e.w, h = e.h;
    const flap = Math.sin(e.anim * 9) * 0.5 + 0.5;
    wings(ctx, -w * 0.05, -h * 0.05, w * 0.8, h * 0.9, flap, A.c2 || A.c1, 1, 'bat');
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.3, h * 0.3, 0.2, 0, TAU); fillInk(ctx, A.c1);
    ctx.beginPath(); ctx.moveTo(w * 0.25, -h * 0.12); ctx.lineTo(w * 0.52, -h * 0.02); ctx.lineTo(w * 0.25, h * 0.06); fillInk(ctx, A.c3 || '#e8c070', 1.5);
    eye(ctx, w * 0.15, -h * 0.12, 2.4, A.eye || '#fff', !!A.glow);
  },

  bat(ctx, e, t, A) {
    const w = e.w, h = e.h;
    const flap = Math.sin(e.anim * 16) * 0.5 + 0.5;
    wings(ctx, 0, 0, w * 0.9, h * 0.8, flap, A.c2 || A.c1, 1, 'bat');
    ctx.beginPath(); ctx.arc(0, 0, w * 0.2, 0, TAU); fillInk(ctx, A.c1);
    ctx.beginPath(); ctx.moveTo(-w * 0.12, -w * 0.15); ctx.lineTo(-w * 0.08, -w * 0.32); ctx.lineTo(-w * 0.02, -w * 0.18);
    ctx.moveTo(w * 0.12, -w * 0.15); ctx.lineTo(w * 0.08, -w * 0.32); ctx.lineTo(w * 0.02, -w * 0.18); fillInk(ctx, A.c1, 1.4);
    eye(ctx, -w * 0.07, -w * 0.03, 1.8, A.eye || '#ff6a5a', true); eye(ctx, w * 0.07, -w * 0.03, 1.8, A.eye || '#ff6a5a', true);
  },

  wisp(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 6;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, w);
    g.addColorStop(0, A.c3 || '#ffffff'); g.addColorStop(0.4, A.c1); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.globalAlpha = e.alpha ?? 0.9;
    ctx.beginPath(); ctx.arc(0, 0, w, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-w * 0.4, 0);
    for (let i = 0; i <= 6; i++) ctx.lineTo(-w * 0.4 + i * w * 0.133, h * 0.5 + Math.sin(ph + i * 1.3) * h * 0.15 + (i % 2) * h * 0.15);
    ctx.lineTo(w * 0.4, 0); ctx.arc(0, 0, w * 0.4, 0, Math.PI, true);
    ctx.fillStyle = A.c1; ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    eye(ctx, -w * 0.13, -h * 0.05, 2.4, INK); eye(ctx, w * 0.13, -h * 0.05, 2.4, INK);
    ctx.globalAlpha = 1;
  },

  candle(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 9;
    ink(ctx, 2);
    ctx.beginPath(); ctx.moveTo(-w * 0.15, -h * 0.1); ctx.lineTo(-w * 0.2 + Math.sin(ph) * 2, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.15, -h * 0.1); ctx.lineTo(w * 0.2 - Math.sin(ph) * 2, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-w * 0.3, -h * 0.08); ctx.lineTo(-w * 0.28, -h * 0.75);
    ctx.quadraticCurveTo(-w * 0.1, -h * 0.68, 0, -h * 0.8); ctx.quadraticCurveTo(w * 0.15, -h * 0.7, w * 0.28, -h * 0.76);
    ctx.lineTo(w * 0.3, -h * 0.08); ctx.closePath();
    fillInk(ctx, A.c1 || '#e9d9b0');
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.moveTo(w * 0.1, -h * 0.75); ctx.quadraticCurveTo(w * 0.16, -h * 0.5, w * 0.08, -h * 0.4); ctx.lineTo(w * 0.14, -h * 0.74); ctx.fill();
    // flame
    const fh = h * 0.35 * (1 + Math.sin(ph * 2) * 0.1);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, -h * 0.85 - fh * 0.4, 0, 0, -h * 0.85 - fh * 0.4, fh * 1.6);
    g.addColorStop(0, A.c2 || '#ffcf7a'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -h * 0.85 - fh * 0.4, fh * 1.6, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = A.c2 || '#ffcf7a';
    ctx.beginPath(); ctx.moveTo(-w * 0.1, -h * 0.82); ctx.quadraticCurveTo(0, -h * 0.85 - fh * 1.3, w * 0.1, -h * 0.82); ctx.quadraticCurveTo(0, -h * 0.78, -w * 0.1, -h * 0.82); ctx.fill();
    eye(ctx, -w * 0.08, -h * 0.5, 2, INK); eye(ctx, w * 0.12, -h * 0.5, 2, INK);
  },

  skull(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 8;
    legs(ctx, 4, w * 0.7, -h * 0.2, h * 0.2, ph, 2.2);
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.55, w * 0.45, h * 0.42, 0, 0, TAU);
    fillInk(ctx, A.c1 || '#e6dcc4');
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(w * 0.12, -h * 0.58, w * 0.12, h * 0.14, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-w * 0.16, -h * 0.58, w * 0.11, h * 0.13, 0, 0, TAU); ctx.fill();
    ctx.fillRect(-w * 0.1, -h * 0.3, w * 0.25, 2);
    eye(ctx, w * 0.12, -h * 0.58, 1.8, A.eye || '#ffb85c', true);
    eye(ctx, -w * 0.16, -h * 0.58, 1.8, A.eye || '#ffb85c', true);
    if (A.horns) {
      ctx.beginPath(); ctx.moveTo(-w * 0.3, -h * 0.85); ctx.quadraticCurveTo(-w * 0.6, -h * 1.1, -w * 0.5, -h * 1.3); ctx.lineTo(-w * 0.2, -h * 0.92);
      ctx.moveTo(w * 0.3, -h * 0.85); ctx.quadraticCurveTo(w * 0.6, -h * 1.1, w * 0.5, -h * 1.3); ctx.lineTo(w * 0.2, -h * 0.92);
      fillInk(ctx, A.c2 || '#cfc3a6', 1.5);
    }
  },

  wasp(ctx, e, t, A) {
    const w = e.w, h = e.h;
    const flap = Math.sin(e.anim * 45) * 0.5 + 0.5;
    wings(ctx, -w * 0.05, -h * 0.25, w * 0.6, h * 0.7, flap, 'rgba(230,240,200,0.55)', 0.8, 'fly');
    ctx.beginPath(); ctx.ellipse(-w * 0.25, h * 0.05, w * 0.28, h * 0.28, 0.4, 0, TAU); fillInk(ctx, A.c2 || '#e8d24a');
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    for (const k of [-0.32, -0.18]) { ctx.beginPath(); ctx.moveTo(w * k, -h * 0.15); ctx.lineTo(w * (k - 0.05), h * 0.25); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-w * 0.48, h * 0.18); ctx.lineTo(-w * 0.65, h * 0.35); ctx.lineTo(-w * 0.42, h * 0.28); fillInk(ctx, '#efe8d8', 1.4);
    ctx.beginPath(); ctx.ellipse(w * 0.1, -h * 0.05, w * 0.16, h * 0.18, 0, 0, TAU); fillInk(ctx, A.c1);
    ctx.beginPath(); ctx.arc(w * 0.32, -h * 0.12, w * 0.14, 0, TAU); fillInk(ctx, A.c1);
    eye(ctx, w * 0.38, -h * 0.15, 2.4, A.eye || '#ff5a3a', true);
  },

  crab(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 12;
    legs(ctx, 4, w * 0.8, -h * 0.25, h * 0.25, ph, 2, 1.5);
    const snap = e.state === 'attack' ? 0.6 : 0;
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * w * 0.42, -h * 0.55); ctx.rotate(s * (-0.4 - snap));
      ctx.beginPath(); ctx.ellipse(0, -h * 0.15, w * 0.13, h * 0.2, 0, 0, TAU); fillInk(ctx, A.c2 || A.c1, 1.6);
      ctx.restore();
    }
    ctx.beginPath(); ctx.ellipse(0, -h * 0.45, w * 0.38, h * 0.3, 0, Math.PI, 0); ctx.lineTo(w * 0.38, -h * 0.35); ctx.quadraticCurveTo(0, -h * 0.2, -w * 0.38, -h * 0.35);
    fillInk(ctx, A.c1);
    ink(ctx, 1.6);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * w * 0.08, -h * 0.72); ctx.lineTo(s * w * 0.1, -h * 0.9); ctx.stroke(); eye(ctx, s * w * 0.1, -h * 0.92, 2.4, A.eye || '#fff', !!A.glow); }
  },

  mantis(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 8;
    ink(ctx, 2.2);
    ctx.beginPath(); ctx.moveTo(-w * 0.1, -h * 0.35); ctx.lineTo(-w * 0.25 + Math.sin(ph) * 2, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.05, -h * 0.35); ctx.lineTo(w * 0.15 - Math.sin(ph) * 2, 0); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-w * 0.15, -h * 0.4, w * 0.3, h * 0.1, -0.3, 0, TAU); fillInk(ctx, A.c1);
    ctx.beginPath(); ctx.moveTo(0, -h * 0.45); ctx.quadraticCurveTo(w * 0.15, -h * 0.65, w * 0.12, -h * 0.85); ink(ctx, 6); ctx.stroke();
    ctx.strokeStyle = A.c1; ctx.lineWidth = 3.5; ctx.stroke();
    // blades
    const atk = e.state === 'attack' ? 1 : e.state === 'tele' ? -0.4 : 0;
    ctx.save(); ctx.translate(w * 0.12, -h * 0.72); ctx.rotate(0.3 + atk * 1.1);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.35, -h * 0.05); ctx.quadraticCurveTo(w * 0.5, h * 0.1, w * 0.3, h * 0.25); ctx.lineTo(w * 0.25, h * 0.05); ctx.closePath();
    fillInk(ctx, A.c2 || '#e8e0cc', 1.5); ctx.restore();
    ctx.beginPath(); ctx.moveTo(w * 0.05, -h * 0.85); ctx.lineTo(w * 0.28, -h * 0.9); ctx.lineTo(w * 0.15, -h * 1.0); ctx.closePath();
    fillInk(ctx, A.c3 || A.c1, 1.6);
    eye(ctx, w * 0.18, -h * 0.92, 2, A.eye || '#fff', !!A.glow);
  },

  golem(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 5;
    const step = Math.sin(ph) * 3;
    ctx.beginPath(); ctx.roundRect(-w * 0.35, -h * 0.25 + Math.max(0, step), w * 0.22, h * 0.25 - Math.max(0, step), 4); fillInk(ctx, A.c2 || A.c1);
    ctx.beginPath(); ctx.roundRect(w * 0.1, -h * 0.25 + Math.max(0, -step), w * 0.22, h * 0.25 - Math.max(0, -step), 4); fillInk(ctx, A.c2 || A.c1);
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, -h * 0.25); ctx.lineTo(-w * 0.5, -h * 0.7); ctx.quadraticCurveTo(-w * 0.3, -h * 1.0, w * 0.1, -h * 0.98);
    ctx.quadraticCurveTo(w * 0.5, -h * 0.9, w * 0.48, -h * 0.45); ctx.lineTo(w * 0.4, -h * 0.25); ctx.closePath();
    fillInk(ctx, A.c1, 2.5);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-w * 0.2, -h * 0.9); ctx.lineTo(-w * 0.05, -h * 0.6); ctx.lineTo(-w * 0.25, -h * 0.4); ctx.stroke();
    const tele = e.state === 'tele';
    eye(ctx, w * 0.25, -h * 0.72, tele ? 5 : 3.5, A.eye || '#ff8a3d', true, 'angry');
  },

  bell(ctx, e, t, A) {
    const w = e.w, h = e.h, sw = Math.sin(e.anim * 4) * 0.15;
    ctx.save(); ctx.rotate(sw);
    ctx.beginPath();
    ctx.moveTo(-w * 0.2, -h * 0.95);
    ctx.quadraticCurveTo(-w * 0.35, -h * 0.5, -w * 0.5, -h * 0.1);
    ctx.lineTo(w * 0.5, -h * 0.1);
    ctx.quadraticCurveTo(w * 0.35, -h * 0.5, w * 0.2, -h * 0.95); ctx.closePath();
    fillInk(ctx, A.c1);
    ctx.strokeStyle = A.c2 || '#fff1c0'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-w * 0.42, -h * 0.22); ctx.lineTo(w * 0.42, -h * 0.22); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -h * 0.05, w * 0.1, 0, TAU); fillInk(ctx, A.c2 || '#fff1c0', 1.5);
    ctx.restore();
    eye(ctx, -w * 0.12, -h * 0.55, 2.4, A.eye || '#fff', true); eye(ctx, w * 0.12, -h * 0.55, 2.4, A.eye || '#fff', true);
  },

  book(ctx, e, t, A) {
    const w = e.w, h = e.h;
    const flap = Math.sin(e.anim * 10) * 0.6;
    for (const s of [-1, 1]) {
      ctx.save(); ctx.rotate(s * (0.3 + flap * 0.5) * (s > 0 ? 1 : 1));
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * w * 0.48, -h * 0.15); ctx.lineTo(s * w * 0.48, h * 0.35); ctx.lineTo(0, h * 0.45); ctx.closePath();
      fillInk(ctx, A.c1, 1.8);
      ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(s * w * 0.42, -h * 0.12); ctx.lineTo(s * w * 0.42, h * 0.3); ctx.lineTo(0, h * 0.4);
      ctx.fillStyle = A.c3 || '#efe6cf'; ctx.fill();
      ctx.strokeStyle = 'rgba(40,30,30,0.4)'; ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(s * 5, h * (0.02 + k * 0.1)); ctx.lineTo(s * w * 0.35, h * (-0.05 + k * 0.1)); ctx.stroke(); }
      ctx.restore();
    }
    eye(ctx, 0, h * 0.12, 3, A.eye || '#e7c96a', true, 'slit');
  },

  spool(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 8;
    legs(ctx, 2, w * 0.4, -h * 0.15, h * 0.15, ph, 2.2);
    ctx.beginPath(); ctx.roundRect(-w * 0.32, -h * 0.85, w * 0.64, h * 0.12, 3); fillInk(ctx, A.c2 || '#8a6a4a');
    ctx.beginPath(); ctx.roundRect(-w * 0.32, -h * 0.28, w * 0.64, h * 0.12, 3); fillInk(ctx, A.c2 || '#8a6a4a');
    ctx.beginPath(); ctx.rect(-w * 0.24, -h * 0.73, w * 0.48, h * 0.45); fillInk(ctx, A.c1);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    for (let y = -h * 0.7; y < -h * 0.3; y += 3) { ctx.beginPath(); ctx.moveTo(-w * 0.24, y); ctx.lineTo(w * 0.24, y + 1.5); ctx.stroke(); }
    eye(ctx, w * 0.05, -h * 0.52, 2.4, A.eye || '#fff', !!A.glow); eye(ctx, w * 0.17, -h * 0.52, 2.4, A.eye || '#fff', !!A.glow);
    ctx.strokeStyle = A.c1; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-w * 0.24, -h * 0.6); ctx.quadraticCurveTo(-w * 0.5, -h * 0.5 + Math.sin(ph) * 3, -w * 0.6, -h * 0.2); ctx.stroke();
  },

  eyeball(ctx, e, t, A) {
    const w = e.w, h = e.h, r = Math.min(w, h) * 0.45;
    ink(ctx, 1.5);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + e.anim;
      ctx.strokeStyle = A.c2 || A.c1;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.quadraticCurveTo(Math.cos(a + 0.4) * r * 1.5, Math.sin(a + 0.4) * r * 1.5, Math.cos(a + 0.2) * r * 1.8, Math.sin(a + 0.2) * r * 1.8);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); fillInk(ctx, A.c3 || '#efe8d8');
    const p = e.game.player, a = Math.atan2(p.cy - e.cy, (p.cx - e.cx) * (e.facing || 1));
    const tele = e.state === 'tele';
    ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4, r * 0.45, 0, TAU); ctx.fillStyle = A.c1; ctx.fill();
    eye(ctx, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * (tele ? 0.3 : 0.18), tele ? '#fff' : INK, tele);
  },

  flower(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 3;
    ink(ctx, 3);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.sin(ph) * 6, -h * 0.4, 0, -h * 0.6); ctx.stroke();
    ctx.strokeStyle = A.c3 || '#4a7a3a'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-w * 0.2, -h * 0.25, w * 0.18, h * 0.06, 0.5, 0, TAU); fillInk(ctx, A.c3 || '#4a7a3a', 1.4);
    const open = e.state === 'tele' ? 1.3 : e.state === 'attack' ? 1.5 : 1;
    ctx.save(); ctx.translate(0, -h * 0.68);
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.rotate((i / 6) * TAU + ph * 0.2);
      ctx.beginPath(); ctx.ellipse(w * 0.2 * open, 0, w * 0.2 * open, w * 0.09, 0, 0, TAU); fillInk(ctx, A.c1, 1.5);
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, w * 0.14, 0, TAU); fillInk(ctx, A.c2 || '#ffe27a', 1.5);
    ctx.restore();
    eye(ctx, 0, -h * 0.68, 2.6, INK);
  },

  yarn(ctx, e, t, A) {
    const w = e.w, h = e.h, r = Math.min(w, h) * 0.45;
    const rot = e.anim * 3;
    ctx.save(); ctx.translate(0, A.centered ? 0 : -r);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); fillInk(ctx, A.c1);
    ctx.save(); ctx.clip(); ctx.rotate(rot);
    ctx.strokeStyle = A.c2 || 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.4;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, r * 1.2, r * 0.25 + Math.abs(i) * 2, i * 0.5, 0, TAU); ctx.stroke(); }
    ctx.restore();
    ink(ctx, 2); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = A.c1; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.6); ctx.bezierCurveTo(-r * 1.4, r * 0.8, -r * 1.2, r * 1.3, -r * 1.8, r * 1.1 + Math.sin(e.anim * 6) * 3); ctx.stroke();
    eye(ctx, r * 0.15, -r * 0.1, Math.max(2, r * 0.16), A.eye || '#fff', !!A.glow);
    eye(ctx, r * 0.5, -r * 0.1, Math.max(2, r * 0.16), A.eye || '#fff', !!A.glow);
    ctx.restore();
  },

  // A rival ball creature (rollers) — evil little beads
  ball(ctx, e, t, A) {
    const r = Math.min(e.w, e.h) * 0.5;
    ctx.save(); ctx.translate(0, A.centered ? 0 : -r);
    ctx.save(); ctx.rotate(e.roll || 0);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); fillInk(ctx, A.c1);
    ctx.strokeStyle = A.c2 || 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
    if (A.spikes) spikesArc(ctx, 0, 0, r, r, 0, TAU, 8, r * 0.4, A.c2 || A.c1);
    ctx.restore();
    eye(ctx, r * 0.3, -r * 0.2, Math.max(2, r * 0.2), A.eye || '#ff5a4a', true, 'angry');
    ctx.restore();
  },

  icicle(ctx, e, t, A) {
    const w = e.w, h = e.h;
    ctx.beginPath(); ctx.moveTo(-w * 0.4, -h); ctx.lineTo(w * 0.4, -h); ctx.lineTo(0, 0); ctx.closePath();
    ctx.globalAlpha = 0.9; fillInk(ctx, A.c1 || '#bfe9ff', 1.6); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-w * 0.2, -h * 0.9); ctx.lineTo(-w * 0.02, -h * 0.2); ctx.stroke();
    eye(ctx, -w * 0.1, -h * 0.75, 2, A.eye || '#2a6aa0'); eye(ctx, w * 0.1, -h * 0.75, 2, A.eye || '#2a6aa0');
  },

  // big mossy furball with a pale mask: generic "beast"
  beast(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = e.anim * 7;
    legs(ctx, 4, w * 0.7, -h * 0.25, h * 0.25, ph, 3);
    ctx.beginPath();
    const n = 18;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI;
      const r = i % 2 ? 1 : 1.08;
      ctx.lineTo(Math.cos(a) * w * 0.5 * r, -h * 0.3 + Math.sin(a) * h * 0.65 * r);
    }
    ctx.quadraticCurveTo(0, -h * 0.15, -w * 0.5, -h * 0.3);
    fillInk(ctx, A.c1);
    mask(ctx, w * 0.32, -h * 0.55, Math.min(w, h) * 0.2, A);
  },
};

// Register a new creature body painter (used by boss minions etc.)
export function registerPainter(name, fn) { PAINTERS[name] = fn; }

// Draw an enemy through its painter with hurt flash + facing + scale
export function drawCreature(ctx, e, t) {
  const A = e.art;
  const P = PAINTERS[A.body] || PAINTERS.mite;
  ctx.save();
  const centered = A.centered;
  ctx.translate(Math.round(e.cx), Math.round(centered ? e.cy : e.y + e.h));
  if (e.rot) ctx.rotate(e.rot);
  ctx.scale(e.facing || 1, e.flipY ? -1 : 1);
  if (A.scale) ctx.scale(A.scale, A.scale);
  if (e.alpha !== undefined && A.body !== 'wisp') ctx.globalAlpha = e.alpha;
  P(ctx, e, t, A);
  ctx.restore();
  if (e.flashT > 0) {
    // white hurt flash drawn as an additive silhouette pass
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, e.flashT / 0.1) * 0.75;
    ctx.translate(Math.round(e.cx), Math.round(centered ? e.cy : e.y + e.h));
    if (e.rot) ctx.rotate(e.rot);
    ctx.scale(e.facing || 1, e.flipY ? -1 : 1);
    if (A.scale) ctx.scale(A.scale, A.scale);
    P(ctx, e, t, Object.assign({}, A, { c1: '#ffffff', c2: '#ffffff', c3: '#ffffff' }));
    ctx.restore();
  }
}
