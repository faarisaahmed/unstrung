// Boot: canvas scaling, fixed-timestep loop, scene stack.
import { VIEW_W, VIEW_H, DT } from './core/constants.js';
import { Input } from './core/input.js';
import { App } from './app.js';

const boot = document.getElementById('boot');
if (boot) boot.remove();

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

let scale = 1;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  scale = s * dpr;
  canvas.width = Math.round(VIEW_W * scale);
  canvas.height = Math.round(VIEW_H * scale);
  canvas.style.width = Math.round(VIEW_W * s) + 'px';
  canvas.style.height = Math.round(VIEW_H * s) + 'px';
}
window.addEventListener('resize', resize);
resize();

const input = new Input();
const app = new App(input, canvas);
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
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  app.draw(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
