// Procedural parallax backgrounds per area, painted once and cached.
import { VIEW_W, VIEW_H } from '../core/constants.js';
import { rng, hashStr, TAU } from '../core/math.js';
import { rgba, mix } from './palettes.js';

const LAYER_W = 1800, LAYER_H = 1000;
const cache = new Map();

// layer depth 0 (far) .. 2 (near)
const PARALLAX = [0.12, 0.3, 0.55];

export function getBackground(area, style) {
  const key = area + ':' + style.bg;
  if (cache.has(key)) return cache.get(key);
  const layers = [0, 1, 2].map((d) => paintLayer(style, d, hashStr(key) + d * 101));
  const bg = { layers, style };
  cache.set(key, bg);
  return bg;
}

export function drawBackground(ctx, bg, camX, camY, roomW, roomH, time) {
  const st = bg.style;
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, mix(st.sky[0], st.sky[1], 0.25)); g.addColorStop(1, mix(st.sky[1], '#000000', 0.3));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // soft, feathered light shafts (pre-painted, blurred streaks rather than hard polygons)
  const shaft = shaftSprite(st.light);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const sx = ((i * 521 - camX * 0.08) % (VIEW_W + 500) + VIEW_W + 500) % (VIEW_W + 500) - 300;
    ctx.globalAlpha = 0.45 + 0.35 * Math.sin(time * 0.25 + i * 1.9);
    ctx.drawImage(shaft, sx, -20);
  }
  ctx.restore();
  for (let d = 0; d < 3; d++) {
    const L = bg.layers[d];
    const p = PARALLAX[d];
    const maxY = Math.max(0, roomH - VIEW_H);
    const ty = maxY > 0 ? (camY / maxY) : 0.5;
    const ox = -((camX * p) % LAYER_W);
    const oy = -(LAYER_H - VIEW_H) * (0.3 + 0.4 * ty * Math.min(1, p * 2));
    for (let x = ox - LAYER_W; x < VIEW_W; x += LAYER_W) {
      if (x + LAYER_W < 0) continue;
      ctx.drawImage(L, Math.round(x), Math.round(oy));
    }
    // thin fog between layers (thicker behind the far layer)
    ctx.globalAlpha = d === 0 ? 0.8 : 0.35;
    ctx.fillStyle = st.fog;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
  }
}

function paintLayer(style, depth, seed) {
  const cv = document.createElement('canvas');
  cv.width = LAYER_W; cv.height = LAYER_H;
  const ctx = cv.getContext('2d');
  const R = rng(seed);
  const haze = mix(style.sky[0], style.sky[1], 0.35);
  const col = depth === 0 ? mix(haze, style.rock, 0.28) : depth === 1 ? mix(style.sky[1], style.rock, 0.55) : mix(style.sky[1], style.rock, 0.86);
  const hi = rgba(mix(style.sky[0], style.rim, 0.25 + depth * 0.15), 0.25 + depth * 0.1);
  const P = PAINTERS[style.bg] || PAINTERS.threadcave;
  // wrap: draw everything three times shifted so the strip tiles seamlessly
  for (const shift of [-LAYER_W, 0, LAYER_W]) {
    ctx.save();
    ctx.translate(shift, 0);
    const R2 = rng(seed);
    P(ctx, R2, depth, col, hi, style);
    ctx.restore();
  }
  // floor and ceiling masses for all layers
  for (const shift of [-LAYER_W, 0, LAYER_W]) {
    ctx.save(); ctx.translate(shift, 0);
    const R3 = rng(seed + 5);
    massEdge(ctx, R3, col, LAYER_H - 60 - depth * 50, 1, depth);
    if (style.bg !== 'clouds' && style.bg !== 'moonsky' && style.bg !== 'town' && style.bg !== 'dunes')
      massEdge(ctx, R3, col, 40 + depth * 40, -1, depth);
    ctx.restore();
  }
  return painterly(cv, style, depth, seed);
}

