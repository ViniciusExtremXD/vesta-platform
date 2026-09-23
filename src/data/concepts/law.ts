/**
 * Concept 04 — Marlowe & Pike Injury Law (fictional), Atlanta, GA.
 * Drawn by src/components/concepts/law/ (Before.astro + Layers.astro).
 *
 * Identity of the rebuild: warm charcoal + stone + a restrained brass accent.
 * Firm name in wide Mona Sans caps (wdth 125), headline in a system serif,
 * the firm's ampersand as the one piece of art. Quiet and authoritative:
 * no verdicts, no ratings, no years in business, no gavels.
 *
 * The BEFORE is a late-2000s law-firm template last touched in 2014: a
 * fixed-width page on linen wallpaper, scales and gavel clip art, glossy gold
 * tabs, a ticker, a starburst, cluttered sidebars, a low-res skyline, a wall
 * of grey text and the only contact form cut off by the fold.
 */
import { place, studyCaption, type Concept, type ConceptAnnotation } from './types';

/** Marker anchors on this drawing (760 × 475 reference units, see types.ts). */
const anchors: Record<string, Omit<ConceptAnnotation, 'id' | 'text'>> = {
  A1: { x: 316, y: 347, a: 's' }, // after the contact form heading, cut by the fold
  A2: { x: 580, y: 97, a: 'e' }, // on the tab bar, against the starburst
  A3: { x: 415, y: 236, a: 'c' }, // the wall of grey text
  A4: { x: 176, y: 0, a: 's', bar: true }, // metadata → URL bar
  B1: { x: 350, y: 142, a: 's' }, // the promise, first screen
  B2: { x: 392, y: 298, a: 's' }, // case review + call buttons
  B3: { x: 144, y: 353, a: 's' }, // after the practice areas label
  B4: { x: 176, y: 0, a: 's', bar: true }, // structured data → URL bar
};

