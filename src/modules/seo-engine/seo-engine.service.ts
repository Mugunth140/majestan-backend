import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { StorageService } from '../storage/storage.service';
import {
  filterKey,
  hydrate,
  intentWhere,
  json,
  pathValue,
  PROPERTY_TYPES,
  renderTemplate,
  SITE,
  slug,
  TYPE_LABELS,
  SINGULAR_TYPES,
  priceLabel,
  TYPE_SLUGS,
  xml,
} from './seo-utils';

// Listing expiry uses Coimbatore's calendar day, independent of server timezone.
const LIVE_PROPERTY =
  "p.status='available' AND (p.available_until IS NULL OR p.available_until>=DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+05:30')))";

@Injectable()
export class SeoEngineService {
  constructor(
    private readonly db: DataSource,
    @Optional() private readonly storage?: StorageService,
  ) {}
  private async one(
    sql: string,
    args: any[] = [],
    manager: DataSource | EntityManager = this.db,
  ) {
    return (await manager.query(sql, args))[0] || null;
  }

  async options() {
    const [cities, sublocations] = await Promise.all([
      this.db.query(
        'SELECT id,city_name AS name FROM cities WHERE is_active=1',
      ),
      this.db.query(
        'SELECT id,city_id,locality_name AS name FROM sublocations WHERE is_active=1 ORDER BY locality_name',
      ),
    ]);
    return {
      cities,
      sublocations,
      propertyTypes: PROPERTY_TYPES.map((value) => ({
        value,
        label: TYPE_LABELS[value],
      })),
    };
  }

  async configs(scope: string) {
    if (!['page', 'template', 'technical', 'listing'].includes(scope))
      throw new BadRequestException('Invalid scope');
    return (
      await this.db.query(
        'SELECT * FROM seo_configs WHERE scope=? ORDER BY config_key',
        [scope],
      )
    ).map(hydrate);
  }

