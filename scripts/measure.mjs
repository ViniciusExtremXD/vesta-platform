/**
 * Measures THIS site with Lighthouse and writes the result to
 * src/data/measurements.json, which the hero renders as a dated, tool-named
 * score. The site promises speed; this is the receipt.
 *
 *   npm run build && npm run measure && npm run build
 *   node scripts/measure.mjs /about/        # another route
 *
 * Runs against the production build served from an ephemeral local port
 * with gzip (as GitHub Pages / any CDN would), with Lighthouse's default
 * mobile emulation and simulated throttling (slow 4G, 4x CPU). Median of
 * three runs. Chrome is the one installed on the machine. The full median
 * report goes to .verify/lighthouse.json and every audit that scored below
 * 0.9 is printed, so a bad score comes with its reasons.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'src', 'data', 'measurements.json');
const REPORT_DIR = path.join(ROOT, '.verify');
const ROUTE = process.argv[2] || '/';
const PROFILE = 'C:\\cmv-lh';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg', '.xml', '.txt']);

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p));
}

function serve() {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        let file = path.join(DIST, pathname);
        if (pathname.endsWith('/')) file = path.join(file, 'index.html');
        if (!existsSync(file) || statSync(file).isDirectory()) {
          res.writeHead(404, { 'content-type': 'text/plain' });
          res.end('404');
          return;
        }
        const ext = path.extname(file).toLowerCase();
        if (ext === '.html' && !server.loggedEncoding) {
          // If this prints "identity" or nothing on a machine with an
          // antivirus web proxy, the proxy is stripping compression to
          // inject its script — the document then measures uncompressed.
          server.loggedEncoding = true;
          console.log(`document request accept-encoding: ${req.headers['accept-encoding'] || '(none)'}`);
        }
        let body = await readFile(file);
        const headers = {
          'content-type': MIME[ext] || 'application/octet-stream',
          'cache-control': ext === '.html' ? 'public, max-age=600' : 'public, max-age=31536000, immutable',
        };
        if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
          body = gzipSync(body, { level: 9 });
          headers['content-encoding'] = 'gzip';
        }
        res.writeHead(200, headers);
        res.end(body);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });
    server.loggedEncoding = false;
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

if (!existsSync(DIST)) {
  console.error('dist/ does not exist. Run `npm run build` first.');
  process.exit(1);
}

const chromePath = findChrome();
if (!chromePath) {
  console.error('Chrome not found. Set CHROME_PATH.');
  process.exit(1);
}

const { server, port } = await serve();
// MEASURE_URL=https://… measures the deployed site instead of the local build
// (real CDN compression; the local antivirus proxy strips gzip from 127.0.0.1).
const LIVE = process.env.MEASURE_URL || '';
const url = LIVE || `http://127.0.0.1:${port}${ROUTE}`;

await mkdir(PROFILE, { recursive: true }).catch(() => {});
await mkdir(REPORT_DIR, { recursive: true }).catch(() => {});
const chrome = await chromeLauncher.launch({
  chromePath,
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  userDataDir: PROFILE,
});

try {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      formFactor: 'mobile',
      screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
      throttlingMethod: 'simulate',
      // Kaspersky's web protection injects http://gc.kis.v2.scr.kaspersky-labs.com/…/main.js
      // (180 kB, unminified, render-blocking) into every page Chrome loads on this
      // machine. It is not part of the site; block it so the receipt measures the site.
      blockedUrlPatterns: ['*kaspersky-labs.com*'],
    });
    runs.push(result.lhr);
    const c = result.lhr.categories;
    console.log(
      `run ${i + 1}: perf ${Math.round(c.performance.score * 100)} · a11y ${Math.round(c.accessibility.score * 100)} · bp ${Math.round(c['best-practices'].score * 100)} · seo ${Math.round(c.seo.score * 100)} · LCP ${Math.round(result.lhr.audits['largest-contentful-paint'].numericValue)}ms · TBT ${Math.round(result.lhr.audits['total-blocking-time'].numericValue)}ms`
    );
  }

  // median run by performance score, so one noisy pass cannot inflate it
  runs.sort((a, b) => a.categories.performance.score - b.categories.performance.score);
  const lhr = runs[Math.floor(runs.length / 2)];
  const a = lhr.audits;
  const items = a['network-requests']?.details?.items ?? [];
  const transfer = items.reduce((s, it) => s + (it.transferSize || 0), 0);

  const out = {
    note: LIVE
      ? `Written by npm run measure (scripts/measure.mjs) against the deployed site ${LIVE}. Lighthouse, mobile emulation and simulated throttling (slow 4G, 4x CPU). Median of three runs. Antivirus-injected scripts (Kaspersky) blocked.`
      : 'Written by `npm run measure` (scripts/measure.mjs). Lighthouse run locally against the production build served with gzip, mobile emulation and simulated throttling (slow 4G, 4x CPU). Median of three runs. Antivirus-injected scripts (Kaspersky) blocked.',
    performance: Math.round(lhr.categories.performance.score * 100),
    accessibility: Math.round(lhr.categories.accessibility.score * 100),
    bestPractices: Math.round(lhr.categories['best-practices'].score * 100),
    seo: Math.round(lhr.categories.seo.score * 100),
    fcpMs: Math.round(a['first-contentful-paint'].numericValue),
    lcpMs: Math.round(a['largest-contentful-paint'].numericValue),
    tbtMs: Math.round(a['total-blocking-time'].numericValue),
    cls: Number(a['cumulative-layout-shift'].numericValue.toFixed(3)),
    speedIndexMs: Math.round(a['speed-index'].numericValue),
    transferKb: Math.round(transfer / 1024),
    requests: items.length,
    tool: `Lighthouse ${lhr.lighthouseVersion}, mobile emulation, simulated slow 4G`,
    date: new Date().toISOString().slice(0, 10),
    route: ROUTE,
  };
  await writeFile(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  await writeFile(path.join(REPORT_DIR, 'lighthouse.json'), JSON.stringify(lhr, null, 2), 'utf8');

  console.log(`\nwrote ${path.relative(ROOT, OUT)}:`);
  console.log(out);

  // ---- why, not just what ------------------------------------------------
  console.log('\n---- audits below 0.9 (median run) ----');
  for (const id of Object.keys(a)) {
    const au = a[id];
    if (au.scoreDisplayMode === 'binary' || au.scoreDisplayMode === 'numeric' || au.scoreDisplayMode === 'metricSavings') {
      if (typeof au.score === 'number' && au.score < 0.9) {
        const savings = au.displayValue ? ` — ${au.displayValue}` : '';
        console.log(`  ${au.score.toFixed(2)}  ${id}${savings}`);
        const rows = Array.isArray(au.details?.items) ? au.details.items.slice(0, 5) : [];
        for (const r of rows) {
          const label = r.url || r.node?.selector || r.source?.url || r.entity || r.groupLabel || '';
          const extra = r.wastedMs ? ` ${Math.round(r.wastedMs)}ms` : r.totalBytes ? ` ${Math.round(r.totalBytes / 1024)}kB` : r.duration ? ` ${Math.round(r.duration)}ms` : '';
          if (label) console.log(`        · ${String(label).slice(0, 110)}${extra}`);
        }
      }
    }
  }
  const lcpEl = a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node;
  if (lcpEl) console.log(`\nLCP element: ${lcpEl.selector} — "${(lcpEl.nodeLabel || '').slice(0, 80)}"`);
  const phases = a['largest-contentful-paint-element']?.details?.items?.[1]?.items ?? [];
  for (const p of phases) console.log(`  ${p.phase}: ${Math.round(p.timing)}ms`);

  console.log('\n---- requests (transfer) ----');
  for (const it of items.slice(0, 30)) {
    console.log(`  ${String(Math.round((it.transferSize || 0) / 1024)).padStart(4)} kB  ${it.resourceType?.padEnd(10) ?? ''} ${it.url.replace(/^http:\/\/127\.0\.0\.1:\d+/, '')}`);
  }

  console.log('\nRebuild so the hero picks it up: npm run build');
} finally {
  await chrome.kill();
  server.close();
}
