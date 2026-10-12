// Headless smoke test + screenshots.
// usage: node tools/shot.js out.png [waitMs] [--eval "js to run in page"] [--keys "Right:800,Z:200"]
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const out = args[0] || 'shot.png';
const wait = Number(args[1]) || 1500;
const evalIdx = args.indexOf('--eval');
const evalJs = evalIdx >= 0 ? args[evalIdx + 1] : null;
const keysIdx = args.indexOf('--keys');
const keys = keysIdx >= 0 ? args[keysIdx + 1] : null;
const url = process.env.URL || 'http://localhost:8080/';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--autoplay-policy=no-user-gesture-required', '--window-size=960,540'],
});
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
await page.goto(url, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, wait));
if (evalJs) {
  try { const r = await page.evaluate(evalJs); if (r !== undefined) console.log('eval:', JSON.stringify(r)); }
  catch (e) { errors.push('[eval] ' + e.message); }
  await new Promise((r) => setTimeout(r, 400));
}
if (keys) {
  for (const step of keys.split(',')) {
    const [k, ms] = step.split(':');
    const combo = k.split('+');
    for (const c of combo) await page.keyboard.down(c);
    await new Promise((r) => setTimeout(r, Number(ms) || 100));
    for (const c of combo.reverse()) await page.keyboard.up(c);
  }
  await new Promise((r) => setTimeout(r, 300));
}
await page.screenshot({ path: out });
const uniq = [...new Set(errors)];
console.log(uniq.length ? uniq.slice(0, 30).join('\n') + (uniq.length > 30 ? `\n...(${uniq.length} unique)` : '') : 'no errors');
await browser.close();
