// Inventory: Bead (status/abilities), Knots (charms), Journal (bestiary), Threadscripts (lore).
import { VIEW_W, VIEW_H } from '../core/constants.js';
import { TAU, hashStr } from '../core/math.js';
import { C, dim, text, title, panel, cursor, paragraph, flourish } from './uikit.js';
import { KNOTS, KNOT_ORDER } from '../data/knots.js';
import { ABILITY_INFO } from '../data/abilities.js';
import { KEY_ITEMS } from '../data/items.js';
import { ENEMY_LIST } from '../data/enemies/index.js';
import { BOSS_INFO } from '../data/bossinfo.js';
import { LORE } from '../data/lore.js';
import { PAINTERS } from '../art/creatures.js';
import { completion } from '../game/save.js';

const TABS = ['Bead', 'Knots', 'Journal', 'Threadscripts'];
const ABILITY_ORDER = ['sap', 'dash', 'shard', 'glide', 'magnet', 'shell', 'pound', 'comet', 'dbljump', 'shrink', 'hook', 'unravel', 'howl', 'lantern'];

export class InventoryScreen {
  constructor(app, opts = {}) {
    this.app = app;
    this.game = app.game;
    this.save = this.game.save;
    this.tab = opts.tab ?? 0;
    this.bench = !!opts.bench;
    this.t = 0;
    this.sel = [0, 0, 0, 0];
    this.scroll = [0, 0, 0, 0];
    app.audio.sfx('menuOpen');
    this.journal = ENEMY_LIST.filter((e) => e.area !== 'boss');
    this.loreIds = Object.keys(LORE);
  }

  usedNotches() { return this.save.knots.equipped.reduce((s, id) => s + (KNOTS[id] ? KNOTS[id].cost : 0), 0); }

  update(dt) {
    const inp = this.app.input, sfx = (n) => this.app.audio.sfx(n);
    this.t += dt;
    if (this.t > 0.15 && (inp.pressed('back') || inp.pressed('inventory') || inp.pressed('pause'))) {
      inp.eatAll(); sfx('menuClose');
      this.game.refreshStats();
      this.app.closeOverlay();
      return;
    }
    if (inp.pressed('dash')) { this.tab = (this.tab + 1) % TABS.length; sfx('tick'); }
    if (inp.pressed('ability')) { this.tab = (this.tab + TABS.length - 1) % TABS.length; sfx('tick'); }
    const s = this.sel;
    if (this.tab === 0) {
      const n = ABILITY_ORDER.length;
      if (inp.pressed('right')) { s[0] = (s[0] + 1) % n; sfx('tick'); }
      if (inp.pressed('left')) { s[0] = (s[0] + n - 1) % n; sfx('tick'); }
      if (inp.pressed('down')) { s[0] = Math.min(n - 1, s[0] + 7); sfx('tick'); }
      if (inp.pressed('up')) { s[0] = Math.max(0, s[0] - 7); sfx('tick'); }
    } else if (this.tab === 1) {
      const n = KNOT_ORDER.length, cols = 8;
      if (inp.pressed('right')) { s[1] = (s[1] + 1) % n; sfx('tick'); }
      if (inp.pressed('left')) { s[1] = (s[1] + n - 1) % n; sfx('tick'); }
      if (inp.pressed('down')) { s[1] = Math.min(n - 1, s[1] + cols); sfx('tick'); }
      if (inp.pressed('up')) { s[1] = Math.max(0, s[1] - cols); sfx('tick'); }
      if (inp.pressed('confirm') || inp.pressed('jump') || inp.pressed('attack')) {
        inp.eatAll();
        const id = KNOT_ORDER[s[1]];
        const kn = this.save.knots;
        if (!kn.owned.includes(id)) { sfx('deny'); return; }
        if (!this.bench) { sfx('deny'); this.flashMsg = 'Knots can only be restrung at a Spindle.'; this.flashT = 1.6; return; }
        const i = kn.equipped.indexOf(id);
        if (i >= 0) { kn.equipped.splice(i, 1); sfx('menuClose'); }
        else if (this.usedNotches() + KNOTS[id].cost <= this.save.notches) { kn.equipped.push(id); sfx('confirm'); }
        else { sfx('deny'); this.flashMsg = 'Not enough string on your thread.'; this.flashT = 1.4; }
        this.game.refreshStats();
      }
    } else if (this.tab === 2) {
      const n = this.journal.length + Object.keys(BOSS_INFO).length;
      if (inp.pressed('down')) { s[2] = Math.min(n - 1, s[2] + 1); sfx('tick'); }
      if (inp.pressed('up')) { s[2] = Math.max(0, s[2] - 1); sfx('tick'); }
      if (inp.pressed('right')) { s[2] = Math.min(n - 1, s[2] + 10); sfx('tick'); }
      if (inp.pressed('left')) { s[2] = Math.max(0, s[2] - 10); sfx('tick'); }
    } else if (this.tab === 3) {
      const n = Math.max(1, this.loreIds.length);
      if (inp.pressed('down')) { s[3] = Math.min(n - 1, s[3] + 1); sfx('tick'); }
      if (inp.pressed('up')) { s[3] = Math.max(0, s[3] - 1); sfx('tick'); }
    }
    if (this.flashT > 0) this.flashT -= dt;
  }

