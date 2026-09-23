/* =========================================================================
   Vesta — motion engine
   One module, imported once by the base layout. Section scripts import the
   small API below (addFrame, isReduced, vestibular) — ES modules are
   singletons, so there is exactly one scroll loop on the page.

   Non-negotiables:
   - Nothing may ever stay invisible. Three safety nets guarantee every
     reveal eventually gets .is-in; the inline <head> guard adds
     html.motion-failed if this file never reports in.
   - One rAF loop for everything scroll-linked. Handlers READ in one pass,
     then WRITE in a second pass — interleaving forces layout per element.
   - The OS "prefers-reduced-motion" flag is ignored for entrances on
     purpose (Windows ships with it on and it silently killed the site for
     real clients). The footer toggle is the master control. Set
     HONOR_OS_VESTIBULAR to true to let the OS flag freeze the three
     vestibular effects (Build teardown, Stance, studio light).
   ========================================================================= */

import Lenis from 'lenis';

const STORAGE_KEY = 'vesta-motion';
const READY_FLAG = '__vestaMotionReady';
const HONOR_OS_VESTIBULAR = false;

const root = document.documentElement;

/* ---------------------------------------------------------------------- */
/* 0. preference                                                          */
/* ---------------------------------------------------------------------- */

function storedPreference(): 'full' | 'reduced' | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'reduced' || v === 'full' ? v : null;
  } catch {
    return null;
  }
}

export function isReduced(): boolean {
  return root.classList.contains('motion-reduced');
}

/** True when scroll-scrubbed 3D / large-motion effects should render static. */
export function vestibular(): boolean {
  if (isReduced()) return true;
  if (!HONOR_OS_VESTIBULAR) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function applyPreference(pref: 'full' | 'reduced'): void {
  root.classList.toggle('motion-reduced', pref === 'reduced');
  document.querySelectorAll<HTMLElement>('[data-motion-toggle]').forEach((btn) => {
    const reduced = pref === 'reduced';
    btn.setAttribute('aria-pressed', String(reduced));
    btn.setAttribute('aria-label', reduced ? 'Turn motion on' : 'Reduce motion');
    const text = btn.querySelector('[data-motion-label]');
    if (text) text.textContent = reduced ? 'Motion: off' : 'Motion: on';
  });
  document.dispatchEvent(new CustomEvent('vesta:motion', { detail: { reduced: pref === 'reduced' } }));
}

/**
 * Motion is always on — the owner removed the footer toggle (2026-09-23).
 * The html.motion-reduced plumbing stays in CSS/scripts as a fail-safe, but
 * nothing turns it on any more, and an old saved opt-out is cleared.
 */
function initPreference(): void {
  if (storedPreference() === 'reduced') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private mode */
    }
  }
  applyPreference('full');
}

/* ---------------------------------------------------------------------- */
/* 1. word splitting (runtime fallback; SplitText.astro splits at build)  */
/* ---------------------------------------------------------------------- */

