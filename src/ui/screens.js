// Title screen, pause menu, options, controls, save-slot select.
import { VIEW_W, VIEW_H } from '../core/constants.js';
import { TAU } from '../core/math.js';
import { C, FONT, dim, text, title, flourish, panel, drawMenu, menuInput, paragraph, cursor } from './uikit.js';
import { loadSave, newSave, deleteSave, completion } from '../game/save.js';
import { AREAS } from '../data/world.js';
import { styleFor } from '../art/palettes.js';
import { getBackground, drawBackground } from '../art/backgrounds.js';

const fmtTime = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return `${h}h ${String(m).padStart(2, '0')}m`; };

// ------------------------------------------------------------------ title
export class TitleScreen {
  constructor(app) {
    this.app = app;
    this.t = 0;
    this.mode = 'press'; // press -> main -> slots | options | controls | credits
    this.st = { sel: 0 };
    this.bg = getBackground('fray', styleFor('fray'));
    this.slots = [0, 1, 2].map((i) => loadSave(i));
    this.beads = [];
    for (let i = 0; i < 60; i++) this.beads.push({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, s: 0.5 + Math.random() * 2, v: 6 + Math.random() * 20, p: Math.random() * TAU });
    this.rollX = -40;
    app.audio.playMusic('title', { fade: 2 });
  }

  menuItems() {
    const any = this.slots.some(Boolean);
    return [
      { label: any ? 'Continue' : 'Begin', id: 'play' },
      { label: 'Options', id: 'options' },
      { label: 'Controls', id: 'controls' },
      { label: 'Credits', id: 'credits' },
    ];
  }

  update(dt) {
    const inp = this.app.input, sfx = (n) => this.app.audio.sfx(n);
    this.t += dt;
    this.rollX += dt * 60; if (this.rollX > VIEW_W + 60) this.rollX = -60;
    for (const b of this.beads) { b.y -= b.v * dt; b.p += dt; if (b.y < -10) { b.y = VIEW_H + 10; b.x = Math.random() * VIEW_W; } }
    if (this.mode === 'press') {
      if (inp.anyPressed && this.t > 0.6) { this.mode = 'main'; sfx('confirm'); inp.eatAll(); }
      return;
    }
    if (this.sub) { this.sub.update(dt); if (this.sub.done) { this.sub = null; this.slots = [0, 1, 2].map((i) => loadSave(i)); } return; }
    if (this.mode === 'main') {
      const items = this.menuItems();
      menuInput(inp, this.st, items.length, sfx);
      if (inp.pressed('confirm') || inp.pressed('jump')) {
        inp.eatAll(); sfx('confirm');
        const id = items[this.st.sel].id;
        if (id === 'play') { this.mode = 'slots'; this.slotSel = { sel: 0 }; }
        else if (id === 'options') this.sub = new OptionsScreen(this.app);
        else if (id === 'controls') this.sub = new ControlsScreen(this.app);
        else if (id === 'credits') this.app.showCredits(false);
      }
    } else if (this.mode === 'slots') {
      menuInput(inp, this.slotSel, 3, sfx);
      if (inp.pressed('back')) { inp.eatAll(); this.mode = 'main'; sfx('menuClose'); return; }
      const i = this.slotSel.sel, s = this.slots[i];
      if (inp.pressed('confirm') || inp.pressed('jump')) {
        inp.eatAll(); sfx('confirm');
        if (s && !s.dead) this.app.startFromSave(s);
        else if (s && s.dead) { deleteSave(i); this.slots[i] = null; }
        else this.mode = 'newgame';
        this.newSel = { sel: 0 };
      }
      if (s && inp.pressed('attack') === false && inp.pressed('focus')) { /* noop */ }
      if (s && (inp.pressed('dash'))) { this.confirmDelete = i; this.mode = 'delete'; this.delSel = { sel: 1 }; }
    } else if (this.mode === 'newgame') {
      const opts = [{ label: 'Normal' }, { label: 'Brittle (one life)' }, { label: 'Back' }];
      menuInput(inp, this.newSel, opts.length, sfx);
      if (inp.pressed('back')) { inp.eatAll(); this.mode = 'slots'; return; }
      if (inp.pressed('confirm') || inp.pressed('jump')) {
        inp.eatAll(); sfx('confirm');
        if (this.newSel.sel === 2) { this.mode = 'slots'; return; }
        this.app.startNewGame(this.slotSel.sel, { brittle: this.newSel.sel === 1 });
      }
    } else if (this.mode === 'delete') {
      menuInput(inp, this.delSel, 2, sfx);
      if (inp.pressed('back')) { inp.eatAll(); this.mode = 'slots'; return; }
      if (inp.pressed('confirm') || inp.pressed('jump')) {
        inp.eatAll();
        if (this.delSel.sel === 0) { deleteSave(this.confirmDelete); this.slots[this.confirmDelete] = null; sfx('deny'); }
        this.mode = 'slots';
      }
    }
  }

