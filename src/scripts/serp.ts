/* =========================================================================
   Vesta · #visibility sequencer (data-serp)

   Six checklist <button>s drive the search illustration through six states.
   - Starts once, when the panel is 35% in view: one item every 1100 ms.
   - Each item ticks first; the panel follows after a short lead (CSS
     transition-delay via --lead), so the tick reads as the cause.
   - Clicking an item jumps to that state and stops the run. Replay restarts.
   - Pauses while the whole section is offscreen and while the tab is hidden.
     (The section, not the panel: on phones the checklist sits under the
     panel and keeps ticking while it is read.)
   - Scrolled past (section fully above the viewport) before the run ended,
     or before it began: the remaining states complete instantly, so the
     section is never found half-played or empty on the way back up.

   Fail-open: the markup's default is the final state (every item ticked).
   Hidden states exist only under .is-armed, which only this file sets, so
   no JS, a thrown error, a failed engine or motion off all render complete.
   ========================================================================= */

import { isReduced } from './motion';

const STEPS = 6;
const STEP_MS = 1100;
/** Indicator fill (180 ms) + tick draw (300 ms), overlapped: then the panel moves. */
const LEAD_MS = 360;
/** Beat between the panel settling into view and the first tick. */
const FIRST_MS = 520;
/** Replay: let the panel rewind to empty before ticking again. */
const REWIND_MS = 900;
/** The run starts when this share of the panel is visible. */
const START_RATIO = 0.35;

const pad = (n: number): string => String(n).padStart(2, '0');

