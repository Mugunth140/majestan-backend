// Local MySQL regression/soak test. Creates and drops ONLY its own scratch DB.
// Run after bun run build: DB_PORT=3306 bun scripts/verify-property-detail-memory.cjs
require('dotenv').config({ quiet: true });
require('reflect-metadata');
const assert = require('node:assert/strict');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { DataSource } = require('typeorm');
const { Property } = require('../dist/src/database/entities/property.entity.js');
const { PropertiesService } = require('../dist/src/modules/properties/properties.service.js');
const { AdminPropertiesService } = require('../dist/src/modules/admin/properties/admin-properties.service.js');

async function main() {
  const host = process.env.DB_HOST || 'localhost';
  assert(['localhost', '127.0.0.1', '::1'].includes(host), 'This test accepts only a local database');
  const connection = {
    host, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root', password: process.env.DB_PASSWORD || '',
  };
  const baseline = process.argv.includes('--baseline');
  const iterations = Number(process.env.DETAIL_SOAK_ITERATIONS || 30);
  assert(Number.isInteger(iterations) && iterations > 0 && iterations <= 2000);
  const sizes = baseline ? [4, 3, 5, 6] : [26, 9, 17, 35];
  const [amenities, furnishings, images, faqs] = sizes;
  const schema = 'majestan_detail_memory_verify_' + Date.now();
  const control = await mysql.createConnection(connection);
  let db;
  let created = false;
  try {
    await control.query(`CREATE DATABASE \`${schema}\``);
    created = true;
    db = new DataSource({
      type: 'mysql', host, port: connection.port, username: connection.user,
      password: connection.password, database: schema,
      entities: [path.resolve(__dirname, '../dist/src/database/entities/*.entity.js')],
      synchronize: true, logging: false, extra: { connectionLimit: 5 },
    });
    await db.initialize();
    await db.query(`INSERT INTO properties
      (id,title,description,property_type,listing_type,status,city,state,country,approval_status,slug,property_code)
      VALUES (2640,'Memory fixture',?,'apartment','Sell','available','Coimbatore','Tamil Nadu','India','Approved','memory-fixture-ap2640','AP2640')`,
      ['Property description. '.repeat(100)]);
    await db.query("INSERT INTO property_details (property_id,bedrooms,bathrooms,area_sqft,parking) VALUES (2640,2,2,1200,1)");
    await db.query("INSERT INTO cities (id,city_name,state_name) VALUES (1,'Coimbatore','Tamil Nadu')");
    await db.query("INSERT INTO sublocations (id,city_id,locality_name) VALUES (1,1,'Saravanampatti')");
    await db.query('INSERT INTO property_locations (property_id,location_id) VALUES (2640,1)');
    for (let i = 1; i <= amenities; i++) {
      await db.query('INSERT INTO amenities (id,name,slug) VALUES (?,?,?)', [i, 'Amenity '+i, 'amenity-'+i]);
      await db.query('INSERT INTO property_amenities (property_id,amenity_id) VALUES (2640,?)', [i]);
    }
    for (let i = 1; i <= furnishings; i++) {
      await db.query('INSERT INTO furnishing_items (id,name,slug) VALUES (?,?,?)', [i, 'Furnishing '+i, 'furnishing-'+i]);
      await db.query('INSERT INTO property_furnishings (property_id,furnishing_item_id) VALUES (2640,?)', [i]);
    }
    for (let i = 1; i <= images; i++)
      await db.query('INSERT INTO property_images (property_id,image_url,image_key,is_primary) VALUES (2640,?,?,?)', ['uploads/'+i+'.webp', 'uploads/'+i+'.webp', i === 1]);
    for (let i = 1; i <= faqs; i++)
      await db.query('INSERT INTO property_faqs (property_id,question,answer) VALUES (2640,?,?)', ['Question '+i, 'Answer '+i]);
    await db.query("INSERT INTO property_seo (property_id,seo_data) VALUES (2640,?)", [JSON.stringify({ overview: { title: 'Fixture SEO' } })]);

    let maxRows = 0, queryCount = 0;
    const createQueryRunner = db.createQueryRunner.bind(db);
    db.createQueryRunner = (...args) => {
      const runner = createQueryRunner(...args);
      const query = runner.query.bind(runner);
      runner.query = async (...input) => {
        const result = await query(...input);
        const rows = Array.isArray(result) ? result : result?.records;
        if (Array.isArray(rows)) maxRows = Math.max(maxRows, rows.length);
        queryCount++;
        return result;
      };
      return runner;
    };
    const repository = db.getRepository(Property);
    if (baseline) {
      const findOne = repository.findOne.bind(repository);
      repository.findOne = (options) => findOne({ ...options, relationLoadStrategy: 'join' });
    }
    const storage = {
      generateReadUrl: (key) => key.startsWith('https:') ? key : 'https://cdn.example/'+key,
      resolveImageUrls: (items) => items.map((item) => ({ ...item, imageUrl: 'https://cdn.example/'+item.imageUrl })),
    };
    const admin = new AdminPropertiesService(db, storage, {});
    const service = new PropertiesService(repository, admin, db, storage, {});
    const check = (result, nested = true) => {
      assert.equal(result.id, 2640);
      assert.equal(result.propertyImages.length, images);
      assert.equal(result.propertyAmenities.length, amenities);
      assert.equal(result.propertyFurnishings.length, furnishings);
      assert.equal(result.faqs.length, faqs);
      assert.equal(result.propertyDetails.bedrooms, 2);
      if (nested) assert.equal(result.propertyLocations[0].sublocation.localityName, 'Saravanampatti');
      assert.equal(result.propertyAmenities[0].amenity.name, 'Amenity 1');
      assert.equal(result.propertyFurnishings[0].furnishingItem.name, 'Furnishing 1');
      assert.equal(result.propertyUnits.length, 0);
      assert.equal(result.propertyFiles.length, 0);
      assert.equal(new Set(result.propertyImages.map((image) => image.id)).size, images);
    };
    const before = process.memoryUsage();
    const started = Date.now();
    const samples = [];
    let peakRssMiB = 0;
    for (let i = 0; i < iterations; i++) {
      const result = await service.detailsBySlug('memory-fixture-ap2640');
      check(result);
      assert.equal(result.seo.seoData.overview.title, 'Fixture SEO');
      // Exercise Express's response serialization too, including lazy-relation backing fields.
      JSON.stringify(result);
      const usage = process.memoryUsage();
      peakRssMiB = Math.max(peakRssMiB, Math.round(usage.rss/1024/1024));
      if ([10,100,500,1000].includes(i+1)) samples.push({lookups: i+1, rssMiB: Math.round(usage.rss/1024/1024), heapMiB: Math.round(usage.heapUsed/1024/1024)});
    }
    check(await service.details('apartment', 2640));
    const recovered = await service.detailsBySlug('memory-fixture-ap02640');
    check(recovered, false);
    assert.equal(recovered.shouldRedirect, true);
    check(await admin.details('apartment', 2640));
    await assert.rejects(service.detailsBySlug('missing-ap999999'), /Property not found/);
    if (baseline) assert(maxRows >= amenities * furnishings * images * faqs);
    else assert(maxRows <= Math.max(...sizes), `A query materialized ${maxRows} rows: independent collections were multiplied`);
    if (global.Bun) Bun.gc(true);
    console.log(JSON.stringify({
      mode: baseline ? 'joined-baseline' : 'separate-relations', iterations,
      theoreticalJoinRows: amenities * furnishings * images * faqs,
      maxRowsPerQuery: maxRows, queryCount, elapsedMs: Date.now()-started,
      peakRssMiB, samples,
      rssBeforeMiB: Math.round(before.rss/1024/1024),
      rssAfterMiB: Math.round(process.memoryUsage().rss/1024/1024),
      heapAfterMiB: Math.round(process.memoryUsage().heapUsed/1024/1024),
      collectionsAndNestedDataPreserved: true,
    }, null, 2));
  } finally {
    if (db?.isInitialized) await db.destroy();
    if (created) await control.query(`DROP DATABASE \`${schema}\``);
    await control.end();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
