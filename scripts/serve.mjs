// Serves the production build (dist/) on PORT (default 4322) — what Render runs,
// minus the platform. Build first: npm run build
process.env.HOST ??= '127.0.0.1';
process.env.PORT ??= '4322';
await import(new URL('../dist/server/entry.mjs', import.meta.url).href);
