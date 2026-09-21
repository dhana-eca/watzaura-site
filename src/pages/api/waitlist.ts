import type { APIRoute } from 'astro';
import { submit, ValidationError, RateLimited, NotConfigured, isConfigured } from '@/lib/waitlist';
import { site } from '@/lib/site';

// The one route that runs on the server.
export const prerender = false;

// Hostnames (no port) an Origin header may carry: the host this request came
// in on, the public domain, loopback for local testing, and any extras.
const allowedHostnames = (request: Request) => {
  const extra = (process.env.WAITLIST_ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const forwarded = request.headers.get('x-forwarded-host')?.split(',')[0].trim().replace(/:d+$/, '');
  return new Set([
    new URL(request.url).hostname,
    forwarded ?? '',
    site.domain,
    `www.${site.domain}`,
    'localhost',
    '127.0.0.1',
    ...extra.map((o) => new URL(o).hostname),
  ]);
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const NOT_OPEN = 'The waitlist is not accepting submissions yet. Email hello@watzaura.com and we will add you by hand.';

export const GET: APIRoute = () => json({ configured: isConfigured() });

export const POST: APIRoute = async ({ request, clientAddress, redirect }) => {
  const ct = request.headers.get('content-type') ?? '';
  const wantsJson = ct.includes('application/json') || (request.headers.get('accept') ?? '').includes('application/json');

  // Same-site only: the Origin a browser sends must match the host this
  // request arrived on (or the public domain). Curl-style clients without an
  // Origin are allowed so the endpoint can be tested from a shell.
  const origin = request.headers.get('origin');
  if (origin) {
    let hostname = '';
    try { hostname = new URL(origin).hostname; } catch { /* malformed → forbidden */ }
    if (!allowedHostnames(request).has(hostname)) return json({ ok: false, error: 'Forbidden' }, 403);
  }

  let raw: Record<string, unknown> = {};
  try {
    if (ct.includes('application/json')) raw = (await request.json()) as Record<string, unknown>;
    else raw = Object.fromEntries((await request.formData()).entries());
  } catch {
    return json({ ok: false, error: 'Bad request' }, 400);
  }

  // Honeypot: real users never see or fill this field. Pretend it worked.
  if (typeof raw.website === 'string' && raw.website.trim() !== '') {
    return wantsJson ? json({ ok: true }) : redirect('/early-access/thanks', 303);
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || clientAddress || 'unknown';
  const userAgent = request.headers.get('user-agent') ?? '';

  try {
    const result = await submit(raw, { ip, userAgent });
    return wantsJson ? json({ ok: true, emailed: result.emailed }) : redirect('/early-access/thanks', 303);
  } catch (e) {
    if (e instanceof ValidationError) {
      return wantsJson
        ? json({ ok: false, error: 'Check the highlighted fields.', fields: e.fields }, 422)
        : redirect(`/early-access?error=${encodeURIComponent(Object.values(e.fields)[0] ?? 'Check the form.')}`, 303);
    }
    if (e instanceof RateLimited) {
      const msg = 'Too many requests from this address. Try again in a few minutes, or email hello@watzaura.com.';
      return wantsJson ? json({ ok: false, error: msg }, 429) : redirect(`/early-access?error=${encodeURIComponent(msg)}`, 303);
    }
    if (e instanceof NotConfigured) {
      return wantsJson ? json({ ok: false, error: NOT_OPEN }, 503) : redirect(`/early-access?error=${encodeURIComponent(NOT_OPEN)}`, 303);
    }
    console.error('waitlist: submission failed', e);
    const msg = 'Something went wrong on our side and your request was not saved. Email hello@watzaura.com and we will add you by hand.';
    return wantsJson ? json({ ok: false, error: msg }, 500) : redirect(`/early-access?error=${encodeURIComponent(msg)}`, 303);
  }
};
