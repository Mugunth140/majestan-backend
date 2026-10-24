/** Read-only sitemap/page validator. Example: bun run scripts/validate-public-seo.ts https://www.majestanrealty.com */
import { writeFile } from 'node:fs/promises';
async function main() {
const base = new URL(process.argv[2] || 'http://localhost:3000');
const canonicalOrigin = process.env.SEO_CANONICAL_ORIGIN || base.origin;
const decode = (s: string) => s.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'");
const locations = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => decode(m[1]));
const get = (url: string) => fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'MajestanSEOValidator/1.0' }, signal: AbortSignal.timeout(30000) });
const index = await get(new URL('/sitemap.xml', base).href);
if (!index.ok) throw new Error(`Sitemap index failed: ${index.status}`);
const children = locations(await index.text());
const urls = new Set<string>();
for (const child of children) {
  const sitemap = new URL(child);
  // Sitemap canonicals retain the public host in local/staging builds.
  const response = await get(new URL(sitemap.pathname, base).href);
  if (!response.ok) throw new Error(`Sitemap failed: ${sitemap.pathname} (${response.status})`);
  for (const url of locations(await response.text())) urls.add(url);
}
const queue = [...urls];
const results: Record<string, unknown>[] = [];
let position = 0;
async function worker() {
  while (position < queue.length) {
    const url = queue[position++];
    const path = new URL(url).pathname;
    try {
      const response = await get(new URL(path, base).href);
      const html = await response.text();
      const attr = (tag: string, name: string) => decode(tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1] || '');
      const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(m => m[0]);
      const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]);
      const canonical = attr(links.find(tag => attr(tag, 'rel') === 'canonical') || '', 'href');
      const robots = attr(metas.find(tag => attr(tag,'name') === 'robots') || '', 'content');
      const issues: string[] = [];
      if (response.status !== 200) issues.push(`HTTP ${response.status}`);
      if (/noindex/i.test(robots) || /noindex/i.test(response.headers.get('x-robots-tag') || '')) issues.push('noindex');
      if (canonical.replace(/\/$/, '') !== new URL(path,canonicalOrigin).href.replace(/\/$/, '')) issues.push('canonical mismatch');
      const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
      if (!title) issues.push('missing title');
      if (!/<h1(?:\s|>)/i.test(html)) issues.push('missing server H1');
      results.push({ url, status: response.status, canonical, robots, title, issues });
    } catch (error) { results.push({ url, issues: [(error as Error).message] }); }
  }
}
await Promise.all(Array.from({length:4}, worker));
const failures = results.filter(row => (row.issues as string[]).length);
const report = { checkedAt: new Date().toISOString(), origin: base.origin, checked: results.length, failed: failures.length, results };
await writeFile(process.env.SEO_VALIDATION_OUTPUT || '/tmp/majestan-seo-validation.json', JSON.stringify(report,null,2));
console.log(`${results.length} URLs checked; ${failures.length} require review. Report: ${process.env.SEO_VALIDATION_OUTPUT || '/tmp/majestan-seo-validation.json'}`);
if (failures.length) process.exitCode = 1;

}
void main().catch(error => { console.error(error); process.exitCode = 1; });
