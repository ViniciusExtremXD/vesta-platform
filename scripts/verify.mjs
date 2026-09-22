/**
 * Pipeline de verificação visual do site Vesta.
 *
 *   npm run build && node scripts/verify.mjs
 *   node scripts/verify.mjs --routes=/,/blog/      # subconjunto
 *   node scripts/verify.mjs --keep                 # mantém o Chrome aberto
 *
 * O que ele prova, em 1440px e 390px, com prefers-reduced-motion emulado
 * como "reduce" (o site ignora esse sinal de propósito — o teste existe
 * justamente para provar que continua funcionando):
 *
 *   1. zero elemento preso invisível depois de rolar a página inteira;
 *   2. zero erro de console;
 *   3. zero overflow horizontal;
 *   4. toda revelação declarada disparou;
 *   5. auditoria elemento a elemento — todo elemento visível que renderiza
 *      texto ou imagem está coberto por alguma animação de entrada;
 *   6. curva de entrada medida quadro a quadro, provando transição gradual
 *      e não salto de 0 para 1;
 *   7. com JavaScript desligado, nada fica invisível;
 *   8. screenshot de viewport cheio para conferência visual.
 *
 * Nota de Windows: o Chrome recusa perfis em caminho longo (MAX_PATH), e o
 * diretório deste projeto já é longo por si só. Por isso o user-data-dir vai
 * para um caminho curto na raiz do disco.
 */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SHOTS = path.join(ROOT, '.verify');

const args = process.argv.slice(2);
const KEEP = args.includes('--keep');
const ROUTES_ARG = (args.find((a) => a.startsWith('--routes=')) || '').split('=')[1];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, dsf: 1 },
  { name: 'mobile', width: 390, height: 844, dsf: 2, mobile: true },
];

/* ------------------------------------------------------------------ chrome */

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('Chrome não encontrado. Defina CHROME_PATH.');
  return found;
}

/** Caminho curto: o Chrome falha em criar o perfil se o caminho passar de MAX_PATH. */
async function shortProfileDir() {
  for (const base of ['C:\\cmv', path.join(os.tmpdir(), 'cmv')]) {
    try {
      await mkdir(base, { recursive: true });
      return base;
    } catch {
      /* tenta o próximo */
    }
  }
  throw new Error('Não consegui criar um diretório de perfil curto para o Chrome.');
}

/* ------------------------------------------------------------------ server */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

/**
 * Sobe o servidor estatico numa porta EFEMERA presa em 127.0.0.1.
 * Porta fixa e perigosa aqui: com um dev server de outro projeto ocupando a
 * porta, a verificacao roda contra o site errado e passa verde mentindo.
 */
function serveDist() {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        let file = path.join(DIST, pathname);
        if (pathname.endsWith('/')) file = path.join(file, 'index.html');
        if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
        if (!existsSync(file) || (await import('node:fs')).statSync(file).isDirectory()) {
          file = path.join(DIST, '404.html');
          if (!existsSync(file)) {
            res.writeHead(404, { 'content-type': 'text/plain' });
            res.end('404');
            return;
          }
          res.writeHead(404, { 'content-type': MIME['.html'] });
          res.end(await readFile(file));
          return;
        }
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
        res.end(body);
      } catch (err) {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end(String(err));
      }
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/* --------------------------------------------------- scripts de auditoria */
/* Estas funções rodam NO NAVEGADOR. Nada de closures do Node aqui dentro.   */

