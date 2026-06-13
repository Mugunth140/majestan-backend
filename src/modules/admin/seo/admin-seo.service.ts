import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Property, PropertyStatus } from '../../../database/entities/property.entity';
import { PropertySeo } from '../../../database/entities/property-seo.entity';
import { UpsertPropertySeoDto } from './dto/upsert-property-seo.dto';

@Injectable()
export class AdminSeoService {
  constructor(private readonly dataSource: DataSource) {}

  async getPropertySeoList() {
    const properties = await this.dataSource
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
      .getMany();

    return properties.map((p) => {
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
    const propertyRepo = this.dataSource.getRepository(Property);
    const seoRepo = this.dataSource.getRepository(PropertySeo);

    const property = await propertyRepo.findOne({ where: { id: propertyId } });
    if (!property) {
      throw new NotFoundException(`Property with ID ${propertyId} not found`);
    }

    // Find or create SEO row
    let seo = await seoRepo.findOne({ where: { propertyId } });
    if (!seo) {
      seo = seoRepo.create({ propertyId, seoData: {} });
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
    if (approvalStatus !== undefined) {
      seo.approvalStatus = approvalStatus;
      
      let statusChanged = false;
      if (approvalStatus === 'published' && property.status !== PropertyStatus.AVAILABLE) {
        property.status = PropertyStatus.AVAILABLE;
        statusChanged = true;
      } else if (approvalStatus === 'unpublished' && property.status !== PropertyStatus.UNAVAILABLE) {
        property.status = PropertyStatus.UNAVAILABLE;
        statusChanged = true;
      }
      
      if (statusChanged) {
        await propertyRepo.save(property);
      }
    }

    const saved = await seoRepo.save(seo);

    // Trigger frontend revalidation if property has a slug
    if (property.slug) {
      this.triggerFrontendRevalidation(property.slug).catch(console.error);
    }

    return saved;
  }

  private async triggerFrontendRevalidation(slug: string) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://147.93.168.178:3000';
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
}