  draw(ctx) {
    const t = this.t;
    drawBackground(ctx, this.bg, t * 20, 200, 4000, 1000, t);
    dim(ctx, 0.35);
    // drifting motes
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.beads) {
      ctx.globalAlpha = 0.35 + 0.3 * Math.sin(b.p * 2);
      ctx.fillStyle = '#dfe8ff';
      ctx.beginPath(); ctx.arc(b.x + Math.sin(b.p) * 8, b.y, b.s, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // the moon & the strand
    const mx = VIEW_W / 2, my = 120;
    const g = ctx.createRadialGradient(mx, my, 20, mx, my, 220);
    g.addColorStop(0, 'rgba(240,244,255,0.35)'); g.addColorStop(1, 'rgba(240,244,255,0)');
    ctx.fillStyle = g; ctx.fillRect(mx - 220, my - 220, 440, 440);
    ctx.fillStyle = 'rgba(244,246,255,0.92)';
    ctx.beginPath(); ctx.arc(mx, my, 56, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(200,205,225,0.5)';
    for (const [dx, dy, r] of [[-18, -10, 9], [14, 12, 6], [20, -18, 4], [-6, 22, 5]]) { ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, TAU); ctx.fill(); }
    // broken necklace arc with beads falling away
    ctx.strokeStyle = 'rgba(184,50,62,0.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mx, my + 10, 96, Math.PI * 0.12, Math.PI * 0.8); ctx.stroke();
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.18 + i * 0.07);
      const fall = i > 5 ? (i - 5) * 18 + Math.sin(t + i) * 3 : 0;
      ctx.fillStyle = '#f4eedf'; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx + Math.cos(a) * 96, my + 10 + Math.sin(a) * 96 + fall, 5, 0, TAU); ctx.fill(); ctx.stroke();
    }
    // logo
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 20;
    text(ctx, 'U N S T R U N G', VIEW_W / 2, 278, 64, '#f6f0e2', 'center');
    ctx.restore();
    flourish(ctx, VIEW_W / 2, 320, 230);
    text(ctx, 'a tale of the smallest bead', VIEW_W / 2, 342, 15, C.dim, 'center');
    // a little Bead rolling along the bottom
    const bx = this.rollX, by = VIEW_H - 40;
    ctx.fillStyle = '#f4eedf'; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bx, by, 11, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.beginPath(); ctx.ellipse(bx + 3, by - 1, 2, 3.2, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(bx + 8, by - 1, 2, 3.2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#b8323e'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bx - 9, by - 6); ctx.quadraticCurveTo(bx - 20, by - 8 + Math.sin(t * 8) * 3, bx - 28, by - 2); ctx.stroke();

    if (this.mode === 'press') {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3);
      text(ctx, 'press any key', VIEW_W / 2, 420, 18, C.text, 'center');
      ctx.globalAlpha = 1;
    } else if (this.mode === 'main') {
      drawMenu(ctx, this.menuItems(), this.st.sel, VIEW_W / 2, 392, t, { gap: 34, size: 20 });
    } else if (this.mode === 'slots' || this.mode === 'delete' || this.mode === 'newgame') {
      this.drawSlots(ctx, t);
    }
    if (this.sub) this.sub.draw(ctx);
    text(ctx, 'v1.0', VIEW_W - 12, VIEW_H - 12, 11, C.faint, 'right');
  }

  drawSlots(ctx, t) {
    dim(ctx, 0.55);
    title(ctx, 'Choose a Thread', VIEW_W / 2, 60, 26);
    for (let i = 0; i < 3; i++) {
      const s = this.slots[i];
      const x = 180, y = 120 + i * 120, w = 600, h = 100;
      panel(ctx, x, y, w, h, i === this.slotSel.sel ? 0.92 : 0.7);
      if (i === this.slotSel.sel) cursor(ctx, x - 20, y + h / 2, t);
      text(ctx, String(i + 1), x + 30, y + h / 2, 30, C.gold, 'center');
      if (!s) { text(ctx, 'New Thread', x + 70, y + h / 2, 22, C.dim); continue; }
      const area = AREAS[(s.room || '').split('_')[0]] || AREAS.fray;
      text(ctx, area ? area.name : '—', x + 70, y + 32, 22, s.dead ? C.red : C.text);
      text(ctx, s.dead ? 'This thread has snapped.' : `${fmtTime(s.playTime)}   ·   ${completion(s)}%   ·   ${s.glints} glints${s.brittle ? '   ·   Brittle' : ''}`, x + 70, y + 66, 15, C.dim);
      for (let k = 0; k < s.maxHp; k++) {
        ctx.fillStyle = k < s.hp ? '#f4eedf' : 'rgba(40,40,50,0.8)';
        ctx.beginPath(); ctx.arc(x + w - 160 + k * 16, y + 32, 6, 0, TAU); ctx.fill();
      }
    }
    if (this.mode === 'newgame') {
      panel(ctx, 330, 180, 300, 180);
      text(ctx, 'New Thread', VIEW_W / 2, 210, 20, C.gold, 'center');
      drawMenu(ctx, [{ label: 'Normal' }, { label: 'Brittle (one life)' }, { label: 'Back' }], this.newSel.sel, VIEW_W / 2, 255, t, { size: 18, gap: 34 });
    } else if (this.mode === 'delete') {
      panel(ctx, 330, 200, 300, 140);
      text(ctx, 'Erase this thread?', VIEW_W / 2, 230, 18, C.red, 'center');
      drawMenu(ctx, [{ label: 'Erase' }, { label: 'Keep' }], this.delSel.sel, VIEW_W / 2, 275, t, { size: 18, gap: 32 });
    } else {
      text(ctx, 'Z / Enter: select     C: erase     Esc: back', VIEW_W / 2, VIEW_H - 24, 13, C.faint, 'center');
    }
  }
}

