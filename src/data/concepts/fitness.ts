/**
 * Concept 05 — Ironbark Strength Club (fictional), San Diego, CA.
 *
 * Voice of the rebuild: athletic-premium. Chalk white, graphite and one
 * signal orange; Mona Sans pushed to its narrowest width (wdth 75) and
 * heaviest weights, set in big uppercase; a slash geometry (the diagonal
 * cut, the stripe, the logo) and a 45 lb bumper plate as the only art.
 * The before is a loud late-2000s gym template last touched in 2016: flames,
 * red gel tabs, a purple banner with a low-res photo, "No pain, no gain!!!",
 * a blinking "Join now", placeholder gallery boxes, and the class schedule
 * and price list posted as images.
 *
 * Drawn by src/components/concepts/fitness/ (Before.astro, Layers.astro).
 * Coordinates below are reference units of the 760 × 475 screen
 * (see ./types.ts).
 */
import { place, studyCaption, type Concept, type ConceptAnnotation } from './types';

/** Marker anchors on this plate's own geometry. */
const anchors: Record<string, Omit<ConceptAnnotation, 'id' | 'text'>> = {
  A1: { x: 150, y: 340, a: 'c' }, // the schedule screenshot
  A2: { x: 332, y: 343, a: 'c' }, // the price list as an image
  A3: { x: 410, y: 203, a: 's' }, // the blinking "Join now!"
  A4: { x: 216, y: 456, a: 's' }, // phone number, tiny, footer only
  B1: { x: 410, y: 118, a: 's' }, // the promise, first screen
  B2: { x: 382, y: 254, a: 's' }, // book + call buttons
  B3: { x: 112, y: 316, a: 's' }, // the week of classes, as text
  B4: { x: 176, y: 0, a: 's', bar: true }, // structured data → URL bar
};

export const fitness: Concept = {
  id: 'fitness',
  number: '05',
  label: 'Concept 05',
  name: 'Ironbark Strength Club',
  niche: 'Fitness studio',
  city: 'San Diego, CA',
  domain: 'ironbarkstrength.example',
  phone: '(619) 555-0174',
  email: 'coach@ironbarkstrength.example',
  schemaType: 'ExerciseGym',
  href: '/work/concept-05/',
  palette: {
    base: '#17181B', // graphite: nav, art panel, schedule band
    base2: '#222327', // the plate face
    deep: '#0E0F11',
    text: '#F2F1EC', // chalk
    muted: '#ABABA4',
    band: '#F2F1EC', // the chalk hero panel
    band2: '#E4E3DC',
    ink: '#17181B',
    ink2: '#55564F',
    accent: '#FF5B14', // signal orange
    onAccent: '#17181B',
    line: '#ABABA4',
  },
  caption: studyCaption('05'),
  aria: {
    hero: 'Concept 05: the website of Ironbark Strength Club, a fictional strength gym in San Diego, before and after a rebuild by Vesta.',
    build: 'Concept 05 taken apart into six layers: code, design, speed, Google, contact buttons and tracking.',
    mini: 'Preview of a site, drawn as the Concept 05 plate.',
    static: 'Concept 05: the rebuilt website of Ironbark Strength Club, a fictional strength gym in San Diego.',
    before: 'Concept 05: the 2016 website of Ironbark Strength Club, a fictional strength gym, before the rebuild.',
  },
  after: {
    headline: 'Get strong. Stay strong.',
    sub: 'Small-group coaching for every level. First session free.',
    nav: ['Classes', 'Schedule', 'Coaches', 'Membership'],
    services: ['Strength', 'Conditioning', 'Mobility', 'Open gym'],
    buttons: ['Book a free intro session', 'Call (619) 555-0174', 'WhatsApp'],
    wireframeTags: ['NAV', 'H1', 'CTA', 'CLASSES'],
    jsonLd: ['"@type": "ExerciseGym"', '"areaServed": "San Diego, CA"'],
    sitemap: ['/', '/classes/', '/schedule/', '/coaches/', '/intro-session/'],
    events: ['whatsapp_click', 'call_click', 'intro_booked'],
  },
  before: {
    palette: { bg: '#0B0B0B', text: '#D6D6D6', primary: '#050505', secondary: '#39FF14', onPrimary: '#FFFFFF' },
    topBar: 'coach@ironbarkstrength.example',
    logo: 'IRONBARK',
    nav: ['Home', 'About', 'Classes', 'Schedule', 'Pricing', 'Contact'],
    welcome: 'Welcome to Ironbark Strength Club',
    heroSub: 'No Pain, No Gain',
    heroButton: 'Join Now!',
    boxes: ['Class Schedule', 'Membership Rates', 'Personal Training'],
    boxText: 'One-on-one sessions for all fitness levels.',
    boxLink: 'Read more »',
    footer: 'Ironbark Strength Club · San Diego, CA · (619) 555-0174',
  },
  study: {
    h1: 'Ironbark Strength Club, rebuilt.',
    lead: 'A study by Vesta. The club is fictional. The problems it shows are common.',
    brief:
      'Ironbark Strength Club, a strength gym in San Diego, CA, runs on a 2016 gym template: a stock banner, a blinking "Join now", and a schedule and price list posted as images.',
    card: 'A strength gym in San Diego, CA, whose schedule and prices lived inside images.',
  },
  annotations: {
    before: place(
      {
        A1: 'The schedule is a screenshot: unreadable on a phone, invisible to Google.',
        A2: 'Prices locked inside an image of a table.',
        A3: 'A blinking "Join now" and no free first visit.',
        A4: 'Phone number only in the footer, in tiny type.',
      },
      anchors
    ),
    after: place(
      {
        B1: 'The promise and a free intro session on the first screen.',
        B2: 'Book and call within thumb reach.',
        B3: 'The week of classes as real text Google can read.',
        B4: 'Structured data for a gym and the area it serves.',
      },
      anchors
    ),
  },
};

/** Strings the drawing needs beyond the shared Concept shape. */
export const fitnessPlate = {
  /** L2 eyebrow above the headline. */
  eyebrow: 'Coached strength · San Diego, CA',
  /** L2 schedule band. */
  week: 'This week',
  scheduleLink: 'See the schedule',
  /** One line per class, same order as `after.services`. */
  times: ['Mon–Fri · 6 AM, 12 PM, 6 PM', 'Tue, Thu · 7 AM, 5:30 PM', 'Wed, Sat · 8 AM', 'Daily · 5 AM–10 PM'],
  /** Bottom ticker (hero mode drifts it; static elsewhere). */
  ticker: ['First session free', 'No contract', 'Coached small groups', 'Free parking'],
  /** BEFORE: the line under the logo. */
  beforeTagline: 'Strength Club',
  /** BEFORE: box 1 and 2 are images; their captions. */
  beforeShot: 'Click to enlarge',
  beforeUpdated: 'Updated monthly',
};
