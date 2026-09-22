/**
 * Renders the Open Graph image (1200×630) and the square logo with the
 * installed Chrome, so the real webfonts are used. Output goes to public/og/.
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

const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;700;900&family=Instrument+Serif:ital@1&family=JetBrains+Mono:wght@500&display=swap">`;

const card = `<!doctype html><html><head>${fonts}<style>
  html,body{margin:0}
  body{width:1200px;height:630px;background:#050507;color:#f4f2fa;font-family:'Archivo',Arial,sans-serif;position:relative;overflow:hidden}
  .glow{position:absolute;inset:-30% -10% auto;height:120%;background:radial-gradient(60rem 36rem at 20% 10%, rgba(124,58,237,.38), transparent 60%)}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:96px 96px}
  .in{position:absolute;inset:72px 80px;display:flex;flex-direction:column;justify-content:space-between}
  .mark{font-weight:900;font-size:34px;letter-spacing:.08em}
  .mark b{color:#b69cff}
  .kick{font-family:'JetBrains Mono',monospace;font-size:18px;letter-spacing:.16em;text-transform:uppercase;color:#b69cff;margin-bottom:22px}
  h1{margin:0;font-size:76px;line-height:1.02;letter-spacing:-.035em;font-weight:900;max-width:15ch}
  h1 em{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-weight:400;letter-spacing:0;color:#b69cff}
  .foot{display:flex;justify-content:space-between;align-items:flex-end;font-family:'JetBrains Mono',monospace;font-size:18px;color:#8a84a0;letter-spacing:.06em;text-transform:uppercase}
  .bar{position:absolute;left:0;right:0;bottom:0;height:8px;background:linear-gradient(90deg,#7c3aed,#a855f7)}
</style></head><body>
<div class="glow"></div><div class="grid"></div>
<div class="in">
  <div class="mark">VESTA<b>.</b></div>
  <div><div class="kick">[ Sites &amp; landing pages for paid traffic ]</div>
  <h1>You already pay for the click. We build the page that <em>turns it into a customer.</em></h1></div>
  <div class="foot"><span>Fixed public pricing · from $1,500</span><span>São Paulo · UTC−3</span></div>
</div>
<div class="bar"></div>
</body></html>`;

const logo = `<!doctype html><html><head>${fonts}<style>
  html,body{margin:0}body{width:512px;height:512px;background:#050507;display:grid;place-items:center;font-family:'Archivo',Arial,sans-serif;color:#f4f2fa}
  .m{font-weight:900;font-size:110px;letter-spacing:.06em}.m b{color:#b69cff}
</style></head><body><div class="m">V<b>.</b></div></body></html>`;

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