export function initSerp(): void {
  const root = document.querySelector<HTMLElement>('[data-serp-root]');
  const panel = root?.querySelector<HTMLElement>('[data-serp]');
  if (!root || !panel) return;

  const items = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-serp-item]'));
  if (!items.length) return;
  const replay = root.querySelector<HTMLButtonElement>('[data-serp-replay]');
  const counter = panel.querySelector<HTMLElement>('[data-serp-count]');
  const gaugeNum = panel.querySelector<HTMLElement>('[data-serp-num]');
  const gaugeTarget = Number(gaugeNum?.textContent?.trim() || 0);

  let shown = STEPS;
  let timer = 0;
  let due = 0;
  let left = 0;
  let started = false;
  let running = false;
  let inView = false;
  /** The visitor picked a state by hand: leave it exactly as chosen. */
  let picked = false;
  let countRaf = 0;

  /* ---- state ----------------------------------------------------------- */

  function countUp(delay: number): void {
    if (!gaugeNum || !gaugeTarget) return;
    cancelAnimationFrame(countRaf);
    const t0 = performance.now() + delay;
    const dur = 1000;
    gaugeNum.textContent = '0';
    const frame = (now: number): void => {
      const t = Math.min(1, Math.max(0, (now - t0) / dur));
      const eased = 1 - Math.pow(1 - t, 4);
      gaugeNum.textContent = String(Math.round(gaugeTarget * eased));
      if (t < 1) countRaf = requestAnimationFrame(frame);
    };
    countRaf = requestAnimationFrame(frame);
  }

  function resetCount(): void {
    cancelAnimationFrame(countRaf);
    if (gaugeNum && gaugeTarget) gaugeNum.textContent = String(gaugeTarget);
  }

  function go(k: number, lead: number, instant = false): void {
    const prev = shown;
    shown = k;

    if (instant) root!.classList.add('is-instant');

    items.forEach((btn) => {
      const n = Number(btn.dataset.serpItem);
      btn.classList.toggle('is-todo', n > k);
      if (n === k) btn.setAttribute('aria-current', 'step');
      else btn.removeAttribute('aria-current');
    });

    panel!.style.setProperty('--lead', `${lead}ms`);
    panel!.style.setProperty('--k', String(k));
    for (let s = 1; s <= STEPS; s++) panel!.classList.toggle(`s${s}`, s <= k);
    if (counter) counter.textContent = `${pad(k)}/${pad(STEPS)}`;

    if (k >= 5 && prev < 5 && !isReduced() && !instant) countUp(lead + 120);
    else if (k < 5 || isReduced() || instant) resetCount();

    if (instant) {
      void panel!.offsetWidth;
      root!.classList.remove('is-instant');
    }
  }

  /* ---- the run --------------------------------------------------------- */

  function schedule(ms: number): void {
    window.clearTimeout(timer);
    due = performance.now() + ms;
    timer = window.setTimeout(step, ms);
  }

  function step(): void {
    timer = 0;
    const next = shown + 1;
    if (next > STEPS) {
      running = false;
      return;
    }
    go(next, LEAD_MS);
    if (next < STEPS) schedule(STEP_MS);
    else running = false;
  }

  function pause(): void {
    if (!running || !timer) return;
    window.clearTimeout(timer);
    timer = 0;
    left = Math.max(0, due - performance.now());
  }

  function resume(): void {
    if (!running || timer || document.hidden || !inView) return;
    schedule(left || STEP_MS);
  }

  function stop(): void {
    running = false;
    window.clearTimeout(timer);
    timer = 0;
  }

  function run(from: number, delay: number): void {
    stop();
    started = true;
    running = true;
    picked = false;
    if (shown !== from) go(from, 0);
    left = delay;
    resume();
  }

  /** Complete the remaining states at once (offscreen, so nothing to watch). */
  function finish(): void {
    stop();
    started = true;
    if (shown !== STEPS) go(STEPS, 0, true);
  }

  /* ---- controls -------------------------------------------------------- */

  items.forEach((btn) => {
    btn.addEventListener('click', () => {
      stop();
      started = true;
      picked = true;
      go(Number(btn.dataset.serpItem), 0);
    });
  });

  function syncReplay(): void {
    if (replay) replay.hidden = isReduced();
  }

  replay?.addEventListener('click', () => {
    if (isReduced()) return;
    // Replay sits under the checklist, so the panel is often half out of
    // view (above the fold on phones): bring it back first. The rewind
    // beat (REWIND_MS) covers the scroll.
    const r = panel.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const seen = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    if (seen < Math.min(r.height, vh) * 0.6) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    run(0, shown !== 0 ? REWIND_MS : FIRST_MS);
  });

  document.addEventListener('vesta:motion', () => {
    syncReplay();
    if (isReduced()) {
      stop();
      started = true;
      go(STEPS, 0, true);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else resume();
  });

  if ('IntersectionObserver' in window) {
    // Start: 35% of the panel in view, or half the viewport when the panel is
    // taller than the screen can show at 35%.
    const startIo = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (started || isReduced() || !e.isIntersecting) continue;
          const need = Math.min(START_RATIO * e.boundingClientRect.height, 0.5 * (window.innerHeight || 1));
          if (e.intersectionRect.height < need) continue;
          inView = true;
          run(0, FIRST_MS);
          startIo.disconnect();
        }
      },
      { threshold: [0, 0.1, 0.2, START_RATIO, 0.5] }
    );
    startIo.observe(panel);

    // Pause / resume / finish: the whole section.
    const viewIo = new IntersectionObserver((entries) => {
      for (const e of entries) {
        inView = e.isIntersecting;
        if (inView) resume();
        else if (!picked && shown !== STEPS && e.boundingClientRect.bottom <= 0) finish();
        else pause();
      }
    });
    viewIo.observe(root);
  }

  /* ---- arm ------------------------------------------------------------- */
  // Jump to the start state without playing the rewind, then hand the
  // transitions back.
  root.classList.add('is-armed');
  panel.classList.add('is-armed');
  if (isReduced() || !('IntersectionObserver' in window)) {
    started = true;
    go(STEPS, 0, true);
  } else {
    go(0, 0, true);
  }
  syncReplay();
}

export function bootSerp(): void {
  try {
    initSerp();
  } catch (err) {
    // Never leave the illustration in a half-armed, hidden state.
    document.querySelectorAll('[data-serp-root], [data-serp]').forEach((el) => el.classList.remove('is-armed'));
    console.warn('[serp] sequencer disabled; showing the final state.', err);
  }
}
