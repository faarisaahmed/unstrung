// The Fray bosses.
import { Boss } from './boss.js';
import { TAU, clamp } from '../core/math.js';
import { INK } from '../art/creatures.js';

// GNARLKNOT — The Tangled Warden. Tutorial boss: readable, generous telegraphs.
export class Gnarlknot extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, {
      id: 'gnarlknot', name: 'Gnarlknot', epithet: 'The Tangled Warden', hp: 150, size: [96, 84],
      music: 'boss_gnarlknot', glints: 60,
    });
    this.rollAng = 0;
    this.lunge = 0;
    this.curl = 0;
  }

  attackList() {
    const near = this.distX() < 170;
    return [
      { name: 'roll', w: 3, fn: this.roll },
      { name: 'leap', w: 2, fn: this.leap },
      { name: 'whip', w: near ? 3 : 0.5, fn: this.whip },
      { name: 'spit', w: this.phase >= 2 ? 2 : 0, fn: this.spit },
    ];
  }

  *roll() {
    this.facePlayer();
    this.curl = 1;
    this.tele = 0.6;
    this.sfx('charge');
    yield 0.6;
    const r = yield* this.dashTo(this.facing, 520 + this.phase * 60);
    if (r === 'wall') {
      this.shake(7, 0.3); this.sfx('slam');
      this.fx.burst(this.facing > 0 ? this.x + this.w : this.x, this.cy, 12, { color: '#9aa3b5', speed: 260, size: 3, life: 0.5 });
      if (this.phase >= 2) for (let i = 0; i < 4; i++) this.fire(this.cx, this.y + 10, -this.facing * this.rand(100, 320), -this.rand(300, 600), { gravity: 1100, art: 'glob', color: '#c7d0e0', r: 8 });
    }
    this.curl = 0;
    this.facing = -this.facing;
    yield 0.7;
  }

  *leap() {
    this.facePlayer();
    this.tele = 0.45;
    yield 0.45;
    this.sfx('leap');
    yield* this.leapTo(this.player.cx, 230, 0.85);
    this.sfx('slam'); this.shake(8, 0.35);
    this.fx.burst(this.cx, this.groundY, 16, { color: '#c7d0e0', speed: 300, angle: -Math.PI / 2, spread: 2.6, size: 3.5, life: 0.6 });
    if (this.phase >= 2) { this.shockwave(this.cx, -1, 380); this.shockwave(this.cx, 1, 380); }
    yield 0.8;
  }

  *whip() {
    this.facePlayer();
    this.lunge = -1;
    this.tele = 0.5;
    this.sfx('rustle');
    yield 0.5;
    this.lunge = 1;
    this.sfx('whip');
    const reach = 150;
    const x = this.facing > 0 ? this.x + this.w - 10 : this.x - reach + 10;
    this.zone(x, this.y + this.h * 0.35, reach, 40, 0.18);
    this.fx.slash(this.cx + this.facing * (this.w / 2 + 50), this.y + this.h * 0.55, this.facing > 0 ? 0 : Math.PI, 150, 'rgba(199,208,224,0.9)', 0.2);
    yield 0.25;
    this.lunge = 0;
    yield 0.6;
  }

  *spit() {
    this.facePlayer();
    this.tele = 0.4;
    yield 0.4;
    for (let i = 0; i < 3; i++) {
      this.sfx('spit');
      const p = this.player;
      const dx = p.cx - this.cx;
      const T = 0.9;
      this.fire(this.cx, this.y + 20, dx / T + this.rand(-60, 60), -500, { gravity: 1100, art: 'glob', color: '#c7d0e0', r: 9 });
      yield 0.3;
    }
    yield 0.6;
  }

  onPhase(n) { if (n === 2) { this.sfx('bossRoar'); this.shake(6, 0.6); this.tele = 0.8; } }

  bodyBox() { return { x: this.x + 10, y: this.y + 12, w: this.w - 20, h: this.h - 12 }; }

  drawBody(ctx, t, white) {
    const f = this.facing;
    const cx = this.cx, by = this.y + this.h;
    const r = 38;
    const walk = this.curl ? 0 : Math.abs(this.vx || 0) > 20 ? Math.sin(t * 14) : 0;
    const cy = by - 46 - Math.abs(walk) * 2;
    if (this.curl) this.rollAng += 0.25 * f; else this.rollAng *= 0.9;
    const W = (c) => (white ? '#fff' : c);
    // the rope arm eases toward its pose: hanging, wound back over the head, or lashed out
    const pose = this.curl ? null : this.lunge < 0 ? 'wind' : this.lunge > 0 ? 'lash' : 'hang';
    const tgt = pose === 'wind' ? [-14, -r - 30, r * 0.4, -r - 14]
      : pose === 'lash' ? [r + 128, 10, r + 60, -26]
      : [r + 8, 38, r + 18, 10];
    this.arm = this.arm || tgt.slice();
    const sp = pose === 'lash' ? 0.55 : 0.18;
    for (let i = 0; i < 4; i++) this.arm[i] += (tgt[i] - this.arm[i]) * sp;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // knitting needles stuck through its back (they spin with it when it curls)
    const needles = (rot) => {
      for (const [x0, y0, a, L] of [[-6, 4, -1.95, 80], [6, 2, -2.45, 70]]) {
        const aa = rot ? a + this.rollAng : a;
        const dx = Math.cos(aa) * f, dy = Math.sin(aa);
        const sx = cx + x0 * f, sy = cy + y0;
        const tx = sx + dx * L, ty = sy + dy * L;
        ctx.strokeStyle = W(INK); ctx.lineWidth = 7.5;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.strokeStyle = W('#d6ad74'); ctx.lineWidth = 4.5; ctx.stroke();
        if (!white) { ctx.strokeStyle = 'rgba(255,240,210,0.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(sx + dy * 1.2 * f, sy - dx * 1.2 * f); ctx.lineTo(tx + dy * 1.2 * f, ty - dx * 1.2 * f); ctx.stroke(); }
        ctx.fillStyle = W('#9c5f2e'); ctx.strokeStyle = W(INK); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(tx, ty, 6, 0, TAU); ctx.fill(); ctx.stroke();
        if (!white) { ctx.fillStyle = 'rgba(255,230,190,0.6)'; ctx.beginPath(); ctx.arc(tx - 1.8, ty - 2, 1.8, 0, TAU); ctx.fill(); }
      }
    };
    needles(this.curl);

    // stubby wool legs
    if (!this.curl) {
      for (const s of [-1, 1]) {
        const lx = cx + s * 17, ly = by - 12 + (s > 0 ? walk : -walk) * 2.5;
        ctx.fillStyle = W('#4a536b'); ctx.strokeStyle = W(INK); ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(lx, ly + 3, 11, 9.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
        if (!white) { ctx.strokeStyle = 'rgba(150,162,190,0.7)'; ctx.lineWidth = 1.4; for (const o of [-3, 2]) { ctx.beginPath(); ctx.ellipse(lx, ly + 3 + o, 9, 2.5, 0, 0.2, Math.PI - 0.2); ctx.stroke(); } }
      }
    }

    // the back arm, a short stub
    if (!this.curl) rope(ctx, [cx - f * r * 0.7, cy + 8], [cx - f * (r + 6), cy + 22], [cx - f * (r + 2), cy + 34], white, 9);

    // body: a lumpy ball of slate wool, wound in bands
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    for (let i = 0; i <= 22; i++) {
      const a = (i / 22) * TAU;
      const rr = r * (1 + 0.045 * Math.sin(i * 3.7) + 0.03 * Math.sin(i * 1.3));
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.96;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = W('#5d6883'); ctx.fill();
    if (!white) {
      ctx.save(); ctx.clip();
      ctx.rotate(this.rollAng);
      for (let i = 0; i < 9; i++) {
        const rot = i * 2.39996, ry = r * (0.25 + 0.6 * ((i * 0.618) % 1));
        for (let k = -1; k <= 1; k++) {
          ctx.strokeStyle = 'rgba(28,30,42,0.75)'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.ellipse(0, 0, r * 0.98, Math.max(2, ry + k * 4), rot, 0.3, Math.PI * 1.15); ctx.stroke();
          ctx.strokeStyle = k ? '#7b87a3' : '#97a3be'; ctx.lineWidth = 2.2; ctx.stroke();
        }
      }
      ctx.rotate(-this.rollAng);
      ctx.fillStyle = 'rgba(14,16,26,0.42)';
      ctx.beginPath(); ctx.arc(0, 0, r * 1.1, -0.35, Math.PI * 0.95); ctx.arc(-r * 0.25, -r * 0.3, r * 1.12, Math.PI * 0.88, -0.3, true); ctx.fill();
      ctx.strokeStyle = 'rgba(205,214,232,0.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.82, -2.6, -1.7); ctx.stroke();
      ctx.restore();
    }
    // fuzzy ink outline: short overlapping brush strokes with stray fibres
    ctx.strokeStyle = W(INK);
    for (let i = 0; i < 26; i++) {
      const a0 = (i / 26) * TAU, a1 = a0 + TAU / 26 * 1.2;
      ctx.lineWidth = 3 + 2 * Math.max(0, Math.sin(a0 + 0.6));
      const rr = r * (1 + 0.045 * Math.sin(i * 3.7 * 22 / 26));
      ctx.beginPath(); ctx.arc(0, 0, rr, a0, a1); ctx.stroke();
      if (i % 3 === 0) { ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(Math.cos(a0) * rr, Math.sin(a0) * rr); ctx.lineTo(Math.cos(a0 + 0.08) * (rr + 6), Math.sin(a0 + 0.08) * (rr + 6)); ctx.stroke(); }
    }
    ctx.restore();

    if (this.curl) { ctx.restore(); return; }

    // the gnarled knot on its crown
    const kx = cx - f * 6, ky = cy - r + 2;
    for (const [ox, oy, rx, ry, a] of [[-9, -4, 11, 7, -0.5], [8, -6, 10, 7, 0.6], [0, -13, 9, 8, 0]]) {
      ctx.fillStyle = W('#4a536b'); ctx.strokeStyle = W(INK); ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.ellipse(kx + ox, ky + oy, rx, ry, a, 0, TAU); ctx.fill(); ctx.stroke();
      if (!white) { ctx.strokeStyle = '#8e9ab4'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(kx + ox, ky + oy, rx * 0.6, ry * 0.45, a, 0, TAU); ctx.stroke(); }
    }
    // a loose red end trails from the knot
    if (!white) {
      ctx.strokeStyle = INK; ctx.lineWidth = 3.4;
      const sw = Math.sin(t * 2.4) * 4;
      const tr = () => { ctx.beginPath(); ctx.moveTo(kx - f * 4, ky - 10); ctx.bezierCurveTo(kx - f * 20, ky - 24, kx - f * 34 + sw, ky - 6, kx - f * 38 + sw, ky + 10); ctx.stroke(); };
      tr(); ctx.strokeStyle = '#b8323e'; ctx.lineWidth = 1.8; tr();
    }

    // face: a linen patch sewn on, two button eyes and a stitched scowl
    const lean = this.lunge * f * 5;
    const fx = cx + f * r * 0.36 + lean, fy = cy - 2;
    const pw = 19, ph = 15;
    ctx.save();
    ctx.translate(fx, fy); ctx.rotate(f * 0.06);
    ctx.fillStyle = W('#e7ddc5'); ctx.strokeStyle = W(INK); ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-pw, -ph + 3); ctx.quadraticCurveTo(-pw + 2, -ph - 2, 0, -ph - 1); ctx.quadraticCurveTo(pw - 1, -ph - 1, pw, -ph + 4);
    ctx.quadraticCurveTo(pw + 2, ph - 4, pw - 4, ph); ctx.quadraticCurveTo(0, ph + 3, -pw + 3, ph - 1); ctx.quadraticCurveTo(-pw - 2, 2, -pw, -ph + 3);
    ctx.fill(); ctx.stroke();
    if (!white) {
      // painted shade + weave
      ctx.save(); ctx.clip();
      ctx.fillStyle = 'rgba(150,130,100,0.35)'; ctx.fillRect(-pw, ph * 0.25, pw * 2, ph);
      ctx.strokeStyle = 'rgba(140,120,90,0.25)'; ctx.lineWidth = 0.7;
      for (let x = -pw; x < pw; x += 3) { ctx.beginPath(); ctx.moveTo(x, -ph); ctx.lineTo(x + 2, ph); ctx.stroke(); }
      ctx.restore();
      // running stitch around the edge
      ctx.strokeStyle = '#2b2530'; ctx.lineWidth = 1.3; ctx.setLineDash([2.5, 2.5]);
      ctx.beginPath(); ctx.ellipse(0, 0.5, pw - 3.5, ph - 3, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      // stitched brows, angled into a scowl
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const x = s * (4 + i * 3.5), y = -9 + i * (s * f > 0 ? -1.3 : 1.3) * -1;
          ctx.beginPath(); ctx.moveTo(x - 1.3, y - 1.6); ctx.lineTo(x + 1.3, y + 1.6); ctx.stroke();
        }
      }
      // stitched mouth
      ctx.lineWidth = 1.6; ctx.beginPath();
      for (let i = 0; i <= 6; i++) { const x = -9 + i * 3, y = 9 + (i % 2 ? -1.6 : 1.2) + (Math.abs(i - 3) * -0.5); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    ctx.restore();
    // button eyes (in phase 2 one tears loose and dangles on its thread)
    const hot = this.tele > 0;
    const eyes = [[-1, fx - 7.5 + f * 1.5, fy - 1.5], [1, fx + 7.5 + f * 1.5, fy - 1.5]];
    for (const [s, x, y] of eyes) {
      if (this.phase >= 2 && s === -f) {
        const sw = Math.sin(t * 3) * 3;
        const bx = x + sw, byy = y + 18;
        if (!white) {
          ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3); ctx.moveTo(x + 3, y - 3); ctx.lineTo(x - 3, y + 3); ctx.stroke();
          ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sw * 0.3, y + 10, bx, byy - 5); ctx.stroke();
        }
        button(ctx, bx, byy, 5, white, false);
      } else button(ctx, x, y, 6.5, white, hot || this.phase >= 2);
    }

    // the rope arm, drawn last so the lash reads in front
    const [ex, ey, qx, qy] = this.arm;
    const ax = cx + f * r * 0.75, ay = cy + 10;
    const wob = pose === 'lash' ? Math.sin(t * 40) * 6 : 0;
    rope(ctx, [ax, ay], [cx + f * qx, cy + qy + wob], [cx + f * ex, cy + ey], white, 10);
    // a knotted mitten of a fist
    const mx = cx + f * ex, my = cy + ey;
    ctx.fillStyle = W('#4a536b'); ctx.strokeStyle = W(INK); ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(mx, my, 9, 0, TAU); ctx.fill(); ctx.stroke();
    if (!white) { ctx.strokeStyle = '#8e9ab4'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(mx, my, 5, 0.5, 4); ctx.stroke(); }
    ctx.restore();
  }
}

// a thick twisted yarn rope along a quadratic curve
function rope(ctx, a, c, b, white, w) {
  const path = () => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]); ctx.stroke(); };
  ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = w + 4; path();
  ctx.strokeStyle = white ? '#fff' : '#5d6883'; ctx.lineWidth = w; path();
  if (!white) {
    ctx.strokeStyle = '#97a3be'; ctx.lineWidth = 1.6; ctx.setLineDash([4, 5]); path();
    ctx.strokeStyle = 'rgba(20,22,34,0.6)'; ctx.lineDashOffset = 4.5; path();
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }
}

function button(ctx, x, y, r, white, glow) {
  ctx.fillStyle = white ? '#fff' : '#120e16'; ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  if (white) return;
  ctx.strokeStyle = glow ? 'rgba(184,212,255,0.95)' : '#9a8f9e'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, TAU); ctx.stroke();
  ctx.fillStyle = glow ? '#cfe2ff' : '#8a8294';
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.beginPath(); ctx.arc(x + dx * r * 0.28, y + dy * r * 0.28, r * 0.13, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(x - r * 0.45, y - r * 0.5, r * 0.25, r * 0.14, -0.6, 0, TAU); ctx.fill();
}
