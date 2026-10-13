// Bead, the hero: a cream ball with a stitched seam, big dark eyes and a red thread tail.
import { TAU } from '../core/math.js';

const INK = '#16141c';

export class BeadArt {
  constructor() {
    this.roll = 0;        // accumulated roll angle
    this.blink = 0;
    this.blinkT = 2;
    this.sqx = 1; this.sqy = 1;
    this.tail = [];
    for (let i = 0; i < 7; i++) this.tail.push({ x: 0, y: 0, px: 0, py: 0 });
    this.tailInit = false;
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

    // thread tail verlet
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const ax = cx - b.facing * r * 0.75, ay = cy - r * 0.55;
    if (!this.tailInit) {
      for (const t of this.tail) { t.x = t.px = ax; t.y = t.py = ay; }
      this.tailInit = true;
    }
    const seg = (b.small ? 2.2 : 4.2) * (1 + Math.max(0, (p.save.notches || 3) - 3) * 0.07);
    this.tail[0].x = ax; this.tail[0].y = ay;
    for (let i = 1; i < this.tail.length; i++) {
      const t = this.tail[i];
      const vx = (t.x - t.px) * 0.9, vy = (t.y - t.py) * 0.9;
      t.px = t.x; t.py = t.y;
      t.x += vx - b.facing * 0.25; t.y += vy + 0.35;
    }
    for (let k = 0; k < 3; k++) {
      for (let i = 1; i < this.tail.length; i++) {
        const a = this.tail[i - 1], t = this.tail[i];
        const dx = t.x - a.x, dy = t.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const diff = (d - seg) / d;
        t.x -= dx * diff; t.y -= dy * diff;
      }
    }
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

    for (const t of this.trail) {
      ctx.globalAlpha = (t.life / 0.18) * 0.35;
      ctx.fillStyle = b.mode === 'comet' ? '#ffd0f2' : '#e9e2cf';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (p.invuln > 0 && Math.floor(time * 20) % 2 === 0 && p.hurtFlash <= 0) ctx.globalAlpha = 0.45;

    // tail
    ctx.strokeStyle = '#b8323e';
    ctx.lineWidth = b.small ? 1.2 : 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.tail[0].x, this.tail[0].y);
    for (let i = 1; i < this.tail.length; i++) {
      const a = this.tail[i - 1], t = this.tail[i];
      ctx.quadraticCurveTo(a.x, a.y, (a.x + t.x) / 2, (a.y + t.y) / 2);
    }
    ctx.stroke();
    // Knots strung on the tail as tiny beads
    const eq = (p.save.knots && p.save.knots.equipped) || [];
    eq.forEach((id, i) => {
      const tp = this.tail[Math.min(this.tail.length - 1, 2 + i)];
      let h = 0; for (let k = 0; k < id.length; k++) h = (h * 31 + id.charCodeAt(k)) >>> 0;
      ctx.fillStyle = `hsl(${h % 360}, 50%, 62%)`; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      const r = b.small ? 1.6 : 2.8;
      ctx.beginPath(); ctx.arc(tp.x, tp.y, r, 0, TAU); ctx.fill(); ctx.stroke();
    });

    // dandelion parachute while gliding
    if (b.gliding) drawDandelion(ctx, cx, cy - r, time);

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
    ctx.scale(this.sqx, this.sqy);

    // comet charge glow
    if (b.mode === 'cometCharge' || b.mode === 'comet') {
      const k = b.mode === 'comet' ? 1 : Math.min(1, b.cometT / 0.55);
      const g = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * (1.8 + k));
      g.addColorStop(0, `rgba(255,200,240,${0.5 * k})`); g.addColorStop(1, 'rgba(255,200,240,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * (1.8 + k), 0, TAU); ctx.fill();
    }

    // body: flat cream paint with a painted shadow crescent and pen hatching (no airbrushed gradients)
    const flash = p.hurtFlash > 0;
    ctx.fillStyle = flash ? '#ffffff' : '#f1e9d6';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    if (!flash) {
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
      ctx.fillStyle = '#cdbf9f';
      ctx.beginPath(); ctx.arc(0, 0, r, -0.2, Math.PI * 0.95); ctx.arc(-r * 0.22, -r * 0.3, r * 1.02, Math.PI * 0.9, -0.15, true); ctx.fill();
      ctx.strokeStyle = 'rgba(110,90,70,0.45)'; ctx.lineWidth = 0.8;
      for (let k = 0; k < 5; k++) {
        const hx = r * 0.15 + k * r * 0.14, hy = r * 0.35 + k * r * 0.06;
        ctx.beginPath(); ctx.moveTo(hx - r * 0.2, hy + r * 0.2); ctx.lineTo(hx + r * 0.05, hy - r * 0.05); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,253,245,0.95)';
      ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.22, r * 0.12, -0.6, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // rolling seam (clipped to body)
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
    ctx.rotate(this.roll);
    ctx.strokeStyle = 'rgba(120,100,80,0.45)';
    ctx.lineWidth = 1.1;
    ctx.setLineDash([2.2, 2.2]);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.45, r * 1.05, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // glass shell sheen
    if (p.abilities.shell) {
      ctx.strokeStyle = 'rgba(190,230,255,0.45)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, r + 2.5, -2.4, -0.6); ctx.stroke();
    }

    // outline: a pressured brush line (thicker on the shadow side) plus a faint offset retrace
    ctx.strokeStyle = INK; ctx.lineCap = 'round';
    const lw = b.small ? 1.2 : 1.9;
    for (let k = 0; k < 16; k++) {
      const a0 = (k / 16) * TAU, a1 = ((k + 1.08) / 16) * TAU;
      ctx.lineWidth = lw * (0.75 + 0.6 * Math.max(0, Math.sin(a0 + 0.6)));
      ctx.beginPath(); ctx.arc(0, 0, r, a0, a1); ctx.stroke();
    }
    ctx.globalAlpha *= 0.35; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(0.8, 0.5, r + 0.6, -2.6, 1.4); ctx.stroke();
    ctx.globalAlpha /= 0.35;

    // face (doesn't roll)
    const f = b.facing;
    const lookY = Math.max(-2, Math.min(2.5, b.vy / 350));
    const ex = f * r * 0.22, ey = -r * 0.08 + lookY;
    const er = r * 0.2;
    const blinkK = this.blink > 0 ? 0.15 : 1;
    ctx.fillStyle = INK;
    for (const s of [-1, 1]) {
      const exx = ex + s * r * 0.36 + (s === f ? f * 0.6 : 0);
      ctx.beginPath(); ctx.ellipse(exx, ey, er * 0.82, er * 1.25 * blinkK, 0, 0, TAU); ctx.fill();
      if (blinkK === 1) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(exx - er * 0.25, ey - er * 0.5, er * 0.32, 0, TAU); ctx.fill();
        ctx.fillStyle = INK;
      }
    }
    // buffing: a bright polish highlight sweeps around the shell
    if (p.mending > 0 || this.shine > 0) {
      const k = p.mending > 0 ? 1 : this.shine / 0.6;
      ctx.strokeStyle = `rgba(255,248,225,${0.85 * k})`; ctx.lineWidth = 2.2;
      const a0 = time * 9;
      ctx.beginPath(); ctx.arc(0, 0, r - 2.5, a0, a0 + 1.2); ctx.stroke();
    }
    if (false) {
      ctx.fillStyle = 'rgba(230,120,130,0.5)';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(ex + s * r * 0.55, ey + er * 1.6, er * 0.7, er * 0.35, 0, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
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
