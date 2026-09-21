/**
 * Early-access waitlist. Validation, storage (Postgres), confirmation email
 * (Resend) and an in-memory rate limit. The endpoint in
 * src/pages/api/waitlist.ts is a thin wrapper around `submit()`.
 *
 * Configuration comes from the process environment at runtime (see
 * .env.example). When it is missing, `submit()` throws NotConfigured and the
 * endpoint answers 503 — the form never pretends a submission succeeded.
 */
import postgres from 'postgres';
import { Resend } from 'resend';

export const ROLES = ['Owner or director', 'Centre manager', 'Head coach', 'Coach', 'Administrator', 'Other'] as const;
export const COUNTRIES = ['Australia', 'India', 'New Zealand', 'United Kingdom', 'United States', 'Other'] as const;

export interface Submission {
  email: string;
  organisation: string;
  role: string;
  country: string;
  notes?: string;
}

export class ValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super('Invalid submission');
  }
}
export class NotConfigured extends Error {
  constructor() {
    super('Waitlist is not configured');
  }
}
export class RateLimited extends Error {
  constructor() {
    super('Too many requests');
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

export function validate(raw: Record<string, unknown>): Submission {
  const email = clean(raw.email, 254).toLowerCase();
  const organisation = clean(raw.organisation, 120);
  const role = clean(raw.role, 60);
  const country = clean(raw.country, 60);
  const notes = clean(raw.notes, 1000) || undefined;
  const fields: Record<string, string> = {};
  if (!EMAIL_RE.test(email)) fields.email = 'Enter a valid email address.';
  if (organisation.length < 2) fields.organisation = 'Tell us the name of your academy or facility.';
  if (!ROLES.includes(role as (typeof ROLES)[number])) fields.role = 'Choose the closest role.';
  if (!COUNTRIES.includes(country as (typeof COUNTRIES)[number])) fields.country = 'Choose a country.';
  if (Object.keys(fields).length) throw new ValidationError(fields);
  return { email, organisation, role, country, notes };
}

/* ---- Rate limit: sliding window per key, in memory. One instance is all a
   marketing site runs, and losing the counters on restart is acceptable. ---- */
const windows = new Map<string, number[]>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) throw new RateLimited();
  hits.push(now);
  windows.set(key, hits);
  if (windows.size > 10_000) windows.clear(); // never let it grow without bound
}

/* ---- Storage ---- */
let sql: ReturnType<typeof postgres> | null = null;
function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new NotConfigured();
  sql ??= postgres(url, { max: 3, idle_timeout: 20, connect_timeout: 10, ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : 'require' });
  return sql;
}

// Table definition: scripts/schema.sql (applied with `npm run db:migrate`).

/** Inserts the signup. Returns false if the email was already on the list. */
async function store(s: Submission, meta: { ip: string; userAgent: string }): Promise<boolean> {
  const rows = await db()`
    insert into waitlist_signups (email, organisation, role, country, notes, ip, user_agent)
    values (${s.email}, ${s.organisation}, ${s.role}, ${s.country}, ${s.notes ?? null}, ${meta.ip}, ${meta.userAgent.slice(0, 300)})
    on conflict (lower(email)) do nothing
    returning id`;
  return rows.length > 0;
}

/* ---- Email ---- */
function mailer() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.WAITLIST_FROM;
  const notify = process.env.WAITLIST_NOTIFY;
  if (!key || !from || !notify) throw new NotConfigured();
  return { resend: new Resend(key), from, notify };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function confirmationHtml(s: Submission) {
  return `<!doctype html><html lang="en"><body style="margin:0;background:#080D18;color:#C2CDE0;font-family:Archivo,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080D18"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding-bottom:24px;font-family:Georgia,serif;font-size:22px;color:#EEF2F9"><span style="display:inline-block;width:10px;height:10px;background:#E0A45C;margin-right:8px"></span>Watzaura</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:28px;line-height:1.15;color:#EEF2F9;padding-bottom:16px">We have your request for early access.</td></tr>
<tr><td style="padding-bottom:16px">Thanks for telling us about <strong style="color:#EEF2F9">${esc(s.organisation)}</strong>. One of the people who built Plinth will read it and reply from this address. There is no automated sequence after this email.</td></tr>
<tr><td style="padding-bottom:16px">If your academy looks like a fit we will ask a few questions about how you run today and what you are trying to change, and offer a walkthrough on your terms.</td></tr>
<tr><td style="padding:16px 0;border-top:1px solid #22304C;font-size:14px;color:#8290AB">Watzaura Infotech Pty Ltd · ABN 32 702 553 857 · Melbourne, Australia<br>If you did not request this, reply and we will remove you.</td></tr>
</table></td></tr></table></body></html>`;
}

function confirmationText(s: Submission) {
  return `We have your request for early access to Plinth.

Thanks for telling us about ${s.organisation}. One of the people who built Plinth will read it and reply from this address. There is no automated sequence after this email.

If your academy looks like a fit we will ask a few questions about how you run today and what you are trying to change, and offer a walkthrough on your terms.

Watzaura Infotech Pty Ltd · ABN 32 702 553 857 · Melbourne, Australia
If you did not request this, reply and we will remove you.`;
}

async function sendEmails(s: Submission) {
  const { resend, from, notify } = mailer();
  const confirmation = await resend.emails.send({
    from,
    to: s.email,
    replyTo: notify,
    subject: 'Your early-access request for Plinth',
    html: confirmationHtml(s),
    text: confirmationText(s),
  });
  if (confirmation.error) throw new Error(`Resend: ${confirmation.error.message}`);
  // Internal notification. A failure here must not fail the user's request.
  await resend.emails
    .send({
      from,
      to: notify,
      replyTo: s.email,
      subject: `Early access: ${s.organisation} (${s.country})`,
      text: `Email: ${s.email}\nOrganisation: ${s.organisation}\nRole: ${s.role}\nCountry: ${s.country}\n\n${s.notes ?? '(no notes)'}`,
    })
    .catch((e) => console.error('waitlist: notify failed', e));
  await db()`update waitlist_signups set confirmed_at = now() where lower(email) = ${s.email}`;
}

export function isConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.RESEND_API_KEY && process.env.WAITLIST_FROM && process.env.WAITLIST_NOTIFY);
}

/**
 * The whole flow. Throws ValidationError, RateLimited or NotConfigured; any
 * other error means storage or email failed and the caller answers 500.
 */
export async function submit(raw: Record<string, unknown>, meta: { ip: string; userAgent: string }) {
  if (!isConfigured()) throw new NotConfigured();
  const s = validate(raw);
  rateLimit(`ip:${meta.ip}`, 5, 10 * 60 * 1000);
  rateLimit(`email:${s.email}`, 2, 24 * 60 * 60 * 1000);
  const created = await store(s, meta);
  // Already on the list: say nothing different to the caller (no enumeration)
  // and do not send a second confirmation.
  if (!created) return { ok: true as const, emailed: true };
  try {
    await sendEmails(s);
    return { ok: true as const, emailed: true };
  } catch (e) {
    // The row is saved and a person will still reply; say so rather than
    // failing the request or claiming an email went out.
    console.error('waitlist: confirmation email failed', e);
    return { ok: true as const, emailed: false };
  }
}
