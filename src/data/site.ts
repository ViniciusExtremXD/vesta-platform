/* =========================================================================
   Vesta · site copy and data (single source)

   Every word the site renders lives in this file. Components import from
   here and never hard-code copy. Source: the flagship build spec
   (§5 home, §7 inner pages, §8 content decisions, §9 voice rules).

   Conventions
   - `confirmed: false` means "do not render". It is the owner's to-do list,
     not content. Filter lists with `confirmedOnly()`.
   - LABEL-style strings (section names, units, table labels, tags) are stored
     in sentence case. CSS uppercases them (§2.3), so screen readers, SEO and
     the verify gate read normal text.
   - Ranges use an en dash with no spaces: $500–$700, 5–7, Mon–Fri.
   - Voice: the actor is "Vesta" or "Vinícius". No first-person plural anywhere,
     WhatsApp prefills included. No gendered pronouns for the founder.
   - No live clocks anywhere (owner decision). Hours are always the static
     `contact.hours.label`.
   - Internal links are root-absolute ("/about/", "/#pricing") so they work
     from every page. Pass every href through `url()` from src/lib/url.ts so
     the GitHub Pages base path is applied. Hrefs that start with "#" are
     home-page-only anchors.
   - WhatsApp links: store the prefill text (`text`), build the href with
     `wa(text)` or the WaLink component.
   ========================================================================= */

/* ------------------------------------------------------------ shared types */

/** Anything that renders only when the owner has confirmed it. */
export interface Flagged {
  text: string;
  confirmed: boolean;
}

export interface Link {
  label: string;
  href: string;
}

/** A WhatsApp call to action: the visible label plus the prefilled message. */
export interface WaCta {
  label: string;
  /** Prefilled message. Build the href with `wa(text)`. */
  text: string;
}

/**
 * Section label row (§4 "Section heading"): livery stripe, numeral, name.
 * `index` is null on inner pages, which show the name only.
 */
export interface SectionLabel {
  index: string | null;
  name: string;
}

export interface Seo {
  title: string;
  description: string;
  noindex?: boolean;
}

/** A label/value row for hairline tables and fact lists. */
export interface Fact {
  label: string;
  value: string;
}

export type PackageId = 'landing' | 'google' | 'complete';

/** The fields of src/data/measurements.json that copy templates read. */
export interface Measurements {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  lcpMs: number;
  tbtMs: number;
  cls: number;
  transferKb: number;
  requests: number;
  tool: string;
  date: string;
}

/** Keeps only the items the owner has confirmed. */
export function confirmedOnly<T extends { confirmed: boolean }>(items: readonly T[]): T[] {
  return items.filter((item) => item.confirmed);
}

/* ------------------------------------------------------------------ brand */

export interface Brand {
  name: string;
  legalName: string;
  cnpj: string;
  city: string;
  /** State code, for the JSON-LD address. */
  region: string;
  country: string;
  /** ISO country code, for the JSON-LD address. */
  countryCode: string;
  /** Brand line: OG image, meta tagline, footer. */
  tagline: string;
  /** Home meta description (§8.3). Also the JSON-LD description. */
  description: string;
  /** Home <title> and meta description (§8.3). */
  seo: Seo;
  /** Text on the generated OG image (scripts/gen-og.mjs). */
  og: { headline: string; sub: string };
  /** Values for the ProfessionalService JSON-LD in Base.astro. */
  schema: { priceRange: string; areaServed: string };
}

export const brand: Brand = {
  name: 'Vesta',
  legalName: 'Vesta Consultoria',
  cnpj: '61.465.539/0001-00',
  city: 'São Paulo',
  region: 'SP',
  country: 'Brazil',
  countryCode: 'BR',
  tagline: 'Websites built like flagships. Priced after a free analysis.',
  description:
    'Vesta designs and builds high-end websites for businesses, new or rebuilt, and sets them up to be found on Google. Every price starts with a free analysis. Talk to the founder on WhatsApp or email.',
  seo: {
    title: 'Vesta — High-end websites for businesses',
    description:
      'Vesta designs and builds high-end websites for businesses, new or rebuilt, and sets them up to be found on Google. Every price starts with a free analysis. Talk to the founder on WhatsApp or email.',
  },
  og: {
    headline: 'Websites built like flagships.',
    sub: 'Free price analysis on every project',
  },
  schema: {
    priceRange: '$750–$1,000',
    areaServed: 'US, worldwide',
  },
};

/* ---------------------------------------------------------------- founder */

export const founder = {
  name: 'Vinícius Magno',
  firstName: 'Vinícius',
  role: 'Founder',
  education: 'B.S. Computer Science, Mackenzie Presbyterian University',
  location: 'São Paulo, Brazil · UTC−3',
  /** Portrait (src/assets/vinicius-magno.jpg). Confirmed by the owner. */
  portrait: {
    confirmed: true,
    alt: 'Vinícius Magno, founder of Vesta',
  },
};

/* ---------------------------------------------------------------- contact */

export const contact = {
  whatsapp: {
    display: '+55 11 91029-2004',
    e164: '5511910292004',
    /** Generic link without a prefill (QR code on /contact/). */
    url: 'https://wa.me/5511910292004',
    confirmed: true,
  },
  linkedin: {
    url: 'https://www.linkedin.com/in/vinicius-magno-vesta/',
    /** Short link label used next to CTAs. */
    label: 'LinkedIn ↗',
    /** Longer label used in the footer contact column. */
    name: 'LinkedIn · Vinícius Magno',
    confirmed: true,
  },
  /** Not rendered anywhere until confirmed. */
  email: {
    address: 'vinicius@vesta.systems',
    /** Subject line for mailto: links. */
    subject: 'Website price analysis',
    label: 'Email',
    confirmed: true,
  },
  /** Calendly and any booking widget stay hidden until confirmed. */
  booking: {
    confirmed: false,
  },
  /** Static working hours. There are no live clocks on the site. */
  hours: {
    label: 'Mon–Fri, 9:00–18:00 São Paulo time (UTC−3)',
    short: 'Mon–Fri, 9:00–18:00',
    utcOffset: 'UTC−3',
    /** Footer line (§5.13). */
    offsetLine: 'São Paulo · UTC−3 · 1–2 hours ahead of New York',
  },
};

/** mailto: link to the professional address, with an optional subject and body. */
export function mail(subject: string = contact.email.subject, body = ''): string {
  const q = [`subject=${encodeURIComponent(subject)}`, body ? `body=${encodeURIComponent(body)}` : ''].filter(Boolean).join('&');
  return `mailto:${contact.email.address}?${q}`;
}

/** Builds a WhatsApp link with a prefilled message (§4 WaLink). */
export function wa(text: string): string {
  return `https://wa.me/${contact.whatsapp.e164}?text=${encodeURIComponent(text)}`;
}

/* ---------------------------------------------------------------- sources */

export interface Source {
  publisher: string;
  title: string;
  /** Year of publication, when the source has one. */
  year: number | null;
  /** When the page was read, for undated help pages. */
  accessed: string | null;
  url: string;
  /** Link text as rendered. */
  citation: string;
}

/** The only two external sources the site cites (§8.1). */
export const sources: { deloitte: Source; googleLocalRanking: Source } = {
  deloitte: {
    publisher: 'Deloitte Digital',
    title: 'Milliseconds Make Millions',
    year: 2020,
    accessed: null,
    url: 'https://www.deloitte.com/ie/en/services/consulting/research/milliseconds-make-millions.html',
    citation: 'Deloitte Digital, "Milliseconds Make Millions", 2020',
  },
  googleLocalRanking: {
    publisher: 'Google Business Profile Help',
    title: 'Tips to improve your local ranking on Google',
    year: null,
    accessed: 'September 2026',
    url: 'https://support.google.com/business/answer/7091',
    citation: 'Google Business Profile Help, "Tips to improve your local ranking on Google", accessed September 2026',
  },
};

/* ------------------------------------------------------ WhatsApp prefills */

/** Configurator state (§5.8). Empty strings mean "not given". */
export interface ConfigSelection {
  packageId: PackageId;
  start: 'new' | 'rebuild';
  currentUrl: string;
  care: boolean;
  business: string;
  /** Optional industry (a concept niche, or 'Other'); '' = not given. */
  industry?: string;
}

export type FinaleIntentId = 'new' | 'rebuild' | 'google' | 'question';
export type QuickStartId = 'newSite' | 'rebuild' | 'landing';
export type HelperNeed = 'new' | 'rebuild' | 'google' | 'question';

/** /contact/ message helper state. Empty strings mean "not given". */
export interface HelperInput {
  business: string;
  currentUrl: string;
  need: HelperNeed;
  extra: string;
}

export interface WaMessages {
  /** Hero primary CTA, nav button, sticky bar, generic links. */
  hero: string;
  /** #visibility text-link CTA. */
  visibility: string;
  /** One per package column CTA. */
  pricing: Record<PackageId, string>;
  /** Care band CTA. */
  care: string;
  /** Founding-clients band CTA. */
  founding: string;
  /** Test Drive "Send your score" link. */
  testDrive: string;
  /** #builder primary CTA. */
  builder: string;
  /** FAQ side link and "Just a question" intent. */
  question: string;
  /** Finale intent chips. */
  finale: Record<FinaleIntentId, string>;
  /** /contact/ quick-start buttons. */
  contact: Record<QuickStartId, string>;
  /** Configurator build-sheet message (§5.8 template). */
  configurator: (sel: ConfigSelection) => string;
  /** /contact/ message helper. */
  contactHelper: (input: HelperInput) => string;
}

