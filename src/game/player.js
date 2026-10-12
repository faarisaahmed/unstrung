// Bead as a game entity: movement (shared physics) + combat, healing, spells, damage.
import { PHYS, TILE } from '../core/constants.js';
import { makeBead, stepBead, resetAir } from '../world/movement.js';
import { BeadArt } from '../art/bead.js';
import { overlap } from '../core/math.js';

export class Player {
  constructor(game, x, y) {
    this.game = game;
    this.b = makeBead(x, y);
    this.art = new BeadArt();
    this.attackT = -1; this.attackCd = 0; this.attackDir = 'side'; this.swing = 0;
    this.invuln = 0; this.hurtFlash = 0; this.stun = 0;
    this.focusHeld = 0; this.mending = 0; this.mendT = 0;
    this.locked = false;       // cutscenes/dialogue
    this.dead = false;
    this.safeT = 0;
    this.lastSafe = { x, y };
    this.spellCd = 0;
    this.chargeT = 0;          // Rollmaster charge
    this.ev = [];
    this.knock = 0;
  }

  get save() { return this.game.save; }
  get abilities() { return this.game.save.abilities; }
  get stats() { return this.game.stats; }
  get cx() { return this.b.x + this.b.w / 2; }
  get cy() { return this.b.y + this.b.h / 2; }
  get hp() { return this.save.hp; }

  rect() { return { x: this.b.x, y: this.b.y, w: this.b.w, h: this.b.h }; }

  // Hurtbox slightly smaller than the collision box for fairness
  hurtbox() { const b = this.b; return { x: b.x + 3, y: b.y + 3, w: b.w - 6, h: b.h - 6 }; }

  attackBox() {
    if (this.attackT < 0.0 || this.attackT > 0.13) return null;
    const b = this.b, s = this.stats;
    const reach = s.reach;
    if (this.attackDir === 'up') return { x: b.x + b.w / 2 - 20, y: b.y - 44 * reach, w: 40, h: 44 * reach + 6 };
    if (this.attackDir === 'down') return { x: b.x + b.w / 2 - 19, y: b.y + b.h - 6, w: 38, h: 46 * reach };
    const w = 46 * reach;
    return b.facing > 0
      ? { x: b.x + b.w - 4, y: b.y - 6, w, h: b.h + 12 }
      : { x: b.x - w + 4, y: b.y - 6, w, h: b.h + 12 };
  }

  update(dt) {
    const g = this.game, inp = g.input, b = this.b, s = this.stats;
    this.attackCd -= dt; this.invuln -= dt; this.hurtFlash -= dt; this.stun -= dt; this.spellCd -= dt;
    if (this.attackT >= 0) { this.attackT += dt; if (this.attackT > 0.22) this.attackT = -1; }

    const canAct = !this.locked && this.stun <= 0 && !this.dead;
    const mi = { x: 0, y: 0, jump: false, jumpP: false, dash: false, dashP: false, dashR: false, abilityP: false };
    if (canAct && this.mending <= 0) {
      mi.x = inp.axisX; mi.y = inp.axisY;
      mi.jump = inp.down('jump'); mi.jumpP = inp.pressed('jump');
      mi.dash = inp.down('dash'); mi.dashP = inp.pressed('dash'); mi.dashR = inp.released('dash');
      mi.abilityP = inp.pressed('ability');
    }
    if (this.stun > 0 && this.knock) { mi.x = 0; }

    // ---- focus: tap = spell, hold = mend ----
    if (canAct) this.updateFocus(dt, inp);

    // ---- attack ----
    if (canAct && this.mending <= 0 && inp.pressed('attack') && this.attackCd <= 0 &&
        (b.mode === 'normal' || b.mode === 'hang' || b.mode === 'magnet')) {
      this.attackT = 0;
      this.attackCd = s.attackCd;
      this.swing++;
      this.attackDir = inp.down('up') ? 'up' : (inp.down('down') && !b.grounded && b.mode === 'normal') ? 'down' : 'side';
      this.hitThisSwing = false;
      g.sfx('swing');
      const bx = this.cx, by = this.cy;
      if (this.attackDir === 'side') g.fx.slash(bx + b.facing * 30, by, b.facing > 0 ? 0 : Math.PI, 56 * s.reach, 'rgba(255,250,235,0.9)', 0.14, this.swing % 2 ? 1 : -1);
      else if (this.attackDir === 'up') g.fx.slash(bx, by - 30, -Math.PI / 2, 52 * s.reach, 'rgba(255,250,235,0.9)', 0.14, 1);
      else g.fx.slash(bx, by + 30, Math.PI / 2, 52 * s.reach, 'rgba(255,250,235,0.9)', 0.14, 1);
    }

    // ---- movement ----
    this.ev.length = 0;
    const lastMode = b.mode;
    stepBead(b, mi, g.room, this.abilities, dt, this.ev);
    if (this.stun > 0 && this.knock) {
      // knockback overrides horizontal velocity briefly
      b.vx = this.knock;
    }
    this.handleMoveEvents(lastMode);

    // ---- attack hits on terrain (breakables, spike pogo) ----
    const ab = this.attackBox();
    if (ab && !this.hitThisSwing) this.terrainHits(ab);

    // ---- hazards ----
    this.checkHazards();

    // ---- safe ground ----
    if (b.grounded && b.mode === 'normal' && !b.inWater) {
      this.safeT += dt;
      if (this.safeT > 0.2 && this.isSafeSpot()) { this.lastSafe = { x: b.x, y: b.y }; this.safeT = 0; }
    }

    this.art.update(dt, this);
  }