function splitWords(el: HTMLElement): void {
  if (el.hasAttribute('data-split-done')) return;

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (node.parentElement?.closest('[data-split-skip]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const targets: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) targets.push(n as Text);

  let index = 0;
  for (const node of targets) {
    const frag = document.createDocumentFragment();
    for (const part of (node.nodeValue ?? '').split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        frag.appendChild(document.createTextNode(part));
        continue;
      }
      const mask = document.createElement('span');
      mask.className = 'wm';
      const word = document.createElement('span');
      word.className = 'w';
      word.style.setProperty('--i', String(index++));
      word.textContent = part;
      mask.appendChild(word);
      frag.appendChild(mask);
    }
    node.parentNode?.replaceChild(frag, node);
  }
  el.setAttribute('data-split-done', '');
}

/* ---------------------------------------------------------------------- */
/* 2. reveals — IntersectionObserver + 3 safety nets                      */
/* ---------------------------------------------------------------------- */

const REVEAL_SELECTOR = '[data-reveal], [data-split], [data-draw-path], [data-count], [data-inview]';
const pending = new Set<HTMLElement>();
let observer: IntersectionObserver | null = null;

function markIn(el: HTMLElement): void {
  if (el.classList.contains('is-in')) return;
  el.classList.add('is-in');
  pending.delete(el);
  observer?.unobserve(el);
  if (el.hasAttribute('data-count')) startCounter(el);
  el.dispatchEvent(new CustomEvent('vesta:reveal', { bubbles: true }));
}

function revealAll(instant: boolean): void {
  document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((el) => {
    if (!instant) return markIn(el);
    const prev = el.style.transition;
    el.style.transition = 'none';
    markIn(el);
    void el.offsetHeight;
    el.style.transition = prev;
  });
}

function inViewport(el: Element, slack = 0): boolean {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight || root.clientHeight;
  return r.top < vh - slack && r.bottom > 0 && (r.width > 0 || r.height > 0);
}

function prepareDrawPaths(scope: ParentNode = document): void {
  scope.querySelectorAll<SVGGeometryElement>('[data-draw-path]').forEach((path) => {
    if (path.dataset.len) return;
    let len = 0;
    try {
      len = typeof path.getTotalLength === 'function' ? path.getTotalLength() : 0;
    } catch {
      len = 0;
    }
    if (!len || !Number.isFinite(len)) len = 1200;
    const rounded = Math.ceil(len) + 2;
    path.dataset.len = String(rounded);
    path.style.setProperty('--len', String(rounded));
  });
}

/** Watch elements added after boot (e.g. by a section script). */
export function observeReveals(scope: ParentNode): void {
  scope.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((el) => {
    if (el.classList.contains('is-in')) return;
    if (el.hasAttribute('data-split')) splitWords(el);
    pending.add(el);
    if (isReduced()) markIn(el);
    else observer?.observe(el);
  });
  prepareDrawPaths(scope);
}

function initReveals(): void {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
  nodes.forEach((el) => {
    if (el.hasAttribute('data-split')) splitWords(el);
    pending.add(el);
  });
  prepareDrawPaths();

  if (isReduced()) {
    revealAll(true);
    return;
  }

  const initial = nodes.filter((el) => inViewport(el, -60));

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) markIn(entry.target as HTMLElement);
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.01 }
    );
    nodes.forEach((el) => observer!.observe(el));
  }

  // Net #1 — the above-the-fold batch on the next frame.
  requestAnimationFrame(() => requestAnimationFrame(() => initial.forEach(markIn)));

  // Net #2 — a sweep inside the shared scroll loop, in case IO never fires.
  addFrame({
    read(y, vh) {
      if (!pending.size) return;
      // At the very bottom nothing can scroll further up into view, so a
      // sliver at the bottom edge (the footer wordmark) counts as seen.
      const atEnd = y + vh >= root.scrollHeight - 2;
      pending.forEach((el) => {
        if (inViewport(el, atEnd ? 0 : 40)) sweepHits.push(el);
      });
    },
    write() {
      sweepHits.forEach(markIn);
      sweepHits.length = 0;
    },
  });

  // Net #3 — hard deadline for everything in or above the viewport. Content
  // further down keeps its entrance for when the visitor gets there; the
  // observer and the scroll sweep (net #2) own it, and every scroll re-arms
  // this net for the new position.
  const deadline = () => {
    const vh = window.innerHeight;
    pending.forEach((el) => {
      if (el.getBoundingClientRect().top < vh) markIn(el);
    });
  };
  window.setTimeout(deadline, 6000);
  let settle = 0;
  window.addEventListener(
    'scroll',
    () => {
      window.clearTimeout(settle);
      settle = window.setTimeout(deadline, 1500);
    },
    { passive: true }
  );
}
const sweepHits: HTMLElement[] = [];

/* ---------------------------------------------------------------------- */
/* 3. counters                                                            */
/* ---------------------------------------------------------------------- */

