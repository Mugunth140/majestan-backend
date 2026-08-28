import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListingPageSeo } from '../../../database/entities/listing-page-seo.entity';
import { UpsertListingPageSeoDto } from './dto/upsert-listing-page-seo.dto';

@Injectable()
export class ListingPageSeoService {
  constructor(
    @InjectRepository(ListingPageSeo)
    private readonly repo: Repository<ListingPageSeo>,
  ) {}

  async findAll(page = 1, limit = 20, search?: string) {
    const qb = this.repo.createQueryBuilder('lps').orderBy('lps.updatedAt', 'DESC');
    if (search) {
      qb.where('lps.pageKey LIKE :search', { search: `%${search}%` });
    }
    qb.skip((page - 1) * limit).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async findByPath(path: string): Promise<ListingPageSeo | null> {
    return this.repo.findOne({ where: { pageKey: path } });
  }

  async findOne(id: number): Promise<ListingPageSeo> {
    const record = await this.repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException(`Listing page SEO ${id} not found`);
    return record;
  }

  async upsertByPath(pageKey: string, dto: UpsertListingPageSeoDto): Promise<ListingPageSeo> {
    let record = await this.repo.findOne({ where: { pageKey } });
    if (!record) {
      record = this.repo.create({ pageKey });
    }
    Object.assign(record, {
      metaTitle: dto.metaTitle ?? record.metaTitle,
      metaDescription: dto.metaDescription ?? record.metaDescription,
      h1: dto.h1 ?? record.h1,
      ogTitle: dto.ogTitle ?? record.ogTitle,
      ogDescription: dto.ogDescription ?? record.ogDescription,
      ogImageUrl: dto.ogImageUrl ?? record.ogImageUrl,
      robotsIndex:
        dto.robotsIndex !== undefined ? (dto.robotsIndex ? 1 : 0) : record.robotsIndex,
      robotsFollow:
        dto.robotsFollow !== undefined ? (dto.robotsFollow ? 1 : 0) : record.robotsFollow,
      customContent: dto.customContent ?? record.customContent,
    });
    return this.repo.save(record);
  }

  async update(id: number, dto: UpsertListingPageSeoDto): Promise<ListingPageSeo> {
    const record = await this.findOne(id);
    Object.assign(record, {
      metaTitle: dto.metaTitle !== undefined ? dto.metaTitle : record.metaTitle,
      metaDescription:
        dto.metaDescription !== undefined ? dto.metaDescription : record.metaDescription,
      h1: dto.h1 !== undefined ? dto.h1 : record.h1,
      ogTitle: dto.ogTitle !== undefined ? dto.ogTitle : record.ogTitle,
      ogDescription:
        dto.ogDescription !== undefined ? dto.ogDescription : record.ogDescription,
      ogImageUrl: dto.ogImageUrl !== undefined ? dto.ogImageUrl : record.ogImageUrl,
      robotsIndex:
        dto.robotsIndex !== undefined ? (dto.robotsIndex ? 1 : 0) : record.robotsIndex,
      robotsFollow:
        dto.robotsFollow !== undefined ? (dto.robotsFollow ? 1 : 0) : record.robotsFollow,
      customContent:
        dto.customContent !== undefined ? dto.customContent : record.customContent,
    });
    return this.repo.save(record);
  }

  async remove(id: number): Promise<{ deleted: true; id: number }> {
    await this.findOne(id); // throws if not found
    await this.repo.delete({ id });
    return { deleted: true, id };
  }
}
