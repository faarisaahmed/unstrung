// Bosses of the Tallow Catacombs: Wickwidow (main, grants Shard Toss) and the Ossuary Knight (optional duel).
import { Boss, registerMinion } from './boss.js';
import { TAU, clamp } from '../core/math.js';
import { TILE } from '../core/constants.js';
import { INK, eye } from '../art/creatures.js';
import { registerProjectileArt } from '../entities/projectile.js';

// ------------------------------------------------------------------ shared helpers
const C = (white, c) => (white ? '#fff' : c);
function inkS(ctx, white, lw = 3) { ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }
function fs(ctx, white, fill, lw = 3) { ctx.fillStyle = white ? '#fff' : fill; ctx.fill(); inkS(ctx, white, lw); ctx.stroke(); }
function glow(ctx, x, y, r, color, a = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.restore();
}
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy || 1;
  const k = clamp(((px - x1) * dx + (py - y1) * dy) / L, 0, 1);
  return Math.hypot(px - (x1 + dx * k), py - (y1 + dy * k));
}
function rectSegHit(r, s) {
  // sample the strand against a rect
  const n = Math.ceil(Math.hypot(s.x2 - s.x1, s.y2 - s.y1) / 10);
  for (let i = 0; i <= n; i++) {
    const x = s.x1 + (s.x2 - s.x1) * i / n, y = s.y1 + (s.y2 - s.y1) * i / n;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { x, y };
  }
  return null;
}
// weighted pick that ignores zero weights and avoids repeating the last attack
function pickAttack(boss, list) {
  list = list.filter((a) => a.w > 0);
  if (!list.length) return null;
  const pool = list.length > 1 ? list.filter((a) => a.name !== boss.lastAttack) : list;
  const total = pool.reduce((s, a) => s + a.w, 0);
  let r = Math.random() * total;
  let pickd = pool[pool.length - 1];
  for (const a of pool) { r -= a.w; if (r <= 0) { pickd = a; break; } }
  boss.lastAttack = pickd.name;
  return pickd.fn.call(boss);
}
const easeIO = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

// ------------------------------------------------------------------ projectile art
registerProjectileArt('ww_pool', (ctx, p, t) => {
  const r = p.rect();
  const k = p.age / (p.age + p.life);
  const fade = Math.min(1, p.life * 3) * Math.min(1, p.age * 8);
  ctx.save();
  ctx.globalAlpha = fade;
  const cx = r.x + r.w / 2, by = r.y + r.h;
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.ellipse(cx, by - 3, r.w / 2 + 2, 7, 0, Math.PI, TAU); ctx.lineTo(cx + r.w / 2 + 2, by); ctx.lineTo(cx - r.w / 2 - 2, by); ctx.fill();
  ctx.fillStyle = '#f0d9a6';
  ctx.beginPath(); ctx.ellipse(cx, by - 3, r.w / 2, 5, 0, Math.PI, TAU); ctx.lineTo(cx + r.w / 2, by); ctx.lineTo(cx - r.w / 2, by); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const fx = cx + (i - 1.5) * r.w * 0.24 + Math.sin(t * 9 + i * 2) * 2;
    const fh = (14 + Math.sin(t * 17 + i * 3) * 5) * (1 - k * 0.6);
    const g = ctx.createRadialGradient(fx, by - 6 - fh * 0.4, 0, fx, by - 6 - fh * 0.4, fh);
    g.addColorStop(0, 'rgba(255,214,140,0.95)'); g.addColorStop(0.5, 'rgba(255,140,50,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, by - 6 - fh * 0.4, fh, 0, TAU); ctx.fill();
  }
  ctx.restore();
});

registerProjectileArt('ok_arc', (ctx, p, t) => {
  const dir = Math.sign(p.vx) || 1;
  ctx.save();
  ctx.translate(p.cx, p.cy); ctx.scale(dir, 1);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, p.r * 2.2);
  g.addColorStop(0, 'rgba(255,190,90,0.7)'); g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, p.r * 2.2, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  const R = p.r * 1.25;
  ctx.beginPath();
  ctx.ellipse(-R * 0.3, 0, R, R * 1.1, 0, -1.35, 1.35);
  ctx.ellipse(-R * 0.75, 0, R * 0.8, R * 0.95, 0, 1.25, -1.25, true);
  ctx.closePath();
  ctx.fillStyle = INK; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = '#ffe2a8'; ctx.fill();
  ctx.fillStyle = 'rgba(255,150,60,0.9)';
  ctx.beginPath(); ctx.ellipse(-R * 0.25, 0, R * 0.55, R * 0.8, 0, -1.2, 1.2); ctx.ellipse(-R * 0.6, 0, R * 0.45, R * 0.7, 0, 1.1, -1.1, true); ctx.fill();
  // trailing embers
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = `rgba(255,${150 + i * 20},80,${0.5 - i * 0.1})`;
    ctx.beginPath(); ctx.arc(-R - i * 10, Math.sin(t * 20 + i) * R * 0.5, 3 - i * 0.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
});

