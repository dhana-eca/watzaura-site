/**
 * End-to-end check of the waitlist against a real Postgres.
 *
 *   DATABASE_URL=postgres://... node scripts/waitlist-e2e.mjs
 *
 * Builds nothing — run `npm run build` first. Starts the production server on
 * a spare port with a deliberately invalid Resend key, so the email step fails
 * and the "saved but not emailed" path is exercised without sending anything.
 * Exits non-zero on the first failed expectation.
 */
import { spawn } from 'node:child_process';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }
const port = 4399;
const base = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  HOST: '127.0.0.1',
  PORT: String(port),
  RESEND_API_KEY: 're_invalid_key_for_e2e',
  WAITLIST_FROM: 'Watzaura <hello@watzaura.com>',
  WAITLIST_NOTIFY: 'hello@watzaura.com',
};

const sql = postgres(url, { max: 1, ssl: false });
await sql`drop table if exists waitlist_signups`;

// 1. migrate
await run('node', ['scripts/db-migrate.mjs']);

// 2. serve
const server = spawn(process.execPath, ['scripts/serve.mjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
await waitFor(`${base}/api/waitlist`);

let failures = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};
const post = (body, headers = {}) =>
  fetch(`${base}/api/waitlist`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', ...headers }, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, body: await r.json() }));

try {
  const cfg = await fetch(`${base}/api/waitlist`).then((r) => r.json());
  check('GET reports configured', cfg.configured === true, JSON.stringify(cfg));

  const valid = { email: 'Owner@Example-Academy.com', organisation: 'Example Academy', role: 'Owner or director', country: 'Australia', notes: 'Two centres on Momence.' };
  let r = await post(valid);
  check('valid submission accepted', r.status === 200 && r.body.ok === true, JSON.stringify(r));
  check('email failure reported honestly', r.body.emailed === false, JSON.stringify(r.body));
  let rows = await sql`select * from waitlist_signups`;
  check('one row stored, email lower-cased', rows.length === 1 && rows[0].email === 'owner@example-academy.com', JSON.stringify(rows.map((x) => x.email)));
  check('notes stored', rows[0].notes === 'Two centres on Momence.');
  check('confirmed_at empty when email failed', rows[0].confirmed_at === null);

  r = await post({ ...valid, email: 'owner@example-academy.com' });
  check('duplicate email: same answer, no second row', r.status === 200 && (await sql`select count(*)::int as c from waitlist_signups`)[0].c === 1);

  r = await post({ email: 'nope', organisation: 'x', role: 'CEO', country: 'Mars' });
  check('invalid submission → 422 with field errors', r.status === 422 && r.body.fields && Object.keys(r.body.fields).length === 4, JSON.stringify(r.body));

  r = await post({ ...valid, email: 'bot@example.com', website: 'http://spam.example' });
  check('honeypot → fake success, nothing stored', r.status === 200 && (await sql`select count(*)::int as c from waitlist_signups where email = 'bot@example.com'`)[0].c === 0);

  r = await post(valid, { origin: 'https://evil.example' });
  check('cross-site origin → 403', r.status === 403);
  r = await post({ ...valid, email: 'same-site@example.com' }, { origin: `http://127.0.0.1:${port}` });
  check('same-site origin allowed', r.status === 200);

  // Rate limit: 5 per IP per 10 minutes. Counted so far: valid, duplicate,
  // same-site (honeypot and invalid are not counted).
  const fresh = (i) => ({ ...valid, email: `rl${i}@example.com` });
  const codes = [];
  for (let i = 0; i < 4; i++) codes.push((await post(fresh(i))).status);
  check('per-IP rate limit kicks in', codes.includes(429), codes.join(','));

  const form = await fetch(`${base}/api/waitlist`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: base, 'x-forwarded-for': '203.0.113.7' },
    body: new URLSearchParams({ email: 'form@example.com', organisation: 'Form Academy', role: 'Coach', country: 'India' }),
    redirect: 'manual',
  });
  check('no-JS form post → 303 to thanks', form.status === 303 && form.headers.get('location') === '/early-access/thanks', `${form.status} ${form.headers.get('location')}`);
  const bad = await fetch(`${base}/api/waitlist`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: base, 'x-forwarded-for': '203.0.113.8' },
    body: new URLSearchParams({ email: 'bad', organisation: 'x', role: 'x', country: 'x' }),
    redirect: 'manual',
  });
  check('no-JS invalid → 303 back with message', bad.status === 303 && (bad.headers.get('location') ?? '').startsWith('/early-access?error='), bad.headers.get('location'));
  const page = await fetch(`${base}${bad.headers.get('location')}`).then((x) => x.text());
  check('early-access page renders the message', page.includes('Enter a valid email address.'));
} finally {
  server.kill();
  await sql.end();
}
console.log(failures ? `\n${failures} failure(s)` : '\nall checks passed');
process.exit(failures ? 1 : 0);

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env: { ...process.env }, stdio: 'inherit', shell: process.platform === 'win32' });
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`${cmd} exited ${c}`))));
  });
}
async function waitFor(u) {
  for (let i = 0; i < 50; i++) {
    try { await fetch(u); return; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  throw new Error(`server did not start at ${u}`);
}
