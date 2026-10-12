// The Fray bosses.
import { Boss } from './boss.js';
import { TAU, clamp } from '../core/math.js';
import { INK, eye } from '../art/creatures.js';

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
    const cx = this.cx, by = this.y + this.h;
    const r = this.w * 0.46;
    const cy = by - r - 4;
    if (this.curl) this.rollAng += 0.25 * this.facing; else this.rollAng *= 0.9;
    // legs of thread
    ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 4;
    if (!this.curl) {
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * (0.15 + i * 0.14);
        const sw = Math.sin(t * 8 + i) * 4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7);
        ctx.quadraticCurveTo(cx + Math.cos(a) * r * 1.1 + sw, cy + r * 0.9, cx + Math.cos(a) * r * 1.2 + sw, by);
        ctx.stroke();
      }
    }
    // tangled body
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rollAng);
    ctx.fillStyle = white ? '#fff' : '#2a3040';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 3; ctx.stroke();
    // scribbled threads
    const cols = white ? ['#fff'] : ['#8d9bb5', '#c7d0e0', '#59627a', '#b8323e'];
    for (let k = 0; k < 4; k++) {
      ctx.strokeStyle = cols[k % cols.length]; ctx.lineWidth = k === 3 ? 1.5 : 2;
      ctx.beginPath();
      for (let i = 0; i < 26; i++) {
        const a = i * 2.39996 + k * 1.3;
        const rr = r * (0.3 + ((i * 37 + k * 11) % 10) / 14);
        const px = Math.cos(a) * Math.min(rr, r * 0.95), py = Math.sin(a) * Math.min(rr, r * 0.95);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
    // loose threads flailing out
    ctx.strokeStyle = white ? '#fff' : '#c7d0e0'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + t * 0.6;
      const L = r * (1.3 + Math.sin(t * 3 + i) * 0.2);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
      ctx.quadraticCurveTo(cx + Math.cos(a + 0.4) * L, cy + Math.sin(a + 0.4) * L, cx + Math.cos(a + 0.2) * (L + 14), cy + Math.sin(a + 0.2) * (L + 14));
      ctx.stroke();
    }
    // mask (stays upright, peeks through the tangle)
    if (!this.curl) {
      const mx = cx + this.facing * r * 0.35 + this.lunge * this.facing * 10, my = cy - r * 0.15;
      const mr = r * 0.42;
      ctx.fillStyle = white ? '#fff' : '#ece6d6'; ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(mx - mr, my);
      ctx.quadraticCurveTo(mx - mr, my - mr * 1.25, mx, my - mr * 1.2);
      ctx.quadraticCurveTo(mx + mr, my - mr * 1.25, mx + mr, my);
      ctx.quadraticCurveTo(mx + mr * 0.7, my + mr * 1.1, mx, my + mr * 1.15);
      ctx.quadraticCurveTo(mx - mr * 0.7, my + mr * 1.1, mx - mr, my);
      ctx.fill(); ctx.stroke();
      if (!white) {
        ctx.fillStyle = INK;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(mx + s * mr * 0.4, my - mr * 0.05, mr * 0.22, mr * 0.4, s * 0.2, 0, TAU); ctx.fill(); }
        if (this.phase >= 2) for (const s of [-1, 1]) eye(ctx, mx + s * mr * 0.4, my, 2.5, '#b8d4ff', true);
        // crack across the mask in phase 2
        if (this.phase >= 2) { ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(mx - mr * 0.2, my - mr * 1.15); ctx.lineTo(mx, my - mr * 0.6); ctx.lineTo(mx - mr * 0.15, my - mr * 0.3); ctx.stroke(); }
      }
    }
  }
}
