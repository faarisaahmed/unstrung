// Shared movement physics for Bead (and simple bodies). No DOM: used by game and validator.
import { TILE, PHYS } from '../core/constants.js';
import { approach, sign } from '../core/math.js';

// ---------- generic AABB movement against a Room ----------

// Move horizontally. Returns true if blocked. Supports small step-ups for grounded bodies.
export function moveX(b, room, dx, stepUp = 0) {
  let rem = dx;
  let hit = false;
  while (rem !== 0) {
    const s = Math.abs(rem) > 6 ? 6 * sign(rem) : rem;
    if (!room.rectBlocked(b.x + s, b.y, b.w, b.h)) { b.x += s; rem -= s; continue; }
    // try stepping up small lips (slope tops, wobbly edges)
    let stepped = false;
    if (stepUp > 0) {
      for (let lift = 1; lift <= stepUp; lift++) {
        if (!room.rectBlocked(b.x + s, b.y - lift, b.w, b.h)) {
          b.y -= lift; b.x += s; rem -= s; stepped = true; break;
        }
      }
    }
    if (stepped) continue;
    // approach contact pixel by pixel
    const d = sign(s);
    let n = Math.abs(s);
    while (n >= 1 && !room.rectBlocked(b.x + d, b.y, b.w, b.h)) { b.x += d; n--; }
    hit = true;
    break;
  }
  return hit;
}

// Move vertically. Returns 'floor' | 'ceil' | null. opts.dropThrough ignores one-ways.
export function moveY(b, room, dy, opts = {}) {
  let rem = dy;
  while (rem !== 0) {
    const s = Math.abs(rem) > 6 ? 6 * sign(rem) : rem;
    if (s > 0 && !opts.dropThrough) {
      const prevBottom = b.y + b.h;
      const land = room.onewayLanding(b.x, b.w, prevBottom, prevBottom + s);
      if (land !== null) { b.y = land - b.h; return 'floor'; }
    }
    if (!room.rectBlocked(b.x, b.y + s, b.w, b.h)) { b.y += s; rem -= s; continue; }
    // corner correction when bonking a ceiling edge
    if (s < 0 && opts.cornerCorrect) {
      let fixed = false;
      for (let off = 1; off <= opts.cornerCorrect && !fixed; off++) {
        for (const dir of [1, -1]) {
          const nx = b.x + off * dir;
          if (!room.rectBlocked(nx, b.y + s, b.w, b.h) && !room.rectBlocked(nx, b.y, b.w, b.h)) {
            b.x = nx; fixed = true; break;
          }
        }
      }
      if (fixed) continue;
    }
    const d = sign(s);
    let n = Math.abs(s);
    while (n >= 1 && !room.rectBlocked(b.x, b.y + d, b.w, b.h)) { b.y += d; n--; }
    return s > 0 ? 'floor' : 'ceil';
  }
  return null;
}

// Snap onto slope surfaces. reach = how far below the feet to look (stick-to-ground).
export function snapSlope(b, room, reach) {
  const cx = b.x + b.w / 2;
  const bottom = b.y + b.h;
  const s = room.slopeSurface(cx, bottom - 18, bottom + reach);
  if (s === null) return false;
  if (room.rectBlocked(b.x, s - b.h, b.w, b.h)) return false;
  b.y = s - b.h;
  return true;
}

export function wallDir(b, room) {
  const yy = b.y + 3, hh = b.h - 6;
  if (room.rectBlocked(b.x - 1.5, yy, 1, hh)) return -1;
  if (room.rectBlocked(b.x + b.w + 0.5, yy, 1, hh)) return 1;
  return 0;
}

const isIce = (ch) => ch === 'I';
const isMag = (ch) => ch === 'M';

function wallHas(b, room, dir, pred) {
  const x = dir < 0 ? b.x - 2 : b.x + b.w + 1;
  return !!room.rectHasChar(x, b.y + 4, 1, b.h - 8, pred);
}

// ---------- Bead ----------

