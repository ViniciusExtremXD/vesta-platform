/**
 * Captura de página inteira, para conferência visual.
 *
 *   node scripts/shoot.mjs /                 # home, desktop + mobile
 *   node scripts/shoot.mjs /blog/ 1440       # só desktop
 *
 * Rola a página até o fim antes de fotografar, para que todas as revelações já
 * tenham disparado — senão a foto mostra o site meio invisível, que é
 * exatamente o estado que o pipeline de verificação existe para proibir.
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, '.verify');

const route = process.argv[2] || '/';
const only = Number(process.argv[3]) || null;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(DIST, p);
  if (p.endsWith('/')) file = path.join(file, 'index.html');
  if (!existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404).end('404');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  res.end(await readFile(file));
});
// Porta EFEMERA presa em 127.0.0.1. Porta fixa ja mordeu: havia um dev server
// de OUTRO projeto em 4399 e a captura saiu do site errado, sem nenhum aviso.
const PORT = await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});

const chrome = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
].find((p) => p && existsSync(p));

await mkdir(OUT, { recursive: true });
await mkdir('C:\\cmv', { recursive: true }).catch(() => {});

const browser = await puppeteer.launch({
  executablePath: chrome,
  userDataDir: 'C:\\cmv',
  headless: true,
  args: ['--no-sandbox', '--force-prefers-reduced-motion', '--font-render-hinting=none'],
});

const sizes = only ? [{ w: only, name: only >= 1000 ? 'desktop' : 'mobile' }] : [
  { w: 1440, name: 'desktop' },
  { w: 390, name: 'mobile' },
];

for (const s of sizes) {
  const page = await browser.newPage();
  await page.setViewport({ width: s.w, height: s.w >= 1000 ? 900 : 844, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'networkidle2' });
  const served = await page.title();
  if (!/Vesta/i.test(served)) {
    throw new Error(`Carregou "${served}" — nao e este site. Colisao de porta?`);
  }
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.6);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 900));
  });
  const name = `full-${s.name}${route.replace(/\//g, '_') || '_home'}.png`;
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
  console.log(path.join('.verify', name));
  await page.close();
}

await browser.close();
server.close();
