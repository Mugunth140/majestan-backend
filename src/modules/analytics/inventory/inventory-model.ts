import { BadRequestException } from '@nestjs/common';
import {
  InventoryChart,
  InventoryConfiguration,
  InventoryFilters,
  InventoryRecord,
  CountRow,
  Metric,
  TrafficRow,
} from './inventory.types';
export const SECTIONS = [
  'overview',
  'properties',
  'projects',
  'pricing',
  'demand',
  'quality',
] as const;
export const ISSUE_LABELS: Record<string, string> = {
  missing_title: 'Missing title',
  missing_type: 'Missing property or project type',
  missing_mode: 'Missing listing mode',
  invalid_price: 'Non-positive or invalid asking price',
  price_outlier: 'Unusual asking price to review',
  missing_description: 'Missing description',
  missing_location: 'Missing city or locality',
  missing_coordinates: 'Missing coordinates',
  missing_price: 'Missing applicable price',
  missing_media: 'Missing gallery or cover',
  missing_cover: 'Missing cover image',
  missing_gallery: 'Missing gallery images',
  location_conflict: 'City and locality association disagree',
  missing_floorplan: 'Missing floor plan',
  missing_brochure: 'Missing brochure',
  pending_approval: 'Pending approval',
  hidden_available: 'Available but hidden',
  expired: 'Availability expired',
  stale: 'Unchanged for over 90 days',
  no_configurations: 'No unit configurations',
  no_available_configurations: 'No available configurations',
  missing_possession: 'Missing possession information',
  overdue_possession: 'Possession date passed',
  missing_seo: 'Missing listing-specific SEO metadata',
  missing_canonical: 'Missing canonical path',
  missing_legal: 'No applicable legal references',
  duplicate_code: 'Repeated listing code',
  duplicate_path: 'Repeated public path',
  similar_candidate: 'Similar inventory to review',
  unsupported_area: 'Unsupported or missing area units',
  rate_conflict: 'Area rate needs review',
  low_exposure: 'Public listing with no tracked views',
};
export function validateInventoryFilters(
  raw: Record<string, unknown>,
): InventoryFilters {
  const allowed = [
    'from',
    'to',
    'kind',
    'city',
    'locality',
    'type',
    'mode',
    'status',
    'approval',
    'visible',
    'builder',
    'project',
    'bedrooms',
    'uploader',
    'provenance',
    'minPrice',
    'maxPrice',
    'areaBasis',
    'asOf',
    'added',
    'activity',
    'recordAge',
    'freshness',
    'furnishing',
    'configurationStatus',
    'bucket',
    'sort',
    'withoutIssue',
    'verification',
    'indexing',
    'possession',
    'configurationType',
    'configurationMode',
    'configurationBedrooms',
    'issue',
    'key',
    'section',
    'page',
    'limit',
  ];
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!allowed.includes(k) || typeof v !== 'string' || v.length > 255)
      throw new BadRequestException('Invalid insights filter');
    if (v) out[k] = v;
  }
  const date = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  if (
    !date(out.from) ||
    !date(out.to) ||
    out.to <= out.from ||
    Date.parse(out.to) - Date.parse(out.from) > 93 * 86400000
  )
    throw new BadRequestException(
      'Choose valid UTC dates, at most 93 days; end is exclusive',
    );
  if (
    (out.asOf && !date(out.asOf)) ||
    (out.kind && !['property', 'project', 'all'].includes(out.kind)) ||
    (out.mode && !['sale', 'rent', 'seat'].includes(out.mode)) ||
    (out.visible && !['true', 'false'].includes(out.visible)) ||
    (out.provenance &&
      !['import', 'new', 'unattributed'].includes(out.provenance)) ||
    (out.section &&
      !SECTIONS.includes(out.section as (typeof SECTIONS)[number])) ||
    (out.issue && out.issue !== 'attention' && !ISSUE_LABELS[out.issue]) ||
    (out.withoutIssue && !ISSUE_LABELS[out.withoutIssue]) ||
    (out.sort &&
      ![
        'title',
        'views',
        'enquiries',
        'engagement',
        'price',
        'updated',
        'created',
        'possession',
      ].includes(out.sort)) ||
    (out.added && out.added !== 'true') ||
    (out.activity &&
      !['views', 'enquiries', 'visits'].includes(out.activity)) ||
    [out.recordAge, out.freshness].some(
      (v) =>
        v &&
        ![
          '0–30 days',
          '31–60 days',
          '61–90 days',
          'Over 90 days',
          'Unknown',
        ].includes(v),
    )
  )
    throw new BadRequestException('Invalid insights filter');
  for (const k of ['page', 'limit', 'bedrooms', 'uploader', 'project'])
    if (
      out[k] &&
      !(k === 'bedrooms' && out[k] === '__missing__') &&
      (!/^\d+$/.test(out[k]) ||
        !Number.isSafeInteger(Number(out[k])) ||
        Number(out[k]) < (k === 'bedrooms' ? 0 : 1))
    )
      throw new BadRequestException('Invalid numeric filter');
  for (const k of ['minPrice', 'maxPrice'])
    if (
      out[k] &&
      (!/^\d+(\.\d{1,2})?$/.test(out[k]) ||
        !Number.isSafeInteger(Math.round(Number(out[k]) * 100)))
    )
      throw new BadRequestException('Invalid price');
  if (
    out.minPrice &&
    out.maxPrice &&
    Number(out.minPrice) > Number(out.maxPrice)
  )
    throw new BadRequestException('Minimum exceeds maximum price');
  if (out.section === 'properties') out.kind = 'property';
  if (out.section === 'projects') out.kind = 'project';
  return out as unknown as InventoryFilters;
}
export function paise(value: string | null): number | null {
  if (!value || !/^\d+(\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const n = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
  return n > 0n && n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : null;
}
export function asking(record: InventoryRecord, mode?: string): number | null {
  const selected =
    mode ||
    (record.type === 'coworking' && record.seatRent ? 'seat' : record.mode);
  if (record.kind === 'project') {
    const prices = record.configurations
      .filter(
        (c) => c.status === 'available' && (!selected || c.mode === selected),
      )
      .map((c) => paise((selected || c.mode) === 'rent' ? c.rent : c.price))
      .filter((n): n is number => n !== null);
    return prices.length ? Math.min(...prices) : null;
  }
  return paise(
    selected === 'seat'
      ? record.seatRent
      : selected === 'rent'
        ? record.rent
        : record.price,
  );
}
export function areaSqft(record: InventoryRecord): number | null {
  const factors: Record<string, number> = {
    'sq ft': 1,
    'sq.ft': 1,
    sqft: 1,
    'sq m': 1 / 0.3048 ** 2,
    sqm: 1 / 0.3048 ** 2,
    cents: 435.6,
    cent: 435.6,
    acres: 43560,
    acre: 43560,
    grounds: 2400,
  };
  // Explicit built-up/carpet columns are already sqft. Generic and plot values require declared units.
  const factor = ['built-up', 'carpet'].includes(record.areaBasis || '')
    ? 1
    : factors[(record.areaUnit || '').toLowerCase()];
  const n = Number(record.area);
  return factor && n > 0 && Number.isFinite(n) ? n * factor : null;
}
export function issues(
  record: InventoryRecord,
  now: number,
  traffic?: TrafficRow,
): string[] {
  const out: string[] = [];
  const add = (rule: string, condition: boolean) => {
    if (condition) out.push(rule);
  };
  add('missing_title', !record.title.trim());
  add('missing_type', !record.type);
  add('missing_mode', record.kind === 'property' && !record.mode);
  add(
    'invalid_price',
    record.kind === 'property' &&
      !!(record.mode === 'rent' ? record.rent : record.price) &&
      asking(record) === null,
  );
  add('missing_description', !record.description);
  add('missing_location', !record.city || !record.localities.length);
  add(
    'missing_coordinates',
    record.latitude === null || record.longitude === null,
  );
  add('missing_price', asking(record) === null);
  add('missing_media', record.media === 0);
  add('missing_cover', record.cover === false);
  add('missing_gallery', record.gallery === 0);
  add('location_conflict', record.locationConflict === true);
  add('missing_canonical', !record.path);
  add('missing_seo', !record.seoTitle || !record.seoDescription);
  add(
    'pending_approval',
    record.kind === 'property' && record.approval !== 'Approved',
  );
  add(
    'hidden_available',
    record.kind === 'property' &&
      record.status === 'available' &&
      !record.visible,
  );
  add(
    'expired',
    !!record.availableUntil && Date.parse(record.availableUntil) < now,
  );
  add(
    'stale',
    !!record.updated && now - Date.parse(record.updated) > 90 * 86400000,
  );
  add(
    'missing_floorplan',
    ['apartment', 'villa', 'individual_portion'].includes(record.type) &&
      !record.floorPlans,
  );
  add(
    'missing_legal',
    record.kind === 'property' &&
      ['plot', 'farmland', 'villa', 'apartment', 'individual_portion'].includes(
        record.type,
      ) &&
      !record.documents &&
      !Object.values(record.legalFlags).some(
        (v) =>
          v && !['no', 'pending', 'not verified'].includes(v.toLowerCase()),
      ),
  );
  add(
    'unsupported_area',
    record.kind === 'property' && !!record.area && areaSqft(record) === null,
  );
  const rate = paise(record.declaredRate),
    price = asking(record),
    area = areaSqft(record);
  add(
    'rate_conflict',
    record.mode === 'sale' &&
      rate !== null &&
      price !== null &&
      area !== null &&
      Math.abs(rate - price / area) / (price / area) > 0.1,
  );
  if (record.kind === 'project') {
    add('no_configurations', !record.configurations.length);
    add(
      'no_available_configurations',
      !record.configurations.some((c) => c.status === 'available'),
    );
    add('missing_brochure', !record.brochure);
    add('missing_possession', !record.possession);
    add(
      'overdue_possession',
      !!record.possessionDate &&
        Date.parse(record.possessionDate) < now &&
        !['ready_to_move'].includes(record.possession || ''),
    );
  }
  if (traffic !== undefined)
    add('low_exposure', record.visible && traffic.views === 0);
  return out;
}
function ageBand(value: string | null, now: number): string {
  if (!value) return 'Unknown';
  const days = Math.max(0, (now - Date.parse(value)) / 86400000);
  return days <= 30
    ? '0–30 days'
    : days <= 60
      ? '31–60 days'
      : days <= 90
        ? '61–90 days'
        : 'Over 90 days';
}
export function issueIndex(
  records: InventoryRecord[],
  now: number,
  traffic: Map<string, TrafficRow>,
): Map<string, string[]> {
  const result = new Map(
    records.map((r) => [r.key, issues(r, now, traffic.get(r.key))]),
  );
  for (const [field, code] of [
    ['code', 'duplicate_code'],
    ['path', 'duplicate_path'],
  ] as const) {
    const groups = new Map<string, string[]>();
    for (const r of records) {
      const v = r[field]?.toLowerCase();
      if (v) groups.set(v, [...(groups.get(v) || []), r.key]);
    }
    for (const keys of groups.values())
      if (keys.length > 1) keys.forEach((k) => result.get(k)!.push(code));
  }
  const candidates = new Map<string, string[]>();
  for (const r of records) {
    if (!r.city || !r.title.trim()) continue;
    const fingerprint = [
      r.kind,
      r.type,
      r.city.toLowerCase(),
      r.title.toLowerCase().replace(/\W+/g, ''),
      r.price || '',
      r.area || '',
    ].join(':');
    candidates.set(fingerprint, [
      ...(candidates.get(fingerprint) || []),
      r.key,
    ]);
  }
  for (const keys of candidates.values())
    if (keys.length > 1)
      keys.forEach((k) => result.get(k)!.push('similar_candidate'));
  const pricingGroups = new Map<string, InventoryRecord[]>();
  for (const r of records) {
    if (asking(r) === null) continue;
    const group = [
      r.kind,
      r.type,
      r.mode,
      r.type === 'coworking' && r.seatRent ? 'seat' : 'total',
    ].join(':');
    pricingGroups.set(group, [...(pricingGroups.get(group) || []), r]);
  }
  for (const rows of pricingGroups.values()) {
    if (rows.length < 5) continue;
    const values = rows.map((r) => asking(r)!);
    const q1 = quantile(values, 0.25),
      q3 = quantile(values, 0.75),
      spread = q3 - q1;
    if (spread > 0)
      for (const r of rows) {
        const v = asking(r)!;
        if (v < q1 - 1.5 * spread || v > q3 + 1.5 * spread)
          result.get(r.key)!.push('price_outlier');
      }
  }
  return result;
}
export function configurationMatches(
  c: InventoryConfiguration,
  f: InventoryFilters,
) {
  return (
    (!f.configurationStatus || c.status === f.configurationStatus) &&
    (!f.configurationType || c.type === f.configurationType) &&
    (!f.configurationMode || c.mode === f.configurationMode) &&
    (!f.configurationBedrooms ||
      (f.configurationBedrooms === '__missing__'
        ? c.bedrooms === null
        : String(c.bedrooms) === f.configurationBedrooms)) &&
    (!f.mode || c.mode === f.mode) &&
    (!f.bedrooms ||
      (f.bedrooms === '__missing__'
        ? c.bedrooms === null
        : String(c.bedrooms) === f.bedrooms))
  );
}
export function filterInventory(
  records: InventoryRecord[],
  f: InventoryFilters,
  index: Map<string, string[]>,
  traffic: Map<string, TrafficRow> = new Map(),
): InventoryRecord[] {
  let matches = records.filter((r) => {
    if (
      f.added === 'true' &&
      (!r.created ||
        r.created.slice(0, 10) < f.from ||
        r.created.slice(0, 10) >= f.to)
    )
      return false;
    if (
      (f.activity === 'views' && !traffic.get(r.key)?.views) ||
      (f.activity === 'enquiries' && !traffic.get(r.key)?.enquiries) ||
      (f.activity === 'visits' && !traffic.get(r.key)?.visits)
    )
      return false;
    if (
      (f.furnishing &&
        (f.furnishing === '__missing__'
          ? !!r.furnishing
          : r.furnishing !== f.furnishing)) ||
      (f.configurationStatus &&
        !r.configurations.some((c) => c.status === f.configurationStatus))
    )
      return false;
    const at = f.asOf ? Date.parse(f.asOf) + 86400000 : Date.now();
    if (
      (f.recordAge && ageBand(r.created, at) !== f.recordAge) ||
      (f.freshness && ageBand(r.updated, at) !== f.freshness)
    )
      return false;

    if (
      f.bedrooms &&
      r.kind === 'property' &&
      ![
        'apartment',
        'villa',
        'individual_portion',
        'farm_house',
        'investment_property',
      ].includes(r.type)
    )
      return false;
    if (f.withoutIssue && index.get(r.key)?.includes(f.withoutIssue))
      return false;
    for (const field of ['verification', 'indexing', 'possession'] as const) {
      if (
        f[field] &&
        (f[field] === '__missing__' ? !!r[field] : r[field] !== f[field])
      )
        return false;
    }
    if (
      r.kind === 'project' &&
      (f.mode ||
        f.bedrooms ||
        f.configurationStatus ||
        f.configurationType ||
        f.configurationMode ||
        f.configurationBedrooms) &&
      !r.configurations.some((c) => configurationMatches(c, f))
    )
      return false;
    if (
      (f.kind && f.kind !== 'all' && r.kind !== f.kind) ||
      (f.key && r.key !== f.key) ||
      (f.city && (f.city === '__missing__' ? !!r.city : r.city !== f.city)) ||
      (f.locality &&
        (f.locality === '__missing__'
          ? !!r.localities.length
          : r.localities[0] !== f.locality)) ||
      (f.type && r.type !== f.type) ||
      (f.status && r.status !== f.status) ||
      (f.approval && r.approval !== f.approval) ||
      (f.visible && String(r.visible) !== f.visible) ||
      (f.builder &&
        (f.builder === '__missing__'
          ? !!(r.builderId || r.builder)
          : (r.builderId ? 'id:' + r.builderId : 'name:' + r.builder) !==
            f.builder)) ||
      (f.project &&
        r.projectId !== Number(f.project) &&
        !(r.kind === 'project' && r.id === Number(f.project))) ||
      (f.bedrooms &&
        (f.bedrooms === '__missing__'
          ? r.bedrooms !== null
          : r.bedrooms !== Number(f.bedrooms)) &&
        !r.configurations.some((c) => c.bedrooms === Number(f.bedrooms))) ||
      (f.uploader && r.uploaderId !== Number(f.uploader)) ||
      (f.areaBasis && r.areaBasis !== f.areaBasis) ||
      (f.issue &&
        (f.issue === 'attention'
          ? !index.get(r.key)?.length
          : !index.get(r.key)?.includes(f.issue)))
    )
      return false;
    if (
      (f.provenance === 'import' && !r.legacy) ||
      (f.provenance === 'new' && r.legacy) ||
      (f.provenance === 'unattributed' && (!!r.uploaderId || r.legacy))
    )
      return false;
    if (
      (f.mode &&
        r.kind === 'property' &&
        (f.mode === 'seat'
          ? r.type !== 'coworking' || r.mode !== 'rent'
          : r.mode !== f.mode)) ||
      (f.mode &&
        r.kind === 'project' &&
        !r.configurations.some((c) => c.mode === f.mode))
    )
      return false;
    const price = asking(r, f.mode);
    if (
      (f.minPrice && (price === null || price < Number(f.minPrice) * 100)) ||
      (f.maxPrice && (price === null || price > Number(f.maxPrice) * 100))
    )
      return false;
    return true;
  });
  if (
    f.mode ||
    f.bedrooms ||
    f.configurationStatus ||
    f.configurationType ||
    f.configurationMode ||
    f.configurationBedrooms
  )
    matches = matches.map((r) =>
      r.kind === 'project'
        ? {
            ...r,
            configurations: r.configurations.filter((c) =>
              configurationMatches(c, f),
            ),
          }
        : r,
    );
  if (f.sort)
    matches.sort((a, b) => {
      const field = f.sort!;
      if (field === 'title') return a.title.localeCompare(b.title);
      if (field === 'possession')
        return (
          (a.possessionDate ? Date.parse(a.possessionDate) : Infinity) -
          (b.possessionDate ? Date.parse(b.possessionDate) : Infinity)
        );
      if (['views', 'enquiries', 'engagement'].includes(field))
        return (
          (traffic.get(b.key)?.[field as 'views'] || 0) -
          (traffic.get(a.key)?.[field as 'views'] || 0)
        );
      if (field === 'price')
        return (asking(b, f.mode) || 0) - (asking(a, f.mode) || 0);
      return (
        Date.parse(b[field as 'updated'] || '1970-01-01') -
        Date.parse(a[field as 'updated'] || '1970-01-01')
      );
    });
  if (f.bucket) {
    if (!['city_other', 'type_other', 'locality_other'].includes(f.bucket))
      throw new BadRequestException('Invalid ranked bucket');
    const label = (r: InventoryRecord) =>
      f.bucket === 'city_other'
        ? r.city || 'Unknown'
        : f.bucket === 'locality_other'
          ? r.localities[0] || 'Unknown'
          : r.type;
    const counts = new Map<string, number>();
    matches.forEach((r) =>
      counts.set(label(r), (counts.get(label(r)) || 0) + 1),
    );
    const top = new Set(
      [...counts]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 10)
        .map(([key]) => key),
    );
    return matches.filter((r) => !top.has(label(r)));
  }
  return matches;
}
const sum = (rows: InventoryRecord[], value: (r: InventoryRecord) => number) =>
  rows.reduce((s, r) => s + value(r), 0);
function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const i = (sorted.length - 1) * q;
  return (
    sorted[Math.floor(i)] +
    (sorted[Math.ceil(i)] - sorted[Math.floor(i)]) * (i % 1)
  );
}
export function sectionReport(
  records: InventoryRecord[],
  f: InventoryFilters,
  index: Map<string, string[]>,
  traffic: Map<string, TrafficRow>,
  daily: TrafficRow[],
  now: number,
  enquiries: {
    key: string;
    day: string;
    enquiries: number;
    visits: number;
  }[] = [],
) {
  const selected = filterInventory(records, f, index, traffic);
  const props = selected.filter((r) => r.kind === 'property'),
    projects = selected.filter((r) => r.kind === 'project');
  const metrics: Metric[] = [],
    charts: InventoryChart[] = [];
  const metric = (
    key: string,
    label: string,
    value: number | null,
    match?: Partial<InventoryFilters>,
    unit?: string,
  ) => metrics.push({ key, label, value, match, unit });
  const grouped = (
    value: (r: InventoryRecord) => string,
    field?: keyof InventoryFilters,
    limit = true,
  ): CountRow[] => {
    const counts = new Map<string, number>();
    for (const r of selected) {
      const label = value(r) || 'Unknown';
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    const rows = [...counts]
      .map(([label, value]) => ({
        label,
        value,
        ...(field
          ? {
              match: {
                [field]:
                  label === 'Unknown' &&
                  [
                    'city',
                    'locality',
                    'furnishing',
                    'verification',
                    'indexing',
                    'possession',
                  ].includes(field)
                    ? '__missing__'
                    : label,
              },
            }
          : {}),
      }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
    if (!limit || rows.length <= 10) return rows;
    return [
      ...rows.slice(0, 10),
      {
        label: 'Other',
        ...(field && ['city', 'type', 'locality'].includes(field)
          ? { match: { bucket: field + '_other' } }
          : {}),
        value: rows.slice(10).reduce((s, r) => s + r.value, 0),
      },
    ];
  };
  const chart = (
    key: string,
    title: string,
    type: InventoryChart['type'],
    rows: InventoryChart['rows'],
    note?: string,
    unit?: string,
  ) => charts.push({ key, title, type, rows, note, unit });
  const bar = (key: string, title: string, rows: CountRow[]) =>
    chart(
      key,
      title,
      'bar',
      rows.map((r) => ({ ...r })),
    );
  const issueCounts = Object.entries(ISSUE_LABELS)
    .map(([key, label]) => ({
      key,
      label,
      value: selected.filter((r) => index.get(r.key)?.includes(key)).length,
      match: { issue: key },
    }))
    .filter((r) => r.value > 0);
  const targets = new Set(selected.map((r) => r.key));
  const trafficRows = selected.map((r) => ({
    ...traffic.get(r.key),
    key: r.key,
    views: traffic.get(r.key)?.views || 0,
  }));
  const selectedDaily = daily.filter((r) => targets.has(r.key));
  const times = new Map<
    string,
    {
      label: string;
      value: number;
      series: string;
      match?: Partial<InventoryFilters>;
    }
  >();
  for (let t = Date.parse(f.from); t < Date.parse(f.to); t += 86400000)
    for (const kind of ['property', 'project']) {
      const day = new Date(t).toISOString().slice(0, 10);
      times.set(kind + day, {
        label: day,
        series: kind,
        value: 0,
        match: {
          from: day,
          to: new Date(t + 86400000).toISOString().slice(0, 10),
          kind,
          activity: 'views',
        },
      });
    }
  for (const r of selectedDaily) {
    const kind = r.key.split(':')[0];
    const target = times.get(kind + r.day);
    if (target) target.value += r.views;
  }
  const section = f.section || 'overview';
  if (section === 'overview') {
    metric('properties', 'Current properties', props.length, {
      kind: 'property',
    });
    metric('projects', 'Current projects', projects.length, {
      kind: 'project',
    });
    metric(
      'visible_properties',
      'Public properties',
      props.filter((r) => r.visible).length,
      { kind: 'property', visible: 'true' },
    );
    metric(
      'visible_projects',
      'Public projects',
      projects.filter((r) => r.visible).length,
      { kind: 'project', visible: 'true' },
    );
    metric(
      'cities',
      'Known cities',
      new Set(selected.map((r) => r.city).filter(Boolean)).size,
    );
    metric(
      'attention',
      'Listings needing attention',
      selected.filter((r) => index.get(r.key)?.length).length,
      { issue: 'attention' },
    );
    const additions: InventoryChart['rows'] = [];
    for (let t = Date.parse(f.from); t < Date.parse(f.to); t += 86400000) {
      const day = new Date(t).toISOString().slice(0, 10);
      for (const legacy of [false, true])
        additions.push({
          label: day,
          series: legacy ? 'Legacy import' : 'New record',
          match: {
            added: 'true',
            from: day,
            to: new Date(t + 86400000).toISOString().slice(0, 10),
            provenance: legacy ? 'import' : 'new',
          },
          value: selected.filter(
            (r) => r.created?.slice(0, 10) === day && r.legacy === legacy,
          ).length,
        });
    }
    chart(
      'additions',
      'New records and legacy imports',
      'stack',
      additions,
      'Creation timestamps describe ingestion, not first publication.',
    );
    bar(
      'types',
      'Inventory composition',
      grouped((r) => r.type, 'type'),
    );
    bar(
      'cities',
      'Inventory by city',
      grouped((r) => r.city || 'Unknown', 'city'),
    );
    bar('attention', 'Attention by issue', issueCounts);
  }
  if (section === 'properties') {
    metric('properties', 'Properties', props.length);
    metric(
      'available',
      'Available',
      props.filter((r) => r.status === 'available').length,
      { status: 'available' },
    );
    metric(
      'pending',
      'Approval pending',
      props.filter((r) => r.approval !== 'Approved').length,
      { issue: 'pending_approval' },
    );
    metric(
      'visible',
      'Publicly visible',
      props.filter((r) => r.visible).length,
      { visible: 'true' },
    );
    const statusRows: InventoryChart['rows'] = [];
    for (const type of new Set(props.map((r) => r.type)))
      for (const status of new Set(props.map((r) => r.status)))
        statusRows.push({
          label: type,
          series: status,
          value: props.filter((r) => r.type === type && r.status === status)
            .length,
          match: { type, status },
        });
    chart('availability', 'Availability by property type', 'stack', statusRows);
    chart(
      'approval',
      'Approval and visibility',
      'heatmap',
      props
        .map((r) => ({
          label: r.approval || 'Unknown',
          series: r.status + ' · ' + (r.visible ? 'Public' : 'Hidden'),
          value: 1,
          match: {
            approval: r.approval || '',
            status: r.status,
            visible: String(r.visible),
          },
        }))
        .reduce<InventoryChart['rows']>((rows, r) => {
          const existing = rows.find(
            (v) => v.label === r.label && v.series === r.series,
          );
          if (existing) existing.value = Number(existing.value) + 1;
          else rows.push(r);
          return rows;
        }, []),
    );
    bar(
      'locations',
      f.city ? 'Inventory by locality' : 'Inventory by city',
      grouped(
        (r) => (f.city ? r.localities[0] || 'Unknown' : r.city || 'Unknown'),
        f.city ? 'locality' : 'city',
      ),
    );
    bar(
      'intent',
      'Sale and rent',
      grouped((r) => r.mode || 'Unknown', 'mode', false),
    );
    const residential = props.filter((r) =>
      [
        'apartment',
        'villa',
        'individual_portion',
        'farm_house',
        'investment_property',
      ].includes(r.type),
    );
    bar(
      'bhk',
      'Residential BHK mix',
      [...new Set(residential.map((r) => r.bedrooms))].map((n) => ({
        label: n === null ? 'Unknown' : n === 0 ? 'Studio' : n + ' BHK',
        value: residential.filter((r) => r.bedrooms === n).length,
        match: { bedrooms: n === null ? '__missing__' : String(n) },
      })),
    );
    bar(
      'furnishing',
      'Furnishing',
      grouped((r) => r.furnishing || 'Unknown', 'furnishing', false),
    );
    bar(
      'age',
      'Record age',
      grouped((r) => ageBand(r.created, now), 'recordAge', false),
    );
    bar(
      'freshness',
      'Time since last edit',
      grouped((r) => ageBand(r.updated, now), 'freshness', false),
    );
    bar(
      'uploaders',
      'Recorded uploader',
      grouped((r) =>
        r.legacy
          ? 'Legacy import'
          : r.uploaderId
            ? 'Staff #' + r.uploaderId
            : 'Unattributed',
      ).map((row) => ({
        ...row,
        match:
          row.label === 'Legacy import'
            ? { provenance: 'import' }
            : row.label === 'Unattributed'
              ? { provenance: 'unattributed' }
              : { uploader: row.label.replace('Staff #', '') },
      })),
    );
    if (f.type && f.areaBasis) {
      const areas = props
        .filter((r) => r.areaBasis === f.areaBasis)
        .map((r) => ({ r, n: areaSqft(r) }))
        .filter((v) => v.n !== null);
      chart(
        'area',
        'Comparable area distribution',
        'histogram',
        histogram(
          areas.map((v) => v.n!),
          false,
        ),
        'Only normalized sqft with the selected area basis are included.',
        'sqft',
      );
    }
    bar(
      'capacity',
      'Coworking seat capacity',
      props
        .filter((r) => r.type === 'coworking' && r.seats !== null)
        .map((r) => ({
          label: r.title,
          value: r.seats!,
          match: { key: r.key },
        })),
    );
  }
  if (section === 'projects') {
    metric('projects', 'Projects', projects.length);
    metric(
      'declared',
      'Declared units',
      projects.some((r) => r.declaredUnits !== null)
        ? sum(projects, (r) => r.declaredUnits || 0)
        : null,
    );
    metric(
      'configurations',
      'Unit configurations',
      sum(projects, (r) => r.configurations.length),
    );
    metric(
      'available_configurations',
      'Available configurations',
      sum(
        projects,
        (r) => r.configurations.filter((c) => c.status === 'available').length,
      ),
    );
    bar(
      'publication',
      'Project publication status',
      grouped((r) => r.status, 'status', false),
    );
    const configurations: InventoryChart['rows'] = [];
    for (const r of projects)
      for (const status of new Set(r.configurations.map((c) => c.status)))
        configurations.push({
          label: r.title,
          series: status,
          value: r.configurations.filter((c) => c.status === status).length,
          match: { key: r.key, configurationStatus: status },
        });
    chart(
      'configuration_status',
      'Configuration availability by project',
      'stack',
      configurations,
    );
    bar(
      'builders',
      'Builder portfolio',
      grouped(
        (r) =>
          r.builderId
            ? 'id:' + r.builderId
            : r.builder
              ? 'name:' + r.builder
              : 'Unknown',
        undefined,
        false,
      ).map((row) => ({
        ...row,
        label: row.label.startsWith('id:')
          ? selected.find((r) => r.builderId === Number(row.label.slice(3)))
              ?.builder || 'Builder #' + row.label.slice(3)
          : row.label.startsWith('name:')
            ? 'Unlinked · ' + row.label.slice(5)
            : 'Unknown',
        match: { builder: row.label === 'Unknown' ? '__missing__' : row.label },
      })),
    );
    bar(
      'possession',
      'Possession readiness',
      grouped((r) => r.possession || 'Unknown', 'possession', false),
    );
    const mix = new Map<
      string,
      { value: number; match: Partial<InventoryFilters> }
    >();
    projects.forEach((r) =>
      r.configurations.forEach((c) => {
        const label = [
          c.type,
          c.bedrooms === null ? 'BHK unknown' : c.bedrooms + ' BHK',
          c.mode,
        ].join(' · ');
        const old = mix.get(label);
        mix.set(label, {
          value: (old?.value || 0) + 1,
          match: {
            configurationType: c.type,
            configurationMode: c.mode,
            configurationBedrooms:
              c.bedrooms === null ? '__missing__' : String(c.bedrooms),
          },
        });
      }),
    );
    bar(
      'configuration_mix',
      'Configuration types and BHK',
      [...mix].map(([label, row]) => ({ label, ...row })),
    );
    const ranges = projects
      .map((r) => {
        const values = r.configurations
          .filter(
            (c) => c.status === 'available' && c.mode === (f.mode || 'sale'),
          )
          .map((c) => paise(f.mode === 'rent' ? c.rent : c.price))
          .filter((n): n is number => n !== null);
        return {
          label: r.title,
          low: values.length ? Math.min(...values) / 100 : null,
          high: values.length ? Math.max(...values) / 100 : null,
          match: { key: r.key },
        };
      })
      .filter((r) => r.low !== null);
    chart(
      'price_range',
      'Available configuration asking ranges',
      'range',
      ranges,
      undefined,
      'INR',
    );
    chart(
      'readiness',
      'Project readiness',
      'heatmap',
      projects.flatMap((r) =>
        Object.entries({
          Location: !!r.city && r.localities.length > 0,
          Cover: r.cover,
          Gallery: r.gallery === undefined ? null : r.gallery > 0,
          Brochure: r.brochure,
          Specifications: r.specifications,
          Configurations: r.configurations.length > 0,
          FAQs: r.faqs > 0,
        }).map(([series, ready]) => ({
          label: r.title,
          series,
          value: ready == null ? null : ready ? 1 : 0,
          match: { key: r.key },
        })),
      ),
    );
  }
  if (section === 'pricing') {
    if (!f.mode || !f.type)
      return {
        metrics,
        charts,
        records: selected,
        issueCounts,
        selectionRequired:
          'Choose a listing mode and property/project type for comparable pricing.',
      };
    const priced = selected
      .map((r) => ({ r, price: asking(r, f.mode) }))
      .filter(
        (v): v is { r: InventoryRecord; price: number } => v.price !== null,
      );
    metric('priced', 'Records with asking prices', priced.length);
    metric('missing', 'Missing asking price', selected.length - priced.length, {
      issue: 'missing_price',
    });
    metric(
      'median',
      f.mode === 'rent'
        ? 'Median monthly rent'
        : f.mode === 'seat'
          ? 'Median rent per seat'
          : 'Median asking price',
      priced.length
        ? quantile(
            priced.map((v) => v.price),
            0.5,
          ) / 100
        : null,
      undefined,
      'INR',
    );
    metric('sample', 'Comparable samples', priced.length);
    chart(
      'price_distribution',
      f.mode === 'rent'
        ? 'Monthly rent distribution'
        : f.mode === 'seat'
          ? 'Monthly rent per seat'
          : 'Asking-price distribution',
      'histogram',
      histogram(
        priced.map((v) => v.price),
        true,
      ),
      undefined,
      'INR',
    );
    if (priced.length >= 5) {
      const values = priced.map((v) => v.price / 100);
      chart(
        'spread',
        'Median and quartile spread',
        'box',
        priced.map((v) => ({
          label: f.type!,
          value: v.price / 100,
          match: { key: v.r.key },
        })),
        values.length + ' comparable records',
        'INR',
      );
    }
    const localities = new Map<string, number[]>();
    priced.forEach((v) => {
      const key = v.r.localities[0] || v.r.city || 'Unknown';
      localities.set(key, [...(localities.get(key) || []), v.price]);
    });
    bar(
      'locality_price',
      'Median asking price by locality',
      [...localities]
        .map(([label, values]) => ({
          label,
          value: quantile(values, 0.5) / 100,
        }))
        .sort((a, b) => b.value - a.value),
    );
    if (f.areaBasis && f.mode !== 'seat') {
      const comparable = priced.filter(
        (v) => v.r.areaBasis === f.areaBasis && areaSqft(v.r) !== null,
      );
      chart(
        'price_area',
        'Asking price and comparable area',
        'scatter',
        comparable.map((v) => ({
          label: v.r.title,
          x: areaSqft(v.r)!,
          y: v.price / 100,
          match: { key: v.r.key },
        })),
        'Area is normalized to sqft; price uses the selected listing mode.',
      );
      chart(
        'area_rate',
        'Asking rate per sqft',
        'scatter',
        comparable.map((v) => ({
          label: v.r.title,
          x: areaSqft(v.r)!,
          y: Math.round(v.price / areaSqft(v.r)!) / 100,
          match: { key: v.r.key },
        })),
        undefined,
        'INR / sqft',
      );
    }
    bar(
      'pricing_issues',
      'Pricing exceptions',
      issueCounts.filter((r) =>
        [
          'missing_price',
          'invalid_price',
          'price_outlier',
          'unsupported_area',
          'rate_conflict',
        ].includes(r.key),
      ),
    );
  }
  if (section === 'demand') {
    metric(
      'views',
      'Detail-page views',
      trafficRows.reduce((s, r) => s + r.views, 0),
    );
    metric(
      'enquiries',
      'Accepted enquiries',
      sum(selected, (r) => traffic.get(r.key)?.enquiries || 0),
    );
    metric(
      'visits',
      'Site-visit requests',
      sum(selected, (r) => traffic.get(r.key)?.visits || 0),
    );
    const sessions = sum(selected, (r) => traffic.get(r.key)?.sessions || 0);
    metric(
      'rate',
      'Attributed enquiry session rate',
      sessions
        ? (sum(
            selected,
            (r) => traffic.get(r.key)?.linkedEnquirySessions || 0,
          ) /
            sessions) *
            100
        : null,
      undefined,
      '%',
    );
    metric(
      'visitor_days',
      'Listing visitor-days',
      sum(selected, (r) => traffic.get(r.key)?.visitors || 0),
    );
    metric('sessions', 'Listing sessions', sessions);
    const views = trafficRows.reduce((s, r) => s + r.views, 0);
    metric(
      'engagement',
      'Average active time',
      views
        ? sum(
            selected,
            (r) =>
              (traffic.get(r.key)?.engagement || 0) *
              (traffic.get(r.key)?.views || 0),
          ) /
            views /
            1000
        : null,
      undefined,
      'seconds',
    );
    metric(
      'scroll',
      'Average scroll depth',
      views
        ? sum(
            selected,
            (r) =>
              (traffic.get(r.key)?.scroll || 0) *
              (traffic.get(r.key)?.views || 0),
          ) / views
        : null,
      undefined,
      '%',
    );
    chart('views', 'Daily listing views', 'line', [...times.values()]);
    const accepted: InventoryChart['rows'] = [];
    for (let t = Date.parse(f.from); t < Date.parse(f.to); t += 86400000) {
      const day = new Date(t).toISOString().slice(0, 10);
      for (const intent of ['enquiries', 'visits'] as const)
        accepted.push({
          label: day,
          series: intent === 'visits' ? 'Visit requests' : 'Accepted enquiries',
          value: enquiries
            .filter((r) => targets.has(r.key) && r.day === day)
            .reduce((s, r) => s + r[intent], 0),
          match: {
            from: day,
            to: new Date(t + 86400000).toISOString().slice(0, 10),
            activity: intent,
          },
        });
    }
    chart(
      'accepted',
      'Accepted enquiries and visit requests',
      'area',
      accepted,
    );
    chart(
      'wishlist_activity',
      'Tracked wishlist activity',
      'stack',
      props
        .flatMap((r) => [
          {
            label: r.title,
            series: 'Saves',
            value: traffic.get(r.key)?.wishlistAdds || 0,
            match: { key: r.key },
          },
          {
            label: r.title,
            series: 'Removes',
            value: traffic.get(r.key)?.wishlistRemoves || 0,
            match: { key: r.key },
          },
        ])
        .filter((r) => r.value > 0),
    );
    bar(
      'views_rank',
      'Most viewed listings',
      selected
        .map((r) => ({
          label: r.title,
          value: traffic.get(r.key)?.views || 0,
          match: { key: r.key },
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    );
    chart(
      'intent',
      'Contact intent',
      'stack',
      selected
        .map((r) => ({ r, t: traffic.get(r.key) }))
        .flatMap(({ r, t }) =>
          ['phone', 'whatsapp', 'email'].map((series) => ({
            label: r.title,
            series,
            value: t?.[series as 'phone'] || 0,
            match: { key: r.key },
          })),
        )
        .filter((r) => r.value > 0),
    );
    chart(
      'engagement',
      'Traffic and active engagement',
      'scatter',
      selected
        .map((r) => ({
          label: r.title,
          x: traffic.get(r.key)?.views || 0,
          y: (traffic.get(r.key)?.engagement || 0) / 1000,
          match: { key: r.key },
        }))
        .filter((r) => r.x > 0),
    );
    bar(
      'saves',
      'Current property wishlist saves',
      props
        .filter((r) => r.saves !== null)
        .map((r) => ({
          label: r.title,
          value: r.saves!,
          match: { key: r.key },
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    );
    const supply = grouped((r) => r.type, 'type');
    const totalSupply = selected.filter((r) => r.visible).length,
      totalViews = trafficRows.reduce((s, r) => s + r.views, 0);
    chart(
      'supply_demand',
      'Public supply and tracked interest share',
      'stack',
      supply
        .filter((r) => r.label !== 'Other')
        .flatMap((r) => [
          {
            label: r.label,
            series: 'Public supply %',
            value: totalSupply
              ? (selected.filter((v) => v.visible && v.type === r.label)
                  .length /
                  totalSupply) *
                100
              : 0,
            match: { type: r.label },
          },
          {
            label: r.label,
            series: 'View share %',
            value: totalViews
              ? (sum(
                  selected.filter((v) => v.type === r.label),
                  (v) => traffic.get(v.key)?.views || 0,
                ) /
                  totalViews) *
                100
              : 0,
            match: { type: r.label },
          },
        ]),
      undefined,
      '%',
    );
    for (const [key, title] of [
      ['enquiries', 'Most enquired listings'],
      ['engagement', 'Highest active engagement'],
    ] as const)
      bar(
        'rank_' + key,
        title,
        selected
          .map((r) => ({
            label: r.title,
            value:
              key === 'engagement'
                ? (traffic.get(r.key)?.engagement || 0) / 1000
                : traffic.get(r.key)?.enquiries || 0,
            match: { key: r.key },
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10),
      );
    bar(
      'low_exposure',
      'Public inventory with no views',
      selected
        .filter((r) => r.visible && !traffic.get(r.key)?.views)
        .map((r) => ({ label: r.title, value: 1, match: { key: r.key } }))
        .slice(0, 10),
    );
  }
  if (section === 'quality') {
    metric(
      'attention',
      'Listings with issues',
      selected.filter((r) => index.get(r.key)?.length).length,
      { issue: 'attention' },
    );
    metric(
      'no_media',
      'Missing media',
      selected.filter((r) => !r.media).length,
      { issue: 'missing_media' },
    );
    metric(
      'no_price',
      'Missing asking price',
      selected.filter((r) => index.get(r.key)?.includes('missing_price'))
        .length,
      { issue: 'missing_price' },
    );
    metric(
      'duplicates',
      'Duplicate candidates',
      selected.filter((r) =>
        index
          .get(r.key)
          ?.some((k) => k.startsWith('duplicate') || k === 'similar_candidate'),
      ).length,
    );
    bar('issues', 'Quality issue distribution', issueCounts);
    bar(
      'verification',
      'Recorded verification states',
      grouped((r) => r.verification || 'Unknown', 'verification', false),
    );
    bar(
      'indexing',
      'Recorded indexing state',
      grouped((r) => r.indexing || 'Unknown', 'indexing', false),
    );
    chart(
      'legal',
      'Applicable legal-information coverage',
      'stack',
      [...new Set(props.map((r) => r.type))].flatMap((type) => {
        const group = props.filter((r) => r.type === type);
        const applicable = [
          'plot',
          'farmland',
          'villa',
          'apartment',
          'individual_portion',
        ].includes(type);
        return [
          {
            label: type,
            series: applicable ? 'Recorded information' : 'Not applicable',
            value: applicable
              ? group.filter(
                  (r) => !index.get(r.key)?.includes('missing_legal'),
                ).length
              : group.length,
            match: { type },
          },
          {
            label: type,
            series: 'Missing applicable information',
            value: group.filter((r) =>
              index.get(r.key)?.includes('missing_legal'),
            ).length,
            match: { type, issue: 'missing_legal' },
          },
        ];
      }),
      'Presence and verification describe recorded information, without asserting legal validity.',
    );
    chart(
      'coverage',
      'Missing requirements by type',
      'heatmap',
      [...new Set(selected.map((r) => r.type))].flatMap((type) =>
        [
          'missing_media',
          'missing_price',
          'missing_location',
          'missing_seo',
          'pending_approval',
        ].map((issue) => ({
          label: type,
          series: ISSUE_LABELS[issue],
          value: selected.filter(
            (r) => r.type === type && index.get(r.key)?.includes(issue),
          ).length,
          match: { type, issue },
        })),
      ),
    );
    bar(
      'freshness',
      'Time since last edit',
      grouped((r) => ageBand(r.updated, now), 'freshness', false),
    );
  }
  return {
    metrics,
    charts,
    records: selected,
    issueCounts,
    selectionRequired: null,
  };
}
function histogram(
  values: number[],
  currency: boolean,
): InventoryChart['rows'] {
  if (!values.length) return [];
  const min = Math.min(...values),
    max = Math.max(...values);
  const width = Math.max(
    1,
    Math.ceil((max - min + 1) / Math.min(10, values.length)),
  );
  const rows: InventoryChart['rows'] = [];
  for (let start = min; start <= max; start += width) {
    const end = start + width;
    rows.push({
      label: currency
        ? (start / 100).toLocaleString('en-IN') +
          '–' +
          ((end - 1) / 100).toLocaleString('en-IN')
        : Math.round(start) + '–' + Math.round(end),
      value: values.filter((v) => v >= start && v < end).length,
      ...(currency
        ? {
            match: {
              minPrice: String(start / 100),
              maxPrice: String((end - 1) / 100),
            },
          }
        : {}),
    });
  }
  return rows;
}