export function makeBead(x, y) {
  return {
    x, y, w: PHYS.w, h: PHYS.h, vx: 0, vy: 0,
    facing: 1, grounded: false, wasGrounded: false, onSlope: 0, onIce: false,
    wall: 0, clinging: false,
    coyote: 0, jumpBuf: 0, jumping: false,
    mode: 'normal', dashT: 0, dashCd: 0, dashDir: 1,
    airDashes: 1, airJumps: 1, wallLock: 0, dropT: 0,
    small: false, gliding: false, inWater: false, inAcid: false,
    hook: null, magnet: null, cometT: 0, cometDir: 1,
    lastSafe: null,
  };
}

export function resetAir(b, ab) {
  b.airDashes = 1;
  b.airJumps = ab.dbljump ? 1 : 0;
}

// Find a grapple hook in range with clear line of sight.
export function findHook(b, room, exclude) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const r = PHYS.hookRange;
  const tx0 = Math.floor((cx - r) / TILE), tx1 = Math.floor((cx + r) / TILE);
  const ty0 = Math.floor((cy - r) / TILE), ty1 = Math.floor((cy + r) / TILE);
  let best = null, bestScore = Infinity;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (room.charAt(tx, ty) !== 'O') continue;
      const hx = tx * TILE + TILE / 2, hy = ty * TILE + TILE / 2;
      if (exclude && exclude.tx === tx && exclude.ty === ty) continue;
      const d = Math.hypot(hx - cx, hy - cy);
      if (d > r) continue;
      if (!lineClear(room, cx, cy, hx, hy)) continue;
      let score = d;
      if (sign(hx - cx) === b.facing) score -= 40;
      if (hy < cy) score -= 30;
      if (score < bestScore) { bestScore = score; best = { tx, ty, x: hx, y: hy }; }
    }
  }
  return best;
}

export function lineClear(room, x0, y0, x1, y1) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    if (room.rectBlocked(x - 2, y - 2, 4, 4)) return false;
  }
  return true;
}

function setSmall(b, room, small) {
  if (small === b.small) return true;
  const cx = b.x + b.w / 2, bottom = b.y + b.h;
  const w = small ? PHYS.smallW : PHYS.w, h = small ? PHYS.smallH : PHYS.h;
  const nx = cx - w / 2, ny = bottom - h;
  if (!small && room.rectBlocked(nx, ny, w, h)) {
    // try nudging sideways
    for (const off of [-6, 6, -12, 12]) {
      if (!room.rectBlocked(nx + off, ny, w, h)) { b.x = nx + off; b.y = ny; b.w = w; b.h = h; b.small = false; return true; }
    }
    return false;
  }
  b.x = nx; b.y = ny; b.w = w; b.h = h; b.small = small;
  return true;
}

