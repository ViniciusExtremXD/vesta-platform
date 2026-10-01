/* =========================================================================
   Conversion events → window.dataLayer (read by Google Tag Manager).
   One delegated listener; nothing here depends on GTM being present, so the
   events queue up harmlessly when the container is not configured.

   Events (configure each as a GA4 event in GTM; mark the first three as
   key events / conversions):
     whatsapp_click   { cta, section }   any wa.me link
     email_click      { cta, section }   any mailto: link
     build_sheet_send { channel }        configurator send buttons
     example_view     { example, place } a niche/example switcher choice
     detail_open      { title }          an Expand box opened
   ========================================================================= */

type Payload = Record<string, string | number | undefined>;

const w = window as unknown as { dataLayer?: Payload[] };
w.dataLayer = w.dataLayer || [];

function push(event: string, data: Payload = {}): void {
  w.dataLayer!.push({ event, ...data });
}

document.addEventListener(
  'click',
  (e) => {
    const t = e.target as Element | null;
    if (!t) return;

    const link = t.closest<HTMLAnchorElement>('a[href]');
    if (link) {
      const href = link.getAttribute('href') || '';
      const section = link.closest<HTMLElement>('section[id]')?.id || (link.closest('footer') ? 'footer' : link.closest('header') ? 'nav' : 'page');
      const cta = link.dataset.waIntent || link.textContent?.trim().replace(/\s+/g, ' ').slice(0, 60) || '';
      if (/wa\.me\//.test(href)) {
        push('whatsapp_click', { cta, section });
        if (link.closest('#configure')) push('build_sheet_send', { channel: 'whatsapp' });
        return;
      }
      if (href.startsWith('mailto:')) {
        push('email_click', { cta, section });
        if (link.closest('#configure')) push('build_sheet_send', { channel: 'email' });
        return;
      }
    }

    const tab = t.closest<HTMLElement>('[role="tab"], [data-niche], [data-example]');
    if (tab && tab.closest('[data-showcase], #build, #configure, [data-niche-switch]')) {
      push('example_view', {
        example: tab.textContent?.trim().replace(/\s+/g, ' ').slice(0, 40),
        place: tab.closest<HTMLElement>('section[id]')?.id || 'page',
      });
      return;
    }

    const summary = t.closest('details[data-expand] > summary');
    if (summary) {
      const box = summary.parentElement as HTMLDetailsElement;
      if (!box.open) push('detail_open', { title: summary.querySelector('.xp-title')?.textContent?.trim() });
    }
  },
  { capture: true, passive: true }
);

export {};
