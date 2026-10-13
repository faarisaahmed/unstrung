// Contact sheet: one screenshot per room id, tiled into a grid PNG (needs python3 + PIL).
// usage: node tools/contact.js out.png room1 room2 ...   (env QS="&ab=all")
import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [out, ...rooms] = process.argv.slice(2);
const dir = fs.mkdtempSync(path.join(path.dirname(out), 'cs_'));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540 });
const files = [];
for (const r of rooms) {
  await page.goto(`http://localhost:8080/?room=${r}${process.env.QS || '&ab=all'}`, { waitUntil: 'load', timeout: 120000 });
  await page.evaluate(() => { try { const g = window.__app.game; g.areaTitle = null; g.player.invuln = 99; } catch {} });
  await new Promise((res) => setTimeout(res, 2600));
  await page.evaluate(() => { try { window.__app.game.areaTitle = null; } catch {} });
  await new Promise((res) => setTimeout(res, 300));
  const f = path.join(dir, r + '.png');
  await page.screenshot({ path: f });
  files.push(f);
}
await browser.close();
execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
files = sys.argv[2:]
cols = 3
w, h = 480, 270
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * (h + 18)), (10, 10, 12))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((w, h))
    x, y = (i % cols) * w, (i // cols) * (h + 18)
    sheet.paste(im, (x, y + 18))
    d.text((x + 6, y + 3), f.split('/')[-1][:-4], fill=(220, 210, 190))
sheet.save(sys.argv[1])
`, out, ...files]);
console.log('wrote', out);
