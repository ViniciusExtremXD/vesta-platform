/**
 * Concept registry — types.
 *
 * Five fictional businesses, one per niche, each drawn as a ConceptPlate
 * (src/components/ConceptPlate.astro) by its own pair of components in
 * src/components/concepts/<id>/ (Before.astro + Layers.astro). The contract
 * for those components is src/components/concepts/README.md.
 *
 * Every concept is FICTIONAL: `.example` domain, 555-01xx phone number, and
 * the caption "Concept NN · A study by Vesta · Fictional business, not
 * client work" wherever it appears.
 *
 * ── Coordinate system (annotations, and every drawing inside a plate) ──────
 * A plate's screen is a 760 × 475 reference drawing (16:10). One unit is
 * `--u = 100cqi / 760` — one reference px, resolved against the plate's own
 * inline size (container query units), so the drawing is identical at 880px,
 * 420px or 300px.
 *   x: 0 = left edge of the screen, 760 = right edge.
 *   y: 0 = top edge of the SCREEN (just below the URL bar), 475 = bottom.
 * `bar: true` puts a marker on the URL bar instead (y is ignored there): that
 * is where a page's title and metadata live, so markers about metadata
 * (no <title>, structured data) sit there.
 * `a` = which edge of the marker sits on (x, y): 's' the marker starts there
 * (extends right), 'e' it ends there (extends left), 'c' centred on it.
 */

export type ConceptId = 'halden' | 'dental' | 'restaurant' | 'law' | 'fitness';

export type PlateMode = 'hero' | 'build' | 'mini' | 'static';

/** Hex colours of one concept's REBUILT site. Used by its Layers component,
 *  by ConceptPlate (screen fill) and by anything that themes a mini preview
 *  (gallery cards, hero cycle chips). Text pairs must pass WCAG AA. */
export interface ConceptPalette {
  /** Main dark surface of the rebuilt site: the L2 base and the plate's
   *  screen fill. */
  base: string;
  /** Raised surface (media block). */
  base2: string;
  /** Darkest surface (JSON-LD card on L4). */
  deep: string;
  /** Primary text on `base` — AA on `base` AND on --void #08070D. */
  text: string;
  /** Secondary text on `base` — AA on `base` AND on --void #08070D. */
  muted: string;
  /** Light band (services strip). */
  band: string;
  /** Light raised (thumbnail fill on the band). */
  band2: string;
  /** Primary text on `band`. */
  ink: string;
  /** Secondary text on `band` (AA ≥ 4.5:1). */
  ink2: string;
  /** The brand accent: button fills, marks, event pins. */
  accent: string;
  /** Text on `accent` (AA ≥ 4.5:1). */
  onAccent: string;
  /** Hairline colour on `base` (drawn at low alpha). */
  line: string;
}

/** Colours of the dated BEFORE site (a plausible 2016 template). */
export interface ConceptBeforePalette {
  bg: string;
  text: string;
  /** Header / hero fill. */
  primary: string;
  /** Secondary fill (header band, button, icon tiles). */
  secondary: string;
  /** Text on `primary` (AA). */
  onPrimary: string;
}

export interface ConceptAnnotation {
  /** 'A1'…'A4' on the before, 'B1'…'B4' on the after. */
  id: string;
  text: string;
  /** Anchor in reference units (see the coordinate system above). */
  x: number;
  y: number;
  a: 's' | 'e' | 'c';
  bar?: boolean;
}

export interface Concept {
  id: ConceptId;
  /** '01'…'05' */
  number: string;
  /** 'Concept 01' */
  label: string;
  name: string;
  /** Niche label, e.g. 'Roofing contractor'. */
  niche: string;
  city: string;
  domain: string;
  phone: string;
  email: string;
  /** schema.org @type for the JSON-LD card. */
  schemaType: string;
  /** Study page route. */
  href: string;
  palette: ConceptPalette;
  /** "Concept NN · A study by Vesta · Fictional business, not client work" */
  caption: string;
  /** aria-label for the plate (role="img"), per plate mode. `before` is the
   *  static mode with state="before". */
  aria: Record<PlateMode | 'before', string>;
  /** The rebuilt site. */
  after: {
    headline: string;
    sub: string;
    nav: string[];
    services: string[];
    /** L5: [primary CTA, call CTA, chat CTA]. */
    buttons: [string, string, string];
    /** L1 wireframe box tags. */
    wireframeTags: [string, string, string, string];
    /** L4 JSON-LD card lines. */
    jsonLd: [string, string];
    /** L4 sitemap tree; [0] is the root. */
    sitemap: string[];
    /** L6 event pins: [chat, call, primary]. */
    events: [string, string, string];
  };
  /** The dated site it replaces. Arial only, AA contrast, not a parody. */
  before: {
    palette: ConceptBeforePalette;
    topBar: string;
    logo: string;
    nav: string[];
    welcome: string;
    heroSub: string;
    heroButton: string;
    /** Three identical boxes. */
    boxes: [string, string, string];
    boxText: string;
    boxLink: string;
    footer: string;
  };
  /** Study page copy (/work/concept-NN/). */
  study: {
    /** Page H1, e.g. 'Halden Roofing, rebuilt.' */
    h1: string;
    /** One line, fictional-business framing. */
    lead: string;
    /** "The brief (fictional)": one or two sentences. */
    brief: string;
    /** Gallery card line (one sentence). */
    card: string;
  };
  annotations: {
    before: ConceptAnnotation[];
    after: ConceptAnnotation[];
  };
}

/** Builds the fixed study caption for a concept number. */
export const studyCaption = (n: string): string => `Concept ${n} · A study by Vesta · Fictional business, not client work`;

/** Marker anchors of the shared plate geometry (the Halden layout, which the
 *  stubs reuse). A niche that redraws its plate passes its own anchors. */
export const defaultAnchors: Record<string, Omit<ConceptAnnotation, 'id' | 'text'>> = {
  A1: { x: 492, y: 459, a: 's' }, // footer phone number
  A2: { x: 733, y: 150, a: 'c' }, // slider arrows
  A3: { x: 206, y: 150, a: 'e' }, // "Welcome to …"
  A4: { x: 176, y: 0, a: 's', bar: true }, // metadata → URL bar
  B1: { x: 268, y: 118, a: 's' }, // the promise, first screen
  B2: { x: 340, y: 284, a: 's' }, // primary + call buttons
  B3: { x: 266, y: 376, a: 'e' }, // service rows
  B4: { x: 176, y: 0, a: 's', bar: true }, // structured data → URL bar
};

/** Joins annotation texts to anchors: `place({ A1: '…', A2: '…' })`. */
export function place(
  texts: Record<string, string>,
  anchors: Record<string, Omit<ConceptAnnotation, 'id' | 'text'>> = defaultAnchors
): ConceptAnnotation[] {
  return Object.entries(texts).map(([id, text]) => ({ id, text, ...(anchors[id] ?? { x: 380, y: 237, a: 'c' as const }) }));
}
