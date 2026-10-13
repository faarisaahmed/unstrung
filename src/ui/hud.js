// In-game HUD: thread vessel, shells (health), glints, boss bar, area titles, banners.
import { VIEW_W, VIEW_H } from '../core/constants.js';
import { TAU, clamp } from '../core/math.js';
import { coachLine } from '../game/coach.js';

const INK = '#16141c';

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
    // --- SPIN: a ball of yarn wound tighter as Spin builds, pierced by a needle whose thread carries the Coats ---
    ctx.save(); ctx.scale(1.2, 1.2);
    const vx = 50, vy = 48, vr = 26;
    const frac = Math.max(0, Math.min(1, sv.thread / sv.maxThread));
    const rolling = g.player && Math.abs(g.player.b.vx) > 200;
    this.spinAng = (this.spinAng || 0) + (rolling ? 0.06 : 0.004);
    const canBuff = sv.thread >= this.g.stats.mendCost;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // the needle passes behind the ball: point out lower-left, eye up-right
    const nx0 = vx - 38, ny0 = vy + 30, nx1 = vx + 34, ny1 = vy - 36;
    const na = Math.atan2(ny1 - ny0, nx1 - nx0), nl = Math.hypot(nx1 - nx0, ny1 - ny0);
    ctx.save(); ctx.translate(nx0, ny0); ctx.rotate(na);
    ctx.fillStyle = '#cfcabd'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(nl * 0.3, -2.4, nl - 6, -3.2); ctx.arc(nl - 6, 0, 3.2, -Math.PI / 2, Math.PI / 2); ctx.quadraticCurveTo(nl * 0.3, 2.4, 0, 0); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(nl - 8, 0, 3.6, 1.1, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(8, -0.8); ctx.lineTo(nl - 16, -1.6); ctx.stroke();
    ctx.restore();
    // the ball: dark core, then a wrap of pale yarn for every bit of Spin
    ctx.fillStyle = 'rgba(8,8,12,0.55)'; ctx.beginPath(); ctx.arc(vx + 2, vy + 3, vr + 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1d1a22'; ctx.beginPath(); ctx.arc(vx, vy, vr, 0, TAU); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(vx, vy, vr - 0.5, 0, TAU); ctx.clip();
    ctx.translate(vx, vy);
    const WR = 16, wraps = frac * WR;
    for (let i = 0; i < Math.ceil(wraps); i++) {
      const part = Math.min(1, wraps - i);
      const h = ((i * 0.618034) % 1);
      const rot = i * 2.39996 + this.spinAng * (i % 2 ? 1 : -0.6);
      const ry = vr * (0.22 + 0.62 * h);
      const lit = i < (this.g.stats.mendCost / sv.maxThread) * WR;
      // each wrap is a band of a few parallel strands, like real wound yarn
      for (let pass = 0; pass < 2; pass++) {
        for (let sx = -1; sx <= 1; sx++) {
          ctx.strokeStyle = pass ? (lit && canBuff ? (sx ? '#e9d3a2' : '#f6e8c4') : (sx ? '#bdb197' : '#d8ccb0')) : 'rgba(18,16,22,0.9)';
          ctx.lineWidth = pass ? 1.6 : 3;
          ctx.beginPath(); ctx.ellipse(0, 0, vr * 0.97, Math.max(1, ry + sx * 2.6), rot, Math.PI * 0.1, Math.PI * (0.1 + 2 * part)); ctx.stroke();
        }
      }
    }
    // painted shadow over the yarn
    ctx.fillStyle = 'rgba(10,8,14,0.4)';
    ctx.beginPath(); ctx.arc(0, 0, vr, -0.3, Math.PI * 0.9); ctx.arc(-vr * 0.25, -vr * 0.3, vr * 1.05, Math.PI * 0.85, -0.25, true); ctx.fill();
    ctx.restore();
    // brushed ink rim with a few dry gaps, and a cream retrace
    ctx.strokeStyle = INK;
    for (let i = 0; i < 14; i++) {
      if (i === 4 || i === 11) continue;
      const a0 = (i / 14) * TAU, a1 = ((i + 1.1) / 14) * TAU;
      ctx.lineWidth = 2.2 + 1.6 * Math.max(0, Math.sin(a0 + 0.6));
      ctx.beginPath(); ctx.arc(vx, vy, vr + 0.5, a0, a1); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(239,228,200,0.85)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(vx - 0.6, vy - 0.6, vr + 2.6, -2.9, -0.4); ctx.stroke();
    // the loose end of the yarn: a tiny red tie that brightens when there's enough Spin to Buff
    const ta = -Math.PI / 2 + (this.g.stats.mendCost / sv.maxThread) * TAU;
    const tx = vx + Math.cos(ta) * (vr + 1), ty = vy + Math.sin(ta) * (vr + 1);
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + Math.cos(ta) * 7, ty + Math.sin(ta) * 7); ctx.stroke();
    ctx.strokeStyle = canBuff ? '#e0485a' : '#7a2a32'; ctx.lineWidth = 2; ctx.stroke();
    if (canBuff && frac > 0.99) {
      ctx.strokeStyle = `rgba(255,244,214,${0.35 + 0.25 * Math.sin(t * 5)})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(vx, vy, vr + 5.5, 0, TAU); ctx.stroke();
    }
    ctx.restore();

    // --- COATS: plain ivory beads strung on the needle's thread ---
    if (this.lastHp !== null && sv.hp < this.lastHp) for (let i = sv.hp; i < this.lastHp; i++) this.hpAnim.push({ i, t: 0 });
    if (this.lastHp !== null && sv.hp > this.lastHp) for (let i = this.lastHp; i < sv.hp; i++) this.hpAnim.push({ i, t: 0, gain: true });
    this.lastHp = sv.hp;
    const n = sv.maxHp;
    const ex0 = nx1 - 3, ey0 = ny1 + 3; // the needle's eye
    const sx = 106, step = 22, lx = sx + step * (n - 1) + 14;
    const by = 31;
    const sag = (x) => by + Math.sin(((x - sx) / (lx - sx)) * Math.PI) * 2.5;
    ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    const thread = () => {
      ctx.beginPath(); ctx.moveTo(ex0, ey0); ctx.quadraticCurveTo(ex0 + 10, by + 4, sx - 12, sag(sx - 12));
      for (let x = sx - 12; x <= lx; x += 4) ctx.lineTo(x, sag(x));
      ctx.quadraticCurveTo(lx + 8, sag(lx) + 2, lx + 6 + Math.sin(t * 1.7) * 1.5, sag(lx) + 12);
      ctx.stroke();
    };
    thread(); ctx.strokeStyle = '#a8303a'; ctx.lineWidth = 1.6; thread();
    for (let i = 0; i < n; i++) {
      const x = sx + i * step, y = sag(x);
      const anim = this.hpAnim.find((a) => a.i === i && a.gain);
      if (i < sv.hp) drawCoat(ctx, x, y, anim ? anim.t : 1);
      else {
        ctx.strokeStyle = 'rgba(232,222,196,0.38)'; ctx.lineWidth = 1.2; ctx.setLineDash([2, 2.5]);
        ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    for (let k = this.hpAnim.length - 1; k >= 0; k--) {
      const a = this.hpAnim[k];
      a.t += 1 / 60;
      if (a.t > (a.gain ? 0.5 : 0.7)) { this.hpAnim.splice(k, 1); continue; }
      if (a.gain) continue;
      const x = sx + a.i * step, y = sag(x) + a.t * a.t * 300;
      ctx.globalAlpha = 1 - a.t / 0.7;
      drawCoat(ctx, x + a.t * 24, y, 1, true, a.t * 5);
      ctx.globalAlpha = 1;
    }

    // --- glints ---
    this.shownGlints += clamp(sv.glints - this.shownGlints, -Math.max(1, Math.abs(sv.glints - this.shownGlints) * 0.15), Math.max(1, Math.abs(sv.glints - this.shownGlints) * 0.15));
    if (Math.abs(sv.glints - this.shownGlints) < 1) this.shownGlints = sv.glints;
    const gx = 108, gy = 56;
    ctx.save(); ctx.translate(gx, gy);
    ctx.fillStyle = '#efe2bd'; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(4.5, 0); ctx.lineTo(0, 7); ctx.lineTo(-4.5, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(150,120,70,0.8)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.moveTo(-4.5, 0); ctx.lineTo(4.5, 0); ctx.stroke();
    ctx.restore();
    ctx.font = `20px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(8,8,12,0.7)'; ctx.fillText(String(Math.round(this.shownGlints)), gx + 13, gy + 2.5);
    ctx.fillStyle = '#efe8d6';
    ctx.fillText(String(Math.round(this.shownGlints)), gx + 12, gy + 1);
    // while winding: little loops of yarn fly onto the ball
    if (g.player && g.player.winding && Math.random() < 0.35) (this.windFx = this.windFx || []).push({ a: Math.random() * TAU, t: 0 });
    if (this.windFx) for (let i = this.windFx.length - 1; i >= 0; i--) {
      const w = this.windFx[i]; w.t += 1 / 60;
      if (w.t > 0.4) { this.windFx.splice(i, 1); continue; }
      const d = vr + 16 * (1 - w.t / 0.4), a = w.a + w.t * 4;
      ctx.strokeStyle = `rgba(246,232,196,${1 - w.t / 0.4})`; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(vx + Math.cos(a) * d, vy + Math.sin(a) * d, 2.2, 0, TAU); ctx.stroke();
    }
    ctx.restore();
    // a standing reminder of how to heal, until it has been learned
    const cl = coachLine(g);
    if (cl) {
      ctx.font = `14px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const a = cl.hot ? 0.75 + 0.25 * Math.sin(t * 5) : 0.6;
      ctx.fillStyle = 'rgba(8,8,12,0.55)'; ctx.fillText(cl.str, 23, 113);
      ctx.fillStyle = cl.hot ? `rgba(255,231,168,${a})` : `rgba(220,210,190,${a})`;
      ctx.fillText(cl.str, 22, 112);
    }

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

export function drawCoat(ctx, x, y, grow = 1, cracked = false, spin = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  const k = grow < 1 ? 0.6 + 0.4 * Math.sin(grow * Math.PI * 0.5) + Math.sin(grow * Math.PI) * 0.25 : 1;
  ctx.scale(k, k);
  // a plain ivory bead, flat paint, ink line and a painted shadow
  ctx.fillStyle = '#ebe2cb';
  ctx.beginPath(); ctx.ellipse(0, 0, 8.6, 8.2, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#b9aa8a';
  ctx.beginPath(); ctx.arc(0, 0, 9, -0.25, Math.PI * 0.95); ctx.arc(-2.2, -2.6, 9.4, Math.PI * 0.88, -0.2, true); ctx.fill();
  ctx.strokeStyle = 'rgba(110,90,70,0.45)'; ctx.lineWidth = 0.7;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(1 + i * 2.4, 6.5 - i * 0.6); ctx.lineTo(4 + i * 2.4, 3 - i * 0.6); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = INK;
  for (let i = 0; i < 10; i++) {
    const a0 = (i / 10) * TAU, a1 = ((i + 1.1) / 10) * TAU;
    ctx.lineWidth = 1.4 + 1.1 * Math.max(0, Math.sin(a0 + 0.6));
    ctx.beginPath(); ctx.ellipse(0, 0, 8.6, 8.2, 0, a0, a1); ctx.stroke();
  }
  // the bore, where the thread passes through
  ctx.fillStyle = '#2a1e1e';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 8, 0, 1.2, 2, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,253,244,0.95)';
  ctx.beginPath(); ctx.ellipse(-3.2, -3.6, 2.4, 1.2, -0.6, 0, TAU); ctx.fill();
  if (grow < 1) { ctx.strokeStyle = `rgba(255,246,214,${1 - grow})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 10 + grow * 8, 0, TAU); ctx.stroke(); }
  if (cracked) { ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-3, -7); ctx.lineTo(0, -2); ctx.lineTo(-2, 2); ctx.lineTo(3, 7); ctx.stroke(); }
  ctx.restore();
}