export const waMessages: WaMessages = {
  hero: "Hi Vinícius, I found Vesta and I'd like a price for a website for my business.",
  visibility: "Hi Vinícius, I'd like help getting my business found on Google. My website is: ",
  pricing: {
    landing: "Hi Vinícius, I'd like a free price analysis for a Landing Page.",
    google: "Hi Vinícius, I'd like a free price analysis for a Landing Page + Google.",
    complete: "Hi Vinícius, I'd like a free price analysis for a Complete Website.",
  },
  care: "Hi Vinícius, I'd like to ask about the Care plan.",
  founding: "Hi Vinícius, I'd like to ask about a founding-client place.",
  testDrive: "Hi Vinícius, I ran Google's test on my site. It scored __ on mobile. My site is: ",
  builder: "Hi Vinícius, I'd like to talk about a website for my business.",
  question: 'Hi Vinícius, I have a question about Vesta: ',
  finale: {
    new: "Hi Vinícius, I'd like a price for a new website for my business. The business is: ",
    rebuild: "Hi Vinícius, I'd like to rebuild my website. My current site is: ",
    google: "Hi Vinícius, I'd like help getting my business found on Google. My website is: ",
    question: 'Hi Vinícius, I have a question about Vesta: ',
  },
  contact: {
    newSite: 'Hi Vinícius, I need a new website for my business. The business is: ',
    rebuild: 'Hi Vinícius, I want to rebuild my current site. It is: ',
    landing: 'Hi Vinícius, I need a landing page for my business. The offer is: ',
  },
  configurator: configuratorMessage,
  contactHelper: contactHelperMessage,
};

/**
 * Configurator message (§5.8), lines joined by "\n":
 *   Hi Vinícius, I'd like to talk about a Vesta build.
 *   – Package: {name} ({price}, {days})
 *   – Starting point: {new website | rebuild my current site ({url})}
 *   – Options: {Care plan | none}
 *   – Business: {name | not given}
 *   Sent from the Vesta website configurator.
 */
function configuratorMessage(sel: ConfigSelection): string {
  const p = getPackage(sel.packageId);
  const url = sel.currentUrl.trim();
  const business = sel.business.trim();
  const start =
    sel.start === 'new' ? 'new website' : url ? `rebuild my current site (${url})` : 'rebuild my current site';
  return [
    "Hi Vinícius, I'd like to talk about a Vesta build.",
    `– Package: ${p.name} (${p.price.display}, ${p.daysLabel})`,
    `– Starting point: ${start}`,
    `– Options: ${sel.care ? 'Care plan' : 'none'}`,
    `– Business: ${business || 'not given'}`,
    ...(sel.industry?.trim() ? [`– Industry: ${sel.industry.trim()}`] : []),
    'Sent from the Vesta website configurator.',
  ].join('\n');
}

const helperNeeds: Record<HelperNeed, string> = {
  new: 'a new website',
  rebuild: 'a rebuild of my current site',
  google: 'help getting found on Google',
  question: 'an answer to a question',
};

/** /contact/ message helper. Same shape as the configurator message. */
function contactHelperMessage(input: HelperInput): string {
  const business = input.business.trim();
  const url = input.currentUrl.trim();
  const extra = input.extra.trim();
  const lines = [
    "Hi Vinícius, I found Vesta and I'd like to talk.",
    `– Business: ${business || 'not given'}`,
    `– Current website: ${url || 'none'}`,
    `– What I need: ${helperNeeds[input.need]}`,
  ];
  if (extra) lines.push(`– Anything else: ${extra}`);
  lines.push('Sent from the Vesta contact page.');
  return lines.join('\n');
}

/* ------------------------------------------------------- nav and global UI */

export interface NavLink extends Link {
  /** Home section id for the sliding active bar; null for other pages. */
  section: string | null;
}

/** Desktop nav links, in order (§4 Nav). */
export const nav: NavLink[] = [
  { label: 'Services', href: '/#services', section: 'services' },
  { label: 'Pricing', href: '/#pricing', section: 'pricing' },
  { label: 'Process', href: '/#process', section: 'process' },
  { label: 'About', href: '/about/', section: null },
];

/** The one primary action on every page. */
export const primaryCta: Link & { text: string } = {
  label: 'Get a price on WhatsApp',
  text: waMessages.hero,
  href: wa(waMessages.hero),
};

/** Small UI strings for the nav and layout chrome. */
export const navUi = {
  homeAria: 'Vesta, home',
  /** Desktop and tablet button label (with the WhatsApp glyph). */
  whatsapp: 'WhatsApp',
  /** Mobile icon-only button. */
  whatsappAria: 'Get a price on WhatsApp',
  /** Desktop/tablet label beside the WhatsApp button. */
  email: 'Email',
  emailAria: 'Email Vinícius',
  menu: 'Menu',
  close: 'Close',
  skipToContent: 'Skip to content',
};

/** Full-screen mobile menu (§4). Links carry a 01–05 index in smoke. */
export const mobileMenu = {
  links: [
    { index: '01', label: 'Services', href: '/#services' },
    { index: '02', label: 'Pricing', href: '/#pricing' },
    { index: '03', label: 'Process', href: '/#process' },
    { index: '04', label: 'About', href: '/about/' },
    { index: '05', label: 'Contact', href: '/contact/' },
  ],
  cta: primaryCta,
  linkedin: { label: contact.linkedin.label, href: contact.linkedin.url },
  /** Static hours line where the spec had a live clock. */
  hours: contact.hours.label,
};

/** Mobile sticky WhatsApp bar (§4). Renders as `{price} · {note}`. */
export const stickyBar = {
  /** Bone. */
  price: 'Free price analysis',
  /** Ash. */
  note: 'Reply in one business day',
  button: 'WhatsApp',
  text: waMessages.hero,
};

/* ------------------------------------------------ Concept 01 (fictional) */

/**
 * Halden Roofing: a fictional business used for every concept plate.
 * Always labelled fictional. Uses a .example domain and a 555-01xx number.
 */
export const concept = {
  number: 'Concept 01',
  name: 'Halden Roofing',
  domain: 'haldenroofing.example',
  phone: '(512) 555-0147',
  email: 'info@haldenroofing.example',
  city: 'Austin, TX',
  schemaType: 'RoofingContractor',
  /** Persistent caption wherever a plate appears (hero leader line). */
  caption: 'Concept 01 · A study by Vesta · Fictional business, not client work',
  /** aria-label for the plate (`role="img"`), per ConceptPlate mode. */
  aria: {
    hero: 'Concept 01: the website of Halden Roofing, a fictional business, before and after a rebuild by Vesta.',
    build: 'Concept 01 taken apart into six layers: code, design, speed, Google, contact buttons and tracking.',
    mini: 'Preview of your site, drawn as a Concept 01 plate.',
  },
  /** The 2016-template "before" site. Arial only, AA contrast, not a parody. */
  before: {
    /** Tiny text on the tan top bar (the phone number stays in the footer only, see A1). */
    topBar: 'info@haldenroofing.example',
    logo: 'Halden Roofing',
    welcome: 'Welcome to Halden Roofing',
    /** Three identical icon boxes. */
    boxes: ['Roofing', 'Repairs', 'Gutters'],
    footer: 'Halden Roofing · Austin, TX · (512) 555-0147',
  },
  /** The rebuilt site, as six stacked layers (see `build.layers[].plate`). */
  after: {
    headline: 'Roofing done once. Done right.',
    sub: 'Free inspections, written estimates, local crew.',
    nav: ['Services', 'About', 'Contact'],
    services: ['Roof repair', 'Roof replacement', 'Storm damage'],
    /** L1 wireframe box tags. */
    wireframeTags: ['NAV', 'H1', 'CTA', 'SERVICES'],
    /** L4 JSON-LD card lines. */
    jsonLd: ['"@type": "RoofingContractor"', '"areaServed": "Austin, TX"'],
    /** L4 sitemap tree. */
    sitemap: ['/', '/roof-repair/', '/roof-replacement/', '/storm-damage/', '/contact/'],
    /** L5 copper buttons. */
    buttons: ['Book a free inspection', 'Call (512) 555-0147', 'WhatsApp'],
    /** L6 event pins. */
    events: ['cta_click', 'call_click', 'form_submit'],
  },
  /** Numbered annotations on /work/concept-01/. */
  annotations: {
    before: [
      { id: 'A1', text: 'Phone number only in the footer.' },
      { id: 'A2', text: 'A slider of placeholder photos that says nothing specific.' },
      { id: 'A3', text: '"Welcome to Halden Roofing" instead of what the company does.' },
      { id: 'A4', text: 'No page title or description written for search.' },
    ],
    after: [
      { id: 'B1', text: 'One clear promise on the first screen.' },
      { id: 'B2', text: 'Call and inspection buttons within thumb reach.' },
      { id: 'B3', text: 'A page per service that Google can index.' },
      { id: 'B4', text: 'Structured data for a roofing contractor.' },
    ],
  },
};

/* =========================================================================
   HOME PAGE: one export per section, in page order
   ========================================================================= */

/* ------------------------------------------------------------ 5.1 #hero */

export const hero = {
  id: 'hero',
  meta: {
    left: 'Vesta · Website design and build studio',
    /** Removed by the owner (2026-09-23): no audience or coordinates line. */
    right: null,
    /** At 390px the meta row collapses to this. */
    mobile: 'Website design and build studio',
  },
  h1: 'Your business is better than its website.',
  lead: 'Vesta designs and builds high-end websites for businesses, new or rebuilt from the one you have, and sets them up to be found on Google.',
  primary: { label: 'Get a price on WhatsApp', text: waMessages.hero } satisfies WaCta,
  secondary: { label: 'See packages', href: '#pricing' } satisfies Link,
  /** Beside WhatsApp: the professional email. */
  email: { label: 'Email Vinícius', subject: 'Website price analysis' },
  /** Ash, under the CTAs. */
  micro: 'Every project starts with a free price analysis. You talk to the founder, who builds every site.',
  /** Smoke, static. Replaces the live clock line. */
  status: 'Replies Mon–Fri, 9:00–18:00 São Paulo time (UTC−3).',
  plate: {
    /** Top bar text (URL only, no browser dots). */
    url: concept.domain,
    caption: concept.caption,
    aria: concept.aria.hero,
    tags: { before: 'Before', after: 'Rebuilt by Vesta' },
    /** Narrow plates (phones): the tags ride the URL bar, so they stay short. */
    tagsShort: { before: 'Before', after: 'After' },
    handleAria: 'Compare the old and rebuilt website. Use the arrow keys.',
    /** No-JS thumbnail caption. */
    insetCaption: 'Before',
  },
  /** The five-niche switcher under the hero plate (order = concepts 01–05). */
  showcase: {
    label: 'Concept studies by niche',
    tabs: { halden: 'Roofing', dental: 'Dental', restaurant: 'Restaurant', law: 'Law', fitness: 'Fitness' },
  },
};

