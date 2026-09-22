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
  mark: 'VESTA ⚶',
  legalName: 'Vesta Consultoria',
  cnpj: '61.465.539/0001-00',
  city: 'São Paulo',
  country: 'Brazil',
  coordinates: '23.55° S · 46.63° W',
  tagline: 'Celestial Landing Pages & Google SEO Engineered for Paid Traffic.',
  description:
    'Named after 4 Vesta, the celestial flame of sacred focus — we engineer sub-second landing pages and technical Google SEO aligned for maximum ad conversion and revenue velocity.',
  seo: {
    title: 'Vesta ⚶ Celestial Landing Pages & Google SEO for Paid Traffic',
    description:
      'Sub-second landing pages engineered with celestial precision for Google Ads, Meta Ads, and organic search indexation. Fixed pricing from $500. Built by Vinícius Magno.',
  },
};

/* ---------------------------------------------------------------- contact */

export const contact = {
  whatsapp: {
    display: '+55 11 91029-2004',
    e164: '5511910292004',
    url: 'https://wa.me/5511910292004?text=Hi%20Vinicius%2C%20I%20saw%20Vesta%20and%20would%20like%20to%20request%20a%20quote%20for%20a%20landing%20page.',
    confirmed: true,
  },
  email: {
    address: 'vinicius@vesta.systems',
    confirmed: false,
  },
  linkedin: {
    url: 'https://www.linkedin.com/in/vinicius-magno-vesta/',
    confirmed: true,
  },
  booking: {
    calendlyUrl: 'https://calendly.com/vesta-systems/15-min-call',
    label: 'Request a Quote / Align Your Project',
    confirmed: false,
  },
  hours: {
    timeZone: 'America/Sao_Paulo',
    start: 9,
    end: 18,
    label: 'Global Delivery · US & International Business Hours',
  },
};

export const nav: NavItem[] = [
  { label: 'Work', href: '/work/' },
  { label: 'Services', href: '/#services' },
  { label: 'Process', href: '/#process' },
  { label: 'About', href: '/about/' },
  { label: 'Contact', href: '/contact/' },
];

export const primaryCta = { label: 'Request a Quote', href: '/contact/' };

/* ------------------------------------------------------------------- hero */

export const hero = {
  kicker: '✦ Celestial Web Architecture · Google & Meta Ads',
  /** Words inside <em> render in the editorial italic. Keep it one phrase. */
  headline: 'You already pay for the click. We forge the celestial page that <em>turns it into revenue.</em>',
  lead:
    'High-converting landing pages and technical Google SEO architecture engineered with mystical precision for brands running paid traffic worldwide. Sub-second mobile speeds, flawless ad tracking, and guaranteed Google indexing — crafted directly by Vinícius Magno.',
  primary: primaryCta,
  secondary: { label: 'See Pricing & Packages', href: '/#services' },
  /** Facts about results and delivery. */
  facts: [
    { label: 'Celestial Mobile Speed', value: '< 0.8s', note: 'instantly captures traffic before bounce' },
    { label: 'Conversion Alignment', value: '100%', note: 'Google Ads, Meta Pixel & GA4 wired' },
    { label: 'Google Indexation', value: 'Guaranteed', note: 'Search Console, sitemaps & Schema tags' },
    { label: 'Turnaround Horizon', value: '5–7 Days', note: 'from alignment brief to live campaign' },
  ],
};

/* ---------------------------------------------------------------- situation */