// Turn a flat silhouette layer into something that reads as painted: torn/brushed edges,
// dry-brush streaks of light and shade over the shapes, and depth-of-field blur on far layers.
function painterly(cv, style, depth, seed) {
  if (typeof document === 'undefined' || !document.getElementById('rough')) return cv;
  const R = rng(seed + 77);
  const W = cv.width, H = cv.height;
  const a = document.createElement('canvas'); a.width = W; a.height = H;
  const c = a.getContext('2d');
  c.filter = 'url(#rough)';
  c.drawImage(cv, 0, 0);
  c.filter = 'none';
  // dry-brush streaks, only on painted pixels
  c.globalCompositeOperation = 'source-atop';
  const n = 260;
  for (let i = 0; i < n; i++) {
    const x = R() * W, y = R() * H, len = 30 + R() * 160, ang = -0.25 + R() * 0.5 + (R() < 0.3 ? Math.PI / 2 : 0);
    const light = R() < 0.45;
    c.strokeStyle = light ? rgba(mix(style.rim, style.rock, 0.5), 0.03 + R() * 0.05) : 'rgba(0,0,0,0.14)';
    c.lineWidth = 2 + R() * 9;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y);
    c.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 + (R() - 0.5) * 20, y + Math.sin(ang) * len * 0.5 + (R() - 0.5) * 20, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    c.stroke();
  }
  // pale rim-light along the tops of shapes, brushed on unevenly
  c.globalCompositeOperation = 'source-over';
  const b = document.createElement('canvas'); b.width = W; b.height = H;
  const bc = b.getContext('2d');
  const blur = [3.2, 1.6, 0.6][depth];
  bc.filter = `blur(${blur}px)`;
  bc.drawImage(a, 0, 0);
  return b;
}

function massEdge(ctx, R, col, baseY, dir, depth) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, dir > 0 ? LAYER_H : 0);
  let y = baseY;
  for (let x = 0; x <= LAYER_W; x += 30) {
    y = baseY + Math.sin(x * 0.004 + depth) * 40 + Math.sin(x * 0.017 + depth * 3) * 14;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(LAYER_W, dir > 0 ? LAYER_H : 0);
  ctx.fill();
}

const shafts = new Map();
function shaftSprite(color) {
  if (shafts.has(color)) return shafts.get(color);
  const w = 380, h = VIEW_H + 40;
  const raw = document.createElement('canvas'); raw.width = w; raw.height = h;
  const c = raw.getContext('2d');
  const R = rng(hashStr(color));
  for (let i = 0; i < 14; i++) {
    const x0 = 60 + R() * 90, spread = 120 + R() * 140, wid = 6 + R() * 26;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, color); g.addColorStop(0.7, color.replace(/[\d.]+\)$/, '0.02)')); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + wid, 0); c.lineTo(x0 + spread + wid * 2, h); c.lineTo(x0 + spread, h); c.fill();
  }
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const o = out.getContext('2d');
  o.filter = 'blur(14px)';
  o.drawImage(raw, 0, 0);
  shafts.set(color, out);
  return out;
}

