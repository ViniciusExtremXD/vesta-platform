/**
 * Resolves internal paths against Astro's `base`. Everything in src/data uses
 * root-absolute paths ("/about/"); this is the only place that knows about
 * the BASE_PATH used by the GitHub Pages deploy.
 */
const BASE = import.meta.env.BASE_URL || '/';

export function url(pathname: string): string {
  if (!pathname) return BASE;
  if (/^(https?:)?\/\//.test(pathname) || pathname.startsWith('mailto:') || pathname.startsWith('tel:')) {
    return pathname;
  }
  if (pathname.startsWith('#')) return pathname;
  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${path}`;
}

export function isExternal(href: string): boolean {
  return /^(https?:)?\/\//.test(href);
}

/** Absolute URL for canonical / Open Graph / JSON-LD. */
export function absolute(pathname: string, site: URL | undefined): string {
  const origin = site ? site.origin : 'https://vesta.systems';
  return new URL(url(pathname), origin).href;
}

/** "September 22, 2026" */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

export function isoDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}