// inp: {x,y, jump, jumpP, dash, dashP, dashR, abilityP}
// ab: ability flags object. ev: array to push events into.
export function stepBead(b, inp, room, ab, dt, ev) {
  b.dashCd = Math.max(0, b.dashCd - dt);
  b.wallLock -= dt; b.coyote -= dt; b.jumpBuf -= dt; b.dropT -= dt;
  if (inp.jumpP) b.jumpBuf = PHYS.jumpBuffer;
  b.wasGrounded = b.grounded;

  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const here = room.charAtPx(cx, cy);
  b.inAcid = here === '!';
  b.inWater = here === '~' || (b.inAcid && ab.shell);
  const inUpdraft = here === 'W';

  switch (b.mode) {
    case 'dash': return stepDash(b, inp, room, ab, dt, ev);
    case 'pound': return stepPound(b, inp, room, ab, dt, ev);
    case 'cometCharge': return stepCometCharge(b, inp, room, ab, dt, ev);
    case 'comet': return stepComet(b, inp, room, ab, dt, ev);
    case 'hook': return stepHook(b, inp, room, ab, dt, ev);
    case 'hang': return stepHang(b, inp, room, ab, dt, ev);
    case 'magnet': return stepMagnet(b, inp, room, ab, dt, ev);
  }

  // ---- normal mode ----
  if (inp.x) b.facing = inp.x;
  b.wall = wallDir(b, room);
  const wallIsIce = b.wall !== 0 && wallHas(b, room, b.wall, isIce);

  // horizontal
  let top = b.small ? PHYS.smallRunSpeed : PHYS.runSpeed;
  if (b.inWater) top *= PHYS.waterRunMul;
  if (b.grounded && b.onSlope && inp.x && sign(inp.x) === -b.onSlope) top *= PHYS.slopeBoost; // downhill
  const target = inp.x * top;
  if (b.wallLock <= 0) {
    let acc;
    if (b.grounded) acc = inp.x ? PHYS.groundAccel : PHYS.groundDecel;
    else acc = inp.x ? PHYS.airAccel : PHYS.airDecel;
    if (b.grounded && b.onIce) acc *= PHYS.iceAccelMul;
    // keep extra momentum (from slopes/comet) a little longer when pushing the same way
    if (inp.x && sign(b.vx) === sign(target) && Math.abs(b.vx) > Math.abs(target)) acc = b.grounded ? 900 : 500;
    b.vx = approach(b.vx, target, acc * dt);
  }

  // jumping
  const canCling = ab.sap && !b.small && b.wall !== 0 && !wallIsIce && !b.grounded;
  if (b.jumpBuf > 0) {
    if (b.grounded || b.coyote > 0) {
      if (inp.y > 0 && onOneway(b, room)) {
        b.dropT = 0.25; b.jumpBuf = 0; b.grounded = false;
      } else {
        b.vy = -(b.small ? PHYS.smallJumpVel : PHYS.jumpVel);
        b.jumping = true; b.grounded = false; b.coyote = 0; b.jumpBuf = 0;
        ev.push({ type: 'jump' });
      }
    } else if (b.inWater) {
      const above = room.charAtPx(cx, b.y - 6);
      const surface = !(above === '~' || (above === '!' && ab.shell));
      b.vy = -(surface ? PHYS.jumpVel * 0.85 : PHYS.swimStroke);
      b.jumping = surface; b.jumpBuf = 0;
      ev.push({ type: 'swim' });
    } else if (canCling) {
      b.vx = -b.wall * PHYS.wallJumpVX;
      b.vy = -PHYS.wallJumpVY;
      b.facing = -b.wall;
      b.wallLock = PHYS.wallJumpLock;
      b.jumping = true; b.jumpBuf = 0;
      resetAir(b, ab);
      ev.push({ type: 'walljump', dir: -b.wall });
    } else if (ab.dbljump && b.airJumps > 0 && !b.small) {
      b.vy = -PHYS.doubleJumpVel;
      b.airJumps--; b.jumping = true; b.jumpBuf = 0;
      ev.push({ type: 'dbljump' });
    }
  }
  if (b.jumping && (!inp.jump || b.vy >= 0)) {
    if (b.vy < 0) b.vy *= PHYS.jumpCut;
    b.jumping = false;
  }

  // gravity
  b.gliding = false;
  b.clinging = false;
  if (b.inWater) {
    b.vy = Math.min(b.vy + PHYS.swimGravity * dt, PHYS.swimMaxFall);
  } else {
    b.vy += PHYS.gravity * dt;
    let maxFall = PHYS.maxFall;
    if (ab.glide && !b.small && inp.jump && b.vy > 0 && !b.grounded) {
      b.gliding = true;
      maxFall = PHYS.glideFall;
    }
    if (b.gliding && inUpdraft) {
      b.vy = approach(b.vy, -PHYS.updraft, 4200 * dt);
    } else if (canCling && b.vy > 0 && inp.x === b.wall) {
      b.clinging = true;
      maxFall = PHYS.wallSlide;
      resetAir(b, ab);
    }
    if (b.vy > maxFall) b.vy = approach(b.vy, maxFall, 5000 * dt);
  }

  // abilities
  if (inp.abilityP) {
    if (!b.grounded && !b.inWater) {
      const hook = ab.hook && !b.small ? findHook(b, room) : null;
      if (hook) {
        b.mode = 'hook'; b.hook = hook; ev.push({ type: 'hook', hook });
        return;
      } else if (ab.pound && !b.small) {
        b.mode = 'pound'; b.vx = 0; b.vy = PHYS.poundSpeed; ev.push({ type: 'poundStart' });
        return;
      }
    } else if (ab.shrink) {
      if (setSmall(b, room, !b.small)) ev.push({ type: b.small ? 'shrink' : 'grow' });
    }
  }
  // dash / comet
  if (inp.dashP && !b.small) {
    if (ab.comet && inp.y > 0 && (b.grounded || b.clinging)) {
      b.mode = 'cometCharge'; b.cometT = 0; b.vx = 0;
      b.cometDir = b.clinging ? -b.wall : b.facing;
      b.cometWall = b.clinging ? b.wall : 0;
      ev.push({ type: 'cometCharge' });
      return;
    }
    if (ab.dash && b.dashCd <= 0 && (b.grounded || b.airDashes > 0 || b.inWater)) {
      b.mode = 'dash'; b.dashT = PHYS.dashTime;
      b.dashDir = b.clinging ? -b.wall : (inp.x || b.facing);
      b.facing = b.dashDir;
      if (!b.grounded && !b.inWater) b.airDashes--;
      b.dashCd = PHYS.dashCooldown;
      b.vy = 0; b.jumping = false;
      ev.push({ type: 'dash', dir: b.dashDir });
      return;
    }
  }
  // magnet attach
  if (ab.magnet && !b.small && !b.grounded) {
    if (b.wall !== 0 && wallHas(b, room, b.wall, isMag) && (inp.x === b.wall || inp.y < 0)) {
      b.mode = 'magnet'; b.magnet = b.wall < 0 ? 'left' : 'right'; b.vx = 0; b.vy = 0;
      resetAir(b, ab); ev.push({ type: 'magnet' });
      return;
    }
    if (b.vy <= 60 && room.rectHasChar(b.x + 2, b.y - 2, b.w - 4, 1, isMag)) {
      b.mode = 'magnet'; b.magnet = 'ceil'; b.vx = 0; b.vy = 0;
      resetAir(b, ab); ev.push({ type: 'magnet' });
      return;
    }
  }

  integrate(b, inp, room, ab, dt, ev);
}

