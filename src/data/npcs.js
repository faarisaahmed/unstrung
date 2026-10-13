// NPC definitions: look, voice, dialogue (progress-aware), and services (shops, polish, techniques).
// Canon and character arcs: docs/LORE.md.
//
// def: { name, verb, voice (0..5 blip pitch), size:[w,h], art (painter) | draw(ctx,npc,t), hideIf(save), talk(g,npc) }
// talk returns string[] or { pages, opts: { choices:[{label, fn}], onEnd } }.
import { grantItem } from './items.js';
import { INK, eye, PAINTERS } from '../art/creatures.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- helpers
const beat = (s, id) => !!s.flags['boss_' + id];
const has = (s, ab) => !!s.abilities[ab];
const ended = (s) => !!(s.endings.A || s.endings.B || s.endings.C);
const pick = (arr, salt = 0) => arr[(Math.floor(Date.now() / 7000) + salt) % arr.length];

// first meeting: returns true once, and records it
function first(g, key) {
  if (g.save.flags['met_' + key]) return false;
  g.save.flags['met_' + key] = 1;
  return true;
}

// Continue a conversation: the NPC's next talk() returns `res` (used by choice callbacks)
function next(npc, res) { npc._next = res; npc.interact(); }

// Spend glints; false if short
function pay(g, n) {
  if (g.save.glints < n) { g.sfx('deny'); return false; }
  g.save.glints -= n;
  g.sfx('buy');
  return true;
}

function banner(g, title, desc) { g.message = { title, desc, t: 0, dur: 4.5, lock: true }; }

function ink(ctx, lw = 2) { ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }
function fillInk(ctx, fill, lw = 2) { ctx.fillStyle = fill; ctx.fill(); ink(ctx, lw); ctx.stroke(); }
function glow(ctx, x, y, r, color, a = 0.35) {
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
}
// Bead-style eye: black oval with a white glint
function beadEye(ctx, x, y, r) {
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, y, r * 0.8, r, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + r * 0.25, y - r * 0.35, r * 0.28, 0, TAU); ctx.fill();
}
// Draw in the NPC's local frame: origin at floor-center, +x = facing
function local(ctx, npc, fn) {
  ctx.save(); ctx.translate(Math.round(npc.cx), Math.round(npc.y + npc.h)); ctx.scale(npc.facing || 1, 1);
  fn(npc.w, npc.h); ctx.restore();
}
// Reuse a creature painter, lifted off the floor (for centered flyers), plus optional extra drawing
function paint(body, art, lift = 0, extra) {
  return (ctx, npc, t) => local(ctx, npc, (w, h) => {
    ctx.save(); ctx.translate(0, -lift);
    if (art.scale) ctx.scale(art.scale, art.scale);
    PAINTERS[body](ctx, npc, t, art);
    ctx.restore();
    if (extra) extra(ctx, npc, t, w, h);
  });
}

// ---------------------------------------------------------------- custom bodies
function drawBobbin(ctx, npc, t) {
  local(ctx, npc, (w, h) => {
    const b = Math.sin(t * 2) * 1;
    ink(ctx, 2.5);
    ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(-9, 0); ctx.moveTo(8, -8); ctx.lineTo(9, 0); ctx.stroke();
    // spool body
    ctx.beginPath(); ctx.roundRect(-21, -15, 42, 8, 3); fillInk(ctx, '#6a4a30');
    ctx.beginPath(); ctx.rect(-16, -42 + b, 32, 28 - b); fillInk(ctx, '#a83a4c');
    ctx.strokeStyle = 'rgba(40,10,20,0.35)'; ctx.lineWidth = 1;
    for (let y = -40 + b; y < -15; y += 3) { ctx.beginPath(); ctx.moveTo(-16, y); ctx.lineTo(16, y + 1.5); ctx.stroke(); }
    ctx.beginPath(); ctx.roundRect(-21, -49 + b, 42, 8, 3); fillInk(ctx, '#6a4a30');
    // apron
    ctx.beginPath(); ctx.moveTo(-9, -40 + b); ctx.lineTo(9, -40 + b); ctx.lineTo(11, -18); ctx.lineTo(-11, -18); ctx.closePath(); fillInk(ctx, '#e8dcc0', 1.5);
    ctx.fillStyle = '#c8b898'; ctx.fillRect(-6, -30 + b, 12, 5);
    // arms + tape measure
    ink(ctx, 2);
    ctx.beginPath(); ctx.moveTo(15, -35 + b); ctx.quadraticCurveTo(24, -28, 20, -22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-15, -35 + b); ctx.quadraticCurveTo(-23, -30, -20, -24); ctx.stroke();
    ctx.strokeStyle = '#e8c860'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(20, -22); ctx.bezierCurveTo(26, -14, 18, -10, 24, -2 + Math.sin(t * 3) * 1.5); ctx.stroke();
    // head
    const hy = -58 + b;
    ctx.beginPath(); ctx.arc(0, hy, 10, 0, TAU); fillInk(ctx, '#efe3c8');
    ctx.beginPath(); ctx.arc(-5, hy - 10, 6, 0, TAU); fillInk(ctx, '#cfc6b8');
    ink(ctx, 1.5);
    ctx.beginPath(); ctx.moveTo(-14, hy - 16); ctx.lineTo(3, hy - 5); ctx.moveTo(-12, hy - 4); ctx.lineTo(1, hy - 17); ctx.stroke();
    ctx.fillStyle = '#d9d0ff'; ctx.beginPath(); ctx.arc(3, hy - 5, 1.6, 0, TAU); ctx.fill();
    beadEye(ctx, 2, hy, 2.6); beadEye(ctx, 7.5, hy, 2.6);
    ink(ctx, 1); ctx.beginPath(); ctx.arc(2, hy, 4, 0, TAU); ctx.moveTo(11.5, hy); ctx.arc(7.5, hy, 4, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(230,120,120,0.45)'; ctx.beginPath(); ctx.arc(-3, hy + 4, 2.5, 0, TAU); ctx.fill();
  });
}

function drawTinsmith(ctx, npc, t) {
  local(ctx, npc, () => {
    const strike = Math.max(0, Math.sin(t * 2.2)) ** 6;
    ink(ctx, 2.2);
    for (const x of [-14, -4, 8]) { ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x - 3, 0); ctx.stroke(); }
    // dome shell
    ctx.beginPath(); ctx.moveTo(-24, -10); ctx.quadraticCurveTo(-26, -44, 0, -44); ctx.quadraticCurveTo(18, -42, 18, -10); ctx.closePath();
    fillInk(ctx, '#33323e');
    ctx.strokeStyle = 'rgba(200,210,230,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-6, -24, 13, Math.PI * 1.15, Math.PI * 1.55); ctx.stroke();
    ink(ctx, 1.5); ctx.beginPath(); ctx.moveTo(-3, -44); ctx.lineTo(-3, -11); ctx.stroke();
    // tin apron
    ctx.beginPath(); ctx.moveTo(6, -36); ctx.lineTo(20, -34); ctx.lineTo(22, -10); ctx.lineTo(6, -10); ctx.closePath(); fillInk(ctx, '#b9c4cf', 1.5);
    // head + horn
    ctx.beginPath(); ctx.ellipse(22, -26, 8, 7, 0, 0, TAU); fillInk(ctx, '#2a2830');
    ctx.beginPath(); ctx.moveTo(25, -31); ctx.quadraticCurveTo(30, -42, 24, -46); ctx.quadraticCurveTo(28, -38, 21, -32); fillInk(ctx, '#2a2830', 1.5);
    eye(ctx, 25, -27, 2, '#ffd890', true);
    // hammer arm
    ctx.save(); ctx.translate(14, -30); ctx.rotate(-1.2 + strike * 1.5);
    ink(ctx, 2.2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(16, 0); ctx.stroke();
    ctx.beginPath(); ctx.rect(14, -5, 6, 10); fillInk(ctx, '#8a8f99', 1.5);
    ctx.restore();
    if (strike > 0.6) glow(ctx, 30, -14, 12, '#ffe0a0', 0.5);
  });
}

function drawBeadmother(ctx, npc, t) {
  const sv = npc.game.save;
  local(ctx, npc, () => {
    const b = Math.sin(t * 1.5) * 0.8;
    // shawled round body
    ctx.beginPath(); ctx.moveTo(-22, 0); ctx.quadraticCurveTo(-26, -34 + b, -4, -40 + b); ctx.quadraticCurveTo(22, -40 + b, 22, 0); ctx.closePath();
    fillInk(ctx, '#5a4868');
    ctx.strokeStyle = 'rgba(255,220,240,0.18)'; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-18 + i * 2, -4 - i * 6); ctx.lineTo(18 - i, -4 - i * 6); ctx.stroke(); }
    // fringe
    ink(ctx, 1);
    for (let x = -20; x <= 20; x += 4) { ctx.beginPath(); ctx.moveTo(x, -2); ctx.lineTo(x + 1, 3); ctx.stroke(); }
    // face
    const hy = -42 + b;
    ctx.beginPath(); ctx.arc(2, hy, 11, 0, TAU); fillInk(ctx, '#ead9c6');
    // knotted hair
    ctx.beginPath(); ctx.ellipse(-3, hy - 10, 9, 5, -0.2, 0, TAU); fillInk(ctx, '#d9d2c8');
    ctx.beginPath(); ctx.arc(-6, hy - 16, 4.5, 0, TAU); fillInk(ctx, '#d9d2c8', 1.5);
    ink(ctx, 1.2); ctx.beginPath(); ctx.arc(-6, hy - 16, 2, 0, TAU); ctx.stroke();
    // kind half-shut eyes
    ink(ctx, 1.8);
    ctx.beginPath(); ctx.arc(4, hy, 2.5, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(10, hy, 2.5, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
    ctx.fillStyle = 'rgba(220,120,130,0.4)'; ctx.beginPath(); ctx.arc(1, hy + 5, 2.6, 0, TAU); ctx.fill();
    // the cord of rescued beadlings
    const n = 16, lit = Math.round(Math.min(48, sv.beadlings) / 48 * n);
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.12 + 0.76 * (i / (n - 1)));
      const x = Math.cos(a) * 19, y = -24 + b + Math.sin(a) * 9;
      if (i < lit) {
        glow(ctx, x, y, 6, '#fff2c8', 0.4 + Math.sin(t * 3 + i) * 0.1);
        ctx.fillStyle = '#fff4d8';
      } else ctx.fillStyle = 'rgba(30,25,40,0.7)';
      ctx.beginPath(); ctx.arc(x, y, 2.1, 0, TAU); ctx.fill();
    }
  });
}

