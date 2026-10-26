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
    if (process.env.SEO_VERIFY_CORE_ONLY) {
      const pages = await admin('configs?scope=page');
      assert(pages.length >= 12, 'Expected seeded core and service pages');
      const failures: string[] = [];
      for (const page of pages) {
        try {
        const path = page.public_path;
        const endpoint = 'configs/' + encodeURIComponent(page.config_key);
        // Warm the real production cache before saving to verify invalidation.
        await html(path);
        const marker = `Core audit ${page.id}`;
        const input = {
          ...page,
          meta_title: `${marker} title`,
          meta_description: `${marker} description`,
          h1: `${marker} heading`,
          og_title: `${marker} social title`,
          og_description: `${marker} social description`,
          og_image_url: 'https://cdn.majestanrealty.com/core-audit.jpg',
          canonical_type: 'self', canonical_url: '',
          robots_index: true, robots_follow: true,
          intro_content: `${marker} introduction`,
          bottom_content: `${marker} guide`,
          highlights: [`${marker} highlight`],
          faqs: [{ question: `${marker} question?`, answer: `${marker} answer` }],
          custom_schema_json: { '@type': 'Service', name: `${marker} schema` },
        };
        const saved = await admin(endpoint, input);
        const reopened = (await admin('configs?scope=page')).find((row: any) => row.config_key === page.config_key);
        assert.equal(reopened.meta_title, input.meta_title, `${path}: persisted title`);
        assert.equal(reopened.intro_content, input.intro_content, `${path}: persisted introduction`);
        assert.deepEqual(reopened.faqs, input.faqs, `${path}: persisted FAQs`);
        const rendered = await html(path);
        assert.equal(decode(rendered.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || ''), input.meta_title, `${path}: title after warm cache save`);
        assert.equal(meta(rendered, 'description'), input.meta_description, `${path}: description`);
        assert.equal(meta(rendered, 'og:title'), input.og_title, `${path}: social title`);
        assert.equal(meta(rendered, 'og:description'), input.og_description, `${path}: social description`);
        assert.equal(meta(rendered, 'og:image'), input.og_image_url, `${path}: social image`);
        const canonicalTag = [...rendered.matchAll(/<link\b[^>]*>/g)].map(match => match[0]).find(tag => /rel="canonical"/.test(tag)) || '';
        const canonical = canonicalTag.match(/href="([^"]*)"/)?.[1] || '';
        assert.equal(canonical.replace(/\/$/, ''), `https://www.majestanrealty.com${path}`.replace(/\/$/, ''), `${path}: canonical`);
        assert(!/noindex/.test(meta(rendered, 'robots') || ''), `${path}: indexable`);
        const body = visible(rendered);
        if (path !== '/projects') {
          for (const text of [input.h1, input.intro_content, input.bottom_content, input.highlights[0], input.faqs[0].answer])
            assert(body.includes(text), `${path}: visible ${text}`);
          assert.equal((body.match(/<h1(?:\s|>)/g) || []).length, 1, `${path}: single H1`);
        } else {
          for (const text of [input.h1, input.intro_content, input.bottom_content, input.highlights[0], input.faqs[0].answer])
            assert(!body.includes(text), 'Projects listing keeps its inventory-derived copy');
        }
        assert(JSON.stringify(graphs(rendered)).includes(`${marker} schema`), `${path}: custom JSON-LD`);
        await admin(endpoint, { ...saved, public_path: '/audit-invalid-core-route' }, 'PUT', 400);
        await admin(endpoint, { ...saved, revision: -1 }, 'PUT', 409);
        const noindex = await admin(endpoint, { ...saved, robots_index: false, robots_follow: false, canonical_type: 'custom', canonical_url: 'https://www.majestanrealty.com/about-us' });
        const overridden = await html(path);
        assert(/noindex/.test(meta(overridden, 'robots') || ''), `${path}: noindex updates warmed page`);
        assert(/nofollow/.test(meta(overridden, 'robots') || ''), `${path}: nofollow updates warmed page`);
        assert(/<link(?=[^>]*rel="canonical")(?=[^>]*href="https:\/\/www.majestanrealty.com\/about-us")[^>]*>/.test(overridden), `${path}: custom canonical updates warmed page`);
        const versions = await admin('history/' + encodeURIComponent(page.config_key));
        const original = versions.find((version: any) => version.revision === page.revision);
        assert(original, `${path}: original version retained`);
        const restored = await admin(`history/${encodeURIComponent(page.config_key)}/${original.id}/restore`, { revision: noindex.revision }, 'POST', 201);
        assert.equal(restored.meta_title, page.meta_title, `${path}: restore title`);
        assert.equal(restored.public_path, path, `${path}: restore keeps route`);
        passed(`${path}: save/reopen, warm-cache SSR, metadata, content, schema, robots, fixed route, conflict and restore`);
        } catch (error) {
          const message = `${page.public_path}: ${(error as Error).message}`;
          failures.push(message);
          console.error('FAIL ' + message);
        }
      }
      assert.equal(await inventoryHash(), before, 'Core SEO edits preserve inventory data');
      await admin('auth/logout', {}, 'POST'); cookie = '';
      await admin('auth/me', undefined, undefined, 401);
      passed('Core edits preserve inventory; logout invalidates access');
      assert.equal(failures.length, 0, failures.join('\n'));
      console.log(`SUCCESS: ${pages.length} core/service pages verified against production Next.js and disposable MySQL databases.`);
      return;
    }
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
    const rootSchema = { '@type': 'Service', name: 'Audit overview schema only' };
    const childSchema = { '@context': 'https://schema.org', '@type': 'ImageGallery', name: 'Audit photos schema only' };
    saved = await admin('configs/' + encodeURIComponent(saved.config_key), { ...saved, schema_overrides: rootSchema, custom_schema_json: rootSchema, section_seo: { ...saved.section_seo, photos: { ...saved.section_seo?.photos, schema_overrides: childSchema } } });
    const reopened = await admin('inventory/project/' + project.id);
    assert.deepEqual(reopened.config.schema_overrides, rootSchema);
    assert.deepEqual(reopened.config.section_seo.photos.schema_overrides, childSchema);
    saved = await admin('configs/' + encodeURIComponent(saved.config_key), { ...reopened.config, meta_title: 'Schema retained after unrelated edit' });
    assert.deepEqual(saved.section_seo.photos.schema_overrides, childSchema);
    const overviewHtml = await html('/' + project.slug);
    const photosHtml = await html('/' + project.slug + '/photos');
    assert(JSON.stringify(graphs(overviewHtml)).includes('Audit overview schema only'));
    assert(!JSON.stringify(graphs(overviewHtml)).includes('Audit photos schema only'));
    assert(photosHtml.includes('Audit photos schema only'));
    // Check executable JSON-LD, excluding embedded React payload data.
    const scripts = [...photosHtml.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    assert(JSON.stringify(scripts).includes('Audit photos schema only'));
    assert(!JSON.stringify(scripts).includes('Audit overview schema only'));
    passed('JSON-LD saves, reloads, survives unrelated edits and renders only on the intended page');
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
