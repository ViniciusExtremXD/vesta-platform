/**
 * Particle field behind the hero. A sparse mesh with gentle drift, elastic
 * attraction to the pointer, and faint links between neighbours.
 *
 * Rules: fine pointers only (touch gets a still hero and a full battery),
 * paused when off-screen or the tab is hidden, capped DPR, and it never
 * paints anything the page depends on — the canvas is decoration.
 */

interface P {
  x: number;
  y: number;
  hx: number; // home
  hy: number;
  vx: number;
  vy: number;
  r: number;
  tone: number; // 0..1, violet ↔ white
  phase: number;
}

export function initParticles(isReduced: () => boolean): void {
  const hosts = Array.from(document.querySelectorAll<HTMLElement>('[data-particles]'));
  if (!hosts.length) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;

  hosts.forEach((host) => mount(host, isReduced));
}

function mount(host: HTMLElement, isReduced: () => boolean): void {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let particles: P[] = [];
  let raf = 0;
  let visible = true;
  let live = false;
  const pointer = { x: -9999, y: -9999, active: false };

  const LINK = 120;
  const PULL = 240;

  function size(): void {
    const r = host.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    if (w <= 1 || h <= 1) return; // hidden host: wait for a real layout
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function seed(): void {
    const n = Math.round(Math.min(130, Math.max(45, (w * h) / 13000)));
    particles = Array.from({ length: n }, () => {
      const x = Math.random() * w;
      const y = Math.random() * h;
      return {
        x,
        y,
        hx: x,
        hy: y,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        r: 0.8 + Math.random() * 1.6,
        tone: Math.random(),
        phase: Math.random() * Math.PI * 2,
      };
    });
  }

  let frame = 0;

  function step(t: number): void {
    raf = 0;
    if (!visible || document.hidden || isReduced()) {
      live = false;
      canvas.classList.remove('is-live');
      return;
    }

    // The host is display:none until the engine flags html.motion-ready,
    // which happens after this module boots. Sizing against a hidden host
    // gives a 1×1 canvas that CSS then stretches over the whole hero — a
    // solid purple wall. So: re-measure until the host has real dimensions,
    // and keep an eye on it every half second after that.
    if (w <= 1 || h <= 1 || frame % 30 === 0) {
      const r = host.getBoundingClientRect();
      const rw = Math.round(r.width);
      const rh = Math.round(r.height);
      if (rw !== w || rh !== h) {
        if (rw < 2 || rh < 2) {
          raf = requestAnimationFrame(step);
          return;
        }
        size();
      }
    }
    frame++;

    if (!live) {
      live = true;
      canvas.classList.add('is-live');
    }

    ctx!.clearRect(0, 0, w, h);

    for (const p of particles) {
      // slow orbital drift around home
      const drift = 0.35 + p.r * 0.2;
      const tx = p.hx + Math.cos(t * 0.00025 + p.phase) * drift * 22;
      const ty = p.hy + Math.sin(t * 0.0002 + p.phase) * drift * 16;
      p.vx += (tx - p.x) * 0.004;
      p.vy += (ty - p.y) * 0.004;

      // elastic pull towards the pointer
      if (pointer.active) {
        const dx = pointer.x - p.x;
        const dy = pointer.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < PULL && d > 0.1) {
          const f = (1 - d / PULL) * 0.06;
          p.vx += (dx / d) * f * 4;
          p.vy += (dy / d) * f * 4;
        }
      }

      p.vx *= 0.92;
      p.vy *= 0.92;
      p.x += p.vx;
      p.y += p.vy;
    }

    // links
    ctx!.lineWidth = 1;
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > LINK * LINK) continue;
        const alpha = (1 - Math.sqrt(d2) / LINK) * 0.18;
        ctx!.strokeStyle = `rgba(168, 85, 247, ${alpha.toFixed(3)})`;
        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.stroke();
      }
    }

    // dots
    for (const p of particles) {
      const near = pointer.active ? Math.max(0, 1 - Math.hypot(pointer.x - p.x, pointer.y - p.y) / PULL) : 0;
      const alpha = 0.35 + p.tone * 0.35 + near * 0.3;
      const rr = p.r + near * 1.2;
      ctx!.fillStyle =
        p.tone > 0.6 ? `rgba(244, 242, 250, ${alpha.toFixed(3)})` : `rgba(182, 156, 255, ${alpha.toFixed(3)})`;
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, rr, 0, Math.PI * 2);
      ctx!.fill();
    }

    raf = requestAnimationFrame(step);
  }

  function wake(): void {
    if (!raf) raf = requestAnimationFrame(step);
  }

  // pointer, relative to the host
  const onMove = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.active = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= r.width && pointer.y <= r.height;
  };
  const onLeave = () => {
    pointer.active = false;
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);

  // only burn frames while the hero is on screen
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((en) => en.isIntersecting);
        if (visible) wake();
      },
      { threshold: 0.02 }
    );
    io.observe(host);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) wake();
  });
  document.addEventListener('click', (e) => {
    // the footer toggle flips motion back on: resume
    if ((e.target as HTMLElement | null)?.closest('[data-motion-toggle]')) window.setTimeout(wake, 50);
  });

  let resizeT = 0;
  window.addEventListener(
    'resize',
    () => {
      window.clearTimeout(resizeT);
      resizeT = window.setTimeout(() => {
        size();
        wake();
      }, 160);
    },
    { passive: true }
  );

  size();
  wake();
}
