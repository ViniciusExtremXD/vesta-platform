/**
 * Renders the Open Graph image (1200×630) and the square logo with the
 * installed Chrome, so the real webfont is used. Output goes to public/og/.
 *
 *   npm run og
 */
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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

// Carbon, bone, one livery red — the same system as the site.
const card = `<!doctype html><html><head>${fonts}<style>
  html,body{margin:0}
  body{width:1200px;height:630px;background:#0b0b0c;color:#eeeae2;font-family:'Mona Sans',Arial,sans-serif;position:relative;overflow:hidden}
  .light{position:absolute;inset:0;background:radial-gradient(60% 45% at 70% 15%, rgba(238,234,226,.07), transparent 70%)}
  .in{position:absolute;inset:72px 80px 80px;display:flex;flex-direction:column;justify-content:space-between}
  .mark{display:flex;align-items:center;gap:18px;font-stretch:115%;font-weight:760;font-size:22px;letter-spacing:.3em}
  .stripe{display:inline-block;width:22px;height:6px;background:#d3001c;transform:skewX(-24deg)}
  h1{margin:0;font-stretch:115%;font-size:84px;line-height:.98;letter-spacing:-.03em;font-weight:640;max-width:13ch}
  .foot{display:flex;justify-content:space-between;align-items:flex-end;font-stretch:115%;font-size:17px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#a7a39a}
  .rule{position:absolute;left:80px;right:80px;bottom:136px;height:1px;background:rgba(238,234,226,.14)}
  .bar{position:absolute;left:0;bottom:0;width:38%;height:8px;background:#d3001c}
</style></head><body>
<div class="light"></div>
<div class="in">
  <div class="mark">VESTA<span class="stripe"></span></div>
  <h1>Websites built like flagships.</h1>
  <div class="foot"><span>Fixed prices from $500</span><span>Website design and build studio</span></div>
</div>
<div class="rule"></div>
<div class="bar"></div>
</body></html>`;

const logo = `<!doctype html><html><head>${fonts}<style>
  html,body{margin:0}body{width:512px;height:512px;background:#0b0b0c;display:grid;place-items:center;font-family:'Mona Sans',Arial,sans-serif;color:#eeeae2}
  .m{position:relative;font-stretch:125%;font-weight:700;font-size:230px;line-height:1;letter-spacing:-.02em}
  .s{position:absolute;left:8%;bottom:-40px;width:84px;height:20px;background:#d3001c;transform:skewX(-24deg)}
</style></head><body><div class="m">V<span class="s"></span></div></body></html>`;

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
