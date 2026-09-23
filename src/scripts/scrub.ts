/* =========================================================================
   Vesta — "Take one apart" (SPEC §6.3)
   Scroll progress through the Build track drives the exploded view of the
   concept on the stage. Registered into the ONE shared rAF loop
   (motion.ts); an IntersectionObserver (rootMargin 100%) gates the work,
   so offscreen the handler returns before touching layout.

   Per frame
     read   track rect, stage rect, six right-hand layer corners (the part
            numbers) + on desktop six left-hand corners and six legend rows
            (the leader lines)
     write  --e1 / --spread on .b-assembly, --lift on each .cp-layer, the
            camera orbit --orb / --el on the section (CSS turns all of it
            into transforms), .is-active on the legend row, the rail and the
            counter digit, six part-number positions, six leader paths, .is-in
            on the final line.

   Round 4
     · the niche switcher (.b-pick): Concept 01 is live in the DOM, the
       other four wait in <template data-plate>; a pick clones one on first
       use (then keeps it), swaps it onto the stage, re-binds the six layers
       and docks them in. Instant and interruptible: a second pick mid-dock
       cancels the first. ←/→ (and Home/End) move along the five.
     · every layer is a button (legend rows, the phone/tablet rail): live,
       it travels the page to the point in the track where that layer is
       the lifted one — the highlight, counter and leader follow the scroll
       on the way; static, it lights that layer's plane.

   Static mode (.build--static, or html.motion-reduced / motion-failed /
   no JS) is pure CSS: exploded, every callout listed. This script only
   stops writing and clears what it wrote.
   ========================================================================= */

import { addFrame, requestFrame, isReduced, vestibular, travelTo } from './motion';

const N = 6;
const DESKTOP = 1100;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/* the scrub map. Layer i lifts over p ∈ [L0 + i·STEP, L0 + i·STEP + SPAN]
   and is the one being read once its lift passes 0.5; past DONE the stack
   docks again. */
const L0 = 0.15;
const STEP = 0.07;
const SPAN = 0.25;
const DONE = 0.88;
/* where to park the scroll to read layer i: its lift ≈ 0.8 while the next
   one is still under 0.5; the last one fully up, well before DONE */
const parkAt = (i: number): number => (i < N - 1 ? L0 + i * STEP + SPAN * 0.72 : 0.76);