  draw(ctx) {
    dim(ctx, 0.82);
    // tabs
    TABS.forEach((name, i) => {
      const x = VIEW_W / 2 + (i - 1.5) * 170;
      text(ctx, name, x, 34, i === this.tab ? 21 : 16, i === this.tab ? C.text : C.dim, 'center');
      if (i === this.tab) flourish(ctx, x, 54, 50);
    });
    text(ctx, '‹ V', 70, 34, 13, C.faint, 'center');
    text(ctx, 'C ›', VIEW_W - 70, 34, 13, C.faint, 'center');
    [this.drawBead, this.drawKnots, this.drawJournal, this.drawLore][this.tab].call(this, ctx);
    if (this.flashT > 0) {
      ctx.globalAlpha = Math.min(1, this.flashT * 2);
      text(ctx, this.flashMsg, VIEW_W / 2, VIEW_H - 30, 16, C.red, 'center');
      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- Bead
  drawBead(ctx) {
    const sv = this.save, t = this.t;
    // portrait
    panel(ctx, 40, 80, 260, 420);
    const cx = 170, cy = 190;
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 110);
    g.addColorStop(0, 'rgba(255,250,235,0.18)'); g.addColorStop(1, 'rgba(255,250,235,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - 110, cy - 110, 220, 220);
    const bob = Math.sin(t * 2) * 3;
    ctx.fillStyle = '#f4eedf'; ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy + bob, 44, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.beginPath(); ctx.ellipse(cx - 13, cy - 4 + bob, 8, 13, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 13, cy - 4 + bob, 8, 13, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx - 15, cy - 9 + bob, 3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 11, cy - 9 + bob, 3, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#b8323e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - 36, cy - 26 + bob); ctx.bezierCurveTo(cx - 60, cy - 40, cx - 64, cy + 10, cx - 84, cy + Math.sin(t * 3) * 6); ctx.stroke();
    // great beads
    text(ctx, 'Great Beads', cx, 268, 14, C.dim, 'center');
    const gb = ['kilns', 'mirror', 'bellfry', 'archive', 'warrens', 'frost'];
    gb.forEach((id, i) => {
      const x = cx - 75 + i * 30, y = 296, have = sv.items['greatBead_' + id];
      ctx.fillStyle = have ? '#f6f8ff' : 'rgba(40,40,52,0.9)'; ctx.strokeStyle = have ? C.ink : 'rgba(220,210,190,0.3)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.fill(); ctx.stroke();
      if (have) { ctx.fillStyle = 'rgba(160,190,255,0.6)'; ctx.beginPath(); ctx.arc(x - 3, y - 3, 3.5, 0, TAU); ctx.fill(); }
    });
    const rows = [
      ['Coats', `${sv.hp} / ${sv.maxHp}`],
      ['Gilded Rings', `${sv.rings || 0} / 6`],
      ['Spin', `${Math.floor(sv.thread)} / ${sv.maxThread}`],
      ['Bearings · Marbles', `${sv.bearings || 0}/3 · ${sv.marbles || 0}/11`],
      ['Polish', `${sv.polish} / 4`],
      ['Pale Tin', `${sv.items.ore || 0}`],
      ['Beadlings freed', `${sv.beadlings} / 48`],
      ['Completion', `${completion(sv)}%`],
    ];
    rows.forEach(([a, b], i) => { text(ctx, a, 64, 336 + i * 20, 14, C.dim); text(ctx, b, 276, 336 + i * 20, 14, C.text, 'right'); });

    // abilities grid
    panel(ctx, 320, 80, 600, 250);
    text(ctx, 'Powers', 620, 104, 16, C.gold, 'center');
    ABILITY_ORDER.forEach((id, i) => {
      const col = i % 7, row = Math.floor(i / 7);
      const x = 380 + col * 80, y = 160 + row * 80;
      const has = !!sv.abilities[id];
      drawAbilityIcon(ctx, id, x, y, has, t);
      if (i === this.sel[0]) { ctx.strokeStyle = 'rgba(255,246,224,0.9)'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 30, y - 30, 60, 60); }
    });
    const sid = ABILITY_ORDER[this.sel[0]];
    const info = ABILITY_INFO[sid];
    panel(ctx, 320, 340, 600, 160);
    if (sv.abilities[sid] && info) {
      text(ctx, info.name, 345, 370, 20, C.text);
      paragraph(ctx, info.desc, 345, 392, 550, 15, C.dim);
    } else text(ctx, '???', 345, 370, 20, C.faint);
    // key items
    const keys = Object.keys(KEY_ITEMS).filter((k) => sv.items[k] || (k === 'lantern' && sv.abilities.lantern));
    if (keys.length) text(ctx, 'Carried: ' + keys.map((k) => KEY_ITEMS[k].name).join(', '), 345, 478, 13, C.faint);
  }

  // ---------------------------------------------------------------- Knots
  drawKnots(ctx) {
    const sv = this.save, t = this.t;
    const used = this.usedNotches();
    panel(ctx, 40, 76, 880, 64);
    text(ctx, this.bench ? 'Tie Knots into your thread' : 'Knots (rest at a Spindle to restring)', 64, 108, 16, this.bench ? C.gold : C.dim);
    // Bead's thread as a length of string: used length in red, spare length pale
    const L = 22, x0 = 600;
    for (let i = 0; i < sv.notches; i++) {
      const x = x0 + i * L, y = 108 + Math.sin(i * 1.3 + this.t * 2) * 2;
      ctx.strokeStyle = i < used ? '#c4404c' : 'rgba(230,220,200,0.35)'; ctx.lineWidth = i < used ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + L / 2, y + (i % 2 ? 5 : -5), x + L, 108 + Math.sin((i + 1) * 1.3 + this.t * 2) * 2); ctx.stroke();
    }
    text(ctx, `${used} / ${sv.notches}`, x0 + sv.notches * L + 14, 108, 13, C.dim);
    // equipped row
    sv.knots.equipped.forEach((id, i) => drawKnotIcon(ctx, id, 380 + i * 34, 108, true, t, 0.6));
    panel(ctx, 40, 150, 560, 350);
    KNOT_ORDER.forEach((id, i) => {
      const col = i % 8, row = Math.floor(i / 8);
      const x = 90 + col * 64, y = 196 + row * 64;
      const owned = sv.knots.owned.includes(id);
      const eq = sv.knots.equipped.includes(id);
      if (eq) { ctx.fillStyle = 'rgba(232,201,138,0.18)'; ctx.beginPath(); ctx.arc(x, y, 26, 0, TAU); ctx.fill(); }
      drawKnotIcon(ctx, owned ? id : null, x, y, owned, t);
      if (i === this.sel[1]) { ctx.strokeStyle = 'rgba(255,246,224,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 28, 0, TAU); ctx.stroke(); }
    });
    const id = KNOT_ORDER[this.sel[1]];
    const k = KNOTS[id];
    panel(ctx, 610, 150, 310, 350);
    if (sv.knots.owned.includes(id)) {
      drawKnotIcon(ctx, id, 765, 210, true, t, 1.6);
      text(ctx, k.name, 765, 270, 19, C.text, 'center');
      text(ctx, `Takes ${k.cost} length${k.cost > 1 ? 's' : ''} of string`, 765, 296, 14, C.gold, 'center');
      paragraph(ctx, k.desc, 635, 320, 260, 15, C.dim);
      if (sv.knots.equipped.includes(id)) text(ctx, 'Tied', 765, 470, 14, C.gold, 'center');
    } else {
      text(ctx, '???', 765, 270, 19, C.faint, 'center');
      text(ctx, 'Not yet found.', 765, 300, 14, C.faint, 'center');
    }
  }

  // ---------------------------------------------------------------- Journal
  drawJournal(ctx) {
    const sv = this.save, t = this.t;
    const bosses = Object.entries(BOSS_INFO);
    const n = this.journal.length + bosses.length;
    const sel = this.sel[2];
    const visible = 18;
    let top = Math.max(0, Math.min(n - visible, sel - Math.floor(visible / 2)));
    panel(ctx, 40, 76, 320, 430);
    const seenCount = this.journal.filter((e) => sv.kills[e.id]).length;
    text(ctx, `Recorded: ${seenCount} / ${this.journal.length}`, 200, 98, 13, C.dim, 'center');
    for (let i = top; i < Math.min(n, top + visible); i++) {
      const y = 124 + (i - top) * 21;
      let name, known;
      if (i < this.journal.length) { const e = this.journal[i]; known = !!sv.kills[e.id]; name = known ? e.name : '???'; }
      else { const [bid, b] = bosses[i - this.journal.length]; known = !!sv.flags['boss_' + bid]; name = known ? '★ ' + b.name : '★ ???'; }
      text(ctx, name, 70, y, 15, i === sel ? '#fff6e0' : known ? C.dim : C.faint);
      if (i === sel) cursor(ctx, 56, y, t);
    }
    panel(ctx, 370, 76, 550, 430);
    if (sel < this.journal.length) {
      const e = this.journal[sel];
      const kills = sv.kills[e.id] || 0, need = e.kills || 10;
      if (!kills) { text(ctx, '???', 645, 280, 24, C.faint, 'center'); return; }
      // creature preview
      const P = PAINTERS[e.art.body] || PAINTERS.mite;
      const [w, h] = e.size || [28, 24];
      const scale = Math.min(3, 150 / Math.max(w, h));
      const fake = { w, h, anim: t, state: 'idle', facing: 1, game: this.game, grounded: true, cx: 645, cy: 200, x: 0, y: 0, emerge: 1, roll: t * 2 };
      ctx.save();
      ctx.translate(645, e.art.centered ? 190 : 250);
      ctx.scale(scale, scale);
      try { P(ctx, fake, t, e.art); } catch { /* preview only */ }
      ctx.restore();
      text(ctx, e.name, 645, 300, 24, C.text, 'center');
      text(ctx, `Defeated: ${kills}${kills >= need ? '' : ' / ' + need}`, 645, 328, 14, C.gold, 'center');
      if (kills >= need) paragraph(ctx, e.journal || '', 400, 352, 490, 15, C.dim);
      else text(ctx, `Defeat ${need - kills} more to learn its nature.`, 645, 370, 14, C.faint, 'center');
    } else {
      const [bid, b] = bosses[sel - this.journal.length];
      if (!sv.flags['boss_' + bid]) { text(ctx, '???', 645, 280, 24, C.faint, 'center'); return; }
      text(ctx, b.name, 645, 220, 28, C.text, 'center');
      text(ctx, b.epithet || '', 645, 256, 16, C.gold, 'center');
      flourish(ctx, 645, 282, 120);
      const echo = sv.echoes[bid];
      text(ctx, echo ? 'Its Echo has been bested.' : 'Its Echo still waits in the Hall.', 645, 320, 14, C.dim, 'center');
    }
  }

  // ---------------------------------------------------------------- Threadscripts
  drawLore(ctx) {
    const sv = this.save, t = this.t;
    const ids = this.loreIds;
    const sel = this.sel[3];
    panel(ctx, 40, 76, 320, 430);
    const read = ids.filter((id) => sv.lore[id]).length;
    text(ctx, `Read: ${read} / ${ids.length}`, 200, 98, 13, C.dim, 'center');
    const visible = 18;
    const top = Math.max(0, Math.min(ids.length - visible, sel - Math.floor(visible / 2)));
    for (let i = top; i < Math.min(ids.length, top + visible); i++) {
      const id = ids[i];
      const y = 124 + (i - top) * 21;
      const known = sv.lore[id];
      text(ctx, known ? (LORE[id].title || id) : '· · ·', 70, y, 15, i === sel ? '#fff6e0' : known ? C.dim : C.faint);
      if (i === sel) cursor(ctx, 56, y, t);
    }
    panel(ctx, 370, 76, 550, 430);
    const id = ids[sel];
    if (id && sv.lore[id]) {
      const L = LORE[id];
      text(ctx, L.title || '', 645, 112, 20, C.gold, 'center');
      let y = 140;
      for (const p of L.pages) y += paragraph(ctx, p, 400, y, 490, 15, '#e6e0f0') + 12;
    } else text(ctx, 'Find Threadscript tablets to read the history of the Strand.', 645, 290, 14, C.faint, 'center');
  }
}

// ---------------------------------------------------------------- icons
export function drawKnotIcon(ctx, id, x, y, owned, t, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (!id) {
    ctx.strokeStyle = 'rgba(220,210,190,0.18)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.stroke();
    ctx.restore(); return;
  }
  const h = hashStr(id);
  const hue = h % 360;
  const loops = 2 + (h >> 4) % 4;
  const col = `hsl(${hue}, 45%, 62%)`;
  ctx.fillStyle = 'rgba(20,18,26,0.9)'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#16141c'; ctx.lineWidth = 6;
  const path = () => {
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * TAU;
      const r = 10 + 5 * Math.cos(a * loops + (h % 7));
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  };
  path(); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = 3; path(); ctx.stroke();
  ctx.fillStyle = '#fff3d8'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawAbilityIcon(ctx, id, x, y, owned, t) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = owned ? 'rgba(255,246,224,0.08)' : 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill();
  ctx.strokeStyle = owned ? 'rgba(232,201,138,0.8)' : 'rgba(220,210,190,0.15)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.stroke();
  if (!owned) { ctx.fillStyle = 'rgba(220,210,190,0.25)'; ctx.font = '18px \"IM Fell English\", Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, 1); ctx.restore(); return; }
  const ink = '#16141c', pale = '#f4eedf';
  ctx.lineWidth = 2; ctx.strokeStyle = pale; ctx.fillStyle = pale;
  const ball = (bx, by, r = 7) => { ctx.fillStyle = pale; ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fill(); ctx.stroke(); };
  switch (id) {
    case 'sap': ctx.fillStyle = '#c99a4a'; ctx.fillRect(-14, -16, 6, 32); ball(-1, 0); ctx.fillStyle = '#e0b860'; ctx.beginPath(); ctx.arc(-8, 6, 3, 0, TAU); ctx.fill(); break;
    case 'dash': ctx.strokeStyle = pale; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-18, -6 + i * 6); ctx.lineTo(-6, -6 + i * 6); ctx.stroke(); } ball(6, 0); break;
    case 'shard': ctx.fillStyle = pale; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(0, -6); ctx.lineTo(-14, 0); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill(); break;
    case 'glide': ctx.strokeStyle = pale; ctx.lineWidth = 1; for (let i = 0; i < 9; i++) { const a = -Math.PI + i * Math.PI / 8; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(Math.cos(a) * 14, -4 + Math.sin(a) * 11); ctx.stroke(); } ball(0, 9, 6); break;
    case 'magnet': ctx.strokeStyle = '#d97a4a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, -2, 10, Math.PI, 0); ctx.stroke(); ctx.fillStyle = pale; ctx.fillRect(-13, -2, 6, 10); ctx.fillRect(7, -2, 6, 10); break;
    case 'shell': ball(0, 0, 9); ctx.strokeStyle = 'rgba(170,220,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 14, -2.6, -0.4); ctx.stroke(); break;
    case 'pound': ball(0, -6); ctx.strokeStyle = pale; ctx.beginPath(); ctx.moveTo(-14, 12); ctx.lineTo(14, 12); ctx.moveTo(-8, 6); ctx.lineTo(-12, 0); ctx.moveTo(8, 6); ctx.lineTo(12, 0); ctx.stroke(); break;
    case 'comet': ctx.fillStyle = 'rgba(255,200,240,0.6)'; ctx.beginPath(); ctx.moveTo(-18, -6); ctx.lineTo(4, -7); ctx.lineTo(4, 7); ctx.lineTo(-18, 6); ctx.fill(); ball(6, 0); break;
    case 'dbljump': ball(0, -6); ctx.strokeStyle = 'rgba(200,230,255,0.9)'; ctx.beginPath(); ctx.arc(0, 10, 7, 0, TAU); ctx.stroke(); break;
    case 'shrink': ball(-8, 2, 9); ball(10, 6, 4); break;
    case 'hook': ctx.strokeStyle = pale; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(6, -8, 6, 0, TAU); ctx.stroke(); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(6, -2); ctx.lineTo(-6, 8); ctx.stroke(); ball(-8, 10, 5); break;
    case 'unravel': ctx.strokeStyle = '#c44a56'; ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = i * TAU / 8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(a + 0.5) * 10, Math.sin(a + 0.5) * 10, Math.cos(a) * 17, Math.sin(a) * 17); ctx.stroke(); } ball(0, 0, 5); break;
    case 'howl': ctx.strokeStyle = pale; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-6 + i * 6, 10); ctx.quadraticCurveTo(-10 + i * 6, -4, -4 + i * 6, -16); ctx.stroke(); } break;
    case 'lantern': ctx.fillStyle = '#ffdc96'; ctx.beginPath(); ctx.ellipse(0, 2, 7, 10, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = ink; ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, -16); ctx.stroke(); break;
  }
  ctx.restore();
}
