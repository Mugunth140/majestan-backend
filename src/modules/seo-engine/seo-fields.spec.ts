import {
  defaultSections,
  exposeSeoFields,
  normalizeSeoInput,
  sections,
  validateSeoFields,
} from './seo-fields';

describe('SEO field normalization', () => {
  it('keeps the edited schema field when a hydrated alias still contains the old schema', () => {
    const oldSchema = { '@type': 'Service', name: 'Old service' };
    const newSchema = { '@type': 'Service', name: 'Updated service' };
    const existing = { schema_overrides: oldSchema };
    expect(
      normalizeSeoInput(
        { schema_overrides: oldSchema, custom_schema_json: newSchema },
        existing,
      ).schema_overrides,
    ).toEqual(newSchema);
    expect(
      normalizeSeoInput(
        { schema_overrides: newSchema, custom_schema_json: oldSchema },
        existing,
      ).schema_overrides,
    ).toEqual(newSchema);
  });
  it('honors edited flat fields when a whole hydrated config contains old nested values', () => {
    const existing = {
      settings: {
        intro_content: 'Old introduction',
        entity: { builder_name: 'Old builder', low_price: 1 },
      },
    };
    const flat = normalizeSeoInput(
      {
        intro_content: 'Updated introduction',
        builder_name: 'New builder',
        settings: existing.settings,
      },
      existing,
    );
    expect(flat.settings.intro_content).toBe('Updated introduction');
    expect(flat.settings.entity.builder_name).toBe('New builder');
    const legacy = normalizeSeoInput(
      { settings: { entity: { lowPrice: 2 } } },
      existing,
    );
    expect(legacy.settings.entity.low_price).toBe(2);
  });
  it('keeps edits from either image API shape when an unchanged hydrated alias is also sent', () => {
    const existing = {
      image_alt_overrides: {
        photo: { alt_text: 'Old', caption: 'Old caption' },
      },
    };
    const legacy = normalizeSeoInput(
      {
        image_alt_overrides: {
          photo: { alt_text: 'New', caption: 'New caption' },
        },
        image_alts: { photo: { alt_text: 'Old', caption: 'Old caption' } },
      },
      existing,
    );
    expect(legacy.image_alt_overrides.photo.alt_text).toBe('New');
    const canonical = normalizeSeoInput(
      {
        image_alt_overrides: existing.image_alt_overrides,
        image_alts: { photo: { alt_text: 'Canonical edit' } },
      },
      existing,
    );
    expect(canonical.image_alt_overrides.photo.alt_text).toBe('Canonical edit');
  });
  it('validates calendar dates and whole unit counts', () => {
    expect(() =>
      validateSeoFields(
        {
          settings: {
            entity: { possession_date: '2028-02-29', total_units: 108 },
          },
        },
        'project',
      ),
    ).not.toThrow();
    expect(() =>
      validateSeoFields(
        { settings: { entity: { possession_date: '2028-02-31' } } },
        'project',
      ),
    ).toThrow();
    expect(() =>
      validateSeoFields(
        { settings: { entity: { total_units: 1.5 } } },
        'project',
      ),
    ).toThrow();
  });
  it('rejects malformed section and entity objects instead of silently discarding input', () => {
    expect(() =>
      normalizeSeoInput({ section_seo: { floor_plan: 'invalid' } }),
    ).toThrow();
    expect(() => normalizeSeoInput({ settings: { entity: [] } })).toThrow();
  });

  it('normalizes legacy floor-plan section and field aliases', () => {
    expect(
      sections({
        'floor-plans': {
          metaTitle: 'Floor plans',
          metaDescription: 'Layouts and areas',
          canonicalUrl: '/projects/example/floor-plans',
        },
      }),
    ).toEqual({
      floor_plans: {
        meta_title: 'Floor plans',
        meta_description: 'Layouts and areas',
        canonical_url: '/projects/example/floor-plans',
      },
    });
  });

  it('merges flat entity values with nested entity settings and exposes canonical values', () => {
    const normalized = normalizeSeoInput(
      {
        builder_name: 'Flat builder',
        settings: { entity: { rera_number: 'Nested RERA' } },
      },
      {
        settings: {
          entity: { approval_authority: 'DTCP' },
          focus_keyword: 'old',
        },
      },
    );

    expect(normalized.settings.entity).toMatchObject({
      builder_name: 'Flat builder',
      rera_number: 'Nested RERA',
      approval_authority: 'DTCP',
    });
    expect(exposeSeoFields({ settings: normalized.settings })).toMatchObject({
      builder_name: 'Flat builder',
      rera_number: 'Nested RERA',
    });
  });

  it('round-trips image alt objects and converts legacy string values', () => {
    const normalized = normalizeSeoInput(
      {
        image_alts: {
          'front.jpg': { alt_text: 'Front elevation', title_text: 'Front' },
          'hall.jpg': 'Living hall',
        },
      },
      { image_alt_overrides: { 'old.jpg': 'Old image' } },
    );

    expect(normalized.image_alt_overrides).toEqual({
      'old.jpg': { alt_text: 'Old image' },
      'front.jpg': { alt_text: 'Front elevation', title_text: 'Front' },
      'hall.jpg': { alt_text: 'Living hall' },
    });
    expect(exposeSeoFields(normalized).image_alts).toEqual(
      normalized.image_alt_overrides,
    );
  });

  it('preserves existing partial settings when normalizing incoming values', () => {
    const normalized = normalizeSeoInput(
      { settings: { intro_content: 'New intro' } },
      {
        settings: {
          focus_keyword: 'Coimbatore homes',
          bottom_content: 'Existing guide',
        },
      },
    );

    expect(normalized.settings).toMatchObject({
      focus_keyword: 'Coimbatore homes',
      intro_content: 'New intro',
      bottom_content: 'Existing guide',
    });
  });
});

