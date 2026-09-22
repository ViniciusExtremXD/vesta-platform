/* =========================================================================
   Vesta — motion engine
   One module, imported once by the base layout.

   Non-negotiables:
   - Nothing may ever stay invisible. Three independent safety nets guarantee
     that every [data-reveal] eventually gets .is-in, and a fourth (the inline
     <head> guard + html.motion-failed) covers this file never loading at all.
   - Only opacity / transform / filter / color are animated. Never clip-path.
   - The OS "prefers-reduced-motion" flag is deliberately ignored. Windows
     ships with animations off by default and that silently killed the whole
     experience for real clients. The footer toggle is the control.
   ========================================================================= */

import { initParticles } from './particles';
import { initTilt } from './tilt';
import { initClocks } from './clocks';

const STORAGE_KEY = 'vesta-motion';
const READY_FLAG = '__vestaMotionReady';
const root = document.documentElement;

type Cleanup = () => void;
const cleanups: Cleanup[] = [];

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

function applyPreference(pref: 'full' | 'reduced'): void {
  root.classList.toggle('motion-reduced', pref === 'reduced');
  document.querySelectorAll<HTMLElement>('[data-motion-toggle]').forEach((btn) => {
    const reduced = pref === 'reduced';
    btn.setAttribute('aria-pressed', String(reduced));
    btn.setAttribute('aria-label', reduced ? 'Turn motion on' : 'Reduce motion');
    const text = btn.querySelector('[data-motion-label]');
    if (text) text.textContent = reduced ? 'Motion: off' : 'Motion: on';
  });
}

export function isReduced(): boolean {
  return root.classList.contains('motion-reduced');
}

function initPreference(): void {
  applyPreference(storedPreference() ?? 'full');

  const onClick = (e: Event) => {
    const btn = (e.target as HTMLElement | null)?.closest('[data-motion-toggle]');
    if (!btn) return;
    e.preventDefault();
    const next = isReduced() ? 'full' : 'reduced';
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode — the class still applies for this session */
    }
    applyPreference(next);
    revealAll(next === 'reduced');
  };

  document.addEventListener('click', onClick);
  cleanups.push(() => document.removeEventListener('click', onClick));
}

/* ---------------------------------------------------------------------- */
/* 1. word splitting                                                      */
/* ---------------------------------------------------------------------- */

/**
 * Wraps each word of every descendant text node in <span class="w" style="--w:n">
 * without destroying inline markup (<br>, <em>, <a>, highlight spans).
 */
function splitWords(el: HTMLElement): void {
  if (el.dataset.splitDone === '1') return;

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (parent && parent.closest('[data-split-skip]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const targets: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    targets.push(current as Text);
    current = walker.nextNode();
  }
  if (!targets.length) return;

  let index = 0;
  for (const node of targets) {
    const frag = document.createDocumentFragment();
    const parts = (node.nodeValue ?? '').split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        frag.appendChild(document.createTextNode(part));
        continue;
      }
      const span = document.createElement('span');
      span.className = 'w';
      span.style.setProperty('--w', String(index++));
      span.textContent = part;
      frag.appendChild(span);
    }
    node.parentNode?.replaceChild(frag, node);
  }

  el.dataset.splitDone = '1';
  el.style.setProperty('--w-count', String(index));
}

/* ---------------------------------------------------------------------- */
/* 2. reveals — IntersectionObserver + 3 safety nets                      */
/* ---------------------------------------------------------------------- */

const REVEAL_SELECTOR = '[data-reveal], [data-split], [data-draw], [data-draw-path], [data-count]';
const pending = new Set<HTMLElement>();
let observer: IntersectionObserver | null = null;

function markIn(el: HTMLElement): void {
  if (el.classList.contains('is-in')) return;
  el.classList.add('is-in');
  pending.delete(el);
  if (observer) observer.unobserve(el);
  if (el.hasAttribute('data-count')) startCounter(el);
  el.dispatchEvent(new CustomEvent('vesta:reveal', { bubbles: true }));
}

/** Net #3 / manual override: reveal everything, optionally with no transition. */
function revealAll(instant: boolean): void {
  document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((el) => {
    if (instant) {
      const prev = el.style.transition;
      el.style.transition = 'none';
      markIn(el);
      void el.offsetHeight;
      el.style.transition = prev;
    } else {
      markIn(el);
    }
  });
}

function inViewport(el: Element, slack = 0): boolean {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  return r.top < vh - slack && r.bottom > 0;
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

  // Elements already on screen at load: stagger them in immediately rather
  // than waiting for a scroll event that may never come on a short page.
  const initial = nodes.filter((el) => inViewport(el, -120));

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) markIn(entry.target as HTMLElement);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.01 }
    );
    nodes.forEach((el) => observer!.observe(el));
  }

  // Net #1 — fire the above-the-fold batch on the next frame.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => initial.forEach(markIn));
  });

  // Net #2 — a rAF-throttled scroll sweep, in case IO never fires.
  let ticking = false;
  const sweep = () => {
    if (ticking || !pending.size) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (!pending.size) return;
      Array.from(pending).forEach((el) => {
        if (inViewport(el, 40)) markIn(el);
      });
    });
  };
  window.addEventListener('scroll', sweep, { passive: true });
  window.addEventListener('resize', sweep, { passive: true });
  cleanups.push(() => {
    window.removeEventListener('scroll', sweep);
    window.removeEventListener('resize', sweep);
  });

  // Net #3 — hard deadline. Anything still hidden after 6s gets revealed.
  window.setTimeout(() => {
    if (pending.size) Array.from(pending).forEach(markIn);
  }, 6000);
}

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
  const locale = el.dataset.countLocale ?? 'en-US';
  const fmt = (n: number) =>
    prefix +
    n.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) +
    suffix;

  if (isReduced()) {
    el.textContent = fmt(target);
    return;
  }

  const duration = Number(el.dataset.countDur ?? 1400);
  const start = performance.now();
  const from = Number(el.dataset.countFrom ?? 0);

  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = t === 1 ? 1 : 1 - Math.pow(2, -9 * t); // easeOutExpo: telemetry landing
    el.textContent = fmt(from + (target - from) * eased);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = fmt(target);
  };
  requestAnimationFrame(tick);
}

