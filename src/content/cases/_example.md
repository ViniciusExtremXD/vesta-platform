---
# DRAFT — files starting with "_" never build. Copy this to a real slug
# (e.g. "acme-hvac.md"), fill every field with measured data, get the
# client's written OK, then set `confirmed: true`.
title: 'Acme Heating & Air — campaign landing page'
client: 'Acme Heating & Air'
vertical: 'hvac'
location: 'Austin, TX'
summary: 'A single landing page for Google Local Services traffic, replacing a five-second template page.'
url: 'https://example.com'
launched: 2026-10-15
problem: 'Paid clicks landed on a page-builder home page that took 5.2 s to load on mobile. The phone number was below the fold.'
solution: 'One static page, one offer, click-to-call in the first screen, a two-field form wired into Jobber. Tracking for Google Ads conversions.'
metrics:
  - label: 'Lighthouse performance (mobile)'
    before: '38'
    after: '100'
    tool: 'Lighthouse 12, mobile emulation'
    measured: 2026-10-15
  - label: 'Largest Contentful Paint (mobile)'
    before: '5.2 s'
    after: '0.9 s'
    tool: 'Lighthouse 12, mobile emulation'
    measured: 2026-10-15
confirmed: false
---

Long-form write-up goes here: what the page had to do, what was built, what
was measured and how. Screenshots go in `src/assets/cases/`.
