// Procedural parallax backgrounds per area, painted once and cached.
// Each area gets three hand-illustrated layers (far haze -> mid structures -> near dark texture),
// built from wobbly ink paths, tapered brush ribbons, hatching and soft glows, then run through a
// painterly finishing pass. Everything is seeded, and every element is wrapped so the strip tiles.
import { VIEW_W, VIEW_H } from '../core/constants.js';
import { rng, hashStr, TAU } from '../core/math.js';
import { rgba, mix } from './palettes.js';

const LAYER_W = 1800, LAYER_H = 1000;
const W = LAYER_W, H = LAYER_H;
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

// ---------- layer painting ----------
function makePal(style, d) {
  const haze = mix(style.sky[0], style.sky[1], 0.35);
  const col = d === 0 ? mix(haze, style.rock, 0.28) : d === 1 ? mix(style.sky[1], style.rock, 0.55) : mix(style.sky[1], style.rock, 0.86);
  const k = [0.42, 0.72, 1][d];
  return {
    d, col, haze, style,
    dark: mix(col, '#000000', 0.28),
    deep: mix(col, '#000000', 0.5),
    lite: mix(col, style.rim, [0.1, 0.17, 0.13][d]),
    mid: mix(col, style.rim, [0.05, 0.09, 0.07][d]),
    rim: rgba(style.rim, [0.13, 0.22, 0.2][d]),
    line: rgba(style.rim, [0.07, 0.12, 0.1][d]),
    ink: 'rgba(0,0,0,' + [0.1, 0.2, 0.3][d] + ')',
    hi: rgba(mix(style.sky[0], style.rim, 0.25 + d * 0.15), 0.25 + d * 0.1),
    glow: (a) => rgba(style.glow, Math.min(1, a * k)),
    acc: (a) => rgba(style.accent, Math.min(1, a * k)),
    rimA: (a) => rgba(style.rim, a),
  };
}

const NO_CEIL = new Set(['clouds', 'moonsky', 'town', 'dunes']);
const NO_FLOOR = new Set(['dunes']);

function paintLayer(style, depth, seed) {
  const cv = document.createElement('canvas');
  cv.width = LAYER_W; cv.height = LAYER_H;
  const ctx = cv.getContext('2d');
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const P = makePal(style, depth);
  const paint = PAINTERS[style.bg] || PAINTERS.threadcave;
  if (depth === 0) {
    // soft pools of distant light so the far silhouettes have something to stand against
    const RG = rng(seed + 9);
    for (let i = 0; i < 3; i++) at(ctx, RG, RG() * W, 600, (r, x) => glow(ctx, x, 250 + r() * 450, 420 + r() * 200, rgba(style.glow, 0.05 + r() * 0.03)));
  }
  paint(ctx, rng(seed), depth, P);
  // floor and ceiling masses for all layers (periodic, so they wrap)
  const R3 = rng(seed + 5);
  if (style.bg === 'looms') {
    // no floor: everything falls away into the abyss
    const g = ctx.createLinearGradient(0, 620, 0, H);
    g.addColorStop(0, rgba(style.sky[1], 0)); g.addColorStop(1, rgba(style.sky[1], 0.9));
    ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = g; ctx.fillRect(0, 600, W, H); ctx.restore();
  } else if (style.bg === 'aqueduct') {
    // a flooded floor: dark water with reflected glints instead of rock
    const wn = pnoise(R3, [6, 11, 17], 0.6), wy = H - 150 - depth * 30;
    const sp = new Path2D(); sp.moveTo(0, H + 10);
    for (let x = 0; x <= W; x += 8) sp.lineTo(x, wy + wn(x) * 5);
    sp.lineTo(W, H + 10); sp.closePath();
    ctx.fillStyle = mix(P.col, style.sky[1], 0.35); ctx.fill(sp);
    ctx.strokeStyle = P.acc(0.3); ctx.lineWidth = 1.5; ctx.save(); ctx.translate(0, 1); ctx.beginPath();
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, wy + wn(x) * 5); ctx.stroke(); ctx.restore();
    for (let i = 0; i < 80; i++) { const x = R3() * W, y = wy + 8 + R3() * 140, l = 8 + R3() * 50; ctx.strokeStyle = P.acc(0.06 + R3() * 0.14); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(Math.min(W, x + l), y); ctx.stroke(); }
  } else if (!NO_FLOOR.has(style.bg)) massEdge(ctx, R3, P, LAYER_H - 60 - depth * 50, 1, depth);
  if (style.bg === 'furnace' && depth > 0) {
    // molten seams glowing through the slag floor
    for (let i = 0; i < 10; i++) at(ctx, R3, R3() * W, 90, (r, x) => {
      const y = H - 40 - depth * 30 + r() * 30, pts = []; let cx = x, cy = y;
      for (let k = 0; k < 7; k++) { pts.push([cx, cy]); cx += 10 + r() * 20; cy += (r() - 0.5) * 18; }
      glow(ctx, x + 50, y, 80, P.glow(0.18));
      wline(ctx, r, pts, P.acc(0.7), 2);
    });
  }
  if (!NO_CEIL.has(style.bg)) massEdge(ctx, R3, P, 40 + depth * 40, -1, depth);
  return painterly(cv, style, depth, seed);
}

// Turn a silhouette layer into something that reads as painted: torn/brushed edges,
// dry-brush streaks of light and shade over the shapes, and depth-of-field blur on far layers.
// Works on a wrap-padded copy so the filters don't leave a seam where the strip tiles.
function painterly(cv, style, depth, seed) {
  const fid = roughFilter();
  if (!fid) return cv;
  const R = rng(seed + 77);
  const PAD = 64;
  const PW = cv.width + PAD * 2, Hh = cv.height;
  const pad = document.createElement('canvas'); pad.width = PW; pad.height = Hh;
  const pc = pad.getContext('2d');
  for (const sx of [PAD - LAYER_W, PAD, PAD + LAYER_W]) pc.drawImage(cv, sx, 0);
  const a = document.createElement('canvas'); a.width = PW; a.height = Hh;
  const c = a.getContext('2d');
  c.filter = `url(#${fid})`;
  c.drawImage(pad, 0, 0);
  c.filter = 'none';
  // dry-brush streaks, only on painted pixels
  c.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 300; i++) {
    const x = R() * PW, y = R() * Hh, len = 30 + R() * 160, ang = -0.25 + R() * 0.5 + (R() < 0.3 ? Math.PI / 2 : 0);
    const light = R() < 0.45;
    c.strokeStyle = light ? rgba(mix(style.rim, style.rock, 0.5), 0.03 + R() * 0.05) : 'rgba(0,0,0,0.14)';
    c.lineWidth = 2 + R() * 9;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y);
    c.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 + (R() - 0.5) * 20, y + Math.sin(ang) * len * 0.5 + (R() - 0.5) * 20, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    c.stroke();
  }
  c.globalCompositeOperation = 'source-over';
  const b = document.createElement('canvas'); b.width = W; b.height = H;
  const bc = b.getContext('2d');
  const blur = [3.0, 1.4, 0.5][depth];
  bc.filter = `blur(${blur}px)`;
  bc.drawImage(a, -PAD, 0);
  return b;
}

// The page's #rough filter, cloned to work in sRGB: the default linearRGB round-trip quantises
// very dark paint to 8 bits and tints near-black layers olive/green.
function roughFilter() {
  if (typeof document === 'undefined') return null;
  if (document.getElementById('roughBg')) return 'roughBg';
  const src = document.getElementById('rough');
  if (!src) return null;
  const f = src.cloneNode(true);
  f.setAttribute('id', 'roughBg');
  f.setAttribute('color-interpolation-filters', 'sRGB');
  src.parentNode.appendChild(f);
  return 'roughBg';
}

function massEdge(ctx, R, P, baseY, dir, depth) {
  const n = pnoise(R, [2, 3, 5, 8, 13, 21, 34], 0.68);
  const p = new Path2D();
  const yEnd = dir > 0 ? H + 20 : -20;
  p.moveTo(0, yEnd);
  for (let x = 0; x <= W; x += 6) p.lineTo(x, baseY + n(x) * 70);
  p.lineTo(W, yEnd); p.closePath();
  ctx.fillStyle = P.col; ctx.fill(p);
  ctx.save(); ctx.clip(p);
  if (dir > 0) { ctx.translate(0, 3); ctx.strokeStyle = P.rim; ctx.lineWidth = 3; ctx.stroke(p); }
  else { ctx.translate(0, -8); ctx.strokeStyle = P.ink; ctx.lineWidth = 16; ctx.stroke(p); }
  ctx.restore();
  // ceiling teeth / floor rubble
  for (let i = 0; i < 16; i++) {
    const x = R() * W, y = baseY + n(x) * 70;
    at(ctx, R, x, 60, (r, x) => {
      if (dir < 0) {
        const w = 10 + r() * 34, len = 30 + r() * 120 * (0.6 + depth * 0.25);
        const sp = wobPath(r, [[x - w, y - 10], [x - w * 0.3, y + len * 0.55], [x + (r() - 0.5) * 6, y + len], [x + w * 0.35, y + len * 0.5], [x + w, y - 10]], 1.4, 7);
        fillShape(ctx, r, sp, P.col, P, { rim: false });
      } else {
        const w = 14 + r() * 40, h = 8 + r() * 26;
        const sp = wobPath(r, [[x - w, y + 20], [x - w * 0.7, y - h * 0.6], [x - w * 0.1, y - h], [x + w * 0.6, y - h * 0.7], [x + w, y + 20]], 2, 8);
        fillShape(ctx, r, sp, P.col, P);
      }
    });
  }
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

// ---------- hand-drawn toolkit ----------
// Draw one element so the strip wraps: it is drawn again shifted by ±W when it crosses an edge.
// The element gets its own sub-rng so every copy is identical.
function at(ctx, R, x, ext, fn) {
  const s = (R() * 4294967296) >>> 0;
  x = ((x % W) + W) % W;
  for (const sh of [0, -W, W]) {
    if (sh === -W && x + ext < W) continue;
    if (sh === W && x - ext > 0) continue;
    ctx.save(); ctx.translate(sh, 0); fn(rng(s), x); ctx.restore();
  }
}
// evenly spread positions with jitter (avoids clumping)
function spread(R, n, jit = 0.7) {
  const o = R() * W, out = [];
  for (let i = 0; i < n; i++) out.push((o + (i + 0.5 + (R() - 0.5) * jit) * W / n) % W);
  return out;
}
// periodic noise across the layer width (seamless), range about -1..1
function pnoise(R, ks = [1, 2, 3, 5, 8, 13], fall = 0.6) {
  const t = ks.map((k, i) => [TAU * k / W, R() * TAU, Math.pow(fall, i)]);
  const norm = t.reduce((s, v) => s + v[2], 0);
  return (x) => { let s = 0; for (const [f, p, a] of t) s += a * Math.sin(f * x + p); return s / norm; };
}
// smooth 1D noise in pixel units, range about -1..1
function snoise(R, sc = 1) {
  const p = [R() * TAU, R() * TAU, R() * TAU, R() * TAU];
  const f = [0.011, 0.029, 0.067, 0.15].map((v) => v * sc * (0.8 + R() * 0.4));
  return (t) => 0.5 * Math.sin(t * f[0] + p[0]) + 0.27 * Math.sin(t * f[1] + p[1]) + 0.15 * Math.sin(t * f[2] + p[2]) + 0.08 * Math.sin(t * f[3] + p[3]);
}
// add a hand-wobbled polyline/polygon to a path (ctx or Path2D)
function addWob(p, R, pts, amp = 2, step = 10, closed = true) {
  const n = snoise(R, 1.6);
  let dist = 0;
  const N = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < N; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
    const steps = Math.max(1, Math.ceil(L / step));
    for (let s = 0; s < steps; s++) {
      const t = s / steps, o = n(dist + t * L) * amp * 1.6;
      const x = x0 + (x1 - x0) * t + nx * o, y = y0 + (y1 - y0) * t + ny * o;
      if (i === 0 && s === 0) p.moveTo(x, y); else p.lineTo(x, y);
    }
    dist += L;
  }
  if (closed) p.closePath(); else p.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  return p;
}
const wobPath = (R, pts, amp, step, closed = true) => addWob(new Path2D(), R, pts, amp, step, closed);
// sample a quadratic curve
function qpts(x0, y0, cx, cy, x1, y1, n = 16) {
  const o = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]); }
  return o;
}
// a hanging catenary-ish sag between two points
function sag(x0, y0, x1, y1, s, n = 18) {
  const o = [];
  for (let i = 0; i <= n; i++) { const t = i / n; o.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + s * 4 * t * (1 - t)]); }
  return o;
}
// tapered brush stroke along a centerline
function ribbon(ctx, R, pts, w0, w1, color, wob = 0.3) {
  const n = snoise(R, 3), N = pts.length, L = [], Rt = [];
  for (let i = 0; i < N; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const t = i / (N - 1 || 1);
    const w = Math.max(0.15, (w0 + (w1 - w0) * t) * (1 + n(i * 11) * wob)) / 2;
    L.push([pts[i][0] - ty * w, pts[i][1] + tx * w]);
    Rt.push([pts[i][0] + ty * w, pts[i][1] - tx * w]);
  }
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
  for (const q of L) ctx.lineTo(q[0], q[1]);
  for (let i = N - 1; i >= 0; i--) ctx.lineTo(Rt[i][0], Rt[i][1]);
  ctx.closePath(); ctx.fill();
}
// thin wobbly ink line
function wline(ctx, R, pts, color, lw = 1, amp) {
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.stroke(wobPath(R, pts, amp ?? Math.min(2.2, 0.5 + lw * 0.4), 7, false));
}
// hatching through a box (clip first)
function hatch(ctx, R, x, y, w, h, ang, gap, color, lw = 1) {
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  const cx = x + w / 2, cy = y + h / 2, r = Math.hypot(w, h) / 2, ca = Math.cos(ang), sa = Math.sin(ang);
  ctx.beginPath();
  for (let o = -r; o < r; o += gap * (0.6 + R() * 0.8)) {
    if (R() < 0.2) continue;
    const a = -r * (0.2 + R() * 0.8), b = r * (0.2 + R() * 0.8);
    const px = cx - sa * o, py = cy + ca * o;
    ctx.moveTo(px + ca * a, py + sa * a);
    ctx.quadraticCurveTo(px + ca * (a + b) / 2 + (R() - 0.5) * 4, py + sa * (a + b) / 2 + (R() - 0.5) * 4, px + ca * b, py + sa * b);
  }
  ctx.stroke();
}
// soft blotches of lighter / darker paint (clip first)
function mottle(ctx, R, x, y, w, h, n, P) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = R() < 0.5 ? P.rimA(0.015 + R() * 0.025) : 'rgba(0,0,0,' + (0.03 + R() * 0.05).toFixed(3) + ')';
    const ex = x + R() * w, ey = y + R() * h, rx = 10 + R() * 40, ry = 6 + R() * 22, a = R() * 3;
    ctx.beginPath(); for (let k = 0; k < 9; k++) { const t = k / 9 * TAU, q = 0.75 + R() * 0.4; ctx.lineTo(ex + Math.cos(t + a) * rx * q, ey + Math.sin(t + a) * ry * q); } ctx.fill();
  }
}
// fill a shape and give it volume: dark occlusion along the bottom, a brushed rim of light on top,
// optional hatching / mottling inside. o.box = [x, y, w, h] for the texture passes.
function fillShape(ctx, R, p, color, P, o = {}) {
  const rule = o.rule || 'nonzero';
  ctx.fillStyle = color; ctx.fill(p, rule);
  ctx.save(); ctx.clip(p, rule);
  if (o.box && o.mottle !== false) mottle(ctx, R, o.box[0], o.box[1], o.box[2], o.box[3], o.mottleN ?? 10, P);
  if (o.box && o.hatch) hatch(ctx, R, o.box[0], o.box[1], o.box[2], o.box[3], o.hatch[0] ?? 1, o.hatch[1] ?? 7, o.hatchCol || P.line, o.hatch[2] || 1);
  if (o.shade !== false) { ctx.save(); ctx.translate(o.sx ?? -3, o.sy ?? -9); ctx.strokeStyle = P.ink; ctx.lineWidth = o.sw ?? 16; ctx.stroke(p); ctx.restore(); }
  if (o.rim !== false) { ctx.save(); ctx.translate(o.rx ?? 1.5, o.ry ?? 2.5); ctx.strokeStyle = o.rimCol || P.rim; ctx.lineWidth = o.rw ?? 2.5; ctx.stroke(p); ctx.restore(); }
  ctx.restore();
}
function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(0.35, color.replace(/[\d.]+\)$/, (m) => (parseFloat(m) * 0.35).toFixed(3) + ')'));
  g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function leaf(ctx, x, y, len, ang, wid, color, vein) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.35, -wid, len, 0); ctx.quadraticCurveTo(len * 0.45, wid * 0.9, 0, 0); ctx.fill();
  if (vein) { ctx.strokeStyle = vein; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -wid * 0.1, len * 0.9, 0); ctx.stroke(); }
  ctx.restore();
}
// a trailing vine with leaves
function vine(ctx, R, x, y0, len, color, leafCol, w = 3, leafS = 1) {
  const amp = 6 + R() * 16, ph = R() * TAU, k = 2 + R() * 3, pts = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push([x + Math.sin(t * k + ph) * amp * t, y0 + len * t]); }
  ribbon(ctx, R, pts, w, w * 0.25, color);
  for (let i = 2; i < 24; i += 1 + Math.floor(R() * 2)) {
    const [px, py] = pts[i], side = i % 2 ? 1 : -1;
    leaf(ctx, px, py, (6 + R() * 9) * leafS * (1 - i / 34), side > 0 ? 0.4 + R() * 0.6 : Math.PI - 0.4 - R() * 0.6, (3 + R() * 3) * leafS, leafCol);
  }
}
// chain of links between two points
function chain(ctx, x0, y0, x1, y1, s, color, lw = 2) {
  const L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0), n = Math.max(1, Math.floor(L / (s * 0.85)));
  ctx.strokeStyle = color;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
    ctx.beginPath();
    if (i % 2 === 0) { ctx.lineWidth = lw; ctx.ellipse(cx, cy, s * 0.55, s * 0.28, a, 0, TAU); }
    else { ctx.lineWidth = lw * 1.4; ctx.moveTo(cx - Math.cos(a) * s * 0.5, cy - Math.sin(a) * s * 0.5); ctx.lineTo(cx + Math.cos(a) * s * 0.5, cy + Math.sin(a) * s * 0.5); }
    ctx.stroke();
  }
}
function cobweb(ctx, R, x, y, r, a0, a1, color) {
  const k = 5 + Math.floor(R() * 3), spokes = [];
  for (let i = 0; i < k; i++) spokes.push(a0 + (a1 - a0) * (i / (k - 1)) + (R() - 0.5) * 0.08);
  ctx.strokeStyle = color; ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const a of spokes) { ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  for (let ring = 1; ring <= 5; ring++) {
    const rr = r * ring / 5.4 * (0.92 + R() * 0.1);
    for (let i = 0; i < k - 1; i++) {
      const A = spokes[i], B = spokes[i + 1], m = (A + B) / 2;
      ctx.moveTo(x + Math.cos(A) * rr, y + Math.sin(A) * rr);
      ctx.quadraticCurveTo(x + Math.cos(m) * rr * 0.82, y + Math.sin(m) * rr * 0.82, x + Math.cos(B) * rr, y + Math.sin(B) * rr);
    }
  }
  ctx.stroke();
}
function moth(ctx, x, y, s, ang, color, glowCol) {
  if (glowCol) glow(ctx, x, y, s * 4, glowCol);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(-s * 0.55, -s * 0.15, s * 0.6, s * 0.38, -0.5, 0, TAU);
  ctx.ellipse(s * 0.55, -s * 0.15, s * 0.6, s * 0.38, 0.5, 0, TAU);
  ctx.ellipse(-s * 0.4, s * 0.35, s * 0.35, s * 0.22, 0.4, 0, TAU);
  ctx.ellipse(s * 0.4, s * 0.35, s * 0.35, s * 0.22, -0.4, 0, TAU);
  ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.12, s * 0.45, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
// arch opening points: x center, w width, spring = y where the curve starts, base = bottom.
// f = 0.5 round, larger = more pointed (gothic)
function archPts(x, w, spring, base, f = 0.5, n = 10) {
  const r = Math.max(w * 0.5, w * f), pts = [[x - w / 2, base], [x - w / 2, spring]];
  const c = (w / 2 - r) / r, aEnd = TAU - Math.acos(Math.max(-1, Math.min(1, c)));
  const cxL = x - w / 2 + r;
  for (let i = 1; i <= n; i++) { const a = Math.PI + (aEnd - Math.PI) * i / n; pts.push([cxL + Math.cos(a) * r, spring + Math.sin(a) * r]); }
  const cxR = x + w / 2 - r;
  for (let i = n - 1; i >= 0; i--) { const a = Math.PI + (aEnd - Math.PI) * i / n; pts.push([cxR - Math.cos(a) * r, spring + Math.sin(a) * r]); }
  pts.push([x + w / 2, spring], [x + w / 2, base]);
  return pts;
}
function rectPts(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
// organic cave column: pinched in the middle, flaring into floor and ceiling
function cavePillar(R, x, w, top = -30, bot = H + 30, pinch = 0.45) {
  const n1 = snoise(R, 0.7), n2 = snoise(R, 0.7), pts = [], N = 34;
  for (let i = 0; i <= N; i++) {
    const t = i / N, y = top + (bot - top) * t;
    const k = pinch + (1 - pinch) * Math.min(1.6, Math.pow(Math.abs(t - 0.5) * 2, 1.8) * 1.6);
    pts.push([x - w / 2 * k + n1(y) * w * 0.22, y]);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N, y = top + (bot - top) * t;
    const k = pinch + (1 - pinch) * Math.min(1.6, Math.pow(Math.abs(t - 0.5) * 2, 1.8) * 1.6);
    pts.push([x + w / 2 * k + n2(y) * w * 0.22, y]);
  }
  return wobPath(R, pts, 2.5, 9);
}
// downward spike (stalactite / icicle) or upward if len < 0
function spike(R, x, y, w, len) {
  const bend = (R() - 0.5) * w * 0.8;
  return wobPath(R, [[x - w / 2, y], [x - w * 0.18 + bend * 0.5, y + len * 0.6], [x + bend, y + len], [x + w * 0.2 + bend * 0.5, y + len * 0.55], [x + w / 2, y]], Math.min(2, w * 0.05 + 0.4), 7);
}
// small dangling ornament on a thread
function dangle(ctx, R, x, y0, len, color, lw, kind, P) {
  const sway = (R() - 0.5) * 30;
  const pts = qpts(x, y0, x + sway * 1.4, y0 + len * 0.5, x + sway, y0 + len, 10);
  wline(ctx, R, pts, color, lw, 0.8);
  const ex = x + sway, ey = y0 + len;
  ctx.fillStyle = color;
  if (kind === 'button') {
    const r = 5 + R() * 6;
    ctx.beginPath(); ctx.arc(ex, ey + r, r, 0, TAU); ctx.fill();
    ctx.fillStyle = P.deep;
    ctx.beginPath(); ctx.arc(ex - r * 0.3, ey + r, r * 0.16, 0, TAU); ctx.arc(ex + r * 0.3, ey + r, r * 0.16, 0, TAU); ctx.fill();
    ctx.strokeStyle = P.rim; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ex, ey + r, r * 0.75, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
  } else if (kind === 'knot') {
    ctx.beginPath(); ctx.ellipse(ex, ey, 3 + R() * 3, 4 + R() * 3, R(), 0, TAU); ctx.fill();
    wline(ctx, R, [[ex, ey], [ex - 4 + R() * 8, ey + 10 + R() * 14]], color, lw * 0.7);
  } else if (kind === 'spool') {
    const s = 7 + R() * 6;
    ctx.fillRect(ex - s, ey, s * 2, 3); ctx.fillRect(ex - s * 0.7, ey + 3, s * 1.4, s * 1.6); ctx.fillRect(ex - s, ey + 3 + s * 1.6, s * 2, 3);
    ctx.strokeStyle = P.line; ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(ex - s * 0.7, ey + 5 + k * s * 0.4); ctx.lineTo(ex + s * 0.7, ey + 6 + k * s * 0.4); ctx.stroke(); }
  } else if (kind === 'bead') {
    ctx.beginPath(); ctx.arc(ex, ey + 4, 4 + R() * 3, 0, TAU); ctx.fill();
  }
}
// torn hanging cloth
function tatter(ctx, R, x, top, w, len, color, P, stitch = true) {
  const sway = (R() - 0.5) * w * 0.4, pts = [[x - w / 2, top - 30], [x + w / 2, top - 30]];
  const yb = top + len;
  pts.push([x + w / 2 + sway * 0.5, top + len * 0.5], [x + w / 2 + sway, yb - len * 0.1 * R()]);
  const k = 5 + Math.floor(R() * 5);
  for (let i = 1; i < k; i++) {
    const t = i / k, xx = x + w / 2 + sway - w * t;
    pts.push([xx + (R() - 0.5) * 8, yb - (i % 2 ? R() * len * 0.35 : -R() * len * 0.08)]);
  }
  pts.push([x - w / 2 + sway, yb - len * 0.2 * R()], [x - w / 2 + sway * 0.5, top + len * 0.5]);
  const p = wobPath(R, pts, 2, 10);
  fillShape(ctx, R, p, color, P, { box: [x - w, top - 30, w * 2, len + 40], hatch: [Math.PI / 2 + 0.05, 9], rx: 2, ry: 0 });
  ctx.save(); ctx.clip(p);
  for (let i = 0; i < 3; i++) {
    const fx = x - w * 0.35 + R() * w * 0.7;
    ribbon(ctx, R, qpts(fx, top - 20, fx + sway * 0.3, top + len * 0.5, fx + sway * 0.8, yb + 10, 10), 6 + R() * 6, 2, i % 2 ? P.ink : P.rimA(0.05));
  }
  ctx.restore();
  if (stitch) {
    ctx.setLineDash([6, 6]);
    wline(ctx, R, [[x - w / 2 + 6, top + 6], [x + w / 2 - 6, top + 8]], P.rim, 1.2);
    ctx.setLineDash([]);
  }
  for (let i = 0; i < 3; i++) {
    const fx = x - w / 2 + sway + R() * w, fy = yb - R() * len * 0.15;
    wline(ctx, R, qpts(fx, fy, fx + (R() - 0.5) * 20, fy + 20, fx + (R() - 0.5) * 20, fy + 30 + R() * 50, 6), color, 1.2);
  }
}
// bell silhouette; y = top of the body, s = lip width
function bell(ctx, R, x, y, s, color, P, o = {}) {
  const h = s * 1.02;
  const prof = [[0, 0], [0.11, 0.004], [0.19, 0.035], [0.235, 0.11], [0.245, 0.27], [0.255, 0.45], [0.285, 0.62], [0.34, 0.76], [0.42, 0.87], [0.5, 0.94], [0.53, 0.985], [0.5, 1], [0.3, 0.975], [0.12, 0.965]];
  const pts = [];
  for (const [px, py] of prof) pts.push([x + px * s, y + py * h]);
  for (let i = prof.length - 1; i >= 0; i--) pts.push([x - prof[i][0] * s, y + prof[i][1] * h]);
  // clapper
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(x + s * 0.03, y + h * 1.0, s * 0.065, s * 0.075, 0, 0, TAU); ctx.fill();
  // crown loop + headstock
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, s * 0.035);
  ctx.beginPath(); ctx.ellipse(x, y - s * 0.03, s * 0.07, s * 0.06, 0, Math.PI, 0); ctx.stroke();
  const p = wobPath(R, pts, Math.min(2.5, s * 0.006 + 0.6), 8);
  fillShape(ctx, R, p, color, P, { box: [x - s * 0.6, y, s * 1.2, h], hatch: o.hatch ? [0.35, 8] : null, mottleN: 8, rx: 3, ry: 2, rw: 3.5, sw: s * 0.12, sx: -s * 0.05, sy: -s * 0.04 });
  ctx.save(); ctx.clip(p);
  // bands, following the round of the bell
  for (const t of [0.16, 0.22, 0.8, 0.86]) {
    const wy = y + h * t, ww = s * (t < 0.5 ? 0.31 : 0.46);
    wline(ctx, R, qpts(x - ww, wy, x, wy + s * 0.05, x + ww, wy, 10), o.band || P.rim, Math.max(1, s * 0.008));
  }
  // vertical sheen
  ribbon(ctx, R, qpts(x - s * 0.17, y + h * 0.08, x - s * 0.21, y + h * 0.5, x - s * 0.3, y + h * 0.92, 12), s * 0.05, s * 0.02, o.sheen || P.rimA(0.06 + P.d * 0.02));
  ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(x, y + h * 0.985, s * 0.46, s * 0.035, 0, 0, TAU); ctx.fill();
  if (o.crack) wline(ctx, R, [[x + s * 0.1, y + h], [x + s * 0.13, y + h * 0.8], [x + s * 0.08, y + h * 0.66], [x + s * 0.12, y + h * 0.5]], P.deep, Math.max(1, s * 0.012), 2);
  ctx.restore();
  return h;
}
// a two-faced crystal shard
function shard(ctx, R, x, base, h, w, ang, cA, cB, edge) {
  ctx.save(); ctx.translate(x, base); ctx.rotate(ang);
  const tip = [(R() - 0.5) * w * 0.3, -h], ridge = [w * (R() - 0.5) * 0.3, 0];
  const sl = [-w / 2 * (0.85 + R() * 0.2), -h * (0.65 + R() * 0.15)], sr = [w / 2 * (0.85 + R() * 0.2), -h * (0.7 + R() * 0.15)];
  ctx.fillStyle = cA; ctx.beginPath(); ctx.moveTo(-w / 2, 4); ctx.lineTo(sl[0], sl[1]); ctx.lineTo(tip[0], tip[1]); ctx.lineTo(ridge[0], 4); ctx.fill();
  ctx.fillStyle = cB; ctx.beginPath(); ctx.moveTo(w / 2, 4); ctx.lineTo(sr[0], sr[1]); ctx.lineTo(tip[0], tip[1]); ctx.lineTo(ridge[0], 4); ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(ridge[0], 0); ctx.lineTo(tip[0], tip[1]); ctx.lineTo(sl[0], sl[1]); ctx.stroke();
  if (R() < 0.6) { ctx.beginPath(); ctx.moveTo(sl[0] * 0.6, sl[1] * 0.4); ctx.lineTo(sl[0] * 0.2 + tip[0] * 0.5, sl[1] * 0.55 + tip[1] * 0.3); ctx.stroke(); }
  ctx.restore();
}
function crystalCluster(ctx, R, x, base, size, dir, P, lit) {
  const n = 4 + Math.floor(R() * 4), list = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) - 0.5;
    list.push({ ox: t * size * 0.7 + (R() - 0.5) * size * 0.15, h: size * (1 - Math.abs(t) * 1.1 + R() * 0.35) * 1.3, w: size * (0.16 + R() * 0.14), a: t * 1.1 + (R() - 0.5) * 0.3 });
  }
  list.sort((a, b) => a.h - b.h);
  for (const s of list) {
    const lc = lit && R() < 0.4 ? mix(P.lite, P.style.accent, 0.12 + P.d * 0.04) : P.lite;
    shard(ctx, R, x + s.ox, base, s.h * -dir, s.w, s.a * -dir, lc, P.col, P.rim);
  }
}
// leaning, crooked house with a steep roof and lit windows
function house(ctx, R, x, base, w, h, P, lit) {
  const lean = (R() - 0.5) * 0.12, ov = 6 + R() * 10, hr = w * (0.55 + R() * 0.5), peak = (R() - 0.5) * w * 0.2;
  const tl = [x - w / 2 + lean * h, base - h], tr = [x + w / 2 + lean * h, base - h];
  const body = wobPath(R, [[x - w / 2, base + 40], tl, tr, [x + w / 2, base + 40]], 1.2, 9);
  fillShape(ctx, R, body, P.col, P, { box: [x - w, base - h, w * 2, h + 40], hatch: R() < 0.5 ? [Math.PI / 2, 10] : null, rim: false, sw: 10 });
  // half-timber
  ctx.save(); ctx.clip(body);
  for (let i = 0; i < 2; i++) { const yy = base - h * (0.33 + i * 0.33); wline(ctx, R, [[x - w, yy], [x + w, yy + (R() - 0.5) * 5]], P.line, 2); }
  ctx.restore();
  // chimney
  if (R() < 0.75) {
    const cx = x + (R() < 0.5 ? -1 : 1) * w * (0.2 + R() * 0.15) + lean * h, cw = 10 + R() * 8, ch = hr * (0.5 + R() * 0.6);
    const cp = wobPath(R, [[cx - cw / 2, base - h], [cx - cw / 2 + 2, base - h - ch], [cx + cw / 2 + 2, base - h - ch], [cx + cw / 2, base - h]], 0.8, 8);
    fillShape(ctx, R, cp, P.col, P, { shade: false });
    ctx.fillStyle = P.col; ctx.fillRect(cx - cw / 2 - 2, base - h - ch - 5, cw + 6, 6);
  }
  const roof = wobPath(R, [[tl[0] - ov, tl[1] + 4], [x + peak + lean * h, base - h - hr], [tr[0] + ov, tr[1] + 4]], 1.5, 9);
  fillShape(ctx, R, roof, P.dark, P, { box: [x - w, base - h - hr, w * 2, hr + 10], hatch: [0.5 + R(), 6], shade: false });
  // windows
  const rows = Math.max(1, Math.floor(h / 70)), cols = Math.max(1, Math.floor(w / 46));
  for (let ry = 0; ry < rows; ry++) for (let cx = 0; cx < cols; cx++) {
    if (R() < 0.35) continue;
    const wx = x - w / 2 + (cx + 0.5) * w / cols + lean * h * (1 - ry / rows) - 6 + (R() - 0.5) * 6, wy = base - h + 22 + ry * 70 + (R() - 0.5) * 6;
    const ww = 10 + R() * 5, wh = 14 + R() * 6;
    const on = lit && R() < 0.45;
    if (on) glow(ctx, wx + ww / 2, wy + wh / 2, 40, P.acc(0.16));
    ctx.fillStyle = on ? P.acc(0.6) : P.deep;
    const wp = wobPath(R, rectPts(wx, wy, ww, wh), 0.6, 6); ctx.fill(wp);
    ctx.strokeStyle = on ? P.dark : P.line; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
  }
  return { tl, tr, top: base - h - hr };
}
// stacked block masonry lines inside a box (clip first)
function masonry(ctx, R, x, y, w, h, bh, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let yy = y, row = 0; yy < y + h; yy += bh * (0.85 + R() * 0.3), row++) {
    ctx.moveTo(x, yy); ctx.lineTo(x + w, yy + (R() - 0.5) * 3);
    for (let xx = x + (row % 2) * bh; xx < x + w; xx += bh * (1.4 + R() * 1.2)) { ctx.moveTo(xx, yy); ctx.lineTo(xx + (R() - 0.5) * 3, yy + bh * 0.9); }
  }
  ctx.stroke();
}
function skull(ctx, x, y, s, bone, hole) {
  ctx.fillStyle = bone;
  ctx.beginPath(); ctx.ellipse(x, y, s * 0.5, s * 0.45, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, y + s * 0.38, s * 0.3, s * 0.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = hole;
  ctx.beginPath(); ctx.ellipse(x - s * 0.18, y + s * 0.06, s * 0.12, s * 0.14, 0, 0, TAU); ctx.ellipse(x + s * 0.18, y + s * 0.06, s * 0.12, s * 0.14, 0, 0, TAU); ctx.fill();
}
function candle(ctx, R, x, y, h, w, wax, P, glowR = 40) {
  glow(ctx, x, y - h - 6, glowR, P.glow(0.22));
  const p = wobPath(R, [[x - w / 2, y], [x - w / 2, y - h], [x + w / 2, y - h + 2], [x + w / 2, y]], 0.5, 5);
  ctx.fillStyle = wax; ctx.fill(p);
  ctx.fillStyle = wax; ctx.beginPath(); ctx.ellipse(x + w * 0.4, y - h * 0.6, w * 0.2, h * 0.25, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = P.glow(0.85);
  ctx.beginPath(); ctx.moveTo(x, y - h - 2); ctx.quadraticCurveTo(x + w * 0.4, y - h - 6, x, y - h - 6 - w * 0.9); ctx.quadraticCurveTo(x - w * 0.4, y - h - 6, x, y - h - 2); ctx.fill();
}
// lumpy cloud bank with lit tops
function cloudBank(ctx, R, x, y, w, color, lit) {
  const n = 6 + Math.floor(R() * 5), puffs = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1) - 0.5; puffs.push([x + t * w + (R() - 0.5) * w * 0.08, y - (1 - Math.abs(t) * 1.6) * w * 0.08 - R() * w * 0.05, w * (0.08 + R() * 0.08)]); }
  const p = new Path2D();
  for (const [px, py, r] of puffs) { p.moveTo(px + r, py); p.ellipse(px, py, r, r * 0.72, 0, 0, TAU); }
  p.moveTo(x - w * 0.55, y); p.ellipse(x, y + w * 0.02, w * 0.55, w * 0.06, 0, 0, TAU);
  // lit crown: fill with the light tone, then the body shifted down, so only a top band stays lit
  const lc = document.createElement('canvas');
  const bx = Math.floor(x - w * 0.8), by = Math.floor(y - w * 0.4), bw = Math.ceil(w * 1.6), bh = Math.ceil(w * 0.55);
  lc.width = bw; lc.height = bh;
  const c = lc.getContext('2d');
  c.translate(-bx, -by);
  c.fillStyle = lit; c.fill(p);
  c.globalCompositeOperation = 'destination-out';
  c.translate(2, 7); c.fill(p);
  ctx.fillStyle = color; ctx.fill(p);
  ctx.drawImage(lc, bx, by);
}
// open wood/iron framework (truss) between two x positions at y
function truss(ctx, R, x0, x1, y, h, color, lw) {
  wline(ctx, R, [[x0, y], [x1, y]], color, lw * 1.6);
  wline(ctx, R, [[x0, y + h], [x1, y + h]], color, lw * 1.6);
  const n = Math.max(2, Math.round((x1 - x0) / h));
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = x0 + (x1 - x0) * i / n, b = x0 + (x1 - x0) * (i + 1) / n;
    ctx.moveTo(a, y); ctx.lineTo(a, y + h); ctx.moveTo(a, i % 2 ? y : y + h); ctx.lineTo(b, i % 2 ? y + h : y);
  }
  ctx.stroke();
}
// sharp star glint
function glint(ctx, x, y, s, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x, y + s * 1.3); ctx.stroke();
}
// a floating rock island with a jagged underside
function island(ctx, R, x, y, w, P, color) {
  const pts = [[x - w / 2, y]], n = 7;
  for (let i = 1; i < n; i++) pts.push([x - w / 2 + w * i / n, y - 2 - R() * 6]);
  pts.push([x + w / 2, y]);
  const m = 14;
  for (let i = 1; i < m; i++) { const t = i / m; pts.push([x + w / 2 - w * t + (R() - 0.5) * w * 0.04, y + Math.pow(Math.sin(t * Math.PI), 0.8) * w * 0.42 * (0.75 + R() * 0.4) + (i % 3 === 0 ? w * 0.06 : 0)]); }
  const p = wobPath(R, pts, 1.5, 8);
  fillShape(ctx, R, p, color, P, { box: [x - w / 2, y - 10, w, w * 0.7], hatch: [1.2, 6] });
  return p;
}

