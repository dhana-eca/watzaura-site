# watzaura.com

Corporate and product site for **Watzaura Infotech Pty Ltd** and its product **Plinth**. Astro 5, Tailwind 4, MDX. Every page is static HTML; one server route (`/api/waitlist`) takes early-access requests, plus `/early-access` is server-rendered so a no-JavaScript submission can come back with its error message.

## Run and build

```bash
npm install
npm run dev        # http://localhost:4321 — live reload
npm run build      # dist/ (client + server)
npm start          # serve the build the way Render does (PORT, HOST from env)
npm run check      # astro check — types and templates
npm run lighthouse # Lighthouse on every page, writes lighthouse/summary.md
```

Node 22+. No global tools needed.

## Where the copy lives

All words are in `src/content/` and nothing else needs to change to edit them.

| File | Page |
|---|---|
| `src/content/pages/home.mdx` | `/` |
| `src/content/pages/product.mdx` | `/product` |
| `src/content/pages/operations.mdx`, `development.mdx`, `mobile.mdx` | `/product/…` |
| `src/content/pages/who-its-for.mdx` | `/who-its-for` |
| `src/content/pages/built-at-elite.mdx` | `/built-at-elite` |
| `src/content/pages/switch.mdx` | `/switch` |
| `src/content/pages/pricing.mdx` | `/pricing` |
| `src/content/pages/company.mdx` | `/company` |
| `src/content/pages/early-access.mdx` | `/early-access` |
| `src/content/legal/privacy.mdx`, `terms.mdx`, `account-deletion.mdx` | `/legal/…` |

Page copy is in the YAML frontmatter, keyed by section (`sections.problem.heading`, `sections.problem.items[0].body`, …). The page component decides layout; the `.mdx` decides words. Legal pages are prose: the Markdown body renders as the document, and `draft: true` shows the "draft for legal review" banner until it is set to `false` with an `effective` date.

Company facts used by components (ABN, ACN, email, JSON-LD) are in `src/lib/site.ts`. Navigation is there too.

Layout and design live in `src/components/` and `src/styles/global.css`. The palette and typefaces are defined once, as Tailwind tokens, at the top of `global.css`; nothing in the markup names a hex colour.

## The waitlist

`POST /api/waitlist` stores `email, organisation, role, country, notes, ip, user_agent, created_at` in Postgres (`waitlist_signups`) and sends two emails through Resend: a confirmation to the requester, and a notification to `WAITLIST_NOTIFY`. Code: `src/lib/waitlist/index.ts`, `src/pages/api/waitlist.ts`, form in `src/components/WaitlistForm.astro`.