function drawGossamer(ctx, npc, t) {
  local(ctx, npc, () => {
    const b = Math.sin(t * 1.7) * 1.2;
    // folded cloak wings
    ctx.beginPath(); ctx.moveTo(-2, -50 + b); ctx.quadraticCurveTo(-30, -40, -22, 0); ctx.lineTo(6, 0); ctx.quadraticCurveTo(10, -30, -2, -50 + b);
    fillInk(ctx, '#7d6b58');
    for (const [x, y] of [[-14, -26], [-11, -11]]) {
      ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); fillInk(ctx, '#cdb58a', 1.2);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill();
    }
    // fuzzy body
    ctx.beginPath(); ctx.ellipse(4, -30 + b, 10, 18, 0.05, 0, TAU); fillInk(ctx, '#c9b694');
    ink(ctx, 2); ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(-1, 0); ctx.moveTo(8, -12); ctx.lineTo(9, 0); ctx.stroke();
    // ruff
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) { const a = Math.PI + (i / 8) * Math.PI; ctx.lineTo(5 + Math.cos(a) * 12, -42 + b - Math.sin(a) * (i % 2 ? 2 : 5)); }
    fillInk(ctx, '#efe2c4', 1.5);
    // head + antennae
    ctx.beginPath(); ctx.arc(7, -50 + b, 7, 0, TAU); fillInk(ctx, '#d8c8a8');
    ink(ctx, 1.4);
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(6 + s * 2, -56 + b); ctx.quadraticCurveTo(8 + s * 8, -68 + b, 14 + s * 6, -66 + b); ctx.stroke();
      for (let k = 0; k < 4; k++) { const x = 8 + s * 3 + k * 2.4, y = -61 - k * 1.5 + b; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2, y - 3); ctx.stroke(); }
    }
    eye(ctx, 10, -51 + b, 2.6, INK); eye(ctx, 4, -51 + b, 2.2, INK);
    // pole lantern
    ink(ctx, 2); ctx.beginPath(); ctx.moveTo(14, -30 + b); ctx.lineTo(22, -66); ctx.stroke();
    const lx = 23 + Math.sin(t * 1.3) * 1.5, ly = -60;
    ctx.beginPath(); ctx.moveTo(22, -66); ctx.lineTo(lx, ly - 4); ctx.stroke();
    glow(ctx, lx, ly, 22, '#ffe2a0', 0.45);
    ctx.beginPath(); ctx.roundRect(lx - 3.5, ly - 4, 7, 9, 2); fillInk(ctx, '#ffe7b0', 1.4);
  });
}

function drawElder(ctx, npc, t) {
  local(ctx, npc, () => {
    const s = Math.sin(t * 0.8);
    // foot
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.quadraticCurveTo(-30, -8, -10, -10); ctx.lineTo(18, -12); ctx.quadraticCurveTo(30, -14, 32, -2); ctx.lineTo(32, 0); ctx.closePath();
    fillInk(ctx, '#8a8c74');
    // neck/head
    ctx.beginPath(); ctx.moveTo(14, -10); ctx.quadraticCurveTo(16, -30, 26, -30); ctx.quadraticCurveTo(34, -28, 32, -8); fillInk(ctx, '#8a8c74');
    // shell spiral
    ctx.beginPath(); ctx.arc(-6, -26, 20, 0, TAU); fillInk(ctx, '#5f6650');
    ink(ctx, 1.6); ctx.beginPath();
    for (let a = 0; a < TAU * 2.4; a += 0.2) { const r = 18 - a * 1.1; ctx.lineTo(-6 + Math.cos(a) * r, -26 + Math.sin(a) * r); }
    ctx.stroke();
    // moss tufts on shell
    ctx.fillStyle = '#7eaa5a';
    for (const [x, y, r] of [[-20, -38, 5], [-10, -45, 6], [2, -42, 4.5], [-24, -26, 3.5]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    // eye stalks, drooping with age
    ink(ctx, 1.8);
    for (const [k, ph] of [[0, 0], [1, 1.3]]) {
      const ex = 28 + k * 6 + Math.sin(t * 0.9 + ph) * 1.5, ey = -44 + k * 3 + s;
      ctx.beginPath(); ctx.moveTo(26 + k * 3, -29); ctx.quadraticCurveTo(25 + k * 6, -40, ex, ey); ctx.stroke();
      ctx.beginPath(); ctx.arc(ex, ey, 3.2, 0, TAU); fillInk(ctx, '#e8e2cc', 1.4);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + 0.8, ey + 0.6, 1.5, 0, TAU); ctx.fill();
    }
    // moss beard
    ctx.fillStyle = '#6e9a4e';
    ctx.beginPath(); ctx.moveTo(26, -18); ctx.quadraticCurveTo(30, -4 + s, 33, -14); ctx.quadraticCurveTo(35, -6 + s, 35, -18); ctx.fill();
  });
}

// Rollmasters: ball-shaped martial artists in headbands
function rollmaster(c1, band, style) {
  return (ctx, npc, t) => local(ctx, npc, (w) => {
    const r = w / 2;
    let y = -r, rot = 0;
    if (style === 'spin') rot = (t % 4 < 0.8) ? (t % 4) / 0.8 * TAU : 0;
    if (style === 'rebound') y -= Math.abs(Math.sin(t * 3.2)) * 7;
    if (style === 'cyclone') y -= 4 + Math.sin(t * 1.6) * 3;
    if (style === 'cyclone') {
      ctx.strokeStyle = 'rgba(220,240,255,0.5)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, -2 - i * 3, r * (1.1 - i * 0.2), 3, 0, t * 4 + i, t * 4 + i + 2.4); ctx.stroke(); }
    }
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, -1, r * 0.8, 3, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(0, y);
    ctx.save(); ctx.rotate(rot);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); fillInk(ctx, c1, 2.2);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.75, Math.PI * 0.6, Math.PI * 1.3); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    // headband + streaming tails
    ctx.beginPath(); ctx.ellipse(0, -r * 0.42, r * 0.97, r * 0.2, 0, Math.PI * 1.02, Math.PI * 1.98, true); ctx.lineTo(r * 0.92, -r * 0.62); ctx.ellipse(0, -r * 0.62, r * 0.92, r * 0.18, 0, 0, Math.PI, true); ctx.closePath();
    fillInk(ctx, band, 1.6);
    const wave = Math.sin(t * 6) * 3;
    ctx.beginPath(); ctx.moveTo(-r * 0.9, -r * 0.5); ctx.quadraticCurveTo(-r * 1.4, -r * 0.7 + wave, -r * 1.9, -r * 0.4 - wave);
    ctx.lineTo(-r * 1.85, -r * 0.2 - wave); ctx.quadraticCurveTo(-r * 1.35, -r * 0.4 + wave, -r * 0.9, -r * 0.35); fillInk(ctx, band, 1.4);
    // fierce eyes + brows
    beadEye(ctx, r * 0.2, -r * 0.05, r * 0.2); beadEye(ctx, r * 0.6, -r * 0.05, r * 0.18);
    ink(ctx, 2.2);
    ctx.beginPath(); ctx.moveTo(r * 0.02, -r * 0.33); ctx.lineTo(r * 0.36, -r * 0.24); ctx.moveTo(r * 0.48, -r * 0.24); ctx.lineTo(r * 0.78, -r * 0.33); ctx.stroke();
    if (style === 'spin') { // venerable whiskers
      ink(ctx, 1.5); ctx.beginPath();
      ctx.moveTo(r * 0.42, r * 0.28); ctx.quadraticCurveTo(r * 0.1, r * 0.45, -r * 0.05, r * 0.75);
      ctx.moveTo(r * 0.42, r * 0.28); ctx.quadraticCurveTo(r * 0.8, r * 0.45, r * 0.9, r * 0.75); ctx.stroke();
    }
    ctx.restore();
  });
}

