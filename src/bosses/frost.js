// Bosses of the Frostlit Reliquary: Rimehorn (Keeper) and the Frostbound Sentinel (optional).
import { Boss } from './boss.js';
import { TAU, clamp } from '../core/math.js';
import { VIEW_W, VIEW_H } from '../core/constants.js';
import { INK, eye } from '../art/creatures.js';
import { registerProjectileArt } from '../entities/projectile.js';

// ---------------------------------------------------------------- shared ink helpers
const col = (white, c) => (white ? '#fff' : c);
function inkStroke(ctx, white, lw = 2.5, c = INK) {
  ctx.strokeStyle = white ? '#fff' : c; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}
function fillInk(ctx, fill, white, lw = 2.5) { ctx.fillStyle = white ? '#fff' : fill; ctx.fill(); inkStroke(ctx, white, lw); }
function glow(ctx, x, y, r, rgb, a = 0.5) {
  if (r <= 0 || a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}
// tapered limb: polyline drawn as ink under a colored core
function limb(ctx, pts, white, c, lw) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = col(white, INK); ctx.lineWidth = lw + 4; ctx.stroke();
  ctx.strokeStyle = col(white, c); ctx.lineWidth = lw; ctx.stroke();
}
// smooth tapered branch through points (Catmull-Rom), filled with an ink outline
function branch(ctx, pts, w0, w1, fill, white, lw = 2.5) {
  const sm = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < 5; k++) {
      const u = k / 5, u2 = u * u, u3 = u2 * u;
      sm.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3),
      ]);
    }
  }
  sm.push(pts[pts.length - 1]);
  const L = [], R = [];
  for (let i = 0; i < sm.length; i++) {
    const a = sm[Math.max(0, i - 1)], b = sm[Math.min(sm.length - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
    const w = (w0 + (w1 - w0) * (i / (sm.length - 1))) / 2;
    L.push([sm[i][0] + nx * w, sm[i][1] + ny * w]); R.push([sm[i][0] - nx * w, sm[i][1] - ny * w]);
  }
  ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
  for (const q of L) ctx.lineTo(q[0], q[1]);
  for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath();
  fillInk(ctx, fill, white, lw);
  return sm;
}
const approach = (v, t, k) => v + (t - v) * k;
// seeded jitter so hand-drawn cracks stay put between frames
function srand(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function jag(ctx, x0, y0, x1, y1, n, amp, rnd) {
  ctx.moveTo(x0, y0);
  for (let i = 1; i < n; i++) { const u = i / n; ctx.lineTo(x0 + (x1 - x0) * u + (rnd() - 0.5) * amp, y0 + (y1 - y0) * u + (rnd() - 0.5) * amp); }
  ctx.lineTo(x1, y1);
}
function ceilingAt(boss, x) {
  const room = boss.game.room;
  for (let y = boss.groundY - 90; y > 0; y -= 6) if (room.rectBlocked(x - 2, y, 4, 4)) return y + 8;
  return boss.arena.y;
}

// ---------------------------------------------------------------- projectile art
// erupting ice spike (rect zone; grows from its floor edge, then shatters)
registerProjectileArt('rh_spike', (ctx, p, t) => {
  const r = p.rect();
  const total = p.age + p.life;
  const grow = Math.min(1, p.age / 0.07);
  const fade = p.life < 0.15 ? p.life / 0.15 : 1;
  const bx = r.x + r.w / 2, by = r.y + r.h, H = r.h * grow;
  ctx.globalAlpha = fade;
  glow(ctx, bx, by - H * 0.5, r.w * 1.6, '190,240,255', 0.35);
  const shard = (dx, h, w, lean) => {
    ctx.beginPath();
    ctx.moveTo(bx + dx - w, by); ctx.lineTo(bx + dx + lean, by - h); ctx.lineTo(bx + dx + w, by); ctx.closePath();
    ctx.fillStyle = '#cdefff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(bx + dx - w * 0.3, by - 4); ctx.lineTo(bx + dx + lean * 0.8, by - h * 0.85); ctx.stroke();
  };
  shard(-r.w * 0.32, H * 0.55, r.w * 0.22, -6);
  shard(r.w * 0.34, H * 0.62, r.w * 0.22, 7);
  shard(0, H, r.w * 0.32, 2);
  ctx.globalAlpha = 1;
  void total; void t;
});
registerProjectileArt('rh_icicle', (ctx, p) => {
  const L = p.r * 4.4;
  ctx.save(); ctx.translate(p.cx, p.cy);
  glow(ctx, 0, 0, p.r * 3, '200,240,255', 0.3);
  ctx.beginPath(); ctx.moveTo(-p.r * 0.9, -L * 0.6); ctx.lineTo(p.r * 0.9, -L * 0.6); ctx.lineTo(0, L * 0.45); ctx.closePath();
  ctx.fillStyle = '#d8f6ff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-p.r * 0.35, -L * 0.5); ctx.lineTo(0, L * 0.25); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(220,245,255,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(p.cx, p.cy - L * 0.6); ctx.lineTo(p.cx, p.cy - L * 1.4); ctx.stroke();
});
registerProjectileArt('rh_shard', (ctx, p) => {
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.rot);
  glow(ctx, 0, 0, p.r * 2.6, '190,240,255', 0.3);
  ctx.beginPath(); ctx.moveTo(p.r * 1.9, 0); ctx.lineTo(0, -p.r * 0.75); ctx.lineTo(-p.r * 1.3, 0); ctx.lineTo(0, p.r * 0.75); ctx.closePath();
  ctx.fillStyle = '#cdefff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-p.r * 0.6, 0); ctx.lineTo(p.r * 1.2, 0); ctx.stroke();
  ctx.restore();
});
registerProjectileArt('fs_lance', (ctx, p) => {
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.rot);
  glow(ctx, 0, 0, 34, '170,230,255', 0.3);
  ctx.strokeStyle = 'rgba(210,245,255,0.4)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-90, 0); ctx.stroke();
  drawIceLance(ctx, 0, 0, 0, false, 1);
  ctx.restore();
});
// ice pillar erupting from a freeze glyph
registerProjectileArt('fs_pillar', (ctx, p, t) => {
  const r = p.rect();
  const grow = Math.min(1, p.age / 0.09);
  const fade = p.life < 0.18 ? p.life / 0.18 : 1;
  const bx = r.x + r.w / 2, by = r.y + r.h, H = r.h * grow;
  ctx.globalAlpha = fade;
  glow(ctx, bx, by - H / 2, r.w * 1.5, '180,235,255', 0.4);
  ctx.beginPath();
  ctx.moveTo(bx - r.w * 0.45, by); ctx.lineTo(bx - r.w * 0.38, by - H * 0.82); ctx.lineTo(bx - r.w * 0.1, by - H);
  ctx.lineTo(bx + r.w * 0.18, by - H * 0.9); ctx.lineTo(bx + r.w * 0.42, by - H * 0.7); ctx.lineTo(bx + r.w * 0.45, by);
  ctx.closePath();
  ctx.fillStyle = 'rgba(205,239,255,0.92)'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(bx - r.w * 0.2, by - 6); ctx.lineTo(bx - r.w * 0.15, by - H * 0.85); ctx.moveTo(bx + r.w * 0.15, by - H * 0.2); ctx.lineTo(bx + r.w * 0.25, by - H * 0.6); ctx.stroke();
  ctx.strokeStyle = 'rgba(90,168,200,0.8)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(bx - r.w * 0.38, by - H * 0.5); ctx.lineTo(bx + r.w * 0.05, by - H * 0.42); ctx.lineTo(bx + r.w * 0.4, by - H * 0.55); ctx.stroke();
  ctx.globalAlpha = 1;
  void t;
});

// An ice javelin, tip at +x. Used by the Sentinel's halo and its thrown lances.
function drawIceLance(ctx, x, y, ang, white, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(34, 0); ctx.lineTo(14, -6); ctx.lineTo(10, -2.5); ctx.lineTo(-30, -2.5); ctx.lineTo(-36, 0); ctx.lineTo(-30, 2.5); ctx.lineTo(10, 2.5); ctx.lineTo(14, 6);
  ctx.closePath();
  ctx.fillStyle = col(white, '#cdefff'); ctx.fill();
  ctx.strokeStyle = col(white, INK); ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
  if (!white) { ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-26, -0.5); ctx.lineTo(30, -0.5); ctx.stroke(); }
  ctx.restore();
}

// =====================================================================================
// RIMEHORN — The Frozen Stag.
// An enormous stag of frost with antlers like a frozen forest. Charges, splits the floor
// with erupting ice, calls down icicles, breathes a freezing cone and leaps to stomp.
// Phase 2 his antlers wake; phase 3 he calls the blizzard (whiteout pulses, faster).
// =====================================================================================
const RH = { fur: '#24384a', furDark: '#152330', mane: '#dceff7', skull: '#eef3ee', antler: '#bfe6f5', ice: '#8fe6ff', hoof: '#0e1820' };

