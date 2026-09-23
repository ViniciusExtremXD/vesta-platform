/* =========================================================================
   The Rebuild Line (§6.1) + the hero's five-niche showcase.

   ── Rebuild line (every hero-mode ConceptPlate, [data-compare]) ─────────
   --x: 0 = the old site, 1 = rebuilt. The rebuilt site covers [0, x] from
   the left; the blade and the handle sit at x. --x is written on the
   plate's HOST: the nearest [data-x-host] ancestor (the hero card, so the
   tags riding the URL bar outside the figure follow it too) or the figure.

   - CSS plays the rebuild on load; this file never gates first paint.
   - On animationend (or at once under motion-off) tween 1 → .56, then arm.
   - Hidden tab at load: jump straight to .56.
   - Plate mostly below the fold at load (phones): hold the old site and play
     the rebuild when it scrolls into view.
   - Pointer: mouse drags from anywhere on the screen; touch drags only after
     a horizontal intent, so vertical page scrolling is never trapped.
   - Keys on the slider: ←/↓ −5, →/↑ +5, PageDown/PageUp ∓10, Home 0, End 100.
   - The idle sheen pauses offscreen and in hidden tabs.
   - Events (bubble from the figure): `plate:armed`, `plate:drag` (detail
     { active }), so a host can pause what it runs while the visitor drags.

   ── Showcase ([data-showcase], the hero) ─────────────────────────────────
   Five concept studies, one live plate. The first is in the HTML; the other
   four wait in <template data-card="id"> and are cloned on demand, so the
   page carries one live drawing. Tabs (role=tab) with a progress bar each;
   the bar is a CSS animation (--hs-dwell) whose end advances the deck.
   Auto-advance holds on hover, focus, drag, offscreen, hidden tab and while
   a switch plays; it stops for good once the visitor picks a tab.
   A switch: the current card swings away in 3D, the next one comes forward
   off the deck on its BEFORE, the blade sweeps to AFTER and settles at .56.
   ========================================================================= */

import { addFrame, isReduced, vestibular } from './motion';

const REST = 0.56;
const clamp = (v: number) => Math.min(1, Math.max(0, v));
/* --ease-mech, cubic-bezier(.65,0,.35,1) ≈ easeInOutCubic */
const mech = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export interface PlateCtl {
  fig: HTMLElement;
  /** Plays the rebuild from the old site: 0 → 1, then back to .56, armed. */
  sweep(): Promise<void>;
  /** Jumps to .56 and arms (reduced motion). */
  rest(): void;
  destroy(): void;
}

type Start = 'auto' | 'hold';

