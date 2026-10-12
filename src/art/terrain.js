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
  const chAt = (x, y) => {
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

  // --- ink rim ---
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  tracePath(ctx, loops);
  ctx.strokeStyle = rgba(style.rim, 0.35);
  ctx.lineWidth = 5; ctx.stroke();
  tracePath(ctx, loops);
  ctx.strokeStyle = rgba(style.rim, 0.95);
  ctx.lineWidth = 1.8; ctx.stroke();
  // brighter highlight on top-facing edges
  ctx.strokeStyle = rgba(style.accent, 0.55);
  ctx.lineWidth = 2.2;
  for (const pts of loops) {
    ctx.beginPath();
    let drawing = false;
    for (const p of pts) {
      if (p.ny < -0.6) {
        if (!drawing) { ctx.moveTo(p.x, p.y); drawing = true; } else ctx.lineTo(p.x, p.y);
      } else drawing = false;
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
  return { canvas: cv, loops };
}

function decorate(ctx, kind, face, p, h, style, R) {
  const x = p.x, y = p.y;
  switch (kind) {
    case 'moss': case 'leaves': case 'grass': case 'mushrooms': case 'snow': case 'lint': {
      if (face !== 'top') return;
      if (kind === 'mushrooms' && h < 0.07) return mushroom(ctx, x, y, h, style);
      if (kind === 'snow') {
        ctx.fillStyle = rgba(style.accent, 0.8);
        ctx.beginPath(); ctx.ellipse(x, y - 1, 6 + h * 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        return;
      }
      if (h > 0.7) return;
      const n = 2 + Math.floor(h * 4);
      ctx.strokeStyle = rgba(kind === 'leaves' ? style.accent : style.rim, 0.85);
      ctx.lineWidth = 1.4;
      for (let i = 0; i < n; i++) {
        const bx = x + (i - n / 2) * 2.2;
        const len = 4 + ((h * 97 + i * 13) % 1) * (kind === 'leaves' ? 12 : 8);
        const bend = (((h * 31 + i * 7) % 1) - 0.5) * 6;
        ctx.beginPath(); ctx.moveTo(bx, y + 1);
        ctx.quadraticCurveTo(bx + bend * 0.3, y - len * 0.6, bx + bend, y - len);
        ctx.stroke();
      }
      if (kind === 'leaves' && h < 0.15) {
        ctx.fillStyle = rgba(style.accent, 0.7);
        ctx.beginPath(); ctx.ellipse(x + 3, y - 6, 5, 2.2, -0.6, 0, Math.PI * 2); ctx.fill();
      }
      return;
    }
    case 'threads': {
      if (face === 'top' && h < 0.25) {
        ctx.strokeStyle = rgba(style.accent, 0.5); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 4, y - 8, x - 4, y - 12, x + 2, y - 16 - h * 20); ctx.stroke();
      } else if (face !== 'top' && h < 0.22) {
        hangThread(ctx, x, y, 14 + h * 120, style, h);
      }
      return;
    }
    case 'roots': case 'vines': {
      if (h > (kind === 'vines' ? 0.3 : 0.2)) return;
      const len = 10 + h * 160;
      ctx.strokeStyle = rgba(style.rim, 0.55); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, y);
      if (face === 'side') {
        ctx.bezierCurveTo(x + p.nx * 8, y + 6, x + p.nx * 4, y + 14, x + p.nx * 2, y + 10 + len * 0.3);
      } else {
        ctx.bezierCurveTo(x + 6, y + len * 0.3, x - 6, y + len * 0.6, x + (h - 0.1) * 30, y + len);
      }
      ctx.stroke();
      if (kind === 'vines') {
        ctx.fillStyle = rgba(style.accent, 0.6);
        for (let k = 1; k < 4; k++) {
          ctx.beginPath(); ctx.ellipse(x + (k % 2 ? 3 : -3), y + len * k / 4, 3.5, 1.8, k % 2 ? 0.5 : -0.5, 0, Math.PI * 2); ctx.fill();
        }
      }
      return;
    }
    case 'drips': case 'wax': case 'slag': case 'icicles': {
      if (face === 'top') return;
      if (h > 0.25) return;
      const len = 6 + h * 70;
      const col = kind === 'icicles' ? style.accent : kind === 'wax' ? '#e9d9b0' : style.rim;
      ctx.fillStyle = rgba(col, kind === 'icicles' ? 0.55 : 0.7);
      ctx.beginPath();
      ctx.moveTo(x - 3 - h * 6, y - 1);
      ctx.quadraticCurveTo(x - 1, y + len * 0.6, x, y + len);
      ctx.quadraticCurveTo(x + 1, y + len * 0.6, x + 3 + h * 6, y - 1);
      ctx.fill();
      return;
    }
    case 'candles': {
      if (face === 'top' && h < 0.06) return candle(ctx, x, y, h, style);
      if (face === 'top' && h < 0.4) {
        ctx.fillStyle = rgba('#e9d9b0', 0.35);
        ctx.beginPath(); ctx.ellipse(x, y, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
      }
      if (face !== 'top' && h < 0.2) decorate(ctx, 'wax', face, p, h, style, R);
      return;
    }
    case 'crystals': case 'glass': {
      if (h > 0.12) return;
      const dir = face === 'top' ? -1 : face === 'bottom' ? 1 : 0;
      const n = 1 + Math.floor(h * 30) % 3;
      for (let i = 0; i < n; i++) {
        const len = 8 + ((h * 53 + i * 0.37) % 1) * 22;
        const ang = (dir === 0 ? Math.atan2(p.ny, p.nx) : dir * Math.PI / 2) + (i - 1) * 0.35;
        const tx = x + Math.cos(ang) * len, ty = y + Math.sin(ang) * len;
        const px = -Math.sin(ang) * 4, py = Math.cos(ang) * 4;
        ctx.fillStyle = rgba(style.accent, 0.45);
        ctx.strokeStyle = rgba(style.glow, 0.8); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + px, y + py); ctx.lineTo(tx, ty); ctx.lineTo(x - px, y - py); ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
      return;
    }
    case 'eggs': {
      if (face === 'top' && h < 0.08) {
        ctx.fillStyle = rgba(style.accent, 0.5);
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x + i * 6 - 6, y - 4, 3.5, 4.5, 0, 0, Math.PI * 2); ctx.fill(); }
      }
      return;
    }
    case 'webs': {
      if (face !== 'top' && h < 0.05) {
        ctx.strokeStyle = 'rgba(220,230,200,0.18)'; ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(i * 0.6 + 0.3) * 40, y + Math.sin(i * 0.6 + 0.3) * 40); ctx.stroke();
        }
        for (let r = 10; r < 40; r += 10) { ctx.beginPath(); ctx.arc(x, y, r, 0.3, 2.7); ctx.stroke(); }
      } else if (face !== 'top' && h < 0.25) hangThread(ctx, x, y, 10 + h * 80, style, h);
      return;
    }
    case 'books': {
      if (face === 'top' && h < 0.12) {
        const cols = [style.accent, style.rim, '#b55a5a', '#5a7ab5'];
        let bx = x - 8;
        for (let i = 0; i < 3; i++) {
          const bh = 8 + ((h * 71 + i * 0.3) % 1) * 8;
          ctx.fillStyle = rgba(cols[(i + Math.floor(h * 40)) % 4], 0.75);
          ctx.fillRect(bx, y - bh, 4, bh); bx += 5;
        }
      } else if (face !== 'top' && h < 0.15) hangThread(ctx, x, y, 12 + h * 100, style, h);
      return;
    }
    case 'tiles': case 'bolts': case 'pipes': case 'barnacles': {
      if (face === 'top' && kind === 'tiles' && h < 0.6) {
        ctx.fillStyle = rgba(style.rim, 0.5);
        ctx.beginPath(); ctx.arc(x, y + 2, 4, Math.PI, 0); ctx.fill();
      } else if (kind === 'bolts' && h < 0.08) {
        ctx.fillStyle = rgba(style.accent, 0.8);
        ctx.beginPath(); ctx.arc(x - p.nx * 6, y - p.ny * 6, 2.2, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'pipes' && face === 'bottom' && h < 0.04) {
        ctx.strokeStyle = rgba(style.rim, 0.7); ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 20 + h * 400); ctx.stroke();
      } else if (kind === 'barnacles' && h < 0.2) {
        ctx.fillStyle = rgba(style.rim, 0.6);
        ctx.beginPath(); ctx.arc(x, y, 2 + h * 12, 0, Math.PI * 2); ctx.fill();
      } else if (face === 'bottom' && h < 0.12) decorate(ctx, 'drips', face, p, h, style, R);
      return;
    }
    case 'side': return;
    default: return decorate(ctx, 'moss', face, p, h, style, R);
  }
}