  async inventory(scope: string, query: Record<string, string>) {
    if (!['project', 'property'].includes(scope))
      throw new BadRequestException('Invalid inventory');
    const page = Math.max(1, Number(query.page) || 1),
      limit = 30;
    const args: any[] = [];
    const conditions = [
      scope === 'property' ? LIVE_PROPERTY : "p.status='published'",
    ];
    if (query.search) {
      conditions.push(
        '(p.' +
          (scope === 'project' ? 'name' : 'title') +
          ' LIKE ? OR p.city LIKE ?)',
      );
      args.push(`%${query.search}%`, `%${query.search}%`);
    }
    if (query.type) {
      conditions.push(
        `p.${scope === 'project' ? 'project_type' : 'property_type'}=?`,
      );
      args.push(query.type);
    }
    if (scope === 'property' && query.intent)
      conditions.push(`(${intentWhere(query.intent)})`);
    if (query.locality) {
      if (scope === 'property')
        conditions.push(
          'EXISTS(SELECT 1 FROM property_locations pl WHERE pl.property_id=p.id AND pl.location_id=?)',
        );
      else
        conditions.push(
          'p.sublocation=(SELECT locality_name FROM sublocations WHERE id=?)',
        );
      args.push(query.locality);
    }
    if (query.seo === 'custom') conditions.push('c.id IS NOT NULL');
    if (query.seo === 'auto') conditions.push('c.id IS NULL');
    const join = `FROM ${scope === 'project' ? 'projects' : 'properties'} p LEFT JOIN seo_configs c ON c.${scope}_id=p.id`;
    const where = conditions.join(' AND ');
    const [count, items] = await Promise.all([
      this.one(`SELECT COUNT(*) AS total ${join} WHERE ${where}`, args),
      this.db.query(
        `SELECT p.id,p.${scope === 'project' ? 'name' : 'title'} AS name,p.city,p.status,
        p.${scope === 'project' ? 'project_type' : 'property_type'} AS type,
        ${scope === 'project' ? `p.canonical_slug,p.builder_name,p.possession_status,p.sublocation,(SELECT MIN(u.price) FROM project_units u WHERE u.project_id=p.id AND u.status='available' AND u.price>0) AS min_price,(SELECT MAX(u.price) FROM project_units u WHERE u.project_id=p.id AND u.status='available' AND u.price>0) AS max_price,(SELECT GROUP_CONCAT(DISTINCT u.bedrooms ORDER BY u.bedrooms SEPARATOR ', ') FROM project_units u WHERE u.project_id=p.id AND u.bedrooms>0) AS configurations` : 'p.slug AS canonical_slug,p.listing_type,p.property_condition,p.price'},
        c.id AS seo_id,c.updated_at AS seo_updated_at ${join} WHERE ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
        [...args, limit, (page - 1) * limit],
      ),
    ]);
    return { items, total: Number(count.total), page, limit };
  }

  async inventoryConfig(scope: string, id: number) {
    if (!['project', 'property'].includes(scope))
      throw new BadRequestException('Invalid scope');
    const target = await this.one(
      `SELECT * FROM ${scope === 'project' ? 'projects' : 'properties'} WHERE id=?`,
      [id],
    );
    if (!target) throw new NotFoundException('Inventory no longer exists');
    const config = hydrate(
      await this.one(`SELECT * FROM seo_configs WHERE ${scope}_id=?`, [id]),
    ) || {
      config_key: `${scope}:${id}`,
      scope,
      [`${scope}_id`]: id,
      robots_index: 1,
      robots_follow: 1,
      revision: 0,
      settings: {},
      faqs: [],
      highlights: [],
      image_alt_overrides: {},
      section_seo: {},
    };
    const source = target.canonical_slug || target.slug;
    const effective = await this.resolve('/' + source);
    const images: any[] = [];
    const addImage = (
      image_url: string,
      key: string,
      kind: string,
      id: any,
    ) => {
      image_url =
        image_url && this.storage
          ? this.storage.generateReadUrl(image_url)
          : image_url;
      if (image_url && !images.some((i) => i.image_url === image_url))
        images.push({
          image_url,
          key,
          kind,
          id,
          alt:
            config.image_alt_overrides?.[image_url] ||
            config.image_alt_overrides?.[key] ||
            '',
        });
    };
    if (scope === 'property') {
      for (const row of await this.db.query(
        'SELECT id,image_url FROM property_images WHERE property_id=? ORDER BY id',
        [id],
      ))
        addImage(row.image_url, `property-image:${row.id}`, 'Photo', row.id);
      for (const file of await this.db.query(
        "SELECT pf.id,f.file_url,f.file_key FROM property_files pf JOIN files f ON f.id=pf.file_id WHERE pf.property_id=? AND pf.document_type='floor_plan' AND pf.is_public=1 ORDER BY pf.sort_order,pf.id",
        [id],
      ))
        addImage(
          file.file_key || file.file_url,
          `property-file:${file.id}`,
          'Floor plan',
          file.id,
        );
      const details = await this.one(
        'SELECT floor_plan_images FROM property_details WHERE property_id=?',
        [id],
      );
      json<any[]>(details?.floor_plan_images, []).forEach((f, i) =>
        addImage(f.imageUrl, `property-floor:${i}`, 'Floor plan', i),
      );
      for (const unit of await this.db.query(
        'SELECT id,floor_plan_image_url FROM property_units WHERE property_id=? AND floor_plan_image_url IS NOT NULL',
        [id],
      ))
        addImage(
          unit.floor_plan_image_url,
          `property-unit:${unit.id}`,
          'Floor plan',
          unit.id,
        );
    } else {
      addImage(target.cover_image_url, 'project-cover', 'Photo', 'cover');
      addImage(
        target.mobile_cover_image_url,
        'project-mobile-cover',
        'Photo',
        'mobile-cover',
      );
      json<string[]>(target.gallery_image_urls, []).forEach((url, i) =>
        addImage(url, `project-image:${i}`, 'Photo', i),
      );
      for (const unit of await this.db.query(
        'SELECT id,floor_plan_image_url,floor_plans FROM project_units WHERE project_id=? ORDER BY id',
        [id],
      )) {
        addImage(
          unit.floor_plan_image_url,
          `project-floor:${unit.id}`,
          'Floor plan',
          unit.id,
        );
        json<any[]>(unit.floor_plans, []).forEach((f, i) =>
          addImage(
            f.imageUrl,
            `project-floor:${unit.id}:${i}`,
            'Floor plan',
            `${unit.id}:${i}`,
          ),
        );
      }
    }
    return {
      config,
      target,
      images,
      effective,
      entity: effective?.entity || {},
    };
  }

  private validateConfig(body: any) {
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('Invalid SEO config');
    const data: any = {};
    const strings: Record<string, number> = {
      meta_title: 255,
      meta_description: 320,
      h1: 255,
      h2: 255,
      og_title: 255,
      og_description: 320,
      og_image_url: 1024,
      canonical_url: 1024,
    };
    for (const [key, max] of Object.entries(strings))
      if (key in body) {
        if (
          body[key] != null &&
          (typeof body[key] !== 'string' || body[key].length > max)
        )
          throw new BadRequestException(`Invalid ${key}`);
        data[key] = body[key] || null;
      }
    for (const field of ['canonical_url', 'og_image_url'])
      if (data[field]) {
        let url: URL;
        try {
          url = new URL(data[field], SITE);
        } catch {
          throw new BadRequestException(`Invalid ${field}`);
        }
        if (
          !['http:', 'https:'].includes(url.protocol) ||
          url.username ||
          url.password
        )
          throw new BadRequestException(`Invalid ${field}`);
      }
    if ('public_path' in body)
      data.public_path = body.public_path ? pathValue(body.public_path) : null;
    for (const key of ['robots_index', 'robots_follow', 'priority_indexing'])
      if (key in body) {
        if (![true, false, 0, 1].includes(body[key]))
          throw new BadRequestException(`Invalid ${key}`);
        data[key] = Boolean(body[key]);
      }
    for (const key of [
      'highlights',
      'faqs',
      'schema_overrides',
      'image_alt_overrides',
      'section_seo',
      'settings',
    ])
      if (key in body) {
        if (
          !body[key] ||
          typeof body[key] !== 'object' ||
          JSON.stringify(body[key]).length > 200000
        )
          throw new BadRequestException(`Invalid ${key}`);
        if (!['highlights', 'faqs'].includes(key) && Array.isArray(body[key]))
          throw new BadRequestException(`${key} must be an object`);
        if (['highlights', 'faqs'].includes(key) && !Array.isArray(body[key]))
          throw new BadRequestException(`${key} must be a list`);
        data[key] = JSON.stringify(body[key]);
      }
    if (
      body.faqs?.some(
        (f: any) =>
          typeof f.question !== 'string' ||
          typeof f.answer !== 'string' ||
          !f.question.trim() ||
          !f.answer.trim(),
      )
    )
      throw new BadRequestException('Every FAQ needs a question and answer');
    if (body.highlights?.some((s: any) => typeof s !== 'string'))
      throw new BadRequestException('Highlights must contain text');
    const settings = body.settings;
    const entity = settings?.entity;
    if (entity) {
      if (typeof entity !== 'object' || Array.isArray(entity))
        throw new BadRequestException('Invalid entity overrides');
      for (const [key, min, max] of [
        ['latitude', -90, 90],
        ['longitude', -180, 180],
        ['lowPrice', 0, 1e15],
        ['highPrice', 0, 1e15],
        ['pricePerSqFt', 0, 1e15],
      ] as const) {
        if (
          entity[key] !== undefined &&
          entity[key] !== '' &&
          (!Number.isFinite(Number(entity[key])) ||
            Number(entity[key]) < min ||
            Number(entity[key]) > max)
        )
          throw new BadRequestException(`Invalid ${key}`);
      }
      if (
        Number(entity.lowPrice) > 0 &&
        Number(entity.highPrice) > 0 &&
        Number(entity.highPrice) < Number(entity.lowPrice)
      )
        throw new BadRequestException('High price must be at least low price');
    }
    if (
      settings?.secondary_keywords !== undefined &&
      (!Array.isArray(settings.secondary_keywords) ||
        settings.secondary_keywords.some((s: any) => typeof s !== 'string'))
    )
      throw new BadRequestException('Secondary keywords must be text');
    if (
      settings?.ai_summary !== undefined &&
      typeof settings.ai_summary !== 'string'
    )
      throw new BadRequestException('Summary must be text');
    const org = settings?.organization;
    if (org) {
      for (const [key, min, max] of [
        ['latitude', -90, 90],
        ['longitude', -180, 180],
      ] as const) {
        if (
          org[key] !== undefined &&
          org[key] !== '' &&
          (!Number.isFinite(Number(org[key])) ||
            Number(org[key]) < min ||
            Number(org[key]) > max)
        )
          throw new BadRequestException(`Invalid organization ${key}`);
      }
    }

    if (settings?.expired_redirect_path)
      pathValue(settings.expired_redirect_path);
    if (
      settings?.robots_txt !== undefined &&
      (typeof settings.robots_txt !== 'string' ||
        !/Disallow:\s*\/admin/i.test(settings.robots_txt) ||
        !/Disallow:\s*\/api/i.test(settings.robots_txt))
    )
      throw new BadRequestException('robots.txt must block /admin and /api');
    return data;
  }

  async saveConfig(
    key: string,
    body: any,
    actor: number,
    manager?: EntityManager,
  ) {
    if (manager) return this.persistConfig(manager, key, body, actor);
    const saved = await this.db.transaction((m) =>
      this.persistConfig(m, key, body, actor),
    );
    await this.notifyIndexing(saved);
    return saved;
  }

  private async persistConfig(
    m: EntityManager,
    key: string,
    body: any,
    actor: number,
  ) {
    if (!/^[a-zA-Z0-9:/_.-]{1,191}$/.test(key))
      throw new BadRequestException('Invalid configuration key');
    const existing = hydrate(
      await this.one(
        'SELECT * FROM seo_configs WHERE config_key=? FOR UPDATE',
        [key],
        m,
      ),
    );
    if (existing && Number(body.revision) !== Number(existing.revision))
      throw new ConflictException(
        'Someone changed this SEO. Reload before saving',
      );
    const scope = existing?.scope || key.split(':')[0];
    if (
      ![
        'project',
        'property',
        'listing',
        'page',
        'template',
        'technical',
      ].includes(scope)
    )
      throw new BadRequestException('Invalid scope');
    const data = this.validateConfig(body);
    if (
      scope === 'page' &&
      existing?.public_path &&
      data.public_path !== undefined &&
      data.public_path !== existing.public_path
    )
      throw new BadRequestException(
        'Core page paths are fixed. Use the redirect manager for URL changes',
      );
    if (
      (scope === 'property' || scope === 'project') &&
      'public_path' in data &&
      !data.public_path
    ) {
      const targetId = existing?.[`${scope}_id`];
      if (targetId) {
        const source = await this.one(
          `SELECT ${scope === 'project' ? 'canonical_slug' : 'slug'} AS path FROM ${scope === 'project' ? 'projects' : 'properties'} WHERE id=?`,
          [targetId],
          m,
        );
        if (source?.path) data.public_path = pathValue('/' + source.path);
      }
    }
    if (body.settings?.expired_redirect_path) {
      const destination = await this.resolve(
        body.settings.expired_redirect_path,
        false,
      );
      if (!destination || destination.gone || destination.scope !== 'listing')
        throw new BadRequestException(
          'Expired listings must redirect to an existing locality listing page',
        );
    }

    if (!existing) {
      data.config_key = key;
      data.scope = scope;
      data.created_by_crm_id = actor;
      if (scope === 'project' || scope === 'property') {
        const id = Number(key.split(':')[1]);
        if (
          !Number.isSafeInteger(id) ||
          id < 1 ||
          !(await this.one(
            `SELECT id FROM ${scope === 'project' ? 'projects' : 'properties'} WHERE id=?`,
            [id],
            m,
          ))
        )
          throw new NotFoundException('Inventory no longer exists');
        data[`${scope}_id`] = id;
        if (!data.public_path) {
          const source = await this.one(
            `SELECT ${scope === 'project' ? 'canonical_slug' : 'slug'} AS path FROM ${scope === 'project' ? 'projects' : 'properties'} WHERE id=?`,
            [id],
            m,
          );
          if (source?.path) data.public_path = pathValue('/' + source.path);
        }
      }
    }
    if (data.public_path) {
      const collision = await this.one(
        `SELECT config_key FROM seo_configs WHERE public_path=? AND config_key<>?`,
        [data.public_path, key],
        m,
      );
      const redirect = await this.one(
        'SELECT id FROM seo_redirects WHERE source_path=? AND is_active=1',
        [data.public_path],
        m,
      );
      if (collision || redirect)
        throw new ConflictException(
          'This URL already belongs to another page or redirect',
        );
      // A custom path must not shadow an inventory slug or fixed public route.
      for (const [table, column] of [
        ['properties', 'slug'],
        ['projects', 'canonical_slug'],
        ['projects', 'slug'],
      ]) {
        const found = await this.one(
          `SELECT id FROM ${table} WHERE ${column}=?`,
          [data.public_path.slice(1)],
          m,
        );
        if (
          found &&
          !(
            scope === 'property' &&
            table === 'properties' &&
            found.id === (existing?.property_id || data.property_id)
          ) &&
          !(
            scope === 'project' &&
            table === 'projects' &&
            found.id === (existing?.project_id || data.project_id)
          )
        )
          throw new ConflictException('URL is already used by inventory');
      }
      const reserved = [
        '/',
        '/projects',
        '/about-us',
        '/contact-us',
        '/services/liaisoning',
        '/services/property-management',
        '/services/financial-assistance',
        '/services/nri-property-investment',
        '/services/professional-brokerage-services',
        '/login',
        '/register',
        '/wishlist',
        '/post-property',
        '/robots.txt',
        '/llms.txt',
        '/sitemap.xml',
      ];
      if (scope !== 'page' && reserved.includes(data.public_path))
        throw new ConflictException('This is a reserved public route');
    }
    data.updated_by_crm_id = actor;
    try {
      const columns = Object.keys(data);
      if (existing)
        await m.query(
          `UPDATE seo_configs SET ${columns.map((c) => `\`${c}\`=?`).join(',')},revision=revision+1 WHERE id=?`,
          [...columns.map((c) => data[c]), existing.id],
        );
      else
        await m.query(
          `INSERT INTO seo_configs (${columns.map((c) => `\`${c}\``).join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
          columns.map((c) => data[c]),
        );
    } catch (e) {
      if ((e as any).code === 'ER_DUP_ENTRY')
        throw new ConflictException('SEO config or URL already exists');
      throw e;
    }
    const saved = hydrate(
      await this.one('SELECT * FROM seo_configs WHERE config_key=?', [key], m),
    );
    const previousPath =
      existing?.public_path ||
      (saved.property_id
        ? '/' +
          (
            await this.one(
              'SELECT slug FROM properties WHERE id=?',
              [saved.property_id],
              m,
            )
          )?.slug
        : saved.project_id
          ? '/' +
            (
              await this.one(
                'SELECT canonical_slug FROM projects WHERE id=?',
                [saved.project_id],
                m,
              )
            )?.canonical_slug
          : null);
    if (
      data.public_path &&
      previousPath &&
      previousPath !== data.public_path &&
      body.settings?.auto_redirect !== false
    )
      await this.persistRedirect(
        m,
        {
          source_path: previousPath,
          destination_path: data.public_path,
          reason: 'slug_change',
        },
        actor,
      );
    return saved;
  }

  async listingPages() {
    return (
      await this.db
        .query(`SELECT c.*, l.id AS listing_id,l.transaction_intent,l.inventory_kind,l.property_type,l.project_type,l.city_id,l.sublocation_id,l.bedrooms,l.filter_key,l.intro_content,l.bottom_content,l.faqs AS locality_faqs,l.auto_stats_faqs,l.thin_content_guard_enabled,l.minimum_active_listings,l.pinned_indexable,ct.city_name,s.locality_name
      FROM seo_listing_pages l JOIN seo_configs c ON c.id=l.seo_config_id JOIN cities ct ON ct.id=l.city_id LEFT JOIN sublocations s ON s.id=l.sublocation_id ORDER BY c.updated_at DESC`)
    ).map((r) => ({ ...hydrate(r), locality_faqs: json(r.locality_faqs, []) }));
  }

  async saveListing(body: any, actor: number) {
    const rule: any = {};
    rule.transaction_intent = body.transaction_intent;
    rule.inventory_kind = body.inventory_kind;
    if (
      !['buy', 'rent'].includes(rule.transaction_intent) ||
      !['property', 'project'].includes(rule.inventory_kind)
    )
      throw new BadRequestException('Choose a valid intent and inventory');
    if (rule.inventory_kind === 'project' && rule.transaction_intent !== 'buy')
      throw new BadRequestException('Projects support Sale only');
    rule.property_type =
      rule.inventory_kind === 'property' ? body.property_type || null : null;
    rule.project_type =
      rule.inventory_kind === 'project' ? body.project_type || null : null;
    if (rule.property_type && !PROPERTY_TYPES.includes(rule.property_type))
      throw new BadRequestException('Invalid property type');
    if (
      rule.project_type &&
      !['apartment', 'villa', 'plot'].includes(rule.project_type)
    )
      throw new BadRequestException('Invalid project type');
    rule.city_id = Number(body.city_id);
    rule.sublocation_id = body.sublocation_id
      ? Number(body.sublocation_id)
      : null;
    rule.bedrooms = body.bedrooms ? Number(body.bedrooms) : null;
    if (
      rule.bedrooms &&
      (!Number.isInteger(rule.bedrooms) ||
        rule.bedrooms < 1 ||
        rule.bedrooms > 20)
    )
      throw new BadRequestException('Invalid bedrooms');
    if (!(await this.one('SELECT id FROM cities WHERE id=?', [rule.city_id])))
      throw new BadRequestException('Choose a city');
    if (
      rule.sublocation_id &&
      !(await this.one('SELECT id FROM sublocations WHERE id=? AND city_id=?', [
        rule.sublocation_id,
        rule.city_id,
      ]))
    )
      throw new BadRequestException('Locality must belong to the city');
    for (const key of ['intro_content', 'bottom_content']) {
      if (
        body[key] != null &&
        (typeof body[key] !== 'string' || body[key].length > 100000)
      )
        throw new BadRequestException(`Invalid ${key}`);
      rule[key] = body[key] || null;
    }
    rule.faqs = JSON.stringify(body.locality_faqs || []);
    if (
      !Array.isArray(body.locality_faqs || []) ||
      (body.locality_faqs || []).some(
        (f: any) => !f.question?.trim() || !f.answer?.trim(),
      )
    )
      throw new BadRequestException('Invalid locality FAQs');
    for (const key of [
      'auto_stats_faqs',
      'thin_content_guard_enabled',
      'pinned_indexable',
    ])
      rule[key] = Boolean(body[key] ?? key !== 'pinned_indexable');
    rule.minimum_active_listings = Number(body.minimum_active_listings ?? 2);
    if (
      !Number.isInteger(rule.minimum_active_listings) ||
      rule.minimum_active_listings < 0 ||
      rule.minimum_active_listings > 1000
    )
      throw new BadRequestException('Invalid inventory threshold');
    rule.filter_key = filterKey(rule);
    const existing = body.listing_id
      ? await this.one(
          'SELECT seo_config_id FROM seo_listing_pages WHERE id=?',
          [body.listing_id],
        )
      : null;
    if (body.listing_id && !existing)
      throw new NotFoundException('Listing rule not found');
    const key = existing
      ? (
          await this.one('SELECT config_key FROM seo_configs WHERE id=?', [
            existing.seo_config_id,
          ])
        ).config_key
      : `listing:${rule.filter_key}`;
    if (!body.public_path)
      throw new BadRequestException('A listing page needs a URL');
    const saved = await this.db.transaction(async (m) => {
      const config = await this.saveConfig(key, body, actor, m);
      rule.seo_config_id = config.id;
      const columns = Object.keys(rule);
      try {
        if (existing)
          await m.query(
            `UPDATE seo_listing_pages SET ${columns.map((c) => `\`${c}\`=?`).join(',')} WHERE id=?`,
            [...columns.map((c) => rule[c]), body.listing_id],
          );
        else
          await m.query(
            `INSERT INTO seo_listing_pages (${columns.map((c) => `\`${c}\``).join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
            columns.map((c) => rule[c]),
          );
      } catch (e) {
        if ((e as any).code === 'ER_DUP_ENTRY')
          throw new ConflictException(
            'A page already exists for these filters',
          );
        throw e;
      }
      return config;
    });
    await this.notifyIndexing(saved);
    return saved;
  }

  async removeListing(id: number) {
    const row = await this.one(
      'SELECT seo_config_id FROM seo_listing_pages WHERE id=?',
      [id],
    );
    if (!row) throw new NotFoundException('Listing rule not found');
    await this.db.query('DELETE FROM seo_configs WHERE id=?', [
      row.seo_config_id,
    ]);
    return { removed: true };
  }

  async redirects() {
    return this.db.query(
      'SELECT * FROM seo_redirects ORDER BY updated_at DESC',
    );
  }
  async saveRedirect(body: any, actor: number) {
    return this.db.transaction((m) => this.persistRedirect(m, body, actor));
  }
  private async persistRedirect(m: EntityManager, body: any, actor: number) {
    const source = pathValue(body.source_path),
      dest = pathValue(body.destination_path);
    if (source === dest)
      throw new BadRequestException('Source and destination must differ');
    let path = dest;
    for (let i = 0; i < 100; i++) {
      if (path === source)
        throw new BadRequestException('This redirect creates a loop');
      const next = await this.one(
        'SELECT destination_path FROM seo_redirects WHERE source_path=? AND is_active=1',
        [path],
        m,
      );
      if (!next) break;
      path = next.destination_path;
      if (i === 99) throw new BadRequestException('Redirect chain is too long');
    }
    const target = await this.resolve(dest, false);
    if (
      !target &&
      !(await this.one(
        'SELECT id FROM seo_configs WHERE public_path=?',
        [dest],
        m,
      ))
    )
      throw new BadRequestException(
        'Destination must be an existing public page',
      );
    await m.query(
      `INSERT INTO seo_redirects (source_path,destination_path,reason,is_active,created_by_crm_id,updated_by_crm_id)
      VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE destination_path=VALUES(destination_path),reason=VALUES(reason),is_active=VALUES(is_active),updated_by_crm_id=VALUES(updated_by_crm_id)`,
      [
        source,
        dest,
        body.reason || 'manual',
        body.is_active === false || body.is_active === 0 ? 0 : 1,
        actor,
        actor,
      ],
    );
    return this.one(
      'SELECT * FROM seo_redirects WHERE source_path=?',
      [source],
      m,
    );
  }
  async removeRedirect(id: number) {
    await this.db.query('DELETE FROM seo_redirects WHERE id=?', [id]);
    return { removed: true };
  }

  async routing() {
    const [redirects, configs] = await Promise.all([
      this.db.query(
        'SELECT source_path AS source,destination_path AS destination FROM seo_redirects WHERE is_active=1',
      ),
      this.db
        .query(`SELECT c.public_path,c.scope,c.settings,p.status AS property_status,j.status AS project_status,(p.available_until IS NOT NULL AND p.available_until < DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+05:30'))) AS is_expired
        FROM seo_configs c LEFT JOIN properties p ON p.id=c.property_id LEFT JOIN projects j ON j.id=c.project_id
        WHERE c.public_path IS NOT NULL AND c.scope IN ('property','project','listing')`),
    ]);
    for (const c of configs) {
      const settings = json<any>(c.settings, {});
      if (
        settings.expired_redirect_path &&
        ((c.scope === 'property' &&
          (c.property_status !== 'available' || c.is_expired)) ||
          (c.scope === 'project' && c.project_status !== 'published'))
      )
        redirects.push({
          source: c.public_path,
          destination: settings.expired_redirect_path,
        });
    }
    return {
      redirects,
      inventory_paths: configs
        .filter((c: any) => ['property', 'project'].includes(c.scope))
        .map((c: any) => c.public_path),
      paths: configs
        .filter((c: any) => c.public_path.split('/').filter(Boolean).length > 1)
        .map((c: any) => c.public_path),
    };
  }

  async technical() {
    return hydrate(
      await this.one(
        "SELECT * FROM seo_configs WHERE config_key='technical:site'",
      ),
    );
  }
  private async notifyIndexing(config: any) {
    // Dynamic, uncached sitemaps reflect this save immediately. IndexNow is
    // optional; a failed ping does not roll back an SEO save.
    if (!config.priority_indexing || !process.env.INDEXNOW_KEY) return;
    const path = config.public_path;
    if (!path) return;
    try {
      const response = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: new URL(SITE).host,
          key: process.env.INDEXNOW_KEY,
          keyLocation: SITE + '/indexnow-key.txt',
          urlList: [SITE + path],
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok)
        console.warn('[SEO] IndexNow returned', response.status);
    } catch {
      console.warn('[SEO] IndexNow unavailable');
    }
  }

  async inferRule(path: string) {
    const match = path
      .slice(1)
      .match(/^(?:(\d+)-bhk-)?(.+?)-for-(sale|rent)-in-(.+)$/);
    if (!match) return null;
    const type = Object.entries(TYPE_SLUGS).find(
      ([, value]) => value === match[2],
    )?.[0];
    if (!type) return null;
    const cities = await this.db.query(
      'SELECT id,city_name FROM cities WHERE is_active=1',
    );
    const city = cities.find(
      (c: any) =>
        match[4] === slug(c.city_name) ||
        match[4].endsWith('-' + slug(c.city_name)),
    );
    if (!city) return null;
    const locSlug =
      match[4] === slug(city.city_name)
        ? ''
        : match[4].slice(0, -slug(city.city_name).length - 1);
    const sublocations = locSlug
      ? await this.db.query(
          'SELECT id,locality_name FROM sublocations WHERE city_id=?',
          [city.id],
        )
      : [];
    const sub = sublocations.find(
      (s: any) => slug(s.locality_name) === locSlug,
    );
    if (locSlug && !sub) return null;
    return {
      inventory_kind: 'property',
      transaction_intent: match[3] === 'rent' ? 'rent' : 'buy',
      property_type: type,
      city_id: city.id,
      city_name: city.city_name,
      sublocation_id: sub?.id || null,
      locality_name: sub?.locality_name || null,
      bedrooms: match[1] ? Number(match[1]) : null,
      minimum_active_listings: 2,
      thin_content_guard_enabled: true,
      pinned_indexable: false,
      auto_stats_faqs: true,
    };
  }

  private async matchingInventory(rule: any) {
    const args: any[] = [];
    let sql: string;
    if (rule.inventory_kind === 'project') {
      const where = ["p.status='published'", 'LOWER(p.city)=LOWER(?)'];
      args.push(rule.city_name);
      if (rule.locality_name) {
        where.push('LOWER(p.sublocation)=LOWER(?)');
        args.push(rule.locality_name);
      }
      if (rule.project_type) {
        where.push('p.project_type=?');
        args.push(rule.project_type);
      }
      if (rule.bedrooms) {
        where.push(
          "EXISTS(SELECT 1 FROM project_units u WHERE u.project_id=p.id AND u.status='available' AND u.bedrooms=?)",
        );
        args.push(rule.bedrooms);
      }
      sql = `SELECT p.id,p.name AS title,TRIM(LEADING '/' FROM COALESCE(c.public_path,p.canonical_slug)) AS slug,p.project_type AS type,
        (SELECT MIN(u.price) FROM project_units u WHERE u.project_id=p.id AND u.status='available' AND u.price>0) AS price,
        (SELECT MAX(u.price) FROM project_units u WHERE u.project_id=p.id AND u.status='available' AND u.price>0) AS max_price,
        NULL AS area_sqft,p.cover_image_url AS image_url,p.updated_at FROM projects p LEFT JOIN seo_configs c ON c.project_id=p.id WHERE ${where.join(' AND ')}`;
    } else {
      const where = [
        LIVE_PROPERTY,
        `(${intentWhere(rule.transaction_intent)})`,
        'LOWER(p.city)=LOWER(?)',
      ];
      args.push(rule.city_name);
      if (rule.property_type) {
        where.push('p.property_type=?');
        args.push(rule.property_type);
      }
      if (rule.sublocation_id) {
        where.push(
          'EXISTS(SELECT 1 FROM property_locations pl WHERE pl.property_id=p.id AND pl.location_id=?)',
        );
        args.push(rule.sublocation_id);
      }
      if (rule.bedrooms) {
        where.push('d.bedrooms=?');
        args.push(rule.bedrooms);
      }
      sql = `SELECT p.id,p.title,TRIM(LEADING '/' FROM COALESCE(c.public_path,p.slug)) AS slug,p.property_type AS type,p.price,p.price AS max_price,d.area_sqft,p.updated_at,
        (SELECT i.image_url FROM property_images i WHERE i.property_id=p.id ORDER BY i.is_primary DESC,i.id LIMIT 1) AS image_url
        FROM properties p LEFT JOIN property_details d ON d.property_id=p.id LEFT JOIN seo_configs c ON c.property_id=p.id WHERE ${where.join(' AND ')}`;
    }
    const items = await this.db.query(sql, args);
    const prices = items
      .map((p: any) => Number(p.price))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    const maxPrices = items
      .map((p: any) => Number(p.max_price))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    const ratios = items
      .filter((p: any) => Number(p.price) > 0 && Number(p.area_sqft) > 0)
      .map((p: any) => Number(p.price) / Number(p.area_sqft));
    return {
      items,
      stats: {
        total: items.length,
        min_price: prices.length ? Math.min(...prices) : null,
        max_price: maxPrices.length ? Math.max(...maxPrices) : null,
        average_price_sqft: ratios.length
          ? Math.round(
              ratios.reduce((a: number, b: number) => a + b, 0) / ratios.length,
            )
          : null,
        priced_count: prices.length,
        price_sqft_sample_count: ratios.length,
        intent: rule.transaction_intent,
      },
    };
  }

  async resolve(rawPath: string, includeRedirect = true): Promise<any> {
    const path = pathValue(rawPath);
    if (includeRedirect) {
      const redirect = await this.one(
        'SELECT destination_path FROM seo_redirects WHERE source_path=? AND is_active=1',
        [path],
      );
      if (redirect) return { redirect: redirect.destination_path };
    }
    let config = hydrate(
      await this.one('SELECT * FROM seo_configs WHERE public_path=?', [path]),
    );
    let target: any = null,
      scope = config?.scope;
    if (scope === 'property')
      target = config.property_id
        ? await this.one('SELECT * FROM properties WHERE id=?', [
            config.property_id,
          ])
        : null;
    if (scope === 'project')
      target = config.project_id
        ? await this.one('SELECT * FROM projects WHERE id=?', [
            config.project_id,
          ])
        : null;
    if (!config) {
      target = await this.one('SELECT * FROM properties WHERE slug=?', [
        path.slice(1),
      ]);
      if (target) {
        scope = 'property';
        config = hydrate(
          await this.one('SELECT * FROM seo_configs WHERE property_id=?', [
            target.id,
          ]),
        );
      } else {
        target = await this.one(
          'SELECT * FROM projects WHERE canonical_slug=? OR slug=?',
          [path.slice(1), path.slice(1)],
        );
        if (target) {
          scope = 'project';
          config = hydrate(
            await this.one('SELECT * FROM seo_configs WHERE project_id=?', [
              target.id,
            ]),
          );
        }
      }
    }
    if ((scope === 'property' || scope === 'project') && !target)
      return config?.settings?.expired_redirect_path
        ? { redirect: config.settings.expired_redirect_path }
        : { gone: true, scope, config, robots_index: false };
    let rule =
      scope === 'listing' && config
        ? await this.one(
            `SELECT l.*,ct.city_name,s.locality_name FROM seo_listing_pages l JOIN cities ct ON ct.id=l.city_id LEFT JOIN sublocations s ON s.id=l.sublocation_id WHERE l.seo_config_id=?`,
            [config.id],
          )
        : null;
    if (!scope || (scope === 'listing' && !rule)) {
      const inferred = await this.inferRule(path);
      if (inferred) {
        scope = 'listing';
        rule = inferred;
      }
    }
    if (!scope) return null;
    if (['technical', 'template'].includes(scope)) return null;
    const sourcePath = target
      ? '/' + (target.canonical_slug || target.slug)
      : path;
    const publicPath = config?.public_path || sourcePath;
    if (
      includeRedirect &&
      publicPath !== path &&
      config?.settings?.auto_redirect !== false
    )
      return { redirect: publicPath };
    const expired =
      target && scope === 'property'
        ? Number(
            (
              await this.one(
                "SELECT available_until IS NOT NULL AND available_until < DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+05:30')) AS expired FROM properties WHERE id=?",
                [target.id],
              )
            )?.expired,
          )
        : 0;
    if (
      target &&
      (expired ||
        (scope === 'property'
          ? target.status !== 'available'
          : target.status !== 'published'))
    ) {
      if (config?.settings?.expired_redirect_path)
        return { redirect: config.settings.expired_redirect_path };
      return { gone: true, scope, config, robots_index: false };
    }
    let data: any = {},
      intent = 'buy',
      type = '',
      locality = '',
      extra: any = {};
    if (scope === 'listing' && rule) {
      data = await this.matchingInventory(rule);
      intent = rule.transaction_intent;
      type = rule.property_type || rule.project_type || 'properties';
      locality = rule.locality_name || '';
    }
    if (target) {
      intent =
        scope === 'property' && target.listing_type === 'Rent' ? 'rent' : 'buy';
      type = target.property_type || target.project_type;
      if (scope === 'property') {
        extra =
          (await this.one(
            `SELECT d.bedrooms,d.area_sqft,s.locality_name,pl.latitude,pl.longitude,pl.pincode,pl.landmark FROM properties p LEFT JOIN property_details d ON d.property_id=p.id LEFT JOIN property_locations pl ON pl.property_id=p.id LEFT JOIN sublocations s ON s.id=pl.location_id WHERE p.id=? ORDER BY s.id LIMIT 1`,
            [target.id],
          )) || {};
        locality = extra.locality_name || '';
      } else locality = target.sublocation || '';
    }
    const defaults =
      scope === 'project' && target
        ? await this.one(
            "SELECT MIN(price) AS lowPrice,MAX(price) AS highPrice,GROUP_CONCAT(DISTINCT bedrooms ORDER BY bedrooms) AS bedrooms FROM project_units WHERE project_id=? AND status='available' AND price>0",
            [target.id],
          )
        : {};
    const entity = {
      locality,
      pincode: extra.pincode || target?.pincode || '',
      builder_entity_name: target?.builder_name || '',
      rera_id: target?.rera_number || '',
      lowPrice: defaults?.lowPrice || target?.price || '',
      highPrice: defaults?.highPrice || target?.price || '',
      latitude: extra.latitude || target?.latitude || '',
      longitude: extra.longitude || target?.longitude || '',
      landmarks: extra.landmark || '',
      ...config?.settings?.entity,
    };
    locality = entity.locality || locality;
    const city = target?.city || rule?.city_name || 'Coimbatore';
    const variables: any = {
      BHK: extra.bedrooms
        ? `${extra.bedrooms} BHK`
        : defaults?.bedrooms
          ? `${String(defaults.bedrooms).split(',').join(', ')} BHK`
          : '',
      SqFt: extra.area_sqft
        ? Number(extra.area_sqft).toLocaleString('en-IN', {
            maximumFractionDigits: 2,
            useGrouping: false,
          })
        : '',
      Property_Type:
        scope === 'property'
          ? SINGULAR_TYPES[type] || 'Property'
          : TYPE_LABELS[type] || 'Properties',
      Project_Type: TYPE_LABELS[type] || 'Properties',
      Transaction_Type: intent === 'rent' ? 'Rent' : 'Sale',
      Sub_Locality: locality || city,
      City: city,
      Location: locality ? `${locality}, ${city}` : city,
      Price: priceLabel(target?.price),
      Min_Price: priceLabel(entity.lowPrice),
      Project_Name: target?.name || '',
      Property_Name: target?.title || target?.name || '',
      Builder: entity.builder_entity_name,
    };
    const template = hydrate(
      await this.one('SELECT * FROM seo_configs WHERE config_key=?', [
        `template:${scope}:${type}:${intent}`,
      ]),
    );
    const resolved: any = {
      scope,
      path: publicPath,
      source_path: sourcePath,
      target_id: target?.id,
      config_key: config?.config_key,
      meta_title:
        config?.meta_title ||
        renderTemplate(template?.meta_title, variables) ||
        target?.name ||
        target?.title ||
        (scope === 'page' ? '' : 'Majestan Realty'),
      meta_description:
        config?.meta_description ||
        renderTemplate(template?.meta_description, variables),
      h1:
        config?.h1 ||
        renderTemplate(template?.h1, variables) ||
        target?.title ||
        target?.name,
      h2: config?.h2 || '',
      canonical_url: config?.canonical_url || SITE + publicPath,
      og_title: config?.og_title,
      og_description: config?.og_description,
      og_image_url: config?.og_image_url || target?.cover_image_url,
      robots_index: config ? Boolean(config.robots_index) : true,
      robots_follow: config ? Boolean(config.robots_follow) : true,
      highlights: config?.highlights || [],
      faqs: config?.faqs || [],
      image_alt_overrides: config?.image_alt_overrides || {},
      schema_overrides: config?.schema_overrides || {},
      section_seo: Object.fromEntries(
        Object.entries({
          ...template?.section_seo,
          ...config?.section_seo,
        }).map(([key, value]) => [
          key,
          Object.fromEntries(
            Object.entries(value as any).map(([field, text]) => [
              field,
              typeof text === 'string' ? renderTemplate(text, variables) : text,
            ]),
          ),
        ]),
      ),
      variables,
      entity,
      settings: config?.settings || {},
      ...data,
      rule,
    };
    if (scope === 'listing') {
      if (
        rule?.thin_content_guard_enabled &&
        !rule.pinned_indexable &&
        data.stats?.total < rule.minimum_active_listings
      )
        resolved.robots_index = false;
      resolved.intro_content = rule?.intro_content || '';
      resolved.bottom_content =
        rule?.bottom_content || config?.settings?.legacy_bottom_content || '';
      resolved.faqs = [...resolved.faqs, ...json<any[]>(rule?.faqs, [])];
      if (rule?.auto_stats_faqs && data.stats) {
        resolved.faqs.push({
          question: `How many ${variables.Property_Type.toLowerCase()} are available for ${variables.Transaction_Type.toLowerCase()} in ${variables.Location}?`,
          answer: `Majestan Realty currently lists ${data.stats.total} matching active listings.`,
        });
        if (data.stats.average_price_sqft)
          resolved.faqs.push({
            question: `What is the average ${intent === 'rent' ? 'monthly rent' : 'asking price'} per square foot in ${variables.Location}?`,
            answer: `The average ${intent === 'rent' ? 'monthly rent' : 'asking price'} is ₹${data.stats.average_price_sqft.toLocaleString('en-IN')} per sq.ft, based on ${data.stats.price_sqft_sample_count} listings with known prices and areas.`,
          });
      }
    }
    if (target && !resolved.faqs.length)
      resolved.faqs = await this.db.query(
        `SELECT question,answer FROM ${scope === 'project' ? 'project_faqs' : 'property_faqs'} WHERE ${scope}_id=? AND section='overview' ORDER BY sort_order,id`,
        [target.id],
      );
    if (scope === 'project' && target) {
      const offers = await this.one(
        "SELECT MIN(price) AS low_price,MAX(price) AS high_price,COUNT(*) AS offer_count FROM project_units WHERE project_id=? AND status='available' AND price>0",
        [target.id],
      );
      if (offers?.offer_count) resolved.project_offers = offers;
    }
    if (scope === 'property' && extra.latitude && extra.longitude)
      resolved.geo = {
        latitude: Number(extra.latitude),
        longitude: Number(extra.longitude),
      };
    if (entity.latitude !== '' && entity.longitude !== '')
      resolved.geo = {
        latitude: Number(entity.latitude),
        longitude: Number(entity.longitude),
      };
    resolved.json_ld = this.structuredData(resolved, target);
    return resolved;
  }

  private structuredData(seo: any, target: any) {
    const url = SITE + seo.path,
      graph: any[] = [];
    const pageName =
      seo.h1 ||
      seo.meta_title ||
      (seo.path === '/'
        ? 'Majestan Realty'
        : seo.path
            .split('/')
            .filter(Boolean)
            .at(-1)
            .split('-')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '));
    const breadcrumbs = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
        {
          '@type': 'ListItem',
          position: 2,
          name: pageName,
          item: url,
        },
      ],
    };
    graph.push(breadcrumbs);
    if (seo.faqs.length)
      graph.push({
        '@type': 'FAQPage',
        mainEntity: seo.faqs.map((f: any) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      });
    if (seo.scope === 'listing')
      graph.push({
        '@type': 'ItemList',
        name: seo.h1,
        url,
        numberOfItems: seo.stats?.total || 0,
        itemListElement: (seo.items || [])
          .slice(0, 100)
          .map((p: any, i: number) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: SITE + '/' + p.slug,
            name: p.title,
          })),
      });
    if (seo.scope === 'property' && target) {
      const placeType =
        target.property_type === 'apartment'
          ? 'Apartment'
          : ['villa', 'individual_portion'].includes(target.property_type)
            ? 'SingleFamilyResidence'
            : ['plot', 'farmland'].includes(target.property_type)
              ? 'Landform'
              : 'Place';
      graph.push({
        '@type': 'RealEstateListing',
        url,
        name: seo.h1,
        description: seo.settings.ai_summary
          ? [seo.settings.ai_summary, ...seo.highlights]
              .filter(Boolean)
              .join(' ')
          : seo.meta_description,
        mainEntity: {
          '@type': placeType,
          name: target.title,
          ...(seo.entity?.rera_id ? { identifier: seo.entity.rera_id } : {}),
          address: {
            '@type': 'PostalAddress',
            addressLocality: seo.entity?.locality || target.city,
            postalCode: seo.entity?.pincode || undefined,
            addressRegion: target.state,
            addressCountry: 'IN',
          },
          ...(seo.geo
            ? { geo: { '@type': 'GeoCoordinates', ...seo.geo } }
            : {}),
        },
        ...(seo.entity?.builder_entity_name
          ? {
              provider: {
                '@type': 'Organization',
                name: seo.entity.builder_entity_name,
              },
            }
          : {}),
        ...(Number(seo.entity?.lowPrice || target.price) > 0
          ? {
              offers: {
                ...(Number(seo.entity?.highPrice) >
                Number(seo.entity?.lowPrice || target.price)
                  ? {
                      '@type': 'AggregateOffer',
                      lowPrice: Number(seo.entity.lowPrice || target.price),
                      highPrice: Number(seo.entity.highPrice),
                    }
                  : {
                      '@type': 'Offer',
                      price: Number(seo.entity?.lowPrice || target.price),
                    }),
                priceCurrency: 'INR',
                availability: 'https://schema.org/InStock',
                businessFunction:
                  target.listing_type === 'Rent'
                    ? 'http://purl.org/goodrelations/v1#LeaseOut'
                    : 'http://purl.org/goodrelations/v1#Sell',
                url,
              },
            }
          : {}),
      });
    }
    if (seo.scope === 'project' && target)
      graph.push({
        '@type':
          target.project_type === 'apartment'
            ? 'ApartmentComplex'
            : target.project_type === 'villa'
              ? 'GatedResidenceCommunity'
              : 'Place',
        name: target.name,
        url,
        address: {
          '@type': 'PostalAddress',
          streetAddress: target.address,
          addressLocality:
            seo.entity?.locality || target.sublocation || target.city,
          postalCode: seo.entity?.pincode || undefined,
          addressRegion: target.state || 'Tamil Nadu',
          addressCountry: 'IN',
        },
        ...(seo.project_offers
          ? {
              offers: {
                '@type': 'AggregateOffer',
                lowPrice: Number(
                  seo.entity?.lowPrice || seo.project_offers.low_price,
                ),
                highPrice: Number(
                  seo.entity?.highPrice || seo.project_offers.high_price,
                ),
                offerCount: Number(seo.project_offers.offer_count),
                priceCurrency: 'INR',
              },
            }
          : {}),
        identifier:
          seo.entity?.rera_id || seo.settings.rera_id || target.rera_number,
        additionalProperty: [
          {
            '@type': 'PropertyValue',
            name: 'Builder',
            value:
              seo.entity?.builder_entity_name ||
              seo.settings.builder_entity_name ||
              target.builder_name,
          },
        ],
        ...(seo.geo
          ? {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: seo.geo.latitude,
                longitude: seo.geo.longitude,
              },
            }
          : {}),
      });
    if (seo.scope === 'project' && target) {
      const development = graph[graph.length - 1];
      development['@id'] = url + '#development';
      const offers = development.offers;
      delete development.offers;
      const builder =
        seo.entity?.builder_entity_name ||
        seo.settings.builder_entity_name ||
        target.builder_name;
      if (builder)
        graph.push({
          '@type': 'Organization',
          '@id': url + '#builder',
          name: builder,
        });
      graph.push({
        '@type': 'RealEstateListing',
        url,
        name: seo.h1 || target.name,
        description: seo.settings.ai_summary
          ? [seo.settings.ai_summary, ...seo.highlights]
              .filter(Boolean)
              .join(' ')
          : seo.meta_description,
        mainEntity: { '@id': url + '#development' },
        ...(offers ? { offers } : {}),
        ...(builder ? { provider: { '@id': url + '#builder' } } : {}),
      });
    }
    if (seo.scope === 'page' && Object.keys(seo.settings || {}).length === 0)
      graph.push({ '@type': 'WebPage', name: pageName, url });
    if (seo.config_key && seo.scope === 'page' && seo.settings.schema)
      graph.push(seo.settings.schema);
    const keywords = [
      seo.settings.focus_keyword,
      ...(Array.isArray(seo.settings.secondary_keywords)
        ? seo.settings.secondary_keywords
        : []),
    ]
      .filter(Boolean)
      .join(', ');
    for (const node of graph) {
      if (node['@type'] !== 'BreadcrumbList' && node['@type'] !== 'FAQPage') {
        if (keywords) node.keywords = keywords;
        if (seo.entity?.landmarks)
          node.additionalProperty = [
            ...(node.additionalProperty || []),
            {
              '@type': 'PropertyValue',
              name: 'Nearby landmarks',
              value: seo.entity.landmarks,
            },
          ];
        if (seo.entity?.pricePerSqFt)
          node.additionalProperty = [
            ...(node.additionalProperty || []),
            {
              '@type': 'PropertyValue',
              name: 'Price per square foot',
              value: Number(seo.entity.pricePerSqFt),
            },
          ];
      }
    }
    const override = seo.schema_overrides || {};
    // Match an explicit @id or @type to override generated nodes; unmatched nodes extend the graph.
    const patches = Array.isArray(override['@graph'])
      ? override['@graph']
      : Object.keys(override).length
        ? [override]
        : [];
    for (const patch of patches) {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) continue;
      const index = graph.findIndex((node) =>
        patch['@id']
          ? node['@id'] === patch['@id']
          : patch['@type']
            ? node['@type'] === patch['@type']
            : node['@type'] === 'RealEstateListing' ||
              node['@type'] === 'WebPage',
      );
      if (index >= 0) graph[index] = this.mergeSchema(graph[index], patch);
      else graph.push(patch);
    }
    return { '@context': 'https://schema.org', '@graph': graph };
  }

  private mergeSchema(base: any, patch: any): any {
    const result = { ...base };
    for (const [key, value] of Object.entries(patch))
      result[key] =
        value && typeof value === 'object' && !Array.isArray(value)
          ? this.mergeSchema(base?.[key] || {}, value)
          : value;
    return result;
  }

  async organization() {
    const config = await this.technical(),
      org = config?.settings?.organization || {};
    return {
      '@context': 'https://schema.org',
      '@type': ['Organization', 'RealEstateAgent'],
      '@id': SITE + '#organization',
      name: org.name || 'Majestan Realty',
      url: SITE,
      logo: SITE + '/assets/images/logo/logo.png',
      telephone: org.telephone,
      address: {
        '@type': 'PostalAddress',
        streetAddress: org.streetAddress,
        addressLocality: org.addressLocality,
        addressRegion: org.addressRegion,
        postalCode: org.postalCode,
        addressCountry: org.addressCountry,
      },
      ...(org.latitude && org.longitude
        ? {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: org.latitude,
              longitude: org.longitude,
            },
          }
        : {}),
    };
  }

  async sitemapEntries(group: string) {
    let entries: any[] = [];
    if (group === 'projects')
      entries = await this.db.query(
        `SELECT COALESCE(c.public_path,CONCAT('/',p.canonical_slug)) AS path,COALESCE(c.updated_at,p.updated_at) AS updated_at,c.canonical_url FROM projects p LEFT JOIN seo_configs c ON c.project_id=p.id WHERE p.status='published' AND COALESCE(c.robots_index,1)=1`,
      );
    else if (['properties-buy', 'properties-rent'].includes(group))
      entries = await this.db.query(
        `SELECT COALESCE(c.public_path,CONCAT('/',p.slug)) AS path,COALESCE(c.updated_at,p.updated_at) AS updated_at,c.canonical_url FROM properties p LEFT JOIN seo_configs c ON c.property_id=p.id WHERE ${LIVE_PROPERTY} AND p.slug IS NOT NULL AND p.listing_type=? AND COALESCE(c.robots_index,1)=1`,
        [group === 'properties-rent' ? 'Rent' : 'Sell'],
      );
    else if (group === 'pages')
      entries = await this.db.query(
        "SELECT public_path AS path,updated_at,canonical_url FROM seo_configs WHERE scope='page' AND robots_index=1 AND public_path IS NOT NULL",
      );
    else if (group === 'localities') {
      const paths = new Set<string>(
        (
          await this.db.query(
            "SELECT public_path FROM seo_configs WHERE scope='listing' AND public_path IS NOT NULL",
          )
        ).map((r: any) => r.public_path),
      );
      const groups = await this.db
        .query(`SELECT p.city,p.property_type,p.listing_type,s.locality_name,COUNT(DISTINCT p.id) AS total
        FROM properties p JOIN property_locations pl ON pl.property_id=p.id JOIN sublocations s ON s.id=pl.location_id
        WHERE ${LIVE_PROPERTY} GROUP BY p.city,p.property_type,p.listing_type,s.id
        UNION ALL SELECT p.city,p.property_type,p.listing_type,NULL,COUNT(*) AS total FROM properties p
        WHERE ${LIVE_PROPERTY} GROUP BY p.city,p.property_type,p.listing_type`);
      const automatic = groups
        .filter((g: any) => Number(g.total) >= 2 && TYPE_SLUGS[g.property_type])
        .map(
          (g: any) =>
            `/${TYPE_SLUGS[g.property_type]}-for-${g.listing_type === 'Rent' ? 'rent' : 'sale'}-in-${g.locality_name ? slug(g.locality_name) + '-' : ''}${slug(g.city)}`,
        );
      // Explicit rules can override an automatic page; resolve those below.
      for (const path of automatic)
        if (!paths.has(path)) entries.push({ path });
      for (const path of paths) {
        const seo = await this.resolve(path);
        if (seo && !seo.redirect && !seo.gone && seo.robots_index)
          entries.push({ path, canonical_url: seo.canonical_url });
      }
    } else throw new NotFoundException('Unknown sitemap');
    const redirects = new Set(
      (
        await this.db.query(
          'SELECT source_path FROM seo_redirects WHERE is_active=1',
        )
      ).map((r: any) => r.source_path),
    );
    return entries.filter(
      (e) =>
        e.path &&
        !redirects.has(e.path) &&
        (!e.canonical_url || e.canonical_url === SITE + e.path),
    );
  }
  async sitemap(group: string) {
    const entries = await this.sitemapEntries(group);
    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map((e) => `<url><loc>${xml(SITE + e.path)}</loc>${e.updated_at ? `<lastmod>${new Date(e.updated_at).toISOString()}</lastmod>` : ''}</url>`).join('')}</urlset>`;
  }
  async llms() {
    const config = await this.technical();
    if (config?.settings?.llms_txt) return config.settings.llms_txt;
    const rows = await this.db.query(
      `SELECT p.property_type,p.listing_type,COUNT(*) AS total FROM properties p WHERE ${LIVE_PROPERTY} GROUP BY p.property_type,p.listing_type`,
    );
    return `# Majestan Realty\n\n> Real estate listings and services in Coimbatore, Tamil Nadu, India.\n\nContact: +91 90929 65556\nAddress: 47/1 Aandal Street, Lakshmipuram Main Rd, Hope College, Coimbatore 641004.\n\n## Current inventory\n${rows.map((r: any) => `- ${TYPE_LABELS[r.property_type] || r.property_type} for ${r.listing_type === 'Rent' ? 'rent' : 'sale'}: ${r.total} active listings`).join('\n')}\n\n## Useful pages\n- [Projects](${SITE}/projects)\n- [Contact](${SITE}/contact-us)\n- [Sitemap](${SITE}/sitemap.xml)\n`;
  }
}