// Sir Burl: pill-bug knight. stage: 'hollows' | 'kilns' | 'loom'
function drawBurl(stage) {
  const C = { hollows: ['#7d8899', '#5b6577'], kilns: ['#4c3b37', '#30252a'], loom: ['#6a6a72', '#4a4a52'] }[stage];
  return (ctx, npc, t) => local(ctx, npc, (w) => {
    const sv = npc.game.save;
    const curled = stage === 'loom' && sv.flags.burl_end;
    if (curled) {
      const r = 14;
      ctx.beginPath(); ctx.arc(0, -r, r, 0, TAU); fillInk(ctx, '#77777f');
      ink(ctx, 1.5);
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(i * 5, -r, 2, r * 0.95, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(-4, -r - 6, 4, 0, TAU); ctx.fill();
      ink(ctx, 2); ctx.beginPath(); ctx.moveTo(-r - 10, -2); ctx.lineTo(r + 14, -1); ctx.stroke(); // his pin, laid down
      return;
    }
    const ph = t * 3, slump = stage === 'loom' ? 3 : 0;
    ink(ctx, 1.6);
    for (let i = 0; i < 6; i++) { const x = -12 + i * 5; ctx.beginPath(); ctx.moveTo(x, -6); ctx.lineTo(x + Math.sin(ph + i) * 1.5, 0); ctx.stroke(); }
    // segmented armour
    ctx.beginPath(); ctx.moveTo(-19, -5); ctx.quadraticCurveTo(-20, -27 + slump, 0, -28 + slump); ctx.quadraticCurveTo(17, -27 + slump, 18, -5); ctx.closePath();
    fillInk(ctx, C[0]);
    ink(ctx, 1.4);
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 5, -26 + slump + Math.abs(i) * 1.2); ctx.quadraticCurveTo(i * 5 + 2, -14, i * 5, -5); ctx.stroke(); }
    if (stage === 'kilns') { // embers in the scorch
      for (let i = 0; i < 4; i++) { const a = 0.5 + 0.5 * Math.sin(t * 4 + i * 2); ctx.fillStyle = `rgba(255,140,60,${a})`; ctx.beginPath(); ctx.arc(-12 + i * 7, -14 - (i % 2) * 6, 1.4, 0, TAU); ctx.fill(); }
    }
    // head
    ctx.beginPath(); ctx.ellipse(19, -10, 6, 6, 0, 0, TAU); fillInk(ctx, C[1]);
    ink(ctx, 1.2); ctx.beginPath(); ctx.moveTo(22, -15); ctx.quadraticCurveTo(28, -22, 32, -20); ctx.moveTo(20, -15); ctx.quadraticCurveTo(24, -25, 28, -26); ctx.stroke();
    beadEye(ctx, 21, -11, 2);
    // helmet plume
    const pl = stage === 'kilns' ? '#6a2a20' : stage === 'loom' ? '#7a5a5a' : '#c2343c';
    ctx.beginPath(); ctx.moveTo(-2, -27 + slump); ctx.quadraticCurveTo(-10, -40 + slump + Math.sin(t * 2) * 2, -20, -34 + slump); ctx.quadraticCurveTo(-10, -32 + slump, -2, -27 + slump);
    fillInk(ctx, pl, 1.4);
    // the pin lance
    ink(ctx, 2.2); ctx.beginPath(); ctx.moveTo(10, -6); ctx.lineTo(38, -18 + slump * 2); ctx.stroke();
    ctx.fillStyle = '#d8d8e0'; ctx.beginPath(); ctx.arc(8, -5, 3, 0, TAU); ctx.fill();
  });
}

function drawWisp(ctx, npc, t) {
  local(ctx, npc, () => {
    const y = -20 + Math.sin(t * 2.2) * 4, x = Math.sin(t * 1.3) * 2;
    glow(ctx, x, y, 34, '#d8e8ff', 0.5);
    ctx.strokeStyle = '#c23a3a'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 4, y + 4);
    for (let i = 1; i <= 6; i++) ctx.lineTo(x - 4 - i * 3, y + 4 + i * 2 + Math.sin(t * 5 - i) * 2.5);
    ctx.stroke();
    ctx.fillStyle = '#f4f6ff'; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
    ink(ctx, 1.4); ctx.stroke();
    beadEye(ctx, x + 1, y - 1, 1.8); beadEye(ctx, x + 4.5, y - 1, 1.8);
  });
}

function drawTwinseer(ctx, npc, t) {
  local(ctx, npc, () => {
    glow(ctx, 0, -40, 30, '#ffd8f0', 0.3);
    // prism cloak
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.quadraticCurveTo(-20, -30, -10, -40); ctx.lineTo(10, -40); ctx.quadraticCurveTo(20, -30, 18, 0); ctx.closePath();
    fillInk(ctx, '#e3bcd2');
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-5, -36); ctx.lineTo(-1, -36); ctx.lineTo(-5, -4); ctx.fill();
    ctx.fillStyle = 'rgba(120,80,140,0.3)'; ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(7, -36); ctx.lineTo(11, -36); ctx.lineTo(12, -4); ctx.fill();
    // hood
    ctx.beginPath(); ctx.arc(0, -46, 13, Math.PI * 0.85, Math.PI * 2.15); ctx.lineTo(10, -38); ctx.lineTo(-10, -38); ctx.closePath(); fillInk(ctx, '#b88aa8');
    // one head, two faces: one looks back, one looks ahead
    for (const s of [-1, 1]) {
      const x = s * 5.5, y = -45 + Math.sin(t * 1.5 + s) * 0.8;
      ctx.beginPath(); ctx.ellipse(x, y, 5.5, 7, s * 0.2, 0, TAU); fillInk(ctx, s < 0 ? '#f8f0f4' : '#dfe6f8', 1.4);
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(x + s * 1.6, y - 0.5, 1.2, 2.2, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x - s * 1.4, y - 0.5, 1.0, 2.0, 0, 0, TAU); ctx.fill();
    }
  });
}

function drawWeaverEcho(ctx, npc, t) {
  local(ctx, npc, () => {
    ctx.save(); ctx.globalAlpha = 0.55 + Math.sin(t * 1.2) * 0.12;
    const fake = { w: npc.w * 1.5, h: npc.h, anim: t * 0.15, game: npc.game };
    PAINTERS.spider(ctx, fake, t, { c1: '#e8e0f0', c2: '#9a8aa8', eye: '#ff5a5a', glow: true });
    ctx.restore();
    // phantom threads from above, worked by her hands
    ctx.strokeStyle = 'rgba(210,50,60,0.6)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      const x = -20 + i * 10;
      ctx.beginPath(); ctx.moveTo(x, -npc.h - 80); ctx.quadraticCurveTo(x + Math.sin(t * 1.5 + i) * 8, -npc.h * 0.8, x * 0.4, -npc.h * 0.45); ctx.stroke();
    }
  });
}

function drawMoonchild(ctx, npc, t) {
  local(ctx, npc, () => {
    const b = Math.sin(t * 1.8) * 2;
    glow(ctx, 0, -24 + b, 46, '#e8f0ff', 0.55);
    ctx.beginPath(); ctx.moveTo(-10, -2 + b); ctx.quadraticCurveTo(-12, -22 + b, 0, -26 + b); ctx.quadraticCurveTo(12, -22 + b, 10, -2 + b);
    ctx.quadraticCurveTo(5, 2 + b, 0, -2 + b); ctx.quadraticCurveTo(-5, 2 + b, -10, -2 + b); fillInk(ctx, '#dfe6f6', 1.6);
    ctx.beginPath(); ctx.arc(0, -34 + b, 10, 0, TAU); fillInk(ctx, '#f6f8ff', 1.6);
    // crescent crown
    ctx.beginPath(); ctx.arc(0, -47 + b, 6, Math.PI * 0.85, Math.PI * 2.15); ctx.arc(1.5, -49 + b, 5, Math.PI * 2.1, Math.PI * 0.9, true); ctx.closePath();
    fillInk(ctx, '#ffffff', 1.2);
    beadEye(ctx, 2, -34 + b, 2.4); beadEye(ctx, 7, -34 + b, 2.2);
  });
}

// ---------------------------------------------------------------- shops
export const SHOPS = {
  bobbin: {
    title: 'Mother Bobbin\'s Notions',
    items: [
      { key: 'bobbin_lantern', name: 'Glowwick Lantern', icon: 'ability', price: 180, give: { item: 'ability', id: 'lantern' }, cond: (s) => !s.abilities.lantern,
        desc: 'A wick that never quite goes out. You\'ll want it below the Catacombs, dear. Trust me. I\'ve seen what lives down there. Well, I haven\'t. That\'s the point.' },
      { key: 'bobbin_wayfinder', name: 'Wayfinder', icon: 'knot', price: 60, give: { item: 'knot', id: 'wayfinder' },
        desc: 'Shows where you are on your map. For the young and the easily turned around, which is everyone.' },
      { key: 'bobbin_glintmagnet', name: 'Glint Magnet', icon: 'knot', price: 120, give: { item: 'knot', id: 'glintmagnet' },
        desc: 'Loose Glints come rolling to you. Like family at supper time.' },
      { key: 'bobbin_threadcatcher', name: 'Thread Catcher', icon: 'knot', price: 150, give: { item: 'knot', id: 'threadcatcher' },
        desc: 'Every Bonk winds up a little more Spin. Waste not.' },
      { key: 'bobbin_swiftknot', name: 'Swift Knot', icon: 'knot', price: 200, give: { item: 'knot', id: 'swiftknot' },
        desc: 'Roll faster. Not in my shop, though.' },
      { key: 'bobbin_longthread', name: 'Long Thread', icon: 'knot', price: 380, give: { item: 'knot', id: 'longthread' },
        desc: 'Your Bonk reaches further. Good manners for a head-butter: keep them at a distance.' },
      { key: 'bobbin_stoneshell', name: 'Stone Shell', icon: 'knot', price: 450, give: { item: 'knot', id: 'stoneshell' },
        desc: 'One more Coat of lacquer. I\'d paint you ten if I had the pots.' },
      { key: 'bobbin_bearing', name: 'Brass Bearing', icon: 'bearing', price: 650, give: { item: 'bearing' },
        desc: 'Oiled and true. Fit it inside you and you\'ll hold far more Spin. Don\'t ask me how. I just sell them.' },
      { key: 'bobbin_notch1', name: 'Length of String', icon: 'notch', price: 400, give: { item: 'notch' },
        desc: 'A longer thread means room for one more Knot. Everyone needs a spare.' },
      { key: 'bobbin_notch2', name: 'Length of String', icon: 'notch', price: 900, give: { item: 'notch' }, cond: (s) => !!s.flags.bought_bobbin_notch1,
        desc: 'My last length. My mother\'s. Wear it in good health.' },
    ],
  },
  gossamer: {
    title: 'The Moth Ferries',
    items: [
      { key: 'gossamer_pass', name: 'Ferry Pass', icon: 'key', price: 250, give: { item: 'key', id: 'ferryPass' }, cond: (s) => !s.items.ferryPass,
        desc: 'A moth-wing token. Show it at any Moth Ferry you have found, and a moth will carry you to any other.' },
    ],
  },
};

// ---------------------------------------------------------------- services
const POLISH_COST = [300, 800, 1500, 2500];