registerProjectileArt('ok_pillar', (ctx, p, t) => {
  const r = p.rect();
  const k = Math.min(1, p.age * 10);
  const fade = Math.min(1, p.life * 5);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = fade;
  const h = r.h * k;
  const g = ctx.createLinearGradient(0, r.y + r.h - h, 0, r.y + r.h);
  g.addColorStop(0, 'rgba(255,120,40,0)'); g.addColorStop(0.3, 'rgba(255,170,80,0.75)'); g.addColorStop(1, 'rgba(255,240,200,0.95)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(r.x, r.y + r.h);
  for (let i = 0; i <= 6; i++) ctx.lineTo(r.x + (r.w * i) / 6, r.y + r.h - h * (0.75 + 0.25 * Math.sin(t * 30 + i * 2)));
  ctx.lineTo(r.x + r.w, r.y + r.h);
  ctx.fill();
  ctx.restore();
});

// ------------------------------------------------------------------ minions
registerMinion({
  id: 'wickling', name: 'Wickling', hp: 10, dmg: 1, size: [22, 32], behavior: 'exploder',
  params: { speed: 70, rush: 190, sight: 900, fuse: 0.65, radius: 50 },
  art: { body: 'candle', c1: '#efdcae', c2: '#ffb85c' }, light: 90, weight: 1,
  journal: 'A candle stub the Wickwidow has wept alive. It runs toward warmth and gives all of its own away at once.',
});

// ==================================================================================================
// WICKWIDOW — Who Weeps Wax. A vast candle-spider; her body is a cluster of melting candles.
// Ceiling perch: wax drips, flame volleys, web strands, then a drop. Floor perch: skitter, pounce,
// lobbed fire, then she reels back up her thread. Phase 2 adds Wicklings and more webs; phase 3 melts.
// ==================================================================================================
export class Wickwidow extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'wickwidow', size: [150, 100], music: 'boss', glints: 140, introTime: 2.6 });
    if (this.dead) return;
    this.light = 240;
    this.noPhysics = true;
    this.perch = 'ceil';
    this.perchCount = 0;
    this.hangY = Math.max(this.arena.y + 60, this.groundY - 205 - this.h);
    this.startY = this.arena.y + 6;
    this.y = this.startY;
    this.curl = 1; this.legT = 0; this.flare = 0; this.fang = 0; this.shudder = 0; this.crouch = 0; this.skit = 0;
    this.threadK = 1; this.weepT = 0; this.wake = 0; this.flareV = 0; this.fangV = 0;
    this.marks = []; this.strands = [];
    this.dt = 1 / 60;
  }

  update(dt) {
    this.dt = dt;
    super.update(dt);
    if (this.dead) return;
    // secondary animation runs in every mode
    if (this.shudder > 0) this.shudder -= dt;
    this.flareV = (this.flareV || 0) + ((this.flare ? 1 : 0) - (this.flareV || 0)) * Math.min(1, dt * 8);
    this.fangV = (this.fangV || 0) + (this.fang - (this.fangV || 0)) * Math.min(1, dt * 12);
    if (this.crouch > 0 && !this.holdCrouch) this.crouch = Math.max(0, this.crouch - dt * 2.5);
    if (this.mode !== 'dormant' && this.mode !== 'dying') {
      this.weepT -= dt;
      if (this.weepT <= 0) {
        this.weepT = this.phase >= 3 ? 0.18 : 0.45;
        const [ex, ey] = this.headPos();
        this.fx.add({ x: ex + this.facing * 4 + this.rand(-6, 6), y: ey + 14, vx: this.rand(-10, 10), vy: 20, life: 1.0, size: 3, color: '#f3e2b8', g: 700, shape: 'dot', front: false });
      }
    }
  }

  headPos() { return [this.cx + this.facing * 52, this.y + this.h - 54 - this.crouch * 8]; }
  spinneret() { return [this.cx - this.facing * 30, this.y + this.h - 50]; }

  idle(dt) { this.legT += dt * 0.6; }

  introUpdate(dt, t) {
    const k = clamp((t - 0.3) / 1.7, 0, 1);
    this.y = this.startY + (this.hangY - this.startY) * easeIO(k);
    this.wake = clamp(t / 1.2, 0, 1);
    if (t > 1.8) this.flare = 1;
    if (t > 2.4) this.flare = 0;
    this.legT += dt * 2;
  }

  onStart() { this.sfx('rustle'); }

  // --------------------------------------------------------------- per-frame logic
  think(dt) {
    const p = this.player;
    // telegraph marks
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i];
      m.t += dt;
      if (m.t >= m.dur) { this.marks.splice(i, 1); if (m.done) m.done(); }
    }
    // web strands: telegraphed lines that become hazards; a Bonk cuts them
    const ab = p.attackBox && p.attackBox();
    for (let i = this.strands.length - 1; i >= 0; i--) {
      const s = this.strands[i];
      s.t += dt;
      if (s.t >= s.life) { this.strands.splice(i, 1); continue; }
      const armed = s.t >= s.arm && s.t < s.life - 0.25;
      if (!armed) continue;
      if (ab) {
        const hit = rectSegHit(ab, s);
        if (hit) {
          this.strands.splice(i, 1);
          this.sfx('whip');
          this.fx.burst(hit.x, hit.y, 10, { color: '#f6ead0', speed: 180, size: 2, life: 0.4, shape: 'streak' });
          continue;
        }
      }
      if (p.invuln <= 0 && !p.dead && segDist(p.cx, p.cy, s.x1, s.y1, s.x2, s.y2) < 13) {
        p.hurt(1, p.cx - (s.x2 - s.x1 > 0 ? 1 : -1));
      }
    }
    if (this.skit) this.legT += dt * 26;
  }

  addMark(m) { this.marks.push(Object.assign({ t: 0 }, m)); }

  onDeath() { this.marks.length = 0; this.strands.length = 0; this.flare = 1; this.fang = 1; }

  chooseAttack() {
    const ceil = this.perch === 'ceil', p = this.phase;
    const webs = this.strands.length > 0;
    return pickAttack(this, [
      { name: 'drip', w: ceil ? 3 : 0, fn: this.drip },
      { name: 'flames', w: ceil ? 2 : 0, fn: this.flamesCeil },
      { name: 'weave', w: webs ? 0 : (p >= 2 ? 2.5 : 1.4), fn: this.weave },
      { name: 'drop', w: ceil ? 0.6 + this.perchCount * 1.4 : 0, fn: this.drop },
      { name: 'skitter', w: !ceil && !webs ? 3 : 0, fn: this.skitter },
      { name: 'pounce', w: !ceil ? 2 : 0, fn: this.pounce },
      { name: 'lob', w: !ceil ? 2 : 0, fn: this.lobFlames },
      { name: 'candles', w: p >= 2 && this.minions.length < 2 ? 1.4 : 0, fn: this.candles },
      { name: 'ascend', w: !ceil ? this.perchCount * 1.3 : 0, fn: this.ascend },
    ]);
  }

  // --------------------------------------------------------------- spawners
  dropWax(x, y, vx = 0, vy = 140, r = 9) {
    this.fire(x, y, vx, vy, { gravity: 1500, art: 'glob', color: '#f2deb0', r, life: 3, onDie: (pr) => this.waxPuddle(pr) });
  }
  surfaceBelow(x, y) {
    const room = this.game.room;
    for (let yy = y - 12; yy < y + 40; yy += 2) if (room.rectBlocked(x - 2, yy, 4, 2)) return yy;
    return null;
  }
  waxPuddle(pr) {
    if (pr.life <= 0 || this.mode !== 'fight') return;
    const y = this.surfaceBelow(pr.cx, pr.cy);
    if (y === null) return;
    const w = 66;
    this.zone(pr.cx - w / 2, y - 12, w, 12, this.phase >= 3 ? 1.9 : 1.4, { art: 'ww_pool' });
    this.fx.burst(pr.cx, y - 4, 6, { color: '#f2deb0', speed: 140, angle: -Math.PI / 2, spread: 2.2, size: 2.5, life: 0.4 });
  }
  web(x1, y1, x2, y2) {
    this.strands.push({ x1, y1, x2, y2, t: 0, arm: 0.85, life: 0.85 + 3.0 + this.phase * 0.4 });
  }
  lobAt(x0, y0, tx, T, opts) {
    const g = opts.gravity;
    const ty = this.groundY - 8;
    return this.fire(x0, y0, (tx - x0) / T, (ty - y0) / T - 0.5 * g * T, opts);
  }
  get L() { return this.arena.x; }
  get R() { return this.arena.x + this.arena.w; }

  // --------------------------------------------------------------- ceiling attacks
  *drip() {
    this.perchCount++;
    this.flare = 1; this.shudder = 0.5; this.tele = 0.5;
    this.sfx('rustle');
    yield 0.5;
    const n = 4 + this.phase + (this.phase >= 3 ? 2 : 0);
    for (let i = 0; i < n; i++) {
      const p = this.player;
      const x = clamp(i % 2 === 0 ? p.cx + this.rand(-100, 100) : this.rand(this.L + 40, this.R - 40), this.L + 20, this.R - 20);
      this.addMark({ kind: 'drip', x, y: this.arena.y, dur: 0.5, done: () => { this.dropWax(x, this.arena.y + 14); this.sfx('drop'); } });
      if (i % 3 === 1) { const [sx, sy] = this.spinneret(); this.dropWax(sx + this.rand(-30, 30), sy + 10, this.rand(-60, 60), 60, 8); }
      yield 0.17;
    }
    this.flare = 0;
    yield 0.9;
  }

  *flamesCeil() {
    this.perchCount++;
    this.facePlayer();
    this.flare = 1; this.fang = 1; this.tele = 0.55; this.shudder = 0.55;
    this.sfx('charge');
    yield 0.55;
    const volleys = this.phase >= 3 ? 2 : 1;
    const n = this.phase >= 2 ? 5 : 3;
    for (let v = 0; v < volleys; v++) {
      const [ox, oy] = this.headPos();
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 0.27 + (v ? 0.13 : 0);
        this.fireAt(ox, oy, 270 + this.phase * 25, { offset: off, art: 'flame', color: '#ff9a40', r: 9, life: 4 });
      }
      this.sfx('spit');
      this.fx.burst(ox, oy, 10, { color: '#ffcf7a', speed: 220, size: 3, life: 0.4, glow: true });
      if (v < volleys - 1) { this.tele = 0.4; yield 0.45; }
    }
    this.fang = 0; this.flare = 0;
    yield 0.9;
  }

  *weave() {
    this.perchCount++;
    this.sfx('rustle');
    this.tele = 0.45; this.shudder = 0.45; this.spinning = 1;
    yield 0.45;
    const L = this.L, R = this.R, G = this.groundY, W = this.arena.w;
    const [sx, sy] = this.spinneret();
    const pats = [
      () => { this.web(L, G - 150, L + W * 0.4, G); this.web(R, G - 150, L + W * 0.6, G); },
      () => { this.web(L, G - 64, R, G - 64); },
    ];
    if (this.perch === 'ceil') pats.push(() => { for (const d of [-1, 0, 1]) this.web(sx, sy, clamp(sx + d * 300, L, R), G); });
    if (this.phase >= 2) {
      pats.push(() => { this.web(L, G - 64, R, G - 64); this.web(L, G - 210, L + W * 0.45, G - 120); this.web(R, G - 210, L + W * 0.55, G - 120); });
      pats.push(() => { this.web(L, G - 30, L + W * 0.5, G - 190); this.web(R, G - 30, L + W * 0.5, G - 190); });
    }
    this.pick(pats)();
    this.sfx('whip');
    yield 0.6;
    this.spinning = 0;
    yield 0.3;
  }

  *drop() {
    this.sfx('rustle');
    let t = 0;
    while (t < 0.75) {
      t += this.dt;
      const tx = clamp(this.player.cx, this.L + this.w / 2, this.R - this.w / 2);
      this.x += clamp(tx - this.cx, -520 * this.dt, 520 * this.dt);
      this.legT += this.dt * 8;
      yield;
    }
    this.shudder = 0.5; this.tele = 0.5; this.fang = 1;
    this.addMark({ kind: 'shadow', x: this.cx, y: this.groundY, w: this.w, dur: 0.5 });
    this.sfx('warn');
    yield 0.5;
    this.perch = 'floor'; this.perchCount = 0;
    let vy = 250;
    while (this.y < this.groundY - this.h) {
      vy += 3400 * this.dt;
      this.y = Math.min(this.groundY - this.h, this.y + vy * this.dt);
      this.curl = Math.max(0, this.curl - this.dt * 5);
      yield;
    }
    this.curl = 0; this.crouch = 1; this.fang = 0;
    this.threadK = 0;
    this.sfx('slam'); this.shake(9, 0.4);
    this.fx.burst(this.cx, this.groundY, 22, { color: '#f2deb0', speed: 320, angle: -Math.PI / 2, spread: 2.8, size: 3.5, life: 0.6 });
    if (this.phase >= 2) {
      this.shockwave(this.cx - 40, -1, 400, 30, { color: 'rgba(255,200,120,0.9)' });
      this.shockwave(this.cx + 40, 1, 400, 30, { color: 'rgba(255,200,120,0.9)' });
    }
    if (this.phase >= 3) for (let i = 0; i < 5; i++) this.dropWax(this.cx + (i - 2) * 20, this.y + 20, (i - 2) * 110, -620, 8);
    yield 1.0;
  }

  // --------------------------------------------------------------- floor attacks
  *skitter() {
    this.perchCount++;
    this.facePlayer();
    this.crouch = 1; this.holdCrouch = true; this.tele = 0.45; this.fang = 1;
    this.sfx('charge');
    yield 0.45;
    this.holdCrouch = false; this.skit = 1;
    this.sfx('dash');
    const dist = Math.min(this.distX() + 240, this.arena.w);
    const speed = 600 + this.phase * 70;
    let moved = 0, dropT = 0;
    for (;;) {
      const step = speed * this.speedMul * this.dt;
      const ox = this.x;
      this.x = clamp(this.x + this.facing * step, this.L, this.R - this.w);
      moved += Math.abs(this.x - ox);
      if (this.phase >= 3 && (dropT -= this.dt) <= 0) { dropT = 0.14; this.dropWax(this.cx - this.facing * 50, this.y + 30, -this.facing * 60, -380, 7); }
      if (Math.abs(this.x - ox) < step * 0.5 || moved >= dist) break;
      yield;
    }
    this.skit = 0; this.fang = 0;
    if (this.x <= this.L + 1 || this.x >= this.R - this.w - 1) { this.shake(5, 0.25); this.sfx('bonkWall'); }
    yield 0.65;
    this.facePlayer();
  }

  *pounce() {
    this.perchCount++;
    this.facePlayer();
    this.crouch = 1; this.holdCrouch = true; this.tele = 0.5; this.fang = 1;
    this.sfx('rustle');
    yield 0.5;
    this.holdCrouch = false;
    this.sfx('leap');
    this.curl = 0.4;
    yield* this.leapTo(this.player.cx, 210, 0.75);
    this.noPhysics = true; this.curl = 0; this.crouch = 1; this.fang = 0;
    this.sfx('slam'); this.shake(7, 0.3);
    this.fx.burst(this.cx, this.groundY, 16, { color: '#f2deb0', speed: 280, angle: -Math.PI / 2, spread: 2.6, size: 3, life: 0.5 });
    if (this.phase >= 2) for (let i = 0; i < 4; i++) this.dropWax(this.cx, this.y + 20, (i - 1.5) * 150, -560, 8);
    yield 0.8;
  }

  *lobFlames() {
    this.perchCount++;
    this.facePlayer();
    this.flare = 1; this.tele = 0.5; this.shudder = 0.5;
    this.sfx('charge');
    yield 0.5;
    const n = 3 + this.phase;
    const p = this.player;
    for (let i = 0; i < n; i++) {
      const tx = clamp(p.cx + (i - (n - 1) / 2) * 95 + this.rand(-20, 20), this.L + 20, this.R - 20);
      this.lobAt(this.cx - this.facing * 20, this.y + 4, tx, 0.95, { gravity: 1100, art: 'glob', color: '#ffb35a', r: 9, life: 3, onDie: (pr) => this.waxPuddle(pr) });
      this.sfx('spit');
      yield 0.09;
    }
    this.flare = 0;
    yield 1.0;
  }

  *candles() {
    this.perchCount++;
    this.flare = 1; this.fang = 1; this.tele = 0.6; this.shudder = 0.6;
    this.sfx('screech');
    yield 0.6;
    const ty = Math.floor((this.groundY - 1) / TILE);
    for (const d of [-1, 1]) {
      const x = clamp(this.cx + d * 130, this.L + 40, this.R - 40);
      const m = this.summon('wickling', Math.floor(x / TILE), ty);
      if (m) { m.facing = d; m.state = 'rush'; }
    }
    this.flare = 0; this.fang = 0;
    yield 0.9;
  }

  *ascend() {
    this.sfx('rustle');
    this.tele = 0.4;
    let t = 0;
    while (t < 0.4) { t += this.dt; this.threadK = t / 0.4; yield; }
    this.threadK = 1;
    const y0 = this.y;
    t = 0;
    let dripped = 0;
    while (t < 0.9) {
      t += this.dt * this.speedMul;
      const k = easeIO(Math.min(1, t / 0.9));
      this.y = y0 + (this.hangY - y0) * k;
      this.curl = k;
      if (this.phase >= 2 && dripped < 2 && t > 0.3 + dripped * 0.3) { dripped++; const [sx, sy] = this.spinneret(); this.dropWax(sx, sy + 8, this.rand(-80, 80), 0, 8); }
      yield;
    }
    this.perch = 'ceil'; this.perchCount = 0;
    yield 0.4;
  }

  onPhase(n) {
    this.sfx('bossRoar'); this.shake(7, 0.6); this.tele = 0.9; this.flare = 1;
    this.fx.burst(this.cx, this.y + 20, 24, { color: '#ffcf7a', speed: 300, size: 3, life: 0.7, glow: true });
    if (n === 3) this.speedMul *= 1.12;
    setTimeout(() => { if (!this.dead) this.flare = 0; }, 700);
  }

  bodyBox() {
    if (this.skit) return { x: this.x + 14, y: this.y + 34, w: this.w - 28, h: this.h - 38 };
    return { x: this.x + 16, y: this.y + 20, w: this.w - 32, h: this.h - 26 };
  }

  // --------------------------------------------------------------- drawing
  drawExtra(ctx, t) {
    // telegraph marks
    for (const m of this.marks) {
      const k = m.t / m.dur;
      if (m.kind === 'drip') {
        const G = this.groundY;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,200,120,${0.05 + 0.1 * k})`;
        ctx.fillRect(m.x - 5, m.y, 10, G - m.y);
        glow(ctx, m.x, G - 2, 30 + 10 * k, 'rgba(255,190,100,0.5)', 0.4 + 0.5 * k);
        ctx.restore();
        const r = 3 + 6 * k;
        ctx.beginPath(); ctx.moveTo(m.x - r * 0.8, m.y + 2); ctx.quadraticCurveTo(m.x - r, m.y + r * 1.6, m.x, m.y + r * 2.2); ctx.quadraticCurveTo(m.x + r, m.y + r * 1.6, m.x + r * 0.8, m.y + 2);
        fs(ctx, false, '#f2deb0', 2);
      } else if (m.kind === 'shadow') {
        ctx.fillStyle = `rgba(10,6,4,${0.25 + 0.4 * k})`;
        ctx.beginPath(); ctx.ellipse(m.x, m.y - 2, m.w * (0.4 + 0.3 * k), 8, 0, 0, TAU); ctx.fill();
      }
    }
    // web strands
    for (const s of this.strands) {
      const tele = s.t < s.arm;
      const born = Math.min(1, s.t / 0.22);
      const x2 = s.x1 + (s.x2 - s.x1) * born, y2 = s.y1 + (s.y2 - s.y1) * born;
      const fade = Math.min(1, (s.life - s.t) / 0.25);
      ctx.save();
      ctx.lineCap = 'round';
      if (tele) {
        const pulse = 0.35 + 0.35 * Math.sin(s.t * 30);
        ctx.setLineDash([10, 8]);
        ctx.strokeStyle = `rgba(255,214,150,${pulse})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.globalAlpha = fade;
        ctx.strokeStyle = INK; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
        ctx.strokeStyle = '#f6ecd6'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
        // wax dew beads that glow
        const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1), n = Math.floor(L / 46);
        for (let i = 1; i < n; i++) {
          const q = i / n, bx = s.x1 + (s.x2 - s.x1) * q, by = s.y1 + (s.y2 - s.y1) * q + 4;
          ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(bx, by, 4.5, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffd38a'; ctx.beginPath(); ctx.arc(bx, by, 3, 0, TAU); ctx.fill();
          glow(ctx, bx, by, 12, 'rgba(255,190,100,0.6)', 0.5 + 0.2 * Math.sin(t * 6 + i));
        }
      }
      ctx.restore();
    }
  }

  drawBody(ctx, t, white) {
    const f = this.facing;
    const cx = this.cx, by = this.y + this.h;
    const shake = this.shudder > 0 ? Math.sin(t * 70) * 2.5 : 0;
    const breathe = Math.sin(t * 2.2) * 2;
    const dy = this.crouch * 9 - breathe * 0.5;
    const curl = this.curl;
    const anchorY = this.arena.y;
    // thread to the ceiling
    if (this.threadK > 0 && (this.perch === 'ceil' || curl > 0 || this.threadK < 1)) {
      const tx = cx - f * 24, ty1 = by - 92 + dy;
      const top = anchorY - 4, bot = top + (ty1 - top) * this.threadK;
      ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(tx, top); ctx.lineTo(tx + shake * 0.3, bot); ctx.stroke();
      ctx.strokeStyle = white ? '#fff' : '#efe2c2'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(tx, top); ctx.lineTo(tx + shake * 0.3, bot); ctx.stroke();
    }
    ctx.save();
    ctx.translate(cx + shake, by);
    ctx.scale(f, 1);
    if (this.perch === 'ceil' && this.mode !== 'dying') ctx.rotate(Math.sin(t * 1.3) * 0.035);

    const walk = this.legT;
    const legCol = white ? '#fff' : '#2a1d16';
    // 8 legs: 4 hips per side. far side first (darker, smaller), near side after the body
    const HIPS = [[34, -54], [18, -60], [-6, -62], [-30, -58]];
    const FEET = [[140, 0], [84, 0], [-62, 0], [-128, 0]];
    const leg = (i, far) => {
      const [hx0, hy0] = HIPS[i];
      const hx = hx0 + (far ? -6 : 0), hy = hy0 + dy + (far ? -4 : 0);
      const ph = walk * 1.4 + i * 1.7 + (far ? Math.PI : 0);
      const side = FEET[i][0] > 0 ? 1 : -1;
      let fx = FEET[i][0] * (far ? 0.86 : 1) + Math.sin(ph) * (this.skit ? 22 : 5);
      let fy = -Math.max(0, Math.cos(ph)) * (this.skit ? 16 : 2);
      // hanging: legs splay out and paddle slowly in the air
      const cfx = FEET[i][0] * 0.95 + Math.sin(t * 2.2 + i * 1.3) * 7, cfy = 6 + (i === 1 || i === 2 ? 14 : 0) + Math.sin(t * 2.2 + i * 1.3 + 1) * 9;
      fx = fx + (cfx - fx) * curl; fy = fy + (cfy - fy) * curl;
      const kx = hx + (fx - hx) * 0.5 + side * 4, ky = hy - 66 + curl * 22 + (far ? 6 : 0) + this.crouch * 12;
      const ax2 = kx + (fx - kx) * 0.62, ay2 = ky + (fy - ky) * 0.3;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = far ? 7 : 9;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(ax2, ay2); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.strokeStyle = white ? '#fff' : (far ? '#1c1410' : legCol); ctx.lineWidth = far ? 3 : 4.5;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(ax2, ay2); ctx.lineTo(fx, fy); ctx.stroke();
      // wax knob at the knee + wax sock at the foot
      ctx.beginPath(); ctx.arc(kx, ky, far ? 4 : 5.5, 0, TAU); fs(ctx, white, far ? '#b9a27a' : '#efdcae', 2);
      ctx.beginPath(); ctx.moveTo(kx - 3, ky + 3); ctx.quadraticCurveTo(kx - 1, ky + 12, kx + 1, ky + 14); ctx.lineTo(kx + 2, ky + 4); fs(ctx, white, far ? '#b9a27a' : '#efdcae', 1.5);
      ctx.beginPath(); ctx.ellipse(fx, fy - 3, far ? 4 : 5, far ? 3 : 4, 0, 0, TAU); fs(ctx, white, far ? '#a38d66' : '#e2cc9c', 1.5);
    };
    for (let i = 0; i < 4; i++) leg(i, true);

    // ---- abdomen: a cluster of fused, melting candles
    const ax = -26, ay = -64 + dy;
    const arx = 62 + breathe * 0.6, ary = 44 + breathe * 0.4;
    // candles rising from the abdomen (behind the wax mass)
    const lit = this.mode === 'dormant' ? 2 : 4 + this.phase;
    const CANDLES = [[-2.55, 40, 13], [-2.2, 58, 15], [-1.85, 70, 16], [-1.5, 52, 14], [-1.2, 64, 13], [-0.9, 42, 12], [-2.85, 30, 11], [-0.65, 30, 11]];
    CANDLES.forEach(([a, hgt, cw], i) => {
      const melt = this.phase >= 3 ? 0.8 : 1;
      const H = hgt * melt + Math.sin(t * 1.5 + i) * 1.5;
      const bx = ax + Math.cos(a) * arx * 0.7, byy = ay + Math.sin(a) * ary * 0.7;
      ctx.save();
      ctx.translate(bx, byy);
      ctx.rotate((a + Math.PI / 2) * 0.45);
      const cols = ['#f4e6c4', '#e9d3a2', '#f7ecd2', '#e6cf9c'];
      ctx.beginPath();
      ctx.moveTo(-cw / 2, 0); ctx.lineTo(-cw / 2, -H);
      ctx.quadraticCurveTo(-cw * 0.25, -H - 4, 0, -H + 2); ctx.quadraticCurveTo(cw * 0.25, -H - 5, cw / 2, -H);
      ctx.lineTo(cw / 2, 0); ctx.closePath();
      fs(ctx, white, cols[i % 4], 2.5);
      if (!white) {
        ctx.fillStyle = 'rgba(160,110,60,0.25)'; ctx.fillRect(cw * 0.1, -H + 3, cw * 0.38, H - 3);
        // drip runs
        ctx.fillStyle = '#fbf3e0';
        ctx.beginPath(); ctx.moveTo(-cw / 2, -H + 1); ctx.quadraticCurveTo(-cw / 2 - 2, -H + 14 + (i % 3) * 5, -cw / 2 + 2, -H + 16 + (i % 3) * 6); ctx.lineTo(-cw / 2 + 3, -H + 2); ctx.fill();
      }
      // wick
      ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -H + 1); ctx.quadraticCurveTo(1, -H - 4, -1, -H - 7); ctx.stroke();
      if (i < lit && !white) {
        const fl = 1 + Math.sin(t * 13 + i * 2.1) * 0.15 + this.flareV * 0.8;
        const fh = 13 * fl;
        glow(ctx, 0, -H - 10, 22 * fl, 'rgba(255,170,80,0.55)');
        ctx.fillStyle = '#ff9a40';
        ctx.beginPath(); ctx.moveTo(-5, -H - 6); ctx.quadraticCurveTo(-5 + Math.sin(t * 9 + i) * 2, -H - 6 - fh, Math.sin(t * 7 + i) * 3, -H - 8 - fh * 1.25);
        ctx.quadraticCurveTo(5, -H - 6 - fh * 0.5, 5, -H - 6); ctx.quadraticCurveTo(0, -H - 2, -5, -H - 6); ctx.fill();
        ctx.fillStyle = '#fff4d0';
        ctx.beginPath(); ctx.ellipse(0, -H - 9 - fh * 0.15, 2.2, 4.5 * fl, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();
    });
    // the wax mass
    ctx.beginPath();
    ctx.ellipse(ax, ay, arx, ary, 0, 0, TAU);
    fs(ctx, white, '#ead7ab', 3.5);
    if (!white) {
      // amber shading + highlight
      const g = ctx.createRadialGradient(ax - 18, ay - 18, 4, ax, ay, arx);
      g.addColorStop(0, 'rgba(255,248,228,0.65)'); g.addColorStop(0.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(120,70,30,0.35)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(ax, ay, arx - 2, ary - 2, 0, 0, TAU); ctx.fill();
      // embedded candle stubs (fused into the mass)
      ctx.strokeStyle = 'rgba(140,95,50,0.45)'; ctx.lineWidth = 2;
      for (const [sx, sy, sh] of [[-40, -6, 22], [-12, 6, 26], [16, -4, 18], [-28, 18, 14]]) {
        ctx.beginPath(); ctx.moveTo(ax + sx - 6, ay + sy); ctx.lineTo(ax + sx - 6, ay + sy - sh); ctx.quadraticCurveTo(ax + sx, ay + sy - sh - 4, ax + sx + 6, ay + sy - sh); ctx.lineTo(ax + sx + 6, ay + sy); ctx.stroke();
      }
      // hourglass marking, like a widow's, in old soot
      ctx.fillStyle = '#5a2a1c';
      ctx.beginPath(); ctx.moveTo(ax - 14, ay - 12); ctx.lineTo(ax + 14, ay - 12); ctx.lineTo(ax + 3, ay); ctx.lineTo(ax + 14, ay + 12); ctx.lineTo(ax - 14, ay + 12); ctx.lineTo(ax - 3, ay); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff9a40'; ctx.globalAlpha = 0.4 + 0.3 * Math.sin(t * 3);
      ctx.beginPath(); ctx.moveTo(ax - 8, ay - 8); ctx.lineTo(ax + 8, ay - 8); ctx.lineTo(ax, ay); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // melting drips hanging from the underside
    const dripN = this.phase >= 3 ? 7 : 5;
    for (let i = 0; i < dripN; i++) {
      const q = (i + 0.5) / dripN;
      const a = Math.PI * (0.15 + q * 0.7);
      const dx = ax + Math.cos(a) * arx * 0.95, dyy = ay + Math.sin(a) * ary * 0.95;
      const len = 10 + ((i * 7) % 5) * 3 + Math.sin(t * 1.7 + i * 1.3) * 4 + (this.phase >= 3 ? 6 : 0);
      ctx.beginPath(); ctx.moveTo(dx - 6, dyy - 4); ctx.quadraticCurveTo(dx - 5, dyy + len * 0.7, dx, dyy + len); ctx.quadraticCurveTo(dx + 5, dyy + len * 0.7, dx + 6, dyy - 4); ctx.closePath();
      fs(ctx, white, '#efdcae', 2);
    }
    // spinneret thread while weaving
    if (this.spinning && !white) {
      ctx.strokeStyle = 'rgba(255,240,210,0.8)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(ax - arx * 0.8, ay + 8); ctx.quadraticCurveTo(ax - arx - 20, ay + 20 + i * 10 + Math.sin(t * 20 + i) * 6, ax - arx - 40, ay + 30 + i * 14); ctx.stroke(); }
    }

    for (let i = 0; i < 4; i++) leg(i, false);
    // ---- head (cephalothorax) with a pale mask and lace veil
    const hx = 50, hy = -50 + dy;
    ctx.beginPath(); ctx.ellipse(hx - 6, hy + 2, 34, 28, -0.15, 0, TAU);
    fs(ctx, white, '#d9c294', 3.5);
    // fangs
    const fo = this.fangV * 0.5;
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(hx + 20, hy + 20); ctx.rotate(s * (0.15 + fo));
      ctx.beginPath(); ctx.moveTo(s * 3, 0); ctx.quadraticCurveTo(s * 9 + 4, 10, 2, 20); ctx.quadraticCurveTo(s * 2, 10, -s * 3, 0); ctx.closePath();
      fs(ctx, white, '#2a1d16', 2);
      ctx.restore();
    }
    // mask
    const mx = hx + 14, my = hy - 4, mr = 26;
    ctx.beginPath();
    ctx.moveTo(mx - mr * 0.9, my - mr * 0.2);
    ctx.quadraticCurveTo(mx - mr * 0.9, my - mr * 1.2, mx, my - mr * 0.95);   // widow's peak
    ctx.quadraticCurveTo(mx + mr * 0.9, my - mr * 1.2, mx + mr * 0.9, my - mr * 0.2);
    ctx.quadraticCurveTo(mx + mr * 0.75, my + mr * 0.9, mx, my + mr * 1.15);
    ctx.quadraticCurveTo(mx - mr * 0.75, my + mr * 0.9, mx - mr * 0.9, my - mr * 0.2);
    fs(ctx, white, '#f3ecdc', 3);
    if (!white) {
      // eyes: two large sockets + four small in an arc
      const open = this.mode === 'dormant' ? 0.25 : 0.3 + 0.7 * Math.max(this.wake || 1, 0);
      ctx.fillStyle = INK;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(mx + s * 8, my + 2, 5.5, 8 * open, s * -0.35, 0, TAU); ctx.fill();
      }
      for (const s of [-1, 1]) eye(ctx, mx + s * 8, my + 3, 2.6, this.phase >= 3 ? '#ffe3a0' : '#ffb85c', true);
      for (let i = 0; i < 4; i++) {
        const a = -2.4 + i * 0.53;
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(mx + Math.cos(a) * 14, my - 4 + Math.sin(a) * 9, 2.4, 0, TAU); ctx.fill();
        eye(ctx, mx + Math.cos(a) * 14, my - 4 + Math.sin(a) * 9, 1, '#ffcf7a', false);
      }
      // wax tears
      ctx.strokeStyle = '#f1dcae'; ctx.lineWidth = 2.5;
      for (const s of [-1, 1]) {
        const L = 10 + Math.sin(t * 2 + s) * 3 + (this.phase >= 3 ? 6 : 0);
        ctx.beginPath(); ctx.moveTo(mx + s * 8, my + 9); ctx.quadraticCurveTo(mx + s * 9, my + 9 + L * 0.6, mx + s * 7, my + 9 + L); ctx.stroke();
        ctx.fillStyle = '#f1dcae'; ctx.beginPath(); ctx.arc(mx + s * 7, my + 10 + L, 2.2, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(22,20,28,0.35)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(mx - 4, my + 14); ctx.quadraticCurveTo(mx, my + 16, mx + 4, my + 14); ctx.stroke();
      // lace veil draped from the crown
      ctx.fillStyle = 'rgba(22,20,28,0.78)';
      ctx.beginPath();
      ctx.moveTo(mx - mr * 1.1, my - mr * 0.6);
      ctx.quadraticCurveTo(mx - 2, my - mr * 1.45, mx + mr * 0.7, my - mr * 0.85);
      ctx.quadraticCurveTo(mx - 4, my - mr * 0.85, mx - mr * 0.6, my - mr * 0.2);
      ctx.quadraticCurveTo(mx - mr * 1.1, my + mr * 0.6 + Math.sin(t * 1.6) * 3, mx - mr * 1.6, my + mr * 0.9);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(240,226,200,0.35)'; ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(mx - mr * 0.75 + i * 5, my - mr * 0.7 + i * 2.5, 2.5, 0, TAU); ctx.stroke(); }
    } else {
      ctx.fillStyle = '#fff';
    }
    // wax crown dripping over the brow
    ctx.beginPath();
    ctx.moveTo(mx - 14, my - 18);
    for (let i = 0; i <= 4; i++) ctx.lineTo(mx - 14 + i * 7, my - 24 - (i % 2 ? 8 : 0));
    ctx.lineTo(mx + 14, my - 18); ctx.closePath();
    fs(ctx, white, '#efdcae', 2);
    if (!white && this.mode !== 'dormant') glow(ctx, mx, my - 30, 16 + this.flareV * 10, 'rgba(255,180,90,0.5)');

    ctx.restore();
  }
}

// ==================================================================================================
// OSSUARY KNIGHT — Last of the Wax Guard. A skeletal knight with a tallow shield and a greatsword.
// A tight duel: the shield turns frontal Bonks aside (strike from above or behind, or during his
// recovery), a parry stance punishes greedy hits, and every swing leaves a clear opening afterwards.
// ==================================================================================================
const POSES = {
  rest: { a: 0.55, hx: 20, hy: -72, sh: 1 },
  kneel: { a: Math.PI / 2 - 0.08, hx: 30, hy: -150, sh: 0.55 },
  raise: { a: -2.25, hx: -2, hy: -118, sh: 0.4 },
  slam: { a: 0.5, hx: 36, hy: -46, sh: 0.35 },
  drawback: { a: Math.PI - 0.2, hx: -30, hy: -58, sh: 0.75 },
  thrust: { a: 0.12, hx: 44, hy: -46, sh: 0.3 },
  lowback: { a: 2.55, hx: -26, hy: -52, sh: 0.55 },
  lowswing: { a: 0.32, hx: 38, hy: -50, sh: 0.5 },
  highback: { a: -2.45, hx: -20, hy: -104, sh: 0.55 },
  highswing: { a: -0.22, hx: 40, hy: -86, sh: 0.5 },
  stance: { a: -1.5, hx: 24, hy: -82, sh: 0.1 },
  plunge: { a: Math.PI / 2, hx: 8, hy: -36, sh: 0.5 },
  bashback: { a: 1.4, hx: -10, hy: -58, sh: 0.7 },
  bash: { a: 1.3, hx: -12, hy: -58, sh: 1.5 },
};

export class OssuaryKnight extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'ossuaryknight', size: [72, 144], music: 'boss', glints: 200, introTime: 2.3 });
    if (this.dead) return;
    this.light = 170;
    this.guard = false;
    this.pose = 'kneel'; this.cur = Object.assign({}, POSES.kneel);
    this.kneel = 1; this.walkT = 0; this.turnT = 0; this.autoFace = false;
    this.blocked = 0; this.shieldJolt = 0; this.parryOn = false; this.parried = false; this.glintT = 0;
    this.fireK = 0; this.fireV = 0; this.interruptible = false; this.counterQ = null;
    this.marks = [];
    this.dt = 1 / 60;
  }

  update(dt) {
    this.dt = dt;
    super.update(dt);
    if (this.dead) return;
    // ease toward the current pose (snap() for instant swings)
    const P = POSES[this.pose] || POSES.rest;
    const k = Math.min(1, dt * 14);
    let da = P.a - this.cur.a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
    this.cur.a += da * k; this.cur.hx += (P.hx - this.cur.hx) * k; this.cur.hy += (P.hy - this.cur.hy) * k; this.cur.sh += (P.sh - this.cur.sh) * k;
    if (this.shieldJolt > 0) this.shieldJolt -= dt;
    if (this.glintT > 0) this.glintT -= dt;
    this.fireV = (this.fireV || 0) + (this.fireK - (this.fireV || 0)) * Math.min(1, dt * 8);
    if (this.mode === 'intro' || this.mode === 'fight') this.kneel = Math.max(0, this.kneel - dt * 1.4);
  }
  snap() { const P = POSES[this.pose]; Object.assign(this.cur, P); }

  introUpdate(dt, t) {
    if (t > 0.6 && this.pose === 'kneel') { this.pose = 'rest'; this.sfx('clink'); }
    if (t > 1.3 && t < 1.4) { this.fireK = 1; this.sfx('slash'); }
    if (t > 2.0) this.fireK = 0;
  }
  onStart() { this.facePlayer(); }

  think(dt) {
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i];
      m.t += dt;
      if (m.t >= m.dur) { this.marks.splice(i, 1); if (m.done) m.done(); }
    }
    if (this.autoFace) {
      if (this.dirTo() !== this.facing) { this.turnT += dt; if (this.turnT > 0.28) { this.facing = -this.facing; this.turnT = 0; } }
      else this.turnT = 0;
    }
    if (this.counterQ && this.interruptible) {
      this.co = this.shieldBash(); this.wait = 0;
      this.counterQ = null; this.interruptible = false;
    }
  }
  addMark(m) { this.marks.push(Object.assign({ t: 0 }, m)); }
  onDeath() { this.marks.length = 0; this.parryOn = false; this.fireK = 0; this.pose = 'kneel'; }

  // The tallow shield turns away Bonks from the front. Pogo from above or strike from behind.
  shielded(p) {
    if (this.parryOn) {
      this.parried = true;
      this.glintT = 0.3;
      this.fx.burst(p.cx + Math.sign(this.cx - p.cx) * 20, p.cy, 12, { color: '#fff4d0', speed: 280, size: 2.5, life: 0.3, glow: true });
      this.fx.ring(this.cx + this.facing * 20, this.y + 40, 6, 60, 0.25, 'rgba(255,240,200,0.9)', 4);
      return true;
    }
    if (!this.guard || p.attackDir === 'down') return false;
    if (Math.sign(p.cx - this.cx) !== this.facing) return false;
    this.blocked++;
    this.shieldJolt = 0.15;
    p.b.vx = this.facing * 320;
    this.fx.burst(this.cx + this.facing * 34, p.cy, 7, { color: '#ffcf7a', speed: 220, size: 2, life: 0.3, glow: true });
    if (this.blocked >= 2) { this.blocked = 0; this.counterQ = 'bash'; }
    return true;
  }
  onHurt() {
    // struck from behind: he wheels around a little faster
    if (this.dirTo() !== this.facing) this.turnT = Math.max(this.turnT, 0.14);
  }

  chooseAttack() {
    const d = this.distX(), p = this.phase;
    this.pose = 'rest'; this.guard = true;
    return pickAttack(this, [
      { name: 'approach', w: d > 230 ? 2.5 : 0.7, fn: this.approach },
      { name: 'lunge', w: d < 460 ? 3 : 1, fn: this.lunge },
      { name: 'slam', w: 2, fn: this.slam },
      { name: 'arcs', w: d > 200 ? 2.5 : 1, fn: this.arcs },
      { name: 'parry', w: d < 260 ? 1.5 : 0.4, fn: this.parryStance },
      { name: 'plunge', w: p >= 2 ? 2 : 0, fn: this.plunge },
    ]);
  }

  // rect in front of him; `top` is measured up from his feet
  frontRect(off, reach, top, h) {
    const x = this.facing > 0 ? this.x + this.w + off : this.x - off - reach;
    return { x, y: this.y + this.h - top, w: reach, h };
  }

  *approach() {
    this.pose = 'rest'; this.guard = true; this.autoFace = true; this.interruptible = true;
    let t = 0;
    const dur = this.rand(0.55, 1.0);
    while (t < dur) {
      t += this.dt;
      const d = this.player.cx - this.cx, ad = Math.abs(d);
      let want = 0;
      if (Math.sign(d) === this.facing) want = ad > 160 ? 1 : ad < 90 ? -0.6 : 0;
      this.vx = want * this.facing * (80 + this.phase * 22) * this.speedMul;
      this.walkT += this.dt * Math.abs(this.vx) / 30;
      yield;
    }
    this.vx = 0; this.interruptible = false; this.autoFace = false;
  }

  *lunge(chained) {
    this.facePlayer();
    this.pose = 'drawback'; this.tele = chained ? 0.38 : 0.45;
    this.sfx('charge');
    yield chained ? 0.38 : 0.45;
    this.guard = false; this.pose = 'thrust'; this.snap(); this.fireK = this.phase >= 2 ? 1 : 0;
    this.sfx('thrust');
    const dist = clamp(this.distX() + 70, 170, 380);
    let moved = 0;
    while (moved < dist) {
      const ox = this.x;
      this.vx = this.facing * 920 * this.speedMul;
      this.hits.push(this.frontRect(-6, 112, 62, 56));
      if (Math.random() < 0.6) this.fx.add({ x: this.cx - this.facing * 20, y: this.y + this.rand(20, 110), vx: -this.facing * 200, vy: 0, life: 0.25, size: 3, color: 'rgba(240,230,210,0.6)', g: 0, shape: 'streak', front: false });
      yield;
      moved += Math.abs(this.x - ox);
      if (this.hitWall || Math.abs(this.x - ox) < 1) break;
    }
    this.vx = 0; this.fireK = 0;
    yield 0.18;
    this.pose = 'rest';
    if (this.phase >= 3 && !chained && Math.random() < 0.55) { yield 0.15; yield* this.lunge(true); return; }
    yield 0.55;
    this.guard = true;
  }

  *slam() {
    this.facePlayer();
    this.pose = 'raise'; this.tele = 0.45; this.fireK = 1;
    this.sfx('charge');
    yield 0.4;
    this.guard = false;
    this.sfx('leap');
    const tx = this.player.cx - this.facing * 46;
    yield* this.leapTo(tx, 150, 0.6);
    this.pose = 'slam'; this.snap();
    this.sfx('slam'); this.shake(9, 0.35);
    this.zone(this.facing > 0 ? this.x + this.w - 10 : this.x - 110, this.groundY - 64, 120, 64, 0.15);
    const tipX = this.cx + this.facing * 110;
    this.fx.burst(tipX, this.groundY, 20, { color: '#ffcf7a', speed: 320, angle: -Math.PI / 2, spread: 2.4, size: 3, life: 0.6, glow: true });
    const col = this.phase >= 2 ? 'rgba(255,170,80,0.95)' : 'rgba(240,232,214,0.9)';
    this.shockwave(tipX, 1, 380 + this.phase * 40, 32, { color: col });
    this.shockwave(tipX, -1, 380 + this.phase * 40, 32, { color: col });
    this.fireK = 0;
    yield 0.85;
    this.pose = 'rest';
    yield 0.2;
    this.guard = true;
  }

  *arcs() {
    this.facePlayer();
    const n = this.phase;
    let low = Math.random() < 0.5;
    for (let i = 0; i < n; i++) {
      this.pose = low ? 'lowback' : 'highback'; this.fireK = 1;
      const tt = i === 0 ? 0.5 : 0.38;
      this.tele = tt;
      this.sfx('charge');
      yield tt;
      this.guard = false;
      this.pose = low ? 'lowswing' : 'highswing'; this.snap();
      this.sfx('slash');
      const y = low ? this.groundY - 22 : this.groundY - 82;
      this.fire(this.cx + this.facing * 50, y, this.facing * (420 + this.phase * 30), 0, { art: 'ok_arc', r: 21, life: 4.5, color: '#ffb35a' });
      this.zone(this.facing > 0 ? this.x + this.w - 8 : this.x - 80, this.groundY - (low ? 60 : 112), 88, 56, 0.12);
      this.fx.slash(this.cx + this.facing * 50, low ? this.groundY - 40 : this.groundY - 90, this.facing > 0 ? 0 : Math.PI, 130, 'rgba(255,200,120,0.85)', 0.18, low ? 1 : -1);
      low = !low;
      yield 0.25;
    }
    this.fireK = 0;
    yield 0.5;
    this.pose = 'rest';
    this.guard = true;
    yield 0.2;
  }

  *parryStance() {
    this.facePlayer();
    this.pose = 'stance'; this.guard = false; this.parryOn = true; this.parried = false; this.glintT = 0.4;
    this.sfx('clink');
    this.fx.ring(this.cx + this.facing * 24, this.y + 44, 4, 40, 0.3, 'rgba(255,250,230,0.9)', 3);
    let t = 0;
    while (t < 1.2 && !this.parried) { t += this.dt; yield; }
    this.parryOn = false;
    if (this.parried) {
      // riposte: flash, wind up, then a fast dash-slash through where Bead stands
      this.sfx('parry');
      this.game.hitstop(0.08);
      this.game.flash('rgba(255,240,210,0.35)', 0.2);
      this.facePlayer();
      this.pose = 'lowback'; this.tele = 0.4; this.fireK = 1; this.guard = true;
      yield 0.4;
      this.guard = false; this.pose = 'lowswing'; this.snap();
      this.sfx('slash');
      let moved = 0;
      while (moved < 240) {
        const ox = this.x;
        this.vx = this.facing * 1000 * this.speedMul;
        this.hits.push(this.frontRect(-20, 100, 92, 88));
        yield;
        moved += Math.abs(this.x - ox);
        if (this.hitWall || Math.abs(this.x - ox) < 1) break;
      }
      this.vx = 0;
      this.fx.slash(this.cx + this.facing * 50, this.groundY - 50, this.facing > 0 ? 0 : Math.PI, 170, 'rgba(255,220,160,0.9)', 0.2);
      this.fireK = 0;
      yield 0.65;
    } else {
      this.pose = 'drawback'; this.tele = 0.35;
      yield 0.35;
      this.guard = false; this.pose = 'thrust'; this.snap(); this.sfx('thrust');
      for (let i = 0; i < 9; i++) { this.vx = this.facing * 500; this.hits.push(this.frontRect(-6, 104, 62, 56)); yield; }
      this.vx = 0;
      yield 0.5;
    }
    this.pose = 'rest'; this.guard = true;
    yield 0.15;
  }

  *shieldBash() {
    this.facePlayer();
    this.pose = 'bashback'; this.tele = 0.38; this.guard = true;
    this.sfx('charge');
    yield 0.38;
    this.pose = 'bash'; this.snap(); this.sfx('slam');
    for (let i = 0; i < 10; i++) {
      this.vx = this.facing * 560 * this.speedMul;
      this.hits.push(this.frontRect(-4, 40, 122, 118));
      yield;
    }
    this.vx = 0; this.shake(4, 0.2);
    this.pose = 'rest';
    this.guard = false;
    yield 0.5;
    this.guard = true;
  }

  *plunge() {
    this.facePlayer();
    this.pose = 'raise'; this.tele = 0.4;
    this.sfx('leap');
    yield 0.35;
    this.guard = false; this.noPhysics = true; this.gravity = 0;
    const y0 = this.y, apex = Math.max(this.arena.y + 8, this.groundY - this.h - 270);
    let t = 0;
    while (t < 0.4) {
      t += this.dt;
      this.y = y0 + (apex - y0) * easeIO(Math.min(1, t / 0.4));
      this.x += clamp(this.player.cx - this.cx, -650 * this.dt, 650 * this.dt);
      yield;
    }
    this.pose = 'plunge'; this.fireK = 1;
    this.sfx('warn');
    const mark = { kind: 'target', x: this.cx, y: this.groundY, dur: 0.5 };
    this.addMark(mark);
    t = 0;
    while (t < 0.5) {
      t += this.dt;
      if (t < 0.2) this.x += clamp(this.player.cx - this.cx, -300 * this.dt, 300 * this.dt);
      this.x = clamp(this.x, this.arena.x, this.arena.x + this.arena.w - this.w);
      mark.x = this.cx;
      yield;
    }
    let vy = 600;
    while (this.y < this.groundY - this.h) {
      vy = Math.min(2000, vy + 5000 * this.dt);
      this.y = Math.min(this.groundY - this.h, this.y + vy * this.dt);
      yield;
    }
    this.noPhysics = false; this.gravity = 2200; this.vy = 0;
    this.sfx('slam'); this.shake(10, 0.4);
    this.zone(this.cx - 50, this.groundY - 50, 100, 50, 0.15);
    this.fx.burst(this.cx, this.groundY, 24, { color: '#ffb35a', speed: 360, angle: -Math.PI / 2, spread: 2.6, size: 3.5, life: 0.7, glow: true });
    if (this.phase >= 3) {
      for (const d of [-1, 1]) for (const k of [1, 2, 3]) {
        const x = this.cx + d * (60 + k * 95);
        if (x < this.arena.x + 10 || x > this.arena.x + this.arena.w - 10) continue;
        this.addMark({ kind: 'pillar', x, y: this.groundY, dur: 0.38 + k * 0.14, done: () => { this.zone(x - 22, this.groundY - 150, 44, 150, 0.4, { art: 'ok_pillar' }); this.sfx('burst'); } });
      }
    } else {
      this.shockwave(this.cx, 1, 400, 30, { color: 'rgba(255,170,80,0.95)' });
      this.shockwave(this.cx, -1, 400, 30, { color: 'rgba(255,170,80,0.95)' });
    }
    this.fireK = 0;
    yield 1.0;
    this.pose = 'rest';
    yield 0.2;
    this.guard = true;
  }

  onPhase(n) {
    this.sfx('bossRoar'); this.shake(6, 0.5); this.tele = 0.8;
    this.fx.burst(this.cx, this.y + 10, 20, { color: '#ffcf7a', speed: 260, size: 3, life: 0.7, glow: true });
    if (n === 3) this.speedMul *= 1.1;
  }

  bodyBox() { return { x: this.x + 12, y: this.y + 8 + this.kneel * 26, w: this.w - 24, h: this.h - 8 - this.kneel * 26 }; }

  drawExtra(ctx, t) {
    for (const m of this.marks) {
      const k = m.t / m.dur;
      ctx.save();
      if (m.kind === 'target') {
        ctx.fillStyle = `rgba(10,6,4,${0.3 + 0.4 * k})`;
        ctx.beginPath(); ctx.ellipse(m.x, m.y - 2, 30 + 20 * k, 7, 0, 0, TAU); ctx.fill();
        glow(ctx, m.x, m.y - 4, 50, 'rgba(255,160,70,0.6)', 0.3 + 0.5 * k);
      } else if (m.kind === 'pillar') {
        glow(ctx, m.x, m.y - 6, 26 + 14 * k, 'rgba(255,170,80,0.8)', 0.3 + 0.6 * k);
        ctx.fillStyle = `rgba(255,200,120,${0.4 * k})`;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(m.x + Math.sin(t * 20 + i * 2) * 12, m.y - 4 - ((t * 120 + i * 20) % 40), 2, 0, TAU); ctx.fill(); }
      }
      ctx.restore();
    }
  }

  drawSword(ctx, white, t) {
    const { a, hx } = this.cur;
    const hy = this.cur.hy + this.kneel * 22;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(a);
    const L = 124;
    if (!white && this.fireV > 0.02) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = this.fireV;
      const g = ctx.createLinearGradient(0, 0, L, 0);
      g.addColorStop(0, 'rgba(255,170,80,0.1)'); g.addColorStop(0.5, 'rgba(255,170,80,0.6)'); g.addColorStop(1, 'rgba(255,230,160,0.8)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(L * 0.6, 0, L * 0.55, 16 + Math.sin(t * 30) * 2, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // grip + pommel
    ctx.beginPath(); ctx.roundRect(-24, -4, 26, 8, 3); fs(ctx, white, '#5a3a24', 2.5);
    if (!white) { ctx.strokeStyle = '#efdcae'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-20 + i * 7, -4); ctx.lineTo(-16 + i * 7, 4); ctx.stroke(); } }
    ctx.beginPath(); ctx.arc(-26, 0, 6, 0, TAU); fs(ctx, white, '#e6dcc4', 2.5);
    // blade
    ctx.beginPath();
    ctx.moveTo(6, -7); ctx.lineTo(L - 16, -5.5); ctx.lineTo(L, 0); ctx.lineTo(L - 16, 5.5); ctx.lineTo(6, 7); ctx.closePath();
    fs(ctx, white, '#d9d4c6', 3);
    if (!white) {
      ctx.strokeStyle = 'rgba(22,20,28,0.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(L - 24, 0); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(12, -5, L - 34, 2);
      // nicks
      ctx.fillStyle = INK;
      for (const q of [40, 72, 96]) { ctx.beginPath(); ctx.moveTo(q, -6); ctx.lineTo(q + 3, -3); ctx.lineTo(q + 6, -6); ctx.fill(); }
      // wax melted over the base of the blade
      ctx.fillStyle = '#efdcae'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(6, -8); ctx.lineTo(26, -7); ctx.quadraticCurveTo(24, 2, 22, 12); ctx.quadraticCurveTo(18, 4, 14, 9); ctx.quadraticCurveTo(10, 3, 6, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // crossguard (bone)
    ctx.beginPath(); ctx.moveTo(2, -16); ctx.quadraticCurveTo(10, -8, 6, 0); ctx.quadraticCurveTo(10, 8, 2, 16); ctx.lineTo(-2, 14); ctx.quadraticCurveTo(2, 0, -2, -14); ctx.closePath();
    fs(ctx, white, '#e6dcc4', 2.5);
    ctx.restore();
    if (!white && this.glintT > 0) {
      const gx = hx + Math.cos(a) * L * 0.8, gy = hy + Math.sin(a) * L * 0.8;
      const s = 18 * (this.glintT / 0.4) + 6;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,250,235,0.95)';
      ctx.beginPath(); ctx.moveTo(gx - s, gy); ctx.lineTo(gx, gy - 2); ctx.lineTo(gx + s, gy); ctx.lineTo(gx, gy + 2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(gx, gy - s); ctx.lineTo(gx + 2, gy); ctx.lineTo(gx, gy + s); ctx.lineTo(gx - 2, gy); ctx.closePath(); ctx.fill();
      ctx.restore();
      glow(ctx, gx, gy, 30, 'rgba(255,250,230,0.8)');
    }
    if (!white && this.parryOn) {
      const gx = hx + Math.cos(a) * L * 0.5, gy = hy + Math.sin(a) * L * 0.5;
      glow(ctx, gx, gy, 46 + Math.sin(t * 20) * 6, 'rgba(255,245,220,0.5)');
    }
  }

  drawBody(ctx, t, white) {
    const f = this.facing;
    const cx = this.cx, by = this.y + this.h;
    const kn = this.kneel;
    const br = Math.sin(t * 2.4) * 1.5;
    const sink = kn * 26;
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(f * 1.14, 1.14);
    const P = this.pose;
    const swordBehind = ['rest', 'drawback', 'raise', 'lowback', 'highback', 'kneel', 'bashback', 'bash'].includes(P);
    const torsoY = -48 + sink + br * 0.3;
    // ---- tattered cape
    const sway = Math.sin(t * 2) * 5 + (this.vx ? -Math.sign(this.vx) * f * 10 : 0);
    ctx.beginPath();
    ctx.moveTo(-14, torsoY - 50);
    ctx.quadraticCurveTo(-40 - sway, torsoY - 10, -46 - sway * 1.4, -4 + sink * 0.3);
    for (let i = 0; i < 5; i++) ctx.lineTo(-46 - sway * 1.4 + i * 9 + 4, (i % 2 ? -16 : -2) + sink * 0.3 + Math.sin(t * 4 + i) * 2);
    ctx.quadraticCurveTo(-10, torsoY - 4, 2, torsoY - 46);
    ctx.closePath();
    fs(ctx, white, '#3d2226', 3);
    if (!white && this.phase >= 3) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) { ctx.fillStyle = `rgba(255,${130 + i * 20},60,0.6)`; ctx.beginPath(); ctx.arc(-44 - sway * 1.4 + i * 9, -6 + Math.sin(t * 9 + i) * 3, 2.5, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    // ---- legs
    const wk = this.walkT;
    const legsDef = kn > 0.05
      ? [[-8, [-24, -2], [-26, -22]], [8, [26, -2], [30, -30]]]
      : [[-8, [-14 + Math.sin(wk) * 10, 0], null], [8, [14 - Math.sin(wk) * 10, 0], null]];
    for (const [hipX, foot, kneeOv] of legsDef) {
      const hx = hipX, hy = torsoY + 2;
      const [fx, fy] = foot;
      const kx = kneeOv ? kneeOv[0] : (hx + fx) / 2 + 6, ky = kneeOv ? kneeOv[1] + sink * 0.2 : (hy + fy) / 2;
      ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 13; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy - 4); ctx.stroke();
      ctx.strokeStyle = white ? '#fff' : '#2b2622'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy - 4); ctx.stroke();
      ctx.beginPath(); ctx.arc(kx, ky, 6, 0, TAU); fs(ctx, white, '#e6dcc4', 2.5);
      ctx.beginPath(); ctx.moveTo(fx - 9, fy); ctx.lineTo(fx - 7, fy - 9); ctx.lineTo(fx + 10, fy - 8); ctx.lineTo(fx + 14, fy); ctx.closePath();
      fs(ctx, white, '#3a332e', 2.5);
    }
    if (swordBehind) this.drawSword(ctx, white, t);
    // ---- sword arm (bone, with gauntlet)
    const shX = -6, shY = torsoY - 44;
    const hX = this.cur.hx, hY = this.cur.hy + kn * 22;
    const elX = (shX + hX) / 2 - 8, elY = Math.max(shY, hY) - 4 + 10;
    ctx.strokeStyle = white ? '#fff' : INK; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(elX, elY); ctx.lineTo(hX, hY); ctx.stroke();
    ctx.strokeStyle = white ? '#fff' : '#e6dcc4'; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(elX, elY); ctx.lineTo(hX, hY); ctx.stroke();
    ctx.beginPath(); ctx.arc(hX, hY, 7, 0, TAU); fs(ctx, white, '#3a332e', 2.5);
    // ---- torso: broken breastplate over a ribcage
    ctx.beginPath();
    ctx.moveTo(-20, torsoY - 46);
    ctx.quadraticCurveTo(0, torsoY - 54, 22, torsoY - 46);
    ctx.lineTo(18, torsoY - 14); ctx.quadraticCurveTo(14, torsoY + 2, 0, torsoY + 4);
    ctx.quadraticCurveTo(-14, torsoY + 2, -16, torsoY - 14);
    ctx.closePath();
    fs(ctx, white, '#2e2a2a', 3.5);
    if (!white) {
      // a torn hole showing ribs
      ctx.fillStyle = '#120d0b';
      ctx.beginPath(); ctx.moveTo(-8, torsoY - 40); ctx.lineTo(12, torsoY - 42); ctx.lineTo(14, torsoY - 18); ctx.lineTo(4, torsoY - 12); ctx.lineTo(-6, torsoY - 20); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e6dcc4'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-6, torsoY - 36 + i * 6); ctx.quadraticCurveTo(4, torsoY - 40 + i * 6, 13, torsoY - 35 + i * 6); ctx.stroke(); }
      // wax seal + glowing heart-candle inside
      glow(ctx, 4, torsoY - 26, 20 + this.fireV * 10, 'rgba(255,160,70,0.6)', 0.6 + 0.2 * Math.sin(t * 5));
      ctx.fillStyle = '#9c2a22'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(-12, torsoY - 8, 6, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-14, torsoY - 42); ctx.quadraticCurveTo(-16, torsoY - 26, -12, torsoY - 16); ctx.stroke();
    }
    // belt + tasset
    ctx.beginPath(); ctx.moveTo(-18, torsoY - 4); ctx.lineTo(20, torsoY - 4); ctx.lineTo(16, torsoY + 12); ctx.lineTo(-16, torsoY + 12); ctx.closePath();
    fs(ctx, white, '#3a2a22', 2.5);
    // pauldron
    ctx.beginPath(); ctx.ellipse(-6, torsoY - 44, 15, 10, -0.2, Math.PI, TAU); ctx.closePath();
    fs(ctx, white, '#e6dcc4', 3);
    // ---- skull helm
    const hx = 4, hy = torsoY - 66 + br * 0.4;
    ctx.beginPath();
    ctx.moveTo(hx - 15, hy + 10);
    ctx.quadraticCurveTo(hx - 18, hy - 18, hx, hy - 20);
    ctx.quadraticCurveTo(hx + 18, hy - 18, hx + 16, hy + 6);
    ctx.lineTo(hx + 12, hy + 18); ctx.lineTo(hx - 10, hy + 18); ctx.closePath();
    fs(ctx, white, '#ece4d0', 3.5);
    if (!white) {
      // visor: a cross slit with ember eyes
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.roundRect(hx - 9, hy - 4, 22, 6, 2); ctx.fill();
      ctx.beginPath(); ctx.roundRect(hx + 3, hy - 6, 5, 20, 2); ctx.fill();
      const ec = this.phase >= 3 ? '#ffe7a8' : '#ff9a40';
      eye(ctx, hx - 3, hy - 1, 2.2, ec, true);
      eye(ctx, hx + 11, hy - 1, 2.2, ec, true);
      // teeth on the jaw guard
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(hx - 6 + i * 5, hy + 12); ctx.lineTo(hx - 6 + i * 5, hy + 18); ctx.stroke(); }
      // crack
      ctx.beginPath(); ctx.moveTo(hx - 12, hy - 12); ctx.lineTo(hx - 6, hy - 8); ctx.lineTo(hx - 8, hy - 4); ctx.stroke();
    }
    // wax candle crest melted onto the helm
    ctx.beginPath();
    ctx.moveTo(hx - 6, hy - 18); ctx.lineTo(hx - 5, hy - 40); ctx.quadraticCurveTo(hx, hy - 43, hx + 5, hy - 40); ctx.lineTo(hx + 6, hy - 18); ctx.closePath();
    fs(ctx, white, '#f2e4c2', 2.5);
    ctx.beginPath();
    ctx.moveTo(hx - 14, hy - 12); ctx.quadraticCurveTo(hx - 8, hy - 22, hx, hy - 20); ctx.quadraticCurveTo(hx + 10, hy - 22, hx + 14, hy - 10);
    ctx.lineTo(hx + 12, hy - 2); ctx.quadraticCurveTo(hx + 10, hy - 10, hx + 7, hy - 9); ctx.lineTo(hx + 5, hy - 2); ctx.quadraticCurveTo(hx + 3, hy - 12, hx - 6, hy - 11); ctx.lineTo(hx - 10, hy - 4); ctx.closePath();
    fs(ctx, white, '#f2e4c2', 2);
    if (!white) {
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx, hy - 41); ctx.lineTo(hx + 1, hy - 46); ctx.stroke();
      const fl = 1 + Math.sin(t * 12) * 0.12 + this.fireV * 0.6 + (this.phase >= 3 ? 0.5 : 0);
      glow(ctx, hx, hy - 54, 26 * fl, 'rgba(255,170,80,0.55)');
      ctx.fillStyle = '#ff9a40';
      ctx.beginPath(); ctx.moveTo(hx - 5, hy - 46); ctx.quadraticCurveTo(hx - 4, hy - 56 * fl, hx + Math.sin(t * 8) * 3, hy - 46 - 16 * fl); ctx.quadraticCurveTo(hx + 5, hy - 52, hx + 5, hy - 46); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff4d0'; ctx.beginPath(); ctx.ellipse(hx, hy - 50, 2, 4 * fl, 0, 0, TAU); ctx.fill();
    }
    if (!swordBehind) this.drawSword(ctx, white, t);
    // ---- the tallow shield (front arm)
    const sh = this.cur.sh;
    const jolt = this.shieldJolt > 0 ? -4 : 0;
    const sx = 32 + (sh - 1) * 36 + jolt, sy = torsoY - 2 + (1 - Math.min(1, sh)) * 18;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate((1 - Math.min(1, sh)) * 0.5);
    const SW = 24, SH = 42;
    ctx.beginPath();
    ctx.moveTo(-SW, -SH + 14);
    ctx.quadraticCurveTo(-SW, -SH - 4, 0, -SH - 6);
    ctx.quadraticCurveTo(SW, -SH - 4, SW, -SH + 14);
    ctx.lineTo(SW - 2, SH - 18);
    ctx.quadraticCurveTo(SW - 6, SH, 0, SH + 6);
    ctx.quadraticCurveTo(-SW + 6, SH, -SW + 2, SH - 18);
    ctx.closePath();
    fs(ctx, white, '#e9dcb8', 4);
    if (!white) {
      const g = ctx.createLinearGradient(-SW, 0, SW, 0);
      g.addColorStop(0, 'rgba(120,80,40,0.35)'); g.addColorStop(0.45, 'rgba(255,250,235,0.25)'); g.addColorStop(1, 'rgba(120,80,40,0.25)');
      ctx.fillStyle = g; ctx.fill();
      // rim
      ctx.strokeStyle = 'rgba(140,100,55,0.6)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-SW + 6, -SH + 14); ctx.quadraticCurveTo(-SW + 6, -SH + 2, 0, -SH); ctx.quadraticCurveTo(SW - 6, -SH + 2, SW - 6, -SH + 14); ctx.lineTo(SW - 8, SH - 18); ctx.quadraticCurveTo(SW - 10, SH - 6, 0, SH - 2); ctx.quadraticCurveTo(-SW + 10, SH - 6, -SW + 8, SH - 18); ctx.closePath(); ctx.stroke();
      // embossed flame emblem
      ctx.beginPath(); ctx.moveTo(0, -20); ctx.quadraticCurveTo(11, -4, 7, 7); ctx.quadraticCurveTo(4, 16, 0, 16); ctx.quadraticCurveTo(-4, 16, -7, 7); ctx.quadraticCurveTo(-11, -4, 0, -20);
      ctx.fillStyle = '#c98a3a'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ffd38a'; ctx.beginPath(); ctx.ellipse(0, 6, 3, 7, 0, 0, TAU); ctx.fill();
      // nails
      ctx.fillStyle = INK;
      for (const [nx, ny] of [[-15, -26], [15, -26], [-14, 24], [14, 24]]) { ctx.beginPath(); ctx.arc(nx, ny, 2.5, 0, TAU); ctx.fill(); }
      // wax drips over the top edge
      ctx.fillStyle = '#f6ecd6'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      for (const [dx, dl] of [[-14, 12], [-2, 18], [12, 9]]) {
        const L = dl + Math.sin(t * 1.3 + dx) * 2;
        ctx.beginPath(); ctx.moveTo(dx - 4, -SH - 2); ctx.quadraticCurveTo(dx - 4, -SH + L * 0.7, dx, -SH + L); ctx.quadraticCurveTo(dx + 4, -SH + L * 0.7, dx + 4, -SH - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // gouges that deepen with each phase
      if (this.phase >= 2) { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-20, -10); ctx.lineTo(-8, 4); ctx.lineTo(-12, 14); ctx.stroke(); }
      if (this.phase >= 3) { ctx.beginPath(); ctx.moveTo(18, -36); ctx.lineTo(8, -24); ctx.lineTo(12, -16); ctx.stroke(); }
    }
    ctx.restore();
    // shield hand
    ctx.beginPath(); ctx.arc(sx - 6, sy - 4, 6, 0, TAU); fs(ctx, white, '#3a332e', 2.5);
    ctx.restore();
  }
}

export default { wickwidow: Wickwidow, ossuaryknight: OssuaryKnight };
