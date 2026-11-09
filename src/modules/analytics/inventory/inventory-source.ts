import { DataSource } from 'typeorm';
import {
  InventoryConfiguration,
  InventoryRecord,
  ListingKind,
} from './inventory.types';

type Source = Record<string, unknown>;
const scalar = (v: unknown): string =>
  typeof v === 'string' || typeof v === 'number' ? String(v) : '';
const text = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;
const numeric = (v: unknown): number | null =>
  v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))
    ? Number(v)
    : null;
const date = (v: unknown): string | null => {
  if (!v) return null;
  const d = new Date(v as string);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
};
function json(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}
function object(v: unknown): Source {
  const parsed = json(v);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Source)
    : {};
}
function array(v: unknown): unknown[] {
  const parsed = json(v);
  return Array.isArray(parsed) ? parsed : [];
}
function known(v: unknown): string | null {
  const t = text(v);
  return t && !['unknown', 'unspecified', 'n/a'].includes(t.toLowerCase())
    ? t
    : null;
}
function path(v: unknown): string | null {
  const t = text(v);
  if (!t) return null;
  return '/' + t.replace(/^\/+|\/+$/g, '');
}
function legalFlag(value: unknown): string | null {
  const label = text(value);
  if (!label) return null;
  const normalized = label.toLowerCase();
  return [
    'yes',
    'no',
    'verified',
    'pending',
    'approved',
    'rejected',
    'not verified',
  ].includes(normalized)
    ? normalized
    : 'present, unverified';
}
function configuration(r: Source): InventoryConfiguration {
  return {
    id: Number(r.id),
    code: text(r.unit_code),
    type: scalar(r.unit_type || 'other').toLowerCase(),
    status: scalar(r.status),
    mode: scalar(r.listing_mode),
    bedrooms: numeric(r.bedrooms),
    price: text(scalar(r.price ?? '')),
    rent: text(scalar(r.monthly_rent ?? '')),
    builtup: text(scalar(r.builtup_area_sqft ?? '')),
    carpet: text(scalar(r.carpet_area_sqft ?? '')),
    plot: text(scalar(r.plot_area_sqft ?? '')),
  };
}
async function readInventory(
  db: Pick<DataSource, 'query'>,
): Promise<InventoryRecord[]> {
  // Only reporting fields are selected. Owner contacts, document URLs and legal contents stay in MySQL.
  const [
    properties,
    projects,
    propertyUnits,
    projectUnits,
    locations,
    media,
    files,
    faqs,
    seo,
    wishlists,
  ] = await Promise.all([
    db.query<
      Source[]
    >(`SELECT p.id,p.title,p.property_code,p.slug,p.price,p.monthly_rent,p.price_per_sqft,p.property_type,p.listing_type,p.status,p.approval_status,p.verification_status,p.city,p.builder_name,p.project_id,p.uploaded_by_crm_user_id,p.legacy_source_id,p.legacy_row_no,p.source,DATE_FORMAT(p.created_at,'%Y-%m-%dT%H:%i:%s.%fZ') created_at,DATE_FORMAT(p.updated_at,'%Y-%m-%dT%H:%i:%s.%fZ') updated_at,DATE_FORMAT(p.available_until,'%Y-%m-%dT%H:%i:%s.%fZ') available_until,
      CHAR_LENGTH(TRIM(p.description))>0 has_description,p.ownership_title_verified,p.encumbrance_certificate,p.approvals,
      JSON_EXTRACT(d.curation_details,'$.measurementUnits') measurement_units,d.bedrooms,d.area_sqft,d.area_unit,d.built_up_area,d.carpet_area,d.plot_area,d.furnishing_status,d.floor_number,d.rent_per_seat,d.available_workstations,d.floor_plan_images
      FROM properties p LEFT JOIN property_details d ON d.property_id=p.id WHERE p.id<>999`),
    db.query<
      Source[]
    >(`SELECT id,name,slug,canonical_slug,project_code,project_type,status,city,sublocation,latitude,longitude,builder_id,builder_name,total_units,possession_status,DATE_FORMAT(possession_date,'%Y-%m-%d') possession_date,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%fZ') created_at,DATE_FORMAT(updated_at,'%Y-%m-%dT%H:%i:%s.%fZ') updated_at,
      CHAR_LENGTH(TRIM(description))>0 has_description,cover_image_url,gallery_image_urls,brochure_key,specifications FROM projects`),
    db.query<Source[]>(
      'SELECT id,property_id,unit_code,unit_type,status,listing_mode,bedrooms,price,monthly_rent,builtup_area_sqft,carpet_area_sqft,floor_plan_image_key FROM property_units',
    ),
    db.query<Source[]>(
      'SELECT id,project_id,unit_code,unit_type,status,listing_mode,bedrooms,price,monthly_rent,builtup_area_sqft,carpet_area_sqft,plot_area_sqft,floor_plan_image_key,floor_plans FROM project_units',
    ),
    db.query<Source[]>(
      'SELECT l.property_id,l.latitude,l.longitude,s.locality_name locality,c.city_name location_city FROM property_locations l LEFT JOIN sublocations s ON s.id=l.location_id LEFT JOIN cities c ON c.id=s.city_id',
    ),
    db.query<Source[]>(
      'SELECT property_id,COUNT(*) count FROM property_images GROUP BY property_id',
    ),
    db.query<Source[]>(
      'SELECT property_id,COUNT(*) count FROM property_files GROUP BY property_id',
    ),
    db.query<Source[]>(
      "SELECT 'property' kind,property_id id,COUNT(*) count FROM property_faqs GROUP BY property_id UNION ALL SELECT 'project',project_id,COUNT(*) FROM project_faqs GROUP BY project_id",
    ),
    db.query<Source[]>(
      `SELECT scope kind,COALESCE(property_id,project_id) id,public_path path,settings,meta_title,meta_description,robots_index,robots_follow FROM seo_configs WHERE scope IN ('property','project')`,
    ),
    db.query<Source[]>(
      'SELECT property_id,COUNT(*) count FROM wishlists GROUP BY property_id',
    ),
  ]);
  const count = (rows: Source[], field: string, id: number) =>
    Number(rows.find((r) => Number(r[field]) === id)?.count || 0);
  function build(r: Source, kind: ListingKind): InventoryRecord {
    const id = Number(r.id),
      project = kind === 'project';
    const configs = (project ? projectUnits : propertyUnits).filter(
      (u) => Number(u[project ? 'project_id' : 'property_id']) === id,
    );
    const local = locations.filter((l) => Number(l.property_id) === id);
    const settingsRows = seo.filter(
      (s) => s.kind === kind && Number(s.id) === id,
    );
    const settings = object(settingsRows[0]?.settings);
    const metadata = object(settings.metadata ?? settings);
    const canonical = path(project ? r.canonical_slug : r.slug);
    const aliases = [
      ...settingsRows.map((s) => path(s.path)),
      canonical,
      text(r.slug)
        ? path(
            project
              ? 'projects/' + scalar(r.slug)
              : 'property/' + scalar(r.slug),
          )
        : null,
      ...(project && text(r.city) && text(r.slug)
        ? [
            path(
              'projects/' +
                scalar(r.city).toLowerCase().replace(/\s+/g, '-') +
                '/' +
                scalar(r.slug),
            ),
          ]
        : []),
    ].filter((p): p is string => !!p && !p.endsWith('/null'));
    const approval = project ? null : text(r.approval_status);
    const measurement = object(r.measurement_units);
    const canonicalLand = !!text(measurement.landArea);
    const areaBasis = project
      ? null
      : canonicalLand || r.plot_area
        ? 'plot'
        : r.built_up_area
          ? 'built-up'
          : r.carpet_area
            ? 'carpet'
            : r.area_sqft
              ? 'recorded'
              : null;
    const coordinates = local.find(
      (l) => numeric(l.latitude) !== null && numeric(l.longitude) !== null,
    );
    return {
      key: kind + ':' + id,
      kind,
      id,
      title: scalar(project ? r.name : r.title),
      code: text(project ? r.project_code : r.property_code),
      path: canonical,
      aliases: [
        ...new Set(
          aliases.flatMap((a) => [
            a,
            ...[
              'amenities',
              'floor-plan',
              'locality',
              'photos',
              'faqs',
              'specifications',
              'price',
              'videos',
              'map',
            ].map((section) => a + '/' + section),
          ]),
        ),
      ],
      type: scalar(project ? r.project_type : r.property_type).toLowerCase(),
      mode: project
        ? null
        : r.listing_type === 'Rent'
          ? 'rent'
          : r.listing_type === 'Sale'
            ? 'sale'
            : null,
      status: scalar(r.status),
      approval,
      verification: project ? null : text(r.verification_status),
      visible: project
        ? ['published', 'booked'].includes(scalar(r.status))
        : approval === 'Approved' &&
          ['available', 'sold', 'rented'].includes(scalar(r.status)),
      city: known(r.city),
      localities: [
        ...new Set(
          (project
            ? [known(r.sublocation)]
            : local.map((l) => known(l.locality))
          ).filter((v): v is string => !!v),
        ),
      ],
      latitude: numeric(project ? r.latitude : coordinates?.latitude),
      longitude: numeric(project ? r.longitude : coordinates?.longitude),
      builderId: numeric(r.builder_id),
      builder: known(r.builder_name),
      projectId: numeric(r.project_id),
      uploaderId: numeric(r.uploaded_by_crm_user_id),
      legacy:
        !!r.legacy_source_id ||
        (r.legacy_row_no !== null && r.legacy_row_no !== undefined),
      source: text(r.source),
      created: date(r.created_at),
      updated: date(r.updated_at),
      availableUntil: date(r.available_until),
      price: project ? null : text(scalar(r.price ?? '')),
      rent: project
        ? null
        : text(
            scalar(
              r.monthly_rent ??
                (r.listing_type === 'Rent' && r.property_type !== 'coworking'
                  ? r.price
                  : '') ??
                '',
            ),
          ),
      seatRent: text(scalar(r.rent_per_seat ?? '')),
      seats: numeric(r.available_workstations),
      declaredRate: text(scalar(r.price_per_sqft ?? '')),
      area: project
        ? null
        : text(
            scalar(
              (canonicalLand ? r.area_sqft : r.plot_area) ??
                r.built_up_area ??
                r.carpet_area ??
                r.area_sqft ??
                '',
            ),
          ),
      areaBasis,
      areaUnit:
        canonicalLand ||
        text(
          measurement[
            areaBasis === 'plot'
              ? 'plotArea'
              : areaBasis === 'built-up'
                ? 'builtUpArea'
                : areaBasis === 'carpet'
                  ? 'carpetArea'
                  : 'areaSqft'
          ],
        )
          ? 'Sq Ft'
          : text(r.area_unit),
      bedrooms: numeric(r.bedrooms),
      furnishing: text(r.furnishing_status),
      floor: text(r.floor_number),
      declaredUnits: numeric(r.total_units),
      possession: text(r.possession_status),
      possessionDate: date(r.possession_date),
      description: Boolean(Number(r.has_description)),
      media: project
        ? Number(!!r.cover_image_url) + array(r.gallery_image_urls).length
        : count(media, 'property_id', id),
      cover: project
        ? !!text(r.cover_image_url)
        : count(media, 'property_id', id) > 0,
      gallery: project
        ? array(r.gallery_image_urls).length
        : count(media, 'property_id', id),
      locationConflict:
        !project &&
        !!known(r.city) &&
        local.some(
          (l) =>
            known(l.location_city) &&
            known(l.location_city)!.toLowerCase() !==
              known(r.city)!.toLowerCase(),
        ),
      floorPlans: project
        ? configs.filter(
            (u) => u.floor_plan_image_key || array(u.floor_plans).length,
          ).length
        : array(r.floor_plan_images).length +
          configs.filter((u) => u.floor_plan_image_key).length,
      brochure: !!r.brochure_key,
      faqs: Number(
        faqs.find((f) => f.kind === kind && Number(f.id) === id)?.count || 0,
      ),
      specifications: array(r.specifications).length > 0,
      documents: project
        ? Number(!!r.brochure_key)
        : count(files, 'property_id', id),
      legalFlags: project
        ? {}
        : {
            title: legalFlag(r.ownership_title_verified),
            encumbrance: legalFlag(r.encumbrance_certificate),
            approvals: legalFlag(r.approvals),
          },
      seoTitle: !!text(
        settingsRows[0]?.meta_title ?? metadata.title ?? settings.title,
      ),
      seoDescription: !!text(
        settingsRows[0]?.meta_description ??
          metadata.description ??
          settings.description,
      ),
      indexing: settingsRows.length
        ? (settingsRows[0].robots_index ? 'index' : 'noindex') +
          ',' +
          (settingsRows[0].robots_follow ? 'follow' : 'nofollow')
        : text(metadata.robots ?? settings.robots),
      configurations: configs.map(configuration),
      saves: project ? null : count(wishlists, 'property_id', id),
    };
  }
  return [
    ...properties.map((r) => build(r, 'property')),
    ...projects.map((r) => build(r, 'project')),
  ];
}

export async function loadInventory(
  db: DataSource,
): Promise<InventoryRecord[]> {
  const runner = db.createQueryRunner();
  await runner.connect();
  try {
    await runner.startTransaction('REPEATABLE READ');
    const records = await readInventory({
      query: <T>(sql: string, params?: unknown[]) =>
        runner.query(sql, params) as Promise<T>,
    });
    await runner.commitTransaction();
    return records;
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
}
