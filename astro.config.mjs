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
  // Self-hosted, subsetted, preloaded. Fallbacks are metric-matched stacks.
  fonts: [
    {
      name: 'Archivo',
      cssVariable: '--font-display',
      provider: fontProviders.google(),
      weights: ['400 900'],
      styles: ['normal'],
      subsets: ['latin'],
      display: 'swap',
      fallbacks: ['Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
    },
    {
      name: 'Instrument Serif',
      cssVariable: '--font-serif',
      provider: fontProviders.google(),
      weights: ['400'],
      styles: ['italic'],
      subsets: ['latin'],
      display: 'swap',
      fallbacks: ['Georgia', 'Times New Roman', 'serif'],
    },
    {
      name: 'JetBrains Mono',
      cssVariable: '--font-mono',
      provider: fontProviders.google(),
      weights: ['400 700'],
      styles: ['normal'],
      subsets: ['latin'],
      display: 'swap',
      fallbacks: ['ui-monospace', 'Cascadia Mono', 'Consolas', 'monospace'],
    },
  ],
  devToolbar: { enabled: false },
});
