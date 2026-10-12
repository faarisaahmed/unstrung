// Boss base class. Bosses script their attacks as generator coroutines:
//
//   *attackSlam() {
//     this.tele = 0.5;                 // telegraph glow for 0.5s
//     yield 0.5;                       // wait 0.5 seconds
//     yield* this.leapTo(px, 220, 0.7);// sub-coroutine
//     this.slam();
//     yield 0.6;
//   }
//
// `yield n` waits n seconds (scaled by this.speedMul), `yield` waits one frame.
import { Entity } from '../entities/base.js';
import { TILE, VIEW_W, VIEW_H } from '../core/constants.js';
import { TAU, clamp, sign, overlap } from '../core/math.js';
import { Projectile } from '../entities/projectile.js';
import { Enemy } from '../entities/enemy.js';
import { ENEMIES } from '../data/enemies/index.js';
import { grantItem } from '../data/items.js';
import { BOSS_INFO } from '../data/bossinfo.js';
import { spawnGlints } from '../entities/pickups.js';
import { moveX, moveY } from '../world/movement.js';

export class Boss extends Entity {
  // cfg: { id, name, title, hp, size:[w,h], music, air?, reward?:{item,id}, glints, gravity, contact }
  constructor(game, tx, ty, spec, cfg0) {
    const cfg = Object.assign({}, BOSS_INFO[cfg0.id] || {}, cfg0);
    const [w, h] = cfg.size || [80, 80];
    const x = tx * TILE + TILE / 2 - w / 2;
    const y = cfg.air ? ty * TILE + TILE / 2 - h / 2 : (ty + 1) * TILE - h;
    super(game, x, y, w, h);
    this.cfg = cfg;
    this.spec = spec || {};
    this.echo = !!this.spec.echo;
    this.id = cfg.id;
    this.name = cfg.name;
    this.title = cfg.title || cfg.name;
    this.isEnemy = true;
    this.isBoss = true;
    this.def = { id: cfg.id, glints: 0 };
    this.maxHp = this.hp = Math.round(cfg.hp * (this.echo ? 1.45 : 1) * (this.spec.hpMul || 1));
    this.damage = cfg.contact ?? 1;
    this.speedMul = this.echo ? 1.22 : 1;
    this.facing = -1;
    this.anim = 0;
    this.flashT = 0;
    this.tele = 0;           // >0 shows wind-up glow
    this.phase = 1;
    this.phases = cfg.phases || [0.66, 0.33]; // hp fractions where phase increments
    this.mode = 'dormant';
    this.hittable = false;
    this.harmful = false;
    this.co = null; this.wait = 0;
    this.hits = [];          // extra damaging rects this frame (weapons, shockwaves)
    this.minions = [];
    this.z = 3;
    this.air = !!cfg.air;
    this.gravity = cfg.gravity ?? (cfg.air ? 0 : 2200);
    this.lastAttack = null;
    this.flagKey = 'boss_' + cfg.id;
    this.defeated = !this.echo && !!game.save.flags[this.flagKey];
    if (this.defeated) { this.dead = true; return; }
    // arena = the room interior unless overridden
    const room = game.room;
    this.arena = this.spec.arena || { x: TILE, y: TILE, w: room.pxW - 2 * TILE, h: room.pxH - 2 * TILE };
    this.groundY = this.findGround();
    this.trigger = this.spec.trigger || null; // {x,y,w,h} in px; default: player inside arena & near
  }

  // ---------- lifecycle ----------
  findGround() {
    const room = this.game.room;
    for (let y = this.y + this.h; y < room.pxH; y += 4) if (room.rectBlocked(this.cx - 2, y, 4, 2)) return y;
    return room.pxH - TILE;
  }

  get floorY() { return this.groundY; }
  get player() { return this.game.player; }

