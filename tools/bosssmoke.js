// Drops Bead into every boss room's arena, lets the fight run, damages the boss through its phases, reports errors.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const page = await browser.newPage();
let current = 'boot';
const errs = {}, info = {};
page.on('console', (m) => { if (m.type() === 'error') (errs[current] = errs[current] || new Set()).add(m.text().slice(0, 220)); });
page.on('pageerror', (e) => (errs[current] = errs[current] || new Set()).add('[pageerror] ' + e.message.slice(0, 220)));
await page.goto('http://localhost:8080/?room=fray_cradle&ab=all', { waitUntil: 'load', timeout: 120000 });
await new Promise((r) => setTimeout(r, 1500));
const only = process.argv.slice(2);
const rooms0 = await page.evaluate(async () => {
  const w = await import('/src/data/world.js');
  return Object.values(w.ROOMS).filter((r) => Object.values(r.legend || {}).some((l) => l && l.e === 'boss')).map((r) => r.id);
});
const rooms = only.length ? rooms0.filter((r) => only.includes(r)) : rooms0;
for (const id of rooms) {
  current = id;
  await page.evaluate((id) => {
    const g = window.__app.game;
    g.save.flags = { trio_ready: 1 }; g.save.items.voidThread = 0; window.__app.ending = () => {};
    g.fadeCb = null; g.fade = 0;
    g.enterRoomAt(id, { spawn: true });
    g.player.invuln = 999;
    const b = g.entities.find((e) => e.isBoss);
    if (b) { g.player.b.x = b.arena.x + b.arena.w / 2; g.player.b.y = b.groundY - 40; }
  }, id);
  const res = await page.evaluate(async () => {
    const g = window.__app.game;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const b = g.entities.find((e) => e.isBoss);
    if (!b) return 'no boss entity';
    await wait(3500);
    const modes = [b.mode];
    for (const f of [0.6, 0.3]) { g.player.invuln = 999; if (b.mode === 'fight') b.hurt(Math.max(1, b.hp - b.maxHp * f), 1, 'x'); await wait(2500); modes.push(b.mode + ':p' + b.phase); }
    g.player.invuln = 999;
    if (b.mode === 'fight') b.hurt(b.hp + 10, 1, 'x');
    await wait(3500);
    return `${b.id} ${modes.join(',')} -> ${b.mode}${b.dead ? ' dead' : ''}`;
  });
  info[id] = res;
  console.log(id.padEnd(20), res, errs[id] ? '  ERRORS: ' + [...errs[id]].join(' | ') : '');
}
await browser.close();
