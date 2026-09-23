/**
 * Concept 02 — Pellwood Dental Studio (FICTIONAL), Denver, CO.
 * Drawn by src/components/concepts/dental/ (Before.astro + Layers.astro).
 *
 * Identity (kept apart from Halden on purpose): the only LIGHT rebuild of the
 * five. Soft porcelain surface, deep ink type and treatment band, one cool
 * accent (glacier blue, with an ice tint of the same hue for marks on ink).
 * Mona Sans runs WIDE and LIGHT (wdth 118–125, wght 300–380): calm, airy,
 * clinical. The art is a line-drawn molar inside an arched window, with a
 * slow glacier scan line crossing it ("done precisely").
 *
 * Palette note for hosts: `base` is porcelain (light). `text` / `muted` are
 * AA on `base` only, not on --void — never set them on a dark host surface.
 * On dark, use `accent` fills with `onAccent`, or `deep` with `band`.
 */
import { studyCaption, type Concept, type ConceptAnnotation } from './types';

/** Annotation anchors of this drawing (760 × 475 reference units). */
const anchors: Record<string, Omit<ConceptAnnotation, 'id' | 'text'>> = {
  A1: { x: 603, y: 9, a: 'e' }, // the tiny phone number in the top bar
  A2: { x: 733, y: 186, a: 'c' }, // the stock-photo slider arrows
  A3: { x: 362, y: 146, a: 's' }, // "Welcome to Pellwood Dental"
  A4: { x: 192, y: 430, a: 's' }, // insurance forms as a PDF download
  B1: { x: 414, y: 140, a: 's' }, // the promise, first screen
  B2: { x: 380, y: 295, a: 's' }, // book + new-patient call buttons
  B3: { x: 184, y: 398, a: 'e' }, // one page per treatment
  B4: { x: 188, y: 0, a: 's', bar: true }, // structured data → URL bar
};

const note = (texts: Record<string, string>): ConceptAnnotation[] =>
  Object.entries(texts).map(([id, text]) => ({ id, text, ...anchors[id] }));

export const dental: Concept = {
  id: 'dental',
  number: '02',
  label: 'Concept 02',
  name: 'Pellwood Dental Studio',
  niche: 'Dental clinic',
  city: 'Denver, CO',
  domain: 'pellwooddental.example',
  phone: '(303) 555-0162',
  email: 'hello@pellwooddental.example',
  schemaType: 'Dentist',
  href: '/work/concept-02/',
  palette: {
    base: '#F6F4EF', // porcelain
    base2: '#E4EAEC', // mist: the arched window
    deep: '#0A141B', // JSON-LD card
    text: '#0D1A22', // deep ink, 16.1:1 on porcelain
    muted: '#4A5A63', // 6.5:1 on porcelain
    band: '#0D1A22', // the treatment band is INK (inverse strip)
    band2: '#16252F',
    ink: '#F6F4EF', // porcelain on the ink band, 16.1:1
    ink2: '#A3B1BA', // 8.0:1 on the ink band
    accent: '#2F6690', // glacier blue: primary fill, chips, pins
    onAccent: '#FFFFFF', // 6.1:1
    line: '#0D1A22',
  },
  caption: studyCaption('02'),
  aria: {
    hero: 'Concept 02: the website of Pellwood Dental Studio, a fictional dental clinic in Denver, before and after a rebuild by Vesta.',
    build: 'Concept 02 taken apart into six layers: code, design, speed, Google, contact buttons and tracking.',
    mini: 'Preview of a site, drawn as the Concept 02 plate: a calm, light dental clinic website.',
    static: 'Concept 02: the rebuilt website of Pellwood Dental Studio, a fictional business: porcelain surface, a line-drawn molar and a Book a visit button.',
    before: 'Concept 02: the dated website of Pellwood Dental Studio, a fictional business, before the rebuild: a stock-photo slider and a tiny phone number.',
  },
  after: {
    headline: 'Unhurried dentistry, done precisely.',
    sub: 'Early and evening visits. Fees agreed before any treatment.',
    nav: ['Treatments', 'First visit', 'Fees', 'Contact'],
    services: ['Cleanings', 'Implants', 'Invisalign', 'Emergency'],
    buttons: ['Book a visit', 'Call (303) 555-0162', 'WhatsApp'],
    wireframeTags: ['NAV', 'H1', 'CTA', 'SERVICES'],
    jsonLd: ['"@type": "Dentist"', '"areaServed": "Denver, CO"'],
    sitemap: ['/', '/cleanings/', '/implants/', '/invisalign/', '/emergency/', '/book/'],
    events: ['whatsapp_click', 'call_click', 'book_visit'],
  },
  before: {
    palette: { bg: '#FFFFFF', text: '#444444', primary: '#13707A', secondary: '#EEF2F2', onPrimary: '#FFFFFF' },
    topBar: 'Mon–Fri 8am–5pm  |  hello@pellwooddental.example',
    logo: 'Pellwood Dental',
    nav: ['Home', 'About', 'Services', 'Smile Gallery', 'Contact'],
    welcome: 'Welcome to Pellwood Dental',
    heroSub: 'Gentle Care for the Whole Family',
    heroButton: 'Learn More',
    boxes: ['General Dentistry', 'Cosmetic Dentistry', 'Dental Implants'],
    boxText: 'Quality dental care for the whole family.',
    boxLink: 'Read More »',
    footer: 'Pellwood Dental Studio · Denver, CO · Privacy Policy · Site Map',
  },
  study: {
    h1: 'Pellwood Dental Studio, rebuilt.',
    lead: 'A study by Vesta. The clinic is fictional. The problems it shows are common.',
    brief: 'Pellwood Dental Studio, a dental clinic in Denver, CO, is replacing a template site where the phone number hides in the top bar and new-patient forms are PDF downloads.',
    card: 'A dental clinic in Denver, CO, where new patients could not find how to book.',
  },
  annotations: {
    before: note({
      A1: 'The phone number, in the smallest type on the page.',
      A2: 'A stock-photo slider that could belong to any clinic.',
      A3: '"Welcome to Pellwood Dental" instead of what the clinic offers.',
      A4: 'Insurance forms only as a PDF download.',
    }),
    after: note({
      B1: 'One calm promise and the booking button on the first screen.',
      B2: 'Book online, or call as a new patient, within thumb reach.',
      B3: 'A page per treatment that Google can index.',
      B4: 'Structured data that tells Google this is a dentist in Denver.',
    }),
  },
};

/** Drawing-only strings (not part of the shared Concept type). */
export const dentalArt = {
  /** L2 eyebrow status line, beside a glacier dot. */
  status: 'Accepting new patients',
  /** Call button: the quiet prefix before the number. */
  callPrefix: 'New patient?',
  /** L2 floating card over the arched window. */
  opening: { label: 'Next opening', value: 'Tue · 7:30 am' },
  /** L2 band label and the one line under each treatment. */
  bandLabel: 'Treatments',
  bandLink: 'All treatments',
  serviceNotes: ['Exam and polish', 'Single tooth to full arch', 'Clear aligners', 'Seen the same day'],
  /** L4 extra JSON-LD line. */
  jsonTel: '"telephone": "+1-303-555-0162"',
  /** BEFORE extras. */
  before: {
    tagline: 'Family & Cosmetic Dentistry',
    phone: 'Tel: (303) 555-0162',
    social: ['f', 't', 'g+'],
    formsLead: 'New patients:',
    forms: 'Insurance forms (PDF)',
    forms2: 'Patient registration (PDF)',
    insurance: 'Most insurance plans accepted',
  },
} as const;