function startCounter(el: HTMLElement): void {
  if (el.dataset.countDone === '1') return;
  el.dataset.countDone = '1';

  const target = Number(el.dataset.count);
  if (!Number.isFinite(target)) return;

  const decimals = Number(el.dataset.countDecimals ?? 0);
  const prefix = el.dataset.countPrefix ?? '';
  const suffix = el.dataset.countSuffix ?? '';
  const fmt = (n: number) =>
    prefix + n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;

  if (isReduced()) {
    el.textContent = fmt(target);
    return;
  }

  const duration = Number(el.dataset.countDur ?? 1400);
  const delay = Number(el.dataset.countDelay ?? 0);
  const from = Number(el.dataset.countFrom ?? 0);

  window.setTimeout(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      el.textContent = fmt(from + (target - from) * eased);
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = fmt(target);
    };
    el.textContent = fmt(from);
    requestAnimationFrame(tick);
  }, delay);
}

/* ---------------------------------------------------------------------- */
/* 4. the one scroll loop                                                 */
/* ---------------------------------------------------------------------- */

export interface FrameHandler {
  /** Layout reads only. Receives scrollY and the viewport height. */
  read?(y: number, vh: number, vw: number): void;
  /** Style writes only. */
  write?(): void;
}

const handlers = new Set<FrameHandler>();
let frameQueued = false;

export function addFrame(h: FrameHandler): () => void {
  handlers.add(h);
  requestFrame();
  return () => handlers.delete(h);
}

export function requestFrame(): void {
  if (frameQueued) return;
  frameQueued = true;
  requestAnimationFrame(runFrame);
}

function runFrame(): void {
  frameQueued = false;
  const y = window.scrollY;
  const vh = window.innerHeight;
  const vw = root.clientWidth;
  handlers.forEach((h) => h.read?.(y, vh, vw));
  handlers.forEach((h) => h.write?.());
}

function initScroll(): void {
  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('resize', requestFrame, { passive: true });

  /* progress line */
  const bar = document.querySelector<HTMLElement>('[data-progress]');
  if (bar) {
    let p = 0;
    addFrame({
      read(y, vh) {
        const docH = root.scrollHeight - vh;
        p = docH > 0 ? Math.min(1, Math.max(0, y / docH)) : 0;
      },
      write() {
        bar.style.setProperty('--p', p.toFixed(4));
      },
    });
  }

  /* nav: solid after 12px, hides on the way down, returns on the way up,
     and takes the theme of whatever section sits under it */
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  if (nav) {
    const themed = Array.from(document.querySelectorAll<HTMLElement>('[data-nav-theme]'));
    let lastY = window.scrollY;
    let solid = false;
    let hidden = false;
    let theme = 'dark';
    addFrame({
      read(y, vh) {
        solid = y > 12;
        const down = y > lastY + 4;
        const up = y < lastY - 4;
        if (down && y > vh * 0.6 && !nav.matches(':focus-within') && !root.classList.contains('menu-open')) hidden = true;
        else if (up || y < 80) hidden = false;
        lastY = y;
        const probe = nav.offsetHeight / 2;
        theme = 'dark';
        for (const s of themed) {
          const r = s.getBoundingClientRect();
          if (r.top <= probe && r.bottom > probe) theme = s.dataset.navTheme || 'dark';
        }
      },
      write() {
        nav.classList.toggle('is-solid', solid);
        nav.classList.toggle('is-hidden', hidden);
        if (nav.dataset.theme !== theme) nav.dataset.theme = theme;
      },
    });
  }

  /* hero exit: transform-only drift as the hero scrolls away */
  const hero = document.querySelector<HTMLElement>('[data-hero-exit]');
  if (hero) {
    let p = 0;
    addFrame({
      read(y, vh) {
        p = vestibular() ? 0 : Math.min(1, Math.max(0, y / (vh * 0.85)));
      },
      write() {
        hero.style.setProperty('--hx', p.toFixed(4));
      },
    });
  }

  /* 3D scene entrance: [data-scene] rises out of depth as it scrolls in.
     --scene goes 0 → 1 while the element's top travels from the bottom of
     the viewport to 55% of it; CSS turns that into a perspective tilt. The
     default (no JS, reduced, before the first frame) is 1 = final. */
  const scenes = Array.from(document.querySelectorAll<HTMLElement>('[data-scene]'));
  if (scenes.length) {
    const tops: number[] = [];
    let vhNow = 0;
    addFrame({
      read(_y, vh) {
        vhNow = vh;
        scenes.forEach((el, i) => (tops[i] = el.getBoundingClientRect().top));
      },
      write() {
        const off = vestibular();
        scenes.forEach((el, i) => {
          const t = tops[i];
          if (t > vhNow * 1.6 || t < -vhNow) return;
          const raw = off ? 1 : (vhNow - t) / (vhNow * 0.45);
          const s = Math.min(1, Math.max(0, raw));
          const eased = 1 - Math.pow(1 - s, 3);
          el.style.setProperty('--scene', eased.toFixed(4));
        });
      },
    });
  }

  /* parallax */
  const parallax = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));
  if (parallax.length) {
    const rects: DOMRect[] = [];
    let vhNow = 0;
    addFrame({
      read(_y, vh) {
        vhNow = vh;
        parallax.forEach((el, i) => (rects[i] = el.getBoundingClientRect()));
      },
      write() {
        if (isReduced()) return;
        parallax.forEach((el, i) => {
          const r = rects[i];
          if (r.bottom < -200 || r.top > vhNow + 200) return;
          const speed = Number(el.dataset.parallax || 0.12);
          const centre = r.top + r.height / 2 - vhNow / 2;
          el.style.setProperty('--py', `${(-centre * speed).toFixed(1)}px`);
        });
      },
    });
  }

  /* mobile sticky WhatsApp bar */
  const sticky = document.querySelector<HTMLElement>('[data-sticky-cta]');
  if (sticky) {
    const anchor = document.querySelector<HTMLElement>('[data-sticky-anchor]');
    const hiders = Array.from(document.querySelectorAll<HTMLElement>('[data-sticky-hide]'));
    let show = false;
    addFrame({
      read(_y, vh) {
        const past = anchor ? anchor.getBoundingClientRect().bottom < 0 : window.scrollY > vh;
        const covered = hiders.some((h) => {
          const r = h.getBoundingClientRect();
          return r.top < vh && r.bottom > vh - 80;
        });
        show = past && !covered && !root.classList.contains('menu-open');
      },
      write() {
        sticky.classList.toggle('is-shown', show);
        sticky.toggleAttribute('inert', !show);
      },
    });
  }

  requestFrame();
}