// ---------- shape primitives ----------
function pillar(ctx, x, w, top, bot, col, hi) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, bot);
  ctx.lineTo(x - w / 2 * 0.85, top);
  ctx.lineTo(x + w / 2 * 0.85, top);
  ctx.lineTo(x + w / 2, bot);
  ctx.fill();
  ctx.strokeStyle = hi; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - w / 2 * 0.85 + 3, top); ctx.lineTo(x - w / 2 + 3, bot); ctx.stroke();
}
function arch(ctx, x, w, y, h, col, hi) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.rect(x - w / 2 - 20, y - h, 20, h + 600);
  ctx.rect(x + w / 2, y - h, 20, h + 600);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 20, y - h);
  ctx.ellipse(x, y - h, w / 2 + 20, w * 0.6, 0, Math.PI, 0);
  ctx.lineTo(x + w / 2, y - h);
  ctx.ellipse(x, y - h, w / 2, w * 0.5, 0, 0, Math.PI, true);
  ctx.fill();
  ctx.strokeStyle = hi; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, y - h, w / 2, w * 0.5, 0, Math.PI, 0); ctx.stroke();
}
function hanging(ctx, x, len, w, col, hi, kind, R) {
  ctx.fillStyle = col; ctx.strokeStyle = col;
  if (kind === 'thread') {
    ctx.lineWidth = Math.max(1, w * 0.15);
    ctx.beginPath(); ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 20, len * 0.4, x - 20, len * 0.7, x, len); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, len, w * 0.4, 0, TAU); ctx.fill();
  } else if (kind === 'bell') {
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, len); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - w * 0.3, len);
    ctx.quadraticCurveTo(x - w * 0.4, len + w * 0.6, x - w * 0.6, len + w);
    ctx.lineTo(x + w * 0.6, len + w);
    ctx.quadraticCurveTo(x + w * 0.4, len + w * 0.6, x + w * 0.3, len);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = hi; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - w * 0.55, len + w * 0.92); ctx.lineTo(x + w * 0.55, len + w * 0.92); ctx.stroke();
  } else { // stalactite
    ctx.beginPath(); ctx.moveTo(x - w, 0); ctx.quadraticCurveTo(x - w * 0.2, len * 0.6, x, len);
    ctx.quadraticCurveTo(x + w * 0.2, len * 0.6, x + w, 0); ctx.fill();
  }
}
function gear(ctx, x, y, r, teeth, col, hi) {
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * TAU;
    const rr = i % 2 ? r : r * 1.15;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = hi; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, TAU); ctx.stroke();
}
function mushroomBig(ctx, x, base, h, w, col, hi) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x - w * 0.08, base);
  ctx.quadraticCurveTo(x - w * 0.15, base - h * 0.5, x - w * 0.05, base - h);
  ctx.lineTo(x + w * 0.05, base - h);
  ctx.quadraticCurveTo(x + w * 0.1, base - h * 0.5, x + w * 0.1, base); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, base - h, w * 0.5, w * 0.22, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = hi; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, base - h, w * 0.5, w * 0.22, 0, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
}
function crystal(ctx, x, base, h, w, ang, col, hi) {
  ctx.save(); ctx.translate(x, base); ctx.rotate(ang);
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -h * 0.8); ctx.lineTo(0, -h);
  ctx.lineTo(w / 2, -h * 0.8); ctx.lineTo(w / 2, 0); ctx.fill();
  ctx.strokeStyle = hi; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(0, 0); ctx.stroke();
  ctx.restore();
}
function cloud(ctx, x, y, w, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) ctx.ellipse(x + (i - 2) * w * 0.18, y - Math.sin(i * 1.3) * w * 0.06, w * 0.18, w * 0.11, 0, 0, TAU);
  ctx.fill();
}
function tower(ctx, x, base, w, h, col, hi, R) {
  ctx.fillStyle = col;
  ctx.fillRect(x - w / 2, base - h, w, h + 400);
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 6, base - h); ctx.lineTo(x, base - h - w * 1.1); ctx.lineTo(x + w / 2 + 6, base - h); ctx.fill();
  ctx.fillStyle = hi;
  for (let i = 0; i < 3; i++) {
    if (R() < 0.5) continue;
    ctx.fillRect(x - 3, base - h + 20 + i * 40, 6, 10);
  }
}

