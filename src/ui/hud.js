// In-game HUD: thread vessel, shells (health), glints, boss bar, area titles, banners.
import { VIEW_W, VIEW_H } from '../core/constants.js';
import { TAU, clamp } from '../core/math.js';

export const FONT = 'Georgia, "Times New Roman", serif';

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
    // --- thread vessel: a spool ---
    const vx = 52, vy = 50, vr = 30;
    ctx.save();
    ctx.fillStyle = 'rgba(10,10,14,0.85)';
    ctx.beginPath(); ctx.arc(vx, vy, vr + 5, 0, TAU); ctx.fill();
    const frac = sv.thread / sv.maxThread;
    ctx.save();
    ctx.beginPath(); ctx.arc(vx, vy, vr, 0, TAU); ctx.clip();
    const fillY = vy + vr - frac * vr * 2;
    const grd = ctx.createLinearGradient(0, vy - vr, 0, vy + vr);
    grd.addColorStop(0, '#fff6e2'); grd.addColorStop(1, '#d8c9a4');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(vx - vr, vy + vr);
    for (let i = 0; i <= 12; i++) {
      const px = vx - vr + (i / 12) * vr * 2;
      ctx.lineTo(px, fillY + Math.sin(t * 3 + i * 0.8) * (frac > 0.02 && frac < 0.98 ? 2 : 0));
    }
    ctx.lineTo(vx + vr, vy + vr); ctx.fill();
    // wound thread texture
    ctx.strokeStyle = 'rgba(160,130,90,0.35)'; ctx.lineWidth = 1;
    for (let y = vy - vr; y < vy + vr; y += 4) {
      if (y < fillY) continue;
      ctx.beginPath(); ctx.moveTo(vx - vr, y); ctx.lineTo(vx + vr, y + 2); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = '#e8e0cc'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(vx, vy, vr, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#16141c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(vx, vy, vr + 3, 0, TAU); ctx.stroke();
    // a curl of loose thread from the spool
    ctx.strokeStyle = '#b8323e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(vx + vr * 0.7, vy + vr * 0.7);
    ctx.bezierCurveTo(vx + vr + 10, vy + vr + 8, vx + vr + 18, vy + 4, vx + vr + 26, vy + 12); ctx.stroke();
    // extra vessel fragments indicator
    const extra = Math.floor(sv.vesselFrags / 3);
    for (let i = 0; i < extra; i++) {
      ctx.fillStyle = '#e8e0cc';
      ctx.beginPath(); ctx.arc(vx - 18 + i * 14, vy + vr + 14, 4, 0, TAU); ctx.fill();
    }
    ctx.restore();

    // --- shells ---
    if (this.lastHp !== null && sv.hp < this.lastHp) {
      for (let i = sv.hp; i < this.lastHp; i++) this.hpAnim.push({ i, t: 0 });
    }
    this.lastHp = sv.hp;
    for (let i = 0; i < sv.maxHp; i++) {
      const x = 104 + i * 30, y = 38;
      drawShell(ctx, x, y, i < sv.hp, t, i);
    }
    for (let k = this.hpAnim.length - 1; k >= 0; k--) {
      const a = this.hpAnim[k];
      a.t += 1 / 60;
      if (a.t > 0.5) { this.hpAnim.splice(k, 1); continue; }
      const x = 104 + a.i * 30, y = 38;
      ctx.globalAlpha = 1 - a.t / 0.5;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 10 + a.t * 40, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // --- glints ---
    this.shownGlints += clamp(sv.glints - this.shownGlints, -Math.max(1, Math.abs(sv.glints - this.shownGlints) * 0.15), Math.max(1, Math.abs(sv.glints - this.shownGlints) * 0.15));
    if (Math.abs(sv.glints - this.shownGlints) < 1) this.shownGlints = sv.glints;
    const gx = 104, gy = 72;
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
      const by = VIEW_H - 70 - bh;
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

function drawShell(ctx, x, y, full, t, i) {
  ctx.save();
  ctx.translate(x, y);
  // a little bead-shaped shell with a notch
  ctx.fillStyle = full ? '#f4eedf' : 'rgba(20,20,26,0.8)';
  ctx.strokeStyle = full ? '#16141c' : 'rgba(220,210,190,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill(); ctx.stroke();
  if (full) {
    ctx.fillStyle = '#16141c';
    ctx.beginPath(); ctx.ellipse(-3, -1, 1.8, 2.8, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(3, -1, 1.8, 2.8, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(-3, -4, 5, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
  }
  ctx.restore();
}