const IN_PAGE = {
  /** Rola a página inteira, devagar, para disparar todas as revelações. */
  async scrollThrough() {
    const step = Math.round(window.innerHeight * 0.65);
    const total = document.documentElement.scrollHeight;
    for (let y = 0; y < total + window.innerHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 140));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 700));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  },

  /**
   * Elementos que declararam animação de entrada e nunca receberam .is-in.
   * Elementos não renderizados (display:none no breakpoint atual, dentro de
   * <details> fechado) são ignorados: uma revelação que não dispara em algo
   * que ninguém vê não esconde conteúdo de ninguém.
   */
  stuckReveals() {
    const sel = '[data-reveal], [data-split], [data-draw], [data-draw-path], [data-count]';
    const rendered = (el) => {
      if (el.closest('details:not([open])')) return false;
      let node = el;
      while (node && node !== document.documentElement) {
        if (node.nodeType === 1) {
          const cs = getComputedStyle(node);
          if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        }
        node = node.parentElement;
      }
      const r = el.getBoundingClientRect?.();
      return !r || r.width > 0 || r.height > 0;
    };
    return [...document.querySelectorAll(sel)]
      .filter((el) => !el.classList.contains('is-in') && rendered(el))
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        cls: el.className?.baseVal ?? String(el.className || ''),
        attr: el.getAttribute('data-reveal') ?? '(split/draw/count)',
        text: (el.textContent || '').trim().slice(0, 60),
      }));
  },

  /**
   * Qualquer elemento visível na árvore cuja opacidade efetiva seja ~0, ou que
   * esteja deslocado para fora por transform residual. É a checagem de
   * "nada pode ficar invisível".
   */
  invisibleContent() {
    const out = [];
    const all = document.body.querySelectorAll('*');
    for (const el of all) {
      if (el.closest('noscript')) continue;
      // Conteúdo de <details> fechado não está na tela; o usuário precisa abrir.
      if (el.closest('details:not([open])') && !el.closest('summary')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;

      const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim().length > 1);
      const isMedia = ['IMG', 'SVG', 'PICTURE', 'VIDEO', 'CANVAS'].includes(el.tagName);
      if (!hasOwnText && !isMedia) continue;

      // opacidade efetiva: multiplica a cadeia de ancestrais
      let opacity = 1;
      let node = el;
      while (node && node !== document.documentElement) {
        const o = Number(getComputedStyle(node).opacity);
        if (Number.isFinite(o)) opacity *= o;
        node = node.parentElement;
      }
      if (opacity < 0.06) {
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className?.baseVal ?? el.className ?? '').slice(0, 60),
          opacity: Number(opacity.toFixed(3)),
          text: (el.textContent || '').trim().slice(0, 60),
        });
      }
    }
    return out;
  },

  /**
   * Auditoria de cobertura: todo elemento visível que renderiza texto próprio
   * ou é mídia precisa estar coberto por alguma animação — nele ou num
   * ancestral. Devolve os que não estão.
   */
  animationCoverage() {
    const MOTION_ATTRS = [
      'data-reveal',
      'data-split',
      'data-draw',
      'data-draw-path',
      'data-count',
      'data-parallax',
      'data-hero-exit',
      'data-img-fade',
      'data-glow',
      'data-magnetic',
      'data-autocycle',
      'data-nav',
      'data-progress',
      'data-motion-toggle',
      'data-tilt',
      'data-clock',
      'data-clock-offset',
      'data-office-status',
      'data-particles',
      'data-calc',
      'data-booking',
    ];

    const covered = (el) => {
      let node = el;
      while (node && node !== document.documentElement) {
        for (const a of MOTION_ATTRS) if (node.hasAttribute?.(a)) return true;
        const cls = String(node.className?.baseVal ?? node.className ?? '');
        if (/\bmarquee\b|\bmarquee-track\b/.test(cls)) return true;
        const cs = getComputedStyle(node);
        if (cs.animationName && cs.animationName !== 'none') return true;
        if (cs.transitionProperty && cs.transitionProperty !== 'none' && cs.transitionDuration !== '0s') {
          // só conta como cobertura se a transição mexe no que importa
          if (/opacity|transform|filter|all/.test(cs.transitionProperty)) return true;
        }
        node = node.parentElement;
      }
      return false;
    };

    const uncovered = [];
    let total = 0;
    for (const el of document.body.querySelectorAll('*')) {
      if (el.closest('noscript') || el.closest('script') || el.closest('style')) continue;
      // Interior de SVG nao e auditado por elemento: o <svg> raiz responde por
      // ele. E conteudo de <details> fechado nao esta na tela.
      if (el.ownerSVGElement) continue;
      if (el.closest('details:not([open])') && !el.closest('summary')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (el.closest('.visually-hidden') || el.classList.contains('visually-hidden')) continue;

      const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim().length > 1);
      const isMedia = ['IMG', 'PICTURE', 'VIDEO', 'CANVAS'].includes(el.tagName);
      const isSvgRoot = el.tagName === 'svg' || el.tagName === 'SVG';
      if (!hasOwnText && !isMedia && !isSvgRoot) continue;

      total++;
      if (!covered(el)) {
        uncovered.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className?.baseVal ?? el.className ?? '').slice(0, 70),
          text: (el.textContent || '').trim().slice(0, 70),
          y: Math.round(rect.top + window.scrollY),
        });
      }
    }
    return { total, uncovered };
  },

  /**
   * Contraste WCAG AA de todo texto visível.
   *
   * Existe por um motivo específico: o laranja da marca (#F58634) dá 2.5:1
   * sobre branco. É a armadilha número um deste projeto — basta alguém usar
   * var(--accent) num parágrafo, ou texto branco dentro de um botão laranja,
   * para o site reprovar. Aqui isso vira erro de build, não achismo.
   */
  contrast() {
    const parseColor = (str) => {
      const m = String(str).match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(',').map((v) => parseFloat(v));
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const lin = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    const over = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });
    const ratio = (a, b) => {
      const l1 = lum(a);
      const l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };

    const WHITE = { r: 255, g: 255, b: 255, a: 1 };

    /** Empilha os fundos dos ancestrais até achar um opaco. */
    const stackBg = (el, stopAt) => {
      const stack = [];
      let node = el;
      while (node && node.nodeType === 1) {
        const c = parseColor(getComputedStyle(node).backgroundColor);
        if (c && c.a > 0) {
          stack.push(c);
          if (c.a >= 0.999) return { stack, opaque: true };
        }
        if (node === stopAt) break;
        node = node.parentElement;
      }
      return { stack, opaque: false };
    };

    const compose = (stack, base) => {
      let out = base;
      for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out);
      return out;
    };

    /**
     * Fundo efetivo, considerando elementos fixos.
     *
     * Um elemento em position:fixed e transparente (a nav flutuando sobre o
     * hero) não tem o fundo real entre seus ancestrais: o que aparece atrás
     * dele é outra parte da página. Subir a árvore devolveria o branco do
     * <body> e acusaria contraste falso. Então: esconde a camada fixa por um
     * instante, pergunta ao documento quem está embaixo daquele ponto, e usa
     * o fundo daquele elemento como base.
     */
    const effectiveBg = (el) => {
      let fixedAncestor = null;
      let node = el;
      while (node && node.nodeType === 1) {
        if (getComputedStyle(node).position === 'fixed') {
          fixedAncestor = node;
          break;
        }
        node = node.parentElement;
      }

      const { stack, opaque } = stackBg(el, fixedAncestor);
      if (opaque || !fixedAncestor) return compose(stack, WHITE);

      const r = el.getBoundingClientRect();
      const x = Math.min(window.innerWidth - 2, Math.max(2, r.left + r.width / 2));
      const y = Math.min(window.innerHeight - 2, Math.max(2, r.top + r.height / 2));
      const prev = fixedAncestor.style.visibility;
      fixedAncestor.style.visibility = 'hidden';
      const under = document.elementFromPoint(x, y);
      fixedAncestor.style.visibility = prev;

      const base = under && under !== document.documentElement ? compose(stackBg(under).stack, WHITE) : WHITE;
      return compose(stack, base);
    };

    const fails = [];
    let checked = 0;
    for (const el of document.body.querySelectorAll('*')) {
      if (el.ownerSVGElement) continue;
      if (el.closest('noscript') || el.closest('details:not([open])')) continue;
      if (el.classList.contains('visually-hidden') || el.closest('.visually-hidden')) continue;

      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.15) continue;

      const text = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.nodeValue.trim())
        .join('')
        .trim();
      if (text.length < 2) continue;

      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;

      const fg = parseColor(cs.color);
      if (!fg) continue;
      const bg = effectiveBg(el);
      const composed = fg.a < 1 ? over(fg, bg) : fg;
      const cr = ratio(composed, bg);

      const px = parseFloat(cs.fontSize);
      const weight = Number(cs.fontWeight) || 400;
      // AA: 3:1 para texto grande (>=24px, ou >=18.66px em negrito), 4.5:1 no resto
      const large = px >= 24 || (px >= 18.66 && weight >= 700);
      const min = large ? 3 : 4.5;

      checked++;
      if (cr + 0.05 < min) {
        fails.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className || '').slice(0, 60),
          text: text.slice(0, 50),
          ratio: Number(cr.toFixed(2)),
          required: min,
          size: Math.round(px),
          color: cs.color,
          bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
        });
      }
    }
    return { checked, fails };
  },

  /**
   * Overflow horizontal.
   *
   * O sinal que importa de verdade é scrollWidth > clientWidth no documento:
   * é ele que cria a barra de rolagem lateral. A lista de culpados serve para
   * localizar a causa, e só é preenchida quando o documento realmente
   * transborda — caso contrário, geometria interna de SVG (que fica recortada
   * pela viewBox e nunca empurra o layout) apareceria como falso positivo em
   * todo elemento de todo diagrama.
   */
  horizontalOverflow() {
    const doc = document.documentElement;
    const vw = doc.clientWidth;
    const docOverflow = doc.scrollWidth - vw;
    const offenders = [];

    if (docOverflow > 1) {
      for (const el of document.body.querySelectorAll('*')) {
        // Geometria interna de SVG é recortada pela viewBox: não empurra nada.
        if (el.ownerSVGElement) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        // Elemento dentro de um contêiner que já esconde o transbordo não conta.
        let clipped = false;
        let p = el.parentElement;
        while (p && p !== document.body) {
          const pcs = getComputedStyle(p);
          if (pcs.overflowX === 'hidden' || pcs.overflowX === 'auto' || pcs.overflowX === 'scroll') {
            clipped = true;
            break;
          }
          p = p.parentElement;
        }
        if (clipped) continue;

        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        const right = r.right + window.scrollX;
        if (right > vw + 1.5) {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: String(el.className?.baseVal ?? el.className ?? '').slice(0, 70),
            overflowPx: Math.round(right - vw),
            width: Math.round(r.width),
          });
        }
      }
    }

    return {
      docScrollWidth: doc.scrollWidth,
      viewportWidth: vw,
      docOverflowPx: Math.max(0, docOverflow),
      offenders: offenders.slice(0, 25),
    };
  },
};