// ------------------------------------------------------------------ options
export class OptionsScreen {
  constructor(app) { this.app = app; this.st = { sel: 0 }; this.t = 0; }
  items() {
    const s = this.app.audio.settings, o = this.app.options;
    const pct = (v) => `${Math.round(v * 100)}%`;
    return [
      { label: `Master volume   ‹ ${pct(s.master)} ›`, key: 'master' },
      { label: `Music volume   ‹ ${pct(s.music)} ›`, key: 'music' },
      { label: `Effects volume   ‹ ${pct(s.sfx)} ›`, key: 'sfx' },
      { label: `Screen shake   ‹ ${o.shake ? 'On' : 'Off'} ›`, key: 'shake' },
      { label: `Show timer   ‹ ${o.timer ? 'On' : 'Off'} ›`, key: 'timer' },
      { label: 'Back', key: 'back' },
    ];
  }
  update(dt) {
    const inp = this.app.input, sfx = (n) => this.app.audio.sfx(n);
    this.t += dt;
    const items = this.items();
    menuInput(inp, this.st, items.length, sfx);
    const it = items[this.st.sel];
    const d = inp.pressed('right') ? 1 : inp.pressed('left') ? -1 : 0;
    if (d) {
      const s = this.app.audio.settings;
      if (it.key in s) { s[it.key] = Math.max(0, Math.min(1, Math.round((s[it.key] + d * 0.1) * 10) / 10)); this.app.audio.applySettings(); sfx('tick'); }
      if (it.key === 'shake' || it.key === 'timer') { this.app.options[it.key] = !this.app.options[it.key]; this.app.saveOptions(); sfx('tick'); }
    }
    if (inp.pressed('back') || ((inp.pressed('confirm') || inp.pressed('jump')) && it.key === 'back')) { inp.eatAll(); this.done = true; sfx('menuClose'); }
  }
  draw(ctx) {
    dim(ctx, 0.75);
    title(ctx, 'Options', VIEW_W / 2, 90, 28);
    drawMenu(ctx, this.items(), this.st.sel, VIEW_W / 2, 170, this.t, { size: 19, gap: 40 });
  }
}

