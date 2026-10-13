// Pre-renders a room's static terrain into an offscreen canvas in a hand-inked style.
import { TILE } from '../core/constants.js';
import { hash2, noise2, rng, hashStr } from '../core/math.js';
import { rgba, mix } from './palettes.js';

const COVER = {
  '#': 15, 'M': 15, 'I': 15, '*': 15, // bits: 1 top, 2 right, 4 bottom, 8 left
  '/': 2 | 4, '\\': 8 | 4,
};
const cov = (ch) => COVER[ch] || 0;

// Extract closed outline loops around terrain mass (in tile-vertex coordinates).
export function extractLoops(room) {
  const edges = [];
  const W = room.w, H = room.h;
  const sky = room.def && room.def.sky;
  const chAt = (x, y) => {
    if (sky && y <= 0) return ' ';     // open sky: the top border is invisible
    if (x < -1 || y < -1 || x > W || y > H) return '#';
    const c = room.charAt(x, y);
    return COVER[c] ? c : ' ';
  };
  for (let y = -2; y <= H + 1; y++) {
    for (let x = -2; x <= W + 1; x++) {
      const c = chAt(x, y);
      const cv = cov(c);
      if (!cv) continue;
      const top = cov(chAt(x, y - 1)), right = cov(chAt(x + 1, y));
      const bot = cov(chAt(x, y + 1)), left = cov(chAt(x - 1, y));
      if (c === '/') edges.push([x, y + 1, x + 1, y]);
      if (c === '\\') edges.push([x, y, x + 1, y + 1]);
      if ((cv & 1) && !(top & 4)) edges.push([x, y, x + 1, y]);
      if ((cv & 2) && !(right & 8)) edges.push([x + 1, y, x + 1, y + 1]);
      if ((cv & 4) && !(bot & 1)) edges.push([x + 1, y + 1, x, y + 1]);
      if ((cv & 8) && !(left & 2)) edges.push([x, y + 1, x, y]);
    }
  }
  const byStart = new Map();
  edges.forEach((e, i) => {
    const k = e[0] + ',' + e[1];
    if (!byStart.has(k)) byStart.set(k, []);
    byStart.get(k).push(i);
  });
  const used = new Uint8Array(edges.length);
  const loops = [];
  for (let i = 0; i < edges.length; i++) {
    if (used[i]) continue;
    const loop = [];
    let cur = i;
    let guard = 0;
    while (cur !== -1 && !used[cur] && guard++ < 100000) {
      used[cur] = 1;
      const e = edges[cur];
      loop.push([e[0], e[1]]);
      const cands = byStart.get(e[2] + ',' + e[3]) || [];
      let next = -1;
      // prefer the sharpest right turn to keep diagonal-touching regions separate
      let bestTurn = -Infinity;
      const dx = e[2] - e[0], dy = e[3] - e[1];
      for (const j of cands) {
        if (used[j]) continue;
        const f = edges[j];
        const fx = f[2] - f[0], fy = f[3] - f[1];
        const cross = dx * fy - dy * fx;
        const dot = dx * fx + dy * fy;
        const turn = Math.atan2(cross, dot);
        if (turn > bestTurn) { bestTurn = turn; next = j; }
      }
      cur = next;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

// Subdivide, displace with noise, and smooth a loop. Returns [{x,y,nx,ny}] in px.
function organicLoop(loop, seed, amp = 3.2) {
  const pts = [];
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const a = loop[i], b = loop[(i + 1) % n];
    const ax = a[0] * TILE, ay = a[1] * TILE, bx = b[0] * TILE, by = b[1] * TILE;
    const len = Math.hypot(bx - ax, by - ay);
    const segs = Math.max(1, Math.round(len / 8));
    for (let s = 0; s < segs; s++) {
      const t = s / segs;
      pts.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, dx: (bx - ax) / len, dy: (by - ay) / len });
    }
  }
  // displace along outward normal (dy, -dx)
  for (const p of pts) {
    const nx = p.dy, ny = -p.dx;
    const up = ny < -0.6; // top-facing surface: keep tight for gameplay readability
    const a = up ? amp * 0.35 : amp;
    const d = (noise2(p.x * 0.045, p.y * 0.045, seed) - 0.5) * 2 * a + (hash2(p.x | 0, p.y | 0, seed) - 0.5) * 0.8;
    p.x += nx * d; p.y += ny * d;
    p.nx = nx; p.ny = ny;
  }
  let cur = pts;
  for (let it = 0; it < 2; it++) {
    const out = [];
    for (let i = 0; i < cur.length; i++) {
      const p = cur[i], q = cur[(i + 1) % cur.length];
      out.push({ x: p.x * 0.75 + q.x * 0.25, y: p.y * 0.75 + q.y * 0.25, nx: p.nx, ny: p.ny });
      out.push({ x: p.x * 0.25 + q.x * 0.75, y: p.y * 0.25 + q.y * 0.75, nx: q.nx, ny: q.ny });
    }
    cur = out;
  }
  return cur;
}

function tracePath(ctx, loops, frame) {
  ctx.beginPath();
  if (frame) ctx.rect(-64, -64, frame.w + 128, frame.h + 128);
  for (const pts of loops) {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  }
}

