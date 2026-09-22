/**
 * Celestial Starfield & Constellation Engine.
 *
 * Immerses the hero in an astrological night sky:
 * - Twinkling major stars and minor cosmic dust (astral gold, celestial violet, starlight white)
 * - Dynamic constellation lines connecting neighbouring stars
 * - Interactive celestial gravity well responding to pointer movement
 * - Occasional shooting stars (meteors) gliding gracefully across the cosmic void
 */

interface P {
  x: number;
  y: number;
  hx: number;
  hy: number;
  vx: number;
  vy: number;
  r: number;
  tone: number;
  phase: number;
  twinkleSpeed: number;
  isMajor: boolean;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  life: number;
  maxLife: number;
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
  let meteors: Meteor[] = [];
  let nextMeteorTime = 0;
  let raf = 0;
  let visible = true;
  let live = false;
  const pointer = { x: -9999, y: -9999, active: false };

  const LINK = 135;
  const PULL = 260;

  function size(): void {
    const r = host.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    if (w <= 1 || h <= 1) return;
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function seed(): void {
    const n = Math.round(Math.min(140, Math.max(50, (w * h) / 12000)));
    particles = Array.from({ length: n }, (_, i) => {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const isMajor = i % 7 === 0;
      return {
        x,
        y,
        hx: x,
        hy: y,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: isMajor ? 1.8 + Math.random() * 1.4 : 0.7 + Math.random() * 1.1,
        tone: Math.random(),
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.0015 + Math.random() * 0.003,
        isMajor,
      };
    });
  }

  function spawnMeteor(): void {
    if (Math.random() < 0.6) return;
    const startX = Math.random() * w * 0.8;
    const startY = Math.random() * (h * 0.4);
    const speed = 4 + Math.random() * 4;
    const angle = (Math.PI / 4) + (Math.random() - 0.5) * 0.3; // ~45 deg downward
    meteors.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      len: 40 + Math.random() * 50,
      life: 0,
      maxLife: 40 + Math.random() * 30,
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

    // Meteors
    if (t > nextMeteorTime) {
      spawnMeteor();
      nextMeteorTime = t + 3500 + Math.random() * 4500;
    }

    for (let m = meteors.length - 1; m >= 0; m--) {
      const met = meteors[m];
      met.x += met.vx;
      met.y += met.vy;
      met.life++;
      const progress = met.life / met.maxLife;
      const alpha = Math.sin(progress * Math.PI) * 0.7;

      if (progress >= 1 || met.x > w || met.y > h) {
        meteors.splice(m, 1);
        continue;
      }

      const tailX = met.x - (met.vx / 6) * met.len;
      const tailY = met.y - (met.vy / 6) * met.len;

      const grad = ctx!.createLinearGradient(tailX, tailY, met.x, met.y);
      grad.addColorStop(0, 'rgba(168, 85, 247, 0)');
      grad.addColorStop(0.7, `rgba(234, 179, 8, ${alpha.toFixed(3)})`);
      grad.addColorStop(1, `rgba(255, 255, 255, ${(alpha * 1.3).toFixed(3)})`);

      ctx!.strokeStyle = grad;
      ctx!.lineWidth = 1.4;
      ctx!.beginPath();
      ctx!.moveTo(tailX, tailY);
      ctx!.lineTo(met.x, met.y);
      ctx!.stroke();
    }

    // Update stars
    for (const p of particles) {
      const drift = 0.35 + p.r * 0.2;
      const tx = p.hx + Math.cos(t * 0.00025 + p.phase) * drift * 22;
      const ty = p.hy + Math.sin(t * 0.0002 + p.phase) * drift * 16;
      p.vx += (tx - p.x) * 0.004;
      p.vy += (ty - p.y) * 0.004;

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

    // Draw Constellation Lines
    ctx!.lineWidth = 0.8;
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > LINK * LINK) continue;
        const distRatio = 1 - Math.sqrt(d2) / LINK;
        const alpha = distRatio * (a.isMajor || b.isMajor ? 0.28 : 0.14);

        if (a.tone > 0.7 && b.tone > 0.7) {
          ctx!.strokeStyle = `rgba(234, 179, 8, ${alpha.toFixed(3)})`; // astral gold
        } else {
          ctx!.strokeStyle = `rgba(168, 85, 247, ${alpha.toFixed(3)})`; // celestial violet
        }

        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.stroke();
      }
    }

    // Pointer constellation pull lines
    if (pointer.active) {
      for (const p of particles) {
        const dx = pointer.x - p.x;
        const dy = pointer.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < PULL * 0.75) {
          const alpha = (1 - d / (PULL * 0.75)) * 0.35;
          ctx!.strokeStyle = `rgba(192, 132, 252, ${alpha.toFixed(3)})`;
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.moveTo(pointer.x, pointer.y);
          ctx!.lineTo(p.x, p.y);
          ctx!.stroke();
        }
      }
    }

    // Draw Stars with Twinkle & Cross Spikes
    for (const p of particles) {
      const near = pointer.active ? Math.max(0, 1 - Math.hypot(pointer.x - p.x, pointer.y - p.y) / PULL) : 0;
      const twinkle = 0.55 + 0.45 * Math.sin(t * p.twinkleSpeed + p.phase);
      const alpha = (0.35 + p.tone * 0.35 + near * 0.3) * twinkle;
      const rr = p.r + near * 1.2;

      // Color selection
      if (p.tone > 0.75) {
        ctx!.fillStyle = `rgba(253, 224, 71, ${Math.min(1, alpha * 1.2).toFixed(3)})`; // gold star
      } else if (p.tone > 0.4) {
        ctx!.fillStyle = `rgba(244, 242, 250, ${alpha.toFixed(3)})`; // white star
      } else {
        ctx!.fillStyle = `rgba(192, 132, 252, ${alpha.toFixed(3)})`; // violet star
      }

      ctx!.beginPath();
      ctx!.arc(p.x, p.y, rr, 0, Math.PI * 2);
      ctx!.fill();

      // Major star cross-spike twinkle
      if (p.isMajor && twinkle > 0.7) {
        const spikeLen = rr * (2.4 + twinkle * 2);
        ctx!.strokeStyle = p.tone > 0.6 ? `rgba(255, 255, 255, ${(alpha * 0.7).toFixed(3)})` : `rgba(216, 180, 254, ${(alpha * 0.6).toFixed(3)})`;
        ctx!.lineWidth = 0.7;
        ctx!.beginPath();
        ctx!.moveTo(p.x - spikeLen, p.y);
        ctx!.lineTo(p.x + spikeLen, p.y);
        ctx!.moveTo(p.x, p.y - spikeLen);
        ctx!.lineTo(p.x, p.y + spikeLen);
        ctx!.stroke();
      }
    }

    raf = requestAnimationFrame(step);
  }

  function wake(): void {
    if (!raf) raf = requestAnimationFrame(step);
  }

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
