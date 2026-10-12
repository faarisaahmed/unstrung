// Shared UI drawing helpers (panels, ornaments, menus) in the game's inked style.
import { VIEW_W, VIEW_H } from '../core/constants.js';
import { TAU } from '../core/math.js';

export const FONT = 'Georgia, "Times New Roman", serif';
export const C = {
  text: '#efe8d6', dim: 'rgba(220,210,190,0.55)', faint: 'rgba(220,210,190,0.25)',
  gold: '#e8c98a', red: '#c4515a', ink: '#16141c', panel: 'rgba(8,8,13,0.86)',
};

export function dim(ctx, a = 0.7) {
  ctx.fillStyle = `rgba(4,4,8,${a})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

export function text(ctx, str, x, y, size = 18, color = C.text, align = 'left', base = 'middle') {
  ctx.font = `${size}px ${FONT}`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillText(str, x, y);
}

export function spaced(s) { return s.split('').join(String.fromCharCode(8202)); }

export function title(ctx, str, x, y, size = 30) {
  text(ctx, spaced(str.toUpperCase()), x, y, size, C.text, 'center');
  flourish(ctx, x, y + size * 0.8, Math.max(80, str.length * size * 0.32));
}

export function flourish(ctx, x, y, w, color = 'rgba(217,210,192,0.8)') {
  ctx.strokeStyle = color; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.5, y - 6, x - 10, y);
  ctx.moveTo(x + w, y); ctx.quadraticCurveTo(x + w * 0.5, y - 6, x + 10, y);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5, y); ctx.fill();
}

export function panel(ctx, x, y, w, h, a = 0.86) {
  ctx.fillStyle = `rgba(8,8,13,${a})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(220,210,190,0.35)'; ctx.lineWidth = 1;
  ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
  // corner curls
  ctx.strokeStyle = 'rgba(220,210,190,0.6)';
  for (const [cx, cy, sx, sy] of [[x + 4, y + 4, 1, 1], [x + w - 4, y + 4, -1, 1], [x + 4, y + h - 4, 1, -1], [x + w - 4, y + h - 4, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + sy * 16); ctx.quadraticCurveTo(cx, cy, cx + sx * 16, cy);
    ctx.stroke();
  }
}

// Cursor: a tiny Bead
export function cursor(ctx, x, y, t) {
  const bob = Math.sin(t * 6) * 1.5;
  ctx.fillStyle = '#f4eedf'; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x + bob, y, 6, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.ellipse(x + bob + 1.5, y - 0.5, 1.1, 1.8, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + bob - 2, y - 0.5, 1.1, 1.8, 0, 0, TAU); ctx.fill();
}

// Vertical menu. items: [{label, disabled?}] ; returns nothing; selection index in state.sel
export function drawMenu(ctx, items, sel, x, y, t, opts = {}) {
  const gap = opts.gap || 38, size = opts.size || 22;
  items.forEach((it, i) => {
    const yy = y + i * gap;
    const on = i === sel;
    text(ctx, it.label, x, yy, size, it.disabled ? C.faint : on ? '#fff6e0' : C.dim, opts.align || 'center');
    if (on) {
      ctx.font = `${size}px ${FONT}`;
      const w = ctx.measureText(it.label).width;
      const lx = opts.align === 'left' ? x - 22 : x - w / 2 - 26;
      cursor(ctx, lx, yy, t);
    }
  });
}

export function menuInput(input, state, n, sfx) {
  if (input.pressed('down')) { state.sel = (state.sel + 1) % n; sfx && sfx('tick'); }
  if (input.pressed('up')) { state.sel = (state.sel + n - 1) % n; sfx && sfx('tick'); }
}

export function wrapLines(ctx, str, maxW, size = 16) {
  ctx.font = `${size}px ${FONT}`;
  const out = [];
  for (const para of String(str).split('\n')) {
    let cur = '';
    for (const w of para.split(' ')) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && cur) { out.push(cur); cur = w; } else cur = test;
    }
    out.push(cur);
  }
  return out;
}

export function paragraph(ctx, str, x, y, maxW, size = 16, color = C.text, lh = 1.45, align = 'left') {
  const lines = wrapLines(ctx, str, maxW, size);
  lines.forEach((l, i) => text(ctx, l, x, y + i * size * lh, size, color, align, 'top'));
  return lines.length * size * lh;
}