/**
 * Mede a curva de entrada de um elemento quadro a quadro.
 * Roda no navegador; devolve a série de opacidade/translateY amostrada.
 */
async function measureEntryCurve(page, selector) {
  return page.evaluate(async (sel) => {
    const host = document.querySelector(sel);
    if (!host) return { error: 'elemento não encontrado', selector: sel };

    // Em [data-split] quem anima são as palavras (.w), não o elemento. Medir o
    // pai daria sempre opacidade 1 — o que já produziu um falso negativo aqui.
    const el = host.matches('[data-split]') ? host.querySelector('.w') || host : host;
    if (!el) return { error: 'sem palavras para medir', selector: sel };

    // volta ao estado inicial e força o elemento para fora da tela
    host.classList.remove('is-in', 'split-in');
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 260));

    const samples = [];
    let running = true;
    const readY = (t) => {
      if (!t || t === 'none') return 0;
      const m = t.match(/matrix(3d)?\(([^)]+)\)/);
      if (!m) return 0;
      const v = m[2].split(',').map(Number);
      return m[1] ? v[13] : v[5];
    };

    const tick = () => {
      const cs = getComputedStyle(el);
      samples.push({
        t: Math.round(performance.now()),
        o: Number(Number(cs.opacity).toFixed(3)),
        y: Number(readY(cs.transform).toFixed(2)),
      });
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    host.scrollIntoView({ block: 'center', behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 1200));
    running = false;

    const t0 = samples[0]?.t ?? 0;
    const series = samples.map((s) => ({ ...s, t: s.t - t0 }));
    const opacities = [...new Set(series.map((s) => s.o))];
    const ys = [...new Set(series.map((s) => s.y))];

    return {
      selector: sel,
      frames: series.length,
      distinctOpacity: opacities.length,
      distinctY: ys.length,
      first: series[0],
      last: series[series.length - 1],
      // amostra enxuta para o relatório
      sample: series.filter((_, i) => i % Math.max(1, Math.floor(series.length / 10)) === 0),
    };
  }, selector);
}

