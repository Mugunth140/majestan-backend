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
  const projectsIndex = client.index('projects');
  try {
    await client.getIndex('properties').catch(async () => {
      await client.createIndex('properties', { primaryKey: 'id' });
    });
    await index.updateSettings({
      searchableAttributes: ['title', 'description', 'city', 'state', 'propertyCode', 'slug', 'propertyType'],
      // approvalStatus MUST stay filterable: the app filters
      // `status = available AND approvalStatus = Approved`. Dropping it here
      // breaks all Meili-backed searches until docs are patched back.
      filterableAttributes: ['propertyType', 'listingType', 'city', 'state', 'status', 'approvalStatus', 'priceNumeric'],
      sortableAttributes: ['priceNumeric', 'createdAt'],
    });
  } catch {}

  const rows: any[] = await ds.query(`SELECT id, title, description, property_code, slug, property_type, listing_type, status, approval_status, city, state, country, price, created_at FROM properties WHERE status='available'`);
  const docs = rows.map((r) => ({
    id: r.id,
    title: r.title || '',
    description: r.description || '',
    propertyCode: r.property_code,
    slug: r.slug,
    propertyType: r.property_type,
    listingType: r.listing_type,
    status: r.status,
    approvalStatus: r.approval_status || 'Pending',
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

  // Projects index (keyword-only; no embedders until OPENAI_API_KEY exists).
  try {
    await client.getIndex('projects').catch(async () => {
      await client.createIndex('projects', { primaryKey: 'id' });
    });
    await projectsIndex.updateSettings({
      searchableAttributes: ['name', 'builderName', 'sublocation', 'city', 'projectCode', 'slug', 'projectType'],
      filterableAttributes: ['projectType', 'city', 'citySlug', 'sublocationSlug', 'status', 'possessionStatus', 'minPriceNumeric'],
      sortableAttributes: ['minPriceNumeric', 'createdAt'],
      rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
      typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 } },
    });
  } catch {}

  const projectRows: any[] = await ds.query(
    `SELECT p.id, p.name, p.builder_name, p.project_code, p.slug, p.canonical_slug, p.project_type, p.city, p.state, p.sublocation, p.possession_status, p.status, p.created_at,
       (SELECT MIN(u.price) FROM project_units u WHERE u.project_id = p.id AND u.price > 0) AS min_price
     FROM projects p WHERE p.status='published'`,
  );
  const toSlug = (v: string) =>
    String(v || '').trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const projectDocs = projectRows.map((r) => ({
    id: r.id,
    name: r.name || '',
    builderName: r.builder_name ?? null,
    projectCode: r.project_code ?? null,
    slug: r.slug || '',
    canonicalSlug: r.canonical_slug || '',
    projectType: r.project_type,
    city: r.city || '',
    state: r.state ?? null,
    sublocation: r.sublocation || null,
    sublocationSlug: r.sublocation ? toSlug(r.sublocation) : '',
    citySlug: r.city ? toSlug(r.city) : '',
    possessionStatus: r.possession_status,
    minPriceNumeric: r.min_price != null ? Number(r.min_price) : 0,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    status: r.status,
    canonicalUrl: r.canonical_slug ? `/${r.canonical_slug}` : '',
  }));
  await projectsIndex.deleteAllDocuments().catch(() => {});
  if (projectDocs.length > 0) {
    const task = await projectsIndex.addDocuments(projectDocs);
    console.log(`Reindex projects queued task ${task.taskUid} docs=${projectDocs.length}`);
  } else {
    console.log('No project docs to index');
  }
  await ds.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
