// Per-frame animated tile art: liquids, updrafts, hooks, breakables, crystals, fake walls.
import { TILE, VIEW_W, VIEW_H } from '../core/constants.js';
import { hash2, TAU } from '../core/math.js';
import { rgba } from './palettes.js';

export function drawDynamicTiles(ctx, room, camX, camY, time, style, player) {
  const x0 = Math.max(0, Math.floor(camX / TILE) - 1), x1 = Math.min(room.w - 1, Math.floor((camX + VIEW_W) / TILE) + 1);
  const y0 = Math.max(0, Math.floor(camY / TILE) - 1), y1 = Math.min(room.h - 1, Math.floor((camY + VIEW_H) / TILE) + 1);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const ch = room.grid[ty][tx];
      const x = tx * TILE, y = ty * TILE;
      switch (ch) {
        case '~': liquid(ctx, room, tx, ty, x, y, time, 'rgba(70,130,200,0.38)', 'rgba(170,220,255,0.75)', '~'); break;
        case '!': liquid(ctx, room, tx, ty, x, y, time, style.acid ? style.acid[0] : 'rgba(60,20,70,0.72)', style.acid ? style.acid[1] : 'rgba(200,120,255,0.8)', '!'); break;
        case 'W': updraft(ctx, x, y, tx, ty, time); break;
        case 'O': hook(ctx, x, y, time, player); break;
        case 'B': breakable(ctx, x, y, tx, ty, style, room); break;
        case 'G': cracked(ctx, x, y, tx, ty, style, room); break;
        case 'C': crystalBlock(ctx, x, y, tx, ty, time); break;
      }
    }
  }
}

function liquid(ctx, room, tx, ty, x, y, time, body, surf, ch) {
  const isTop = room.charAt(tx, ty - 1) !== ch;
  ctx.fillStyle = body;
  if (!isTop) { ctx.fillRect(x, y, TILE, TILE); return; }
  ctx.beginPath();
  ctx.moveTo(x, y + TILE);
  for (let i = 0; i <= 8; i++) {
    const px = x + (i / 8) * TILE;
    ctx.lineTo(px, y + 6 + Math.sin(px * 0.08 + time * 2.4) * 2.5 + Math.sin(px * 0.031 - time * 1.3) * 1.5);
  }
  ctx.lineTo(x + TILE, y + TILE);
  ctx.fill();
  ctx.strokeStyle = surf; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    const px = x + (i / 8) * TILE;
    const py = y + 6 + Math.sin(px * 0.08 + time * 2.4) * 2.5 + Math.sin(px * 0.031 - time * 1.3) * 1.5;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();
  if (ch === '!' && hash2(tx, Math.floor(time * 2), 3) < 0.08) {
    ctx.fillStyle = 'rgba(220,150,255,0.6)';
    ctx.beginPath(); ctx.arc(x + hash2(tx, ty, 9) * TILE, y + 8, 2, 0, TAU); ctx.fill();
  }
}

function updraft(ctx, x, y, tx, ty, time) {
  ctx.strokeStyle = 'rgba(230,240,255,0.18)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) {
    const ph = (time * 1.6 + hash2(tx, ty, i) * 4 + i * 0.33) % 1;
    const sx = x + 6 + i * 10 + Math.sin(time * 3 + i + ty) * 2;
    const sy = y + TILE - ph * TILE * 1.4;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 10); ctx.stroke();
  }
}

function hook(ctx, x, y, time, player) {
  const cx = x + TILE / 2, cy = y + TILE / 2;
  const inRange = player && player.abilities.hook &&
    Math.hypot(player.cx - cx, player.cy - cy) < 6.5 * TILE;
  if (inRange) {
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22);
    g.addColorStop(0, 'rgba(255,240,200,0.5)'); g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = '#16141c'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, TAU); ctx.stroke();
  ctx.strokeStyle = inRange ? '#ffe9b5' : '#b9ad92'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, y - 2); ctx.stroke();
}