/* -------------------------------------------------------------------- run */

const chromePath = findChrome();
const userDataDir = await shortProfileDir();

if (!existsSync(DIST)) {
  console.error('dist/ não existe. Rode `npm run build` antes.');
  process.exit(1);
}
await rm(SHOTS, { recursive: true, force: true });
await mkdir(SHOTS, { recursive: true });

const { server, port } = await serveDist();
const ORIGIN = `http://127.0.0.1:${port}`;

const routes = ROUTES_ARG
  ? ROUTES_ARG.split(',').filter(Boolean)
  : await (async () => {
      const { readdir } = await import('node:fs/promises');
      const found = ['/'];
      const walk = async (dir, prefix = '') => {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          if (['_astro', 'fonts', 'og'].includes(entry.name)) continue;
          const route = `${prefix}/${entry.name}/`;
          if (existsSync(path.join(dir, entry.name, 'index.html'))) found.push(route);
          // só um nível de profundidade extra, senão auditamos 316 posts
          if (prefix === '') await walk(path.join(dir, entry.name), `/${entry.name}`);
        }
      };
      await walk(DIST);
      // amostra do blog: índice + um post, não os 316
      return found.filter((r) => !/^\/blog\/\d{4}/.test(r)).slice(0, 24);
    })();

/**
 * Guarda de identidade. Se o que esta sendo servido nao for este site, tudo
 * abaixo e teatro: o relatorio passa verde auditando a pagina de outro projeto.
 * Ja aconteceu uma vez por colisao de porta; nao acontece de novo em silencio.
 */
{
  const home = await readFile(path.join(DIST, 'index.html'), 'utf8');
  if (!/Vesta/i.test(home)) {
    console.error('dist/index.html nao parece ser o site da Vesta. Rode `npm run build`.');
    server.close();
    process.exit(1);
  }
}

