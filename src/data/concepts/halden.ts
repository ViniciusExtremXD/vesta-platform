/**
 * Concept 01 — Halden Roofing (fictional), Austin, TX.
 * Derived from site.ts `concept` (which stays the copy source and keeps
 * working for every existing importer). Only the strings site.ts never had
 * (the before-site nav/hero/box text, palette, annotation positions) live here.
 */
import { concept, conceptPage } from '../site';
import { defaultAnchors as pos, type Concept } from './types';

const A = concept.after;
const B = concept.before;
export const halden: Concept = {
  id: 'halden',
  number: '01',
  label: concept.number,
  name: concept.name,
  niche: 'Roofing contractor',
  city: concept.city,
  domain: concept.domain,
  phone: concept.phone,
  email: concept.email,
  schemaType: concept.schemaType,
  href: '/work/concept-01/',
  palette: {
    base: '#1F2A30',
    base2: '#27353C',
    deep: '#111719',
    text: '#F2ECE1',
    muted: '#B9C3C7',
    band: '#F2ECE1',
    band2: '#E4DCCD',
    ink: '#1F2A30',
    ink2: '#4A5A61',
    accent: '#D08A4E',
    onAccent: '#1F2A30',
    line: '#B9C3C7',
  },
  caption: concept.caption,
  aria: {
    hero: concept.aria.hero,
    build: concept.aria.build,
    mini: concept.aria.mini,
    static: 'Concept 01: the rebuilt website of Halden Roofing, a fictional business.',
    before: 'Concept 01: the 2016 website of Halden Roofing, a fictional business, before the rebuild.',
  },
  after: {
    headline: A.headline,
    sub: A.sub,
    nav: A.nav,
    services: A.services,
    buttons: A.buttons as Concept['after']['buttons'],
    wireframeTags: A.wireframeTags as Concept['after']['wireframeTags'],
    jsonLd: A.jsonLd as Concept['after']['jsonLd'],
    sitemap: A.sitemap,
    events: A.events as Concept['after']['events'],
  },
  before: {
    palette: { bg: '#F7F4EE', text: '#333333', primary: '#3D5A3A', secondary: '#C9B99A', onPrimary: '#FFFFFF' },
    topBar: B.topBar,
    logo: B.logo,
    nav: ['Home', 'About', 'Services', 'Gallery', 'Contact'],
    welcome: B.welcome,
    heroSub: 'Quality Roofing You Can Trust',
    heroButton: 'Read More',
    boxes: B.boxes as Concept['before']['boxes'],
    boxText: 'Quality service at an affordable price.',
    boxLink: 'Read more »',
    footer: B.footer,
  },
  study: {
    h1: conceptPage.h1,
    lead: conceptPage.lead,
    brief: conceptPage.brief.text,
    card: 'A roofing company in Austin, TX, and its website before and after a rebuild.',
  },
  annotations: {
    before: concept.annotations.before.map((n) => ({ ...n, ...pos[n.id] })),
    after: concept.annotations.after.map((n) => ({ ...n, ...pos[n.id] })),
  },
};
