// Boot: canvas scaling, fixed-timestep loop, scene stack, hand-drawn post-process.
import { VIEW_W, VIEW_H, DT } from './core/constants.js';
import { Input } from './core/input.js';
import { App } from './app.js';
import { PostFX } from './core/postfx.js';

const boot = document.getElementById('boot');
if (boot) boot.remove();

// The visible canvas is WebGL (post-process). World + UI are drawn on two offscreen 2D canvases.
const view = document.createElement('canvas');
document.body.appendChild(view);
const world = document.createElement('canvas');
const ui = document.createElement('canvas');
const wctx = world.getContext('2d');
const uctx = ui.getContext('2d');
let post = null;
try { if (!new URLSearchParams(location.search).has('nofx')) post = new PostFX(view); } catch (e) { console.warn('post-process unavailable, drawing plainly', e); }
let plain = post ? null : view.getContext('2d');

let scale = 1;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  // render at device resolution, capped at 1920 px wide to keep uploads cheap
  scale = Math.min(s * dpr, 1920 / VIEW_W);
  const w = Math.round(VIEW_W * scale), h = Math.round(VIEW_H * scale);
  for (const c of [view, world, ui]) { c.width = w; c.height = h; }
  view.style.width = Math.round(VIEW_W * s) + 'px';
  view.style.height = Math.round(VIEW_H * s) + 'px';
}
window.addEventListener('resize', resize);
resize();

const input = new Input();
const app = new App(input, view);
window.__app = app; // debug handle

let last = performance.now();
let acc = 0;
function frame(now) {
  let elapsed = (now - last) / 1000;
  last = now;
  if (elapsed > 0.25) elapsed = 0.25;
  acc += elapsed;
  let steps = 0;
  while (acc >= DT && steps < 5) {
    input.update();
    app.update(DT);
    acc -= DT;
    steps++;
  }
  if (steps >= 5) acc = 0;
  if (post) {
    wctx.setTransform(scale, 0, 0, scale, 0, 0);
    uctx.setTransform(1, 0, 0, 1, 0, 0);
    uctx.clearRect(0, 0, ui.width, ui.height);
    uctx.setTransform(scale, 0, 0, scale, 0, 0);
    app.draw(wctx, uctx);
    post.render(world, ui, elapsed);
  } else {
    plain.setTransform(scale, 0, 0, scale, 0, 0);
    app.draw(plain, plain);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
