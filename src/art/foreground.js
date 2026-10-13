// Foreground silhouettes: dark, soft-focus shapes that slide past in front of the play space with
// strong parallax (roots, leaves, stalactites, grass, pins...). They frame the screen like a painting.
import { VIEW_W, VIEW_H } from '../core/constants.js';
import { rng, hashStr, TAU } from '../core/math.js';
import { mix } from './palettes.js';

const W = 2400, H = VIEW_H;
const cache = new Map();

const KIND = {
  threadcave: 'cave', bells: 'cave', crypt: 'cave', fungal: 'fungal', hive: 'cave', iceshrine: 'ice',
  looms: 'threads', void: 'threads', greenhouse: 'leaves', town: 'grass', clouds: 'grass', moonsky: 'grass',
  dunes: 'grass', pinworks: 'pins', aqueduct: 'cave', furnace: 'cave', prisms: 'ice', library: 'threads', temple: 'threads',
};

export function getForeground(style) {
  const key = style.bg;
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const R = rng(hashStr('fg' + key));
  const col = mix(style.rock, '#000000', 0.45);
  const kind = KIND[key] || 'cave';
  for (const shift of [-W, 0, W]) {
    ctx.save(); ctx.translate(shift, 0);
    const R2 = rng(hashStr('fg' + key));
    paint(ctx, R2, kind, col, style);
    ctx.restore();
  }
  // soft focus: these shapes are closer to the "camera" than anything else
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const o = out.getContext('2d');
  o.filter = 'blur(2.6px)';
  o.drawImage(cv, 0, 0);
  cache.set(key, out);
  return out;
}

export function drawForeground(ctx, fg, camX, camY, roomH) {
  const px = 1.35;
  const ox = -((camX * px) % W);
  // the bottom band sinks away when the camera is high above the room floor
  const below = Math.max(0, Math.min(1, (roomH - (camY + VIEW_H)) / 300));
  ctx.save();
  ctx.globalAlpha = 0.94;
  for (let x = ox - W; x < VIEW_W; x += W) {
    if (x + W < 0) continue;
    ctx.drawImage(fg, 0, 0, W, H * 0.5, x, -Math.min(60, camY * 0.0), W, H * 0.5);           // top band
    ctx.drawImage(fg, 0, H * 0.5, W, H * 0.5, x, H * 0.5 + below * 140, W, H * 0.5);        // bottom band
  }
  ctx.restore();
}

function paint(ctx, R, kind, col, style) {
  ctx.fillStyle = col; ctx.strokeStyle = col;
  const bottom = (x0, n, f) => { for (let i = 0; i < n; i++) f(x0 + R() * W, H); };
  if (kind === 'cave' || kind === 'ice' || kind === 'threads' || kind === 'fungal') {
    // hanging from the top: stalactites / roots / threads
    for (let i = 0; i < 26; i++) {
      const x = R() * W, len = 20 + R() * (R() < 0.15 ? 150 : 60), w = 8 + R() * 30;
      ctx.beginPath(); ctx.moveTo(x - w, -5);
      ctx.quadraticCurveTo(x - w * 0.3, len * 0.6, x + (R() - 0.5) * 10, len);
      ctx.quadraticCurveTo(x + w * 0.3, len * 0.6, x + w, -5); ctx.fill();
    }
    for (let i = 0; i < 18; i++) {
      const x = R() * W, len = 60 + R() * 200;
      ctx.lineWidth = 2 + R() * 3;
      ctx.beginPath(); ctx.moveTo(x, -5);
      ctx.bezierCurveTo(x + 20, len * 0.4, x - 20, len * 0.7, x + (R() - 0.5) * 30, len); ctx.stroke();
      if (kind !== 'threads') { ctx.beginPath(); ctx.arc(x + (R() - 0.5) * 30, len, 3 + R() * 4, 0, TAU); ctx.fill(); }
    }
  }
  // ground band
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H - 18 - Math.sin(x * 0.01) * 10 - Math.sin(x * 0.037) * 8 - (R() < 0.04 ? 30 : 0));
  ctx.lineTo(W, H); ctx.fill();
  if (kind === 'leaves') {
    for (let i = 0; i < 30; i++) {
      const x = R() * W, top = R() < 0.4;
      const y = top ? -10 : H + 10, s = 30 + R() * 70, a = (top ? 1 : -1) * (Math.PI / 2 + (R() - 0.5) * 1.4);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.5, -s * 0.35, s, 0); ctx.quadraticCurveTo(s * 0.5, s * 0.35, 0, 0); ctx.fill();
      ctx.restore();
    }
  }
  if (kind === 'fungal') {
    bottom(0, 9, (x) => { const h = 40 + R() * 90, w = 30 + R() * 60; ctx.fillRect(x - 4, H - h, 8, h); ctx.beginPath(); ctx.ellipse(x, H - h, w, w * 0.35, 0, Math.PI, 0); ctx.fill(); });
  }
  if (kind === 'pins') {
    // chains and hooks from the rafters, dangling needles, and great pins leaning in from below
    for (let i = 0; i < 9; i++) {
      const x = R() * W, len = 60 + R() * 200, s = 14 + R() * 6;
      ctx.lineWidth = 4;
      for (let y = -5; y < len; y += s * 0.9) { ctx.beginPath(); ctx.ellipse(x, y, (y / s) % 2 < 1 ? s * 0.28 : 2, s * 0.55, 0, 0, TAU); ctx.stroke(); }
      if (R() < 0.5) { ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(x + 12, len + 14, 14, Math.PI * 0.95, Math.PI * 0.1, true); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(x - 5, len); ctx.lineTo(x + 5, len); ctx.lineTo(x + 1, len + 110 + R() * 60); ctx.closePath(); ctx.fill(); }
    }
    for (let i = 0; i < 16; i++) {
      const x = R() * W, len = 30 + R() * 90, w = 8 + R() * 26;
      ctx.beginPath(); ctx.moveTo(x - w, -5);
      ctx.quadraticCurveTo(x - w * 0.3, len * 0.6, x + (R() - 0.5) * 10, len);
      ctx.quadraticCurveTo(x + w * 0.3, len * 0.6, x + w, -5); ctx.fill();
    }
    for (let i = 0; i < 6; i++) {
      const x = R() * W, a = 0.25 + (R() - 0.4) * 0.7, len = 90 + R() * 130, w = 7 + R() * 6, hr = 16 + R() * 12;
      ctx.save(); ctx.translate(x, H + 10); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -len); ctx.lineTo(w / 2, -len); ctx.lineTo(w / 2, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -len - hr * 0.8, hr, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  // grass / bristle tufts along the bottom, for every kind
  ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  for (let i = 0; i < 160; i++) {
    const x = R() * W, h = 10 + R() * (R() < 0.1 ? 55 : 26), lean = (R() - 0.5) * 18;
    ctx.beginPath(); ctx.moveTo(x, H - 10); ctx.quadraticCurveTo(x + lean * 0.3, H - h * 0.6, x + lean, H - h - 12); ctx.stroke();
  }
  // a few big corner silhouettes
  for (let i = 0; i < 5; i++) {
    const x = R() * W, r = 50 + R() * 70;
    ctx.beginPath(); ctx.ellipse(x, H + r * 0.35, r, r * 0.8, 0, 0, TAU); ctx.fill();
  }
}
