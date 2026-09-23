# Concept plates — contract for niche designers

Five fictional businesses, one per niche, each drawn as a **ConceptPlate**:

| id | NN | Business | Niche | City | Drawing |
|---|---|---|---|---|---|
| `halden` | 01 | Halden Roofing | Roofing contractor | Austin, TX | bespoke (reference) |
| `dental` | 02 | Pellwood Dental Studio | Dental clinic | Denver, CO | **stub** |
| `restaurant` | 03 | Trattoria Ombra | Restaurant | Chicago, IL | **stub** |
| `law` | 04 | Marlowe & Pike Injury Law | Law firm | Atlanta, GA | **stub** |
| `fitness` | 05 | Ironbark Strength Club | Fitness studio | San Diego, CA | **stub** |

```astro
<ConceptPlate concept="dental" mode="hero|build|mini|static" state="after|before" />
```

`concept` defaults to `'halden'`, so every existing usage (Hero, Build, Configurator,
AnnotatedPlate, ExplodedPlate, /work/concept-01/) draws Concept 01 unchanged.

## Files

| Path | Owner | What |
|---|---|---|
| `src/data/concepts/types.ts` | architect | `Concept` interface, palette types, coordinate system, `defaultAnchors`, `place()` |
| `src/data/concepts/<id>.ts` | niche designer | copy, palette, before-site strings, study copy, annotations |
| `src/data/concepts/index.ts` | architect | `concepts` (ordered 01–05), `getConcept(id)`, `isConceptId()` |
| `src/components/concepts/<id>/Before.astro` | niche designer | the dated 2016 site |
| `src/components/concepts/<id>/Layers.astro` | niche designer | the rebuild, as six layers |
| `src/components/concepts/registry.ts` | architect | id → `{ Before, Layers }`; do not edit to redraw a niche |
| `src/components/concepts/stub/*` | architect | the palette-themed placeholder the four stubs render |
| `src/components/ConceptPlate.astro` | architect | frame, URL bar, compare slider, caption, modes |

To redraw a niche, replace the body of `concepts/<id>/Before.astro` and `Layers.astro`
(they currently just render `<StubBefore>` / `<StubLayers>` with the concept's data).
Keep the file names: the registry imports them. Halden (`concepts/halden/`) is the
reference implementation; read it first.

`src/data/site.ts` `concept` is still the copy source for Halden and still exported for
older importers; `concepts/halden.ts` derives from it. New niches keep their copy in their
own `src/data/concepts/<id>.ts`.

## The drawing surface

- The plate's screen is a **760 × 475 reference drawing** (16:10). Draw everything in
  reference px through `--u`:
  ```css
  .cp-layer, .b-site { --u: calc(100cqi / 760); }
  .thing { left: calc(32 * var(--u)); font-size: calc(11 * var(--u)); }
  ```
  `cqi` resolves against the nearest size container: the plate figure
  (`container-type: inline-size`). The same drawing then renders at 880px (Build),
  760px (hero), 420px (configurator), 300px (phone) — identical, just scaled.
  Never use px/rem/vw for geometry or type inside a drawing (hairlines may stay `1px`).
- SVG art: `viewBox` in reference units, `preserveAspectRatio="none"` only for
  full-bleed fills; hairlines `vector-effect="non-scaling-stroke"`.
- **Zero image bytes.** DOM + inline SVG only. No `<img>`, no web fonts beyond the
  site's (`var(--font-sans)` for the rebuild with `font-stretch`/weight to give each
  brand its own voice; Arial/Helvetica for the before).
- Tiny type is fine (it is a picture of a site), but anything a visitor is meant to
  read (headline, buttons, service names) should stay ≥ 9 reference px.

### Coordinate system (annotations)

Same units: `x` 0 → 760 from the screen's left edge, `y` 0 → 475 from the screen's top
edge (just below the URL bar). `bar: true` places the marker on the URL bar (y ignored):
use it for metadata findings (no `<title>`, structured data). `a` is which edge of the
marker sits on the anchor: `'s'` starts there (extends right), `'e'` ends there (extends
left), `'c'` centred. Annotation ids: `A1`–`A4` on the before, `B1`–`B4` on the after.
If you move a feature, move its anchor: pass your own anchors to
`place(texts, anchors)` in your data file. The stubs use `defaultAnchors` (Halden's
geometry).

## Before (`Before.astro`)

- ONE root element: `<div class="b-site" aria-hidden="true">`, `position: absolute;
  inset: 0; overflow: hidden;` with an opaque background. It accepts a `class` prop.
- A plausible **2016 template, not a parody**: Arial, centred logo, slider hero,
  "Welcome to …", identical boxes, phone number only in the footer. It must show the
  A1–A4 findings of the data file.
- Every text pair passes AA **on its own fill** (the verify gate checks it).
- It renders in two places at once in hero mode (the compare view and the 140px no-JS
  thumbnail), so no `id` attributes inside.

## After (`Layers.astro`) — six sibling layers

The component outputs **exactly six sibling elements, no wrapper**:

```html
<div class="cp-layer cp-l1" style="--i:0">…</div>
<div class="cp-layer cp-l4" style="--i:3">…</div>
<div class="cp-layer cp-l6" style="--i:5">…</div>
<div class="cp-layer cp-l2" style="--i:1">…</div>
<div class="cp-layer cp-l3" style="--i:2">…</div>
<div class="cp-layer cp-l5" style="--i:4">…</div>
```

