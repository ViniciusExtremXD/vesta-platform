/* =========================================================================
   The Rebuild Line (§6.1) — takes over the hero plate's --x after the CSS
   load animation (0 → 1), eases it back to .56 and arms the handle.

   --x: 0 = the old site, 1 = rebuilt. The rebuilt site covers [0, x] from
   the left; the blade and the handle sit at x.

   - CSS plays the rebuild on load; this file never gates first paint.
   - On animationend (or at once under motion-off) tween 1 → .56, then arm.
   - Hidden tab at load: jump straight to .56.
   - Plate mostly below the fold at load (phones): hold the old site and play
     the rebuild when it scrolls into view.
   - Pointer: mouse drags from anywhere on the screen; touch drags only after
     a horizontal intent, so vertical page scrolling is never trapped.
   - Keys on the slider: ←/↓ −5, →/↑ +5, PageDown/PageUp ∓10, Home 0, End 100.
   - The idle sheen pauses offscreen and in hidden tabs.
   ========================================================================= */

import { isReduced } from './motion';

const REST = 0.56;
const clamp = (v: number) => Math.min(1, Math.max(0, v));
/* --ease-mech, cubic-bezier(.65,0,.35,1) ≈ easeInOutCubic */
const mech = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function initPlate(fig: HTMLElement): void {
  const screen = fig.querySelector<HTMLElement>('.cp-screen');
  const handle = fig.querySelector<HTMLElement>('.cp-handle');
  if (!screen || !handle) return;

  let x = 1;
  let armed = false;
  let taken = false;
  let tweenId = 0;

  const write = (v: number) => {
    x = clamp(v);
    fig.style.setProperty('--x', x.toFixed(4));
    handle.setAttribute('aria-valuenow', String(Math.round(x * 100)));
  };

  const stopTween = () => {
    if (tweenId) cancelAnimationFrame(tweenId);
    tweenId = 0;
  };

  const tween = (to: number, ms: number, done?: () => void) => {
    stopTween();
    const from = x;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
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
    if (armed) return;
    armed = true;
    handle.tabIndex = 0;
    fig.classList.add('is-armed');
  };

  /* the CSS animation hands over: pin --x inline, drop the animation */
  const takeOver = (value: number) => {
    if (taken) return;
    taken = true;
    write(value);
    fig.classList.add('is-live');
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

  /* ---- start ---------------------------------------------------------- */
  const rect = fig.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const visible = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0)) / Math.max(1, rect.height);

  if (document.hidden) {
    takeOver(REST);
    arm();
  } else if (!isReduced() && visible < 0.35 && 'IntersectionObserver' in window) {
    // below the fold: keep the old site until the visitor gets there
    takeOver(0);
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        window.setTimeout(() => tween(1, 1300, () => window.setTimeout(() => tween(REST, 500, arm), 120)), 160);
      },
      { threshold: 0.45 }
    );
    io.observe(fig);
    // never leave the plate on the old site: the hard deadline rebuilds it
    window.setTimeout(() => {
      if (armed || tweenId) return;
      io.disconnect();
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
    fig.addEventListener('animationend', (e) => {
      if (e.target === fig) finish();
    });
    // the CSS animation may already be over when this module runs
    const rebuild = fig
      .getAnimations?.()
      .find((a) => (a as CSSAnimation).animationName === 'cp-rebuild');
    rebuild?.finished.then(finish, finish);
    // animation missing, cancelled or never started: take over anyway
    window.setTimeout(finish, rebuild ? 2600 : isReduced() ? 60 : 2300);
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
    dragging = false;
    pending = null;
    fig.classList.remove('is-dragging');
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
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      for (const e of entries) fig.classList.toggle('is-offscreen', !e.isIntersecting);
    }).observe(fig);
  }
  const onVisibility = () => fig.classList.toggle('is-paused', document.hidden);
  document.addEventListener('visibilitychange', onVisibility);
  onVisibility();
}

function boot(): void {
  document.querySelectorAll<HTMLElement>('[data-compare]').forEach((fig) => {
    try {
      initPlate(fig);
    } catch {
      /* the plate still renders fully rebuilt (--x: 1) */
    }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