function onOneway(b, room) {
  const y = b.y + b.h + 1;
  return !!room.rectHasChar(b.x, y, b.w, 1, (ch) => ch === '=') ||
    room.dynamicSolids.some((d) => d.active && d.oneway && b.x < d.x + d.w && b.x + b.w > d.x && Math.abs(d.y - (b.y + b.h)) < 2);
}

function integrate(b, inp, room, ab, dt, ev) {
  const prevVy = b.vy;
  const hitX = moveX(b, room, b.vx * dt, b.grounded ? 10 : 0);
  if (hitX) b.vx = 0;
  const res = moveY(b, room, b.vy * dt, { dropThrough: b.dropT > 0, cornerCorrect: b.vy < 0 ? 7 : 0 });
  let grounded = false;
  if (res === 'floor') { grounded = true; b.vy = 0; }
  else if (res === 'ceil') { b.vy = Math.max(b.vy, 0); b.jumping = false; }
  b.onSlope = 0;
  if (b.vy >= 0) {
    const reach = b.wasGrounded && !b.jumping ? 14 : 0;
    if (snapSlope(b, room, reach)) {
      grounded = true; b.vy = 0;
      b.onSlope = room.slopeDirAt(b.x + b.w / 2, b.y + b.h + 1);
    }
  }
  // stick to flat ground after leaving a slope while running down
  if (!grounded && b.wasGrounded && b.vy >= 0 && !b.jumping) {
    for (let d = 1; d <= 10; d++) {
      if (room.rectBlocked(b.x, b.y + d, b.w, b.h)) { b.y += d - 1; grounded = true; b.vy = 0; break; }
    }
  }
  b.grounded = grounded;
  if (grounded) {
    b.coyote = PHYS.coyote;
    resetAir(b, ab);
    b.onIce = !!room.rectHasChar(b.x + b.w / 2 - 1, b.y + b.h + 1, 2, 1, isIce);
    if (!b.wasGrounded) ev.push({ type: 'land', vy: prevVy });
  }
}

