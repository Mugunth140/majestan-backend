import { DataSource } from 'typeorm';
import { Meilisearch } from 'meilisearch';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const host = process.env.MEILI_HOST || 'http://localhost:7700';
  const apiKey = process.env.MEILI_MASTER_KEY || process.env.MEILI_API_KEY || '';
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = Number(process.env.DB_PORT || 3307);
  const dbUser = process.env.DB_USERNAME || 'root';
  const dbPass = process.env.DB_PASSWORD || '8220';
  const dbName = process.env.DB_NAME || 'majestan';

  const ds = new DataSource({
    type: 'mysql',
    host: dbHost,
    port: dbPort,
    username: dbUser,
    password: dbPass,
    database: dbName,
  });
  await ds.initialize();

  const client = new Meilisearch({ host, apiKey: apiKey || undefined });
  const index = client.index('properties');
  try {
    await client.getIndex('properties').catch(async () => {
      await client.createIndex('properties', { primaryKey: 'id' });
    });
    await index.updateSettings({
      searchableAttributes: ['title', 'description', 'city', 'state', 'propertyCode', 'slug', 'propertyType'],
      filterableAttributes: ['propertyType', 'listingType', 'city', 'state', 'status', 'priceNumeric'],
      sortableAttributes: ['priceNumeric', 'createdAt'],
    });
  } catch {}

  const rows: any[] = await ds.query(`SELECT id, title, description, property_code, slug, property_type, listing_type, status, city, state, country, price, created_at FROM properties WHERE status='available'`);
  const docs = rows.map((r) => ({
    id: r.id,
    title: r.title || '',
    description: r.description || '',
    propertyCode: r.property_code,
    slug: r.slug,
    propertyType: r.property_type,
    listingType: r.listing_type,
    status: r.status,
    city: r.city || '',
    state: r.state || '',
    country: r.country || '',
    price: r.price,
    priceNumeric: r.price ? Number(r.price) : 0,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  }));
  await index.deleteAllDocuments().catch(() => {});
  if (docs.length > 0) {
    const task = await index.addDocuments(docs);
    console.log(`Reindex queued task ${task.taskUid} docs=${docs.length}`);
  } else {
    console.log('No docs to index');
  }
  await ds.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
