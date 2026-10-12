// Smooth-follow camera with look-ahead, room clamping and screen shake.
import { VIEW_W, VIEW_H } from '../core/constants.js';
import { clamp, lerp } from '../core/math.js';

export class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.shakeT = 0; this.shakeMag = 0;
    this.ox = 0; this.oy = 0;
    this.look = 0;
    this.lockRect = null; // boss arenas can lock the camera
  }

  snap(target, room) {
    this.x = target.x - VIEW_W / 2;
    this.y = target.y - VIEW_H / 2;
    this.clampTo(room);
  }

  clampTo(room) {
    const r = this.lockRect || { x: 0, y: 0, w: room.pxW, h: room.pxH };
    if (r.w <= VIEW_W) this.x = r.x + (r.w - VIEW_W) / 2;
    else this.x = clamp(this.x, r.x, r.x + r.w - VIEW_W);
    if (r.h <= VIEW_H) this.y = r.y + (r.h - VIEW_H) / 2;
    else this.y = clamp(this.y, r.y, r.y + r.h - VIEW_H);
  }

  follow(target, room, dt, facing, vy, lookY = 0) {
    this.look = lerp(this.look, facing * 70, 1 - Math.exp(-dt * 2.5));
    const tx = target.x + this.look - VIEW_W / 2;
    const fallLead = vy > 500 ? Math.min(140, (vy - 500) * 0.4) : 0;
    const ty = target.y - VIEW_H / 2 + 20 + fallLead + lookY;
    this.x = lerp(this.x, tx, 1 - Math.exp(-dt * 7));
    this.y = lerp(this.y, ty, 1 - Math.exp(-dt * (vy > 500 ? 12 : 6)));
    this.clampTo(room);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const m = this.shakeMag * Math.min(1, this.shakeT * 4);
      this.ox = (Math.random() - 0.5) * 2 * m;
      this.oy = (Math.random() - 0.5) * 2 * m;
    } else { this.ox = 0; this.oy = 0; }
  }

  shake(mag, time) {
    if (mag >= this.shakeMag || this.shakeT <= 0) { this.shakeMag = mag; }
    this.shakeT = Math.max(this.shakeT, time);
  }

  get viewX() { return Math.round(this.x + this.ox); }
  get viewY() { return Math.round(this.y + this.oy); }
}
