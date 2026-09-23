// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// GitHub Pages serves a project site from /<repo>/. On the custom domain
// (vesta.systems) BASE_PATH is empty. The deploy workflow sets both.
const BASE_PATH = process.env.BASE_PATH || '';
const SITE = process.env.SITE_URL || 'https://viniciusextremxd.github.io/vesta-platform';

export default defineConfig({
  site: SITE,
  base: BASE_PATH || undefined,
  trailingSlash: 'always',
  output: 'static',
  build: {
    format: 'directory',
    inlineStylesheets: 'always',
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
    }),
  ],
  image: {
    responsiveStyles: true,
  },
  // One self-hosted variable family (Mona Sans, SIL OFL): wdth 75–125 and
  // wght 200–900 in a single latin file. Display type runs at wdth 115, text at
  // 100, and the Stance statement scrubs the width axis live.
  fonts: [
    {
      name: 'Mona Sans',
      cssVariable: '--font-sans',
      provider: fontProviders.google(),
      weights: ['200 900'],
      styles: ['normal'],
      subsets: ['latin'],
      display: 'swap',
      fallbacks: ['Arial', 'Helvetica Neue', 'sans-serif'],
      options: { experimental: { variableAxis: { wdth: [['75', '125']] } } },
    },
  ],
  devToolbar: { enabled: false },
});
