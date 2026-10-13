// Bead, the hero: a painted cream bead with big dark eyes and a red thread bow tied through its bore.
// Bonking unravels three strands of yarn from Bead's body and lashes them out like a whip.
import { TAU } from '../core/math.js';

const INK = '#16141c';
export const WHIP_COLORS = ['#b8323e', '#d4535c', '#93262f'];

export class BeadArt {
  constructor() {
    this.roll = 0;        // accumulated roll angle
    this.blink = 0;
    this.blinkT = 2;
    this.sqx = 1; this.sqy = 1;
    // the sprig of thread on top springs about as Bead moves
    this.sway = 0; this.swayV = 0;
    this.trail = [];
  }

  impulse(sx, sy) { this.sqx = sx; this.sqy = sy; }

  update(dt, p) {
    const b = p.b;
    const r = b.w / 2;
    this.roll += (b.vx * dt) / Math.max(4, r);
    this.sqx += (1 - this.sqx) * Math.min(1, dt * 14);
    this.sqy += (1 - this.sqy) * Math.min(1, dt * 14);
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.12; this.blinkT = 2 + Math.random() * 3; }
    if (this.blink > 0) this.blink -= dt;
    if (this.shine > 0) this.shine -= dt;

    // the sprig leans back against motion and springs when Bead lands or jumps
    const target = -b.vx / 520 + Math.max(-0.4, Math.min(0.4, b.vy / 1400)) * b.facing;
    this.swayV += ((target - this.sway) * 90 - this.swayV * 7) * dt;
    this.sway += this.swayV * dt;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    // afterimages while dashing / comet
    if (b.mode === 'dash' || b.mode === 'comet') {
      this.trail.push({ x: cx, y: cy, life: 0.18, r });
    }
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life -= dt;
      if (this.trail[i].life <= 0) this.trail.splice(i, 1);
    }
  }

  draw(ctx, p, time) {
    const b = p.b;
    const r = b.w / 2 + 1;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const k = r / 13;

    for (const t of this.trail) {
      ctx.globalAlpha = (t.life / 0.18) * 0.35;
      ctx.fillStyle = b.mode === 'comet' ? '#ffd0f2' : '#e9e2cf';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (p.invuln > 0 && Math.floor(time * 20) % 2 === 0 && p.hurtFlash <= 0) ctx.globalAlpha = 0.45;
    const attacking = p.attackT >= 0;
    const at = attacking ? p.attackT : 0;
    const dir = p.attackDir, flip = p.swing % 2 ? 1 : -1;

    // dandelion parachute while gliding
    if (b.gliding) drawDandelion(ctx, cx, cy - r - 4, time);

    // hook line
    if ((b.mode === 'hook' || b.mode === 'hang') && b.hook) {
      ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(b.hook.x, b.hook.y); ctx.stroke();
    }

    ctx.save();
    ctx.translate(cx, cy + (1 - this.sqy) * r * 0.9);
    // magnet orientation: rotate so "down" faces the surface
    if (b.mode === 'magnet') {
      ctx.rotate(b.magnet === 'ceil' ? Math.PI : b.magnet === 'left' ? Math.PI / 2 : -Math.PI / 2);
    }
    // the whole body throws itself into a swing: wind back, then snap through
    let lean = 0, asx = 1, asy = 1;
    if (attacking && b.mode !== 'magnet') {
      const u = Math.min(1, at / 0.09), back = Math.max(0, 1 - at / 0.03);
      const settle = Math.max(0, 1 - Math.max(0, at - 0.09) / 0.13);
      if (dir === 'side') { lean = b.facing * (flip > 0 ? 1 : -1) * (-0.35 * back + 0.4 * u * settle); asx = 1 + 0.16 * u * settle; asy = 1 - 0.12 * u * settle; }
      else if (dir === 'up') { lean = -b.facing * 0.3 * u * settle; asx = 1 - 0.12 * u * settle; asy = 1 + 0.16 * u * settle; }
      else { lean = b.facing * 0.5 * u * settle; asx = 1 + 0.12 * u * settle; asy = 1 - 0.1 * u * settle; }
    }
    ctx.rotate(lean);
    ctx.scale(this.sqx * asx, this.sqy * asy);

    // comet charge glow
    if (b.mode === 'cometCharge' || b.mode === 'comet') {
      const kk = b.mode === 'comet' ? 1 : Math.min(1, b.cometT / 0.55);
      const g = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * (1.8 + kk));
      g.addColorStop(0, `rgba(255,200,240,${0.5 * kk})`); g.addColorStop(1, 'rgba(255,200,240,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * (1.8 + kk), 0, TAU); ctx.fill();
    }

    // body: flat cream paint, a painted shadow and a few rolling terracotta dots
    const flash = p.hurtFlash > 0;
    ctx.fillStyle = flash ? '#ffffff' : '#f1e9d6';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    if (!flash) {
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
      // a red running stitch around the bead turns with the roll
      ctx.save(); ctx.rotate(this.roll);
      ctx.strokeStyle = 'rgba(184,50,62,0.42)'; ctx.lineWidth = 1.1; ctx.setLineDash([2.2, 2.4]);
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.42, r * 1.02, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
      ctx.fillStyle = 'rgba(150,120,90,0.42)';
      ctx.beginPath(); ctx.arc(0, 0, r, -0.2, Math.PI * 0.95); ctx.arc(-r * 0.22, -r * 0.3, r * 1.02, Math.PI * 0.9, -0.15, true); ctx.fill();
      ctx.strokeStyle = 'rgba(110,90,70,0.4)'; ctx.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) {
        const hx = r * 0.2 + i * r * 0.15, hy = r * 0.4 + i * r * 0.05;
        ctx.beginPath(); ctx.moveTo(hx - r * 0.18, hy + r * 0.18); ctx.lineTo(hx + r * 0.04, hy - r * 0.04); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,253,245,0.95)';
      ctx.beginPath(); ctx.ellipse(-r * 0.42, -r * 0.45, r * 0.2, r * 0.1, -0.7, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // glass shell sheen
    if (p.abilities.shell) {
      ctx.strokeStyle = 'rgba(190,230,255,0.45)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, r + 2.5, -2.4, -0.6); ctx.stroke();
    }

    // outline: a pressured brush line (thicker on the shadow side) plus a faint offset retrace
    ctx.strokeStyle = INK; ctx.lineCap = 'round';
    const lw = b.small ? 1.2 : 1.9;
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * TAU, a1 = ((i + 1.08) / 16) * TAU;
      ctx.lineWidth = lw * (0.75 + 0.6 * Math.max(0, Math.sin(a0 + 0.6)));
      ctx.beginPath(); ctx.arc(0, 0, r, a0, a1); ctx.stroke();
    }
    ctx.globalAlpha *= 0.35; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(0.8, 0.5, r + 0.6, -2.6, 1.4); ctx.stroke();
    ctx.globalAlpha /= 0.35;

    // face (doesn't roll); eyes follow the swing
    const f = b.facing;
    let lookY = Math.max(-2, Math.min(2.5, b.vy / 350));
    if (attacking) lookY = dir === 'up' ? -3 * k : dir === 'down' ? 3 * k : lookY;
    const ex = f * r * 0.22, ey = -r * 0.04 + lookY;
    const er = r * 0.2;
    const squint = attacking && at < 0.12 && dir === 'side';
    const blinkK = this.blink > 0 ? 0.15 : squint ? 0.55 : 1;
    // cheeks
    if (!flash) {
      ctx.fillStyle = 'rgba(226,120,120,0.38)';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(ex + s * r * 0.56, ey + er * 1.7, er * 0.62, er * 0.34, 0, 0, TAU); ctx.fill(); }
    }
    ctx.fillStyle = INK;
    for (const s of [-1, 1]) {
      const exx = ex + s * r * 0.34 + (s === f ? f * 0.6 : 0);
      ctx.beginPath(); ctx.ellipse(exx, ey, er * 0.8, er * 1.25 * blinkK, 0, 0, TAU); ctx.fill();
      if (blinkK === 1) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(exx - er * 0.25, ey - er * 0.5, er * 0.32, 0, TAU); ctx.fill();
        ctx.fillStyle = INK;
      }
    }
    // Bead's thread, knotted through the bore, with a curly sprig on top (Knots are strung on it)
    const notch = (p.save && p.save.notches) || 3;
    drawSprig(ctx, 0, -r + 1, k * (b.small ? 0.8 : 1) * (1 + Math.max(0, notch - 3) * 0.05), this.sway + Math.sin(time * 2.2) * 0.04, flash, '#b8323e', [], b.facing);

    // buffing: a bright polish highlight sweeps around the shell
    if (p.mending > 0 || this.shine > 0) {
      const kk = p.mending > 0 ? 1 : this.shine / 0.6;
      ctx.strokeStyle = `rgba(255,248,225,${0.85 * kk})`; ctx.lineWidth = 2.2;
      const a0 = time * 9;
      ctx.beginPath(); ctx.arc(0, 0, r - 2.5, a0, a0 + 1.2); ctx.stroke();
    }
    ctx.restore();

    // the yarn whip, unravelled from Bead and lashed out in front
    if (attacking) {
      const reach = (p.stats && p.stats.reach) || 1;
      drawWhip(ctx, cx, cy, r, dir, b.facing, at, flip, reach * (b.small ? 0.8 : 1), WHIP_COLORS);
    }
    ctx.globalAlpha = 1;
  }
}

