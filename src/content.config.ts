import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

/**
 * Case studies. A file only ships when `confirmed: true` — meaning the
 * client authorised the name and the numbers below were actually measured.
 * Files starting with "_" are drafts and are never loaded.
 */
const cases = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/cases' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      client: z.string(),
      vertical: z.string(),
      location: z.string(),
      summary: z.string(),
      cover: image().optional(),
      url: z.string().url().optional(),
      launched: z.coerce.date(),
      problem: z.string(),
      solution: z.string(),
      /** Every number needs a date and a tool, or it does not render. */
      metrics: z
        .array(
          z.object({
            label: z.string(),
            before: z.string(),
            after: z.string(),
            tool: z.string(),
            measured: z.coerce.date(),
          })
        )
        .default([]),
      confirmed: z.boolean().default(false),
    }),
});

export const collections = { cases };
