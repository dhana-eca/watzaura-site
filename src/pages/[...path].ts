import type { APIRoute } from 'astro';

/**
 * The product site moved to https://arenzo.app on 30 Oct 2026. Every page that
 * used to live here 301s to the same path there, so old links, search results
 * and the app-store pages keep working. Anything else is a 404.
 */
export const prerender = false;

const MOVED = [
  '/product', '/pricing', '/who-its-for', '/switch', '/built-at-elite', '/demo',
  '/early-access', '/blog', '/rss.xml',
];

const handler: APIRoute = async ({ url }) => {
  const path = url.pathname.replace(/\/$/, '') || '/';
  if (path === '/company') return Response.redirect(new URL('/', url), 301);
  if (MOVED.some((p) => path === p || path.startsWith(p + '/'))) {
    return Response.redirect(`https://arenzo.app${path}${url.search}`, 301);
  }
  // rewrite('/404') cannot reach a prerendered page from here, so serve the
  // built 404.html with a 404 status.
  const page = await fetch(new URL('/404.html', url));
  return new Response(page.ok ? await page.text() : 'Not found', {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
};

export const GET = handler;
export const HEAD = handler;