export function renderTerrain(room, style) {
  const W = room.pxW, H = room.pxH;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const seed = hashStr(room.id);
  const R = rng(seed);
  const loops = extractLoops(room).map((l, i) => organicLoop(l, seed + i * 7));

  const frame = { w: W, h: H };
  // --- mass ---
  tracePath(ctx, loops, frame);
  ctx.fillStyle = style.rock;
  ctx.fill('evenodd');

  // --- inner texture (clipped) ---
  ctx.save();
  tracePath(ctx, loops, frame);
  ctx.clip('evenodd');
  // soft lighter band hugging the edges, darker deep inside
  ctx.lineJoin = 'round';
  tracePath(ctx, loops);
  ctx.strokeStyle = rgba(style.rockHi, 0.55);
  ctx.lineWidth = 34; ctx.stroke();
  tracePath(ctx, loops);
  ctx.strokeStyle = rgba(style.rockHi, 0.65);
  ctx.lineWidth = 14; ctx.stroke();
  // painterly blotches
  const blotches = Math.floor((W * H) / 9000);
  for (let i = 0; i < blotches; i++) {
    const x = R() * W, y = R() * H;
    if (room.shapeAt(Math.floor(x / TILE), Math.floor(y / TILE)) !== 1) continue;
    const r = 6 + R() * 26;
    ctx.fillStyle = rgba(R() < 0.5 ? style.rockHi : '#000000', 0.12 + R() * 0.12);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.4 + R() * 0.5), R() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // hairline cracks
  ctx.strokeStyle = rgba(style.rim, 0.12);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < blotches / 3; i++) {
    let x = R() * W, y = R() * H;
    if (room.shapeAt(Math.floor(x / TILE), Math.floor(y / TILE)) !== 1) continue;
    ctx.beginPath(); ctx.moveTo(x, y);
    let ang = R() * Math.PI * 2;
    for (let s = 0; s < 4; s++) {
      ang += (R() - 0.5) * 1.4;
      x += Math.cos(ang) * (6 + R() * 10); y += Math.sin(ang) * (6 + R() * 10);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // special materials
  for (let ty = 0; ty < room.h; ty++) {
    for (let tx = 0; tx < room.w; tx++) {
      const ch = room.grid[ty][tx];
      if (ch === 'M') drawMagnetTile(ctx, tx * TILE, ty * TILE, room, tx, ty);
      else if (ch === 'I') drawIceTile(ctx, tx * TILE, ty * TILE, R);
    }
  }
  ctx.restore();

  // --- pen hatching just inside the rock faces (hand-inked shading) ---
  ctx.save();
  tracePath(ctx, loops, frame);
  ctx.clip('evenodd');
  ctx.lineCap = 'round';
  for (const pts of loops) {
    for (let i = 0; i < pts.length; i += 2) {
      const p = pts[i];
      const h = hash2(p.x | 0, p.y | 0, seed + 11);
      if (h > 0.55) continue;
      // stroke points inward (opposite the outward normal), slanted, of varied length
      const len = 5 + h * 16;
      const ang = Math.atan2(-p.ny, -p.nx) + 0.55;
      const ox = p.x - p.nx * (2 + h * 3), oy = p.y - p.ny * (2 + h * 3);
      ctx.strokeStyle = rgba(style.rim, 0.10 + h * 0.22);
      ctx.lineWidth = 0.8 + h;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(ang) * len, oy + Math.sin(ang) * len); ctx.stroke();
      if (p.ny > 0.5 && h < 0.25) { // cross-hatch the undersides (deepest shadow)
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(ang - 1.1) * len * 0.8, oy + Math.sin(ang - 1.1) * len * 0.8); ctx.stroke();
      }
    }
  }
  // scattered pebbles and fossils drawn as little ink rings
  const pebbles = Math.floor((W * H) / 14000);
  for (let i = 0; i < pebbles; i++) {
    const x = R() * W, y = R() * H;
    if (room.shapeAt(Math.floor(x / TILE), Math.floor(y / TILE)) !== 1) continue;
    ctx.strokeStyle = rgba(style.rim, 0.10 + R() * 0.12); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, 2 + R() * 6, 1.5 + R() * 4, R() * 3, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();

  // --- brushed ink rim: varying pressure, dry-brush gaps, heavier on top surfaces ---
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  tracePath(ctx, loops);
  ctx.strokeStyle = rgba(style.rim, 0.22);
  ctx.lineWidth = 6; ctx.stroke();
  for (const pts of loops) {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const n = noise2(p.x * 0.03, p.y * 0.03, seed + 5);
      if (n < 0.16) continue; // dry-brush gap
      const top = p.ny < -0.6;
      ctx.strokeStyle = rgba(top ? style.accent : style.rim, top ? 0.9 : 0.75 + n * 0.25);
      ctx.lineWidth = (top ? 1.6 : 1.0) + n * (top ? 2.2 : 1.6);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
  }
  // a second, offset faint pass: the slightly-off retrace of a hand-drawn line
  ctx.strokeStyle = rgba(style.rim, 0.28); ctx.lineWidth = 0.9;
  for (const pts of loops) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[i];
      const j = (noise2(p.x * 0.05, p.y * 0.05, seed + 9) - 0.5) * 3;
      const x = p.x + p.nx * (1.5 + j), y = p.y + p.ny * (1.5 + j);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }

  // --- surface decorations ---
  for (const pts of loops) {
    for (let i = 0; i < pts.length; i += 3) {
      const p = pts[i];
      if (p.x < 0 || p.y < 0 || p.x > W || p.y > H) continue;
      const h = hash2(p.x | 0, p.y | 0, seed + 3);
      if (p.ny < -0.6) decorate(ctx, style.decorTop, 'top', p, h, style, R);
      else if (p.ny > 0.6) decorate(ctx, style.decorBottom, 'bottom', p, h, style, R);
      else if (h < 0.08) decorate(ctx, style.decorBottom === 'roots' ? 'roots' : 'side', 'side', p, h, style, R);
    }
  }

  // --- static tile props: one-ways, half blocks, spikes ---
  for (let ty = 0; ty < room.h; ty++) {
    for (let tx = 0; tx < room.w; tx++) {
      const ch = room.grid[ty][tx];
      const x = tx * TILE, y = ty * TILE;
      if (ch === '=') drawPlatform(ctx, x, y, room, tx, ty, style);
      else if (ch === 'H') drawHalfBlock(ctx, x, y, style, R);
      else if (ch === '^') drawSpikes(ctx, x, y, room, tx, ty, style, R);
    }
  }
  // brush-roughen the whole painting once (displaces edges so nothing is machine-smooth)
  const out = roughen(cv, 'url(#roughFine)');
  return { canvas: out, loops };
}

export function roughen(cv, filter) {
  try {
    if (typeof document === 'undefined' || !document.getElementById('roughFine')) return cv;
    const o = document.createElement('canvas');
    o.width = cv.width; o.height = cv.height;
    const c = o.getContext('2d');
    c.filter = filter;
    c.drawImage(cv, 0, 0);
    return o;
  } catch { return cv; }
}

// ------------------------------------------------------------------ hand-inked surface details
// Small brush helpers (local to the decorations): tapered strokes, leaves, inked blobs.
const TAU = Math.PI * 2;
const fr = (h, k) => { const v = Math.sin(h * 12.9898 * (k + 1) + k * 78.233) * 43758.5453; return v - Math.floor(v); };
function bzT(P, t) {
  const u = 1 - t;
  if (P.length === 4) return [P[0] * u + P[2] * t, P[1] * u + P[3] * t];
  if (P.length === 6) return [u * u * P[0] + 2 * u * t * P[2] + t * t * P[4], u * u * P[1] + 2 * u * t * P[3] + t * t * P[5]];
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * P[0] + b * P[2] + c * P[4] + d * P[6], a * P[1] + b * P[3] + c * P[5] + d * P[7]];
}
// tapered brush stroke along a bezier (w0 -> w1, plus optional mid-stroke belly)
function taper(ctx, P, w0, w1, color, belly = 0, n = 8) {
  const L = [], Rr = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = bzT(P, t);
    const q = bzT(P, Math.min(1, t + 0.03)), o = bzT(P, Math.max(0, t - 0.03));
    let dx = q[0] - o[0], dy = q[1] - o[1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const wd = (w0 + (w1 - w0) * t + belly * Math.sin(Math.PI * t)) * 0.5;
    L.push([p[0] - dy * wd, p[1] + dx * wd]); Rr.push([p[0] + dy * wd, p[1] - dx * wd]);
  }
  ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
  for (const q of L) ctx.lineTo(q[0], q[1]);
  for (let i = Rr.length - 1; i >= 0; i--) ctx.lineTo(Rr[i][0], Rr[i][1]);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
// an inked leaf: base (x,y), direction ang, length len, width wd
function leaf(ctx, x, y, ang, len, wd, fill, line, rib) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const P = (u, v) => [x + c * u - s * v, y + s * u + c * v];
  const a = P(len * 0.35, -wd), b = P(len * 0.8, -wd * 0.6), tip = P(len, 0), d = P(len * 0.8, wd * 0.5), e = P(len * 0.3, wd * 0.9);
  ctx.beginPath(); ctx.moveTo(x, y);
  ctx.bezierCurveTo(a[0], a[1], b[0], b[1], tip[0], tip[1]);
  ctx.bezierCurveTo(d[0], d[1], e[0], e[1], x, y);
  ctx.fillStyle = fill; ctx.fill();
  if (line) { ctx.strokeStyle = line; ctx.lineWidth = 0.9; ctx.stroke(); }
  if (rib) { const m = P(len * 0.85, -wd * 0.05); ctx.strokeStyle = rib; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(P(len * 0.5, -wd * 0.2)[0], P(len * 0.5, -wd * 0.2)[1], m[0], m[1]); ctx.stroke(); }
}
// a grass blade: dark tapered body with a pale catch-light on its lit edge
function blade(ctx, x, y, len, bend, wd, dark, lit, curl = 0) {
  const P = curl
    ? [x, y, x + bend * 0.2, y - len * 0.7, x + bend * 1.2, y - len * 1.05, x + bend + curl, y - len * 0.8]
    : [x, y, x + bend * 0.25, y - len * 0.6, x + bend, y - len];
  taper(ctx, P, wd, 0.15, dark, 0, 7);
  if (lit) {
    const Q = P.map((v, i) => (i % 2 ? v + 0.3 : v - wd * 0.28));
    taper(ctx, Q, wd * 0.35, 0.05, lit, 0, 6);
  }
}
const inkOf = (style) => mix(style.rock, '#000000', 0.45);
const midOf = (style) => mix(style.rock, style.rim, 0.28);

