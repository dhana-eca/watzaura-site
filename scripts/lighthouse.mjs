/**
 * Runs Lighthouse (mobile, simulated throttling — the same preset PageSpeed
 * Insights uses) against the production build for every page, and writes
 * lighthouse/summary.md plus one JSON report per page.
 *
 *   npm run build && npm run lighthouse
 *
 * Needs Chrome. Set CHROME_PATH if it is not found automatically.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const port = 4397;
const base = `http://127.0.0.1:${port}`;
const pages = ['/', '/product', '/product/operations', '/product/development', '/product/mobile', '/who-its-for', '/built-at-elite', '/switch', '/pricing', '/company', '/early-access', '/legal/privacy', '/legal/account-deletion'];

const server = spawn(process.execPath, ['scripts/serve.mjs'], { env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) }, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { await fetch(base); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }

const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });
mkdirSync('lighthouse', { recursive: true });
const rows = [];
try {
  for (const p of pages) {
    const { lhr } = await lighthouse(`${base}${p}`, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] });
    const c = lhr.categories;
    const score = (k) => Math.round(c[k].score * 100);
    const row = { page: p, perf: score('performance'), a11y: score('accessibility'), bp: score('best-practices'), seo: score('seo'), lcp: lhr.audits['largest-contentful-paint'].displayValue, cls: lhr.audits['cumulative-layout-shift'].displayValue, tbt: lhr.audits['total-blocking-time'].displayValue };
    rows.push(row);
    writeFileSync(`lighthouse/${p === '/' ? 'home' : p.slice(1).replace(/\//g, '-')}.json`, JSON.stringify(lhr, null, 1));
    console.log(`${p.padEnd(26)} perf ${row.perf}  a11y ${row.a11y}  bp ${row.bp}  seo ${row.seo}  LCP ${row.lcp}  CLS ${row.cls}  TBT ${row.tbt}`);
  }
} finally {
  await chrome.kill();
  server.kill();
}
const md = ['| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |', '|---|---|---|---|---|---|---|---|', ...rows.map((r) => `| ${r.page} | ${r.perf} | ${r.a11y} | ${r.bp} | ${r.seo} | ${r.lcp} | ${r.cls} | ${r.tbt} |`)].join('\n');
writeFileSync('lighthouse/summary.md', `# Lighthouse (mobile, simulated throttling) — ${new Date().toISOString().slice(0, 10)}\n\nLighthouse ${(await import('lighthouse/package.json', { with: { type: 'json' } })).default.version}, production build served locally.\n\n${md}\n`);
console.log('\nwrote lighthouse/summary.md');