export function initPlate(fig: HTMLElement, start: Start = 'auto'): PlateCtl | null {
  const screen = fig.querySelector<HTMLElement>('.cp-screen');
  const handle = fig.querySelector<HTMLElement>('.cp-handle');
  if (!screen || !handle) return null;
  fig.dataset.compareReady = '';
  const host = fig.closest<HTMLElement>('[data-x-host]') ?? fig;

  let x = start === 'hold' ? 0 : 1;
  let armed = false;
  let taken = false;
  let tweenId = 0;
  let dead = false;
  const timers: number[] = [];
  const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));

  const write = (v: number) => {
    x = clamp(v);
    host.style.setProperty('--x', x.toFixed(4));
    handle.setAttribute('aria-valuenow', String(Math.round(x * 100)));
  };

  const stopTween = () => {
    if (tweenId) cancelAnimationFrame(tweenId);
    tweenId = 0;
  };

  const tween = (to: number, ms: number, done?: () => void) => {
    stopTween();
    const from = x;
    const t0 = performance.now();
    const step = (now: number) => {
      if (dead) return;
      const t = Math.min(1, (now - t0) / ms);
      write(from + (to - from) * mech(t));
      if (t < 1) tweenId = requestAnimationFrame(step);
      else {
        tweenId = 0;
        done?.();
      }
    };
    tweenId = requestAnimationFrame(step);
  };

  const arm = () => {
    if (armed || dead) return;
    armed = true;
    handle.tabIndex = 0;
    fig.classList.add('is-armed');
    fig.dispatchEvent(new CustomEvent('plate:armed', { bubbles: true }));
  };

  /* the CSS animation hands over: pin --x inline, drop the animation */
  const takeOver = (value: number) => {
    if (taken) return;
    taken = true;
    write(value);
    fig.classList.add('is-live');
    host.classList.add('is-live');
  };

  const settle = () => {
    if (isReduced()) {
      takeOver(REST);
      arm();
      return;
    }
    takeOver(1);
    tween(REST, 500, arm);
  };

  const sweep = () =>
    new Promise<void>((resolve) => {
      takeOver(0);
      if (isReduced() || document.hidden) {
        write(REST);
        arm();
        resolve();
        return;
      }
      tween(1, 1100, () => later(() => tween(REST, 520, () => (arm(), resolve())), 140));
    });

  /* ---- start ---------------------------------------------------------- */
  let io: IntersectionObserver | null = null;
  if (start === 'hold') {
    takeOver(0);
  } else {
    const rect = fig.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const visible = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0)) / Math.max(1, rect.height);

    if (document.hidden) {
      takeOver(REST);
      arm();
    } else if (!isReduced() && visible < 0.35 && 'IntersectionObserver' in window) {
      // below the fold: keep the old site until the visitor gets there
      takeOver(0);
      io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          io?.disconnect();
          later(() => void sweep(), 160);
        },
        { threshold: 0.45 }
      );
      io.observe(fig);
      // never leave the plate on the old site: the hard deadline rebuilds it
      later(() => {
        if (armed || tweenId) return;
        io?.disconnect();
        write(REST);
        arm();
      }, 12000);
    } else {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        settle();
      };
      host.addEventListener('animationend', (e) => {
        if (e.target === host) finish();
      });
      // the CSS animation may already be over when this module runs
      const rebuild = host
        .getAnimations?.()
        .find((a) => /rebuild$/.test((a as CSSAnimation).animationName || ''));
      rebuild?.finished.then(finish, finish);
      // animation missing, cancelled or never started: take over anyway
      later(finish, rebuild ? 2600 : isReduced() ? 60 : 2300);
    }
  }

  /* ---- pointer ------------------------------------------------------------ */
  let dragging = false;
  let pending: { id: number; x0: number; y0: number; v0: number } | null = null;

  const fromClient = (clientX: number) => {
    const r = screen.getBoundingClientRect();
    return r.width ? (clientX - r.left) / r.width : x;
  };

  const startDrag = (id: number) => {
    dragging = true;
    stopTween();
    fig.classList.add('is-dragging');
    fig.dispatchEvent(new CustomEvent('plate:drag', { bubbles: true, detail: { active: true } }));
    try {
      screen.setPointerCapture(id);
    } catch {
      /* pointer already gone */
    }
  };

  screen.addEventListener('pointerdown', (e) => {
    if (!armed || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.pointerType === 'mouse') {
      e.preventDefault();
      startDrag(e.pointerId);
      write(fromClient(e.clientX));
      handle.focus({ preventScroll: true });
    } else {
      pending = { id: e.pointerId, x0: e.clientX, y0: e.clientY, v0: x };
    }
  });

  screen.addEventListener('pointermove', (e) => {
    if (dragging) {
      if (pending) {
        const w = screen.getBoundingClientRect().width || 1;
        write(pending.v0 + (e.clientX - pending.x0) / w);
      } else write(fromClient(e.clientX));
      return;
    }
    if (pending && e.pointerId === pending.id) {
      const dx = e.clientX - pending.x0;
      const dy = e.clientY - pending.y0;
      if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) startDrag(e.pointerId);
      else if (Math.abs(dy) > 10) pending = null;
    }
  });

  const end = () => {
    const was = dragging;
    dragging = false;
    pending = null;
    fig.classList.remove('is-dragging');
    if (was) fig.dispatchEvent(new CustomEvent('plate:drag', { bubbles: true, detail: { active: false } }));
  };
  screen.addEventListener('pointerup', end);
  screen.addEventListener('pointercancel', end);
  // Touch has implicit capture on the element under the finger; moving the
  // capture to the screen fires lostpointercapture on that child, which
  // bubbles here. Only the screen's own loss ends the drag.
  screen.addEventListener('lostpointercapture', (e) => {
    if (e.target === screen) end();
  });

  /* ---- keyboard ----------------------------------------------------------- */
  handle.addEventListener('keydown', (e) => {
    if (!armed) return;
    const steps: Record<string, number> = {
      ArrowLeft: -0.05,
      ArrowDown: -0.05,
      ArrowRight: 0.05,
      ArrowUp: 0.05,
      PageDown: -0.1,
      PageUp: 0.1,
    };
    let next: number | null = null;
    if (e.key in steps) next = x + steps[e.key];
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 1;
    if (next === null) return;
    e.preventDefault();
    stopTween();
    write(Math.round(next * 100) / 100);
  });

  /* ---- sheen: pause offscreen and in hidden tabs ------------------------- */
  let seen: IntersectionObserver | null = null;
  if ('IntersectionObserver' in window) {
    seen = new IntersectionObserver((entries) => {
      for (const e of entries) fig.classList.toggle('is-offscreen', !e.isIntersecting);
    });
    seen.observe(fig);
  }
  const onVisibility = () => fig.classList.toggle('is-paused', document.hidden);
  document.addEventListener('visibilitychange', onVisibility);
  onVisibility();

  return {
    fig,
    sweep,
    rest() {
      stopTween();
      takeOver(REST);
      write(REST);
      arm();
    },
    destroy() {
      dead = true;
      stopTween();
      timers.forEach((t) => window.clearTimeout(t));
      io?.disconnect();
      seen?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}

/* =========================================================================
   Showcase
   ========================================================================= */

function initShowcase(root: HTMLElement): void {
  const deck = root.querySelector<HTMLElement>('[data-deck]');
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"][data-concept]'));
  const firstCard = deck?.querySelector<HTMLElement>('[data-card]');
  const firstFig = firstCard?.querySelector<HTMLElement>('[data-compare]');
  if (!deck || !firstCard || !firstFig || tabs.length < 2) return;

  const order = tabs.map((t) => t.dataset.concept || '');
  const templates = new Map<string, HTMLTemplateElement>();
  root.querySelectorAll<HTMLTemplateElement>('template[data-card]').forEach((t) => templates.set(t.dataset.card || '', t));
  const ghosts = Array.from(root.querySelectorAll<HTMLElement>('[data-ghost]'));
  const capA = root.querySelector<HTMLElement>('[data-cap-a]');
  const capB = root.querySelector<HTMLElement>('[data-cap-b]');
  const capBox = root.querySelector<HTMLElement>('[data-cap]');

  let idx = Math.max(0, order.indexOf(firstCard.dataset.card || ''));
  let card = firstCard;
  let ctl = initPlate(firstFig, 'auto');
  let busy = false;
  let queued: number | null = null;
  let stopped = false;
  const hold = { hover: false, focus: false, drag: false, off: false, hidden: document.hidden, busy: false, wait: true };

  const syncHold = () => {
    const on = Object.values(hold).some(Boolean);
    root.classList.toggle('is-hold', on);
  };

  const setGhosts = () => {
    const n = order.length;
    ghosts.forEach((g) => {
      const k = order.indexOf(g.dataset.ghost || '');
      g.style.setProperty('--slot', String((k - idx + n) % n));
    });
  };

  const setTabs = () => {
    tabs.forEach((t, k) => {
      const on = k === idx;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      t.classList.toggle('is-current', on);
    });
    deck.setAttribute('aria-labelledby', tabs[idx].id);
  };

  /* restart the current tab's progress bar (a CSS animation) */
  const restartFill = () => {
    const fill = tabs[idx].querySelector<HTMLElement>('.hs-fill');
    if (!fill) return;
    fill.classList.remove('is-run');
    void fill.offsetWidth;
    if (!stopped) fill.classList.add('is-run');
  };

  const flipCaption = (a: string, b: string) => {
    if (!capA || !capB) return;
    if (isReduced() || !capBox?.animate) {
      capA.textContent = a;
      capB.textContent = b;
      return;
    }
    const out = capBox.animate(
      [
        { transform: 'none', opacity: 1 },
        { transform: 'translate3d(0,-40%,0) rotateX(80deg)', opacity: 0 },
      ],
      { duration: 280, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }
    );
    out.finished
      .then(() => {
        capA.textContent = a;
        capB.textContent = b;
        const back = capBox.animate(
          [
            { transform: 'translate3d(0,40%,0) rotateX(-80deg)', opacity: 0 },
            { transform: 'none', opacity: 1 },
          ],
          { duration: 620, easing: 'cubic-bezier(.16,1,.3,1)' }
        );
        out.cancel();
        return back.finished;
      })
      .catch(() => {
        capA.textContent = a;
        capB.textContent = b;
      });
  };

  const go = (to: number, dir: 1 | -1) => {
    if (to === idx) return;
    if (busy) {
      queued = to;
      return;
    }
    const tpl = templates.get(order[to]);
    const next = tpl?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
    const nextFig = next?.querySelector<HTMLElement>('[data-compare]');
    if (!next || !nextFig) return;

    busy = true;
    hold.busy = true;
    syncHold();
    tabs.forEach((t) => t.querySelector('.hs-fill')?.classList.remove('is-run'));

    const old = card;
    const oldCtl = ctl;
    old.setAttribute('aria-hidden', 'true');
    old.inert = true;
    old.classList.add('is-leaving');

    next.style.setProperty('--x', '0');
    next.classList.add('is-live', 'is-entering');
    deck.append(next);
    card = next;
    ctl = initPlate(nextFig, 'hold');
    idx = to;
    setTabs();
    setGhosts();
    flipCaption(next.dataset.capA || '', next.dataset.capB || '');

    const finish = () => {
      old.remove();
      oldCtl?.destroy();
      next.classList.remove('is-entering');
      busy = false;
      hold.busy = false;
      syncHold();
      restartFill();
      if (queued !== null) {
        const q = queued;
        queued = null;
        if (q !== idx) go(q, q > idx ? 1 : -1);
      }
    };

    if (isReduced() || !next.animate) {
      ctl?.rest();
      finish();
      return;
    }

    /* forward: the current card swings away toward the viewer and off to the
       right (never across the copy); back: it is tucked into the deck */
    const away = old.animate(
      dir > 0
        ? [
            { transform: 'none', opacity: 1 },
            { opacity: 1, offset: 0.5 },
            { transform: 'translate3d(58%, 16%, 220px) rotateY(-56deg) rotateZ(5deg)', opacity: 0 },
          ]
        : [
            { transform: 'none', opacity: 1 },
            { opacity: 1, offset: 0.4 },
            { transform: 'translate3d(6%, -12%, -260px) rotateX(8deg)', opacity: 0 },
          ],
      { duration: 900, easing: 'cubic-bezier(.55,0,.2,1)', fill: 'forwards' }
    );
    /* the next one comes forward off the deck (from the first ghost's slot) */
    const come = next.animate(
      [
        { transform: 'translate3d(3.5%, -6%, -110px) rotateY(-10deg)', opacity: 0 },
        { opacity: 1, offset: 0.3 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 1000, delay: 160, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }
    );
    away.finished.then(() => old.remove()).catch(() => old.remove());
    come.finished
      .catch(() => undefined)
      .then(() => (ctl ? ctl.sweep() : undefined))
      .then(finish, finish);
  };

  const pick = (k: number) => {
    if (!stopped) {
      stopped = true;
      root.classList.add('is-stopped');
      tabs.forEach((t) => t.querySelector('.hs-fill')?.classList.remove('is-run'));
    }
    go(k, k > idx ? 1 : -1);
  };

  tabs.forEach((t, k) => {
    t.addEventListener('click', () => pick(k));
    t.addEventListener('keydown', (e) => {
      const n = tabs.length;
      let k2: number | null = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') k2 = (k + 1) % n;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') k2 = (k - 1 + n) % n;
      else if (e.key === 'Home') k2 = 0;
      else if (e.key === 'End') k2 = n - 1;
      if (k2 === null) return;
      e.preventDefault();
      tabs[k2].focus();
      pick(k2);
    });
    /* the dwell ends → the deck advances */
    t.querySelector('.hs-fill')?.addEventListener('animationend', () => {
      if (stopped || k !== idx) return;
      go((idx + 1) % order.length, 1);
    });
  });

  /* ---- holds -------------------------------------------------------------- */
  root.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') (hold.hover = true), syncHold();
  });
  root.addEventListener('pointerleave', () => ((hold.hover = false), syncHold()));
  root.addEventListener('focusin', () => ((hold.focus = true), syncHold()));
  root.addEventListener('focusout', (e) => {
    if (!root.contains(e.relatedTarget as Node | null)) (hold.focus = false), syncHold();
  });
  root.addEventListener('plate:drag', (e) => {
    hold.drag = !!(e as CustomEvent<{ active: boolean }>).detail?.active;
    syncHold();
  });
  /* the first plate's rebuild must finish before the clock starts */
  root.addEventListener(
    'plate:armed',
    () => {
      if (!hold.wait) return;
      hold.wait = false;
      syncHold();
      restartFill();
    },
    { once: false }
  );
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        hold.off = !entries.some((e) => e.isIntersecting);
        syncHold();
      },
      { threshold: 0.25 }
    ).observe(deck);
  }
  document.addEventListener('visibilitychange', () => {
    hold.hidden = document.hidden;
    syncHold();
  });

  setGhosts();
  setTabs();
  syncHold();
  root.classList.add('is-ready');
}