function decorate(ctx, kind, face, p, h, style, R) {
  const x = p.x, y = p.y;
  const dark = inkOf(style);
  switch (kind) {
    case 'moss': case 'leaves': case 'grass': case 'mushrooms': case 'snow': case 'lint': {
      if (face !== 'top') return;
      if (kind === 'mushrooms' && h < 0.07) return mushroom(ctx, x, y, h, style);
      if (kind === 'snow') {
        // a continuous lumpy snow cap with a cool shadow underneath and the odd glint
        ctx.fillStyle = rgba(mix(style.rim, style.rock, 0.4), 0.7);
        ctx.beginPath(); ctx.ellipse(x + 1, y + 1.2, 6 + h * 6, 2.6, 0, 0, Math.PI); ctx.fill();
        ctx.fillStyle = rgba(style.accent, 0.92);
        ctx.beginPath(); ctx.ellipse(x, y - 1 - h * 1.2, 6 + h * 6, 2.4 + h * 1.6, (h - 0.5) * 0.2, Math.PI, 0); ctx.lineTo(x - 6 - h * 6, y); ctx.fill();
        if (h < 0.1) { // a drift with a curled lip
          ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.quadraticCurveTo(x - 2, y - 9 - h * 30, x + 9, y - 3); ctx.quadraticCurveTo(x + 11, y - 1, x + 8, y); ctx.fill();
          ctx.strokeStyle = rgba(style.rim, 0.6); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x - 6, y - 3); ctx.quadraticCurveTo(x, y - 7 - h * 20, x + 7, y - 3); ctx.stroke();
        }
        if (h > 0.93) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 0.6, y - 4.5, 1.2, 3); ctx.fillRect(x - 1.5, y - 3.6, 3, 1.2); }
        return;
      }
      if (kind === 'moss') {
        // cushion of moss: scalloped lumps hugging the lip, plus spore stalks
        if (h > 0.85) return;
        const mc = mix(style.rock, style.rim, 0.35), lc = rgba(style.accent, 0.7);
        const n = 2 + Math.floor(h * 3);
        for (let i = 0; i < n; i++) {
          const bx = x + (i - n / 2) * 3.4 + fr(h, i) * 2, r = 2.2 + fr(h, i + 3) * 2.6;
          ctx.fillStyle = mc; ctx.beginPath(); ctx.arc(bx, y + 0.8, r, Math.PI, 0); ctx.fill();
          ctx.strokeStyle = lc; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(bx, y + 0.8, r, Math.PI * 1.15, Math.PI * 1.75); ctx.stroke();
        }
        if (h < 0.22) { // spore stalks / fronds
          const k = 1 + Math.floor(h * 14) % 3;
          for (let i = 0; i < k; i++) {
            const bx = x + (i - 1) * 3 + fr(h, i + 7) * 2, len = 6 + fr(h, i + 9) * 9, bend = (fr(h, i + 11) - 0.5) * 5;
            taper(ctx, [bx, y, bx + bend * 0.2, y - len * 0.6, bx + bend, y - len], 1.3, 0.4, dark);
            ctx.fillStyle = style.glow; ctx.beginPath(); ctx.arc(bx + bend, y - len - 0.6, 1.1, 0, TAU); ctx.fill();
          }
        }
        if (h < 0.04) blade(ctx, x + 2, y, 16 + h * 200, 6, 2.6, dark, rgba(style.rim, 0.8), -3);
        return;
      }
      if (kind === 'lint') {
        if (h > 0.6) return;
        // fuzz tufts: tiny bursts of fibre
        const n = 5 + Math.floor(h * 8), r = 2.5 + h * 5;
        ctx.strokeStyle = rgba(style.accent, 0.55); ctx.lineWidth = 0.8; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < n; i++) { const a = Math.PI + (i / (n - 1)) * Math.PI; ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a + 0.4) * r * 0.6, y + Math.sin(a + 0.4) * r * 0.6, x + Math.cos(a) * r * (0.7 + fr(h, i) * 0.6), y + Math.sin(a) * r * (0.7 + fr(h, i) * 0.6)); }
        ctx.stroke();
        return;
      }
      // grass / leaves: clumps of tapered blades, with the odd hero tuft
      if (h > 0.66) return;
      const leafy = kind === 'leaves';
      const lit = rgba(leafy ? style.accent : style.rim, 0.85);
      const hero = h < 0.05;
      const n = hero ? 7 : 2 + Math.floor(h * 6);
      for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) - 0.5 : 0;
        const bx = x + t * (hero ? 12 : 7) + (fr(h, i) - 0.5) * 2;
        const len = (hero ? 12 + fr(h, i + 2) * 16 : 4 + fr(h, i + 2) * (leafy ? 11 : 8)) * (1 - Math.abs(t) * 0.6);
        const bend = t * 6 + (fr(h, i + 5) - 0.5) * 6;
        const curl = hero && i % 3 === 1 ? (bend > 0 ? -3 : 3) : 0;
        blade(ctx, bx, y + 1, len, bend, hero ? 2.4 : 1.8, dark, lit, curl);
      }
      if (leafy && h < 0.2) {
        const fill = mix(style.rock, style.accent, 0.3);
        leaf(ctx, x + 1, y, -0.6 - h * 3, 9 + h * 30, 3 + h * 6, fill, rgba(style.accent, 0.7), rgba(style.accent, 0.5));
        if (h < 0.1) leaf(ctx, x - 1, y, -2.4 + h * 3, 7 + h * 30, 2.6 + h * 5, mix(fill, '#000000', 0.25), rgba(style.accent, 0.5), rgba(style.accent, 0.35));
      }
      if (hero && kind === 'grass') { // seed head
        ctx.fillStyle = lit; ctx.beginPath(); ctx.ellipse(x + 5, y - 22 - h * 100, 1.6, 3.4, 0.4, 0, TAU); ctx.fill();
      }
      return;
    }
    case 'threads': {
      if (face === 'top' && h < 0.25) {
        // a loose thread standing up in a lazy curl, sometimes a knot
        const ht = 10 + h * 50;
        taper(ctx, [x, y, x + 6, y - ht * 0.45, x - 6, y - ht * 0.75, x + 2 + h * 8, y - ht], 1.4, 0.3, rgba(style.accent, 0.55), 0, 10);
        if (h < 0.08) { ctx.strokeStyle = rgba(style.accent, 0.6); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(x + 2 + h * 8, y - ht - 2, 2, 0, TAU); ctx.stroke(); }
      } else if (face !== 'top' && h < 0.22) {
        hangThread(ctx, x, y, 14 + h * 120, style, h);
      }
      return;
    }
    case 'roots': case 'vines': {
      if (h > (kind === 'vines' ? 0.3 : 0.2)) return;
      const len = 10 + h * 160;
      const col = mix(style.rock, style.rim, 0.22);
      if (face === 'side') {
        // a little rootlet poking from the wall, curling down
        const ex = x + p.nx * (8 + h * 40), ey = y + 10 + len * 0.25;
        taper(ctx, [x - p.nx * 2, y, x + p.nx * 10, y + 2, ex, ey - 4, ex - p.nx * 3, ey], 3, 0.3, col, 0, 9);
        return;
      }
      const sway = (h - 0.1) * 30;
      const P = [x, y - 1, x + 7, y + len * 0.3, x - 6, y + len * 0.65, x + sway, y + len];
      taper(ctx, P, kind === 'vines' ? 2.6 : 4 + h * 10, 0.3, col, 0, 12);
      // lit edge
      taper(ctx, P.map((v, i) => (i % 2 ? v : v - 1)), 0.9, 0.05, rgba(style.rim, 0.45), 0, 10);
      if (kind === 'roots') {
        // branching rootlets
        for (let k = 1; k <= 2; k++) {
          const q = bzT(P, 0.25 + k * 0.25), s = k % 2 ? 1 : -1;
          taper(ctx, [q[0], q[1], q[0] + s * 6, q[1] + 3, q[0] + s * (8 + h * 20), q[1] + 8 + h * 20], 1.6, 0.2, col, 0, 6);
        }
        if (h < 0.05) { const q = bzT(P, 1); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q[0] + 2, q[1] - 2, 2.5, Math.PI * 0.5, Math.PI * 2.1); ctx.stroke(); }
      } else {
        const fill = mix(style.rock, style.accent, 0.32);
        for (let k = 1; k < 5; k++) {
          const q = bzT(P, k / 5), s = k % 2 ? 1 : -1;
          leaf(ctx, q[0], q[1], s > 0 ? 0.5 : Math.PI - 0.5, 6 + fr(h, k) * 5, 2.2 + fr(h, k + 1) * 1.5, fill, rgba(style.accent, 0.55), rgba(style.accent, 0.4));
        }
        if (h < 0.06) { const q = bzT(P, 1); ctx.fillStyle = style.glow; ctx.beginPath(); ctx.arc(q[0], q[1] + 2, 2.4, 0, TAU); ctx.fill(); }
      }
      return;
    }
    case 'drips': case 'wax': case 'slag': case 'icicles': {
      if (face === 'top') return;
      if (h > 0.25) return;
      const len = 6 + h * 70, wd = 3 + h * 6;
      if (kind === 'wax') {
        // a thick wax run with a rounded bead at the end
        const wc = '#e3d2a6';
        ctx.fillStyle = wc;
        ctx.beginPath(); ctx.moveTo(x - wd, y - 1); ctx.quadraticCurveTo(x - wd * 0.4, y + len * 0.3, x - wd * 0.35, y + len * 0.8);
        ctx.arc(x, y + len * 0.8, wd * 0.38, Math.PI, 0, true); ctx.quadraticCurveTo(x + wd * 0.5, y + len * 0.3, x + wd, y - 1); ctx.fill();
        ctx.strokeStyle = 'rgba(80,55,30,0.75)'; ctx.lineWidth = 1; ctx.stroke();
        taper(ctx, [x - wd * 0.5, y + 1, x - wd * 0.3, y + len * 0.4, x - wd * 0.1, y + len * 0.75], 1.4, 0.4, 'rgba(255,250,230,0.7)', 0, 6);
        return;
      }
      if (kind === 'icicles') {
        const ic = rgba(style.accent, 0.7);
        ctx.fillStyle = ic; ctx.beginPath(); ctx.moveTo(x - wd, y - 1);
        ctx.quadraticCurveTo(x - wd * 0.4, y + len * 0.5, x + (h - 0.12) * 6, y + len); ctx.quadraticCurveTo(x + wd * 0.3, y + len * 0.4, x + wd, y - 1); ctx.fill();
        ctx.strokeStyle = rgba(style.rim, 0.9); ctx.lineWidth = 0.9; ctx.stroke();
        taper(ctx, [x - wd * 0.45, y + 1, x - wd * 0.2, y + len * 0.5, x + (h - 0.12) * 5, y + len * 0.9], 1.2, 0.2, 'rgba(255,255,255,0.75)', 0, 6);
        return;
      }
      // drips & slag: a tapered stalactite with a hanging droplet
      const body = kind === 'slag' ? dark : midOf(style);
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.moveTo(x - wd, y - 1);
      ctx.quadraticCurveTo(x - 1, y + len * 0.55, x, y + len);
      ctx.quadraticCurveTo(x + 1, y + len * 0.55, x + wd, y - 1); ctx.fill();
      taper(ctx, [x - wd * 0.6, y, x - 1.5, y + len * 0.5, x - 0.2, y + len * 0.95], 1, 0.1, rgba(kind === 'slag' ? style.accent : style.rim, 0.7), 0, 6);
      if (h < 0.12) {
        const dc = kind === 'slag' ? style.glow : style.accent;
        ctx.fillStyle = rgba(dc, kind === 'slag' ? 0.95 : 0.65);
        ctx.beginPath(); ctx.moveTo(x, y + len + 2); ctx.quadraticCurveTo(x + 2.2, y + len + 5.5, x, y + len + 6.5); ctx.quadraticCurveTo(x - 2.2, y + len + 5.5, x, y + len + 2); ctx.fill();
      }
      if (kind === 'slag') { ctx.fillStyle = rgba(style.accent, 0.85); ctx.beginPath(); ctx.ellipse(x, y + len * 0.85, 1.2, len * 0.15, 0, 0, TAU); ctx.fill(); }
      return;
    }
    case 'candles': {
      if (face === 'top' && h < 0.06) return candle(ctx, x, y, h, style);
      if (face === 'top' && h < 0.4) {
        // wax puddle with an inked lip
        ctx.fillStyle = rgba('#e3d2a6', 0.5);
        ctx.beginPath(); ctx.ellipse(x, y, 5 + h * 6, 1.8, 0, Math.PI, 0); ctx.fill();
        if (h < 0.14) { ctx.fillStyle = 'rgba(227,210,166,0.8)'; ctx.beginPath(); ctx.ellipse(x + 2, y - 1.5, 1.6, 1.4, 0, 0, TAU); ctx.fill(); }
      }
      if (face !== 'top' && h < 0.2) decorate(ctx, 'wax', face, p, h, style, R);
      return;
    }
    case 'crystals': case 'glass': {
      if (h > 0.12) return;
      const dir = face === 'top' ? -1 : face === 'bottom' ? 1 : 0;
      const n = 1 + Math.floor(h * 30) % 3 + (h < 0.03 ? 2 : 0);
      for (let i = 0; i < n; i++) {
        const len = (8 + fr(h, i) * 22) * (i === 0 && h < 0.03 ? 1.6 : 1);
        const ang = (dir === 0 ? Math.atan2(p.ny, p.nx) : dir * Math.PI / 2) + (i - (n - 1) / 2) * 0.38;
        const tx = x + Math.cos(ang) * len, ty = y + Math.sin(ang) * len;
        const hw = 3 + len * 0.12;
        const px = -Math.sin(ang) * hw, py = Math.cos(ang) * hw;
        const sx = x + Math.cos(ang) * len * 0.75, sy = y + Math.sin(ang) * len * 0.75;
        // shard body (shadow plane), then the lit facet
        ctx.fillStyle = mix(style.rock, style.accent, 0.35);
        ctx.beginPath(); ctx.moveTo(x + px, y + py); ctx.lineTo(sx + px * 0.8, sy + py * 0.8); ctx.lineTo(tx, ty); ctx.lineTo(sx - px * 0.8, sy - py * 0.8); ctx.lineTo(x - px, y - py); ctx.closePath(); ctx.fill();
        ctx.fillStyle = rgba(style.accent, 0.75);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(sx + px * 0.8, sy + py * 0.8); ctx.lineTo(tx, ty); ctx.lineTo(sx, sy); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = rgba(style.glow, 0.9); ctx.lineWidth = 1; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(x + px, y + py); ctx.lineTo(sx + px * 0.8, sy + py * 0.8); ctx.lineTo(tx, ty); ctx.lineTo(sx - px * 0.8, sy - py * 0.8); ctx.lineTo(x - px, y - py); ctx.stroke();
      }
      return;
    }
    case 'eggs': {
      if (face === 'top' && h < 0.08) {
        // a clutch of glossy eggs glued together with silk
        const n = 3 + Math.floor(h * 40) % 3;
        for (let i = 0; i < n; i++) {
          const ex = x + (i - (n - 1) / 2) * 5.5 + (fr(h, i) - 0.5) * 2, ry = 3.8 + fr(h, i + 1) * 2.2, ey = y - ry + 0.5 - (i % 2) * 1.5;
          ctx.fillStyle = mix(style.rock, style.accent, 0.55); ctx.beginPath(); ctx.ellipse(ex, ey, ry * 0.72, ry, (fr(h, i + 2) - 0.5) * 0.5, 0, TAU); ctx.fill();
          ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = rgba(style.glow, 0.8); ctx.beginPath(); ctx.ellipse(ex - ry * 0.25, ey - ry * 0.4, 0.9, 1.5, -0.4, 0, TAU); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(230,235,210,0.35)'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.quadraticCurveTo(x, y - 9, x + 10, y); ctx.stroke();
      } else if (face === 'top' && h < 0.3) {
        blade(ctx, x, y + 1, 4 + h * 14, (h - 0.2) * 20, 1.6, dark, rgba(style.rim, 0.6));
      }
      return;
    }
    case 'webs': {
      if (face !== 'top' && h < 0.05) {
        // radial spokes with sagging capture spiral
        const spokes = [];
        for (let i = 0; i < 6; i++) { const a = 0.2 + i * 0.55; spokes.push([Math.cos(a), Math.sin(a)]); }
        ctx.strokeStyle = 'rgba(225,232,205,0.28)'; ctx.lineWidth = 0.9;
        for (const [cx, cy] of spokes) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cx * 46, y + cy * 46); ctx.stroke(); }
        ctx.lineWidth = 0.7;
        for (let r = 9; r < 44; r += 7 + (r % 3)) {
          ctx.beginPath();
          for (let i = 0; i < spokes.length - 1; i++) {
            const [ax, ay] = spokes[i], [bx, by] = spokes[i + 1];
            const mx = (ax + bx) / 2, my = (ay + by) / 2;
            if (!i) ctx.moveTo(x + ax * r, y + ay * r);
            ctx.quadraticCurveTo(x + mx * r * 0.82, y + my * r * 0.82 + 2, x + bx * r, y + by * r);
          }
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(240,245,220,0.6)'; ctx.beginPath(); ctx.arc(x + 14, y + 22, 1.2, 0, TAU); ctx.fill();
      } else if (face !== 'top' && h < 0.25) hangThread(ctx, x, y, 10 + h * 80, style, h);
      return;
    }
    case 'books': {
      if (face === 'top' && h < 0.12) {
        const cols = [style.accent, style.rim, '#9a4a4a', '#4a6a9a', '#6a7a4a'];
        let bx = x - 9;
        const n = 3 + Math.floor(h * 30) % 2;
        for (let i = 0; i < n; i++) {
          const bh = 8 + fr(h, i) * 9, bw = 3.5 + fr(h, i + 3) * 2;
          const lean = i === n - 1 ? 0.35 : 0;
          ctx.save(); ctx.translate(bx, y); ctx.rotate(lean);
          ctx.fillStyle = mix(cols[(i + Math.floor(h * 40)) % 5], style.rock, 0.3);
          ctx.fillRect(0, -bh, bw, bh);
          ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.strokeRect(0, -bh, bw, bh);
          ctx.fillStyle = rgba(style.glow, 0.45); ctx.fillRect(0.6, -bh * 0.75, bw - 1.2, 0.9); ctx.fillRect(0.6, -bh * 0.3, bw - 1.2, 0.9);
          ctx.restore();
          bx += bw + 0.6;
        }
        if (h < 0.04) { // a book lying flat on top
          ctx.fillStyle = mix('#8a5a3a', style.rock, 0.3); ctx.fillRect(x - 10, y - 3.5, 13, 3.5);
          ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.strokeRect(x - 10, y - 3.5, 13, 3.5);
          ctx.fillStyle = rgba('#efe6cf', 0.7); ctx.fillRect(x - 9.4, y - 2.6, 11, 1.6);
        }
      } else if (face !== 'top' && h < 0.15) hangThread(ctx, x, y, 12 + h * 100, style, h);
      return;
    }
    case 'tiles': case 'bolts': case 'pipes': case 'barnacles': {
      if (face === 'top' && kind === 'tiles' && h < 0.6) {
        // overlapping roof-tile scallops, some chipped
        const tc = mix(style.rock, style.rim, 0.3), r = 3.6 + fr(h, 1) * 1.2;
        ctx.fillStyle = tc; ctx.beginPath(); ctx.arc(x, y + 2, r, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = rgba(style.rim, 0.65); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(x, y + 2, r, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
        if (h < 0.08) { ctx.strokeStyle = dark; ctx.beginPath(); ctx.moveTo(x - 1, y - 1); ctx.lineTo(x + 1, y + 2); ctx.stroke(); }
      } else if (kind === 'bolts' && h < 0.08) {
        const bx = x - p.nx * 7, by = y - p.ny * 7;
        ctx.fillStyle = mix(style.rock, style.accent, 0.4); ctx.beginPath(); ctx.arc(bx, by, 2.6, 0, TAU); ctx.fill();
        ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = rgba(style.glow, 0.85); ctx.beginPath(); ctx.arc(bx - 0.8, by - 0.8, 0.9, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba(dark, 0.9); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(bx - 1.6, by + 1.2); ctx.lineTo(bx + 1.6, by - 1.2); ctx.stroke();
      } else if (kind === 'pipes' && face === 'bottom' && h < 0.04) {
        const len = 20 + h * 400, pc = mix(style.rock, style.rim, 0.3);
        ctx.fillStyle = pc; ctx.fillRect(x - 3, y - 1, 6, len);
        ctx.fillStyle = rgba(style.accent, 0.55); ctx.fillRect(x - 2, y, 1.2, len);
        ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.strokeRect(x - 3, y - 1, 6, len);
        for (let k = 10; k < len - 2; k += 18 + h * 100) { ctx.fillStyle = pc; ctx.fillRect(x - 4.5, y + k, 9, 3.2); ctx.strokeRect(x - 4.5, y + k, 9, 3.2); }
        ctx.fillStyle = rgba(style.accent, 0.8); ctx.beginPath(); ctx.moveTo(x, y + len + 3); ctx.quadraticCurveTo(x + 2, y + len + 6, x, y + len + 7); ctx.quadraticCurveTo(x - 2, y + len + 6, x, y + len + 3); ctx.fill();
      } else if (kind === 'barnacles' && h < 0.2) {
        // little volcano-shaped barnacles, clustered
        const n = 1 + Math.floor(h * 20) % 3;
        for (let i = 0; i < n; i++) {
          const s = 2.2 + fr(h, i) * (4 + h * 12);
          const bx = x + (i - (n - 1) / 2) * s * 1.3 - p.nx * 0.5, by = y - p.ny * 0.5;
          const ux = p.nx, uy = p.ny; // outward
          const c = mix(style.rock, style.rim, 0.35);
          ctx.fillStyle = c; ctx.beginPath();
          ctx.moveTo(bx - uy * s, by + ux * s);
          ctx.lineTo(bx + ux * s * 1.2 - uy * s * 0.45, by + uy * s * 1.2 + ux * s * 0.45);
          ctx.lineTo(bx + ux * s * 1.2 + uy * s * 0.45, by + uy * s * 1.2 - ux * s * 0.45);
          ctx.lineTo(bx + uy * s, by - ux * s); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = rgba(style.rim, 0.7); ctx.lineWidth = 0.9; ctx.stroke();
          ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(bx + ux * s * 1.2, by + uy * s * 1.2, s * 0.4, s * 0.2, Math.atan2(uy, ux) + Math.PI / 2, 0, TAU); ctx.fill();
        }
      } else if (face === 'bottom' && h < 0.12) decorate(ctx, 'drips', face, p, h, style, R);
      return;
    }
    case 'side': return;
    default: return decorate(ctx, 'moss', face, p, h, style, R);
  }
}

function hangThread(ctx, x, y, len, style, h) {
  const ex = x + (h - 0.1) * 20, ey = y + len;
  taper(ctx, [x, y, x + 5, y + len * 0.4, x - 5, y + len * 0.7, ex, ey], 1.5, 0.6, rgba(style.accent, 0.42), 0, 12);
  if (h < 0.06) { // a little knot partway down
    const q = bzT([x, y, x + 5, y + len * 0.4, x - 5, y + len * 0.7, ex, ey], 0.45);
    ctx.strokeStyle = rgba(style.accent, 0.55); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(q[0], q[1], 1.8, 2.4, 0.5, 0, TAU); ctx.stroke();
  }
  // a bead/bobbin at the end, inked
  const r = 1.6 + h * 6;
  ctx.fillStyle = rgba(style.accent, 0.6); ctx.beginPath(); ctx.arc(ex, ey + r * 0.6, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(mix(style.rock, '#000000', 0.4), 0.9); ctx.lineWidth = 0.9; ctx.stroke();
  ctx.fillStyle = rgba(style.glow, 0.7); ctx.beginPath(); ctx.arc(ex - r * 0.3, ey + r * 0.25, r * 0.3, 0, TAU); ctx.fill();
}

function mushroom(ctx, x, y, h, style) {
  // a little cluster: one tall cap and one or two small ones, inked and glowing-spotted
  const dark = inkOf(style);
  const caps = [[0, 6 + h * 120, 0], [-5 - h * 30, 4 + h * 50, -0.25], [5 + h * 20, 3 + h * 30, 0.3]].slice(0, 2 + (h < 0.03 ? 1 : 0));
  for (const [dx, s, lean] of caps.slice().reverse()) {
    const bx = x + dx, tx = bx + lean * s, ty = y - s;
    taper(ctx, [bx, y + 1, bx + lean * s * 0.3, y - s * 0.5, tx, ty], Math.max(2, s * 0.22), Math.max(1.6, s * 0.16), mix(style.rock, style.rim, 0.45), 0, 6);
    const cw = s * 0.7, ch = s * 0.42;
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(lean * 0.6);
    ctx.fillStyle = mix(style.rock, style.rim, 0.2);
    ctx.beginPath(); ctx.ellipse(0, 0, cw * 0.9, ch * 0.2, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = mix(style.rock, style.accent, 0.6);
    ctx.beginPath(); ctx.moveTo(-cw, 1); ctx.bezierCurveTo(-cw, -ch * 1.3, cw, -ch * 1.3, cw, 1); ctx.quadraticCurveTo(0, -ch * 0.15, -cw, 1); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.9, s * 0.06); ctx.stroke();
    ctx.fillStyle = rgba(style.glow, 0.8);
    for (const [u, v, r] of [[-0.4, -0.6, 0.11], [0.2, -0.75, 0.08], [0.5, -0.4, 0.07]]) { ctx.beginPath(); ctx.arc(cw * u, ch * v, Math.max(0.8, cw * r), 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // soft spore glow
  const s0 = caps[0][1];
  const g = ctx.createRadialGradient(x, y - s0, 0, x, y - s0, s0 * 1.4);
  g.addColorStop(0, rgba(style.glow, 0.22)); g.addColorStop(1, rgba(style.glow, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - s0, s0 * 1.4, 0, TAU); ctx.fill();
}

function candle(ctx, x, y, h, style) {
  // one to three candles of different heights, drippy, inked, with a two-tone flame
  const n = 1 + Math.floor(h * 50) % 3;
  const dark = inkOf(style);
  for (let i = n - 1; i >= 0; i--) {
    const ch = (8 + h * 200) * (1 - i * 0.3), cx = x + (i ? (i % 2 ? -1 : 1) * (5 + i) : 0), cw = 2.6 - i * 0.3;
    const wax = i ? '#d8c69a' : '#e8d6aa';
    ctx.fillStyle = wax;
    ctx.beginPath(); ctx.moveTo(cx - cw, y + 1); ctx.lineTo(cx - cw, y - ch + 1.5); ctx.quadraticCurveTo(cx, y - ch - 1, cx + cw, y - ch + 1); ctx.lineTo(cx + cw, y + 1); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 0.9; ctx.stroke();
    // drip down the side
    ctx.fillStyle = '#f4e8c4'; ctx.beginPath(); ctx.moveTo(cx + cw * 0.2, y - ch + 1); ctx.quadraticCurveTo(cx + cw * 0.9, y - ch * 0.6, cx + cw * 0.5, y - ch * 0.5); ctx.quadraticCurveTo(cx + cw * 0.1, y - ch * 0.6, cx + cw * 0.2, y - ch + 1); ctx.fill();
    ctx.fillStyle = 'rgba(80,55,30,0.35)'; ctx.fillRect(cx + cw * 0.35, y - ch + 2, cw * 0.6, ch - 1);
    const fy = y - ch - 1;
    ctx.strokeStyle = dark; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(cx, fy + 1); ctx.lineTo(cx + 0.3, fy - 1.5); ctx.stroke();
    const g = ctx.createRadialGradient(cx, fy - 4, 0, cx, fy - 4, 22);
    g.addColorStop(0, rgba(style.glow, 0.4)); g.addColorStop(1, rgba(style.glow, 0));
    ctx.fillStyle = g; ctx.fillRect(cx - 22, fy - 26, 44, 44);
    ctx.fillStyle = style.accent;
    ctx.beginPath(); ctx.moveTo(cx - 2, fy - 1); ctx.quadraticCurveTo(cx - 2, fy - 5, cx + 0.5, fy - 9); ctx.quadraticCurveTo(cx + 2.4, fy - 4, cx + 2, fy - 1); ctx.quadraticCurveTo(cx, fy + 0.6, cx - 2, fy - 1); ctx.fill();
    ctx.fillStyle = '#fff6dc';
    ctx.beginPath(); ctx.ellipse(cx + 0.1, fy - 3, 0.9, 2, 0, 0, TAU); ctx.fill();
  }
  // wax puddle at the base
  ctx.fillStyle = '#e3d2a6'; ctx.beginPath(); ctx.ellipse(x, y + 0.5, 6 + n * 3, 1.6, 0, Math.PI, 0); ctx.fill();
}

function drawPlatform(ctx, x, y, room, tx, ty, style) {
  // an inked plank: lit top lip, darker underside, wood grain, chipped ends, pegged struts
  const l = room.charAt(tx - 1, ty) !== '=', r = room.charAt(tx + 1, ty) !== '=';
  const hs = hash2(tx, ty, 77);
  const top = (u) => y + 0.3 + Math.sin(u * 0.35 + hs * 6) * 0.4;
  const bot = (u) => y + 8.5 + Math.sin(u * 0.21 + hs * 9) * 0.8;
  const x0 = x - (l ? -1 : 1), x1 = x + TILE + (r ? -1 : 1);
  ctx.beginPath();
  ctx.moveTo(x0, top(0));
  for (let u = 4; u <= TILE; u += 4) ctx.lineTo(x + Math.min(u, x1 - x), top(u));
  if (r) { ctx.lineTo(x1 + 0.5, y + 3); ctx.lineTo(x1 - 1.5, y + 5.5); ctx.lineTo(x1, bot(TILE)); }
  for (let u = TILE; u >= 0; u -= 4) ctx.lineTo(x + Math.max(u, x0 - x), bot(u));
  if (l) { ctx.lineTo(x0 + 1.5, y + 5); ctx.lineTo(x0 - 0.5, y + 2.5); }
  ctx.closePath();
  ctx.fillStyle = mix(style.rock, style.rockHi, 0.75); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = rgba('#000000', 0.35); ctx.fillRect(x - 2, y + 5.5, TILE + 4, 5);
  ctx.strokeStyle = rgba(style.rim, 0.22); ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x, y + 3.6 + hs); ctx.quadraticCurveTo(x + TILE * 0.5, y + 2.8 + hs * 2, x + TILE, y + 4 + hs); ctx.stroke();
  if (hs < 0.4) { ctx.beginPath(); ctx.ellipse(x + 8 + hs * 30, y + 4.5, 2.4, 1, 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(mix(style.rock, '#000000', 0.5), 0.95); ctx.lineWidth = 1.6; ctx.stroke();
  // lit top edge: a brush line that thickens and thins
  for (let u = 0; u < TILE; u += 4) {
    const k = Math.sin((u + hs * 40) * 0.2) * 0.5 + 0.5;
    ctx.strokeStyle = rgba(style.rim, 0.75 + k * 0.25); ctx.lineWidth = 1.1 + k * 1.3;
    ctx.beginPath(); ctx.moveTo(x + u, top(u) + 0.6); ctx.lineTo(x + u + 4, top(u + 4) + 0.6); ctx.stroke();
  }
  // seam between planks
  if (!l && hs < 0.5) { ctx.strokeStyle = rgba('#000000', 0.55); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 0.5, y + 1.5); ctx.lineTo(x + 1, y + 8); ctx.stroke(); }
  // pegged support struts at platform ends
  const sc = rgba(mix(style.rock, style.rim, 0.35), 0.85);
  for (const [end, sx, dir] of [[l, x + 5, 1], [r, x + TILE - 5, -1]]) {
    if (!end) continue;
    taper(ctx, [sx, y + 8, sx + dir * 3, y + 15, sx + dir * 7, y + 24], 3, 1.2, sc, 0, 6);
    ctx.fillStyle = rgba(style.rim, 0.7); ctx.beginPath(); ctx.arc(sx, y + 4.5, 1.2, 0, TAU); ctx.fill();
  }
}

function drawHalfBlock(ctx, x, y, style, R) {
  const hs = hash2(x | 0, y | 0, 31);
  const yb = y + TILE / 2;
  ctx.beginPath();
  ctx.moveTo(x - 0.5, y + 1);
  ctx.quadraticCurveTo(x + TILE / 2, y - 0.6, x + TILE + 0.5, y + 1);
  ctx.lineTo(x + TILE + 0.5, yb - 2);
  for (let u = TILE; u >= 0; u -= 6) ctx.lineTo(x + u, yb + Math.sin(u * 0.4 + hs * 9) * 1.2 + (u % 12 === 0 ? 1 : 0));
  ctx.lineTo(x - 0.5, yb - 2);
  ctx.closePath();
  ctx.fillStyle = style.rock; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = rgba(style.rockHi, 0.8); ctx.fillRect(x - 1, y, TILE + 2, 4);
  ctx.strokeStyle = rgba(style.rim, 0.18); ctx.lineWidth = 0.8;
  for (let k = 0; k < 5; k++) { const hx = x + 4 + k * 6 + hs * 3; ctx.beginPath(); ctx.moveTo(hx, yb - 1); ctx.lineTo(hx + 4, yb - 7); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = rgba(mix(style.rock, '#000000', 0.5), 0.9); ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.strokeStyle = rgba(style.rim, 0.85); ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.quadraticCurveTo(x + TILE / 2, y - 0.5, x + TILE, y + 1); ctx.stroke();
  ctx.strokeStyle = rgba(style.rim, 0.45); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 2, yb + 0.5); ctx.lineTo(x + TILE - 2, yb + 0.5); ctx.stroke();
}

function drawSpikes(ctx, x, y, room, tx, ty, style, R) {
  // orientation: point away from the adjacent solid
  const solid = (dx, dy) => room.shapeAt(tx + dx, ty + dy) === 1;
  let ang = -Math.PI / 2; // up
  if (solid(0, 1)) ang = -Math.PI / 2;
  else if (solid(0, -1)) ang = Math.PI / 2;
  else if (solid(-1, 0)) ang = 0;
  else if (solid(1, 0)) ang = Math.PI;
  ctx.save();
  ctx.translate(x + TILE / 2, y + TILE / 2);
  ctx.rotate(ang + Math.PI / 2);
  // hooked thorns point toward -y, base at +TILE/2; a tangle of bramble at the root
  const B = TILE / 2 + 2;
  const thorns = [];
  for (let i = 0; i < 3; i++) {
    const bx = -TILE / 2 + (i + 0.5) * (TILE / 3) + (R() - 0.5) * 3;
    thorns.push({ bx, hgt: (i === 1 ? 22 : 17) + R() * 9, lean: (R() - 0.5) * 7, half: 5.5 + R() * 2 });
  }
  const tr = (t, k = 1) => {
    ctx.moveTo(t.bx - t.half * k, B);
    ctx.bezierCurveTo(t.bx - t.half * 0.5 * k, B - t.hgt * 0.4, t.bx + t.lean * 0.4 - 1, B - t.hgt * 0.8, t.bx + t.lean, B - t.hgt);
    ctx.bezierCurveTo(t.bx + t.lean * 0.3 + 1.2, B - t.hgt * 0.7, t.bx + t.half * 0.3 * k, B - t.hgt * 0.35, t.bx + t.half * k, B);
    ctx.closePath();
  };
  for (const t of thorns) {
    ctx.beginPath(); tr(t);
    ctx.fillStyle = '#0b0a10'; ctx.fill();
    ctx.strokeStyle = rgba(mix(style.rim, '#000000', 0.25), 0.95); ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke();
    // lit edge: tapered pale stroke along the left flank to the tip
    const P = [t.bx - t.half * 0.55, B - 2, t.bx - t.half * 0.35, B - t.hgt * 0.45, t.bx + t.lean * 0.95, B - t.hgt + 0.8];
    taper(ctx, P, 1.8, 0.4, rgba(style.accent, 0.75), 0, 6);
    // a barb on the flank
    const q = bzT(P, 0.45), s = t.lean > 0 ? -1 : 1;
    ctx.fillStyle = '#0b0a10'; ctx.beginPath(); ctx.moveTo(q[0] + 0.5, q[1] + 2); ctx.lineTo(q[0] + s * -4 - 1, q[1] - 3); ctx.lineTo(q[0] + 1.5, q[1] - 1); ctx.fill();
  }
  // bramble root
  ctx.fillStyle = '#0b0a10';
  ctx.beginPath(); ctx.ellipse(0, B, TILE / 2 + 1, 3.5, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = rgba(style.rim, 0.5); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-TILE / 2, B - 1); ctx.quadraticCurveTo(-4, B - 5, 4, B - 2.5); ctx.quadraticCurveTo(10, B - 1, TILE / 2, B - 3); ctx.stroke();
  ctx.restore();
}

function drawMagnetTile(ctx, x, y, room, tx, ty) {
  // a riveted lodestone plate: rusty iron with an inked bevel and a painted horseshoe sigil
  ctx.fillStyle = 'rgba(120,62,34,0.7)'; ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = 'rgba(170,92,48,0.45)'; ctx.fillRect(x + 2, y + 2, TILE - 4, 4);
  ctx.fillStyle = 'rgba(30,12,8,0.45)'; ctx.fillRect(x + 2, y + TILE - 6, TILE - 4, 4);
  ctx.strokeStyle = 'rgba(25,12,8,0.85)'; ctx.lineWidth = 1.4; ctx.strokeRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
  ctx.strokeStyle = 'rgba(255,170,90,0.55)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(x + 3, y + TILE - 3); ctx.lineTo(x + 3, y + 3); ctx.lineTo(x + TILE - 3, y + 3); ctx.stroke();
  for (const [ox, oy] of [[6, 6], [TILE - 6, 6], [6, TILE - 6], [TILE - 6, TILE - 6]]) {
    ctx.fillStyle = 'rgba(60,28,14,0.9)'; ctx.beginPath(); ctx.arc(x + ox + 0.5, y + oy + 0.5, 2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,205,150,0.85)'; ctx.beginPath(); ctx.arc(x + ox - 0.3, y + oy - 0.3, 1.1, 0, TAU); ctx.fill();
  }
  // horseshoe glyph with tapered arms
  const cx = x + TILE / 2, cy = y + TILE / 2 - 2;
  ctx.strokeStyle = 'rgba(255,120,80,0.75)'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0.05, Math.PI - 0.05); ctx.stroke();
  ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(cx - 5.5, cy); ctx.lineTo(cx - 5.5, cy - 3); ctx.moveTo(cx + 5.5, cy); ctx.lineTo(cx + 5.5, cy - 3); ctx.stroke();
  ctx.strokeStyle = 'rgba(240,235,220,0.75)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 5.5, cy - 3); ctx.lineTo(cx - 5.5, cy - 5); ctx.moveTo(cx + 5.5, cy - 3); ctx.lineTo(cx + 5.5, cy - 5); ctx.stroke();
}

function drawIceTile(ctx, x, y, R) {
  // frosted ice: cool fill, a lit facet, inked crack lines and rime specks
  ctx.fillStyle = 'rgba(150,210,245,0.3)'; ctx.fillRect(x, y, TILE, TILE);
  const a = R(), b = R(), c = R();
  ctx.fillStyle = 'rgba(235,250,255,0.18)';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 10 + a * 14, y); ctx.lineTo(x, y + 12 + b * 12); ctx.fill();
  ctx.strokeStyle = 'rgba(20,40,60,0.45)'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
  const sx = x + 4 + a * 10, sy = y + 3;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 4 + b * 4, sy + 10); ctx.lineTo(sx + 2 + c * 8, sy + 20); ctx.lineTo(sx + 6 + a * 6, y + TILE - 3);
  ctx.moveTo(sx + 4 + b * 4, sy + 10); ctx.lineTo(sx + 12 + c * 6, sy + 13); ctx.stroke();
  ctx.strokeStyle = 'rgba(230,250,255,0.6)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(sx + 1, sy); ctx.lineTo(sx + 5 + b * 4, sy + 10); ctx.stroke();
  ctx.fillStyle = 'rgba(240,252,255,0.7)';
  for (let i = 0; i < 3; i++) { ctx.fillRect(x + 3 + R() * (TILE - 6), y + 3 + R() * (TILE - 6), 1.2, 1.2); }
}