/* ------------------------------------------------ spec band (part of #hero) */

export interface SpecCell {
  /** Final value, present in the HTML. */
  value: string;
  /** Unit label (CSS uppercase); null for the text-only cell. */
  unit: string | null;
  caption: string;
  /** Count-up target for `data-count`; null when the value rises instead. */
  count: { to: number; prefix: string; suffix: string } | null;
}

export const specBand: { cells: SpecCell[]; footnote: string } = {
  cells: [
    {
      value: 'Free',
      unit: 'Analysis',
      caption: 'Every price starts with a look at your business and your current site.',
      count: null,
    },
    {
      value: '5–7',
      unit: 'Days',
      caption: 'Business days to launch a landing page.',
      count: null,
    },
    {
      value: '100%',
      unit: 'Yours',
      caption: 'Code, design, content and every login.',
      count: { to: 100, prefix: '', suffix: '%' },
    },
    {
      value: 'Websites, not ads',
      unit: null,
      caption: "Vesta builds what Google and your ads send people to. It doesn't run the ads.",
      count: null,
    },
  ],
  footnote: 'Complete websites in 2–3 weeks.',
};

/* --------------------------------------------------------- 5.2 #problem */

export const problem = {
  id: 'problem',
  label: { index: '01', name: 'The problem' } satisfies SectionLabel,
  h2: 'Most good businesses have a website that undersells them.',
  rows: [
    {
      index: '01',
      title: 'It looks older than the business is.',
      body: 'Customers judge the company by its site before they ever call. A dated layout and stock photos say the wrong thing about good work.',
      /** Round 2: visible keywords; the body sits in the Expand box. */
      keywords: ['Dated layout', 'Stock photos', 'Lost trust'],
    },
    {
      index: '02',
      title: "Google can't tell what you do, or where.",
      body: 'No page titles written for search, no structured data, no Business Profile linked. The people searching for exactly what you sell never see it.',
      keywords: ['No search titles', 'No structured data', 'No Business Profile'],
    },
    {
      index: '03',
      title: 'It makes people work to reach you.',
      body: 'The phone number hides in the footer, the form asks for nine things, and on a phone the menu covers everything.',
      keywords: ['Hidden phone', 'Nine-field form', 'Broken mobile menu'],
    },
  ],
  closing: 'Vesta fixes all three in one project.',
};

/* -------------------------------------------------------- 5.3 #services */

export const services = {
  id: 'services',
  label: { index: '02', name: 'What Vesta does' } satisfies SectionLabel,
  /** A. Stance stage (carbon). */
  stance: {
    /** Full statement, for the accessible name and no-JS. */
    text: 'Ads rent attention. A great website owns it.',
    /** One `.ln` span per entry. */
    desktop: ['Ads rent attention.', 'A great website', 'owns it.'],
    mobile: ['Ads rent', 'attention.', 'A great', 'website', 'owns it.'],
  },
  /** Round 2: the one visible line after the stage (bodyA/bodyB/follow move into `detail`). */
  lead: 'Vesta builds the website people judge your business by, and sets it up so Google can find it.',
  /** Round 2: the Expand box under the lead (holds bodyB + notOurWork.follow). */
  detail: {
    title: 'With ads or without',
    keywords: ['Landing pages', 'Google and Maps', 'Tracking'],
  },
  /** Lead, bone. */
  bodyA:
    "Vesta doesn't manage ad budgets. Vesta builds the website people judge your business by, and sets it up so Google can find it.",
  /** Ash. */
  bodyB:
    "If you run ads, they finally land somewhere worth the click. If you don't, the website keeps working every day: on Google, on Maps, and every time someone looks you up before they call.",
  notOurWork: {
    label: "Not Vesta's work",
    /** Rendered struck through. */
    items: ['Paid ads management', 'Social media management', 'Content calendars'],
    follow: 'If someone runs your ads, Vesta builds the page they land on and installs the tracking they need.',
  },
  /** B. Stations (paper). */
  stations: [
    {
      index: '01',
      title: 'Design',
      body: 'A site designed around your offer, your customers and your brand. Phone and desktop designed as equals.',
      deliverables: ['Structure and copy direction', 'Visual design', 'Two revision rounds'],
    },
    {
      index: '02',
      title: 'Build',
      body: 'Custom code, written for your site. No page builders, no themes, no plugin stack. The repository and every login are yours at launch.',
      deliverables: ['Custom code', 'WhatsApp, call and form wiring', 'Analytics and conversion tracking'],
    },
    {
      index: '03',
      title: 'Get found',
      body: 'A beautiful site nobody finds is a brochure in a drawer. Search Console, sitemap, structured data and metadata are set up before launch, by package.',
      deliverables: ['Technical SEO', 'Local SEO', 'Care after launch'],
    },
  ],
  modernize: 'Already have a website? Most projects are rebuilds: same domain, same business, a site that finally matches it.',
};

/* ----------------------------------------------------------- 5.4 #build */

export interface BuildLayer {
  index: string;
  name: string;
  /** Callout text (15px). */
  text: string;
  /** Minimal text drawn on this plate layer (plate table, §5.4). */
  plate: string[];
}

export const build = {
  id: 'build',
  label: { index: '03', name: 'The build' } satisfies SectionLabel,
  h2: 'Take one apart.',
  lead: 'Six layers, one builder. Scroll to see what sits inside a Vesta site.',
  /** Renders as `{label} {n} {total}`, e.g. "Layer 3 / 6". */
  counter: { label: 'Layer', total: '/ 6' },
  layers: [
    {
      index: '01',
      name: 'Code',
      text: 'Custom HTML, CSS and TypeScript, written for this site. Pages are pre-built, so there is no page builder or plugin stack to patch.',
      plate: concept.after.wireframeTags,
    },
    {
      index: '02',
      name: 'Design',
      text: 'Layout, type, colour and image direction made for the brand. Phone and desktop designed together.',
      plate: [concept.after.headline],
    },
    {
      index: '03',
      name: 'Speed',
      text: "Images sized for each screen, fonts self-hosted, nothing loaded that the page doesn't use. Measured with Lighthouse before launch.",
      /** Image frames and a load-waterfall graphic: bars only, no text. */
      plate: [],
    },
    {
      index: '04',
      name: 'Google',
      text: 'Search Console, XML sitemap, structured data and metadata. Indexing requested on launch day.',
      plate: [...concept.after.jsonLd, ...concept.after.sitemap],
    },
    {
      index: '05',
      name: 'Contact buttons',
      text: 'WhatsApp, call and form buttons where the thumb lands. Leads arrive in the inbox you already use.',
      plate: concept.after.buttons,
    },
    {
      index: '06',
      name: 'Tracking',
      text: 'Analytics and conversion events installed, so you can see what the site actually does.',
      plate: concept.after.events,
    },
  ] satisfies BuildLayer[],
  final: 'Assembled. Handed over with the repository, the domain access and every login.',
  /** 12px smoke, always visible. */
  caption: 'Concept 01 is a study by Vesta for a fictional roofing company. It is not client work.',
  skip: { label: 'Skip the teardown ↓', href: '#visibility' } satisfies Link,
};

/* ------------------------------------------------------ 5.5 #visibility */

export interface VisibilityItem {
  title: string;
  text: string;
  /** Package tag as rendered (LABEL, ink-3). */
  tag: string;
  packages: PackageId[];
  confirmed: boolean;
}

const allPackages: PackageId[] = ['landing', 'google', 'complete'];
const googlePackages: PackageId[] = ['google', 'complete'];

export const visibility = {
  id: 'visibility',
  label: { index: '04', name: 'Google visibility' } satisfies SectionLabel,
  h2: 'Show up when they search for what you do.',
  lead: "The technical and local SEO that tells Google what you do, where, and when you're open.",
  /** Six `<button>` rows; each drives one panel state. */
  items: [
    {
      title: 'Search Console verified, sitemap submitted',
      text: 'Google is told the site exists and which pages matter.',
      tag: 'All packages',
      packages: allPackages,
      confirmed: true,
    },
    {
      title: 'Titles and descriptions written for people',
      text: 'The result says what you do instead of "Home".',
      tag: 'All packages',
      packages: allPackages,
      confirmed: true,
    },
    {
      title: 'Structured data',
      text: 'Hours, services, location and FAQs in the schema.org format Google reads.',
      tag: 'Landing Page + Google · Complete Website',
      packages: googlePackages,
      confirmed: true,
    },
    {
      title: 'Google Business Profile completed',
      text: 'Categories, hours, photos and your website link, so the business can appear in map results.',
      tag: 'Landing Page + Google · Complete Website',
      packages: googlePackages,
      confirmed: true,
    },
    {
      title: 'Fast on mobile',
      text: 'Core Web Vitals checked before launch. The Lighthouse report is yours.',
      tag: 'All packages',
      packages: allPackages,
      confirmed: true,
    },
    {
      title: 'Calls and messages tracked',
      text: 'Analytics plus call and WhatsApp events, so you can see what the site brings in.',
      tag: 'All packages',
      packages: allPackages,
      confirmed: true,
    },
  ] satisfies VisibilityItem[],
  /** Search panel illustration. Vesta colours only: no Google logo, blue or fonts. */
  panel: {
    label: 'Illustration',
    query: 'roof repair austin',
    before: {
      title: 'Home',
      url: 'haldenroofing.example/index.html',
      snippet: 'Welcome to Halden Roofing! Click here to learn more.',
    },
    after: {
      title: 'Halden Roofing · Roof repair and replacement in Austin, TX',
      url: concept.domain,
      snippet: 'Free inspections, written estimates, local crew. Call (512) 555-0147 or message on WhatsApp.',
      hours: 'Open · Closes 6 pm',
      faq: ['Do you handle storm damage claims?', 'Do you offer free inspections?'],
    },
    /** No stars and no review counts. */
    map: {
      name: 'Halden Roofing',
      category: 'Roofing contractor',
      status: 'Open',
      actions: ['Website', 'Directions', 'Call'],
    },
    /** State 5: 56px gauge showing this site's measured performance. */
    gaugeLabel: 'Speed',
    /** State 5 when this page's own score is under 90: an illustrated vitals check, no number claimed. */
    vitals: { metrics: ['LCP', 'INP', 'CLS'], note: 'Core Web Vitals, checked before launch' },
    /** State 6. */
    tracked: 'Calls tracked',
  },
  honesty:
    'No one can honestly promise a ranking. What Vesta promises is that every item above is done, and you can check each one.',
  source: {
    text: 'Google says local results are based mainly on relevance, distance and prominence.',
    citation: sources.googleLocalRanking.citation,
    url: sources.googleLocalRanking.url,
    accessed: 'September 2026',
  },
  replay: 'Replay',
  /** One line over the checklist; rows outside every package carry their own tag. */
  listHead: 'In every package, unless marked',
  /** Expand box holding the honesty line and the source. */
  more: { title: 'No ranking promises', keywords: ['Every item checkable', 'How Google ranks local results'] },
  cta: { label: 'Get my business found on Google →', text: waMessages.visibility } satisfies WaCta,
};

