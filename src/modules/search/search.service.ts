import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
};

const INDEX_NAME = 'properties';

@Injectable()
export class SearchService implements OnModuleInit {
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

  private async ensureIndex() {
    if (!this.client || !this.index) return;
    try {
      await this.client.getIndex(INDEX_NAME).catch(async () => {
        await this.client!.createIndex(INDEX_NAME, { primaryKey: 'id' });
      });
      await this.index.updateSettings({
        searchableAttributes: ['title', 'description', 'city', 'state', 'propertyCode', 'slug', 'propertyType'],
        filterableAttributes: ['propertyType', 'listingType', 'city', 'state', 'status', 'priceNumeric'],
        sortableAttributes: ['priceNumeric', 'createdAt'],
        rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
        typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 } },
      });
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

  private toDocument(p: Property): PropertyDocument {
    const priceNumeric = p.price ? Number(p.price) : 0;
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
    };
  }

  async indexProperty(propertyId: number) {
    if (!this.enabled || !this.index) return;
    try {
      const repo = this.dataSource.getRepository(Property);
      const prop = await repo.findOne({ where: { id: propertyId } });
      if (!prop) {
        await this.deleteProperty(propertyId);
        return;
      }
      if (prop.status !== PropertyStatus.AVAILABLE) {
        await this.deleteProperty(propertyId);
        return;
      }
      const doc = this.toDocument(prop);
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
    const props = await repo.find({ where: { status: PropertyStatus.AVAILABLE } });
    const docs = props.map((p) => this.toDocument(p));
    if (docs.length === 0) {
      await this.index.deleteAllDocuments().catch(() => {});
      return { indexed: 0 };
    }
    await this.index.deleteAllDocuments().catch(() => {});
    const task = await this.index.addDocuments(docs);
    this.logger.log(`Reindex queued task ${task.taskUid} docs=${docs.length}`);
    return { indexed: docs.length };
  }

  async search(query: string, filters: { propertyType?: string; listingType?: string; city?: string }, page: number, limit: number) {
    if (!this.enabled || !this.index) throw new Error('Meilisearch not enabled');
    const filterParts: string[] = ['status = available'];
    if (filters.propertyType) filterParts.push(`propertyType = "${filters.propertyType}"`);
    if (filters.listingType) filterParts.push(`listingType = "${filters.listingType}"`);
    if (filters.city) filterParts.push(`city = "${filters.city}"`);
    const filter = filterParts.join(' AND ');
    const res = await this.index.search(query || '', {
      filter: filter || undefined,
      sort: undefined,
      page,
      hitsPerPage: limit,
    });
    return { hits: res.hits, total: (res as any).estimatedTotalHits ?? (res as any).totalHits ?? res.hits.length, page, limit };
  }

  async health(): Promise<{ enabled: boolean; host: string }> {
    return {
      enabled: this.enabled,
      host: this.configService.get<string>('meilisearch.host') || '',
    };
  }
}
