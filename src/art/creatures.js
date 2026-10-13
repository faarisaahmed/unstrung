// Parametric hand-inked creature painters. Each painter draws in a local frame:
// origin at the creature's bottom-center (ground creatures) or center (flyers, `centered: true`),
// facing +x. Size comes from e.w / e.h. A = art params {c1, c2, c3, eye, ...}.
//
// Style: confident silhouettes with a pressure-weighted contour (heavy on the shadow side, a hairline
// on the lit side), flat fills with a painted shadow crescent and a thin rim light, tapered brush
// strokes for limbs/antennae/details, pale masks with deep sockets.
import { TAU } from '../core/math.js';

export const INK = '#16141c';

// ------------------------------------------------------------------ colour helpers
const _rgbCache = new Map();
function parseCol(c) {
  if (typeof c !== 'string') return null;
  let v = _rgbCache.get(c);
  if (v !== undefined) return v;
  v = null;
  if (c[0] === '#') {
    let s = c.slice(1);
    if (s.length === 3 || s.length === 4) s = s.split('').map((k) => k + k).join('');
    if (s.length >= 6) v = [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16), s.length === 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1];
  } else {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(',').map(Number); v = [p[0], p[1], p[2], p[3] ?? 1]; }
  }
  if (v && v.some((k) => Number.isNaN(k))) v = null;
  _rgbCache.set(c, v);
  return v;
}
function mixTo(c, to, k) {
  const a = parseCol(c);
  if (!a) return null;
  const r = Math.round(a[0] + (to[0] - a[0]) * k), g = Math.round(a[1] + (to[1] - a[1]) * k), b = Math.round(a[2] + (to[2] - a[2]) * k);
  return a[3] < 1 ? `rgba(${r},${g},${b},${a[3]})` : `rgb(${r},${g},${b})`;
}
const DEEP = [26, 18, 40], PAPER = [255, 248, 228];
// painted shadow tone: toward a cool deep violet (never grey)
export function shade(c, k = 0.4) { return mixTo(c, DEEP, k) || c; }
export function lighten(c, k = 0.3) { return mixTo(c, PAPER, k) || c; }

// ------------------------------------------------------------------ ink primitives
function ink(ctx, lw = 2) { ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }

const LX = -0.55, LY = -0.83; // light comes from the upper-left (local frame)

// The core inked form: trace(ctx) adds the outline to the current path (it is called several
// times under different offsets). o.lw contour weight, o.sd shadow depth (px), o.hatch adds pen
// hatching inside the shadow, o.rim false disables the rim light, o.dk shadow strength.
function form(ctx, fill, trace, o = {}) {
  const lw = o.lw ?? 2, sd = o.sd ?? 3;
  // 1) heavy contour, nudged toward the shadow side: the fill covers its inner half
  ctx.save();
  ctx.translate(-LX * lw * 0.32, -LY * lw * 0.32);
  ctx.beginPath(); trace(ctx); ink(ctx, lw * 1.15); ctx.stroke();
  ctx.restore();
  // 2) flat fill
  ctx.beginPath(); trace(ctx);
  ctx.fillStyle = fill; ctx.fill();
  // 3) painted shadow crescent + rim light, clipped to the form
  if (sd > 0 && o.shadow !== false) {
    const dk = parseCol(fill) ? shade(fill, o.dk ?? 0.42) : 'rgba(22,20,28,0.3)';
    ctx.save();
    ctx.clip();
    ctx.beginPath(); ctx.rect(-4000, -4000, 8000, 8000);
    ctx.save(); ctx.translate(LX * sd, LY * sd); trace(ctx); ctx.restore();
    ctx.fillStyle = dk; ctx.fill('evenodd');
    if (o.hatch) {
      ctx.save(); ctx.clip('evenodd');
      const [bx, by, bw, bh] = o.hatch;
      ctx.strokeStyle = INK; ctx.globalAlpha *= 0.45; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let k = -bh; k < bw; k += 2.8) { ctx.moveTo(bx + k, by + bh); ctx.lineTo(bx + k + bh * 0.8, by); }
      ctx.stroke();
      ctx.restore();
    }
    if (o.rim !== false && parseCol(fill)) {
      ctx.beginPath(); ctx.rect(-4000, -4000, 8000, 8000);
      ctx.save(); ctx.translate(-LX * sd * 0.4, -LY * sd * 0.4); trace(ctx); ctx.restore();
      ctx.fillStyle = lighten(fill, 0.38); ctx.globalAlpha *= 0.75; ctx.fill('evenodd');
    }
    ctx.restore();
  }
  // 4) crisp hairline on top of everything
  ctx.beginPath(); trace(ctx); ink(ctx, lw * 0.7); ctx.stroke();
}

// Legacy-compatible: fill + pressure-weighted stroke of the current path.
function fillInk(ctx, fill, lw = 2) {
  ctx.fillStyle = fill; ctx.fill();
  ink(ctx, lw); ctx.stroke();
}

// Bezier helpers. P = [x0,y0, x1,y1] | [x0,y0, cx,cy, x1,y1] | [x0,y0, c1x,c1y, c2x,c2y, x1,y1]
function bz(P, t) {
  const u = 1 - t;
  if (P.length === 4) return [P[0] * u + P[2] * t, P[1] * u + P[3] * t];
  if (P.length === 6) return [u * u * P[0] + 2 * u * t * P[2] + t * t * P[4], u * u * P[1] + 2 * u * t * P[3] + t * t * P[5]];
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * P[0] + b * P[2] + c * P[4] + d * P[6], a * P[1] + b * P[3] + c * P[5] + d * P[7]];
}
// A tapered brush stroke along a curve: width goes w0 -> w1, plus an optional belly (swell mid-stroke).
function brush(ctx, P, w0, w1, color = INK, belly = 0, n = 10) {
  const L = [], R = [];
  let prev = bz(P, 0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = bz(P, t);
    const q = bz(P, Math.min(1, t + 0.02)), o = bz(P, Math.max(0, t - 0.02));
    let dx = q[0] - o[0], dy = q[1] - o[1];
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const wd = (w0 + (w1 - w0) * t + belly * Math.sin(Math.PI * t)) * 0.5;
    L.push(p[0] - dy * wd, p[1] + dx * wd); R.push(p[0] + dy * wd, p[1] - dx * wd);
    prev = p;
  }
  ctx.beginPath();
  ctx.moveTo(L[0], L[1]);
  for (let i = 2; i < L.length; i += 2) ctx.lineTo(L[i], L[i + 1]);
  for (let i = R.length - 2; i >= 0; i -= 2) ctx.lineTo(R[i], R[i + 1]);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  if (w0 > 1.6) { ctx.beginPath(); ctx.arc(P[0], P[1], w0 * 0.5, 0, TAU); ctx.fill(); }
  void prev;
}
// a short detail stroke that swells in the middle and tapers at both ends
function stroke(ctx, P, w, color = INK) { brush(ctx, P, w * 0.25, w * 0.2, color, w * 0.8, 8); }

// jointed insect leg: hip -> knee -> foot, tapering to a point
function leg(ctx, x0, y0, kx, ky, fx, fy, lw, col = INK) {
  brush(ctx, [x0, y0, (x0 + kx) / 2, (y0 + ky) / 2 - lw * 0.6, kx, ky], lw * 1.15, lw * 0.85, col, 0, 6);
  brush(ctx, [kx, ky, kx + (fx - kx) * 0.6, ky + (fy - ky) * 0.35, fx, fy], lw * 0.85, lw * 0.2, col, 0, 7);
}
function legs(ctx, n, w, y, len, phase, lw = 2, spread = 1) {
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n);
    const out = x >= 0 ? 1 : -1;
    const s = Math.sin(phase + i * 2.1);
    const lift = Math.max(0, s) * len * 0.3;
    const kx = x + out * len * 0.35 * spread + s * len * 0.15, ky = y + len * 0.2 - lift * 0.6;
    const fx = x + out * len * 0.45 * spread + s * len * 0.3, fy = y + len - lift;
    leg(ctx, x, y, kx, ky, fx, fy, lw);
  }
}

