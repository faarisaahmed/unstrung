// Enemy AI archetypes. Each: { air?, defaults, init?, update(e,dt,g), onBonk?, hurtbox?, hitboxes?, draw? }
// Telegraph convention: state 'tele' is a readable wind-up before every dangerous move.
import { TILE } from '../core/constants.js';
import { TAU, clamp, sign } from '../core/math.js';
import { Projectile } from './projectile.js';

// ---------- helpers ----------
function patrol(e, dt, speed) {
  if (e.grounded) {
    if (e.wallAhead(e.facing) || (!e.P.noLedge && !e.floorAhead(e.facing, 2))) e.facing = -e.facing;
  }
  e.vx = e.facing * speed;
  e.physics(dt);
}
function face(e) { e.facing = e.dirToPlayer(); }
function sameLevel(e, tol = 70) { return Math.abs(e.player.cy - e.cy) < tol; }
function inFront(e) { return sign(e.player.cx - e.cx) === e.facing; }

export function fire(e, vx, vy, opts = {}) {
  const P = e.P;
  return e.game.add(new Projectile(e.game, opts.x ?? e.cx, opts.y ?? e.cy, vx, vy, Object.assign({
    dmg: 1, life: 4, r: P.projR || 7, color: P.color || '#ff8a7a', art: P.projArt || 'orb', gravity: P.projGravity || 0,
  }, opts)));
}
export function aimAt(e, speed, tx, ty) {
  const dx = tx - e.cx, dy = ty - e.cy, d = Math.hypot(dx, dy) || 1;
  return [dx / d * speed, dy / d * speed];
}
export function lob(e, tx, ty, gravity, speed = 420) {
  const dx = tx - e.cx, dy = ty - e.cy;
  const T = clamp(Math.abs(dx) / speed, 0.55, 1.4);
  return [dx / T, dy / T - 0.5 * gravity * T];
}

