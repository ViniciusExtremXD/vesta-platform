/**
 * Calendly, on demand. The widget script (~100 kB + iframe) is the only
 * third-party code on the site, and it loads only after the visitor asks for
 * it. Hovering the button warms the connection; clicking loads the embed.
 * Calendly detects the visitor's time zone and handles spam on its side.
 */
const WIDGET = 'https://assets.calendly.com/assets/external/widget.js';
const CSS = 'https://assets.calendly.com/assets/external/widget.css';

export function initBooking(): void {
  const host = document.querySelector<HTMLElement>('[data-booking]');
  if (!host) return;
  const url = host.dataset.bookingUrl;
  const button = host.querySelector<HTMLButtonElement>('[data-booking-load]');
  const slot = host.querySelector<HTMLElement>('[data-booking-slot]');
  const status = host.querySelector<HTMLElement>('[data-booking-status]');
  if (!url || !button || !slot) return;

  let warmed = false;
  const warm = () => {
    if (warmed) return;
    warmed = true;
    for (const href of ['https://assets.calendly.com', 'https://calendly.com']) {
      const l = document.createElement('link');
      l.rel = 'preconnect';
      l.href = href;
      l.crossOrigin = '';
      document.head.appendChild(l);
    }
  };
  button.addEventListener('pointerenter', warm, { once: true });
  button.addEventListener('focus', warm, { once: true });

  let loading = false;
  const fail = () => {
    loading = false;
    button.disabled = false;
    if (status) status.textContent = 'The scheduler could not load. Use WhatsApp below, or try again.';
  };

  button.addEventListener('click', () => {
    if (loading) return;
    loading = true;
    warm();
    button.disabled = true;
    if (status) status.textContent = 'Loading the scheduler…';

    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = CSS;
    document.head.appendChild(css);

    const s = document.createElement('script');
    s.src = WIDGET;
    s.async = true;
    s.onload = () => {
      const w = (window as unknown as { Calendly?: { initInlineWidget: (o: Record<string, unknown>) => void } }).Calendly;
      if (!w) return fail();
      slot.hidden = false;
      slot.innerHTML = '';
      w.initInlineWidget({ url: `${url}?hide_gdpr_banner=1&background_color=0e0c15&text_color=f4f2fa&primary_color=7c3aed`, parentElement: slot });
      host.classList.add('is-loaded');
      button.hidden = true;
      if (status) status.textContent = '';
    };
    s.onerror = fail;
    document.body.appendChild(s);
  });
}
