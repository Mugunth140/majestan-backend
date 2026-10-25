import { BadRequestException } from '@nestjs/common';

export const ENTITY_FIELDS = [
  'builder_name',
  'rera_number',
  'approval_authority',
  'sub_locality_override',
  'pincode',
  'latitude',
  'longitude',
  'low_price',
  'high_price',
  'price_per_sqft',
  'unit_configurations',
  'total_units',
  'total_area_acres',
  'possession_status',
  'possession_date',
  'brochure_seo_title',
  'transaction_display',
  'property_type_schema',
  'price_override',
  'builtup_area_sqft',
  'plot_area',
  'bhk_config',
  'commercial_specs',
  'land_specs',
  'approval_status',
  'furnishing_status',
  'facing_direction',
];
export const SETTING_FIELDS = [
  'focus_keyword',
  'secondary_keywords',
  'ai_summary',
  'nearby_landmarks',
  'expired_redirect_policy',
  'redirect_target_path',
  'intro_content',
  'bottom_content',
  'image_alt_template',
];
const aliases: Record<string, string> = {
  locality: 'sub_locality_override',
  builder_entity_name: 'builder_name',
  rera_id: 'rera_number',
  lowPrice: 'low_price',
  highPrice: 'high_price',
  pricePerSqFt: 'price_per_sqft',
};
export function entityFields(raw: any = {}) {
  const result = { ...raw };
  for (const [old, key] of Object.entries(aliases)) {
    if (result[key] === undefined && result[old] !== undefined)
      result[key] = result[old];
    if (result[key] !== undefined) result[old] = result[key];
  }
  return result;
}
export function sectionKey(key: string) {
  return (
    (
      {
        'floor-plans': 'floor_plans',
        'floor-plan': 'floor_plan',
        floorPlans: 'floor_plans',
        floorPlan: 'floor_plan',
      } as any
    )[key] || key
  );
}
export function sections(raw: any = {}) {
  const result: any = {};
  for (const [key, value] of Object.entries(raw || {})) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const v: any = value;
    const next = { ...v };
    for (const [name, old] of Object.entries({
      meta_title: ['metaTitle', 'title'],
      meta_description: ['metaDescription', 'description'],
      canonical_url: ['canonicalUrl', 'canonical', 'custom_canonical_url'],
      intro_text: ['introText'],
      schema_overrides: ['custom_schema_json', 'json_ld', 'jsonLd'],
    })) {
      if (next[name] === undefined)
        for (const alias of old)
          if (v[alias] !== undefined) {
            next[name] = v[alias];
            break;
          }
      for (const alias of old) delete next[alias];
    }
    if (typeof next.schema_overrides === 'string') {
      try {
        next.schema_overrides = JSON.parse(next.schema_overrides);
      } catch {
        // Keep legacy invalid text visible for repair; validation rejects saving it.
      }
    }
    if (next.canonical_type === undefined)
      next.canonical_type = next.canonical_url ? 'custom' : 'self';
    result[sectionKey(key)] = { ...result[sectionKey(key)], ...next };
  }
  return result;
}
export function imageFields(raw: any = {}) {
  const result: any = {};
  for (const [key, value] of Object.entries(raw || {})) {
    if (typeof value === 'string') result[key] = { alt_text: value };
    else if (value && typeof value === 'object' && !Array.isArray(value))
      result[key] = { ...value, alt_text: (value as any).alt_text || '' };
  }
  return result;
}
export function normalizeSeoInput(input: any, existing: any = {}) {
  const body = { ...input };
  if (input.custom_canonical_url !== undefined)
    body.canonical_url = input.custom_canonical_url;
  if (body.canonical_type === undefined)
    body.canonical_type =
      existing.canonical_type || (body.canonical_url ? 'custom' : 'self');
  for (const key of [
    'settings',
    'section_seo',
    'image_alts',
    'image_alt_overrides',
  ])
    if (
      key in input &&
      (input[key] === null ||
        typeof input[key] !== 'object' ||
        Array.isArray(input[key]))
    )
      throw new BadRequestException(`Invalid ${key}`);
  if (
    input.settings?.entity !== undefined &&
    (input.settings.entity === null ||
      typeof input.settings.entity !== 'object' ||
      Array.isArray(input.settings.entity))
  )
    throw new BadRequestException('Invalid entity overrides');
  if (input.section_seo)
    for (const value of Object.values(input.section_seo))
      if (value === null || typeof value !== 'object' || Array.isArray(value))
        throw new BadRequestException('Invalid section_seo');
  const oldSettings = existing?.settings || {};
  const incoming = input.settings || {};
  const previousEntity = entityFields(oldSettings.entity);
  const incomingEntity = entityFields(incoming.entity);
  const flatEntity = Object.fromEntries(
    ENTITY_FIELDS.filter((k) => k in input).map((k) => [k, input[k]]),
  );
  const mergedEntity = { ...previousEntity, ...incomingEntity, ...flatEntity };
  const changed = (a: any, b: any) => JSON.stringify(a) !== JSON.stringify(b);
  for (const key of ENTITY_FIELDS)
    if (
      key in incomingEntity &&
      changed(incomingEntity[key], previousEntity[key])
    )
      mergedEntity[key] = incomingEntity[key];
  const settings = {
    ...oldSettings,
    ...incoming,
    entity: entityFields(mergedEntity),
  };
  for (const key of SETTING_FIELDS)
    if (
      key in input &&
      (!(key in incoming) || !changed(incoming[key], oldSettings[key]))
    )
      settings[key] = input[key];
  if (
    incoming.expired_redirect_path !== undefined &&
    changed(
      incoming.expired_redirect_path,
      oldSettings.expired_redirect_path,
    ) &&
    !changed(incoming.redirect_target_path, oldSettings.redirect_target_path)
  )
    settings.redirect_target_path = incoming.expired_redirect_path;
  if (typeof settings.secondary_keywords === 'string')
    settings.secondary_keywords = settings.secondary_keywords
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
  if (settings.redirect_target_path !== undefined)
    settings.expired_redirect_path = settings.redirect_target_path;
  else if (settings.expired_redirect_path !== undefined)
    settings.redirect_target_path = settings.expired_redirect_path;
  if (input.key_highlights !== undefined && input.highlights === undefined)
    body.highlights = input.key_highlights;
  if (
    input.custom_schema_json !== undefined &&
    (input.schema_overrides === undefined ||
      (changed(input.custom_schema_json, existing?.schema_overrides || {}) &&
        !changed(input.schema_overrides, existing?.schema_overrides || {})))
  )
    body.schema_overrides = input.custom_schema_json;
  if (input.image_alts !== undefined) {
    const previous = imageFields(existing?.image_alt_overrides),
      legacy = imageFields(input.image_alt_overrides),
      canonical = imageFields(input.image_alts);
    body.image_alt_overrides = { ...previous, ...canonical, ...legacy };
    for (const [key, value] of Object.entries(canonical))
      if (changed(value, previous[key])) body.image_alt_overrides[key] = value;
  }
  if (input.section_seo !== undefined) {
    const previous = sections(existing?.section_seo),
      next = sections(input.section_seo);
    body.section_seo = { ...previous };
    for (const [key, value] of Object.entries(next)) {
      const supplied = Object.entries(input.section_seo).find(
        ([raw]) => sectionKey(raw) === key,
      )?.[1] as any;
      if (
        supplied &&
        supplied.canonical_type === undefined &&
        supplied.canonical_url === undefined &&
        supplied.custom_canonical_url === undefined &&
        previous[key]?.canonical_type
      )
        (value as any).canonical_type = previous[key].canonical_type;
      body.section_seo[key] = { ...previous[key], ...(value as any) };
    }
  }
  for (const [alias, field] of Object.entries({
    meta_title_template: 'meta_title',
    meta_description_template: 'meta_description',
    h1_template: 'h1',
  }))
    if (alias in input) body[field] = input[alias];
  if (existing?.scope === 'template' || input.scope === 'template') {
    const scope = settings.scope || existing?.settings?.scope;
    const floor = scope === 'project' ? 'floor_plans' : 'floor_plan';
    for (const [alias, key, field] of [
      ['floor_plan_title_template', floor, 'meta_title'],
      ['floor_plan_description_template', floor, 'meta_description'],
      ['photos_title_template', 'photos', 'meta_title'],
      ['photos_description_template', 'photos', 'meta_description'],
    ]) {
      if (alias in input) {
        body.section_seo = body.section_seo || sections(existing?.section_seo);
        body.section_seo[key] = {
          ...body.section_seo[key],
          [field]: input[alias],
        };
      }
    }
  }
  if (['property', 'project'].includes(input.scope || existing.scope))
    for (const key of ['expired_redirect_policy', 'expired_redirect_path', 'redirect_target_path'])
      delete settings[key];
  body.settings = settings;
  return body;
}
export function exposeSeoFields(row: any) {
  if (!row) return row;
  const e = entityFields(row.settings?.entity || {});
  for (const key of ENTITY_FIELDS) if (e[key] !== undefined) row[key] = e[key];
  for (const key of SETTING_FIELDS)
    if (row.settings?.[key] !== undefined) row[key] = row.settings[key];
  row.key_highlights = row.highlights || [];
  row.custom_schema_json = row.schema_overrides || {};
  row.image_alts = imageFields(row.image_alt_overrides);
  row.section_seo = sections(row.section_seo);
  if (row.scope === 'template') {
    const floor =
      row.settings?.scope === 'project' ? 'floor_plans' : 'floor_plan';
    Object.assign(row, {
      meta_title_template: row.meta_title,
      meta_description_template: row.meta_description,
      h1_template: row.h1,
      floor_plan_title_template: row.section_seo[floor]?.meta_title || '',
      floor_plan_description_template:
        row.section_seo[floor]?.meta_description || '',
      photos_title_template: row.section_seo.photos?.meta_title || '',
      photos_description_template:
        row.section_seo.photos?.meta_description || '',
    });
  }
  return row;
}
export function validateSeoFields(body: any, scope: string) {
  if (
    body.canonical_type !== undefined &&
    !['self', 'parent', 'custom'].includes(body.canonical_type)
  )
    throw new BadRequestException('Invalid canonical_type');
  const fail = (field: string) => {
    throw new BadRequestException(`Invalid ${field}`);
  };
  const text = (v: any, max: number, key: string) => {
    if (
      v !== undefined &&
      v !== null &&
      (typeof v !== 'string' || v.length > max)
    )
      fail(key);
  };
  if (scope === 'project' || scope === 'property') {
    text(body.meta_title, 80, 'meta_title (maximum 80 characters)');
    text(
      body.meta_description,
      200,
      'meta_description (maximum 200 characters)',
    );
  }
  const s = body.settings || {},
    e = s.entity || {};
  for (const [key, min, max] of [
    ['latitude', -90, 90],
    ['longitude', -180, 180],
    ['low_price', 0, 1e15],
    ['high_price', 0, 1e15],
    ['price_override', 0, 1e15],
    ['builtup_area_sqft', 0, 1e12],
    ['total_units', 0, 1e9],
    ['total_area_acres', 0, 1e9],
  ] as const) {
    if (
      e[key] !== undefined &&
      e[key] !== null &&
      e[key] !== '' &&
      (!Number.isFinite(Number(e[key])) ||
        Number(e[key]) < min ||
        Number(e[key]) > max)
    )
      fail(key);
  }
  for (const key of ENTITY_FIELDS.filter(
    (k) => !['plot_area', 'commercial_specs', 'land_specs'].includes(k),
  ))
    if (
      e[key] !== undefined &&
      e[key] !== null &&
      !['string', 'number', 'boolean'].includes(typeof e[key])
    )
      fail(key);
  if (
    e.low_price !== '' &&
    e.high_price !== '' &&
    Number(e.low_price) > Number(e.high_price)
  )
    fail('price range');
  if (
    e.total_units !== undefined &&
    e.total_units !== '' &&
    !Number.isInteger(Number(e.total_units))
  )
    fail('total_units');
  if (
    e.possession_date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.possession_date)) ||
      !Number.isFinite(Date.parse(e.possession_date + 'T00:00:00Z')) ||
      new Date(e.possession_date + 'T00:00:00Z').toISOString().slice(0, 10) !==
        e.possession_date)
  )
    fail('possession_date');
  if (
    e.plot_area &&
    (typeof e.plot_area !== 'object' ||
      !['Sq.Ft', 'Cent', 'Acre'].includes(e.plot_area.unit) ||
      !Number.isFinite(Number(e.plot_area.value)) ||
      Number(e.plot_area.value) < 0)
  )
    fail('plot_area');
  for (const key of ['commercial_specs', 'land_specs'])
    if (e[key] != null && (typeof e[key] !== 'object' || Array.isArray(e[key])))
      fail(key);
  if (
    s.expired_redirect_policy !== undefined &&
    !['redirect_to_locality', 'keep_live_sold_banner', 'gone'].includes(
      s.expired_redirect_policy,
    )
  )
    fail('expired_redirect_policy');
  if (
    s.nearby_landmarks !== undefined &&
    (!Array.isArray(s.nearby_landmarks) ||
      s.nearby_landmarks.some(
        (l: any) =>
          !l ||
          typeof l.name !== 'string' ||
          !l.name.trim() ||
          (l.distance_km !== undefined &&
            l.distance_km !== '' &&
            (!Number.isFinite(Number(l.distance_km)) ||
              Number(l.distance_km) < 0)),
      ))
  )
    fail('nearby_landmarks');
  for (const key of [
    'focus_keyword',
    'ai_summary',
    'image_alt_template',
    'intro_content',
    'bottom_content',
  ])
    text(s[key], key.endsWith('content') ? 100000 : 10000, key);
  if (body.section_seo)
    for (const [key, value] of Object.entries(body.section_seo)) {
      const v: any = value;
      if (
        v?.canonical_type !== undefined &&
        !['self', 'parent', 'custom'].includes(v.canonical_type)
      )
        fail('canonical_type');
      if (!v || typeof v !== 'object' || Array.isArray(v)) fail('section_seo');
      for (const field of [
        'meta_title',
        'meta_description',
        'h1',
        'intro_text',
        'canonical_url',
      ])
        text(
          v[field],
          field === 'intro_text'
            ? 10000
            : field === 'canonical_url'
              ? 1024
              : 320,
          `${key}.${field}`,
        );
      if (
        v.schema_overrides !== undefined &&
        (!v.schema_overrides ||
          typeof v.schema_overrides !== 'object' ||
          Array.isArray(v.schema_overrides))
      )
        fail(`${key}.schema_overrides`);
      for (const field of ['robots_index', 'robots_follow'])
        if (v[field] !== undefined && ![true, false, 0, 1].includes(v[field]))
          fail(`${key}.${field}`);
      if (v.canonical_url) {
        let u: URL;
        try {
          u = new URL(v.canonical_url, 'https://www.majestanrealty.com');
        } catch {
          fail(`${key}.canonical_url`);
        }
        if (
          !['http:', 'https:'].includes(u!.protocol) ||
          u!.username ||
          u!.password
        )
          fail(`${key}.canonical_url`);
      }
    }
  if (body.image_alt_overrides)
    for (const [key, value] of Object.entries(body.image_alt_overrides)) {
      if (typeof value === 'string') {
        text(value, 2000, key);
        continue;
      }
      if (!value || typeof value !== 'object' || Array.isArray(value))
        fail('image_alts');
      for (const field of ['alt_text', 'title_text', 'caption'])
        text((value as any)[field], 2000, `image_alts.${field}`);
    }
}
export function defaultSections(scope: string) {
  const project = scope === 'project',
    name = project ? '{Project_Name}' : '{Property_Name}';
  return {
    [project ? 'floor_plans' : 'floor_plan']: {
      meta_title: project
        ? '{Project_Name} Floor Plans & 2D/3D Unit Configurations | {Sub_Locality}, {City}'
        : '{Property_Name} Floor Plan - {BHK} {Property_Type} ({SqFt} Sq.Ft) in {Sub_Locality}',
      meta_description: `View ${name} floor plans, unit configurations and area details in {Sub_Locality}, {City}.`,
      h1: project
        ? '{Project_Name} Floor Plans & Carpet Area'
        : '{Property_Name} 2D Floor Plan & Dimensions',
      intro_text: '',
      canonical_url: '',
      robots_index: true,
    },
    photos: {
      meta_title: project
        ? '{Project_Name} Photos, Site Images & Construction Updates | {Sub_Locality}'
        : '{Property_Name} Photos - {BHK} {Property_Type} for {Transaction_Type} in {Sub_Locality}',
      meta_description: `Explore photographs of ${name} in {Sub_Locality}, {City}.`,
      h1: project
        ? '{Project_Name} Interior, Exterior & Site Photos'
        : '{Property_Name} Photos & Gallery',
      intro_text: '',
      canonical_url: '',
      robots_index: true,
    },
    ...(project
      ? {
          amenities: {
            meta_title:
              '{Project_Name} Amenities, Clubhouse & Specifications | {Sub_Locality}',
            meta_description:
              'Explore the amenities and specifications of {Project_Name} in {Sub_Locality}, {City}.',
            h1: '{Project_Name} Amenities & Specifications',
            intro_text: '',
            canonical_url: '',
            robots_index: true,
          },
          locality: {
            meta_title:
              '{Project_Name} Location Map, Address & Nearby Landmarks in {Sub_Locality}',
            meta_description:
              'View {Project_Name} location, address and nearby landmarks in {Sub_Locality}, {City}.',
            h1: '{Project_Name} Location & Nearby Landmarks',
            intro_text: '',
            canonical_url: '',
            robots_index: true,
          },
        }
      : {}),
  };
}