Protections: server-side validation, a honeypot field (`website`), per-IP (5 / 10 min) and per-email (2 / day) rate limits, same-site origin check (Astro's CSRF check plus our own), duplicate emails absorbed without a second confirmation.

Honesty rules, enforced in code:

- Not configured (no database or no Resend key) → **503** and the form says the list is not open yet and gives the email address. It never fakes success.
- Stored but the confirmation email failed → the row is kept and the form says so ("a person will still reply"), not "your request was lost".
- Works without JavaScript: plain POST, 303 back to `/early-access/thanks` or to `/early-access?error=…`.

Environment (see `.env.example`):

```
DATABASE_URL      Postgres connection string
RESEND_API_KEY    from resend.com — the sending domain must be verified there
WAITLIST_FROM     e.g. "Watzaura <hello@watzaura.com>" (must be on the verified domain)
WAITLIST_NOTIFY   where new requests are announced, e.g. hello@watzaura.com
```

`npm run db:migrate` creates the table (idempotent; `scripts/schema.sql`). `scripts/waitlist-e2e.mjs` runs the whole flow against a real Postgres and checks every branch — run it with `DATABASE_URL` pointing at a scratch database; it drops and recreates the table.

To read the list: `select email, organisation, role, country, notes, created_at from waitlist_signups order by created_at desc;`

## Deployment

The build is `dist/client` (static files) plus `dist/server/entry.mjs` (a Node server that serves them and runs the two dynamic routes). Any host that runs Node works.

**Render (recommended — Watzaura already runs the application there).** `render.yaml` is a Blueprint: one starter web service and one free Postgres. In the Render dashboard: New → Blueprint → point at this repo. Then set `RESEND_API_KEY` (marked `sync: false`), add the custom domain `watzaura.com` (and `www`), and let Render issue the certificate. The build command runs `db:migrate`, so the table exists before the first request. Redeploys are automatic on push to `main`.

**Cloudflare Pages / Netlify.** Swap `@astrojs/node` for `@astrojs/cloudflare` or `@astrojs/netlify` in `astro.config.mjs` (one line), keep `output: 'static'`; the two server routes become a function. The waitlist code uses the `postgres` driver over TCP, which Cloudflare Workers support through Hyperdrive; on Netlify it works as-is.

DNS: an `A`/`CNAME` for `watzaura.com` and `www` to the host, and Resend's DKIM/SPF records for the sending domain.

## Assets

- **Fonts** are self-hosted in `public/fonts/` (latin subsets from Fontsource, SIL OFL; licences alongside). `font-display: swap`, the two critical faces preloaded. CLS measured at 0 on every page.
- **Social image and favicons** are generated: `node scripts/og.mjs` (uses `scripts/fonts/*.ttf`, decompressed from the woff2 files with `wawoff2`). Edit the text in that script if the headline changes.
- **Wordmarks** — no logo exists. `src/components/Wordmark.astro` sets "Watzaura" and "Plinth" in Fraunces with one brass block. Replace that component when a real mark exists.
- **Product visuals** are rendered in HTML/CSS (`src/components/ui/`) with an invented academy ("Northgate Cricket Academy") and invented players. Each is labelled as an illustration on the page. They depict what Plinth does today; if the product changes, change them.
- **Photographs of the centres** — none yet. Add files to `src/assets/centres/` and list them in `src/lib/photos.ts`; `/built-at-elite` then renders the gallery automatically and drops the "photographs only with consent on file" notice. **Do not add an image showing an identifiable child unless a guardian's signed media consent is on file**, and record who checked in the `consent` field.

## Measured Lighthouse scores

Mobile preset, simulated throttling, Lighthouse 13.5, measured against the live site (https://watzaura.com, brotli-compressed by Render) on 22 Sep 2026 — full table in `lighthouse/summary.md`. Regenerate with `npm run lighthouse -- https://watzaura.com`; the local variant (`npm run lighthouse`) serves the build uncompressed and scores a few points lower.

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| / | 99 | 100 | 100 | 100 |
| /product | 99 | 100 | 100 | 100 |
| /product/operations | 98 | 100 | 100 | 100 |
| /product/development | 96 | 100 | 100 | 100 |
| /product/mobile | 98 | 100 | 100 | 100 |
| /who-its-for | 98 | 100 | 100 | 100 |
| /built-at-elite | 100 | 100 | 100 | 100 |
| /switch | 98 | 100 | 100 | 100 |
| /pricing | 98 | 100 | 100 | 100 |
| /company | 97 | 100 | 100 | 100 |
| /early-access | 94 | 100 | 100 | 100 |
| /legal/privacy | 99 | 100 | 100 | 100 |
| /legal/account-deletion | 99 | 100 | 100 | 100 |

LCP 1.5–2.3 s (2.7 s on /early-access, the one server-rendered page), CLS 0, TBT ≤ 10 ms. All motion is CSS on transform/opacity; every animated element is complete at rest, and nothing runs under prefers-reduced-motion.

Contrast ratios measured against the navy ground (`#080D18`): ink 17.3:1, ink-2 12.1:1, muted 6.0:1 (5.4:1 on surface, 4.9:1 on surface-2), brass 8.9:1, ground-on-brass buttons 8.9:1. All AA; all body text AAA.

## What still needs a real input

See the hand-off notes in the pull request / session report: centre photographs (with consent), a logo if one is wanted, a sanitised demo tenant if screenshots are ever preferred over rendered UI, any metric Dhana will stand behind, the registered office address if it should be public, confirmation that `hello@watzaura.com` is a live mailbox, and a lawyer's pass over `src/content/legal/`.