/* ------------------------------------------------------ 5.6 #test-drive */

export type ScoreKey = 'performance' | 'accessibility' | 'seo' | 'bestPractices';

/** The Test Drive section renders only if all four scores are at or above this (§5.6). */
const TEST_DRIVE_MIN_SCORE = 90;

export const testDrive = {
  id: 'test-drive',
  minScore: TEST_DRIVE_MIN_SCORE,
  /** Build-time gate. With today's measurements (best practices 82) this is false. */
  renders(m: Measurements): boolean {
    return [m.performance, m.accessibility, m.bestPractices, m.seo].every((v) => v >= TEST_DRIVE_MIN_SCORE);
  },
  label: { index: '05', name: 'Telemetry' } satisfies SectionLabel,
  h2: "Don't take adjectives on trust. Measure this page.",
  lead: "You're looking at a Vesta build right now. Here is its technical data, measured and not promised.",
  gauges: [
    { key: 'performance', label: 'Speed' },
    { key: 'accessibility', label: 'Accessibility' },
    { key: 'seo', label: 'Google SEO' },
    { key: 'bestPractices', label: 'Code quality' },
  ] satisfies { key: ScoreKey; label: string }[],
  /** "{n}/100" under each gauge. */
  score: (n: number): string => `${n}/100`,
  gaugeCaption: 'Scored by Google Lighthouse on a simulated phone. The 90–100 band is marked good.',
  table: [
    { label: 'Main content visible in', value: (m: Measurements) => `${(m.lcpMs / 1000).toFixed(1)} s` },
    { label: 'Time the page is blocked', value: (m: Measurements) => `${m.tbtMs} ms` },
    { label: 'Layout movement while loading', value: (m: Measurements) => String(m.cls) },
    { label: 'Home page weight, compressed', value: (m: Measurements) => `${m.transferKb} KB` },
    { label: 'Files requested', value: (m: Measurements) => String(m.requests) },
  ],
  /** Pass a formatted date (formatDate(m.date)) and m.tool. */
  footnote: (date: string, tool: string): string =>
    `Measured ${date} with ${tool}, median of three runs. Rebuilt and re-measured on every deploy. If the numbers get worse, this table says so.`,
  research: {
    text: 'Why speed matters: a 0.1-second faster mobile site lifted retail conversions by 8.4%.',
    source: { label: sources.deloitte.citation, href: sources.deloitte.url } satisfies Link,
  },
  /** Check module: a plain GET form to PageSpeed Insights. */
  check: {
    title: 'Now test the site you have.',
    body: "Paste its address. Google's free tool scores it on a simulated phone connection. Anything under 50 is marked poor.",
    form: { action: 'https://pagespeed.web.dev/analysis', method: 'get', name: 'url', target: '_blank', rel: 'noopener' },
    input: { label: 'Your website', placeholder: 'yourbusiness.com' },
    button: "Run Google's free test",
    follow: { label: 'Send your score to Vinícius →', text: waMessages.testDrive } satisfies WaCta,
  },
};

/* --------------------------------------------------------- 5.7 packages */

export interface Price {
  /** Lowest price in USD. */
  min: number;
  /** Highest price in USD; null when the price is "from" (quoted after a brief). */
  max: number | null;
  /** True when the price reads "from $X". */
  from: boolean;
  currency: 'USD';
  /** Exactly as rendered: '$500–$700', '$750', 'from $750'. */
  display: string;
  /** Sub-line under the price, or null. */
  sub: string | null;
  /** Owner-gated note under the price, or null. */
  note: Flagged | null;
}

export interface Package {
  id: PackageId;
  name: string;
  /** Short name for tight spots (mobile sticky summary). */
  shortName: string;
  tagline: string;
  /** Rosso flag above the column. Render only when confirmed. */
  recommended: Flagged | null;
  price: Price;
  /** Lead time on the dimension line (CSS uppercase): '5–7 business days'. */
  daysLabel: string;
  /** Compact lead time for the sticky summary: '5–7 days'. */
  daysShort: string;
  /** Lead time in business days [min, max]. Dimension line width = max / pricing.dayScaleMax. */
  dayRange: [number, number];
  bestFor: string;
  /** Exactly six rows, no checkmarks. */
  includes: Flagged[];
  /** Google setup included: the configurator shows the fixed "Google setup · included" row. */
  googleIncluded: boolean;
  /** WhatsApp CTA label. */
  cta: string;
  /** WhatsApp prefill for the CTA. */
  waText: string;
  /** Secondary link: the configurator with this package preselected. */
  configure: Link;
  /** Radio label in configurator step 01. */
  optionLabel: string;
}

export const packages: Package[] = [
  {
    id: 'landing',
    name: 'Landing Page',
    shortName: 'Landing Page',
    tagline: 'One page, one offer, built to turn visitors into conversations.',
    recommended: null,
    price: { min: 750, max: 1000, from: false, currency: 'USD', display: 'Price on analysis', sub: null, note: null },
    daysLabel: '5–7 business days',
    daysShort: '5–7 days',
    dayRange: [5, 7],
    bestFor: 'A launch, a single service, or a business that needs one sharp page now.',
    includes: [
      { text: 'Custom design and copy structure', confirmed: true },
      { text: 'Custom code, fast on phones', confirmed: true },
      { text: 'WhatsApp, call and form buttons wired to your inbox', confirmed: true },
      { text: 'Analytics and conversion tracking', confirmed: true },
      { text: 'Page titles, descriptions and Search Console setup', confirmed: true },
      { text: 'Code and accounts delivered to you', confirmed: true },
    ],
    googleIncluded: false,
    cta: 'Request a price analysis →',
    waText: waMessages.pricing.landing,
    configure: { label: 'Configure', href: '#configure?model=landing' },
    optionLabel: 'Landing Page',
  },
  {
    id: 'google',
    name: 'Landing Page + Google',
    shortName: '+ Google',
    tagline: 'The Landing Page, plus the technical and local Google setup that gets it found.',
    recommended: { text: 'Recommended for local businesses', confirmed: true },
    price: { min: 750, max: 1000, from: false, currency: 'USD', display: 'Price on analysis', sub: null, note: null },
    daysLabel: '7–10 business days',
    daysShort: '7–10 days',
    dayRange: [7, 10],
    bestFor: 'Local businesses that want the page to earn visits from Google, not only from links and ads.',
    includes: [
      { text: 'Everything in Landing Page', confirmed: true },
      { text: 'Sitemap submitted and indexing requested', confirmed: true },
      { text: 'Structured data (schema.org)', confirmed: true },
      { text: 'On-page SEO for your main services', confirmed: true },
      { text: 'Google Business Profile setup', confirmed: true },
      { text: 'Lighthouse report at launch', confirmed: true },
    ],
    googleIncluded: true,
    cta: 'Request a price analysis →',
    waText: waMessages.pricing.google,
    configure: { label: 'Configure', href: '#configure?model=google' },
    optionLabel: 'Landing Page + Google',
  },
  {
    id: 'complete',
    name: 'Complete Website',
    shortName: 'Complete',
    tagline: 'A multi-page website, new or rebuilt from the site you have.',
    recommended: null,
    price: {
      min: 750,
      max: 1000,
      from: false,
      currency: 'USD',
      display: 'Price on analysis',
      sub: 'The scope sets the price. It is fixed in writing before work starts.',
      note: null,
    },
    daysLabel: '2–3 weeks',
    daysShort: '2–3 weeks',
    dayRange: [10, 15],
    bestFor:
      'Businesses with several services, locations or audiences, and any business whose website no longer matches it.',
    includes: [
      { text: 'Home, Services, About, Contact and the pages your business needs', confirmed: true },
      { text: 'Local and technical SEO on every page', confirmed: true },
      { text: 'Content moved from your old site', confirmed: true },
      { text: 'Redirects so old links keep working', confirmed: true },
      { text: 'Google Business Profile setup', confirmed: true },
      { text: 'A direct line to the founder throughout', confirmed: true },
    ],
    googleIncluded: true,
    cta: 'Request a price analysis →',
    waText: waMessages.pricing.complete,
    configure: { label: 'Configure', href: '#configure?model=complete' },
    optionLabel: 'Complete Website',
  },
];