  updateFocus(dt, inp) {
    const g = this.game, b = this.b, s = this.stats, sv = this.save;
    if (inp.down('focus')) {
      this.focusHeld += dt;
      if (this.focusHeld > 0.22 && b.grounded && b.mode === 'normal' && sv.thread >= s.mendCost && sv.hp < sv.maxHp) {
        if (this.mending <= 0) { this.mending = 1; this.mendT = 0; g.sfx('mendStart'); }
        this.mendT += dt;
        b.vx = 0;
        if (Math.random() < 0.5) g.fx.add({ x: this.cx + (Math.random() - 0.5) * 40, y: this.cy + 20, vx: 0, vy: -60 - Math.random() * 60, life: 0.6, size: 2, color: '#fff3d6', g: 0, front: true, glow: true });
        if (this.mendT >= s.mendTime) {
          sv.thread -= s.mendCost; sv.hp = Math.min(sv.maxHp, sv.hp + s.mendAmount);
          this.mendT = 0;
          g.sfx('mend');
          g.fx.ring(this.cx, this.cy, 6, 40, 0.4, '#fff3d6', 3);
          this.art.impulse(1.25, 0.8);
          if (sv.thread < s.mendCost || sv.hp >= sv.maxHp) this.mending = 0;
        }
      } else if (this.mending > 0 && (!b.grounded || sv.thread < s.mendCost || sv.hp >= sv.maxHp)) {
        this.mending = 0;
      }
    } else {
      if (this.focusHeld > 0 && this.focusHeld <= 0.22 && this.mending <= 0) this.castSpell(inp);
      this.focusHeld = 0;
      this.mending = 0;
    }
  }

  castSpell(inp) {
    const g = this.game, sv = this.save, s = this.stats;
    if (this.spellCd > 0) return;
    const up = inp.down('up'), down = inp.down('down');
    let kind = null;
    if (up && sv.abilities.howl) kind = 'howl';
    else if (down && sv.abilities.unravel) kind = 'unravel';
    else if (sv.abilities.shard) kind = 'shard';
    else if (sv.abilities.unravel) kind = 'unravel';
    if (!kind || sv.thread < s.spellCost) return;
    sv.thread -= s.spellCost;
    this.spellCd = 0.35;
    g.castSpell(kind, this);
  }

