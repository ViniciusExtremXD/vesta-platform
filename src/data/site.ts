/* =========================================================================
   Vesta — single source of truth for every word and number on the site.
   No component hard-codes copy. Everything lives here.

   Convention: anything marked `confirmed: false` is NOT rendered. It is a
   to-do list for the owner, not content. No invented number ships.
   ========================================================================= */

export interface NavItem {
  label: string;
  href: string;
}

export interface Situation {
  index: string;
  title: string;
  body: string;
}

export interface ResearchStat {
  value: string;
  text: string;
  source: string;
  year: number;
  url: string;
}

export interface ComparisonRow {
  dimension: string;
  usual: string;
  vesta: string;
}

export interface Offer {
  id: string;
  name: string;
  price: string;
  cadence?: string;
  terms: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}

export interface ProcessStep {
  index: string;
  title: string;
  when: string;
  body: string;
}

export interface Vertical {
  slug: string;
  label: string;
}

export interface Faq {
  q: string;
  a: string;
}

/* ------------------------------------------------------------------ brand */

export const brand = {
  name: 'Vesta',
  mark: 'VESTA',
  legalName: 'Vesta Consultoria',
  cnpj: '61.465.539/0001-00',
  city: 'São Paulo',
  country: 'Brazil',
  coordinates: '23.55° S · 46.63° W',
  tagline: 'Websites and landing pages engineered for paid traffic.',
  description:
    'Vesta designs and builds custom, sub-second websites and landing pages for businesses that run paid traffic — built and shipped by the founder, on US business hours.',
  seo: {
    title: 'Vesta — Websites and landing pages engineered for paid traffic',
    description:
      'Custom-coded, sub-second websites and landing pages for businesses running Google, Meta or Local Services ads. Fixed public pricing. Built by the founder you talk to.',
  },
};

/* ---------------------------------------------------------------- contact */

export const contact = {
  whatsapp: {
    display: '+55 11 91029-2004',
    e164: '5511910292004',
    url: 'https://wa.me/5511910292004?text=Hi%20Vinicius%2C%20I%20found%20Vesta%20and%20want%20to%20talk%20about%20a%20project.',
    confirmed: true,
  },
  email: {
    address: 'vinicius@vesta.systems',
    // Domain mailbox not confirmed yet. Until it is, the site shows no e-mail
    // at all: a personal Gmail as the business contact costs more trust than
    // it earns.
    confirmed: false,
  },
  linkedin: {
    url: 'https://www.linkedin.com/in/vinicius-magno-vesta/',
    confirmed: true,
  },
  booking: {
    // Replace with the real Calendly event URL, then flip `confirmed`.
    calendlyUrl: 'https://calendly.com/vesta-systems/15-min-call',
    label: 'Book a 15-minute call',
    confirmed: false,
  },
  hours: {
    timeZone: 'America/Sao_Paulo',
    start: 9,
    end: 18,
    label: '9am – 6pm São Paulo (UTC−3)',
  },
};

export const nav: NavItem[] = [
  { label: 'Work', href: '/work/' },
  { label: 'Services', href: '/#services' },
  { label: 'Process', href: '/#process' },
  { label: 'About', href: '/about/' },
  { label: 'Contact', href: '/contact/' },
];

export const primaryCta = { label: 'Book a 15-minute call', href: '/contact/' };

/* ------------------------------------------------------------------- hero */

export const hero = {
  kicker: 'Sites & landing pages for paid traffic',
  /** Words inside <em> render in the editorial italic. Keep it one phrase. */
  headline: 'You already pay for the click. We build the page that <em>turns it into a customer.</em>',
  lead:
    'Custom-coded websites and landing pages for businesses running Google, Meta or Local Services ads — most of them in the United States. Sub-second on mobile. Built and shipped by the founder you talk to, on your business hours.',
  primary: primaryCta,
  secondary: { label: 'See fixed pricing', href: '/#services' },
  /** Facts about THIS page. Each one is verifiable by the visitor. */
  facts: [
    { label: 'Third-party scripts on this page', value: '0', note: 'until you open the scheduler' },
    { label: 'Framework shipped to your phone', value: '0 kB', note: 'static HTML + CSS' },
  ],
};

/* ---------------------------------------------------------------- situation */