function tinsmithPolish(g, npc) {
  const sv = g.save, n = sv.polish;
  if (n >= 4) return ['Nothing left to polish. You\'re all shine.'];
  const cost = POLISH_COST[n], ore = sv.items.ore || 0;
  if (!ore) return ['No Pale Tin, no polish. Tin first. Then talk.'];
  if (sv.glints < cost) return [`Polish number ${n + 1}. One Pale Tin and ${cost} Glints. You've got the tin. Not the Glints.`];
  return {
    pages: [`Polish number ${n + 1}. One Pale Tin, ${cost} Glints. Hold still. Shell gets harder. Bonk gets meaner.`],
    opts: {
      choices: [
        { label: `Polish (${cost} Glints)`, fn: () => {
          if (!pay(g, cost)) return;
          sv.items.ore = ore - 1;
          sv.polish++;
          g.refreshStats();
          banner(g, `Polish ${sv.polish} of 4`, 'Bead\'s shell gleams. Bonk damage increased.');
          next(npc, [pick(['There. Bonk something. Feel that?', 'Done. Don\'t scuff it.', 'Good shell. Good tin. Good work. Mine, I mean.'], sv.polish),
            ...(sv.polish === 4 ? ['That\'s the last of it. Finest shell I ever worked. Don\'t tell the others.'] : [])]);
        } },
        { label: 'Not now' },
      ],
    },
  };
}

function learnTechnique(g, npc, id, price, name, how) {
  return {
    label: `Learn ${name} (${price})`,
    fn: () => {
      if (!pay(g, price)) { next(npc, ['Your purse is lighter than your shell. Return with ' + price + ' Glints.']); return; }
      g.save.techniques[id] = 1;
      g.refreshStats();
      banner(g, 'Technique: ' + name, how);
      const t = g.save.techniques;
      const done = t.spin && t.rebound && t.cyclone;
      const after = [`Again. And again. ${how} Until it is not a thing you do, but a thing you are.`];
      if (done && !g.save.flags.trio_ready) {
        g.save.flags.trio_ready = 1;
        after.push('Spin, Rebound and Cyclone. You hold all three. That has not happened in a very long time.',
          'The masters will feel it. Go to the Rolling Dojo in Spindletown. All three of us await you there, for the final test.');
      }
      next(npc, after);
    },
  };
}

function trioPages(s) {
  if (beat(s, 'rollmasters')) return ['You have bested all three of us. The dojo is yours.', '...Please do not take the dojo. It is our dojo.'];
  if (s.flags.trio_ready) return ['The masters await you in Spindletown\'s dojo. Do not keep us waiting. We are very old balls.'];
  return null;
}

// Bobbin's Marble Jar: Glass Marbles found around the world, traded in for rewards
const MARBLE_TIERS = [
  { n: 3, give: { item: 'glints', value: 400 }, say: 'Three marbles! Clink, clink, clink. Here, a little something.' },
  { n: 6, give: { item: 'glints', value: 900 }, say: 'Six! The jar\'s half full. Or half empty. I prefer full.' },
  { n: 9, give: { item: 'glints', value: 1600 }, say: 'Nine. You must be looking under every rock. I approve.' },
  { n: 11, give: { item: 'ring' }, say: 'Eleven. The jar is full. I\'ve been saving this ring for whoever filled it. It\'s gilded. It\'s yours.' },
];
function marbleJar(g) {
  const s = g.save, have = s.marbles || 0;
  const out = [];
  for (const t of MARBLE_TIERS) {
    if (have >= t.n && !s.flags['marbletier_' + t.n]) {
      s.flags['marbletier_' + t.n] = 1;
      out.push(t.say);
      setTimeout(() => grantItem(g, t.give), 50);
      break;
    }
  }
  if (!out.length) {
    const nxt = MARBLE_TIERS.find((t) => have < t.n);
    out.push(nxt ? `${have} marble${have === 1 ? '' : 's'} in the jar. Bring me ${nxt.n - have} more and we\'ll talk.` : 'The jar is full. I just like to look at it, now.');
  }
  return out;
}

// Beadmother reward tiers
const BEAD_TIERS = [
  { n: 5, give: { item: 'glints', value: 200 }, say: ['Five! Five little lights, home and grumbling about the jars.', 'Here, for your trouble. Don\'t spend it on sweets. Spend some of it on sweets.'] },
  { n: 10, give: { item: 'glints', value: 600 }, say: ['Ten. They sing at night now. Not well.', 'This was in my mending basket. Glints, rolled up in a sock. Take them.'] },
  { n: 20, give: { item: 'knot', id: 'mothersblessing' }, say: ['Twenty! Hold still, now.', 'I tied this the way my mother tied it for me. Stand quiet a while, and it will mend you.'] },
  { n: 30, give: { item: 'knot', id: 'thickshell' }, say: ['Thirty. You\'re growing a thick shell, going where you\'ve been.', 'Here is a thicker one. I worry, you see. It\'s what I\'m for.'] },
  { n: 40, give: { item: 'glints', value: 1000 }, say: ['Forty. I\'ve run out of clever things to give.', 'Have money. Money is always clever.'] },
  { n: 48, give: { item: 'glints', value: 3000 }, say: [
    'Forty-eight. That is all of them. Every little one the strand let fall. I counted them from my window every night for an age.',
    'Sit with me a moment. I\'ll tell you what I am. I\'m a knot.',
    'On the strand, between every bead, there was a little knot, so the beads would not grind each other away. That was all our work: to sit in between.',
    'When it came down, I fell with the little ones. Somebody had to keep them from rubbing.',
    'And you. I knew you the moment you rolled in dripping on my rug. I sat three beads from the end. I could feel you back there, holding everything together.',
    'Whatever you choose to do with that, little clasp: you were never only a thing that holds. You were a bead, too. Take this. Take all of it.',
  ] },
];

