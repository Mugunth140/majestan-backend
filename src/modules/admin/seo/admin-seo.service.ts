import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Property, PropertyStatus } from '../../../database/entities/property.entity';
import { PropertyLocation } from '../../../database/entities/property-location.entity';
import { PropertySeo } from '../../../database/entities/property-seo.entity';
import { UpsertPropertySeoDto } from './dto/upsert-property-seo.dto';
import { LocalityService } from './locality.service';

@Injectable()
export class AdminSeoService {
  constructor(private readonly dataSource: DataSource, private localityService: LocalityService) {}

  async getPropertySeoList(page = 1, limit = 100) {
    const skip = (page - 1) * limit;
    const [properties, total] = await this.dataSource
      .getRepository(Property)
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.seo', 'seo')
      .select([
        'p.id',
        'p.title',
        'p.propertyType',
        'p.status',
        'p.slug',
        'p.propertyCode',
        'seo.id',
        'seo.verificationStatus',
        'seo.approvalStatus',
      ])
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const items = properties.map((p) => {
      const seo = (p as any).seo as PropertySeo | null;
      return {
        id: p.id,
        title: p.title,
        propertyType: p.propertyType,
        status: p.status,
        slug: p.slug,
        propertyCode: p.propertyCode,
        seoId: seo?.id ?? null,
        verificationStatus: seo?.verificationStatus ?? null,
        approvalStatus: seo?.approvalStatus ?? null,
      };
    });

    return { items, total, page, limit };
  }

  async getPropertySeo(propertyId: number) {
    const property = await this.dataSource
      .getRepository(Property)
      .findOne({
        where: { id: propertyId },
        relations: ['seo'],
      });

    if (!property) {
      throw new NotFoundException(`Property with ID ${propertyId} not found`);
    }

    const seo = await property.seo;

    return {
      ...property,
      seo,
    };
  }

  async upsertPropertySeo(propertyId: number, dto: UpsertPropertySeoDto): Promise<PropertySeo> {
    const property = await this.dataSource.getRepository(Property).findOne({ where: { id: propertyId } });
    if (!property) {
      throw new NotFoundException(`Property with ID ${propertyId} not found`);
    }

    // Find or create SEO row outside transaction to allow merge
    let seo = await this.dataSource.getRepository(PropertySeo).findOne({ where: { propertyId } });
    if (!seo) {
      seo = this.dataSource.getRepository(PropertySeo).create({ propertyId, seoData: {} });
    }

    // Deep-merge section data into existing seoData
    const existingData = seo.seoData || {};
    const { verificationStatus, approvalStatus, ...sections } = dto;

    const mergedData: typeof existingData = { ...existingData };
    for (const [key, value] of Object.entries(sections)) {
      if (value !== undefined) {
        mergedData[key] = {
          ...(existingData[key] || {}),
          ...value,
        };
      }
    }
    seo.seoData = mergedData;

    if (verificationStatus !== undefined) {
      seo.verificationStatus = verificationStatus;
    }

    let statusChanged = false;
    if (approvalStatus !== undefined) {
      seo.approvalStatus = approvalStatus;
      if (approvalStatus === 'published' && property.status !== PropertyStatus.AVAILABLE) {
        property.status = PropertyStatus.AVAILABLE;
        statusChanged = true;
      } else if (approvalStatus === 'unpublished' && property.status !== PropertyStatus.UNAVAILABLE) {
        property.status = PropertyStatus.UNAVAILABLE;
        statusChanged = true;
      }
    }

    // Wrap both saves atomically
    const saved = await this.dataSource.transaction(async (manager) => {
      if (statusChanged) {
        await manager.save(property);
      }
      return manager.save(seo!);
    });

    // Trigger frontend revalidation if property has a slug
    if (property.slug) {
      this.triggerFrontendRevalidation(property.slug).catch(console.error);
    }

    return saved;
  }

  private async triggerFrontendRevalidation(slug: string) {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    if (!frontendUrl) {
      console.warn('[AdminSeo] FRONTEND_URL is not set — skipping ISR revalidation');
      return;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      await fetch(`${frontendUrl}/api/revalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          secret: process.env.REVALIDATE_SECRET || 'majestan-isr-secret',
        }),
        signal: controller.signal as any,
      });
      clearTimeout(timeoutId);
    } catch (error) {
      console.error(`Failed to revalidate frontend for slug: ${slug}`, error);
    }
  }

  async generateLocalityData(propertyId: number): Promise<PropertySeo> {
    const loc = await this.dataSource.getRepository(PropertyLocation).findOne({ where: { propertyId } });
    if (!loc || !loc.latitude || !loc.longitude) {
      throw new BadRequestException('Property location does not have latitude and longitude set. Please update it in the properties wizard first.');
    }

    const places = await this.localityService.fetchNearbyPlaces(Number(loc.latitude), Number(loc.longitude));

    // Find or create SEO row
    let seo = await this.dataSource.getRepository(PropertySeo).findOne({ where: { propertyId } });
    if (!seo) {
      seo = this.dataSource.getRepository(PropertySeo).create({ propertyId, seoData: {} });
    }

    const existingData = seo.seoData || {};
    seo.seoData = {
      ...existingData,
      locality: {
        ...(existingData.locality || {}),
        categories: places
      }
    };

    return this.dataSource.getRepository(PropertySeo).save(seo);
  }
}
