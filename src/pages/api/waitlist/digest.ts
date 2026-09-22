import type { APIRoute } from 'astro';
import postgres from 'postgres';
import { Resend } from 'resend';

/**
 * Weekly waitlist digest: emails the last seven days of early-access requests
 * to WAITLIST_NOTIFY. Triggered by .github/workflows/waitlist-digest.yml with
 * `Authorization: Bearer $DIGEST_SECRET`. Never exposes rows to the caller —
 * the response is a count only.
 */
export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const POST: APIRoute = async ({ request }) => {
  const secret = process.env.DIGEST_SECRET;
  const auth = request.headers.get('authorization') ?? '';
  if (!secret || auth !== `Bearer ${secret}`) return json({ ok: false, error: 'Unauthorized' }, 401);

  const { DATABASE_URL, RESEND_API_KEY, WAITLIST_FROM, WAITLIST_NOTIFY } = process.env;
  if (!DATABASE_URL || !RESEND_API_KEY || !WAITLIST_FROM || !WAITLIST_NOTIFY) return json({ ok: false, error: 'Not configured' }, 503);

  const days = Math.min(31, Math.max(1, Number(new URL(request.url).searchParams.get('days') ?? 7)));
  const sql = postgres(DATABASE_URL, { max: 1, ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1') ? false : 'require' });
  try {
    const rows = await sql<{ email: string; organisation: string; role: string; country: string; notes: string | null; created_at: Date; confirmed_at: Date | null }[]>`
      select email, organisation, role, country, notes, created_at, confirmed_at
      from waitlist_signups
      where created_at > now() - make_interval(days => ${days})
      order by created_at desc`;
    const [{ total }] = await sql<{ total: number }[]>`select count(*)::int as total from waitlist_signups`;

    const fmt = (d: Date) => new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
    const lines = rows.map((r) => `${fmt(r.created_at)}  ${r.organisation} · ${r.role} · ${r.country}\n  ${r.email}${r.confirmed_at ? '' : '  (confirmation email not sent)'}${r.notes ? `\n  "${r.notes}"` : ''}`);
    const text = rows.length
      ? `${rows.length} early-access request${rows.length === 1 ? '' : 's'} in the last ${days} days (${total} on the list in total).\n\n${lines.join('\n\n')}\n\nReply to each from hello@watzaura.com.`
      : `No new early-access requests in the last ${days} days. ${total} on the list in total.`;
    const html = `<pre style="font:14px/1.5 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap">${esc(text)}</pre>`;

    const resend = new Resend(RESEND_API_KEY);
    const r = await resend.emails.send({ from: WAITLIST_FROM, to: WAITLIST_NOTIFY, subject: `Plinth early access — ${rows.length} new this week`, text, html });
    if (r.error) return json({ ok: false, error: `Resend: ${r.error.message}`, count: rows.length }, 502);
    return json({ ok: true, count: rows.length, total, sent: true });
  } finally {
    await sql.end();
  }
};
