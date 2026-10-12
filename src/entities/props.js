// Interactive world props: Spindles (benches), levers, gates, lore tablets, NPCs, Beadlings, Tangles, pots, ferries.
import { Entity } from './base.js';
import { TILE, VIEW_W } from '../core/constants.js';
import { TAU, overlap } from '../core/math.js';
import { Dialogue } from '../ui/dialogue.js';
import { spawnGlints } from './pickups.js';
import { INK, eye } from '../art/creatures.js';
import { LORE } from '../data/lore.js';
import { NPCS } from '../data/npcs.js';

// ----- interactable base: shows a prompt and fires interact() on Up -----
class Interactable extends Entity {
  constructor(game, x, y, w, h, prompt) {
    super(game, x, y, w, h);
    this.prompt = prompt;
    this.promptA = 0;
    this.z = 1;
  }
  near() {
    const p = this.player;
    return !p.dead && Math.abs(p.cx - this.cx) < this.w / 2 + 26 && Math.abs(p.cy - this.cy) < this.h / 2 + 30 && p.b.grounded;
  }
  update(dt) {
    const n = this.near() && !this.game.dialogue && !this.disabled;
    this.promptA += ((n ? 1 : 0) - this.promptA) * Math.min(1, dt * 10);
    if (n && this.game.input.pressed('up') && !this.game.player.locked) { this.game.input.eat('up'); this.interact(); }
  }
  drawPrompt(ctx) {
    if (this.promptA < 0.02) return;
    ctx.globalAlpha = this.promptA;
    const x = this.cx, y = this.y - 26 + Math.sin(this.game.time * 3) * 2;
    ctx.fillStyle = 'rgba(8,8,12,0.7)';
    ctx.font = '13px Georgia, serif';
    const w = ctx.measureText(this.prompt).width + 26;
    ctx.fillRect(x - w / 2, y - 12, w, 22);
    ctx.fillStyle = '#efe6cf'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('↑ ' + this.prompt, x, y);
    ctx.globalAlpha = 1;
  }
}

// ----- Spindle: the bench -----
export class Spindle extends Interactable {
  constructor(game, tx, ty, marker) {
    super(game, tx * TILE - 16, ty * TILE + TILE - 30, 64, 30, 'Rest');
    this.marker = marker;
    this.light = 160;
  }
  interact() {
    const g = this.game, p = g.player;
    p.b.x = this.cx - p.b.w / 2; p.b.vx = 0;
    g.rest(this);
    g.fx.ring(this.cx, this.cy, 10, 70, 0.6, 'rgba(255,240,210,0.8)', 3);
    this.resting = true;
    g.app.openBench(this);
  }
  draw(ctx, t) {
    const x = this.cx, y = this.y + this.h;
    // glow
    const gl = ctx.createRadialGradient(x, y - 30, 4, x, y - 30, 90);
    gl.addColorStop(0, 'rgba(255,230,180,0.22)'); gl.addColorStop(1, 'rgba(255,230,180,0)');
    ctx.fillStyle = gl; ctx.fillRect(x - 90, y - 120, 180, 180);
    // spool-shaped bench: two discs + wound thread seat
    ctx.fillStyle = '#2a2230'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * 26, y - 14, 6, 14, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#c9b48a';
    ctx.beginPath(); ctx.rect(x - 24, y - 24, 48, 18); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,80,50,0.5)'; ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(x - 24, y - 23 + i * 2); ctx.lineTo(x + 24, y - 21 + i * 2); ctx.stroke(); }
    ctx.strokeStyle = '#b8323e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 22, y - 10); ctx.quadraticCurveTo(x + 34, y - 2 + Math.sin(t * 2) * 2, x + 30, y); ctx.stroke();
    // little candle
    ctx.fillStyle = '#efe0b8'; ctx.fillRect(x - 32, y - 40, 4, 12);
    ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.ellipse(x - 30, y - 44 + Math.sin(t * 9) * 0.6, 2, 4, 0, 0, TAU); ctx.fill();
    this.drawPrompt(ctx);
  }
}

