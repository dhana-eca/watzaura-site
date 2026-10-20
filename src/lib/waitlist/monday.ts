/**
 * Copies each new early-access request onto the monday.com board "Watzaura
 * Sales Pipeline", where the sales follow-up is worked. Postgres stays the
 * record; monday gets a working copy (one item per academy).
 *
 *  - Off unless both MONDAY_API_TOKEN and MONDAY_SALES_BOARD_ID are set.
 *  - Columns and the "Active pipeline" group are found by title, so the code
 *    does not carry one board's generated column ids. Renaming a column on the
 *    board drops that value from new items (logged), nothing worse.
 *  - Never throws and is never awaited by the request: a monday outage cannot
 *    fail or slow down the visitor's submission, which is already stored.
 */
import type { Submission } from './index';

const API_VERSION = '2025-04';
const TIMEOUT_MS = 8000;

/** Column titles on the board, as created on 20 Oct 2026. */
export const TITLES = {
  stage: 'Stage',
  source: 'Lead source',
  email: 'Email',
  state: 'State',
  nextStep: 'Next step',
  nextStepDate: 'Next step date',
  notes: 'Notes',
} as const;
const GROUP_TITLE = 'Active pipeline';

type Layout = { columns: Map<string, string>; group?: string };
let cached: { board: string; layout: Layout } | null = null;

/** The calendar date in Melbourne, which is the date the board is read in. */
export function melbourneDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne' }).format(d);
}

/** Column values keyed by title, with no network involved. Exported for the checks. */
export function mondayItem(s: Submission, meta: { id: string; receivedAt: Date }) {
  const values: Record<string, unknown> = {
    [TITLES.stage]: { label: 'New lead' },
    [TITLES.source]: { labels: ['Website form'] },
    [TITLES.email]: { email: s.email, text: s.email },
    [TITLES.nextStep]: 'Reply to the early-access request',
    [TITLES.nextStepDate]: { date: melbourneDate(meta.receivedAt) },
    [TITLES.notes]: {
      text: [
        `Role: ${s.role}`,
        `Country: ${s.country}`,
        s.notes ? `\n${s.notes}` : '',
        `\nwatzaura.com early-access form, waitlist #${meta.id}, ${meta.receivedAt.toISOString()}`,
      ].filter(Boolean).join('\n').slice(0, 2000),
    },
  };
  // The form asks for a country, not a state; India is the one value the State column shares.
  if (s.country === 'India') values[TITLES.state] = { labels: ['India'] };
  return { name: s.organisation.slice(0, 255), values };
}

async function call(token: string, query: string, variables: Record<string, unknown>) {
  const res = await fetch(process.env.MONDAY_API_URL || 'https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: token, 'api-version': API_VERSION },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => null)) as { data?: any; errors?: unknown; error_message?: string } | null;
  // monday answers 200 with an `errors` array for a bad query or column value.
  if (!res.ok || !body?.data || body.errors) {
    throw new Error(`monday ${res.status}: ${JSON.stringify(body?.errors ?? body?.error_message ?? null).slice(0, 300)}`);
  }
  return body.data;
}

async function layout(token: string, board: string): Promise<Layout> {
  if (cached?.board === board) return cached.layout;
  const data = await call(token, 'query ($board: [ID!]) { boards(ids: $board) { columns { id title } groups { id title } } }', { board: [board] });
  const b = data.boards?.[0];
  if (!b) throw new Error(`monday board ${board} not found`);
  const l: Layout = {
    columns: new Map((b.columns as { id: string; title: string }[]).map((c) => [c.title, c.id])),
    group: (b.groups as { id: string; title: string }[]).find((g) => g.title === GROUP_TITLE)?.id,
  };
  cached = { board, layout: l };
  return l;
}

/**
 * Create the item. Resolves to what happened ('sent:<item id>' | 'skipped' |
 * 'failed'); never rejects.
 */
export async function pushToMonday(s: Submission, meta: { id: string; receivedAt: Date }): Promise<string> {
  const token = process.env.MONDAY_API_TOKEN?.trim();
  const board = process.env.MONDAY_SALES_BOARD_ID?.trim();
  if (!token || !board) return 'skipped';
  try {
    const { columns, group } = await layout(token, board);
    const item = mondayItem(s, meta);
    const values: Record<string, unknown> = {};
    for (const [title, v] of Object.entries(item.values)) {
      const id = columns.get(title);
      if (id) values[id] = v;
      else console.error(`waitlist: monday column "${title}" not found on board ${board}`);
    }
    const data = await call(
      token,
      'mutation ($board: ID!, $group: String, $name: String!, $values: JSON) { create_item(board_id: $board, group_id: $group, item_name: $name, column_values: $values) { id } }',
      { board, group: group ?? null, name: item.name, values: JSON.stringify(values) },
    );
    return `sent:${data.create_item.id}`;
  } catch (e) {
    cached = null; // a renamed column or a new board is picked up on the next try
    console.error(`waitlist: monday push failed for #${meta.id}`, e);
    return 'failed';
  }
}