// ---------- painters ----------
// signature: (ctx, R, depth, pal). Every object goes through at() so the strip wraps.
const PAINTERS = {
  // The Fray: a frayed cavern of hanging threads, tattered cloth and colossal sewing pins.
  threadcave(ctx, R, d, P) {
    if (d === 0) {
      for (const x of spread(R, 5)) at(ctx, R, x, 260, (r, x) => {
        const w = 150 + r() * 150;
        fillShape(ctx, r, cavePillar(r, x, w), P.col, P, { box: [x - w, 0, w * 2, H], hatch: [1.3, 10] });
      });
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 420, (r, x) => {
        const len = 520 + r() * 300, ang = (r() < 0.5 ? -1 : 1) * (0.15 + r() * 0.35), w = 20 + r() * 10;
        needle(ctx, r, x, H - 90, len, ang, w, P);
      });
      for (const x of spread(R, 4)) at(ctx, R, x, 200, (r, x) => tatter(ctx, r, x, 20 + r() * 50, 90 + r() * 120, 200 + r() * 260, P.col, P, false));
    } else if (d === 1) {
      for (const x of spread(R, 3)) at(ctx, R, x, 160, (r, x) => {
        const w = 130 + r() * 90;
        fillShape(ctx, r, cavePillar(r, x, w, -30, H + 30, 0.5), P.col, P, { box: [x - w, 0, w * 2, H], hatch: [1.2, 7] });
        // threads wound round the column
        for (let k = 0; k < 5; k++) { const yy = 200 + r() * 600; wline(ctx, r, qpts(x - w * 0.45, yy, x, yy + 18 + r() * 10, x + w * 0.45, yy + (r() - 0.5) * 20, 10), P.rimA(0.25), 1.5); }
        // pins stuck in the column
        for (let k = 0; k < 2; k++) {
          const py = 250 + r() * 450, s = r() < 0.5 ? -1 : 1;
          wline(ctx, r, [[x, py], [x + s * (60 + r() * 50), py - 20 - r() * 30]], P.lite, 3);
          ctx.fillStyle = P.lite; ctx.beginPath(); ctx.arc(x + s * (60 + 50 * 0.5), py - 35, 6, 0, TAU); ctx.fill();
        }
      });
      for (const x of spread(R, 3)) at(ctx, R, x, 140, (r, x) => tatter(ctx, r, x, 40 + r() * 60, 70 + r() * 60, 220 + r() * 220, P.col, P));
      // cat's-cradle threads strung across
      for (let i = 0; i < 6; i++) at(ctx, R, R() * W, 420, (r, x) => {
        const x1 = x + (r() < 0.5 ? -1 : 1) * (200 + r() * 200), y0 = 120 + r() * 400, y1 = y0 + (r() - 0.5) * 200;
        wline(ctx, r, sag(x, y0, x1, y1, 30 + r() * 80), P.lite, 1.4, 0.6);
      });
      for (let i = 0; i < 26; i++) at(ctx, R, R() * W, 30, (r, x) => dangle(ctx, r, x, 40, 120 + r() * 420, P.rimA(0.3), 1.3 + r(), r.pick(['knot', 'button', 'bead', 'knot', 'spool', '']), P));
    } else {
      for (let i = 0; i < 4; i++) at(ctx, R, R() * W, 120, (r, x) => {
        const k = 5 + Math.floor(r() * 7), len = 150 + r() * 260;
        for (let j = 0; j < k; j++) {
          const sx = x + (r() - 0.5) * 70, ex = x + (r() - 0.5) * 30;
          ribbon(ctx, r, qpts(sx, 60, (sx + ex) / 2 + (r() - 0.5) * 40, 60 + len * 0.5, ex, 60 + len * (0.6 + r() * 0.5), 14), 4 + r() * 4, 0.6, P.col);
        }
        ctx.fillStyle = P.col; ctx.beginPath(); ctx.ellipse(x, 60 + len * 0.45, 14 + r() * 8, 10 + r() * 6, r(), 0, TAU); ctx.fill();
      });
      at(ctx, R, R() * W, 200, (r, x) => cobweb(ctx, r, x, 75, 160, 0.2, Math.PI - 0.2, P.rimA(0.12)));
      for (let i = 0; i < 6; i++) at(ctx, R, R() * W, 60, (r, x) => {
        for (let j = 0; j < 4; j++) ribbon(ctx, r, qpts(x + j * 8, H - 100, x + j * 12 + (r() - 0.5) * 40, H - 160, x + (r() - 0.5) * 60, H - 180 - r() * 120, 10), 4, 0.5, P.col);
      });
    }
  },

  // Mossbell Hollows: a mossy cavern hung with colossal bronze bells.
  bells(ctx, R, d, P) {
    const bronze = (c) => mix(c, '#6b5228', [0.1, 0.16, 0.08][d]);
    if (d === 0) {
      for (const x of spread(R, 4)) at(ctx, R, x, 240, (r, x) => {
        const w = 150 + r() * 130;
        fillShape(ctx, r, cavePillar(r, x, w, -30, H + 30, 0.6), P.col, P, { box: [x - w, 0, w * 2, H], hatch: [1.4, 11] });
      });
      for (const x of spread(R, 3)) at(ctx, R, x, 280, (r, x) => {
        const s = 320 + r() * 160, y = 140 + r() * 120;
        chain(ctx, x, -20, x, y - s * 0.06, 34, P.col, 6);
        bell(ctx, r, x, y, s, bronze(P.col), P, { hatch: true });
      });
    } else if (d === 1) {
      for (const x of spread(R, 2, 0.4)) at(ctx, R, x, 200, (r, x) => {
        const w = 140 + r() * 80;
        fillShape(ctx, r, cavePillar(r, x, w, -30, H + 30, 0.5), P.col, P, { box: [x - w, 0, w * 2, H], hatch: [1.2, 7] });
        // moss beards on the column
        for (let k = 0; k < 5; k++) { const yy = 150 + r() * 600, mx = x + (r() - 0.5) * w * 0.5; for (let j = 0; j < 6; j++) ribbon(ctx, r, qpts(mx + j * 6 - 15, yy, mx + j * 6 - 15 + (r() - 0.5) * 10, yy + 30, mx + (r() - 0.5) * 30, yy + 40 + r() * 80, 8), 5, 0.5, mix(P.col, P.style.rim, 0.25)); }
        for (let k = 0; k < 4; k++) glow(ctx, x + (r() - 0.5) * w * 0.6, 200 + r() * 600, 12, P.acc(0.3));
      });
      for (let i = 0; i < 9; i++) at(ctx, R, R() * W, 50, (r, x) => fillShape(ctx, r, spike(r, x, 60, 30 + r() * 50, 100 + r() * 220), P.col, P, { rim: false }));
      for (const x of spread(R, 5)) at(ctx, R, x, 170, (r, x) => {
        const s = 110 + r() * 120, y = 160 + r() * 340;
        chain(ctx, x, -20, x, y - s * 0.05, 18, P.col, 3.5);
        if (r() < 0.4) chain(ctx, x - s * 0.15, y - s * 0.03, x - s * 0.15 - 60 - r() * 60, -20, 14, P.col, 2.5);
        const h = bell(ctx, r, x, y, s, bronze(P.col), P, { hatch: true, crack: r() < 0.4 });
        // moss draped over the shoulder
        const moss = mix(P.col, P.style.rim, 0.12);
        ctx.fillStyle = moss; ctx.beginPath(); ctx.ellipse(x, y + s * 0.03, s * 0.24, s * 0.07, 0, 0, TAU); ctx.fill();
        for (let k = 0; k < 10; k++) {
          const t = (r() - 0.5) * 0.48, mx = x + t * s, my = y + s * 0.05;
          ribbon(ctx, r, qpts(mx, my, mx + (r() - 0.5) * 8, my + 20, mx + t * s * 0.3 + (r() - 0.5) * 12, my + 20 + r() * s * 0.7, 8), 4 + r() * 4, 0.6, moss);
        }
        if (r() < 0.6) glow(ctx, x, y + h * 0.95, s * 0.6, P.acc(0.07));
      });
      for (let i = 0; i < 18; i++) at(ctx, R, R() * W, 20, (r, x) => { const gy = 80 + r() * 700; ctx.fillStyle = P.acc(0.35); ctx.beginPath(); ctx.arc(x, gy, 1.5 + r() * 2, 0, TAU); ctx.fill(); glow(ctx, x, gy, 14, P.acc(0.12)); });
    } else {
      at(ctx, R, R() * W, 260, (r, x) => {
        const s = 300 + r() * 80, y = 70;
        chain(ctx, x, -20, x, y, 30, P.col, 6);
        bell(ctx, r, x, y, s, bronze(P.col), P, { hatch: true, crack: true });
      });
      for (let i = 0; i < 14; i++) at(ctx, R, R() * W, 40, (r, x) => {
        const len = 80 + r() * 260;
        for (let j = 0; j < 3; j++) ribbon(ctx, r, qpts(x + j * 6, 60, x + j * 6 + (r() - 0.5) * 20, 60 + len / 2, x + (r() - 0.5) * 30, 60 + len * (0.7 + r() * 0.3), 10), 6, 0.6, P.col);
      });
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 30, (r, x) => chain(ctx, x, -10, x + (r() - 0.5) * 40, 200 + r() * 300, 20, P.col, 4));
    }
  },

  // Spindletown: a crooked rainy town under a giant spindle spire.
  town(ctx, R, d, P) {
    if (d === 0) {
      const n = pnoise(R, [2, 3, 7, 11], 0.6);
      const hill = new Path2D(); hill.moveTo(0, H + 10);
      for (let x = 0; x <= W; x += 10) hill.lineTo(x, 700 + n(x) * 60);
      hill.lineTo(W, H + 10); hill.closePath();
      fillShape(ctx, R, hill, P.col, P, { rim: false });
      // spindle spire
      at(ctx, R, R() * W, 120, (r, x) => {
        const base = 720, top = 60 + r() * 60;
        const p = wobPath(r, [[x - 34, base], [x - 22, base - 150], [x - 48, base - 210], [x - 48, base - 240], [x - 14, base - 270], [x - 9, top + 120], [x, top], [x + 9, top + 120], [x + 14, base - 270], [x + 48, base - 240], [x + 48, base - 210], [x + 22, base - 150], [x + 34, base]], 1.5, 10);
        fillShape(ctx, r, p, P.col, P, { box: [x - 50, top, 100, base - top], hatch: [Math.PI / 2, 6] });
        for (let k = 0; k < 6; k++) wline(ctx, r, [[x - 12, top + 150 + k * 50], [x + 12, top + 140 + k * 50 + 30]], P.line, 1.5);
        ctx.fillStyle = P.acc(0.4); ctx.fillRect(x - 3, top + 200, 6, 10);
      });
      for (let i = 0; i < 20; i++) at(ctx, R, R() * W, 60, (r, x) => {
        const w = 40 + r() * 60, h = 60 + r() * 140;
        house(ctx, r, x, 720 + n(x) * 60 + 20, w, h, P, true);
      });
      for (let i = 0; i < 4; i++) at(ctx, R, R() * W, 30, (r, x) => {
        const base = 700 + n(x) * 60, h = 250 + r() * 180;
        const p = wobPath(r, [[x - 14, base], [x - 12, base - h], [x - 18, base - h], [x, base - h - 90], [x + 18, base - h], [x + 12, base - h], [x + 14, base]], 1, 9);
        fillShape(ctx, r, p, P.col, P, {});
      });
    } else if (d === 1) {
      const n = pnoise(R, [2, 5, 9], 0.6);
      const roofs = [];
      for (const x of spread(R, 9)) at(ctx, R, x, 120, (r, x) => {
        const w = 90 + r() * 90, h = 160 + r() * 260, base = 860 + n(x) * 40;
        const hh = house(ctx, r, x, base, w, h, P, true);
        roofs.push([x, hh.top]);
      });
      // washing lines between houses
      for (let i = 0; i < 6; i++) at(ctx, R, R() * W, 220, (r, x) => {
        const y0 = 520 + r() * 180, x1 = x + 140 + r() * 80, y1 = y0 + (r() - 0.5) * 40, pts = sag(x, y0, x1, y1, 26 + r() * 20, 14);
        wline(ctx, r, pts, P.lite, 1.2);
        for (let k = 2; k < 13; k += 2 + Math.floor(r() * 2)) {
          const [cx, cy] = pts[k], cw = 12 + r() * 16, ch = 18 + r() * 30;
          const cp = wobPath(r, [[cx - cw / 2, cy], [cx + cw / 2, cy + 1], [cx + cw / 2 + 2, cy + ch], [cx + 2, cy + ch * 0.85], [cx - cw / 2, cy + ch]], 1, 6);
          fillShape(ctx, r, cp, r() < 0.3 ? mix(P.col, P.style.accent, 0.12) : P.lite, P, { shade: false, rw: 1.5 });
        }
      });
      for (let i = 0; i < 4; i++) at(ctx, R, R() * W, 40, (r, x) => {
        const base = 900, h = 200 + r() * 90;
        wline(ctx, r, [[x, base], [x + (r() - 0.5) * 8, base - h]], P.col, 5);
        wline(ctx, r, [[x, base - h], [x + 22, base - h - 6]], P.col, 3);
        glow(ctx, x + 22, base - h + 12, 70, P.glow(0.2));
        ctx.fillStyle = P.acc(0.75); ctx.fillRect(x + 17, base - h + 2, 10, 14);
        ctx.strokeStyle = P.col; ctx.lineWidth = 2; ctx.strokeRect(x + 17, base - h + 2, 10, 14);
      });
    } else {
      const n = pnoise(R, [1, 3, 5], 0.6);
      for (const x of spread(R, 4)) at(ctx, R, x, 220, (r, x) => {
        const w = 200 + r() * 150, base = H - 60, hr = 90 + r() * 120, y = base - 60 - r() * 80;
        const roof = wobPath(r, [[x - w / 2, base + 60], [x - w / 2, y], [x + (r() - 0.5) * 40, y - hr], [x + w / 2, y], [x + w / 2, base + 60]], 2, 10);
        fillShape(ctx, r, roof, P.col, P, { box: [x - w / 2, y - hr, w, base - y + hr], hatch: [0.6, 7] });
        if (r() < 0.6) { ctx.fillStyle = P.acc(0.6); glow(ctx, x, y + 30, 50, P.acc(0.15)); ctx.fillRect(x - 6, y + 20, 12, 18); }
        // chimney with pot
        const cx = x + (r() - 0.5) * w * 0.5;
        fillShape(ctx, r, wobPath(r, rectPts(cx - 10, y - hr * 0.8 - 60, 20, hr), 1, 8), P.col, P, { shade: false });
      });
      // bunting across the top
      at(ctx, R, R() * W, 500, (r, x) => {
        const pts = sag(x, 160, x + 900, 220, 90, 30);
        wline(ctx, r, pts, P.col, 2);
        for (let k = 1; k < 30; k += 2) { const [fx, fy] = pts[k]; ctx.fillStyle = k % 4 === 1 ? mix(P.col, P.style.accent, 0.15) : P.col; ctx.beginPath(); ctx.moveTo(fx - 8, fy); ctx.lineTo(fx + 8, fy + 1); ctx.lineTo(fx + 1, fy + 22); ctx.fill(); }
      });
      void n;
    }
  },

  // Glasswing Gardens: iron-ribbed glass vaults, some panes lit, hanging plants and moths.
  greenhouse(ctx, R, d, P) {
    const glass = (a) => P.glow(a);
    if (d === 0) {
      // distant domes
      for (const x of spread(R, 3)) at(ctx, R, x, 330, (r, x) => {
        const w = 420 + r() * 200, base = 900, spring = 560 - r() * 120;
        const p = wobPath(r, archPts(x, w, spring, base + 50, 0.62, 16), 2, 12);
        ctx.fillStyle = glass(0.05); ctx.fill(p);
        ctx.save(); ctx.clip(p);
        for (let k = -6; k <= 6; k++) wline(ctx, r, qpts(x + k * w / 13, base + 50, x + k * w / 20, spring, x, spring - w * 0.6, 10), P.col, 4);
        for (let yy = spring - w * 0.5; yy < base; yy += 50) wline(ctx, r, [[x - w, yy], [x + w, yy + 4]], P.col, 2.5);
        for (let k = 0; k < 12; k++) { ctx.fillStyle = glass(0.08 + r() * 0.08); ctx.fillRect(x - w / 2 + r() * w, spring - w * 0.3 + r() * 300, w / 13, 46); }
        ctx.restore();
        ctx.strokeStyle = P.col; ctx.lineWidth = 6; ctx.stroke(p);
      });
      // palms / fern silhouettes
      for (let i = 0; i < 5; i++) at(ctx, R, R() * W, 200, (r, x) => palm(ctx, r, x, 920, 260 + r() * 260, P.col));
    } else if (d === 1) {
      // the glass vault: tall gothic bays of iron ribs and panes, with plants pressing at the glass
      const bays = 5, bw = W / bays, base = H + 20;
      const off = R() * bw;
      for (let i = 0; i < bays; i++) at(ctx, R, off + i * bw, bw, (r, x) => {
        const w = bw * (0.78 + r() * 0.12), sp = 280 + r() * 160;
        const p = wobPath(r, archPts(x, w, sp, base, 0.7 + r() * 0.15, 14), 1.5, 10);
        ctx.save(); ctx.clip(p);
        ctx.fillStyle = P.glow(0.025); ctx.fill(p);
        const cols = 3 + Math.floor(r() * 2), pw = w / cols;
        const rows = []; for (let yy = sp - w * 0.75; yy < base; yy += 50 + r() * 40) rows.push(yy);
        for (let c = 0; c < cols; c++) for (let k = 0; k < rows.length - 1; k++) {
          const v = r(), px = x - w / 2 + c * pw, py = rows[k], ph = rows[k + 1] - py;
          if (v < 0.07) { glow(ctx, px + pw / 2, py + ph / 2, Math.max(pw, ph) * 0.8, P.glow(0.16)); if (r() < 0.6) moth(ctx, px + pw * r(), py + ph * r(), 4 + r() * 2, r() - 0.5, P.col); }
          else if (v < 0.13) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + pw, py + r() * ph * 0.5); ctx.lineTo(px + pw * r(), py + ph); ctx.lineTo(px + pw * 0.3, py + ph * 0.4); ctx.fill(); }
          else { ctx.fillStyle = r() < 0.5 ? P.glow(r() * 0.035) : 'rgba(0,0,0,' + (r() * 0.07).toFixed(3) + ')'; ctx.fillRect(px, py, pw, ph); }
          // condensation streaks
          if (r() < 0.3) { ctx.strokeStyle = P.glow(0.05); ctx.lineWidth = 1; ctx.beginPath(); const sx = px + r() * pw; ctx.moveTo(sx, py + 2); ctx.lineTo(sx + 1, py + ph * (0.4 + r() * 0.6)); ctx.stroke(); }
        }
        // foliage inside, silhouetted against the glass
        for (let k = 0; k < 2; k++) palm(ctx, r, x + (r() - 0.5) * w * 0.6, base, 220 + r() * 300, mix(P.col, P.style.sky[1], 0.3));
        bigLeaves(ctx, r, x + (r() - 0.5) * w * 0.5, H - 60, 160 + r() * 80, P);
        for (let c = 1; c < cols; c++) {
          const mx = x - w / 2 + c * pw, t = (mx - x) / (w / 2);
          wline(ctx, r, qpts(mx, base, mx, sp, x + t * w * 0.1, sp - w * 0.7, 12), P.col, 2.5);
        }
        for (const yy of rows) wline(ctx, r, [[x - w / 2, yy], [x + w / 2, yy + (r() - 0.5) * 4]], rgba(P.col, 0.75), 1.3);
        ctx.restore();
        // heavy iron rib frame, with a second inner rib
        ctx.strokeStyle = P.col; ctx.lineWidth = 8; ctx.stroke(p);
        ctx.save(); ctx.translate(2, 2); ctx.strokeStyle = P.rim; ctx.lineWidth = 1.5; ctx.stroke(p); ctx.restore();
        for (const s of [-1, 1]) curl(ctx, r, x + s * w / 2 - s * 18, sp + 10, 14, s, P.col);
        // creeping vine over the frame
        const vs = r() < 0.5 ? -1 : 1;
        for (let k = 0; k < 3; k++) vine(ctx, r, x + vs * (w / 2 - 10 - k * 30), sp - w * 0.2 + k * 20, 100 + r() * 260, P.col, P.col, 2.5, 1.2);
      });
      // iron roof girder tying the bays together
      truss(ctx, R, -10, W + 10, 170, 46, P.col, 3);
      for (let x = 0; x < W; x += W / 12) { ctx.strokeStyle = P.col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + W / 24, 216, W / 24 - 4, Math.PI, 0); ctx.stroke(); }
      // hanging baskets with trailing vines
      for (let i = 0; i < 5; i++) at(ctx, R, R() * W, 60, (r, x) => {
        const y = 200 + r() * 260;
        chain(ctx, x, 0, x, y, 12, P.col, 2);
        ctx.fillStyle = P.col; ctx.beginPath(); ctx.moveTo(x - 26, y); ctx.quadraticCurveTo(x, y + 40, x + 26, y); ctx.fill();
        for (let k = 0; k < 4; k++) vine(ctx, r, x - 20 + k * 13, y + 6, 80 + r() * 200, P.col, P.col, 2.5, 1.2);
        for (let k = 0; k < 5; k++) leaf(ctx, x - 20 + r() * 40, y, 18 + r() * 12, -Math.PI / 2 + (r() - 0.5) * 2, 7, P.col);
      });
      for (let i = 0; i < 9; i++) at(ctx, R, R() * W, 10, (r, x) => moth(ctx, x, 250 + r() * 500, 4 + r() * 3, (r() - 0.5), P.lite, glass(0.12)));
    } else {
      for (let i = 0; i < 5; i++) at(ctx, R, R() * W, 160, (r, x) => {
        for (let k = 0; k < 6; k++) vine(ctx, r, x + (r() - 0.5) * 120, 40, 120 + r() * 320, P.col, P.col, 4, 1.8);
        for (let k = 0; k < 12; k++) leaf(ctx, x + (r() - 0.5) * 150, 60 + r() * 50, 40 + r() * 40, Math.PI / 2 + (r() - 0.5) * 2.2, 14 + r() * 8, P.col, P.line);
      });
      for (let i = 0; i < 4; i++) at(ctx, R, R() * W, 200, (r, x) => bigLeaves(ctx, r, x, H - 40, 220 + r() * 120, P));
      for (let i = 0; i < 4; i++) at(ctx, R, R() * W, 10, (r, x) => moth(ctx, x, 200 + r() * 500, 6 + r() * 3, r() - 0.5, P.lite, glass(0.15)));
    }
  },

  // Tallow Catacombs: ossuary walls of arched niches stacked with skulls, lit by candles.
  crypt(ctx, R, d, P) {
    const bone = P.rimA([0.1, 0.22, 0.2][d]);
    if (d === 0) {
      const bays = 6, bw = W / bays, off = R() * bw;
      for (let i = 0; i < bays; i++) at(ctx, R, off + i * bw, bw, (r, x) => {
        const w = bw * 0.62, sp = 380 + r() * 40;
        const p = new Path2D();
        addWob(p, r, rectPts(x - bw / 2 - 2, 120, bw + 4, H), 2, 14);
        addWob(p, r, archPts(x, w, sp, H + 40, 0.5, 14), 2, 12);
        fillShape(ctx, r, p, P.col, P, { rule: 'evenodd', box: [x - bw / 2, 120, bw, H], hatch: [1.2, 9] });
        ctx.save(); ctx.clip(p, 'evenodd'); masonry(ctx, r, x - bw / 2, 120, bw, H, 34, P.line); ctx.restore();
        glow(ctx, x + (r() - 0.5) * w * 0.5, 700 + r() * 120, 90, P.glow(0.18));
      });
    } else if (d === 1) {
      for (const x of spread(R, 3, 0.4)) at(ctx, R, x, 280, (r, x) => {
        const w = 360 + r() * 160, top = 160 + r() * 120;
        const p = new Path2D();
        const outline = [[x - w / 2, H + 20], [x - w / 2 + 6, top + 30]];
        for (let k = 1; k < 8; k++) outline.push([x - w / 2 + w * k / 8, top + (r() < 0.4 ? r() * 60 : 0)]);
        outline.push([x + w / 2 - 6, top + 20], [x + w / 2, H + 20]);
        addWob(p, r, outline, 2, 10);
        const niches = [], bands = [];
        let yb = top + 70;
        while (yb < H - 120) {
          if (r() < 0.3) { // a band of stacked bone-ends set into the wall
            const bh = 34 + r() * 26; bands.push([yb, bh]); yb += bh + 16; continue;
          }
          const rh = 110 + r() * 70, n = 2 + Math.floor(r() * 4), nw = w / n, f = r() < 0.4 ? 0.8 : 0.5;
          for (let c = 0; c < n; c++) {
            if (r() < 0.12) continue;
            const nx = x - w / 2 + (c + 0.5) * nw + (r() - 0.5) * 10, ww = nw * (0.45 + r() * 0.25), nb = yb + rh;
            const sp = nb - Math.min(rh * 0.55, ww * 0.9);
            addWob(p, r, archPts(nx, ww, sp, nb, f, 8), 1, 8);
            niches.push([nx, ww, sp, nb, f]);
          }
          yb += rh + 26;
        }
        fillShape(ctx, r, p, P.col, P, { rule: 'evenodd', box: [x - w / 2, top, w, H - top], hatch: [1.1, 8] });
        ctx.save(); ctx.clip(p, 'evenodd'); masonry(ctx, r, x - w / 2, top, w, H, 26, P.line);
        for (const [by, bh] of bands) {
          ctx.fillStyle = P.deep; ctx.fillRect(x - w / 2, by, w, bh);
          for (let yy = by + 6; yy < by + bh - 2; yy += 9) for (let xx = x - w / 2 + ((yy / 9) % 2) * 5; xx < x + w / 2; xx += 10) {
            ctx.fillStyle = bone; ctx.beginPath(); ctx.ellipse(xx + (r() - 0.5) * 2, yy, 4, 3.5, 0, 0, TAU); ctx.fill();
          }
          for (let xx = x - w / 2 + 20 + r() * 30; xx < x + w / 2 - 10; xx += 50 + r() * 40) skull(ctx, xx, by + bh / 2, 16, bone, P.deep);
          ctx.fillStyle = P.col; ctx.fillRect(x - w / 2, by - 4, w, 5); ctx.fillRect(x - w / 2, by + bh, w, 5);
        }
        ctx.restore();
        // niche contents
        for (const [nx, ww, sp, nb, f] of niches) {
          ctx.fillStyle = P.deep; ctx.fill(wobPath(r, archPts(nx, ww, sp, nb, f, 8), 1, 8));
          const v = r();
          if (v < 0.55) {
            const k = 2 + Math.floor(r() * 2);
            for (let s = 0; s < k; s++) skull(ctx, nx - ww * 0.3 + s * ww * 0.6 / Math.max(1, k - 1), nb - 12, 15 + r() * 4, bone, P.deep);
            if (r() < 0.6) skull(ctx, nx + (r() - 0.5) * 10, nb - 32, 15, bone, P.deep);
            ctx.fillStyle = bone; ctx.fillRect(nx - ww * 0.45, nb - 4, ww * 0.9, 4);
          } else if (v < 0.85) {
            candle(ctx, r, nx + (r() - 0.5) * ww * 0.4, nb, 14 + r() * 14, 6, mix(P.col, P.style.rim, 0.3), P, 60);
            if (r() < 0.5) candle(ctx, r, nx + ww * 0.28, nb, 8 + r() * 8, 5, mix(P.col, P.style.rim, 0.3), P, 40);
          }
          // wax drip below the sill
          if (r() < 0.4) ribbon(ctx, r, [[nx - 4, nb], [nx - 3, nb + 10], [nx - 2, nb + 14 + r() * 20]], 5, 2, mix(P.col, P.style.rim, 0.22));
        }
      });
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 80, (r, x) => {
        const y = 200 + r() * 160;
        chain(ctx, x - 40, 0, x, y, 12, P.col, 2); chain(ctx, x + 40, 0, x, y, 12, P.col, 2);
        ctx.strokeStyle = P.col; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x, y + 8, 46, 9, 0, 0, TAU); ctx.stroke();
        for (let k = 0; k < 5; k++) candle(ctx, r, x - 40 + k * 20, y + 8, 10 + r() * 10, 5, mix(P.col, P.style.rim, 0.25), P, 34);
      });
    } else {
      for (const x of spread(R, 2, 0.5)) at(ctx, R, x, 120, (r, x) => {
        const w = 70 + r() * 40;
        const p = wobPath(r, [[x - w / 2 - 20, H + 20], [x - w / 2 - 14, H - 80], [x - w / 2, H - 100], [x - w / 2 + 4, 90], [x - w / 2 - 14, 60], [x + w / 2 + 14, 55], [x + w / 2 - 2, 90], [x + w / 2, H - 100], [x + w / 2 + 16, H - 80], [x + w / 2 + 20, H + 20]], 2, 10);
        fillShape(ctx, r, p, P.col, P, { box: [x - w, 0, w * 2, H], hatch: [Math.PI / 2 + 0.1, 6] });
        // candle ledge with dripping wax
        const ly = 380 + r() * 260;
        ctx.fillStyle = P.col; ctx.fillRect(x - w / 2 - 22, ly, w + 44, 10);
        for (let k = 0; k < 3; k++) candle(ctx, r, x - w / 2 - 10 + k * (w + 20) / 2, ly, 16 + r() * 22, 7, mix(P.col, P.style.rim, 0.2), P, 70);
        for (let k = 0; k < 6; k++) ribbon(ctx, r, [[x - w / 2 - 18 + r() * (w + 36), ly + 8], [x - w / 2 + r() * w, ly + 30 + r() * 60]], 5, 1, mix(P.col, P.style.rim, 0.12));
      });
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 90, (r, x) => {
        for (let k = 0; k < 12; k++) skull(ctx, x + (r() - 0.5) * 120, H - 165 + r() * 30 - (k > 8 ? 20 : 0), 18 + r() * 8, P.lite, P.deep);
        for (let k = 0; k < 6; k++) { const a = (r() - 0.5) * 1.2; wline(ctx, r, [[x - 50 + r() * 100, H - 160], [x - 50 + r() * 100 + Math.cos(a) * 50, H - 160 + Math.sin(a) * 20]], P.lite, 5); }
      });
      at(ctx, R, R() * W, 200, (r, x) => cobweb(ctx, r, x, 85, 150, 0.15, Math.PI - 0.15, P.rimA(0.12)));
    }
  },

  // Hushwood: a towering, glowing mushroom forest.
  fungal(ctx, R, d, P) {
    if (d === 0) {
      for (const x of spread(R, 6)) at(ctx, R, x, 260, (r, x) => shroom(ctx, r, x, H - 60, 380 + r() * 380, 200 + r() * 260, P, P.col, false));
    } else if (d === 1) {
      for (const x of spread(R, 5)) at(ctx, R, x, 220, (r, x) => shroom(ctx, r, x, H - 80, 300 + r() * 320, 150 + r() * 200, P, P.col, true));
      for (let i = 0; i < 7; i++) at(ctx, R, R() * W, 60, (r, x) => { for (let k = 0; k < 4; k++) shroom(ctx, r, x + (r() - 0.5) * 70, H - 100, 30 + r() * 60, 24 + r() * 30, P, P.col, true); });
      for (let i = 0; i < 40; i++) at(ctx, R, R() * W, 20, (r, x) => { const y = 100 + r() * 750; glow(ctx, x, y, 10 + r() * 10, P.acc(0.25)); });
    } else {
      for (let i = 0; i < 2; i++) at(ctx, R, R() * W, 300, (r, x) => shroom(ctx, r, x, H - 60, 620 + r() * 200, 360 + r() * 160, P, P.col, true));
      for (let i = 0; i < 10; i++) at(ctx, R, R() * W, 80, (r, x) => {
        for (let k = 0; k < 9; k++) ribbon(ctx, r, qpts(x + k * 6 - 24, H - 80, x + k * 8 - 30 + (r() - 0.5) * 30, H - 140, x + (k - 4) * 14 + (r() - 0.5) * 30, H - 150 - r() * 120, 8), 5, 0.5, P.col);
      });
      for (let i = 0; i < 4; i++) at(ctx, R, R() * W, 60, (r, x) => shroom(ctx, r, x, H - 90, 80 + r() * 90, 60 + r() * 50, P, P.col, true));
    }
  },

  // The Pinworks: the guild's forge-ruin. Forests of colossal dressmaker pins and chained needles,
  // all leaning toward the fallen lodestone; horseshoe magnets haloed in iron-filing field lines;
  // tomato-pincushion mountains, cast-iron treadle frames and the orange breath of quench troughs.
  pinworks(ctx, R, d, P) {
    const fade = [0.6, 0.42, 0.74][d];
    const red = mix('#c4372b', P.col, fade), silver = mix('#c9d2dc', P.col, fade + 0.06);
    const heads = ['#b8392d', '#c98a45', '#5d7d9f', '#cfc8b8', '#b8392d'].map((c) => mix(c, P.col, fade + [0.12, 0.2, 0.08][d]));
    const head = (r) => heads[Math.floor(r() * heads.length)];
    const thread = mix('#c4372b', P.col, fade + 0.1);
    const forge = (a) => `rgba(255,140,60,${(a * [0.55, 1, 0.8][d]).toFixed(3)})`;
    const lean = (r) => 0.22 + (r() - 0.45) * 0.6; // the pull of the lodestone
    if (d === 0) {
      for (let i = 0; i < 4; i++) at(ctx, R, R() * W, 340, (r, x) => glow(ctx, x, H - 140 - r() * 140, 280 + r() * 160, forge(0.09)));
      // a great magnet hung in the haze, its field drawn out in filings
      at(ctx, R, R() * W, 460, (r, x) => {
        const y = 300 + r() * 80, s = 120, a = (r() - 0.5) * 0.3;
        filings(ctx, r, magnetPoles(x, y, s, a), 440, P.rimA(0.16), 1.6);
        chain(ctx, x + 30, -10, x + Math.sin(a) * s, y - Math.cos(a) * s, 16, P.col, 3);
        magnet(ctx, r, x, y, s, a, P, red, silver);
      });
      // treadle ironwork looming in the haze: the stands the guild's machines once rode on
      for (const x of spread(R, 2, 0.4)) at(ctx, R, x, 420, (r, x) => treadle(ctx, r, x, H - 110, 520 + r() * 120, P, P.col, red));
      // pincushion mountains bristling with pins
      for (const x of spread(R, 3, 0.5)) at(ctx, R, x, 480, (r, x) => pincushion(ctx, r, x, H - 100, 300 + r() * 140, 240 + r() * 120, P, mix(P.col, red, 0.25), head));
      // the distant pin forest
      for (let i = 0; i < 18; i++) at(ctx, R, R() * W, 160, (r, x) => pin(ctx, r, x, H - 90 - r() * 30, 280 + r() * 420, lean(r), 6 + r() * 4, 10 + r() * 6, P, P.col, head(r)));
      for (let i = 0; i < 2; i++) at(ctx, R, R() * W, 260, (r, x) => hangNeedle(ctx, r, x, 160 + r() * 160, 360 + r() * 160, 0.2 + (r() - 0.5) * 0.4, 16, P, P.col, thread));
    } else if (d === 1) {
      // magnets with their filing halos: one hung on a chain, one stood poles-up on the floor
      at(ctx, R, R() * W, 420, (r, x) => {
        const y = 200 + r() * 120, s = 82 + r() * 20, a = (r() - 0.5) * 0.5;
        filings(ctx, r, magnetPoles(x, y, s, a), 340, P.rimA(0.34), 1.5);
        chain(ctx, x - 20, -10, x + Math.sin(a) * s, y - Math.cos(a) * s, 14, P.col, 3);
        magnet(ctx, r, x, y, s, a, P, red, silver);
      });
      at(ctx, R, R() * W, 360, (r, x) => {
        const s = 64 + r() * 14, y = H - 125 - s;
        filings(ctx, r, magnetPoles(x, y, s, Math.PI), 280, P.rimA(0.32), 1.4);
        magnet(ctx, r, x, y, s, Math.PI, P, red, silver);
      });
      // chained needles threaded with red
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 260, (r, x) => hangNeedle(ctx, r, x, 170 + r() * 260, 280 + r() * 180, 0.15 + (r() - 0.5) * 0.6, 18, P, P.col, thread));
      // coils of wire hung to temper
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 60, (r, x) => coil(ctx, r, x, 60 + r() * 60, 18 + r() * 14, 140 + r() * 200, 8 + Math.floor(r() * 7), P.col, P));
      // groves of pins stuck into the floor
      for (let i = 0; i < 6; i++) at(ctx, R, R() * W, 200, (r, x) => {
        const n = 2 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) pin(ctx, r, x + (r() - 0.5) * 140, H - 140 + r() * 20, 180 + r() * 300, lean(r), 6 + r() * 4, 8 + r() * 5, P, P.col, head(r));
      });
      // quench troughs breathing forge light
      for (let i = 0; i < 2; i++) at(ctx, R, R() * W, 200, (r, x) => trough(ctx, r, x, H - 140, 150 + r() * 80, P, P.col, forge));
      for (let i = 0; i < 2; i++) at(ctx, R, R() * W, 120, (r, x) => anvil(ctx, r, x, H - 140, 80 + r() * 30, P, P.col));
      for (let i = 0; i < 46; i++) at(ctx, R, R() * W, 10, (r, x) => { ctx.fillStyle = forge(0.45 + r() * 0.4); ctx.fillRect(x, H - 160 - r() * 600, 2, 2); });
    } else {
      // near: a few colossal dark pins and a needle swinging close to the eye
      for (let i = 0; i < 2; i++) at(ctx, R, R() * W, 220, (r, x) => pin(ctx, r, x, H - 80, 420 + r() * 200, lean(r) * 0.6, 14 + r() * 6, 24 + r() * 10, P, P.col, head(r)));
      at(ctx, R, R() * W, 380, (r, x) => hangNeedle(ctx, r, x, 120 + r() * 120, 640, 0.25, 22, P, P.col, thread));
      for (let i = 0; i < 2; i++) at(ctx, R, R() * W, 60, (r, x) => coil(ctx, r, x, -10, 26, 220 + r() * 160, 9, P.col, P));
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 40, (r, x) => {
        const y = 160 + r() * 260;
        chain(ctx, x, -10, x, y, 22, P.col, 5);
        ctx.strokeStyle = P.col; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(x + 14, y + 20, 18, Math.PI * 0.95, Math.PI * 0.1, true); ctx.stroke();
      });
      at(ctx, R, R() * W, 200, (r, x) => trough(ctx, r, x, H - 90, 240, P, P.col, forge));
      // filings bristling up off the floor toward the pull
      for (let i = 0; i < 16; i++) at(ctx, R, R() * W, 60, (r, x) => {
        for (let k = 0; k < 14; k++) { const a = 0.3 + (r() - 0.5) * 0.7, l = 10 + r() * 34, bx = x + (r() - 0.5) * 80; wline(ctx, r, [[bx, H - 70], [bx + Math.sin(a) * l, H - 70 - Math.cos(a) * l]], P.col, 2 + r() * 2); }
      });
    }
  },

  // Brine Cistern: drowned aqueducts with spilling water.
  aqueduct(ctx, R, d, P) {
    const water = (a) => P.acc(a);
    if (d === 0) {
      // two-tier arcade spanning the whole strip (arches evenly divide W, so it wraps)
      for (const [tier, n, top, bot] of [[0, 9, 420, 760], [1, 18, 260, 420]]) {
        const p = new Path2D(), aw = W / n;
        addWob(p, R, rectPts(-4, top, W + 8, (bot - top) + (tier === 0 ? 400 : 0)), 2, 16);
        for (let i = 0; i < n; i++) addWob(p, R, archPts((i + 0.5) * aw, aw * 0.66, top + (bot - top) * 0.35, tier === 0 ? H + 40 : bot - 18, 0.5, 10), 1.5, 12);
        fillShape(ctx, R, p, P.col, P, { rule: 'evenodd', box: [0, top, W, bot - top + 300], hatch: [1.1, 10] });
      }
      for (let i = 0; i < 4; i++) at(ctx, R, R() * W, 30, (r, x) => { ctx.fillStyle = water(0.1); ctx.fillRect(x, 260, 10 + r() * 14, H); });
    } else if (d === 1) {
      const n = 4, aw = W / n, off = R() * aw, top = 300;
      for (let i = 0; i < n; i++) at(ctx, R, off + i * aw, aw, (r, x) => {
        const p = new Path2D(), w = aw * (0.55 + r() * 0.1), broken = r() < 0.35;
        // deck + upper gallery of small arches
        const gt = top - 110;
        const outline = [[x - aw / 2 - 2, H + 30], [x - aw / 2 - 2, gt]];
        if (broken) { const bx = x + (r() - 0.5) * aw * 0.3; outline.push([bx - 60, gt], [bx - 40, gt + 70], [bx - 10, gt + 50], [bx + 10, gt + 120], [bx + 40, gt + 60], [bx + 70, gt]); }
        outline.push([x + aw / 2 + 2, gt], [x + aw / 2 + 2, H + 30]);
        addWob(p, r, outline, 2, 12);
        addWob(p, r, archPts(x, w, top + 180 + r() * 40, H + 60, 0.5, 14), 2, 12);
        for (let k = 0; k < 5; k++) { const gx = x - aw / 2 + (k + 0.5) * aw / 5; if (broken && Math.abs(gx - x) < 90) continue; addWob(p, r, archPts(gx, aw / 5 * 0.55, gt + 40, top - 14, 0.5, 6), 1, 8); }
        fillShape(ctx, r, p, P.col, P, { rule: 'evenodd', box: [x - aw / 2, gt, aw, H], hatch: [1.2, 8] });
        ctx.save(); ctx.clip(p, 'evenodd'); masonry(ctx, r, x - aw / 2, gt, aw, H, 30, P.line);
        // waterline stains and weed
        for (let k = 0; k < 3; k++) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x - aw / 2, H - 260 - k * 40 - r() * 20, aw, 8 + r() * 10); }
        ctx.restore();
        ctx.fillStyle = P.col; ctx.fillRect(x - aw / 2 - 6, top - 10, aw + 12, 14);
        // water spilling from the channel (through the break, or from a spout)
        const sx = broken ? x + 10 : x + (r() - 0.5) * aw * 0.6, sy = broken ? gt + 110 : top + 50 + r() * 60;
        if (broken || r() < 0.6) {
          if (!broken) { ctx.fillStyle = P.col; ctx.fillRect(sx - 12, sy - 8, 26, 16); }
          const fall = H - sy, ww = broken ? 30 : 10;
          ribbon(ctx, r, qpts(sx + 14, sy, sx + 24, sy + 30, sx + 28, sy + fall, 18), ww, ww * 2.2, water(0.16), 0.4);
          ribbon(ctx, r, qpts(sx + 16, sy + 2, sx + 22, sy + 30, sx + 26, sy + fall, 18), ww * 0.25, ww * 0.6, water(0.35), 0.5);
          glow(ctx, sx + 28, H - 130, 60, water(0.12));
        }
        for (let k = 0; k < 10; k++) { const bx = x - aw / 2 + r() * aw, by = top + 300 + r() * 400; ctx.strokeStyle = P.rim; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(bx, by, 2 + r() * 4, 0, TAU); ctx.stroke(); }
      });
      for (let i = 0; i < 8; i++) at(ctx, R, R() * W, 40, (r, x) => fillShape(ctx, r, spike(r, x, 60, 20 + r() * 40, 80 + r() * 160), P.col, P, { rim: false }));
    } else {
      for (let i = 0; i < 10; i++) at(ctx, R, R() * W, 40, (r, x) => {
        const w = 20 + r() * 40, len = 120 + r() * 250;
        fillShape(ctx, r, spike(r, x, 60, w, len), P.col, P, { rim: false });
        if (r() < 0.6) { ctx.fillStyle = water(0.5); ctx.beginPath(); ctx.ellipse(x, 70 + len + 14 + r() * 40, 2, 3.5, 0, 0, TAU); ctx.fill(); }
      });
      at(ctx, R, R() * W, 300, (r, x) => {
        const y = 280 + r() * 150;
        wline(ctx, r, [[x - 300, y], [x, y]], P.col, 46);
        ctx.fillStyle = P.col; ctx.fillRect(x - 10, y - 32, 18, 64);
        ctx.strokeStyle = P.rim; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 300, y - 20); ctx.lineTo(x - 12, y - 20); ctx.stroke();
        ribbon(ctx, r, qpts(x + 8, y, x + 60, y + 30, x + 80, H, 20), 26, 46, water(0.14), 0.5);
        ribbon(ctx, r, qpts(x + 8, y - 6, x + 54, y + 20, x + 74, H, 20), 4, 10, water(0.3), 0.5);
      });
    }
  },

  // Ashen Kilns: bottle kilns and glassworks glowing in smoke.
  furnace(ctx, R, d, P) {
    if (d === 0) {
      for (let i = 0; i < 6; i++) at(ctx, R, R() * W, 200, (r, x) => {
        const y = 100 + r() * 300, w = 200 + r() * 260;
        ctx.fillStyle = P.rimA(0.04); ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.35, 0, 0, TAU); ctx.fill();
      });
      for (const x of spread(R, 4)) at(ctx, R, x, 200, (r, x) => bottleKiln(ctx, r, x, H - 140, 160 + r() * 80, 420 + r() * 260, P));
      ctx.fillStyle = P.glow(0.0);
    } else if (d === 1) {
      for (const x of spread(R, 3)) at(ctx, R, x, 160, (r, x) => bottleKiln(ctx, r, x, H - 170, 140 + r() * 60, 380 + r() * 160, P));
      // glass racks
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 160, (r, x) => {
        const w = 220 + r() * 80, top = 440 + r() * 120;
        for (const s of [-1, 1]) wline(ctx, r, [[x + s * w / 2, top - 20], [x + s * w / 2, H]], P.col, 6);
        for (let row = 0; row < 3; row++) {
          const y = top + row * 110;
          wline(ctx, r, [[x - w / 2 - 6, y], [x + w / 2 + 6, y + (r() - 0.5) * 4]], P.col, 5);
          let bx = x - w / 2 + 10;
          while (bx < x + w / 2 - 20) { const bw = 12 + r() * 18; vessel(ctx, r, bx + bw / 2, y - 2, bw, 30 + r() * 50, P); bx += bw + 6 + r() * 10; }
        }
      });
      // hanging crucibles
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 60, (r, x) => {
        const y = 200 + r() * 200;
        chain(ctx, x, -10, x, y, 14, P.col, 3);
        glow(ctx, x, y + 40, 80, P.glow(0.28));
        ctx.fillStyle = P.col; ctx.beginPath(); ctx.moveTo(x - 30, y + 10); ctx.lineTo(x + 30, y + 10); ctx.lineTo(x + 20, y + 50); ctx.lineTo(x - 20, y + 50); ctx.fill();
        ctx.fillStyle = P.acc(0.8); ctx.beginPath(); ctx.ellipse(x, y + 12, 26, 5, 0, 0, TAU); ctx.fill();
      });
      for (let i = 0; i < 40; i++) at(ctx, R, R() * W, 10, (r, x) => { ctx.fillStyle = P.acc(0.4 + r() * 0.4); ctx.fillRect(x, 100 + r() * 800, 2, 2); });
    } else {
      const n = pnoise(R, [2, 4, 7, 13], 0.6);
      const p = new Path2D(); p.moveTo(0, H + 10);
      for (let x = 0; x <= W; x += 8) p.lineTo(x, H - 120 + n(x) * 70);
      p.lineTo(W, H + 10); p.closePath();
      fillShape(ctx, R, p, P.col, P, { box: [0, H - 220, W, 220], hatch: [0.4, 7] });
      // glowing cracks in the slag
      for (let i = 0; i < 9; i++) at(ctx, R, R() * W, 80, (r, x) => {
        const y = H - 80 + n(x) * 70 + 20;
        const pts = []; let cx = x, cy = y;
        for (let k = 0; k < 6; k++) { pts.push([cx, cy]); cx += 10 + r() * 20; cy += (r() - 0.5) * 20; }
        glow(ctx, x + 50, y, 70, P.glow(0.15));
        wline(ctx, r, pts, P.acc(0.6), 2);
      });
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 50, (r, x) => {
        const y = 160 + r() * 250;
        chain(ctx, x, -10, x, y, 22, P.col, 5);
        ctx.strokeStyle = P.col; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(x + 14, y + 20, 18, Math.PI * 0.95, Math.PI * 0.1, true); ctx.stroke();
      });
    }
  },

  // Mirrored Deep: faceted crystal caverns over a still reflecting pool.
  prisms(ctx, R, d, P) {
    if (d === 0) {
      for (const x of spread(R, 5)) at(ctx, R, x, 220, (r, x) => { glow(ctx, x, 720, 260, P.glow(0.16)); crystalCluster(ctx, r, x, H - 110, 150 + r() * 120, -1, P, true); });
      for (const x of spread(R, 4)) at(ctx, R, x, 200, (r, x) => crystalCluster(ctx, r, x, 70, 110 + r() * 90, 1, P, false));
      // a far, still mirror-lake horizon
      ctx.fillStyle = P.glow(0.08); ctx.fillRect(0, H - 130, W, 3);
    } else if (d === 1) {
      const wy = H - 150;
      // colossal hexagonal crystal pillars, floor to ceiling
      for (const x of spread(R, 2, 0.4)) at(ctx, R, x, 120, (r, x) => {
        const w = 80 + r() * 50, lean = (r() - 0.5) * 80;
        const faces = [[-0.5, -0.2], [-0.2, 0.25], [0.25, 0.5]];
        faces.forEach(([a, b], k) => {
          const p = wobPath(r, [[x + a * w, H + 20], [x + b * w, H + 20], [x + b * w + lean, -20], [x + a * w + lean, -20]], 1, 14);
          ctx.fillStyle = [P.lite, mix(P.lite, P.style.accent, 0.1), P.col][k]; ctx.fill(p);
        });
        ctx.strokeStyle = P.rim; ctx.lineWidth = 1.5;
        for (const f of [-0.2, 0.25]) { ctx.beginPath(); ctx.moveTo(x + f * w, H); ctx.lineTo(x + f * w + lean, 0); ctx.stroke(); }
        for (let k = 0; k < 4; k++) { const t = r(); glint(ctx, x + lean * (1 - t) + (r() - 0.5) * w * 0.4, H * t, 4 + r() * 5, P.acc(0.5)); }
        glow(ctx, x + lean * 0.5, H * 0.5, w * 2, P.glow(0.08));
      });
      for (const x of spread(R, 4)) at(ctx, R, x, 200, (r, x) => {
        const s = 100 + r() * 130;
        glow(ctx, x, wy - s * 0.6, s, P.glow(0.1));
        crystalCluster(ctx, r, x, wy, s, -1, P, true);
        // reflection
        ctx.save(); ctx.globalAlpha = 0.35; ctx.translate(0, wy * 2); ctx.scale(1, -1);
        crystalCluster(ctx, rng(Math.floor(r() * 1e9)), x, wy, s * 0.8, -1, P, false);
        ctx.restore();
      });
      for (const x of spread(R, 4)) at(ctx, R, x, 160, (r, x) => crystalCluster(ctx, r, x, 80, 120 + r() * 100, 1, P, true));
      // floating mirror shards
      for (let i = 0; i < 12; i++) at(ctx, R, R() * W, 40, (r, x) => {
        const y = 200 + r() * 450, s = 10 + r() * 22, a = r() * TAU;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.fillStyle = P.lite; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.5, 0); ctx.lineTo(0, s * 1.2); ctx.lineTo(-s * 0.45, 0); ctx.fill();
        ctx.strokeStyle = P.acc(0.4); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.5, 0); ctx.stroke();
        ctx.restore();
        glint(ctx, x + s * 0.4, y - s * 0.5, 5, P.acc(0.6));
      });
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, wy, W, H - wy);
      ctx.strokeStyle = P.acc(0.2); ctx.lineWidth = 1.5;
      for (let i = 0; i < 50; i++) { const x = R() * W, y = wy + 4 + R() * 100, l = 20 + R() * 60; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(Math.min(W, x + l), y); ctx.stroke(); }
    } else {
      for (let i = 0; i < 4; i++) at(ctx, R, R() * W, 200, (r, x) => crystalCluster(ctx, r, x, H - 60, 180 + r() * 140, -1, P, false));
      for (let i = 0; i < 4; i++) at(ctx, R, R() * W, 160, (r, x) => crystalCluster(ctx, r, x, 50, 120 + r() * 120, 1, P, false));
      for (let i = 0; i < 14; i++) at(ctx, R, R() * W, 10, (r, x) => glint(ctx, x, 150 + r() * 700, 3 + r() * 6, P.acc(0.5)));
    }
  },

  // Bellfry Heights: bell towers above a sea of cloud, rope bridges and pennants.
  clouds(ctx, R, d, P) {
    const cloudCol = (a) => P.acc(a);
    if (d === 0) {
      for (let i = 0; i < 5; i++) at(ctx, R, R() * W, 340, (r, x) => cloudBank(ctx, r, x, 380 + r() * 300, 500 + r() * 300, cloudCol(0.08), cloudCol(0.1)));
      for (const x of spread(R, 5)) at(ctx, R, x, 80, (r, x) => belfry(ctx, r, x, H - 40, 46 + r() * 30, 380 + r() * 340, P));
      for (let i = 0; i < 4; i++) at(ctx, R, R() * W, 380, (r, x) => cloudBank(ctx, r, x, 760 + r() * 140, 600 + r() * 200, mix(P.col, P.style.rim, 0.22), cloudCol(0.1)));
    } else if (d === 1) {
      const tops = [];
      for (const x of spread(R, 3, 0.4)) at(ctx, R, x, 120, (r, x) => { const h = 380 + r() * 260; belfry(ctx, r, x, H + 20, 80 + r() * 40, h, P); tops.push([x, H + 20 - h]); });
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 340, (r, x) => {
        const y = 420 + r() * 200, x1 = x + 300 + r() * 200, pts = sag(x, y, x1, y + (r() - 0.5) * 60, 50 + r() * 40, 24);
        wline(ctx, r, pts, P.col, 2.5);
        wline(ctx, r, pts.map(([a, b]) => [a, b - 34]), P.col, 1.5);
        ctx.strokeStyle = P.col; ctx.lineWidth = 4;
        for (let k = 0; k < pts.length; k++) { const [a, b] = pts[k]; ctx.beginPath(); ctx.moveTo(a - 1, b); ctx.lineTo(a + 3, b + 8); ctx.stroke(); if (k % 3 === 0) { ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(a, b - 34); ctx.stroke(); ctx.lineWidth = 4; } }
        if (r() < 0.6) { const [bx, by] = pts[12]; chain(ctx, bx, by, bx, by + 30, 8, P.col, 2); bell(ctx, r, bx, by + 30, 36, P.col, P, {}); }
      });
      for (let i = 0; i < 5; i++) at(ctx, R, R() * W, 360, (r, x) => cloudBank(ctx, r, x, 560 + r() * 360, 300 + r() * 300, rgba(mix(P.col, P.style.rim, 0.4), 0.35), cloudCol(0.09)));
    } else {
      for (const x of spread(R, 3)) at(ctx, R, x, 260, (r, x) => {
        const w = 360 + r() * 160, y = H - 160 - r() * 80, hr = 120 + r() * 80, peak = x + (r() - 0.5) * 60;
        const p = wobPath(r, [[x - w / 2, H + 20], [x - w / 2, y], [peak, y - hr], [x + w / 2, y], [x + w / 2, H + 20]], 2, 10);
        fillShape(ctx, r, p, P.col, P, { box: [x - w / 2, y - hr, w, H], rim: true });
        // scalloped tiles
        ctx.save(); ctx.clip(p); ctx.strokeStyle = P.line; ctx.lineWidth = 1.4;
        for (let yy = y - hr + 14; yy < H; yy += 14) { ctx.beginPath(); for (let xx = x - w / 2 + ((yy / 14) % 2) * 9; xx < x + w / 2; xx += 18) { ctx.moveTo(xx, yy); ctx.arc(xx + 9, yy, 9, Math.PI, 0, true); } ctx.stroke(); }
        ctx.restore();
        // weathervane
        wline(ctx, r, [[peak, y - hr], [peak, y - hr - 70]], P.col, 3);
        ctx.fillStyle = P.col; ctx.beginPath(); ctx.moveTo(peak, y - hr - 66); ctx.lineTo(peak + 34, y - hr - 58); ctx.lineTo(peak, y - hr - 50); ctx.fill();
      });
      at(ctx, R, R() * W, 600, (r, x) => {
        const pts = sag(x, 120, x + 1100, 180, 120, 40);
        wline(ctx, r, pts, P.col, 2);
        for (let k = 1; k < 40; k += 2) { const [fx, fy] = pts[k]; ctx.fillStyle = k % 6 === 1 ? mix(P.col, P.style.accent, 0.18) : P.col; ctx.beginPath(); ctx.moveTo(fx - 9, fy); ctx.lineTo(fx + 9, fy + 2); ctx.lineTo(fx + 2, fy + 26); ctx.fill(); }
      });
    }
  },

  // Silken Archive: towering shelves and reading galleries strung with threads.
  library(ctx, R, d, P) {
    if (d === 0) {
      for (const x of spread(R, 4)) at(ctx, R, x, 260, (r, x) => {
        const w = 300 + r() * 160, top = 60;
        const p = new Path2D();
        addWob(p, r, rectPts(x - w / 2, top, w, H), 2, 14);
        addWob(p, r, archPts(x, w * 0.5, 360, 840, 0.75, 12), 2, 12);
        fillShape(ctx, r, p, P.col, P, { rule: 'evenodd', box: [x - w / 2, top, w, H], hatch: [Math.PI / 2, 8] });
        ctx.save(); ctx.clip(p, 'evenodd');
        for (let y = top + 40; y < H; y += 46) wline(ctx, r, [[x - w / 2, y], [x + w / 2, y + 2]], P.line, 2);
        ctx.restore();
        ctx.fillStyle = P.glow(0.07); ctx.fill(wobPath(r, archPts(x, w * 0.5, 360, 840, 0.75, 12), 2, 12));
        ctx.strokeStyle = P.col; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x, 200); ctx.lineTo(x, 840); ctx.moveTo(x - w * 0.25, 560); ctx.lineTo(x + w * 0.25, 560); ctx.stroke();
      });
      for (let i = 0; i < 20; i++) at(ctx, R, R() * W, 10, (r, x) => { ctx.save(); ctx.translate(x, 100 + r() * 700); ctx.rotate(r() * TAU); ctx.fillStyle = P.acc(0.25); ctx.fillRect(-5, -7, 10, 14); ctx.restore(); });
    } else if (d === 1) {
      const cases = [];
      for (const x of spread(R, 4, 0.4)) at(ctx, R, x, 220, (r, x) => {
        const w = 240 + r() * 120, top = 80 + r() * 80;
        cases.push(x);
        const p = wobPath(r, [[x - w / 2, H + 20], [x - w / 2, top + 30], [x - w / 2 + 20, top], [x, top - 30 - r() * 30], [x + w / 2 - 20, top], [x + w / 2, top + 30], [x + w / 2, H + 20]], 1.5, 12);
        fillShape(ctx, r, p, P.col, P, { box: [x - w / 2, top - 60, w, H], hatch: [Math.PI / 2, 9] });
        ctx.save(); ctx.clip(p);
        for (let y = top + 90; y < H; y += 80 + r() * 10) {
          ctx.fillStyle = P.deep; ctx.fillRect(x - w / 2 + 14, y - 66, w - 28, 66);
          let bx = x - w / 2 + 16;
          while (bx < x + w / 2 - 20) {
            const bw = 6 + r() * 11, bh = 34 + r() * 30, lean = r() < 0.12 ? (r() - 0.5) * 0.5 : 0;
            if (r() < 0.08) { bx += bw * 2; continue; }
            ctx.save(); ctx.translate(bx + bw / 2, y); ctx.rotate(lean);
            ctx.fillStyle = r() < 0.12 ? mix(P.col, P.style.accent, 0.15) : r() < 0.35 ? P.lite : r() < 0.5 ? P.dark : P.mid;
            ctx.fillRect(-bw / 2, -bh, bw, bh);
            ctx.fillStyle = P.rimA(0.12); ctx.fillRect(-bw / 2 + 1, -bh * 0.8, bw - 2, 2);
            ctx.restore();
            bx += bw + 1 + r() * 2;
          }
          wline(ctx, r, [[x - w / 2, y + 2], [x + w / 2, y + 2]], P.col, 8);
          ctx.strokeStyle = P.rim; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - w / 2, y - 1); ctx.lineTo(x + w / 2, y - 1); ctx.stroke();
        }
        ctx.restore();
        // ladder
        if (r() < 0.7) {
          const lx = x + (r() - 0.5) * w * 0.5, ly = top + 120 + r() * 200, lean = 50 + r() * 40;
          wline(ctx, r, [[lx, ly], [lx + lean, H]], P.col, 4); wline(ctx, r, [[lx + 28, ly], [lx + 28 + lean, H]], P.col, 4);
          ctx.strokeStyle = P.col; ctx.lineWidth = 3;
          for (let k = 0; k < 20; k++) { const t = k / 20, yy = ly + (H - ly) * t; ctx.beginPath(); ctx.moveTo(lx + lean * t, yy); ctx.lineTo(lx + 28 + lean * t, yy); ctx.stroke(); }
        }
      });
      // reading gallery balcony
      at(ctx, R, R() * W, 500, (r, x) => {
        const y = 430 + r() * 100, w = 900;
        fillShape(ctx, r, wobPath(r, [[x - w / 2, y], [x + w / 2, y], [x + w / 2 - 10, y + 22], [x - w / 2 + 10, y + 22]], 1, 10), P.col, P, {});
        ctx.strokeStyle = P.col; ctx.lineWidth = 3; ctx.beginPath();
        for (let xx = x - w / 2 + 10; xx < x + w / 2; xx += 18) { ctx.moveTo(xx, y); ctx.lineTo(xx, y - 34); }
        ctx.stroke();
        wline(ctx, r, [[x - w / 2, y - 36], [x + w / 2, y - 36]], P.col, 6);
        for (let k = 0; k < 3; k++) { const lx = x - w / 3 + k * w / 3; chain(ctx, lx, y + 22, lx, y + 90, 10, P.col, 2); glow(ctx, lx, y + 100, 60, P.glow(0.25)); ctx.fillStyle = P.glow(0.7); ctx.beginPath(); ctx.arc(lx, y + 100, 6, 0, TAU); ctx.fill(); }
      });
      // threads strung with hanging pages
      for (let i = 0; i < 5; i++) at(ctx, R, R() * W, 380, (r, x) => {
        const y0 = 150 + r() * 500, x1 = x + 300 + r() * 400, pts = sag(x, y0, x1, y0 + (r() - 0.5) * 100, 40 + r() * 60, 20);
        wline(ctx, r, pts, P.rimA(0.3), 1);
        for (let k = 2; k < 19; k += 2 + Math.floor(r() * 3)) { const [px, py] = pts[k]; ctx.save(); ctx.translate(px, py); ctx.rotate((r() - 0.5) * 0.4); ctx.fillStyle = P.acc(0.22); ctx.fillRect(-6, 0, 12, 16); ctx.strokeStyle = P.line; ctx.beginPath(); ctx.moveTo(-3, 5); ctx.lineTo(3, 5); ctx.moveTo(-3, 9); ctx.lineTo(3, 9); ctx.stroke(); ctx.restore(); }
      });
    } else {
      for (let i = 0; i < 2; i++) at(ctx, R, R() * W, 120, (r, x) => {
        const w = 90 + r() * 40;
        fillShape(ctx, r, wobPath(r, rectPts(x - w / 2, -20, w, H + 40), 2, 12), P.col, P, { box: [x - w / 2, 0, w, H], hatch: [Math.PI / 2, 6] });
        for (let y = 120; y < H; y += 90) { ctx.fillStyle = P.col; ctx.fillRect(x - w / 2 - 12, y, w + 24, 10); }
      });
      for (let i = 0; i < 4; i++) at(ctx, R, R() * W, 80, (r, x) => {
        let y = H - 70;
        for (let k = 0; k < 6 + r() * 8; k++) { const bw = 70 + r() * 50, bh = 10 + r() * 10, ox = (r() - 0.5) * 20; fillShape(ctx, r, wobPath(r, rectPts(x - bw / 2 + ox, y - bh, bw, bh), 0.8, 8), k % 3 ? P.col : P.mid, P, { shade: false, rw: 1.5 }); y -= bh; }
      });
      for (let i = 0; i < 8; i++) at(ctx, R, R() * W, 30, (r, x) => {
        const len = 100 + r() * 300;
        wline(ctx, r, [[x, 0], [x + (r() - 0.5) * 20, len]], P.col, 1.5);
        ctx.save(); ctx.translate(x, len); ctx.rotate((r() - 0.5) * 0.6); ctx.fillStyle = P.col; ctx.fillRect(-10, 0, 20, 26); ctx.restore();
      });
    }
  },

  // Rotgut Warrens: a living hive of brood cells, egg sacs and sinew.
  hive(ctx, R, d, P) {
    if (d === 0) {
      ctx.fillStyle = P.col; ctx.fillRect(0, 0, W, H);
      const pts = [];
      for (const x of spread(R, 6)) pts.push(x);
      ctx.save(); ctx.globalCompositeOperation = 'destination-out';
      for (const x of pts) at(ctx, R, x, 260, (r, x) => {
        const y = 300 + r() * 400, rw = 160 + r() * 120, rh = 120 + r() * 120;
        ctx.fill(wobPath(r, Array.from({ length: 16 }, (_, k) => [x + Math.cos(k / 16 * TAU) * rw * (0.85 + r() * 0.3), y + Math.sin(k / 16 * TAU) * rh * (0.85 + r() * 0.3)]), 4, 14));
      });
      ctx.restore();
      ctx.save(); ctx.strokeStyle = P.line; ctx.lineWidth = 3;
      for (let i = 0; i < 30; i++) at(ctx, R, R() * W, 100, (r, x) => { const y = r() * H; ctx.beginPath(); ctx.arc(x, y, 40 + r() * 60, r() * TAU, r() * TAU + 1.5); ctx.stroke(); });
      ctx.restore();
      for (const x of pts) at(ctx, R, x, 60, (r, x) => glow(ctx, x, 600, 160, P.acc(0.1)));
    } else if (d === 1) {
      for (const x of spread(R, 4)) at(ctx, R, x, 220, (r, x) => {
        const cy = 300 + r() * 400, cw = 300 + r() * 120;
        // brood comb: a lumpy mass of wobbly cells
        const outline = Array.from({ length: 18 }, (_, k) => [x + Math.cos(k / 18 * TAU) * cw / 2 * (0.75 + r() * 0.35), cy + Math.sin(k / 18 * TAU) * cw * 0.42 * (0.75 + r() * 0.35)]);
        const p = wobPath(r, outline, 4, 14);
        fillShape(ctx, r, p, P.col, P, { box: [x - cw / 2, cy - cw / 2, cw, cw], rim: true, mottleN: 6 });
        ctx.save(); ctx.clip(p);
        const s = 18 + r() * 6;
        for (let yy = cy - cw / 2, row = 0; yy < cy + cw / 2; yy += s * 1.5, row++) for (let xx = x - cw / 2 + (row % 2) * s * 0.87; xx < x + cw / 2; xx += s * 1.74) {
          const hp = Array.from({ length: 6 }, (_, k) => [xx + Math.cos(k / 6 * TAU + 0.52) * s * (0.85 + r() * 0.2), yy + Math.sin(k / 6 * TAU + 0.52) * s * (0.85 + r() * 0.2)]);
          const v = r(), cell = wobPath(r, hp, 0.8, 6);
          ctx.fillStyle = v < 0.1 ? P.acc(0.12) : P.deep; ctx.fill(cell);
          if (v < 0.1) { ctx.fillStyle = P.acc(0.2); ctx.beginPath(); ctx.ellipse(xx, yy, s * 0.4, s * 0.48, 0, 0, TAU); ctx.fill(); }
          ctx.strokeStyle = P.rim; ctx.lineWidth = 1; ctx.stroke(cell);
        }
        ctx.restore();
        // sinew strands to the ceiling and floor
        for (let k = 0; k < 4; k++) { const sx = x + (r() - 0.5) * cw * 0.6; ribbon(ctx, r, qpts(sx, cy - cw * 0.3, sx + (r() - 0.5) * 80, cy - cw * 0.6, sx + (r() - 0.5) * 120, -10, 12), 14, 5, P.col); }
        for (let k = 0; k < 3; k++) { const sx = x + (r() - 0.5) * cw * 0.6; ribbon(ctx, r, qpts(sx, cy + cw * 0.3, sx + (r() - 0.5) * 80, cy + cw * 0.6, sx + (r() - 0.5) * 120, H + 10, 12), 12, 6, P.col); }
      });
      for (let i = 0; i < 6; i++) at(ctx, R, R() * W, 40, (r, x) => eggSac(ctx, r, x, 60, 150 + r() * 250, 18 + r() * 14, P));
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 160, (r, x) => cobweb(ctx, r, x, 600 + r() * 200, 140, -Math.PI + 0.2, -0.2, P.rimA(0.14)));
    } else {
      for (let i = 0; i < 4; i++) at(ctx, R, R() * W, 200, (r, x) => {
        const w = 260 + r() * 160, y = 80;
        const pts = [[x - w / 2, -10], [x + w / 2, -10]];
        for (let k = 0; k <= 10; k++) { const t = 1 - k / 10; pts.push([x - w / 2 + w * t, y + Math.sin(t * Math.PI) * (60 + r() * 50) + (k % 2) * 20]); }
        fillShape(ctx, r, wobPath(r, pts, 3, 10), P.col, P, { box: [x - w / 2, 0, w, 200] });
        for (let k = 0; k < 5; k++) { const dx = x - w / 2 + r() * w, len = 40 + r() * 140; ribbon(ctx, r, [[dx, y + 30], [dx + 1, y + 30 + len * 0.6], [dx, y + 30 + len]], 7, 2, P.col); ctx.fillStyle = P.acc(0.4); ctx.beginPath(); ctx.ellipse(dx, y + 38 + len, 3, 5, 0, 0, TAU); ctx.fill(); }
      });
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 50, (r, x) => eggSac(ctx, r, x, 60, 200 + r() * 200, 30 + r() * 16, P));
    }
  },

  // Frostlit Reliquary: a frozen cathedral of ice-bound columns, shrines and icicles.
  iceshrine(ctx, R, d, P) {
    const ice = (a) => P.acc(a);
    if (d === 0) {
      for (const x of spread(R, 3, 0.4)) at(ctx, R, x, 320, (r, x) => {
        const w = 520 + r() * 100, top = 80;
        const p = new Path2D();
        addWob(p, r, rectPts(x - w / 2, top, w, H), 2, 14);
        const ow = w * 0.55, sp = 420;
        addWob(p, r, archPts(x, ow, sp, H + 40, 0.85, 14), 2, 12);
        p.moveTo(x + 70, 260); p.arc(x, 260, 70, 0, TAU);
        fillShape(ctx, r, p, P.col, P, { rule: 'evenodd', box: [x - w / 2, top, w, H], hatch: [Math.PI / 2, 10] });
        // rose window tracery
        ctx.strokeStyle = P.col; ctx.lineWidth = 5;
        for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; ctx.beginPath(); ctx.moveTo(x, 260); ctx.lineTo(x + Math.cos(a) * 70, 260 + Math.sin(a) * 70); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(x, 260, 26, 0, TAU); ctx.stroke();
        glow(ctx, x, 260, 90, ice(0.15));
        wline(ctx, r, [[x, sp - ow * 0.5], [x, H]], P.col, 6);
        for (let k = 0; k < 10; k++) fillShape(ctx, r, spike(r, x - w / 2 + r() * w, top + 10, 14 + r() * 20, 60 + r() * 160), P.col, P, { rim: false, shade: false });
      });
    } else if (d === 1) {
      for (const x of spread(R, 4)) at(ctx, R, x, 140, (r, x) => {
        const w = 60 + r() * 30;
        const col = wobPath(r, [[x - w / 2 - 20, H + 20], [x - w / 2 - 16, H - 100], [x - w / 2, H - 120], [x - w / 2, 180], [x - w / 2 - 20, 150], [x - w / 2 - 20, 120], [x + w / 2 + 20, 120], [x + w / 2 + 20, 150], [x + w / 2, 180], [x + w / 2, H - 120], [x + w / 2 + 16, H - 100], [x + w / 2 + 20, H + 20]], 1.5, 10);
        fillShape(ctx, r, col, P.col, P, { box: [x - w, 100, w * 2, H], hatch: [Math.PI / 2, 5] });
        // ice crusting the column: crystal growths bursting from its sides
        for (let k = 0; k < 4; k++) {
          const y = 250 + r() * 600, sg = r() < 0.5 ? -1 : 1, n = 3 + Math.floor(r() * 4);
          glow(ctx, x + sg * w * 0.5, y, 60, ice(0.08));
          for (let j = 0; j < n; j++) shard(ctx, r, x + sg * w * 0.4, y + (r() - 0.5) * 40, 22 + r() * 34, 12 + r() * 10, sg * (Math.PI / 2 + (r() - 0.5) * 1.6), mix(P.col, P.style.accent, 0.22), mix(P.col, P.style.accent, 0.1), ice(0.4));
        }
        // a sheath of frost on the shaft
        ctx.save(); ctx.clip(col); ctx.fillStyle = ice(0.05); ctx.fillRect(x - w / 2, 180, w * 0.35, H); ctx.restore();
        // icicles under the capital
        for (let k = 0; k < 7; k++) fillShape(ctx, r, spike(r, x - w / 2 - 16 + k * (w + 32) / 6, 150, 6 + r() * 6, 20 + r() * 60), mix(P.col, P.style.accent, 0.15), P, { shade: false, rw: 1 });
      });
      // reliquary shrines with frozen figures
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 120, (r, x) => {
        const w = 210 + r() * 60, base = H - 120, top = base - 440;
        const p = new Path2D();
        addWob(p, r, [[x - w / 2, base], [x - w / 2, top + 60], [x, top - 40], [x + w / 2, top + 60], [x + w / 2, base]], 1.5, 10);
        addWob(p, r, archPts(x, w * 0.6, top + 100, base - 20, 0.9, 10), 1, 8);
        fillShape(ctx, r, p, P.col, P, { rule: 'evenodd', box: [x - w / 2, top - 40, w, base - top + 40], hatch: [0.9, 7] });
        glow(ctx, x, base - 150, 140, ice(0.18));
        // hooded figure holding a reliquary, sealed in ice
        const fp = wobPath(r, [[x - 44, base - 20], [x - 34, base - 150], [x - 26, base - 230], [x, base - 262], [x + 26, base - 230], [x + 34, base - 150], [x + 44, base - 20]], 1, 8);
        fillShape(ctx, r, fp, P.dark, P, { shade: false, rimCol: ice(0.35) });
        ctx.fillStyle = P.deep; ctx.beginPath(); ctx.ellipse(x, base - 222, 12, 17, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = ice(0.5); ctx.beginPath(); ctx.moveTo(x, base - 150); ctx.lineTo(x + 12, base - 132); ctx.lineTo(x, base - 114); ctx.lineTo(x - 12, base - 132); ctx.fill();
        glow(ctx, x, base - 132, 40, ice(0.3));
        const ib = wobPath(r, [[x - w * 0.28, base - 20], [x - w * 0.3, top + 120], [x + w * 0.3, top + 110], [x + w * 0.28, base - 20]], 3, 12);
        ctx.fillStyle = ice(0.05); ctx.fill(ib); ctx.strokeStyle = ice(0.2); ctx.lineWidth = 1; ctx.stroke(ib);
        for (let k = 0; k < 4; k++) wline(ctx, r, [[x - w * 0.25 + r() * w * 0.5, top + 130 + r() * 100], [x - w * 0.25 + r() * w * 0.5, base - 40 - r() * 100]], ice(0.15), 1);
        // snow cap
        ctx.fillStyle = ice(0.18); ctx.beginPath(); ctx.moveTo(x - w / 2 - 4, top + 60); ctx.lineTo(x, top - 44); ctx.lineTo(x + w / 2 + 4, top + 60); ctx.lineTo(x + w / 2 - 6, top + 66); ctx.lineTo(x, top - 30); ctx.lineTo(x - w / 2 + 6, top + 66); ctx.fill();
      });
    } else {
      const n = pnoise(R, [5, 9, 15, 27], 0.7);
      for (let x = 0; x < W; x += 8 + R() * 18) {
        const len = 30 + (n(x) * 0.5 + 0.5) * 200 * R() + 20;
        fillShape(ctx, R, spike(R, x, 120, 6 + R() * 16, len), P.col, P, { rim: false, shade: false });
        if (R() < 0.2) { ctx.fillStyle = ice(0.4); ctx.beginPath(); ctx.ellipse(x, 126 + len, 1.5, 3, 0, 0, TAU); ctx.fill(); }
      }
      for (let i = 0; i < 4; i++) at(ctx, R, R() * W, 140, (r, x) => crystalCluster(ctx, r, x, H - 70, 100 + r() * 80, -1, P, false));
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 30, (r, x) => chain(ctx, x, -10, x + (r() - 0.5) * 30, 200 + r() * 260, 18, P.col, 4));
    }
  },

  // The Loom Below: colossal looms with taut warp threads falling into the abyss.
  looms(ctx, R, d, P) {
    const thread = (a) => P.acc(a);
    if (d === 0) {
      // a forest of far looms, their threads converging into the dark below
      for (const x of spread(R, 4)) at(ctx, R, x, 300, (r, x) => loomFrame(ctx, r, x, 100 + r() * 160, 300 + r() * 200, H + 40, P, false));
      for (let i = 0; i < 40; i++) at(ctx, R, R() * W, 30, (r, x) => { ctx.strokeStyle = thread(0.05 + r() * 0.05); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (r() - 0.5) * 30, H); ctx.stroke(); });
    } else if (d === 1) {
      for (const x of spread(R, 2, 0.4)) at(ctx, R, x, 320, (r, x) => loomFrame(ctx, r, x, 150 + r() * 100, 380 + r() * 160, H + 40, P, true));
      // warp weights hanging into the dark
      for (let i = 0; i < 6; i++) at(ctx, R, R() * W, 30, (r, x) => {
        const y = 500 + r() * 300;
        wline(ctx, r, [[x, 0], [x, y]], thread(0.25), 1);
        fillShape(ctx, r, wobPath(r, Array.from({ length: 10 }, (_, k) => [x + Math.cos(k / 10 * TAU) * 16, y + 16 + Math.sin(k / 10 * TAU) * 18]), 1, 6), P.col, P, {});
        ctx.fillStyle = P.deep; ctx.beginPath(); ctx.arc(x, y + 8, 3, 0, TAU); ctx.fill();
      });
    } else {
      for (let i = 0; i < 5; i++) at(ctx, R, R() * W, 500, (r, x) => {
        const x1 = x + (r() - 0.5) * 900;
        ribbon(ctx, r, qpts(x, -20, (x + x1) / 2 + (r() - 0.5) * 40, H * 0.5, x1, H + 20, 24), 8 + r() * 6, 4 + r() * 4, P.col, 0.2);
      });
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 80, (r, x) => {
        const y = H - 90 - r() * 30, s = 50 + r() * 30;
        fillShape(ctx, r, wobPath(r, [[x - s, y - s * 1.6], [x + s, y - s * 1.6], [x + s * 0.7, y - s * 1.4], [x + s * 0.7, y - s * 0.2], [x + s, y], [x - s, y], [x - s * 0.7, y - s * 0.2], [x - s * 0.7, y - s * 1.4]], 1.5, 8), P.col, P, { box: [x - s, y - s * 1.6, s * 2, s * 1.6], hatch: [0.05, 4] });
      });
    }
  },

  // Moon's Cradle: an enormous moon over slender cradle-spires and threads.
  moonsky(ctx, R, d, P) {
    const st = P.style;
    if (d === 0) {
      for (let i = 0; i < 260; i++) { const s = R() < 0.1 ? 2.5 : 1.3; ctx.fillStyle = rgba('#ffffff', 0.15 + R() * 0.5); ctx.fillRect(R() * W, R() * H * 0.8, s, s); }
      const mx = W * (0.3 + R() * 0.4), my = 320, mr = 290;
      const moonCol = mix(st.glow, st.sky[0], 0.3);
      at(ctx, R, mx, mr * 2.4, (r, x) => {
        glow(ctx, x, my, mr * 2.2, rgba(moonCol, 0.1));
        ctx.fillStyle = rgba(moonCol, 0.3); ctx.beginPath(); ctx.arc(x, my, mr, 0, TAU); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.arc(x, my, mr, 0, TAU); ctx.clip();
        for (let k = 0; k < 18; k++) { const a = r() * TAU, dd = Math.sqrt(r()) * mr * 0.9, cr = 10 + r() * 55; ctx.fillStyle = rgba(st.sky[1], 0.08 + r() * 0.1); ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * dd, my + Math.sin(a) * dd, cr, cr * (0.8 + r() * 0.3), r(), 0, TAU); ctx.fill(); ctx.strokeStyle = rgba(st.glow, 0.12); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + Math.cos(a) * dd + 1, my + Math.sin(a) * dd + 1.5, cr * 0.9, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); }
        // terminator shadow, hatched
        ctx.fillStyle = rgba(st.sky[1], 0.28); ctx.beginPath(); ctx.arc(x + mr * 0.45, my + mr * 0.15, mr * 1.02, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = rgba(moonCol, 0.25); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, my, mr + 3, Math.PI * 0.6, Math.PI * 1.6); ctx.stroke();
      });
      for (let i = 0; i < 4; i++) at(ctx, R, R() * W, 360, (r, x) => cloudBank(ctx, r, x, 380 + r() * 300, 420 + r() * 260, rgba(st.sky[1], 0.3), rgba(st.glow, 0.08)));
      const n = pnoise(R, [3, 7, 13], 0.6);
      for (let i = 0; i < 14; i++) at(ctx, R, R() * W, 40, (r, x) => { const h = 200 + r() * 340, base = H - 40 + n(x) * 20, w = 16 + r() * 18; spire(ctx, r, x, base, w, h, P); });
    } else if (d === 1) {
      const tops = [];
      for (const x of spread(R, 4)) at(ctx, R, x, 80, (r, x) => { const h = 420 + r() * 300, w = 34 + r() * 20; spire(ctx, r, x, H + 20, w, h, P); tops.push(x); });
      for (let i = 0; i < 5; i++) at(ctx, R, R() * W, 500, (r, x) => {
        const y = 300 + r() * 300, x1 = x + 300 + r() * 500;
        wline(ctx, r, sag(x, y, x1, y + (r() - 0.5) * 120, 40 + r() * 70), P.acc(0.22), 1.2);
      });
      for (let i = 0; i < 4; i++) at(ctx, R, R() * W, 360, (r, x) => cloudBank(ctx, r, x, 650 + r() * 250, 400 + r() * 300, mix(P.col, st.accent, 0.08), P.acc(0.12)));
    } else {
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 120, (r, x) => spire(ctx, r, x, H + 20, 60 + r() * 30, 300 + r() * 200, P));
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 500, (r, x) => wline(ctx, r, sag(x, 150 + r() * 200, x + 700, 120 + r() * 300, 120), P.col, 2.5));
    }
  },

  // The Unwoven: unravelling fragments of the world adrift in a void of loose thread.
  void(ctx, R, d, P) {
    const thr = (a) => P.acc(a);
    if (d === 0) {
      for (let i = 0; i < 10; i++) at(ctx, R, R() * W, 260, (r, x) => {
        const y = r() * H, turns = 2 + r() * 3, rr = 80 + r() * 160;
        const pts = [];
        for (let k = 0; k <= 80; k++) { const t = k / 80, a = t * turns * TAU; pts.push([x + Math.cos(a) * rr * t, y + Math.sin(a) * rr * t * 0.8]); }
        wline(ctx, r, pts, thr(0.22), 1.5, 1.5);
      });
      // rifts: seams where the world's cloth has torn open
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 200, (r, x) => {
        let cx = x, cy = 80 + r() * 200; const pts = [[cx, cy]];
        for (let k = 0; k < 8; k++) { cx += (r() - 0.5) * 80; cy += 50 + r() * 50; pts.push([cx, cy]); }
        for (const [px, py] of pts) glow(ctx, px, py, 70, thr(0.12));
        ribbon(ctx, r, pts, 2, 7, thr(0.25), 0.6);
        ribbon(ctx, r, pts, 0.8, 2.5, P.glow(0.3), 0.6);
        for (let k = 1; k < pts.length; k++) { const [px, py] = pts[k]; for (const sg of [-1, 1]) wline(ctx, r, [[px, py], [px + sg * (8 + r() * 14), py - 6 + r() * 12]], thr(0.35), 1); }
      });
      for (const x of spread(R, 4)) at(ctx, R, x, 200, (r, x) => {
        const y = 250 + r() * 400, w = 160 + r() * 160;
        ctx.save(); ctx.translate(x, y); ctx.rotate((r() - 0.5) * 0.3); ctx.translate(-x, -y);
        island(ctx, r, x, y, w, P, P.col);
        if (r() < 0.6) house(ctx, r, x + (r() - 0.5) * w * 0.3, y, 40 + r() * 30, 50 + r() * 50, P, false);
        ctx.restore();
        for (let k = 0; k < 8; k++) wline(ctx, r, qpts(x + (r() - 0.5) * w * 0.4, y + w * 0.3, x + (r() - 0.5) * 80, y + w * 0.5 + 60, x + (r() - 0.5) * 160, y + w * 0.5 + 100 + r() * 200, 10), thr(0.15), 1);
      });
    } else if (d === 1) {
      for (const x of spread(R, 4)) at(ctx, R, x, 220, (r, x) => {
        const y = 220 + r() * 420, w = 190 + r() * 130;
        ctx.save(); ctx.translate(x, y); ctx.rotate((r() - 0.5) * 0.4); ctx.translate(-x, -y);
        island(ctx, r, x, y, w, P, mix(P.col, P.style.rim, 0.06));
        ctx.strokeStyle = P.acc(0.3); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - w / 2, y - 1); ctx.lineTo(x + w / 2, y - 3); ctx.stroke();
        const v = r();
        if (v < 0.33) { chain(ctx, x, y, x, y - 70, 8, P.col, 2); bell(ctx, r, x - 2, y - 70 - 46, 40, P.col, P, {}); }
        else if (v < 0.66) house(ctx, r, x, y, 50 + r() * 20, 60 + r() * 40, P, true);
        else { for (let k = 0; k < 3; k++) shard(ctx, r, x - 20 + k * 20, y, -(50 + r() * 50), 18, (r() - 0.5) * 0.6, P.lite, P.col, P.rim); }
        ctx.restore();
        // unravelling underside
        for (let k = 0; k < 14; k++) { const sx = x + (r() - 0.5) * w * 0.6; wline(ctx, r, qpts(sx, y + w * 0.25, sx + (r() - 0.5) * 60, y + w * 0.5 + 80, sx + (r() - 0.5) * 200, y + w * 0.5 + 150 + r() * 300, 12), k % 3 ? P.col : thr(0.3), 1 + r()); }
      });
      for (let i = 0; i < 8; i++) at(ctx, R, R() * W, 80, (r, x) => {
        const y = 100 + r() * 750, s = 30 + r() * 40;
        ctx.save(); ctx.translate(x, y); ctx.rotate(r() * TAU);
        const cp = wobPath(r, [[-s, -s * 0.5], [s * 0.8, -s * 0.6], [s, s * 0.3], [s * 0.2, s * 0.5], [-s * 0.4, s * 0.2], [-s * 0.9, s * 0.6]], 2, 6);
        fillShape(ctx, r, cp, mix(P.col, P.style.rim, 0.1), P, { box: [-s, -s, s * 2, s * 2], hatch: [0.8, 4], shade: false });
        ctx.restore();
      });
    } else {
      for (const dir of [1, -1]) {
        const n = pnoise(R, [3, 5, 9, 17, 31], 0.7), base = dir > 0 ? 70 : H - 70;
        const p = new Path2D(); p.moveTo(0, dir > 0 ? -10 : H + 10);
        for (let x = 0; x <= W; x += 5) p.lineTo(x, base + dir * (40 + n(x) * 60 + (Math.floor(x / 5) % 3 === 0 ? 14 : 0)));
        p.lineTo(W, dir > 0 ? -10 : H + 10); p.closePath();
        fillShape(ctx, R, p, P.col, P, { box: [0, dir > 0 ? 0 : H - 200, W, 200], hatch: [Math.PI / 2, 5] });
        for (let i = 0; i < 24; i++) at(ctx, R, R() * W, 50, (r, x) => { const y = base + dir * (40 + n(x) * 60); wline(ctx, r, qpts(x, y, x + (r() - 0.5) * 40, y + dir * 40, x + (r() - 0.5) * 80, y + dir * (50 + r() * 140), 10), r() < 0.3 ? thr(0.4) : P.col, 1.2 + r()); });
      }
    }
  },

  // Dustmote Dunes: wind-rippled dunes swallowing colossal sewing relics.
  dunes(ctx, R, d, P) {
    const dune = (y0, amp, ks, col) => {
      const n = pnoise(R, ks, 0.55), p = new Path2D(); p.moveTo(0, H + 10);
      for (let x = 0; x <= W; x += 6) p.lineTo(x, y0 + n(x) * amp);
      p.lineTo(W, H + 10); p.closePath();
      fillShape(ctx, R, p, col, P, { box: [0, y0 - amp, W, H], hatch: [0.06, 9], rw: 3, mottleN: 30 });
      // wind ripples following the crest
      ctx.strokeStyle = P.rimA(0.05 + d * 0.02); ctx.lineWidth = 1.2;
      for (let k = 1; k < 6; k++) { ctx.beginPath(); for (let x = 0; x <= W; x += 12) ctx.lineTo(x, y0 + n(x) * amp + k * (14 + k * 6) + Math.sin(x * 0.05 + k) * 3); ctx.stroke(); }
      return (x) => y0 + n(x) * amp;
    };
    const streaks = (n, a) => { for (let i = 0; i < n; i++) at(ctx, R, R() * W, 200, (r, x) => { const y = 150 + r() * 600; ribbon(ctx, r, [[x - 150, y], [x, y - 4], [x + 150, y + 2]], 1, 3, P.acc(a), 0.5); }); };
    if (d === 0) {
      const g0 = dune(600, 110, [1, 2, 3, 5], mix(P.col, P.style.rim, 0.04));
      const kinds = [0.1, 0.4, 0.7, 0.9].sort(() => R() - 0.5);
      spread(R, 4).forEach((x0, ki) => at(ctx, R, x0, 300, (r, x) => {
        const v = kinds[ki], y = g0(x) + 40;
        if (v < 0.3) needle(ctx, r, x, y + 80, 520 + r() * 200, (r() - 0.5) * 1.1, 26, P);
        else if (v < 0.55) thimble(ctx, r, x, y, 110 + r() * 50, P, P.col);
        else if (v < 0.8) scissors(ctx, r, x, y, 380 + r() * 120, P, P.col);
        else { const p = new Path2D(); addWob(p, r, [[x - 160, y + 60], [x - 150, y - 160], [x - 60, y - 190], [x + 40, y - 150], [x + 150, y - 170], [x + 160, y + 60]], 2, 12); addWob(p, r, archPts(x, 160, y - 60, y + 80, 0.5, 10), 2, 10); fillShape(ctx, r, p, P.col, P, { rule: 'evenodd', box: [x - 160, y - 190, 320, 260], hatch: [1.2, 8] }); }
      }));
      dune(780, 70, [2, 3, 5, 7], P.col);
      streaks(10, 0.06);
    } else if (d === 1) {
      const g = dune(700, 90, [1, 2, 4, 6], P.col);
      for (const x of spread(R, 5)) at(ctx, R, x, 200, (r, x) => {
        const y = g(x) + 20, v = r();
        if (v < 0.3) { // giant button half-buried
          const s = 70 + r() * 50;
          ctx.save(); ctx.beginPath(); ctx.rect(x - s * 2, y - s * 2.5, s * 4, s * 2.5 + 6); ctx.clip();
          ctx.translate(x, y - s * 0.35); ctx.rotate((r() - 0.5) * 0.5); ctx.scale(1, 0.85 + r() * 0.15);
          const p = new Path2D(); p.ellipse(0, 0, s, s, 0, 0, TAU);
          for (const [hx, hy] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) { p.moveTo(hx * s + s * 0.09, hy * s); p.arc(hx * s, hy * s, s * 0.09, 0, TAU); }
          fillShape(ctx, r, p, P.lite, P, { rule: 'evenodd', box: [-s, -s, s * 2, s * 2], hatch: [0.4, 6] });
          ctx.strokeStyle = P.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, s * 0.78, 0, TAU); ctx.stroke();
          ctx.restore();
          // sand drift against it
          ctx.fillStyle = P.col; ctx.beginPath(); ctx.moveTo(x - s * 1.3, y + 6); ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.25, x + s * 0.2, y + 6); ctx.fill();
        } else if (v < 0.55) { // a broken column with a capital, tilted
          const h = 160 + r() * 200, w = 40;
          ctx.save(); ctx.translate(x, y + 20); ctx.rotate((r() - 0.5) * 0.25); ctx.translate(-x, -y - 20);
          const top = []; for (let j = 0; j <= 4; j++) top.push([x + w / 2 - w * j / 4, y - h + (r() - 0.5) * 30]);
          fillShape(ctx, r, wobPath(r, [[x - w / 2, y + 30], [x + w / 2, y + 30], ...top], 1.5, 8), P.col, P, { box: [x - w, y - h - 20, w * 2, h + 60], hatch: [Math.PI / 2, 6] });
          ctx.restore();
          fillShape(ctx, r, wobPath(r, [[x + 40, y + 10], [x + 44, y - 18], [x + 100, y - 22], [x + 104, y + 10]], 1.5, 8), P.col, P, {});
        } else if (v < 0.8) { // a spool, its thread unwinding across the dunes
          const s = 60 + r() * 30;
          ctx.save(); ctx.translate(x, y); ctx.rotate(-0.3 + r() * 0.2);
          fillShape(ctx, r, wobPath(r, [[-s, -s * 1.4], [s, -s * 1.4], [s, -s * 1.25], [s * 0.7, -s * 1.2], [s * 0.7, -s * 0.2], [s, -s * 0.15], [s, 0], [-s, 0], [-s, -s * 0.15], [-s * 0.7, -s * 0.2], [-s * 0.7, -s * 1.2], [-s, -s * 1.25]], 1.5, 8), P.col, P, { box: [-s, -s * 1.4, s * 2, s * 1.4], hatch: [0.05, 4] });
          ctx.restore();
          wline(ctx, r, qpts(x + s * 0.6, y - s * 0.6, x + s * 2, y + 10, x + s * 4 + r() * 100, y + 4, 16), mix(P.col, P.style.accent, 0.2), 2);
        } else { // sand pouring from an overhang
          const sy = 200 + r() * 200;
          fillShape(ctx, r, wobPath(r, [[x - 90, sy], [x + 60, sy - 10], [x + 70, sy + 30], [x - 80, sy + 40]], 2, 8), P.col, P, {});
          ribbon(ctx, r, qpts(x + 50, sy + 20, x + 56, (sy + y) / 2, x + 60, y, 16), 4, 16, P.acc(0.14), 0.5);
        }
      });
      streaks(8, 0.08);
    } else {
      const g = dune(H - 190, 70, [2, 3, 5, 9], P.col);
      for (let i = 0; i < 14; i++) at(ctx, R, R() * W, 40, (r, x) => { const y = g(x) + 8; for (let k = 0; k < 7; k++) ribbon(ctx, r, qpts(x + k * 3, y, x + k * 4 + (r() - 0.5) * 20, y - 30, x + (k - 3) * 10 + (r() - 0.5) * 30, y - 40 - r() * 60, 8), 3, 0.4, P.col); });
      for (let i = 0; i < 2; i++) at(ctx, R, R() * W, 80, (r, x) => { const y = g(x); ctx.save(); ctx.translate(x, y + 10); ctx.rotate((r() - 0.5) * 0.6); fillShape(ctx, r, wobPath(r, [[-40, 30], [-36, -60], [-10, -80], [20, -66], [40, -90], [44, 30]], 1.5, 8), P.col, P, { box: [-44, -90, 88, 120], hatch: [Math.PI / 2, 5] }); ctx.restore(); });
    }
  },

  // Hall of Echoes: a grand colonnade of fluted columns, banners and boss statues.
  temple(ctx, R, d, P) {
    if (d === 0) {
      const n = 10, cw = W / n;
      // entablature with arches between columns
      const p = new Path2D();
      addWob(p, R, rectPts(-4, 120, W + 8, 140), 2, 16);
      fillShape(ctx, R, p, P.col, P, { box: [0, 120, W, 140], hatch: [0, 8] });
      for (let i = 0; i < n; i++) at(ctx, R, (i + 0.5) * cw, cw, (r, x) => {
        column(ctx, r, x - cw / 2, 30 + r() * 6, 250, H, P);
        if (r() < 0.5) statue(ctx, r, x, H - 70, 160 + r() * 80, P, P.col);
      });
      for (let i = 0; i < 2; i++) at(ctx, R, R() * W, 260, (r, x) => {
        const dp = wobPath(r, [...Array.from({ length: 17 }, (_, k) => [x - 240 * Math.cos(k / 16 * Math.PI), 140 - 200 * Math.sin(k / 16 * Math.PI)])], 2, 10);
        fillShape(ctx, r, dp, P.col, P, { box: [x - 240, -60, 480, 200], hatch: [Math.PI / 2, 9] });
      });
    } else if (d === 1) {
      const n = 5, cw = W / n, off = R() * cw;
      for (let i = 0; i < n; i++) at(ctx, R, off + i * cw, cw, (r, x) => {
        // arch spanning to the next column
        const p = new Path2D();
        addWob(p, r, rectPts(x - 6, 160, cw + 12, 290), 1.5, 14);
        addWob(p, r, archPts(x + cw / 2, cw - 60, 330, 450, 0.5, 14), 1.5, 12);
        fillShape(ctx, r, p, P.col, P, { rule: 'evenodd', box: [x, 160, cw, 300], hatch: [0, 7] });
        ctx.save(); ctx.clip(p, 'evenodd'); masonry(ctx, r, x, 160, cw, 300, 28, P.line); ctx.restore();
        column(ctx, r, x, 50 + r() * 8, 300, H + 20, P);
        // banner hanging in the arch
        if (r() < 0.75) {
          const bx = x + cw / 2, by = 400, bw = 60 + r() * 20, bl = 200 + r() * 160;
          tatter(ctx, r, bx, by, bw, bl, mix(P.col, P.style.accent, 0.1), P, true);
          ctx.strokeStyle = P.acc(0.3); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by + 60, 14, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(bx, by + 46); ctx.lineTo(bx, by + 74); ctx.stroke();
        } else {
          chain(ctx, x + cw / 2, 330 - cw / 2 + 50, x + cw / 2, 520, 12, P.col, 2);
          glow(ctx, x + cw / 2, 540, 70, P.glow(0.25));
          ctx.fillStyle = P.col; ctx.beginPath(); ctx.moveTo(x + cw / 2 - 16, 520); ctx.lineTo(x + cw / 2 + 16, 520); ctx.lineTo(x + cw / 2 + 8, 556); ctx.lineTo(x + cw / 2 - 8, 556); ctx.fill();
          ctx.fillStyle = P.glow(0.7); ctx.fillRect(x + cw / 2 - 6, 528, 12, 18);
        }
        if (r() < 0.6) statue(ctx, r, x + cw / 2 + (r() - 0.5) * 60, H - 80, 200 + r() * 60, P, P.mid);
      });
    } else {
      for (let i = 0; i < 2; i++) at(ctx, R, R() * W, 120, (r, x) => column(ctx, r, x, 100 + r() * 30, -40, H + 20, P));
      for (let i = 0; i < 3; i++) at(ctx, R, R() * W, 60, (r, x) => {
        const y = H - 230;
        fillShape(ctx, r, wobPath(r, [[x - 40, y], [x + 40, y], [x + 26, y + 30], [x + 10, y + 34], [x + 12, y + 160], [x + 30, y + 240], [x - 30, y + 240], [x - 12, y + 160], [x - 10, y + 34], [x - 26, y + 30]], 1, 8), P.col, P, {});
        glow(ctx, x, y - 16, 80, P.glow(0.2));
        ctx.fillStyle = P.glow(0.4);
        ctx.beginPath(); ctx.moveTo(x - 16, y); ctx.quadraticCurveTo(x - 6, y - 18, x, y - 32); ctx.quadraticCurveTo(x + 6, y - 18, x + 16, y); ctx.fill();
      });
    }
  },
};

