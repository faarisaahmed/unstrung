// Room: parsed ASCII grid + collision queries. Pure logic (no DOM) so the validator can use it.
import { TILE } from '../core/constants.js';
import { T, TILE_CHARS, shapeOf, isDoorChar } from './tiles.js';

export class Room {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.area = def.area;
    const rows = def.tiles.map((r) => r.replace(/\t/g, ' '));
    this.h = rows.length;
    this.w = Math.max(...rows.map((r) => r.length));
    this.grid = [];
    this.markers = []; // {ch, tx, ty, spec}
    this.spawn = null;
    for (let y = 0; y < this.h; y++) {
      const row = [];
      const src = rows[y].padEnd(this.w, '#');
      for (let x = 0; x < this.w; x++) {
        let ch = src[x];
        if (ch === '.') ch = ' ';
        if (ch === '@') { this.spawn = { tx: x, ty: y }; ch = ' '; }
        if (!TILE_CHARS.has(ch)) {
          const spec = def.legend && def.legend[ch];
          this.markers.push({ ch, tx: x, ty: y, spec: spec || null });
          ch = (spec && spec.under) || ' ';
        }
        row.push(ch);
      }
      this.grid.push(row);
    }
    // markers sitting inside a liquid inherit it (unless `under` was given explicitly)
    for (const m of this.markers) {
      if (m.spec && m.spec.under) continue;
      const nb = [[1, 0], [-1, 0], [0, -1], [0, 1]].map(([dx, dy]) => (this.grid[m.ty + dy] || [])[m.tx + dx]);
      for (const liq of ['~', '!']) if (nb.filter((c) => c === liq).length >= 3) { this.grid[m.ty][m.tx] = liq; break; }
    }
    this.pxW = this.w * TILE;
    this.pxH = this.h * TILE;
    this.dynamicSolids = []; // [{x,y,w,h,oneway?,active}]
    this.parseDoors();
  }

  parseDoors() {
    this.doors = {};
    const add = (ch, edge, tx, ty) => {
      let d = this.doors[ch];
      if (!d) {
        d = this.doors[ch] = { id: ch, edge, cells: [], link: (this.def.doors || {})[ch] || null };
      }
      d.cells.push({ tx, ty });
    };
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const ch = this.grid[y][x];
        if (!isDoorChar(ch)) continue;
        let edge = null;
        if (x === 0) edge = 'left';
        else if (x === this.w - 1) edge = 'right';
        else if (y === 0) edge = 'top';
        else if (y === this.h - 1) edge = 'bottom';
        if (edge) add(ch, edge, x, y);
        else add(ch, 'inner', x, y); // interior door cells (part of a thick door)
      }
    }
    for (const d of Object.values(this.doors)) {
      // Resolve primary edge = the edge most cells sit on
      const edges = d.cells.map((c) =>
        c.tx === 0 ? 'left' : c.tx === this.w - 1 ? 'right' : c.ty === 0 ? 'top' : c.ty === this.h - 1 ? 'bottom' : 'inner');
      const counts = {};
      for (const e of edges) counts[e] = (counts[e] || 0) + 1;
      d.edge = Object.keys(counts).filter((e) => e !== 'inner').sort((a, b) => counts[b] - counts[a])[0] || 'inner';
      const edgeCells = d.cells.filter((c, i) => edges[i] === d.edge);
      const xs = edgeCells.map((c) => c.tx), ys = edgeCells.map((c) => c.ty);
      d.x0 = Math.min(...xs); d.x1 = Math.max(...xs);
      d.y0 = Math.min(...ys); d.y1 = Math.max(...ys);
    }
  }

  inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }

  // Raw char with out-of-bounds handling: beyond a door cell is open, beyond anything else is rock.
  charAt(tx, ty) {
    if (this.inBounds(tx, ty)) return this.grid[ty][tx];
    const cx = Math.max(0, Math.min(this.w - 1, tx));
    const cy = Math.max(0, Math.min(this.h - 1, ty));
    const ch = this.grid[cy][cx];
    return isDoorChar(ch) ? ' ' : '#';
  }

  setChar(tx, ty, ch) {
    if (this.inBounds(tx, ty)) this.grid[ty][tx] = ch;
  }

  // passChars: chars treated as empty (validator uses this for breakables)
  shapeAt(tx, ty) {
    const ch = this.charAt(tx, ty);
    if (this.passChars && this.passChars.has(ch)) return T.EMPTY;
    return shapeOf(ch);
  }

  // Does rect overlap any blocking geometry? opts: {oneway:{prevBottom}, ignoreHalf}
  rectBlocked(x, y, w, h) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const s = this.shapeAt(tx, ty);
        if (s === T.SOLID) return true;
        if (s === T.HALF) {
          const top = ty * TILE;
          if (y < top + TILE / 2 && y + h > top) return true;
        }
      }
    }
    for (const d of this.dynamicSolids) {
      if (!d.active || d.oneway) continue;
      if (x < d.x + d.w && x + w > d.x && y < d.y + d.h && y + h > d.y) return true;
    }
    return false;
  }

  // Top surface of one-way platforms/dynamic one-ways crossed when moving down from prevBottom to newBottom.
  onewayLanding(x, w, prevBottom, newBottom) {
    let best = null;
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
    const r0 = Math.floor(prevBottom / TILE), r1 = Math.floor((newBottom - 0.001) / TILE);
    for (let ty = Math.max(r0, 0); ty <= r1; ty++) {
      const top = ty * TILE;
      if (prevBottom > top + 0.01 || newBottom < top) continue;
      for (let tx = x0; tx <= x1; tx++) {
        if (this.shapeAt(tx, ty) === T.ONEWAY) {
          if (best === null || top < best) best = top;
        }
      }
    }
    for (const d of this.dynamicSolids) {
      if (!d.active || !d.oneway) continue;
      if (x < d.x + d.w && x + w > d.x && prevBottom <= d.y + 0.01 && newBottom >= d.y) {
        if (best === null || d.y < best) best = d.y;
      }
    }
    return best;
  }

  // Slope surface y under point cx, searching between yA..yB (yA<yB). Returns smallest surface y or null.
  slopeSurface(cx, yA, yB) {
    const tx = Math.floor(cx / TILE);
    const r0 = Math.floor(yA / TILE), r1 = Math.floor(yB / TILE);
    let best = null;
    for (let ty = r0; ty <= r1; ty++) {
      const s = this.shapeAt(tx, ty);
      if (s !== T.SLOPE_R && s !== T.SLOPE_L) continue;
      const lx = cx - tx * TILE;
      const sy = ty * TILE + (s === T.SLOPE_R ? TILE - lx : lx);
      if (sy >= yA && sy <= yB && (best === null || sy < best)) best = sy;
    }
    return best;
  }

  slopeDirAt(cx, y) {
    const s = this.shapeAt(Math.floor(cx / TILE), Math.floor(y / TILE));
    return s === T.SLOPE_R ? 1 : s === T.SLOPE_L ? -1 : 0;
  }

  // Any tile char in rect satisfying predicate
  rectHasChar(x, y, w, h, pred) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (pred(this.charAt(tx, ty), tx, ty)) return { tx, ty };
    return null;
  }

  charAtPx(px, py) { return this.charAt(Math.floor(px / TILE), Math.floor(py / TILE)); }
}
