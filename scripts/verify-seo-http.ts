/**
 * Real admin HTTP -> MySQL -> production Next SSR verification.
 * Run with `bun run scripts/verify-seo-http.ts` from the backend directory.
 * Uses disposable database copies and ports 5098/3099. Never writes source DBs.
 */
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPool } from 'mysql2/promise';
import { hash } from 'bcrypt';
import source from '../src/database/data-source';

async function verify() {
  const frontend = resolve('../majestan-frontend');
  const runId = Date.now();
  const dbName = `majestan_seo_http_verify_${runId}`;
  const crmName = `majestan_seo_crm_verify_${runId}`;
  const base = 'http://localhost:3099';
  const api = 'http://localhost:5098/api/v1';
  const dist = '.next-seo-verify';
  const logs = `/tmp/majestan-seo-http-${runId}`;
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
    let verifiedProperty: any;
    for (const scope of ['project', 'property']) {
      const target = (
        await source.query(
          scope === 'project'
            ? `SELECT p.id,p.canonical_slug AS slug FROM \`${dbName}\`.projects p LEFT JOIN \`${dbName}\`.seo_configs c ON c.project_id=p.id WHERE p.status='published' AND c.id IS NULL ORDER BY p.id LIMIT 1`
            : `SELECT p.id,p.slug FROM \`${dbName}\`.properties p LEFT JOIN \`${dbName}\`.seo_configs c ON c.property_id=p.id WHERE p.status='available' AND p.property_type='apartment' AND (p.available_until IS NULL OR p.available_until>=CURRENT_DATE) AND c.id IS NULL ORDER BY p.id LIMIT 1`,
        )
      )[0];
      assert(target, `${scope} fixture`);
      const directSections =
        scope === 'project'
          ? ['floor-plans', 'photos', 'amenities', 'locality']
          : ['floor-plan', 'photos', 'amenities', 'locality'];
      for (const section of directSections) {
        const direct = await html('/' + target.slug + '/' + section);
        assert(!direct.includes('Page changed from static to dynamic'));
      }
      passed(
        `${scope}: direct child routes render before an SEO config exists`,
      );
      const editor = await admin(`inventory/${scope}/${target.id}`);
      const image = editor.images.find((m: any) => m.kind === 'Photo');
      const path = '/' + target.slug;
      const children =
        scope === 'project'
          ? ['floor_plans', 'photos', 'amenities', 'locality']
          : ['floor_plan', 'photos'];
      assert(editor.default_og_image_url, `${scope} default image`);
      if (scope === 'project')
        assert.equal(
          editor.default_og_image_url,
          editor.images.find((m: any) => m.key === 'project-cover')?.image_url,
        );
      else
        assert.equal(
          editor.default_og_image_url,
          editor.images.find((m: any) => m.key.startsWith('property-image:'))
            ?.image_url,
        );
      let saved = await admin(
        'configs/' + encodeURIComponent(editor.config.config_key),
        {
          ...editor.config,
          meta_title: `Verified ${scope} main title`,
          meta_description: `Verified ${scope} description`,
          h1: `Verified ${scope} H1`,
          h2: `Verified ${scope} H2`,
          robots_index: true,
          robots_follow: false,
          og_title: `Verified ${scope} social title`,
          og_description: `Verified ${scope} social description`,
          og_image_url: '',
          settings: {
            ...editor.config.settings,
            ai_summary: `Verified ${scope} factual summary`,
            focus_keyword: 'verified keyword',
            secondary_keywords: ['verified secondary'],
            entity: {
              builder_name: 'Verified developer',
              rera_number: 'Verified RERA',
              sub_locality_override: 'Verified locality',
              pincode: '641035',
              latitude: 11.1,
              longitude: 76.9,
              price_override: 8300000,
              low_price: 8300000,
              high_price: 9300000,
              total_units: 108,
              brochure_seo_title: 'Verified brochure title',
            },
          },
          highlights: [`Verified ${scope} highlight`],
          nearby_landmarks: [
            {
              name: 'Verified landmark',
              category: 'Education',
              distance_km: 0.2,
            },
          ],
          faqs: [
            {
              question: `Verified ${scope} question?`,
              answer: `Verified ${scope} answer.`,
            },
          ],
          image_alt_overrides: image
            ? {
                [image.key]: {
                  alt_text: `Verified ${scope} alt`,
                  title_text: `Verified ${scope} image title`,
                  caption: `Verified ${scope} caption`,
                },
              }
            : {},
          section_seo: Object.fromEntries(
            children.map((key) => [
              key,
              {
                meta_title: `Verified ${scope} ${key} title`,
                meta_description: `Verified ${scope} ${key} description`,
                h1: `Verified ${scope} ${key} H1`,
                intro_text: `Verified ${scope} ${key} introduction`,
                robots_index: key !== 'photos',
              },
            ]),
          ),
        },
      );
      let page = await html(path),
        body = visible(page);
      assert.equal(
        (body.match(/<h1(?:\s|>)/g) || []).length,
        1,
        `${scope} must render one H1`,
      );
      assert(page.includes(`<title>Verified ${scope} main title</title>`));
      assert.equal(meta(page, 'description'), `Verified ${scope} description`);
      assert.equal(meta(page, 'og:title'), `Verified ${scope} social title`);
      assert.equal(
        meta(page, 'og:description'),
        `Verified ${scope} social description`,
      );
      assert.equal(meta(page, 'og:image'), editor.default_og_image_url);
      assert.equal(meta(page, 'twitter:image'), editor.default_og_image_url);
      assert(meta(page, 'robots')?.includes('nofollow'));
      assert(body.includes(`Verified ${scope} H1`));
      assert(body.includes(`Verified ${scope} answer.`));
      assert(!body.includes(`Verified ${scope} factual summary`));
      assert(!body.includes('aria-label="Property facts"'));
      assert(!body.includes('aria-label="Key highlights"'));
      if (image) {
        assert(body.includes(`alt="Verified ${scope} alt"`));
        assert(body.includes(`title="Verified ${scope} image title"`));
        assert(body.includes(`Verified ${scope} caption`));
      }
      const nodes = graphs(page);
      assert(nodes.some((n: any) => n['@type'] === 'FAQPage'));
      assert(JSON.stringify(nodes).includes('Verified locality'));
      assert(JSON.stringify(nodes).includes('641035'));
      assert(
        JSON.stringify(nodes).includes(`Verified ${scope} factual summary`),
      );
      passed(
        `${scope}: saved editor-shaped payload -> SSR metadata/media/FAQ and source JSON-LD without extra visitor-facing SEO blocks and automatic OG/Twitter image`,
      );
      for (const section of children) {
        const suffix = section.replaceAll('_', '-'),
          child = await html(path + '/' + suffix);
        assert(
          child.includes(`<title>Verified ${scope} ${section} title</title>`),
        );
        assert.equal(
          meta(child, 'description'),
          `Verified ${scope} ${section} description`,
        );
        assert.equal(
          (visible(child).match(/<h1(?:\s|>)/g) || []).length,
          1,
          `${scope}/${section} must render one H1`,
        );
        assert(visible(child).includes(`Verified ${scope} ${section} H1`));
        assert(
          visible(child).includes(`Verified ${scope} ${section} introduction`),
        );
        assert(
          child.includes(
            `href="https://www.majestanrealty.com${path}/${suffix}"`,
          ),
        );
        assert(
          graphs(child).some(
            (node: any) =>
              node['@type'] === 'BreadcrumbList' ||
              node.breadcrumb?.['@type'] === 'BreadcrumbList',
          ),
        );
        if (section === 'photos')
          assert(meta(child, 'robots')?.includes('noindex'));
        assert.equal(meta(child, 'og:image'), editor.default_og_image_url);
      }
      passed(
        `${scope}: all ${children.length} child routes independently render edited metadata, H1/intro, canonical, robots and JSON-LD`,
      );
      const customImage =
        'https://www.majestanrealty.com/assets/images/logo/logo.png';
      const customPath = '/verified-' + scope + '-' + runId;
      saved = await admin('configs/' + encodeURIComponent(saved.config_key), {
        ...saved,
        public_path: customPath,
        meta_title: `Updated ${scope} title`,
        canonical_url: 'https://www.majestanrealty.com' + customPath,
        og_image_url: customImage,
      });
      page = await html(customPath);
      assert(page.includes(`<title>Updated ${scope} title</title>`));
      assert(!page.includes(`<title>Verified ${scope} main title</title>`));
      assert.equal(meta(page, 'og:image'), customImage);
      const renamedChild = await html(
        customPath + '/' + children[0].replaceAll('_', '-'),
      );
      assert(
        renamedChild.includes(
          `<title>Verified ${scope} ${children[0]} title</title>`,
        ),
      );
      assert(
        renamedChild.includes(
          `href="https://www.majestanrealty.com${customPath}/${children[0].replaceAll('_', '-')}"`,
        ),
      );
      const reread = await admin(`inventory/${scope}/${target.id}`);
      assert.equal(reread.effective.meta_title, `Updated ${scope} title`);
      assert.equal(reread.default_og_image_url, editor.default_og_image_url);
      const redirect = await fetch(base + path, { redirect: 'manual' });
      assert.equal(redirect.status, 301);
      assert(redirect.headers.get('location')?.endsWith(customPath));
      await admin(
        'configs/' + encodeURIComponent(saved.config_key),
        { ...saved, revision: 0, meta_title: 'Stale edit' },
        'PUT',
        409,
      );
      saved = await admin('configs/' + encodeURIComponent(saved.config_key), {
        ...saved,
        og_image_url: '',
      });
      if (scope === 'property') verifiedProperty = saved;
      assert.equal(
        meta(await html(customPath), 'og:image'),
        editor.default_og_image_url,
      );
      passed(
        `${scope}: second save appears immediately, custom slug 301/canonical, reopened editor, custom OG then automatic reset, stale-save rejection`,
      );
    }
    for (const path of [
      '/',
      '/projects',
      '/sell-property',
      '/rent-property',
      '/about-us',
      '/contact-us',
      '/services/property-management',
      '/services/liaisoning',
      '/services/financial-assistance',
      '/services/nri-services',
    ]) {
      const configs = await admin('configs?scope=page'),
        c = configs.find((row: any) => row.public_path === path);
      assert(c, `Core config ${path}`);
      await admin('configs/' + encodeURIComponent(c.config_key), {
        ...c,
        meta_title: 'Verified core title',
        h1: 'Verified core H1',
        h2: 'Verified core H2',
        intro_content: 'Verified core introduction',
        bottom_content: '## Verified core guide\n\n- Verified useful detail',
        faqs: [
          {
            question: 'Verified core question?',
            answer: 'Verified core answer.',
          },
        ],
        custom_schema_json: {
          '@type': 'Service',
          name: 'Verified custom service',
        },
      });
      const page = await html(path),
        body = visible(page);
      assert.equal(
        (body.match(/<h1(?:\s|>)/g) || []).length,
        1,
        `${path} must render one H1`,
      );
      assert(page.includes('<title>Verified core title</title>'));
      for (const text of [
        'Verified core H1',
        'Verified core H2',
        'Verified core introduction',
        'Verified core answer.',
        '<li>Verified useful detail</li>',
      ])
        assert(body.includes(text), `${path} visible ${text}`);
      assert(
        graphs(page).some(
          (node: any) => node.name === 'Verified custom service',
        ),
      );
      assert(
        body.indexOf('Verified core answer.') < body.lastIndexOf('<footer'),
      );
      passed(
        `Core ${path}: edited title/H1/H2/intro/Markdown/FAQ + custom JSON-LD in SSR`,
      );
    }
    const propertyConfig = verifiedProperty;
    const propertyEditor = await admin(
      `inventory/property/${propertyConfig.property_id}`,
    );
    const intent =
      propertyEditor.target.listing_type === 'Rent' ? 'rent' : 'buy';
    const template = (await admin('configs?scope=template')).find(
      (c: any) => c.config_key === `template:property:apartment:${intent}`,
    );
    assert(template);
    await admin('configs/' + encodeURIComponent(template.config_key), {
      ...template,
      meta_title_template: 'Verified {Transaction_Type} {Property_Type}',
      meta_description_template: 'Updated template in {City}',
    });
    await admin('configs/' + encodeURIComponent(propertyConfig.config_key), {
      ...propertyConfig,
      meta_title: '',
      meta_description: '',
    });
    const templatedPage = await html(propertyConfig.public_path);
    assert(
      templatedPage.includes(
        `<title>Verified ${intent === 'buy' ? 'Sale' : 'Rent'} Apartment</title>`,
      ),
    );
    assert.equal(
      meta(templatedPage, 'description'),
      `Updated template in ${propertyEditor.target.city}`,
    );
    passed(
      'Auto-SEO template edits regenerate SSR fallback metadata and expand dynamic tokens',
    );
    const options = await admin('options');
    const city = (
      await source.query(
        `SELECT id FROM \`${dbName}\`.cities WHERE city_name='Coimbatore' LIMIT 1`,
      )
    )[0].id;
    for (const intent of ['buy', 'rent']) {
      let listing = await admin(
        'listing-pages',
        {
          inventory_kind: 'property',
          transaction_intent: intent,
          property_type: 'apartment',
          city_id: city,
          public_path: `/verified-${intent}-listing`,
          meta_title: `Verified ${intent} listing`,
          meta_description: 'Verified listing description',
          h1: 'Verified listing H1',
          h2: 'Verified listing H2',
          intro_content: 'Verified listing introduction',
          bottom_content:
            '## Verified listing guide\n\n- Verified listing detail',
          show_live_market_snapshot: true,
          auto_stats_faqs: true,
          minimum_active_listings: 0,
          thin_content_guard_enabled: false,
          locality_faqs: [
            {
              question: 'Verified market question?',
              answer: 'Verified market answer.',
            },
          ],
        },
        'POST',
        201,
      );
      let page = await html(`/verified-${intent}-listing`),
        body = visible(page);
      assert(body.includes('Verified listing H1'));
      for (const text of [
        'Verified listing introduction',
        'Verified listing detail',
        'Verified market answer.',
        'Live inventory snapshot',
        'Local market at a glance',
      ])
        assert(
          !body.includes(text),
          `${intent} listing must not display extra SEO block: ${text}`,
        );
      assert.equal(
        (body.match(/<h1(?:\s|>)/g) || []).length,
        1,
        `${intent} listing must render one H1`,
      );
      assert(page.includes(`<title>Verified ${intent} listing</title>`));
      assert(!graphs(page).some((n: any) => n['@type'] === 'FAQPage'));
      assert(graphs(page).some((n: any) => n['@type'] === 'ItemList'));
      const rules = await admin('listing-pages'),
        rule = rules.find((r: any) => r.config_key === listing.config_key);
      await admin(
        'listing-pages',
        {
          ...rule,
          show_live_market_snapshot: false,
          meta_title: `Updated ${intent} listing`,
        },
        'POST',
        201,
      );
      page = await html(`/verified-${intent}-listing`);
      assert(!visible(page).includes('Local market at a glance'));
      assert(page.includes(`<title>Updated ${intent} listing</title>`));
      const response = await fetch(
        api +
          '/seo-engine/resolve?path=' +
          encodeURIComponent(`/verified-${intent}-listing`),
      );
      const raw: any = await response.json(),
        resolved = raw.data ?? raw;
      const count = (
        await source.query(
          `SELECT COUNT(*) AS n FROM \`${dbName}\`.properties WHERE property_type='apartment' AND listing_type=? AND status='available' AND (available_until IS NULL OR available_until>=CURRENT_DATE) AND city='Coimbatore'`,
          [intent === 'buy' ? 'Sell' : 'Rent'],
        )
      )[0].n;
      assert.equal(resolved.stats.total, Number(count));
      passed(
        `${intent} listing: real SQL inventory count and edited metadata; visible results without extra SEO copy/stats/FAQ; matching ItemList schema`,
      );
    }
    assert(options);
    assert.equal(await inventoryHash(), before, 'SEO saves changed inventory');
    passed(
      'All SEO edits left properties, projects, units and property images byte-for-byte unchanged',
    );
    const technical = await admin('technical');
    const robotsText =
      'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n# Verified technical edit\n';
    await admin('configs/' + encodeURIComponent(technical.config_key), {
      ...technical,
      settings: {
        ...technical.settings,
        robots_txt: robotsText,
        llms_txt: '# Verified AI inventory guide',
      },
    });
    assert.equal(await (await fetch(base + '/robots.txt')).text(), robotsText);
    assert.equal(
      await (await fetch(base + '/llms.txt')).text(),
      '# Verified AI inventory guide',
    );
    const explicitRedirect = await admin(
      'redirects',
      { source_path: '/verified-old-page', destination_path: '/about-us' },
      'POST',
      201,
    );
    const redirectResponse = await fetch(base + '/verified-old-page', {
      redirect: 'manual',
    });
    assert.equal(redirectResponse.status, 301);
    assert(redirectResponse.headers.get('location')?.endsWith('/about-us'));
    await admin('redirects/' + explicitRedirect.id, undefined, 'DELETE');
    passed(
      'Technical edits immediately update robots.txt/llms.txt; redirect CRUD serves real HTTP 301',
    );
    const robots = await fetch(base + '/robots.txt');
    assert.equal(robots.status, 200);
    const sitemap = await fetch(base + '/sitemap.xml');
    assert.equal(sitemap.status, 200);
    assert((await sitemap.text()).includes('sitemap'));
    await admin('auth/logout', {}, 'POST');
    cookie = '';
    await admin('auth/me', undefined, undefined, 401);
    passed('Robots/sitemap served and logout clears browser session');
    console.log(
      `SUCCESS: ${checks} integration groups passed. Logs: ${logs}*.log`,
    );
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