function stepDash(b, inp, room, ab, dt, ev) {
  b.dashT -= dt;
  b.vy = 0;
  b.vx = b.dashDir * PHYS.dashSpeed;
  if (b.grounded && inp.jumpP) { // dash-jump
    b.mode = 'normal';
    b.vx = b.dashDir * PHYS.runSpeed * 1.25;
    b.vy = -PHYS.jumpVel; b.jumping = true; b.grounded = false; b.jumpBuf = 0;
    ev.push({ type: 'jump' });
    integrate(b, inp, room, ab, dt, ev);
    return;
  }
  const hit = moveX(b, room, b.vx * dt, b.grounded ? 10 : 0);
  // keep grounded state while dashing along floors/slopes
  const wasG = b.grounded;
  if (wasG) {
    if (!snapSlope(b, room, 12)) {
      let ok = false;
      for (let d = 0; d <= 10; d++) if (room.rectBlocked(b.x, b.y + d + 1, b.w, b.h)) { b.y += d; ok = true; break; }
      b.grounded = ok;
    }
  }
  if (hit || b.dashT <= 0) {
    b.mode = 'normal';
    b.vx = hit ? 0 : b.dashDir * PHYS.runSpeed;
  }
}

function stepPound(b, inp, room, ab, dt, ev) {
  b.vx = 0;
  b.vy = PHYS.poundSpeed;
  const res = moveY(b, room, b.vy * dt, {});
  if (res === 'floor' || snapSlope(b, room, 0)) {
    // break cracked floors beneath
    const broke = breakChars(b, room, b.x, b.y + b.h + 1, b.w, 4, 'G', ev);
    if (broke) return; // keep falling through
    b.mode = 'normal'; b.vy = 0; b.grounded = true; b.coyote = PHYS.coyote;
    resetAir(b, ab);
    ev.push({ type: 'pound', x: b.x + b.w / 2, y: b.y + b.h });
  }
}

// Break every tile of char ch overlapping the rect (expanding to connected same-char cells in that row/column block)
function breakChars(b, room, x, y, w, h, ch, ev) {
  const hits = [];
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (room.charAt(tx, ty) === ch) hits.push([tx, ty]);
  if (!hits.length) return false;
  // flood fill connected cells of same char so whole slabs break together
  const seen = new Set();
  const stack = hits.slice();
  while (stack.length) {
    const [tx, ty] = stack.pop();
    const k = tx + ',' + ty;
    if (seen.has(k) || room.charAt(tx, ty) !== ch || !room.inBounds(tx, ty)) continue;
    seen.add(k);
    room.setChar(tx, ty, ' ');
    ev.push({ type: 'break', tx, ty, ch });
    stack.push([tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1]);
  }
  return true;
}

function stepCometCharge(b, inp, room, ab, dt, ev) {
  b.vx = approach(b.vx, 0, PHYS.groundDecel * dt);
  b.vy = 0;
  b.cometT += dt;
  if (inp.jumpP) { b.mode = 'normal'; return; }
  if (!inp.dash) {
    if (b.cometT >= PHYS.cometCharge) {
      b.mode = 'comet';
      if (inp.x && !b.cometWall) b.cometDir = inp.x;
      b.facing = b.cometDir;
      ev.push({ type: 'comet', dir: b.cometDir });
    } else b.mode = 'normal';
    return;
  }
  if (!b.cometWall) {
    if (inp.x) b.cometDir = inp.x;
    moveY(b, room, 1, {});
  }
}

function stepComet(b, inp, room, ab, dt, ev) {
  b.vx = b.cometDir * PHYS.cometSpeed;
  b.vy = 0;
  if (inp.jumpP || inp.dashP) {
    b.mode = 'normal'; b.vx = b.cometDir * PHYS.runSpeed;
    ev.push({ type: 'cometEnd' });
    return;
  }
  const hit = moveX(b, room, b.vx * dt, 0);
  if (hit) {
    const ahead = b.cometDir > 0 ? b.x + b.w + 1 : b.x - 3;
    if (breakChars(b, room, ahead, b.y, 2, b.h, 'C', ev)) return;
    b.mode = 'normal'; b.vx = -b.cometDir * 220; b.vy = -260;
    ev.push({ type: 'cometHit' });
  }
}