function hangThread(ctx, x, y, len, style, h) {
  ctx.strokeStyle = rgba(style.accent, 0.35); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + 5, y + len * 0.4, x - 5, y + len * 0.7, x + (h - 0.1) * 20, y + len);
  ctx.stroke();
  ctx.fillStyle = rgba(style.accent, 0.5);
  ctx.beginPath(); ctx.arc(x + (h - 0.1) * 20, y + len, 1.8, 0, Math.PI * 2); ctx.fill();
}

function mushroom(ctx, x, y, h, style) {
  const s = 6 + h * 120;
  ctx.fillStyle = rgba(style.rim, 0.8);
  ctx.fillRect(x - 1.2, y - s, 2.4, s);
  ctx.fillStyle = rgba(style.accent, 0.75);
  ctx.beginPath(); ctx.ellipse(x, y - s, s * 0.7, s * 0.35, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = rgba(style.glow, 0.6);
  ctx.beginPath(); ctx.arc(x - s * 0.25, y - s - s * 0.12, 1.4, 0, Math.PI * 2); ctx.fill();
}

function candle(ctx, x, y, h, style) {
  const ch = 8 + h * 200;
  ctx.fillStyle = '#e8d6aa';
  ctx.fillRect(x - 2.5, y - ch, 5, ch);
  const g = ctx.createRadialGradient(x, y - ch - 4, 0, x, y - ch - 4, 26);
  g.addColorStop(0, rgba(style.glow, 0.45)); g.addColorStop(1, rgba(style.glow, 0));
  ctx.fillStyle = g; ctx.fillRect(x - 26, y - ch - 30, 52, 52);
  ctx.fillStyle = style.glow;
  ctx.beginPath(); ctx.ellipse(x, y - ch - 4, 2, 4, 0, 0, Math.PI * 2); ctx.fill();
}

function drawPlatform(ctx, x, y, room, tx, ty, style) {
  ctx.fillStyle = mix(style.rock, style.rockHi, 0.6);
  ctx.fillRect(x - 1, y, TILE + 2, 9);
  ctx.strokeStyle = rgba(style.rim, 0.9); ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x - 1, y + 0.8); ctx.lineTo(x + TILE + 1, y + 0.8); ctx.stroke();
  ctx.strokeStyle = rgba(style.rim, 0.35); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y + 9); ctx.lineTo(x + TILE, y + 9); ctx.stroke();
  // support struts at platform ends
  const l = room.charAt(tx - 1, ty) !== '=', r = room.charAt(tx + 1, ty) !== '=';
  ctx.strokeStyle = rgba(style.rim, 0.4); ctx.lineWidth = 2;
  if (l) { ctx.beginPath(); ctx.moveTo(x + 4, y + 9); ctx.lineTo(x + 10, y + 22); ctx.stroke(); }
  if (r) { ctx.beginPath(); ctx.moveTo(x + TILE - 4, y + 9); ctx.lineTo(x + TILE - 10, y + 22); ctx.stroke(); }
}

