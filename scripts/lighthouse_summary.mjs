// Lighthouse's scores for the interactive page as a table (idea #180), for the CI job in
// .github/workflows/pages.yml, which runs Lighthouse (installed there only) as a phone and as a
// desktop and passes the JSON reports here:
//   node scripts/lighthouse_summary.mjs lighthouse/mobile.report.json lighthouse/desktop.report.json
// The table (scores, the timings behind the performance score, and every audit that did not pass
// in accessibility, best practices and SEO) goes to $GITHUB_STEP_SUMMARY when it is set, else to
// the screen. A score under 90 is flagged with a ::warning:: line, never failed: performance
// moves from run to run on shared machines. No packages.
import { appendFileSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node scripts/lighthouse_summary.mjs <report.json> [...]');
  process.exit(2);
}
const CATS = [['performance', 'Performance'], ['accessibility', 'Accessibility'], ['best-practices', 'Best practices'], ['seo', 'SEO']];
const METRICS = [['first-contentful-paint', 'First contentful paint'], ['largest-contentful-paint', 'Largest contentful paint'],
  ['total-blocking-time', 'Total blocking time'], ['cumulative-layout-shift', 'Layout shift'], ['speed-index', 'Speed index']];
const out = ['## Lighthouse (idea #180)', ''];
const rows = [];
const misses = [];
for (const f of files) {
  const r = JSON.parse(readFileSync(f, 'utf8'));
  const name = r.configSettings?.formFactor === 'desktop' ? 'Desktop' : 'Phone (slow 4G, 4x CPU)';
  const scores = CATS.map(([k]) => (r.categories[k] ? Math.round(r.categories[k].score * 100) : null));
  rows.push({ name, scores, metrics: METRICS.map(([k]) => r.audits[k]?.displayValue || 'n/a'), file: basename(f), version: r.lighthouseVersion, url: r.finalDisplayedUrl || r.finalUrl });
  CATS.forEach(([k, label], i) => {
    if (scores[i] != null && scores[i] < 90) console.log(`::warning title=Lighthouse ${name}::${label} ${scores[i]} (under 90)`);
    if (k === 'performance' || !r.categories[k]) return;
    for (const ref of r.categories[k].auditRefs) {
      const a = r.audits[ref.id];
      if (ref.weight > 0 && a && a.score !== null && a.score < 1) misses.push(`- ${name}, ${label}: ${a.title}`);
    }
  });
}
out.push(`| | ${CATS.map(([, l]) => l).join(' | ')} |`, `|---|${CATS.map(() => '---:').join('|')}|`);
for (const r of rows) out.push(`| ${r.name} | ${r.scores.map((s) => (s == null ? 'n/a' : s < 90 ? `**${s}**` : String(s))).join(' | ')} |`);
out.push('', `| | ${METRICS.map(([, l]) => l).join(' | ')} |`, `|---|${METRICS.map(() => '---:').join('|')}|`);
for (const r of rows) out.push(`| ${r.name} | ${r.metrics.join(' | ')} |`);
out.push('', misses.length ? '**Audits that did not pass:**' : 'Every weighted accessibility, best-practices and SEO audit passed.', ...misses);
out.push('', `Lighthouse ${rows[0].version}, ${rows[0].url}; the full reports are in this run's "lighthouse" artifact.`, '');
const text = out.join('\n');
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
console.log(text);