console.log(`Chrome    : ${chromePath}`);
console.log(`Perfil    : ${userDataDir}`);
console.log(`Servindo  : ${DIST} em ${ORIGIN}`);
console.log(`Rotas     : ${routes.length}\n`);

const browser = await puppeteer.launch({
  executablePath: chromePath,
  userDataDir,
  headless: !KEEP,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--force-prefers-reduced-motion', // o site ignora de propósito; o teste prova isso
    '--font-render-hinting=none',
  ],
});

const report = [];
let failures = 0;

for (const vp of VIEWPORTS) {
  for (const route of routes) {
    const page = await browser.newPage();
    await page.setViewport({
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: vp.dsf,
      isMobile: Boolean(vp.mobile),
      hasTouch: Boolean(vp.mobile),
    });
    // O sistema diz "reduza o movimento". O site tem de ignorar e animar mesmo assim.
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
    });
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${String(err).slice(0, 200)}`));
    page.on('requestfailed', (req) => {
      const url = req.url();
      if (url.startsWith(ORIGIN)) consoleErrors.push(`404/falha: ${url.replace(ORIGIN, '')}`);
    });

    await page.goto(`${ORIGIN}${route}`, { waitUntil: 'networkidle2', timeout: 45000 });

    const served = await page.title();
    if (!/Vesta/i.test(served)) {
      console.error(`
O navegador carregou "${served}" em ${route} — nao e este site. Abortando.`);
      await browser.close();
      server.close();
      process.exit(1);
    }

    await page.evaluate(() => new Promise((r) => setTimeout(r, 500)));

    await page.evaluate(IN_PAGE.scrollThrough);

    const stuck = await page.evaluate(IN_PAGE.stuckReveals);
    const invisible = await page.evaluate(IN_PAGE.invisibleContent);
    const coverage = await page.evaluate(IN_PAGE.animationCoverage);
    const overflow = await page.evaluate(IN_PAGE.horizontalOverflow);
    const contrast = await page.evaluate(IN_PAGE.contrast);

    const entry = {
      route,
      viewport: vp.name,
      consoleErrors,
      stuck,
      invisible,
      coverage,
      overflow,
      contrast,
    };

    const bad =
      consoleErrors.length > 0 ||
      stuck.length > 0 ||
      invisible.length > 0 ||
      coverage.uncovered.length > 0 ||
      overflow.docOverflowPx > 1 ||
      contrast.fails.length > 0;
    if (bad) failures++;

    const pct = coverage.total ? (((coverage.total - coverage.uncovered.length) / coverage.total) * 100).toFixed(1) : '100.0';
    console.log(
      `${bad ? 'X' : 'OK'}  ${vp.name.padEnd(7)} ${route.padEnd(28)} ` +
        `cobertura ${pct}% (${coverage.total - coverage.uncovered.length}/${coverage.total})  ` +
        `presos:${stuck.length} invisiveis:${invisible.length} overflow:${overflow.docOverflowPx}px ` +
        `contraste:${contrast.fails.length}/${contrast.checked} console:${consoleErrors.length}`
    );

    const shot = path.join(SHOTS, `${vp.name}${route.replace(/\//g, '_') || '_home'}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    entry.screenshot = path.relative(ROOT, shot);

    // curva de entrada: só na home, só no desktop, em elementos representativos
    if (route === '/' && vp.name === 'desktop') {
      // Elementos representativos de CONTEÚDO. Medir o primeiro [data-reveal]
      // do documento pegava o grafismo de fundo do hero, que não é
      // representativo do que o visitante lê.
      entry.curves = [];
      for (const sel of ['#services [data-reveal]', 'h1[data-split]', '.foot-brand[data-reveal]']) {
        entry.curves.push(await measureEntryCurve(page, sel));
      }
    }

    report.push(entry);
    await page.close();
  }
}

