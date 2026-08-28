import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Meilisearch, Index } from 'meilisearch';
import { Property, PropertyStatus } from '../../database/entities/property.entity';

export type PropertyDocument = {
  id: number;
  title: string;
  description: string;
  propertyCode: string | null;
  slug: string | null;
  propertyType: string;
  listingType: string;
  status: string;
  city: string;
  state: string;
  country: string;
  price: string | null;
  priceNumeric: number;
  createdAt: number;
  locality: string;
  localitySlug: string;
  citySlug: string;
  bedrooms: number | null;
  canonicalUrl: string;
};

const INDEX_NAME = 'properties';

function toSlug(value: string): string {
  return value.trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const PROPERTY_TYPE_SLUG_MAP: Record<string, string> = {
  apartment: 'apartments',
  villa: 'villas',
  plot: 'plots',
  commercial: 'commercial-spaces',
  industrial: 'industrial-spaces',
  individual_portion: 'independent-houses',
  farmland: 'farmlands',
  coworking: 'coworking',
};

@Injectable()
export class SearchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchService.name);
  private client: Meilisearch | null = null;
  private index: Index<PropertyDocument> | null = null;
  private enabled = false;

  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    const host = this.configService.get<string>('meilisearch.host') || process.env.MEILI_HOST || '';
    const apiKey = this.configService.get<string>('meilisearch.apiKey') || process.env.MEILI_MASTER_KEY || process.env.MEILI_API_KEY || '';
    if (host) {
      if (!apiKey) {
        this.logger.warn('Meilisearch enabled but MEILI_MASTER_KEY is empty — server with --master-key requires Bearer auth. Set same key in infra/.env and site/.env / site/majestan-backend/.env then restart both services.');
      }
      try {
        this.client = new Meilisearch({ host, apiKey: apiKey || undefined });
        this.enabled = true;
        this.index = this.client.index<PropertyDocument>(INDEX_NAME);
        this.logger.log(`Meilisearch enabled host=${host} key=${apiKey ? '***' + apiKey.slice(-4) : 'none'}`);
      } catch (e) {
        this.logger.warn(`Meilisearch init failed: ${(e as Error).message}`);
      }
    } else {
      this.logger.warn('Meilisearch disabled — MEILI_HOST not set');
    }
  }

  async onModuleInit() {
    if (!this.enabled || !this.client || !this.index) return;
    try {
      await this.ensureIndex();
    } catch (e) {
      this.logger.warn(`Meilisearch ensureIndex failed: ${(e as Error).message}`);
    }
  }

  async onModuleDestroy() {
    // Meilisearch JS client uses stateless HTTP — no persistent socket to close.
    // Set flags to prevent any in-flight callers from issuing new requests after shutdown.
    this.enabled = false;
    this.client = null;
    this.index = null;
  }

  private async ensureIndex() {
    if (!this.client || !this.index) return;
    try {
      await this.client.getIndex(INDEX_NAME).catch(async () => {
        await this.client!.createIndex(INDEX_NAME, { primaryKey: 'id' });
      });

      const baseSettings: any = {
        searchableAttributes: ['title', 'description', 'city', 'locality', 'state', 'propertyCode', 'slug', 'propertyType'],
        filterableAttributes: ['propertyType', 'listingType', 'city', 'citySlug', 'state', 'status', 'priceNumeric', 'localitySlug', 'bedrooms'],
        sortableAttributes: ['priceNumeric', 'createdAt'],
        rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
        typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 } },
      };

      if (process.env.OPENAI_API_KEY) {
        baseSettings.embedders = {
          openai: {
            source: 'openAi' as any,
            apiKey: process.env.OPENAI_API_KEY,
            model: 'text-embedding-3-small',
            documentTemplate: '{{doc.title}} in {{doc.locality}}, {{doc.city}}. {{doc.propertyType}} for {{doc.listingType}}.',
          },
        };
      }

      await this.index.updateSettings(baseSettings);
      this.logger.log(`Meilisearch index ${INDEX_NAME} ready`);
    } catch (e) {
      const msg = (e as any)?.message || String(e);
      if (msg.includes('Authorization header is missing')) {
        this.logger.warn(`ensureIndex error: ${msg} — MEILI_MASTER_KEY mismatch or not sent. Ensure infra/.env and site/.env have same hex key and restart: infra: docker compose up -d meilisearch && site: docker compose up -d site-backend (or bun run start:dev).`);
      } else {
        this.logger.warn(`ensureIndex error: ${msg}`);
      }
    }
  }

  isEnabled() {
    return this.enabled && !!this.client;
  }

  private async toDocument(p: Property): Promise<PropertyDocument> {
    const priceNumeric = p.price ? Number(p.price) : 0;

    // Relations may be lazy Promises or eagerly loaded arrays — resolve safely
    const locs = await Promise.resolve(p.propertyLocations).catch(() => []) as any[];
    const details = await Promise.resolve(p.propertyDetails).catch(() => null) as any;

    // Extract the first locality name from the resolved locations
    let localityName = '';
    if (Array.isArray(locs) && locs.length > 0) {
      const firstLoc = locs[0];
      // sublocation may itself be a lazy relation
      const sublocation = firstLoc?.sublocation
        ? await Promise.resolve(firstLoc.sublocation).catch(() => null)
        : null;
      localityName = (sublocation as any)?.localityName || '';
    }

    const localitySlug = localityName ? toSlug(localityName) : '';
    const citySlug = p.city ? toSlug(p.city) : '';
    const bedrooms: number | null = details?.bedrooms != null ? Number(details.bedrooms) : null;

    // Build canonical URL
    const listingPrefix = p.listingType === 'Rent' ? 'for-rent' : 'for-sale';
    const ptSlug = PROPERTY_TYPE_SLUG_MAP[p.propertyType] ?? toSlug(p.propertyType);
    const canonicalUrl = localitySlug
      ? `/${listingPrefix}/${ptSlug}/${citySlug}/${localitySlug}`
      : `/${listingPrefix}/${ptSlug}/${citySlug}`;

    return {
      id: p.id,
      title: p.title || '',
      description: p.description || '',
      propertyCode: p.propertyCode,
      slug: p.slug,
      propertyType: p.propertyType,
      listingType: p.listingType,
      status: p.status,
      city: p.city || '',
      state: p.state || '',
      country: p.country || '',
      price: p.price,
      priceNumeric: Number.isFinite(priceNumeric) ? priceNumeric : 0,
      createdAt: p.createdAt ? new Date(p.createdAt).getTime() : Date.now(),
      locality: localityName,
      localitySlug,
      citySlug,
      bedrooms,
      canonicalUrl,
    };
  }

  async indexProperty(propertyId: number) {
    if (!this.enabled || !this.index) return;
    try {
      const repo = this.dataSource.getRepository(Property);
      const prop = await repo.findOne({
        where: { id: propertyId },
        relations: ['propertyLocations', 'propertyLocations.sublocation', 'propertyDetails'],
      });
      if (!prop) {
        await this.deleteProperty(propertyId);
        return;
      }
      if (prop.status !== PropertyStatus.AVAILABLE) {
        await this.deleteProperty(propertyId);
        return;
      }
      const doc = await this.toDocument(prop);
      await this.index.addDocuments([doc]);
    } catch (e) {
      this.logger.warn(`indexProperty ${propertyId} failed: ${(e as Error).message}`);
    }
  }

  async deleteProperty(propertyId: number) {
    if (!this.enabled || !this.index) return;
    try {
      await this.index.deleteDocument(propertyId);
    } catch {}
  }

  async reindexAll(): Promise<{ indexed: number }> {
    if (!this.enabled || !this.index) throw new Error('Meilisearch not enabled');
    const repo = this.dataSource.getRepository(Property);

    await this.index.deleteAllDocuments().catch(() => {});

    const BATCH_SIZE = 500;
    let offset = 0;
    let totalIndexed = 0;

    while (true) {
      const props = await repo.find({
        where: { status: PropertyStatus.AVAILABLE },
        relations: ['propertyLocations', 'propertyLocations.sublocation', 'propertyDetails'],
        take: BATCH_SIZE,
        skip: offset,
      });

      if (props.length === 0) break;

      const docs = await Promise.all(props.map((p) => this.toDocument(p)));
      const task = await this.index.addDocuments(docs);
      this.logger.log(`Reindex batch offset=${offset} count=${docs.length} taskUid=${task.taskUid}`);
      totalIndexed += docs.length;
      offset += BATCH_SIZE;

      if (props.length < BATCH_SIZE) break;
    }

    this.logger.log(`Reindex complete: total=${totalIndexed}`);
    return { indexed: totalIndexed };
  }

  async search(
    query: string,
    filters: { propertyType?: string; listingType?: string; city?: string; locality?: string },
    page: number,
    limit: number,
    useHybrid = false,
  ) {
    if (!this.enabled || !this.index) throw new Error('Meilisearch not enabled');
    const filterParts: string[] = ['status = available'];
    if (filters.propertyType) filterParts.push(`propertyType = "${filters.propertyType}"`);
    if (filters.listingType) filterParts.push(`listingType = "${filters.listingType}"`);
    if (filters.city) filterParts.push(`city = "${filters.city}"`);
    if (filters.locality) filterParts.push(`localitySlug = "${toSlug(filters.locality)}"`);
    const filter = filterParts.join(' AND ');

    const searchOptions: any = {
      filter: filter || undefined,
      page,
      hitsPerPage: limit,
      attributesToRetrieve: ['id', 'title', 'slug', 'propertyType', 'listingType', 'locality', 'localitySlug', 'citySlug', 'bedrooms', 'canonicalUrl', 'city', 'priceNumeric'],
    };

    if (useHybrid && process.env.OPENAI_API_KEY) {
      searchOptions.hybrid = { semanticRatio: 0.5, embedder: 'openai' };
    }

    const res = await this.index.search(query || '', searchOptions);
    return { hits: res.hits, total: (res as any).estimatedTotalHits ?? (res as any).totalHits ?? res.hits.length, page, limit };
  }

  async health(): Promise<{ enabled: boolean; host: string }> {
    return {
      enabled: this.enabled,
      host: this.configService.get<string>('meilisearch.host') || '',
    };
  }
}
