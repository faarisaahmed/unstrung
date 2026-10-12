// Computes global map positions (in tiles) for every room by aligning linked doors.
// Pure logic: used by the in-game map and by tools/validate.js.
import { Room } from './room.js';

const roomCache = new Map();
export function roomInfo(def) {
  let r = roomCache.get(def.id);
  if (!r) {
    const room = new Room(def);
    r = { id: def.id, area: def.area, w: room.w, h: room.h, doors: room.doors, grid: room.grid };
    roomCache.set(def.id, r);
  }
  return r;
}

export function parseLink(link) {
  if (!link) return null;
  const i = link.lastIndexOf(':');
  return { room: link.slice(0, i), door: link.slice(i + 1) };
}

// Offset of room B (top-left) relative to room A given A.door -> B.door
function offsetFor(A, da, B, db) {
  switch (da.edge) {
    case 'right': return { x: A.w, y: da.y0 - db.y0 };
    case 'left': return { x: -B.w, y: da.y0 - db.y0 };
    case 'bottom': return { x: da.x0 - db.x0, y: A.h };
    case 'top': return { x: da.x0 - db.x0, y: -B.h };
    default: return { x: A.w, y: 0 };
  }
}

export function computeLayout(ROOMS, startId, overrides = {}) {
  const pos = {};
  const issues = [];
  const queue = [];
  const place = (id, x, y) => { pos[id] = { x, y }; queue.push(id); };
  place(startId, 0, 0);
  const seeds = Object.keys(ROOMS);
  let seedIdx = 0;
  for (;;) {
    while (queue.length) {
      const id = queue.shift();
      const A = roomInfo(ROOMS[id]);
      for (const d of Object.values(A.doors)) {
        const L = parseLink(d.link);
        if (!L || !ROOMS[L.room]) continue;
        const B = roomInfo(ROOMS[L.room]);
        const db = B.doors[L.door];
        if (!db) continue;
        const off = offsetFor(A, d, B, db);
        const bx = pos[id].x + off.x, by = pos[id].y + off.y;
        if (!pos[L.room]) place(L.room, bx, by);
        else if (pos[L.room].x !== bx || pos[L.room].y !== by) {
          issues.push({ type: 'mismatch', a: id, door: d.id, b: L.room, dx: pos[L.room].x - bx, dy: pos[L.room].y - by });
        }
      }
    }
    // disconnected rooms: place them far away in a column so the map still draws them
    while (seedIdx < seeds.length && pos[seeds[seedIdx]]) seedIdx++;
    if (seedIdx >= seeds.length) break;
    const id = seeds[seedIdx];
    const maxX = Math.max(0, ...Object.values(pos).map((p) => p.x)) + 400;
    place(id, maxX, 0);
    issues.push({ type: 'disconnected', a: id });
  }
  for (const [id, o] of Object.entries(overrides)) if (pos[id]) { pos[id].x += o.x; pos[id].y += o.y; }
  return { pos, issues };
}

export function findOverlaps(ROOMS, pos) {
  const ids = Object.keys(pos);
  const out = [];
  for (let i = 0; i < ids.length; i++) {
    const a = roomInfo(ROOMS[ids[i]]), pa = pos[ids[i]];
    for (let j = i + 1; j < ids.length; j++) {
      const b = roomInfo(ROOMS[ids[j]]), pb = pos[ids[j]];
      const ox = Math.min(pa.x + a.w, pb.x + b.w) - Math.max(pa.x, pb.x);
      const oy = Math.min(pa.y + a.h, pb.y + b.h) - Math.max(pa.y, pb.y);
      if (ox > 2 && oy > 2) out.push({ a: ids[i], b: ids[j], ox, oy });
    }
  }
  return out;
}
