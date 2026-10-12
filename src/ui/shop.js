// Shop overlay and Moth Ferry travel overlay.
import { VIEW_W, VIEW_H } from '../core/constants.js';
import { TAU } from '../core/math.js';
import { C, dim, text, title, panel, cursor, paragraph, menuInput } from './uikit.js';
import { drawItemIcon } from '../entities/pickups.js';
import { grantItem } from '../data/items.js';
import { AREAS } from '../data/world.js';

// def: { title, items: [{ key, name, desc, price, icon, give, cond }] }
export class ShopScreen {
  constructor(app, def) {
    this.app = app; this.game = app.game; this.def = def;
    this.st = { sel: 0 }; this.t = 0;
    app.audio.sfx('menuOpen');
  }
  list() {
    const sv = this.game.save;
    return (this.def.items || []).filter((it) => (!it.cond || it.cond(sv)) && !(it.once !== false && sv.flags['bought_' + it.key]));
  }
  update(dt) {
    const inp = this.app.input, sfx = (n) => this.app.audio.sfx(n);
    this.t += dt;
    if (this.t > 0.15 && (inp.pressed('back') || inp.pressed('pause'))) { inp.eatAll(); sfx('menuClose'); this.app.closeOverlay(); return; }
    const items = this.list();
    if (!items.length) { if (this.t > 0.15 && (inp.pressed('confirm') || inp.pressed('jump'))) { inp.eatAll(); this.app.closeOverlay(); } return; }
    this.st.sel = Math.min(this.st.sel, items.length - 1);
    menuInput(inp, this.st, items.length, sfx);
    if (this.t > 0.15 && (inp.pressed('confirm') || inp.pressed('jump'))) {
      inp.eatAll();
      const it = items[this.st.sel];
      const sv = this.game.save;
      if (sv.glints < it.price) { sfx('deny'); this.msg = 'Not enough Glints.'; this.msgT = 1.5; return; }
      sv.glints -= it.price;
      if (it.once !== false) sv.flags['bought_' + it.key] = 1;
      sfx('buy');
      if (typeof it.give === 'function') it.give(this.game);
      else if (it.give) grantItem(this.game, it.give);
      this.game.refreshStats();
      this.msg = it.name + ' acquired.'; this.msgT = 1.5;
    }
    if (this.msgT > 0) this.msgT -= dt;
  }
  draw(ctx) {
    dim(ctx, 0.7);
    title(ctx, this.def.title || 'Shop', VIEW_W / 2, 60, 26);
    const items = this.list();
    panel(ctx, 60, 100, 500, 380);
    if (!items.length) text(ctx, 'Sold out.', 310, 280, 18, C.dim, 'center');
    const visible = 8;
    const top = Math.max(0, Math.min(items.length - visible, this.st.sel - 3));
    items.slice(top, top + visible).forEach((it, k) => {
      const i = top + k;
      const y = 140 + k * 42;
      drawItemIcon(ctx, it.icon || 'relic', 110, y, 1, this.t);
      text(ctx, it.name, 140, y, 17, i === this.st.sel ? '#fff6e0' : C.dim);
      const can = this.game.save.glints >= it.price;
      text(ctx, String(it.price), 520, y, 17, can ? C.gold : C.red, 'right');
      if (i === this.st.sel) cursor(ctx, 80, y, this.t);
    });
    panel(ctx, 580, 100, 320, 380);
    const it = items[this.st.sel];
    if (it) {
      drawItemIcon(ctx, it.icon || 'relic', 740, 170, 2.4, this.t);
      text(ctx, it.name, 740, 230, 19, C.text, 'center');
      paragraph(ctx, it.desc || '', 605, 256, 270, 15, C.dim);
    }
    text(ctx, `◆ ${this.game.save.glints}`, 880, 72, 18, C.text, 'right');
    if (this.msgT > 0) { ctx.globalAlpha = Math.min(1, this.msgT * 2); text(ctx, this.msg, VIEW_W / 2, VIEW_H - 30, 16, C.gold, 'center'); ctx.globalAlpha = 1; }
  }
}

export class FerryScreen {
  constructor(app, from) {
    this.app = app; this.game = app.game; this.from = from;
    this.st = { sel: 0 }; this.t = 0;
    app.audio.sfx('menuOpen');
  }
  stations() {
    const f = this.game.save.ferries;
    return Object.keys(f).map((id) => ({ id, room: f[id], name: (AREAS[id] && AREAS[id].name) || id }));
  }
  update(dt) {
    const inp = this.app.input, sfx = (n) => this.app.audio.sfx(n);
    this.t += dt;
    if (this.t > 0.15 && (inp.pressed('back') || inp.pressed('pause'))) { inp.eatAll(); sfx('menuClose'); this.app.closeOverlay(); return; }
    if (!this.game.save.items.ferryPass) { if (this.t > 0.3 && (inp.pressed('confirm') || inp.pressed('jump'))) { inp.eatAll(); this.app.closeOverlay(); } return; }
    const st = this.stations();
    menuInput(inp, this.st, st.length, sfx);
    if (this.t > 0.15 && (inp.pressed('confirm') || inp.pressed('jump'))) {
      inp.eatAll();
      const s = st[this.st.sel];
      if (!s || s.room === this.game.room.id) { sfx('deny'); return; }
      sfx('confirm');
      this.app.closeOverlay();
      const g = this.game;
      g.player.locked = true;
      g.startFade(() => { g.enterRoomAt(s.room, { markerType: 'ferry' }); g.sfx('dash'); }, 2);
    }
  }
  draw(ctx) {
    dim(ctx, 0.75);
    title(ctx, 'Moth Ferry', VIEW_W / 2, 70, 26);
    if (!this.game.save.items.ferryPass) {
      text(ctx, 'The moth watches you, unimpressed.', VIEW_W / 2, 220, 18, C.dim, 'center');
      text(ctx, 'It will not carry you without a Ferry Pass from Spindletown.', VIEW_W / 2, 250, 16, C.faint, 'center');
      return;
    }
    const st = this.stations();
    panel(ctx, 280, 110, 400, Math.max(120, st.length * 34 + 40));
    st.forEach((s, i) => {
      const y = 140 + i * 34;
      const here = s.room === this.game.room.id;
      text(ctx, s.name + (here ? '  (here)' : ''), 330, y, 18, i === this.st.sel ? '#fff6e0' : here ? C.faint : C.dim);
      if (i === this.st.sel) cursor(ctx, 310, y, this.t);
    });
  }
}