// ---------- composite props ----------
function needle(ctx, R, x, base, len, ang, w, P) {
  ctx.save(); ctx.translate(x, base); ctx.rotate(ang);
  const p = new Path2D();
  addWob(p, R, [[-w * 0.2, 60], [-w / 2, -len * 0.3], [-w / 2, -len + w * 0.9], [-w * 0.2, -len - w * 0.1], [w * 0.2, -len - w * 0.1], [w / 2, -len + w * 0.9], [w / 2, -len * 0.3], [w * 0.2, 60]], 1, 14);
  p.moveTo(w * 0.17, -len + w * 2.6); p.ellipse(0, -len + w * 2.6, w * 0.17, w * 1.3, 0, 0, TAU);
  fillShape(ctx, R, p, P.dark, P, { rule: 'evenodd', box: [-w, -len, w * 2, len + 60], hatch: [Math.PI / 2, 5], rx: 3, ry: 0, sx: -5, sy: 0, sw: 10, rw: 3.5 });
  ctx.restore();
  // thread through the eye, drooping away
  const ex = x + Math.sin(ang) * (len - w * 2.6), ey = base - Math.cos(ang) * (len - w * 2.6);
  const tx = ex + (R() < 0.5 ? -1 : 1) * (200 + R() * 260);
  wline(ctx, R, sag(ex, ey, tx, ey + 100 + R() * 200, 120 + R() * 120, 20), P.dark, 3);
  wline(ctx, R, qpts(ex, ey, ex + (R() - 0.5) * 60, ey + 120, ex + (R() - 0.5) * 120, ey + 200 + R() * 200, 12), P.dark, 2.5);
}
function thimble(ctx, R, x, base, s, P, color) {
  const pts = [[x - s, base + 30], [x - s * 0.92, base - s * 1.4]];
  for (let k = 0; k <= 10; k++) { const a = Math.PI + k / 10 * Math.PI; pts.push([x + Math.cos(a) * s * 0.92, base - s * 1.4 + Math.sin(a) * s * 0.5]); }
  pts.push([x + s * 0.92, base - s * 1.4], [x + s, base + 30]);
  const p = wobPath(R, pts, 2, 10);
  fillShape(ctx, R, p, color, P, { box: [x - s, base - s * 2, s * 2, s * 2 + 30], hatch: [Math.PI / 2, 8] });
  ctx.save(); ctx.clip(p); ctx.fillStyle = P.dark;
  for (let row = 0; row < 7; row++) for (let k = -6; k <= 6; k++) { const yy = base - s * 1.6 + row * s * 0.22, xx = x + k * s * 0.15 + (row % 2) * s * 0.075; ctx.beginPath(); ctx.arc(xx, yy, s * 0.04, 0, TAU); ctx.fill(); }
  ctx.fillStyle = P.col; ctx.fillRect(x - s, base - s * 0.15, s * 2, s * 0.1);
  ctx.restore();
}
function scissors(ctx, R, x, base, len, P, color) {
  // colossal shears stabbed point-first into the sand, blades a little open
  for (const sg of [-1, 1]) {
    ctx.save(); ctx.translate(x, base + 40); ctx.rotate(sg * 0.16 + 0.1);
    const blade = wobPath(R, [[0, 0], [sg * len * 0.07, -len * 0.55], [sg * len * 0.02, -len * 0.62], [-sg * len * 0.015, -len * 0.5]], 1.5, 10);
    fillShape(ctx, R, blade, color, P, { box: [-len * 0.1, -len * 0.65, len * 0.2, len * 0.65], hatch: [Math.PI / 2, 6] });
    // handle ring
    ctx.strokeStyle = color; ctx.lineWidth = len * 0.035;
    ctx.beginPath(); ctx.ellipse(sg * len * 0.08, -len * 0.78, len * 0.08, len * 0.13, sg * 0.3, 0, TAU); ctx.stroke();
    wline(ctx, R, [[sg * len * 0.02, -len * 0.6], [sg * len * 0.06, -len * 0.66]], color, len * 0.03);
    ctx.restore();
  }
  ctx.fillStyle = P.rim; ctx.beginPath(); ctx.arc(x - len * 0.03, base + 40 - len * 0.55, len * 0.015, 0, TAU); ctx.fill();
}
function palm(ctx, R, x, base, h, color) {
  const lean = (R() - 0.5) * 120, top = [x + lean, base - h];
  ribbon(ctx, R, qpts(x, base, x + lean * 0.2, base - h * 0.5, top[0], top[1], 16), 18, 8, color);
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI / 2 + (k / 8 - 0.5) * 3.4 + (R() - 0.5) * 0.3, len = 90 + R() * 80;
    const ex = top[0] + Math.cos(a) * len, ey = top[1] + Math.sin(a) * len * 0.5 + len * 0.4;
    const pts = qpts(top[0], top[1], top[0] + Math.cos(a) * len * 0.6, top[1] + Math.sin(a) * len * 0.6 - 20, ex, ey, 12);
    ribbon(ctx, R, pts, 14, 1, color);
  }
}
function bigLeaves(ctx, R, x, base, s, P) {
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (R() - 0.5) * 1.8, len = s * (0.6 + R() * 0.5);
    ribbon(ctx, R, qpts(x, base + 20, x + Math.cos(a) * len * 0.3, base - len * 0.3, x + Math.cos(a) * len * 0.5, base + Math.sin(a) * len * 0.6, 8), 5, 2, P.col);
    leaf(ctx, x + Math.cos(a) * len * 0.5, base + Math.sin(a) * len * 0.6, len * 0.6, a + (R() - 0.5) * 0.8, len * 0.2, P.col, P.line);
  }
}
function curl(ctx, R, x, y, r, s, color) {
  const pts = [];
  for (let k = 0; k <= 20; k++) { const t = k / 20, a = t * TAU * 1.3; pts.push([x + s * Math.cos(a) * r * (1 - t * 0.8), y + Math.sin(a) * r * (1 - t * 0.8)]); }
  wline(ctx, R, pts, color, 2.5, 0.3);
}
function shroom(ctx, R, x, base, h, w, P, color, detail) {
  const lean = (R() - 0.5) * h * 0.3, tx = x + lean, ty = base - h;
  ribbon(ctx, R, qpts(x, base + 30, x + lean * 0.1, base - h * 0.5, tx, ty, 16), w * 0.16, w * 0.1, color, 0.15);
  // ring on the stem
  if (R() < 0.5) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(tx - lean * 0.15, ty + h * 0.15, w * 0.13, w * 0.03, 0, 0, TAU); ctx.fill(); }
  const kind = R(), cw = w / 2;
  // cap profiles: 0 dome, 1 flat parasol, 2 tall cone, 3 bell with ragged skirt
  const K = kind < 0.3 ? 0 : kind < 0.55 ? 1 : kind < 0.8 ? 2 : 3;
  const ch = w * [0.38, 0.16, 0.6, 0.45][K];
  const pts = [];
  for (let k = 0; k <= 18; k++) {
    const t = k / 18, a = Math.PI + t * Math.PI, sx = Math.sin(t * Math.PI);
    const bump = K === 2 ? Math.pow(sx, 2.2) : K === 1 ? Math.pow(sx, 0.4) : Math.pow(sx, 0.7);
    pts.push([tx + Math.cos(a) * cw, ty - bump * ch + (R() - 0.5) * 3]);
  }
  if (K === 3) for (let k = 0; k < 9; k++) { const t = k / 8; pts.push([tx + cw - t * cw * 2, ty + ch * (k % 2 ? 0.05 : 0.18)]); }
  else pts.push([tx + cw * 0.85, ty + ch * 0.1], [tx, ty + ch * 0.06 + w * 0.04], [tx - cw * 0.85, ty + ch * 0.1]);
  const cap = wobPath(R, pts, 1.5, 8);
  // underside with radiating gills, faintly lit
  const gy = ty + w * 0.02, gd = w * 0.09;
  ctx.fillStyle = mix(color, P.style.accent, detail ? 0.08 : 0.04);
  ctx.beginPath(); ctx.ellipse(tx, gy, cw * 0.96, gd, 0, 0, Math.PI); ctx.fill();
  ctx.strokeStyle = detail ? P.acc(0.25) : P.line; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k < 36; k++) { const t = k / 35 - 0.5; ctx.moveTo(tx + t * cw * 0.2, gy + gd * 0.9); ctx.lineTo(tx + t * cw * 1.9, gy + gd * 0.25 * (1 - Math.abs(t))); }
  ctx.stroke();
  fillShape(ctx, R, cap, color, P, { box: [tx - cw, ty - ch, cw * 2, ch * 1.3], hatch: detail ? [0.3, 6] : null, sw: ch * 0.4, sy: -ch * 0.2 });
  if (detail) {
    ctx.save(); ctx.clip(cap);
    const n = K === 1 ? 4 : 8;
    for (let k = 0; k < n; k++) { const sx = tx + (R() - 0.5) * cw * 1.5, sy = ty - R() * ch * 0.8; ctx.fillStyle = P.acc(0.25); ctx.beginPath(); ctx.ellipse(sx, sy, 3 + R() * w * 0.03, 2 + R() * w * 0.02, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
    glow(ctx, tx, gy + gd, w * 0.55, P.acc(0.1));
    // lace veil hanging from some caps
    if (h > 150 && R() < 0.35) {
      const vh = h * (0.3 + R() * 0.25), vw = cw * 0.55;
      ctx.strokeStyle = P.acc(0.14); ctx.lineWidth = 1; ctx.beginPath();
      for (let k = 0; k <= 8; k++) { const t = k / 8 - 0.5; ctx.moveTo(tx + t * vw * 0.5, gy + gd); ctx.quadraticCurveTo(tx + t * vw * 1.4, gy + vh * 0.6, tx + t * vw * 1.6, gy + vh); }
      for (let j = 1; j <= 5; j++) { const yy = gy + gd + (vh - gd) * j / 5, ww = vw * (0.5 + 1.1 * j / 5); ctx.moveTo(tx - ww * 0.8, yy); for (let k = 1; k <= 8; k++) ctx.lineTo(tx - ww * 0.8 + ww * 1.6 * k / 8, yy + (k % 2 ? 6 : 0)); }
      ctx.stroke();
    }
    // shelf fungus on the stem
    if (h > 120 && R() < 0.7) for (let k = 0; k < 3; k++) { const sy = base - h * (0.2 + R() * 0.5), sx = x + lean * (1 - (base - sy) / h) * 0.2; ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(sx + w * 0.08, sy, w * 0.12, w * 0.04, -0.15, Math.PI, 0); ctx.fill(); ctx.strokeStyle = P.rim; ctx.beginPath(); ctx.ellipse(sx + w * 0.08, sy, w * 0.12, w * 0.04, -0.15, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke(); }
    for (let k = 0; k < 4; k++) { const dx = tx + (R() - 0.5) * cw * 1.6, len = 20 + R() * h * 0.3; wline(ctx, R, [[dx, gy], [dx, gy + len]], P.line, 1); glow(ctx, dx, gy + len, 8, P.acc(0.4)); }
  }
}
// ---- Pinworks props ----
// a dressmaker pin stuck point-first into the ground, glass head up. ang leans it (0 = upright).
function pin(ctx, R, x, base, len, ang, w, hr, P, color, headCol) {
  ctx.save(); ctx.translate(x, base); ctx.rotate(ang);
  const shaft = wobPath(R, [[-w * 0.5, -len], [w * 0.5, -len], [w * 0.42, 40], [0, 80], [-w * 0.42, 40]], 0.7, 16);
  fillShape(ctx, R, shaft, color, P, { box: [-w, -len, w * 2, len + 80], shade: false, rx: -w * 0.22, ry: 0, rw: Math.max(1.2, w * 0.2), mottleN: 4 });
  ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(1, w * 0.18);
  ctx.beginPath(); ctx.moveTo(w * 0.32, -len); ctx.lineTo(w * 0.28, 40); ctx.stroke();
  const hy = -len - hr * 0.8;
  ctx.restore();
  // the head is drawn unrotated so its light stays top-left
  const hx = x + Math.sin(ang) * -hy, hyw = base + Math.cos(ang) * hy;
  glassBead(ctx, hx, hyw, hr, headCol, P);
}
function glassBead(ctx, x, y, r, col, P) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.beginPath(); ctx.arc(x + r * 0.45, y + r * 0.5, r * 1.05, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.arc(x + r * 0.35, y + r * 0.55, r * 0.35, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,' + [0.16, 0.38, 0.2][P.d] + ')';
  ctx.beginPath(); ctx.ellipse(x - r * 0.38, y - r * 0.4, r * 0.3, r * 0.17, -0.7, 0, TAU); ctx.fill();
  ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
}
// horseshoe magnet: arch at (x,y), legs of length 1.15s run "down" (rotated by ang)
function magnetPoles(x, y, s, ang) {
  const L = s * 1.15, c = Math.cos(ang), sn = Math.sin(ang);
  const w = (lx, ly) => [x + lx * c - ly * sn, y + lx * sn + ly * c];
  return [[...w(-0.75 * s, L), 1], [...w(0.75 * s, L), -1]];
}
function magnet(ctx, R, x, y, s, ang, P, red, silver) {
  const L = s * 1.15, ri = s * 0.5;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const pts = [[-s, L], [-s, 0]];
  for (let k = 1; k < 18; k++) { const a = Math.PI + k / 18 * Math.PI; pts.push([Math.cos(a) * s, Math.sin(a) * s]); }
  pts.push([s, 0], [s, L], [ri, L], [ri, 0]);
  for (let k = 17; k >= 1; k--) { const a = Math.PI + k / 18 * Math.PI; pts.push([Math.cos(a) * ri, Math.sin(a) * ri]); }
  pts.push([-ri, 0], [-ri, L]);
  const p = wobPath(R, pts, 1.1, 10);
  fillShape(ctx, R, p, red, P, { box: [-s, -s, s * 2, s + L], hatch: [0.9, 7], sw: s * 0.14, sx: 0, sy: -s * 0.06, rimCol: 'rgba(255,190,170,' + [0.12, 0.3, 0.12][P.d] + ')' });
  ctx.save(); ctx.clip(p);
  const ty = L - s * 0.4;
  ctx.fillStyle = silver; ctx.fillRect(-s - 4, ty, s * 2 + 8, s * 0.5);
  ctx.fillStyle = 'rgba(255,255,255,' + [0.1, 0.3, 0.12][P.d] + ')';
  for (const lx of [-s, ri]) ctx.fillRect(lx + s * 0.07, ty + 3, s * 0.08, s * 0.34);
  ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-s, ty); ctx.lineTo(s, ty); ctx.stroke();
  // a soft sheen sweeping round the crown
  ctx.strokeStyle = 'rgba(255,220,200,' + [0.05, 0.13, 0.05][P.d] + ')'; ctx.lineWidth = s * 0.12;
  ctx.beginPath(); ctx.arc(0, 0, s * 0.8, Math.PI * 1.12, Math.PI * 1.5); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.stroke(p);
  ctx.restore();
}
// iron filings combed into the field lines of a pair of poles: traced lines broken into short
// hairs, plus loose filings scattered thickest near the poles. Alpha fades out to radius rad.
function filings(ctx, R, poles, rad, color, lw = 1.3) {
  const [N, S] = poles, cx = (N[0] + S[0]) / 2, cy = (N[1] + S[1]) / 2;
  const field = (x, y) => {
    let ex = 0, ey = 0;
    for (const [px, py, q] of poles) { const dx = x - px, dy = y - py, r2 = dx * dx + dy * dy + 60, r3 = r2 * Math.sqrt(r2); ex += q * dx / r3; ey += q * dy / r3; }
    const l = Math.hypot(ex, ey) || 1; return [ex / l, ey / l];
  };
  const base = ctx.globalAlpha;
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  const dash = (x, y, fx, fy, l) => {
    const f = Math.max(0, 1 - Math.hypot(x - cx, y - cy) / rad);
    if (f <= 0) return;
    ctx.globalAlpha = base * Math.min(1, f * 1.6);
    ctx.beginPath(); ctx.moveTo(x - fx * l * 0.5, y - fy * l * 0.5); ctx.lineTo(x + fx * l * 0.5, y + fy * l * 0.5); ctx.stroke();
  };
  ctx.lineWidth = lw;
  const n = 30;
  for (let i = 0; i < n; i++) {
    const a = (i + R() * 0.6) / n * TAU;
    let x = N[0] + Math.cos(a) * 10, y = N[1] + Math.sin(a) * 10, run = 0;
    for (let s = 0; s < 700; s++) {
      const [fx, fy] = field(x, y);
      run += 3;
      if (run > 5 + R() * 4) { run = 0; dash(x + (R() - 0.5) * 2, y + (R() - 0.5) * 2, fx + (R() - 0.5) * 0.25, fy + (R() - 0.5) * 0.25, 3 + R() * 4); }
      x += fx * 3; y += fy * 3;
      if (Math.hypot(x - S[0], y - S[1]) < 10 || Math.hypot(x - cx, y - cy) > rad) break;
    }
  }
  ctx.lineWidth = lw * 0.8;
  for (let i = 0; i < 900; i++) {
    const a = R() * TAU, rr = Math.pow(R(), 0.8) * rad, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    const dm = Math.min(Math.hypot(x - N[0], y - N[1]), Math.hypot(x - S[0], y - S[1]));
    if (R() > Math.exp(-dm / (rad * 0.3))) continue;
    const [fx, fy] = field(x, y);
    dash(x, y, fx, fy, 2 + R() * 4);
  }
  ctx.globalAlpha = base;
}
// a tomato pincushion the size of a hill, pins driven in all over it
function pincushion(ctx, R, x, base, w, h, P, color, head) {
  const k = 6 + Math.floor(R() * 2), pts = [];
  for (let i = 0; i <= 48; i++) {
    const a = Math.PI + i / 48 * Math.PI, m = Math.abs(Math.sin((a - Math.PI) * k));
    const rr = 0.93 + 0.07 * Math.sqrt(m);
    pts.push([x + Math.cos(a) * w * rr, base + Math.sin(a) * h * rr]);
  }
  pts.push([x + w, base + 200], [x - w, base + 200]);
  // pins first, so the cushion swallows their points
  const np = 9 + Math.floor(R() * 6);
  for (let i = 0; i < np; i++) {
    const a = Math.PI * 1.08 + R() * Math.PI * 0.84, px = x + Math.cos(a) * w * 0.86, py = base + Math.sin(a) * h * 0.86;
    pin(ctx, R, px, py, h * (0.35 + R() * 0.3), a + Math.PI / 2 + (R() - 0.5) * 0.5 + 0.15, 5 + R() * 3, 9 + R() * 6, P, P.col, head(R));
  }
  const p = wobPath(R, pts, 2, 12);
  fillShape(ctx, R, p, color, P, { box: [x - w, base - h, w * 2, h + 200], hatch: [1.3, 9], mottleN: 18, sw: 30, sy: -16 });
  // creases between the lobes, curving like meridians
  ctx.save(); ctx.clip(p);
  for (let j = 1; j < k; j++) {
    const c = Math.cos(Math.PI - j * Math.PI / k), tx = x, ty = base - h * 0.95;
    const ex = x + c * w * 0.98, ey = base + 10, mx = x + c * w * 1.12, my = base - h * 0.75;
    wline(ctx, R, qpts(tx, ty, mx, my, ex, ey, 16), P.ink, 6);
    wline(ctx, R, qpts(tx + 4, ty + 4, mx + 8, my, ex + 8, ey, 16), P.rimA(0.05 + P.d * 0.02), 3);
  }
  ctx.restore();
  // the felt calyx on the crown
  for (let j = 0; j < 6; j++) {
    const a = j / 6 * TAU + R() * 0.3, l = w * (0.18 + R() * 0.08);
    ribbon(ctx, R, qpts(x, base - h * 0.98, x + Math.cos(a) * l * 0.6, base - h - 8, x + Math.cos(a) * l, base - h * 0.98 + Math.sin(a) * l * 0.25 + 6, 10), 14, 1, P.dark);
  }
  ribbon(ctx, R, qpts(x, base - h, x + 6, base - h - 30, x + 20, base - h - 44, 8), 8, 4, P.dark);
}
// a needle slung on two chains, red thread hanging from its eye. The eye end is at -len/2.
function hangNeedle(ctx, R, x, y, len, ang, w, P, color, thread) {
  const c = Math.cos(ang), s = Math.sin(ang), at2 = (t) => [x + c * len * t, y + s * len * t];
  for (const t of [-0.28, 0.24]) { const [cx, cy] = at2(t); chain(ctx, cx - 60 + R() * 40, -10, cx, cy - w * 0.4, 10 + P.d * 4, color, 2 + P.d); }
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const p = new Path2D();
  addWob(p, R, [[-len / 2 + w * 0.3, -w * 0.5], [len * 0.25, -w * 0.48], [len / 2, 0], [len * 0.25, w * 0.48], [-len / 2 + w * 0.3, w * 0.5], [-len / 2 - w * 0.25, w * 0.2], [-len / 2 - w * 0.25, -w * 0.2]], 0.8, 14);
  const eye = -len / 2 + w * 1.7;
  p.moveTo(eye + w, 0); p.ellipse(eye, 0, w, w * 0.16, 0, 0, TAU);
  fillShape(ctx, R, p, color, P, { rule: 'evenodd', box: [-len / 2 - w, -w, len + w, w * 2], hatch: [0.02, 5], shade: false, rx: 0, ry: -w * 0.18, rw: Math.max(1.5, w * 0.18) });
  ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(1.5, w * 0.2); ctx.beginPath(); ctx.moveTo(-len / 2, w * 0.3); ctx.lineTo(len * 0.3, w * 0.3); ctx.stroke();
  ctx.restore();
  const ex = x + c * eye, ey = y + s * eye;
  const tw = [2, 3, 5][P.d];
  ribbon(ctx, R, qpts(ex, ey, ex - 20, ey + 60, ex - 10 + (R() - 0.5) * 50, ey + 110 + R() * 80, 12), tw, tw * 0.5, thread);
  const tx = ex - 120 - R() * 200;
  ribbon(ctx, R, sag(ex, ey, tx, ey + 160 + R() * 200, 80 + R() * 60, 22), tw, tw * 0.4, thread);
}
// a hanging coil of wire
function coil(ctx, R, x, y0, r, len, turns, color, P) {
  const N = turns * 24, pts = [];
  for (let i = 0; i <= N; i++) { const t = i / N, a = t * turns * TAU; pts.push([x + Math.cos(a) * r, y0 + 30 + t * len + Math.sin(a) * r * 0.32]); }
  wline(ctx, R, [[x, y0], [x, y0 + 30 - r * 0.3]], color, 3);
  ctx.strokeStyle = color; ctx.lineWidth = 3 + P.d * 1.5; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke();
  ctx.strokeStyle = P.rimA(0.08 + P.d * 0.05); ctx.lineWidth = 1.2;
  for (let i = 0; i < N; i++) { const a = i / N * turns * TAU; if (Math.sin(a) > 0.2 && Math.cos(a) < 0) { ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1] - 1); ctx.lineTo(pts[i + 1][0], pts[i + 1][1] - 1); ctx.stroke(); } }
  const [lx, ly] = pts[N];
  wline(ctx, R, qpts(lx, ly, lx + 30, ly + 40, lx + (R() - 0.5) * 60, ly + 80 + R() * 80, 10), color, 2.5);
}
// a cast-iron treadle stand: lattice legs, spoked handwheel, treadle plate, and the machine's arm
function treadle(ctx, R, x, base, s, P, color, red) {
  const legs = [x - s * 0.5, x + s * 0.42], ty = base - s * 0.92;
  const fil = mix(color, P.style.rim, 0.06);
  for (const lx of legs) {
    const p = new Path2D();
    addWob(p, R, [[lx - s * 0.2, base + 30], [lx - s * 0.2, base - s * 0.04], [lx - s * 0.08, base - s * 0.12], [lx - s * 0.07, ty], [lx + s * 0.07, ty], [lx + s * 0.08, base - s * 0.12], [lx + s * 0.2, base - s * 0.04], [lx + s * 0.2, base + 30]], 1, 12);
    const win = [[lx - s * 0.11, base - s * 0.1], [lx - s * 0.04, ty + s * 0.08], [lx + s * 0.04, ty + s * 0.08], [lx + s * 0.11, base - s * 0.1]];
    addWob(p, R, win, 0.8, 10);
    fillShape(ctx, R, p, color, P, { rule: 'evenodd', box: [lx - s * 0.2, ty, s * 0.4, s], sw: 8 });
    // lattice and scroll rings in the window
    const wp = wobPath(R, win, 0.8, 10);
    ctx.save(); ctx.clip(wp);
    ctx.strokeStyle = fil; ctx.lineWidth = Math.max(2, s * 0.012);
    ctx.beginPath();
    for (let o = -s; o < s; o += s * 0.07) { ctx.moveTo(lx + o, base); ctx.lineTo(lx + o + s * 0.5, base - s); ctx.moveTo(lx + o, base); ctx.lineTo(lx + o - s * 0.5, base - s); }
    ctx.stroke();
    for (let k = 0; k < 4; k++) { ctx.lineWidth = Math.max(2, s * 0.014); ctx.beginPath(); ctx.arc(lx, base - s * (0.22 + k * 0.17), s * 0.04, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  // stretcher, table plank (cracked and tilted), and the treadle plate
  wline(ctx, R, [[legs[0], base - s * 0.42], [legs[1], base - s * 0.42]], color, s * 0.025);
  ctx.save(); ctx.translate(x, ty); ctx.rotate(-0.04 + (R() - 0.5) * 0.04);
  fillShape(ctx, R, wobPath(R, rectPts(-s * 0.78, -s * 0.06, s * 1.5, s * 0.06), 1, 10), color, P, { box: [-s * 0.8, -s * 0.07, s * 1.6, s * 0.08], hatch: [0.02, 5], sw: 6, sy: -4 });
  ctx.restore();
  const plate = wobPath(R, [[x - s * 0.36, base - s * 0.06], [x + s * 0.26, base - s * 0.14], [x + s * 0.28, base - s * 0.09], [x - s * 0.34, base - s * 0.01]], 0.8, 10);
  fillShape(ctx, R, plate, color, P, { box: [x - s * 0.4, base - s * 0.16, s * 0.7, s * 0.16], hatch: [0.8, 5], sw: 4 });
  // handwheel: a flywheel with curved spokes (no teeth)
  const wx = legs[1] + s * 0.2, wy = base - s * 0.5, wr = s * 0.27;
  ctx.strokeStyle = color; ctx.lineWidth = s * 0.035; ctx.beginPath(); ctx.arc(wx, wy, wr, 0, TAU); ctx.stroke();
  ctx.strokeStyle = P.rim; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(wx, wy, wr - s * 0.012, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
  const rot = R() * TAU;
  for (let k = 0; k < 5; k++) {
    const a = rot + k * TAU / 5, b = a + 0.5;
    ribbon(ctx, R, qpts(wx + Math.cos(a) * wr * 0.15, wy + Math.sin(a) * wr * 0.15, wx + Math.cos(a + 0.45) * wr * 0.6, wy + Math.sin(a + 0.45) * wr * 0.6, wx + Math.cos(b) * wr, wy + Math.sin(b) * wr, 10), s * 0.03, s * 0.016, color);
  }
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(wx, wy, s * 0.045, 0, TAU); ctx.fill();
  ctx.fillStyle = P.rim; ctx.beginPath(); ctx.arc(wx - 2, wy - 2, s * 0.012, 0, TAU); ctx.fill();
  // pitman rod from the plate to the wheel's crank, and the drive belt up to the table
  wline(ctx, R, [[x + s * 0.24, base - s * 0.12], [wx + wr * 0.35, wy + wr * 0.3]], color, s * 0.016);
  wline(ctx, R, [[wx - wr * 0.9, wy - wr * 0.3], [x + s * 0.3, ty - s * 0.2]], color, 2.5);
  // the machine's arm on the table, its needle bar still down
  const ay = ty - s * 0.06;
  const arm = wobPath(R, [[x + s * 0.34, ay], [x + s * 0.34, ay - s * 0.42], [x + s * 0.28, ay - s * 0.48], [x - s * 0.36, ay - s * 0.46], [x - s * 0.42, ay - s * 0.4], [x - s * 0.42, ay - s * 0.27], [x - s * 0.32, ay - s * 0.24], [x + s * 0.12, ay - s * 0.3], [x + s * 0.16, ay - s * 0.08], [x + s * 0.2, ay]], 1.2, 12);
  fillShape(ctx, R, arm, color, P, { box: [x - s * 0.45, ay - s * 0.5, s * 0.85, s * 0.5], hatch: [0.1, 6], sw: 12 });
  // a faded red guild-stripe along the arm
  ctx.save(); ctx.clip(arm); ctx.strokeStyle = rgba(mix(red, color, 0.3), 0.7); ctx.lineWidth = s * 0.014;
  ctx.beginPath(); ctx.moveTo(x - s * 0.38, ay - s * 0.36); ctx.lineTo(x + s * 0.28, ay - s * 0.39); ctx.stroke(); ctx.restore();
  wline(ctx, R, [[x - s * 0.37, ay - s * 0.26], [x - s * 0.37, ay - s * 0.08]], color, s * 0.022);
  wline(ctx, R, [[x - s * 0.37, ay - s * 0.08], [x - s * 0.37, ay - s * 0.01]], P.rim, 1.5);
}
// a quench trough breathing forge light and steam
function trough(ctx, R, x, base, w, P, color, forge) {
  const h = w * 0.32;
  glow(ctx, x, base - h, w * 1.1, forge(0.28));
  for (let k = 0; k < 4; k++) ribbon(ctx, R, qpts(x - w * 0.3 + R() * w * 0.6, base - h, x + (R() - 0.5) * 80, base - h - 120, x + (R() - 0.5) * 140, base - h - 220 - R() * 140, 14), 10 + R() * 12, 30, P.rimA(0.025 + P.d * 0.01), 0.6);
  const p = wobPath(R, [[x - w / 2, base - h], [x + w / 2, base - h], [x + w / 2 - 10, base + 30], [x - w / 2 + 10, base + 30]], 1, 10);
  fillShape(ctx, R, p, color, P, { box: [x - w / 2, base - h, w, h + 30], hatch: [0.05, 6], sw: 8 });
  ctx.fillStyle = P.rim;
  for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(x - w / 2 + 10 + k * (w - 20) / 5, base - h + 9, 2.2, 0, TAU); ctx.fill(); }
  ctx.fillStyle = forge(0.85); ctx.beginPath(); ctx.ellipse(x, base - h + 1, w / 2 - 6, 4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,230,170,' + [0.3, 0.7, 0.5][P.d] + ')'; ctx.fillRect(x - w * 0.3, base - h, w * 0.5, 1.5);
  // tongs leaning on the rim
  wline(ctx, R, [[x + w / 2 - 20, base - h - 50], [x + w / 2 + 14, base + 10]], color, 4);
  wline(ctx, R, [[x + w / 2 - 6, base - h - 52], [x + w / 2 + 6, base + 10]], color, 4);
}
function anvil(ctx, R, x, base, s, P, color) {
  const q = [[-0.4, 0.4], [0.4, 0.4], [0.32, 0.1], [0.18, 0.02], [0.18, -0.3], [0.5, -0.34], [0.55, -0.48], [-0.3, -0.48], [-0.82, -0.44], [-0.3, -0.33], [-0.18, -0.3], [-0.18, 0.02], [-0.32, 0.1]];
  const p = wobPath(R, q.map(([a, b]) => [x + a * s, base - s * 0.4 + b * s]), 1, 10);
  fillShape(ctx, R, p, color, P, { box: [x - s, base - s, s * 2, s * 1.2], hatch: [0.2, 6], sw: 8 });
  ctx.strokeStyle = P.rimA(0.3); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - s * 0.3, base - s * 0.87); ctx.lineTo(x + s * 0.54, base - s * 0.87); ctx.stroke();
}
function bottleKiln(ctx, R, x, base, w, h, P) {
  const neck = w * 0.22, sh = base - h * 0.45;
  const pts = [[x - w / 2, base + 30], [x - w / 2 - 6, base - h * 0.15], [x - w * 0.46, sh + h * 0.08], [x - w * 0.3, sh - h * 0.07], [x - neck, sh - h * 0.2], [x - neck * 0.85, base - h], [x + neck * 0.85, base - h], [x + neck, sh - h * 0.2], [x + w * 0.3, sh - h * 0.07], [x + w * 0.46, sh + h * 0.08], [x + w / 2 + 6, base - h * 0.15], [x + w / 2, base + 30]];
  const p = wobPath(R, pts, 2, 10);
  // smoke plume
  for (let k = 0; k < 7; k++) { const t = k / 7; ctx.fillStyle = P.rimA(0.035 * (1 - t)); ctx.beginPath(); ctx.ellipse(x + t * t * 160 * (R() < 0.5 ? 1 : 1), base - h - 30 - t * 300, 30 + t * 90, 22 + t * 50, 0, 0, TAU); ctx.fill(); }
  fillShape(ctx, R, p, P.col, P, { box: [x - w / 2, base - h, w, h], hatch: [Math.PI / 2, 7] });
  ctx.save(); ctx.clip(p); masonry(ctx, R, x - w / 2, base - h, w, h, 20, P.line);
  // iron hoops
  for (let k = 0; k < 4; k++) { const y = sh - h * 0.05 + k * h * 0.11; wline(ctx, R, qpts(x - w, y, x, y + 14, x + w, y, 10), P.dark, 3); }
  ctx.restore();
  // glowing mouth
  const my = base - 10, mw = w * 0.32;
  glow(ctx, x, my - 30, w * 0.8, P.glow(0.35));
  const mp = wobPath(R, archPts(x, mw, my - mw * 0.6, my + 20, 0.5, 8), 1, 6);
  ctx.fillStyle = P.acc(0.75); ctx.fill(mp);
  ctx.fillStyle = P.glow(0.9); ctx.beginPath(); ctx.ellipse(x, my, mw * 0.3, mw * 0.2, 0, 0, TAU); ctx.fill();
  // glowing cracks
  for (let k = 0; k < 2; k++) { const cx = x + (R() - 0.5) * w * 0.6, cy = base - h * (0.15 + R() * 0.3); wline(ctx, R, [[cx, cy], [cx + 6, cy + 14], [cx + 2, cy + 26], [cx + 8, cy + 40]], P.acc(0.4), 1.5); }
}
function vessel(ctx, R, x, base, w, h, P) {
  const neck = w * (0.15 + R() * 0.2), belly = 0.3 + R() * 0.4;
  const pts = [[x - w * 0.4, base], [x - w / 2, base - h * belly], [x - neck, base - h * 0.8], [x - neck * 1.4, base - h], [x + neck * 1.4, base - h], [x + neck, base - h * 0.8], [x + w / 2, base - h * belly], [x + w * 0.4, base]];
  const p = wobPath(R, pts, 0.5, 5);
  const lit = R() < 0.15;
  ctx.fillStyle = lit ? P.acc(0.25) : P.mid; ctx.fill(p);
  ctx.strokeStyle = P.rim; ctx.lineWidth = 1; ctx.save(); ctx.clip(p); ctx.translate(2, 0); ctx.stroke(p); ctx.restore();
}
function belfry(ctx, R, x, base, w, h, P) {
  const top = base - h, bh = w * 1.3;
  const body = wobPath(R, [[x - w / 2, base], [x - w / 2 + 2, top + bh], [x - w / 2 - 6, top + bh - 6], [x - w / 2 - 6, top], [x + w / 2 + 6, top], [x + w / 2 + 6, top + bh - 6], [x + w / 2 - 2, top + bh], [x + w / 2, base]], 1.5, 10);
  const p = new Path2D(); p.addPath(body);
  const ow = w * 0.55;
  addWob(p, R, archPts(x, ow, top + bh * 0.4, top + bh - 10, 0.5, 8), 1, 6);
  fillShape(ctx, R, p, P.col, P, { rule: 'evenodd', box: [x - w, top - w, w * 2, h + w], hatch: [Math.PI / 2, 7] });
  ctx.save(); ctx.clip(p, 'evenodd'); masonry(ctx, R, x - w, top + bh, w * 2, h, 18, P.line); ctx.restore();
  // bell in the opening
  bell(ctx, R, x, top + bh * 0.35, ow * 0.8, P.col, P, {});
  // roof
  const roof = wobPath(R, [[x - w / 2 - 14, top + 4], [x - w / 2 - 4, top - 4], [x + (R() - 0.5) * 6, top - w * (1.4 + R() * 0.8)], [x + w / 2 + 4, top - 4], [x + w / 2 + 14, top + 4]], 1.2, 9);
  fillShape(ctx, R, roof, P.col, P, { box: [x - w, top - w * 2.4, w * 2, w * 2.4], hatch: [0.8, 6] });
  // pennant
  const py = top - w * 1.4;
  if (R() < 0.6) { ctx.fillStyle = mix(P.col, P.style.accent, 0.2); ctx.beginPath(); ctx.moveTo(x, py); ctx.quadraticCurveTo(x + 30, py + 2, x + 60, py + 10); ctx.quadraticCurveTo(x + 30, py + 12, x, py + 16); ctx.fill(); }
  // windows down the shaft
  for (let y = top + bh + 40; y < base - 40; y += 70 + R() * 50) if (R() < 0.5) { ctx.fillStyle = R() < 0.4 ? P.acc(0.5) : P.deep; ctx.fillRect(x - 4 + (R() - 0.5) * w * 0.3, y, 8, 14); }
}
function eggSac(ctx, R, x, y0, len, s, P) {
  wline(ctx, R, qpts(x, y0, x + (R() - 0.5) * 30, y0 + len / 2, x, y0 + len, 10), P.col, 2.5);
  const y = y0 + len;
  glow(ctx, x, y + s, s * 2.5, P.acc(0.14));
  const p = wobPath(R, Array.from({ length: 14 }, (_, k) => { const a = k / 14 * TAU; return [x + Math.cos(a) * s * 0.8, y + s + Math.sin(a) * s * (Math.sin(a) > 0 ? 1.15 : 0.95)]; }), 1, 6);
  fillShape(ctx, R, p, P.col, P, { shade: false, rimCol: P.acc(0.3) });
  ctx.save(); ctx.clip(p);
  for (let k = 0; k < 5; k++) { ctx.fillStyle = P.acc(0.22); ctx.beginPath(); ctx.arc(x + (R() - 0.5) * s, y + s + (R() - 0.3) * s, s * 0.22, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function loomFrame(ctx, R, x, top, w, base, P, detail) {
  const col = P.col, post = detail ? 30 : 22, rollY = top + 10;
  // the warp: taut threads from the roller, converging as they fall into the abyss
  const vy = base + 900, conv = 0.45;
  const tx0 = x - w / 2 + post, tx1 = x + w / 2 - post, step = detail ? 5 : 7;
  const at_ = (tx, y) => tx + (x - tx) * conv * (y - rollY) / (vy - rollY);
  glow(ctx, x, rollY + 40, w * 0.8, P.acc(detail ? 0.08 : 0.14));
  ctx.lineWidth = 1;
  for (let tx = tx0; tx <= tx1; tx += step * (0.7 + R() * 0.6)) {
    ctx.strokeStyle = P.acc((detail ? 0.1 : 0.1) + R() * 0.08);
    ctx.beginPath(); ctx.moveTo(tx, rollY); ctx.lineTo(at_(tx, H + 40), H + 40); ctx.stroke();
  }
  if (detail) {
    // half-woven cloth hanging from the roller, its lower edge unfinished and frayed
    const cb = rollY + 140 + R() * 120, pts = [[tx0, rollY], [tx1, rollY], [at_(tx1, cb), cb]];
    const k = 14;
    for (let i = 1; i < k; i++) { const t = i / k, xx = at_(tx1, cb) + (at_(tx0, cb) - at_(tx1, cb)) * t; pts.push([xx, cb + (R() - 0.3) * 30 * Math.sin(t * Math.PI)]); }
    pts.push([at_(tx0, cb), cb]);
    const cp = wobPath(R, pts, 1.5, 10);
    fillShape(ctx, R, cp, mix(col, P.style.accent, 0.07), P, { box: [tx0, rollY, w, cb - rollY + 40], hatch: [0.02, 4], mottleN: 6, rx: 0, ry: 3 });
    ctx.save(); ctx.clip(cp); hatch(ctx, R, tx0, rollY, w, cb - rollY + 40, Math.PI / 2, 4, P.line, 1);
    // a woven band pattern
    for (let i = 0; i < 3; i++) { const by = rollY + 30 + i * 36 + R() * 10; ctx.fillStyle = P.acc(0.05); ctx.fillRect(tx0, by, w, 8); }
    ctx.restore();
    // loose weft threads trailing from the unfinished edge
    for (let i = 0; i < 6; i++) { const fx = at_(tx0, cb) + R() * (at_(tx1, cb) - at_(tx0, cb)); wline(ctx, R, qpts(fx, cb, fx + (R() - 0.5) * 30, cb + 40, fx + (R() - 0.5) * 60, cb + 60 + R() * 120, 8), P.acc(0.18), 1); }
    // heddle bar slung from the beam, with its leashes
    const hy = cb + 120 + R() * 80, hx0 = at_(tx0, hy) - 30, hx1 = at_(tx1, hy) + 30;
    wline(ctx, R, [[hx0 + 20, top - 10], [hx0 + 20, hy]], col, 3); wline(ctx, R, [[hx1 - 20, top - 10], [hx1 - 20, hy]], col, 3);
    ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.beginPath();
    for (let xx = hx0 + 30; xx < hx1 - 30; xx += 7) { ctx.moveTo(xx, hy - 30); ctx.lineTo(xx + 1, hy + 30); }
    ctx.stroke();
    fillShape(ctx, R, wobPath(R, rectPts(hx0, hy - 36, hx1 - hx0, 10), 1, 10), col, P, { shade: false });
    fillShape(ctx, R, wobPath(R, rectPts(hx0, hy + 28, hx1 - hx0, 10), 1, 10), col, P, { shade: false });
    // the shuttle, mid-throw, trailing its weft
    const sx = x + (R() - 0.5) * w * 0.3, sy = hy + 120 + R() * 100;
    wline(ctx, R, sag(at_(tx0, sy) - 10, sy - 30, sx - 40, sy, 30, 10), P.acc(0.25), 1.2);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate((R() - 0.5) * 0.3);
    fillShape(ctx, R, wobPath(R, [[-56, 0], [-24, -11], [24, -11], [56, 0], [24, 11], [-24, 11]], 0.8, 6), P.lite, P, { shade: false, box: [-56, -12, 112, 24], hatch: [0, 3] });
    ctx.fillStyle = P.deep; ctx.fillRect(-16, -4, 32, 8);
    ctx.restore();
  }
  // posts leaning in like a great A-frame, plunging down out of sight
  for (const sgn of [-1, 1]) {
    const px = x + sgn * w / 2, lean = sgn * w * 0.08;
    fillShape(ctx, R, wobPath(R, [[px - post / 2, top - 50], [px + post / 2, top - 50], [px + post / 2 + lean, H + 40], [px - post / 2 + lean, H + 40]], 1.5, 12), col, P, { box: [px - post, top, post * 2, H], hatch: [Math.PI / 2, 5] });
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(px, top - 54, post * 0.7, post * 0.9, 0, 0, TAU); ctx.fill();
    // pegs and lashings
    for (let k = 0; k < 4; k++) { const yy = top + 160 + k * 170 + R() * 40; wline(ctx, R, [[px - post * 0.8, yy], [px + post * 0.8, yy + 6]], P.rim, 2); }
  }
  // top beam with knobbed ends, and the roller wound thick with thread
  fillShape(ctx, R, wobPath(R, [[x - w / 2 - 50, top - 30], [x + w / 2 + 50, top - 34], [x + w / 2 + 40, top - 4], [x - w / 2 - 40, top]], 1.5, 12), col, P, { box: [x - w / 2 - 50, top - 34, w + 100, 34], hatch: [0, 5] });
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, rollY, w / 2 - post * 0.3, post * 0.75, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = P.acc(detail ? 0.16 : 0.1); ctx.lineWidth = 1; ctx.beginPath();
  for (let k = -w / 2 + post; k < w / 2 - post; k += 3) { ctx.moveTo(x + k, rollY - post * 0.6); ctx.lineTo(x + k + 4, rollY + post * 0.6); }
  ctx.stroke();
}
function spire(ctx, R, x, base, w, h, P) {
  const top = base - h;
  const pts = [[x - w / 2, base], [x - w * 0.42, top + h * 0.35], [x - w * 0.62, top + h * 0.3], [x - w * 0.62, top + h * 0.26], [x - w * 0.36, top + h * 0.22], [x - w * 0.3, top + w * 1.2]];
  const right = pts.map(([px, py]) => [2 * x - px, py]).reverse();
  const p = wobPath(R, [...pts, [x, top + w * 0.2], ...right], 1.2, 9);
  fillShape(ctx, R, p, P.col, P, { box: [x - w, top, w * 2, h], hatch: [Math.PI / 2, 6] });
  // crescent cradle on top
  ctx.strokeStyle = P.col; ctx.lineWidth = Math.max(3, w * 0.18);
  ctx.beginPath(); ctx.arc(x, top + w * 0.1 - w * 0.6, w * 0.6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  wline(ctx, R, [[x, top + w * 0.2], [x, top - w * 0.2]], P.col, Math.max(2, w * 0.12));
  for (let k = 0; k < 3; k++) if (R() < 0.6) { const wy = top + h * (0.3 + k * 0.18); ctx.fillStyle = R() < 0.6 ? P.glow(0.5) : P.deep; ctx.beginPath(); ctx.ellipse(x, wy, w * 0.08 + 1.5, w * 0.16 + 3, 0, 0, TAU); ctx.fill(); }
}
function column(ctx, R, x, w, top, bot, P) {
  const cap = 22 + w * 0.2, baseH = 30 + w * 0.2;
  const pts = [[x - w / 2 - 12, bot], [x - w / 2 - 12, bot - baseH * 0.4], [x - w / 2 - 4, bot - baseH * 0.5], [x - w / 2, bot - baseH], [x - w / 2 + 3, top + cap], [x - w / 2 - 12, top + cap * 0.6], [x - w / 2 - 16, top], [x + w / 2 + 16, top], [x + w / 2 + 12, top + cap * 0.6], [x + w / 2 - 3, top + cap], [x + w / 2, bot - baseH], [x + w / 2 + 4, bot - baseH * 0.5], [x + w / 2 + 12, bot - baseH * 0.4], [x + w / 2 + 12, bot]];
  const p = wobPath(R, pts, 1.2, 10);
  fillShape(ctx, R, p, P.col, P, { box: [x - w, top, w * 2, bot - top], mottleN: 6 });
  ctx.save(); ctx.clip(p);
  for (let k = 1; k < 5; k++) { const fx = x - w / 2 + w * k / 5; wline(ctx, R, [[fx, top + cap + 4], [fx, bot - baseH - 4]], k < 3 ? P.rimA(0.08 + P.d * 0.03) : P.ink, Math.max(1.5, w * 0.05)); }
  // cracks
  if (R() < 0.6) { const cy = top + (bot - top) * (0.3 + R() * 0.4); wline(ctx, R, [[x - w / 2, cy], [x - w * 0.2, cy + 10], [x - w * 0.1, cy + 30], [x + w * 0.05, cy + 36]], P.deep, 1.5, 1.5); }
  ctx.restore();
}
function statue(ctx, R, x, base, h, P, color) {
  // a robed, horned guardian on a plinth: an echo of a fallen foe
  const w = h * 0.36, pl = h * 0.16;
  fillShape(ctx, R, wobPath(R, rectPts(x - w * 0.7, base - pl, w * 1.4, pl + 40), 1, 8), color, P, {});
  const b = base - pl, horn = R() < 0.5;
  const pts = [[x - w / 2, b], [x - w * 0.42, b - h * 0.45], [x - w * 0.3, b - h * 0.62], [x - w * 0.24, b - h * 0.72], [x - w * 0.2, b - h * 0.84]];
  if (horn) pts.push([x - w * 0.45, b - h * 0.98], [x - w * 0.12, b - h * 0.9]); else pts.push([x - w * 0.08, b - h * 0.94]);
  const right = pts.map(([px, py]) => [2 * x - px, py]).reverse();
  const p = wobPath(R, [...pts, [x, b - h * 0.92], ...right], 1, 8);
  fillShape(ctx, R, p, color, P, { box: [x - w, b - h, w * 2, h], hatch: [Math.PI / 2 + 0.2, 5] });
  ctx.fillStyle = P.glow(0.35);
  ctx.beginPath(); ctx.ellipse(x - w * 0.08, b - h * 0.78, 2.5, 4, 0, 0, TAU); ctx.ellipse(x + w * 0.08, b - h * 0.78, 2.5, 4, 0, 0, TAU); ctx.fill();
}