/** Looks up a package by id. */
export function getPackage(id: PackageId): Package {
  const found = packages.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown package: ${id}`);
  return found;
}

/* ---------------------------------------------------------- 5.7 #pricing */

export const pricing = {
  id: 'pricing',
  label: { index: '06', name: 'Pricing' } satisfies SectionLabel,
  h2: 'Three packages. One free price analysis.',
  lead: 'Tell Vesta what the business needs. The price comes from a free analysis and is fixed in writing before work starts.',
  /** The owner's observation (2026-09-23). Rendered once, near the packages. */
  rangeNote: {
    title: 'What a project usually costs',
    text: 'From system to system, a project runs $750–$1,000. The analysis often brings that number down.',
    range: '$750–$1,000',
  },
  analysisCta: 'Request a price analysis',
  /** Replaces the odometer price in each package. */
  priceLabel: 'Price on analysis',
  /** Ink-2, under the lead. */
  differentiator:
    'A landing page is one page for one offer. A complete website has a page for every service and location, quoted before any work starts.',
  labels: {
    bestFor: 'Best for',
    /** 11px label next to the price. */
    currency: 'USD',
    /** Expandable box toggle under each package. */
    includes: "What's included",
  },
  /** Business days that fill a full column on the dimension line (2–3 weeks). */
  dayScaleMax: 15,
  /** Round 2: keyword chips on each package and the visible keywords of the detail boxes (CSS uppercases). */
  keys: {
    landing: ['One page', 'Custom code', 'Tracking'],
    google: ['Google Business Profile', 'Schema', 'Indexing'],
    complete: ['Multi-page', 'Redirects', 'Local SEO'],
    compare: ['Pages', 'Google setup', 'Redirects', 'Ownership'],
    care: ['Hosting', 'Monitoring', 'Updates', 'Monthly report'],
    founding: ['Reduced price', 'Published case study'],
    paperwork: ['50/50', 'Contract in English', 'W-8BEN-E', 'USD'],
  } satisfies Record<PackageId | 'compare' | 'care' | 'founding' | 'paperwork', string[]>,
};

export type CompareCell = boolean | string;

export interface CompareRow {
  label: string;
  /** [Landing Page, + Google, Complete Website]. true = ■, false = —. */
  values: [CompareCell, CompareCell, CompareCell];
  confirmed: boolean;
}

export const compare = {
  /** <caption> (can be visually hidden). */
  caption: 'What each package includes',
  /** First header cell (can be visually hidden). */
  rowHeader: 'Included',
  columns: ['Landing Page', '+ Google', 'Complete Website'] as [string, string, string],
  /** Mobile <details> summary. */
  summary: 'Compare all three',
  included: { glyph: '■', label: 'Included' },
  notIncluded: { glyph: '—', label: 'Not included' },
  rows: [
    { label: 'Pages', values: ['One', 'One', 'Multi-page'], confirmed: true },
    { label: 'Design and build by the founder', values: [true, true, true], confirmed: true },
    { label: 'WhatsApp, call and form wiring', values: [true, true, true], confirmed: true },
    { label: 'Analytics and conversion tracking', values: [true, true, true], confirmed: true },
    { label: 'Titles, descriptions, Search Console', values: [true, true, true], confirmed: true },
    { label: 'Sitemap and indexing request', values: [false, true, true], confirmed: true },
    { label: 'Structured data', values: [false, true, true], confirmed: true },
    { label: 'Google Business Profile', values: [false, true, true], confirmed: true },
    { label: 'Redirects from an old site', values: [false, false, true], confirmed: true },
    { label: 'Lighthouse report at launch', values: [true, true, true], confirmed: true },
    { label: 'Revision rounds', values: ['2', '2', '2'], confirmed: true },
    { label: 'You own the code', values: ['100%', '100%', '100%'], confirmed: true },
  ] satisfies CompareRow[],
};

/** Care plan band (pricing) and every "Care" mention. */
export const care = {
  title: 'Care, after launch.',
  body: 'Hosting, monitoring, updates and a short monthly report. Priced with your project.',
  /** Care has no public price; it is always "priced with your project". */
  priced: 'with your project',
  cta: { label: 'Ask about Care →', text: waMessages.care } satisfies WaCta,
};

export type SlotStatus = 'open' | 'taken';

export interface FoundingSlot {
  n: number;
  status: SlotStatus;
}

/** Founding-clients program (confirmed). Never show a discount amount. */
export const founding = {
  confirmed: true,
  title: 'Founding clients: three places.',
  body: 'Vesta is new, so there are no borrowed logos here. The first three client projects are built at a reduced price, in exchange for permission to publish the work and its measured before-and-after. Real case studies, or none at all.',
  /** Rendered as "01 Open · 02 Open · 03 Open". */
  slots: [
    { n: 1, status: 'open' },
    { n: 2, status: 'open' },
    { n: 3, status: 'open' },
  ] satisfies FoundingSlot[],
  statusLabels: { open: 'Open', taken: 'Taken' } satisfies Record<SlotStatus, string>,
  cta: { label: 'Ask about a founding place →', text: waMessages.founding } satisfies WaCta,
};

/** Alias with the name used in spec §8.1. */
export const launchEdition = { slots: founding.slots };

/** "The fine print, printed large." Six cells, value / caption. */
export const paperwork = {
  title: 'The fine print, printed large.',
  cells: [
    { value: '50/50', caption: 'Half to start, half at launch' },
    { value: '2', caption: 'Revision rounds included' },
    { value: '100%', caption: 'Your code, design and content' },
    { value: 'EN', caption: 'Formal contract in English' },
    { value: 'W-8BEN-E', caption: 'On request, for your accountant' },
    { value: 'USD', caption: 'Stripe, Wise or international wire' },
  ],
};

export const terms = {
  /** Renders under the paperwork cells only when confirmed. */
  assurance: {
    text: "If the direction isn't right after the first design review, you pay only the first half and keep what was made.",
    confirmed: true,
  } satisfies Flagged,
};

/* -------------------------------------------------------- 5.8 #configure */

export interface SheetRow {
  key: 'package' | 'start' | 'options' | 'price' | 'delivery' | 'payment';
  label: string;
  value: string;
  /** Extra line under the value (Care note under the price), or null. */
  note: string | null;
}

/** Build-sheet rows for a selection (§5.8). Used by the static sheet and configure.ts. */
function buildSheetRows(sel: ConfigSelection): SheetRow[] {
  const p = getPackage(sel.packageId);
  const url = sel.currentUrl.trim();
  const start = sel.start === 'new' ? 'New website' : url ? `Rebuild: ${url}` : 'Rebuild my current site';
  return [
    { key: 'package', label: 'Package', value: p.name, note: null },
    { key: 'start', label: 'Starting point', value: start, note: null },
    { key: 'options', label: 'Options', value: sel.care ? 'Care plan' : 'None', note: null },
    { key: 'price', label: 'Price', value: 'Free price analysis', note: sel.care ? 'Care priced with your project' : 'Typical range $750–$1,000, often less' },
    { key: 'delivery', label: 'Delivery', value: p.daysLabel, note: null },
    { key: 'payment', label: 'Payment', value: '50% to start, 50% at launch', note: null },
  ];
}

/** Lowercase [a-z0-9], at most 24 characters (§5.8). Accents are stripped first. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 24);
}

const configDefaults: ConfigSelection = {
  packageId: 'google',
  start: 'new',
  currentUrl: '',
  care: false,
  business: '',
};

export const configure = {
  id: 'configure',
  label: { index: '07', name: 'Configure' } satisfies SectionLabel,
  h2: 'Put your name on it.',
  lead: 'Pick, name it, send. The build sheet arrives filled in.',
  /** No-JS state: Landing Page + Google preselected. */
  defaults: configDefaults,
  steps: {
    /** Round 2: optional first step. Options = the five concept niches + other. */
    industry: {
      index: '01',
      legend: 'Industry (optional)',
      other: 'Other',
      sheetLabel: 'Industry',
    },
    package: {
      index: '02',
      legend: 'Package',
      options: packages.map((p) => ({ id: p.id, label: p.optionLabel })),
    },
    start: {
      index: '03',
      legend: 'Starting point',
      options: [
        { id: 'new', label: 'New website' },
        { id: 'rebuild', label: 'Rebuild my current site' },
      ] satisfies { id: ConfigSelection['start']; label: string }[],
      /** Revealed when Rebuild is chosen. */
      currentUrl: { label: 'Current website (optional)', placeholder: 'yourbusiness.com' },
    },
    options: {
      index: '04',
      legend: 'Options',
      care: 'Care plan after launch · priced with your project',
      /** Fixed row for packages with `googleIncluded`. */
      googleIncluded: 'Google setup · included',
    },
    name: {
      index: '05',
      legend: 'Your name on it',
      business: { label: 'Business name (optional)', placeholder: 'Halden Roofing', maxLength: 48 },
    },
  },
  preview: {
    siteLabel: 'Your site · Preview',
    listingLabel: 'How it could appear on Google · Illustration',
    aria: concept.aria.mini,
    /** Complete fans the plate into these page plates. */
    fanPages: ['Home', 'Services', 'About', 'Contact', 'Locations'],
    /** Rebuild slides out a hairline ghost plate with this tag. */
    ghostLabel: 'Before',
    /** Round 2: the clickable page deck (Complete Website). */
    pages: {
      navLabel: 'Pages',
      navAria: 'Bring a page of the preview to the front',
      paths: ['', '/services', '/about', '/contact', '/locations'],
      services: { title: 'Services', sub: 'Free estimates. Clear prices.', cta: 'Get a quote' },
      about: { title: 'About', sub: 'Local, licensed, family-run.', years: ['2009', '2016', 'Today'] },
      contact: { title: 'Contact', fields: ['Name', 'Phone', 'Message'], send: 'Send', pin: 'Visit' },
      locations: { title: 'Locations', places: ['Downtown', 'North side', 'East side'], hours: 'Open today' },
    },
  },
  listing: {
    defaultUrl: concept.domain,
    defaultName: concept.name,
    /** `{slug}.com`, or the concept domain when the name is empty. */
    url(name: string): string {
      const slug = slugify(name);
      return slug ? `${slug}.com` : concept.domain;
    },
    /** `{Name} · Official website`. */
    title(name: string): string {
      return `${name.trim() || concept.name} · Official website`;
    },
    text: 'Vesta sets up everything Google needs to list your site. No one can honestly guarantee rankings.',
    /** Shown (smoke) instead of `text` when Landing Page is selected. */
    landingText: 'Choose Landing Page + Google or Complete Website to set this up properly.',
  },
  sheet: {
    title: 'Your build',
    rows: buildSheetRows,
  },
  cta: 'Send build sheet on WhatsApp',
  /** Round 2: secondary CTA, mailto with the build sheet as the body. */
  ctaEmail: 'Send by email',
  emailSubject: 'Build sheet · Vesta',
  note: 'Nothing is stored or sent until you press send.',
  message: configuratorMessage,
  /** Prefill for the no-JS CTA: the message for the default selection. */
  noJsText: configuratorMessage(configDefaults),
  /** Mobile sticky bar inside #configure, e.g. "+ Google · $750 · 7–10 days". */
  sticky: {
    summary(id: PackageId): string {
      const p = getPackage(id);
      return `${p.shortName} · ${p.daysShort}`;
    },
    send: 'Send',
  },
};

/* ---------------------------------------------------------- 5.9 #process */

export interface Milestone {
  /** Time label above the rail: 'Day 0', 'Days 1–4', 'After'. */
  time: string;
  title: string;
  body: string;
  /** Business days from the first message [start, end], for proportional placement. null = after launch. */
  span: [number, number] | null;
}

export interface ProcessPlan {
  id: PackageId;
  /** Tab label. */
  tab: string;
  /** Total lead time, same as the package. */
  total: string;
  /** Rail length in business days. */
  railDays: number;
  milestones: Milestone[];
  /** One-line version for no-JS (non-default plans render as this line). */
  summary: string;
}

const step = {
  conversation: 'A WhatsApp chat or a 15-minute call about the business and what the site has to do. You get a fixed price in writing.',
  kickoff: 'A short agreement in English and the first half. You send your logo, photos, services and prices.',
  design: 'The real design with your real content. First revision round.',
  build: 'Custom code, WhatsApp and forms wired, analytics installed. Second revision round.',
  google: 'Search Console, sitemap, structured data, Business Profile.',
  launch: 'Domain connected, Lighthouse report saved, repository and every login handed over. Second half due.',
  care: 'Hosting, monitoring, changes and a monthly report.',
};

function plan(id: PackageId, railDays: number, milestones: Milestone[]): ProcessPlan {
  const p = getPackage(id);
  return {
    id,
    tab: p.name,
    total: p.daysLabel,
    railDays,
    milestones,
    summary: `${p.name}: ${milestones.map((m) => `${m.time} ${m.title}`).join(' · ')}`,
  };
}

/**
 * Named `process` per the spec. Inside a component that imports it, the
 * Node global of the same name is shadowed; alias it if that matters.
 * Durations confirmed by the owner.
 */
export const process = {
  id: 'process',
  confirmed: true,
  label: { index: '08', name: 'Process' } satisfies SectionLabel,
  h2: 'From first message to launch.',
  sub: 'One person, start to finish. No hand-offs.',
  defaultPlan: 'google' as PackageId,
  plans: {
    /** Spec gives time and title only; bodies reuse the matching + Google steps. */
    landing: plan('landing', 7, [
      { time: 'Day 0', title: 'Conversation', body: step.conversation, span: [0, 0] },
      { time: 'Day 1', title: 'Kickoff', body: step.kickoff, span: [1, 1] },
      { time: 'Days 1–3', title: 'Design', body: step.design, span: [1, 3] },
      { time: 'Days 3–6', title: 'Build', body: step.build, span: [3, 6] },
      { time: 'Days 6–7', title: 'Launch', body: step.launch, span: [6, 7] },
    ]),
    /** Default tab. Copy verbatim from §5.9. */
    google: plan('google', 10, [
      { time: 'Day 0', title: 'Conversation', body: step.conversation, span: [0, 0] },
      { time: 'Day 1', title: 'Agreement and kickoff', body: step.kickoff, span: [1, 1] },
      { time: 'Days 1–4', title: 'Design', body: step.design, span: [1, 4] },
      { time: 'Days 4–8', title: 'Build', body: step.build, span: [4, 8] },
      { time: 'Days 7–9', title: 'Google setup', body: step.google, span: [7, 9] },
      { time: 'Days 9–10', title: 'Launch and handover', body: step.launch, span: [9, 10] },
      { time: 'After', title: 'Care, if you want it', body: step.care, span: null },
    ]),
    /** Spec gives time and title only; bodies reuse or adapt the + Google steps. */
    complete: plan('complete', 15, [
      {
        time: 'Days 0–2',
        title: 'Conversation and brief',
        body: 'A WhatsApp chat or a 15-minute call, then a short brief. You get a fixed quote in writing.',
        span: [0, 2],
      },
      { time: 'Week 1', title: 'Design', body: step.design, span: [1, 5] },
      { time: 'Week 2', title: 'Build', body: step.build, span: [6, 10] },
      {
        time: 'Weeks 2–3',
        title: 'Content, redirects and Google setup',
        body: 'Content moved from your old site and redirects set. Then Search Console, sitemap, structured data and Business Profile.',
        span: [6, 15],
      },
      { time: 'End of week 3', title: 'Launch', body: step.launch, span: [15, 15] },
    ]),
  } satisfies Record<PackageId, ProcessPlan>,
  whatYouBring: {
    title: 'What you bring',
    items: [
      'Your logo and any brand material',
      'Your offer, prices and service area',
      'Photos of real work and real people, or a budget to shoot them',
      'Access to your domain',
      'Access to analytics and ad accounts, if you have them',
    ],
    closing: 'Everything else is on Vesta.',
    /** Visible on the closed Expand box. */
    keywords: ['Logo', 'Offer and prices', 'Photos', 'Domain access'],
  },
  /** SMALL, ink-3. */
  note: 'The clock starts when the first payment and your materials arrive.',
};

/* --------------------------------------------------------- 5.10 #builder */

export const builder = {
  id: 'builder',
  label: { index: '09', name: 'The builder' } satisfies SectionLabel,
  h2: 'The person you message is the person who builds it.',
  paragraphs: [
    'Vesta is Vinícius Magno. A Computer Science graduate of Mackenzie Presbyterian University in São Paulo, Vinícius designs, builds and launches every Vesta site.',
    'No account managers, no junior hand-offs, no outsourcing. The person on WhatsApp is the person building your site.',
    'São Paulo is one to two hours ahead of New York, depending on the season. Working hours are 9:00–18:00 local time, which covers most of the US Eastern and Central business day.',
  ],
  /** Hairline rows. "Hours" replaces the spec's live "Local time" row. */
  facts: [
    { label: 'Education', value: founder.education },
    { label: 'Company', value: `${brand.legalName} · CNPJ ${brand.cnpj}` },
    { label: 'Based in', value: founder.location },
    { label: 'Hours', value: contact.hours.label },
  ] satisfies Fact[],
  cta: { label: 'Message Vinícius on WhatsApp', text: waMessages.builder } satisfies WaCta,
  /** Round 2: second channel next to WhatsApp (mailto via mail()). */
  email: { label: 'Email Vinícius', subject: 'A website for my business' },
  linkedin: { label: contact.linkedin.label, href: contact.linkedin.url } satisfies Link,
  /** Round 2: paragraphs 2–3 live in this Expand box; the lead stays visible. */
  more: { title: 'More about Vinícius', keywords: ['No hand-offs', 'No outsourcing', 'US business hours'] },
};

/* ------------------------------------------------------------- 5.11 #faq */

export interface FaqItem {
  q: string;
  a: string;
  /** false = hidden, and left out of the FAQPage JSON-LD. */
  confirmed: boolean;
}

/** Section chrome for the FAQ. The questions are in `faq`. */
export const faqSection = {
  id: 'faq',
  label: { index: '10', name: 'Questions' } satisfies SectionLabel,
  h2: 'Straight answers.',
  side: { label: 'Ask anything on WhatsApp →', text: waMessages.question } satisfies WaCta,
  /** Round 2: the same question by email (mailto via mail()). */
  email: { label: 'Or send it by email', subject: 'A question about Vesta' },
};

/** Render `confirmedOnly(faq)`. FAQPage JSON-LD uses the same filtered list. */
export const faq: FaqItem[] = [
  {
    q: 'Do you run paid ads?',
    a: 'No. Vesta designs and builds websites and sets them up for Google. If you run ads, the site is built for them, with fast pages and conversion tracking, and your ads manager keeps running the campaigns.',
    confirmed: true,
  },
  {
    q: 'Can you rebuild the website I already have?',
    a: 'Yes, and most projects start that way. The site is rebuilt in modern custom code on the same domain, with redirects so links and search results pointing to old pages keep working.',
    confirmed: true,
  },
  {
    q: 'Will I be on the first page of Google?',
    a: 'Nobody can honestly promise that. Vesta guarantees the technical work: a fast, indexable site with structured data, submitted to Search Console on launch day and, on Google packages, connected to your Business Profile. Where you rank then depends on your market and your content.',
    confirmed: true,
  },
  {
    q: 'How much does it cost?',
    a: 'Every project starts with a free price analysis. From system to system, projects run $750–$1,000, and the analysis often brings the price down. The price is fixed in writing before any work starts.',
    confirmed: true,
  },
  {
    q: 'How long does it take?',
    a: 'Landing Page: 5–7 business days. Landing Page + Google: 7–10 business days. Complete Website: 2–3 weeks. The date is written into the scope.',
    confirmed: true,
  },
  {
    q: 'Who owns the site?',
    a: 'You do: 100% of the code, design and content, delivered to your own accounts with every login.',
    confirmed: true,
  },
  {
    q: 'How do I pay from the US?',
    a: 'In US dollars by Stripe invoice, Wise or international wire. Half to start, half at launch. A W-8BEN-E is available on request.',
    confirmed: true,
  },
  {
    q: 'Is there a contract?',
    a: 'Yes. A formal service agreement in English covering scope, timeline, payment, revisions and ownership, signed before work starts.',
    confirmed: true,
  },
  {
    q: 'What about the time difference?',
    a: 'São Paulo is one to two hours ahead of New York, depending on the season. Vesta works 9:00–18:00 local time, which covers most of the US Eastern and Central business day.',
    confirmed: true,
  },
  {
    q: 'What happens if Vesta is unavailable after launch?',
    a: 'You own the code, the domain and every login from launch day, so any developer can take the site over.',
    confirmed: true,
  },
  {
    q: 'Are the concept studies real clients?',
    a: 'No. They are five studies by Vesta for fictional businesses in five different niches, labeled everywhere they appear. Client work will be published only with permission and measured results.',
    confirmed: true,
  },
  /* Hidden until the owner writes or approves the answers (§10 item 11). */
  {
    q: 'Can I update text, hours and prices myself?',
    a: '',
    confirmed: false,
  },
  {
    q: 'Where is the site hosted, and what does hosting cost?',
    a: '',
    confirmed: false,
  },
  {
    q: 'Why does a studio in Brazil cost less than a US agency?',
    a: 'One person, no account managers and lower overhead in São Paulo. The price reflects the structure, not shortcuts.',
    confirmed: false,
  },
];

/* ---------------------------------------------------------- 5.12 #finale */

export interface FinaleIntent {
  id: FinaleIntentId;
  label: string;
  text: string;
}

export const finale = {
  id: 'finale',
  h2: 'Send your current website. Get a free price analysis.',
  body: 'Paste the link, or the business name if there is no site yet. The answer comes from the person who would build it.',
  /** Radio group label for the chips. */
  intentsLabel: 'What do you need?',
  intents: [
    { id: 'new', label: 'New website', text: waMessages.finale.new },
    { id: 'rebuild', label: 'Rebuild my website', text: waMessages.finale.rebuild },
    { id: 'google', label: 'Google visibility', text: waMessages.finale.google },
    { id: 'question', label: 'Just a question', text: waMessages.finale.question },
  ] satisfies FinaleIntent[],
  button: {
    label: 'Open WhatsApp',
    /** Prefill before any chip is chosen. */
    text: waMessages.hero,
    /** Label after a chip is chosen: "Open WhatsApp: {intent}". */
    withIntent: (intentLabel: string): string => `Open WhatsApp: ${intentLabel}`,
  },
  /** Round 2: email next to WhatsApp. Subject = the chosen chip's label
      (before a choice: contact.email.subject); body = the same prefill. */
  email: { label: 'Email', address: contact.email.address, aria: 'Email Vinícius at' },
  number: {
    display: contact.whatsapp.display,
    copy: 'Copy number',
    copied: 'Copied',
    /** How long "Copied" shows. */
    copiedMs: 1600,
  },
  reassurance: 'A Brazilian number. WhatsApp messages are free from any country.',
  secondary: [
    { label: contact.linkedin.label, href: contact.linkedin.url },
    { label: 'See the packages', href: '/#pricing' },
  ] satisfies Link[],
};

/* ------------------------------------------------------------ 5.13 footer */

export const footer = {
  brand: {
    blurb: 'Website design and build studio in São Paulo.',
    tagline: brand.tagline,
  },
  columns: {
    pricing: {
      title: 'Pricing',
      links: [
        { label: 'Landing Page', href: '/#pricing' },
        { label: 'Landing Page + Google', href: '/#pricing' },
        { label: 'Complete Website', href: '/#pricing' },
        { label: 'Free price analysis', href: '/#pricing' },
        { label: 'Care, priced with your project', href: '/#pricing' },
      ] satisfies Link[],
    },
    studio: {
      title: 'Studio',
      links: [
        { label: 'About', href: '/about/' },
        { label: 'Work', href: '/work/' },
        { label: 'Contact', href: '/contact/' },
        { label: 'Privacy', href: '/privacy/' },
      ] satisfies Link[],
    },
    contact: {
      title: 'Contact',
      whatsapp: { label: `WhatsApp ${contact.whatsapp.display}`, text: waMessages.hero } satisfies WaCta,
      linkedin: { label: contact.linkedin.name, href: contact.linkedin.url } satisfies Link,
      /** Static hours where the spec had a live clock. */
      hours: contact.hours.label,
      offset: contact.hours.offsetLine,
    },
  },
  /**
   * The orbit diagram (SPEC_COSMOS §4): Mars, 4 Vesta and Jupiter to scale.
   * Semi-major axes in AU; Vesta's eccentricity drawn true.
   */
  orbit: {
    caption: '4 Vesta · a 2.36 AU · 3.63-year orbit',
    bodies: [
      { name: 'Mars', a: 1.52, e: 0.093 },
      { name: '4 Vesta', a: 2.36, e: 0.089 },
      { name: 'Jupiter', a: 5.2, e: 0.049 },
    ],
  },
  /** SMALL dim. Pass measurements.performance and a formatted date. */
  buildLine: (performance: number, date: string): string =>
    `Designed and built by Vinícius Magno in São Paulo. This page: Lighthouse mobile performance ${performance}, measured ${date}.`,
  /** Labels for the existing `data-motion-toggle` (motion.ts sets them at runtime too). */
  motion: {
    on: 'Motion: on',
    off: 'Motion: off',
    ariaReduce: 'Reduce motion',
    ariaRestore: 'Turn motion on',
  },
  backToTop: 'Back to top ↑',
};

/* =========================================================================
   INNER PAGES (§7)
   ========================================================================= */

/* ------------------------------------------------------------------ about */

export const about = {
  seo: {
    title: 'About · Vesta',
    description:
      'Vesta is one person: Vinícius Magno, who designs, builds and launches every site. Company facts, working hours and how Vesta works.',
  } satisfies Seo,
  label: { index: null, name: 'About' } satisfies SectionLabel,
  h1: "The studio is one person. That's the point.",
  lead: 'Vinícius Magno designs, builds and launches every Vesta website personally.',
  /** Portrait section (same `founder.portrait.confirmed` gate). */
  bio: [
    'Most small-business sites are built from templates by people the owner never meets. Vesta is the opposite: one builder, custom code, a fixed price in writing.',
    'Vinícius holds a B.S. in Computer Science from Mackenzie Presbyterian University in São Paulo.',
    'One builder means nothing gets lost between the first message and the code. The person who hears the brief is the person who builds the site.',
  ],
  howVestaWorks: {
    title: 'How Vesta works',
    items: [
      'A free price analysis, then a fixed price.',
      'The person you talk to builds the site.',
      'You own everything at launch.',
      'Measured, not claimed: every launch ships with its Lighthouse report.',
      'Websites and Google setup. No ads, no ranking promises.',
    ],
  },
  /** Static replacement for the spec's live 24-hour bands. */
  hours: {
    title: "Your hours and São Paulo's",
    body: 'São Paulo is one to two hours ahead of New York, depending on the season. Working hours cover most of the US Eastern and Central business day.',
    hours: contact.hours.label,
  },
  companyFacts: {
    title: 'Company facts',
    rows: [
      { label: 'Legal name', value: brand.legalName },
      { label: 'CNPJ', value: brand.cnpj },
      { label: 'Based in', value: 'São Paulo, Brazil' },
      { label: 'Contracts', value: 'Formal agreement in English' },
      { label: 'Invoicing', value: 'USD via Stripe, Wise or international wire' },
      { label: 'Tax form', value: 'W-8BEN-E on request' },
    ] satisfies Fact[],
  },
  theName: {
    title: 'The name',
    text: 'Vesta is named after 4 Vesta, the brightest asteroid in the sky and the only one sometimes visible to the naked eye. Heinrich Olbers found it on 29 March 1807. It circles the Sun between Mars and Jupiter every 3.63 years.',
    /** One line on the older meaning of the name. */
    closing: { text: "Long before the asteroid, Vesta was the Roman goddess of the hearth, whose fire was never allowed to go out.", confirmed: true } satisfies Flagged,
    source: {
      publisher: 'NASA Science',
      title: '4 Vesta',
      year: null,
      accessed: 'September 2026',
      url: 'https://science.nasa.gov/solar-system/asteroids/4-vesta/',
      citation: 'NASA Science, "4 Vesta", accessed September 2026',
    },
  },
  /** Closing: render the finale module in compact form (reuse `finale`). */
  /** Round 2: the detail lives in expandable boxes; titles + keywords stay visible. */
  more: {
    builder: { title: 'One builder', keywords: ['Custom code', 'No hand-offs'] },
    background: { title: 'Background', keywords: ['B.S. Computer Science', 'Mackenzie'] },
    entity: { title: 'Legal entity', keywords: ['Vesta Consultoria', 'CNPJ'] },
    paperwork: { title: 'Contracts and invoicing', keywords: ['In English', 'USD', 'W-8BEN-E'] },
    overlap: { keywords: ['1–2 hours ahead of New York'] },
    story: { title: 'The story', keywords: ['Found in 1807', '3.63-year orbit', 'Goddess of the hearth'] },
    orbit: { title: 'The orbit, to scale', keywords: ['2.36 AU', '3.63 years', 'Mars to Jupiter'] },
  },
  /** Round 3: the 3D asteroid in "The name" (NASA Dawn shape figures). */
  asteroid: { name: '4 Vesta', dims: '572 × 557 × 446 km', mean: '≈ 525 km', hint: 'Drag to turn it' },
  /** Label beside the Sun in the orbit diagram. */
  sun: 'Sun',
  /** Closing: the email companion to the WhatsApp button. */
  emailButton: 'Send an email',
};

/* ---------------------------------------------------------------- contact */

export interface QuickStart {
  id: QuickStartId;
  label: string;
  text: string;
}

export const contactPage = {
  seo: {
    title: 'Contact · Vesta',
    description:
      'Message Vinícius Magno on WhatsApp or by email for a free price analysis on a new or rebuilt website. Replies Mon–Fri, 9:00–18:00 São Paulo time.',
  } satisfies Seo,
  label: { index: null, name: 'Contact' } satisfies SectionLabel,
  h1: 'Talk to the person who builds it.',
  lead: 'WhatsApp or email, straight to Vinícius. Replies Mon–Fri, 9:00–18:00 São Paulo time (UTC−3).',
  /** The email line under the lead: the address set large, copyable. */
  email: { label: 'Email', write: 'Write an email', copy: 'Copy address', copied: 'Copied' },
  /** Faceted violet panel: the number at N2, then three starlight quick-starts. */
  panel: {
    label: 'WhatsApp',
    number: contact.whatsapp.display,
    quickStarts: [
      { id: 'newSite', label: 'I need a new website', text: waMessages.contact.newSite },
      { id: 'rebuild', label: 'I want to rebuild my current site', text: waMessages.contact.rebuild },
      { id: 'landing', label: 'I need a landing page', text: waMessages.contact.landing },
    ] satisfies QuickStart[],
  },
  /** Desktop QR code for the generic link, generated at build time. */
  qr: {
    target: contact.whatsapp.url,
    caption: 'Scan to continue on your phone.',
  },
  /** Optional composer; stores nothing. Hidden without JS. */
  helper: {
    title: 'Message helper',
    fields: {
      business: { label: 'Business name' },
      currentUrl: { label: 'Current website (optional)', placeholder: 'yourbusiness.com' },
      need: {
        legend: 'What you need',
        options: [
          { id: 'new', label: 'New website' },
          { id: 'rebuild', label: 'Rebuild' },
          { id: 'google', label: 'Google visibility' },
          { id: 'question', label: 'A question' },
        ] satisfies { id: HelperNeed; label: string }[],
      },
      extra: { label: 'Anything else' },
    },
    button: 'Open in WhatsApp',
    emailButton: 'Send by email',
    preview: 'Your message',
    note: 'Nothing is sent to Vesta or stored. Each button opens your app with the message ready; you choose whether to send it.',
    message: contactHelperMessage,
  },
  include: {
    title: 'What to include in your first message',
    items: [
      { index: '01', text: 'What the business does and where' },
      { index: '02', text: 'The website you have now, if any' },
      { index: '03', text: 'What the site has to achieve' },
      { index: '04', text: 'Your deadline' },
    ],
  },
  linkedin: { title: 'LinkedIn', label: contact.linkedin.name, href: contact.linkedin.url },
  /** Static hours; the spec's four clocks are removed. */
  hours: { title: 'Hours', text: contact.hours.label, offset: contact.hours.offsetLine },
  company: {
    title: 'Company',
    rows: [
      { label: 'Legal name', value: brand.legalName },
      { label: 'CNPJ', value: brand.cnpj },
      { label: 'Based in', value: 'São Paulo, Brazil' },
    ] satisfies Fact[],
  },
  configureLink: { label: 'Or configure a build →', href: '/#configure' } satisfies Link,
  /** Round 2: keywords for the expandable boxes on /contact/. */
  more: {
    include: { keywords: ['The business', 'Current site', 'Goal', 'Deadline'] },
    company: { keywords: ['CNPJ', 'São Paulo, Brazil'] },
  },
};

/* ------------------------------------------------------------------- work */

export const work = {
  seo: {
    title: 'Work · Vesta',
    description:
      'Vesta publishes client work only with permission and measured numbers. Three founding-client places are open.',
  } satisfies Seo,
  label: { index: null, name: 'Work' } satisfies SectionLabel,
  h1: 'No borrowed logos.',
  lead: "Vesta publishes client work only with the client's permission and measured numbers. The first three client projects are being built now.",
  /** Founding-clients list and CTA: reuse `founding.slots`, `founding.statusLabels`, `founding.cta`. */
  founding: {
    title: founding.title,
    cta: founding.cta,
  },
  concept: {
    title: 'Concept 01 · A study',
    /** LABEL in rosso-hi. */
    label: 'Concept · Fictional business',
    text: 'A fictional roofing company in Austin, TX, and its website before and after a rebuild. Not client work.',
    link: { label: 'Open the study →', href: '/work/concept-01/' } satisfies Link,
  },
  /** Round 2: the five-study gallery on /work/ (data: src/data/concepts). */
  studies: {
    label: 'Concept studies · Fictional businesses',
    title: 'Five niches, five rebuilds.',
    lead: 'Fictional businesses, common problems. Each study shows the old site, the rebuild and how it is built.',
    open: 'Open the study',
    before: 'Before',
    foundingMore: { title: 'How a founding place works', keys: ['Reduced price', 'Published case study'] },
  },
};

/* ------------------------------------------------------ /work/concept-01/ */

export const conceptPage = {
  seo: {
    title: 'Concept 01, a study · Vesta',
    description:
      'Concept 01 is a study by Vesta: a fictional roofing company and its website, before and after a rebuild. Not client work.',
    noindex: true,
  } satisfies Seo,
  /** Persistent top banner (graphite). */
  banner: 'Concept study. Halden Roofing is a fictional business. This is not client work.',
  label: { index: null, name: 'Concept 01' } satisfies SectionLabel,
  h1: 'Halden Roofing, rebuilt.',
  lead: 'A study by Vesta. The business is fictional. The problems it shows are common.',
  brief: {
    title: 'The brief (fictional)',
    text: 'Halden Roofing, a roofing company in Austin, TX, is rebuilding a 2016 template site.',
  },
  before: { title: 'Before', annotations: concept.annotations.before },
  after: { title: 'After', annotations: concept.annotations.after },
  /** Static exploded view: reuse `build.layers`. */
  layers: { title: 'The six layers' },
  pricing: {
    title: 'How it would be priced',
    text: 'This scope would be a Complete Website, priced after a free analysis.',
    cta: { label: 'Ask for a quote on WhatsApp →', text: waMessages.pricing.complete } satisfies WaCta,
  },
  /** Round 2: the study template (/work/concept-NN/), shared by all five concepts. */
  study: {
    banner: (name: string) => `Concept study. ${name} is a fictional business. This is not client work.`,
    seoTitle: (n: string) => `Concept ${n}, a study · Vesta`,
    seoDescription: (niche: string, city: string) =>
      `A study by Vesta: a fictional ${niche.toLowerCase()} in ${city} and its website, before and after a rebuild. Not client work.`,
    facts: { niche: 'Niche', city: 'City', domain: 'Domain', phone: 'Phone', status: 'Status' },
    status: 'Fictional',
    before: { kicker: 'The 2016 template', title: 'Before' },
    after: { kicker: 'Rebuilt by Vesta', title: 'After' },
    findings: 'Findings',
    layers: { kicker: 'How it is built', title: 'The six layers', more: 'What each layer does' },
    pricing: {
      kicker: 'Price',
      title: 'How it would be priced',
      line: 'Priced after a free analysis.',
      text: 'This scope would be a Complete Website. The price comes from a free analysis, fixed in writing before work starts.',
      cta: 'Request a price analysis',
      mail: 'Or write by email',
    },
    next: { label: 'Next study', all: 'All five studies' },
  },
};

/* ---------------------------------------------------------------- privacy */

export interface PrivacyClause {
  id: string;
  title: string;
  paragraphs: string[];
  links: Link[];
}

export const privacy = {
  seo: {
    title: 'Privacy · Vesta',
    description: 'What this website collects, which is nothing by default, and how to ask Vesta about your data.',
  } satisfies Seo,
  h1: 'Privacy',
  /** ISO date; render as "Last updated {formatDate(updated)}". */
  updated: '2026-09-22',
  updatedLabel: 'Last updated',
  /** Sticky clause index title. */
  indexTitle: 'On this page',
  clauses: [
    {
      id: 'who',
      title: 'Who runs this site',
      paragraphs: [`This site is run by ${brand.legalName}, CNPJ ${brand.cnpj}, based in São Paulo, Brazil.`],
      links: [],
    },
    {
      /* Keep this clause true: update it the day any cookie, analytics or third-party font is added. */
      id: 'collects',
      title: 'What this site collects',
      paragraphs: [
        'This site sets no cookies and runs no analytics or advertising scripts. Fonts are served from this site, not from a third party.',
        'One preference is stored in your browser: the Motion on/off setting, saved in localStorage under the key "vesta-motion". It never leaves your device.',
      ],
      links: [],
    },
    {
      id: 'configurator',
      title: 'The configurator and message helper',
      paragraphs: [
        'Both run entirely in your browser. Nothing you type is stored or sent to Vesta.',
        'The button opens WhatsApp with your message ready. Nothing is sent until you press send there.',
      ],
      links: [],
    },
    {
      id: 'third-parties',
      title: 'WhatsApp and LinkedIn',
      paragraphs: [
        'Links to WhatsApp and LinkedIn open services run by third parties, under their own privacy policies.',
        'Messages you send there are used only to answer you and, if you hire Vesta, to deliver the project.',
      ],
      links: [
        { label: 'WhatsApp privacy policy ↗', href: 'https://www.whatsapp.com/legal/privacy-policy' },
        { label: 'LinkedIn privacy policy ↗', href: 'https://www.linkedin.com/legal/privacy-policy' },
      ],
    },
    {
      id: 'hosting',
      title: 'Hosting',
      paragraphs: [
        'The site is hosted on GitHub Pages. GitHub may keep standard server logs, such as IP address, browser and requested page, for security.',
      ],
      links: [
        {
          label: 'GitHub privacy statement ↗',
          href: 'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
        },
      ],
    },
    {
      id: 'requests',
      title: 'Your requests',
      paragraphs: [
        'To ask what Vesta holds about you, or to have it corrected or deleted, message Vinícius on WhatsApp or LinkedIn.',
      ],
      links: [
        { label: 'WhatsApp', href: contact.whatsapp.url },
        { label: 'LinkedIn ↗', href: contact.linkedin.url },
      ],
    },
  ] satisfies PrivacyClause[],
};

/* -------------------------------------------------------------------- 404 */

export const notFound = {
  seo: {
    title: 'Page not found · Vesta',
    description: "This page doesn't exist. The rest of the site does.",
    noindex: true,
  } satisfies Seo,
  numeral: '404',
  /** Label on the framing dimension lines (CSS uppercase). */
  dimension: 'Route not found',
  text: "This page doesn't exist. The rest of the site does.",
  links: [
    { label: 'Home', href: '/' },
    { label: 'Pricing', href: '/#pricing' },
  ] satisfies Link[],
  cta: primaryCta,
};

/* ------------------------------------------------------------------ legal */

export const legal = {
  privacyUrl: '/privacy/',
  copyright: `© ${new Date().getFullYear()} ${brand.legalName} · CNPJ ${brand.cnpj} · ${brand.city}, ${brand.country}`,
};
