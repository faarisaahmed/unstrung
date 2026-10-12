// usage: node multi.mjs prefix startMs intervalMs count [--eval js] [--every js]
import puppeteer from 'puppeteer-core';
const a = process.argv.slice(2);
const [prefix, start, interval, count] = [a[0], +a[1], +a[2], +a[3]];
const ev = a.indexOf('--eval') >= 0 ? a[a.indexOf('--eval') + 1] : null;
const every = a.indexOf('--every') >= 0 ? a[a.indexOf('--every') + 1] : null;
const url = process.env.URL;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required', '--window-size=960,540'] });
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + ' ' + e.stack));
await page.goto(url, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 1500));
if (ev) { try { const r = await page.evaluate(ev); if (r !== undefined) console.log('eval', JSON.stringify(r)); } catch (e) { errors.push('[eval] ' + e.message); } }
await new Promise((r) => setTimeout(r, start));
for (let i = 0; i < count; i++) {
  if (every) { try { const r = await page.evaluate(every); if (r !== undefined) console.log(i, JSON.stringify(r)); } catch (e) { errors.push('[every] ' + e.message); } }
  await page.screenshot({ path: `${prefix}${i}.png` });
  await new Promise((r) => setTimeout(r, interval));
}
console.log([...new Set(errors)].slice(0, 20).join('\n') || 'no errors');
await browser.close();
