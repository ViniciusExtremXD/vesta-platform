/**
 * Renders the Open Graph image (1200×630) and the square logo with the
 * installed Chrome, so the real webfont is used. Output goes to public/og/.
 *
 *   npm run og
 */
import { mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'og');

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
    '/usr/bin/google-chrome',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('Chrome not found. Set CHROME_PATH.');
  return found;
}

const fonts =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mona+Sans:wdth,wght@75..125,200..900&display=swap">';

// The owner's logo on deep space, the headline and the offer.
const logoUri = 'data:image/png;base64,' + readFileSync(path.join(ROOT, 'src/assets/brand/vesta-logo.png')).toString('base64');
const markUri = 'data:image/png;base64,' + readFileSync(path.join(ROOT, 'src/assets/brand/vesta-mark.png')).toString('base64');

// deterministic star dots (no Math.random in a build asset)
const stars = Array.from({ length: 140 }, (_, i) => {
  const x = (i * 7919) % 1200, y = (i * 104729) % 630;
  const r = i % 11 === 0 ? 1.6 : i % 3 === 0 ? 1 : 0.6;
  const o = i % 11 === 0 ? 0.9 : 0.35 + ((i * 37) % 40) / 100;
  return `<i style="left:${x}px;top:${y}px;width:${r * 2}px;height:${r * 2}px;opacity:${o}"></i>`;
}).join('');

const card = `<!doctype html><html><head>${fonts}<style>
  html,body{margin:0}
  body{width:1200px;height:630px;background:#08070d;color:#f3f0fa;font-family:'Mona Sans',Arial,sans-serif;position:relative;overflow:hidden}
  .sky i{position:absolute;border-radius:50%;background:#f3f0fa}
  .neb{position:absolute;inset:0;background:radial-gradient(42% 60% at 78% 38%, rgba(98,54,232,.28), transparent 70%),radial-gradient(30% 40% at 18% 90%, rgba(185,162,255,.08), transparent 70%)}
  .logo{position:absolute;left:80px;top:78px;width:430px}
  h1{position:absolute;left:80px;top:292px;margin:0;font-stretch:115%;font-size:72px;line-height:.98;letter-spacing:-.03em;font-weight:640;max-width:13ch}
  .foot{position:absolute;left:80px;right:80px;bottom:64px;display:flex;justify-content:space-between;font-stretch:115%;font-size:17px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#b4abc8}
  .rule{position:absolute;left:80px;right:80px;bottom:110px;height:1px;background:rgba(243,240,250,.14)}
  .bar{position:absolute;left:0;bottom:0;width:38%;height:8px;background:#6236e8}
</style></head><body>
<div class="neb"></div><div class="sky">${stars}</div>
<img class="logo" src="${logoUri}">
<h1>Websites built like flagships.</h1>
<div class="rule"></div>
<div class="foot"><span>High-end websites for businesses</span><span>Free price analysis</span></div>
<div class="bar"></div>
</body></html>`;

const logo = `<!doctype html><html><head><style>
  html,body{margin:0}body{width:512px;height:512px;background:#08070d;display:grid;place-items:center}
  img{width:400px}
</style></head><body><img src="${markUri}"></body></html>`;

await mkdir(OUT, { recursive: true });
await mkdir('C:\\cmv-og', { recursive: true }).catch(() => {});
const browser = await puppeteer.launch({
  executablePath: findChrome(),
  userDataDir: 'C:\\cmv-og',
  headless: true,
  args: ['--no-sandbox', '--font-render-hinting=none'],
});
try {
  for (const [name, html, w, h] of [
    ['default.png', card, 1200, 630],
    ['logo.png', logo, 512, 512],
  ]) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, name), type: 'png' });
    await page.close();
    console.log(`wrote public/og/${name}`);
  }
} finally {
  await browser.close();
}
