// World map: rooms laid out by door alignment (src/world/layout.js), drawn as tiny inked silhouettes.
// A room is drawn when visited; owning an area's map reveals that area's unvisited rooms faintly.
import { VIEW_W, VIEW_H, TILE } from '../core/constants.js';
import { TAU, clamp } from '../core/math.js';
import { C, dim, text, title, panel } from './uikit.js';
import { ROOMS, START_ROOM, AREAS } from '../data/world.js';
import { computeLayout, roomInfo } from '../world/layout.js';
import { styleFor } from '../art/palettes.js';

let LAYOUT = null;
const thumbs = new Map();

function layout() {
  if (!LAYOUT) LAYOUT = computeLayout(ROOMS, START_ROOM).pos;
  return LAYOUT;
}

// One canvas pixel per tile, colored by the area's palette
function thumb(id) {
  if (thumbs.has(id)) return thumbs.get(id);
  const def = ROOMS[id];
  const info = roomInfo(def);
  const st = styleFor(def.style || def.area);
  const cv = document.createElement('canvas');
  cv.width = info.w; cv.height = info.h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(info.w, info.h);
  const rim = hex(st.rim), air = hex(st.rockHi);
  for (let y = 0; y < info.h; y++) {
    for (let x = 0; x < info.w; x++) {
      const ch = info.grid[y][x];
      const solid = '#MI*BGC/\\'.includes(ch);
      const i = (y * info.w + x) * 4;
      if (!solid) {
        // edge cells (air touching rock) are drawn bright: an inked outline
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const c2 = (info.grid[y + dy] || [])[x + dx];
          return c2 === undefined || '#MI*BGC/\\'.includes(c2);
        });
        const c = edge ? rim : air;
        img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = edge ? 255 : 150;
        if ('~!'.includes(ch)) { img.data[i] = 80; img.data[i + 1] = 120; img.data[i + 2] = 200; img.data[i + 3] = 200; }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  thumbs.set(id, cv);
  return cv;
}
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

export class MapScreen {
  constructor(app) {
    this.app = app; this.game = app.game; this.save = this.game.save;
    this.t = 0;
    const pos = layout()[this.game.room.id] || { x: 0, y: 0 };
    const r = roomInfo(this.game.room.def);
    this.cx = pos.x + r.w / 2; this.cy = pos.y + r.h / 2;
    this.zoom = 1.6; // screen px per tile
    app.audio.sfx('menuOpen');
  }

  visible(id) {
    const def = ROOMS[id];
    if (!def || id.startsWith('test_') || id.startsWith('__')) return 0;
    if (this.save.visited[id]) return 2;
    if (this.save.maps[def.area]) return 1;
    return 0;
  }

  update(dt) {
    const inp = this.app.input, sfx = (n) => this.app.audio.sfx(n);
    this.t += dt;
    if (this.t > 0.15 && (inp.pressed('back') || inp.pressed('map') || inp.pressed('pause'))) { inp.eatAll(); sfx('menuClose'); this.app.closeOverlay(); return; }
    const sp = 420 / this.zoom * dt;
    this.cx += inp.axisX * sp; this.cy += inp.axisY * sp;
    if (inp.down('jump')) this.zoom = clamp(this.zoom * (1 + dt * 1.5), 0.5, 5);
    if (inp.down('attack')) this.zoom = clamp(this.zoom / (1 + dt * 1.5), 0.5, 5);
  }

  draw(ctx) {
    dim(ctx, 0.9);
    // parchment-ish backdrop
    ctx.fillStyle = 'rgba(30,26,22,0.5)';
    ctx.fillRect(20, 20, VIEW_W - 40, VIEW_H - 40);
    const pos = layout();
    const z = this.zoom;
    const ox = VIEW_W / 2 - this.cx * z, oy = VIEW_H / 2 - this.cy * z;
    ctx.save();
    ctx.beginPath(); ctx.rect(20, 20, VIEW_W - 40, VIEW_H - 40); ctx.clip();
    ctx.imageSmoothingEnabled = false;
    const areaBounds = {};
    for (const id of Object.keys(pos)) {
      const v = this.visible(id);
      if (!v) continue;
      const def = ROOMS[id], info = roomInfo(def), p = pos[id];
      const x = ox + p.x * z, y = oy + p.y * z, w = info.w * z, h = info.h * z;
      if (x > VIEW_W || y > VIEW_H || x + w < 0 || y + h < 0) { this.accum(areaBounds, def.area, p, info); continue; }
      ctx.globalAlpha = v === 2 ? 1 : 0.35;
      ctx.drawImage(thumb(id), x, y, w, h);
      this.accum(areaBounds, def.area, p, info);
      // markers
      if (v === 2) {
        for (const [ch, spec] of Object.entries(def.legend || {})) {
          if (!spec || (spec.e !== 'spindle' && spec.e !== 'ferry')) continue;
          const at = findChar(def.tiles, ch);
          if (!at) continue;
          const mx = x + (at.x + 0.5) * z, my = y + (at.y + 0.5) * z;
          ctx.globalAlpha = 1;
          if (spec.e === 'spindle') {
            ctx.fillStyle = '#e8c98a'; ctx.strokeStyle = '#16141c'; ctx.lineWidth = 1;
            ctx.fillRect(mx - 4, my - 3, 8, 6); ctx.strokeRect(mx - 4, my - 3, 8, 6);
          } else {
            ctx.fillStyle = '#d8cdb8'; ctx.beginPath(); ctx.ellipse(mx - 3, my, 4, 2.5, -0.4, 0, TAU); ctx.ellipse(mx + 3, my, 4, 2.5, 0.4, 0, TAU); ctx.fill();
          }
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    // area labels
    for (const [a, b] of Object.entries(areaBounds)) {
      const ar = AREAS[a];
      if (!ar) continue;
      const lx = ox + (b.x0 + b.x1) / 2 * z, ly = oy + (b.y0 + b.y1) / 2 * z;
      ctx.save(); ctx.shadowColor = 'black'; ctx.shadowBlur = 6;
      text(ctx, ar.name.toUpperCase(), lx, ly, Math.max(11, Math.min(18, 10 + z * 3)), 'rgba(240,232,214,0.85)', 'center');
      ctx.restore();
    }
    // the player (needs the Wayfinder knot) and the tangle
    const g = this.game, rp = pos[g.room.id];
    if (rp && g.stats.flags.compass) {
      const px = ox + (rp.x + g.player.cx / TILE) * z, py = oy + (rp.y + g.player.cy / TILE) * z;
      const pulse = 1 + Math.sin(this.t * 5) * 0.2;
      ctx.fillStyle = '#f4eedf'; ctx.strokeStyle = '#16141c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 5 * pulse, 0, TAU); ctx.fill(); ctx.stroke();
    }
    const tg = this.save.tangle;
    if (tg && pos[tg.room] && this.visible(tg.room)) {
      const p = pos[tg.room];
      const tx = ox + (p.x + tg.x / TILE) * z, ty = oy + (p.y + tg.y / TILE) * z;
      ctx.strokeStyle = '#b8323e'; ctx.lineWidth = 2;
      ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = i * 0.9 + this.t; ctx.lineTo(tx + Math.cos(a) * 5, ty + Math.sin(a * 1.3) * 5); } ctx.stroke();
    }
    ctx.restore();
    // frame
    ctx.strokeStyle = 'rgba(220,210,190,0.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(24.5, 24.5, VIEW_W - 49, VIEW_H - 49);
    const area = AREAS[g.room.def.area];
    title(ctx, area ? area.name : '', VIEW_W / 2, 48, 20);
    const hint = g.stats.flags.compass ? '' : 'Tie the Wayfinder knot to see where you are.   ';
    text(ctx, hint + 'Arrows: pan   Z/X: zoom   Tab: close', VIEW_W / 2, VIEW_H - 36, 12, C.faint, 'center');
    if (!this.save.maps[g.room.def.area]) text(ctx, 'You have no map of this place. Only where you have been is remembered.', VIEW_W / 2, VIEW_H - 56, 12, C.faint, 'center');
  }

  accum(b, area, p, info) {
    const e = b[area] || (b[area] = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
    e.x0 = Math.min(e.x0, p.x); e.y0 = Math.min(e.y0, p.y);
    e.x1 = Math.max(e.x1, p.x + info.w); e.y1 = Math.max(e.y1, p.y + info.h);
  }
}

function findChar(grid, ch) {
  for (let y = 0; y < grid.length; y++) {
    const x = grid[y].indexOf(ch);
    if (x >= 0) return { x, y };
  }
  return null;
}

export function resetMapLayout() { LAYOUT = null; thumbs.clear(); }
