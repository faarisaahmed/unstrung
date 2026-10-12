// Base entity + simple physics body helpers for enemies/pickups.
import { moveX, moveY, snapSlope } from '../world/movement.js';

export class Entity {
  constructor(game, x, y, w, h) {
    this.game = game;
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.dead = false;
    this.z = 0;
    this.hittable = false;
    this.harmful = false;
    this.grounded = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get room() { return this.game.room; }
  get player() { return this.game.player; }
  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  update(dt) {}
  draw(ctx, t) {}

  // Physics step with gravity + tile collision. Returns {hitX, floor, ceil}
  physics(dt, gravity = 2000, maxFall = 900) {
    if (gravity) this.vy = Math.min(this.vy + gravity * dt, maxFall);
    const wasG = this.grounded;
    const hitX = moveX(this, this.room, this.vx * dt, this.grounded ? 8 : 0);
    if (hitX) this.vx = 0;
    const r = moveY(this, this.room, this.vy * dt, {});
    this.grounded = r === 'floor';
    if (r) this.vy = r === 'ceil' ? Math.max(0, this.vy) : 0;
    if (this.vy >= 0 && snapSlope(this, this.room, wasG ? 10 : 0)) { this.grounded = true; this.vy = 0; }
    return { hitX, floor: r === 'floor', ceil: r === 'ceil' };
  }

  // Free-flying move with collision (no gravity). Returns true if blocked.
  fly(dt) {
    const hx = moveX(this, this.room, this.vx * dt, 0);
    const hy = moveY(this, this.room, this.vy * dt, { dropThrough: true });
    if (hx) this.vx = -this.vx * 0.3;
    if (hy) this.vy = -this.vy * 0.3;
    return hx || !!hy;
  }

  // Is there floor ahead in direction dir? (ledge detection)
  floorAhead(dir, dist = 4) {
    const x = dir > 0 ? this.x + this.w + dist : this.x - dist;
    return this.room.rectBlocked(x - 1, this.y + this.h + 2, 2, 6) ||
      this.room.onewayLanding(x - 1, 2, this.y + this.h, this.y + this.h + 6) !== null ||
      this.room.slopeSurface(x, this.y + this.h - 16, this.y + this.h + 16) !== null;
  }
  wallAhead(dir) {
    const x = dir > 0 ? this.x + this.w : this.x - 2;
    return this.room.rectBlocked(x, this.y + 2, 2, this.h - 6);
  }
  distToPlayer() { return Math.hypot(this.player.cx - this.cx, this.player.cy - this.cy); }
  dirToPlayer() { return this.player.cx < this.cx ? -1 : 1; }
  canSeePlayer(range = 400) {
    const p = this.player;
    if (p.dead) return false;
    const d = this.distToPlayer();
    if (d > range) return false;
    const steps = Math.ceil(d / 16);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = this.cx + (p.cx - this.cx) * t, y = this.cy + (p.cy - this.cy) * t;
      if (this.room.rectBlocked(x - 1, y - 1, 2, 2)) return false;
    }
    return true;
  }
}
