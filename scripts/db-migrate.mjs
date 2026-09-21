// Creates the waitlist table. Needs DATABASE_URL. Idempotent.
//   DATABASE_URL=postgres://... npm run db:migrate
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}
const sql = postgres(url, { max: 1, ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : 'require' });
try {
  await sql.unsafe(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  const [{ count }] = await sql`select count(*)::int as count from waitlist_signups`;
  console.log(`waitlist_signups ready (${count} rows)`);
} finally {
  await sql.end();
}
