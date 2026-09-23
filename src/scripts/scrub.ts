/* =========================================================================
   Vesta — "Take one apart" (SPEC §6.3)
   Scroll progress through the Build track drives the exploded view of
   Concept 01. Registered into the ONE shared rAF loop (motion.ts); an
   IntersectionObserver (rootMargin 100%) gates the work, so offscreen the
   handler returns before touching layout.

   Per frame
     read   track rect, stage rect, six right-hand layer corners (the part
            numbers) + on desktop six left-hand corners and six legend rows
            (the leader lines)
     write  --e1 / --spread on .b-assembly, --lift on each .cp-layer, the
            camera orbit --orb / --el on the section (CSS turns all of it
            into transforms), .is-active on the legend row, the counter
            digit, six part-number positions, six leader paths, .is-in on
            the final line.

   Static mode (.build--static, or html.motion-reduced / motion-failed /
   no JS) is pure CSS: exploded, every callout listed. This script only
   stops writing and clears what it wrote.
   ========================================================================= */

import { addFrame, requestFrame, isReduced, vestibular } from './motion';

const N = 6;
const DESKTOP = 1100;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

export function initScrub(): void {
  const root = document.querySelector<HTMLElement>('[data-scrub]');
  if (!root) return;
  const track = root.querySelector<HTMLElement>('.b-track');
  const stage = root.querySelector<HTMLElement>('.b-stage');
  const assembly = root.querySelector<HTMLElement>('.b-assembly');
  const svg = root.querySelector<SVGSVGElement>('.b-leaders');
  const digit = root.querySelector<HTMLElement>('[data-count-n]');
  const final = root.querySelector<HTMLElement>('.b-final');
  const list = root.querySelector<HTMLElement>('.b-callouts');
  if (!track || !stage || !assembly) return;

  const layers: HTMLElement[] = [];
  for (let i = 0; i < N; i++) {
    const el = assembly.querySelector<HTMLElement>(`.cp-l${i + 1}`);
    if (!el) return;
    layers.push(el);
  }
  const rows = Array.from(root.querySelectorAll<HTMLElement>('.b-co'));
  const tags = Array.from(root.querySelectorAll<HTMLElement>('.b-tag'));
  const paths = svg ? Array.from(svg.querySelectorAll<SVGPathElement>('.b-ld')) : [];
  const terms = svg ? Array.from(svg.querySelectorAll<SVGRectElement>('.b-term')) : [];
  const axis = svg?.querySelector<SVGPathElement>('.b-axis') ?? null;

  /* two 1px probes per layer. Top-left: with the stage's rotateZ (−20° to
     −52° through the orbit) that corner is the layer's leftmost vertex, so
     the six stack into one column — where the leaders start. Bottom-right:
     the rightmost vertex — where the part numbers hang. */
  const probe = (layer: HTMLElement, css: string): HTMLElement => {
    const a = document.createElement('i');
    a.setAttribute('aria-hidden', 'true');
    a.style.cssText = `position:absolute;${css};width:1px;height:1px;pointer-events:none;`;
    layer.appendChild(a);
    return a;
  };
  const anchors = layers.map((layer) => probe(layer, 'left:0;top:0'));
  const corners = layers.map((layer) => probe(layer, 'right:0;bottom:0'));

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

  const setLive = (on: boolean) => {
    if (live === on) return;
    live = on;
    root.classList.toggle('is-live', on);
    /* the visual legend hides inactive text; screen readers get the full
       list (.b-sr) while live */
    if (list) {
      if (on) list.setAttribute('aria-hidden', 'true');
      else list.removeAttribute('aria-hidden');
    }
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
      paths.forEach((pa) => pa.classList.remove('is-on'));
      terms.forEach((t) => t.classList.remove('is-on'));
      root.classList.remove('is-open', 'is-scrubbing', 'is-done');
      final?.classList.remove('is-in');
      lastP = -2;
      active = -1;
      done = false;
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

      const out = 1 - smooth((p - 0.88) / 0.12);
      const e1 = smooth(p / 0.15) * out;
      let top = -1;
      let sum = 0;
      for (let i = 0; i < N; i++) {
        lifts[i] = smooth((p - 0.15 - i * 0.07) / 0.25) * out;
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

      const isDone = p > 0.88;
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
