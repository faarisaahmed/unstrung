// In-game HUD: thread vessel, shells (health), glints, boss bar, area titles, banners.
import { VIEW_W, VIEW_H } from '../core/constants.js';
import { TAU, clamp } from '../core/math.js';

export const FONT = '"IM Fell English", Georgia, serif';

export class HUD {
  constructor(game) {
    this.g = game;
    this.shownGlints = 0;
    this.hpAnim = [];
    this.lastHp = null;
  }

  draw(ctx) {
    const g = this.g, sv = g.save;
    if (g.cutscene && g.cutscene.hideHud) return;
    const t = g.time;
    // --- SPIN: a lacquered spinning disc; the gold wedge is your Spin, the spiral turns faster as it fills ---
    const vx = 52, vy = 50, vr = 29;
    const frac = Math.max(0, Math.min(1, sv.thread / sv.maxThread));
    this.spinAng = (this.spinAng || 0) + (0.4 + frac * 7) / 60;
    ctx.save();
    // ink shadow + rim
    ctx.fillStyle = 'rgba(8,8,12,0.85)';
    ctx.beginPath(); ctx.arc(vx + 1.5, vy + 2, vr + 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1b1820';
    ctx.beginPath(); ctx.arc(vx, vy, vr + 4, 0, TAU); ctx.fill();
    // the filled wedge (clockwise from top)
    if (frac > 0) {
      const gr = ctx.createRadialGradient(vx - 6, vy - 8, 2, vx, vy, vr);
      gr.addColorStop(0, '#fff3cf'); gr.addColorStop(0.55, '#e9b955'); gr.addColorStop(1, '#a06a22');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(vx, vy); ctx.arc(vx, vy, vr, -Math.PI / 2, -Math.PI / 2 + frac * TAU); ctx.closePath(); ctx.fill();
    }
    // engraved spiral that spins
    ctx.save();
    ctx.beginPath(); ctx.arc(vx, vy, vr, 0, TAU); ctx.clip();
    ctx.translate(vx, vy); ctx.rotate(this.spinAng);
    ctx.strokeStyle = frac > 0.99 ? 'rgba(255,250,230,0.85)' : 'rgba(30,24,20,0.55)'; ctx.lineWidth = 1.4;
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      for (let k = 0; k <= 30; k++) { const r = k / 30 * vr, a = arm * TAU / 3 + k * 0.16; ctx[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
      ctx.stroke();
    }
    ctx.restore();
    // hand-inked rims
    ctx.strokeStyle = '#efe4c8'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(vx, vy, vr + 1, -2.9, 2.6); ctx.stroke();
    ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(vx + 0.6, vy - 0.4, vr + 4.5, 0.4, 3.6); ctx.stroke();
    ctx.fillStyle = '#16141c'; ctx.beginPath(); ctx.arc(vx, vy, 4, 0, TAU); ctx.fill();
    // buff cost tick on the rim
    const cost = this.g.stats.mendCost / sv.maxThread;
    const ca = -Math.PI / 2 + cost * TAU;
    ctx.strokeStyle = 'rgba(255,240,210,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(vx + Math.cos(ca) * (vr - 4), vy + Math.sin(ca) * (vr - 4)); ctx.lineTo(vx + Math.cos(ca) * (vr + 5), vy + Math.sin(ca) * (vr + 5)); ctx.stroke();
    ctx.restore();

    // --- COATS: lacquer beads strung on Bead's red thread ---
    if (this.lastHp !== null && sv.hp < this.lastHp) for (let i = sv.hp; i < this.lastHp; i++) this.hpAnim.push({ i, t: 0 });
    this.lastHp = sv.hp;
    const n = sv.maxHp;
    const sx = vx + vr + 10, ex = sx + 26 * n + 10;
    const sag = (x) => 30 + Math.sin(((x - sx) / (ex - sx)) * Math.PI) * 9 + Math.sin(t * 1.3 + x * 0.05) * 0.8;
    ctx.strokeStyle = '#b8323e'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = sx; x <= ex; x += 4) ctx[x === sx ? 'moveTo' : 'lineTo'](x, sag(x));
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex, sag(ex)); ctx.quadraticCurveTo(ex + 8, sag(ex) + 10, ex + 4 + Math.sin(t * 2) * 2, sag(ex) + 18); ctx.stroke();
    const hues = ['#d9a441', '#c9574a', '#4f8f8a', '#8a6bb8', '#d07a3c', '#5b86c4', '#b5527a', '#7aa04a', '#c99a52', '#6a6fc0', '#c25b5b', '#4c9a7a'];
    for (let i = 0; i < n; i++) {
      const x = sx + 18 + i * 26, y = sag(x) + 6;
      if (i < sv.hp) drawCoat(ctx, x, y, hues[i % hues.length], t, i);
      else {
        // an empty knot where the bead slipped off
        ctx.strokeStyle = '#b8323e'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y - 4, 3, 0, TAU); ctx.stroke();
      }
    }
    for (let k = this.hpAnim.length - 1; k >= 0; k--) {
      const a = this.hpAnim[k];
      a.t += 1 / 60;
      if (a.t > 0.7) { this.hpAnim.splice(k, 1); continue; }
      const x = sx + 18 + a.i * 26, y = sag(x) + 6 + a.t * a.t * 300;
      ctx.globalAlpha = 1 - a.t / 0.7;
      drawCoat(ctx, x + a.t * 30, y, hues[a.i % hues.length], t, a.i, true);
      ctx.globalAlpha = 1;
    }