  handleMoveEvents(lastMode) {
    const g = this.game, b = this.b;
    for (const e of this.ev) {
      switch (e.type) {
        case 'jump': g.sfx('jump'); this.art.impulse(0.75, 1.3); break;
        case 'dbljump':
          g.sfx('dbljump'); this.art.impulse(0.7, 1.35);
          g.fx.ring(this.cx, this.cy + 10, 4, 26, 0.3, 'rgba(220,240,255,0.9)', 2);
          for (let i = 0; i < 6; i++) g.fx.add({ x: this.cx, y: this.cy + 12, vx: (Math.random() - 0.5) * 120, vy: 40 + Math.random() * 60, life: 0.5, size: 3, color: 'rgba(210,235,255,0.8)', g: -100, shape: 'dot', front: true });
          break;
        case 'walljump': g.sfx('jump'); this.art.impulse(1.25, 0.8); g.fx.burst(this.cx - e.dir * 12, this.cy, 5, { color: '#d8d0bb', speed: 120, size: 2, life: 0.3 }); break;
        case 'land':
          if (e.vy > 380) {
            const k = Math.min(1, e.vy / 950);
            this.art.impulse(1 + 0.4 * k, 1 - 0.35 * k);
            g.sfx('land', k);
            g.fx.burst(this.cx, b.y + b.h, 3 + Math.floor(6 * k), { color: 'rgba(200,195,180,0.7)', speed: 90, angle: -Math.PI / 2, spread: 2.8, size: 2.2, life: 0.35, g: 300 });
          }
          if (e.vy > 940 && !this.abilities.glide) this.game.camera.shake(3, 0.12);
          break;
        case 'dash':
          g.sfx('dash'); this.art.impulse(1.3, 0.8);
          g.fx.burst(this.cx - e.dir * 10, this.cy, 6, { color: 'rgba(230,225,210,0.7)', speed: 80, angle: e.dir > 0 ? Math.PI : 0, spread: 1, size: 2.5, life: 0.25, g: 0 });
          break;
        case 'swim': g.sfx('swim'); break;
        case 'pound':
          g.sfx('pound'); g.camera.shake(7, 0.25); this.art.impulse(1.5, 0.6);
          g.fx.burst(e.x, e.y, 16, { color: '#d8cfb8', speed: 260, angle: -Math.PI / 2, spread: 3, size: 3, life: 0.5 });
          g.onPound(e.x, e.y);
          break;
        case 'poundStart': g.sfx('poundStart'); this.art.impulse(0.7, 1.3); break;
        case 'break':
          g.onTileBroken(e.tx, e.ty, e.ch);
          break;
        case 'comet': g.sfx('comet'); g.camera.shake(3, 0.2); break;
        case 'cometCharge': g.sfx('cometCharge'); break;
        case 'cometHit': g.sfx('bonkWall'); g.camera.shake(5, 0.2); break;
        case 'hook': g.sfx('hook'); break;
        case 'hang': g.sfx('hang'); break;
        case 'magnet': g.sfx('magnet'); break;
        case 'shrink': g.sfx('shrink'); g.fx.ring(this.cx, this.cy, 20, 4, 0.25, '#fff', 2); break;
        case 'grow': g.sfx('grow'); g.fx.ring(this.cx, this.cy, 4, 22, 0.25, '#fff', 2); break;
      }
    }
  }

  terrainHits(box) {
    const g = this.game, room = g.room, b = this.b;
    // breakable walls
    const hit = room.rectHasChar(box.x, box.y, box.w, box.h, (ch) => ch === 'B');
    if (hit) {
      this.hitThisSwing = true;
      g.hitBreakable(hit.tx, hit.ty);
      this.recoil();
      return;
    }
    // pogo off spikes / hazards with a down attack
    if (this.attackDir === 'down') {
      const sp = room.rectHasChar(box.x, box.y, box.w, box.h, (ch) => ch === '^' || ch === '!' && !this.abilities.shell);
      if (sp) {
        this.hitThisSwing = true;
        this.pogo();
        g.sfx('clink');
        g.fx.burst(this.cx, b.y + b.h + 10, 6, { color: '#fff', speed: 160, size: 2, life: 0.2 });
        return;
      }
    }
    // clink off walls on side attacks (tiny feedback)
    if (this.attackDir === 'side' && this.attackT < 0.03) {
      const wx = b.facing > 0 ? box.x + box.w - 4 : box.x + 4;
      if (room.rectBlocked(wx - 2, b.y + 4, 4, b.h - 8)) {
        this.hitThisSwing = true;
        g.sfx('clink');
        g.fx.burst(wx, this.cy, 4, { color: '#fff6dd', speed: 140, size: 1.8, life: 0.2 });
        this.recoil(0.6);
      }
    }
  }