// ------------------------------------------------------------------ controls
export class ControlsScreen {
  constructor(app) { this.app = app; this.t = 0; }
  update(dt) {
    this.t += dt;
    const inp = this.app.input;
    if (this.t > 0.2 && (inp.pressed('back') || inp.pressed('confirm') || inp.pressed('jump'))) { inp.eatAll(); this.done = true; this.app.audio.sfx('menuClose'); }
  }
  draw(ctx) {
    dim(ctx, 0.82);
    title(ctx, 'Controls', VIEW_W / 2, 60, 28);
    const rows = [
      ['Roll', '← →  /  A D', 'Left stick / D-pad'],
      ['Jump (hold for height, glide later)', 'Z  /  Space', 'A'],
      ['Bonk (↑ / ↓ to aim, ↓ in air = pogo)', 'X  /  J', 'X'],
      ['Dash (↓ + Dash: Comet Roll charge)', 'C  /  K  /  Shift', 'RB / B'],
      ['Focus: tap = spell, hold while rolling = Buff', 'F  /  L', 'Y'],
      ['Ability: shrink / hook / ground pound', 'V  /  I', 'LB'],
      ['Interact, rest, talk', '↑', 'Up'],
      ['Map', 'Tab  /  M', 'Select'],
      ['Inventory', 'E  /  Q', 'RT'],
      ['Pause', 'Esc', 'Start'],
    ];
    rows.forEach(([a, k, p], i) => {
      const y = 120 + i * 36;
      text(ctx, a, 90, y, 16, C.text);
      text(ctx, k, 560, y, 16, C.gold);
      text(ctx, p, 760, y, 16, C.dim);
    });
    text(ctx, 'Press any button to return', VIEW_W / 2, VIEW_H - 30, 13, C.faint, 'center');
  }
}

// ------------------------------------------------------------------ pause
export class PauseMenu {
  constructor(app) {
    this.app = app; this.st = { sel: 0 }; this.t = 0;
    app.audio.sfx('menuOpen');
  }
  items() { return [{ label: 'Resume' }, { label: 'Options' }, { label: 'Controls' }, { label: 'Quit to Title' }]; }
  update(dt) {
    const inp = this.app.input, sfx = (n) => this.app.audio.sfx(n);
    this.t += dt;
    if (this.sub) { this.sub.update(dt); if (this.sub.done) this.sub = null; return; }
    menuInput(inp, this.st, 4, sfx);
    if (inp.pressed('back') || (inp.pressed('pause') && this.t > 0.1)) { inp.eatAll(); this.app.closeOverlay(); sfx('menuClose'); return; }
    if (inp.pressed('confirm') || inp.pressed('jump')) {
      inp.eatAll(); sfx('confirm');
      if (this.st.sel === 0) this.app.closeOverlay();
      else if (this.st.sel === 1) this.sub = new OptionsScreen(this.app);
      else if (this.st.sel === 2) this.sub = new ControlsScreen(this.app);
      else this.app.quitToTitle();
    }
  }
  draw(ctx) {
    dim(ctx, 0.6);
    title(ctx, 'Paused', VIEW_W / 2, 150, 32);
    const g = this.app.game;
    if (g) {
      const room = g.room.def;
      const area = AREAS[room.area];
      text(ctx, `${area ? area.name : ''}${room.name ? '  ·  ' + room.name : ''}`, VIEW_W / 2, 200, 15, C.dim, 'center');
      text(ctx, `${fmtTime(g.save.playTime)}   ·   ${completion(g.save)}%`, VIEW_W / 2, 224, 14, C.faint, 'center');
    }
    drawMenu(ctx, this.items(), this.st.sel, VIEW_W / 2, 290, this.t);
    if (this.sub) this.sub.draw(ctx);
  }
}
