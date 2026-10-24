/**
 * Real admin HTTP -> MySQL -> production Next SSR verification.
 * Run with `bun run scripts/verify-seo-audit.ts` from the backend directory.
 * Uses disposable database copies and ports 5098/3099. Never writes source DBs.
 */
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPool } from 'mysql2/promise';
import { hash } from 'bcrypt';
import source from '../src/database/data-source';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { SeoAuditRemediation1785200000000 } from '../src/database/migrations/1785200000000-SeoAuditRemediation';

async function verify() {
  const frontend = resolve('../majestan-frontend');
  const runId = Date.now();
  const dbName = `majestan_seo_http_verify_${runId}`;
  const crmName = `majestan_seo_crm_verify_${runId}`;
  const base = 'http://localhost:3099';
  const api = 'http://localhost:5098/api/v1';
  const dist = '.next-seo-audit-verify';
  const logs = `/tmp/majestan-seo-audit-${runId}`;
  const children: ReturnType<typeof Bun.spawn>[] = [];
  const tsconfig = await readFile(frontend + '/tsconfig.json', 'utf8');
  const crm = createPool({
    host: process.env.CRM_DB_HOST || process.env.DB_HOST,
    port: Number(process.env.CRM_DB_PORT || process.env.DB_PORT || 3306),
    user: process.env.CRM_DB_USERNAME || process.env.DB_USERNAME,
    password: process.env.CRM_DB_PASSWORD ?? process.env.DB_PASSWORD,
    database: process.env.CRM_DB_NAME || 'majestan_crm',
  });
  let cookie = '';
  let checks = 0;
  function passed(message: string) {
    checks++;
    console.log(`PASS ${message}`);
  }
  function spawn(
    args: string[],
    cwd: string,
    env: Record<string, string | undefined>,
    log: string,
  ) {
    const child = Bun.spawn(args, {
      cwd,
      env: { ...process.env, ...env },
      stdout: Bun.file(log),
      stderr: Bun.file(log),
    });
    children.push(child);
    return child;
  }
  async function ready(url: string, child: ReturnType<typeof Bun.spawn>) {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null)
        throw new Error(`Server exited: see ${logs}*.log`);
      try {
        if ((await fetch(url)).ok) return;
      } catch {}
      await Bun.sleep(500);
    }
    throw new Error(`Server not ready: ${url}`);
  }
  async function admin(
    path: string,
    body?: any,
    method?: string,
    status = 200,
  ) {
    const r = await fetch(base + '/api/seo-admin/' + path, {
      method: method || (body ? 'PUT' : 'GET'),
      headers: {
        'Content-Type': 'application/json',
        Origin: base,
        Cookie: cookie,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const value = await r.json();
    assert.equal(
      r.status,
      status,
      `${path}: ${JSON.stringify(value).slice(0, 300)}`,
    );
    return value.data ?? value;
  }
  const visible = (html: string) =>
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const graphs = (html: string) =>
    [
      ...html.matchAll(
        /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
      ),
    ].flatMap((m) => {
      const j = JSON.parse(m[1]);
      return j['@graph'] || [j];
    });
  const decode = (s: string) =>
    s
      .replaceAll('&amp;', '&')
      .replaceAll('&quot;', '"')
      .replaceAll('&#x27;', "'")
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>');
  function meta(html: string, name: string) {
    for (const m of html.matchAll(/<meta\b[^>]*>/g)) {
      const attrs = Object.fromEntries(
        [...m[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map((a) => [
          a[1],
          decode(a[2]),
        ]),
      );
      if (attrs.name === name || attrs.property === name) return attrs.content;
    }
  }
  async function html(path: string) {
    const r = await fetch(base + path, {
      headers: { 'User-Agent': 'Googlebot' },
    });
    assert.equal(r.status, 200, `${path} HTTP status`);
    return r.text();
  }
  async function inventoryHash() {
    let value = '';
    for (const table of [
      'properties',
      'projects',
      'project_units',
      'property_images',
    ])
      value += JSON.stringify(
        await source.query(
          `SELECT * FROM \`${dbName}\`.\`${table}\` ORDER BY id`,
        ),
      );
    return createHash('sha256').update(value).digest('hex');
  }
  try {
    await source.initialize();
    const original = String(source.options.database).replaceAll('`', '``');
    await source.query(`CREATE DATABASE \`${dbName}\``);
    for (const row of await source.query(
      `SHOW FULL TABLES FROM \`${original}\` WHERE Table_type='BASE TABLE'`,
    )) {
      const table = String(Object.values(row)[0]).replaceAll('`', '``');
      await source.query(
        `CREATE TABLE \`${dbName}\`.\`${table}\` LIKE \`${original}\`.\`${table}\``,
      );
      await source.query(
        `INSERT INTO \`${dbName}\`.\`${table}\` SELECT * FROM \`${original}\`.\`${table}\``,
      );
    }
    await crm.query(`CREATE DATABASE \`${crmName}\``);
    const crmOriginal = (process.env.CRM_DB_NAME || 'majestan_crm').replaceAll(
      '`',
      '``',
    );
    for (const table of ['users', 'roles', 'permissions', 'user_permissions']) {
      await crm.query(
        `CREATE TABLE \`${crmName}\`.\`${table}\` LIKE \`${crmOriginal}\`.\`${table}\``,
      );
      await crm.query(
        `INSERT INTO \`${crmName}\`.\`${table}\` SELECT * FROM \`${crmOriginal}\`.\`${table}\``,
      );
    }
    const [accounts]: any = await crm.query(
      `SELECT u.id,u.email FROM \`${crmName}\`.users u JOIN \`${crmName}\`.roles r ON r.id=u.role_id WHERE u.is_active=1 AND r.name IN ('Admin','Super Admin') LIMIT 1`,
    );
    const account = accounts[0];
    assert(account, 'An active admin fixture is required');
    const password = randomBytes(24).toString('hex');
    await crm.query(
      `UPDATE \`${crmName}\`.users SET password_hash=? WHERE id=?`,
      [await hash(password, 10), account.id],
    );
    const fixture = new DataSource({ ...source.options, database: dbName } as DataSourceOptions);
    await fixture.initialize();
    try { await new SeoAuditRemediation1785200000000().up(fixture.createQueryRunner()); }
    finally { await fixture.destroy(); }
    const before = await inventoryHash();
    const backend = spawn(
      ['bun', 'run', 'src/main.ts'],
      process.cwd(),
      {
        DB_NAME: dbName,
        CRM_DB_NAME: crmName,
        PORT: '5098',
        THROTTLE_LIMIT: '10000',
        NODE_ENV: 'development',
        SEO_SESSION_SECRET: randomBytes(32).toString('hex'),
      },
      logs + '-backend.log',
    );
    await ready(api + '/seo-engine/routing', backend);
    passed('Isolated backend and disposable site/CRM fixtures ready');
    const frontEnv = {
      NODE_ENV: 'production',
      API_BASE_URL: api,
      SITE_BACKEND_URL: 'http://localhost:5098',
      NEXT_PUBLIC_API_BASE_URL: '/site-api',
      NEXT_DIST_DIR: dist,
      PORT: '3099',
    };
    if (!process.env.SEO_VERIFY_REUSE_BUILD) {
      const build = spawn(
        ['bun', 'run', 'build'],
        frontend,
        frontEnv,
        logs + '-build.log',
      );
      assert.equal(
        await build.exited,
        0,
        `Production build failed: ${logs}-build.log`,
      );
    }
    passed('Production Next.js build');
    const front = spawn(
      ['bun', 'node_modules/next/dist/bin/next', 'start', '-p', '3099'],
      frontend,
      frontEnv,
      logs + '-frontend.log',
    );
    await ready(base + '/admin/login', front);
    await admin('inventory/project', undefined, undefined, 401);
    await admin(
      'auth/login',
      { email: account.email, password: 'invalid-password' },
      'POST',
      401,
    );
    const login = await fetch(base + '/api/seo-admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ email: account.email, password }),
    });
    assert.equal(login.status, 200);
    const setCookie = login.headers.get('set-cookie') || '';
    assert(
      setCookie.includes('HttpOnly') && /SameSite=Strict/i.test(setCookie),
    );
    cookie = setCookie.split(';')[0];
    assert.equal((await admin('auth/me')).id, account.id);
    passed(
      'Real password login, HttpOnly session, invalid-password/unauthenticated rejection',
    );
    for (const path of ['/emi-calculator','/affordability-calculator']) {
      const page = await html(path);
      assert(page.includes(`href="https://www.majestanrealty.com${path}"`));
    }
    passed('Both calculators have individual canonicals');
    assert.equal((await fetch(base + '/apartments-for-sale-in-zzzauditzz-coimbatore')).status, 404);
    passed('Invented locality is a genuine HTTP 404');
    for (const group of ['projects','properties-buy','properties-rent','localities','pages']) {
      const response = await fetch(base + '/sitemap-' + group + '.xml');
      assert.equal(response.status, 200);
      const xml = await response.text();
      assert(!xml.includes('/eden-park-ap013'), 'unapproved inventory excluded');
    }
    passed('All five sitemap groups execute against MySQL and exclude unapproved inventory');
    const project = (await source.query(`SELECT id,canonical_slug AS slug FROM ${dbName}.projects WHERE status='published' ORDER BY id LIMIT 1`))[0];
    assert(project, 'published project fixture');
    let editor = await admin(`inventory/project/${project.id}`);
    let saved = await admin('configs/' + encodeURIComponent(editor.config.config_key), { ...editor.config, meta_title: 'Audit verified original title' });
    const originalVersion = saved;
    saved = await admin('configs/' + encodeURIComponent(saved.config_key), { ...saved, meta_title: 'Audit verified new title' });
    const versions = await admin('history/' + encodeURIComponent(saved.config_key));
    assert(versions.some((v: any) => v.revision === originalVersion.revision));
    const version = versions.find((v: any) => v.revision === originalVersion.revision);
    saved = await admin(`history/${encodeURIComponent(saved.config_key)}/${version.id}/restore`, { revision: saved.revision }, 'POST', 201);
    assert.equal(saved.meta_title, 'Audit verified original title');
    await admin(`history/${encodeURIComponent(saved.config_key)}/${version.id}/restore`, { revision: 0 }, 'POST', 409);
    passed('Authenticated version history and restore, including stale-write rejection');
    const publishing = await admin('inventory/project/' + project.id);
    saved = await admin('configs/' + encodeURIComponent(saved.config_key), { ...saved, settings: { ...saved.settings, intro_content: 'Reviewed public project guide', publish_editorial_content: false } });
    assert(!visible(await html('/' + project.slug)).includes('Reviewed public project guide'));
    saved = await admin('configs/' + encodeURIComponent(saved.config_key), { ...saved, settings: { ...saved.settings, publish_editorial_content: true } });
    assert(visible(await html('/' + project.slug)).includes('Reviewed public project guide'));
    passed('Inventory editorial notes publish only after explicit opt in');
    const renamed = '/audit-renamed-project-' + runId;
    saved = await admin('configs/' + encodeURIComponent(saved.config_key), { ...saved, public_path: renamed });
    const direct = await html(renamed + '/photos');
    assert(direct.includes('https://www.majestanrealty.com' + renamed + '/photos'));
    const child = await fetch(base + '/' + project.slug + '/photos', { redirect: 'manual' });
    assert([301,308].includes(child.status));
    assert(child.headers.get('location')?.endsWith(renamed + '/photos'));
    assert(!child.headers.get('location')?.includes(','));
    passed('Renamed child routes preserve suffix and emit one Location destination');
    for (const route of ['seo-route','seo-section']) {
      const r = await fetch(base + '/' + route + '/' + project.slug + '/photos', { redirect: 'manual' });
      assert.equal(r.status,308);
      assert(r.headers.get('location')?.endsWith('/' + project.slug + '/photos'));
    }
    passed('External rendering aliases redirect to public routes');
    const technical = await admin('technical');
    await admin('configs/' + encodeURIComponent(technical.config_key), { ...technical, settings: { ...technical.settings, robots_txt: 'User-agent: *\nDisallow: /\nDisallow: /admin\nDisallow: /api' } }, 'PUT',400);
    passed('Admin rejects a site-wide robots block');
    const index = await html('/projects');
    assert(visible(index).includes('<h1'), 'server heading');
    assert(visible(index).includes('href="/'), 'server project links');
    assert(!index.includes('Projects API failed'));
    passed('Projects index server-renders useful initial content');
    const rule = await admin('listing-pages', {
      transaction_intent: 'buy',inventory_kind: 'property',property_type: 'apartment',
      city_id: (await admin('options')).cities[0].id,
      public_path: '/audit-locality-' + runId,
      meta_title: 'Audit locality title',h1: 'Audit locality heading',
      intro_content: 'Visible audit locality introduction',bottom_content: 'Visible audit locality footer',
      locality_faqs: [{ question: 'Audit locality question?',answer: 'Visible locality answer' }],
      robots_index:true,robots_follow:true,minimum_active_listings:0,thin_content_guard_enabled:true,
    }, 'POST',201);
    const locality = visible(await html('/audit-locality-' + runId));
    assert(locality.includes('Visible audit locality introduction'));
    assert(locality.includes('Visible audit locality footer'));
    assert(locality.includes('Visible locality answer'));
    passed('Saved locality content and FAQs publish visibly');
    const sitemapCheck = Bun.spawn(['bun','run','scripts/validate-public-seo.ts',base], {
      cwd: process.cwd(), env: { ...process.env, SEO_CANONICAL_ORIGIN: 'https://www.majestanrealty.com', SEO_VALIDATION_OUTPUT: '/tmp/seo-integration-sitemap.json' },
      stdout: 'inherit',stderr: 'inherit',
    });
    assert.equal(await sitemapCheck.exited, 0, 'All fixture sitemap URLs must pass public response checks');
    passed('Every fixture sitemap URL returns 200 with matching canonical and indexability');
    assert.equal(await inventoryHash(), before, 'SEO saves preserve inventory data');
    passed('SEO edits leave inventory data unchanged');
    await admin('auth/logout', {}, 'POST'); cookie = '';
    await admin('auth/me', undefined, undefined, 401);
    console.log(`SUCCESS: ${checks} audit remediation integration groups passed. Logs: ${logs}*.log`);

  } finally {
    for (const child of children.reverse()) {
      if (child.exitCode === null) {
        child.kill();
        await child.exited;
      }
    }
    await writeFile(frontend + '/tsconfig.json', tsconfig);
    if (!process.env.SEO_VERIFY_KEEP_BUILD)
      await rm(frontend + '/' + dist, { recursive: true, force: true });
    if (source.isInitialized) {
      await source.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
      await source.destroy();
    }
    await crm.query(`DROP DATABASE IF EXISTS \`${crmName}\``);
    await crm.end();
  }
}
void verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
