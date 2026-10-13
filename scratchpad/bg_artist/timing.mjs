import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
await page.goto('http://localhost:8080/scratchpad/bg_artist/layers.html?area=fray', { waitUntil: 'load' });
await page.waitForFunction('window.__done', { timeout: 120000 });
const t = await page.evaluate(async () => {
  const { getBackground } = await import('../../src/art/backgrounds.js?t=' + Math.random());
  const { STYLES } = await import('../../src/art/palettes.js');
  const out = {};
  for (const a of Object.keys(STYLES)) {
    const t0 = performance.now();
    const bg = getBackground(a + 'X', STYLES[a]);
    for (const L of bg.layers) L.getContext('2d').getImageData(0, 0, 1, 1);
    out[a] = Math.round(performance.now() - t0);
  }
  return out;
});
console.log(JSON.stringify(t));
await browser.close();