    // --- glints ---
    this.shownGlints += clamp(sv.glints - this.shownGlints, -Math.max(1, Math.abs(sv.glints - this.shownGlints) * 0.15), Math.max(1, Math.abs(sv.glints - this.shownGlints) * 0.15));
    if (Math.abs(sv.glints - this.shownGlints) < 1) this.shownGlints = sv.glints;
    const gx = 104, gy = 76;
    ctx.fillStyle = '#f3e7c4';
    ctx.save(); ctx.translate(gx, gy); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-5, -5, 10, 10); ctx.restore();
    ctx.strokeStyle = '#16141c'; ctx.lineWidth = 1;
    ctx.font = `20px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#efe8d6';
    ctx.fillText(String(Math.round(this.shownGlints)), gx + 14, gy + 1);

    // --- boss bar ---
    if (g.bossBar && g.bossBar.boss && !g.bossBar.boss.dead) {
      const bb = g.bossBar, boss = bb.boss;
      const w = 420, x = (VIEW_W - w) / 2, y = VIEW_H - 40;
      const f = Math.max(0, boss.hp / boss.maxHp);
      bb.shown = bb.shown === undefined ? f : bb.shown + (f - bb.shown) * 0.08;
      ctx.fillStyle = 'rgba(10,10,14,0.7)'; ctx.fillRect(x - 3, y - 3, w + 6, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y, w * bb.shown, 6);
      ctx.fillStyle = '#efe6cf'; ctx.fillRect(x, y, w * f, 6);
      ctx.font = `15px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#efe6cf';
      ctx.fillText(boss.title || boss.name, VIEW_W / 2, y - 14);
    }

    // --- area title card ---
    if (g.areaTitle) {
      const a = g.areaTitle;
      const k = a.t < 0.8 ? a.t / 0.8 : a.t > 3.5 ? Math.max(0, 1 - (a.t - 3.5)) : 1;
      ctx.globalAlpha = k;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const y = a.big ? VIEW_H * 0.3 : 90;
      if (a.big) {
        ctx.font = `15px ${FONT}`; ctx.fillStyle = '#d9d2c0';
        ctx.fillText(a.sub ? a.sub.toUpperCase() : '', VIEW_W / 2, y - 34);
      }
      ctx.font = `${a.big ? 46 : 26}px ${FONT}`;
      ctx.fillStyle = '#f4eedf';
      ctx.fillText(spaced(a.name.toUpperCase()), VIEW_W / 2, y);
      flourish(ctx, VIEW_W / 2, y + (a.big ? 34 : 22), a.big ? 200 : 120);
      ctx.globalAlpha = 1;
    }

    // --- item banner ---
    if (g.message && g.message.hint) {
      const m = g.message;
      const k = m.t < 0.3 ? m.t / 0.3 : m.t > m.dur - 0.5 ? Math.max(0, (m.dur - m.t) / 0.5) : 1;
      ctx.globalAlpha = k;
      const lines = m.desc ? m.desc.split('\n') : [];
      const bh = 44 + lines.length * 20;
      const by = g.areaTitle ? 230 : 120;
      const grd = ctx.createLinearGradient(0, by, 0, by + bh);
      grd.addColorStop(0, 'rgba(6,6,10,0)'); grd.addColorStop(0.25, 'rgba(6,6,10,0.7)'); grd.addColorStop(0.75, 'rgba(6,6,10,0.7)'); grd.addColorStop(1, 'rgba(6,6,10,0)');
      ctx.fillStyle = grd; ctx.fillRect(VIEW_W / 2 - 330, by, 660, bh);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `22px ${FONT}`; ctx.fillStyle = '#fff6e0';
      ctx.fillText(m.title, VIEW_W / 2, by + 24);
      ctx.font = `15px ${FONT}`; ctx.fillStyle = '#cfc8b5';
      lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, by + 48 + i * 20));
      ctx.globalAlpha = 1;
    } else if (g.message) {
      const m = g.message;
      const k = m.t < 0.3 ? m.t / 0.3 : m.t > m.dur - 0.5 ? Math.max(0, (m.dur - m.t) / 0.5) : 1;
      ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(6,6,10,0.75)';
      const bh = m.desc ? 120 : 70;
      ctx.fillRect(0, VIEW_H / 2 - bh / 2 - 40, VIEW_W, bh);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `30px ${FONT}`; ctx.fillStyle = '#fff6e0';
      ctx.fillText(m.title, VIEW_W / 2, VIEW_H / 2 - 40 - (m.desc ? 22 : 0));
      if (m.desc) {
        ctx.font = `16px ${FONT}`; ctx.fillStyle = '#cfc8b5';
        const lines = m.desc.split('\n');
        lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, VIEW_H / 2 - 30 + 12 + i * 22));
      }
      ctx.globalAlpha = 1;
    }

    if (g.app.options && g.app.options.timer) {
      const tt = sv.playTime, h = Math.floor(tt / 3600), mm = Math.floor((tt % 3600) / 60), ss = Math.floor(tt % 60);
      ctx.font = `14px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(239,232,214,0.7)';
      ctx.fillText(`${h}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, VIEW_W - 16, 14);
    }
    if (g.player && g.player.dead && !g.echo) {
      g.deathT = (g.deathT || 0) + 1 / 60;
      const k = Math.min(1, Math.max(0, (g.deathT - 0.4) / 0.6));
      ctx.globalAlpha = k;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `30px ${FONT}`; ctx.fillStyle = '#efe6cf';
      ctx.fillText(sv.brittle ? 'The thread has snapped.' : 'Unravelled', VIEW_W / 2, VIEW_H / 2 - 10);
      if (!sv.brittle && sv.tangle && sv.tangle.glints) { ctx.font = `15px ${FONT}`; ctx.fillStyle = '#b8a8a0'; ctx.fillText('Your glints are caught in a Tangle where you fell.', VIEW_W / 2, VIEW_H / 2 + 26); }
      ctx.globalAlpha = 1;
    } else if (g.player) g.deathT = 0;
    if (g.dialogue) g.dialogue.draw(ctx);
  }
}