// ---------- painters ----------
const PAINTERS = {
  threadcave(ctx, R, d, col, hi) {
    for (let i = 0; i < 9; i++) pillar(ctx, R() * LAYER_W, 40 + R() * 90 * (d + 1) / 2, 0, LAYER_H, col, hi);
    for (let i = 0; i < 40; i++) hanging(ctx, R() * LAYER_W, 80 + R() * 500, 4 + d * 3, col, hi, 'thread', R);
  },
  bells(ctx, R, d, col, hi) {
    for (let i = 0; i < 12; i++) hanging(ctx, R() * LAYER_W, 60 + R() * 300, 20 + R() * 40, col, hi, 'stal', R);
    for (let i = 0; i < 7; i++) hanging(ctx, R() * LAYER_W, 100 + R() * 400, 26 + d * 18 + R() * 20, col, hi, 'bell', R);
    for (let i = 0; i < 5; i++) pillar(ctx, R() * LAYER_W, 50 + R() * 60, 0, LAYER_H, col, hi);
  },
  town(ctx, R, d, col, hi, style) {
    for (let i = 0; i < 14; i++) {
      const x = R() * LAYER_W, w = 60 + R() * 120, h = 150 + R() * 350 - d * 60;
      ctx.fillStyle = col;
      ctx.fillRect(x - w / 2, LAYER_H - h, w, h);
      ctx.beginPath(); ctx.moveTo(x - w / 2 - 15, LAYER_H - h); ctx.lineTo(x - w * 0.1, LAYER_H - h - w * 0.6); ctx.lineTo(x + w / 2 + 15, LAYER_H - h); ctx.fill();
      for (let k = 0; k < 4; k++) {
        if (R() < 0.45) continue;
        ctx.fillStyle = rgba(style.accent, 0.25 + d * 0.15);
        ctx.fillRect(x - w / 3 + R() * w * 0.5, LAYER_H - h + 30 + k * 50, 10, 14);
      }
    }
    for (let i = 0; i < 6; i++) tower(ctx, R() * LAYER_W, LAYER_H - 200, 30 + R() * 30, 400 + R() * 300, col, hi, R);
  },
  greenhouse(ctx, R, d, col, hi, style) {
    for (let i = 0; i < 5; i++) arch(ctx, R() * LAYER_W, 160 + R() * 160, LAYER_H - 50, 300 + R() * 200, col, hi);
    ctx.strokeStyle = hi; ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) { const x = R() * LAYER_W; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 60, LAYER_H); ctx.stroke(); }
    ctx.fillStyle = col;
    for (let i = 0; i < 80; i++) { ctx.beginPath(); ctx.ellipse(R() * LAYER_W, R() * 300, 10 + R() * 30, 5 + R() * 10, R() * 3, 0, TAU); ctx.fill(); }
    for (let i = 0; i < 30; i++) hanging(ctx, R() * LAYER_W, 100 + R() * 400, 3 + d * 2, col, hi, 'thread', R);
  },
  crypt(ctx, R, d, col, hi, style) {
    for (let i = 0; i < 6; i++) arch(ctx, i * 300 + R() * 100, 120 + R() * 80, LAYER_H - 80, 200 + R() * 150, col, hi);
    for (let i = 0; i < 9; i++) {
      const x = R() * LAYER_W, y = 200 + R() * 600;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 18 + d * 8);
      g.addColorStop(0, rgba(style.glow, 0.16)); g.addColorStop(1, rgba(style.glow, 0));
      ctx.fillStyle = g; ctx.fillRect(x - 50, y - 50, 100, 100);
    }
    for (let i = 0; i < 10; i++) hanging(ctx, R() * LAYER_W, 60 + R() * 220, 14 + R() * 20, col, hi, 'stal', R);
  },
  fungal(ctx, R, d, col, hi, style) {
    for (let i = 0; i < 9; i++) mushroomBig(ctx, R() * LAYER_W, LAYER_H - 40, 250 + R() * 450, 160 + R() * 220, col, hi);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = rgba(style.accent, 0.12 + d * 0.06);
      ctx.beginPath(); ctx.arc(R() * LAYER_W, R() * LAYER_H, 1 + R() * 3, 0, TAU); ctx.fill();
    }
  },
  gears(ctx, R, d, col, hi) {
    for (let i = 0; i < 8; i++) gear(ctx, R() * LAYER_W, R() * LAYER_H, 50 + R() * 140, 8 + Math.floor(R() * 8), col, hi);
    ctx.fillStyle = col;
    for (let i = 0; i < 6; i++) { const y = R() * LAYER_H; ctx.fillRect(0, y, LAYER_W, 10 + d * 6); }
    for (let i = 0; i < 6; i++) pillar(ctx, R() * LAYER_W, 30 + R() * 40, 0, LAYER_H, col, hi);
  },
  aqueduct(ctx, R, d, col, hi, style) {
    for (let i = 0; i < 7; i++) arch(ctx, i * 260 + R() * 60, 140, LAYER_H - 120 - d * 60, 180, col, hi);
    ctx.fillStyle = col;
    ctx.fillRect(0, LAYER_H - 380 - d * 60, LAYER_W, 30);
    for (let i = 0; i < 50; i++) {
      ctx.strokeStyle = rgba(style.accent, 0.12);
      ctx.beginPath(); ctx.arc(R() * LAYER_W, R() * LAYER_H, 2 + R() * 6, 0, TAU); ctx.stroke();
    }
    for (let i = 0; i < 12; i++) hanging(ctx, R() * LAYER_W, 50 + R() * 250, 10 + R() * 18, col, hi, 'stal', R);
  },
  furnace(ctx, R, d, col, hi, style) {
    for (let i = 0; i < 8; i++) {
      const x = R() * LAYER_W, w = 60 + R() * 80, h = 400 + R() * 400;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(x - w, LAYER_H); ctx.lineTo(x - w * 0.4, LAYER_H - h); ctx.lineTo(x + w * 0.4, LAYER_H - h); ctx.lineTo(x + w, LAYER_H); ctx.fill();
      const g = ctx.createRadialGradient(x, LAYER_H - h * 0.3, 0, x, LAYER_H - h * 0.3, w);
      g.addColorStop(0, rgba(style.glow, 0.35)); g.addColorStop(1, rgba(style.glow, 0));
      ctx.fillStyle = g; ctx.fillRect(x - w, LAYER_H - h * 0.3 - w, w * 2, w * 2);
    }
  },
  prisms(ctx, R, d, col, hi) {
    for (let i = 0; i < 26; i++) crystal(ctx, R() * LAYER_W, LAYER_H - 40, 150 + R() * 450, 40 + R() * 80, (R() - 0.5) * 0.8, col, hi);
    for (let i = 0; i < 16; i++) crystal(ctx, R() * LAYER_W, 0, -(100 + R() * 300), 30 + R() * 60, (R() - 0.5) * 0.6, col, hi);
  },
  clouds(ctx, R, d, col, hi, style) {
    for (let i = 0; i < 7; i++) tower(ctx, R() * LAYER_W, LAYER_H - 100, 50 + R() * 50, 300 + R() * 500, col, hi, R);
    for (let i = 0; i < 14; i++) cloud(ctx, R() * LAYER_W, 200 + R() * 700, 250 + R() * 300, rgba(style.accent, 0.08 + d * 0.05));
    for (let i = 0; i < 6; i++) hanging(ctx, R() * LAYER_W, 40 + R() * 80, 30 + R() * 30, col, hi, 'bell', R);
  },
  library(ctx, R, d, col, hi, style) {
    for (let i = 0; i < 7; i++) {
      const x = R() * LAYER_W, w = 140 + R() * 160;
      ctx.fillStyle = col; ctx.fillRect(x, 0, w, LAYER_H);
      for (let y = 40; y < LAYER_H; y += 70) {
        ctx.fillStyle = hi; ctx.fillRect(x, y, w, 4);
        let bx = x + 4;
        while (bx < x + w - 10) {
          const bw = 6 + R() * 10, bh = 30 + R() * 30;
          ctx.fillStyle = rgba(R() < 0.3 ? style.accent : style.rim, 0.12 + d * 0.06);
          ctx.fillRect(bx, y - bh, bw, bh); bx += bw + 2;
        }
      }
    }
    for (let i = 0; i < 30; i++) hanging(ctx, R() * LAYER_W, 100 + R() * 500, 3 + d * 2, col, hi, 'thread', R);
  },
  hive(ctx, R, d, col, hi) {
    ctx.fillStyle = col;
    for (let i = 0; i < 70; i++) {
      const x = R() * LAYER_W, y = R() * LAYER_H, r = 20 + R() * 60;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) ctx.lineTo(x + Math.cos(k * TAU / 6) * r, y + Math.sin(k * TAU / 6) * r);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.ellipse(R() * LAYER_W, R() * LAYER_H, 30 + R() * 50, 20 + R() * 40, 0, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
  },
  iceshrine(ctx, R, d, col, hi) {
    for (let i = 0; i < 10; i++) pillar(ctx, R() * LAYER_W, 40 + R() * 70, 0, LAYER_H, col, hi);
    for (let i = 0; i < 20; i++) hanging(ctx, R() * LAYER_W, 80 + R() * 300, 8 + R() * 18, col, hi, 'stal', R);
    for (let i = 0; i < 10; i++) crystal(ctx, R() * LAYER_W, LAYER_H - 50, 100 + R() * 200, 30 + R() * 40, (R() - 0.5) * 0.5, col, hi);
  },
  looms(ctx, R, d, col, hi) {
    for (let i = 0; i < 5; i++) {
      const x = R() * LAYER_W, w = 200 + R() * 200, top = R() * 300;
      ctx.fillStyle = col;
      ctx.fillRect(x, top, 18, LAYER_H); ctx.fillRect(x + w, top, 18, LAYER_H);
      ctx.fillRect(x - 10, top, w + 38, 20);
      ctx.strokeStyle = hi; ctx.lineWidth = 1;
      for (let k = 0; k < w; k += 8) { ctx.beginPath(); ctx.moveTo(x + 18 + k, top + 20); ctx.lineTo(x + 18 + k + Math.sin(k) * 10, LAYER_H); ctx.stroke(); }
    }
  },
  moonsky(ctx, R, d, col, hi, style) {
    if (d === 0) {
      for (let i = 0; i < 200; i++) { ctx.fillStyle = rgba('#ffffff', 0.2 + R() * 0.6); ctx.fillRect(R() * LAYER_W, R() * LAYER_H, 1.5, 1.5); }
      const g = ctx.createRadialGradient(LAYER_W * 0.6, 260, 60, LAYER_W * 0.6, 260, 360);
      g.addColorStop(0, rgba(style.glow, 0.5)); g.addColorStop(1, rgba(style.glow, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, LAYER_W, LAYER_H);
      ctx.fillStyle = rgba(style.glow, 0.85); ctx.beginPath(); ctx.arc(LAYER_W * 0.6, 260, 140, 0, TAU); ctx.fill();
    } else {
      for (let i = 0; i < 9; i++) cloud(ctx, R() * LAYER_W, 300 + R() * 600, 300 + R() * 300, rgba(style.accent, 0.06 * d));
      for (let i = 0; i < 4; i++) tower(ctx, R() * LAYER_W, LAYER_H - 50, 40, 300 + R() * 300, col, hi, R);
    }
  },
  void(ctx, R, d, col, hi, style) {
    for (let i = 0; i < 25; i++) {
      ctx.strokeStyle = rgba(style.accent, 0.08 + d * 0.06); ctx.lineWidth = 1 + d;
      const x = R() * LAYER_W, y = R() * LAYER_H;
      ctx.beginPath();
      for (let k = 0; k < 60; k++) { const a = k * 0.25; ctx.lineTo(x + Math.cos(a) * k * 3, y + Math.sin(a) * k * 3); }
      ctx.stroke();
    }
    ctx.fillStyle = col;
    for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.ellipse(R() * LAYER_W, R() * LAYER_H, 30 + R() * 90, 20 + R() * 60, R() * 3, 0, TAU); ctx.fill(); }
  },
  dunes(ctx, R, d, col, hi) {
    ctx.fillStyle = col;
    for (let i = 0; i < 6; i++) {
      const x = R() * LAYER_W, w = 400 + R() * 500, h = 120 + R() * 200;
      ctx.beginPath(); ctx.moveTo(x - w / 2, LAYER_H); ctx.quadraticCurveTo(x, LAYER_H - h * 2 - 200 + d * 120, x + w / 2, LAYER_H); ctx.fill();
    }
    for (let i = 0; i < 5; i++) pillar(ctx, R() * LAYER_W, 20 + R() * 30, LAYER_H - 500, LAYER_H, col, hi);
  },
  temple(ctx, R, d, col, hi, style) {
    for (let i = 0; i < 9; i++) pillar(ctx, i * 200 + R() * 50, 50 + d * 20, 80, LAYER_H, col, hi);
    for (let i = 0; i < 4; i++) arch(ctx, R() * LAYER_W, 220, LAYER_H - 100, 360, col, hi);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = rgba(style.glow, 0.1); ctx.beginPath(); ctx.arc(R() * LAYER_W, R() * LAYER_H, 1 + R() * 2, 0, TAU); ctx.fill(); }
  },
};
