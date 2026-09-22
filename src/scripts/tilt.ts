/**
 * Inertial 3D tilt for [data-tilt] cards. The pointer sets a target angle;
 * a rAF loop eases the current angle towards it, so the card has weight
 * instead of snapping. Fine pointers only.
 */
export function initTilt(isReduced: () => boolean): void {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-tilt]'));
  if (!cards.length) return;

  interface S {
    el: HTMLElement;
    tx: number;
    ty: number;
    cx: number;
    cy: number;
    active: boolean;
  }
  const states: S[] = cards.map((el) => ({ el, tx: 0, ty: 0, cx: 0, cy: 0, active: false }));
  let raf = 0;

  const loop = () => {
    raf = 0;
    let busy = false;
    for (const s of states) {
      s.cx += (s.tx - s.cx) * 0.14;
      s.cy += (s.ty - s.cy) * 0.14;
      if (Math.abs(s.cx - s.tx) > 0.02 || Math.abs(s.cy - s.ty) > 0.02 || s.active) busy = true;
      else {
        s.cx = s.tx;
        s.cy = s.ty;
      }
      s.el.style.setProperty('--rx', `${s.cx.toFixed(2)}deg`);
      s.el.style.setProperty('--ry', `${s.cy.toFixed(2)}deg`);
    }
    if (busy) raf = requestAnimationFrame(loop);
  };
  const wake = () => {
    if (!raf) raf = requestAnimationFrame(loop);
  };

  states.forEach((s) => {
    const max = Number(s.el.dataset.tilt || 6);
    s.el.addEventListener('pointermove', (e) => {
      if (isReduced()) return;
      const r = s.el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      s.tx = -py * max * 2;
      s.ty = px * max * 2;
      s.active = true;
      s.el.classList.remove('is-resting');
      wake();
    });
    const rest = () => {
      s.tx = 0;
      s.ty = 0;
      s.active = false;
      s.el.classList.add('is-resting');
      wake();
    };
    s.el.addEventListener('pointerleave', rest);
    s.el.addEventListener('blur', rest);
  });
}