export class Rimehorn extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'rimehorn', size: [200, 150], music: 'boss_keeper', glints: 340 });
    this.pose = { head: 0, rear: 0, crouch: 0, paw: 0, tuck: 0 };
    this.tgt = { head: 0, rear: 0, crouch: 0, paw: 0, tuck: 0 };
    this.gait = 0;
    this.clock = 0;
    this.pending = [];   // ice spikes waiting to erupt
    this.cracks = [];    // running floor cracks
    this.icicles = [];   // icicles forming on the ceiling
    this.breath = null;
    this.shadow = null;
    this.antlerGlow = 0;
    this.blizzard = false;
    this.blizT = 0;
    this.white = 0;
    this.pendingRoar = 0;
    this.lastSpikeSfx = 0;
  }

  // ---------------- posing & transforms
  animate(dt) {
    const k = Math.min(1, dt * 9);
    for (const key in this.tgt) this.pose[key] = approach(this.pose[key], this.tgt[key], k);
    this.clock += dt;
    const glowT = this.phase >= 2 ? 1 : 0;
    this.antlerGlow = approach(this.antlerGlow, glowT, dt * 2);
    // frosty breath from the nostrils
    if (this.mode !== 'dying' && Math.random() < dt * 5 && !this.breath) {
      const m = this.mouth();
      this.fx.add({ x: m.x, y: m.y, vx: this.facing * (20 + Math.random() * 30), vy: -10 - Math.random() * 20, life: 1.1, size: 5 + Math.random() * 4, color: 'rgba(225,245,255,0.35)', g: -20, drag: 1, front: false });
    }
  }
  // map a point in the stag's local art frame to world coords (mirrors drawBody's transforms)
  toWorld(lx, ly, head = true) {
    const P = this.pose;
    let x = lx, y = ly;
    if (head) {
      const a = P.head * 0.62; const px = 58, py = -128;
      const dx = x - px, dy = y - py;
      x = px + dx * Math.cos(a) - dy * Math.sin(a); y = py + dx * Math.sin(a) + dy * Math.cos(a);
    }
    y += P.crouch * 22;
    {
      const a = -P.rear * 0.24; const px = -74, py = 0;
      const dx = x - px, dy = y - py;
      x = px + dx * Math.cos(a) - dy * Math.sin(a); y = py + dx * Math.sin(a) + dy * Math.cos(a);
    }
    return { x: this.cx + x * this.facing, y: this.y + this.h + y };
  }
  mouth() { return this.toWorld(160, -150); }
  antlerTip() { return this.toWorld(50, -380); }
  idle(dt) { this.animate(dt); }
  introUpdate(dt, t) {
    this.animate(dt);
    if (t < 0.3) this.tgt.head = 0.3;
    else if (t < 1.6) { this.tgt.rear = 1; this.tgt.head = -0.5; this.antlerGlow = Math.min(1, this.antlerGlow + dt); }
    else { this.tgt.rear = 0; this.tgt.head = 0; }
    if (t > 0.45 && t - dt <= 0.45) { this.shake(10, 1.2); this.sfx('bossRoar'); this.fx.ring(this.mouth().x, this.mouth().y, 30, 400, 0.9, 'rgba(220,245,255,0.7)', 6); }
  }
  think(dt) {
    this.animate(dt);
    this.updateHazards(dt);
    if (this.blizzard) this.updateBlizzard(dt);
  }

  updateHazards(dt) {
    const c = this.clock;
    let erupted = 0;
    for (const s of this.pending) {
      if (!s.done && c >= s.te) {
        s.done = true;
        if (this.mode === 'fight') {
          this.zone(s.x - 22, this.groundY - s.h, 44, s.h, 0.5, { art: 'rh_spike' });
          this.fx.burst(s.x, this.groundY - 6, 5, { color: '#d8f6ff', speed: 220, angle: -Math.PI / 2, spread: 1.6, size: 2.5, life: 0.4, shape: 'shard' });
          erupted++;
        }
      }
    }
    if (erupted && c - this.lastSpikeSfx > 0.09) { this.sfx('crystalBreak'); this.lastSpikeSfx = c; }
    this.pending = this.pending.filter((s) => !s.done);
    this.cracks = this.cracks.filter((k) => c < k.end);
    for (const ic of this.icicles) {
      ic.t -= dt;
      if (ic.t <= 0 && !ic.fell) {
        ic.fell = true;
        if (this.mode === 'fight') {
          this.fire(ic.x, ic.y + ic.len * 0.5, 0, 80, { gravity: 1900, art: 'rh_icicle', r: 10, noScale: true, life: 3, onDie: (p) => this.icicleShatter(p) });
        }
      }
    }
    this.icicles = this.icicles.filter((ic) => !ic.fell);
  }
  updateBlizzard(dt) {
    this.blizT += dt;
    const period = 6.2 / this.speedMul;
    const u = this.blizT % period;
    let w = 0;
    if (u < 0.6) w = u / 0.6; else if (u < 1.5) w = 1; else if (u < 2.6) w = 1 - (u - 1.5) / 1.1;
    this.white = w * 0.7;
    if (w > 0.95 && Math.random() < dt * 4) this.sfx('howl', 0.4);
    // driving snow
    const cam = this.game.camera;
    const n = Math.random() < 0.5 + w * 0.5 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      this.fx.add({ x: cam.viewX - 20, y: cam.viewY + Math.random() * VIEW_H, vx: 700 + Math.random() * 400, vy: 80 + Math.random() * 80, life: 1.6, size: 1.5 + Math.random() * 2.5, color: 'rgba(240,250,255,0.85)', g: 0, drag: 0, shape: 'streak', front: true });
    }
  }

  // ---------------- attack selection
  attackList() {
    const p = this.phase, near = this.distX() < 260;
    return [
      { name: 'charge', w: 3, fn: this.antlerCharge },
      { name: 'spikes', w: 2.6, fn: this.iceSpikes },
      { name: 'icicles', w: 2, fn: this.icicleRain },
      { name: 'breath', w: near ? 2.8 : 2, fn: this.frostBreath },
      { name: 'leap', w: near ? 1.4 : 2.6, fn: this.leapStomp },
      { name: 'crown', w: p >= 2 ? 2.2 : 0, fn: this.antlerVolley },
    ].filter((a) => a.w > 0);
  }
  chooseAttack() {
    if (this.pendingRoar) { const n = this.pendingRoar; this.pendingRoar = 0; return this.roar(n); }
    return super.chooseAttack();
  }
  onPhase(n) { this.pendingRoar = n; }

  *roar(n) {
    this.facePlayer();
    this.tgt.rear = 1; this.tgt.head = -0.5; this.tele = 0.8;
    yield 0.45;
    this.sfx('bossRoar'); this.shake(12, 1.3);
    const m = this.mouth();
    this.fx.ring(m.x, m.y, 30, 460, 1.0, 'rgba(220,245,255,0.8)', 8);
    if (n >= 3) {
      this.blizzard = true; this.blizT = 0;
      this.speedMul *= 1.2;
      this.game.flash('rgba(240,250,255,0.9)', 1.0);
    } else {
      this.fx.burst(this.antlerTip().x, this.antlerTip().y, 24, { color: '#d8f6ff', speed: 260, size: 3, life: 0.9, glow: true });
    }
    yield 0.5;
    const xs = [this.player.cx, this.player.cx - 160, this.player.cx + 160];
    xs.forEach((x, i) => this.formIcicle(x, i * 0.15));
    yield 0.4;
    this.tgt.rear = 0; this.tgt.head = 0;
    yield 0.6;
  }

  // ---- 1. Antler charge
  antlerBox() {
    const front = this.facing > 0 ? this.x + this.w - 20 : this.x - 90;
    return { x: front, y: this.groundY - 150, w: 110, h: 112 };
  }
  *antlerCharge() {
    this.facePlayer();
    this.tgt.head = 0.75; this.tele = 0.65;
    this.sfx('charge');
    for (let i = 0; i < 3; i++) {
      this.tgt.paw = 1; yield 0.11;
      this.tgt.paw = 0; this.snowKick(this.cx + this.facing * 70, -this.facing); yield 0.11;
    }
    const runs = this.phase >= 3 ? 2 : 1;
    for (let r = 0; r < runs; r++) {
      if (r > 0) {
        this.facing = -this.facing; this.tgt.head = 0.75; this.tele = 0.5; this.sfx('charge');
        this.snowKick(this.cx, this.facing);
        yield 0.5;
      }
      this.sfx('bossRoar', 0.6);
      const sp = (640 + this.phase * 80) * this.speedMul;
      for (;;) {
        this.x += this.facing * sp / 60;
        this.gait += 0.32;
        this.hits.push(this.antlerBox());
        if (Math.random() < 0.6) this.snowKick(this.cx - this.facing * 60, -this.facing, 2);
        const lo = this.arena.x, hi = this.arena.x + this.arena.w - this.w;
        if (this.x <= lo || this.x >= hi) { this.x = clamp(this.x, lo, hi); break; }
        yield;
      }
      this.sfx('slam'); this.sfx('crystalBreak'); this.shake(13, 0.5);
      const wx = this.facing > 0 ? this.x + this.w + 20 : this.x - 20;
      this.fx.burst(wx, this.groundY - 110, 26, { color: '#d8f6ff', speed: 380, size: 3.5, life: 0.8, shape: 'shard' });
      // the impact shakes icicles loose
      const n = 2 + this.phase;
      for (let i = 0; i < n; i++) this.formIcicle(i === 0 ? this.player.cx : this.rand(this.arena.x + 60, this.arena.x + this.arena.w - 60), i * 0.1);
    }
    this.tgt.head = 0.4;
    yield 1.0; // antlers lodged: punish window
    this.tgt.head = 0;
    yield 0.3;
  }
  snowKick(x, dir, n = 6) {
    this.fx.burst(x, this.groundY - 4, n, { color: 'rgba(225,245,255,0.85)', speed: 200, angle: dir > 0 ? -0.5 : Math.PI + 0.5, spread: 1.2, size: 3, life: 0.5, g: 500 });
  }

  // ---- 2. Ice spikes: rears, stamps; cracks race outward and spikes follow
  *iceSpikes() {
    this.facePlayer();
    this.tgt.rear = 1; this.tgt.head = -0.25; this.tele = 0.6; this.sfx('charge');
    yield 0.6;
    this.tgt.rear = 0; this.tgt.head = 0.2;
    yield 0.13;
    this.sfx('slam'); this.shake(9, 0.4);
    const x0 = this.cx + this.facing * 80;
    this.snowKick(x0, 1, 8); this.snowKick(x0, -1, 8);
    const count = this.phase >= 2 ? 14 : 10;
    this.spikeWave(x0, 1, count, 60, 520, 0.42, 0);
    this.spikeWave(x0, -1, count, 60, 520, 0.42, 0);
    if (this.phase >= 2) {
      yield 0.75;
      this.sfx('slam'); this.shake(6, 0.3);
      this.spikeWave(x0 + 30, 1, count, 60, 560, 0.42, 0);
      this.spikeWave(x0 - 30, -1, count, 60, 560, 0.42, 0);
    }
    if (this.phase >= 3) {
      yield 0.5;
      const px = this.player.cx;
      this.spikeWave(px, 1, 2, 44, 300, 0.5, -1);
      this.spikeWave(px, -1, 2, 44, 300, 0.5, -1);
    }
    yield 1.0;
    this.tgt.head = 0;
    yield 0.3;
  }
  // a crack that runs along the floor; each segment erupts `delay` after the crack reaches it
  spikeWave(x0, dir, n, spacing, speed, delay, startIndex = 1) {
    const A = this.arena;
    let last = x0;
    for (let i = Math.max(0, startIndex); i <= n; i++) {
      const x = x0 + dir * (i * spacing);
      if (x < A.x + 16 || x > A.x + A.w - 16) break;
      const tc = this.clock + Math.abs(x - x0) / speed;
      this.pending.push({ x, tc, te: tc + delay, h: 82 + ((i * 37) % 5) * 9 });
      last = x;
    }
    const len = Math.abs(last - x0);
    this.cracks.push({ x0, dir, t0: this.clock, speed, len, end: this.clock + len / speed + delay + 0.35, seed: (Math.random() * 1e9) | 0 });
  }

  // ---- 3. Icicles: a bellow at the vault; icicles form, shiver, and fall
  formIcicle(x, delay = 0) {
    x = clamp(x, this.arena.x + 24, this.arena.x + this.arena.w - 24);
    const tt = 0.8 + delay;
    this.icicles.push({ x, y: ceilingAt(this, x), t: tt, max: tt, len: this.rand(38, 54) });
  }
  icicleShatter(p) {
    this.fx.burst(p.cx, p.cy, 10, { color: '#d8f6ff', speed: 240, size: 3, life: 0.5, shape: 'shard' });
    this.sfx('glassHit', 0.5);
    if (this.phase >= 2 && this.mode === 'fight') {
      for (const s of [-1, 1]) this.fire(p.cx, p.cy - 8, s * this.rand(150, 220), -260, { gravity: 1300, art: 'rh_shard', r: 6, noScale: true, life: 2 });
    }
  }
  *icicleRain() {
    this.facePlayer();
    this.tgt.rear = 0.55; this.tgt.head = -0.55; this.tele = 0.55;
    yield 0.55;
    this.sfx('bossRoar', 0.7); this.shake(5, 0.8);
    const n = 3 + this.phase * 2;
    const xs = [this.player.cx];
    for (let tries = 0; xs.length < n && tries < 60; tries++) {
      const x = this.rand(this.arena.x + 40, this.arena.x + this.arena.w - 40);
      if (xs.every((q) => Math.abs(q - x) > 78)) xs.push(x);
    }
    xs.forEach((x, i) => this.formIcicle(x, i * 0.11));
    yield 0.6;
    this.tgt.rear = 0; this.tgt.head = 0;
    yield 0.9;
  }

  // ---- 4. Freezing breath: inhale (frost spirals into the jaw), then a cone
  *frostBreath() {
    this.facePlayer();
    this.tgt.head = -0.25; this.tele = 0.7; this.sfx('rustle');
    for (let t = 0; t < 0.7; t += 1 / 60) {
      const m = this.mouth();
      if (Math.random() < 0.7) {
        const a = Math.random() * TAU, d = 90 + Math.random() * 60;
        this.fx.add({ x: m.x + Math.cos(a) * d, y: m.y + Math.sin(a) * d, vx: -Math.cos(a) * d * 2.6, vy: -Math.sin(a) * d * 2.6, life: 0.36, size: 2.5, color: '#e6f8ff', g: 0, drag: 0, front: true, glow: true });
      }
      yield;
    }
    const aimAt = () => {
      const m = this.mouth(), p = this.player;
      return clamp(Math.atan2(p.cy - m.y, (p.cx - m.x) * this.facing), -0.75, 0.85);
    };
    this.breath = { ang: aimAt(), t: 0 };
    this.tgt.head = 0.1;
    this.sfx('howl'); this.shake(4, 1.2);
    const dur = this.phase >= 2 ? 1.4 : 1.1;
    for (let t = 0; t < dur; t += 1 / 60) {
      this.breath.t = t;
      if (this.phase >= 2) { const want = aimAt(); this.breath.ang += clamp(want - this.breath.ang, -0.55 / 60, 0.55 / 60); }
      const m = this.mouth();
      const dx = Math.cos(this.breath.ang) * this.facing, dy = Math.sin(this.breath.ang);
      for (let d = 50; d <= 420; d += 52) {
        const half = 12 + d * 0.2;
        this.hits.push({ x: m.x + dx * d - half, y: m.y + dy * d - half, w: half * 2, h: half * 2 });
      }
      for (let i = 0; i < 3; i++) {
        const sp = 500 + Math.random() * 300, spread = (Math.random() - 0.5) * 0.45;
        const a = Math.atan2(dy, dx) + spread;
        this.fx.add({ x: m.x, y: m.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.7, size: 4 + Math.random() * 5, color: 'rgba(225,245,255,0.55)', g: 0, drag: 1.2, front: true });
      }
      yield;
    }
    this.breath = null;
    this.tgt.head = 0;
    yield 0.85;
  }

  // ---- 5. Leaping stomp: crouch, a huge leap (shadow marks the landing), quake
  *leapStomp() {
    this.facePlayer();
    this.tgt.crouch = 1; this.tgt.head = 0.25; this.tele = 0.5; this.sfx('charge');
    yield 0.5;
    const tx = clamp(this.player.cx, this.arena.x + this.w / 2, this.arena.x + this.arena.w - this.w / 2);
    this.shadow = { x: tx };
    this.tgt.crouch = 0; this.tgt.tuck = 1; this.tgt.head = -0.2;
    this.sfx('leap'); this.snowKick(this.cx, 1, 8); this.snowKick(this.cx, -1, 8);
    yield* this.leapTo(tx, 300, 1.0);
    this.shadow = null; this.tgt.tuck = 0; this.tgt.crouch = 0.8;
    this.sfx('slam'); this.shake(14, 0.6);
    this.snowKick(this.cx - 60, -1, 12); this.snowKick(this.cx + 60, 1, 12);
    const wc = 'rgba(210,240,255,0.9)';
    this.shockwave(this.cx - 80, -1, 440, 30, { color: wc });
    this.shockwave(this.cx + 80, 1, 440, 30, { color: wc });
    if (this.phase >= 2) {
      this.spikeWave(this.cx + 120, 1, 3, 56, 420, 0.35, 0);
      this.spikeWave(this.cx - 120, -1, 3, 56, 420, 0.35, 0);
    }
    yield 0.3;
    this.tgt.crouch = 0;
    yield 0.8;
  }

  // ---- 6. Antler volley (phase 2+): the crown sheds a rain of ice shards
  *antlerVolley() {
    this.facePlayer();
    this.tgt.rear = 0.5; this.tgt.head = -0.45; this.tele = 0.65;
    this.sfx('rustle');
    yield 0.65;
    this.tgt.head = 0.35; this.sfx('crystalBreak'); this.shake(5, 0.3);
    const tip = this.antlerTip();
    const n = this.phase >= 3 ? 9 : 7;
    const spread = 118;
    const off = this.rand(-40, 40);
    const g = 1250;
    for (let i = 0; i < n; i++) {
      const tx = clamp(this.player.cx + off + (i - (n - 1) / 2) * spread, this.arena.x + 20, this.arena.x + this.arena.w - 20);
      const T = 1.0 + Math.abs(tx - tip.x) / 3000;
      this.fire(tip.x, tip.y, (tx - tip.x) / T, (this.groundY - tip.y - 0.5 * g * T * T) / T, { gravity: g, art: 'rh_shard', r: 9, noScale: true, life: 4 });
    }
    this.fx.burst(tip.x, tip.y, 20, { color: '#e6f8ff', speed: 300, size: 3, life: 0.7, glow: true });
    yield 0.5;
    this.tgt.rear = 0; this.tgt.head = 0;
    yield 0.8;
  }

  onDeath() { this.pending = []; this.icicles = []; this.cracks = []; this.breath = null; this.shadow = null; this.blizzard = false; this.white = 0; }

  bodyBox() { return { x: this.x + 18, y: this.y + 10, w: this.w - 36, h: this.h - 10 }; }
  headBox() { const h = this.toWorld(120, -170); return { x: h.x - 40, y: h.y - 40, w: 80, h: 80 }; }
  hurtboxes() { return [this.bodyBox(), this.headBox()]; }

  // ---------------- drawing
  drawExtra(ctx, t) {
    const gy = this.groundY;
    // landing shadow
    if (this.shadow) {
      ctx.fillStyle = 'rgba(10,20,30,0.45)';
      ctx.beginPath(); ctx.ellipse(this.shadow.x, gy - 2, 110, 12, 0, 0, TAU); ctx.fill();
      glow(ctx, this.shadow.x, gy - 2, 90, '190,235,255', 0.15 + 0.1 * Math.sin(t * 20));
    }
    // blizzard whiteout (under projectiles and Bead, over the world)
    if (this.white > 0.01) {
      const cam = this.game.camera;
      ctx.fillStyle = `rgba(236,247,255,${this.white})`;
      ctx.fillRect(cam.viewX - 10, cam.viewY - 10, VIEW_W + 20, VIEW_H + 20);
      // his eyes burn through the white
      const e = this.toWorld(126, -176);
      glow(ctx, e.x, e.y, 60, '120,220,255', 0.6 * this.white + 0.2);
      eye(ctx, e.x, e.y, 4, '#7fe0ff', true, 'angry');
    }
    // running cracks
    for (const c of this.cracks) {
      const front = Math.min(c.len, (this.clock - c.t0) * c.speed);
      if (front <= 0) continue;
      const rnd = srand(c.seed);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(160,230,255,0.85)'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      jag(ctx, c.x0, gy - 2, c.x0 + c.dir * front, gy - 2, Math.max(2, Math.round(front / 14)), 5, rnd);
      ctx.stroke();
      ctx.restore();
    }
    // spike tells: glowing star-cracks that brighten until they erupt
    for (const s of this.pending) {
      if (this.clock < s.tc) continue;
      const k = clamp((this.clock - s.tc) / (s.te - s.tc), 0, 1);
      glow(ctx, s.x, gy - 4, 26 + k * 20, '170,235,255', 0.25 + 0.45 * k);
      const rnd = srand((s.x * 7) | 0);
      ctx.strokeStyle = `rgba(230,250,255,${0.5 + 0.5 * k})`; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) { const a = Math.PI + (i + 0.5) / 4 * Math.PI; jag(ctx, s.x, gy - 2, s.x + Math.cos(a) * (10 + k * 12), gy - 2 + Math.sin(a) * (4 + k * 10), 3, 3, rnd); }
      ctx.stroke();
      if (k > 0.6) { ctx.fillStyle = '#e6f8ff'; ctx.beginPath(); ctx.moveTo(s.x - 5, gy); ctx.lineTo(s.x, gy - 10 * k); ctx.lineTo(s.x + 5, gy); ctx.fill(); }
    }
    // icicles forming on the ceiling
    for (const ic of this.icicles) {
      const k = clamp(1 - ic.t / ic.max, 0, 1);
      const L = ic.len * Math.min(1, k * 1.6);
      const sh = k > 0.55 ? Math.sin(t * 60 + ic.x) * 2 * k : 0;
      const x = ic.x + sh;
      glow(ctx, x, ic.y + L * 0.4, 30, '200,240,255', 0.15 + 0.35 * k);
      ctx.beginPath(); ctx.moveTo(x - 9, ic.y); ctx.lineTo(x + 9, ic.y); ctx.lineTo(x, ic.y + L); ctx.closePath();
      ctx.fillStyle = '#d8f6ff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      // falling-line hint
      if (k > 0.5) {
        ctx.strokeStyle = `rgba(200,240,255,${(k - 0.5) * 0.5})`; ctx.lineWidth = 1; ctx.setLineDash([4, 10]);
        ctx.beginPath(); ctx.moveTo(x, ic.y + L + 6); ctx.lineTo(x, gy); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    // breath cone
    if (this.breath) {
      const m = this.mouth();
      const a = this.breath.ang, f = this.facing;
      const L = 430, w = 0.24;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(m.x, m.y, 10, m.x, m.y, L);
      g.addColorStop(0, 'rgba(240,252,255,0.75)'); g.addColorStop(0.6, 'rgba(170,230,255,0.35)'); g.addColorStop(1, 'rgba(170,230,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(m.x, m.y);
      for (let i = 0; i <= 10; i++) {
        const aa = a + (i / 10 - 0.5) * 2 * w + Math.sin(t * 30 + i) * 0.02;
        ctx.lineTo(m.x + Math.cos(aa) * L * f, m.y + Math.sin(aa) * L);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  drawBody(ctx, t, white) {
    const f = this.facing, P = this.pose, a = this.anim;
    ctx.save();
    ctx.translate(this.cx, this.y + this.h);
    ctx.scale(f, 1);
    const br = Math.sin(a * 1.8);
    // rear pivot at hind hooves, crouch lowers the body
    ctx.translate(-74, 0); ctx.rotate(-P.rear * 0.24); ctx.translate(74, 0);
    ctx.translate(0, P.crouch * 22);
    const moving = this.gait;
    this.drawLeg(ctx, white, -64, -96, true, false, moving + Math.PI, a);
    this.drawLeg(ctx, white, 46, -94, false, false, moving + Math.PI * 0.5, a);
    // far antler and head are drawn later; tail
    ctx.beginPath(); ctx.moveTo(-90, -122); ctx.quadraticCurveTo(-112, -128 + Math.sin(a * 3) * 4, -108, -108); ctx.quadraticCurveTo(-98, -112, -90, -112);
    fillInk(ctx, RH.mane, white, 2.2);
    // torso
    ctx.beginPath();
    ctx.moveTo(-96, -116);
    ctx.bezierCurveTo(-92, -150 - br * 2, 20, -152 - br * 2, 62, -138);
    ctx.bezierCurveTo(84, -128, 86, -92, 66, -80);
    ctx.bezierCurveTo(30, -66 + br, -40, -64, -78, -78);
    ctx.bezierCurveTo(-98, -88, -100, -104, -96, -116);
    ctx.closePath();
    fillInk(ctx, RH.fur, white, 3.5);
    if (!white) {
      // shaggy underbelly fringe
      ctx.fillStyle = RH.furDark;
      ctx.beginPath(); ctx.moveTo(-80, -80);
      for (let i = 0; i <= 12; i++) { const x = -80 + i * 12.5; ctx.lineTo(x, -70 - (i % 2) * 7 + Math.sin(a * 2 + i) * 1.5); }
      ctx.lineTo(66, -84); ctx.closePath(); ctx.fill();
      // fur strokes
      ctx.strokeStyle = '#3a5468'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 14; i++) {
        const x = -80 + ((i * 47) % 150), y = -126 + ((i * 29) % 44);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 5, y + 5, x - 4, y + 11); ctx.stroke();
      }
      // frost along the spine
      ctx.strokeStyle = 'rgba(220,245,255,0.7)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-90, -124); ctx.bezierCurveTo(-60, -148, 20, -150, 58, -136); ctx.stroke();
    }
    // ice crystals growing from the back
    const nC = this.phase >= 2 ? 7 : 5;
    for (let i = 0; i < nC; i++) {
      const x = -70 + i * (120 / (nC - 1)), y = -146 + Math.abs(i - (nC - 1) / 2) * 2.5;
      const h = 18 + ((i * 7) % 4) * 6 + (this.phase >= 2 ? 6 : 0);
      ctx.beginPath(); ctx.moveTo(x - 6, y + 6); ctx.lineTo(x - 1 + (i % 2 ? 3 : -3), y - h); ctx.lineTo(x + 6, y + 6); ctx.closePath();
      fillInk(ctx, RH.antler, white, 2);
      if (!white && this.antlerGlow > 0.05) glow(ctx, x, y - h * 0.5, 16, '140,225,255', 0.3 * this.antlerGlow);
    }
    // near legs
    this.drawLeg(ctx, white, -54, -94, true, true, moving, a);
    this.drawLeg(ctx, white, 56, -92, false, true, moving + Math.PI * 1.5, a);
    this.drawHead(ctx, white, t, a);
    ctx.restore();
  }

  drawLeg(ctx, white, hx, hy, hind, near, ph, a) {
    const P = this.pose;
    const lift = Math.max(0, Math.sin(ph)) * 16 * Math.min(1, this.gait ? 1 : 0);
    const swing = Math.cos(ph) * 16;
    let fx = hx + (hind ? -6 : 8) + (this.gait ? swing : 0), fy = -lift;
    // rearing lifts the forelegs; pawing scrapes one; tuck folds them in the air
    if (!hind && P.rear > 0.15) { fx = hx + 34 * P.rear; fy = -60 * P.rear + Math.sin(a * 10 + (near ? 0 : 2)) * 6 * P.rear; }
    if (!hind && near && P.paw > 0.05) { fx += 18 * P.paw; fy = -26 * P.paw; }
    if (P.tuck > 0.05) { fx = hx + (hind ? -26 : 26) * P.tuck + (fx - hx) * (1 - P.tuck); fy = fy * (1 - P.tuck) - 54 * P.tuck; }
    fy -= P.crouch * 0; // crouch bends the knees instead (the whole body is lowered)
    const c = near ? RH.fur : RH.furDark;
    const cr = P.crouch;
    let pts;
    if (hind) {
      pts = [[hx, hy + 6], [hx + 14 + cr * 8, -62 + cr * 10], [hx - 12 + (fx - hx) * 0.3, -34 + fy * 0.5 + cr * 4], [fx - 2, fy - 12], [fx, fy - 2]];
      branch(ctx, pts, near ? 34 : 28, 8, c, white, 2.8);
    } else {
      pts = [[hx, hy + 6], [hx + 4 + (fx - hx) * 0.3, -58 + fy * 0.4 + cr * 8], [hx + 2 + (fx - hx) * 0.7, -32 + fy * 0.7 + cr * 4], [fx, fy - 12], [fx, fy - 2]];
      branch(ctx, pts, near ? 26 : 22, 8, c, white, 2.8);
    }
    // hoof
    ctx.beginPath(); ctx.moveTo(fx - 8, fy); ctx.lineTo(fx - 6, fy - 12); ctx.lineTo(fx + 7, fy - 12); ctx.lineTo(fx + 10, fy);
    ctx.closePath(); fillInk(ctx, RH.hoof, white, 2.2);
    // frost fetlock tuft
    if (!white) {
      ctx.fillStyle = RH.mane; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(fx - 7, fy - 14); ctx.lineTo(fx + 6, fy - 16); ctx.lineTo(fx + 2, fy - 8); ctx.lineTo(fx - 2, fy - 11); ctx.lineTo(fx - 6, fy - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  drawHead(ctx, white, t, a) {
    const P = this.pose;
    ctx.save();
    ctx.translate(58, -128); ctx.rotate(P.head * 0.62 + Math.sin(a * 1.2) * 0.02); ctx.translate(-58, 128);
    this.drawAntler(ctx, white, a, false);
    // neck: a thick shaggy column rising to the skull
    ctx.beginPath();
    ctx.moveTo(24, -140);
    ctx.bezierCurveTo(40, -174, 70, -200, 102, -202);
    ctx.lineTo(128, -168);
    ctx.bezierCurveTo(110, -148, 96, -118, 88, -88);
    ctx.lineTo(48, -98);
    ctx.closePath();
    fillInk(ctx, RH.fur, white, 3);
    // shaggy fringe on the nape
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const u = i / 6;
      const x = 32 + u * 62, y = -150 - u * 46 + (u * u) * -4;
      ctx.lineTo(x - 6 - (i % 2) * 8, y - (i % 2) * 10 + Math.sin(a * 2 + i) * 1.5);
    }
    ctx.lineTo(100, -190); ctx.lineTo(40, -138); ctx.closePath();
    fillInk(ctx, RH.furDark, white, 2);
    // frost mane: a ragged white ruff down the throat
    ctx.beginPath();
    ctx.moveTo(120, -162);
    for (let i = 0; i <= 11; i++) {
      const u = i / 11;
      const x = 120 - u * 60 + (i % 2) * 14 + Math.sin(a * 2.5 + i) * 2;
      const y = -162 + u * 86 + (i % 2) * 5;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(52, -88); ctx.quadraticCurveTo(84, -120, 106, -158); ctx.closePath();
    fillInk(ctx, RH.mane, white, 2.5);
    if (!white) {
      ctx.strokeStyle = '#9fb8c4'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(100 - i * 12, -150 + i * 18); ctx.lineTo(108 - i * 12, -140 + i * 18); ctx.stroke(); }
    }
    // ear
    ctx.beginPath(); ctx.moveTo(98, -194); ctx.quadraticCurveTo(76, -214 + Math.sin(a * 4) * 3, 72, -204); ctx.quadraticCurveTo(84, -196, 96, -186);
    fillInk(ctx, RH.fur, white, 2.2);
    // the skull-mask
    ctx.beginPath();
    ctx.moveTo(96, -198);
    ctx.quadraticCurveTo(122, -204, 134, -186);
    ctx.lineTo(166, -158); ctx.quadraticCurveTo(172, -150, 162, -146);
    ctx.lineTo(140, -146); ctx.quadraticCurveTo(116, -150, 104, -164);
    ctx.quadraticCurveTo(92, -178, 96, -198);
    ctx.closePath();
    fillInk(ctx, RH.skull, white, 3);
    if (!white) {
      ctx.strokeStyle = '#a9b8b8'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(132, -184); ctx.quadraticCurveTo(146, -168, 160, -154); ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(124, -178, 8, 11, 0.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(160, -153, 3, 2, 0.4, 0, TAU); ctx.fill();
      const ec = this.blizzard ? '#bff4ff' : '#7fe0ff';
      eye(ctx, 125, -176, 3.8, ec, true, this.phase >= 2 ? 'angry' : 'round');
      // cracks in the skull as he is worn down
      if (this.phase >= 2) { ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(110, -196); ctx.lineTo(114, -186); ctx.lineTo(108, -178); ctx.stroke(); }
      if (this.phase >= 3) { ctx.beginPath(); ctx.moveTo(146, -168); ctx.lineTo(140, -160); ctx.lineTo(146, -152); ctx.stroke(); }
      // breath glow at the jaw while exhaling
      if (this.breath) glow(ctx, 160, -150, 40, '220,245,255', 0.7);
    }
    this.drawAntler(ctx, white, a, true);
    ctx.restore();
  }

  // antlers: branching beams of ice-bone, with icicles hanging off the tines
  drawAntler(ctx, white, a, near) {
    ctx.save();
    ctx.translate(106, -196); ctx.scale(1.3, 1.3); ctx.translate(-106, 196);
    if (!near) { ctx.translate(-16, -2); ctx.scale(0.9, 0.95); }
    const beam = [[106, -196], [98, -232], [84, -270], [76, -304], [60, -338]];
    const tines = [
      [[104, -212], [124, -226], [146, -230], 7],
      [[98, -240], [118, -262], [132, -286], 7],
      [[86, -266], [64, -280], [44, -296], 6],
      [[80, -296], [96, -322], [100, -350], 6],
      [[70, -318], [48, -330], [30, -340], 5],
      [[62, -334], [64, -352], [74, -366], 4],
    ];
    const c = near ? RH.antler : '#7fa9bd';
    for (const [p0, p1, p2, w] of tines) branch(ctx, [p0, p1, p2], w * 1.6, 2, c, white, 2.2);
    branch(ctx, beam, 15, 4, c, white, 2.6);
    // burr ring where antler meets skull
    ctx.beginPath(); ctx.ellipse(106, -196, 10, 5, -0.3, 0, TAU); fillInk(ctx, '#d0e6ee', white, 2);
    if (!white) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(101, -206); ctx.quadraticCurveTo(90, -262, 70, -320); ctx.stroke();
      const g = 0.22 + this.antlerGlow * 0.5 + (this.tele > 0 ? 0.3 : 0);
      for (const [, , e] of tines) glow(ctx, e[0], e[1], 14 + this.antlerGlow * 12, '150,230,255', g * (near ? 1 : 0.6));
      glow(ctx, 60, -338, 22, '150,230,255', g);
      if (near) {
        // frost crystals at the tips and icicles hanging off the tines
        for (const [, m, e] of tines) {
          ctx.fillStyle = '#f2fbff';
          ctx.beginPath(); ctx.moveTo(e[0] - 3, e[1]); ctx.lineTo(e[0], e[1] - 7); ctx.lineTo(e[0] + 3, e[1]); ctx.lineTo(e[0], e[1] + 3); ctx.closePath(); ctx.fill();
          const L = 9 + ((m[0] * 13) % 3) * 4;
          ctx.beginPath(); ctx.moveTo(m[0] - 3, m[1] + 3); ctx.lineTo(m[0] + 3, m[1] + 3); ctx.lineTo(m[0], m[1] + 3 + L + Math.sin(a * 2 + m[0]) * 1); ctx.closePath();
          ctx.fillStyle = '#e6f8ff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}

// =====================================================================================
// FROSTBOUND SENTINEL — Who Guards the Last Warmth.
// A tower-shielded guardian in a shell of ice. While armored it takes little damage and
// blocks frontal Bonks; crack the armor (cracks spread as it weakens) to shatter it,
// then the gaunt thing inside fights faster, with lances, pillars and a plunging spear.
// =====================================================================================
const FS = { ice: '#9fd8ee', iceHi: '#d8f6ff', iceLo: '#5aa8c8', body: '#1a2230', cloak: '#1b2a44', mask: '#eef3ee' };

export class FrostboundSentinel extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'sentinel', size: [110, 172], music: 'boss_optional', glints: 320 });
    this.phases = []; // phases are driven by the armor, not by hp thresholds
    this.armorMax = this.armor = Math.round(380 * (this.echo ? 1.45 : 1));
    this.armored = true;
    this.pose = { shield: 0, spear: 0, kneel: 1, plunge: 0, step: 0, thrust: 0 };
    this.tgt = { shield: 0, spear: 0, kneel: 1, plunge: 0, step: 0, thrust: 0 };
    this.guard = false;
    this.walkT = 0;
    this.haloN = 5;
    this.haloSpent = 0;
    this.haloRegrow = 0;
    this.volley = null;  // lances detached from the halo, aiming
    this.ring = null;    // phase 3 ring of lances
    this.glyphs = [];    // freeze-zone tells on the floor
    this.pendingBreak = false;
    this.pendingRoar = 0;
    this.thrustY = 0;
    // hand-drawn cracks (local coords), revealed as the armor weakens
    const rnd = srand(9187);
    this.crackPaths = [];
    const regions = [[-22, -128, 24, -74], [34, -150, 70, -24], [-18, -196, 18, -150], [-46, -140, -22, -118], [22, -140, 46, -118]];
    for (let i = 0; i < 16; i++) {
      const [x0, y0, x1, y1] = regions[i % regions.length];
      const sx = x0 + rnd() * (x1 - x0), sy = y0 + rnd() * (y1 - y0);
      const pts = [[sx, sy]];
      let ang = rnd() * TAU;
      for (let j = 0; j < 4; j++) {
        ang += (rnd() - 0.5) * 1.6;
        const L = 6 + rnd() * 10;
        const p = pts[pts.length - 1];
        pts.push([clamp(p[0] + Math.cos(ang) * L, x0 - 4, x1 + 4), clamp(p[1] + Math.sin(ang) * L, y0 - 4, y1 + 4)]);
      }
      this.crackPaths.push(pts);
    }
  }

  // ---------------- lifecycle & posing
  animate(dt) {
    const k = Math.min(1, dt * 10);
    for (const key in this.tgt) this.pose[key] = approach(this.pose[key], this.tgt[key], key === 'thrust' ? Math.min(1, dt * 22) : k);
    if (this.haloSpent > 0) { this.haloRegrow += dt; if (this.haloRegrow > 1.4 && !this.volley && !this.ring) { this.haloSpent = Math.max(0, this.haloSpent - 1); this.haloRegrow = 0.9; } }
    for (const g of this.glyphs) g.t -= dt;
    for (const g of this.glyphs) {
      if (g.t <= 0 && !g.done) {
        g.done = true;
        if (this.mode === 'fight') {
          this.zone(g.x - 38, this.groundY - 176, 76, 176, 0.5, { art: 'fs_pillar' });
          this.sfx('crystalBreak', 0.7);
          this.fx.burst(g.x, this.groundY - 10, 8, { color: '#d8f6ff', speed: 300, angle: -Math.PI / 2, spread: 1.2, size: 3, life: 0.5, shape: 'shard' });
        }
      }
    }
    this.glyphs = this.glyphs.filter((g) => !g.done);
    // breath mist through the visor
    if (this.mode !== 'dying' && Math.random() < dt * 2.5) {
      const h = this.toWorld(10, -168);
      this.fx.add({ x: h.x, y: h.y, vx: this.facing * 18, vy: -14, life: 1.0, size: 4, color: 'rgba(225,245,255,0.3)', g: -15, drag: 1, front: false });
    }
  }
  toWorld(lx, ly) { return { x: this.cx + lx * 1.12 * this.facing, y: this.y + this.h + ly * 1.12 + this.pose.kneel * 26 }; }
  idle(dt) { this.animate(dt); }
  introUpdate(dt, t) {
    this.animate(dt);
    if (t > 0.3) this.tgt.kneel = 0;
    if (t > 0.9) this.tgt.shield = 1;
    if (t > 0.3 && t - dt <= 0.3) { this.sfx('crystalBreak'); this.shake(6, 0.8); }
    if (t > 1.2 && t - dt <= 1.2) { this.sfx('clink'); this.fx.ring(this.cx, this.cy, 20, 200, 0.6, 'rgba(210,245,255,0.8)', 4); }
  }
  onStart() { this.facePlayer(); }
  think(dt) {
    this.animate(dt);
    if (this.pendingBreak && this.mode === 'fight') {
      this.pendingBreak = false;
      this.volley = null; this.ring = null;
      this.co = this.shatter(); this.wait = 0;
    }
  }

  // ---------------- damage: armor soaks, shield blocks the front
  shielded(p) {
    if (!this.armored || !this.guard) return false;
    if (p.attackDir === 'down') return false;
    const front = Math.sign(p.cx - this.cx) === this.facing;
    return front && p.cy > this.y + 24;
  }
  hurt(dmg, dir, src) {
    if (!this.hittable || this.mode !== 'fight') return;
    if (this.armored) {
      this.armor -= dmg;
      const c = this.toWorld(0, -110);
      this.fx.burst(c.x, c.y, 6, { color: '#d8f6ff', speed: 240, size: 3, life: 0.4, shape: 'shard' });
      this.sfx('glassHit', 0.7);
      if (this.armor <= 0 && !this.pendingBreak) this.pendingBreak = true;
      dmg *= 0.3;
    }
    super.hurt(dmg, dir, src);
  }
  onHurt() {
    if (this.phase === 2 && this.hp / this.maxHp <= 0.35) { this.phase = 3; this.pendingRoar = 3; }
  }

  // ---------------- attacks
  attackList() {
    const p = this.phase, near = this.distX() < 210;
    if (this.armored) {
      return [
        { name: 'volley', w: 2.6, fn: this.lanceVolley },
        { name: 'bash', w: near ? 3 : 1.6, fn: this.shieldBash },
        { name: 'zones', w: 2.2, fn: this.freezeZones },
        { name: 'thrust', w: near ? 2.4 : 0.6, fn: this.spearThrust },
        { name: 'advance', w: near ? 0.5 : 1.6, fn: this.advance },
      ];
    }
    return [
      { name: 'volley', w: 2.4, fn: this.lanceVolley },
      { name: 'lunge', w: 2.6, fn: this.glacierLunge },
      { name: 'zones', w: 2.2, fn: this.freezeZones },
      { name: 'thrust', w: near ? 2.6 : 0.6, fn: this.spearThrust },
      { name: 'plunge', w: 2.2, fn: this.leapPlunge },
      { name: 'ring', w: p >= 3 ? 2.2 : 0, fn: this.lanceRing },
    ].filter((a) => a.w > 0);
  }
  chooseAttack() {
    if (this.pendingRoar) { const n = this.pendingRoar; this.pendingRoar = 0; return this.roar(n); }
    return super.chooseAttack();
  }

  *shatter() {
    this.guard = false; this.harmful = false;
    Object.assign(this.tgt, { shield: 0, spear: 0, plunge: 0, step: 0, thrust: 0 });
    this.tele = 0;
    this.game.hitstop(0.25);
    this.sfx('crystalBreak'); this.sfx('bossRoar');
    this.game.flash('rgba(230,248,255,0.85)', 0.6);
    this.shake(14, 1.0);
    const c = this.toWorld(0, -110);
    this.fx.burst(c.x, c.y, 50, { color: '#d8f6ff', speed: 520, size: 6, life: 1.2, shape: 'shard', g: 900 });
    this.fx.burst(c.x, c.y, 24, { color: '#9fd8ee', speed: 380, size: 8, life: 1.0, shape: 'shard', g: 900 });
    this.fx.ring(c.x, c.y, 30, 300, 0.8, 'rgba(230,248,255,0.9)', 8);
    this.armored = false; this.armor = 0;
    this.phase = 2;
    this.haloN = 7;
    this.tgt.kneel = 1;
    yield 1.9; // staggered: free hits
    this.tgt.kneel = 0;
    this.harmful = true;
    yield 0.4;
    this.facePlayer();
    this.sfx('bossRoar'); this.shake(8, 0.6);
    yield 0.5;
  }
  *roar() {
    this.facePlayer();
    this.tgt.spear = 1; this.tele = 0.8;
    yield 0.5;
    this.sfx('bossRoar'); this.shake(10, 1.0);
    this.game.flash('rgba(200,240,255,0.4)', 0.5);
    this.haloN = 9; this.speedMul *= 1.15;
    this.fx.ring(this.cx, this.cy, 20, 380, 0.9, 'rgba(220,245,255,0.8)', 6);
    yield 0.7;
    this.tgt.spear = 0;
    yield 0.4;
  }

  // guarded advance (phase 1): shield up, frontal Bonks clink off
  *advance() {
    this.facePlayer();
    this.guard = true; this.tgt.shield = 1;
    const dur = this.rand(0.8, 1.3);
    for (let t = 0; t < dur; t += 1 / 60) {
      this.facePlayer();
      if (this.distX() > 120) { this.x += this.facing * 90 * this.speedMul / 60; this.walkT += 1 / 60; }
      this.x = clamp(this.x, this.arena.x, this.arena.x + this.arena.w - this.w);
      yield;
    }
    yield 0.2;
  }

  // ---- 1. Lance volley: halo lances swing round to aim (lines show), then fly in turn
  *lanceVolley() {
    this.facePlayer();
    this.guard = this.armored; this.tgt.shield = this.armored ? 1 : 0; this.tgt.spear = 0.5;
    const volleys = this.phase >= 3 ? 2 : 1;
    for (let v = 0; v < volleys; v++) {
      const n = Math.min(this.haloN - this.haloSpent, this.armored ? 3 : this.phase >= 3 ? 7 : 5);
      if (n <= 0) break;
      const L = [];
      for (let i = 0; i < n; i++) {
        const hp = this.haloPos(i, n);
        L.push({ x: hp.x, y: hp.y, ang: hp.ang, tx: 0, ty: 0, fired: false, glow: 0 });
      }
      this.volley = L;
      this.haloSpent += n; this.haloRegrow = 0;
      this.tele = 0.6; this.sfx('rustle');
      const tele = v ? 0.5 : 0.65;
      for (let t = 0; t < tele; t += 1 / 60) {
        const p = this.player;
        L.forEach((l, i) => {
          const off = (i - (n - 1) / 2) * 34;
          if (t < tele - 0.18) { l.tx = p.cx + off * 0.6; l.ty = p.cy + Math.abs(off) * 0.2; }
          const want = Math.atan2(l.ty - l.y, l.tx - l.x);
          let d = want - l.ang; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
          l.ang += d * 0.18; l.glow = t / tele;
        });
        yield;
      }
      for (const l of L) {
        l.fired = true;
        this.fire(l.x, l.y, Math.cos(l.ang) * 820, Math.sin(l.ang) * 820, { art: 'fs_lance', r: 9, life: 2.5, onDie: (p) => this.fx.burst(p.cx, p.cy, 6, { color: '#d8f6ff', speed: 200, size: 2.5, life: 0.35, shape: 'shard' }) });
        this.sfx('throw');
        yield 0.11;
      }
      this.volley = null;
      yield 0.35;
    }
    this.tgt.spear = 0;
    this.guard = false;
    yield 0.7;
  }
  haloCenter() { return this.toWorld(-8, -132); }
  haloPos(i, n, spin = 0) {
    const c = this.haloCenter();
    const k = n > 1 ? i / (n - 1) : 0.5;
    const a = -Math.PI * (0.88 - 0.76 * k);
    const ax = Math.cos(a) * this.facing, ay = Math.sin(a);
    return { x: c.x + ax * 103, y: c.y + ay * 103 + Math.sin(this.anim * 2 + i + spin) * 3, ang: Math.atan2(ay, ax) };
  }

  // ---- 2. Shield bash (armored)
  *shieldBash() {
    this.facePlayer();
    this.guard = true; this.tgt.shield = 1.3; this.tele = 0.5; this.sfx('charge');
    this.x -= this.facing * 6;
    yield 0.5;
    this.sfx('slam');
    const dist = Math.min(300, this.distX() + 40);
    let moved = 0;
    while (moved < dist) {
      const step = 760 * this.speedMul / 60;
      this.x += this.facing * step; moved += step;
      const sx = this.facing > 0 ? this.x + this.w - 20 : this.x - 30;
      this.hits.push({ x: sx, y: this.groundY - 160, w: 50, h: 156 });
      this.walkT += 1 / 30;
      if (this.x < this.arena.x || this.x > this.arena.x + this.arena.w - this.w) { this.x = clamp(this.x, this.arena.x, this.arena.x + this.arena.w - this.w); break; }
      yield;
    }
    this.shake(6, 0.25);
    this.fx.burst(this.cx + this.facing * 70, this.groundY - 80, 12, { color: '#d8f6ff', speed: 260, size: 3, life: 0.4, shape: 'shard' });
    // shield lowered: an opening from the front
    this.guard = false; this.tgt.shield = 0.2;
    yield 0.9;
    this.tgt.shield = 0;
  }

  // ---- 3. Freeze zones: spear planted, glyphs bloom on the floor, then pillars erupt
  *freezeZones() {
    this.facePlayer();
    this.guard = false; this.tgt.spear = 1; this.tele = 0.55; this.sfx('rustle');
    yield 0.55;
    this.tgt.spear = -1; this.sfx('slam'); this.shake(5, 0.3);
    const waves = this.phase >= 3 ? 2 : 1;
    for (let w = 0; w < waves; w++) {
      const n = this.armored ? 3 : 5;
      const px = this.player.cx;
      const gap = this.armored ? 170 : 140;
      const off = w ? gap / 2 : 0;
      for (let i = 0; i < n; i++) {
        const x = clamp(px + off + (i - (n - 1) / 2) * gap, this.arena.x + 40, this.arena.x + this.arena.w - 40);
        this.glyphs.push({ x, t: 0.85 + i * 0.05, max: 0.85 + i * 0.05 });
      }
      this.sfx('warn');
      yield 0.9;
    }
    yield 0.4;
    this.tgt.spear = 0;
    yield 0.6;
  }

  // ---- 4. Spear thrust at Bead's height
  *spearThrust() {
    this.facePlayer();
    this.guard = false;
    this.thrustY = clamp(this.player.cy, this.groundY - 150, this.groundY - 16);
    this.tgt.thrust = -1; this.tele = 0.45; this.sfx('rustle');
    yield 0.45;
    this.tgt.thrust = 1; this.sfx('thrust');
    this.x += this.facing * 18;
    const reach = 180;
    const x = this.facing > 0 ? this.cx + 20 : this.cx - 20 - reach;
    this.zone(x, this.thrustY - 18, reach, 36, 0.16);
    this.fx.slash(this.cx + this.facing * 120, this.thrustY, this.facing > 0 ? 0 : Math.PI, 120, 'rgba(220,245,255,0.85)', 0.16);
    yield 0.35;
    this.tgt.thrust = 0;
    yield 0.6;
  }

  // ---- 5. Glacier lunge (unarmored): a low spear dash across the floor
  *glacierLunge() {
    this.facePlayer();
    this.thrustY = this.groundY - 40;
    this.tgt.thrust = -1; this.tele = 0.55; this.sfx('charge');
    yield 0.55;
    this.tgt.thrust = 1; this.sfx('thrust');
    const dist = 380;
    let moved = 0;
    while (moved < dist) {
      const step = 860 * this.speedMul / 60;
      this.x += this.facing * step; moved += step;
      const sx = this.facing > 0 ? this.cx + 20 : this.cx - 20 - 150;
      this.hits.push({ x: sx, y: this.thrustY - 20, w: 150, h: 40 });
      if (Math.random() < 0.6) this.fx.add({ x: this.cx - this.facing * 30, y: this.groundY - 6, vx: -this.facing * 80, vy: -40, life: 0.4, size: 3, color: 'rgba(225,245,255,0.8)', g: 200, front: false });
      if (this.x < this.arena.x || this.x > this.arena.x + this.arena.w - this.w) { this.x = clamp(this.x, this.arena.x, this.arena.x + this.arena.w - this.w); break; }
      yield;
    }
    this.tgt.thrust = 0;
    yield 0.7;
  }

  // ---- 6. Leap & plunge (unarmored): spear-first from above, shards fan out
  *leapPlunge() {
    this.facePlayer();
    this.tgt.kneel = 0.5; this.tele = 0.5; this.sfx('charge');
    yield 0.5;
    this.tgt.kneel = 0; this.tgt.plunge = 1; this.sfx('leap');
    const tx = this.player.cx;
    this.shadowX = clamp(tx, this.arena.x + this.w / 2, this.arena.x + this.arena.w - this.w / 2);
    yield* this.leapTo(tx, 290, 0.9);
    this.shadowX = null;
    this.sfx('slam'); this.sfx('crystalBreak'); this.shake(11, 0.45);
    this.zone(this.cx - 70, this.groundY - 40, 140, 40, 0.15);
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI * (0.9 - i * 0.16);
      this.fire(this.cx, this.groundY - 30, Math.cos(a) * 380, Math.sin(a) * 380, { gravity: 900, art: 'rh_shard', r: 8, life: 3 });
    }
    this.shockwave(this.cx, -1, 400, 28, { color: 'rgba(210,240,255,0.9)' });
    this.shockwave(this.cx, 1, 400, 28, { color: 'rgba(210,240,255,0.9)' });
    this.tgt.kneel = 0.6;
    yield 0.8; // spear stuck: opening
    this.tgt.plunge = 0; this.tgt.kneel = 0;
    yield 0.4;
  }

  // ---- 7. Lance ring (phase 3): the whole halo circles and bursts outward
  *lanceRing() {
    this.facePlayer();
    this.tgt.spear = 1; this.tele = 0.8; this.sfx('rustle');
    const n = 8;
    const c = this.toWorld(0, -100);
    this.ring = { a0: Math.random() * TAU, t: 0, n, r: 0, x: c.x, y: c.y };
    this.haloSpent = this.haloN; this.haloRegrow = 0;
    for (let t = 0; t < 0.85; t += 1 / 60) {
      this.ring.t = t; this.ring.r = Math.min(110, t * 300);
      this.ring.a0 += (1 - t / 0.85) * 0.08;
      yield;
    }
    this.sfx('crystalBreak'); this.shake(5, 0.3);
    for (let i = 0; i < n; i++) {
      const a = this.ring.a0 + i / n * TAU;
      this.fire(this.ring.x + Math.cos(a) * 110, this.ring.y + Math.sin(a) * 110, Math.cos(a) * 520, Math.sin(a) * 520, { art: 'fs_lance', r: 9, life: 2.5 });
    }
    this.ring = null;
    this.tgt.spear = 0;
    yield 0.9;
  }

  onDeath() { this.glyphs = []; this.volley = null; this.ring = null; this.shadowX = null; }

  bodyBox() {
    const kn = this.pose.kneel * 26;
    return { x: this.x + 24, y: this.y + 22 + kn, w: this.w - 48, h: this.h - 22 - kn };
  }

  // ---------------- drawing
  drawExtra(ctx, t) {
    const gy = this.groundY;
    if (this.shadowX != null) {
      ctx.fillStyle = 'rgba(10,20,30,0.45)'; ctx.beginPath(); ctx.ellipse(this.shadowX, gy - 2, 70, 9, 0, 0, TAU); ctx.fill();
    }
    // freeze glyphs
    for (const g of this.glyphs) {
      const k = clamp(1 - g.t / g.max, 0, 1);
      glow(ctx, g.x, gy - 6, 40 + k * 30, '160,225,255', 0.2 + k * 0.4);
      ctx.save(); ctx.translate(g.x, gy - 4); ctx.scale(1, 0.3);
      ctx.strokeStyle = `rgba(220,248,255,${0.5 + k * 0.5})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.stroke();
      ctx.rotate(t * 2);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 30 * (0.5 + k * 0.5), Math.sin(a) * 30 * (0.5 + k * 0.5)); }
      ctx.stroke();
      ctx.restore();
      if (k > 0.5) { ctx.strokeStyle = `rgba(220,248,255,${(k - 0.5)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(g.x - 30, gy - 170 * k); ctx.lineTo(g.x - 30, gy); ctx.moveTo(g.x + 30, gy - 170 * k); ctx.lineTo(g.x + 30, gy); ctx.stroke(); }
    }
    // detached lances (aim lines + the lances themselves)
    if (this.volley) {
      for (const l of this.volley) {
        if (l.fired) continue;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(190,240,255,${0.15 + 0.4 * l.glow})`; ctx.lineWidth = 1.5; ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x + Math.cos(l.ang) * 900, l.y + Math.sin(l.ang) * 900); ctx.stroke();
        ctx.restore();
        glow(ctx, l.x, l.y, 26, '170,230,255', 0.2 + l.glow * 0.4);
        drawIceLance(ctx, l.x, l.y, l.ang, false, 1);
      }
    }
    if (this.ring) {
      const R = this.ring;
      for (let i = 0; i < R.n; i++) {
        const a = R.a0 + i / R.n * TAU;
        const x = R.x + Math.cos(a) * R.r, y = R.y + Math.sin(a) * R.r;
        if (R.t > 0.35) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(190,240,255,${(R.t - 0.35) * 0.8})`; ctx.lineWidth = 1.5; ctx.setLineDash([10, 8]);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 700, y + Math.sin(a) * 700); ctx.stroke();
          ctx.restore();
        }
        glow(ctx, x, y, 24, '170,230,255', 0.4);
        drawIceLance(ctx, x, y, a, false, 1);
      }
    }
  }

  drawBody(ctx, t, white) {
    const f = this.facing, P = this.pose, a = this.anim;
    ctx.save();
    ctx.translate(this.cx, this.y + this.h + P.kneel * 26);
    ctx.scale(f * 1.12, 1.12);
    const br = Math.sin(a * 1.6) * 1.5;
    const arm = this.armored;
    // halo of lances behind
    const shown = this.haloN - this.haloSpent;
    if (!this.volley && !this.ring) {
      for (let i = 0; i < this.haloN; i++) {
        if (i >= shown) continue;
        const k = this.haloN > 1 ? i / (this.haloN - 1) : 0.5;
        const an = -Math.PI * (0.88 - 0.76 * k);
        const x = -8 + Math.cos(an) * 92, y = -132 + Math.sin(an) * 92 + Math.sin(a * 2 + i) * 3;
        if (!white) glow(ctx, x, y, 20, '160,225,255', 0.18);
        drawIceLance(ctx, x, y, an, white, 0.95);
      }
    }
    // cloak
    const cw = Math.sin(a * 2.2) * 4;
    ctx.beginPath();
    ctx.moveTo(-26, -140);
    ctx.quadraticCurveTo(-56, -90, -60 + cw, -8);
    for (let i = 0; i < 6; i++) ctx.lineTo(-52 + i * 9 + cw * (1 - i / 6), i % 2 ? -18 : -4);
    ctx.quadraticCurveTo(-10, -60, 12, -138);
    ctx.closePath();
    fillInk(ctx, FS.cloak, white, 2.5);
    // spear (back hand)
    this.drawSpear(ctx, white, a);
    // legs
    const wk = Math.sin(this.walkT * 9) * 6;
    for (const [s, near] of [[-1, false], [1, true]]) {
      const hx = s * 14, fx = s * 22 + (near ? wk : -wk) - P.kneel * (near ? 10 : -26);
      const knee = [hx + s * 4 + P.kneel * 20 * (near ? 1 : 0), -38 + P.kneel * 14];
      const c = arm ? (near ? FS.ice : FS.iceLo) : (near ? '#2a3448' : '#1a2230');
      limb(ctx, [[hx, -70], knee, [fx, near || !P.kneel ? -4 : -4]], white, c, arm ? 13 : 8);
      ctx.beginPath(); ctx.moveTo(fx - 10, 0); ctx.lineTo(fx - 8, -10); ctx.lineTo(fx + 12, -10); ctx.lineTo(fx + 14, 0); ctx.closePath();
      fillInk(ctx, arm ? FS.iceLo : FS.body, white, 2);
    }
    // tassets / skirt
    ctx.beginPath();
    ctx.moveTo(-28, -86); ctx.lineTo(28, -86); ctx.lineTo(34, -52); ctx.lineTo(18, -46); ctx.lineTo(8, -56); ctx.lineTo(-4, -44); ctx.lineTo(-16, -54); ctx.lineTo(-32, -48);
    ctx.closePath();
    fillInk(ctx, arm ? FS.iceLo : '#24304a', white, 2.5);
    // torso
    if (arm) {
      // broad breastplate of old ice
      ctx.beginPath();
      ctx.moveTo(-34, -138 + br);
      ctx.quadraticCurveTo(0, -146 + br, 34, -138 + br);
      ctx.quadraticCurveTo(36, -112, 24, -86);
      ctx.lineTo(-24, -86);
      ctx.quadraticCurveTo(-36, -112, -34, -138 + br);
      ctx.closePath();
      fillInk(ctx, FS.ice, white, 3);
      if (!white) {
        ctx.save(); ctx.clip();
        ctx.fillStyle = FS.iceLo;
        ctx.beginPath(); ctx.moveTo(4, -146); ctx.lineTo(40, -146); ctx.lineTo(40, -80); ctx.lineTo(10, -80); ctx.lineTo(16, -112); ctx.closePath(); ctx.fill();
        ctx.fillStyle = FS.iceHi;
        ctx.beginPath(); ctx.moveTo(-30, -136 + br); ctx.lineTo(-8, -138 + br); ctx.lineTo(-16, -112); ctx.lineTo(-30, -108); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.moveTo(-26, -130); ctx.lineTo(-20, -132); ctx.lineTo(-26, -112); ctx.closePath(); ctx.fill();
        // inner warmth seen through the ice: the last ember it guards
        glow(ctx, 0, -112, 26, '255,190,120', 0.28 + 0.1 * Math.sin(a * 3));
        ctx.restore();
        // keel ridge and plate seams
        ctx.strokeStyle = INK; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -142 + br); ctx.lineTo(4, -112); ctx.lineTo(0, -88); ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-32, -112); ctx.quadraticCurveTo(0, -104, 32, -112); ctx.stroke();
        // a slow glint travelling over the armor
        glow(ctx, -30 + ((a * 30) % 90), -122, 14, '255,255,255', 0.35);
      }
      // belt
      ctx.beginPath(); ctx.rect(-26, -90, 52, 8); fillInk(ctx, '#2c4a62', white, 2);
      if (!white) { ctx.fillStyle = '#ffcf8a'; ctx.beginPath(); ctx.arc(2, -86, 3, 0, TAU); ctx.fill(); }
      // gorget
      ctx.beginPath(); ctx.moveTo(-16, -140 + br); ctx.quadraticCurveTo(2, -132 + br, 20, -140 + br); ctx.lineTo(16, -150 + br); ctx.lineTo(-12, -150 + br); ctx.closePath();
      fillInk(ctx, FS.iceLo, white, 2);
    } else {
      // gaunt body under the broken shell
      ctx.beginPath();
      ctx.moveTo(-20, -134); ctx.quadraticCurveTo(0, -142, 20, -134); ctx.lineTo(14, -84); ctx.lineTo(-14, -84); ctx.closePath();
      fillInk(ctx, FS.body, white, 3);
      if (!white) {
        ctx.strokeStyle = '#3a4a66'; ctx.lineWidth = 1.6;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-12, -124 + i * 9); ctx.quadraticCurveTo(0, -120 + i * 9, 12, -124 + i * 9); ctx.stroke(); }
        glow(ctx, 0, -112, 30, '255,190,120', 0.45 + 0.15 * Math.sin(a * 5));
        ctx.fillStyle = '#ffcf8a'; ctx.beginPath(); ctx.arc(0, -112, 4, 0, TAU); ctx.fill();
        // jagged remnants of the shell
        ctx.fillStyle = FS.ice; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(-22, -136); ctx.lineTo(-30, -122); ctx.lineTo(-18, -118); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(18, -96); ctx.lineTo(26, -86); ctx.lineTo(12, -86); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    // pauldrons: crystal clusters
    for (const s of [-1, 1]) {
      const px = s * 30, py = -132 + br;
      const n = arm ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + s * (0.5 + i * 0.35);
        const L = arm ? 22 - i * 4 : 12;
        ctx.beginPath();
        ctx.moveTo(px - 7, py + 4); ctx.lineTo(px + Math.cos(ang) * L, py + Math.sin(ang) * L); ctx.lineTo(px + 7, py + 4); ctx.closePath();
        fillInk(ctx, arm ? FS.iceHi : FS.ice, white, 2);
      }
      ctx.beginPath(); ctx.ellipse(px, py + 4, arm ? 14 : 9, arm ? 10 : 7, 0, 0, TAU);
      fillInk(ctx, arm ? FS.ice : '#2a3448', white, 2.5);
    }
    // head
    this.drawHelm(ctx, white, a, br);
    // cracks over the armor
    if (arm && !white) {
      const frac = 1 - this.armor / this.armorMax;
      const n = Math.floor(frac * this.crackPaths.length * 1.05);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < n && i < this.crackPaths.length; i++) {
        const pts = this.crackPaths[i];
        ctx.moveTo(pts[0][0], pts[0][1]); for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
      }
      ctx.stroke();
      if (frac > 0.6) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.8; ctx.stroke(); }
    }
    // shield (front hand)
    if (arm) this.drawShield(ctx, white, a);
    else {
      // bare front arm
      ctx.beginPath(); ctx.moveTo(24, -126); ctx.lineTo(36, -100); ctx.lineTo(44, -86);
      inkStroke(ctx, white, 7); ctx.beginPath(); ctx.moveTo(24, -126); ctx.lineTo(36, -100); ctx.lineTo(44, -86); inkStroke(ctx, white, 4, '#2a3448');
    }
    ctx.restore();
  }

  drawHelm(ctx, white, a, br) {
    const arm = this.armored;
    ctx.save(); ctx.translate(2, -150 + br);
    if (arm) {
      // crown of icicle spikes
      for (let i = 0; i < 5; i++) {
        const x = -16 + i * 8, h = 20 + (i === 2 ? 18 : i % 2 ? 10 : 4);
        ctx.beginPath(); ctx.moveTo(x - 5, -22); ctx.lineTo(x + (i - 2) * 1.5, -22 - h); ctx.lineTo(x + 5, -22); ctx.closePath();
        fillInk(ctx, FS.iceHi, white, 2);
      }
      // tall great-helm
      ctx.beginPath();
      ctx.moveTo(-20, 16); ctx.lineTo(-23, -10); ctx.quadraticCurveTo(-22, -30, 2, -32); ctx.quadraticCurveTo(26, -30, 26, -10);
      ctx.lineTo(28, 8); ctx.quadraticCurveTo(22, 20, 4, 22); ctx.quadraticCurveTo(-12, 22, -20, 16);
      ctx.closePath();
      fillInk(ctx, FS.ice, white, 3);
      if (!white) {
        ctx.save(); ctx.clip();
        ctx.fillStyle = FS.iceLo; ctx.fillRect(12, -40, 20, 70);
        ctx.fillStyle = FS.iceHi; ctx.beginPath(); ctx.moveTo(-20, -12); ctx.lineTo(-8, -28); ctx.lineTo(-4, -24); ctx.lineTo(-16, -4); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // T-shaped visor: darkness, and two cold eyes within
      ctx.beginPath();
      ctx.moveTo(-14, -8); ctx.lineTo(24, -8); ctx.lineTo(24, -2); ctx.lineTo(8, -2); ctx.lineTo(8, 14); ctx.lineTo(2, 14); ctx.lineTo(2, -2); ctx.lineTo(-14, -2);
      ctx.closePath();
      fillInk(ctx, INK, white, 1.5);
      if (!white) {
        const pul = 0.8 + 0.2 * Math.sin(a * 4);
        eye(ctx, -5, -5, 2.4 * pul, '#bff4ff', true); eye(ctx, 16, -5, 2.4 * pul, '#bff4ff', true);
        ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-18, 8); ctx.lineTo(-6, 10); ctx.moveTo(14, 10); ctx.lineTo(24, 6); ctx.stroke();
      }
    } else {
      // the bare long mask, with a few ice horns left
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(s * 8, -18); ctx.quadraticCurveTo(s * 18, -36, s * 12, -50); ctx.lineTo(s * 4, -22); ctx.closePath();
        fillInk(ctx, FS.iceHi, white, 1.8);
      }
      ctx.beginPath();
      ctx.moveTo(-14, -2); ctx.quadraticCurveTo(-16, -24, 2, -24); ctx.quadraticCurveTo(20, -24, 18, -2);
      ctx.quadraticCurveTo(16, 18, 4, 28); ctx.quadraticCurveTo(-10, 18, -14, -2);
      fillInk(ctx, FS.mask, white, 2.5);
      if (!white) {
        ctx.fillStyle = INK;
        for (const ex of [-5, 10]) { ctx.beginPath(); ctx.ellipse(ex, -6, 4, 7, ex < 0 ? -0.2 : 0.2, 0, TAU); ctx.fill(); }
        const ec = this.phase >= 3 ? '#ffcf8a' : '#bff4ff';
        eye(ctx, -5, -5, 2.4, ec, true, 'angry'); eye(ctx, 10, -5, 2.4, ec, true, 'angry');
        ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(8, -24); ctx.lineTo(6, -14); ctx.lineTo(10, -10); ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawShield(ctx, white, a) {
    const P = this.pose;
    const up = clamp(P.shield, 0, 1.3);
    ctx.save();
    ctx.translate(40 + up * 10, -88 - up * 6);
    ctx.rotate(-0.04 + (1 - Math.min(1, up)) * 0.12);
    const W = 26, Ht = 70;
    ctx.beginPath();
    ctx.moveTo(-W, -Ht + 10); ctx.quadraticCurveTo(0, -Ht - 12, W, -Ht + 10);
    ctx.lineTo(W, Ht - 30); ctx.quadraticCurveTo(W - 4, Ht - 4, 0, Ht + 6); ctx.quadraticCurveTo(-W + 4, Ht - 4, -W, Ht - 30);
    ctx.closePath();
    fillInk(ctx, FS.ice, white, 3.5);
    if (!white) {
      ctx.save(); ctx.clip();
      ctx.fillStyle = FS.iceLo; ctx.fillRect(W - 10, -Ht - 20, 14, Ht * 2 + 30);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(-W + 4, -Ht); ctx.lineTo(-W + 12, -Ht); ctx.lineTo(-W + 4, -10); ctx.closePath(); ctx.fill();
      ctx.restore();
      // emblem: an eight-pointed frost star around a bead of warmth
      ctx.save(); ctx.translate(0, -10);
      ctx.strokeStyle = FS.iceHi; ctx.lineWidth = 2;
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const an = i / 8 * TAU; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an) * (i % 2 ? 10 : 18), Math.sin(an) * (i % 2 ? 10 : 18)); } ctx.stroke();
      ctx.fillStyle = '#ffcf8a'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = FS.iceHi; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-W + 5, -Ht + 12); ctx.quadraticCurveTo(0, -Ht - 4, W - 5, -Ht + 12); ctx.stroke();
      if (this.guard) glow(ctx, 0, -10, 60, '200,240,255', 0.12 + 0.06 * Math.sin(a * 6));
    }
    ctx.restore();
  }

  drawSpear(ctx, white, a) {
    const P = this.pose;
    ctx.save();
    if (P.thrust !== 0 || P.plunge > 0.05) {
      // held forward for thrusts / downward for plunges
      const ty = this.thrustY ? (this.thrustY - (this.y + this.h)) / 1.12 : -100;
      const reachBack = P.thrust < 0 ? -40 * -P.thrust : 60 * Math.max(0, P.thrust);
      if (P.plunge > 0.05) { ctx.translate(30, -110); ctx.rotate(Math.PI / 2 * P.plunge); }
      else { ctx.translate(reachBack, clamp(ty, -150, -16)); }
      ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(90, 0); inkStroke(ctx, white, 6);
      ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(90, 0); inkStroke(ctx, white, 3, '#6d8aa0');
      ctx.beginPath(); ctx.moveTo(86, -8); ctx.lineTo(124, 0); ctx.lineTo(86, 8); ctx.lineTo(92, 0); ctx.closePath();
      fillInk(ctx, FS.iceHi, white, 2);
      if (!white && this.tele > 0) glow(ctx, 118, 0, 22, '220,248,255', 0.7);
      ctx.restore();
      // the arm reaching to it
      return;
    }
    const lift = P.spear > 0 ? P.spear * 30 : P.spear * -20;
    ctx.translate(-34, -100 - (P.spear > 0 ? lift : 0) + (P.spear < 0 ? 26 : 0));
    ctx.rotate(-0.08);
    ctx.beginPath(); ctx.moveTo(0, 110); ctx.lineTo(0, -120); inkStroke(ctx, white, 6);
    ctx.beginPath(); ctx.moveTo(0, 110); ctx.lineTo(0, -120); inkStroke(ctx, white, 3, '#6d8aa0');
    ctx.beginPath(); ctx.moveTo(-8, -116); ctx.lineTo(0, -156); ctx.lineTo(8, -116); ctx.lineTo(0, -122); ctx.closePath();
    fillInk(ctx, FS.iceHi, white, 2);
    if (!white) glow(ctx, 0, -140, 18 + (this.tele > 0 ? 10 : 0), '200,240,255', 0.35 + (this.tele > 0 ? 0.3 : 0));
    // back hand
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); fillInk(ctx, this.armored ? FS.ice : '#2a3448', white, 2);
    ctx.restore();
  }
}

export default { rimehorn: Rimehorn, sentinel: FrostboundSentinel };
