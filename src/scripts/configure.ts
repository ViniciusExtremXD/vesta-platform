/* =========================================================================
   Vesta — configurator (#configure, SPEC §5.8 + ROUND2/3)
   Loaded on demand by Configurator.astro. Every visual state that depends on
   the choices is CSS (:has); this module writes the TEXT (names, URLs, the
   build-sheet rows, the WhatsApp + mailto hrefs, the sticky-bar summary),
   runs the page-deck shuffle and the example switcher on the preview (a
   second face of the Industry step), and adds the micro-motion (sheet flips,
   the preview bump). Input is coalesced into one rAF. No storage, no network.
   All strings arrive pre-derived from src/data/site.ts in a JSON block.
   ========================================================================= */

interface Pk {
  name: string;
  days: string;
  r: number;
  line: string;
  sticky: string;
}

interface Cc {
  name: string;
  domain: string;
  niche: string;
  city: string;
  svc: string[];
}

interface Data {
  wa: string;
  mail: string;
  pk: Record<string, Pk>;
  msg: Record<'head' | 'tail' | 'startNew' | 'startRe' | 'startReUrl' | 'care' | 'none' | 'biz' | 'noBiz' | 'ind', string>;
  sheet: Record<'startNew' | 'startRe' | 'startReUrl' | 'care' | 'none', string>;
  cc: Record<string, Cc>;
  other: string;
  listing: { title: string };
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

const EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';
const QUINT = 'cubic-bezier(0.83, 0, 0.17, 1)';
const MECH = 'cubic-bezier(0.65, 0, 0.35, 1)';

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

  const html = document.documentElement;
  const still = () => html.classList.contains('motion-reduced') || html.classList.contains('motion-failed');
  const canAnimate = typeof Element.prototype.animate === 'function';

