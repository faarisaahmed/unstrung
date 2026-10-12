// Typewriter dialogue box with optional speaker name and choices.
import { VIEW_W, VIEW_H } from '../core/constants.js';
import { FONT } from './hud.js';

export class Dialogue {
  // pages: array of strings, or {text, speaker} objects. opts: {speaker, choices:[{label, fn}], onEnd, style:'lore'}
  constructor(game, pages, opts = {}) {
    this.g = game;
    this.pages = pages.map((p) => (typeof p === 'string' ? { text: p } : p));
    this.i = 0; this.chars = 0; this.opts = opts;
    this.choice = 0; this.done = false;
    this.wait = 0.15;
    game.sfx('talk');
  }

  get page() { return this.pages[this.i]; }

  update(dt) {
    const inp = this.g.input;
    this.wait -= dt;
    const txt = this.page.text;
    if (this.chars < txt.length) {
      const prev = Math.floor(this.chars);
      this.chars += dt * (this.opts.style === 'lore' ? 70 : 48);
      if (Math.floor(this.chars) !== prev && Math.floor(this.chars) % 3 === 0 && txt[Math.floor(this.chars)] !== ' ') this.g.sfx('blip', this.opts.voice || 0);
      if (this.wait <= 0 && (inp.pressed('jump') || inp.pressed('attack') || inp.pressed('confirm'))) { this.chars = txt.length; inp.eatAll(); }
      return;
    }
    const last = this.i === this.pages.length - 1;
    if (last && this.opts.choices) {
      if (inp.pressed('up')) { this.choice = (this.choice + this.opts.choices.length - 1) % this.opts.choices.length; this.g.sfx('tick'); }
      if (inp.pressed('down')) { this.choice = (this.choice + 1) % this.opts.choices.length; this.g.sfx('tick'); }
    }
    if (this.wait <= 0 && (inp.pressed('jump') || inp.pressed('confirm') || inp.pressed('attack'))) {
      inp.eatAll();
      if (!last) { this.i++; this.chars = 0; return; }
      this.close();
      if (this.opts.choices) this.opts.choices[this.choice].fn && this.opts.choices[this.choice].fn();
    }
    if (inp.pressed('back') && !this.opts.choices && false) this.close();
  }

  close() {
    if (this.done) return;
    this.done = true;
    if (this.g.dialogue === this) this.g.dialogue = null;
    this.opts.onEnd && this.opts.onEnd();
  }

  draw(ctx) {
    const lore = this.opts.style === 'lore';
    const w = 640, h = lore ? 170 : 130, x = (VIEW_W - w) / 2, y = lore ? VIEW_H / 2 - h / 2 - 30 : 46;
    ctx.fillStyle = lore ? 'rgba(8,8,14,0.88)' : 'rgba(6,6,10,0.82)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(230,220,200,0.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 20, y + 6); ctx.lineTo(x + w - 20, y + 6); ctx.moveTo(x + 20, y + h - 6); ctx.lineTo(x + w - 20, y + h - 6); ctx.stroke();
    const speaker = this.page.speaker || this.opts.speaker;
    ctx.textAlign = lore ? 'center' : 'left'; ctx.textBaseline = 'top';
    if (speaker) {
      ctx.font = `17px ${FONT}`; ctx.fillStyle = '#e8c98a';
      ctx.fillText(speaker, lore ? VIEW_W / 2 : x + 28, y + 16);
    }
    ctx.font = `${lore ? 17 : 18}px ${FONT}`;
    ctx.fillStyle = lore ? '#e6e0f0' : '#f1ebdc';
    const shown = this.page.text.slice(0, Math.floor(this.chars));
    const lines = wrap(ctx, shown, w - 56, this.page.text);
    lines.forEach((l, i) => ctx.fillText(l, lore ? VIEW_W / 2 : x + 28, y + (speaker ? 42 : 24) + i * 24));
    const last = this.i === this.pages.length - 1;
    if (this.chars >= this.page.text.length) {
      if (last && this.opts.choices) {
        const cx = x + w - 200;
        this.opts.choices.forEach((c, i) => {
          ctx.fillStyle = i === this.choice ? '#fff6dd' : 'rgba(220,210,190,0.5)';
          ctx.textAlign = 'left';
          ctx.fillText((i === this.choice ? '› ' : '  ') + c.label, cx, y + h + 10 + i * 24);
        });
      } else {
        ctx.fillStyle = 'rgba(240,230,210,0.7)';
        const by = y + h - 18 + Math.sin(this.g.time * 5) * 2;
        ctx.beginPath(); ctx.moveTo(x + w - 30, by); ctx.lineTo(x + w - 22, by); ctx.lineTo(x + w - 26, by + 5); ctx.fill();
      }
    }
  }
}

// Word-wrap using the full text so lines don't reflow while typing
function wrap(ctx, shown, maxW, full) {
  const words = full.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (w.includes('\n')) {
      const parts = w.split('\n');
      parts.forEach((p, i) => {
        const test = cur ? cur + ' ' + p : p;
        if (i < parts.length - 1) { lines.push(test); cur = ''; } else cur = test;
      });
      continue;
    }
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  // trim to shown length
  let remaining = shown.length;
  const out = [];
  for (const l of lines) {
    if (remaining <= 0) break;
    out.push(l.slice(0, remaining));
    remaining -= l.length + 1;
  }
  return out;
}