function breakable(ctx, x, y, tx, ty, style, room) {
  ctx.fillStyle = style.rockHi;
  ctx.beginPath(); ctx.roundRect(x + 1, y + 1, TILE - 2, TILE - 2, 5); ctx.fill();
  ctx.strokeStyle = rgba(style.rim, 0.9); ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = rgba(style.rim, 0.6); ctx.lineWidth = 1;
  const h = hash2(tx, ty, 5);
  ctx.beginPath();
  ctx.moveTo(x + 6 + h * 10, y + 3); ctx.lineTo(x + 14, y + 14); ctx.lineTo(x + 8, y + 22); ctx.lineTo(x + 12, y + TILE - 3);
  ctx.moveTo(x + 14, y + 14); ctx.lineTo(x + TILE - 4, y + 10 + h * 10);
  ctx.stroke();
  const dmg = room.breakHits && room.breakHits[tx + ',' + ty];
  if (dmg) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.moveTo(x + 4, y + 26); ctx.lineTo(x + 20, y + 6); ctx.stroke();
  }
}

function cracked(ctx, x, y, tx, ty, style, room) {
  ctx.fillStyle = style.rockHi;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.strokeStyle = rgba(style.rim, 0.95); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x + TILE, y + 1); ctx.stroke();
  ctx.strokeStyle = rgba(style.accent, 0.5); ctx.lineWidth = 1.2;
  const h = hash2(tx, ty, 2);
  ctx.beginPath();
  ctx.moveTo(x + h * 8, y + 2); ctx.lineTo(x + 12, y + 12); ctx.lineTo(x + 18, y + 6); ctx.lineTo(x + 26, y + 16); ctx.lineTo(x + TILE, y + 12 + h * 6);
  ctx.moveTo(x + 12, y + 12); ctx.lineTo(x + 10, y + TILE);
  ctx.stroke();
}

function crystalBlock(ctx, x, y, tx, ty, time) {
  const g = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
  g.addColorStop(0, 'rgba(255,215,245,0.85)'); g.addColorStop(1, 'rgba(180,120,200,0.85)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x + 4, y); ctx.lineTo(x + TILE - 4, y); ctx.lineTo(x + TILE, y + TILE / 2);
  ctx.lineTo(x + TILE - 4, y + TILE); ctx.lineTo(x + 4, y + TILE); ctx.lineTo(x, y + TILE / 2); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,255,0.9)'; ctx.lineWidth = 1.2; ctx.stroke();
  const sh = (time * 0.7 + hash2(tx, ty, 1)) % 1;
  ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - sh)})`;
  ctx.beginPath(); ctx.moveTo(x + 6 + sh * 16, y + 4); ctx.lineTo(x + 2 + sh * 16, y + TILE - 4); ctx.stroke();
}

// Fake walls draw as rock in front of everything until revealed.
export function drawFakeWalls(ctx, room, camX, camY, style, reveal) {
  const x0 = Math.max(0, Math.floor(camX / TILE) - 1), x1 = Math.min(room.w - 1, Math.floor((camX + VIEW_W) / TILE) + 1);
  const y0 = Math.max(0, Math.floor(camY / TILE) - 1), y1 = Math.min(room.h - 1, Math.floor((camY + VIEW_H) / TILE) + 1);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (room.grid[ty][tx] !== '*') continue;
      const a = 1 - (reveal(tx, ty) || 0);
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = style.rock;
      ctx.fillRect(tx * TILE - 1, ty * TILE - 1, TILE + 2, TILE + 2);
      ctx.fillStyle = rgba(style.rockHi, 0.5);
      if (hash2(tx, ty, 4) < 0.3) { ctx.beginPath(); ctx.arc(tx * TILE + 16, ty * TILE + 16, 9, 0, TAU); ctx.fill(); }
    }
  }
  ctx.globalAlpha = 1;
}
