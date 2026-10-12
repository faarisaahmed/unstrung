// Full-screen text cutscenes: the intro, the three endings, and the credits roll.
import { VIEW_W, VIEW_H } from '../core/constants.js';
import { TAU } from '../core/math.js';
import { C, text, title, flourish, paragraph, wrapLines } from './uikit.js';

export class Cutscene {
  // pages: string[]; opts: {title, music, onDone, art:'moon'|'strand'|'beads'|'light', credits:[lines]}
  constructor(app, pages, opts = {}) {
    this.app = app; this.pages = pages || []; this.opts = opts;
    this.i = 0; this.t = 0; this.pageT = 0;
    this.motes = Array.from({ length: 70 }, () => ({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, v: 5 + Math.random() * 20, s: 0.5 + Math.random() * 2, p: Math.random() * TAU }));
    if (opts.music) app.audio.playMusic(opts.music, { fade: 2 });
    this.creditsY = VIEW_H + 40;
    this.phase = this.pages.length ? 'pages' : 'credits';
  }

  update(dt) {
    const inp = this.app.input;
    this.t += dt; this.pageT += dt;
    for (const m of this.motes) { m.y -= m.v * dt; m.p += dt; if (m.y < -5) { m.y = VIEW_H + 5; m.x = Math.random() * VIEW_W; } }
    if (this.phase === 'pages') {
      const adv = inp.pressed('confirm') || inp.pressed('jump') || inp.pressed('attack');
      const len = (this.pages[this.i] || '').length;
      const auto = 4 + len * 0.045;
      if ((adv && this.pageT > 0.6) || this.pageT > auto) {
        inp.eatAll();
        this.i++; this.pageT = 0;
        if (this.i >= this.pages.length) {
          if (this.opts.credits) { this.phase = 'credits'; this.creditsY = VIEW_H + 40; }
          else this.finish();
        }
      }
      if (inp.pressed('pause')) this.finish();
    } else if (this.phase === 'credits') {
      this.creditsY -= dt * (inp.down('jump') || inp.down('confirm') ? 160 : 40);
      const total = (this.opts.credits || []).length * 34 + 200;
      if (this.creditsY < -total || inp.pressed('pause')) this.finish();
    }
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.opts.onDone && this.opts.onDone();
  }

  draw(ctx) {
    ctx.fillStyle = '#05050a'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.drawArt(ctx);
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      ctx.globalAlpha = 0.3 + 0.3 * Math.sin(m.p * 2);
      ctx.fillStyle = '#e6ecff';
      ctx.beginPath(); ctx.arc(m.x + Math.sin(m.p) * 6, m.y, m.s, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (this.phase === 'pages') {
      if (this.opts.title && this.i === 0) {
        ctx.globalAlpha = Math.min(1, this.pageT);
        title(ctx, this.opts.title, VIEW_W / 2, 110, 34);
        ctx.globalAlpha = 1;
      }
      const p = this.pages[this.i];
      if (p) {
        const fadeIn = Math.min(1, this.pageT / 0.8);
        ctx.globalAlpha = fadeIn;
        const lines = wrapLines(ctx, p, 640, 21);
        const y0 = VIEW_H / 2 - (lines.length * 30) / 2 + (this.opts.title ? 40 : 0);
        lines.forEach((l, k) => text(ctx, l, VIEW_W / 2, y0 + k * 30, 21, '#efe8da', 'center'));
        ctx.globalAlpha = 1;
      }
      text(ctx, '▸', VIEW_W - 30, VIEW_H - 26, 16, `rgba(220,210,190,${0.3 + 0.3 * Math.sin(this.t * 3)})`, 'center');
    } else {
      const lines = this.opts.credits || [];
      let y = this.creditsY;
      title(ctx, 'UNSTRUNG', VIEW_W / 2, y, 40);
      y += 110;
      for (const l of lines) {
        if (y > -40 && y < VIEW_H + 40) {
          const head = l.startsWith('#');
          text(ctx, head ? l.slice(1).trim() : l, VIEW_W / 2, y, head ? 22 : 17, head ? C.gold : '#e8e2d4', 'center');
        }
        y += l === '' ? 18 : 34;
      }
    }
  }

  drawArt(ctx) {
    const art = this.opts.art || 'moon', t = this.t;
    const mx = VIEW_W / 2, my = 150;
    if (art === 'moon' || art === 'strand' || art === 'light') {
      const g = ctx.createRadialGradient(mx, my, 10, mx, my, 260);
      g.addColorStop(0, art === 'light' ? 'rgba(255,240,210,0.25)' : 'rgba(220,228,255,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = art === 'light' ? '#fff3dc' : '#eef2ff';
      ctx.beginPath(); ctx.arc(mx, my, 70, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (art === 'strand') {
      ctx.strokeStyle = 'rgba(184,50,62,0.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx, my, 200, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
    }
  }
}