describe('SEO field validation', () => {
  it('enforces 60-character titles and 160-character descriptions for inventory', () => {
    expect(() =>
      validateSeoFields({ meta_title: 't'.repeat(61) }, 'property'),
    ).toThrow(/meta_title/);
    expect(() =>
      validateSeoFields({ meta_description: 'd'.repeat(161) }, 'project'),
    ).toThrow(/meta_description/);
    expect(() =>
      validateSeoFields(
        { meta_title: 't'.repeat(60), meta_description: 'd'.repeat(160) },
        'property',
      ),
    ).not.toThrow();
  });

  it('allows longer template patterns in inventory template scope', () => {
    expect(() =>
      validateSeoFields(
        {
          meta_title: '{Project_Name} '.repeat(8),
          meta_description: '{City} '.repeat(30),
        },
        'template',
      ),
    ).not.toThrow();
  });

  it('rejects unsafe child canonical URLs', () => {
    expect(() =>
      validateSeoFields(
        { section_seo: { photos: { canonical_url: 'javascript:alert(1)' } } },
        'property',
      ),
    ).toThrow(/photos\.canonical_url/);
  });

  it('rejects negative nearby landmark distances', () => {
    expect(() =>
      validateSeoFields(
        {
          settings: {
            nearby_landmarks: [{ name: 'Railway station', distance_km: -0.1 }],
          },
        },
        'page',
      ),
    ).toThrow(/nearby_landmarks/);
  });

  it('rejects plot areas with unsupported units', () => {
    expect(() =>
      validateSeoFields(
        {
          settings: {
            entity: { plot_area: { value: 1200, unit: 'SquareYard' } },
          },
        },
        'property',
      ),
    ).toThrow(/plot_area/);
  });

  it('accepts empty entity settings and rejects non-scalar text entity fields', () => {
    expect(() =>
      validateSeoFields({ settings: { entity: {} } }, 'property'),
    ).not.toThrow();
    expect(() =>
      validateSeoFields(
        { settings: { entity: { builder_name: { unexpected: true } } } },
        'project',
      ),
    ).toThrow(/builder_name/);
  });
});

describe('default child SEO sections', () => {
  it('provides all four default sections for projects', () => {
    expect(Object.keys(defaultSections('project'))).toEqual([
      'floor_plans',
      'photos',
      'amenities',
      'locality',
    ]);
  });

  it('provides floor plans and photos for properties', () => {
    expect(Object.keys(defaultSections('property'))).toEqual([
      'floor_plan',
      'photos',
    ]);
  });
});