/* =========================================================================
   Hero dive: the galaxy follows the same scroll progress as the DOM layers
   (motion.ts writes --hx on [data-hero-exit]); drive the cosmos' --dive
   with it so the camera move is one gesture.
   ========================================================================= */

function initDive(): void {
  const hero = document.querySelector<HTMLElement>('[data-hero-exit]');
  const sky = hero?.querySelector<HTMLElement>('[data-cosmos="galaxy"]');
  if (!hero || !sky) return;
  let p = 0;
  let last = -1;
  addFrame({
    read(y, vh) {
      p = vestibular() ? 0 : Math.min(1, Math.max(0, y / (vh * 0.85)));
    },
    write() {
      if (Math.abs(p - last) < 0.0005) return;
      last = p;
      sky.style.setProperty('--dive', p.toFixed(4));
    },
  });
}

function boot(): void {
  document.querySelectorAll<HTMLElement>('[data-showcase]').forEach((root) => {
    try {
      initShowcase(root);
    } catch {
      /* the first plate still renders fully rebuilt (--x: 1) */
    }
  });
  document.querySelectorAll<HTMLElement>('[data-compare]').forEach((fig) => {
    if (fig.hasAttribute('data-compare-ready')) return;
    try {
      initPlate(fig);
    } catch {
      /* the plate still renders fully rebuilt (--x: 1) */
    }
  });
  try {
    initDive();
  } catch {
    /* the galaxy dives by itself */
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