function strand(ctx, e) {
  ctx.beginPath(); ctx.moveTo(e[0].x, e[0].y);
  for (let i = 1; i < e.length; i++) { const a = e[i - 1], q = e[i]; ctx.quadraticCurveTo(a.x, a.y, (a.x + q.x) / 2, (a.y + q.y) / 2); }
  const l = e[e.length - 1]; ctx.lineTo(l.x, l.y);
  ctx.stroke();
}

function knotHue(id) { let h = 0; for (let c = 0; c < id.length; c++) h = (h * 31 + id.charCodeAt(c)) >>> 0; return h % 360; }

// a small knot through Bead's bore with one short loose curl of thread lying on top
export function drawSprig(ctx, x, y, k, sway, white, color = '#b8323e', knots = [], curl = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(k, k);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const pts = [];
  const N = 7, L = 10;
  for (let i = 0; i <= N; i++) {
    const q = i / N;
    // rises, leans with sway, and curls over at the tip
    const a = -Math.PI / 2 - 0.75 * curl + sway * (0.4 + q) + q * 2.9 * curl;
    const prev = pts[i - 1] || [0, -1];
    pts.push(i ? [prev[0] + Math.cos(a) * L / N, prev[1] + Math.sin(a) * L / N] : [0, -1]);
  }
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) { const m = pts[i - 1], n = pts[i]; ctx.quadraticCurveTo(m[0], m[1], (m[0] + n[0]) / 2, (m[1] + n[1]) / 2); } ctx.lineTo(pts[N][0], pts[N][1]); ctx.stroke(); };
  ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 3; path();
  ctx.strokeStyle = white ? '#fff' : color; ctx.lineWidth = 1.5; path();
  // frayed tip
  if (!white) {
    const [tx, ty] = pts[N], [qx, qy] = pts[N - 1], a = Math.atan2(ty - qy, tx - qx);
    ctx.strokeStyle = color; ctx.lineWidth = 0.8;
    for (const d of [-0.6, 0.5]) { ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + Math.cos(a + d) * 2.6, ty + Math.sin(a + d) * 2.6); ctx.stroke(); }
  }
  // equipped Knots strung on the sprig as tiny beads
  knots.slice(0, 4).forEach((id, i) => {
    const [bx, by] = pts[Math.min(N - 1, 2 + i)];
    ctx.fillStyle = white ? '#fff' : `hsl(${knotHue(id)}, 38%, 66%)`; ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(bx, by, 2, 0, TAU); ctx.fill(); ctx.stroke();
  });
  // the knot itself, snug against the bore
  ctx.fillStyle = white ? '#fff' : color; ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.ellipse(0, 0.5, 3.4, 2.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
  if (!white) { ctx.strokeStyle = 'rgba(40,10,16,0.6)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-1.6, -1); ctx.quadraticCurveTo(0, 1.8, 1.8, -0.6); ctx.stroke(); }
  ctx.restore();
}

// Three strands of yarn whipping through an arc. The base leads and the tips lag behind, so the
// strands curl like a lash, crack at full stretch, then reel back in.
// angles are given for a right-facing swing (canvas coords: negative = up) and mirrored for left.
const SWINGS = {
  over: [-2.3, 0.35],    // side swing, from behind/over the head to forward
  under: [2.2, -0.35],   // side swing, from behind/below, upward through the front
  up: [0.5, -Math.PI / 2 - 0.55],
  down: [-0.7, Math.PI / 2 + 0.45],
};
const STRANDS = [
  { off: -0.13, len: 0.92, lag: 0.035, w: 2.3 },
  { off: 0.0, len: 1.06, lag: 0.05, w: 2.6 },
  { off: 0.13, len: 0.96, lag: 0.065, w: 2.1 },
];

function ease(x) { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); }

