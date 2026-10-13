// Bosses of the Silken Archive: Archivist Quill and the Inkwraith.
import { Boss, registerMinion } from './boss.js';
import { TAU, clamp, lerp } from '../core/math.js';
import { TILE } from '../core/constants.js';
import { INK, eye, PAINTERS } from '../art/creatures.js';
import { registerProjectileArt } from '../entities/projectile.js';
import { moveX } from '../world/movement.js';

// ---------------------------------------------------------------- shared helpers
function scanGround(room, x, y0) {
  for (let y = Math.floor(y0 / TILE) * TILE; y < room.pxH; y += 4) if (room.rectBlocked(x - 2, y, 4, 2)) return y;
  return room.pxH - TILE;
}
function hurtPlayer(boss, srcX) {
  const p = boss.player;
  if (p.dead || p.invuln > 0) return;
  p.hurt(1, srcX);
}
function segDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
  const k = clamp(((px - x0) * dx + (py - y0) * dy) / L2, 0, 1);
  return Math.hypot(px - (x0 + dx * k), py - (y0 + dy * k));
}
// clip the infinite line through (x,y) with angle a to the rect
function lineAcross(x, y, a, R) {
  const dx = Math.cos(a), dy = Math.sin(a);
  let t0 = -1e6, t1 = 1e6;
  for (const [p, d, lo, hi] of [[x, dx, R.x, R.x + R.w], [y, dy, R.y, R.y + R.h]]) {
    if (Math.abs(d) < 1e-6) continue;
    let a0 = (lo - p) / d, a1 = (hi - p) / d;
    if (a0 > a1) [a0, a1] = [a1, a0];
    t0 = Math.max(t0, a0); t1 = Math.min(t1, a1);
  }
  return { x0: x + dx * t0, y0: y + dy * t0, x1: x + dx * t1, y1: y + dy * t1 };
}
const W = (white, c) => (white ? '#fff' : c);
const INKC = '#0e0c16';

// ---------------------------------------------------------------- art for minions / projectiles
PAINTERS.inkling = function inkling(ctx, e, t, A) {
  const w = e.w, h = e.h, ph = e.anim * 7;
  const sq = 1 + Math.sin(ph) * 0.08;
  ctx.beginPath();
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI;
    const r = 1 + Math.sin(i * 2.3 + ph) * 0.07;
    ctx.lineTo(Math.cos(a) * w * 0.5 * r / sq, Math.sin(a) * h * 0.9 * r * sq);
  }
  ctx.quadraticCurveTo(w * 0.6, 2, 0, 1);
  ctx.quadraticCurveTo(-w * 0.6, 2, -w * 0.5 / sq, 0);
  ctx.fillStyle = A.c1; ctx.fill();
  ctx.strokeStyle = A.c2 || '#6f64b8'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = A.c1;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-w * 0.3 + i * w * 0.3, 2, 3, 4 + Math.sin(ph + i) * 2, 0, 0, TAU); ctx.fill(); }
  eye(ctx, w * 0.12, -h * 0.55 * sq, 2.6, A.eye || '#d9c8ff', true, 'angry');
  eye(ctx, w * 0.32, -h * 0.5 * sq, 2.2, A.eye || '#d9c8ff', true, 'angry');
};

registerMinion({
  id: 'quilltome', name: 'Errant Tome', hp: 30, dmg: 1, size: [34, 28],
  behavior: 'dasher', params: { speed: 470, interval: 2.2, sight: 520 },
  art: { body: 'book', c1: '#3a2f6a', c3: '#efe6cf', eye: '#7fd8ff', centered: true },
  journal: 'Books the Archivist has called from their shelves. They do not like to be read without permission.',
});
registerMinion({
  id: 'inkling', name: 'Inkling', hp: 26, dmg: 1, size: [34, 24],
  behavior: 'stalker', params: { speed: 140, jump: 640 },
  art: { body: 'inkling', c1: INKC, c2: '#6f64b8', eye: '#d9c8ff' },
  journal: 'Splashes of the Inkwraith that crawl back toward it. Each one remembers being a word.',
});

registerProjectileArt('glyph', (ctx, p, t) => {
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(Math.sin(t * 5 + p.age * 3) * 0.25);
  ctx.font = 'italic bold 32px "IM Fell English", Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(127,216,255,0.25)';
  ctx.beginPath(); ctx.arc(0, 0, p.r * 1.8, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = 4; ctx.strokeStyle = '#b8e8ff'; ctx.strokeText(p.o.ch || 'A', 0, 1);
  ctx.fillStyle = INKC; ctx.fillText(p.o.ch || 'A', 0, 1);
  ctx.restore();
});
registerProjectileArt('page', (ctx, p, t) => {
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.age * 7 + p.r);
  ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(p.age * 9)));
  ctx.fillStyle = '#efe6cf'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.rect(-8, -10, 16, 20); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(40,30,60,0.6)'; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-5, -6 + i * 4); ctx.lineTo(5 - (i % 2) * 3, -6 + i * 4); ctx.stroke(); }
  ctx.restore();
});
registerProjectileArt('inkdrop', (ctx, p, t) => {
  const r = p.r;
  ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(Math.atan2(p.vy, p.vx) - Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(0, -r * 2.2);
  ctx.quadraticCurveTo(r * 1.1, -r * 0.2, r, r * 0.3);
  ctx.arc(0, r * 0.3, r, 0, Math.PI);
  ctx.quadraticCurveTo(-r * 1.1, -r * 0.2, 0, -r * 2.2);
  ctx.fillStyle = INKC; ctx.fill();
  ctx.strokeStyle = '#7d70d0'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(220,210,255,0.7)'; ctx.beginPath(); ctx.arc(-r * 0.35, 0, r * 0.25, 0, TAU); ctx.fill();
  ctx.restore();
});

// calligraphic stroke: tapered, swelling ribbon from (x0,y0) to (x1,y1) drawn up to fraction k
function inkStroke(ctx, S, k, th, fill, rim, seed) {
  const n = 24, dx = S.x1 - S.x0, dy = S.y1 - S.y0, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * k;
    const wob = Math.sin(u * 9 + seed) * 6;
    const wd = th * (0.25 + 0.75 * Math.sin(Math.PI * clamp(u / Math.max(k, 0.001), 0, 1)) ** 0.6) * (0.85 + 0.15 * Math.sin(u * 23 + seed));
    pts.push([S.x0 + dx * u + nx * wob, S.y0 + dy * u + ny * wob, wd]);
  }
  ctx.beginPath();
  pts.forEach(([x, y, w], i) => (i ? ctx.lineTo(x + nx * w / 2, y + ny * w / 2) : ctx.moveTo(x + nx * w / 2, y + ny * w / 2)));
  for (let i = pts.length - 1; i >= 0; i--) { const [x, y, w] = pts[i]; ctx.lineTo(x - nx * w / 2, y - ny * w / 2); }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (rim) { ctx.strokeStyle = rim; ctx.lineWidth = 2; ctx.stroke(); }
}

// ================================================================= ARCHIVIST QUILL
// Keeper of every record. A tall robed scribe with a pale, bespectacled mask, a quill longer than
// itself and a pot of ink that never empties. It writes the hall full of strokes, throws words,
// calls books from the shelves, and at the last writes Bead's ending into the margins.
const QW = 96, QH = 210;
const QC = { robe: '#2c2d63', robeDk: '#17173a', gold: '#d9b45a', mask: '#ece6d6', eye: '#7fd8ff', vane: '#f0e8d4', ink: INKC };
const QREST = 1.15;
const WORDS = [['HUSH', 'READ', 'LOST', 'MUTE'], ['ERASE', 'BOUND', 'BLOT'], ['THE END', 'FINIS', 'AMEN']];

