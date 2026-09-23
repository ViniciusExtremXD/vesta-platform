/**
 * Captura de qualquer URL (dev server ou dist servido), para conferência visual
 * durante o desenvolvimento de uma seção.
 *
 *   node scripts/snap.mjs --url=http://localhost:4321/lab/hero/ --out=C:/tmp/hero
 *   node scripts/snap.mjs --url=... --out=... --widths=1440,390 --full
 *   node scripts/snap.mjs --url=... --out=... --frames=0,300,800,1600   # sequência de entrada
 *   node scripts/snap.mjs --url=... --out=... --scroll=1200              # rola até y antes de fotografar
 *   node scripts/snap.mjs --url=... --out=... --selector=#hero           # recorta um elemento
 *
 * Saída: <out>-<largura>[-f<ms>|-full].png — um arquivo por captura, caminhos
 * impressos no stdout. Erros de console da página também são impressos.
 */
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import puppeteer from 'puppeteer-core';

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true;
};

const url = arg('url');
const out = arg('out');
if (!url || !out) {
  console.error('uso: node scripts/snap.mjs --url=<url> --out=<caminho/prefixo> [--widths=1440,390] [--full] [--frames=ms,ms] [--scroll=y] [--selector=css] [--height=900]');
  process.exit(1);
}
const widths = String(arg('widths', '1440,390')).split(',').map(Number).filter(Boolean);
const full = Boolean(arg('full', false));
const frames = arg('frames') ? String(arg('frames')).split(',').map(Number) : null;
const scrollTo = arg('scroll') ? Number(arg('scroll')) : null;
const selector = arg('selector') || null;
const fixedHeight = arg('height') ? Number(arg('height')) : null;

const chrome = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
].find((p) => p && existsSync(p));

await mkdir(path.dirname(path.resolve(out)), { recursive: true });

// Perfil descartável e curto por processo: vários agentes podem capturar ao
// mesmo tempo, e o Chrome não compartilha user-data-dir entre instâncias.
const profile = path.join(os.tmpdir(), `snap-${process.pid}`);

const browser = await puppeteer.launch({
  executablePath: chrome,
  userDataDir: profile,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none', '--hide-scrollbars'],
});

const written = [];
try {
  for (const w of widths) {
    const h = fixedHeight || (w >= 1000 ? 900 : 844);
    const page = await browser.newPage();
    const errors = [];
    let aborted = 0;
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      // o abort da injeção do antivírus aparece como ERR_FAILED; não é da página
      if (aborted && /ERR_FAILED/.test(m.text())) return;
      errors.push(m.text().slice(0, 200));
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 768, hasTouch: w < 768 });
    // Bloqueia a injeção do antivírus local (Kaspersky) que distorce a página.
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      if (/kaspersky-labs|kis\.v2\.scr/.test(r.url())) {
        aborted++;
        r.abort();
      } else r.continue();
    });

    if (frames) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const t0 = Date.now();
      for (const f of frames) {
        const wait = f - (Date.now() - t0);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        const file = `${out}-${w}-f${f}.png`;
        await page.screenshot({ path: file });
        written.push(file);
      }
    } else {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.evaluate(async (full) => {
        await document.fonts.ready;
        if (!full) return;
        const step = Math.round(window.innerHeight * 0.6);
        for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 140));
        }
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 900));
      }, full);
      if (scrollTo !== null) {
        await page.evaluate((y) => window.scrollTo(0, y), scrollTo);
        await new Promise((r) => setTimeout(r, 1400));
      } else {
        await new Promise((r) => setTimeout(r, 1600));
      }
      const file = `${out}-${w}${full ? '-full' : ''}${scrollTo !== null ? `-y${scrollTo}` : ''}.png`;
      if (selector) {
        const el = await page.$(selector);
        if (!el) throw new Error(`seletor não encontrado: ${selector}`);
        await el.screenshot({ path: file });
      } else {
        await page.screenshot({ path: file, fullPage: full });
      }
      written.push(file);
    }
    if (errors.length) console.log(`[${w}px] erros de console:\n  ` + errors.join('\n  '));
    await page.close();
  }
} finally {
  await browser.close();
}
written.forEach((f) => console.log(f));
