// Loads every room in a live page, lets it run briefly, and reports console errors per room.
// usage: node tools/smoke.js [areaPrefix]
import puppeteer from 'puppeteer-core';
const prefix = process.argv[2] || '';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540 });
let current = 'boot';
const errs = {};
page.on('console', (m) => { if (m.type() === 'error') (errs[current] = errs[current] || new Set()).add(m.text().slice(0, 200)); });
page.on('pageerror', (e) => (errs[current] = errs[current] || new Set()).add('[pageerror] ' + e.message.slice(0, 200)));
await page.goto('http://localhost:8080/?room=fray_cradle&ab=all', { waitUntil: 'load', timeout: 120000 });
await new Promise((r) => setTimeout(r, 1500));
const ids = await page.evaluate(async (p) => { const w = await import('/src/data/world.js'); return Object.keys(w.ROOMS).filter((id) => id.startsWith(p) && !id.startsWith('test_') && !id.startsWith('__')); }, prefix);
for (const id of ids) {
  current = id;
  await page.evaluate((id) => {
    const g = window.__app.game;
    g.player.invuln = 99;
    const r = g.room;
    g.fadeCb = null; g.fade = 0;
    try { g.enterRoomAt(id, { spawn: true }); } catch (e) { console.error('enter failed ' + e.message); }
  }, id);
  await new Promise((r) => setTimeout(r, 450));
}
await browser.close();
const bad = Object.entries(errs);
console.log(`smoke: ${ids.length} rooms, ${bad.length} with errors`);
for (const [id, set] of bad) console.log(' ', id, '→', [...set].slice(0, 3).join(' | '));