export const situations: { kicker: string; title: string; items: Situation[] } = {
  kicker: 'Is this you?',
  title: 'Three situations. One fix: <em>a page built to convert the traffic you already pay for.</em>',
  items: [
    {
      index: '01',
      title: 'You buy traffic and the page leaks it.',
      body: 'Google Ads, Local Services, Meta — the click costs the same whether the page loads in one second or five. Most of the waste happens after the click, on a page nobody ever measured.',
    },
    {
      index: '02',
      title: 'Your site is older than your best competitor’s.',
      body: 'A slow, template-built site tells the visitor to price-shop. The competitor with the sharper site wins the job before your phone rings.',
    },
    {
      index: '03',
      title: 'You need one page for one campaign — not a new website.',
      body: 'A dedicated landing page, built for one offer and one audience, ships in days and can be measured on its own. No redesign required.',
    },
  ],
};

/* --------------------------------------------------------------- manifesto */

export const manifesto = {
  kicker: 'The cost of a slow page',
  title: 'A six-dollar click that lands on a five-second page is a <em>six-dollar donation.</em>',
  paragraphs: [
    'Paid traffic turned page speed into a line item. Every second of mobile load time is a slice of the budget that never reaches the offer, the form or the phone number.',
    'The research below is public and old enough to be boring. What is rare is a page actually built to act on it — and a builder who publishes the numbers.',
  ],
  research: [
    {
      value: '53%',
      text: 'of mobile visits are abandoned when a page takes longer than three seconds to load.',
      source: 'Google, “Mobile page speed: new industry benchmarks”',
      year: 2017,
      url: 'https://www.thinkwithgoogle.com/marketing-strategies/app-and-mobile/mobile-page-speed-new-industry-benchmarks/',
    },
    {
      value: '+32%',
      text: 'bounce probability when load time goes from one second to three. At five seconds: +90%.',
      source: 'Google / SOASTA research, same study',
      year: 2017,
      url: 'https://www.thinkwithgoogle.com/marketing-strategies/app-and-mobile/mobile-page-speed-new-industry-benchmarks/',
    },
    {
      value: '+8.4%',
      text: 'retail conversions from a 0.1-second improvement in mobile site speed. Travel: +10.1%.',
      source: 'Deloitte Digital, “Milliseconds Make Millions”',
      year: 2020,
      url: 'https://www.deloitte.com/ie/en/services/consulting/research/milliseconds-make-millions.html',
    },
  ] as ResearchStat[],
  check: {
    title: 'Check the page your ads are paying for.',
    body: 'Paste your URL into Google’s PageSpeed Insights and read the mobile score. Under 50 means the page is losing the click before it loads.',
    label: 'Open PageSpeed Insights',
    url: 'https://pagespeed.web.dev/',
  },
  comparison: {
    title: 'What changes when the person who sells it is the person who builds it.',
    usualLabel: 'The pattern we replace',
    vestaLabel: 'Vesta',
    rows: [
      { dimension: 'Who builds it', usual: 'A page builder, a theme, and whoever is available that week.', vesta: 'The founder writes every line of it, by hand.' },
      { dimension: 'Who you talk to', usual: 'Account manager → project manager → subcontractor.', vesta: 'One person: the one writing the code.' },
      { dimension: 'What ships', usual: 'A theme with plugins on a hosting plan you rent.', vesta: 'Static, custom code you own outright. Hosts anywhere, for about nothing.' },
      { dimension: 'Speed', usual: '“We can optimise it later.”', vesta: 'Measured with Lighthouse before launch. Score published with the case.' },
      { dimension: 'Price', usual: 'A quote after three meetings.', vesta: 'Public and fixed. It is on this page.' },
      { dimension: 'Hours', usual: 'Overnight replies from a different hemisphere.', vesta: 'The same business hours as your team, one to two hours ahead of New York.' },
    ] as ComparisonRow[],
  },
};

/* ------------------------------------------------------------------ offers */

