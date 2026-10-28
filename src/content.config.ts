import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * All copy lives in src/content. Pages read structured copy from frontmatter
 * (so the layout stays in components) and render the MDX body where a page
 * has long-form text. Edit the .mdx files; nothing else needs to change.
 */
const link = z.object({ label: z.string(), href: z.string() });

const item = z.object({
  title: z.string(),
  body: z.string().optional(),
  /** Small mono label shown above or beside the title. */
  meta: z.string().optional(),
  href: z.string().optional(),
  /** Bullet points under the body. */
  points: z.array(z.string()).optional(),
});

const section = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  lede: z.string().optional(),
  body: z.string().optional(),
  items: z.array(item).optional(),
  cta: link.optional(),
  /** Free-form extra strings a specific section design needs. */
  extra: z.record(z.string()).optional(),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    eyebrow: z.string().optional(),
    heading: z.string(),
    lede: z.string().optional(),
    ctas: z.array(link).optional(),
    sections: z.record(section).default({}),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
  }),
});

const legal = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/legal' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** Shown as "Draft for legal review" until set to a real date. */
    effective: z.string().optional(),
    draft: z.boolean().default(true),
  }),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    /** One or two sentences; used as the meta description, the listing blurb and the RSS summary. */
    description: z.string(),
    date: z.coerce.date(),
    author: z.string().default('Watzaura'),
    /** Hidden from the blog, sitemap and RSS until false. */
    draft: z.boolean().default(false),
  }),
});

export const collections = { pages, legal, posts };