/* ---------------------------------------------------------------------- */
/* 4. scroll: progress, nav, parallax, hero exit, active link             */
/* ---------------------------------------------------------------------- */

function initScroll(): void {
  const bar = document.querySelector<HTMLElement>('[data-progress]');
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  const hero = document.querySelector<HTMLElement>('[data-hero-exit]');
  const parallax = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));
  const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]'));
  const sections = navLinks
    .map((a) => {
      const href = a.getAttribute('href') || '';
      const hash = href.includes('#') ? href.slice(href.indexOf('#')) : '';
      return hash.length > 1 ? document.querySelector<HTMLElement>(hash) : null;
    })
    .filter((s): s is HTMLElement => Boolean(s));

  let lastY = window.scrollY;
  let ticking = false;
  let activeId = '';

  const frame = () => {
    ticking = false;
    const reduced = isReduced();

    // ---- reads first, all of them, then writes: interleaving the two forces
    // a synchronous layout per element (Lighthouse flags it as forced reflow).
    const y = window.scrollY;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const vh = window.innerHeight;
    const parallaxRects = reduced ? [] : parallax.map((el) => el.getBoundingClientRect());
    const sectionTops = sections.map((s) => s.getBoundingClientRect().top);

    // ---- writes
    if (bar) bar.style.setProperty('--p', String(docH > 0 ? Math.min(1, Math.max(0, y / docH)) : 0));

    if (nav) {
      nav.classList.toggle('is-solid', y > 12);
      const goingDown = y > lastY + 4;
      const goingUp = y < lastY - 4;
      if (goingDown && y > vh * 0.6) nav.classList.add('is-hidden');
      else if (goingUp || y < 80) nav.classList.remove('is-hidden');
    }

    if (hero && !reduced) {
      const p = Math.min(1, y / (vh * 0.85));
      hero.style.setProperty('--hero-y', `${(p * 56).toFixed(1)}px`);
      hero.style.setProperty('--hero-o', String(Math.max(0, 1 - p * 1.12)));
    }

    if (!reduced) {
      parallax.forEach((el, i) => {
        const r = parallaxRects[i];
        if (r.bottom < -200 || r.top > vh + 200) return;
        const speed = Number(el.dataset.parallax || 0.12);
        const centre = r.top + r.height / 2 - vh / 2;
        el.style.setProperty('--py', `${(-centre * speed).toFixed(1)}px`);
      });
    }

    if (sections.length) {
      let current = '';
      sections.forEach((s, i) => {
        if (sectionTops[i] <= vh * 0.35) current = `#${s.id}`;
      });
      if (current !== activeId) {
        activeId = current;
        navLinks.forEach((a) => {
          const href = a.getAttribute('href') || '';
          const on = current !== '' && href.endsWith(current);
          a.classList.toggle('is-active', on);
        });
      }
    }

    lastY = y;
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(frame);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  cleanups.push(() => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  });
  frame();
}

/* ---------------------------------------------------------------------- */
/* 5. pointer: glow + magnetic (fine pointers only)                       */
/* ---------------------------------------------------------------------- */

function initPointer(): void {
  if (!window.matchMedia('(pointer: fine)').matches) return;

  document.querySelectorAll<HTMLElement>('[data-glow]').forEach((el) => {
    const move = (e: PointerEvent) => {
      if (isReduced()) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    };
    const enter = () => !isReduced() && el.classList.add('is-hot');
    const leave = () => el.classList.remove('is-hot');
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    cleanups.push(() => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
    });
  });

  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const strength = Number(el.dataset.magnetic || 0.28);
    const move = (e: PointerEvent) => {
      if (isReduced()) return;
      const r = el.getBoundingClientRect();
      el.classList.add('is-pulling');
      el.style.setProperty('--gx', `${(e.clientX - (r.left + r.width / 2)) * strength}px`);
      el.style.setProperty('--gy', `${(e.clientY - (r.top + r.height / 2)) * strength}px`);
    };
    const reset = () => {
      el.classList.remove('is-pulling');
      el.style.setProperty('--gx', '0px');
      el.style.setProperty('--gy', '0px');
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', reset);
    el.addEventListener('blur', reset);
    cleanups.push(() => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', reset);
      el.removeEventListener('blur', reset);
    });
  });
}

/* ---------------------------------------------------------------------- */
/* 6. images                                                              */
/* ---------------------------------------------------------------------- */

function initImages(): void {
  document.querySelectorAll<HTMLImageElement>('img[data-img-fade]').forEach((img) => {
    const done = () => img.classList.add('is-loaded');
    if (img.complete && img.naturalWidth > 0) {
      done();
      return;
    }
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
    // safety net: a stalled decode must never leave a hole in the page
    window.setTimeout(done, 3500);
  });
}

/* ---------------------------------------------------------------------- */
/* 7. boot                                                                */
/* ---------------------------------------------------------------------- */

function boot(): void {
  let failed = false;
  try {
    initPreference();
    initReveals();
    initScroll();
    initPointer();
    initImages();
    initClocks();
    initTilt(isReduced);
    initParticles(isReduced);
  } catch (err) {
    // A thrown error must never leave the page half-hidden.
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