// ---------- behaviors ----------
export const BEHAVIORS = {
  crawler: {
    defaults: { speed: 50 },
    update(e, dt) { e.animSpeed = 1; patrol(e, dt, e.P.speed); },
  },

  critter: { // harmless ambient creature; flees
    defaults: { speed: 40 },
    init(e) { e.harmful = false; },
    update(e, dt) {
      const d = e.distToPlayer();
      if (d < 120) { e.facing = -e.dirToPlayer(); patrol(e, dt, e.P.speed * 2.5); }
      else patrol(e, dt, e.t % 4 < 2 ? e.P.speed : 0);
    },
  },

  charger: {
    defaults: { speed: 45, chargeSpeed: 380, sight: 320, tele: 0.45 },
    update(e, dt) {
      const P = e.P;
      switch (e.state) {
        case 'idle':
          patrol(e, dt, P.speed);
          if (e.t > 0.4 && e.grounded && sameLevel(e) && e.canSeePlayer(P.sight)) { face(e); e.setState('tele'); e.vx = 0; }
          break;
        case 'tele':
          e.vx = 0; e.physics(dt); e.animSpeed = 3;
          if (e.t > P.tele) { e.setState('attack'); e.game.sfx('charge'); }
          break;
        case 'attack':
          e.animSpeed = 3;
          e.vx = e.facing * P.chargeSpeed;
          { const r = e.physics(dt);
            if (r.hitX || (!e.floorAhead(e.facing, 2) && e.grounded) || e.t > 1.8) { e.setState('rest'); e.vx = 0; if (r.hitX) e.game.camera.shake(3, 0.15); } }
          break;
        case 'rest':
          e.animSpeed = 0.3; e.vx = 0; e.physics(dt);
          if (e.t > 0.9) e.setState('idle');
          break;
      }
    },
  },

  hopper: {
    defaults: { interval: 1.3, vx: 170, vy: 620, sight: 420 },
    update(e, dt) {
      const P = e.P;
      e.animSpeed = 1;
      if (e.grounded) {
        e.vx *= 0.7;
        if (e.state !== 'tele' && e.t > P.interval - 0.3) { e.setState('tele'); }
        if (e.state === 'tele' && e.t > 0.3) {
          if (e.canSeePlayer(P.sight)) face(e); else if (e.wallAhead(e.facing)) e.facing = -e.facing;
          e.vx = e.facing * P.vx * (0.7 + Math.random() * 0.5);
          e.vy = -P.vy * (0.85 + Math.random() * 0.3);
          e.grounded = false;
          e.setState('air');
        }
      }
      e.physics(dt);
      if (e.state === 'air' && e.grounded) e.setState('idle');
    },
  },

  leaper: {
    defaults: { interval: 1.6, vx: 140, vy: 560, leap: 760, sight: 300 },
    update(e, dt) {
      const P = e.P;
      if (e.grounded) {
        e.vx *= 0.6;
        if (e.state === 'idle' && e.t > P.interval) {
          const near = e.canSeePlayer(P.sight);
          face(e);
          e.setState(near ? 'tele' : 'hop');
        }
        if (e.state === 'hop') { e.vx = e.facing * P.vx; e.vy = -P.vy; e.grounded = false; e.setState('air'); }
        if (e.state === 'tele' && e.t > 0.45) {
          const [vx, vy] = [clamp((e.player.cx - e.cx) * 1.6, -420, 420), -P.leap];
          e.vx = vx; e.vy = vy; e.grounded = false; e.setState('air'); e.game.sfx('leap');
        }
      }
      e.physics(dt);
      if (e.state === 'air' && e.grounded) e.setState('idle');
    },
  },

  flyer: {
    air: true,
    defaults: { speed: 110, accel: 320, sight: 360, bob: 18 },
    update(e, dt) {
      const P = e.P;
      e.animSpeed = 1;
      if (e.canSeePlayer(P.sight) || (e.aggro && e.distToPlayer() < P.sight * 1.5)) {
        e.aggro = true;
        const [tx, ty] = aimAt(e, P.speed, e.player.cx, e.player.cy - 6);
        e.vx += clamp(tx - e.vx, -P.accel * dt, P.accel * dt);
        e.vy += clamp(ty - e.vy, -P.accel * dt, P.accel * dt);
        face(e);
      } else {
        e.vx *= 0.95;
        e.vy = Math.sin(e.anim * 2) * P.bob;
        if (Math.abs(e.x - e.home.x) > 60) e.vx += sign(e.home.x - e.x) * 20;
      }
      e.fly(dt);
    },
  },

  swarm: {
    air: true,
    defaults: { speed: 170, accel: 600, sight: 380 },
    update(e, dt) {
      const P = e.P;
      e.animSpeed = 2;
      e.jit = (e.jit || 0) - dt;
      if (e.jit <= 0) { e.jx = (Math.random() - 0.5) * 160; e.jy = (Math.random() - 0.5) * 120; e.jit = 0.4 + Math.random() * 0.4; }
      const near = e.canSeePlayer(P.sight);
      const tx = (near ? e.player.cx : e.home.x + 16) + e.jx, ty = (near ? e.player.cy : e.home.y + 16) + e.jy;
      const [vx, vy] = aimAt(e, P.speed, tx, ty);
      e.vx += clamp(vx - e.vx, -P.accel * dt, P.accel * dt);
      e.vy += clamp(vy - e.vy, -P.accel * dt, P.accel * dt);
      face(e);
      e.fly(dt);
    },
  },

  swooper: {
    air: true,
    defaults: { speed: 430, sight: 280, range: 220 },
    init(e) { e.flipY = true; },
    update(e, dt) {
      const P = e.P, p = e.player;
      switch (e.state) {
        case 'idle':
          e.flipY = true; e.animSpeed = 0.2;
          e.vx = 0; e.vy = 0;
          if (Math.abs(p.cx - e.cx) < P.range && p.cy > e.cy && e.canSeePlayer(P.sight)) { e.setState('tele'); face(e); e.game.sfx('screech'); }
          break;
        case 'tele':
          e.flipY = false; e.animSpeed = 3;
          if (e.t > 0.35) { e.tgt = { x: p.cx, y: p.cy }; e.org = { x: e.x, y: e.y }; e.setState('attack'); }
          break;
        case 'attack': {
          const k = e.t / 0.9;
          if (k >= 1) { e.setState('return'); break; }
          const ex = e.tgt.x + (e.tgt.x - e.org.x - e.w / 2) * 0.8;
          const bx = e.org.x + (ex - e.org.x) * k;
          const by = e.org.y + Math.sin(k * Math.PI) * (e.tgt.y - e.org.y + 20);
          e.x = bx; e.y = by;
          break;
        }
        case 'return': {
          const [vx, vy] = aimAt(e, 160, e.home.x + e.w / 2, e.home.y + e.h / 2);
          e.x += vx * dt; e.y += vy * dt;
          if (Math.hypot(e.x - e.home.x, e.y - e.home.y) < 6) { e.x = e.home.x; e.y = e.home.y; e.setState('idle'); }
          break;
        }
      }
    },
  },

  shooter: {
    defaults: { interval: 2.2, speed: 260, count: 1, spread: 0.25, sight: 460, tele: 0.45, arc: false, gravity: 900 },
    update(e, dt) {
      const P = e.P;
      e.physics(dt);
      if (e.state === 'idle') {
        e.animSpeed = 0.5;
        if (e.t > P.interval && e.canSeePlayer(P.sight)) { face(e); e.setState('tele'); }
      } else if (e.state === 'tele') {
        e.animSpeed = 3;
        if (e.t > P.tele) {
          e.game.sfx('spit');
          const p = e.player;
          for (let i = 0; i < P.count; i++) {
            const off = (i - (P.count - 1) / 2) * P.spread;
            if (P.arc) {
              const [vx, vy] = lob(e, p.cx + off * 200, p.cy, P.gravity, P.speed);
              fire(e, vx, vy, { gravity: P.gravity, y: e.y + 4 });
            } else {
              const a = Math.atan2(p.cy - e.cy, p.cx - e.cx) + off;
              fire(e, Math.cos(a) * P.speed, Math.sin(a) * P.speed);
            }
          }
          e.setState('idle');
        }
      }
    },
  },

  flyshooter: {
    air: true,
    defaults: { speed: 100, keep: 210, interval: 2.4, projSpeed: 250, sight: 420, count: 1, spread: 0.3 },
    update(e, dt) {
      const P = e.P, p = e.player;
      const d = e.distToPlayer();
      const see = e.canSeePlayer(P.sight);
      if (see || e.aggro) {
        e.aggro = true;
        const want = d > P.keep + 30 ? 1 : d < P.keep - 30 ? -1 : 0;
        const [vx, vy] = aimAt(e, P.speed * want, p.cx, p.cy - 80);
        e.vx += (vx - e.vx) * Math.min(1, dt * 3);
        e.vy += (vy + Math.sin(e.anim * 3) * 30 - e.vy) * Math.min(1, dt * 3);
        face(e);
      } else { e.vx *= 0.95; e.vy = Math.sin(e.anim * 2) * 15; }
      e.fly(dt);
      if (e.state === 'idle' && e.t > P.interval && see) e.setState('tele');
      if (e.state === 'tele' && e.t > 0.4) {
        e.game.sfx('spit');
        for (let i = 0; i < P.count; i++) {
          const a = Math.atan2(p.cy - e.cy, p.cx - e.cx) + (i - (P.count - 1) / 2) * P.spread;
          fire(e, Math.cos(a) * P.projSpeed, Math.sin(a) * P.projSpeed);
        }
        e.setState('idle');
      }
    },
  },

  wallcrawler: {
    defaults: { speed: 55 },
    init(e) {
      e.nx = 0; e.ny = -1; e.cw = Math.random() < 0.5 ? 1 : -1; e.noGravity = true;
      e.facing = e.cw;
    },
    update(e, dt) {
      const room = e.room;
      const tx = -e.ny * e.cw, ty = e.nx * e.cw; // tangent
      const step = e.P.speed * dt;
      const blocked = (x, y) => room.rectBlocked(x - 1, y - 1, 2, 2);
      const cx = e.cx, cy = e.cy, hw = e.w / 2;
      // concave corner ahead
      if (blocked(cx + tx * (hw + 2), cy + ty * (hw + 2))) {
        const onx = e.nx, ony = e.ny;
        e.nx = -tx; e.ny = -ty;
        void onx; void ony;
      } else {
        e.x += tx * step; e.y += ty * step;
        // convex: no support behind
        const sx = e.cx - e.nx * (hw + 3), sy = e.cy - e.ny * (hw + 3);
        const sx2 = sx - tx * (hw - 2), sy2 = sy - ty * (hw - 2);
        if (!blocked(sx, sy) && !blocked(sx2, sy2)) {
          // wrap around the corner
          e.x += -e.nx * (hw + 1) + tx * 2; e.y += -e.ny * (hw + 1) + ty * 2;
          const nnx = tx, nny = ty;
          e.nx = -nnx; e.ny = -nny;
          // normal now points back along old tangent; flip to point away from new surface
          e.nx = tx; e.ny = ty;
          // reposition flush: move against new surface
          for (let i = 0; i < 20 && !blocked(e.cx - e.nx * (hw + 1), e.cy - e.ny * (hw + 1)); i++) { e.x -= e.nx; e.y -= e.ny; }
        }
      }
      e.rot = Math.atan2(e.ny, e.nx) + Math.PI / 2;
      e.facing = e.cw;
      e.animSpeed = 1;
    },
  },

  burrower: {
    defaults: { sight: 230, speed: 140, up: 1.2 },
    init(e) { e.hidden = true; e.hittable = false; e.harmful = false; e.emerge = 0; },
    update(e, dt) {
      const P = e.P, p = e.player;
      switch (e.state) {
        case 'idle':
          e.hidden = true; e.hittable = false; e.harmful = false;
          if (Math.abs(p.cx - e.cx) < P.sight && Math.abs(p.cy - e.cy) < 120 && e.t > 0.8) {
            e.vx = sign(p.cx - e.cx) * P.speed;
            if (Math.abs(p.cx - e.cx) < 20 || e.t > 2.5) { e.setState('tele'); e.vx = 0; }
          } else e.vx = 0;
          if (e.vx && (e.wallAhead(sign(e.vx)) || !e.floorAhead(sign(e.vx), 2))) e.vx = 0;
          e.physics(dt);
          if (e.vx && Math.random() < 0.3) e.game.fx.add({ x: e.cx, y: e.y + e.h, vx: (Math.random() - 0.5) * 60, vy: -80, life: 0.4, size: 2, color: e.game.style.rim, g: 500 });
          break;
        case 'tele':
          if (Math.random() < 0.6) e.game.fx.add({ x: e.cx + (Math.random() - 0.5) * e.w, y: e.y + e.h, vx: (Math.random() - 0.5) * 80, vy: -160, life: 0.4, size: 2.5, color: e.game.style.rim, g: 600 });
          if (e.t > 0.5) { e.setState('attack'); e.game.sfx('burst'); }
          break;
        case 'attack':
          e.hidden = false; e.hittable = true; e.harmful = true;
          e.emerge = Math.min(1, e.t / 0.15);
          face(e);
          if (e.t > P.up) e.setState('down');
          break;
        case 'down':
          e.emerge = Math.max(0, 1 - e.t / 0.25);
          if (e.t > 0.25) e.setState('idle');
          break;
      }
    },
    hurtbox(e) { return { x: e.x, y: e.y + e.h * (1 - (e.emerge || 0)) - e.h * 0.8 * (e.emerge || 0), w: e.w, h: e.h * (1 + 0.8 * (e.emerge || 0)) }; },
    hitboxes(e) { return [{ x: e.x + 4, y: e.y - e.h * 0.8 * (e.emerge || 0), w: e.w - 8, h: e.h * (1 + 0.8 * (e.emerge || 0)) }]; },
  },

  dropper: {
    defaults: { range: 50, speed: 50 },
    init(e) { e.flipY = true; e.y = e.y - (TILE - e.h); /* hang from ceiling */ e.noGrav = true; },
    update(e, dt) {
      if (e.state === 'idle') {
        e.animSpeed = 0.3;
        if (Math.abs(e.player.cx - e.cx) < e.P.range && e.player.cy > e.cy && e.canSeePlayer(400)) { e.setState('tele'); }
      } else if (e.state === 'tele') {
        e.x += Math.sin(e.t * 60) * 0.8;
        if (e.t > 0.3) { e.setState('fall'); e.flipY = false; e.game.sfx('drop'); }
      } else if (e.state === 'fall') {
        e.physics(dt);
        if (e.grounded) { e.setState('walk'); face(e); e.game.camera.shake(2, 0.1); }
      } else {
        e.animSpeed = 1;
        patrol(e, dt, e.P.speed);
      }
    },
  },

  guard: {
    defaults: { speed: 55, sight: 230, lunge: 280, reach: 46, tele: 0.42, shield: false },
    update(e, dt) {
      const P = e.P;
      e.extraHit = null;
      switch (e.state) {
        case 'idle':
          e.animSpeed = 1;
          if (e.canSeePlayer(P.sight) && sameLevel(e, 80)) {
            face(e);
            const d = Math.abs(e.player.cx - e.cx);
            if (d < P.reach + 60) { e.setState('tele'); e.vx = 0; }
            else { if (e.wallAhead(e.facing) || !e.floorAhead(e.facing, 2)) e.vx = 0; else e.vx = e.facing * P.speed * 1.6; }
            e.physics(dt);
          } else patrol(e, dt, P.speed);
          break;
        case 'tele':
          e.vx = 0; e.physics(dt); e.animSpeed = 0;
          if (e.t > P.tele) { e.setState('attack'); e.game.sfx('slash'); }
          break;
        case 'attack':
          e.vx = e.t < 0.15 && e.floorAhead(e.facing, 2) ? e.facing * P.lunge : 0;
          e.physics(dt);
          e.extraHit = e.facing > 0 ? { x: e.x + e.w - 4, y: e.y + 2, w: P.reach, h: e.h - 6 } : { x: e.x - P.reach + 4, y: e.y + 2, w: P.reach, h: e.h - 6 };
          if (e.t < 0.05) e.game.fx.slash(e.cx + e.facing * (e.w / 2 + P.reach / 2), e.cy, e.facing > 0 ? 0 : Math.PI, P.reach * 1.3, 'rgba(255,230,220,0.8)', 0.15);
          if (e.t > 0.3) e.setState('rest');
          break;
        case 'rest':
          e.vx = 0; e.physics(dt);
          if (e.t > 0.6) e.setState('idle');
          break;
      }
    },
    onBonk(e, dmg, dir, p) {
      if (e.P.shield && e.state !== 'attack' && e.state !== 'rest' && sign(p.cx - e.cx) === e.facing && p.attackDir === 'side') {
        e.game.sfx('clink');
        e.game.fx.burst(e.cx + e.facing * e.w / 2, e.cy, 6, { color: '#fff', speed: 200, size: 2, life: 0.2 });
        p.b.vx = -p.b.facing * 260;
        return false;
      }
    },
  },

  lancer: {
    defaults: { speed: 40, sight: 260, reach: 110, tele: 0.55 },
    update(e, dt) {
      const P = e.P;
      e.extraHit = null;
      if (e.state === 'idle') {
        patrol(e, dt, P.speed);
        if (e.canSeePlayer(P.sight) && sameLevel(e, 50) && Math.abs(e.player.cx - e.cx) < P.reach + 40) { face(e); e.setState('tele'); }
      } else if (e.state === 'tele') {
        e.vx = 0; e.physics(dt);
        if (e.t > P.tele) { e.setState('attack'); e.game.sfx('thrust'); }
      } else if (e.state === 'attack') {
        const k = Math.min(1, e.t / 0.08);
        const L = P.reach * k;
        e.extraHit = e.facing > 0 ? { x: e.x + e.w, y: e.cy - 5, w: L, h: 10 } : { x: e.x - L, y: e.cy - 5, w: L, h: 10 };
        if (e.t > 0.35) e.setState('rest');
      } else { if (e.t > 0.7) e.setState('idle'); }
    },
    draw(ctx, e) {
      if (e.extraHit) {
        const h = e.extraHit;
        ctx.strokeStyle = '#16141c'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(e.cx, e.cy); ctx.lineTo(e.facing > 0 ? h.x + h.w : h.x, e.cy); ctx.stroke();
        ctx.strokeStyle = e.art.c2 || '#e8e0cc'; ctx.lineWidth = 2; ctx.stroke();
      }
    },
  },

  bomber: {
    air: true,
    defaults: { speed: 110, interval: 2.2, height: 150, sight: 420 },
    update(e, dt) {
      const P = e.P, p = e.player;
      if (e.canSeePlayer(P.sight) || e.aggro) {
        e.aggro = true;
        const tx = p.cx + Math.sin(e.anim) * 60, ty = p.cy - P.height;
        const [vx, vy] = aimAt(e, P.speed, tx, ty);
        e.vx += (vx - e.vx) * Math.min(1, dt * 2); e.vy += (vy - e.vy) * Math.min(1, dt * 2);
        face(e);
        if (e.t > P.interval && Math.abs(p.cx - e.cx) < 80) {
          e.setState('idle');
          e.game.sfx('drop');
          fire(e, e.vx * 0.3, 60, { gravity: 900, art: 'glob', r: 8, life: 3, onDie: (pr) => explode(e.game, pr.cx, pr.cy, 50) });
        }
      } else { e.vx *= 0.95; e.vy = Math.sin(e.anim * 2) * 15; }
      e.fly(dt);
    },
  },

  exploder: {
    defaults: { speed: 50, rush: 230, sight: 260, fuse: 0.7, radius: 64 },
    update(e, dt) {
      const P = e.P;
      if (e.state === 'idle') {
        patrol(e, dt, P.speed);
        if (e.canSeePlayer(P.sight)) e.setState('rush');
      } else if (e.state === 'rush') {
        face(e); e.animSpeed = 3;
        e.vx = e.facing * P.rush; e.physics(dt);
        if (e.distToPlayer() < 50 || e.t > 3) e.setState('tele');
      } else if (e.state === 'tele') {
        e.vx *= 0.8; e.physics(dt);
        e.flashT = Math.sin(e.t * 40) > 0 ? 0.05 : 0;
        if (e.t > P.fuse) { explode(e.game, e.cx, e.cy, P.radius); e.die(0); }
      }
    },
  },

  spawner: {
    defaults: { interval: 4, max: 3, child: null, sight: 500 },
    update(e, dt, g) {
      const P = e.P;
      e.physics(dt);
      e.kids = (e.kids || []).filter((k) => !k.dead);
      if (e.state === 'idle' && e.t > P.interval && e.kids.length < P.max && e.canSeePlayer(P.sight)) e.setState('tele');
      if (e.state === 'tele' && e.t > 0.6) {
        e.setState('idle');
        const def = g.app.enemyDefs[P.child];
        if (def) {
          const k = g.add(new e.constructor(g, Math.floor(e.cx / TILE), Math.floor((e.y - 4) / TILE), def, {}));
          k.def = Object.assign({}, def, { glints: 0 });
          e.kids.push(k);
          g.fx.ring(e.cx, e.cy, 6, 30, 0.3, '#fff', 2);
        }
      }
    },
  },

  spinner: {
    defaults: { rate: 1.6, speed: 190, arms: 4, interval: 0.3, sight: 500 },
    update(e, dt) {
      const P = e.P;
      e.physics(dt);
      e.ang = (e.ang || 0) + P.rate * dt;
      e.animSpeed = 2;
      if (e.t > P.interval && e.canSeePlayer(P.sight)) {
        e.t = 0;
        for (let i = 0; i < P.arms; i++) {
          const a = e.ang + (i / P.arms) * TAU;
          fire(e, Math.cos(a) * P.speed, Math.sin(a) * P.speed, { life: 2.5 });
        }
      }
    },
  },

  orbiter: {
    air: true,
    defaults: { radius: 64, speed: 2.2 },
    init(e) { e.ang = Math.random() * TAU; },
    update(e, dt) {
      e.ang += e.P.speed * dt;
      e.x = e.home.x + Math.cos(e.ang) * e.P.radius;
      e.y = e.home.y + Math.sin(e.ang) * e.P.radius;
      e.facing = Math.cos(e.ang + Math.PI / 2) > 0 ? 1 : -1;
      e.animSpeed = 2;
    },
  },

  phaser: {
    air: true,
    defaults: { interval: 2.4, dash: 420, sight: 420 },
    init(e) { e.alpha = 1; },
    update(e, dt) {
      const P = e.P, p = e.player;
      switch (e.state) {
        case 'idle':
          e.alpha = 1; e.hittable = true; e.harmful = true;
          e.vx *= 0.9; e.vy = Math.sin(e.anim * 2) * 20; e.fly(dt);
          if (e.t > P.interval && e.canSeePlayer(P.sight)) { e.setState('fade'); e.game.sfx('phase'); }
          break;
        case 'fade':
          e.alpha = Math.max(0, 1 - e.t / 0.3); e.hittable = false; e.harmful = false;
          if (e.t > 0.4) {
            const side = Math.random() < 0.5 ? -1 : 1;
            e.x = clamp(p.cx + side * 140 - e.w / 2, 0, e.room.pxW - e.w);
            e.y = clamp(p.cy - 60 - e.h / 2, 0, e.room.pxH - e.h);
            if (e.room.rectBlocked(e.x, e.y, e.w, e.h)) { e.x = e.home.x; e.y = e.home.y; }
            e.setState('appear');
          }
          break;
        case 'appear':
          e.alpha = Math.min(1, e.t / 0.4); face(e);
          if (e.t > 0.5) { const [vx, vy] = aimAt(e, P.dash, p.cx, p.cy); e.vx = vx; e.vy = vy; e.setState('attack'); e.hittable = true; e.harmful = true; }
          break;
        case 'attack':
          e.fly(dt);
          if (e.t > 0.5) e.setState('idle');
          break;
      }
    },
  },

  mimic: {
    defaults: { wake: 90, vx: 200, vy: 560 },
    init(e) { e.harmful = false; e.dormant = true; e.animSpeed = 0; },
    update(e, dt) {
      if (e.dormant) {
        e.physics(dt);
        if (e.distToPlayer() < e.P.wake) { e.dormant = false; e.setState('tele'); e.game.sfx('screech'); }
        return;
      }
      e.harmful = true; e.animSpeed = 2;
      if (e.state === 'tele') { if (e.t > 0.35) e.setState('idle'); e.physics(dt); return; }
      BEHAVIORS.hopper.update(e, dt);
    },
  },

  swimmer: {
    air: true,
    defaults: { speed: 90, lunge: 360, sight: 260 },
    update(e, dt) {
      const P = e.P, room = e.room;
      const inLiquid = (x, y) => { const c = room.charAtPx(x, y); return c === '~' || c === '!'; };
      if (e.state === 'idle') {
        e.vx = e.facing * P.speed; e.vy = Math.sin(e.anim * 2) * 30;
        if (!inLiquid(e.cx + e.facing * (e.w / 2 + 6), e.cy) || e.wallAhead(e.facing)) e.facing = -e.facing;
        const p = e.player;
        if (e.canSeePlayer(P.sight) && inLiquid(p.cx, p.cy) && e.t > 1) { e.setState('tele'); face(e); }
      } else if (e.state === 'tele') {
        e.vx *= 0.8; e.vy *= 0.8;
        if (e.t > 0.4) { const [vx, vy] = aimAt(e, P.lunge, e.player.cx, e.player.cy); e.vx = vx; e.vy = vy; e.setState('attack'); }
      } else if (e.state === 'attack') {
        if (e.t > 0.6) e.setState('idle');
      }
      const ox = e.x, oy = e.y;
      e.fly(dt);
      if (!inLiquid(e.cx, e.cy)) { e.x = ox; e.y = oy; e.vy = -e.vy; e.vx = -e.vx; e.facing = sign(e.vx) || -e.facing; }
      e.animSpeed = e.state === 'attack' ? 3 : 1;
    },
  },

  roller: {
    defaults: { speed: 210, hop: 520, sight: 350 },
    update(e, dt) {
      const P = e.P;
      if (e.canSeePlayer(P.sight)) face(e);
      e.vx += (e.facing * P.speed - e.vx) * Math.min(1, dt * 2.5);
      const r = e.physics(dt);
      if (r.hitX) { e.facing = -e.facing; e.vx = e.facing * P.speed * 0.6; e.game.sfx('bonkWall', 0.3); }
      e.roll = (e.roll || 0) + (e.vx * dt) / (e.w / 2);
      if (e.grounded && e.t > 1.5 && e.player.cy < e.cy - 40 && Math.abs(e.player.cx - e.cx) < 150) { e.vy = -P.hop; e.t = 0; }
    },
  },

  sentinel: {
    defaults: { open: 1.8, closed: 2.4, speed: 230, count: 3, spread: 0.35, sight: 480 },
    update(e, dt) {
      const P = e.P;
      e.physics(dt);
      if (e.state === 'idle') { // closed
        e.shut = true; e.animSpeed = 0;
        if (e.t > P.closed && e.canSeePlayer(P.sight)) e.setState('tele');
      } else if (e.state === 'tele') {
        e.shut = false; e.animSpeed = 2;
        if (e.t > 0.4) {
          face(e);
          for (let i = 0; i < P.count; i++) {
            const a = Math.atan2(e.player.cy - e.cy, e.player.cx - e.cx) + (i - (P.count - 1) / 2) * P.spread;
            fire(e, Math.cos(a) * P.speed, Math.sin(a) * P.speed);
          }
          e.setState('open');
        }
      } else if (e.state === 'open') {
        if (e.t > P.open) e.setState('idle');
      }
    },
    onBonk(e, dmg, dir, p) {
      if (e.shut) { e.game.sfx('clink'); e.game.fx.burst(e.cx, e.cy, 5, { color: '#fff', speed: 160, size: 2, life: 0.2 }); return false; }
    },
    onHurt(e, dmg, dir, src) { if (e.shut && src !== 'pound') return false; },
    draw(ctx, e) {
      if (e.shut) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.cx, e.cy, Math.max(e.w, e.h) * 0.6, 0, TAU); ctx.stroke();
      }
    },
  },

  lasher: {
    defaults: { range: 120, tele: 0.5 },
    update(e, dt) {
      const P = e.P;
      e.extraHit = null;
      e.physics(dt);
      if (e.state === 'idle') {
        e.animSpeed = 1;
        if (e.distToPlayer() < P.range && e.t > 0.6) { face(e); e.setState('tele'); e.game.sfx('rustle'); }
      } else if (e.state === 'tele') {
        if (e.t > P.tele) { e.setState('attack'); e.lashA = Math.atan2(e.player.cy - (e.y + 6), e.player.cx - e.cx); e.game.sfx('whip'); }
      } else if (e.state === 'attack') {
        const L = P.range * Math.min(1, e.t / 0.1);
        const x2 = e.cx + Math.cos(e.lashA) * L, y2 = e.y + 6 + Math.sin(e.lashA) * L;
        e.lashEnd = { x: x2, y: y2 };
        e.extraHit = { x: Math.min(e.cx, x2) - 6, y: Math.min(e.y, y2) - 6, w: Math.abs(x2 - e.cx) + 12, h: Math.abs(y2 - e.y) + 12 };
        // narrow the hitbox to the lash line by sampling: approximate with tip box
        e.extraHit = { x: x2 - 14, y: y2 - 14, w: 28, h: 28 };
        if (e.t > 0.35) e.setState('rest');
      } else if (e.t > 0.8) e.setState('idle');
    },
    draw(ctx, e) {
      if (e.state === 'attack' && e.lashEnd) {
        ctx.strokeStyle = '#16141c'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(e.cx, e.y + 6);
        ctx.quadraticCurveTo((e.cx + e.lashEnd.x) / 2, e.y - 20, e.lashEnd.x, e.lashEnd.y); ctx.stroke();
        ctx.strokeStyle = e.art.c3 || '#4a7a3a'; ctx.lineWidth = 3; ctx.stroke();
      }
    },
  },

  thrower: {
    defaults: { interval: 2.3, speed: 400, gravity: 1000, sight: 480, count: 1 },
    update(e, dt) {
      const P = e.P;
      patrol(e, dt, e.state === 'idle' ? 30 : 0);
      if (e.state === 'idle' && e.t > P.interval && e.canSeePlayer(P.sight)) { face(e); e.setState('tele'); }
      if (e.state === 'tele' && e.t > 0.45) {
        e.game.sfx('throw');
        for (let i = 0; i < P.count; i++) {
          const [vx, vy] = lob(e, e.player.cx + (i - (P.count - 1) / 2) * 50, e.player.cy, P.gravity, P.speed);
          fire(e, vx, vy, { gravity: P.gravity, art: P.projArt || 'glob', r: 7 });
        }
        e.setState('idle');
      }
    },
  },

  stalker: {
    defaults: { speed: 150, jump: 720, sight: 380 },
    update(e, dt) {
      const P = e.P, p = e.player;
      if (e.canSeePlayer(P.sight) || (e.aggro && e.distToPlayer() < P.sight * 1.3)) {
        e.aggro = true;
        face(e);
        e.vx += (e.facing * P.speed - e.vx) * Math.min(1, dt * 6);
        if (e.grounded && (e.wallAhead(e.facing) || (p.cy < e.cy - 50 && Math.abs(p.cx - e.cx) < 140) || !e.floorAhead(e.facing, 2)) && e.t > 0.5) {
          e.vy = -P.jump; e.t = 0; e.grounded = false;
        }
        e.physics(dt);
        e.animSpeed = 2;
      } else { patrol(e, dt, P.speed * 0.3); e.animSpeed = 0.6; }
    },
  },

  dasher: {
    air: true,
    defaults: { speed: 520, interval: 2.0, sight: 420 },
    update(e, dt) {
      const P = e.P;
      if (e.state === 'idle') {
        e.vx *= 0.92; e.vy = e.vy * 0.92 + Math.sin(e.anim * 3) * 6;
        e.fly(dt);
        if (e.t > P.interval && e.canSeePlayer(P.sight)) { face(e); e.setState('tele'); e.game.sfx('buzz'); }
      } else if (e.state === 'tele') {
        e.animSpeed = 4;
        e.x += Math.sin(e.t * 70) * 1.2;
        if (e.t > 0.5) { const [vx, vy] = aimAt(e, P.speed, e.player.cx, e.player.cy); e.vx = vx; e.vy = vy; e.setState('attack'); }
      } else if (e.state === 'attack') {
        if (e.fly(dt) || e.t > 0.45) { e.setState('idle'); e.animSpeed = 1; }
      }
    },
  },

  // stationary hazard creature: invulnerable, harmful (e.g., thorn bulbs, spinning blades)
  hazard: {
    air: true,
    defaults: {},
    init(e) { e.hittable = false; },
    update(e, dt) { e.animSpeed = 1; },
  },
};

export function explode(g, x, y, r) {
  g.sfx('explode');
  g.camera.shake(6, 0.25);
  g.fx.burst(x, y, 18, { color: '#ffb070', speed: 320, size: 4, life: 0.5, glow: true });
  g.fx.ring(x, y, 8, r, 0.3, 'rgba(255,220,180,0.9)', 5);
  g.add(new Projectile(g, x, y, 0, 0, { dmg: 1, life: 0.15, r: 0, box: { w: r * 2, h: r * 2, oy: -r }, art: 'none' }));
}