/* ---------------------------------------------------------------------- */
/* 5. pointer: magnetic (fine pointers only)                              */
/* ---------------------------------------------------------------------- */

function initPointer(): void {
  if (!window.matchMedia('(pointer: fine)').matches) return;

  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const strength = Number(el.dataset.magnetic || 0.2);
    const clampPx = 8;
    el.addEventListener('pointermove', (e) => {
      if (isReduced()) return;
      const r = el.getBoundingClientRect();
      const gx = Math.max(-clampPx, Math.min(clampPx, (e.clientX - (r.left + r.width / 2)) * strength));
      const gy = Math.max(-clampPx, Math.min(clampPx, (e.clientY - (r.top + r.height / 2)) * strength));
      el.classList.add('is-pulling');
      el.style.setProperty('--mag-x', `${gx.toFixed(1)}px`);
      el.style.setProperty('--mag-y', `${gy.toFixed(1)}px`);
    });
    const reset = () => {
      el.classList.remove('is-pulling');
      el.style.setProperty('--mag-x', '0px');
      el.style.setProperty('--mag-y', '0px');
    };
    el.addEventListener('pointerleave', reset);
    el.addEventListener('blur', reset);
  });

  /* 3D tilt toward the pointer: [data-tilt] or [data-tilt="6"] (max degrees) */
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
    const max = Number(el.dataset.tilt || 5);
    el.addEventListener('pointermove', (e) => {
      if (isReduced()) return;
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      el.classList.add('is-tilting');
      el.style.setProperty('--tilt-x', `${(nx * max * 2).toFixed(2)}deg`);
      el.style.setProperty('--tilt-y', `${(-ny * max * 2).toFixed(2)}deg`);
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('is-tilting');
      el.style.setProperty('--tilt-x', '0deg');
      el.style.setProperty('--tilt-y', '0deg');
    });
  });

  /* gleam distance = button width, so the line always crosses fully */
  document.querySelectorAll<HTMLElement>('.btn').forEach((btn) => {
    btn.addEventListener('pointerenter', () => btn.style.setProperty('--gleam-x', `${btn.offsetWidth + 4}px`), { passive: true });
  });
}

