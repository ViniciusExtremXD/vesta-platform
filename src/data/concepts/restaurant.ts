/**
 * Concept 03 — Trattoria Ombra (fictional), Chicago, IL.
 *
 * Owned by the niche designer. Drawn by src/components/concepts/restaurant/
 * (Before.astro = the dated 2016 template, Layers.astro = the rebuild as six
 * layers). Contract: src/components/concepts/README.md.
 *
 * Identity of the rebuild (kept clearly apart from Halden's slate + copper):
 * deep oxblood surface, candlelit terracotta accent, cream band, a serif
 * display (Georgia, system font) over Mona Sans set wide for labels, and a
 * hand-drawn line illustration (olive branch, a fiasco candle, a pasta nest)
 * inside a Roman arch.
 *
 * Everything here is fictional: .example domain, a 555-01xx number, no
 * reviews, ratings or years in business.
 */
import { place, studyCaption, type Concept, type ConceptAnnotation } from './types';

/** Marker anchors on THIS drawing (reference units, see types.ts). */
const anchors: Record<string, Omit<ConceptAnnotation, 'id' | 'text'>> = {
  A1: { x: 474, y: 449, a: 's' }, // hours + phone, tiny, in the footer
  A2: { x: 696, y: 170, a: 'e' }, // slideshow arrow
  A3: { x: 690, y: 292, a: 's' }, // "Download menu (PDF)" button
  A4: { x: 176, y: 0, a: 's', bar: true }, // no title / description → URL bar
  B1: { x: 386, y: 124, a: 's' }, // the promise, first screen
  B2: { x: 296, y: 322, a: 's' }, // reserve button + tonight's menu
  B3: { x: 216, y: 398, a: 'e' }, // tonight's menu + hours as real text
  B4: { x: 176, y: 0, a: 's', bar: true }, // Restaurant structured data → URL bar
};

export const restaurant: Concept = {
  id: 'restaurant',
  number: '03',
  label: 'Concept 03',
  name: 'Trattoria Ombra',
  niche: 'Restaurant',
  city: 'Chicago, IL',
  domain: 'trattoriaombra.example',
  phone: '(312) 555-0138',
  email: 'tables@trattoriaombra.example',
  schemaType: 'Restaurant',
  href: '/work/concept-03/',
  palette: {
    base: '#3B1216', // oxblood
    base2: '#4A1A1D', // arch / media
    deep: '#230A0D', // JSON-LD card
    text: '#F5E9D6', // cream: 13.6:1 oxblood, 16.7:1 void
    muted: '#D8B9A0', // 8.9:1 oxblood, 10.9:1 void
    band: '#F3E6D0', // menu band
    band2: '#E8D3B6',
    ink: '#3B1216', // 13.3:1 on band
    ink2: '#7A3F2E', // 6.6:1 on band
    accent: '#D9744A', // candlelit terracotta
    onAccent: '#2A0B0E', // 5.7:1 on terracotta
    line: '#D8B9A0',
  },
  caption: studyCaption('03'),
  aria: {
    hero: 'Concept 03: the website of Trattoria Ombra, a fictional restaurant, before and after a rebuild by Vesta.',
    build: 'Concept 03 taken apart into six layers: code, design, speed, Google, contact buttons and tracking.',
    mini: 'Preview of a site, drawn as the Concept 03 plate.',
    static: 'Concept 03: the rebuilt website of Trattoria Ombra, a fictional restaurant in Chicago.',
    before: 'Concept 03: the 2016 website of Trattoria Ombra, a fictional restaurant, before the rebuild.',
  },
  after: {
    headline: 'Handmade pasta. Late tables. Chicago.',
    sub: 'Pasta rolled every afternoon in the West Loop. Kitchen open until midnight.',
    nav: ['Menu', 'Wine', 'Private dining', 'Visit'],
    /** The band rows: tonight's three pastas. */
    services: ['Cacio e pepe', 'Tagliatelle al ragù', 'Agnolotti del plin'],
    buttons: ['Reserve a table', 'Call (312) 555-0138', 'WhatsApp'],
    wireframeTags: ['NAV', 'H1', 'CTA', 'MENU'],
    jsonLd: ['"@type": "Restaurant"', '"areaServed": "Chicago, IL"'],
    sitemap: ['/', '/menu/', '/wine/', '/private-dining/', '/reserve/'],
    events: ['whatsapp_click', 'call_click', 'reserve_submit'],
  },
  before: {
    palette: { bg: '#1B1512', text: '#EDE6DA', primary: '#9E1B22', secondary: '#1E6B3A', onPrimary: '#FFFFFF' },
    topBar: 'tables@trattoriaombra.example',
    logo: 'Trattoria Ombra',
    nav: ['Home', 'About', 'Menu', 'Gallery', 'Events', 'Contact'],
    welcome: 'Welcome to Trattoria Ombra',
    heroSub: 'Authentic Italian Cuisine in the Heart of Chicago',
    heroButton: 'Download menu (PDF)',
    boxes: ['Dinner', 'Private Parties', 'Catering'],
    boxText: 'Fresh ingredients and family recipes.',
    boxLink: 'Read more »',
    footer: 'Hours: Tue–Sun 5–10 pm · Closed Mondays · (312) 555-0138',
  },
  study: {
    h1: 'Trattoria Ombra, rebuilt.',
    lead: 'A study by Vesta. The restaurant is fictional. The problems it shows are common.',
    brief:
      'Trattoria Ombra, a pasta restaurant in Chicago, IL, runs a 2016 template: a PDF menu, a slideshow, hours hidden in the footer and no way to reserve.',
    card: 'A pasta restaurant in Chicago, IL: PDF menu out, tonight’s menu and reservations in.',
  },
  annotations: {
    before: place(
      {
        A1: 'Hours and phone number only in the footer.',
        A2: 'A slideshow of placeholder photos.',
        A3: 'The menu is a PDF: slow on phones, unreadable for Google.',
        A4: 'No page title or description written for search.',
      },
      anchors
    ),
    after: place(
      {
        B1: 'The food, the hours and the city on the first screen.',
        B2: 'Reserve a table in one tap, from the first screen.',
        B3: 'Tonight’s menu and hours as real text, not a PDF.',
        B4: 'Structured data for a restaurant.',
      },
      anchors
    ),
  },
};

/** Strings the rebuild draws that the shared Concept type has no field for. */
export const ombra = {
  /** Eyebrow over the headline. */
  eyebrow: 'Pasta bar · West Loop',
  /** Secondary hero link (l2, next to the primary button). */
  menuLink: 'See tonight’s menu',
  /** Band, left block. */
  tonight: 'Tonight',
  hours: '5 pm – midnight',
  days: 'Tuesday to Sunday',
  /** Band rows: one note + price per `after.services` entry. */
  dishes: [
    { numeral: 'I', note: 'Tonnarelli, pecorino, black pepper', price: '19' },
    { numeral: 'II', note: 'Slow beef and pork ragù, parmigiano', price: '24' },
    { numeral: 'III', note: 'Brown butter, sage, pinched by hand', price: '26' },
  ],
  /** Before site: small caps line under the script logo. */
  beforeTagline: 'Ristorante Italiano · Chicago',
} as const;
