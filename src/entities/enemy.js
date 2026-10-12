// Data-driven enemy. Behavior logic lives in behaviors.js, art in art/creatures.js.
import { TILE } from '../core/constants.js';
import { Entity } from './base.js';
import { drawCreature } from '../art/creatures.js';
import { BEHAVIORS } from './behaviors.js';
import { spawnGlints } from './pickups.js';

export class Enemy extends Entity {
  constructor(game, tx, ty, def, extra = {}) {
    const [w, h] = def.size || [28, 24];
    const B = BEHAVIORS[def.behavior] || BEHAVIORS.crawler;
    const air = B.air || def.air;
    const x = tx * TILE + TILE / 2 - w / 2;
    const y = air ? ty * TILE + TILE / 2 - h / 2 : (ty + 1) * TILE - h;
    super(game, x, y, w, h);
    this.def = def;
    this.name = def.name;
    this.maxHp = this.hp = Math.round((def.hp || 10) * (extra.hpMul || 1));
    this.damage = def.dmg || 1;
    this.isEnemy = true;
    this.hittable = true;
    this.harmful = true;
    this.art = def.art || { body: 'mite', c1: '#555' };
    this.facing = extra.facing || (Math.random() < 0.5 ? -1 : 1);
    this.anim = Math.random() * 10;
    this.state = 'idle';
    this.t = 0;              // state timer
    this.flashT = 0;
    this.stunT = 0;
    this.weight = def.weight ?? 1;
    this.B = B;
    this.P = Object.assign({}, B.defaults || {}, def.params || {}, extra.params || {});
    this.home = { x: this.x, y: this.y };
    this.air = air;
    this.z = 2;
    this.light = def.light || 0;
    if (B.init) B.init(this);
  }

  update(dt) {
    this.flashT -= dt;
    this.anim += dt * (this.animSpeed ?? 1);
    if (this.ramT) this.ramT -= dt;
    if (this.stunT > 0) {
      this.stunT -= dt;
      if (this.air) { this.vx *= 0.9; this.vy *= 0.9; this.fly(dt); }
      else { this.vx *= 0.85; this.physics(dt); }
      return;
    }
    this.t += dt;
    this.B.update(this, dt, this.game);
    // hazards kill enemies that fall into acid/spikes pits (not flyers)
    if (!this.air && this.y > this.room.pxH + 50) this.dead = true;
  }

  setState(s) { this.state = s; this.t = 0; }

  onBonk(dmg, dir, p) {
    if (this.B.onBonk) {
      const r = this.B.onBonk(this, dmg, dir, p);
      if (r === false) return false;
    }
    this.hurt(dmg, dir || (p.cx < this.cx ? 1 : -1), 'bonk');
    return true;
  }

  hurt(dmg, dir, src) {
    if (this.dead || this.invuln) return;
    if (this.B.onHurt && this.B.onHurt(this, dmg, dir, src) === false) return;
    this.hp -= dmg;
    this.flashT = 0.12;
    this.game.sfx('hit');
    const kb = (src === 'spell' ? 160 : 260) / this.weight;
    if (this.weight < 50) {
      this.vx = dir * kb;
      if (this.air) this.vy = -60 / this.weight;
      this.stunT = this.def.noStun ? 0 : 0.12;
    }
    if (this.hp <= 0) this.die(dir);
  }

  die(dir = 0) {
    if (this.dead) return;
    this.dead = true;
    const g = this.game, sv = g.save;
    sv.kills[this.def.id] = (sv.kills[this.def.id] || 0) + 1;
    g.sfx('enemyDie');
    g.fx.burst(this.cx, this.cy, 12, { color: '#16141c', speed: 280, size: 4.5, life: 0.7, shape: 'shard', front: false });
    g.fx.burst(this.cx, this.cy, 8, { color: this.art.c1 || '#888', speed: 200, size: 3, life: 0.6 });
    g.fx.ring(this.cx, this.cy, 6, 40, 0.3, 'rgba(255,255,255,0.8)', 3);
    g.camera.shake(2, 0.1);
    spawnGlints(g, this.cx, this.cy, Math.round((this.def.glints ?? 2) * g.stats.glintMul));
    if (this.B.onDeath) this.B.onDeath(this);
    if (this.onDeathCb) this.onDeathCb(this);
    // leave a corpse silhouette that fades
    g.fx.add({ x: this.cx, y: this.cy, vx: dir * 60, vy: -120, life: 0.6, size: Math.max(this.w, this.h) * 0.35, color: 'rgba(22,20,28,0.8)', g: 900, shape: 'dot', front: false });
  }

  hurtbox() {
    if (this.B.hurtbox) return this.B.hurtbox(this);
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  hitboxes() {
    const boxes = [{ x: this.x + 3, y: this.y + 3, w: this.w - 6, h: this.h - 6 }];
    if (this.extraHit) boxes.push(this.extraHit);
    if (this.B.hitboxes) return this.B.hitboxes(this, boxes);
    return boxes;
  }

  draw(ctx, t) {
    if (this.B.drawBack) this.B.drawBack(ctx, this, t);
    if (!this.hidden) drawCreature(ctx, this, t);
    if (this.B.draw) this.B.draw(ctx, this, t);
  }
}