Each is `position: absolute; inset: 0` (full screen size) and draws in `--u`. Other
units drive them from outside — respect these, or the Build teardown and the exploded
view break:

- `--i` (0–5, inline style) is the layer's Z index in the exploded views. You may add
  your own custom properties to the same inline style (the stub passes its palette
  this way), never remove `--i`.
- **Do not set `transform`, `outline`, `will-change` or `::after` on the `.cp-layer`
  root.** Build (`scrub.ts`) writes `transform` and draws a lilac rim with `::after`;
  ExplodedPlate uses `transform` + `outline`. Put your own pseudo-elements on children.
- Class names `.cp-layer` and `.cp-l1`…`.cp-l6` are the public hooks. Everything else
  is scoped to your component.

| Layer | Meaning (Build legend) | Contents | Flat z-index |
|---|---|---|---|
| `.cp-l1` | Code | wireframe hairlines + box tags NAV / H1 / CTA / SERVICES | 0 (under l2) |
| `.cp-l2` | Design | nav, brand mark, name, city, headline, sub, art, services band — **the only opaque layer** | 1 |
| `.cp-l3` | Speed | image frames + load-waterfall bars, **no text**, `pointer-events: none` | 2 |
| `.cp-l4` | Google | JSON-LD card (`@type` = the concept's `schemaType`) + sitemap tree | 0 (under l2) |
| `.cp-l5` | Contact | the three buttons: primary / Call / WhatsApp | 3 |
| `.cp-l6` | Tracking | event pins, one per button (`events` in data) | 0 (under l2) |

Flat (hero, mini, static) the stack reads as one finished website: l1, l4 and l6 sit
under the opaque l2 — the parts of a real site nobody sees — then l3, then l5 on top.
Lifted in 3D, each layer shows on its own.

### Opacity and contrast (verify gate)

- **l2 must be fully opaque** (`background-color` = the palette `base`, every band on it
  opaque) so it hides l1/l4/l6 when flat.
- In the Build teardown the layers lift over the dark stage (`--void #08070D`, stars
  behind). So every text node **outside l2** must pass WCAG AA (4.5:1) **both on the
  concept's `base` and on `--void`**, or sit on its own opaque chip (the stub puts box
  tags and event names on accent chips, the JSON-LD card on `deep`, outline buttons on
  `base`). Text inside l2 only needs AA on its own l2 fill.
- Hex/rgb colours only on text (no `color-mix`, no opacity on text). `color-mix` is fine
  for hairlines and non-text fills.
- l2 art (SVG) must not put text on gradients or photos.

### Personalisation hooks

- `[data-cp-name]` on the business-name element in l2 (the configurator writes the
  visitor's business name into it; it must ellipsise: `overflow: hidden;
  white-space: nowrap; text-overflow: ellipsis` with a max width).
- `[data-cp-url]` is on the URL bar (ConceptPlate owns it).

### Motion

- A plate adds no entrance motion of its own in build / mini / static; hosts give the
  figure (or an ancestor) a reveal attribute. Hero mode's rebuild sweep and the idle
  sheen are ConceptPlate's.
- If a drawing animates internally (e.g. a pulse on the primary button), animate
  `transform`/`opacity` only, pause with `.cp.is-offscreen`, and write hidden starting
  states only under `html.js:not(.motion-reduced):not(.motion-failed)` with opacity 0.

## Palette (`ConceptPalette`)

`base` (l2 surface, screen fill — ConceptPlate exposes it as `--cp-bg` on the figure),
`base2` (media block), `deep` (JSON-LD card), `text` / `muted` (AA on `base` and on
`--void`), `band` / `band2` (light strip), `ink` / `ink2` (text on band), `accent` /
`onAccent` (fills and text on them), `line` (hairlines). Hosts use the palette to theme
mini previews (gallery cards, hero cycle), so keep it truthful to the drawing.

Each niche needs its own visual voice (colour, type stretch/weight, art), never a
recolour of Halden: the owner will see all five side by side.

## Copy rules

- Fictional, always: `.example` domain, `(xxx) 555-01xx` phone, and the caption
  `Concept NN · A study by Vesta · Fictional business, not client work` (`studyCaption`).
- The fictional business speaks in its own voice but still never uses "we / our / us"
  (the gate scans all rendered text, plates included) nor the banned vocabulary in
  `scripts/verify.mjs` (`bannedWords`).
- Plain, specific, US small-business English. The before site is dated, not stupid.

## Checklist before handing a niche back

1. `/lab/architect/` renders your concept in hero, mini, static (after + before) and
   lifted build mode; screenshot at 1440, 390 and 320.
2. Flat: reads as one finished site; nothing of l1/l4/l6 peeks out from under l2.
3. Lifted: every layer is legible over `--void`; l3 has no text.
4. Hero compare: drag the handle end to end — the before and after align at the blade,
   the "Rebuilt by Vesta" / "Before" tags (bottom edge) do not cover key content.
5. `data-cp-name` ellipsises with a 40-character name at 420px.
6. Annotations: anchors land on their features at 1440 and 390.
7. Gate (lab page): 0 contrast fails, 0 console errors, 0 overflow at 320–1440,
   0 banned words, no-JS render complete.
8. CSS stays lean — every page with a plate ships all five drawings' styles.