  update(dt) {
    const g = this.game;
    this.anim += dt;
    this.flashT -= dt;
    if (this.tele > 0) this.tele -= dt;
    this.hits.length = 0;
    if (this.mode === 'dormant') {
      const p = this.player;
      const trig = this.trigger || { x: this.arena.x + TILE * 2, y: this.arena.y, w: this.arena.w - TILE * 4, h: this.arena.h };
      if (overlap(p.rect(), trig) && p.b.grounded !== undefined) this.startFight();
      this.idle && this.idle(dt);
      return;
    }
    if (this.mode === 'intro') {
      this.introT += dt;
      if (this.introUpdate) this.introUpdate(dt, this.introT);
      if (this.introT > (this.cfg.introTime ?? 2.0)) {
        this.mode = 'fight'; this.hittable = true; this.harmful = true;
        g.player.locked = false; g.cutscene = null;
      }
      this.physicsStep(dt);
      return;
    }
    if (this.mode === 'dying') {
      this.dieT += dt;
      if (Math.random() < 0.5) g.fx.burst(this.cx + (Math.random() - 0.5) * this.w, this.cy + (Math.random() - 0.5) * this.h, 3, { color: '#16141c', speed: 200, size: 5, life: 0.8, shape: 'shard' });
      if (this.dieT > 2.2) this.finish();
      return;
    }
    // fight
    this.minions = this.minions.filter((m) => !m.dead);
    this.runCoroutine(dt);
    this.physicsStep(dt);
    if (this.think) this.think(dt);
  }

  physicsStep(dt) {
    if (this.noPhysics) return;
    if (this.air) return;
    if (this.gravity) this.vy = Math.min(this.vy + this.gravity * dt, 1400);
    const room = this.game.room;
    const hitX = moveX(this, room, this.vx * dt, 0);
    if (hitX) { this.hitWall = true; this.vx = 0; } else this.hitWall = false;
    const r = moveY(this, room, this.vy * dt, { dropThrough: true });
    this.grounded = r === 'floor';
    if (r) this.vy = 0;
  }

  runCoroutine(dt) {
    if (this.wait > 0) { this.wait -= dt; return; }
    if (!this.co) {
      this.co = this.chooseAttack();
      if (!this.co) return;
    }
    let guard = 0;
    while (this.wait <= 0 && this.co && guard++ < 20) {
      const r = this.co.next();
      if (r.done) { this.co = null; break; }
      if (typeof r.value === 'number') { this.wait += r.value / this.speedMul; break; }
      break; // bare yield = next frame
    }
  }

  // Override: return a generator. Default picks from this.attackList weights, avoiding repeats.
  chooseAttack() {
    const list = (this.attackList ? this.attackList() : []).filter((a) => !a.cond || a.cond());
    if (!list.length) return null;
    let pool = list.filter((a) => a.name !== this.lastAttack || list.length === 1);
    const total = pool.reduce((s, a) => s + (a.w ?? 1), 0);
    let r = Math.random() * total;
    for (const a of pool) { r -= a.w ?? 1; if (r <= 0) { this.lastAttack = a.name; return a.fn.call(this); } }
    this.lastAttack = pool[0].name;
    return pool[0].fn.call(this);
  }

  startFight() {
    const g = this.game;
    this.mode = 'intro';
    this.introT = 0;
    g.arenaLock = true;
    for (const e of g.entities) if (e.onArena) e.onArena(true);
    g.bossBar = { boss: this };
    g.cutscene = { kind: 'bossIntro' };
    g.player.locked = true;
    g.areaTitle = { name: this.name, sub: this.cfg.epithet || '', t: 0.6, big: true, boss: true };
    g.app.audio && g.app.audio.playMusic(this.cfg.music || 'boss', { fade: 0.3, fadeOut: 0.6 });
    g.sfx('bossRoar');
    g.camera.shake(6, 1.0);
    this.facePlayer();
    if (this.onStart) this.onStart();
  }

  // ---------- damage ----------
  onBonk(dmg, dir, p) {
    if (!this.hittable) return false;
    if (this.shielded && this.shielded(p)) {
      this.game.sfx('clink');
      this.game.fx.burst(p.cx + p.b.facing * 30, p.cy, 5, { color: '#fff', speed: 180, size: 2, life: 0.2 });
      return false;
    }
    this.hurt(dmg, dir, 'bonk');
    return true;
  }

  hurt(dmg, dir, src) {
    if (!this.hittable || this.mode !== 'fight') return;
    const g = this.game;
    if (g.stats.flags.desperate && g.save.hp === 1) dmg *= 1.75;
    this.hp -= dmg;
    this.flashT = 0.1;
    g.sfx('bossHit');
    if (this.onHurt) this.onHurt(dmg, src);
    const frac = this.hp / this.maxHp;
    while (this.phase - 1 < this.phases.length && frac <= this.phases[this.phase - 1]) {
      this.phase++;
      if (this.onPhase) this.onPhase(this.phase);
    }
    if (this.hp <= 0) this.beginDeath();
  }

