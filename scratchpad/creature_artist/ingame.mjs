// usage: node ingame.mjs out.png room1 room2 ...  -> grid of 3x upscaled crops of each enemy in game
import puppeteer from '/Users/faaris/WORKSPACE/Games/metroidvania/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const [out, ...rooms] = process.argv.slice(2);
const dir = fs.mkdtempSync('/tmp/ig_'.replace('/tmp', process.cwd()));
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.setViewport({ width: 960, height: 540 });
const files = [];
for (const r of rooms) {
  await p.goto(`http://localhost:8080/?room=${r}&ab=all`, { waitUntil: 'load' });
  await new Promise(res => setTimeout(res, 1800));
  const n = await p.evaluate(() => { const g = __app.game; g.areaTitle = null; g.player.invuln = 999; return g.entities.filter(e => e.isEnemy && !e.isBoss).length; });
  for (let i = 0; i < Math.min(n, 8); i++) {
    const info = await p.evaluate((i) => { const g = __app.game; g.areaTitle = null; const e = g.entities.filter(e => e.isEnemy && !e.isBoss)[i]; if (!e) return null; window.__tgt = e; g.player.b.x = e.cx + 120; g.player.b.y = e.y - 20; g.player.b.vx = 0; g.player.b.vy = 0; return { id: e.def.id }; }, i);
    if (!info) continue;
    await new Promise(res => setTimeout(res, 900));
    const box = await p.evaluate((i) => { const g = __app.game; const e = window.__tgt; if (!e) return null; return { x: e.cx - g.camera.viewX, y: e.cy - g.camera.viewY, s: Math.max(e.w, e.h) }; }, i);
    if (!box) continue;
    await new Promise(res => setTimeout(res, 60));
    const S = Math.max(70, box.s * 2.2);
    const clip = { x: Math.max(0, Math.min(960 - S, box.x - S / 2)), y: Math.max(0, Math.min(540 - S, box.y - S / 2)), width: S, height: S };
    const f = `${dir}/${r}_${i}_${info.id}.png`;
    await p.screenshot({ path: f, clip });
    files.push(f);
  }
}
await b.close();
execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
files = sys.argv[2:]; cols = 6; C = 200
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * C, rows * (C + 14)), (10, 10, 12)); d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((C, C), Image.NEAREST)
    x, y = (i % cols) * C, (i // cols) * (C + 14)
    sheet.paste(im, (x, y + 14)); d.text((x + 3, y + 1), f.split('/')[-1][:-4][-30:], fill=(220, 210, 190))
sheet.save(sys.argv[1])
`, out, ...files]);
fs.rmSync(dir, { recursive: true });
console.log(errs.length ? [...new Set(errs)].join('\n') : 'ok', files.length);