// ---------------------------------------------------------------- NPCs
export const NPCS = {
  // ======================== The Fray
  threadwisp: {
    name: 'Threadwisp', verb: 'Listen', voice: 5, size: [24, 34], light: 120,
    draw: drawWisp,
    talk(g) {
      const s = g.save;
      if (first(g, 'threadwisp')) return [
        'Oh! Oh, you\'re awake. You fell such a long way. Everything did.',
        'I\'m only a thread. A little loose one. But I kept a little light, and you looked like you needed some.',
        'If something tries to hurt you, Bonk it. Press X and put your whole head into it. You have a very good head for it.',
        'Scuffed? Hold F while you roll to Buff yourself bright again. It burns Spin, and you build Spin by rolling fast. So keep moving. Always keep moving.',
        'Go right. Keep rolling. The way out is up, and up is always further than it looks.',
      ];
      if (ended(s)) return ['You came back down! Nobody comes back down.', 'You look... finished. Like the end of a seam. In a good way.'];
      if (s.greatBeads >= 1) return ['You\'re carrying something heavy and bright.', 'You remind me of someone. Someone at the very end of the thread. ...No. Never mind. Keep rolling.'];
      if (beat(s, 'gnarlknot')) return ['The knot came undone! I felt it all through the cloth.', 'Up and right now. There\'s a town. It rains there, and nobody minds.'];
      return [pick([
        'Bonk with X. Roll fast to wind up Spin. Hold F while rolling to Buff. That\'s nearly everything I know.',
        'Thin floors let you drop through. Hold down and jump.',
        'Cracked walls are only pretending. Bonk them until they admit it.',
      ])];
    },
  },

  // ======================== Spindletown
  bobbin: {
    name: 'Mother Bobbin', verb: 'Talk', voice: 2, size: [40, 60], light: 60,
    draw: drawBobbin,
    talk(g, npc) {
      const s = g.save;
      const choices = [
        { label: 'Shop', fn: () => g.app.openShop(SHOPS.bobbin) },
        { label: 'Marble Jar', fn: () => next(npc, marbleJar(g)) },
        { label: 'Talk', fn: () => next(npc, bobbinChat(s)) },
        { label: 'Leave' },
      ];
      if (first(g, 'bobbin')) return { pages: [
        'Well! Look what the rain rolled in. A bead! A real one, with eyes.',
        'I\'m Mother Bobbin. I keep the shop, and the gossip, and an eye on everyone who comes up that road. Mostly the gossip.',
        'Don\'t drip on the merchandise, dear. What can I do for you?',
      ], opts: { choices } };
      return { pages: [pick(['There you are. Wipe your... well, all of you.', 'Back again! I knew it. I said to the kettle, I said, that bead will be back.', 'Mind the pins. What\'ll it be?'])], opts: { choices } };
    },
  },

  tinsmith: {
    name: 'Tinsmith Ferrule', verb: 'Talk', voice: 0, size: [48, 46],
    draw: drawTinsmith,
    talk(g, npc) {
      const s = g.save;
      if (s.items.tinsmithMold && !s.flags.mold_returned) {
        return { pages: [
          '...That\'s my mold.',
          'Lost it in the dark forty years back. Cast my first bell in that. My father\'s hands. Then mine.',
          'Here. Don\'t argue. Don\'t look at me. I\'m fine. Tin dust. In my eye.',
        ], opts: { onEnd: () => { s.flags.mold_returned = 1; grantItem(g, { item: 'glints', value: 800 }); } } };
      }
      const intro = first(g, 'tinsmith')
        ? ['Ferrule. Tinsmith. You\'re dull.', 'Your shell. Dull. Bring Pale Tin, I polish. Polished shell, harder Bonk.', 'Tin\'s rare. Bosses hoard it. Bells hide it. Go look.']
        : [s.polish >= 4 ? 'Nothing left to polish. Shine like that, they\'ll mistake you for the Moon.' : (s.items.ore ? 'Tin. Good. Want it worked?' : pick(['No tin? Then no polish.', 'Hmph. Still dull.', 'Pale Tin. Bring it.']))];
      if (s.polish >= 4) return intro.concat(ended(s) ? ['Heard what you did. Up there. ...Good work. That\'s all.'] : []);
      return { pages: intro, opts: { choices: [
        { label: 'Polish shell', fn: () => next(npc, tinsmithPolish(g, npc)) },
        { label: 'Leave' },
      ] } };
    },
  },

  beadmother: {
    name: 'The Beadmother', verb: 'Talk', voice: 1, size: [46, 54], light: 70,
    draw: drawBeadmother,
    talk(g) {
      const s = g.save, n = s.beadlings;
      if (first(g, 'beadmother')) return [
        'Come in out of the rain, little one. Mind the jars.',
        'Every little bead that fell, I count. Chips and seed-pearls, the ones too small to become kingdoms.',
        'Collectors put them in jars, because they glow. Break the jars. The little ones will find their own way to me. They always know where I am.',
      ];
      if (s.items.wishbone && !s.flags.wishbone_given) {
        return { pages: ['A wishbone! You remembered.', 'The little ones have been wanting to pull one. They\'ll argue about who wins for a month. Here, that\'s for the trouble.'],
          opts: { onEnd: () => { s.flags.wishbone_given = 1; grantItem(g, { item: 'glints', value: 600 }); } } };
      }
      const tier = BEAD_TIERS.find((tr) => n >= tr.n && !s.flags['beadtier_' + tr.n]);
      if (tier) {
        const more = BEAD_TIERS.some((tr) => tr !== tier && n >= tr.n && !s.flags['beadtier_' + tr.n]);
        return { pages: tier.say.concat(more ? ['Oh, and talk to me again. There\'s more. I keep losing track; there are so many of them now.'] : []),
          opts: { onEnd: () => { s.flags['beadtier_' + tier.n] = 1; grantItem(g, tier.give); } } };
      }
      if (n >= 48) return [ended(s) ? 'They\'re asleep. All of them. Forty-eight. Forty-nine, with you home.' : 'Hush. They\'re sleeping. All forty-eight. Forty-nine, when you\'re home.'];
      const nextT = BEAD_TIERS.find((tr) => n < tr.n);
      return [
        n === 0 ? 'None home yet. That\'s all right. It was a long fall.' : `${n} home. ${48 - n} still out there in the dark, in jars, glowing at nobody.`,
        nextT ? `Bring ${nextT.n - n} more home and I'll have something for you.` : 'Keep looking.',
      ];
    },
  },

  gossamer: {
    name: 'Gossamer', verb: 'Talk', voice: 3, size: [40, 58], light: 110,
    draw: drawGossamer,
    talk(g) {
      const s = g.save;
      const choices = s.items.ferryPass ? null : [
        { label: 'Buy Ferry Pass', fn: () => g.app.openShop(SHOPS.gossamer) },
        { label: 'Leave' },
      ];
      let pages;
      if (first(g, 'gossamer')) pages = [
        'Gossamer, of the Moth Ferries. I carry folk between the kingdoms, on the wing, under the roof of the world.',
        'Every kingdom has a landing. Find one, and with a Pass, my moths will fly you to any other you\'ve found.',
        'The Pass is 250 Glints. Wings are expensive. Ask anyone who has lost one.',
      ];
      else if (s.items.ferryPass) pages = [pick([
        'Moths fly at light. It\'s in the blood. The trick of being a ferry moth is to fly at a light and not into it.',
        'I have spent my whole life not flying at the Moon. You would be amazed how tiring that is.',
        'Find the landings, little one. My moths do the rest.',
      ]),
      ...(s.endings.B ? ['The Moon looks lighter tonight. Less... fastened. Some nights I nearly let myself go to her. Nearly.'] : [])];
      else pages = ['Still walking? A Pass is 250 Glints. Your little legs will thank you. Do you have legs?'];
      return choices ? { pages, opts: { choices } } : pages;
    },
  },

  elder: {
    name: 'Elder Loam', verb: 'Talk', voice: 0, size: [64, 44],
    draw: drawElder,
    talk(g) {
      const s = g.save;
      if ((s.endings.A || s.endings.B) && !s.items.echoBell) {
        return { pages: [
          'You came back. ...They don\'t, usually. The ones who go up.',
          'This bell hung in my hall before there was a town. It rings for the beaten. Ring it, and everything you ever bested will answer.',
          'There is a door behind this hall that only opens to an echo. I have never gone through. I am too slow to be answered.',
        ], opts: { onEnd: () => grantItem(g, { item: 'key', id: 'echoBell' }) } };
      }
      if (s.endings.C) return ['Morning.', 'I had the word all along. I was saving it. I am very glad I lived long enough to spend it.'];
      if (s.items.echoBell) return ['The Hall is through the door. Thirty answered, they say. Three did not.', 'And one... no. You\'ll find it, or it will find you.'];
      if (first(g, 'elder')) return [
        'Mm. A bead.',
        'I saw them fall, you know. Every one. Like slow rain that glowed. I stood on the Spire and I did not catch a single one.',
        'I was young then. Barely four hundred.',
        'The gate up the hill opens to the Moon\'s Cradle. It wants the Moon Key, and the Weaver has that, far below everything.',
        'They say six lights must ring together before the way down to her opens. Six Great Beads. Kept by six who will not let go.',
      ];
      if (s.items.voidThread) return ['That thread you carry is not there.', 'Be careful whom you cut with it, little one. And be more careful whom you don\'t.'];
      if (s.items.moonKey) return ['You have the key.', 'Go on, then. She is waiting. She has been waiting longer than me, and I am very, very old.'];
      if (s.greatBeads >= 6) return ['All six. I can feel them humming from here, like a hive.', 'The way down opens under the Heart of the Hollows. The Weaver is waiting at the bottom. She always is.'];
      if (s.greatBeads > 0) return [`${s.greatBeads} of six.`, 'Each Keeper loved their bead. Remember that, when you take it. Love that has nowhere to go turns into holding on.'];
      return [pick([
        'Patience. A snail learns it. A bead may have to.',
        'Look up when you can. She is smaller than she was. It is polite to look.',
        'The town was built so that someone would be here when they came back. The beads, I mean. Maybe you.',
      ])];
    },
  },

  rollmaster_spin: {
    name: 'Master Whirl', verb: 'Talk', voice: 1, size: [38, 38],
    draw: rollmaster('#e9dcc0', '#c23a3a', 'spin'),
    hideIf: (s) => !!s.flags.trio_ready && !beat(s, 'rollmasters'),
    talk(g, npc) {
      const s = g.save;
      const trio = trioPages(s);
      if (trio) return trio;
      if (s.techniques.spin) return ['Hold. Gather. Release. You remember.', 'My rivals: Carom, who bounces about the Hushwood like a hailstone, and Vortice, who sulks in the clouds over Bellfry. Learn from them. Do not tell them I said so.'];
      const how = 'Hold Bonk to charge, then release for a spinning strike.';
      return { pages: first(g, 'whirl') ? [
        'HAI! A ball! A fellow ball! Welcome to the Rolling Dojo, where we roll with PURPOSE.',
        'I am Master Whirl, first of the Rollmasters. My art is the Spin.',
        'Hold Bonk. Let the roll gather inside you, round and round. Then release: a spinning strike that cuts all about you.',
        'Eight hundred Glints, and it is yours. Enlightenment is free. Instruction is not.',
      ] : ['The Spin awaits, little sphere. Eight hundred Glints.'],
      opts: { choices: [learnTechnique(g, npc, 'spin', 800, 'Spin', how), { label: 'Leave' }] } };
    },
  },

  // ======================== Mossbell Hollows
  burl_hollows: {
    name: 'Sir Burl', verb: 'Talk', voice: 1, size: [40, 32],
    draw: drawBurl('hollows'),
    talk(g) {
      const s = g.save;
      if (first(g, 'burl1')) return [
        'HALT! Who rolls there? ...Ah. A fellow sphere. Well met!',
        'I am Sir Burl of the Curled Order, knight-errant, and, do not be alarmed, the Moon\'s own lost bead.',
        'Observe. (He curls up tight. He uncurls.) You see? Perfectly round. I am rolling home to her. It is only a matter of up.',
        'Unfortunately, up is behind that ledge, and I am a roller, not a climber. I am regrouping.',
      ];
      if (beat(s, 'mossmother')) return ['You bested the Mother of Moss? Grand. I would have done it myself, but I was curled at the time. Strategically.', 'Onward! Upward! Well. Onward.'];
      if (has(s, 'sap')) return ['You clung to the WALL. Squire, that is either sorcery or sap.', 'Either way I am deeply jealous, and I will be taking the long way round.'];
      return [pick([
        'Still regrouping. Regrouping is a vital part of any quest.',
        'When I reach her, she will gasp. "My bead!" she will say. "My bravest bead!"',
        'Do not touch my lance. It is a pin. It is a very serious pin.',
      ])];
    },
  },

  bellkeeper: {
    name: 'Bellkeeper Tull', verb: 'Talk', voice: 0, size: [40, 36],
    draw: paint('beetle', { c1: '#7a6a3a', c2: '#c8a85a', eye: '#ffe6a8' }, 0, (ctx, npc, t) => {
      // a little hand bell, swung by feel
      ctx.save(); ctx.translate(18, -30); ctx.rotate(Math.sin(t * 3) * 0.4);
      ink(ctx, 1.6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5, 14); ctx.quadraticCurveTo(-4, 6, 0, 6); ctx.quadraticCurveTo(4, 6, 5, 14); ctx.closePath(); fillInk(ctx, '#d8b25a', 1.4);
      ctx.restore();
    }),
    talk(g) {
      const s = g.save;
      if (first(g, 'tull')) return [
        'EH? A VISITOR. YOU\'LL HAVE TO SPEAK UP. NO, DON\'T. I CAN\'T HEAR YOU ANYWAY.',
        'I RING THE BELLS BY FEEL. THE MOTHER\'S LITTLE ONES SLEEP BETTER WITH BELLS. SO DO I. I FEEL THEM IN MY FEET.',
        'THERE WAS A BELLMAKER ONCE, BUILT A BEETLE OUT OF BRASS TO RING THEM FOR HIM. IT GOT IDEAS. IT SULKS EAST AND LOW, PAST A GAP YOU\'LL NEED A QUICK ROLL FOR.',
      ];
      if (beat(s, 'brassbeetle')) return ['THE BRASS ONE\'S STILL! FELT IT STOP THROUGH THE FLOOR.', 'GOOD. IT RANG FLAT. ALWAYS DID.'];
      if (beat(s, 'mossmother')) return ['THE MOTHER\'S QUIET.', '...I SUPPOSE I\'LL KEEP RINGING. THE LITTLE ONES STILL SLEEP. SOMEONE HAS TO KEEP THEM WARM NOW.'];
      return [pick(['MIND THE MOSS. SHE GROWS IT WARM FOR A REASON.', 'BELL\'S A BIT SHARP TODAY. OR I\'M A BIT FLAT.', 'BELOW US, THE HEART BELL. SIX LIGHTS, THEY SAY, BEFORE IT OPENS. I SAY: LOUD.'])];
    },
  },

  // ======================== Glasswing Gardens
  mothmaid: {
    name: 'Pell the Mothmaid', verb: 'Talk', voice: 4, size: [36, 46],
    draw: paint('moth', { c1: '#dfe8c8', c2: 'rgba(200,235,210,0.75)', eye: '#2a3a2a', wing: 'moth' }, 26, (ctx) => {
      // watering can
      ink(ctx, 1.6); ctx.beginPath(); ctx.roundRect(8, -16, 12, 10, 2); ctx.fillStyle = '#a8b878'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(20, -13); ctx.lineTo(28, -20); ctx.stroke();
    }),
    talk(g) {
      const s = g.save;
      if (first(g, 'mothmaid')) return [
        'Oh! Mind the panes. They\'re older than the roof.',
        'I\'m Pell. I tend the greenhouse. The roof is glass so the plants can see the Moon. They can\'t. I haven\'t told them.',
        'There\'s a bead in the soil at the heart of the gardens. Everything grows toward it instead of up. Some of what grows is hungry.',
      ];
      if (beat(s, 'glassmoths')) return ['My sisters came down. In pieces, but they came down.', '...Thank you. I mean it. Mostly. Let me be sad in the potting shed for a while.'];
      if (beat(s, 'petalmaw')) return ['The great bloom is quiet. I\'ll replant. Something gentler. Something with fewer mouths.',
        'My sisters, Lumen and Lacuna, flew up to the high panes to be nearer the light. Their wings went to glass. They won\'t come down. Something that clings might reach them.'];
      return [pick(['Talk softly near the seedlings. They\'re impressionable.', 'Every petal on the big bloom is a mouth. I counted. Then I stopped counting.'])];
    },
  },

  // ======================== Tallow Catacombs
  chandler: {
    name: 'The Chandler', verb: 'Talk', voice: 3, size: [28, 46], light: 140,
    art: { body: 'candle', c1: '#ead8a8', c2: '#ffcf7a' },
    talk(g) {
      const s = g.save;
      if (first(g, 'chandler')) return [
        'Shh. Wax hears everything. Welcome to the Catacombs. I keep the candles.',
        'All of them. Every one. It\'s a lot of candles. I\'m a candle myself, so it\'s also a bit like being asked to keep a lot of relatives.',
        s.abilities.lantern ? 'You have a Glowwick. Good. It won\'t go out. Not quite. That\'s the best any light can promise.'
          : 'Below here it\'s unlit. Not a wick. Mother Bobbin in town sells a Glowwick Lantern. Buy it before you go down. Please. I hate lighting candles for the lost.',
      ];
      if (s.items.cryptKey && !beat(s, 'ossuaryknight')) return ['That\'s the Wax Key. The Sealed Ossuary...', 'The Knight is still in there, standing guard. Over nothing. Go gently. Or go hard. He won\'t mind either way.'];
      if (beat(s, 'wickwidow')) return ['The Widow\'s still.', 'She loved them, you know. She just didn\'t know you\'re allowed to let things go cold.'];
      if (!s.abilities.lantern) return ['No lantern yet? Bobbin. Town. 180 Glints. I\'ll light a candle for you in the meantime. Not that kind. A regular one.'];
      return [pick(['Drip, drip. That\'s me. Don\'t mind me.', 'The deeper candles were lit for someone who never came back. I keep relighting them anyway.'])];
    },
  },

  // ======================== Hushwood
  hushling: {
    name: 'Hushling', verb: 'Listen', voice: 5, size: [26, 30],
    art: { body: 'shroom', c1: '#8a5aa8', c2: '#e0c8f0', eye: '#fff' },
    talk(g) {
      const s = g.save;
      if (first(g, 'hushling')) return [
        'shh. shh shh. you roll very loudly.',
        'the elder is dreaming. if he wakes, we all wake. none of us want to.',
        'there\'s an owl. it makes no sound. if the quiet gets quieter... roll.',
      ];
      if (beat(s, 'hush')) return ['the owl\'s gone.', 'listen. ...you can hear the mushrooms growing. that\'s nice. i never knew.'];
      if (beat(s, 'sporecap')) return ['he\'s awake.', 'oh. oh, it\'s so loud, being awake. is it always this loud? how do you bear it?'];
      return [pick(['shh.', 'the spores make you sleepy. don\'t breathe. ...no, breathe. just not much.', 'the master in the clearing is trying very hard to whisper. it isn\'t going well.'])];
    },
  },

  rollmaster_rebound: {
    name: 'Master Carom', verb: 'Talk', voice: 2, size: [36, 36],
    draw: rollmaster('#b8d0e8', '#2a5aa0', 'rebound'),
    talk(g, npc) {
      const s = g.save;
      const trio = trioPages(s);
      if (trio) return trio;
      if (s.techniques.rebound) return ['(whispering) Dash! Bonk! Ping! ...sorry. Pong.', '(whispering) Whirl is in his dojo in town. Vortice sulks up in Bellfry. Learn them all. Then we will see.'];
      const how = 'Bonk right after a dash for a ricocheting strike.';
      return { pages: first(g, 'carom') ? [
        'HAI! I AM MASTER CAR-',
        '(whispering) Sorry. Sorry. The mushrooms. I am Master Carom. Of the Rebound.',
        '(whispering) Dash, and in the instant after, Bonk. You strike, you rebound, you strike again. Ping, pong, ping.',
        '(whispering) One thousand Glints. It is a very loud technique to teach quietly. I am charging for the difficulty.',
      ] : ['(whispering) The Rebound. One thousand Glints. Ping.'],
      opts: { choices: [learnTechnique(g, npc, 'rebound', 1000, 'Rebound', how), { label: 'Leave' }] } };
    },
  },

  // ======================== Cogwork Bastion
  tinkerbot: {
    name: 'Tinkerbot Nine', verb: 'Talk', voice: 4, size: [30, 36],
    art: { body: 'golem', c1: '#b87a3a', c2: '#7a4a28', eye: '#7ef0ff', glow: true },
    talk(g, npc) {
      const s = g.save;
      if (s.flags.tinker_resting) {
        if (beat(s, 'choir')) return ['THE CHOIR HAS STOPPED SINGING THE SHIFT CHANGE.', 'THE SHIFT... IS OVER? UNIT NINE WILL REMAIN RESTING. UNIT NINE HAS GOTTEN QUITE GOOD AT IT.'];
        return ['UNIT NINE IS RESTING. AS ORDERED.', 'IT IS... PLEASANT. UNIT NINE HAS LOGGED A COMPLAINT THAT IT WAS NOT ORDERED TO DO THIS SOONER.'];
      }
      const pages = first(g, 'tinker') ? [
        'BEEP. UNIT NINE OF THE GUILD. AWAITING ORDERS.',
        'LAST ORDER RECEIVED: "WAIT HERE." DURATION OF WAIT: [NUMBER TOO LARGE TO DISPLAY].',
        'THE GUILD HAS NOT RETURNED. UNIT NINE ASSUMES THEY ARE RUNNING LATE.',
      ] : [beat(s, 'gearwright') ? 'THE COLOSSUS HAS HALTED. UNIT NINE IS UNSURE WHETHER TO BE SAD. UNIT NINE WILL BE SAD AT LOW PRIORITY.' : 'STILL AWAITING ORDERS. ANY ORDERS. UNIT NINE IS NOT FUSSY.'];
      return { pages, opts: { choices: [
        { label: 'Order: Rest', fn: () => { s.flags.tinker_resting = 1; next(npc, ['ORDER ACCEPTED.', '...', 'UNIT NINE HAS NEVER RESTED. PROCESSING. PROCESSING. OH. OH, THAT IS NICE.']); } },
        { label: 'Leave' },
      ] } };
    },
  },

  // ======================== Brine Cistern
  diver: {
    name: 'Old Brine', verb: 'Talk', voice: 0, size: [40, 36],
    draw: paint('crab', { c1: '#b8603a', c2: '#e8a070', eye: '#fff' }, 0, (ctx, npc, t) => {
      // brass diving helmet
      ctx.beginPath(); ctx.arc(0, -30, 12, 0, TAU); fillInk(ctx, '#c89a4a');
      ctx.beginPath(); ctx.arc(4, -30, 6, 0, TAU); fillInk(ctx, 'rgba(160,200,230,0.8)', 1.5);
      beadEye(ctx, 4, -30, 2);
      const by = -46 - ((t * 14) % 24);
      ctx.strokeStyle = 'rgba(200,230,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-2, by, 2.5, 0, TAU); ctx.stroke();
    }),
    talk(g) {
      const s = g.save;
      if (first(g, 'diver')) return [
        'Glub. Sorry. Habit.',
        'Old Brine. Last Pumpkeeper of the Cistern. There were four of us. Then something large swallowed the outflow pipe.',
        'We pump. It\'s pointless. The bead at the bottom weeps ink faster than we can shift it. We pump.',
      ];
      if (beat(s, 'brinematron')) return ['The Matron\'s gone quiet in her nursery.', 'Her little ones will be on their own now. Same as the rest of us. Glub.'];
      if (beat(s, 'gullet')) return ['The Gullet\'s gone?', '...The water\'s going down. Already. Huh.', 'Maybe it wasn\'t pointless. Maybe we were just waiting for you.'];
      if (!has(s, 'magnet')) return ['There\'s a copper culvert below. Runs on lodestone. You don\'t look magnetic.', 'Find something that sticks. Then come back down.'];
      if (!s.items.cryptKey) return ['There\'s a key in the copper reliquary down there. Wax, kept in copper so the candle-folk can\'t melt it.', 'Opens something in the Catacombs. Something sad.'];
      return [pick(['Glub.', 'Don\'t drink the ink. It\'s drowned light. It tastes of nights.'])];
    },
  },

  // ======================== Ashen Kilns
  glassmonk: {
    name: 'Brother Cullet', verb: 'Talk', voice: 1, size: [34, 50], light: 60,
    art: { body: 'knight', c1: '#7a5a48', c3: '#e8d8c8', eye: '#ffb060', horns: 0 },
    talk(g) {
      const s = g.save;
      if (first(g, 'cullet')) return [
        'Peace, small one. You stand in the Chapel of the Blown Flame.',
        'We teach that glass is light that agreed to stay. Master Vitrius taught it best of all.',
        'He made a thousand beads, and not one of them shone. So he opened his own chest and set the true one inside. He has not been gentle since.',
      ];
      if (beat(s, 'cindertwins')) return ['The twin furnaces are cold. Ash and Ember.', 'They were his first apprentices. He let them burn too hot, and never told them to stop. Perhaps now they can rest.'];
      if (beat(s, 'vitrius')) return ['Then he has let it go.', 'I will keep the kilns lit. Not for light. For warmth, which is a humbler thing, and enough.'];
      return [pick(['Cool slowly. Glass cooled in haste shatters years later, for no reason anyone can see.', 'The Master is in the Great Kiln. Do not touch him with bare shell.'])];
    },
  },

  burl_kilns: {
    name: 'Sir Burl', verb: 'Talk', voice: 1, size: [40, 32], light: 40,
    draw: drawBurl('kilns'),
    talk(g) {
      const s = g.save;
      if (first(g, 'burl2')) return [
        'Squire! Don\'t come closer. I\'m annealing.',
        'My plan is genius. The Moon will not recognise a grey bug. But a glass bead? She will know me at once.',
        'So I am baking my shell into glass. It is going... fine. It is going very hot.',
        'I have been here three days. I believe I am now slightly crispy.',
      ];
      if (beat(s, 'vitrius')) return [
        'You have a Great Bead! May I... may I look?',
        '...It\'s so bright.',
        'Mine is... that is, I am... still grey. I\'ll give it another hour. Or ten.',
      ];
      return [pick(['Still annealing. Do I look glassier? Be honest. No, don\'t.', 'A knight must suffer for his quest. This is me suffering. Quite a lot, actually.'])];
    },
  },

  // ======================== Mirrored Deep
  twinseer: {
    name: 'The Twinseer', verb: 'Listen', voice: 4, size: [38, 56], light: 80,
    draw: drawTwinseer,
    talk(g) {
      const s = g.save;
      const L = (text) => ({ text, speaker: 'The Twinseer (left)' });
      const R = (text) => ({ text, speaker: 'The Twinseer (right)' });
      if (first(g, 'twinseer')) return [
        L('We see two of everything. One of them is true.'),
        R('That one.'),
        L('No. That one.'),
        R('Somewhere in the Deep you will meet yourself. You will need a second leap to reach that room. Do not be kind to it.'),
        L('Or be kind to it. We disagree.'),
      ];
      if (beat(s, 'reflection')) return [L('You met yourself.'), R('And won. Or lost.'), L('Same thing, here.')];
      if (beat(s, 'prismwarden')) return [L('The Warden is broken. All the little lights are one light again.'), R('Or a million again. We disagree.')];
      return [pick([L('The Warden broke the bead\'s light so everyone could have some.'), R('Now nobody has enough.'), L('Comet through the crystal. Everything here breaks, if you are fast enough.')])];
    },
  },

  // ======================== Bellfry Heights
  ringer: {
    name: 'Ringer Wren', verb: 'Talk', voice: 4, size: [30, 32],
    draw: paint('bird', { c1: '#9a7a5a', c2: '#6a5040', c3: '#e8c070', eye: '#1a1a22' }, 16),
    talk(g) {
      const s = g.save;
      if (first(g, 'wren')) return [
        'Wind\'s up. Hold onto something. ...You can\'t hold onto anything, can you. Ha. Hold onto your nerve, then.',
        'I\'m Wren. I climb the towers and tie down loose bells before the gale takes them.',
        'The Great Bell up top hasn\'t rung in an age. Cracked. Still has a Great Bead in him for a clapper, they say.',
        'Ringer\'s rule: never ring seven. Seven is for when she answers.',
      ];
      if (beat(s, 'galeharrow')) return ['The wind\'s... stopped?', 'I\'ve never heard the towers this quiet. I don\'t like it. I love it. I don\'t know.'];
      if (beat(s, 'carillon')) return ['Did you hear him? He rang once more as he fell.', 'That was seven.'];
      return [pick([
        'West of the summit there\'s a nest where the wind lives. You\'d need to be very small to get near it.',
        'Mind the updrafts. Mind the downdrafts. Mind the sideways drafts. It\'s all drafts up here.',
      ])];
    },
  },

  rollmaster_cyclone: {
    name: 'Master Vortice', verb: 'Talk', voice: 3, size: [36, 36],
    draw: rollmaster('#d8e8d0', '#3a8a6a', 'cyclone'),
    talk(g, npc) {
      const s = g.save;
      const trio = trioPages(s);
      if (trio) return trio;
      if (s.techniques.cyclone) return ['Up, and around, and up.', 'Whirl calls me aloof. I am merely higher than him. In every sense.'];
      const how = 'Hold Up and charge Bonk, then release for a rising whirl.';
      return { pages: first(g, 'vortice') ? [
        '...',
        'You climbed all this way to bother me. Admirable. Irritating. I am Master Vortice, of the Cyclone.',
        'Hold Up. Charge your Bonk. Release, and rise in a whirl that carries you and cuts everything above.',
        'One thousand two hundred Glints. The view is free.',
      ] : ['The Cyclone. Twelve hundred Glints. Do not haggle; the wind takes it personally.'],
      opts: { choices: [learnTechnique(g, npc, 'cyclone', 1200, 'Cyclone', how), { label: 'Leave' }] } };
    },
  },

  // ======================== Silken Archive
  librarian: {
    name: 'The Librarian', verb: 'Talk', voice: 3, size: [36, 46],
    draw: paint('moth', { c1: '#5a5a8a', c2: 'rgba(170,160,220,0.8)', eye: '#e8d890', wing: 'moth' }, 26, (ctx) => {
      ink(ctx, 1.2); ctx.beginPath(); ctx.arc(4, -30, 3.5, 0, TAU); ctx.moveTo(13.5, -30); ctx.arc(10, -30, 3.5, 0, TAU); ctx.stroke();
    }),
    talk(g) {
      const s = g.save;
      if (first(g, 'librarian')) return [
        'Shhh.',
        '...Welcome to the Silken Archive. All histories are woven here. All of them. Including some that haven\'t happened.',
        'I am the Librarian. I have eaten so many books that I am mostly footnotes.',
        'The Archivist writes every ending. I worry he has written mine. I have eaten nine shelves looking for it.',
      ];
      if (beat(s, 'inkwraith')) return ['The blot is gone from the Blotted Room.', 'It was a spilled history, you know. Something nobody wanted written down. It got angry about being erased.'];
      if (beat(s, 'quill')) return ['He left a note on the lectern.', '"Ending: not yet decided." I\'ve never known him to leave anything undecided. I\'ve been staring at it for hours. It\'s delicious.'];
      return [pick([
        'The Unlent Shelf holds a catalog card about the very first bead. Shelfmark zero. Don\'t eat it. I did, once. It tasted of gold.',
        'Shhh. Not you. The books. They gossip.',
        'Return all books. Even the ones you never borrowed. Especially those.',
      ])];
    },
  },

  // ======================== Rotgut Warrens
  hivedeserter: {
    name: 'Vesp', verb: 'Talk', voice: 2, size: [32, 36],
    draw: paint('wasp', { c1: '#3a3a2a', c2: '#c8b03a', eye: '#fff' }, 22),
    talk(g) {
      const s = g.save;
      if (first(g, 'vesp')) return [
        'Don\'t. Don\'t call them. ...You\'re not a wasp. Good. Good.',
        'I\'m Vesp. I was a blade of the Stinger Court. They told me to sting, and I wouldn\'t. So now I\'m a deserter, and the Court judges deserters.',
        'The Broodmother swallowed a Great Bead so no one could steal it. She glows. The whole hive sleeps curled around her, warm and starving.',
      ];
      if (beat(s, 'stingercourt')) return ['The Court is gone?', 'I don\'t have to hide.', '...I don\'t know how not to hide. I\'ll learn. Will you visit? No. You\'re busy. I\'ll learn anyway.'];
      if (beat(s, 'gnash')) return ['The light\'s out of her. The brood is waking up hungry and confused.', 'But their own. Hungry and their own. That\'s something.', 'The Court is still behind its seal, though. It would take something that bursts every way at once.'];
      return [pick(['Shh. Wings. ...No. Just the wind. There isn\'t any wind. Shh.', 'I\'d rather be judged than be a blade. I wrote that on the Court\'s door. It seemed braver at the time.'])];
    },
  },

  // ======================== Frostlit Reliquary
  frozenpilgrim: {
    name: 'The Frozen Pilgrim', verb: 'Listen', voice: 0, size: [32, 48],
    art: { body: 'knight', c1: '#9ab8d0', c3: '#eef6ff', eye: '#bfe8ff', horns: 0 },
    hideIf: (s) => !!s.flags.pilgrim_gone,
    talk(g) {
      const s = g.save;
      if (beat(s, 'rimehorn')) return {
        pages: [
          'Oh. ...Oh. It\'s thawing. I can feel my feet.',
          'I carried a little warmth all the way up here, for the relics, so they wouldn\'t be lonely.',
          'I think I\'ll keep it. I think I\'ll carry it the rest of the way. Not up. Just... home.',
          'Thank you, small one. Whatever you did, it was warm.',
        ],
        opts: { onEnd: () => { s.flags.pilgrim_gone = 1; } },
      };
      if (first(g, 'pilgrim')) return [
        'I... am... resting.',
        'I carried... a little warmth... all the way... up.',
        'For the relics. So they... would not... be lonely.',
        'I will go on... in a moment. The Stag... keeps the cold. Until he is still... no one... goes on.',
      ];
      return ['...resting...', '...in a moment...'];
    },
  },

  // ======================== The Loom Below
  weaverecho: {
    name: 'Echo of the Weaver', verb: 'Listen', voice: 1, size: [56, 46], light: 90,
    draw: drawWeaverEcho,
    talk(g) {
      const s = g.save;
      if (beat(s, 'weaver')) return [
        'She is resting. Her hands do not know how to rest. They are learning.',
        'She said to you: finish it. She meant: I am sorry. She also meant: finish it.',
        ...(s.items.voidThread ? ['And you carry the thread that is not there. ...She would never have thought of that. I am glad someone did.'] : []),
      ];
      if (first(g, 'weaverecho')) return [
        'Little one. You came all the way down.',
        'I am not her. I am a thread that broke off her a long time ago, and kept working.',
        'She will not give you the key gently. She cannot. She has been holding on for so long that her hands have forgotten every other shape.',
        'You are the last one she made. She loved you most. That will not make her kinder. It may make her harder.',
      ];
      return [pick(['Every thread in every kingdom runs back to this loom. She has been weaving a new strand. Longer. Stronger. No clasp.', 'A hollow can learn to want. She did not know that. Now she does.'])];
    },
  },

  burl_loom: {
    name: 'Sir Burl', verb: 'Talk', voice: 1, size: [40, 32],
    draw: drawBurl('loom'),
    talk(g) {
      const s = g.save;
      if (s.flags.burl_end) return [
        'Sir Burl is curled up tight around himself. He does not uncurl.',
        'He looks, at last, very much like a bead.',
      ];
      return {
        pages: [
          'Squire. Well met. Well... met.',
          'I rolled downhill. It is the only direction I know. I rolled and rolled, and here is the very bottom of everything, and no Moon.',
          'I have been thinking. Knights are permitted to think, at the end of quests.',
          'I think I am not a bead. I think I was only ever round when I was frightened. And I have been frightened, squire, for a very long time.',
          'Here. My fortune. Thirty-seven Glints. A knight\'s ransom. A small knight.',
          'When you get up there, and you will, tell her a knight tried. That is all. Tell her he tried.',
          'I am going to curl up now. Just for a while. Just until I feel brave.',
        ],
        opts: { onEnd: () => { s.flags.burl_end = 1; grantItem(g, { item: 'glints', value: 37 }); } },
      };
    },
  },

  // ======================== Moon's Cradle
  moonchild: {
    name: 'The Moonchild', verb: 'Listen', voice: 5, size: [28, 52], light: 200,
    draw: drawMoonchild,
    talk(g) {
      const s = g.save;
      if (s.endings.B) return ['She\'s rising on her own now. No string. No clasp.', 'She\'s smaller. She\'s brighter. She keeps looking down at all of you and laughing.'];
      if (s.endings.A) return ['You came back. Or something that remembers being you came back.', 'She\'s whole. She says thank you. She says she can feel you, at the back of her neck, where she can\'t see.'];
      if (first(g, 'moonchild')) return [
        'You came.',
        'I\'m what she kept. The last little light that she wouldn\'t let run off.',
        'I know what you are. You sat at the back of her neck where she could never see you. The clasp. The only bead that touched both ends.',
        'Everyone says the strand snapped. It didn\'t. You opened.',
        'If you close again, she\'ll be whole. And you\'ll be the thing that holds. Forever.',
        ...(s.items.voidThread ? [] : ['Unless... below the Loom there\'s a place where things come undone. Something there keeps a thread that isn\'t there.']),
      ];
      if (s.items.voidThread) return ['That thread. It isn\'t there.', 'With that, you could cut what holds her. Not her. What holds her.'];
      return ['She\'s just through there. She\'s cold. She won\'t mean to hurt you.', 'She will, though.'];
    },
  },

  // ======================== Dustmote Dunes
  lintjester: {
    name: 'Motley', verb: 'Talk', voice: 5, size: [30, 30],
    draw: paint('mite', { c1: '#c8b8a0', c2: '#e8dcc8', eye: '#1a1a22' }, 0, (ctx, npc, t) => {
      // jester cap
      const h = npc.h, by = -h * 0.95;
      for (const [s, c] of [[-1, '#a83a4c'], [1, '#3a5aa8']]) {
        ctx.beginPath(); ctx.moveTo(-2, by + 4); ctx.quadraticCurveTo(s * 10, by - 10, s * 14, by + 2 + Math.sin(t * 4 + s) * 2); ctx.quadraticCurveTo(s * 6, by - 2, 2, by + 4);
        fillInk(ctx, c, 1.4);
        ctx.fillStyle = '#ffd860'; ctx.beginPath(); ctx.arc(s * 14, by + 3 + Math.sin(t * 4 + s) * 2, 2.2, 0, TAU); ctx.fill();
      }
    }),
    talk(g) {
      const s = g.save;
      if (first(g, 'motley')) return [
        'BEHOLD! Motley, Jester to His Fluffiness the Lint King! Formerly one of two jesters. Don\'t ask.',
        'Why did the dust bunny cross the floorboards? ...Because it was swept off its feet! Thank you. I\'m here all age.',
        'The other jester? Got too near the Glint Hoarder\'s vault. He\'s in the hoard now. Filed under "shiny".',
      ];
      if (beat(s, 'lintking')) return ['You toppled the King?!', '...Oh, thank goodness. Do you know how hard it is to be funny for a pile of lint? He never laughed. He just shed.'];
      if (beat(s, 'hoarder')) return ['You cracked the Hoard! Did you see a jester in there? Bells on his hat? Awful puns?', '...No? Well. He always did hate being found.'];
      return [pick([
        'What do you call a bead with no thread? Loose! What do you call a bead with no friends? ...Also loose. It\'s a sad joke. They can\'t all be winners.',
        'The King says the Moon is a button. I say nothing. I\'m paid in crumbs.',
        'Knock knock. Who\'s there? Lint. Lint who? Lint me a Glint? No? Worth a try.',
      ])];
    },
  },

  // ======================== Hall of Echoes
  echokeeper: {
    name: 'The Echokeeper', verb: 'Listen', voice: 2, size: [36, 50], light: 120,
    art: { body: 'bell', c1: '#c9a24a', c2: '#fff1c0', eye: '#fff6d0' },
    talk(g) {
      const s = g.save;
      const done = [1, 2, 3, 4].filter((i) => s.flags['pantheon_' + i]).length;
      if (s.endings.C) return ['The First has been answered.', 'The Hall is quiet. For the first time since before the Moon, it is not waiting for anything.'];
      if (first(g, 'echokeeper')) return [
        'You rang the bell. ...They answered.',
        'This is the Hall of Echoes. Everything you have beaten is kept here, in gold. Touch a statue, and it will answer you again. Harder.',
        'Beyond the colonnade are four Pantheons. Four rites. Each asks you to answer many echoes, one after another, without rest.',
        'And there is one who was never asked. Answer all four rites, and the First will ask to be answered.',
      ];
      if (done >= 4) return ['All four rites. The Sanctum is open.', 'Go gently. It has been alone longer than anything.'];
      return [`${done} of four rites answered.`, pick(['Echoes hit harder than memories. That is the point of them.', 'Speak softly. Everything you ever beat is listening.'])];
    },
  },
};

