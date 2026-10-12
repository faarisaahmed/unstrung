// Global constants shared by the game and the offline validator.
export const TILE = 32;
export const VIEW_W = 960;
export const VIEW_H = 540;
export const DT = 1 / 60;

// Player movement tuning (px, px/s, px/s^2, seconds)
export const PHYS = {
  w: 24, h: 24,
  smallW: 12, smallH: 12,
  gravity: 2300,
  maxFall: 950,
  runSpeed: 290,
  groundAccel: 2800,
  groundDecel: 3400,
  airAccel: 2100,
  airDecel: 1300,
  jumpVel: 860,          // ~160px max height -> clears 4 tiles
  jumpCut: 0.42,
  coyote: 0.1,
  jumpBuffer: 0.13,
  wallSlide: 210,
  wallJumpVX: 330,
  wallJumpVY: 820,
  wallJumpLock: 0.14,
  dashSpeed: 760,
  dashTime: 0.17,
  dashCooldown: 0.42,
  doubleJumpVel: 760,
  glideFall: 115,
  updraft: 520,          // upward speed reached in updrafts while gliding
  poundSpeed: 1350,
  cometSpeed: 1100,
  cometCharge: 0.55,
  smallRunSpeed: 210,
  smallJumpVel: 620,
  hookRange: 6.5 * 32,
  hookSpeed: 950,
  hookJumpVel: 820,
  magnetSpeed: 230,
  swimGravity: 600,
  swimMaxFall: 160,
  swimStroke: 430,
  waterRunMul: 0.7,
  slopeBoost: 1.25,      // extra top speed when rolling downhill
  iceAccelMul: 0.18,
  pogoVel: 680,
};

export const ABILITIES = [
  'sap', 'dash', 'shard', 'glide', 'magnet', 'shell', 'pound',
  'comet', 'dbljump', 'shrink', 'hook', 'unravel', 'lantern',
];