function stepHook(b, inp, room, ab, dt, ev) {
  const h = b.hook;
  const tx = h.x - b.w / 2, ty = h.y + 4;
  const dx = tx - b.x, dy = ty - b.y;
  const d = Math.hypot(dx, dy);
  const step = PHYS.hookSpeed * dt;
  if (d <= step) {
    b.x = tx; b.y = ty; b.vx = 0; b.vy = 0; b.mode = 'hang';
    resetAir(b, ab);
    ev.push({ type: 'hang' });
  } else {
    b.x += (dx / d) * step; b.y += (dy / d) * step;
    b.vx = (dx / d) * PHYS.hookSpeed; b.vy = (dy / d) * PHYS.hookSpeed;
  }
}

function stepHang(b, inp, room, ab, dt, ev) {
  b.vx = 0; b.vy = 0;
  if (inp.x) b.facing = inp.x;
  if (inp.jumpP) {
    b.mode = 'normal';
    if (inp.y > 0) { b.vy = 50; return; }
    b.vy = -PHYS.hookJumpVel; b.vx = inp.x * PHYS.runSpeed; b.jumping = true; b.jumpBuf = 0;
    ev.push({ type: 'jump' });
    return;
  }
  if (inp.abilityP) {
    const next = findHook(b, room, b.hook);
    if (next) { b.hook = next; b.mode = 'hook'; ev.push({ type: 'hook', hook: next }); return; }
  }
  if (inp.dashP && ab.dash) {
    b.mode = 'dash'; b.dashT = PHYS.dashTime; b.dashDir = inp.x || b.facing; b.dashCd = PHYS.dashCooldown;
    ev.push({ type: 'dash', dir: b.dashDir });
  }
}

function stepMagnet(b, inp, room, ab, dt, ev) {
  const side = b.magnet;
  const sp = PHYS.magnetSpeed;
  if (inp.jumpP) {
    b.mode = 'normal'; b.magnet = null; b.jumpBuf = 0;
    if (side === 'ceil') { b.vy = 80; b.vx = inp.x * PHYS.runSpeed; }
    else {
      const away = side === 'left' ? 1 : -1;
      b.vx = away * PHYS.wallJumpVX; b.vy = -PHYS.wallJumpVY; b.facing = away;
      b.wallLock = PHYS.wallJumpLock; b.jumping = true;
    }
    ev.push({ type: 'jump' });
    return;
  }
  const stillOn = () => side === 'ceil'
    ? !!room.rectHasChar(b.x + 4, b.y - 2, b.w - 8, 1, isMag)
    : wallHas(b, room, side === 'left' ? -1 : 1, isMag);
  if (side === 'ceil') {
    if (inp.x) b.facing = inp.x;
    const ox = b.x;
    const hit = moveX(b, room, inp.x * sp * dt, 0);
    if (!stillOn()) b.x = ox;
    if (hit && inp.x) {
      // concave corner into a magnetic wall
      if (wallHas(b, room, inp.x, isMag)) b.magnet = inp.x < 0 ? 'left' : 'right';
    }
    if (inp.y > 0) { b.mode = 'normal'; b.magnet = null; b.vy = 60; }
  } else {
    const dir = side === 'left' ? -1 : 1;
    b.facing = -dir;
    const oy = b.y;
    const res = moveY(b, room, inp.y * sp * dt, {});
    if (!stillOn()) b.y = oy;
    if (res === 'ceil' && room.rectHasChar(b.x + 2, b.y - 2, b.w - 4, 1, isMag)) b.magnet = 'ceil';
    if (res === 'floor') { b.mode = 'normal'; b.magnet = null; b.grounded = true; }
    if (inp.x === -dir) { b.mode = 'normal'; b.magnet = null; b.vx = -dir * 120; }
  }
  b.vx = 0; b.vy = 0;
  resetAir(b, ab);
}