// Talk wrapper: lets choice callbacks continue a conversation with next(npc, res)
for (const def of Object.values(NPCS)) {
  const inner = def.talk;
  def.talk = (g, npc) => {
    if (npc._next) { const r = npc._next; npc._next = null; return r; }
    return inner.call(def, g, npc);
  };
}

function bobbinChat(s) {
  if (s.endings.C) return ['Did you see it? The east went gold. Every candle in my stock is worthless now.', 'I\'ve never been so happy to be ruined.'];
  if (s.endings.B) return ['The Moon looks different. Smaller? Brighter. Like someone took something heavy off her.', 'Good for her. Nobody should wear jewellery that heavy.'];
  if (s.endings.A) return ['I had the strangest dream. You\'d gone up, and you never came down.', 'And then here you are, dripping on my floor. Sit. Dry off. I kept your shelf. I know. I know. Just in case.'];
  if (s.greatBeads >= 6) return ['All six. The Elder\'s gone quiet.', 'When the Elder goes quiet, dear, something is about to happen. Eat something before it does.'];
  if (s.greatBeads >= 1) return ['You\'ve a Great Bead on you. I can see it glowing through your... well, you don\'t have pockets. Through you, then.', 'Does it hurt? Carrying it? You can say.'];
  if (has(s, 'sap') && !s.abilities.lantern) return ['Going down to the Catacombs? Buy a lantern.', 'Don\'t look at me like that. I\'m not upselling. I\'m mothering.'];
  if (has(s, 'sap')) return ['You went down the well and came back up a wall. The whole square\'s talking.', 'Well. I\'m talking. The square is listening.'];
  return ['Down the well is the Hollows. Moss and bells, and a great warm Mother who does not care for visitors.', 'Wipe your feet. On the way back, I mean. Mine are clean.'];
}