export class ArchivistQuill extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'quill', size: [QW, QH], music: 'boss_keeper', glints: 340, introTime: 2.4 });
    if (this.dead) return;
    this.noPhysics = true;
    this.groundY = this.findGround();
    this.hover = 10;
    this.y = this.groundY - this.h - this.hover;
    this.quillAng = QREST;      // angle of the quill relative to "up/forward"
    this.quillTarget = QREST;
    this.nib = null;           // world point the nib is writing at
    this.strokes = [];
    this.glyphs = [];          // hovering letters before they're thrown
    this.swirl = 0;            // pages orbiting (0..1)
    this.fade = 1;             // 0 = dissolved into pages
    this.stabK = 0;
    this.lean = 0;
    this.inkL = 0; this.inkR = 0; this.inkTarget = 0;
    this.writeOpen = 0;
  }

  get floorX0() { return this.arena.x + this.inkL; }
  get floorX1() { return this.arena.x + this.arena.w - this.inkR; }

  idle(dt) { this.float(dt); }
  introUpdate(dt, t) {
    this.float(dt);
    this.quillTarget = t < 1.2 ? QREST + Math.sin(t * 3) * 0.2 : -1.9;
    this.writeOpen = clamp(t - 0.6, 0, 1);
    if (t > 1.0 && Math.random() < 0.4) this.fx.add({ x: this.cx + this.rand(-80, 80), y: this.y + this.rand(0, this.h), vx: this.rand(-40, 40), vy: -this.rand(20, 80), life: 1, size: 3, color: 'rgba(239,230,207,0.7)', shape: 'shard', g: -20, front: false });
  }
  float(dt) {
    this.y = this.groundY - this.h - this.hover - Math.sin(this.anim * 1.8) * 4;
    this.quillAng += (this.quillTarget - this.quillAng) * Math.min(1, dt * 10);
  }

  think(dt) {
    this.float(dt);
    const p = this.player;
    // strokes
    for (const S of this.strokes) {
      S.t += dt;
      const live = S.t > S.tele && S.t < S.tele + S.live;
      if (live && segDist(p.cx, p.cy, S.x0, S.y0, S.x1, S.y1) < S.th / 2 + 8) hurtPlayer(this, (S.x0 + S.x1) / 2);
      if (S.t > S.tele && !S.rang) { S.rang = true; this.sfx('slash'); this.shake(3, 0.12); }
    }
    this.strokes = this.strokes.filter((S) => S.t < S.tele + S.live + 0.9);
    // the ending: ink rising in the margins
    if (this.inkTarget > 0) {
      this.inkL = Math.min(this.inkTarget, this.inkL + 42 * dt);
      this.inkR = Math.min(this.inkTarget, this.inkR + 42 * dt);
      const A = this.arena, b = p.b;
      const inL = this.inkL > 4 && b.x < A.x + this.inkL - 6, inR = this.inkR > 4 && b.x + b.w > A.x + A.w - this.inkR + 6;
      if ((inL || inR) && this.mode === 'fight' && !p.dead) {
        hurtPlayer(this, inL ? A.x - 100 : A.x + A.w + 100);
        if (!this.game.cutscene) moveX(b, this.game.room, (inL ? 1 : -1) * 260 * dt, 0);
      }
      this.x = clamp(this.x, this.floorX0 + 10, this.floorX1 - this.w - 10);
    }
    for (const G of this.glyphs) G.t += dt;
  }

  *during(sec, fn) {
    const T = sec / this.speedMul;
    for (let t = 0; t < T; t += 1 / 60) { fn(t / T, t); yield; }
    fn(1, T);
  }

  attackList() {
    const d = this.distX();
    return [
      { name: 'strokes', w: 3, fn: this.strokesAtk },
      { name: 'letters', w: 2.2, fn: this.lettersAtk },
      { name: 'books', w: this.minions.length < 2 ? (this.phase >= 2 ? 1.5 : 1) : 0, fn: this.booksAtk },
      { name: 'pages', w: this.phase >= 2 ? 2 : 1, fn: this.pageStorm },
      { name: 'stab', w: d < 230 ? 3 : 0.3, fn: this.stab },
      { name: 'turn', w: d < 140 ? 2 : 0.4, fn: this.turnPage },
    ];
  }

  // ----- Ink Strokes: hairlines sketched across the hall, then inked thick
  *strokesAtk() {
    this.facePlayer();
    this.tele = 0.5; this.sfx('rustle');
    this.quillTarget = -0.4;
    const waves = this.phase >= 3 ? 2 : this.phase >= 2 ? 2 : 3;
    const per = this.phase >= 3 ? 3 : this.phase >= 2 ? 2 : 1;
    for (let w = 0; w < waves; w++) {
      const A = this.arena;
      const R = { x: this.floorX0, y: A.y, w: this.floorX1 - this.floorX0, h: this.groundY - A.y };
      const px = this.player.cx, py = this.player.cy;
      const kinds = per === 1 ? [this.pick(['horiz', 'diag', 'vert', 'diag'])]
        : per === 2 ? this.pick([['diag', 'diagB'], ['horiz', 'vert'], ['diag', 'vert']])
        : ['diag', 'diagB', 'horiz'];
      for (let i = 0; i < kinds.length; i++) {
        const kind = kinds[i];
        let a, y = py, x = px;
        if (kind === 'horiz') { a = this.rand(-0.06, 0.06); y = Math.min(py, this.groundY - 16); }
        else if (kind === 'vert') a = Math.PI / 2 + this.rand(-0.12, 0.12);
        else a = (kind === 'diagB' ? -1 : 1) * this.rand(0.55, 0.85);
        const seg = lineAcross(x, y, a, R);
        if (Math.random() < 0.5) [seg.x0, seg.y0, seg.x1, seg.y1] = [seg.x1, seg.y1, seg.x0, seg.y0];
        this.strokes.push(Object.assign(seg, { t: -i * 0.12, tele: 0.75, live: 0.38, th: 22, seed: Math.random() * 10 }));
      }
      // the quill traces the newest stroke
      const S = this.strokes[this.strokes.length - 1];
      yield* this.during(0.75, (k) => {
        this.nib = { x: lerp(S.x0, S.x1, k), y: lerp(S.y0, S.y1, k) };
        this.quillTarget = clamp(Math.atan2(this.nib.y - (this.y + 70), (this.nib.x - this.cx) * this.facing), -2.6, 1.5);
        this.lean = Math.sin(k * Math.PI) * 0.12;
      });
      this.nib = null; this.lean = 0;
      yield 0.55;
    }
    this.quillTarget = QREST;
    yield 0.5;
  }

  // ----- Thrown Words: letters lift off the page, hang, then fly at Bead one by one
  *lettersAtk() {
    this.facePlayer();
    this.quillTarget = -1.9; this.tele = 0.5; this.sfx('rustle');
    const word = this.pick(WORDS[Math.min(2, this.phase - 1)]);
    const chars = word.split('').filter((c) => c !== ' ');
    const cx = this.cx, cy = this.y + 10;
    this.glyphs = chars.map((ch, i) => {
      const a = -Math.PI / 2 + (i - (chars.length - 1) / 2) * 0.42;
      return { ch, x: cx + Math.cos(a) * 120, y: cy + Math.sin(a) * 90, t: -i * 0.06 };
    });
    yield 0.65;
    const sp = 310 + this.phase * 30;
    for (const G of this.glyphs.slice()) {
      this.fireAt(G.x, G.y, sp, { art: 'glyph', ch: G.ch, r: 12, life: 4, color: '#b8e8ff' });
      this.glyphs.shift();
      this.sfx('throw');
      this.quillTarget = this.quillTarget < 0 ? 0.9 : -1.2;
      yield this.phase >= 3 ? 0.17 : 0.24;
    }
    this.glyphs = [];
    this.quillTarget = QREST;
    yield 0.8;
  }

  // ----- Errant Tomes: books fly down from the shelves
  *booksAtk() {
    this.tele = 0.6; this.writeOpen = 1; this.sfx('rustle');
    this.quillTarget = -2.6;
    yield 0.6;
    const n = this.phase >= 2 ? 2 : 1;
    const A = this.arena;
    for (let i = 0; i < n; i++) {
      const x = clamp(this.cx + (i ? 1 : -1) * this.rand(140, 260), this.floorX0 + 40, this.floorX1 - 40);
      const e = this.summon('quilltome', Math.floor(x / TILE), Math.floor((A.y + 90) / TILE));
      if (e) this.fx.burst(e.cx, e.cy, 10, { color: '#efe6cf', speed: 160, size: 3, life: 0.6, shape: 'shard' });
      this.sfx('burst');
      yield 0.3;
    }
    this.quillTarget = QREST;
    yield 0.8;
  }

  // ----- Page Storm: it lifts into a whirl of loose pages that spiral out in arms
  *pageStorm() {
    this.tele = 0.7; this.sfx('rustle');
    const h0 = this.hover;
    yield* this.during(0.7, (k) => { this.swirl = k; this.hover = lerp(h0, 120, k); });
    const arms = this.phase >= 2 ? 4 : 3;
    const dur = 2.4;
    let a = Math.random() * TAU;
    const spin = (Math.random() < 0.5 ? 1 : -1) * 1.5;
    let acc = 0;
    yield* this.during(dur, (k, t) => {
      a += spin / 60;
      acc += 1 / 60;
      if (acc >= 0.14) {
        acc = 0;
        const cx = this.cx, cy = this.y + this.h * 0.45;
        for (let i = 0; i < arms; i++) {
          const b = a + (i / arms) * TAU;
          this.fire(cx + Math.cos(b) * 30, cy + Math.sin(b) * 30, Math.cos(b) * 185, Math.sin(b) * 185, { art: 'page', r: 9, life: 4.5 });
          if (this.phase >= 3 && i % 2 === 0) { const c = -a * 1.3 + (i / arms) * TAU; this.fire(cx, cy, Math.cos(c) * 150, Math.sin(c) * 150, { art: 'page', r: 9, life: 4.5 }); }
        }
        this.sfx('rustle');
      }
    });
    yield* this.during(0.5, (k) => { this.swirl = 1 - k; this.hover = lerp(120, 10, k); });
    this.hover = 10; this.swirl = 0;
    yield 0.6;
  }

  // ----- Nib Thrust: draws the quill back, then lunges it along the floor
  *stab() {
    this.facePlayer();
    this.tele = 0.5; this.sfx('charge');
    yield* this.during(0.5, (k) => { this.stabK = -k; this.quillTarget = 0.2; });
    this.sfx('thrust');
    const reach = 230;
    const x = this.facing > 0 ? this.cx + 10 : this.cx - reach - 10;
    this.zone(x, this.groundY - 46, reach, 38, 0.22);
    this.fx.slash(this.cx + this.facing * (reach * 0.6), this.groundY - 28, this.facing > 0 ? 0 : Math.PI, reach * 0.9, 'rgba(184,232,255,0.8)', 0.2);
    yield* this.during(0.12, (k) => { this.stabK = k; this.x = clamp(this.x + this.facing * 5, this.floorX0, this.floorX1 - this.w); });
    if (this.phase >= 2) {
      // flick of ink off the nib
      for (let i = 0; i < 3; i++) this.fire(this.cx + this.facing * reach * 0.8, this.groundY - 40, this.facing * this.rand(60, 220), -this.rand(380, 560), { gravity: 1200, art: 'inkdrop', r: 7, life: 3 });
    }
    yield 0.35;
    yield* this.during(0.3, (k) => { this.stabK = 1 - k; });
    this.stabK = 0; this.quillTarget = QREST;
    yield 0.5;
  }

  // ----- Turn the Page: it dissolves into pages and reappears across the room
  *turnPage() {
    this.sfx('rustle');
    this.tele = 0.4;
    yield* this.during(0.4, (k) => { this.fade = 1 - k; this.swirl = k; });
    this.hittable = false;
    this.fx.burst(this.cx, this.cy, 18, { color: '#efe6cf', speed: 260, size: 3.5, life: 0.7, shape: 'shard' });
    const A = this.arena, p = this.player;
    const side = p.cx < A.x + A.w / 2 ? 1 : -1;
    const nx = clamp(p.cx + side * this.rand(260, 380), this.floorX0 + 20, this.floorX1 - this.w - 20);
    yield 0.35;
    this.x = nx - this.w / 2;
    this.facePlayer();
    this.fx.burst(this.cx, this.cy, 18, { color: '#efe6cf', speed: 200, size: 3.5, life: 0.6, shape: 'shard' });
    yield* this.during(0.35, (k) => { this.fade = k; this.swirl = 1 - k; });
    this.fade = 1; this.swirl = 0;
    this.hittable = this.mode === 'fight';
    yield 0.3;
  }

  onPhase(n) {
    this.sfx('bossRoar'); this.shake(6, 0.6); this.tele = 0.8;
    if (n === 3) { this.co = this.writeEnding(); this.wait = 0; }
  }

  *writeEnding() {
    this.glyphs = []; this.nib = null; this.stabK = 0;
    this.fade = 1; this.swirl = 0; this.hittable = true; this.harmful = true;
    const A = this.arena;
    // move to the middle of the page
    const mid = A.x + A.w / 2 - this.w / 2;
    this.sfx('rustle');
    yield* this.during(0.6, (k) => { this.x = lerp(this.x, mid, 0.12); });
    this.quillTarget = -2.5; this.tele = 1.2; this.writeOpen = 1;
    const text = 'and then, the end.';
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== ' ') this.fx.text(this.cx - 130 + i * 15, this.y - 30 + Math.sin(i) * 4, text[i], '#b8e8ff', 22);
      if (i % 3 === 0) this.sfx('tick');
      yield 0.05;
    }
    this.sfx('bossRoar'); this.shake(8, 1.2);
    this.game.flash('rgba(14,12,22,0.6)', 0.5);
    this.inkTarget = Math.min(A.w * 0.2, Math.max(0, (A.w - 520) / 2));
    yield 1.2;
    this.quillTarget = QREST;
  }

  onDeath() { this.strokes = []; this.glyphs = []; this.nib = null; this.inkTarget = 0; this.swirl = 0; this.fade = 1; }

  bodyBox() {
    if (this.fade < 0.5) return { x: this.cx - 4, y: this.cy - 4, w: 8, h: 8 };
    return { x: this.x + 16, y: this.y + 30, w: this.w - 32, h: this.h - 34 };
  }
  hitboxes() {
    const r = this.bodyBox();
    return this.harmful && this.fade > 0.5 ? [r, ...this.hits] : [...this.hits];
  }

  // ---------- drawing ----------
  drawBody(ctx, t, white) {
    const f = this.facing;
    const bx = this.cx, by = this.y + this.h;
    ctx.save();
    ctx.translate(bx, by);
    if (!white) ctx.globalAlpha = clamp(this.fade, 0, 1);
    ctx.rotate(this.lean * f);
    ctx.scale(f, 1);
    const h = QH, w = QW;
    if (!white) {
      const g = ctx.createRadialGradient(0, -h * 0.55, 10, 0, -h * 0.55, h * 0.75);
      g.addColorStop(0, 'rgba(231,201,106,0.16)'); g.addColorStop(1, 'rgba(231,201,106,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -h * 0.55, h * 0.75, 0, TAU); ctx.fill();
    }
    // orbiting pages (back half)
    this.drawPages(ctx, t, white, -1);
    // ink pot hand (behind)
    const potX = -w * 0.42, potY = -h * 0.42 + Math.sin(t * 2) * 2;
    ctx.strokeStyle = W(white, QC.robeDk); ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(-w * 0.2, -h * 0.74); ctx.quadraticCurveTo(-w * 0.5, -h * 0.62, potX, potY - 14); ctx.stroke();
    ctx.strokeStyle = W(white, INK); ctx.lineWidth = 2; ctx.stroke();
    // ink pot
    ctx.beginPath(); ctx.ellipse(potX, potY, 17, 14, 0, 0, TAU);
    ctx.fillStyle = W(white, '#3c3a6e'); ctx.fill(); ctx.strokeStyle = W(white, INK); ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.rect(potX - 7, potY - 20, 14, 7); ctx.fillStyle = W(white, QC.gold); ctx.fill(); ctx.stroke();
    if (!white) {
      ctx.fillStyle = INKC; ctx.beginPath(); ctx.ellipse(potX, potY + 3, 12, 8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(200,230,255,0.6)'; ctx.beginPath(); ctx.ellipse(potX - 7, potY - 5, 3, 5, 0.4, 0, TAU); ctx.fill();
      eye(ctx, potX, potY + 2, 2.2 + this.writeOpen, '#7fd8ff', true);
    }
    // robe
    const sway = Math.sin(t * 2.1) * 4;
    ctx.beginPath();
    ctx.moveTo(-w * 0.24, -h * 0.8);
    ctx.quadraticCurveTo(-w * 0.42, -h * 0.4, -w * 0.58 + sway, -h * 0.04);
    // tattered paper hem
    const N = 9;
    for (let i = 0; i <= N; i++) {
      const x = lerp(-w * 0.58 + sway, w * 0.58 + sway, i / N);
      const y = (i % 2 ? 6 + Math.sin(t * 5 + i) * 4 : -4) - 0;
      ctx.lineTo(x, y);
    }
    ctx.quadraticCurveTo(w * 0.42, -h * 0.4, w * 0.24, -h * 0.8);
    ctx.closePath();
    if (white) ctx.fillStyle = '#fff';
    else { const g = ctx.createLinearGradient(-w * 0.5, 0, w * 0.5, 0); g.addColorStop(0, QC.robeDk); g.addColorStop(0.55, QC.robe); g.addColorStop(1, QC.robeDk); ctx.fillStyle = g; }
    ctx.fill();
    ctx.strokeStyle = W(white, INK); ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
    if (!white) {
      // gold trim and embroidered script
      ctx.strokeStyle = QC.gold; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(w * 0.06, -h * 0.78); ctx.quadraticCurveTo(w * 0.12, -h * 0.4, w * 0.16 + sway * 0.5, -h * 0.02); ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-w * 0.55 + sway, -h * 0.1); ctx.quadraticCurveTo(0, -h * 0.07, w * 0.55 + sway, -h * 0.1); ctx.stroke();
      ctx.strokeStyle = 'rgba(217,180,90,0.55)'; ctx.lineWidth = 1.2;
      for (let r = 0; r < 4; r++) {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const x = -w * 0.32 + i * 6, y = -h * (0.55 - r * 0.1) + Math.sin(i * 1.7 + r) * 3;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    }
    // high collar / mantle
    ctx.beginPath();
    ctx.moveTo(-w * 0.36, -h * 0.74);
    ctx.quadraticCurveTo(-w * 0.3, -h * 0.9, 0, -h * 0.86);
    ctx.quadraticCurveTo(w * 0.32, -h * 0.9, w * 0.36, -h * 0.74);
    ctx.quadraticCurveTo(0, -h * 0.66, -w * 0.36, -h * 0.74);
    ctx.fillStyle = W(white, '#3a3b7a'); ctx.fill();
    ctx.strokeStyle = W(white, INK); ctx.lineWidth = 2.5; ctx.stroke();
    if (!white) { ctx.strokeStyle = QC.gold; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-w * 0.33, -h * 0.745); ctx.quadraticCurveTo(0, -h * 0.68, w * 0.33, -h * 0.745); ctx.stroke(); }
    // neck + head
    const hx = w * 0.06, hy = -h * 0.93 + Math.sin(t * 1.8 + 1) * 2;
    ctx.strokeStyle = W(white, QC.robeDk); ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(0, -h * 0.82); ctx.lineTo(hx, hy + 10); ctx.stroke();
    this.drawHead(ctx, hx, hy, t, white);
    // orbiting pages (front half)
    this.drawPages(ctx, t, white, 1);
    // quill arm + quill
    this.drawQuill(ctx, t, white);
    ctx.restore();
  }

  drawHead(ctx, x, y, t, white) {
    // tall folded scholar's cap
    ctx.beginPath();
    ctx.moveTo(x - 18, y - 18);
    ctx.lineTo(x - 14, y - 58);
    ctx.quadraticCurveTo(x + 4, y - 70, x + 20, y - 60);
    ctx.lineTo(x + 18, y - 18);
    ctx.closePath();
    ctx.fillStyle = W(white, '#232456'); ctx.fill(); ctx.strokeStyle = W(white, INK); ctx.lineWidth = 2.5; ctx.stroke();
    if (!white) {
      ctx.strokeStyle = QC.gold; ctx.lineWidth = 1.5;
      for (const k of [0.35, 0.6]) { ctx.beginPath(); ctx.moveTo(x - 16 + k * 2, y - 18 - k * 44); ctx.lineTo(x + 19 - k * 1, y - 18 - k * 44); ctx.stroke(); }
      // ribbon bookmark
      ctx.strokeStyle = '#b8323e'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + 18, y - 56); ctx.quadraticCurveTo(x + 30, y - 30 + Math.sin(t * 3) * 5, x + 26, y - 4 + Math.sin(t * 3.4) * 6); ctx.stroke();
    }
    // long narrow mask
    ctx.beginPath();
    ctx.moveTo(x - 16, y - 16);
    ctx.quadraticCurveTo(x - 18, y + 14, x - 4, y + 34);
    ctx.quadraticCurveTo(x + 2, y + 40, x + 8, y + 34);
    ctx.quadraticCurveTo(x + 20, y + 14, x + 17, y - 16);
    ctx.quadraticCurveTo(x, y - 22, x - 16, y - 16);
    ctx.fillStyle = W(white, QC.mask); ctx.fill(); ctx.strokeStyle = W(white, INK); ctx.lineWidth = 2.5; ctx.stroke();
    if (white) return;
    // spectacles
    const ec = this.phase >= 3 ? '#c9f0ff' : QC.eye;
    for (const s of [-1, 1]) {
      const ex = x + 1 + s * 7.5, ey = y - 2;
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(ex, ey, 5, 6.5, 0, 0, TAU); ctx.fill();
      eye(ctx, ex + 1, ey + 0.5, 2 + (this.tele > 0 ? 0.8 : 0), ec, true);
      ctx.strokeStyle = QC.gold; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(ex, ey, 7.5, 0, TAU); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(x - 1, y - 2); ctx.lineTo(x + 3, y - 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x + 9, y - 4, 4.5, -2.2, -1.4); ctx.stroke();
    // ink tear stains
    ctx.strokeStyle = 'rgba(14,12,22,0.75)'; ctx.lineWidth = 1.8;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + 1 + s * 7.5, y + 6); ctx.quadraticCurveTo(x + s * 9, y + 16, x + 1 + s * 6, y + 24 + (s > 0 ? 3 : 0)); ctx.stroke(); }
    if (this.phase >= 2) { ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x + 12, y - 16); ctx.lineTo(x + 8, y - 8); ctx.lineTo(x + 13, y + 2); ctx.stroke(); }
  }

  drawQuill(ctx, t, white) {
    const h = QH, w = QW;
    const sx = w * 0.18, sy = -h * 0.72;
    const reach = 46 + this.stabK * 40;
    // local angle: quillAng is measured in world-ish terms; convert so 0 = forward, negative = up
    const a = this.quillAng;
    const hx = sx + Math.cos(a) * reach * 0.3 + 26 + this.stabK * 30, hy = sy + 40 + Math.sin(a) * 8;
    // sleeve
    ctx.strokeStyle = W(white, QC.robeDk); ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx - 6, sy + 4); ctx.quadraticCurveTo(sx + 26, sy + 10, hx, hy); ctx.stroke();
    ctx.strokeStyle = W(white, INK); ctx.lineWidth = 2; ctx.stroke();
    // thin pale hand
    ctx.fillStyle = W(white, QC.mask); ctx.beginPath(); ctx.ellipse(hx, hy, 6, 5, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = W(white, INK); ctx.lineWidth = 1.5; ctx.stroke();
    // the quill: a long feather, nib toward angle a
    const L = h * 1.05;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(a);
    // nib (forward, +x)
    ctx.beginPath(); ctx.moveTo(L * 0.28, 0); ctx.lineTo(L * 0.2, -4); ctx.lineTo(L * 0.2, 4); ctx.closePath();
    ctx.fillStyle = W(white, QC.gold); ctx.fill(); ctx.strokeStyle = W(white, INK); ctx.lineWidth = 1.5; ctx.stroke();
    if (!white) { ctx.fillStyle = INKC; ctx.beginPath(); ctx.arc(L * 0.28, 0, 2.5, 0, TAU); ctx.fill(); }
    // shaft
    ctx.strokeStyle = W(white, '#3b3020'); ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(L * 0.2, 0); ctx.lineTo(-L * 0.72, 0); ctx.stroke();
    // vane
    ctx.beginPath();
    ctx.moveTo(-L * 0.05, 0);
    ctx.quadraticCurveTo(-L * 0.3, -26, -L * 0.72, -6);
    ctx.quadraticCurveTo(-L * 0.4, 6, -L * 0.05, 0);
    ctx.moveTo(-L * 0.12, 0);
    ctx.quadraticCurveTo(-L * 0.35, 18, -L * 0.7, 4);
    ctx.quadraticCurveTo(-L * 0.4, 2, -L * 0.12, 0);
    ctx.fillStyle = W(white, QC.vane); ctx.fill();
    ctx.strokeStyle = W(white, INK); ctx.lineWidth = 2; ctx.stroke();
    if (!white) {
      ctx.strokeStyle = 'rgba(120,110,150,0.6)'; ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const u = -L * 0.12 - i * L * 0.048;
        const flut = Math.sin(t * 6 + i) * 1.5;
        ctx.beginPath(); ctx.moveTo(u, 0); ctx.lineTo(u - 10, -14 + Math.abs(i - 6) * 1.2 + flut); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(u, 0); ctx.lineTo(u - 8, 10 - Math.abs(i - 6) * 0.8 + flut); ctx.stroke();
      }
      // ink dripping from the nib
      const dr = (t * 1.3) % 1;
      ctx.fillStyle = INKC; ctx.beginPath(); ctx.ellipse(L * 0.28, 4 + dr * 10, 2, 3 + dr * 2, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  drawPages(ctx, t, white, side) {
    const k = this.swirl;
    const n = 6 + Math.round(k * 10);
    for (let i = 0; i < n; i++) {
      const a = t * (0.8 + k * 3) + i * (TAU / n);
      const z = Math.sin(a);
      if ((z >= 0 ? 1 : -1) !== side) continue;
      const rx = 58 + k * 40, ry = 14 + k * 30;
      const x = Math.cos(a) * rx, y = -QH * (0.25 + 0.5 * ((i * 0.37) % 1)) + z * ry * 0.3 - k * 30;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a * 1.7 + i);
      ctx.scale(1, 0.4 + 0.6 * Math.abs(Math.cos(a * 2)));
      ctx.fillStyle = W(white, '#efe6cf'); ctx.strokeStyle = W(white, INK); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.rect(-6, -8, 12, 16); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  drawExtra(ctx, t) {
    const A = this.arena;
    // strokes
    for (const S of this.strokes) {
      if (S.t < 0) continue;
      if (S.t < S.tele) {
        const k = S.t / S.tele;
        ctx.save();
        ctx.strokeStyle = `rgba(184,232,255,${0.35 + 0.45 * k})`; ctx.lineWidth = 1.5 + k;
        ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.moveTo(S.x0, S.y0); ctx.lineTo(lerp(S.x0, S.x1, Math.min(1, k * 1.4)), lerp(S.y0, S.y1, Math.min(1, k * 1.4))); ctx.stroke();
        ctx.restore();
        if (k > 0.75) { ctx.strokeStyle = `rgba(255,255,255,${(k - 0.75) * 3})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(S.x0, S.y0); ctx.lineTo(S.x1, S.y1); ctx.stroke(); }
      } else {
        const lt = S.t - S.tele;
        const k = Math.min(1, lt / 0.08);
        const fade = lt < S.live ? 1 : clamp(1 - (lt - S.live) / 0.9, 0, 1);
        ctx.globalAlpha = fade;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        inkStroke(ctx, S, k, S.th + 10, `rgba(127,216,255,${lt < S.live ? 0.4 : 0.06})`, null, S.seed);
        ctx.restore();
        inkStroke(ctx, S, k, S.th * (lt < S.live ? 1 : 0.7), INKC, lt < S.live ? '#a89cf5' : null, S.seed);
        // drips
        if (lt > 0.1) {
          ctx.fillStyle = INKC;
          for (let i = 1; i < 6; i++) {
            const u = i / 6, x = lerp(S.x0, S.x1, u), y = lerp(S.y0, S.y1, u);
            const dl = Math.min(30, (lt - 0.1) * 40) * ((i * 7) % 3 + 1) / 3;
            ctx.beginPath(); ctx.ellipse(x, y + S.th * 0.3 + dl, 2.5, 3 + dl * 0.3, 0, 0, TAU); ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }
    }
    // nib spark while writing
    if (this.nib) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(this.nib.x, this.nib.y, 0, this.nib.x, this.nib.y, 22);
      g.addColorStop(0, 'rgba(184,232,255,0.8)'); g.addColorStop(1, 'rgba(184,232,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.nib.x, this.nib.y, 22, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // hovering letters
    for (const G of this.glyphs) {
      if (G.t < 0) continue;
      const k = Math.min(1, G.t * 4);
      ctx.save(); ctx.translate(G.x, G.y - (1 - k) * 20 + Math.sin(t * 6 + G.x) * 3);
      ctx.globalAlpha = k;
      ctx.font = 'italic bold 32px "IM Fell English", Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(127,216,255,0.3)'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 4; ctx.strokeStyle = '#b8e8ff'; ctx.strokeText(G.ch, 0, 1);
      ctx.fillStyle = INKC; ctx.fillText(G.ch, 0, 1);
      ctx.restore();
    }
    // the ending: ink filling the margins
    if (this.inkL > 0 || this.inkR > 0) {
      const top = A.y - 40, bot = this.groundY + 6;
      for (const s of [-1, 1]) {
        const wdt = s < 0 ? this.inkL : this.inkR;
        if (wdt <= 0) continue;
        const edge = s < 0 ? A.x + wdt : A.x + A.w - wdt;
        const outer = s < 0 ? A.x - 40 : A.x + A.w + 40;
        ctx.beginPath();
        ctx.moveTo(outer, top);
        for (let y = top; y <= bot; y += 12) ctx.lineTo(edge + Math.sin(y * 0.05 + t * 3 * s) * 8 + Math.sin(y * 0.13 - t * 2) * 4, y);
        ctx.lineTo(outer, bot);
        ctx.closePath();
        ctx.fillStyle = INKC; ctx.fill();
        ctx.strokeStyle = '#7d70d0'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.save(); ctx.clip();
        ctx.font = 'italic 20px "IM Fell English", Georgia, serif'; ctx.fillStyle = 'rgba(184,232,255,0.22)'; ctx.textAlign = 'center';
        const words = ['the', 'end', 'Bead', 'rolled', 'no', 'further', 'and', 'so'];
        for (let i = 0; i < 14; i++) {
          const yy = top + ((i * 61 + t * 18) % (bot - top));
          ctx.fillText(words[i % words.length], edge - s * (20 + (i * 23) % Math.max(20, wdt - 10)), yy);
        }
        ctx.restore();
      }
    }
  }
}

// ================================================================= INKWRAITH
// A spilled blot that learned to hate. Amorphous ink with a cracked porcelain mask adrift inside it.
// It melts through the floor, rains, grasps with tendrils, and splits itself into crawling blots.
const IW = 190, IH = 150;

export class Inkwraith extends Boss {
  constructor(game, tx, ty, spec) {
    super(game, tx, ty, spec, { id: 'inkwraith', size: [IW, IH], music: 'boss_optional', glints: 280, introTime: 2.3 });
    if (this.dead) return;
    this.noPhysics = true;
    this.groundY = this.findGround();
    this.y = this.groundY - this.h;
    this.melt = 0;            // 0 solid .. 1 a flat puddle
    this.stretch = 0;         // rearing up tall
    this.scale = 1;
    this.under = null;        // { x } ripple when submerged
    this.marks = [];          // ceiling drips / floor bubbles { x, t, dur, kind }
    this.tendrils = [];       // { x, t, tele, live, h, w, dir }
    this.lash = null;         // horizontal grasp { y, dir, k, x0 }
    this.maskOff = { x: 0, y: 0 };
    this.eyes = [];
    for (let i = 0; i < 9; i++) this.eyes.push({ a: Math.PI + 0.3 + Math.random() * (Math.PI - 0.6), r: 0.45 + Math.random() * 0.35, open: 0, seed: Math.random() * 10 });
    this.dripT = 0;
  }

  idle(dt) { this.melt = 0.6 + Math.sin(this.anim * 1.2) * 0.05; }
  introUpdate(dt, t) {
    this.melt = clamp(0.65 - t * 0.6, 0, 1);
    this.stretch = Math.sin(clamp((t - 0.8) / 1.0, 0, 1) * Math.PI) * 0.5;
    if (t > 1.0 && t < 1.05) this.sfx('splash');
    if (Math.random() < 0.3) this.splat(this.cx + this.rand(-60, 60), this.groundY - 4, 1);
  }

  splat(x, y, n = 6, sp = 200) { this.fx.burst(x, y, n, { color: INKC, speed: sp, angle: -Math.PI / 2, spread: 2.4, size: 4, life: 0.6, g: 600 }); }

  think(dt) {
    const p = this.player;
    // mask drifts inside the blot, looking at Bead
    const tx = clamp((p.cx - this.cx) / 300, -1, 1) * 18, ty = Math.sin(this.anim * 1.4) * 5;
    this.maskOff.x += (tx - this.maskOff.x) * Math.min(1, dt * 3);
    this.maskOff.y += (ty - this.maskOff.y) * Math.min(1, dt * 3);
    for (const E of this.eyes) {
      const want = this.phase >= 3 ? 1 : this.phase >= 2 ? (E.seed > 5 ? 1 : 0) : 0;
      const blink = Math.sin(this.anim * 0.7 + E.seed * 3) > 0.97 ? 0 : 1;
      E.open += (want * blink - E.open) * Math.min(1, dt * 6);
    }
    for (const m of this.marks) m.t += dt;
    this.marks = this.marks.filter((m) => m.t < m.dur);
    // tendrils
    for (const T of this.tendrils) {
      T.t += dt;
      if (T.t > T.tele && !T.rose) { T.rose = true; this.sfx('whip'); this.splat(T.x, this.groundY, 6, 260); }
      if (T.t > T.tele && T.t < T.tele + T.live) this.hits.push({ x: T.x - T.w / 2, y: this.groundY - T.h, w: T.w, h: T.h });
    }
    this.tendrils = this.tendrils.filter((T) => T.t < T.tele + T.live + 0.35);
    // horizontal grasp
    const L = this.lash;
    if (L && L.k > 0.05) {
      const x1 = L.x0 + L.dir * L.reach * L.k;
      this.hits.push({ x: Math.min(L.x0, x1), y: L.y - 16, w: Math.abs(x1 - L.x0), h: 32 });
    }
    // phase 3: the ceiling weeps
    if (this.phase >= 3 && this.mode === 'fight') {
      this.dripT -= dt;
      if (this.dripT <= 0) { this.dripT = 1.3; this.drip(clamp(p.cx + this.rand(-120, 120), this.arena.x + 30, this.arena.x + this.arena.w - 30), 0.8); }
    }
    this.y = this.groundY - this.h;
  }

  *during(sec, fn) {
    const T = sec / this.speedMul;
    for (let t = 0; t < T; t += 1 / 60) { fn(t / T, t); yield; }
    fn(1, T);
  }
  *ooze(x, speed = 160) {
    const A = this.arena;
    x = clamp(x, A.x + this.w / 2 + 10, A.x + A.w - this.w / 2 - 10);
    while (Math.abs(this.cx - x) > 3) {
      const s = Math.sign(x - this.cx) * Math.min(Math.abs(x - this.cx), speed * this.speedMul / 60);
      this.x += s; this.facing = Math.sign(s) || this.facing;
      yield;
    }
  }

  attackList() {
    const d = this.distX();
    return [
      { name: 'sink', w: 2.5, fn: this.sink },
      { name: 'rain', w: 1.8, fn: this.inkRain },
      { name: 'tendrils', w: 2.4, fn: this.tendrilAtk },
      { name: 'grasp', w: d < 450 ? 2.4 : 1, fn: this.grasp },
      { name: 'split', w: this.phase >= 2 && this.minions.length < 2 ? 1.8 : 0, fn: this.split },
      { name: 'wave', w: 1.6, fn: this.waveAtk },
    ];
  }

  // ----- Melt: sinks into the floor, a ripple hunts Bead, then erupts beneath
  *sink() {
    this.tele = 0.5; this.sfx('splash');
    yield* this.during(0.55, (k) => { this.melt = k * k; });
    this.hittable = false; this.harmful = false;
    this.under = { x: this.cx, bub: 0 };
    const sp = 360 * this.speedMul;
    yield* this.during(1.1, () => {
      const dx = this.player.cx - this.under.x;
      this.under.x += clamp(dx, -sp / 60, sp / 60);
    });
    // stops and bubbles (telegraph)
    this.under.bub = 1; this.sfx('warn');
    yield 0.55;
    const x = this.under.x;
    this.x = clamp(x - this.w / 2, this.arena.x, this.arena.x + this.arena.w - this.w);
    this.under = null;
    // erupt
    this.sfx('burst'); this.shake(7, 0.3);
    this.zone(this.cx - 55, this.groundY - 230, 110, 230, 0.25);
    this.splat(this.cx, this.groundY, 16, 420);
    this.hittable = true; this.harmful = true;
    if (this.phase >= 2) for (let i = 0; i < 6; i++) this.fire(this.cx, this.groundY - 120, this.rand(-260, 260), -this.rand(400, 650), { gravity: 1300, art: 'inkdrop', r: 8, life: 3 });
    yield* this.during(0.3, (k) => { this.melt = 1 - k; this.stretch = Math.sin(k * Math.PI) * 0.9; });
    this.melt = 0; this.stretch = 0;
    yield 0.75;
  }

  // ----- Ink Rain: spouts at the ceiling; drops fall where drips gather
  *inkRain() {
    this.tele = 0.5;
    yield* this.during(0.5, (k) => { this.stretch = k * 0.8; });
    this.sfx('splash');
    for (let i = 0; i < 12; i++) this.fx.add({ x: this.cx + this.rand(-10, 10), y: this.y, vx: this.rand(-40, 40), vy: -this.rand(600, 900), life: 0.8, size: 5, color: INKC, g: 300, front: false });
    yield* this.during(0.3, (k) => { this.stretch = 0.8 * (1 - k); });
    this.stretch = 0;
    const A = this.arena;
    const waves = 2 + this.phase;
    for (let w = 0; w < waves; w++) {
      const base = this.player.cx + (w % 2 ? 48 : 0);
      for (let i = -3; i <= 3; i++) {
        const x = base + i * 96;
        if (x > A.x + 16 && x < A.x + A.w - 16) this.drip(x, 0.65);
      }
      yield 0.6;
    }
    yield 0.9;
  }
  drip(x, warn) {
    this.marks.push({ x, t: 0, dur: warn, kind: 'drip' });
    const g = this.game;
    setTimeout(() => {
      if (this.mode !== 'fight' || g.room !== this.room) return;
      this.fire(x, this.arena.y + 10, 0, 120, { gravity: 1500, art: 'inkdrop', r: 8, life: 3, color: '#2b2550',
        onDie: (p) => { if (this.mode === 'fight') g.fx.burst(p.cx, p.cy, 6, { color: INKC, speed: 160, angle: -Math.PI / 2, spread: 2, size: 3, life: 0.4, g: 600 }); } });
    }, (warn * 1000) / this.speedMul);
  }

  // ----- Grasping Tendrils: the floor bubbles, then arms of ink burst up
  *tendrilAtk() {
    this.tele = 0.45; this.sfx('rustle');
    yield* this.during(0.45, (k) => { this.melt = k * 0.3; });
    const n = 3 + this.phase;
    const A = this.arena;
    for (let i = 0; i < n; i++) {
      const xs = [this.player.cx];
      if (this.phase >= 3) xs.push(this.player.cx + this.pick([-1, 1]) * 140);
      for (const x0 of xs) {
        const x = clamp(x0, A.x + 24, A.x + A.w - 24);
        this.tendrils.push({ x, t: 0, tele: 0.55, live: 0.5, h: 190 + this.rand(0, 40), w: 44, dir: this.pick([-1, 1]), seed: Math.random() * 10 });
      }
      yield this.phase >= 2 ? 0.45 : 0.55;
    }
    yield* this.during(0.3, (k) => { this.melt = 0.3 * (1 - k); });
    this.melt = 0;
    yield 0.7;
  }

  // ----- Grasp: a long arm of ink sweeps along the floor (and, later, at head height)
  *grasp() {
    this.facePlayer();
    const rows = this.phase >= 2 ? [this.groundY - 18, this.groundY - 96] : [this.groundY - 18];
    for (const y of rows) {
      const dir = this.dirTo();
      this.facing = dir;
      this.lash = { y, dir, k: 0, x0: this.cx + dir * this.w * 0.35, reach: 520, coil: 0 };
      this.tele = 0.55; this.sfx('rustle');
      yield* this.during(0.55, (k) => { this.lash.coil = k; this.stretch = y < this.groundY - 50 ? k * 0.4 : -k * 0.15; });
      this.sfx('whip');
      yield* this.during(0.16, (k) => { this.lash.k = k; });
      this.shake(3, 0.15);
      yield 0.22;
      yield* this.during(0.3, (k) => { this.lash.k = 1 - k; });
      this.lash = null; this.stretch = 0;
      yield 0.25;
    }
    yield 0.5;
  }

  // ----- Split: it tears itself in two and flings crawling blots out
  *split() {
    this.tele = 0.6; this.sfx('splash');
    yield* this.during(0.6, (k) => { this.stretch = Math.sin(k * Math.PI * 3) * 0.2; this.scale = 1 + k * 0.1; });
    const g = this.game;
    for (const s of [-1, 1]) {
      this.fire(this.cx + s * 40, this.y + 30, s * this.rand(220, 320), -620, {
        gravity: 1400, art: 'glob', color: '#2b2550', r: 14, life: 3, dmg: 1,
        onDie: (p) => {
          if (this.mode !== 'fight') return;
          this.splat(p.cx, p.cy, 8);
          const e = this.summon('inkling', Math.floor(clamp(p.cx, this.arena.x + 20, this.arena.x + this.arena.w - 20) / TILE), Math.floor((this.groundY - 1) / TILE));
          if (e) e.facing = this.player.cx < e.cx ? -1 : 1;
        },
      });
    }
    this.sfx('burst');
    yield* this.during(0.4, (k) => { this.scale = lerp(1.1, 0.85, k); this.stretch = 0; });
    yield 0.9;
  }

  // ----- Ink Wave: rears up and crashes, sending a wave of ink along the floor
  *waveAtk() {
    this.facePlayer();
    this.tele = 0.55; this.sfx('charge');
    yield* this.during(0.55, (k) => { this.stretch = k * 0.9; });
    this.sfx('splash'); this.shake(7, 0.3);
    yield* this.during(0.15, (k) => { this.stretch = 0.9 - k * 1.3; });
    const sp = 400 + this.phase * 40;
    this.shockwave(this.cx + this.facing * 60, this.facing, sp, 54, { color: 'rgba(30,24,50,0.95)' });
    if (this.phase >= 3) this.shockwave(this.cx - this.facing * 60, -this.facing, sp * 0.8, 40, { color: 'rgba(30,24,50,0.95)' });
    this.splat(this.cx, this.groundY, 14, 380);
    yield* this.during(0.3, (k) => { this.stretch = -0.4 * (1 - k); });
    this.stretch = 0;
    if (this.distX() > 260) yield* this.ooze(this.player.cx, 200);
    yield 0.5;
  }

  onPhase(n) {
    this.sfx('bossRoar'); this.shake(7, 0.7); this.tele = 0.8;
    this.splat(this.cx, this.cy, 20, 380);
  }
  onDeath() { this.tendrils = []; this.marks = []; this.lash = null; this.under = null; this.melt = 0; }

  bodyBox() {
    const s = this.scale, hh = IH * (1 - this.melt * 0.85) * (1 + this.stretch * 0.6) * s, ww = IW * (1 + this.melt * 0.3 - this.stretch * 0.2) * s;
    return { x: this.cx - ww * 0.4, y: this.groundY - hh * 0.92, w: ww * 0.8, h: hh * 0.92 };
  }

  // ---------- drawing ----------
  blobPath(ctx, t, rx, ry) {
    const n = 40;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = Math.PI + u * Math.PI;
      const wob = 1 + Math.sin(a * 3 + t * 2.3) * 0.06 + Math.sin(a * 5 - t * 3.1) * 0.04 + Math.sin(a * 9 + t * 5) * 0.02;
      const x = Math.cos(a) * rx * wob, y = Math.sin(a) * ry * wob;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    // foot: drips spreading on the floor
    ctx.quadraticCurveTo(rx * 1.25, 2, rx * 0.9, 3);
    for (let i = 0; i <= 6; i++) { const x = lerp(rx * 0.9, -rx * 0.9, i / 6); ctx.lineTo(x, 3 + (i % 2) * (2 + Math.sin(t * 4 + i) * 1.5)); }
    ctx.quadraticCurveTo(-rx * 1.25, 2, -rx, 0);
    ctx.closePath();
  }

  drawBody(ctx, t, white) {
    const s = this.scale;
    const rx = IW * 0.5 * (1 + this.melt * 0.35 - this.stretch * 0.22) * s;
    const ry = IH * (1 - this.melt * 0.88) * (1 + this.stretch * 0.7) * s;
    ctx.save();
    ctx.translate(this.cx, this.groundY);
    // wisps rising off the top
    if (!white && this.melt < 0.8) {
      ctx.strokeStyle = 'rgba(14,12,22,0.75)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * rx * 0.35, sw = Math.sin(t * 2 + i * 1.7) * 12;
        ctx.beginPath(); ctx.moveTo(x, -ry * 0.85); ctx.quadraticCurveTo(x + sw, -ry * 1.15, x - sw * 0.5, -ry * 1.3 - (i % 2) * 10); ctx.stroke();
      }
    }
    if (!white) {
      // a violet halo so the blot reads against the dark stacks
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const R = Math.max(rx, ry) * 1.5;
      const g0 = ctx.createRadialGradient(0, -ry * 0.45, R * 0.2, 0, -ry * 0.45, R);
      g0.addColorStop(0, `rgba(140,110,230,${0.22 + (this.tele > 0 ? 0.15 : 0)})`); g0.addColorStop(1, 'rgba(140,110,230,0)');
      ctx.fillStyle = g0; ctx.beginPath(); ctx.arc(0, -ry * 0.45, R, 0, TAU); ctx.fill();
      ctx.restore();
    }
    this.blobPath(ctx, t, rx, ry);
    if (white) ctx.fillStyle = '#fff';
    else { const g = ctx.createLinearGradient(-rx, -ry, rx * 0.6, 0); g.addColorStop(0, '#2b2550'); g.addColorStop(0.35, INKC); g.addColorStop(1, '#07060c'); ctx.fillStyle = g; }
    ctx.fill();
    ctx.strokeStyle = W(white, '#6f64b8'); ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
    if (!white) {
      // glossy sheen
      ctx.strokeStyle = 'rgba(220,210,255,0.45)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(-rx * 0.35, -ry * 0.62, rx * 0.25, ry * 0.18, -0.5, Math.PI * 1.05, Math.PI * 1.5); ctx.stroke();
      ctx.fillStyle = 'rgba(230,220,255,0.6)'; ctx.beginPath(); ctx.arc(-rx * 0.15, -ry * 0.8, 2.5, 0, TAU); ctx.fill();
      // drips from the underside edge
      ctx.fillStyle = INKC;
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * rx * 0.38, len = 6 + ((t * 0.8 + i * 0.37) % 1) * 10;
        ctx.beginPath(); ctx.ellipse(x, 4 + len * 0.5, 3, len * 0.5, 0, 0, TAU); ctx.fill();
      }
      // extra eyes opening in the ink
      for (const E of this.eyes) {
        if (E.open < 0.05) continue;
        const ex = Math.cos(E.a) * rx * E.r, ey = Math.sin(E.a) * ry * E.r;
        ctx.fillStyle = '#05040a'; ctx.beginPath(); ctx.ellipse(ex, ey, 6, 7 * E.open, 0, 0, TAU); ctx.fill();
        eye(ctx, ex, ey, 2.4 * E.open, '#d9c8ff', true, 'slit');
      }
    }
    // the mask, adrift inside
    if (this.melt < 0.75) {
      const mr = 32 * s;
      const mx = this.maskOff.x + this.facing * rx * 0.12, my = -ry * 0.55 + this.maskOff.y;
      ctx.save(); ctx.translate(mx, my); ctx.rotate(Math.sin(t * 1.1) * 0.12 + this.facing * 0.08);
      ctx.globalAlpha = white ? 1 : clamp(1 - this.melt * 1.4, 0, 1);
      ctx.beginPath();
      ctx.moveTo(-mr, -mr * 0.1);
      ctx.quadraticCurveTo(-mr * 1.05, -mr * 1.25, 0, -mr * 1.25);
      ctx.quadraticCurveTo(mr * 1.05, -mr * 1.25, mr, -mr * 0.1);
      ctx.quadraticCurveTo(mr * 0.8, mr * 0.95, 0, mr * 1.1);
      ctx.quadraticCurveTo(-mr * 0.8, mr * 0.95, -mr, -mr * 0.1);
      ctx.fillStyle = W(white, '#e9e3d6'); ctx.fill();
      ctx.strokeStyle = W(white, INK); ctx.lineWidth = 2.5; ctx.stroke();
      if (!white) {
        // ink staining the lower half
        ctx.save(); ctx.clip();
        ctx.fillStyle = 'rgba(14,12,22,0.85)';
        ctx.beginPath(); ctx.moveTo(-mr * 1.2, mr * 0.45);
        for (let i = 0; i <= 8; i++) ctx.lineTo(-mr * 1.2 + i * mr * 0.3, mr * 0.45 + Math.sin(i * 2 + t * 2) * 5 + (i % 2) * 8);
        ctx.lineTo(mr * 1.2, mr * 1.4); ctx.lineTo(-mr * 1.2, mr * 1.4); ctx.fill();
        ctx.restore();
        // sockets + furious eyes
        const ec = this.phase >= 3 ? '#ffd0f0' : '#d9c8ff';
        for (const sd of [-1, 1]) {
          ctx.fillStyle = INK; ctx.beginPath();
          ctx.moveTo(sd * mr * 0.12, -mr * 0.35); ctx.lineTo(sd * mr * 0.68, -mr * 0.55); ctx.lineTo(sd * mr * 0.6, mr * 0.05); ctx.quadraticCurveTo(sd * mr * 0.3, mr * 0.15, sd * mr * 0.12, -mr * 0.35);
          ctx.fill();
          eye(ctx, sd * mr * 0.4, -mr * 0.18, mr * 0.11 + (this.tele > 0 ? 1 : 0), ec, true);
        }
        // cracks
        ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(-mr * 0.2, -mr * 1.22); ctx.lineTo(-mr * 0.05, -mr * 0.8); ctx.lineTo(-mr * 0.3, -mr * 0.55); ctx.stroke();
        if (this.phase >= 2) { ctx.beginPath(); ctx.moveTo(mr * 0.9, -mr * 0.6); ctx.lineTo(mr * 0.55, -mr * 0.75); ctx.lineTo(mr * 0.4, -mr * 1.05); ctx.stroke(); }
      }
      ctx.restore();
    }
    ctx.restore();
  }

  drawExtra(ctx, t) {
    const A = this.arena, gy = this.groundY;
    // submerged ripple
    if (this.under) {
      const U = this.under, k = U.bub;
      ctx.fillStyle = 'rgba(14,12,22,0.85)';
      ctx.beginPath(); ctx.ellipse(U.x, gy - 1, 46 + k * 14 + Math.sin(t * 12) * 3, 6, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = k ? `rgba(217,200,255,${0.5 + 0.4 * Math.sin(t * 25)})` : 'rgba(111,100,184,0.7)'; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < (k ? 6 : 2); i++) {
        const bx = U.x + Math.sin(t * 7 + i * 2.1) * 36, by = gy - 4 - ((t * 60 + i * 13) % 20);
        ctx.fillStyle = INKC; ctx.beginPath(); ctx.arc(bx, by, 3 + (i % 3), 0, TAU); ctx.fill();
        ctx.strokeStyle = '#6f64b8'; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    // ceiling drips gathering
    for (const m of this.marks) {
      const k = m.t / m.dur;
      ctx.fillStyle = INKC; ctx.strokeStyle = '#6f64b8'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(m.x, A.y + 4 + k * 8, 4 + k * 3, 4 + k * 9, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = `rgba(217,200,255,${0.15 + 0.35 * k})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(m.x, gy - 2, 16, 4, 0, 0, TAU); ctx.stroke();
    }
    // tendrils
    for (const T of this.tendrils) {
      if (T.t < T.tele) {
        const k = T.t / T.tele;
        ctx.fillStyle = 'rgba(14,12,22,0.9)';
        ctx.beginPath(); ctx.ellipse(T.x, gy - 1, 14 + k * 18, 4 + k * 2, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(217,200,255,${0.3 + 0.6 * k})`; ctx.lineWidth = 2; ctx.stroke();
        for (let i = 0; i < 3; i++) { ctx.fillStyle = INKC; ctx.beginPath(); ctx.arc(T.x + (i - 1) * 12, gy - 4 - ((t * 50 + i * 9) % 14), 2.5, 0, TAU); ctx.fill(); }
        continue;
      }
      const lt = T.t - T.tele;
      const rise = lt < T.live ? Math.min(1, lt / 0.1) : clamp(1 - (lt - T.live) / 0.35, 0, 1);
      const H = T.h * rise;
      ctx.beginPath();
      const n = 12;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const sway = Math.sin(u * 4 + t * 8 + T.seed) * 8 * u + T.dir * u * u * 30;
        pts.push([T.x + sway, gy - u * H, (T.w * 0.5) * (1 - u * 0.85)]);
      }
      pts.forEach(([x, y, w], i) => (i ? ctx.lineTo(x + w, y) : ctx.moveTo(x + w, y)));
      // curled hook tip
      const [tx, ty] = pts[n];
      ctx.quadraticCurveTo(tx + T.dir * 22, ty - 14, tx + T.dir * 18, ty + 8);
      ctx.quadraticCurveTo(tx + T.dir * 12, ty - 4, tx - 3, ty);
      for (let i = n; i >= 0; i--) { const [x, y, w] = pts[i]; ctx.lineTo(x - w, y); }
      ctx.closePath();
      ctx.fillStyle = INKC; ctx.fill();
      ctx.strokeStyle = '#7d70d0'; ctx.lineWidth = 2; ctx.stroke();
      // suckers
      ctx.fillStyle = 'rgba(217,200,255,0.5)';
      for (let i = 2; i < n; i += 2) { const [x, y, w] = pts[i]; ctx.beginPath(); ctx.arc(x + T.dir * w * 0.4, y, 2, 0, TAU); ctx.fill(); }
    }
    // grasping arm
    const L = this.lash;
    if (L) {
      const coil = L.k <= 0.01 ? L.coil : 0;
      const x1 = L.x0 + L.dir * L.reach * L.k;
      if (L.k <= 0.01) {
        // telegraph: coiled arm and a faint guide along the row
        ctx.save(); ctx.setLineDash([6, 8]);
        ctx.strokeStyle = `rgba(217,200,255,${0.2 + 0.5 * coil})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(L.x0, L.y); ctx.lineTo(L.x0 + L.dir * L.reach, L.y); ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = INKC; ctx.lineWidth = 12; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(L.x0 - L.dir * 10, L.y - 10, 14 + coil * 6, 0, TAU * coil); ctx.stroke();
      } else {
        const n = 16;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const u = i / n, x = lerp(L.x0, x1, u), y = L.y + Math.sin(u * 10 - t * 20) * 4 * u;
          i ? ctx.lineTo(x, y - 12 * (1 - u * 0.7)) : ctx.moveTo(x, y - 12);
        }
        ctx.quadraticCurveTo(x1 + L.dir * 26, L.y - 18, x1 + L.dir * 20, L.y + 4);
        for (let i = n; i >= 0; i--) {
          const u = i / n, x = lerp(L.x0, x1, u), y = L.y + Math.sin(u * 10 - t * 20) * 4 * u;
          ctx.lineTo(x, y + 12 * (1 - u * 0.7));
        }
        ctx.closePath();
        ctx.fillStyle = INKC; ctx.fill(); ctx.strokeStyle = '#7d70d0'; ctx.lineWidth = 2; ctx.stroke();
        // clutching fingers at the end
        ctx.strokeStyle = INKC; ctx.lineWidth = 4;
        for (const f of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(x1, L.y); ctx.quadraticCurveTo(x1 + L.dir * 16, L.y + f * 12, x1 + L.dir * 24, L.y + f * 6 + 4); ctx.stroke(); }
      }
    }
  }
}

export default { quill: ArchivistQuill, inkwraith: Inkwraith };
