/**
 * Industry labels for case studies and /industries/[slug]/.
 *
 * TODO_SITE: site.ts no longer exports `verticals` (the old paid-traffic
 * vertical list was removed in the rewrite). Until the owner confirms an
 * industries list, labels come from this map, falling back to the slug in
 * sentence case ("home-services" → "Home services"). Move this into site.ts
 * (e.g. `industries: { slug, label, h1, lead }[]`) when the first confirmed
 * case lands.
 */
export const TODO_SITE_VERTICAL_LABELS: Record<string, string> = {
  hvac: 'HVAC',
  roofing: 'Roofing',
  dental: 'Dental',
  legal: 'Legal',
  'home-services': 'Home services',
};

export function verticalLabel(slug: string): string {
  const known = TODO_SITE_VERTICAL_LABELS[slug];
  if (known) return known;
  const words = slug.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * TODO_SITE: /industries/[slug]/ copy. The old page sold "businesses that
 * buy traffic" (the retired paid-traffic positioning), so it is rewritten
 * here in the current voice. Move into site.ts with the list above.
 */
export const TODO_SITE_INDUSTRY = {
  seoTitle: (label: string) => `${label} websites · Vesta`,
  seoDescription: (label: string) =>
    `High-end websites for ${label.toLowerCase()} businesses, built by Vesta at fixed prices from $500. Measured case studies from the same industry.`,
  h1: (label: string) => `Websites for ${label.toLowerCase()} businesses.`,
  lead: 'The same packages and the same fixed prices. The case studies below were measured, and each number carries its tool and date.',
  casesTitle: 'Case studies',
  pricesTitle: 'Prices',
  pricesLink: { label: 'See every package', href: '/#pricing' },
};

/** TODO_SITE: /work/ and case-page strings not in site.ts. */
export const TODO_SITE_CASES = {
  /** /work/ section title above confirmed cases (renders only when one exists). */
  listTitle: 'Client work',
  /** Case page field labels. */
  measured: 'Measured',
  problem: 'Problem',
  built: 'What was built',
  liveSite: 'Live site ↗',
  launched: 'Launched',
  before: 'Before',
  after: 'After',
  tool: 'Tool and date',
  back: 'All work',
};