function drawHalfBlock(ctx, x, y, style, R) {
  ctx.fillStyle = style.rock;
  ctx.beginPath(); ctx.roundRect(x - 0.5, y, TILE + 1, TILE / 2, 3); ctx.fill();
  ctx.strokeStyle = rgba(style.rim, 0.8); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y + TILE / 2); ctx.lineTo(x + TILE, y + TILE / 2); ctx.stroke();
  ctx.strokeStyle = rgba(style.rim, 0.3);
  ctx.beginPath(); ctx.moveTo(x, y + TILE / 2 + 3); ctx.lineTo(x + TILE, y + TILE / 2 + 3); ctx.stroke();
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
  // now spikes point toward -y, base at +TILE/2
  ctx.fillStyle = style.rock;
  ctx.strokeStyle = rgba(style.rim, 0.95); ctx.lineWidth = 1.3;
  const n = 4;
  for (let i = 0; i < n; i++) {
    const bx = -TILE / 2 + (i + 0.5) * (TILE / n);
    const hgt = 18 + R() * 10;
    const lean = (R() - 0.5) * 5;
    ctx.beginPath();
    ctx.moveTo(bx - 5, TILE / 2 + 1);
    ctx.quadraticCurveTo(bx - 1, TILE / 2 - hgt * 0.5, bx + lean, TILE / 2 - hgt);
    ctx.quadraticCurveTo(bx + 1, TILE / 2 - hgt * 0.5, bx + 5, TILE / 2 + 1);
    ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawMagnetTile(ctx, x, y, room, tx, ty) {
  ctx.fillStyle = 'rgba(150,80,40,0.55)';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = 'rgba(255,170,90,0.6)'; ctx.lineWidth = 1;
  ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
  ctx.fillStyle = 'rgba(255,200,140,0.75)';
  for (const [ox, oy] of [[6, 6], [TILE - 6, 6], [6, TILE - 6], [TILE - 6, TILE - 6]]) {
    ctx.beginPath(); ctx.arc(x + ox, y + oy, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  // horseshoe glyph
  ctx.strokeStyle = 'rgba(255,120,80,0.6)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE / 2 - 1, 6, 0, Math.PI); ctx.stroke();
}

function drawIceTile(ctx, x, y, R) {
  ctx.fillStyle = 'rgba(160,220,255,0.28)';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = 'rgba(230,250,255,0.45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 4 + R() * 8, y + 4); ctx.lineTo(x + 10 + R() * 14, y + TILE - 6); ctx.stroke();
}