export const offers: { kicker: string; title: string; lead: string; items: Offer[] } = {
  kicker: 'Services & pricing',
  title: 'Three ways to work together. <em>Prices are public and fixed.</em>',
  lead: 'Nobody should pay extra for being a worse negotiator. Every price below is the price.',
  items: [
    {
      id: 'landing-page',
      name: 'Campaign landing page',
      price: '$1,500',
      terms: 'Fixed price · ready in 7–10 business days',
      description: 'One page, one offer, one audience. Built to receive paid traffic and to be measured on its own.',
      features: [
        'Copy, design and build for a single offer',
        'Click-to-call and a short lead form above the fold',
        'Leads delivered to your CRM, inbox or booking tool',
        'Sub-second mobile load, measured with Lighthouse before launch',
        'Conversion tracking wired for Google and Meta ads',
      ],
    },
    {
      id: 'website',
      name: 'Complete website',
      price: '$3,500 – $5,000',
      terms: 'Fixed quote after one call · 3–5 weeks',
      description: 'Home, services, service areas, about, reviews and contact. The full authority site, delivered as static code you own.',
      features: [
        'Up to eight pages, each with its own search intent',
        'Service-area and industry pages built to rank locally',
        'Real project galleries and review embeds — no stock photography',
        'Structured data, sitemap and metadata done properly',
        'Integrations with your CRM, dispatch or booking tool',
        'Sub-second load site-wide, measured before launch',
      ],
      highlighted: true,
    },
    {
      id: 'care-plan',
      name: 'Care plan',
      price: '$250 – $450',
      cadence: '/month',
      terms: 'Monthly · cancel any time',
      description: 'Hosting, monitoring, monthly changes and a monthly report of what the site actually did.',
      features: [
        'Fast static hosting with a global CDN',
        'Uptime and speed monitoring, with alerts',
        'Monthly copy, design and offer changes',
        'A monthly report: visits, leads, calls, speed',
        'Direct line to the person who built it',
      ],
    },
  ],
};

/* ----------------------------------------------------------------- process */

export const process: { kicker: string; title: string; steps: ProcessStep[]; youProvide: string[] } = {
  kicker: 'How it works',
  title: 'From first call to measured launch, <em>without a single hand-off.</em>',
  steps: [
    { index: '01', title: '15-minute call', when: 'Day 0', body: 'You describe the business, the traffic and what the page has to do. I ask the questions a builder asks. No pitch deck.' },
    { index: '02', title: 'Scope and fixed quote', when: 'Within 48 hours', body: 'A one-page scope: pages, integrations, timeline, price. You sign a short service agreement and pay the first half.' },
    { index: '03', title: 'Copy and design', when: 'Week 1', body: 'Wireframe, then the real design with the real copy. One review call. Two revision rounds are included.' },
    { index: '04', title: 'Build and integrations', when: 'Weeks 1–3', body: 'Hand-written static code. Forms, calls and bookings wired into the tools you already use. Tracking configured.' },
    { index: '05', title: 'Measured launch', when: 'Launch day', body: 'Lighthouse run on the final build and saved with the project. DNS switched. You get the repository and every credential.' },
    { index: '06', title: 'Care, if you want it', when: 'After launch', body: 'Optional monthly plan for hosting, monitoring, changes and a report of what the site did.' },
  ],
  youProvide: [
    'Logo and any brand material you already have',
    'The offer, the prices and the service area',
    'Photos of real work and real people (or a budget to shoot them)',
    'Access to your ads account and analytics',
    'Access to your domain’s DNS',
  ],
};

/* ---------------------------------------------------------------- verticals */

export const verticals: { kicker: string; title: string; note: string; items: Vertical[] } = {
  kicker: 'Industries',
  title: 'Built for businesses that <em>sell a service and buy traffic.</em>',
  note: 'Industry pages go live only when there is a published case study behind them.',
  items: [
    { slug: 'hvac', label: 'HVAC' },
    { slug: 'roofing', label: 'Roofing' },
    { slug: 'plumbing', label: 'Plumbing' },
    { slug: 'remodeling', label: 'Remodeling' },
    { slug: 'dental', label: 'Dental clinics' },
    { slug: 'legal', label: 'Law firms' },
    { slug: 'fitness', label: 'Gyms & studios' },
    { slug: 'clinics', label: 'Clinics & med-spas' },
    { slug: 'ecommerce', label: 'E-commerce' },
    { slug: 'home-services', label: 'Home services' },
  ],
};

/* ----------------------------------------------------------------- founder */