  const q = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s);
  const qa = <T extends Element = HTMLElement>(s: string) => Array.from(root.querySelectorAll<T>(s));

  /* personalisation targets: each concept plate keeps its own defaults, the
     page cards and the listing follow the chosen concept */
  const own = qa('[data-cp-name]:not([data-cp-follow]), [data-cp-url]:not([data-cp-follow])');
  own.forEach((el) => (el.dataset.def = el.textContent || ''));
  const ownNames = own.filter((el) => el.hasAttribute('data-cp-name'));
  const ownUrls = own.filter((el) => el.hasAttribute('data-cp-url'));
  const fNames = qa('[data-cp-name][data-cp-follow]');
  const fUrls = qa('[data-cp-url][data-cp-follow]');
  const cities = qa('[data-cp-city]');
  const svcs = qa('[data-svc]');
  const title = q('[data-cfg-title]');
  const sPackage = q('[data-sheet="package"]');
  const sIndustry = q('[data-sheet="industry"]');
  const rIndustry = q('[data-sheet-row="industry"]');
  const sStart = q('[data-sheet="start"]');
  const sOptions = q('[data-sheet="options"]');
  const sDelivery = q('[data-sheet="delivery"]');
  const sLine = q('[data-sheet="dl"]');
  const cta = q<HTMLAnchorElement>('[data-cfg-cta]');
  const mailA = q<HTMLAnchorElement>('[data-cfg-mail]');
  const bump = q('[data-cfg-bump]');

  const text = (el: Element | null, v: string) => {
    if (!el || el.textContent === v) return false;
    el.textContent = v;
    return true;
  };

  /* a changed sheet value flips in on its top hinge (split-flap) */
  let armed = false;
  const flip = (el: Element | null) => {
    if (!armed || !el || still() || !canAnimate) return;
    el.animate(
      [
        { transform: 'perspective(420px) rotateX(-88deg)', opacity: 0 },
        { transform: 'perspective(420px) rotateX(12deg)', opacity: 1, offset: 0.6 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 620, easing: EXPO }
    );
  };
  const put = (el: Element | null, v: string) => text(el, v) && flip(el);

  const read = () => {
    const f = new FormData(form);
    const id = String(f.get('package') || 'google');
    const ind = String(f.get('industry') || '');
    return {
      id,
      p: data.pk[id] || data.pk.google,
      ind,
      c: data.cc[ind] || data.cc.halden,
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

  /* ================================================================ deck */
  const deck = q('[data-deck]');
  const cards = qa('[data-card]');
  const pageBtns = qa<HTMLButtonElement>('[data-page]');
  /** slot of each card: 0 = front */
  const slot = cards.map((_, i) => i);
  let running: Animation[] = [];
  let landT = 0;

  const isComplete = () => !!form.querySelector('input[name="package"][value="complete"]:checked');

  const paint = () => {
    cards.forEach((c, i) => {
      c.style.setProperty('--k', String(slot[i]));
      c.classList.toggle('is-front', slot[i] === 0);
    });
    pageBtns.forEach((b) => b.setAttribute('aria-pressed', slot[Number(b.dataset.page)] === 0 ? 'true' : 'false'));
  };

  const settle = () => {
    running.forEach((a) => a.cancel());
    running = [];
    window.clearTimeout(landT);
    deck?.classList.remove('is-shuffling');
  };

  const reset = () => {
    settle();
    slot.forEach((_, i) => (slot[i] = i));
    cards.forEach((c) => c.classList.remove('is-landed'));
    paint();
  };

  const bringForward = (to: number) => {
    if (!deck || !isComplete() || !cards[to] || slot[to] === 0) return;
    settle();
    const from = slot.indexOf(0);
    const a = slot[to];
    const chosen = cards[to];
    const front = cards[from];
    const cs = getComputedStyle(deck);
    const fx = parseFloat(cs.getPropertyValue('--fan-x')) || 12;
    const fy = parseFloat(cs.getPropertyValue('--fan-y')) || 20;
    const w = front.offsetWidth;
    const h = front.offsetHeight;
    const T = (k: number) => `translate3d(${k * fx}px, ${-k * fy}px, 0px)`;

    slot[to] = 0;
    slot[from] = a;
    cards.forEach((c) => c.classList.remove('is-landed'));

    if (still() || !canAnimate) {
      paint();
      chosen.classList.add('is-landed');
      return;
    }

    deck.classList.add('is-shuffling');
    paint();
    const D = 1080;
    /* the chosen page lifts out of the deck, turns, and lands in front */
    running.push(
      chosen.animate(
        [
          { transform: T(a), zIndex: 10 - a, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
          {
            transform: `translate3d(${a * fx + w * 0.22}px, ${-a * fy - h * 0.24}px, 90px) rotateZ(6deg) rotateX(18deg) rotateY(-16deg)`,
            zIndex: 10 - a,
            offset: 0.34,
          },
          {
            transform: `translate3d(${w * 0.12}px, ${-h * 0.2}px, 140px) rotateZ(3deg) rotateX(10deg) rotateY(-8deg)`,
            zIndex: 30,
            offset: 0.46,
            easing: EXPO,
          },
          { transform: `translate3d(0px, ${h * 0.025}px, 30px) rotateZ(-0.8deg) rotateX(-3deg)`, zIndex: 30, offset: 0.82 },
          { transform: T(0), zIndex: 30 },
        ],
        { duration: D }
      )
    );
    /* the old front card sinks back into the deck with a 3D tilt */
    running.push(
      front.animate(
        [
          { transform: T(0), zIndex: 10, easing: QUINT },
          {
            transform: `translate3d(${-w * 0.05}px, ${h * 0.06}px, -160px) rotateX(-14deg) rotateY(10deg) rotateZ(-2.5deg)`,
            zIndex: 10,
            offset: 0.44,
            easing: MECH,
          },
          {
            transform: `translate3d(${a * fx * 0.6}px, ${-a * fy * 0.5}px, -110px) rotateX(-6deg) rotateY(4deg)`,
            zIndex: 10 - a,
            offset: 0.7,
            easing: EXPO,
          },
          { transform: T(a), zIndex: 10 - a },
        ],
        { duration: D }
      )
    );
    const done = running;
    Promise.all(done.map((x) => x.finished))
      .then(() => {
        if (running === done) {
          running = [];
          deck.classList.remove('is-shuffling');
        }
      })
      .catch(() => {
        /* cancelled by a newer shuffle */
      });
    landT = window.setTimeout(() => chosen.classList.add('is-landed'), D * 0.62);
  };

  deck?.addEventListener('click', (e) => {
    const card = (e.target as Element).closest<HTMLElement>('[data-card]');
    if (!card || card.classList.contains('is-front')) return;
    bringForward(Number(card.dataset.card));
  });
  pageBtns.forEach((b) => b.addEventListener('click', () => bringForward(Number(b.dataset.page))));

  /* ============================================================ examples */
  /* The switcher on the preview is a second face of step 01: a tab or an
     arrow checks the Industry radio (so CSS picks the plate and the sheet,
     message and listing follow), and any Industry change repaints the tabs.
     The turn itself runs here (WAAPI, transform/opacity): direction-aware
     (next turns one way, previous the other) and interruptible — a new pick
     mid-turn starts from wherever each plate is, never from a blank frame. */
  const swapEl = q('[data-swap]');
  const plates = new Map(qa('[data-si]').map((el) => [el.dataset.si || '', el]));
  const exBtns = qa<HTMLButtonElement>('[data-ex]');
  const exIds = exBtns.map((b) => b.dataset.ex || '');
  const exTabs = q('[data-ex-tabs]');
  /** the concept the preview is showing (none / Other fall back to 01) */
  const shownId = () => {
    const ind = form.querySelector<HTMLInputElement>('input[name="industry"]:checked')?.value || '';
    return exIds.includes(ind) ? ind : exIds[0];
  };
  let shown = shownId();
  let wantDir = 0;

  const paintEx = () => {
    exBtns.forEach((b) => {
      const on = b.dataset.ex === shown;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  };

  const OUT = (d: number) => `rotateY(${64 * d}deg) translate3d(${12 * d}%, 0, -120px)`;
  const IN = (d: number) => `rotateY(${-72 * d}deg) translate3d(${-14 * d}%, 0, -160px)`;
  const turning = new Map<HTMLElement, Animation[]>();
  if (swapEl && canAnimate) swapEl.dataset.turn = '';

  const turn = (from: string, to: string, dir: number) => {
    if (!swapEl || !canAnimate) return;
    /* where every plate is right now: mid-turn plates report their live
       pose; the rest are at rest (the old one shown, the others hidden) */
    const now = new Map<HTMLElement, { t: string; o: number; moving: boolean }>();
    /* a pick that lands mid-turn answers at once: no beat before the fades */
    const rush = turning.size > 0;
    plates.forEach((el, id) => {
      const run = turning.get(el);
      if (run) {
        const cs = getComputedStyle(el);
        now.set(el, { t: cs.transform, o: parseFloat(cs.opacity) || 0, moving: true });
        run.forEach((a) => a.cancel());
        turning.delete(el);
      } else if (id === from) now.set(el, { t: 'none', o: 1, moving: false });
    });
    if (still()) return;
    const keep = (el: HTMLElement, list: Animation[]) => {
      turning.set(el, list);
      Promise.all(list.map((a) => a.finished))
        .then(() => turning.get(el) === list && turning.delete(el))
        .catch(() => {
          /* cancelled by a newer pick */
        });
    };
    now.forEach((p, el) => {
      if (el === plates.get(to)) return;
      /* leaving: swing out to the far side, fading after a beat */
      keep(el, [
        el.animate([{ transform: p.t, visibility: 'visible' }, { transform: OUT(dir), visibility: 'visible' }], {
          duration: 620,
          easing: p.moving ? EXPO : QUINT,
        }),
        el.animate([{ opacity: p.o }, { opacity: 0 }], {
          duration: Math.max(120, (rush ? 300 : 360) * p.o),
          delay: rush ? 0 : 160,
          fill: 'backwards',
        }),
      ]);
    });
    const el = plates.get(to);
    if (!el) return;
    const p = now.get(el);
    const delay = rush || p ? 0 : 140;
    keep(el, [
      el.animate([{ transform: p ? p.t : IN(dir) }, { transform: 'none' }], { duration: 1050, delay, easing: EXPO, fill: 'backwards' }),
      el.animate([{ opacity: p ? p.o : 0 }, { opacity: 1 }], { duration: rush ? 260 : 420, delay, fill: 'backwards' }),
    ]);
  };

  /* runs synchronously inside the change event of step 01 */
  const onIndustry = () => {
    const next = shownId();
    if (next === shown) return;
    const dir = wantDir || (exIds.indexOf(next) < exIds.indexOf(shown) ? -1 : 1);
    wantDir = 0;
    turn(shown, next, dir);
    shown = next;
    paintEx();
  };

  const pick = (id: string, dir = 0) => {
    const input = form.querySelector<HTMLInputElement>(`input[name="industry"][value="${id}"]`);
    if (!input || input.checked) return;
    wantDir = dir;
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const stepBy = (d: number) => {
    const i = exIds.indexOf(shown);
    const n = exIds.length;
    pick(exIds[(((i + d) % n) + n) % n], d < 0 ? -1 : 1);
  };

  exBtns.forEach((b) => b.addEventListener('click', () => pick(b.dataset.ex || '')));
  qa<HTMLButtonElement>('[data-ex-step]').forEach((b) =>
    b.addEventListener('click', () => stepBy(Number(b.dataset.exStep) || 1))
  );
  /* ←/→ (and Home/End) on the tabs move the pick and the focus together */
  exTabs?.addEventListener('keydown', (e) => {
    const k = e.key;
    const n = exIds.length;
    const i = exIds.indexOf(shown);
    const to =
      k === 'ArrowRight' ? (i + 1) % n : k === 'ArrowLeft' ? (i - 1 + n) % n : k === 'Home' ? 0 : k === 'End' ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    const forward = k === 'ArrowRight' || k === 'End';
    pick(exIds[to], forward ? 1 : -1);
    exBtns[to]?.focus();
  });

  /* the preview answers every choice with a small 3D nod */
  let nodding: Animation | null = null;
  const nod = () => {
    if (!armed || !bump || still() || !canAnimate) return;
    /* rapid picks: let the running nod finish rather than snapping it */
    if (nodding && nodding.playState === 'running') return;
    nodding = bump.animate(
      [
        { transform: 'none' },
        { transform: 'perspective(1400px) translate3d(0, -10px, 40px) rotateX(5deg) rotateY(-3deg)', offset: 0.35 },
        { transform: 'none' },
      ],
      { duration: 760, easing: EXPO }
    );
  };

  /* ---- one write per frame ---- */
  let queued = false;
  let wasComplete = isComplete();

  const write = () => {
    queued = false;
    const s = read();
    const { p, c, ind, rebuild, url, care, biz } = s;

    /* plates, page cards, listing */
    const slug = slugify(biz);
    ownNames.forEach((el) => text(el, biz || el.dataset.def || ''));
    ownUrls.forEach((el) => text(el, slug ? `${slug}.com` : el.dataset.def || ''));
    fNames.forEach((el) => text(el, biz || c.name));
    fUrls.forEach((el) => text(el, slug ? `${slug}.com` : c.domain));
    cities.forEach((el) => text(el, c.city));
    svcs.forEach((el) => text(el, c.svc[Number(el.dataset.svc)] || ''));
    text(title, fill(data.listing.title, '{b}', biz || c.name));

    /* the deck resets when Complete is left */
    const complete = s.id === 'complete';
    if (wasComplete && !complete) reset();
    wasComplete = complete;

    /* build sheet */
    const niche = ind === 'other' ? data.other : data.cc[ind]?.niche || '';
    const startSheet = !rebuild ? data.sheet.startNew : url ? fill(data.sheet.startReUrl, '{u}', url) : data.sheet.startRe;
    put(sPackage, p.name);
    if (rIndustry) rIndustry.hidden = !niche;
    put(sIndustry, niche);
    put(sStart, startSheet);
    put(sOptions, care ? data.sheet.care : data.sheet.none);
    put(sDelivery, p.days);
    sLine?.style.setProperty('--r', p.r.toFixed(4));

    /* the message: WhatsApp and email carry the same build sheet */
    const m = data.msg;
    const msg = [
      m.head,
      p.line,
      !rebuild ? m.startNew : url ? fill(m.startReUrl, '{u}', url) : m.startRe,
      care ? m.care : m.none,
      biz ? fill(m.biz, '{b}', biz) : m.noBiz,
      ...(niche ? [fill(m.ind, '{i}', niche)] : []),
      m.tail,
    ].join('\n');
    href = data.wa + encodeURIComponent(msg);
    if (cta && cta.getAttribute('href') !== href) cta.setAttribute('href', href);
    const mhref = `${data.mail}&body=${encodeURIComponent(msg.replace(/\n/g, '\r\n'))}`;
    if (mailA && mailA.getAttribute('href') !== mhref) mailA.setAttribute('href', mhref);

    summary = p.sticky;
    if (inside) syncBar();
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(write);
  };

  form.addEventListener('input', schedule);
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement | null;
    if (t && t.name === 'industry') onIndustry();
    schedule();
    if (t && t.type !== 'text') nod();
  });
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
        import('./motion')
          .then((mo) => mo.travelTo(root))
          .catch(() => root.scrollIntoView({ block: 'start' }));
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

  paint();
  paintEx();
  write();
  armed = true;
}