  beginDeath() {
    const g = this.game;
    this.mode = 'dying';
    this.dieT = 0;
    this.hittable = false; this.harmful = false;
    this.co = null;
    for (const m of this.minions) if (!m.dead) m.die(0);
    for (const e of g.entities) if (e instanceof Projectile && !e.friendly) e.dead = true;
    g.hitstop(0.4);
    g.flash('rgba(255,255,255,0.8)', 0.6);
    g.camera.shake(10, 1.6);
    g.sfx('bossDie');
    g.app.audio && g.app.audio.stopMusic(0.5);
    g.bossBar = null;
    if (this.onDeath) this.onDeath();
  }

  finish() {
    const g = this.game;
    this.dead = true;
    g.arenaLock = false;
    for (const e of g.entities) if (e.onArena) e.onArena(false);
    g.fx.burst(this.cx, this.cy, 40, { color: '#16141c', speed: 420, size: 7, life: 1.4, shape: 'shard', front: true });
    g.fx.burst(this.cx, this.cy, 30, { color: '#fff8e8', speed: 300, size: 3, life: 1.2, glow: true });
    g.fx.ring(this.cx, this.cy, 20, 260, 1.0, 'rgba(255,255,255,0.9)', 6);
    if (this.echo) {
      g.save.echoes[this.id] = Math.max(g.save.echoes[this.id] || 0, 1);
      if (this.spec.onWin) this.spec.onWin(g);
      if (g.onEchoWin) g.onEchoWin(this);
      return;
    }
    g.save.flags[this.flagKey] = 1;
    spawnGlints(g, this.cx, this.cy, this.cfg.glints ?? 120);
    const area = g.room.def.area;
    setTimeout(() => {
      if (g.room && g.room.def.area === area) g.app.audio && g.app.audio.playMusic(g.room.def.music || area, { fade: 3 });
    }, 2500);
    if (this.cfg.reward) {
      const rw = this.cfg.reward;
      // rewards can be a list
      const list = Array.isArray(rw) ? rw : [rw];
      let delay = 1200;
      for (const r of list) {
        setTimeout(() => grantItem(g, r), delay);
        delay += 5200;
      }
    }
    if (this.onFinish) this.onFinish();
    g.writeSave && g.writeSave();
  }

