import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DataSource, type DataSourceOptions } from 'typeorm';
import source from '../src/database/data-source';
import { SeoCommandCenter1784600000000 } from '../src/database/migrations/1784600000000-SeoCommandCenter';
import { SeoSaleRentTemplates1784700000000 } from '../src/database/migrations/1784700000000-SeoSaleRentTemplates';
import { SeoFieldProvisioning1784800000000 } from '../src/database/migrations/1784800000000-SeoFieldProvisioning';
import { SeoEngineService } from '../src/modules/seo-engine/seo-engine.service';
async function verify() {
  await source.initialize();
  const database = 'majestan_seo_engine_verify_' + Date.now();
  let db: DataSource | undefined;
  try {
    await source.query(`CREATE DATABASE \`${database}\``);
    const original = String(source.options.database);
    for (const table of [
      'properties',
      'projects',
      'cities',
      'sublocations',
      'property_seo',
      'project_seo',
      'listing_page_seo',
      'seo_metadata',
      'property_details',
      'property_locations',
      'property_images',
      'project_units',
      'builders',
      'property_units',
      'property_files',
      'files',
      'property_faqs',
      'project_faqs',
    ]) {
      await source.query(
        `CREATE TABLE \`${database}\`.\`${table}\` LIKE \`${original}\`.\`${table}\``,
      );
      await source.query(
        `INSERT INTO \`${database}\`.\`${table}\` SELECT * FROM \`${original}\`.\`${table}\``,
      );
    }
    db = new DataSource({
      ...source.options,
      database,
      migrations: [
        SeoCommandCenter1784600000000,
        SeoSaleRentTemplates1784700000000,
        SeoFieldProvisioning1784800000000,
      ],
    } as DataSourceOptions);
    await db.initialize();
    await db.runMigrations({ transaction: 'none' });
    const service = new SeoEngineService(db);
    const inventoryHash = async () =>
      createHash('sha256')
        .update(
          JSON.stringify(
            await db!.query('SELECT * FROM properties ORDER BY id'),
          ) +
            JSON.stringify(
              await db!.query('SELECT * FROM projects ORDER BY id'),
            ),
        )
        .digest('hex');
    const before = await inventoryHash();
    const city = (
      await db.query("SELECT id FROM cities WHERE city_name='Coimbatore'")
    )[0].id;
    const totals: Record<string, number> = {};
    for (const intent of ['buy', 'rent']) {
      const config = await service.saveListing(
        {
          inventory_kind: 'property',
          transaction_intent: intent,
          property_type: 'apartment',
          city_id: city,
          public_path: '/verification-' + intent,
          meta_title: 'SEO verification ' + intent,
          h1: 'Verification listings',
          intro_content: 'Real inventory for verification.',
          bottom_content: 'Locality facts.',
          locality_faqs: [
            {
              question: 'What is listed?',
              answer: 'Current matching inventory.',
            },
          ],
          revision: 0,
          minimum_active_listings: 1000,
          thin_content_guard_enabled: true,
          auto_stats_faqs: true,
        },
        42,
      );
      const seo = await service.resolve('/verification-' + intent);
      totals[intent] = seo.stats.total;
      assert.equal(seo.meta_title, 'SEO verification ' + intent);
      assert.equal(seo.robots_index, false);
      assert(seo.json_ld['@graph'].some((s: any) => s['@type'] === 'FAQPage'));
      await assert.rejects(
        service.saveConfig(
          config.config_key,
          { ...config, revision: 0, meta_title: 'Stale update' },
          42,
        ),
      );
      const pinned = await service.saveConfig(
        config.config_key,
        { ...config, revision: config.revision, meta_title: 'Changed title' },
        42,
      );
      assert.equal(
        (await service.resolve('/verification-' + intent)).meta_title,
        'Changed title',
      );
    }
    const broad = (
      await db.query(
        "SELECT COUNT(*) AS n FROM properties WHERE property_type='apartment' AND listing_type='Sell' AND status='available' AND city='Coimbatore'",
      )
    )[0].n;
    assert.equal(totals.buy, Number(broad));

    await service.saveRedirect(
      {
        source_path: '/verification-old',
        destination_path: '/verification-buy',
      },
      42,
    );
    assert.equal(
      (await service.resolve('/verification-old')).redirect,
      '/verification-buy',
    );
    await assert.rejects(
      service.saveRedirect(
        {
          source_path: '/verification-buy',
          destination_path: '/verification-old',
        },
        42,
      ),
    );
    const target = (
      await db.query(
        "SELECT p.id FROM properties p LEFT JOIN seo_configs c ON c.property_id=p.id WHERE p.status='available' AND p.slug IS NOT NULL AND c.id IS NULL LIMIT 1",
      )
    )[0];
    let saved = await service.saveConfig(
      'property:' + target.id,
      {
        revision: 0,
        public_path: '/verification/nested/property',
        meta_title: 'Custom title',
        h1: 'Custom H1',
        faqs: [{ question: 'A question?', answer: 'A factual answer.' }],
        settings: {
          entity: {
            locality: 'Verification locality',
            pincode: '641035',
            latitude: 11.1,
            longitude: 76.9,
            lowPrice: 13000000,
            highPrice: 14000000,
            pricePerSqFt: 5000,
            landmarks: 'Nearby college',
            builder_entity_name: 'Verified builder',
            rera_id: 'Verified RERA',
          },
          ai_summary: 'Factual property summary.',
          focus_keyword: 'apartment in locality',
          secondary_keywords: ['sale apartment'],
        },
        section_seo: {
          'floor-plan': {
            metaTitle: 'Floor plan for {Property_Name}',
            h1: 'Custom floorplan heading',
          },
        },
        schema_overrides: {
          '@type': 'RealEstateListing',
          mainEntity: { address: { postalCode: '641036' } },
        },
      },
      42,
    );
    const resolved = await service.resolve('/verification/nested/property');
    assert.equal(resolved.target_id, target.id);
    assert.equal(resolved.h1, 'Custom H1');
    const listingNode = resolved.json_ld['@graph'].find(
      (n: any) => n['@type'] === 'RealEstateListing',
    );
    assert.equal(listingNode.description, 'Factual property summary.');
    assert.equal(
      listingNode.mainEntity.address.addressLocality,
      'Verification locality',
    );
    assert.equal(listingNode.mainEntity.address.postalCode, '641036');
    assert.equal(listingNode.mainEntity.geo.latitude, 11.1);
    assert.equal(listingNode.offers.lowPrice, 13000000);
    assert.equal(listingNode.offers.highPrice, 14000000);
    assert.equal(listingNode.provider.name, 'Verified builder');
    assert.equal(listingNode.mainEntity.identifier, 'Verified RERA');
    assert(listingNode.keywords.includes('sale apartment'));
    assert(
      !resolved.section_seo.floor_plan.meta_title.includes('{Property_Name}'),
    );
    const editor = await service.inventoryConfig('property', target.id);
    assert(editor.images.every((image: any) => image.key && image.image_url));
    await assert.rejects(
      service.saveConfig(
        saved.config_key,
        { ...saved, settings: { entity: { latitude: 100 } } },
        42,
      ),
    );

    assert.equal(
      resolved.json_ld['@graph'].find(
        (s: any) => s['@type'] === 'RealEstateListing',
      ).name,
      'Custom H1',
    );
    const originalPath = (
      await db.query('SELECT slug FROM properties WHERE id=?', [target.id])
    )[0].slug;
    assert.equal(
      (await service.resolve('/' + originalPath)).redirect,
      '/verification/nested/property',
    );
    await assert.rejects(
      service.saveConfig(
        saved.config_key,
        { ...saved, meta_title: 'x'.repeat(61) },
        42,
      ),
    );
    await assert.rejects(
      service.saveConfig(
        saved.config_key,
        { ...saved, meta_description: 'x'.repeat(161) },
        42,
      ),
    );
    saved = await service.saveConfig(
      saved.config_key,
      {
        revision: saved.revision,
        meta_title: 'Complete property fields',
        robots_follow: false,
        price_override: 17500000,
        price_per_sqft: '₹7,264/sq.ft',
        builtup_area_sqft: 2400,
        sub_locality_override: 'Canonical locality',
        bhk_config: '4 BHK',
        property_type_schema: 'CommercialProperty',
        plot_area: { value: 5, unit: 'Cent' },
        commercial_specs: { power_load: '50 kW' },
        land_specs: { road_width: '30 ft' },
        approval_status: 'DTCP',
        furnishing_status: 'Furnished',
        facing_direction: 'East',
        ai_summary: 'Verified factual summary.',
        key_highlights: ['Verified highlight'],
        nearby_landmarks: [
          { name: 'Verified school', category: 'School', distance_km: 0.2 },
        ],
        image_alts: {
          'property-image:fixture': {
            alt_text: 'SEO alt',
            title_text: 'SEO title',
            caption: 'SEO caption',
          },
        },
        section_seo: {
          floor_plan: {
            meta_title: 'Dedicated floor title',
            meta_description: 'Dedicated floor description',
            h1: 'Dedicated floor H1',
            intro_text: 'Dedicated floor intro',
            robots_index: false,
          },
        },
      },
      42,
    );
    const complete = await service.resolve('/verification/nested/property');
    assert.equal(complete.entity.price_override, 17500000);
    assert.equal(complete.entity.sub_locality_override, 'Canonical locality');
    assert.equal(complete.variables.BHK, '4 BHK');
    assert.equal(complete.variables.SqFt, '2400');
    assert.equal(
      complete.image_alts['property-image:fixture'].caption,
      'SEO caption',
    );
    assert.equal(
      complete.image_alt_overrides['property-image:fixture'],
      'SEO alt',
    );
    const offer = complete.json_ld['@graph'].find(
      (n: any) => n['@type'] === 'RealEstateListing',
    );
    assert.equal(offer.offers['@type'], 'Offer');
    assert.equal(offer.offers.price, 17500000);
    assert.equal(offer.mainEntity['@type'], 'Place'); // customcategory is additionalType, not invalidschema type
    assert.equal(offer.mainEntity.additionalType, 'CommercialProperty');
    assert(!JSON.stringify(complete.json_ld).includes('"value":null'));
    assert.equal(complete.robots_follow, false);
    const child = await service.resolve(
      '/verification/nested/property/floor-plan',
    );
    assert.equal(child.meta_title, 'Dedicated floor title');
    assert.equal(child.intro_content, 'Dedicated floor intro');
    assert.equal(child.robots_index, false);
    assert.equal(
      child.canonical_url,
      'https://www.majestanrealty.com/verification/nested/property/floor-plan',
    );
    assert(
      child.json_ld['@graph'].some(
        (node: any) => node['@type'] === 'BreadcrumbList',
      ),
    );
    const primary = (
      await db.query(
        'SELECT image_url FROM property_images WHERE property_id=? ORDER BY is_primary DESC,id LIMIT 1',
        [target.id],
      )
    )[0];
    assert.equal(complete.og_image_url, primary?.image_url);
    const project = (
      await db.query(
        "SELECT p.id,p.canonical_slug FROM projects p LEFT JOIN seo_configs c ON c.project_id=p.id WHERE p.status='published' AND c.id IS NULL LIMIT 1",
      )
    )[0];
    if (project) {
      const config = await service.saveConfig(
        'project:' + project.id,
        {
          revision: 0,
          meta_title: 'Complete project fields',
          builder_name: 'Actual developer',
          rera_number: 'RERA-test',
          approval_authority: 'DTCP',
          low_price: 13000000,
          high_price: 15000000,
          unit_configurations: '3 BHK Apartments',
          total_units: 108,
          total_area_acres: 5.2,
          possession_status: 'Under Construction',
          possession_date: '2028-06-01',
          brochure_seo_title: 'Download verified brochure',
          section_seo: {
            amenities: { intro_text: 'Amenity facts.' },
            locality: { intro_text: 'Locality facts.' },
          },
        },
        42,
      );
      const data = await service.resolve('/' + project.canonical_slug);
      assert.equal(data.entity.total_units, 108);
      assert.equal(
        data.entity.brochure_seo_title,
        'Download verified brochure',
      );
      const development = data.json_ld['@graph'].find((node: any) =>
        node['@id']?.endsWith('#development'),
      );
      assert.equal(development.numberOfAccommodationUnits.value, 108);
      assert.equal(
        data.json_ld['@graph'].find(
          (node: any) => node['@type'] === 'Organization',
        ).name,
        'Actual developer',
      );
      for (const suffix of ['floor-plans', 'photos', 'amenities', 'locality'])
        assert(
          (await service.resolve('/' + project.canonical_slug + '/' + suffix))
            .meta_title,
        );
      const sm = await service.sitemapEntries('projects');
      assert(
        sm.some(
          (entry: any) =>
            entry.path === '/' + project.canonical_slug + '/amenities',
        ),
      );
    }
    const listing = (await service.listingPages()).find(
      (r: any) => r.transaction_intent === 'buy',
    );
    await service.saveListing(
      { ...listing, show_live_market_snapshot: false },
      42,
    );
    assert.equal(
      (await service.resolve('/verification-buy')).show_live_market_snapshot,
      false,
    );
    const rentalUnit = (
      await db.query(
        "SELECT u.id,u.project_id,p.city,p.project_type FROM project_units u JOIN projects p ON p.id=u.project_id WHERE p.status='published' AND u.status='available' LIMIT 1",
      )
    )[0];
    if (rentalUnit) {
      await db.query(
        "UPDATE project_units SET listing_mode='rent',monthly_rent=45000,bedrooms=4,builtup_area_sqft=1000 WHERE id=?",
        [rentalUnit.id],
      );
      const cityId = (
        await db.query(
          'SELECT id FROM cities WHERE LOWER(city_name)=LOWER(?)',
          [rentalUnit.city],
        )
      )[0].id;
      const unitsBefore = JSON.stringify(
        await db.query(
          'SELECT * FROM project_units WHERE project_id=? ORDER BY id',
          [rentalUnit.project_id],
        ),
      );
      await service.saveListing(
        {
          inventory_kind: 'project',
          transaction_intent: 'rent',
          project_type: rentalUnit.project_type,
          city_id: cityId,
          bedrooms: '4+',
          public_path: '/verification-project-rent',
          meta_title: 'Project rental listings',
          h1: 'Project rental listings',
          minimum_active_listings: 0,
          thin_content_guard_enabled: false,
        },
        42,
      );
      const rent = await service.resolve('/verification-project-rent');
      assert.equal(rent.stats.total, 1);
      assert.equal(rent.stats.min_price, 45000);
      assert.equal(rent.stats.max_price, 45000);
      assert.equal(rent.stats.average_price_sqft, 45);
      assert.equal(
        JSON.stringify(
          await db.query(
            'SELECT * FROM project_units WHERE project_id=? ORDER BY id',
            [rentalUnit.project_id],
          ),
        ),
        unitsBefore,
      );
    }
    assert.equal(await inventoryHash(), before, 'SEO changed inventory');
    saved = await service.saveConfig(
      saved.config_key,
      {
        revision: saved.revision,
        expired_redirect_policy: 'keep_live_sold_banner',
        redirect_target_path: '/verification-buy',
        schema_overrides: {
          '@type': 'RealEstateListing',
          offers: {
            '@type': 'Offer',
            availability: 'https://schema.org/InStock',
            price: 17500000,
          },
        },
      },
      42,
    );
    await db.query(
      "UPDATE properties SET available_until='2000-01-01' WHERE id=?",
      [target.id],
    );
    const retained = await service.resolve('/verification/nested/property');
    assert.equal(retained.off_market, true);
    assert(
      retained.target_snapshot && !('owner_id' in retained.target_snapshot),
    );
    assert(!retained.json_ld['@graph'].some((node: any) => node.offers));
    assert(!JSON.stringify(retained.json_ld).includes('schema.org/InStock'));
    assert(
      !(await service.routing()).redirects.some(
        (r: any) => r.source === '/verification/nested/property',
      ),
    );
    await service.saveConfig(
      saved.config_key,
      {
        revision: saved.revision,
        expired_redirect_policy: 'redirect_to_locality',
        redirect_target_path: '/verification-buy',
      },
      42,
    );
    await db.query(
      "UPDATE properties SET available_until='2000-01-01' WHERE id=?",
      [target.id],
    );
    assert.equal(
      (await service.resolve('/verification/nested/property')).redirect,
      '/verification-buy',
    );
    assert.equal(
      (
        await db.query('SELECT status FROM properties WHERE id=?', [target.id])
      )[0].status,
      'available',
    );
    await db.query('DELETE FROM properties WHERE id=?', [target.id]);
    assert.equal(
      (await service.resolve('/verification/nested/property')).redirect,
      '/verification-buy',
    );
    console.log(
      'Passed: Sale/Rent intents, live stats, immediate updates, thin-content guards, FAQ JSON-LD, stale-save protection, redirect loops, nested paths and unchanged inventory.',
    );
  } finally {
    if (db?.isInitialized) await db.destroy();
    await source.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await source.destroy();
  }
}
void verify().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