  // Called by game when the attack box connects with an enemy/object
  onAttackHit(target) {
    const g = this.game, sv = this.save, s = this.stats;
    this.hitThisSwing = true;
    if (target && target.givesThread !== false) sv.thread = Math.min(sv.maxThread, sv.thread + s.threadGain);
    if (this.attackDir === 'down') this.pogo();
    else this.recoil();
  }

  pogo() {
    const b = this.b;
    if (b.mode !== 'normal') return;
    b.vy = -PHYS.pogoVel;
    b.jumping = false;
    resetAir(b, this.abilities);
    this.art.impulse(0.8, 1.2);
  }

  recoil(k = 1) {
    const b = this.b;
    if (this.attackDir === 'side') b.vx = -b.facing * 190 * k;
    else if (this.attackDir === 'up' && b.vy < 0) b.vy *= 0.6;
  }

  hurt(dmg, srcX, opts = {}) {
    const g = this.game, sv = this.save;
    if (this.invuln > 0 || this.dead || g.cutscene) return false;
    dmg = Math.max(1, Math.round(dmg * (this.stats.damageTaken || 1)));
    sv.hp -= dmg;
    this.mending = 0; this.focusHeld = 0;
    this.invuln = this.stats.invuln;
    this.hurtFlash = 0.12;
    this.stun = 0.18;
    const dir = srcX !== undefined ? (this.cx < srcX ? -1 : 1) : -this.b.facing;
    this.knock = dir * 260;
    if (this.b.mode !== 'normal' && this.b.mode !== 'magnet') { this.b.mode = 'normal'; }
    if (this.b.mode === 'magnet') { this.b.mode = 'normal'; this.b.magnet = null; }
    this.b.vy = -380;
    g.hitstop(0.12);
    g.camera.shake(8, 0.3);
    g.sfx('hurt');
    g.fx.burst(this.cx, this.cy, 14, { color: '#16141c', speed: 300, size: 4, life: 0.5, shape: 'shard' });
    g.fx.ring(this.cx, this.cy, 10, 60, 0.35, 'rgba(255,255,255,0.9)', 4);
    g.flash('rgba(255,255,255,0.25)', 0.12);
    if (sv.hp <= 0) { sv.hp = 0; g.onPlayerDeath(); }
    else if (opts.hazard) g.onHazard();
    return true;
  }

  checkHazards() {
    const g = this.game, b = this.b, room = g.room;
    if (this.invuln > 0 && !this.pendingHazard) return;
    const hb = { x: b.x + 4, y: b.y + 4, w: b.w - 8, h: b.h - 8 };
    // spikes: tile inset
    const spike = room.rectHasChar(hb.x, hb.y, hb.w, hb.h, (ch, tx, ty) => {
      if (ch !== '^') return false;
      const r = { x: tx * TILE + 5, y: ty * TILE + 5, w: TILE - 10, h: TILE - 10 };
      return overlap(hb, r);
    });
    const acid = !this.abilities.shell && room.rectHasChar(hb.x + 2, hb.y + 6, hb.w - 4, hb.h - 6, (ch) => ch === '!');
    if (spike || acid) {
      if (this.invuln > 0) return;
      this.hurt(1, undefined, { hazard: true });
    }
  }

  isSafeSpot() {
    const room = this.game.room, b = this.b;
    // standing on solid ground with no spikes or acid nearby
    const bad = room.rectHasChar(b.x - 40, b.y - 30, b.w + 80, b.h + 50, (ch) => ch === '^' || ch === '!' || ch === 'G' || ch === 'C');
    if (bad) return false;
    if (this.game.enemiesNear(this.cx, this.cy, 60)) return false;
    return room.rectBlocked(b.x, b.y + b.h + 1, b.w, 2);
  }

  draw(ctx, time) {
    this.art.draw(ctx, this, time);
  }
}