export const law: Concept = {
  id: 'law',
  number: '04',
  label: 'Concept 04',
  name: 'Marlowe & Pike Injury Law',
  niche: 'Law firm',
  city: 'Atlanta, GA',
  domain: 'marlowepike.example',
  phone: '(404) 555-0119',
  email: 'intake@marlowepike.example',
  schemaType: 'LegalService',
  href: '/work/concept-04/',
  palette: {
    base: '#1A1918', // warm charcoal
    base2: '#242220',
    deep: '#100F0E',
    text: '#EEE9E0', // stone white — 14.5:1 on base, 16.6:1 on --void
    muted: '#ADA597', // 7.2:1 on base, 8.2:1 on --void
    band: '#E3DDD2', // stone
    band2: '#D5CDBF',
    ink: '#1A1918', // 13:1 on stone
    ink2: '#5A5449', // 5.6:1 on stone
    accent: '#B39459', // brass — 6.1:1 as text on base, 7:1 on --void
    onAccent: '#1A1918', // 6.1:1 on brass
    line: '#ADA597',
  },
  caption: studyCaption('04'),
  aria: {
    hero: 'Concept 04: the website of Marlowe & Pike Injury Law, a fictional business, before and after a rebuild by Vesta.',
    build: 'Concept 04 taken apart into six layers: code, design, speed, Google, contact buttons and tracking.',
    mini: 'Preview of a site, drawn as the Concept 04 plate.',
    static: 'Concept 04: the rebuilt website of Marlowe & Pike Injury Law, a fictional business.',
    before: 'Concept 04: the 2014 website of Marlowe & Pike Injury Law, a fictional business, before the rebuild.',
  },
  after: {
    headline: 'Hurt in Atlanta? Talk to a lawyer today.',
    sub: 'Free case review, day or night. No fee unless you win.',
    nav: ['Practice areas', 'About', 'Contact'],
    services: ['Car accidents', 'Truck accidents', 'Slip and fall', 'Wrongful death'],
    buttons: ['Free case review', 'Call 24/7', 'WhatsApp'],
    wireframeTags: ['NAV', 'H1', 'CTA', 'PRACTICE'],
    jsonLd: ['"@type": "LegalService"', '"areaServed": "Atlanta, GA"'],
    sitemap: ['/', '/car-accidents/', '/truck-accidents/', '/slip-and-fall/', '/wrongful-death/', '/case-review/'],
    events: ['whatsapp_click', 'call_click', 'case_review_start'],
  },
  before: {
    palette: { bg: '#FFFFFF', text: '#333333', primary: '#1F3A5F', secondary: '#C8B27A', onPrimary: '#FFFFFF' },
    topBar: 'intake@marlowepike.example',
    logo: 'Marlowe & Pike',
    nav: ['Home', 'Attorneys', 'Practice Areas', 'Results', 'Contact'],
    welcome: 'Aggressive Representation You Can Trust!!',
    heroSub: 'Attorneys at Law',
    heroButton: 'Read More »',
    boxes: ['Personal Injury', 'Auto Accidents', 'Workers Comp'],
    boxText:
      'Marlowe & Pike Injury Law is a full-service personal injury law firm dedicated to protecting the rights of injured people throughout the State of Georgia. If you or a loved one has been hurt because of the negligence of another party, you may be entitled to compensation for medical bills, lost wages, pain and suffering and more.',
    boxLink: 'Read more »',
    footer: 'Marlowe & Pike Injury Law · Atlanta, GA · (404) 555-0119',
  },
  study: {
    h1: 'Marlowe & Pike, rebuilt.',
    lead: 'A study by Vesta. The firm is fictional. The problems it shows are common.',
    brief: 'Marlowe & Pike Injury Law, a personal injury firm in Atlanta, GA, is replacing a 2014 template site where the only contact form sits at the bottom of the page.',
    card: 'An injury law firm in Atlanta, GA, whose only contact form sat at the bottom of the page.',
  },
  annotations: {
    before: place(
      {
        A1: 'The only contact form sits below the fold. No phone number on screen.',
        A2: 'A starburst, clip art and a shouted welcome. No next step.',
        A3: 'A wall of grey text before any way to act.',
        A4: 'No page title or description written for search.',
      },
      anchors
    ),
    after: place(
      {
        B1: 'Who the firm helps, and where, on the first screen.',
        B2: 'Case review and a 24/7 call button within thumb reach.',
        B3: 'A page per practice area that Google can index.',
        B4: 'Structured data for a legal service in Atlanta.',
      },
      anchors
    ),
  },
};

/**
 * Drawing-only strings the shared Concept type has no field for. Used by
 * concepts/law/Before.astro and Layers.astro only.
 */
export const lawDrawing = {
  after: {
    brand: 'Marlowe & Pike',
    brandSub: 'Injury law',
    eyebrow: 'Atlanta, GA · Personal injury',
    /** The headline set on three lines (same words as law.after.headline). */
    headlineLines: ['Hurt in Atlanta?', 'Talk to a lawyer', 'today.'],
    practiceLabel: 'Practice areas',
    served: 'Serving Atlanta, Decatur, Marietta and Sandy Springs',
  },
  before: {
    topLeft: 'Serving Atlanta and All of Georgia',
    headRight: 'Free Consultation',
    gavelCaption: 'Justice for the Injured',
    wall2:
      'The attorneys at Marlowe & Pike have the knowledge and experience to handle your case from start to finish. Insurance companies have teams of lawyers working to protect their interests. You deserve the same. Do not wait, Georgia law limits the time you have to file a claim.',
    photoCaption: 'Call Today for a Free Consultation',
    practiceLead: 'Practice Areas:',
    practice: ['Personal Injury', 'Auto Accidents', 'Workers Comp', 'Wrongful Death', 'Slip & Fall'],
    formTitle: 'Contact the Firm',
    formLead: 'Fill out the form below and an attorney will contact you.',
    fields: ['Name *', 'Email *', 'Phone', 'Describe your case'],
    hoursTitle: 'Office Hours',
    hours: ['Monday – Friday', '9:00 AM – 5:00 PM', 'Closed Weekends'],
  },
};
