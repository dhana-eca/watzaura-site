// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// Every page is prerendered to static HTML at build time. The only route that
// runs on the server is /api/waitlist (it opts out with `prerender = false`),
// which is why the Node adapter is present. See README → Deployment.
export default defineConfig({
  // Canonical host is www. The apex redirects to it at Render's edge, so every
  // canonical URL, sitemap entry and OG url below is written with www.
  site: 'https://www.watzaura.com',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  trailingSlash: 'never',
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/early-access/thanks'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: 'always', // one round trip fewer; the sheet is small once compressed
  },
  security: {
    // Astro rejects cross-site form posts to /api/waitlist (CSRF). For that
    // check to see the real host behind Render's proxy, and for Astro.url to be
    // right, the hosts the site is served on must be listed here.
    checkOrigin: true,
    allowedDomains: [
      { hostname: 'www.watzaura.com' },
      // The apex is kept here so a request that reaches the app directly (not
      // via the edge redirect) is still trusted rather than 403'd.
      { hostname: 'watzaura.com' },
      { hostname: '**.onrender.com' },
      { hostname: 'localhost' },
      { hostname: '127.0.0.1' },
    ],
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
});