export function initScrub(): void {
  const root = document.querySelector<HTMLElement>('[data-scrub]');
  if (!root) return;
  const track = root.querySelector<HTMLElement>('.b-track');
  const stage = root.querySelector<HTMLElement>('.b-stage');
  const view = root.querySelector<HTMLElement>('.b-view');
  const assembly = root.querySelector<HTMLElement>('.b-assembly');
  const svg = root.querySelector<SVGSVGElement>('.b-leaders');
  const digit = root.querySelector<HTMLElement>('[data-count-n]');
  const final = root.querySelector<HTMLElement>('.b-final');
  if (!track || !stage || !assembly) return;

  const rows = Array.from(root.querySelectorAll<HTMLElement>('.b-co'));
  const texts = Array.from(root.querySelectorAll<HTMLElement>('.b-co-text'));
  const steps = Array.from(root.querySelectorAll<HTMLElement>('.b-step'));
  const tags = Array.from(root.querySelectorAll<HTMLElement>('.b-tag'));
  const paths = svg ? Array.from(svg.querySelectorAll<SVGPathElement>('.b-ld')) : [];
  const terms = svg ? Array.from(svg.querySelectorAll<SVGRectElement>('.b-term')) : [];
  const axis = svg?.querySelector<SVGPathElement>('.b-axis') ?? null;

  /* ---- the plate on the stage, and its six layers ------------------------
     two 1px probes per layer. Top-left: with the stage's rotateZ (−20° to
     −52° through the orbit) that corner is the layer's leftmost vertex, so
     the six stack into one column — where the leaders start. Bottom-right:
     the rightmost vertex — where the part numbers hang. A plate keeps its
     probes when it leaves the stage, so a second visit re-uses them. */
  const probe = (layer: HTMLElement, css: string, kind: string): HTMLElement => {
    const got = layer.querySelector<HTMLElement>(`:scope > i[data-probe="${kind}"]`);
    if (got) return got;
    const a = document.createElement('i');
    a.setAttribute('aria-hidden', 'true');
    a.dataset.probe = kind;
    a.style.cssText = `position:absolute;${css};width:1px;height:1px;pointer-events:none;`;
    layer.appendChild(a);
    return a;
  };

  let plate = assembly.querySelector<HTMLElement>('.cp');
  if (!plate) return;
  let layers: HTMLElement[] = [];
  let anchors: HTMLElement[] = [];
  let corners: HTMLElement[] = [];

  const bind = (fig: HTMLElement): boolean => {
    const ls: HTMLElement[] = [];
    for (let i = 0; i < N; i++) {
      const el = fig.querySelector<HTMLElement>(`.cp-l${i + 1}`);
      if (!el) return false;
      ls.push(el);
    }
    layers = ls;
    anchors = ls.map((l) => probe(l, 'left:0;top:0', 'a'));
    corners = ls.map((l) => probe(l, 'right:0;bottom:0', 'c'));
    return true;
  };
  if (!bind(plate)) return;

  const html = document.documentElement;
  const isStatic = () => root.classList.contains('build--static') || html.classList.contains('motion-failed') || vestibular();

  /* ---- state ------------------------------------------------------------ */
  let near = false;
  let live = false;
  let p = -1;
  let lastP = -2;
  let desk = false;
  let active = -1;
  let done = false;
  let shown = 1;
  let picked = -1;
  let vbW = 0;
  let vbH = 0;
  const lifts = new Array<number>(N).fill(0);
  const ax = new Array<number>(N).fill(0);
  const ay = new Array<number>(N).fill(0);
  const cx = new Array<number>(N).fill(0);
  const cy = new Array<number>(N).fill(0);
  const tx = new Array<number>(N).fill(0);
  const ty = new Array<number>(N).fill(0);
  let dirtyGeo = true;

  /* static: which layer's plane is lit (a legend click) */
  const applyPicked = (): void => {
    if (live) return;
    layers.forEach((l, i) => l.classList.toggle('is-on', i === picked));
    rows.forEach((r, i) => r.classList.toggle('is-picked', i === picked));
  };

  const setLive = (on: boolean) => {
    if (live === on) return;
    live = on;
    root.classList.toggle('is-live', on);
    /* the visual legend hides inactive text; screen readers get the full
       list (.b-sr) while live. The row buttons stay reachable. */
    texts.forEach((t) => (on ? t.setAttribute('aria-hidden', 'true') : t.removeAttribute('aria-hidden')));
    rows.forEach((r) => r.classList.remove('is-picked'));
    if (!on) {
      assembly.style.removeProperty('--e1');
      assembly.style.removeProperty('--spread');
      root.style.removeProperty('--orb');
      root.style.removeProperty('--el');
      root.style.removeProperty('--ptx');
      root.style.removeProperty('--pty');
      tags.forEach((t) => t.classList.remove('is-up', 'is-on'));
      layers.forEach((l) => {
        l.style.removeProperty('--lift');
        l.classList.remove('is-on');
      });
      rows.forEach((r) => r.classList.remove('is-active'));
      steps.forEach((s) => {
        s.classList.remove('is-on', 'is-past');
        s.removeAttribute('aria-current');
      });
      paths.forEach((pa) => pa.classList.remove('is-on'));
      terms.forEach((t) => t.classList.remove('is-on'));
      root.classList.remove('is-open', 'is-scrubbing', 'is-done');
      final?.classList.remove('is-in');
      lastP = -2;
      active = -1;
      done = false;
      picked = -1;
    } else {
      layers.forEach((l) => l.classList.remove('is-on'));
      active = -9;
    }
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) near = e.isIntersecting;
      root.classList.toggle('is-near', near);
      requestFrame();
    },
    { rootMargin: '100% 0px' }
  );
  io.observe(track);

  /* iOS: the URL bar resizes the viewport on scroll. Re-measure geometry
     only when the width changes or the height moves by more than 15%. */
  let rw = window.innerWidth;
  let rh = window.innerHeight;
  window.addEventListener(
    'resize',
    () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w !== rw || Math.abs(h - rh) / (rh || 1) > 0.15) {
        rw = w;
        rh = h;
        dirtyGeo = true;
        lastP = -2;
      }
    },
    { passive: true }
  );
  document.fonts?.ready.then(() => {
    dirtyGeo = true;
    lastP = -2;
    requestFrame();
  });
  document.addEventListener('vesta:motion', () => {
    lastP = -2;
    requestFrame();
  });

  /* the stack leans toward a fine pointer: eased in its own short rAF
     burst, which stops once settled; each step asks the shared loop for a
     frame so the part numbers and leaders follow */
  if (window.matchMedia?.('(pointer: fine)')?.matches) {
    let gx = 0;
    let gy = 0;
    let vx = 0;
    let vy = 0;
    let raf = 0;
    const tick = (): void => {
      vx += (gx - vx) * 0.07;
      vy += (gy - vy) * 0.07;
      const still = Math.abs(gx - vx) < 0.001 && Math.abs(gy - vy) < 0.001;
      if (still) {
        vx = gx;
        vy = gy;
      }
      root.style.setProperty('--ptx', vx.toFixed(4));
      root.style.setProperty('--pty', vy.toFixed(4));
      requestFrame();
      raf = still ? 0 : requestAnimationFrame(tick);
    };
    const aim = (x: number, y: number): void => {
      gx = x;
      gy = y;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    stage.addEventListener('pointermove', (e) => {
      if (!live || isReduced()) return;
      const r = stage.getBoundingClientRect();
      aim(clamp01((e.clientX - r.left) / (r.width || 1)) - 0.5, clamp01((e.clientY - r.top) / (r.height || 1)) - 0.5);
    });
    stage.addEventListener('pointerleave', () => aim(0, 0));
  }

  /* ---- layer buttons ------------------------------------------------------ */
  /* Lenis (fine pointers) re-targets a running scroll cleanly, so travelTo
     is used there. Without it, travelTo's fallback tween can't be
     interrupted (two rapid clicks fight), so the native smooth scroll —
     which a newer call replaces — carries the page instead. */
  const scrollToY = (y: number): void => {
    const top = Math.max(0, Math.round(y));
    if (isReduced() || html.classList.contains('lenis')) travelTo(top);
    else window.scrollTo({ top, behavior: 'smooth' });
  };

  const goLayer = (i: number): void => {
    if (i < 0 || i >= N) return;
    if (live) {
      const r = track.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      if (span <= 0) return;
      scrollToY(window.scrollY + r.top + parkAt(i) * span);
      return;
    }
    picked = i;
    applyPicked();
    /* static: bring the plate into view when it's off screen */
    const v = (view ?? assembly).getBoundingClientRect();
    if (v.bottom < 0 || v.top > window.innerHeight) travelTo(view ?? assembly);
  };

  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-layer]');
    if (!b || !root.contains(b)) return;
    goLayer(Number(b.dataset.layer));
  });

  /* ---- the niche switcher ------------------------------------------------- */
  const picks = Array.from(root.querySelectorAll<HTMLButtonElement>('.b-pick-b'));
  const dots = Array.from(root.querySelectorAll<HTMLElement>('.b-pick-dot'));
  const nowN = root.querySelector<HTMLElement>('.b-pick-now-n');
  const nowT = root.querySelector<HTMLElement>('.b-pick-now-t');
  const cap = root.querySelector<HTMLElement>('[data-b-cap]');
  const plates = new Map<string, HTMLElement>();
  let current = plate.dataset.concept ?? picks[0]?.dataset.concept ?? '';
  plates.set(current, plate);
  let docking: Animation[] = [];

  const plateFor = (id: string): HTMLElement | null => {
    const got = plates.get(id);
    if (got) return got;
    const tpl = root.querySelector<HTMLTemplateElement>(`template[data-plate="${id}"]`);
    const fig = tpl?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
    if (!fig) return null;
    plates.set(id, fig);
    return fig;
  };

  /* the new stack docks in: each layer rises out of the plane below it,
     bottom first. Opacity + the individual `translate` property, so the
     scrub's transform on each layer is left alone. */
  const dock = (): void => {
    docking.forEach((a) => a.cancel());
    docking = [];
    if (isReduced() || typeof layers[0]?.animate !== 'function') return;
    layers.forEach((l, i) => {
      docking.push(
        l.animate(
          [
            { opacity: 0, translate: '0 0 -160px' },
            { opacity: 1, translate: '0 0 0' },
          ],
          { duration: 820, delay: i * 60, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }
        )
      );
    });
    /* the part numbers and leaders ride the docking layers: ask the shared
       loop for a frame until the last one has landed */
    const mine = docking;
    const follow = (): void => {
      if (mine !== docking) return;
      requestFrame();
      if (mine.some((a) => a.pending || a.playState === 'running')) requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);
  };

  const choose = (k: number, focus = false): void => {
    const b = picks[k];
    const id = b?.dataset.concept;
    if (!b || !id) return;
    picks.forEach((x, i) => {
      const on = i === k;
      x.classList.toggle('is-on', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
      x.tabIndex = on ? 0 : -1;
    });
    dots.forEach((d, i) => d.classList.toggle('is-on', i === k));
    if (focus) b.focus();
    if (id === current) return;

    const next = plateFor(id);
    if (!next || !plate) return;
    const old = plate;
    old.replaceWith(next);
    if (!bind(next)) {
      /* a drawing without its six layers: put the old one back */
      next.replaceWith(old);
      bind(old);
      return;
    }
    plate = next;
    current = id;

    if (nowN) nowN.textContent = b.dataset.num ?? '';
    if (nowT) {
      nowT.textContent = b.dataset.name ?? '';
      nowT.classList.remove('is-flip');
      if (!isReduced()) {
        void nowT.offsetWidth;
        nowT.classList.add('is-flip');
      }
    }
    if (cap && b.dataset.caption) cap.textContent = b.dataset.caption;

    /* the incoming stack takes the current lifts at once, then the frame
       loop re-measures probes, tags and leaders */
    if (live) {
      for (let i = 0; i < N; i++) layers[i].style.setProperty('--lift', lifts[i].toFixed(4));
      layers.forEach((l) => l.classList.remove('is-on'));
      active = -9;
    } else {
      applyPicked();
    }
    dirtyGeo = true;
    lastP = -2;
    dock();
    requestFrame();
  };

  const at = (): number => Math.max(0, picks.findIndex((x) => x.classList.contains('is-on')));

  picks.forEach((b, k) => {
    b.addEventListener('click', () => choose(k));
    b.addEventListener('keydown', (e) => {
      const n = picks.length;
      let to = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = (k + 1) % n;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = (k - 1 + n) % n;
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = n - 1;
      if (to < 0) return;
      e.preventDefault();
      choose(to, true);
    });
  });

  root.querySelectorAll<HTMLElement>('.b-pick-arr').forEach((a) => {
    a.addEventListener('click', () => {
      const n = picks.length;
      if (!n) return;
      choose((at() + Number(a.dataset.step || 1) + n) % n);
    });
  });

  let skip = true;

  addFrame({
    read(_y, vh, vw) {
      skip = true;
      if (isStatic()) {
        if (live) setLive(false);
        return;
      }
      if (!near) return;
      const r = track.getBoundingClientRect();
      const span = r.height - vh;
      p = span > 0 ? clamp01(-r.top / span) : 0;
      desk = vw >= DESKTOP;
      const s = stage.getBoundingClientRect();
      /* part numbers: every width */
      for (let i = 0; i < N; i++) {
        const c = corners[i].getBoundingClientRect();
        tx[i] = c.left - s.left;
        ty[i] = c.top - s.top;
      }
      if (desk && svg) {
        if (dirtyGeo || Math.abs(s.width - vbW) > 0.5 || Math.abs(s.height - vbH) > 0.5) {
          vbW = s.width;
          vbH = s.height;
          svg.setAttribute('viewBox', `0 0 ${Math.round(vbW)} ${Math.round(vbH)}`);
          dirtyGeo = false;
        }
        for (let i = 0; i < N; i++) {
          const a = anchors[i].getBoundingClientRect();
          ax[i] = a.left - s.left;
          ay[i] = a.top - s.top;
          const row = rows[i];
          if (row) {
            const c = row.getBoundingClientRect();
            /* the legend sits left of the plate: land on the row's end */
            cx[i] = c.right - s.left + 14;
            cy[i] = c.top - s.top + c.height / 2;
          }
        }
      }
      /* the probes were read before this frame's write: always write, so
         tags and leaders come to rest on the plate (see requestFrame below) */
      skip = false;
    },

    write() {
      if (skip) return;
      if (!live) setLive(true);
      const moved = Math.abs(p - lastP) >= 1e-5;
      lastP = p;

      const out = 1 - smooth((p - DONE) / 0.12);
      const e1 = smooth(p / L0) * out;
      let top = -1;
      let sum = 0;
      for (let i = 0; i < N; i++) {
        lifts[i] = smooth((p - L0 - i * STEP) / SPAN) * out;
        sum += i * lifts[i];
        if (lifts[i] > 0.5) top = i;
      }
      /* centroid of the open stack, 0 (flat) → 1 (every layer up) */
      const spread = sum / ((N * (N - 1)) / 2);
      /* the camera orbit runs the whole scrub; elevation peaks mid-way */
      const t = clamp01((p - 0.04) / 0.86);
      const orb = smooth(t) * 2 - 1;
      const el = Math.sin(Math.PI * t);

      if (moved) {
        assembly.style.setProperty('--e1', e1.toFixed(4));
        assembly.style.setProperty('--spread', spread.toFixed(4));
        root.style.setProperty('--orb', orb.toFixed(4));
        root.style.setProperty('--el', el.toFixed(4));
        for (let i = 0; i < N; i++) layers[i].style.setProperty('--lift', lifts[i].toFixed(4));
        /* the probes were measured before this write: one more frame
           re-reads them so tags and leaders rest exactly on the plate */
        requestFrame();
      }

      for (let i = 0; i < N; i++) {
        const tag = tags[i];
        if (!tag) continue;
        tag.style.transform = `translate3d(${tx[i].toFixed(1)}px, ${ty[i].toFixed(1)}px, 0)`;
        tag.classList.toggle('is-up', lifts[i] > 0.62 && e1 > 0.5);
      }

      const isDone = p > DONE;
      const nextActive = isDone ? -1 : Math.max(top, 0);
      root.classList.toggle('is-scrubbing', p > 0.015);
      root.classList.toggle('is-open', e1 > 0.35);

      if (isDone !== done) {
        done = isDone;
        root.classList.toggle('is-done', done);
        final?.classList.toggle('is-in', done);
      }

      if (nextActive !== active) {
        active = nextActive;
        rows.forEach((r, i) => r.classList.toggle('is-active', i === active));
        layers.forEach((l, i) => l.classList.toggle('is-on', i === active));
        paths.forEach((pa, i) => pa.classList.toggle('is-on', i === active));
        terms.forEach((t, i) => t.classList.toggle('is-on', i === active));
        tags.forEach((t, i) => t.classList.toggle('is-on', i === active));
        const reached = done ? N : active;
        steps.forEach((s, i) => {
          s.classList.toggle('is-on', i === active);
          s.classList.toggle('is-past', i < reached && i !== active);
          if (i === active) s.setAttribute('aria-current', 'step');
          else s.removeAttribute('aria-current');
        });
      }

      const n = done ? N : Math.max(active, 0) + 1;
      if (digit && n !== shown) {
        shown = n;
        digit.textContent = String(n);
        if (!isReduced() && typeof digit.animate === 'function') {
          digit.animate(
            [
              { transform: 'translate3d(0, 55%, 0)', opacity: 0 },
              { transform: 'none', opacity: 1 },
            ],
            { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' }
          );
        }
      }

      if (desk && paths.length) {
        /* the assembly axis: a dashed line through the six corners, the
           drafting convention of an exploded view */
        if (axis) {
          let d = '';
          for (let i = 0; i < N; i++) d += `${i ? 'L' : 'M'}${ax[i].toFixed(1)} ${ay[i].toFixed(1)}`;
          axis.setAttribute('d', d);
        }
        for (let i = 0; i < N; i++) {
          terms[i]?.classList.toggle('is-lit', lifts[i] > 0.5 || (i === 0 && e1 > 0.5));
          const x0 = ax[i];
          const y0 = ay[i];
          const x1 = cx[i];
          const y1 = cy[i];
          /* elbow: a short level stub out of the anchor, a 45° diagonal
             (steeper only when there is no room), then a level shoulder
             into the legend row. Works in either direction. */
          const dir = x1 >= x0 ? 1 : -1;
          const stub = x0 + dir * 16;
          const room = Math.max(0, Math.abs(x1 - stub) - 24);
          const run = Math.min(Math.abs(y1 - y0), room);
          const ex = stub + dir * run;
          paths[i].setAttribute('d', `M${x0.toFixed(1)} ${y0.toFixed(1)}H${stub.toFixed(1)}L${ex.toFixed(1)} ${y1.toFixed(1)}H${x1.toFixed(1)}`);
          const t = terms[i];
          if (t) {
            t.setAttribute('x', (x0 - 2.5).toFixed(1));
            t.setAttribute('y', (y0 - 2.5).toFixed(1));
          }
        }
      }
    },
  });

  requestFrame();
}
