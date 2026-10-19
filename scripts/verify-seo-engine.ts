import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DataSource, type DataSourceOptions } from 'typeorm';
import source from '../src/database/data-source';
import { SeoCommandCenter1784600000000 } from '../src/database/migrations/1784600000000-SeoCommandCenter';
import { SeoSaleRentTemplates1784700000000 } from '../src/database/migrations/1784700000000-SeoSaleRentTemplates';
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
    const saved = await service.saveConfig(
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
      !resolved.section_seo['floor-plan'].metaTitle.includes('{Property_Name}'),
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
    assert.equal(await inventoryHash(), before, 'SEO changed inventory');
    await service.saveConfig(
      saved.config_key,
      { ...saved, settings: { expired_redirect_path: '/verification-buy' } },
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
