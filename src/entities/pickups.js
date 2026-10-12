// Currency glints and collectible item pickups.
import { Entity } from './base.js';
import { TILE } from '../core/constants.js';
import { TAU } from '../core/math.js';
import { ITEMS, grantItem } from '../data/items.js';

export class Glint extends Entity {
  constructor(game, x, y, value) {
    const s = value >= 25 ? 12 : value >= 5 ? 9 : 7;
    super(game, x - s / 2, y - s / 2, s, s);
    this.value = value;
    this.vx = (Math.random() - 0.5) * 260;
    this.vy = -200 - Math.random() * 250;
    this.age = 0;
    this.z = 4;
    this.removable = true;
  }
  update(dt) {
    this.age += dt;
    const p = this.player;
    const d = Math.hypot(p.cx - this.cx, p.cy - this.cy);
    if (this.age > 0.35 && d < 90 + (this.game.stats.flags.magnet ? 160 : 0)) {
      const k = 900 * dt / Math.max(d, 1);
      this.vx += (p.cx - this.cx) * k * 4; this.vy += (p.cy - this.cy) * k * 4;
      this.vx *= 0.9; this.vy *= 0.9;
      this.x += this.vx * dt; this.y += this.vy * dt;
    } else {
      const r = this.physics(dt, 1400, 700);
      if (r.floor) { this.vx *= 0.6; if (Math.abs(this.vy) < 1 && this.age < 1.5) { /* settle */ } }
    }
    if (this.age > 0.25 && d < 20) {
      this.dead = true;
      this.game.save.glints += this.value;
      this.game.sfx('glint', this.value);
    }
    if (this.age > 40) this.dead = true;
  }
  draw(ctx, t) {
    const s = this.w / 2;
    ctx.save(); ctx.translate(this.cx, this.cy); ctx.rotate(Math.PI / 4 + Math.sin(t * 4 + this.age) * 0.2);
    ctx.fillStyle = '#16141c'; ctx.fillRect(-s - 1.5, -s - 1.5, s * 2 + 3, s * 2 + 3);
    ctx.fillStyle = this.value >= 25 ? '#ffe9a8' : this.value >= 5 ? '#f3e7c4' : '#e8dfc9';
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(-s, -s, s * 0.8, s * 0.8);
    ctx.restore();
  }
}

export function spawnGlints(game, x, y, total) {
  let n = total;
  while (n > 0) {
    const v = n >= 25 ? 25 : n >= 5 ? 5 : 1;
    n -= v;
    game.add(new Glint(game, x, y, v));
  }
}

// A collectible item resting on the ground; disappears once taken (persisted by key)
export class ItemPickup extends Entity {
  constructor(game, tx, ty, spec, key) {
    super(game, tx * TILE + 6, ty * TILE + 6, 20, 20);
    this.spec = spec;
    this.key = 'got_' + key;
    this.z = 3;
    if (game.save.flags[this.key]) this.dead = true;
    this.light = 90;
  }
  onTouch(p) {
    if (this.dead) return;
    this.dead = true;
    this.game.save.flags[this.key] = 1;
    grantItem(this.game, this.spec);
  }
  draw(ctx, t) {
    const cx = this.cx, cy = this.cy + Math.sin(t * 2.5) * 3;
    const info = ITEMS[this.spec.item] || {};
    const col = info.color || '#fff4d6';
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.45 + Math.sin(t * 3) * 0.1;
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 34, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // rays
    ctx.strokeStyle = 'rgba(255,250,230,0.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = t * 0.5 + i * TAU / 6;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12); ctx.lineTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24); ctx.stroke();
    }
    drawItemIcon(ctx, this.spec.item, cx, cy, 1, t);
  }
}

export function drawItemIcon(ctx, item, x, y, s = 1, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = '#16141c'; ctx.lineWidth = 2;
  switch (item) {
    case 'shellFrag':
      ctx.fillStyle = '#f4eedf';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 9, -Math.PI / 2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      break;
    case 'vesselFrag':
      ctx.fillStyle = '#efe4c8';
      ctx.beginPath(); ctx.arc(0, 0, 9, Math.PI * 0.8, Math.PI * 2.2); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#b8323e'; ctx.beginPath(); ctx.moveTo(-3, 3); ctx.quadraticCurveTo(4, 8, 8, 4); ctx.stroke();
      break;
    case 'knot':
      ctx.strokeStyle = '#b8323e'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(-4, 0, 6, 4, 0.6, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(4, 0, 6, 4, -0.6, 0, TAU); ctx.stroke();
      break;
    case 'notch':
      ctx.fillStyle = '#e6d9b8'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#16141c'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill();
      break;
    case 'ore':
      ctx.fillStyle = '#d9e2ef';
      ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(-3, -7); ctx.lineTo(6, -5); ctx.lineTo(8, 5); ctx.lineTo(0, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'greatBead':
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(180,200,255,0.5)'; ctx.beginPath(); ctx.arc(-3, -3, 4, 0, TAU); ctx.fill();
      break;
    case 'ability':
      ctx.fillStyle = '#fff8e6'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#16141c';
      ctx.beginPath(); ctx.ellipse(-3, -1, 1.6, 2.6, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(3, -1, 1.6, 2.6, 0, 0, TAU); ctx.fill();
      break;
    case 'key': case 'relic': default:
      ctx.fillStyle = '#e8d38a';
      ctx.beginPath(); ctx.arc(-3, 0, 5, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillRect(1, -1.5, 9, 3); ctx.strokeRect(1, -1.5, 9, 3);
      break;
  }
  ctx.restore();
}