export function spaced(s) { return s.split('').join(String.fromCharCode(8202)); }

export function flourish(ctx, x, y, w) {
  ctx.strokeStyle = '#d9d2c0'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.5, y - 6, x - 10, y);
  ctx.moveTo(x + w, y); ctx.quadraticCurveTo(x + w * 0.5, y - 6, x + 10, y);
  ctx.stroke();
  ctx.fillStyle = '#d9d2c0';
  ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5, y); ctx.fill();
}

function drawCoat(ctx, x, y, hue, t, i, cracked) {
  ctx.save();
  ctx.translate(x, y);
  // a glossy lacquered bead, hand-inked
  const g = ctx.createRadialGradient(-3, -4, 1, 0, 0, 10);
  g.addColorStop(0, '#fff8e6'); g.addColorStop(0.35, hue); g.addColorStop(1, '#1d1418');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, 9.5, 9, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#16141c'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(-1, -1, 5.5, 3.6, 4.6); ctx.stroke();
  ctx.fillStyle = '#16141c'; ctx.beginPath(); ctx.ellipse(0, -8.5, 2.2, 1.4, 0, 0, TAU); ctx.fill();
  if (cracked) { ctx.strokeStyle = '#16141c'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(0, -1); ctx.lineTo(-2, 3); ctx.lineTo(3, 7); ctx.stroke(); }
  ctx.restore();
}