function strandPts(ox, oy, r, sw, facing, t, s, L) {
  const [a0, a1] = sw;
  const N = 11, pts = [];
  const span = a1 - a0;
  const grow = Math.min(1, t / 0.035) * (t > 0.13 ? Math.max(0, 1 - (t - 0.13) / 0.09) : 1);
  const len = L * s.len * grow;
  // base direction at this moment decides where the strand leaves the body
  const baseA = a0 + span * ease(t / 0.085) + s.off;
  let x = Math.cos(baseA) * r * 0.85, y = Math.sin(baseA) * r * 0.85;
  pts.push([ox + facing * x, oy + y]);
  for (let i = 1; i <= N; i++) {
    const q = i / N;
    const local = (t - q * s.lag) / 0.085;
    // tips overshoot a little at full stretch: the crack
    const over = q * 0.22 * Math.sin(Math.max(0, Math.min(1, (t - 0.06 - q * s.lag) / 0.08)) * Math.PI);
    const a = a0 + span * ease(local) + s.off * (1 - q * 0.5) + Math.sign(span) * over
      + Math.sin(q * 7 - t * 50 + s.off * 20) * 0.12 * q * (1 - ease(local));
    x += Math.cos(a) * len / N; y += Math.sin(a) * len / N;
    pts.push([ox + facing * x, oy + y]);
  }
  return pts;
}