export const founder = {
  name: 'Vinícius Magno',
  role: 'Founder & Principal Architect',
  kicker: 'The founder',
  title: 'No intermediaries. No junior hand-offs. <em>You work directly with the architect.</em>',
  quote:
    'Design without conversion math is decoration. Vesta exists to close the gap between a site that looks right and a site that pays for itself.',
  bio: [
    'Vinícius designs, writes and ships every Vesta project personally. There is no account manager, no project manager and no subcontractor between you and the person writing the code.',
    'His background is computer science, distributed systems and automation — which is why a Vesta page is built the way software is built: measured, versioned, and yours.',
  ],
  credentials: [
    'Computer science — Mackenzie Presbyterian University, São Paulo',
    'Distributed systems, AI automation and revenue platforms',
    'Every Vesta project built and shipped personally',
  ],
  timezone: {
    title: 'Same business hours as your team.',
    body: 'São Paulo runs one to two hours ahead of New York, depending on daylight saving. A nine-to-six day here covers the Eastern and Central business day almost entirely — you get replies while you are at your desk, not overnight.',
  },
  location: 'São Paulo, Brazil · UTC−3',
  portrait: {
    // The only portrait on disk (src/assets/vinicius-magno.jpg) carries a
    // baked-in "AI-generated content" label. Cropping the disclosure out
    // would be dishonest; showing it under "you work with the architect"
    // costs trust. Until a real, unedited photo replaces the file, the
    // founder frame renders typographically. Flip to true when it does.
    confirmed: false,
  },
};

/* ----------------------------------------------------------------- terms */

export const terms = {
  payment:
    'Card or bank transfer in US dollars through a Stripe invoice. International wire and Wise also work. Half to start, half at launch; the care plan is billed monthly.',
  documents:
    'A USD invoice from Vesta Consultoria (CNPJ 61.465.539/0001-00). A W-8BEN-E is available on request for your accountant.',
  contract:
    'A short service agreement in plain English, signed before work starts. It covers scope, timeline, payment, revisions and code ownership.',
  ownership:
    'You own one hundred percent of the code, design and content. It is delivered to your own GitHub and hosting accounts, with every credential.',
  revisions:
    'Two revision rounds are included in every project. If we cannot agree on direction after the first design review, you pay only the first half and keep everything produced up to that point.',
};

/* --------------------------------------------------------------------- faq */

export const faq: Faq[] = [
  { q: 'Is the price negotiable?', a: 'No. Prices are public and fixed so that nobody pays more for being a worse negotiator. What changes between projects is scope, and scope is agreed in writing before anything is built.' },
  { q: 'How do I pay from the US?', a: terms.payment },
  { q: 'What document do I receive?', a: terms.documents },
  { q: 'Is there a contract?', a: terms.contract },
  { q: 'Who owns the site when it is done?', a: terms.ownership },
  { q: 'What if I don’t like the design?', a: terms.revisions },
  { q: 'How long does it take?', a: 'A campaign landing page ships in seven to ten business days. A complete website takes three to five weeks, most of it waiting on content and reviews. The timeline is in the scope document and it is the one we keep.' },
  { q: 'Do you work with my industry?', a: 'If you sell a service and buy traffic, almost certainly. The industry list on the home page is where Vesta has focus; industry pages are published only when there is a real case study behind them.' },
  { q: 'Who actually does the work?', a: 'Vinícius. All of it: copy, design, code, integrations, launch. That is the point of the studio, not a marketing line.' },
  { q: 'What about the time difference?', a: 'São Paulo is one to two hours ahead of New York. Vesta works nine to six local time, which covers most of the US Eastern and Central business day. You will get answers during your working hours.' },
  { q: 'Do you run the ads too?', a: 'No. Vesta builds the page the ads land on and wires the conversion tracking so your ads manager can see what the page does. Ad management stays with whoever runs it today.' },
  { q: 'What do you need from me?', a: process.youProvide.join('; ') + '.' },
];

/* ------------------------------------------------------------- final CTA */

export const finalCta = {
  kicker: 'Next step',
  title: 'Fifteen minutes. <em>No deck, no pitch.</em>',
  body: 'Bring the page your ads land on today. We will look at it together, and you will leave the call knowing whether a rebuild pays for itself — whether or not you hire Vesta.',
};

/* --------------------------------------------------------- founding program */

export const foundingProgram = {
  kicker: 'Case studies',
  title: 'The case studies here will be <em>real ones, or none at all.</em>',
  body: 'Vesta is a new studio. Rather than publish borrowed logos or invented numbers, the first three client projects are offered at a reduced price in exchange for permission to publish the work, the problem, and the measured before-and-after.',
  slots: 3,
  label: 'Ask about a founding-client slot',
};

/* ------------------------------------------------------------------ legal */

export const legal = {
  privacyUrl: '/privacy/',
  copyright: `© ${new Date().getFullYear()} ${brand.legalName} · CNPJ ${brand.cnpj} · ${brand.city}, ${brand.country}`,
};