// ----- Lever: hit to set a flag -----
export class Lever extends Entity {
  constructor(game, tx, ty, spec) {
    super(game, tx * TILE + 8, ty * TILE + 4, 16, 28);
    this.flag = spec.flag;
    this.on = !!game.save.flags[this.flag];
    this.hittable = true;
    this.givesThread = false;
  }
  onBonk() {
    if (this.on) return false;
    this.on = true;
    this.game.save.flags[this.flag] = 1;
    this.game.sfx('lever');
    this.game.camera.shake(3, 0.2);
    for (const e of this.game.entities) if (e.onFlag) e.onFlag(this.flag);
    return true;
  }
  draw(ctx, t) {
    const x = this.cx, y = this.y + this.h;
    ctx.fillStyle = '#2b2733'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 4, 12, 5, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.translate(x, y - 6); ctx.rotate(this.on ? 0.7 : -0.7);
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -22); ctx.stroke();
    ctx.strokeStyle = '#a99c84'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#e9dcc0'; ctx.beginPath(); ctx.arc(0, -22, 5, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
}

// ----- Gate: solid bars until a flag is set (lever, boss defeat, key) -----
export class Gate extends Entity {
  constructor(game, tx, ty, spec) {
    const w = (spec.w || 1) * TILE, h = (spec.h || 3) * TILE;
    super(game, tx * TILE, ty * TILE, w, h);
    this.spec = spec;
    this.flag = spec.flag;
    this.open = spec.arena ? !game.arenaLock : this.flag ? !!game.save.flags[this.flag] : false;
    this.openK = this.open ? 1 : 0;
    this.solid = { x: this.x, y: this.y, w: this.w, h: this.h, active: !this.open };
    game.room.dynamicSolids.push(this.solid);
    this.z = 1;
    if (spec.item && game.save.items[spec.item]) this.open = true, this.openK = 1, this.solid.active = false;
    if (spec.beads && game.save.greatBeads >= spec.beads) this.open = true, this.openK = 1, this.solid.active = false;
  }
  onFlag(flag) { if (flag === this.flag) this.setOpen(true); }
  onArena(locked) { if (this.spec.arena) this.setOpen(!locked); }
  setOpen(v) {
    if (this.open === v) return;
    this.open = v;
    this.game.sfx(v ? 'gateOpen' : 'gateClose');
    this.game.camera.shake(3, 0.3);
  }
  update(dt) {
    if (this.spec.item && !this.open) {
      const p = this.player;
      if (this.game.save.items[this.spec.item] && Math.abs(p.cx - this.cx) < 60 && Math.abs(p.cy - this.cy) < 80) {
        this.setOpen(true); this.game.save.flags[this.flag || ('gate_' + this.spec.item)] = 1;
      }
    }
    if (!this.open && this.flag && !this.spec.arena && this.game.save.flags[this.flag]) this.setOpen(true);
    this.openK += ((this.open ? 1 : 0) - this.openK) * Math.min(1, dt * 5);
    this.solid.active = this.openK < 0.6;
    if (!this.open && this.solid.active) {
      // push player out if overlapping a closing gate
      const p = this.player;
      if (overlap(p.rect(), this.solid)) p.b.x = p.cx < this.cx ? this.x - p.b.w - 1 : this.x + this.w + 1;
    }
  }
  draw(ctx, t) {
    const k = this.openK;
    const horiz = this.w > this.h;
    ctx.save();
    ctx.beginPath(); ctx.rect(this.x - 4, this.y - 4, this.w + 8, this.h + 8); ctx.clip();
    const n = horiz ? Math.max(2, this.w / 16) : Math.max(2, this.w / 12);
    for (let i = 0; i < n; i++) {
      ctx.strokeStyle = INK; ctx.lineWidth = 7;
      ctx.beginPath();
      if (horiz) {
        const y = this.y + (i + 0.5) * (this.h / n);
        const off = k * this.w;
        ctx.moveTo(this.x - off, y); ctx.lineTo(this.x + this.w - off, y);
      } else {
        const x = this.x + (i + 0.5) * (this.w / n);
        const off = k * this.h;
        ctx.moveTo(x, this.y - off); ctx.lineTo(x, this.y + this.h - off);
      }
      ctx.stroke();
      ctx.strokeStyle = '#8f8576'; ctx.lineWidth = 3; ctx.stroke();
    }
    // spiked tips
    ctx.restore();
  }
}