  // ---------- helpers for scripts ----------
  facePlayer() { this.facing = this.player.cx < this.cx ? -1 : 1; }
  distX() { return Math.abs(this.player.cx - this.cx); }
  dirTo() { return this.player.cx < this.cx ? -1 : 1; }
  sfx(n, k) { this.game.sfx(n, k); }
  shake(m = 5, t = 0.3) { this.game.camera.shake(m, t); }
  get fx() { return this.game.fx; }
  rand(a, b) { return a + Math.random() * (b - a); }
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  fire(x, y, vx, vy, opts = {}) {
    return this.game.add(new Projectile(this.game, x, y, vx * (opts.noScale ? 1 : this.speedMul ** 0.5), vy * (opts.noScale ? 1 : this.speedMul ** 0.5), Object.assign({ dmg: 1, life: 5, r: 9 }, opts)));
  }
  fireAt(x, y, speed, opts = {}) {
    const p = this.player;
    const a = Math.atan2(p.cy - y, p.cx - x) + (opts.offset || 0);
    return this.fire(x, y, Math.cos(a) * speed, Math.sin(a) * speed, opts);
  }
  fireRing(x, y, n, speed, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = (opts.a0 || 0) + (i / n) * TAU;
      this.fire(x, y, Math.cos(a) * speed, Math.sin(a) * speed, opts);
    }
  }
  // Area hit (rect) that lives for `life` seconds
  zone(x, y, w, h, life = 0.2, opts = {}) {
    return this.game.add(new Projectile(this.game, x + w / 2, y + h / 2, 0, 0, Object.assign({
      dmg: 1, life, r: 0, box: { w, h, oy: -h / 2 }, art: opts.art || 'none',
    }, opts)));
  }
  // Ground shockwave traveling along the floor
  shockwave(x, dir, speed = 420, h = 34, opts = {}) {
    const p = this.game.add(new Projectile(this.game, x, this.groundY - h / 2, dir * speed, 0, Object.assign({
      dmg: 1, life: 3, r: h / 2, art: 'wave', color: opts.color || 'rgba(240,232,214,0.9)', ignoreWalls: false,
    }, opts)));
    p.o.box = null;
    return p;
  }
  summon(id, tx, ty, extra = {}) {
    const def = ENEMIES[id];
    if (!def) return null;
    const e = this.game.add(new Enemy(this.game, tx, ty, Object.assign({}, def, { glints: 0 }), extra));
    this.minions.push(e);
    this.game.fx.ring(e.cx, e.cy, 4, 40, 0.4, 'rgba(255,255,255,0.8)', 3);
    return e;
  }

  // coroutine: move in a straight line to (x,y) (top-left coords) at speed px/s
  *moveTo(x, y, speed) {
    for (;;) {
      const dx = x - this.x, dy = y - this.y, d = Math.hypot(dx, dy);
      const step = speed * this.speedMul / 60;
      if (d <= step) { this.x = x; this.y = y; this.vx = 0; this.vy = 0; return; }
      this.x += dx / d * step; this.y += dy / d * step;
      yield;
    }
  }
  // coroutine: ballistic leap landing at target center-x after `time` seconds, apex `height` above
  *leapTo(tx, height = 200, time = 0.8) {
    tx = clamp(tx, this.arena.x + this.w / 2, this.arena.x + this.arena.w - this.w / 2);
    this.gravity = 0;
    const x0 = this.cx, y0 = this.y;
    const T = time / this.speedMul;
    const vy0 = -4 * height / T; // apex == height
    let t = 0;
    this.noPhysics = true;
    for (;;) {
      t += 1 / 60;
      const k = Math.min(1, t / T);
      this.x = x0 + (tx - x0) * k - this.w / 2;
      // parabola that ends at the floor
      const yy = y0 + vy0 * t + 0.5 * (2 * -vy0 / T) * t * t;
      this.y = Math.min(yy, this.groundY - this.h);
      if (k >= 1) break;
      yield;
    }
    this.y = this.groundY - this.h;
    this.noPhysics = false;
    this.gravity = this.cfg.gravity ?? 2200;
    this.vx = 0; this.vy = 0;
  }
  // coroutine: dash horizontally until wall or distance
  *dashTo(dir, speed, maxDist = 2000) {
    let moved = 0;
    for (;;) {
      const step = speed * this.speedMul / 60;
      const ox = this.x;
      this.x += dir * step;
      if (this.x < this.arena.x || this.x + this.w > this.arena.x + this.arena.w) {
        this.x = clamp(this.x, this.arena.x, this.arena.x + this.arena.w - this.w);
        return 'wall';
      }
      moved += Math.abs(this.x - ox);
      if (moved >= maxDist) return 'dist';
      yield;
    }
  }

  hitboxes() {
    const r = this.bodyBox ? this.bodyBox() : { x: this.x + 6, y: this.y + 6, w: this.w - 12, h: this.h - 12 };
    return [r, ...this.hits];
  }
  hurtbox() { return this.bodyBox ? this.bodyBox() : { x: this.x, y: this.y, w: this.w, h: this.h }; }

  draw(ctx, t) {
    if (this.mode === 'dying') {
      ctx.save();
      ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
    }
    this.drawBody(ctx, t);
    if (this.flashT > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.6;
      this.drawBody(ctx, t, true);
      ctx.restore();
    }
    if (this.tele > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(this.cx, this.cy, 4, this.cx, this.cy, Math.max(this.w, this.h));
      g.addColorStop(0, `rgba(255,240,220,${Math.min(0.35, this.tele)})`); g.addColorStop(1, 'rgba(255,240,220,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.cx, this.cy, Math.max(this.w, this.h), 0, TAU); ctx.fill();
      ctx.restore();
    }
    if (this.mode === 'dying') ctx.restore();
    if (this.drawExtra) this.drawExtra(ctx, t);
  }

  // Override. `white` = draw as a flat silhouette for hit flashes (use fill colors '#fff').
  drawBody(ctx, t, white) {
    ctx.fillStyle = white ? '#fff' : '#333';
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}
