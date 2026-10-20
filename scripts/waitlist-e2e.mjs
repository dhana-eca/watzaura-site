/**
 * End-to-end check of the waitlist against a real Postgres.
 *
 *   DATABASE_URL=postgres://... node scripts/waitlist-e2e.mjs
 *
 * Builds nothing — run `npm run build` first. Starts the production server on
 * a spare port with a deliberately invalid Resend key, so the email step fails
 * and the "saved but not emailed" path is exercised without sending anything.
 * The monday.com API is a local stand-in that records what it is sent.
 * Exits non-zero on the first failed expectation.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }
const port = 4399;
const base = `http://127.0.0.1:${port}`;
const mondayPort = 4398;
const env = {
  ...process.env,
  HOST: '127.0.0.1',
  PORT: String(port),
  RESEND_API_KEY: 're_invalid_key_for_e2e',
  WAITLIST_FROM: 'Watzaura <hello@watzaura.com>',
  WAITLIST_NOTIFY: 'hello@watzaura.com',
  MONDAY_API_TOKEN: 'monday-e2e-token',
  MONDAY_SALES_BOARD_ID: '5032008672',
  MONDAY_API_URL: `http://127.0.0.1:${mondayPort}/v2`,
};

// Stand-in for api.monday.com. Answers the board-layout query with the real
// board's titles, creates items, and fails for one academy name.
const COLUMNS = { Stage: 'color_x', 'Lead source': 'dropdown_x', Email: 'email_x', State: 'dropdown_s', 'Next step': 'text_x', 'Next step date': 'date_x', Notes: 'long_text_x' };
const created = [];
const monday = createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const { query, variables } = JSON.parse(raw);
  const reply = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (query.includes('boards(')) {
    return reply(200, { data: { boards: [{ columns: Object.entries(COLUMNS).map(([title, id]) => ({ id, title })), groups: [{ id: 'topics', title: 'Active pipeline' }, { id: 'group_closed', title: 'Closed' }] }] } });
  }
  created.push({ auth: req.headers.authorization, ...variables, values: JSON.parse(variables.values) });
  if (variables.name === 'Monday Down Academy') return reply(500, { error_message: 'Internal server error' });
  reply(200, { data: { create_item: { id: String(9000 + created.length) } } });
});
await new Promise((r) => monday.listen(mondayPort, '127.0.0.1', r));

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

  const item = await waitForItem('Example Academy');
  check('monday item created, named after the academy', Boolean(item), JSON.stringify(created.map((c) => c.name)));
  check('monday call uses the token, board and Active pipeline group', item?.auth === 'monday-e2e-token' && item?.board === '5032008672' && item?.group === 'topics', JSON.stringify(item && { auth: item.auth, board: item.board, group: item.group }));
  const v = item?.values ?? {};
  check('monday Stage = New lead, Lead source = Website form', v.color_x?.label === 'New lead' && v.dropdown_x?.labels?.[0] === 'Website form', JSON.stringify(v));
  check('monday email, next step and notes mapped', v.email_x?.email === 'owner@example-academy.com' && v.text_x && /^\d{4}-\d{2}-\d{2}$/.test(v.date_x?.date ?? '')
    && v.long_text_x?.text.includes('Role: Owner or director') && v.long_text_x.text.includes('Two centres on Momence.') && v.long_text_x.text.includes(`waitlist #${rows[0].id}`), JSON.stringify(v));
  check('monday State left empty for Australia (form has no state)', !('dropdown_s' in v));

  r = await post({ ...valid, email: 'owner@example-academy.com' });
  check('duplicate email: same answer, no second row', r.status === 200 && (await sql`select count(*)::int as c from waitlist_signups`)[0].c === 1);
  await new Promise((res) => setTimeout(res, 300));
  check('duplicate email: no second monday item', created.filter((c) => c.name === 'Example Academy').length === 1);

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
  const india = await waitForItem('Form Academy');
  check('monday State = India for an Indian academy', india?.values.dropdown_s?.labels?.[0] === 'India', JSON.stringify(india?.values));
  const bad = await fetch(`${base}/api/waitlist`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: base, 'x-forwarded-for': '203.0.113.8' },
    body: new URLSearchParams({ email: 'bad', organisation: 'x', role: 'x', country: 'x' }),
    redirect: 'manual',
  });
  check('no-JS invalid → 303 back with message', bad.status === 303 && (bad.headers.get('location') ?? '').startsWith('/early-access?error='), bad.headers.get('location'));
  const page = await fetch(`${base}${bad.headers.get('location')}`).then((x) => x.text());
  check('early-access page renders the message', page.includes('Enter a valid email address.'));

  r = await post({ ...valid, email: 'down@example.com', organisation: 'Monday Down Academy' }, { 'x-forwarded-for': '203.0.113.9' });
  check('monday failure: submission still accepted', r.status === 200 && r.body.ok === true, JSON.stringify(r));
  check('monday failure: row still stored', (await sql`select count(*)::int as c from waitlist_signups where email = 'down@example.com'`)[0].c === 1);
  check('monday failure: the push was attempted', Boolean(await waitForItem('Monday Down Academy')));

  // Without the two monday variables the server never calls monday.
  const offPort = port - 2;
  const { MONDAY_API_TOKEN, MONDAY_SALES_BOARD_ID, ...offEnv } = env;
  const off = spawn(process.execPath, ['scripts/serve.mjs'], { env: { ...offEnv, PORT: String(offPort) }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await waitFor(`http://127.0.0.1:${offPort}/api/waitlist`);
    const before = created.length;
    const res = await fetch(`http://127.0.0.1:${offPort}/api/waitlist`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', 'x-forwarded-for': '203.0.113.10' },
      body: JSON.stringify({ ...valid, email: 'unset@example.com', organisation: 'No Monday Academy' }),
    });
    await new Promise((res) => setTimeout(res, 500));
    check('monday unset: submission accepted, no monday call', res.status === 200 && created.length === before, `${res.status}, ${created.length - before} call(s)`);
  } finally {
    off.kill();
  }
} finally {
  server.kill();
  monday.close();
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
async function waitForItem(name) {
  for (let i = 0; i < 50; i++) {
    const hit = created.find((c) => c.name === name);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 100));
  }
  return undefined;
}
async function waitFor(u) {
  for (let i = 0; i < 50; i++) {
    try { await fetch(u); return; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  throw new Error(`server did not start at ${u}`);
}
