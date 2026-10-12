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

// Two-level layout: each area is laid out internally from its first room, then whole areas are
// placed relative to each other through their connector doors and pushed apart if they overlap.
export function computeLayout(ROOMS, startId, overrides = {}) {
  const issues = [];
  const byArea = {};
  for (const def of Object.values(ROOMS)) {
    if (def.id.startsWith('__') || def.id.startsWith('test_')) continue;
    (byArea[def.area] = byArea[def.area] || []).push(def.id);
  }
  // 1) local layouts
  const local = {};       // id -> {x,y} within its area
  const comps = {};       // id -> component index within area (disconnected chunks)
  for (const [area, ids] of Object.entries(byArea)) {
    let comp = 0;
    let shiftX = 0;
    for (const seed of ids) {
      if (local[seed]) continue;
      const queue = [seed];
      local[seed] = { x: shiftX, y: 0 };
      comps[seed] = comp;
      let maxX = shiftX;
      while (queue.length) {
        const id = queue.shift();
        const A = roomInfo(ROOMS[id]);
        maxX = Math.max(maxX, local[id].x + A.w);
        for (const d of Object.values(A.doors)) {
          const L = parseLink(d.link);
          if (!L || !ROOMS[L.room] || ROOMS[L.room].area !== area) continue;
          const B = roomInfo(ROOMS[L.room]);
          const db = B.doors[L.door];
          if (!db) continue;
          const off = offsetFor(A, d, B, db);
          const bx = local[id].x + off.x, by = local[id].y + off.y;
          if (!local[L.room]) { local[L.room] = { x: bx, y: by }; comps[L.room] = comp; queue.push(L.room); }
          else if (local[L.room].x !== bx || local[L.room].y !== by) issues.push({ type: 'mismatch', a: id, door: d.id, b: L.room, dx: local[L.room].x - bx, dy: local[L.room].y - by });
        }
      }
      comp++;
      shiftX = maxX + 20;
    }
  }
  // 2) place areas through cross-area links
  const areaOff = {};
  const startArea = ROOMS[startId] ? ROOMS[startId].area : Object.keys(byArea)[0];
  const placed = [];
  const rectsOf = (area, off) => byArea[area].map((id) => {
    const r = roomInfo(ROOMS[id]);
    return { x: local[id].x + off.x, y: local[id].y + off.y, w: r.w, h: r.h };
  });
  const collides = (rects) => placed.some((pr) => rects.some((a) => pr.some((b) =>
    a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1)));
  if (byArea[startArea]) { areaOff[startArea] = { x: 0, y: 0 }; placed.push(rectsOf(startArea, areaOff[startArea])); }
  const aq = [startArea];
  const pushDir = { right: [1, 0], left: [-1, 0], bottom: [0, 1], top: [0, -1] };
  while (aq.length) {
    const area = aq.shift();
    for (const id of byArea[area] || []) {
      const A = roomInfo(ROOMS[id]);
      for (const d of Object.values(A.doors)) {
        const L = parseLink(d.link);
        if (!L || !ROOMS[L.room]) continue;
        const bArea = ROOMS[L.room].area;
        if (bArea === area || areaOff[bArea] || !byArea[bArea]) continue;
        const B = roomInfo(ROOMS[L.room]);
        const db = B.doors[L.door];
        if (!db) continue;
        const off = offsetFor(A, d, B, db);
        const ax = local[id].x + areaOff[area].x, ay = local[id].y + areaOff[area].y;
        let o = { x: ax + off.x - local[L.room].x, y: ay + off.y - local[L.room].y };
        const [dx, dy] = pushDir[d.edge] || [1, 0];
        let guard = 0;
        while (collides(rectsOf(bArea, o)) && guard++ < 400) { o = { x: o.x + dx * 8, y: o.y + dy * 8 }; }
        areaOff[bArea] = o;
        placed.push(rectsOf(bArea, o));
        aq.push(bArea);
      }
    }
  }
  // areas not connected to the start: park them to the right
  let parkX = Math.max(0, ...placed.flat().map((r) => r.x + r.w)) + 60;
  for (const area of Object.keys(byArea)) {
    if (areaOff[area]) continue;
    areaOff[area] = { x: parkX, y: 0 };
    const rs = rectsOf(area, areaOff[area]);
    parkX = Math.max(...rs.map((r) => r.x + r.w)) + 60;
    issues.push({ type: 'disconnected', a: area });
  }
  const pos = {};
  for (const [area, ids] of Object.entries(byArea)) for (const id of ids) pos[id] = { x: local[id].x + areaOff[area].x, y: local[id].y + areaOff[area].y };
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