// ----- Lore tablet: "Threadscript" -----
export class LoreTablet extends Interactable {
  constructor(game, tx, ty, spec) {
    super(game, tx * TILE - 8, ty * TILE - 20, 48, 52, 'Read');
    this.id = spec.id;
    this.light = 80;
  }
  interact() {
    const g = this.game, entry = LORE[this.id];
    const pages = entry ? entry.pages : ['The threads here are too frayed to read.'];
    g.save.lore[this.id] = 1;
    g.dialogue = new Dialogue(g, pages, { style: 'lore', speaker: entry && entry.title });
  }
  draw(ctx, t) {
    const x = this.cx, y = this.y + this.h;
    ctx.fillStyle = '#25212c'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.lineTo(x - 16, y - 40); ctx.quadraticCurveTo(x, y - 54, x + 16, y - 40); ctx.lineTo(x + 18, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    // woven glyph lines
    const read = this.game.save.lore[this.id];
    ctx.strokeStyle = read ? 'rgba(220,210,190,0.45)' : `rgba(255,230,180,${0.6 + Math.sin(t * 2) * 0.25})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(x - 10, y - 34 + i * 8);
      ctx.bezierCurveTo(x - 4, y - 38 + i * 8, x + 4, y - 30 + i * 8, x + 10, y - 34 + i * 8); ctx.stroke();
    }
    this.drawPrompt(ctx);
  }
}

// ----- NPC: dialogue, optional shop/services handled by data/npcs.js -----
export class NPC extends Interactable {
  constructor(game, tx, ty, spec) {
    const def = NPCS[spec.id] || { name: spec.id, art: {}, talk: () => ['...'] };
    const [w, h] = def.size || [30, 40];
    super(game, tx * TILE + TILE / 2 - w / 2, (ty + 1) * TILE - h, w, h, def.verb || 'Listen');
    this.def = def;
    this.id = spec.id;
    this.anim = Math.random() * 5;
    this.facing = spec.facing || -1;
    this.art = Object.assign({ body: 'knight', c1: '#3a3240' }, def.art);
    this.light = def.light || 0;
    if (def.hideIf && def.hideIf(game.save)) this.dead = true;
  }
  update(dt) {
    super.update(dt);
    this.anim += dt * 0.25;
    if (Math.abs(this.player.cx - this.cx) < 160) this.facing = this.player.cx < this.cx ? -1 : 1;
  }
  interact() {
    const g = this.game;
    const res = this.def.talk(g, this);
    if (!res) return;
    const pages = Array.isArray(res) ? res : res.pages;
    g.dialogue = new Dialogue(g, pages, Object.assign({ speaker: this.def.name, voice: this.def.voice || 0 }, Array.isArray(res) ? {} : res.opts));
  }
  draw(ctx, t) {
    if (this.def.draw) this.def.draw(ctx, this, t);
    else {
      // reuse creature painters for NPC bodies
      const P = this.game.app.painters[this.art.body] || this.game.app.painters.knight;
      ctx.save(); ctx.translate(this.cx, this.y + this.h); ctx.scale(this.facing, 1);
      P(ctx, this, t, this.art);
      ctx.restore();
    }
    this.drawPrompt(ctx);
  }
}

// ----- Beadling: a tiny trapped bead in a glass jar. Bonk the jar to free it -----
export class Beadling extends Entity {
  constructor(game, tx, ty, key) {
    super(game, tx * TILE + 2, (ty + 1) * TILE - 34, 28, 34);
    this.key = 'beadling_' + key;
    this.hittable = true;
    this.givesThread = false;
    this.freed = !!game.save.flags[this.key];
    if (this.freed) this.dead = true;
    this.hits = 0;
    this.light = 70;
    this.t = 0;
  }
  onBonk() {
    if (this.freed) return false;
    this.hits++;
    this.game.sfx('glassHit');
    this.game.fx.burst(this.cx, this.cy, 4, { color: 'rgba(200,230,255,0.8)', speed: 150, size: 2, life: 0.3, shape: 'shard' });
    if (this.hits >= 2) {
      this.freed = true;
      this.game.save.flags[this.key] = 1;
      this.game.save.beadlings++;
      this.game.sfx('beadling');
      this.game.fx.burst(this.cx, this.cy, 14, { color: 'rgba(200,230,255,0.9)', speed: 260, size: 3, life: 0.6, shape: 'shard' });
      this.flyT = 0;
    }
    return true;
  }
  update(dt) {
    this.t += dt;
    if (this.freed) { this.flyT += dt; if (this.flyT > 1.4) this.dead = true; }
  }
  draw(ctx, t) {
    const x = this.cx, y = this.y + this.h;
    if (!this.freed) {
      // jar
      ctx.fillStyle = 'rgba(170,210,240,0.18)'; ctx.strokeStyle = 'rgba(210,235,255,0.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x - 13, y - 24); ctx.quadraticCurveTo(x - 13, y - 30, x - 7, y - 30); ctx.lineTo(x + 7, y - 30);
      ctx.quadraticCurveTo(x + 13, y - 30, x + 13, y - 24); ctx.lineTo(x + 12, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x - 8, y - 34, 16, 5);
    }
    // the little beadling
    const by = this.freed ? y - 12 - this.flyT * 90 : y - 9 + Math.abs(Math.sin(t * 5)) * -3;
    const bx = this.freed ? x + Math.sin(this.flyT * 8) * 8 : x;
    if (this.freed) ctx.globalAlpha = Math.max(0, 1 - this.flyT / 1.4);
    ctx.fillStyle = '#f7f1e2'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(bx, by, 7, 0, TAU); ctx.fill(); ctx.stroke();
    eye(ctx, bx - 2.5, by - 1, 1.3, INK); eye(ctx, bx + 2.5, by - 1, 1.3, INK);
    ctx.globalAlpha = 1;
    if (!this.freed && Math.sin(t * 2 + this.x) > 0.95) {
      ctx.fillStyle = '#efe6cf'; ctx.font = '11px Georgia'; ctx.textAlign = 'center'; ctx.fillText('!', x + 12, y - 38);
    }
  }
}

// ----- Tangle: the knot of thread left behind on death; bonk it to recover glints -----
export class Tangle extends Entity {
  constructor(game, x, y) {
    super(game, x - 18, y - 18, 36, 36);
    this.hittable = true;
    this.givesThread = false;
    this.hits = 0;
    this.t = 0;
    this.home = { x: this.x, y: this.y };
    this.light = 100;
    this.isEnemy = true; // so spells hit it too
    this.def = { id: 'tangle' };
  }
  hurt() { this.onBonk(); }
  onBonk() {
    this.hits++;
    this.game.sfx('tangleHit');
    this.game.fx.burst(this.cx, this.cy, 8, { color: '#b8323e', speed: 200, size: 2, life: 0.5, shape: 'streak' });
    if (this.hits >= 3) {
      const sv = this.game.save;
      spawnGlints(this.game, this.cx, this.cy, sv.tangle ? sv.tangle.glints : 0);
      sv.tangle = null;
      this.dead = true;
      this.game.sfx('tangleFree');
      this.game.fx.ring(this.cx, this.cy, 10, 80, 0.6, '#b8323e', 4);
    }
    return true;
  }
  update(dt) {
    this.t += dt;
    this.x = this.home.x + Math.sin(this.t * 0.9) * 30;
    this.y = this.home.y + Math.sin(this.t * 1.7) * 12;
  }
  draw(ctx, t) {
    const x = this.cx, y = this.cy;
    ctx.strokeStyle = '#16141c'; ctx.lineWidth = 4;
    const path = () => {
      ctx.beginPath();
      for (let i = 0; i < 60; i++) {
        const a = i * 0.45 + t * 0.8;
        const r = 10 + Math.sin(i * 1.7 + t) * 8;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a * 1.3) * r;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
    };
    path(); ctx.stroke();
    ctx.strokeStyle = '#b8323e'; ctx.lineWidth = 2; path(); ctx.stroke();
    eye(ctx, x - 4, y - 2, 2.4, '#f7efe0'); eye(ctx, x + 4, y - 2, 2.4, '#f7efe0');
  }
}

// ----- Pot / glint cache: breakable decoration that drops glints -----
export class Pot extends Entity {
  constructor(game, tx, ty, spec, key) {
    super(game, tx * TILE + 4, (ty + 1) * TILE - 26, 24, 26);
    this.hittable = true; this.givesThread = false;
    this.value = spec.value || 6;
    this.cache = !!spec.cache; // big glint deposit: several hits, persistent
    this.key = 'pot_' + key;
    this.hp = this.cache ? 5 : 1;
    if (this.cache && game.save.flags[this.key]) this.dead = true;
  }
  onBonk() {
    this.hp--;
    this.game.sfx(this.cache ? 'bonkRock' : 'potBreak');
    spawnGlints(this.game, this.cx, this.cy, this.cache ? Math.ceil(this.value / 5) : 0);
    if (this.hp <= 0) {
      this.dead = true;
      if (this.cache) this.game.save.flags[this.key] = 1;
      spawnGlints(this.game, this.cx, this.cy, this.cache ? this.value : this.value);
      this.game.fx.burst(this.cx, this.cy, 10, { color: this.game.style.rim, speed: 220, size: 3.5, life: 0.6, shape: 'shard', g: 900 });
    }
    return true;
  }
  draw(ctx, t) {
    const x = this.cx, y = this.y + this.h, st = this.game.style;
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    if (this.cache) {
      ctx.fillStyle = st.rockHi;
      ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x - 10, y - 24); ctx.lineTo(x + 6, y - 28); ctx.lineTo(x + 14, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f3e7c4';
      for (const [dx, dy] of [[-4, -14], [4, -8], [0, -20], [7, -18]]) { ctx.save(); ctx.translate(x + dx, y + dy); ctx.rotate(0.78); ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore(); }
    } else {
      ctx.fillStyle = st.rockHi;
      ctx.beginPath(); ctx.moveTo(x - 7, y - 24); ctx.lineTo(x + 7, y - 24); ctx.quadraticCurveTo(x + 14, y - 14, x + 9, y); ctx.lineTo(x - 9, y); ctx.quadraticCurveTo(x - 14, y - 14, x - 7, y - 24);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = st.rim; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 10, y - 14); ctx.lineTo(x + 10, y - 14); ctx.stroke();
    }
  }
}

// ----- Moth Ferry: fast-travel station -----
export class Ferry extends Interactable {
  constructor(game, tx, ty, spec) {
    super(game, tx * TILE - 16, ty * TILE - 32, 64, 64, 'Call Moth');
    this.id = spec.id;
    this.light = 120;
  }
  update(dt) {
    super.update(dt);
    if (!this.game.save.ferries[this.id] && this.near()) {
      this.game.save.ferries[this.id] = this.game.room.id;
      this.game.message = { title: 'Moth Ferry Station', desc: 'You can now fly here from other stations.', t: 0, dur: 2.5 };
      this.game.sfx('unlock');
    }
  }
  interact() { this.game.app.openFerry(this); }
  draw(ctx, t) {
    const x = this.cx, y = this.y + this.h;
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 60); ctx.stroke();
    ctx.strokeStyle = '#8a7a66'; ctx.lineWidth = 1.5; ctx.stroke();
    // perched moth
    const flap = Math.sin(t * 3) * 0.15;
    ctx.save(); ctx.translate(x, y - 64);
    ctx.fillStyle = '#d8cdb8'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    for (const s of [-1, 1]) { ctx.save(); ctx.scale(s, 1); ctx.rotate(flap); ctx.beginPath(); ctx.ellipse(14, -4, 16, 9, -0.3, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = '#3a3040'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 10, 0, 0, TAU); ctx.fill(); ctx.stroke();
    eye(ctx, -2, -6, 1.5, '#fff'); eye(ctx, 2, -6, 1.5, '#fff');
    ctx.restore();
    this.drawPrompt(ctx);
  }
}

// ----- Decorative props (lamps, statues, signs) -----
export class Deco extends Entity {
  constructor(game, tx, ty, spec) {
    super(game, tx * TILE, ty * TILE, TILE, TILE);
    this.spec = spec;
    this.layer = spec.front ? 'front' : 'back';
    this.light = spec.kind === 'lamp' ? 150 : spec.kind === 'candle' ? 90 : 0;
  }
  draw(ctx, t) {
    const s = this.spec, x = this.cx, y = this.y + TILE, st = this.game.style;
    if (s.kind === 'lamp') {
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, this.y - (s.hang ? 200 : 0)); ctx.lineTo(x, this.y + 6); ctx.stroke();
      const g = ctx.createRadialGradient(x, this.y + 14, 2, x, this.y + 14, 80);
      g.addColorStop(0, 'rgba(255,220,150,0.35)'); g.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 80, this.y - 66, 160, 160);
      ctx.fillStyle = '#ffdc96'; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.ellipse(x, this.y + 14, 7, 10, 0, 0, TAU); ctx.fill(); ctx.stroke();
    } else if (s.kind === 'candle') {
      ctx.fillStyle = '#e8d6aa'; ctx.fillRect(x - 3, y - 18, 6, 18);
      ctx.fillStyle = '#ffcf7a'; ctx.beginPath(); ctx.ellipse(x, y - 22 + Math.sin(t * 10) * 0.7, 2.5, 5, 0, 0, TAU); ctx.fill();
    } else if (s.kind === 'statue') {
      ctx.fillStyle = st.rockHi; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y - 60, 22, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillRect(x - 20, y - 38, 40, 38); ctx.strokeRect(x - 20, y - 38, 40, 38);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x - 7, y - 62, 3, 5, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + 7, y - 62, 3, 5, 0, 0, TAU); ctx.fill();
    } else if (s.kind === 'sign') {
      ctx.fillStyle = '#4a3c30'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.fillRect(x - 2, y - 30, 4, 30);
      ctx.beginPath(); ctx.rect(x - 18, y - 40, 36, 18); ctx.fill(); ctx.stroke();
      if (s.text) {
        const p = this.player;
        if (Math.abs(p.cx - x) < 60 && Math.abs(p.cy - y) < 60) {
          ctx.font = '14px Georgia'; ctx.textAlign = 'center'; ctx.fillStyle = '#efe6cf';
          ctx.fillText(s.text, x, y - 52);
        }
      }
    } else if (s.kind === 'banner') {
      ctx.fillStyle = s.color || '#6a3040'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 14, this.y); ctx.lineTo(x + 14, this.y); ctx.lineTo(x + 14 + Math.sin(t) * 2, this.y + 70); ctx.lineTo(x, this.y + 58); ctx.lineTo(x - 14 + Math.sin(t) * 2, this.y + 70); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (s.kind === 'bones') {
      ctx.strokeStyle = '#d9cdb0'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - 14, y - 3); ctx.lineTo(x + 10, y - 6); ctx.moveTo(x - 4, y - 2); ctx.lineTo(x + 12, y - 1); ctx.stroke();
      ctx.fillStyle = '#e6dcc4'; ctx.beginPath(); ctx.arc(x - 10, y - 8, 6, 0, TAU); ctx.fill();
    }
  }
}

// ----- Trigger: invisible rect that sets a flag / starts a cutscene once -----
export class Trigger extends Entity {
  constructor(game, tx, ty, spec) {
    super(game, tx * TILE, ty * TILE, (spec.w || 1) * TILE, (spec.h || 1) * TILE);
    this.spec = spec;
    if (spec.flag && game.save.flags[spec.flag]) this.dead = true;
  }
  onTouch(p) {
    if (this.dead) return;
    const g = this.game, s = this.spec;
    if (s.flag) g.save.flags[s.flag] = 1;
    if (s.text) g.dialogue = new Dialogue(g, Array.isArray(s.text) ? s.text : [s.text], { speaker: s.speaker, style: s.style });
    if (s.hint) g.message = { title: s.hint, desc: s.desc || '', t: 0, dur: s.dur || 3.5 };
    if (!s.repeat) this.dead = true;
  }
}