/* ------------------------------------------------------------- sem JavaScript */

console.log('\n--- com JavaScript desligado ---');
for (const vp of VIEWPORTS) {
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
  await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle2', timeout: 45000 });
  const invisible = await page.evaluate(IN_PAGE.invisibleContent);
  const overflow = await page.evaluate(IN_PAGE.horizontalOverflow);
  const ok = invisible.length === 0 && overflow.docOverflowPx <= 1;
  if (!ok) failures++;
  console.log(
    `${ok ? 'OK' : 'X'}  ${vp.name.padEnd(7)} sem JS: invisiveis:${invisible.length} overflow:${overflow.docOverflowPx}px`
  );
  await page.screenshot({ path: path.join(SHOTS, `nojs-${vp.name}.png`) });
  report.push({ route: '/', viewport: `${vp.name}-nojs`, invisible, overflow, consoleErrors: [], stuck: [], coverage: null });
  await page.close();
}

/* ----------------------------------------------------------------- relatório */

await writeFile(path.join(SHOTS, 'report.json'), JSON.stringify(report, null, 2), 'utf8');

console.log('\n================ DETALHE DAS FALHAS ================');
let printed = 0;
for (const r of report) {
  const issues = [];
  if (r.consoleErrors?.length) issues.push(['console', r.consoleErrors]);
  if (r.stuck?.length) issues.push(['revelacoes presas', r.stuck]);
  if (r.invisible?.length) issues.push(['conteudo invisivel', r.invisible]);
  if (r.coverage?.uncovered?.length) issues.push(['sem animacao', r.coverage.uncovered]);
  if (r.contrast?.fails?.length) issues.push(['contraste abaixo de AA', r.contrast.fails]);
  if (r.overflow?.docOverflowPx > 1)
    issues.push([`overflow horizontal (${r.overflow.docOverflowPx}px no documento)`, r.overflow.offenders]);
  if (!issues.length) continue;
  printed++;
  console.log(`\n### ${r.viewport} ${r.route}`);
  for (const [label, items] of issues) {
    console.log(`  ${label} (${items.length}):`);
    for (const it of items.slice(0, 8)) console.log(`    - ${typeof it === 'string' ? it : JSON.stringify(it)}`);
    if (items.length > 8) console.log(`    …e mais ${items.length - 8}`);
  }
}
if (!printed) console.log('(nenhuma)');

const curves = report.flatMap((r) => r.curves || []);
if (curves.length) {
  console.log('\n================ CURVA DE ENTRADA ================');
  for (const c of curves) {
    if (c.error) {
      console.log(`  ${c.selector}: ${c.error}`);
      continue;
    }
    const gradual = c.distinctOpacity >= 5 || c.distinctY >= 5;
    console.log(
      `  ${gradual ? 'OK' : 'X'} ${c.selector}: ${c.frames} quadros, ` +
        `${c.distinctOpacity} valores distintos de opacidade, ${c.distinctY} de translateY ` +
        `(${c.first?.o} -> ${c.last?.o})`
    );
    if (!gradual) failures++;
  }
}

console.log(`\nScreenshots em ${path.relative(ROOT, SHOTS)}/`);
console.log(failures === 0 ? '\nTUDO VERDE.' : `\n${failures} verificação(ões) com problema.`);

if (!KEEP) {
  await browser.close();
  server.close();
  process.exit(failures === 0 ? 0 : 1);
} else {
  console.log('\n--keep: Chrome aberto. Ctrl+C para encerrar.');
}
