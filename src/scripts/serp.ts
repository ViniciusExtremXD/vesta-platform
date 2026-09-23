/* =========================================================================
   Vesta · #visibility sequencer (data-serp)

   Six checklist <button>s drive the search illustration through six states.
   - Starts once, when the panel is 35% in view: the query types itself
     (.q-on), the neighbouring results load, then one item every STEP_MS.
   - Each item ticks first; the panel follows after a short lead (CSS
     transition-delay via --lead), so the tick reads as the cause. The row
     that is playing opens its one-line explanation (aria-current) and its
     bottom hairline fills as a timer until the next item ticks.
   - Clicking an item jumps to that state and stops the run. Replay restarts.
   - Pauses while the whole section is offscreen and while the tab is hidden.
     (The section, not the panel: on phones the checklist sits under the
     panel and keeps ticking while it is read.) The panel's own loops (caret,
     orbit) rest whenever the panel is offscreen (.is-vis).
   - Scrolled past (section fully above the viewport) before the run ended,
     or before it began: the remaining states complete instantly, so the
     section is never found half-played or empty on the way back up.

   Fail-open: the markup's default is the final state (every item ticked).
   Hidden states exist only under .is-armed, which only this file sets, so
   no JS, a thrown error, a failed engine or motion off all render complete.
   ========================================================================= */

import { isReduced, travelTo } from './motion';

const STEPS = 6;
/** Time each item holds the stage: long enough to read its explanation. */
const STEP_MS = 1900;
/** Indicator fill + tick draw, overlapped: then the panel moves. */
const LEAD_MS = 360;
/** Per typed character (mirrors the CSS: --qn × 52ms). */
const CHAR_MS = 52;
/** After typing: the neighbouring results load, then the first item ticks. */
const AFTER_TYPE_MS = 900;
/** Beat between the panel settling into view and the typing. */
const FIRST_MS = 420;
/** Replay: let the panel rewind to empty before typing again. */
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
  const qn = Number(getComputedStyle(panel).getPropertyValue('--qn')) || 18;
  const TYPE_MS = qn * CHAR_MS;

  let shown = STEPS;
  let typed = true;
  let timer = 0;
  let due = 0;
  let left = 0;
  let started = false;
  let running = false;
  let inView = false;
  /** The visitor picked a state by hand: leave it exactly as chosen. */
  let picked = false;
  let countRaf = 0;

  root.style.setProperty('--step', `${STEP_MS}ms`);

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

  function setTyped(on: boolean): void {
    typed = on;
    panel!.classList.toggle('q-on', on);
  }

  /** The playing row's bottom hairline fills over one step. */
  function setTiming(k: number | null): void {
    items.forEach((btn) => btn.classList.remove('is-timing'));
    if (k === null || isReduced()) return;
    const btn = items.find((b) => Number(b.dataset.serpItem) === k);
    if (!btn) return;
    void btn.offsetWidth;
    btn.classList.add('is-timing');
  }

  function go(k: number, lead: number, instant = false): void {
    const prev = shown;
    shown = k;

    if (instant) root!.classList.add('is-instant');

    setTyped(k > 0);
    items.forEach((btn) => {
      const n = Number(btn.dataset.serpItem);
      btn.classList.toggle('is-todo', n > k);
      if (n === k) btn.setAttribute('aria-current', 'step');
      else btn.removeAttribute('aria-current');
    });

    panel!.style.setProperty('--lead', `${lead}ms`);
    panel!.style.setProperty('--k', String(k));
    for (let s = 1; s <= STEPS; s++) panel!.classList.toggle(`s${s}`, s <= k);
    if (counter) {
      const text = `${pad(k)}/${pad(STEPS)}`;
      if (counter.textContent !== text) {
        counter.textContent = text;
        counter.classList.remove('is-flip');
        if (!instant && !isReduced()) {
          void counter.offsetWidth;
          counter.classList.add('is-flip');
        }
      }
    }

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
    if (!typed) {
      setTyped(true);
      schedule(TYPE_MS + AFTER_TYPE_MS);
      return;
    }
    const next = shown + 1;
    if (next > STEPS) {
      running = false;
      setTiming(null);
      return;
    }
    go(next, LEAD_MS);
    if (next < STEPS) {
      setTiming(next);
      schedule(STEP_MS);
    } else {
      setTiming(null);
      running = false;
    }
  }

  function pause(): void {
    if (!running || !timer) return;
    window.clearTimeout(timer);
    timer = 0;
    left = Math.max(0, due - performance.now());
    setTiming(null);
  }

  function resume(): void {
    if (!running || timer || document.hidden || !inView) return;
    // a resumed step restarts its timer bar for the time that is left
    if (typed && shown > 0 && shown < STEPS) {
      root!.style.setProperty('--step', `${Math.round(left || STEP_MS)}ms`);
      setTiming(shown);
    }
    schedule(left || STEP_MS);
  }

  function stop(): void {
    running = false;
    window.clearTimeout(timer);
    timer = 0;
    setTiming(null);
    root!.style.setProperty('--step', `${STEP_MS}ms`);
  }

  function run(delay: number): void {
    stop();
    started = true;
    running = true;
    picked = false;
    if (shown !== 0) go(0, 0);
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
    // beat (REWIND_MS) covers the travel.
    const r = panel.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const seen = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    if (seen < Math.min(r.height, vh) * 0.6) travelTo(panel);
    run(shown !== 0 ? REWIND_MS : FIRST_MS);
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
          run(FIRST_MS);
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

    // The panel's loops (caret, orbiting planet) run only while it is seen.
    new IntersectionObserver((entries) => {
      for (const e of entries) panel.classList.toggle('is-vis', e.isIntersecting);
    }).observe(panel);
  } else {
    panel.classList.add('is-vis');
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
    document.querySelectorAll('[data-serp-root], [data-serp]').forEach((el) => el.classList.remove('is-armed', 'q-on'));
    console.warn('[serp] sequencer disabled; showing the final state.', err);
  }
}