// smooth closed curve through points (midpoint quadratic)
function smooth(ctx, pts, closed = true) {
  const n = pts.length;
  if (!closed) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
    return;
  }
  const m = (i) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
  const s = m(n - 1);
  ctx.moveTo(s[0], s[1]);
  for (let i = 0; i < n; i++) { const e = m(i); ctx.quadraticCurveTo(pts[i][0], pts[i][1], e[0], e[1]); }
  ctx.closePath();
}
// organic ellipse: a little lopsided, never compass-perfect
function oval(ctx, cx, cy, rx, ry, rot = 0, wob = 0.05, k = 3, ph = 0.7) {
  const pts = [], n = 18, c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const r = 1 + wob * Math.sin(a * k + ph) + wob * 0.5 * Math.sin(a * 2 - ph);
    const x = Math.cos(a) * rx * r, y = Math.sin(a) * ry * r;
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  smooth(ctx, pts);
}
// tufted fur outline (hooked tufts flicked one way)
function fur(ctx, cx, cy, rx, ry, n, d, ph = 0, a0 = 0, a1 = TAU) {
  const full = a1 - a0 >= TAU - 1e-3;
  const step = (a1 - a0) / n;
  const P = (a, k) => [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  const p0 = P(a0, 1);
  if (full) ctx.moveTo(p0[0], p0[1]); else ctx.lineTo(p0[0], p0[1]);
  for (let i = 0; i < n; i++) {
    const a = a0 + i * step;
    const dd = d * (0.65 + 0.35 * Math.sin(i * 2.7 + ph));
    const c1 = P(a + step * 0.15, 1 + dd * 0.9), tip = P(a + step * 0.6, 1 + dd);
    const c2 = P(a + step * 0.8, 1 - dd * 0.15), nx = P(a + step, 1);
    ctx.quadraticCurveTo(c1[0], c1[1], tip[0], tip[1]);
    ctx.quadraticCurveTo(c2[0], c2[1], nx[0], nx[1]);
  }
  if (full) ctx.closePath();
}

// stable per-creature variation (not colour-based, so the hurt flash matches)
function seedOf(e, A) {
  const s = `${A.body}${e.w}x${e.h}${A.eye || ''}${A.horn || ''}${A.segs || ''}${A.n || ''}${A.eyes || ''}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}

function withAlpha(c, a) { const v = parseCol(c); return v ? `rgba(${v[0]},${v[1]},${v[2]},${a * v[3]})` : 'rgba(255,255,255,0.3)'; }
const isDark = (c) => { const v = parseCol(c); return !!v && v[0] + v[1] + v[2] < 150; };

export function eye(ctx, x, y, r, color = '#fff', glow = false, shape = 'round') {
  ctx.save();
  if (glow) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
    g.addColorStop(0, color); g.addColorStop(0.35, withAlpha(color, 0.35)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= 0.4;
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, TAU); ctx.fill();
    ctx.restore(); ctx.save();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  if (shape === 'slit') ctx.ellipse(x, y, r * 0.5, r * 1.25, 0, 0, TAU);
  else if (shape === 'angry') {
    // a hooded, slanted almond
    ctx.moveTo(x - r * 1.05, y - r * 0.55);
    ctx.quadraticCurveTo(x + r * 0.2, y - r * 0.35, x + r * 1.05, y + r * 0.05);
    ctx.quadraticCurveTo(x + r * 0.5, y + r * 0.95, x - r * 0.3, y + r * 0.75);
    ctx.quadraticCurveTo(x - r * 1.0, y + r * 0.4, x - r * 1.05, y - r * 0.55);
  } else ctx.ellipse(x, y, r * 0.92, r * 1.08, 0, 0, TAU);
  ctx.fill();
  if (r >= 1.6) {
    if (isDark(color)) { // dark eyes get a tiny wet glint
      ctx.fillStyle = 'rgba(255,250,235,0.9)';
      ctx.beginPath(); ctx.arc(x + r * 0.28, y - r * 0.38, Math.max(0.6, r * 0.28), 0, TAU); ctx.fill();
    } else if (!glow && shape === 'round' && r >= 2.2) { // pale eyes get a pinprick pupil
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(x + r * 0.25, y + r * 0.05, r * 0.32, r * 0.45, 0, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// almond eye socket carved into a mask
function socket(ctx, x, y, rx, ry, tilt) {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(x - rx, y - ry * 0.1);
  ctx.bezierCurveTo(x - rx * 0.8, y - ry * 1.15, x + rx * 0.9, y - ry * 1.2, x + rx, y - ry * 0.05 + tilt);
  ctx.bezierCurveTo(x + rx * 0.85, y + ry * 1.0, x - rx * 0.7, y + ry * 1.05, x - rx, y - ry * 0.1);
  ctx.fill();
}

// Pale HK-style mask face
function mask(ctx, x, y, r, A, f = 1) {
  const pale = A.c3 || '#efe8d8';
  form(ctx, pale, (c) => {
    c.moveTo(x - r * 0.98, y - r * 0.05);
    c.bezierCurveTo(x - r * 1.05, y - r * 1.05, x - r * 0.3, y - r * 1.32, x + r * 0.05, y - r * 1.28);
    c.bezierCurveTo(x + r * 0.55, y - r * 1.28, x + r * 1.05, y - r * 0.95, x + r * 1.0, y - r * 0.05);
    c.bezierCurveTo(x + r * 0.95, y + r * 0.55, x + r * 0.45, y + r * 0.95, x + r * 0.05, y + r * 1.12);
    c.bezierCurveTo(x - r * 0.4, y + r * 0.95, x - r * 0.95, y + r * 0.55, x - r * 0.98, y - r * 0.05);
  }, { lw: Math.max(1.6, r * 0.16), sd: r * 0.22, dk: 0.3 });
  // brow crease
  stroke(ctx, [x - r * 0.15, y - r * 0.92, x + r * 0.05, y - r * 1.0, x + r * 0.25, y - r * 0.9], Math.max(0.8, r * 0.07), shade(pale, 0.45));
  for (const s of [-1, 1]) socket(ctx, x + s * r * 0.4 + f, y - r * 0.08, r * 0.27, r * 0.4, s * r * 0.1);
  if (A.eye && A.eye !== INK) {
    for (const s of [-1, 1]) eye(ctx, x + s * r * 0.38 + f, y - r * 0.02, r * 0.11, A.eye, true);
  }
}

function spikesArc(ctx, cx, cy, rx, ry, a0, a1, n, len, fill) {
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (i + 0.5) / n;
    const l = len * (0.8 + 0.35 * Math.sin(i * 2.3 + 1));
    const bx = cx + Math.cos(a) * rx * 0.94, by = cy + Math.sin(a) * ry * 0.94;
    const tx = cx + Math.cos(a + 0.12) * (rx + l), ty = cy + Math.sin(a + 0.12) * (ry + l);
    const hw = Math.max(2.2, len * 0.32);
    const px = -Math.sin(a) * hw, py = Math.cos(a) * hw;
    form(ctx, fill, (c) => {
      c.moveTo(bx + px, by + py);
      c.quadraticCurveTo((bx + tx) / 2 + px * 0.2, (by + ty) / 2 + py * 0.2, tx, ty);
      c.quadraticCurveTo((bx + tx) / 2 - px * 0.5, (by + ty) / 2 - py * 0.5, bx - px, by - py);
      c.closePath();
    }, { lw: 1.4, sd: 1.5 });
  }
}

// wing shapes (style: moth | bat | fly | bird), drawn for both sides; far wing darker
function wings(ctx, x, y, w, h, flap, fill, alpha = 0.8, style = 'moth', detail) {
  const a0 = ctx.globalAlpha;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.globalAlpha = a0 * alpha;
    ctx.translate(x, y);
    ctx.rotate(s * 0.3 - flap * 0.9 * (s > 0 ? 1 : 0.7));
    if (s < 0) { ctx.translate(w * 0.06, -h * 0.04); ctx.scale(0.86, 0.9); }
    const f = s < 0 ? shade(fill, 0.28) : fill;
    if (style === 'fly') {
      const tr = (c) => { c.moveTo(0, 0); c.bezierCurveTo(-w * 0.2, -h * 0.55, -w * 0.75, -h * 0.85, -w * 0.72, -h * 0.5); c.bezierCurveTo(-w * 0.7, -h * 0.25, -w * 0.3, -h * 0.05, 0, 0); };
      form(ctx, f, tr, { lw: 1.2, sd: 0, rim: false });
      const vc = 'rgba(22,20,28,0.55)';
      stroke(ctx, [0, 0, -w * 0.35, -h * 0.45, -w * 0.68, -h * 0.55], 1, vc);
      stroke(ctx, [-w * 0.2, -h * 0.25, -w * 0.4, -h * 0.25, -w * 0.6, -h * 0.35], 0.8, vc);
      stroke(ctx, [-w * 0.3, -h * 0.4, -w * 0.4, -h * 0.6, -w * 0.45, -h * 0.72], 0.8, vc);
    } else if (style === 'bat') {
      // membrane between finger bones, scalloped trailing edge
      const F = [[-w * 0.3, -h], [-w * 0.62, -h * 0.62], [-w, -h * 0.68], [-w * 0.8, 0]];
      const tr = (c) => {
        c.moveTo(0, 0); c.quadraticCurveTo(-w * 0.1, -h * 0.7, F[0][0], F[0][1]);
        c.quadraticCurveTo(-w * 0.5, -h * 0.98, F[2][0], F[2][1]);
        c.quadraticCurveTo(-w * 0.82, -h * 0.5, F[1][0] - w * 0.08, -h * 0.35);
        c.quadraticCurveTo(-w * 0.85, -h * 0.25, F[3][0], F[3][1]);
        c.quadraticCurveTo(-w * 0.6, -h * 0.18, -w * 0.42, -h * 0.12);
        c.quadraticCurveTo(-w * 0.25, -h * 0.1, 0, 0);
      };
      form(ctx, f, tr, { lw: 1.5, sd: h * 0.12 });
      for (const [fx, fy] of [F[0], F[2], [-w * 0.72, -h * 0.4]]) brush(ctx, [0, 0, fx * 0.5, fy * 0.6, fx, fy], 1.8, 0.5, INK, 0, 6);
    } else if (style === 'bird') {
      // covert + a fan of primary feathers
      const tips = [[-w * 0.98, -h * 0.82], [-w * 0.9, -h * 0.55], [-w * 0.76, -h * 0.32], [-w * 0.58, -h * 0.14], [-w * 0.38, -h * 0.02]];
      const tr = (c) => {
        c.moveTo(0, 0); c.bezierCurveTo(-w * 0.05, -h * 0.65, -w * 0.55, -h * 0.98, tips[0][0], tips[0][1]);
        for (let i = 1; i < tips.length; i++) {
          const a = tips[i - 1], b = tips[i];
          c.quadraticCurveTo(a[0] + w * 0.12, a[1] + h * 0.05, b[0], b[1]);
        }
        c.quadraticCurveTo(-w * 0.2, h * 0.02, 0, 0);
      };
      form(ctx, f, tr, { lw: 1.6, sd: h * 0.12 });
      const vc = shade(fill, 0.5);
      for (let i = 1; i < tips.length; i++) { const a = tips[i]; stroke(ctx, [a[0], a[1], a[0] * 0.75 + w * 0.02, a[1] * 0.8 - h * 0.08, a[0] * 0.55, a[1] * 0.7 - h * 0.18], 1, vc); }
      ctx.fillStyle = lighten(fill, 0.25);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-w * 0.05, -h * 0.6, -w * 0.4, -h * 0.75, -w * 0.5, -h * 0.6); ctx.quadraticCurveTo(-w * 0.3, -h * 0.3, 0, 0); ctx.fill();
      ink(ctx, 0.8); ctx.beginPath(); ctx.moveTo(-w * 0.5, -h * 0.6); ctx.quadraticCurveTo(-w * 0.3, -h * 0.3, 0, 0); ctx.stroke();
    } else {
      // moth: a rounded hindwing lobe under a long, swept forewing; painted bands, veins, eye-spot
      const hind = (c) => {
        c.moveTo(-w * 0.05, -h * 0.02);
        c.bezierCurveTo(-w * 0.2, -h * 0.5, -w * 0.62, -h * 0.5, -w * 0.66, -h * 0.25);
        c.bezierCurveTo(-w * 0.7, -h * 0.02, -w * 0.5, h * 0.12, -w * 0.3, h * 0.08);
        c.quadraticCurveTo(-w * 0.12, h * 0.06, -w * 0.05, -h * 0.02);
      };
      form(ctx, shade(f, 0.15), hind, { lw: 1.5, sd: h * 0.1 });
      const fore = (c) => {
        c.moveTo(0, -h * 0.05);
        c.bezierCurveTo(-w * 0.12, -h * 0.7, -w * 0.62, -h * 1.08, -w * 0.98, -h * 0.98);
        c.quadraticCurveTo(-w * 0.96, -h * 0.72, -w * 0.82, -h * 0.55);
        c.bezierCurveTo(-w * 0.62, -h * 0.4, -w * 0.32, -h * 0.28, -w * 0.12, -h * 0.12);
        c.quadraticCurveTo(-w * 0.04, -h * 0.06, 0, -h * 0.05);
      };
      form(ctx, f, fore, { lw: 1.7, sd: h * 0.12 });
      const vc = shade(f, 0.5);
      ctx.save(); ctx.beginPath(); fore(ctx); ctx.clip();
      brush(ctx, [-w * 0.55, -h * 1.1, -w * 0.72, -h * 0.75, -w * 0.62, -h * 0.4], w * 0.09, w * 0.06, vc, 0, 8);
      ctx.restore();
      stroke(ctx, [-w * 0.02, -h * 0.08, -w * 0.4, -h * 0.6, -w * 0.9, -h * 0.92], 1, vc);
      stroke(ctx, [-w * 0.08, -h * 0.1, -w * 0.4, -h * 0.35, -w * 0.78, -h * 0.58], 0.9, vc);
      stroke(ctx, [-w * 0.1, -h * 0.02, -w * 0.35, -h * 0.15, -w * 0.58, -h * 0.2], 0.9, shade(f, 0.6));
      if (detail) { // eye-spot on the forewing
        ctx.fillStyle = detail; ctx.beginPath(); ctx.ellipse(-w * 0.45, -h * 0.6, w * 0.085, h * 0.085, 0, 0, TAU); ctx.fill();
        ink(ctx, 0.8); ctx.stroke();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-w * 0.44, -h * 0.61, Math.max(0.8, w * 0.035), 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  ctx.globalAlpha = a0;
}

// ------------------------------------------------------------------ painters
export const PAINTERS = {
  // fuzzy lint ball with stubby legs
  mite(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 12;
    const k = Math.abs(Math.sin(ph)), bob = k * h * 0.08;
    legs(ctx, 4, w * 0.7, -h * 0.3, h * 0.3, ph, Math.max(1.3, w * 0.055));
    const cy = -h * 0.55 - bob, rx = w * 0.46 * (1.06 - k * 0.08), ry = h * 0.42 * (0.92 + k * 0.1);
    form(ctx, A.c1, (c) => fur(c, 0, cy, rx, ry, 13, 0.2, seedOf(e, A) * 6), { sd: h * 0.16, hatch: [-rx, cy - ry, rx * 2, ry * 2] });
    const fc = shade(A.c1, 0.55);
    for (let i = 0; i < 4; i++) {
      const a = 0.4 + i * 0.5, r0 = 0.45;
      stroke(ctx, [Math.cos(a) * rx * r0, cy + Math.sin(a) * ry * r0, Math.cos(a + 0.3) * rx * 0.7, cy + Math.sin(a + 0.3) * ry * 0.7, Math.cos(a + 0.2) * rx * 0.85, cy + Math.sin(a + 0.2) * ry * 0.85], 1.1, fc);
    }
    stroke(ctx, [-rx * 0.6, cy - ry * 0.2, -rx * 0.5, cy - ry * 0.6, -rx * 0.15, cy - ry * 0.75], 1.1, lighten(A.c1, 0.45));
    if (A.c2) { // a knot of coloured thread caught in the fluff
      brush(ctx, [-rx * 0.7, cy - ry * 0.5, -rx * 0.4, cy - ry * 0.9, -rx * 0.2, cy - ry * 0.2, rx * 0.05, cy - ry * 0.55], 1.8, 1.2, A.c2, 0, 10);
      brush(ctx, [rx * 0.05, cy - ry * 0.55, rx * 0.2, cy - ry * 0.95, rx * 0.35, cy - ry * 1.15], 1.2, 0.4, A.c2, 0, 6);
    }
    eye(ctx, w * 0.2, cy - ry * 0.1, Math.max(2, w * 0.09), A.eye || '#fff', !!A.glow);
  },

  grub(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 8;
    const segs = Math.max(2, A.segs || 4);
    const body = [];
    for (let i = 0; i < segs; i++) {
      const k = i / (segs - 1);
      const x = -w * 0.36 + k * w * 0.58;
      const wave = Math.sin(ph - i * 0.9);
      const r = h * (0.34 + k * 0.08);
      body.push({ x: x - wave * w * 0.015, y: -r * (1 + Math.max(0, wave) * 0.18), rx: r * (1.1 - Math.max(0, wave) * 0.08), ry: r * (1 + Math.max(0, wave) * 0.1), i });
    }
    // stubby prolegs
    for (const b of body) brush(ctx, [b.x - b.rx * 0.2, -h * 0.12, b.x - b.rx * 0.1 + Math.sin(ph - b.i) * 1.5, -h * 0.05, b.x - b.rx * 0.3 + Math.sin(ph - b.i) * 2, 0], Math.max(1.6, h * 0.1), 0.8);
    for (const b of body) {
      const col = b.i === segs - 1 ? (A.c2 || A.c1) : A.c1;
      form(ctx, col, (c) => oval(c, b.x, b.y, b.rx, b.ry, 0.1, 0.05, 3, b.i), { sd: b.ry * 0.38, lw: 2 });
      // fold line + a few bristles
      stroke(ctx, [b.x + b.rx * 0.55, b.y - b.ry * 0.75, b.x + b.rx * 0.8, b.y, b.x + b.rx * 0.5, b.y + b.ry * 0.8], 1.3, shade(col, 0.55));
      if (!A.spikes) stroke(ctx, [b.x - b.rx * 0.1, b.y - b.ry * 0.95, b.x - b.rx * 0.15, b.y - b.ry * 1.2, b.x - b.rx * 0.35, b.y - b.ry * 1.3], 1, INK);
    }
    const hx = w * 0.32, hr = h * 0.42;
    if (A.spikes) {
      for (const b of body.slice(0, -1)) {
        const bx = b.x, by = b.y - b.ry * 0.85, l = h * 0.32;
        form(ctx, A.c2 || A.c1, (c) => { c.moveTo(bx - 3, by + 2); c.quadraticCurveTo(bx - 1, by - l * 0.6, bx - l * 0.35, by - l); c.quadraticCurveTo(bx + 2, by - l * 0.4, bx + 4, by + 2); c.closePath(); }, { lw: 1.4, sd: 1.5 });
      }
    }
    if (A.mask) mask(ctx, hx + 2, -hr, hr * 0.85, A);
    else {
      const b = body[segs - 1];
      eye(ctx, b.x + b.rx * 0.45, b.y - b.ry * 0.25, Math.max(2, hr * 0.2), A.eye || '#fff', !!A.glow);
      stroke(ctx, [b.x + b.rx * 0.55, b.y + b.ry * 0.3, b.x + b.rx * 0.8, b.y + b.ry * 0.35, b.x + b.rx * 0.9, b.y + b.ry * 0.15], 1.2);
    }
  },

  beetle(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 10;
    const bob = Math.abs(Math.sin(ph)) * h * 0.03;
    legs(ctx, 3, w * 0.62, -h * 0.3, h * 0.3, ph, Math.max(1.6, h * 0.08), 1.2);
    ctx.save(); ctx.translate(0, -bob);
    // head (behind the shell's front lip)
    const hx = w * 0.4, hy = -h * 0.42;
    form(ctx, A.c3 || A.c1, (c) => oval(c, hx, hy, w * 0.17, h * 0.22, 0.2, 0.06), { sd: h * 0.08 });
    brush(ctx, [hx + w * 0.12, hy + h * 0.1, hx + w * 0.22, hy + h * 0.08, hx + w * 0.24, hy + h * 0.2], Math.max(1.5, h * 0.08), 0.5);
    // antenna with secondary lag
    const sway = Math.sin(ph * 0.5) * h * 0.05;
    stroke(ctx, [hx + w * 0.08, hy - h * 0.15, hx + w * 0.2, hy - h * 0.38, hx + w * 0.34 + sway, hy - h * 0.32], 1.4);
    if (A.horn) {
      const hh = 0.7 + A.horn * 0.15, ht = 0.95 + A.horn * 0.2;
      form(ctx, A.c3 || '#efe8d8', (c) => {
        c.moveTo(w * 0.44, -h * 0.58); c.quadraticCurveTo(w * 0.66, -h * hh, w * 0.58, -h * ht);
        c.quadraticCurveTo(w * 0.53, -h * 0.72, w * 0.34, -h * 0.6); c.closePath();
      }, { lw: 1.6, sd: 2 });
      stroke(ctx, [w * 0.5, -h * 0.66, w * 0.57, -h * (hh + 0.05), w * 0.57, -h * (ht - 0.1)], 1, lighten(A.c3 || '#efe8d8', 0.5));
    }
    // shell
    const shell = (c) => {
      c.moveTo(-w * 0.52, -h * 0.28);
      c.bezierCurveTo(-w * 0.56, -h * 0.82, -w * 0.25, -h * 1.04, w * 0.06, -h * 0.98);
      c.bezierCurveTo(w * 0.34, -h * 0.94, w * 0.46, -h * 0.66, w * 0.38, -h * 0.3);
      c.quadraticCurveTo(-w * 0.05, -h * 0.2, -w * 0.52, -h * 0.28);
    };
    form(ctx, A.c1, shell, { sd: h * 0.2, lw: 2.2, hatch: [-w * 0.55, -h, w, h * 0.8] });
    // growth rings and elytra seam
    const ring = shade(A.c1, 0.55);
    for (const k of [0.78, 0.58]) stroke(ctx, [-w * 0.46 * k - w * 0.04, -h * 0.32, -w * 0.3 * k, -h * (0.3 + 0.62 * k), w * 0.3 * k, -h * (0.32 + 0.5 * k)], 1.2, ring);
    brush(ctx, [w * 0.05, -h * 0.97, -w * 0.02, -h * 0.6, -w * 0.16, -h * 0.27], 2, 0.6);
    // lacquer highlight
    stroke(ctx, [-w * 0.32, -h * 0.66, -w * 0.22, -h * 0.86, w * 0.0, -h * 0.9], 2.2, lighten(A.c2 || A.c1, A.c2 ? 0.1 : 0.5));
    eye(ctx, w * 0.47, -h * 0.46, Math.max(1.8, h * 0.07), A.eye || '#fff', !!A.glow);
    if (A.spikes) spikesArc(ctx, -w * 0.05, -h * 0.35, w * 0.44, h * 0.63, Math.PI * 1.05, Math.PI * 1.85, 5, h * 0.22, A.c2 || A.c1);
    ctx.restore();
  },

  slug(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 5;
    const st = Math.sin(ph) * 0.06, stretch = 1 + Math.sin(ph) * 0.04;
    ctx.save(); ctx.scale(stretch, 1 / stretch);
    const bodyP = (c) => {
      c.moveTo(-w * 0.52, 0);
      c.bezierCurveTo(-w * 0.5, -h * 0.25, -w * 0.3, -h * (0.55 + st), 0, -h * (0.58 + st));
      c.bezierCurveTo(w * 0.3, -h * 0.62, w * 0.46, -h * 0.88, w * 0.54, -h * 0.5);
      c.quadraticCurveTo(w * 0.58, -h * 0.15, w * 0.48, 0);
      c.closePath();
    };
    // eyestalks (behind the head) with lagging tips
    for (const s of [0, 1]) {
      const bx = w * (0.38 + s * 0.08), tx = bx + 4 + s * 3 + Math.sin(ph * 1.3 + s) * 2, ty = -h * (1.05 + Math.sin(ph + s) * 0.06);
      brush(ctx, [bx, -h * 0.6, bx + 1, (ty - h * 0.6) / 2, tx, ty], Math.max(2.4, h * 0.12), 1.4, s ? INK : shade(A.c1, 0.5));
      eye(ctx, tx, ty, Math.max(2.2, h * 0.09), A.eye || '#fff', !!A.glow);
    }
    form(ctx, A.c1, bodyP, { sd: h * 0.2, lw: 2.2 });
    // foot frill + mantle
    const dk = shade(A.c1, 0.5);
    ctx.strokeStyle = dk; ctx.lineWidth = 1.1; ctx.beginPath();
    for (let x = -w * 0.44; x < w * 0.44; x += 3) ctx.lineTo(x, -h * 0.07 - Math.abs(Math.sin(x * 0.6 + ph * 3)) * h * 0.06);
    ctx.stroke();
    stroke(ctx, [-w * 0.2, -h * 0.5, w * 0.1, -h * 0.35, w * 0.4, -h * 0.55], 1.3, dk);
    stroke(ctx, [w * 0.44, -h * 0.25, w * 0.5, -h * 0.2, w * 0.47, -h * 0.12], 1.2, INK);
    // slime gleam
    ctx.fillStyle = lighten(A.c1, 0.6);
    ctx.beginPath(); ctx.ellipse(-w * 0.15, -h * 0.45, w * 0.06, h * 0.03, -0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.03, -h * 0.5, Math.max(0.8, h * 0.025), 0, TAU); ctx.fill();
    if (A.shell) {
      const sx = -w * 0.08, sy = -h * 0.66, R = h * 0.5;
      const shc = A.c2 || '#b39a7a';
      form(ctx, shc, (c) => oval(c, sx, sy, R, R * 0.96, 0.3, 0.04), { sd: R * 0.3, lw: 2.2, hatch: [sx - R, sy - R, R * 2, R * 2] });
      // spiral of growth
      ctx.strokeStyle = INK; ctx.lineCap = 'round';
      let px = sx, py = sy;
      for (let a = 0.6; a < 11.5; a += 0.35) {
        const rr = a * R * 0.078;
        const nx = sx + Math.cos(a) * rr, ny = sy + Math.sin(a) * rr;
        ctx.lineWidth = 0.6 + a * 0.13; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
        px = nx; py = ny;
      }
      for (let i = 0; i < 5; i++) { const a = 3.5 + i * 0.55; stroke(ctx, [sx + Math.cos(a) * R * 0.45, sy + Math.sin(a) * R * 0.45, sx + Math.cos(a + 0.1) * R * 0.7, sy + Math.sin(a + 0.1) * R * 0.7, sx + Math.cos(a) * R * 0.9, sy + Math.sin(a) * R * 0.9], 1, shade(shc, 0.5)); }
    }
    ctx.restore();
  },

  moth(ctx, e, t, A) {
    const w = e.w, h = e.h, an = e.anim || 0;
    const flap = Math.sin(an * 14) * 0.5 + 0.5;
    const bob = Math.sin(an * 14 + 1.2) * h * 0.04;
    ctx.save(); ctx.translate(0, bob);
    wings(ctx, -w * 0.05, -h * 0.05, w * 0.9, h * 1.0, flap, A.c2 || A.c1, 0.95, A.wing || 'moth', (A.wing || 'moth') === 'moth' ? (A.c3 || A.c1) : null);
    // fuzzy abdomen + thorax
    form(ctx, A.c1, (c) => { oval(c, -w * 0.06, h * 0.08, w * 0.15, h * 0.3, 0.5, 0.05); }, { sd: w * 0.06 });
    for (let i = 0; i < 3; i++) stroke(ctx, [-w * 0.18 + i * w * 0.05, h * (0.0 + i * 0.08), -w * 0.08 + i * w * 0.05, h * (0.08 + i * 0.09), w * 0.02 + i * w * 0.04, h * (0.0 + i * 0.1)], 1, shade(A.c1, 0.55));
    form(ctx, A.c1, (c) => fur(c, w * 0.04, -h * 0.12, w * 0.16, h * 0.18, 9, 0.18), { sd: w * 0.05 });
    // head + feathered antennae (trailing the flap)
    const lag = Math.sin(an * 14 - 0.8) * h * 0.04;
    for (const [bx, by, cx, cy, tx, ty] of [[w * 0.22, -h * 0.36, w * 0.3, -h * 0.65, w * 0.44, -h * 0.6 + lag], [w * 0.15, -h * 0.38, w * 0.15, -h * 0.7, w * 0.27, -h * 0.74 + lag]]) {
      brush(ctx, [bx, by, cx, cy, tx, ty], 1.6, 0.6);
      for (let k = 0.35; k < 1; k += 0.2) { const p = bz([bx, by, cx, cy, tx, ty], k); stroke(ctx, [p[0], p[1], p[0] + 1.5, p[1] - 1, p[0] + 3, p[1] - 0.5], 0.8); }
    }
    form(ctx, A.c3 || A.c1, (c) => oval(c, w * 0.19, -h * 0.25, w * 0.14, w * 0.14, 0, 0.05), { sd: w * 0.05, lw: 1.8 });
    eye(ctx, w * 0.25, -h * 0.25, Math.max(2, w * 0.065), A.eye || '#fff', !!A.glow);
    ctx.restore();
  },

  fly(ctx, e, t, A) {
    const w = e.w, h = e.h, an = e.anim || 0;
    const flap = Math.sin(an * 40) * 0.5 + 0.5;
    // dangling legs
    for (let i = 0; i < 3; i++) {
      const x = -w * 0.15 + i * w * 0.15, sw = Math.sin(an * 6 + i) * 1.5;
      leg(ctx, x, h * 0.2, x - w * 0.05 + sw, h * 0.42, x - w * 0.1 + sw * 1.5, h * 0.55, Math.max(1.1, h * 0.05));
    }
    wings(ctx, -w * 0.05, -h * 0.2, w * 0.7, h * 0.8, flap, 'rgba(225,235,250,0.55)', 0.85, 'fly');
    if (A.stinger) form(ctx, A.c2 || '#ddd', (c) => { c.moveTo(-w * 0.34, -h * 0.08); c.quadraticCurveTo(-w * 0.5, 0, -w * 0.66, h * 0.08); c.quadraticCurveTo(-w * 0.48, h * 0.18, -w * 0.32, h * 0.14); c.closePath(); }, { lw: 1.4, sd: 1.5 });
    const bodyP = (c) => oval(c, 0, 0, w * 0.4, h * 0.34, -0.08, 0.05);
    form(ctx, A.c1, bodyP, { sd: h * 0.14, hatch: [-w * 0.4, -h * 0.34, w * 0.8, h * 0.68] });
    if (A.c2) { // banded abdomen
      ctx.save(); ctx.beginPath(); bodyP(ctx); ctx.clip();
      for (const k of [-0.22, -0.02]) brush(ctx, [w * k, -h * 0.4, w * (k - 0.06), 0, w * k, h * 0.4], 2.8, 2.8, A.c2, 0, 6);
      ctx.restore();
    }
    stroke(ctx, [-w * 0.25, -h * 0.2, -w * 0.05, -h * 0.3, w * 0.15, -h * 0.24], 1.2, lighten(A.c1, 0.45));
    // big compound eye
    const er = Math.max(2.2, h * 0.17);
    eye(ctx, w * 0.25, -h * 0.06, er, A.eye || '#ff9b7a', !!A.glow);
    ctx.fillStyle = 'rgba(22,20,28,0.35)';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(w * 0.25 + (i - 1) * er * 0.4, -h * 0.06 + er * 0.45, er * 0.12, 0, TAU); ctx.fill(); }
  },

  spider(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 12;
    const lw = Math.max(1.6, h * 0.07);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const bx = s * w * 0.06, by = -h * 0.45;
        const sw = Math.sin(ph + i * 1.5 + (s > 0 ? 1 : 0)) * h * 0.08;
        const lift = Math.max(0, sw) * 0.8;
        const kx = s * w * (0.28 + i * 0.05), ky = -h * (0.82 - i * 0.06) - lift;
        const fx = s * w * (0.32 + i * 0.07) + sw, fy = -lift * 0.6;
        leg(ctx, bx, by, kx, ky, fx, fy, s < 0 ? lw * 0.85 : lw, s < 0 ? shade(INK, 0) : INK);
      }
    }
    const ab = (c) => oval(c, -w * 0.13, -h * 0.56, w * 0.27, h * 0.31, -0.15, 0.05, 2);
    form(ctx, A.c1, ab, { sd: h * 0.14, hatch: [-w * 0.42, -h * 0.9, w * 0.6, h * 0.65] });
    // abdomen hairs + marking
    for (let i = 0; i < 6; i++) { const a = Math.PI * (1.0 + i * 0.13); stroke(ctx, [-w * 0.13 + Math.cos(a) * w * 0.26, -h * 0.56 + Math.sin(a) * h * 0.3, -w * 0.13 + Math.cos(a - 0.1) * w * 0.31, -h * 0.56 + Math.sin(a - 0.1) * h * 0.36, -w * 0.13 + Math.cos(a - 0.2) * w * 0.33, -h * 0.56 + Math.sin(a - 0.2) * h * 0.38], 1); }
    if (A.c2) {
      const mx = -w * 0.15, my = -h * 0.62, r = w * 0.07;
      ctx.fillStyle = A.c2; ctx.beginPath();
      ctx.moveTo(mx - r, my - r * 1.3); ctx.quadraticCurveTo(mx, my - r * 0.2, mx + r, my - r * 1.3);
      ctx.quadraticCurveTo(mx + r * 0.3, my, mx + r, my + r * 1.3); ctx.quadraticCurveTo(mx, my + r * 0.3, mx - r, my + r * 1.3);
      ctx.quadraticCurveTo(mx - r * 0.3, my, mx - r, my - r * 1.3); ctx.fill();
    }
    // cephalothorax + fangs
    form(ctx, A.c3 || A.c1, (c) => oval(c, w * 0.15, -h * 0.45, w * 0.16, h * 0.2, 0.1, 0.05), { sd: h * 0.07 });
    brush(ctx, [w * 0.24, -h * 0.34, w * 0.3, -h * 0.28, w * 0.26, -h * 0.2], Math.max(1.8, h * 0.07), 0.4);
    brush(ctx, [w * 0.18, -h * 0.32, w * 0.22, -h * 0.25, w * 0.18, -h * 0.19], Math.max(1.6, h * 0.06), 0.4);
    const n = A.eyes || 2;
    for (let i = 0; i < n; i++) eye(ctx, w * 0.2 + (i % 2) * 4 - Math.floor(i / 2) * 1, -h * 0.5 + Math.floor(i / 2) * 3 - 1, i < 2 ? 1.8 : 1.3, A.eye || '#ff6a5a', !!A.glow);
  },

  jelly(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 3;
    const pulse = 1 + Math.sin(ph * 2) * 0.08;
    const a0 = ctx.globalAlpha;
    const tc = A.c2 || A.c1;
    // trailing tentacles: tapered, lagging the pulse
    for (let i = 0; i < 5; i++) {
      const x = -w * 0.3 + i * w * 0.15;
      ctx.globalAlpha = a0 * 0.85;
      brush(ctx, [x, h * 0.02, x + Math.sin(ph + i) * 6, h * 0.3, x - Math.sin(ph + i) * 6, h * 0.5, x + Math.sin(ph * 1.3 + i) * 4, h * (0.62 + (i % 2) * 0.12)], 2.6, 0.4, INK, 0, 12);
      brush(ctx, [x, h * 0.02, x + Math.sin(ph + i) * 6, h * 0.3, x - Math.sin(ph + i) * 6, h * 0.5, x + Math.sin(ph * 1.3 + i) * 4, h * (0.62 + (i % 2) * 0.12)], 1.4, 0.2, tc, 0, 12);
    }
    // frilly oral arms
    ctx.globalAlpha = a0 * 0.8;
    for (const s of [-1, 1]) brush(ctx, [s * w * 0.06, h * 0.0, s * w * 0.12 + Math.sin(ph * 1.5) * 3, h * 0.2, s * w * 0.02, h * 0.38], 4, 1, lighten(tc, 0.2), 2, 8);
    ctx.globalAlpha = a0 * 0.92;
    const rx = w * 0.48 * pulse, ry = h * 0.42 / pulse, cy = -h * 0.05;
    const bell = (c) => {
      c.moveTo(-rx, cy);
      c.bezierCurveTo(-rx * 1.02, cy - ry * 1.25, rx * 1.02, cy - ry * 1.3, rx, cy);
      // scalloped rim
      for (let i = 0; i < 6; i++) { const x0 = rx - (i / 6) * rx * 2, x1 = rx - ((i + 1) / 6) * rx * 2; c.quadraticCurveTo((x0 + x1) / 2, cy + h * 0.14, x1, cy); }
    };
    form(ctx, A.c1, bell, { sd: h * 0.12, lw: 1.9 });
    // inner organ: a painted lighter dome
    ctx.fillStyle = A.c3 || lighten(A.c1, 0.5); ctx.globalAlpha = a0 * 0.55;
    ctx.beginPath(); ctx.ellipse(-w * 0.02, cy - ry * 0.35, rx * 0.5, ry * 0.42, 0, Math.PI, 0); ctx.quadraticCurveTo(0, cy - ry * 0.05, -w * 0.02 - rx * 0.5, cy - ry * 0.35); ctx.fill();
    ctx.globalAlpha = a0;
    stroke(ctx, [-rx * 0.65, cy - ry * 0.45, -rx * 0.45, cy - ry * 0.85, -rx * 0.05, cy - ry * 0.95], 1.4, 'rgba(255,255,255,0.7)');
    eye(ctx, w * 0.12, -h * 0.18, 2.2, A.eye || INK, !!A.glow);
    eye(ctx, -w * 0.08, -h * 0.18, 2.2, A.eye || INK, !!A.glow);
  },

  // husk-like masked bug, optionally armed
  knight(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 9;
    const walk = Math.sin(ph) * w * 0.06;
    const bob = Math.abs(Math.cos(ph)) * h * 0.025;
    const tele = e.state === 'tele', atk = e.state === 'attack' ? 1 : tele ? -0.6 : 0;
    const lean = tele ? -0.06 : atk > 0 ? 0.08 : 0;
    const lw = Math.max(2, w * 0.07);
    brush(ctx, [-w * 0.13, -h * 0.25, -w * 0.15 + walk * 0.5, -h * 0.12, -w * 0.17 + walk, 0], lw * 1.3, lw * 0.5);
    brush(ctx, [w * 0.1, -h * 0.25, w * 0.12 - walk * 0.5, -h * 0.12, w * 0.15 - walk, 0], lw * 1.3, lw * 0.5);
    ctx.save(); ctx.translate(0, -bob); ctx.rotate(lean);
    // cloak/body with a tattered, lagging hem
    const hem = Math.sin(ph - 1) * w * 0.03;
    const cloak = (c) => {
      c.moveTo(-w * 0.16, -h * 0.72);
      c.lineTo(w * 0.2, -h * 0.72);
      c.bezierCurveTo(w * 0.38, -h * 0.66, w * 0.42, -h * 0.4, w * 0.34 + hem, -h * 0.16);
      c.lineTo(w * 0.22 + hem, -h * 0.22); c.lineTo(w * 0.12 + hem, -h * 0.13); c.lineTo(0 + hem, -h * 0.2);
      c.lineTo(-w * 0.1 + hem, -h * 0.12); c.lineTo(-w * 0.22 + hem, -h * 0.2); c.lineTo(-w * 0.38 + hem * 1.4, -h * 0.15);
      c.bezierCurveTo(-w * 0.44, -h * 0.4, -w * 0.4, -h * 0.66, -w * 0.16, -h * 0.72);
    };
    form(ctx, A.c1, cloak, { sd: w * 0.12, lw: 2.2, hatch: [-w * 0.45, -h * 0.75, w * 0.9, h * 0.65] });
    const fold = shade(A.c1, 0.55);
    stroke(ctx, [-w * 0.05, -h * 0.62, -w * 0.12, -h * 0.42, -w * 0.18 + hem, -h * 0.2], 1.4, fold);
    stroke(ctx, [w * 0.14, -h * 0.6, w * 0.2, -h * 0.42, w * 0.18 + hem, -h * 0.22], 1.2, fold);
    stroke(ctx, [-w * 0.3, -h * 0.6, -w * 0.15, -h * 0.68, w * 0.1, -h * 0.66], 1.2, lighten(A.c1, 0.35));
    // weapon
    if (A.weapon) {
      ctx.save(); ctx.translate(w * 0.25, -h * 0.45); ctx.rotate(-0.6 + atk * 1.2);
      if (A.weapon === 'spear') {
        brush(ctx, [-6, 0, w * 0.45, -0.5, w * 0.9, 0], 3, 2.2, INK, 0, 4);
        brush(ctx, [-5, 0, w * 0.45, -0.5, w * 0.89, 0], 1.2, 0.8, shade(A.c2 || '#ddd', 0.35), 0, 4);
        form(ctx, A.c2 || '#ddd', (c) => { c.moveTo(w * 0.88, -4); c.quadraticCurveTo(w * 1.0, -3.5, w * 1.12, 0); c.quadraticCurveTo(w * 1.0, 3.5, w * 0.88, 4); c.closePath(); }, { lw: 1.5, sd: 1.5 });
      } else if (A.weapon === 'shield') {
        ctx.rotate(0.6 - atk * 1.2);
        const sc = A.c2 || '#998';
        form(ctx, sc, (c) => oval(c, 4, 2, w * 0.13, h * 0.33, 0, 0.03), { sd: w * 0.05, lw: 2.2 });
        ctx.strokeStyle = shade(sc, 0.5); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(4, 2, w * 0.08, h * 0.26, 0, 0, TAU); ctx.stroke();
        form(ctx, lighten(sc, 0.2), (c) => oval(c, 5, 2, w * 0.035, w * 0.035, 0, 0), { lw: 1.2, sd: 1 });
      } else {
        // a chipped nail-blade
        form(ctx, A.c2 || '#e0dccf', (c) => { c.moveTo(-2, -3); c.lineTo(w * 0.5, -2.5); c.quadraticCurveTo(w * 0.62, -1.5, w * 0.66, 0.5); c.lineTo(w * 0.42, 3); c.lineTo(w * 0.36, 2.2); c.lineTo(-2, 3); c.closePath(); }, { lw: 1.6, sd: 1.6 });
        brush(ctx, [-4, -4.5, -3, 0, -4, 4.5], 2.6, 2.6, INK, 0, 3);
      }
      ctx.restore();
    }
    // horns + mask
    const hy = -h * 0.8;
    if (A.horns !== 0) {
      const hc = A.c3 || '#efe8d8';
      for (const s of [-1, 1]) {
        const bx = s < 0 ? -w * 0.07 : w * 0.1;
        form(ctx, hc, (c) => {
          c.moveTo(bx - w * 0.06, hy - h * 0.08);
          c.bezierCurveTo(bx + s * w * 0.0 - w * 0.12, hy - h * 0.28, bx + s * w * 0.12 - w * 0.02, hy - h * 0.34, bx + s * w * 0.04, hy - h * 0.44);
          c.bezierCurveTo(bx + s * w * 0.02, hy - h * 0.3, bx + w * 0.04, hy - h * 0.22, bx + w * 0.06, hy - h * 0.1);
          c.closePath();
        }, { lw: 1.6, sd: 1.6 });
      }
    }
    mask(ctx, w * 0.02, hy, Math.min(w, h) * 0.2, A);
    ctx.restore();
  },

  snail(ctx, e, t, A) { PAINTERS.slug(ctx, e, t, Object.assign({}, A, { shell: true })); },

  hopper(ctx, e, t, A) {
    const w = e.w, h = e.h, an = e.anim || 0;
    const air = e.grounded === false;
    const crouch = e.state === 'tele' ? 0.72 : air ? 1.12 : 1 + Math.sin(an * 4) * 0.02;
    const sx = 1 / Math.sqrt(crouch);
    const lw = Math.max(2, h * 0.08);
    // hind leg: big thigh + shin; folded on the ground, trailing in the air
    const kx = -w * 0.5, ky = air ? -h * 0.15 : -h * 0.42 * crouch;
    const fx = air ? -w * 0.58 : -w * 0.36, fy = air ? h * 0.05 : 0;
    brush(ctx, [kx, ky, (kx + fx) / 2 - w * 0.04, (ky + fy) / 2, fx, fy], lw * 1.2, lw * 0.5);
    brush(ctx, [fx, fy, fx + w * 0.06, fy + 0.5, fx + w * 0.12, fy], lw * 0.8, lw * 0.3);
    // front leg
    brush(ctx, [w * 0.2, -h * 0.28 * crouch, w * 0.3, -h * 0.15, w * 0.28 + (air ? w * 0.08 : 0), air ? -h * 0.02 : 0], lw * 1.1, lw * 0.35);
    const bodyP = (c) => oval(c, 0, -h * 0.45 * crouch, w * 0.42 * sx, h * 0.38 * crouch, -0.15, 0.04);
    form(ctx, A.c1, bodyP, { sd: h * 0.14, lw: 2.2 });
    // belly
    ctx.save(); ctx.beginPath(); bodyP(ctx); ctx.clip();
    ctx.fillStyle = A.c2 || lighten(A.c1, 0.4);
    ctx.beginPath(); ctx.ellipse(w * 0.02, -h * 0.2 * crouch, w * 0.34 * sx, h * 0.18, -0.1, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.beginPath(); bodyP(ctx); ink(ctx, 1.1); ctx.stroke();
    // thigh drawn over the body
    form(ctx, A.c1, (c) => oval(c, -w * 0.24, -h * 0.38 * crouch, w * 0.24 * sx, h * 0.17 * crouch, air ? 0.25 : -0.35, 0.05), { sd: h * 0.07, lw: 2 });
    stroke(ctx, [-w * 0.38, -h * 0.4 * crouch, -w * 0.25, -h * 0.47 * crouch, -w * 0.1, -h * 0.4 * crouch], 1.1, shade(A.c1, 0.5));
    // mouth
    stroke(ctx, [w * 0.18, -h * 0.5 * crouch, w * 0.3, -h * 0.45 * crouch, w * 0.38, -h * 0.52 * crouch], 1.4);
    for (const s of [0, 1]) {
      const ex = w * (0.18 + s * 0.16), ey = -h * 0.78 * crouch;
      form(ctx, A.c3 || '#efe8d8', (c) => oval(c, ex, ey, w * 0.1, w * 0.1, 0, 0.04), { lw: 1.6, sd: w * 0.03 });
      eye(ctx, ex + w * 0.02, ey, w * 0.055, INK);
    }
  },

  worm(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 6;
    const up = e.emerge ?? 1;
    ctx.save();
    ctx.beginPath(); ctx.rect(-w, -h * 2, w * 2, h * 2); ctx.clip();
    const segs = 6;
    for (let i = segs - 1; i >= 0; i--) {
      const k = i / (segs - 1);
      const y = -h * k * up;
      const x = Math.sin(ph + k * 3) * w * 0.12;
      const r = w * (0.42 - k * 0.12);
      const col = i % 2 ? A.c1 : (A.c2 || A.c1);
      form(ctx, col, (c) => oval(c, x, y - r * 0.5, r, r * 0.92, 0.2, 0.04, 3, i), { sd: r * 0.32, lw: 2 });
      stroke(ctx, [x - r * 0.75, y - r * 0.2, x, y + r * 0.15, x + r * 0.75, y - r * 0.2], 1.2, shade(col, 0.55));
      stroke(ctx, [x + r * 0.5, y - r * 0.9, x + r * 0.7, y - r * 0.6, x + r * 0.55, y - r * 0.3], 1, lighten(col, 0.45));
    }
    const hx = Math.sin(ph + 3) * w * 0.12, hy = -h * up - w * 0.15;
    // hooked mandibles
    const open = Math.sin(ph * 1.5) * w * 0.04;
    for (const s of [-1, 1]) {
      form(ctx, A.c3 || '#efe8d8', (c) => {
        c.moveTo(hx + s * w * 0.3, hy);
        c.quadraticCurveTo(hx + s * (w * 0.3 + open), hy - w * 0.35, hx + s * (w * 0.08 - open), hy - w * 0.5);
        c.quadraticCurveTo(hx + s * w * 0.14, hy - w * 0.25, hx + s * w * 0.04, hy - w * 0.08);
        c.closePath();
      }, { lw: 1.5, sd: 1.5 });
    }
    eye(ctx, hx - w * 0.12, hy + 2, Math.max(2, w * 0.07), A.eye || '#ff8a5a', true);
    eye(ctx, hx + w * 0.12, hy + 2, Math.max(2, w * 0.07), A.eye || '#ff8a5a', true);
    ctx.restore();
    // dirt clods kicked up at the burrow mouth
    if (up > 0.05) {
      ctx.fillStyle = INK;
      for (let i = 0; i < 4; i++) { const x = (i - 1.5) * w * 0.28, r = w * (0.06 + (i % 2) * 0.03); ctx.beginPath(); ctx.ellipse(x, -r * 0.4, r * 1.3, r, i, 0, TAU); ctx.fill(); }
    }
  },

  shroom(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 8;
    const tele = e.state === 'tele';
    const sq = tele ? 0.8 : 1 + Math.sin(ph) * 0.04;
    const wide = 1 / Math.sqrt(sq);
    const lw = Math.max(1.8, w * 0.07);
    brush(ctx, [-w * 0.1, -h * 0.08, -w * 0.13, -h * 0.03, -w * 0.17 + Math.sin(ph) * 2, 0], lw, lw * 0.4);
    brush(ctx, [w * 0.1, -h * 0.08, w * 0.13, -h * 0.03, w * 0.17 - Math.sin(ph) * 2, 0], lw, lw * 0.4);
    const sc = A.c3 || '#e8dcc6';
    form(ctx, sc, (c) => {
      c.moveTo(-w * 0.17 * wide, -h * 0.52 * sq);
      c.bezierCurveTo(-w * 0.24 * wide, -h * 0.3 * sq, -w * 0.24 * wide, -h * 0.1, -w * 0.18, -h * 0.05);
      c.quadraticCurveTo(0, -h * 0.01, w * 0.19, -h * 0.05);
      c.bezierCurveTo(w * 0.23 * wide, -h * 0.15, w * 0.2 * wide, -h * 0.35 * sq, w * 0.16 * wide, -h * 0.52 * sq);
      c.closePath();
    }, { sd: w * 0.08, lw: 2 });
    for (const x of [-0.08, 0.06]) stroke(ctx, [w * x, -h * 0.48 * sq, w * (x - 0.02), -h * 0.3 * sq, w * x, -h * 0.12], 0.9, shade(sc, 0.4));
    eye(ctx, w * 0.08, -h * 0.33 * sq, 2.2, INK); eye(ctx, -w * 0.05, -h * 0.33 * sq, 2.2, INK);
    // cap: gill band underneath, then the dome
    const cy = -h * 0.55 * sq, rx = w * 0.5 * wide, ry = h * 0.42 * (tele ? 1.1 : 1);
    ctx.fillStyle = shade(sc, 0.3);
    ctx.beginPath(); ctx.ellipse(0, cy, rx * 0.9, h * 0.07, 0, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = shade(sc, 0.6); ctx.lineWidth = 0.8;
    for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * rx * 0.05, cy + 1); ctx.lineTo(i * rx * 0.2, cy + h * 0.06 * Math.cos(i * 0.3)); ctx.stroke(); }
    const cap = (c) => {
      c.moveTo(-rx, cy + h * 0.02);
      c.bezierCurveTo(-rx * 1.05, cy - ry * 0.9, -rx * 0.35, cy - ry * 1.25, rx * 0.1, cy - ry * 1.15);
      c.bezierCurveTo(rx * 0.7, cy - ry * 1.05, rx * 1.05, cy - ry * 0.55, rx, cy + h * 0.02);
      c.quadraticCurveTo(rx * 0.5, cy - h * 0.06, 0, cy - h * 0.02);
      c.quadraticCurveTo(-rx * 0.5, cy - h * 0.06, -rx, cy + h * 0.02);
    };
    form(ctx, A.c1, cap, { sd: h * 0.12, lw: 2.2, hatch: [-rx, cy - ry * 1.2, rx * 2, ry * 1.3] });
    const spot = A.c2 || 'rgba(255,255,255,0.6)';
    for (const [x, y, r] of [[-0.22, -0.78, 0.08], [0.12, -0.88, 0.055], [0.3, -0.66, 0.045], [-0.02, -0.7, 0.035]]) {
      ctx.fillStyle = spot; ctx.beginPath(); oval(ctx, w * x * wide, h * y * sq - (tele ? h * 0.04 : 0), w * r, w * r * 0.75, x, 0.12); ctx.fill();
    }
    stroke(ctx, [-rx * 0.75, cy - ry * 0.45, -rx * 0.6, cy - ry * 0.9, -rx * 0.2, cy - ry * 1.05], 1.4, lighten(A.c1, 0.45));
  },

  crystal(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 10;
    legs(ctx, 3, w * 0.7, -h * 0.25, h * 0.25, ph, Math.max(1.6, h * 0.07), 1.2);
    const cc = A.c2 || '#ffd0f2';
    const n = A.n || 3;
    for (let i = 0; i < n; i++) {
      const x = -w * 0.25 + (i / Math.max(1, n - 1)) * w * 0.5;
      const ht = h * (0.45 + ((i * 37) % 10) / 25);
      const tip = x + (i - (n - 1) / 2) * 4, bw = w * 0.085, by = -h * 0.56, ty = by - ht;
      form(ctx, cc, (c) => { c.moveTo(x - bw, by); c.lineTo(tip - bw * 0.45, ty + ht * 0.18); c.lineTo(tip, ty); c.lineTo(tip + bw * 0.4, ty + ht * 0.2); c.lineTo(x + bw, by); c.closePath(); }, { lw: 1.5, sd: bw * 0.7 });
      // facet: lit plane on the left
      ctx.fillStyle = lighten(cc, 0.5); ctx.globalAlpha *= 0.8;
      ctx.beginPath(); ctx.moveTo(x - bw * 0.7, by); ctx.lineTo(tip - bw * 0.35, ty + ht * 0.2); ctx.lineTo(tip, ty + 1); ctx.lineTo(x - bw * 0.1, by); ctx.fill();
      ctx.globalAlpha /= 0.8;
      stroke(ctx, [x - bw * 0.05, by, (x + tip) / 2, (by + ty) / 2, tip, ty + 1], 0.9, shade(cc, 0.5));
    }
    const shellP = (c) => { c.moveTo(-w * 0.47, -h * 0.24); c.quadraticCurveTo(-w * 0.44, -h * 0.5, -w * 0.3, -h * 0.62); c.quadraticCurveTo(0, -h * 0.68, w * 0.3, -h * 0.61); c.quadraticCurveTo(w * 0.46, -h * 0.5, w * 0.47, -h * 0.24); c.quadraticCurveTo(0, -h * 0.18, -w * 0.47, -h * 0.24); };
    form(ctx, A.c1, shellP, { sd: h * 0.1, lw: 2.2, hatch: [-w * 0.5, -h * 0.7, w, h * 0.5] });
    for (let i = 0; i < 4; i++) stroke(ctx, [-w * 0.35 + i * w * 0.18, -h * 0.58, -w * 0.32 + i * w * 0.18, -h * 0.42, -w * 0.34 + i * w * 0.18, -h * 0.28], 1, shade(A.c1, 0.5));
    eye(ctx, w * 0.32, -h * 0.4, 2.2, A.eye || '#fff', true);
  },

  gear(ctx, e, t, A) {
    const w = e.w, h = e.h, r = Math.min(w, h) * 0.45;
    const rot = (e.anim || 0) * (A.spin || 2);
    const oy = A.centered ? 0 : -r;
      const teeth = A.teeth || 8;
    const gearP = (c) => {
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * TAU, s = TAU / teeth;
        const p = (aa, rr) => [Math.cos(aa) * rr, Math.sin(aa) * rr];
        const pts = [p(a - s * 0.5, r * 0.8), p(a - s * 0.22, r * 0.82), p(a - s * 0.16, r * 1.0), p(a + s * 0.14, r * 1.0), p(a + s * 0.2, r * 0.82)];
        pts.forEach((q, k) => (i === 0 && k === 0 ? c.moveTo(q[0], q[1]) : c.lineTo(q[0], q[1])));
      }
      c.closePath();
    };
    // draw with an unrotated light, rotated geometry
    ctx.save(); ctx.translate(0, oy);
    const rotP = (c) => { const m = c.getTransform(); c.rotate(rot); gearP(c); c.setTransform(m); };
    form(ctx, A.c1, rotP, { sd: r * 0.18, lw: 2.2 });
    ctx.rotate(rot);
    // lightening holes + rivets
    ctx.fillStyle = INK;
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58, r * 0.13, r * 0.09, a, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = shade(A.c1, 0.5); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.74, 0.3, 2.6); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.translate(0, oy);
    form(ctx, A.c2 || '#3a2a1a', (c) => oval(c, 0, 0, r * 0.42, r * 0.42, 0, 0.02), { sd: r * 0.12, lw: 1.8 });
    ctx.restore();
    eye(ctx, 0, oy, r * 0.2, A.eye || '#ffb050', true);
  },

  fish(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 10;
    const tail = Math.sin(ph) * 0.4;
    const fc = A.c2 || A.c1;
    // tail with fin rays
    ctx.save(); ctx.translate(-w * 0.4, 0); ctx.rotate(tail);
    form(ctx, fc, (c) => { c.moveTo(w * 0.02, 0); c.quadraticCurveTo(-w * 0.12, -h * 0.2, -w * 0.27, -h * 0.4); c.quadraticCurveTo(-w * 0.18, 0, -w * 0.27, h * 0.4); c.quadraticCurveTo(-w * 0.12, h * 0.2, w * 0.02, 0); }, { lw: 1.6, sd: 2 });
    for (const k of [-0.25, 0, 0.25]) stroke(ctx, [0, 0, -w * 0.1, h * k * 0.5, -w * 0.2, h * k], 0.8, shade(fc, 0.5));
    ctx.restore();
    // dorsal + pectoral fins (secondary ripple)
    const rip = Math.sin(ph * 0.8) * h * 0.05;
    form(ctx, fc, (c) => { c.moveTo(-w * 0.2, -h * 0.3); c.quadraticCurveTo(-w * 0.1, -h * 0.6 + rip, w * 0.12, -h * 0.52 - rip); c.lineTo(w * 0.1, -h * 0.3); c.closePath(); }, { lw: 1.5, sd: 1.5 });
    const bodyP = (c) => {
      c.moveTo(-w * 0.44, 0);
      c.bezierCurveTo(-w * 0.35, -h * 0.42, w * 0.25, -h * 0.5, w * 0.46, -h * 0.05);
      c.bezierCurveTo(w * 0.4, h * 0.32, -w * 0.25, h * 0.42, -w * 0.44, 0);
    };
    form(ctx, A.c1, bodyP, { sd: h * 0.14, lw: 2.2, hatch: [-w * 0.45, -h * 0.4, w * 0.9, h * 0.8] });
    // scales + gill
    ctx.save(); ctx.beginPath(); bodyP(ctx); ctx.clip();
    ctx.strokeStyle = shade(A.c1, 0.45); ctx.lineWidth = 0.9;
    for (let row = -1; row <= 1; row++) for (let i = 0; i < 4; i++) {
      const x = -w * 0.28 + i * w * 0.11 + (row & 1) * w * 0.05, y = row * h * 0.16;
      ctx.beginPath(); ctx.arc(x, y, h * 0.09, -1.2, 1.2); ctx.stroke();
    }
    ctx.restore();
    brush(ctx, [w * 0.16, -h * 0.28, w * 0.1, -h * 0.05, w * 0.16, h * 0.2], 0.6, 0.6, INK, 1.4, 8);
    // pectoral fin
    form(ctx, fc, (c) => { c.moveTo(w * 0.05, h * 0.05); c.quadraticCurveTo(-w * 0.08, h * 0.2 + rip, -w * 0.12, h * 0.28); c.quadraticCurveTo(0, h * 0.25, w * 0.08, h * 0.12); c.closePath(); }, { lw: 1.3, sd: 1 });
    // mouth
    stroke(ctx, [w * 0.46, -h * 0.03, w * 0.35, h * 0.06, w * 0.24, h * 0.06], 1.3);
    if (A.teeth) {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(w * (0.22 + i * 0.055), h * 0.05); ctx.lineTo(w * (0.245 + i * 0.055), h * 0.16); ctx.lineTo(w * (0.265 + i * 0.055), h * 0.05); ctx.fill(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 0.7;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(w * (0.22 + i * 0.055), h * 0.05); ctx.lineTo(w * (0.245 + i * 0.055), h * 0.16); ctx.lineTo(w * (0.265 + i * 0.055), h * 0.05); ctx.stroke(); }
    }
    if (A.lure) {
      const lx = w * 0.6 + Math.sin(ph * 0.4) * 2, ly = -h * 0.5 + Math.cos(ph * 0.3) * 2;
      brush(ctx, [w * 0.2, -h * 0.32, w * 0.5, -h * 0.95, lx, ly], 1.8, 0.7);
      eye(ctx, lx, ly, 3, A.c3 || '#bfe4ff', true);
    }
    eye(ctx, w * 0.27, -h * 0.12, Math.max(2, h * 0.11), A.eye || '#fff', !!A.glow);
  },

  bird(ctx, e, t, A) {
    const w = e.w, h = e.h, an = e.anim || 0;
    const flap = Math.sin(an * 9) * 0.5 + 0.5;
    const bob = Math.sin(an * 9 + 1) * h * 0.05;
    ctx.save(); ctx.translate(0, bob);
    // tail feathers
    form(ctx, A.c2 || A.c1, (c) => { c.moveTo(-w * 0.2, h * 0.05); c.lineTo(-w * 0.48, h * 0.12); c.lineTo(-w * 0.42, h * 0.2); c.lineTo(-w * 0.5, h * 0.26); c.lineTo(-w * 0.18, h * 0.2); c.closePath(); }, { lw: 1.5, sd: 1.5 });
    wings(ctx, -w * 0.05, -h * 0.05, w * 0.8, h * 0.9, flap, A.c2 || A.c1, 1, 'bird');
    const bodyP = (c) => oval(c, 0, 0, w * 0.3, h * 0.31, 0.2, 0.04);
    form(ctx, A.c1, bodyP, { sd: h * 0.12, lw: 2 });
    // chest feather scallops
    ctx.save(); ctx.beginPath(); bodyP(ctx); ctx.clip();
    ctx.fillStyle = lighten(A.c1, 0.3); ctx.beginPath(); ctx.ellipse(w * 0.1, h * 0.12, w * 0.18, h * 0.2, 0.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = shade(A.c1, 0.4); ctx.lineWidth = 0.9;
    for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(w * (0.0 + i * 0.08 + (r & 1) * 0.04), h * (0.0 + r * 0.1), w * 0.04, 0.2, Math.PI - 0.2); ctx.stroke(); }
    ctx.restore();
    // ear tufts + brow
    form(ctx, A.c1, (c) => { c.moveTo(w * 0.02, -h * 0.25); c.quadraticCurveTo(w * 0.0, -h * 0.42, -w * 0.06, -h * 0.48); c.quadraticCurveTo(w * 0.08, -h * 0.42, w * 0.14, -h * 0.28); c.closePath(); }, { lw: 1.4, sd: 1 });
    form(ctx, A.c3 || '#e8c070', (c) => { c.moveTo(w * 0.24, -h * 0.13); c.quadraticCurveTo(w * 0.42, -h * 0.12, w * 0.53, -h * 0.0); c.quadraticCurveTo(w * 0.4, h * 0.02, w * 0.25, h * 0.05); c.closePath(); }, { lw: 1.5, sd: 1.2 });
    eye(ctx, w * 0.15, -h * 0.12, Math.max(2.2, h * 0.09), A.eye || '#fff', !!A.glow);
    stroke(ctx, [w * 0.05, -h * 0.24, w * 0.15, -h * 0.26, w * 0.24, -h * 0.2], 1.4);
    ctx.restore();
  },

  bat(ctx, e, t, A) {
    const w = e.w, h = e.h, an = e.anim || 0;
    const flap = Math.sin(an * 16) * 0.5 + 0.5;
    ctx.save(); ctx.translate(0, (flap - 0.5) * h * 0.1);
    wings(ctx, 0, 0, w * 0.9, h * 0.8, flap, A.c2 || A.c1, 1, 'bat');
    // ears
    for (const s of [-1, 1]) form(ctx, A.c1, (c) => { c.moveTo(s * w * 0.15, -w * 0.12); c.quadraticCurveTo(s * w * 0.16, -w * 0.28, s * w * 0.09, -w * 0.36); c.quadraticCurveTo(s * w * 0.04, -w * 0.25, s * w * 0.01, -w * 0.17); c.closePath(); }, { lw: 1.4, sd: 1.2 });
    form(ctx, A.c1, (c) => fur(c, 0, w * 0.02, w * 0.2, w * 0.2, 10, 0.16, 1), { sd: w * 0.06, lw: 2 });
    stroke(ctx, [-w * 0.1, w * 0.1, 0, w * 0.15, w * 0.1, w * 0.1], 1, shade(A.c1, 0.5));
    // fangs
    ctx.fillStyle = '#f2ead8';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * w * 0.06, w * 0.06); ctx.lineTo(s * w * 0.04, w * 0.14); ctx.lineTo(s * w * 0.02, w * 0.06); ctx.fill(); }
    eye(ctx, -w * 0.07, -w * 0.03, 1.9, A.eye || '#ff6a5a', true, 'angry');
    eye(ctx, w * 0.07, -w * 0.03, 1.9, A.eye || '#ff6a5a', true, 'angry');
    ctx.restore();
  },

  wisp(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 6;
    const a0 = e.alpha ?? 0.9;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, w);
    g.addColorStop(0, A.c3 || '#ffffff'); g.addColorStop(0.35, A.c1); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.globalAlpha = a0 * 0.75;
    ctx.beginPath(); ctx.arc(0, 0, w, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.globalAlpha = a0;
    // ghost body: a hooded flame with ragged trailing wisps
    const body = (c) => {
      c.moveTo(-w * 0.42, 0);
      c.bezierCurveTo(-w * 0.46, -h * 0.55, w * 0.1, -h * 0.75, w * 0.1 + Math.sin(ph * 0.7) * w * 0.05, -h * 0.72);
      c.bezierCurveTo(w * 0.35, -h * 0.55, w * 0.46, -h * 0.25, w * 0.42, 0);
      for (let i = 0; i <= 4; i++) {
        const x = w * 0.42 - (i + 0.5) * w * 0.21;
        const yy = h * (0.45 + (i % 2) * 0.18) + Math.sin(ph + i * 1.3) * h * 0.12;
        c.quadraticCurveTo(x + w * 0.1 + Math.sin(ph + i) * w * 0.06, yy, x, h * 0.18 + (i % 2) * h * 0.05);
      }
      c.lineTo(-w * 0.42, 0);
    };
    ctx.beginPath(); body(ctx);
    ctx.fillStyle = A.c1; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = A.c3 || lighten(A.c1, 0.6); ctx.globalAlpha = a0 * 0.75;
    ctx.beginPath(); oval(ctx, -w * 0.05, -h * 0.2, w * 0.24, h * 0.28, -0.3, 0.08); ctx.fill();
    ctx.restore();
    ctx.beginPath(); body(ctx); ctx.strokeStyle = shade(A.c1, 0.55); ctx.lineWidth = 1.2; ctx.lineJoin = 'round'; ctx.stroke();
    for (const s of [-1, 1]) socket(ctx, s * w * 0.13, -h * 0.08, w * 0.075, h * 0.1, s * 0.5);
    ctx.restore();
  },

  candle(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 9;
    const lw = Math.max(1.8, w * 0.08);
    brush(ctx, [-w * 0.14, -h * 0.1, -w * 0.17, -h * 0.05, -w * 0.2 + Math.sin(ph) * 2, 0], lw, lw * 0.4);
    brush(ctx, [w * 0.14, -h * 0.1, w * 0.17, -h * 0.05, w * 0.2 - Math.sin(ph) * 2, 0], lw, lw * 0.4);
    const wax = A.c1 || '#e9d9b0';
    const bodyP = (c) => {
      c.moveTo(-w * 0.3, -h * 0.08);
      c.bezierCurveTo(-w * 0.32, -h * 0.3, -w * 0.27, -h * 0.55, -w * 0.29, -h * 0.75);
      c.quadraticCurveTo(-w * 0.15, -h * 0.68, -w * 0.02, -h * 0.8);
      c.quadraticCurveTo(w * 0.15, -h * 0.7, w * 0.28, -h * 0.77);
      // drips down the front-right
      c.lineTo(w * 0.29, -h * 0.55); c.quadraticCurveTo(w * 0.35, -h * 0.42, w * 0.31, -h * 0.4);
      c.lineTo(w * 0.31, -h * 0.08);
      c.quadraticCurveTo(0, -h * 0.03, -w * 0.3, -h * 0.08);
    };
    form(ctx, wax, bodyP, { sd: w * 0.12, lw: 2, hatch: [-w * 0.3, -h * 0.8, w * 0.6, h * 0.72] });
    // drip rivulets + melted pool on top
    const dc = lighten(wax, 0.35);
    brush(ctx, [w * 0.1, -h * 0.74, w * 0.14, -h * 0.55, w * 0.09, -h * 0.42], 3, 2, dc, 0, 6);
    brush(ctx, [-w * 0.2, -h * 0.72, -w * 0.18, -h * 0.65, -w * 0.21, -h * 0.58], 2.6, 2, dc, 0, 6);
    stroke(ctx, [-w * 0.24, -h * 0.74, -w * 0.05, -h * 0.7, w * 0.22, -h * 0.73], 1, shade(wax, 0.4));
    // wick
    brush(ctx, [0, -h * 0.78, Math.sin(ph) * 1.2, -h * 0.84, Math.sin(ph * 1.3) * 1.5, -h * 0.88], 1.6, 1, INK, 0, 4);
    // flame: two-tone painted tongue with a soft halo
    const fh = h * 0.35 * (1 + Math.sin(ph * 2) * 0.1), fy = -h * 0.86, sway = Math.sin(ph * 1.3) * w * 0.05;
    const fc = A.c2 || '#ffcf7a';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, fy - fh * 0.4, 0, 0, fy - fh * 0.4, fh * 1.5);
    g.addColorStop(0, fc); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha *= 0.55; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, fy - fh * 0.4, fh * 1.5, 0, TAU); ctx.fill();
    ctx.restore();
    const tongue = (k, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-w * 0.11 * k, fy); ctx.bezierCurveTo(-w * 0.14 * k, fy - fh * 0.5 * k, sway, fy - fh * 0.8, sway * 1.4, fy - fh * 1.25 * k); ctx.bezierCurveTo(w * 0.05, fy - fh * 0.7 * k, w * 0.14 * k, fy - fh * 0.4 * k, w * 0.11 * k, fy); ctx.quadraticCurveTo(0, fy + fh * 0.12, -w * 0.11 * k, fy); ctx.fill(); };
    tongue(1, fc); tongue(0.55, lighten(fc, 0.7));
    socket(ctx, -w * 0.09, -h * 0.5, w * 0.07, h * 0.06, 0.4);
    socket(ctx, w * 0.13, -h * 0.5, w * 0.07, h * 0.06, -0.4);
  },

  skull(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 8;
    legs(ctx, 4, w * 0.7, -h * 0.2, h * 0.2, ph, Math.max(1.8, h * 0.07), 1.3);
    const bone = A.c1 || '#e6dcc4';
    const bob = Math.abs(Math.sin(ph)) * h * 0.03;
    ctx.save(); ctx.translate(0, -bob);
    if (A.horns) {
      const hc = A.c2 || '#cfc3a6';
      for (const s of [-1, 1]) form(ctx, hc, (c) => { c.moveTo(s * w * 0.32, -h * 0.82); c.bezierCurveTo(s * w * 0.62, -h * 0.95, s * w * 0.62, -h * 1.2, s * w * 0.48, -h * 1.32); c.bezierCurveTo(s * w * 0.48, -h * 1.15, s * w * 0.4, -h * 1.0, s * w * 0.18, -h * 0.94); c.closePath(); }, { lw: 1.6, sd: 2 });
    }
    const cran = (c) => {
      c.moveTo(-w * 0.44, -h * 0.5);
      c.bezierCurveTo(-w * 0.48, -h * 0.95, w * 0.42, -h * 1.05, w * 0.45, -h * 0.55);
      c.bezierCurveTo(w * 0.46, -h * 0.35, w * 0.3, -h * 0.3, w * 0.2, -h * 0.2);
      c.lineTo(-w * 0.18, -h * 0.2);
      c.bezierCurveTo(-w * 0.3, -h * 0.3, -w * 0.43, -h * 0.35, -w * 0.44, -h * 0.5);
    };
    form(ctx, bone, cran, { sd: h * 0.14, lw: 2.2, hatch: [-w * 0.45, -h, w * 0.9, h * 0.8] });
    // cracks
    brush(ctx, [-w * 0.05, -h * 0.94, -w * 0.02, -h * 0.84, -w * 0.08, -h * 0.76], 1.4, 0.3);
    brush(ctx, [-w * 0.02, -h * 0.84, w * 0.05, -h * 0.82, w * 0.08, -h * 0.86], 1, 0.3);
    socket(ctx, w * 0.13, -h * 0.58, w * 0.13, h * 0.15, 0.5);
    socket(ctx, -w * 0.16, -h * 0.58, w * 0.12, h * 0.14, -0.5);
    // nasal notch + teeth
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-w * 0.03, -h * 0.4); ctx.lineTo(0, -h * 0.47); ctx.lineTo(w * 0.03, -h * 0.4); ctx.fill();
    ink(ctx, 1); ctx.beginPath(); ctx.moveTo(-w * 0.15, -h * 0.28); ctx.lineTo(w * 0.17, -h * 0.28); ctx.stroke();
    for (let i = 0; i < 4; i++) { const x = -w * 0.11 + i * w * 0.08; ctx.beginPath(); ctx.moveTo(x, -h * 0.32); ctx.lineTo(x, -h * 0.23); ctx.stroke(); }
    eye(ctx, w * 0.13, -h * 0.58, 1.8, A.eye || '#ffb85c', true);
    eye(ctx, -w * 0.16, -h * 0.58, 1.8, A.eye || '#ffb85c', true);
    ctx.restore();
  },

  wasp(ctx, e, t, A) {
    const w = e.w, h = e.h, an = e.anim || 0;
    const flap = Math.sin(an * 45) * 0.5 + 0.5;
    const curl = e.state === 'tele' || e.state === 'attack' ? 0.35 : Math.sin(an * 3) * 0.06;
    for (let i = 0; i < 2; i++) leg(ctx, w * (0.02 + i * 0.1), h * 0.08, w * (0.0 + i * 0.1), h * 0.28, w * (-0.06 + i * 0.1) + Math.sin(an * 5 + i) * 1.5, h * 0.4, Math.max(1.2, h * 0.05));
    wings(ctx, -w * 0.05, -h * 0.25, w * 0.6, h * 0.7, flap, 'rgba(232,240,205,0.5)', 0.85, 'fly');
    // abdomen pivots at the waist
    ctx.save(); ctx.translate(-w * 0.05, 0); ctx.rotate(curl);
    const yc = A.c2 || '#e8d24a';
    brush(ctx, [-w * 0.42, h * 0.12, -w * 0.52, h * 0.24, -w * 0.62, h * 0.36], Math.max(3, h * 0.12), 0.3, INK, 0, 6);
    const abd = (c) => oval(c, -w * 0.22, h * 0.05, w * 0.28, h * 0.27, 0.4, 0.04);
    form(ctx, yc, abd, { sd: h * 0.1, lw: 2 });
    ctx.save(); ctx.beginPath(); abd(ctx); ctx.clip();
    for (const k of [-0.3, -0.14]) brush(ctx, [w * k, -h * 0.25, w * (k - 0.02), h * 0.05, w * (k - 0.07), h * 0.32], 3, 2.2, INK, 0.6, 6);
    ctx.restore();
    ctx.restore();
    form(ctx, A.c1, (c) => fur(c, w * 0.1, -h * 0.05, w * 0.16, h * 0.18, 8, 0.15), { sd: h * 0.06 });
    form(ctx, A.c1, (c) => oval(c, w * 0.32, -h * 0.12, w * 0.14, w * 0.14, 0, 0.04), { sd: w * 0.05, lw: 1.8 });
    // mandibles + antenna
    brush(ctx, [w * 0.4, -h * 0.02, w * 0.48, h * 0.04, w * 0.44, h * 0.1], 1.8, 0.4);
    stroke(ctx, [w * 0.33, -h * 0.25, w * 0.4, -h * 0.5, w * 0.52 + Math.sin(an * 4) * 1.5, -h * 0.48], 1.3);
    eye(ctx, w * 0.38, -h * 0.15, Math.max(2.2, h * 0.09), A.eye || '#ff5a3a', true, 'angry');
  },

  crab(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 12;
    legs(ctx, 4, w * 0.8, -h * 0.25, h * 0.25, ph, Math.max(1.6, h * 0.07), 1.5);
    const snap = e.state === 'attack' ? 0.6 : e.state === 'tele' ? -0.2 : 0;
    const clawC = A.c2 || A.c1;
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * w * 0.4, -h * 0.5); ctx.rotate(s * (-0.4 - snap));
      brush(ctx, [0, h * 0.08, 0, 0, 0, -h * 0.06], Math.max(3, h * 0.12), Math.max(2.5, h * 0.1));
      const open = 0.25 + (snap > 0 ? 0.2 : Math.max(0, Math.sin(ph * 0.3)) * 0.2);
      form(ctx, clawC, (c) => { c.moveTo(-w * 0.1, -h * 0.05); c.bezierCurveTo(-w * 0.16, -h * 0.25, -w * 0.08, -h * 0.42, w * 0.0, -h * 0.4); c.quadraticCurveTo(-w * 0.02, -h * 0.22, w * 0.08, -h * 0.12); c.quadraticCurveTo(w * 0.08, -h * 0.02, -w * 0.1, -h * 0.05); }, { lw: 1.8, sd: h * 0.07 });
      ctx.save(); ctx.translate(w * 0.06, -h * 0.12); ctx.rotate(open);
      form(ctx, clawC, (c) => { c.moveTo(0, 0); c.quadraticCurveTo(w * 0.04, -h * 0.18, -w * 0.02, -h * 0.26); c.quadraticCurveTo(-w * 0.03, -h * 0.12, -w * 0.05, -h * 0.02); c.closePath(); }, { lw: 1.5, sd: 1 });
      ctx.restore();
      ctx.restore();
    }
    const cara = (c) => { c.moveTo(-w * 0.4, -h * 0.36); c.bezierCurveTo(-w * 0.42, -h * 0.7, w * 0.38, -h * 0.76, w * 0.4, -h * 0.36); c.quadraticCurveTo(w * 0.2, -h * 0.22, 0, -h * 0.24); c.quadraticCurveTo(-w * 0.22, -h * 0.22, -w * 0.4, -h * 0.36); };
    // eyestalks behind the carapace
    for (const s of [-1, 1]) { const tx = s * w * 0.1 + Math.sin(ph * 0.4 + s) * 1.2; brush(ctx, [s * w * 0.08, -h * 0.6, s * w * 0.09, -h * 0.75, tx, -h * 0.9], 2.2, 1.5); eye(ctx, tx, -h * 0.92, 2.4, A.eye || '#fff', !!A.glow); }
    form(ctx, A.c1, cara, { sd: h * 0.12, lw: 2.2, hatch: [-w * 0.42, -h * 0.75, w * 0.84, h * 0.55] });
    stroke(ctx, [-w * 0.25, -h * 0.42, 0, -h * 0.5, w * 0.25, -h * 0.42], 1.3, shade(A.c1, 0.55));
    stroke(ctx, [-w * 0.25, -h * 0.58, -w * 0.08, -h * 0.66, w * 0.12, -h * 0.65], 1.4, lighten(A.c1, 0.45));
    ctx.fillStyle = shade(A.c1, 0.35);
    for (const [x, y] of [[-0.18, -0.5], [0.15, -0.55], [0.02, -0.38]]) { ctx.beginPath(); ctx.arc(w * x, h * y, Math.max(1, w * 0.025), 0, TAU); ctx.fill(); }
  },

  mantis(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 8;
    const lw = Math.max(1.6, w * 0.05);
    leg(ctx, -w * 0.1, -h * 0.36, -w * 0.18, -h * 0.25, -w * 0.25 + Math.sin(ph) * 2, 0, lw);
    leg(ctx, w * 0.04, -h * 0.36, w * 0.12, -h * 0.25, w * 0.15 - Math.sin(ph) * 2, 0, lw);
    leg(ctx, -w * 0.25, -h * 0.38, -w * 0.35, -h * 0.28, -w * 0.42 - Math.sin(ph) * 2, 0, lw * 0.85);
    // abdomen with folded wing on top
    form(ctx, A.c1, (c) => oval(c, -w * 0.18, -h * 0.4, w * 0.3, h * 0.1, -0.3, 0.05), { sd: h * 0.05 });
    for (let i = 0; i < 3; i++) stroke(ctx, [-w * (0.32 - i * 0.08), -h * (0.36 - i * 0.03), -w * (0.33 - i * 0.08), -h * (0.4 - i * 0.03), -w * (0.32 - i * 0.08), -h * (0.45 - i * 0.03)], 1, shade(A.c1, 0.5));
    form(ctx, lighten(A.c1, 0.25), (c) => { c.moveTo(0, -h * 0.45); c.quadraticCurveTo(-w * 0.2, -h * 0.55, -w * 0.45, -h * 0.42); c.quadraticCurveTo(-w * 0.2, -h * 0.44, 0, -h * 0.42); c.closePath(); }, { lw: 1.3, sd: 1 });
    // neck
    brush(ctx, [0, -h * 0.45, w * 0.15, -h * 0.65, w * 0.12, -h * 0.85], Math.max(6, w * 0.13), Math.max(5, w * 0.1));
    brush(ctx, [0, -h * 0.45, w * 0.15, -h * 0.65, w * 0.12, -h * 0.85], Math.max(3.5, w * 0.08), Math.max(2.8, w * 0.06), A.c1);
    // raptorial blade arm
    const atk = e.state === 'attack' ? 1 : e.state === 'tele' ? -0.4 : 0;
    ctx.save(); ctx.translate(w * 0.12, -h * 0.72); ctx.rotate(0.3 + atk * 1.1);
    const bc = A.c2 || '#e8e0cc';
    form(ctx, bc, (c) => { c.moveTo(0, -2); c.lineTo(w * 0.35, -h * 0.06); c.quadraticCurveTo(w * 0.52, h * 0.1, w * 0.3, h * 0.27); c.quadraticCurveTo(w * 0.38, h * 0.1, w * 0.26, h * 0.04); c.lineTo(0, 3); c.closePath(); }, { lw: 1.6, sd: 2 });
    for (let i = 0; i < 3; i++) brush(ctx, [w * (0.08 + i * 0.08), h * 0.0, w * (0.09 + i * 0.08), h * 0.04, w * (0.08 + i * 0.08), h * 0.07], 1.4, 0.2);
    ctx.restore();
    form(ctx, A.c3 || A.c1, (c) => { c.moveTo(w * 0.04, -h * 0.86); c.quadraticCurveTo(w * 0.16, -h * 0.82, w * 0.3, -h * 0.9); c.quadraticCurveTo(w * 0.22, -h * 1.0, w * 0.13, -h * 1.02); c.quadraticCurveTo(w * 0.04, -h * 0.98, w * 0.04, -h * 0.86); }, { lw: 1.6, sd: 1.5 });
    stroke(ctx, [w * 0.12, -h * 1.0, w * 0.18, -h * 1.15, w * 0.3, -h * 1.14 + Math.sin(ph * 0.5) * 1.5], 1.1);
    eye(ctx, w * 0.18, -h * 0.93, 2.2, A.eye || '#fff', !!A.glow);
  },

  golem(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 5;
    const step = Math.sin(ph) * h * 0.04;
    const tele = e.state === 'tele';
    const lc = A.c2 || A.c1;
    const legP = (x, lift) => (c) => { c.moveTo(x, -h * 0.28); c.lineTo(x + w * 0.22, -h * 0.28); c.lineTo(x + w * 0.24, -lift - h * 0.02); c.quadraticCurveTo(x + w * 0.11, -lift + h * 0.01, x - w * 0.02, -lift - h * 0.03); c.closePath(); };
    form(ctx, lc, legP(-w * 0.36, Math.max(0, step)), { sd: w * 0.05, lw: 2.2 });
    form(ctx, lc, legP(w * 0.1, Math.max(0, -step)), { sd: w * 0.05, lw: 2.2 });
    const sink = tele ? h * 0.04 : Math.abs(step) * 0.4;
    ctx.save(); ctx.translate(0, sink);
    const bodyP = (c) => {
      c.moveTo(-w * 0.45, -h * 0.25); c.lineTo(-w * 0.5, -h * 0.6); c.lineTo(-w * 0.42, -h * 0.82);
      c.lineTo(-w * 0.2, -h * 0.97); c.lineTo(w * 0.12, -h * 0.98); c.lineTo(w * 0.36, -h * 0.88);
      c.lineTo(w * 0.49, -h * 0.6); c.lineTo(w * 0.46, -h * 0.4); c.lineTo(w * 0.4, -h * 0.25); c.closePath();
    };
    form(ctx, A.c1, bodyP, { sd: h * 0.16, lw: 2.8, hatch: [-w * 0.5, -h, w, h * 0.78] });
    // slab seams + cracks
    const sc = shade(A.c1, 0.6);
    brush(ctx, [-w * 0.2, -h * 0.95, -w * 0.05, -h * 0.62, -w * 0.25, -h * 0.4], 1.8, 0.4, sc);
    brush(ctx, [-w * 0.05, -h * 0.62, w * 0.1, -h * 0.55, w * 0.18, -h * 0.35], 1.4, 0.3, sc);
    stroke(ctx, [-w * 0.44, -h * 0.55, -w * 0.3, -h * 0.5, -w * 0.18, -h * 0.52], 1.2, sc);
    // pale chips on lit edges + moss on top
    stroke(ctx, [-w * 0.4, -h * 0.78, -w * 0.32, -h * 0.88, -w * 0.18, -h * 0.93], 2, lighten(A.c1, 0.4));
    // moss draped over the crown, hanging in strands
    ctx.save(); ctx.beginPath(); bodyP(ctx); ctx.clip();
    ctx.fillStyle = A.c3 || shade(lc, 0.1);
    ctx.beginPath(); ctx.moveTo(-w * 0.5, -h * 1.1); ctx.lineTo(w * 0.4, -h * 1.1); ctx.lineTo(w * 0.3, -h * 0.85);
    for (let i = 0; i < 7; i++) ctx.quadraticCurveTo(w * (0.25 - i * 0.11), -h * (0.72 - (i % 2) * 0.1), w * (0.2 - (i + 1) * 0.11), -h * (0.86 + (i % 2) * 0.03));
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.beginPath(); bodyP(ctx); ink(ctx, 1.6); ctx.stroke();
    eye(ctx, w * 0.25, -h * 0.72, tele ? 5 : 3.5, A.eye || '#ff8a3d', true, 'angry');
    ctx.restore();
  },

  bell(ctx, e, t, A) {
    const w = e.w, h = e.h, an = e.anim || 0;
    const sw = Math.sin(an * 4) * 0.15;
    ctx.save(); ctx.rotate(sw);
    // clapper lags the swing (secondary motion)
    const lag = -Math.sin(an * 4 - 0.9) * 0.35;
    ctx.save(); ctx.translate(0, -h * 0.55); ctx.rotate(lag);
    brush(ctx, [0, 0, 0, h * 0.25, 0, h * 0.45], 2, 1.6);
    form(ctx, A.c2 || '#fff1c0', (c) => oval(c, 0, h * 0.5, w * 0.1, w * 0.1, 0, 0.05), { lw: 1.6, sd: 1.5 });
    ctx.restore();
    const bodyP = (c) => {
      c.moveTo(-w * 0.18, -h * 0.95);
      c.bezierCurveTo(-w * 0.32, -h * 0.9, -w * 0.32, -h * 0.4, -w * 0.52, -h * 0.12);
      c.quadraticCurveTo(-w * 0.3, -h * 0.17, -w * 0.12, -h * 0.14);
      c.quadraticCurveTo(0, -h * 0.2, w * 0.12, -h * 0.14);
      c.quadraticCurveTo(w * 0.3, -h * 0.17, w * 0.52, -h * 0.12);
      c.bezierCurveTo(w * 0.32, -h * 0.4, w * 0.32, -h * 0.9, w * 0.18, -h * 0.95);
      c.closePath();
    };
    form(ctx, A.c1, bodyP, { sd: w * 0.14, lw: 2.2, hatch: [-w * 0.5, -h, w, h * 0.88] });
    const rc = A.c2 || '#fff1c0';
    ctx.strokeStyle = rc; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-w * 0.42, -h * 0.24); ctx.quadraticCurveTo(0, -h * 0.3, w * 0.42, -h * 0.24); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-w * 0.3, -h * 0.72); ctx.quadraticCurveTo(0, -h * 0.76, w * 0.3, -h * 0.72); ctx.stroke();
    // crack + crown loop
    brush(ctx, [w * 0.22, -h * 0.4, w * 0.15, -h * 0.32, w * 0.2, -h * 0.22], 1.5, 0.3);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, -h * 0.98, w * 0.07, Math.PI, 0); ctx.stroke();
    stroke(ctx, [-w * 0.2, -h * 0.8, -w * 0.26, -h * 0.5, -w * 0.38, -h * 0.25], 1.8, lighten(A.c1, 0.45));
    ctx.restore();
    eye(ctx, -w * 0.12, -h * 0.55, 2.4, A.eye || '#fff', true); eye(ctx, w * 0.12, -h * 0.55, 2.4, A.eye || '#fff', true);
  },

  book(ctx, e, t, A) {
    const w = e.w, h = e.h, an = e.anim || 0;
    const flap = Math.sin(an * 10) * 0.6;
    const pc = A.c3 || '#efe6cf';
    for (const s of [-1, 1]) {
      ctx.save(); ctx.rotate(s * (0.3 + flap * 0.5));
      form(ctx, A.c1, (c) => { c.moveTo(0, 0); c.lineTo(s * w * 0.49, -h * 0.17); c.lineTo(s * w * 0.5, h * 0.36); c.lineTo(0, h * 0.46); c.closePath(); }, { lw: 1.9, sd: 2 });
      // fanned pages (secondary flutter)
      const fl = Math.sin(an * 10 - 1) * 2;
      for (let k = 2; k >= 0; k--) {
        ctx.fillStyle = k ? shade(pc, 0.12 * k) : pc;
        ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(s * (w * 0.43 - k * 2), -h * 0.13 + k * fl); ctx.lineTo(s * (w * 0.43 - k * 2), h * 0.31 + k * fl * 0.5); ctx.lineTo(0, h * 0.41); ctx.fill();
        ink(ctx, 0.7); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(40,30,30,0.5)'; ctx.lineWidth = 0.9;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(s * 5, h * (0.0 + k * 0.08)); ctx.lineTo(s * w * (0.2 + (k % 2) * 0.12), h * (-0.05 + k * 0.085)); ctx.stroke(); }
      ctx.restore();
    }
    // spine
    brush(ctx, [0, -h * 0.02, 1, h * 0.2, 0, h * 0.46], 3.2, 2.2);
    eye(ctx, 0, h * 0.12, 3, A.eye || '#e7c96a', true, 'slit');
  },

  spool(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 8;
    legs(ctx, 2, w * 0.4, -h * 0.15, h * 0.15, ph, Math.max(1.8, w * 0.07));
    const fc = A.c2 || '#8a6a4a';
    // thread core
    form(ctx, A.c1, (c) => { c.moveTo(-w * 0.24, -h * 0.74); c.quadraticCurveTo(0, -h * 0.7, w * 0.24, -h * 0.74); c.quadraticCurveTo(w * 0.27, -h * 0.5, w * 0.24, -h * 0.27); c.quadraticCurveTo(0, -h * 0.3, -w * 0.24, -h * 0.27); c.quadraticCurveTo(-w * 0.27, -h * 0.5, -w * 0.24, -h * 0.74); }, { sd: w * 0.1, lw: 2 });
    ctx.strokeStyle = shade(A.c1, 0.45); ctx.lineWidth = 0.9;
    for (let y = -h * 0.7; y < -h * 0.3; y += 2.6) { ctx.beginPath(); ctx.moveTo(-w * 0.23, y); ctx.quadraticCurveTo(0, y + 2.2, w * 0.23, y + 0.8); ctx.stroke(); }
    stroke(ctx, [-w * 0.18, -h * 0.68, -w * 0.2, -h * 0.5, -w * 0.17, -h * 0.33], 1.4, lighten(A.c1, 0.5));
    // flanges with wood grain
    for (const y of [-h * 0.85, -h * 0.28]) {
      form(ctx, fc, (c) => oval(c, 0, y + h * 0.06, w * 0.33, h * 0.065, 0, 0.02), { sd: h * 0.035, lw: 2 });
      stroke(ctx, [-w * 0.22, y + h * 0.05, 0, y + h * 0.08, w * 0.2, y + h * 0.05], 0.9, shade(fc, 0.5));
    }
    eye(ctx, w * 0.05, -h * 0.52, 2.4, A.eye || '#fff', !!A.glow); eye(ctx, w * 0.17, -h * 0.52, 2.4, A.eye || '#fff', !!A.glow);
    // loose thread end, trailing
    brush(ctx, [-w * 0.24, -h * 0.6, -w * 0.5, -h * 0.5 + Math.sin(ph) * 3, -w * 0.6, -h * 0.2 + Math.sin(ph - 1) * 2], 1.8, 0.6, A.c1, 0, 10);
  },

  eyeball(ctx, e, t, A) {
    const w = e.w, h = e.h, r = Math.min(w, h) * 0.45, an = e.anim || 0;
    const tc = A.c2 || A.c1;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + an;
      const P = [Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, Math.cos(a + 0.4) * r * 1.5, Math.sin(a + 0.4) * r * 1.5, Math.cos(a + 0.2 + Math.sin(an * 3 + i) * 0.2) * r * 1.85, Math.sin(a + 0.2 + Math.sin(an * 3 + i) * 0.2) * r * 1.85];
      brush(ctx, P, 3.2, 0.3, INK, 0, 8);
      brush(ctx, P, 1.6, 0.1, tc, 0, 8);
    }
    const sc = A.c3 || '#efe8d8';
    form(ctx, sc, (c) => oval(c, 0, 0, r, r * 0.97, 0.3, 0.03), { sd: r * 0.25, lw: 2.2 });
    // bloodshot veins
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.5; stroke(ctx, [Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, Math.cos(a + 0.2) * r * 0.75, Math.sin(a + 0.2) * r * 0.75, Math.cos(a - 0.1) * r * 0.6, Math.sin(a - 0.1) * r * 0.6], 1, 'rgba(170,40,50,0.6)'); }
    const p = e.game && e.game.player;
    const a = p ? Math.atan2(p.cy - e.cy, (p.cx - e.cx) * (e.facing || 1)) : 0;
    const tele = e.state === 'tele';
    const ix = Math.cos(a) * r * 0.4, iy = Math.sin(a) * r * 0.4;
    ctx.fillStyle = A.c1; ctx.beginPath(); ctx.arc(ix, iy, r * 0.45, 0, TAU); ctx.fill();
    ctx.strokeStyle = shade(A.c1, 0.5); ctx.lineWidth = 0.9;
    for (let i = 0; i < 10; i++) { const b = i * TAU / 10; ctx.beginPath(); ctx.moveTo(ix + Math.cos(b) * r * 0.2, iy + Math.sin(b) * r * 0.2); ctx.lineTo(ix + Math.cos(b) * r * 0.42, iy + Math.sin(b) * r * 0.42); ctx.stroke(); }
    ink(ctx, 1.2); ctx.beginPath(); ctx.arc(ix, iy, r * 0.45, 0, TAU); ctx.stroke();
    eye(ctx, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * (tele ? 0.3 : 0.18), tele ? '#fff' : INK, tele);
    // heavy upper lid
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
    ctx.fillStyle = shade(sc, 0.35); ctx.beginPath(); ctx.ellipse(0, -r * (tele ? 1.25 : 1.05), r * 1.2, r * 0.45, 0, 0, TAU); ctx.fill();
    ctx.restore();
  },

  flower(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 3;
    const gc = A.c3 || '#4a7a3a';
    const sw = Math.sin(ph) * 6;
    const stem = [0, 0, sw, -h * 0.4, 0, -h * 0.62];
    brush(ctx, stem, 5, 3.4);
    brush(ctx, stem, 2.6, 1.4, gc);
    for (const [x, y, rot, s] of [[-w * 0.2, -h * 0.25, 0.5, -1], [w * 0.16, -h * 0.4, -0.5, 1]]) {
      form(ctx, gc, (c) => { c.moveTo(sw * 0.3, y + h * 0.04); c.quadraticCurveTo(x * 0.5, y - h * 0.1, x * 1.3, y - h * 0.02 * s); c.quadraticCurveTo(x * 0.6, y + h * 0.08, sw * 0.3, y + h * 0.04); }, { lw: 1.4, sd: 1.2 });
      stroke(ctx, [sw * 0.3, y + h * 0.04, x * 0.6, y, x * 1.15, y - h * 0.015 * s], 0.8, shade(gc, 0.5));
      void rot;
    }
    const open = e.state === 'tele' ? 1.3 : e.state === 'attack' ? 1.5 : 1;
    ctx.save(); ctx.translate(0, -h * 0.68);
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.rotate((i / 6) * TAU + ph * 0.2);
      const L = w * 0.21 * open, W = w * 0.1;
      form(ctx, i % 2 ? A.c1 : shade(A.c1, 0.12), (c) => { c.moveTo(w * 0.04, 0); c.bezierCurveTo(L * 0.6, -W * 1.2, L * 1.8, -W * 0.9, L * 2, 0); c.bezierCurveTo(L * 1.8, W * 0.9, L * 0.6, W * 1.2, w * 0.04, 0); }, { lw: 1.5, sd: W * 0.4 });
      stroke(ctx, [w * 0.06, 0, L, -W * 0.1, L * 1.7, 0], 0.8, shade(A.c1, 0.45));
      ctx.restore();
    }
    const cc = A.c2 || '#ffe27a';
    form(ctx, cc, (c) => oval(c, 0, 0, w * 0.14, w * 0.14, 0, 0.05), { lw: 1.6, sd: w * 0.04 });
    ctx.fillStyle = shade(cc, 0.5);
    for (let i = 0; i < 7; i++) { const a = i * 2.4; ctx.beginPath(); ctx.arc(Math.cos(a) * w * 0.08 * Math.sqrt(i / 7), Math.sin(a) * w * 0.08 * Math.sqrt(i / 7), 0.8, 0, TAU); ctx.fill(); }
    ctx.restore();
    eye(ctx, 0, -h * 0.68, 2.6, INK);
  },

  yarn(ctx, e, t, A) {
    const w = e.w, h = e.h, r = Math.min(w, h) * 0.45, an = e.anim || 0;
    const rot = an * 3;
    ctx.save(); ctx.translate(0, A.centered ? 0 : -r);
    // trailing loose strand
    brush(ctx, [-r * 0.7, r * 0.6, -r * 1.4, r * 0.8, -r * 1.2, r * 1.3, -r * 1.8, r * 1.1 + Math.sin(an * 6) * 3], 3.2, 0.8, INK, 0, 12);
    brush(ctx, [-r * 0.7, r * 0.6, -r * 1.4, r * 0.8, -r * 1.2, r * 1.3, -r * 1.8, r * 1.1 + Math.sin(an * 6) * 3], 1.8, 0.3, A.c1, 0, 12);
    const ball = (c) => oval(c, 0, 0, r, r * 0.97, 0.4, 0.03, 5);
    form(ctx, A.c1, ball, { sd: r * 0.28, lw: 2.2 });
    ctx.save(); ctx.beginPath(); ball(ctx); ctx.clip(); ctx.rotate(rot);
    const sc = A.c2 || shade(A.c1, 0.45);
    ctx.strokeStyle = sc; ctx.lineCap = 'round';
    for (let i = -3; i <= 3; i++) { ctx.lineWidth = 1.6 - Math.abs(i) * 0.15; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.2, r * 0.25 + Math.abs(i) * 2, i * 0.5, 0.2, Math.PI * 1.7); ctx.stroke(); }
    ctx.strokeStyle = lighten(A.c1, 0.4); ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * 0.3, 1.8 + i * 0.4, 3.6, 5.2); ctx.stroke(); }
    ctx.restore();
    eye(ctx, r * 0.15, -r * 0.1, Math.max(2, r * 0.16), A.eye || '#fff', !!A.glow);
    eye(ctx, r * 0.5, -r * 0.1, Math.max(2, r * 0.16), A.eye || '#fff', !!A.glow);
    ctx.restore();
  },

  // A rival ball creature (rollers): evil little beads
  ball(ctx, e, t, A) {
    const r = Math.min(e.w, e.h) * 0.5;
    ctx.save(); ctx.translate(0, A.centered ? 0 : -r);
    const roll = e.roll || 0;
    if (A.spikes) { ctx.save(); ctx.rotate(roll); spikesArc(ctx, 0, 0, r, r, 0, TAU, 8, r * 0.4, A.c2 || A.c1); ctx.restore(); }
    form(ctx, A.c1, (c) => oval(c, 0, 0, r, r, 0, 0.02), { sd: r * 0.3, lw: 2.2, hatch: [-r, -r, r * 2, r * 2] });
    // rolling seam (an ellipse that turns with the roll)
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
    const sk = Math.cos(roll);
    ctx.strokeStyle = A.c2 || 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, r * Math.abs(sk) + 0.5, r, 0, 0, TAU); ctx.stroke();
    ctx.restore();
    stroke(ctx, [-r * 0.65, -r * 0.2, -r * 0.55, -r * 0.6, -r * 0.15, -r * 0.72], 2, lighten(A.c1, 0.5));
    const er = Math.max(2, r * 0.2);
    eye(ctx, r * 0.3, -r * 0.2, er, A.eye || '#ff5a4a', true, 'angry');
    brush(ctx, [r * 0.0, -r * 0.48, r * 0.3, -r * 0.42, r * 0.58, -r * 0.25], 2.4, 1);
    ctx.restore();
  },

  icicle(ctx, e, t, A) {
    const w = e.w, h = e.h;
    const ic = A.c1 || '#bfe9ff';
    const a0 = ctx.globalAlpha;
    ctx.globalAlpha = a0 * 0.92;
    const P = (c) => { c.moveTo(-w * 0.42, -h); c.lineTo(w * 0.42, -h); c.lineTo(w * 0.3, -h * 0.72); c.lineTo(w * 0.22, -h * 0.68); c.quadraticCurveTo(w * 0.08, -h * 0.3, 0, 0); c.quadraticCurveTo(-w * 0.12, -h * 0.4, -w * 0.28, -h * 0.75); c.closePath(); };
    form(ctx, ic, P, { sd: w * 0.16, lw: 1.8 });
    ctx.globalAlpha = a0;
    // facet light + frost lines
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.moveTo(-w * 0.3, -h * 0.95); ctx.lineTo(-w * 0.12, -h * 0.95); ctx.lineTo(-w * 0.02, -h * 0.15); ctx.closePath(); ctx.fill();
    stroke(ctx, [w * 0.12, -h * 0.9, w * 0.08, -h * 0.6, w * 0.03, -h * 0.3], 1, shade(ic, 0.45));
    eye(ctx, -w * 0.1, -h * 0.75, 2, A.eye || '#2a6aa0'); eye(ctx, w * 0.1, -h * 0.75, 2, A.eye || '#2a6aa0');
  },

  // big mossy furball with a pale mask: generic "beast"
  beast(ctx, e, t, A) {
    const w = e.w, h = e.h, ph = (e.anim || 0) * 7;
    const breathe = 1 + Math.sin(ph * 0.4) * 0.03;
    legs(ctx, 4, w * 0.7, -h * 0.25, h * 0.25, ph, Math.max(2.4, h * 0.1), 1.2);
    const bodyP = (c) => {
      c.moveTo(-w * 0.5, -h * 0.3);
      fur(c, 0, -h * 0.3, w * 0.5, h * 0.65 * breathe, 11, 0.12, 2, Math.PI, TAU);
      c.quadraticCurveTo(w * 0.2, -h * 0.12, 0, -h * 0.15);
      c.quadraticCurveTo(-w * 0.3, -h * 0.12, -w * 0.5, -h * 0.3);
    };
    form(ctx, A.c1, bodyP, { sd: h * 0.16, lw: 2.6, hatch: [-w * 0.5, -h, w, h * 0.85] });
    // fur tufts drawn into the body
    const fc = shade(A.c1, 0.5), lc = lighten(A.c1, 0.35);
    for (let i = 0; i < 7; i++) {
      const x = -w * 0.35 + i * w * 0.1, y = -h * (0.45 + Math.sin(i * 1.7) * 0.15);
      stroke(ctx, [x, y, x + w * 0.03, y + h * 0.06, x + w * 0.01, y + h * 0.12], 1.2, i % 3 ? fc : lc);
    }
    if (A.c2) { // a band of moss/markings across the back
      ctx.save(); ctx.beginPath(); bodyP(ctx); ctx.clip();
      ctx.fillStyle = A.c2; ctx.beginPath();
      ctx.moveTo(-w * 0.6, -h * 1.2); ctx.lineTo(w * 0.6, -h * 1.2); ctx.lineTo(w * 0.3, -h * 0.72);
      for (let i = 0; i < 8; i++) ctx.quadraticCurveTo(w * (0.27 - i * 0.09), -h * (0.58 + (i % 2) * 0.1), w * (0.22 - (i + 1) * 0.09), -h * (0.74 - (i % 3) * 0.04));
      ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.beginPath(); bodyP(ctx); ink(ctx, 1.4); ctx.stroke();
    }
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