function hash(n) { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }
function smooth(e0, e1, x) { x = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return x * x * (3 - 2 * x); }

// One soft yarn: three plies twisted together near Bead that unravel into loose, fuzzy strands at the tip.
export function drawWhip(ctx, ox, oy, r, dir, facing, t, flip, reach, cols, white) {
  if (t < 0 || t > 0.22) return;
  const sw = dir === 'up' ? SWINGS.up : dir === 'down' ? SWINGS.down : flip > 0 ? SWINGS.over : SWINGS.under;
  const L = (dir === 'side' ? 54 : 50) * reach;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // motion smear: a hair-thin pen stroke tracing where the tip has just been
  if (t > 0.02 && t < 0.15 && !white) {
    ctx.strokeStyle = 'rgba(245,236,214,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let m = 0; m <= 8; m++) {
      const tt = Math.max(0, t - 0.05 + m * 0.00625);
      const pts = strandPts(ox, oy, r, sw, facing, tt, STRANDS[1], L);
      const [px, py] = pts[pts.length - 1];
      m ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  const core = strandPts(ox, oy, r, sw, facing, t, STRANDS[1], L);
  const n = core.length - 1;
  // perpendiculars along the core
  const nrm = core.map((p, i) => {
    const a = core[Math.max(0, i - 1)], b = core[Math.min(n, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    return [-dy / d, dx / d];
  });
  const plies = STRANDS.map((s, k) => {
    const loose = strandPts(ox, oy, r, sw, facing, t, s, L);
    return core.map((c, i) => {
      const q = i / n;
      const u = smooth(0.4, 1, q);               // how unravelled this point is
      const tw = Math.sin(q * 16 + k * TAU / 3 - t * 30) * 1.5; // the twist
      const tx = c[0] + nrm[i][0] * tw, ty = c[1] + nrm[i][1] * tw;
      const fan = (k - 1) * u * 5;
      return [tx + (loose[i][0] - tx) * u + nrm[i][0] * fan, ty + (loose[i][1] - ty) * u + nrm[i][1] * fan];
    });
  });
  // soft ink shadow under the twisted part only, so it reads as one cord rather than separate wires
  ctx.strokeStyle = white ? '#fff' : 'rgba(22,20,28,0.85)';
  for (let i = 1; i <= n; i++) {
    const q = i / n; if (q > 0.7) break;
    ctx.lineWidth = 6.2 * (1 - q * 0.9);
    ctx.beginPath(); ctx.moveTo(core[i - 1][0], core[i - 1][1]); ctx.lineTo(core[i][0], core[i][1]); ctx.stroke();
  }
  plies.forEach((pts, k) => {
    ctx.strokeStyle = white ? '#fff' : cols[k % cols.length];
    for (let i = 1; i <= n; i++) {
      const q = i / n;
      ctx.lineWidth = 2.3 - q * 1.2;
      ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    }
  });
  if (!white) {
    // fuzz: little fibres standing off the yarn, more of them where it frays
    ctx.strokeStyle = 'rgba(240,180,180,0.35)'; ctx.lineWidth = 0.6;
    plies.forEach((pts, k) => {
      for (let i = 2; i <= n; i++) {
        const q = i / n, h = hash(i * 7 + k * 31);
        if (h > 0.1 + q * 0.3) continue;
        const [x, y] = pts[i], [nx, ny] = nrm[i], sgn = h > 0.12 ? 1 : -1, len = 1.5 + h * 8;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + nx * sgn * len * 0.6 + ny * 1.5, y + ny * sgn * len * 0.6 - nx * 1.5, x + nx * sgn * len, y + ny * sgn * len); ctx.stroke();
      }
      // a frayed tuft at each tip
      const [tx, ty] = pts[n], [qx, qy] = pts[n - 1], a = Math.atan2(ty - qy, tx - qx);
      ctx.strokeStyle = cols[k % cols.length]; ctx.lineWidth = 0.8;
      for (const d of [-0.55, 0, 0.5]) { ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + Math.cos(a + d) * 4.5, ty + Math.sin(a + d) * 4.5); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(240,180,180,0.35)'; ctx.lineWidth = 0.6;
    });
    // a soft puff where the lash cracks
    if (t > 0.07 && t < 0.14) {
      const [tx, ty] = core[n];
      const kk = 1 - Math.abs(t - 0.1) / 0.04;
      ctx.strokeStyle = `rgba(255,240,226,${0.75 * kk})`; ctx.lineWidth = 1.1;
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + 0.3;
        ctx.beginPath(); ctx.arc(tx + Math.cos(a) * (5 + 3 * (1 - kk)), ty + Math.sin(a) * (5 + 3 * (1 - kk)), 1.6, 0, TAU); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawDandelion(ctx, x, y, time) {
  ctx.strokeStyle = 'rgba(240,235,220,0.9)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 14); ctx.stroke();
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI + (i / (n - 1)) * Math.PI + Math.sin(time * 6 + i) * 0.05;
    const L = 12 + (i % 2) * 3;
    const ex = x + Math.cos(a) * L, ey = y - 14 + Math.sin(a) * L * 0.8;
    ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,250,0.85)';
    ctx.beginPath(); ctx.arc(ex, ey, 1.6, 0, TAU); ctx.fill();
  }
}