/* ---------------------------------------------------------------------- */
/* 6. images                                                              */
/* ---------------------------------------------------------------------- */

function initImages(): void {
  document.querySelectorAll<HTMLImageElement>('img[data-img-fade]').forEach((img) => {
    const done = () => img.classList.add('is-loaded');
    if (img.complete && img.naturalWidth > 0) return done();
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
    window.setTimeout(done, 3500);
  });
}

/* ---------------------------------------------------------------------- */
/* 6b. smooth scroll + eased anchors                                      */
/* ---------------------------------------------------------------------- */
/* Lenis smooths wheel/trackpad scrolling on fine pointers only (touch keeps
   native momentum). It drives the real window scroll, so position: sticky,
   the shared frame loop and IntersectionObserver keep working unchanged.
   Every same-page anchor — with or without Lenis — travels on an eased
   curve instead of the browser's jump. Motion: off turns both off. */

let lenis: Lenis | null = null;

const easeInOutExpo = (t: number): number =>
  t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;

function navOffset(): number {
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  return (nav?.offsetHeight ?? 0) + 12;
}

/** Scrolls to an element (or y) on the site's travel curve. */
export function travelTo(target: HTMLElement | number): void {
  const top =
    typeof target === 'number'
      ? target
      : target.getBoundingClientRect().top + window.scrollY - navOffset();
  const distance = Math.abs(top - window.scrollY);
  const duration = Math.min(2.2, 0.9 + distance / 4000);

  if (isReduced()) {
    window.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
    return;
  }
  if (lenis) {
    lenis.scrollTo(top, { duration, easing: easeInOutExpo, force: true });
    return;
  }
  const from = window.scrollY;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / (duration * 1000));
    window.scrollTo({ top: from + (top - from) * easeInOutExpo(t), behavior: 'instant' as ScrollBehavior });
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function initSmoothScroll(): void {
  const fine = window.matchMedia('(pointer: fine)').matches;
  const start = () => {
    if (lenis || isReduced() || !fine) return;
    lenis = new Lenis({
      duration: 1.15,
      easing: (t) => 1 - Math.pow(1 - t, 4),
      smoothWheel: true,
      allowNestedScroll: true,
      autoRaf: true,
    });
  };
  const stop = () => {
    lenis?.destroy();
    lenis = null;
  };
  start();
  document.addEventListener('vesta:motion', () => (isReduced() ? stop() : start()));

  // the full-screen menu locks the page; Lenis has to stop with it
  new MutationObserver(() => {
    if (!lenis) return;
    if (root.classList.contains('menu-open')) lenis.stop();
    else lenis.start();
  }).observe(root, { attributes: true, attributeFilter: ['class'] });

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href*="#"]');
    if (!a || a.target === '_blank') return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.hash.length < 2) return;
    // ids may carry a query, e.g. #configure?model=complete
    const id = decodeURIComponent(url.hash.slice(1).split('?')[0]);
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    travelTo(el);
    if (location.hash !== url.hash) {
      history.pushState(null, '', url.hash);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  });
}

/* ---------------------------------------------------------------------- */
/* 7. boot                                                                */
/* ---------------------------------------------------------------------- */

function boot(): void {
  let failed = false;
  try {
    initPreference();
    initScroll();
    initReveals();
    initPointer();
    initImages();
    initSmoothScroll();
  } catch (err) {
    failed = true;
    root.classList.add('motion-failed');
    console.error('[motion] failed to start; content revealed:', err);
  } finally {
    (window as unknown as Record<string, unknown>)[READY_FLAG] = true;
    if (!failed) root.classList.remove('motion-failed');
    root.classList.add('motion-ready');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