export const situations: { kicker: string; title: string; items: Situation[] } = {
  kicker: 'Is this you?',
  title: 'Three core challenges. One solution: <em>high-converting pages & Google SEO architecture.</em>',
  items: [
    {
      index: '01',
      title: 'You buy ad traffic and the page leaks it.',
      body: 'Google Ads, Meta Ads, Local Services — the click costs the same whether the page converts or bounces. We build sub-second pages engineered to turn clicks into booked calls and direct leads.',
    },
    {
      index: '02',
      title: 'Your page is invisible or poorly indexed on Google.',
      body: 'Without proper technical SEO, Schema markup and Search Console configuration, you lose high-intent organic search traffic to competitors with sharper indexation.',
    },
    {
      index: '03',
      title: 'You need a high-converting page live in days, not months.',
      body: 'A dedicated landing page tailored to one offer, integrated with WhatsApp/CRM and measured for conversion ships in 5–7 business days without agency bureaucracy.',
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
  title: 'Clear options. <em>Transparent pricing, engineered for ROI.</em>',
  lead: 'Every price is transparent and agreed in advance. Direct collaboration with Vinícius Magno — zero agency markups.',
  items: [
    {
      id: 'landing-page',
      name: 'High-Converting Landing Page',
      price: '$500 – $700',
      terms: 'Fixed price · ready in 5–7 business days',
      description: 'Single-page conversion engine tailored for one campaign or offer. Built to turn Google and Meta ads traffic into high-value leads.',
      features: [
        'Conversion-first copywriting and premium bespoke design',
        'Sub-second mobile loading (<1.0s) to eliminate traffic bounce',
        'Direct WhatsApp button & lead forms connected to your CRM/inbox',
        'Google Ads & Meta Pixel conversion tracking configured',
        'Google Search Console setup and basic SEO metadata',
        'Full code ownership delivered to your own accounts',
      ],
      highlighted: true,
    },
    {
      id: 'landing-page-seo',
      name: 'Landing Page + Google SEO & Indexing',
      price: '$750',
      terms: 'Complete growth package · 7–10 business days',
      description: 'The complete revenue asset: premium landing page for paid traffic plus full technical Google SEO architecture to capture organic search.',
      features: [
        'Everything in High-Converting Landing Page',
        'Google Search Console verification & instant indexing request',
        'Structured Schema.org (JSON-LD) rich snippets for search engines',
        'XML Sitemap & on-page keyword semantic optimization',
        'Core Web Vitals performance guarantee (95+ score)',
        'Speed & security optimization with global CDN deployment',
      ],
      highlighted: false,
    },
    {
      id: 'website',
      name: 'Complete Website & Custom Scope',
      price: 'From $750',
      terms: 'Custom quote after quick brief · 2–3 weeks',
      description: 'Multi-page institutional web platform for established brands requiring dedicated service areas, corporate credibility, and comprehensive Google indexation.',
      features: [
        'Multi-page architecture (Home, Services, About, Contact)',
        'Comprehensive local & technical Google SEO indexation',
        'Corporate trust structure: CNPJ 61.465.539/0001-00, formal contracts',
        'Stripe international invoicing or Brazilian Nota Fiscal',
        'Direct architectural access to founder Vinícius Magno',
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
  role: 'Founder & Celestial Tech Architect',
  kicker: 'The Architect',
  title: 'Direct communion with the builder. <em>Zero middlemen, zero junior hand-offs.</em>',
  quote:
    'A landing page is not an art project — it is a celestial revenue engine. Every millisecond of delay and every misplaced CTA is wasted ad spend.',
  bio: [
    'Vinícius Magno is the founder and celestial tech architect behind Vesta Consultoria (CNPJ 61.465.539/0001-00). He collaborates directly with ambitious brands and marketing teams worldwide to build ultra-fast landing pages and technical Google SEO that convert paid ad traffic into signed clients.',
    'Holding a degree in Computer Science from Mackenzie Presbyterian University in São Paulo, Vinícius unites software engineering and distributed systems with conversion alchemy: sub-second landing pages aligned to dominate ad auctions and Google search.',
  ],
  credentials: [
    'B.S. in Computer Science — Mackenzie Presbyterian University, São Paulo',
    'Specialist in high-conversion landing pages & Google technical SEO',
    'Official registered entity: Vesta Consultoria (CNPJ 61.465.539/0001-00)',
    '100% direct execution: every project designed and coded personally',
  ],
  timezone: {
    title: 'Global Delivery & Seamless Alignment',
    body: 'Operating from São Paulo (UTC−3), Vinícius works on schedules that smoothly cover US Eastern, Central, and European business hours with rapid turnaround and direct communication.',
  },
  location: 'São Paulo, Brazil · UTC−3',
  portrait: {
    confirmed: true,
  },
};

/* ----------------------------------------------------------------- terms */

export const terms = {
  payment:
    'Card or bank transfer in US dollars through Stripe invoice, Wise, or international wire. For Brazilian clients, Pix/TED with official Nota Fiscal from Vesta Consultoria (CNPJ 61.465.539/0001-00). Half to start, half at launch.',
  documents:
    'Official USD invoice from Vesta Consultoria (CNPJ 61.465.539/0001-00). A W-8BEN-E is available on request for your accountant and corporate compliance.',
  contract:
    'A clear, concise service agreement in plain English or Portuguese before work starts, covering scope, timeline, payment, revisions, and complete code ownership.',
  ownership:
    'You own one hundred percent of the code, design, and content. Everything is delivered directly to your own GitHub repository and hosting accounts.',
  revisions:
    'Two revision rounds are included in every project. If we cannot agree on direction after the first design review, you pay only the first half and keep everything produced up to that point.',
};

/* --------------------------------------------------------------------- faq */

export const faq: Faq[] = [
  { q: 'How much does a landing page cost?', a: 'Landing pages range from $500 to $700 depending on complexity, with our complete Google SEO & Indexing package at $750. For complete multi-page websites or bespoke scopes, we provide a custom quote within 24 hours.' },
  { q: 'How do I pay from the US or abroad?', a: terms.payment },
  { q: 'What legal documents do I receive?', a: terms.documents },
  { q: 'Is there a formal contract?', a: terms.contract },
  { q: 'Who owns the code when it is done?', a: terms.ownership },
  { q: 'What if I need revisions?', a: terms.revisions },
  { q: 'How long does it take?', a: 'A campaign landing page ships in 5 to 7 business days. A complete website takes 2 to 3 weeks. The timeline is agreed in the scope document and strictly kept.' },
  { q: 'Do you configure Google SEO and search indexation?', a: 'Yes. We configure complete technical SEO: structured JSON-LD data, XML sitemaps, Open Graph metadata, and direct submission to Google Search Console to guarantee fast, proper indexation.' },
  { q: 'Who actually does the work?', a: 'Vinícius Magno personally. All copy structure, design, code, ad tracking integrations, and launch are handled directly by the founder.' },
  { q: 'What about the time difference?', a: 'São Paulo is one to two hours ahead of New York. Vesta works nine to six local time, which covers most of the US Eastern and Central business day. You will get answers during your working hours.' },
  { q: 'Do you run the ads too?', a: 'No. Vesta builds the page the ads land on and wires the conversion tracking so your ads manager can see what the page does. Ad management stays with whoever runs it today.' },
  { q: 'What do you need from me to start?', a: process.youProvide.join('; ') + '.' },
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
