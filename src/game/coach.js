// The Coach: one-time, in-context tips that teach the survival loop (Coats, Spin, Buffing) the first
// time each situation actually happens, plus a small standing reminder by the HUD until it sticks.
export const KEYS = {
  keyboard: { focus: 'F', attack: 'X', rest: '↑', inv: 'E' },
  pad: { focus: 'Y', attack: 'X', rest: 'Up', inv: 'RT' },
};

export function keys(g) { return KEYS[g.input.lastDevice === 'pad' ? 'pad' : 'keyboard']; }

const TIPS = [
  {
    id: 'tut_hurt', when: (g, sv) => sv.hp < sv.maxHp,
    title: 'You lost a Coat',
    desc: (k) => 'The ivory beads on the thread (top left) are your Coats of lacquer. Lose them all and Bead unravels.\nTo get one back, wind up Spin, then Buff.',
  },
  {
    id: 'tut_spin', when: (g, sv) => g.player.winding && sv.flags.tut_hurt,
    title: 'Winding Spin',
    desc: (k) => 'Rolling at full speed winds yarn onto the ball (top left). That yarn is your Spin.\nBonking enemies winds it too.',
  },
  {
    id: 'tut_buff', when: (g, sv) => sv.hp < sv.maxHp && sv.thread >= g.stats.mendCost && sv.flags.tut_hurt,
    title: 'Ready to Buff',
    desc: (k) => `Roll at full speed and hold ${k.focus} to polish a Coat back. Keep rolling until it finishes;\nstopping cancels it. Each Buff uses some Spin.`,
  },
  {
    id: 'tut_buffed', when: (g, sv) => (sv.flags.buffs || 0) > 0,
    title: 'Buffed',
    desc: (k) => 'Good as new. You can top up between fights by rolling back and forth.\nThe hard part is Buffing mid-fight. Resting at a Spindle heals you fully.',
  },
];

export function updateCoach(g, dt) {
  const sv = g.save, p = g.player;
  if (!p || p.dead || g.cutscene || g.dialogue || g.echo) return;
  // don't interrupt other banners; wait for a quiet moment
  if (g.message) return;
  const inFight = g.bossBar && g.bossBar.boss && !g.bossBar.boss.dead;
  for (const tip of TIPS) {
    if (sv.flags[tip.id]) continue;
    if (inFight || !tip.when(g, sv)) continue;
    sv.flags[tip.id] = 1;
    g.message = { title: tip.title, desc: tip.desc(keys(g)), t: 0, dur: 6.5, hint: true };
    break;
  }
  // holding Focus without being able to Buff: say why (throttled)
  g.coachT = Math.max(0, (g.coachT || 0) - dt);
  if (p.buffBlocked && g.coachT <= 0) {
    g.coachT = 1.6;
    g.fx.text(p.cx, p.cy - 28, p.buffBlocked === 'spin' ? 'Not enough Spin' : 'Roll to Buff!', '#ffe7a8', 14);
  }
}

// small reminder under the yarn ball while hurt, until Bead has Buffed a few times
export function coachLine(g) {
  const sv = g.save, p = g.player;
  if (!p || p.dead || sv.hp >= sv.maxHp || (sv.flags.buffs || 0) >= 4) return null;
  const k = keys(g);
  if (p.mending > 0) return { str: 'Buffing... keep rolling', hot: true };
  if (sv.thread >= g.stats.mendCost) return { str: `Roll + hold ${k.focus}: Buff a Coat back`, hot: true };
  return { str: 'Roll fast or Bonk foes to wind Spin', hot: false };
}
