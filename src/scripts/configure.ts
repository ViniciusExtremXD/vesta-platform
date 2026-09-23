/* =========================================================================
   Vesta — configurator (#configure, SPEC §5.8)
   Loaded on demand by Configurator.astro. Every visual state that depends on
   the choices is CSS (:has); this module writes only TEXT and two numbers:
   the name/URL on the plate and listing, the build-sheet rows, the odometer
   price, the delivery line ratio, the WhatsApp href and the mobile sticky-bar
   summary. Input is coalesced into one rAF. No storage, no network.
   All strings arrive pre-derived from src/data/site.ts in a JSON block.
   ========================================================================= */

interface Pk {
  name: string;
  price: string;
  days: string;
  r: number;
  line: string;
  sticky: string;
}

interface Data {
  wa: string;
  pk: Record<string, Pk>;
  msg: Record<'head' | 'tail' | 'startNew' | 'startRe' | 'startReUrl' | 'care' | 'none' | 'biz' | 'noBiz', string>;
  sheet: Record<'startNew' | 'startRe' | 'startReUrl' | 'care' | 'none', string>;
  listing: { url0: string; title: string; name0: string };
  send: string;
}

const HASH = /^#configure\?(?:.*&)?model=(landing|google|complete)\b/;

/** Lowercase [a-z0-9], at most 24 characters, accents stripped (site.ts slugify). */
const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 24);

/** Fill a template token without re-scanning the user's text. */
const fill = (tpl: string, token: string, value: string) => tpl.split(token).join(value);

export function initConfigure(root: HTMLElement): void {
  if (root.dataset.cfgReady) return;
  const form = root.querySelector<HTMLFormElement>('form[data-config]');
  const raw = root.querySelector('script[data-config-data]');
  if (!form || !raw) return;
  let data: Data;
  try {
    data = JSON.parse(raw.textContent || '');
  } catch {
    return;
  }
  root.dataset.cfgReady = '1';

  const q = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s);
  const names = Array.from(root.querySelectorAll<HTMLElement>('[data-cp-name]'));
  const urls = Array.from(root.querySelectorAll<HTMLElement>('[data-cp-url], [data-cfg-url]'));
  const title = q('[data-cfg-title]');
  const sPackage = q('[data-sheet="package"]');
  const sStart = q('[data-sheet="start"]');
  const sOptions = q('[data-sheet="options"]');
  const sNote = q('[data-sheet="note"]');
  const sDelivery = q('[data-sheet="delivery"]');
  const sLine = q('[data-sheet="dl"]');
  const odo = q('[data-odometer]');
  const cta = q<HTMLAnchorElement>('[data-cfg-cta]');

  const text = (el: Element | null, v: string) => {
    if (el && el.textContent !== v) el.textContent = v;
  };

  const read = () => {
    const f = new FormData(form);
    const id = String(f.get('package') || 'google');
    return {
      p: data.pk[id] || data.pk.google,
      rebuild: f.get('start') === 'rebuild',
      url: String(f.get('url') || '').trim(),
      care: f.has('care'),
      biz: String(f.get('business') || '').trim(),
    };
  };

  /* ---- mobile sticky bar: swaps to the build summary inside #configure ---- */
  const bar = document.querySelector<HTMLElement>('[data-sticky-cta]');
  const barPrice = bar?.querySelector<HTMLElement>('.sticky-price') ?? null;
  const barHide = bar ? Array.from(bar.querySelectorAll<HTMLElement>('.sticky-sep, .sticky-note')) : [];
  const barLink = bar?.querySelector<HTMLAnchorElement>('[data-sticky-link]') ?? null;
  const barLabel = barLink?.querySelector<HTMLElement>('span:not([class])') ?? null;
  const barOrig = {
    price: barPrice?.textContent ?? '',
    href: barLink?.getAttribute('href') ?? '',
    label: barLabel?.textContent ?? '',
  };
  let inside = false;
  let href = cta?.getAttribute('href') ?? '';
  let summary = '';

  const syncBar = () => {
    if (!barPrice || !barLink) return;
    text(barPrice, inside ? summary : barOrig.price);
    barHide.forEach((el) => (el.hidden = inside));
    barLink.setAttribute('href', inside ? href : barOrig.href);
    if (barLabel) text(barLabel, inside ? data.send : barOrig.label);
  };

  /* ---- one write per frame ---- */
  let queued = false;
  let price = '';

  const write = () => {
    queued = false;
    const s = read();
    const { p, rebuild, url, care, biz } = s;

    /* plate + listing: typing updates textContent at once */
    const slug = slugify(biz);
    const domain = slug ? `${slug}.com` : data.listing.url0;
    names.forEach((el) => text(el, biz || data.listing.name0));
    urls.forEach((el) => text(el, domain));
    text(title, fill(data.listing.title, '{b}', biz || data.listing.name0));

    /* build sheet */
    const startSheet = !rebuild ? data.sheet.startNew : url ? fill(data.sheet.startReUrl, '{u}', url) : data.sheet.startRe;
    text(sPackage, p.name);
    text(sStart, startSheet);
    text(sOptions, care ? data.sheet.care : data.sheet.none);
    if (sNote) sNote.hidden = !care;
    text(sDelivery, p.days);
    sLine?.style.setProperty('--r', p.r.toFixed(4));
    if (odo && p.price !== price) {
      if (price) odo.dispatchEvent(new CustomEvent('vesta:odometer', { detail: { value: p.price } }));
      price = p.price;
    }

    /* the message */
    const m = data.msg;
    const msg = [
      m.head,
      p.line,
      !rebuild ? m.startNew : url ? fill(m.startReUrl, '{u}', url) : m.startRe,
      care ? m.care : m.none,
      biz ? fill(m.biz, '{b}', biz) : m.noBiz,
      m.tail,
    ].join('\n');
    href = data.wa + encodeURIComponent(msg);
    if (cta && cta.getAttribute('href') !== href) cta.setAttribute('href', href);

    summary = p.sticky;
    if (inside) syncBar();
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(write);
  };

  /* the price the odometer is already showing (no-JS default) */
  price = (odo?.querySelector('[data-odo-text]')?.textContent || '').trim();

  form.addEventListener('input', schedule);
  form.addEventListener('change', schedule);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur?.();
  });

  /* #configure?model=<id> — from the pricing columns, or a shared link */
  const applyHash = (scroll: boolean) => {
    const hit = HASH.exec(location.hash);
    if (!hit) return;
    const input = form.querySelector<HTMLInputElement>(`input[name="package"][value="${hit[1]}"]`);
    if (input && !input.checked) input.checked = true;
    schedule();
    if (scroll) {
      const r = root.getBoundingClientRect();
      if (r.top > window.innerHeight * 0.5 || r.bottom < 0) {
        const reduced = document.documentElement.classList.contains('motion-reduced');
        root.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      }
    }
  };
  window.addEventListener('hashchange', () => applyHash(true));
  applyHash(true);

  if (bar && 'IntersectionObserver' in window) {
    new IntersectionObserver(
      (es) => {
        const now = es.some((e) => e.isIntersecting);
        if (now === inside) return;
        inside = now;
        syncBar();
      },
      { rootMargin: '-45% 0px -45% 0px' }
    ).observe(root);
  }

  write();
}
