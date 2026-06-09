import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property, PropertyType, PropertyStatus } from '../../database/entities/property.entity';
import { PropertySearchQueryDto, PropertySortOption } from './dto/property-search.dto';

function getPropertyIdSuffix(type: PropertyType, id: number): string {
  const map: Record<PropertyType, string> = {
    [PropertyType.APARTMENT]: 'ap',
    [PropertyType.VILLA]: 'vl',
    [PropertyType.PLOT]: 'pl',
    [PropertyType.COMMERCIAL]: 'cm',
    [PropertyType.COWORKING]: 'co',
    [PropertyType.FARMLAND]: 'ag',
    [PropertyType.INDUSTRIAL]: 'in',
    [PropertyType.OTHER]: 'ot',
    [PropertyType.INDIVIDUAL_PORTION]: 'ip',
  };
  const prefix = map[type] || 'pr';
  return `-${prefix}${id}`;
}

type SearchResult = {
  items: Property[];
  total: number;
  page: number;
  limit: number;
};

import { AdminPropertiesService } from '../admin/properties/admin-properties.service';
import { CreatePropertyDto } from '../admin/properties/dto/create-property.dto';
import { DataSource } from 'typeorm';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    private readonly adminPropertiesService: AdminPropertiesService,
    private readonly dataSource: DataSource,
  ) {}

  async getFormData() {
    const amenities = await this.dataSource.query('SELECT id, name FROM amenities WHERE is_active = 1');
    const cities = await this.dataSource.query('SELECT id, city_name, state_name, country_name FROM cities WHERE is_active = 1');
    const sublocations = await this.dataSource.query('SELECT id, city_id, locality_name FROM sublocations WHERE is_active = 1');
    return {
      amenities,
      cities,
      sublocations,
    };
  }

  async submit(propertyType: string, payload: CreatePropertyDto) {
    // Force status to UNAVAILABLE so it goes to admin review
    payload.status = PropertyStatus.UNAVAILABLE;
    return this.adminPropertiesService.create(propertyType, payload);
  }

  async search(query: PropertySearchQueryDto): Promise<SearchResult> {
    const qb = this.propertyRepository.createQueryBuilder('p')
      .leftJoinAndSelect('p.propertyDetails', 'details')
      .leftJoinAndSelect('p.propertyLocations', 'locations')
      .leftJoinAndSelect('p.propertyImages', 'images', 'images.isPrimary = true')
      .where('p.status = :status', { status: PropertyStatus.AVAILABLE });

    if (query.propertyType) {
      qb.andWhere('p.propertyType = :propertyType', { propertyType: query.propertyType });
    }

    if (query.listingType) {
      qb.andWhere('p.listingType = :listingType', { listingType: query.listingType });
    }

    if (query.propertyName) {
      qb.andWhere('(p.title LIKE :search OR p.propertyCode LIKE :search OR p.city LIKE :search)', { search: `%${query.propertyName}%` });
    }

    if (query.location) {
      qb.andWhere('p.city = :location', { location: query.location });
    }

    // Example range filters
    if (query.priceRanges && query.priceRanges.length > 0) {
      const priceFilters = query.priceRanges.map((range, index) => {
        const [min, max] = range.split('-');
        if (max) {
          return `(CAST(p.price AS DECIMAL(12,2)) >= ${min} AND CAST(p.price AS DECIMAL(12,2)) <= ${max})`;
        }
        return `CAST(p.price AS DECIMAL(12,2)) >= ${min}`;
      });
      qb.andWhere(`(${priceFilters.join(' OR ')})`);
    }

    if (query.sort === PropertySortOption.PriceLowToHigh) {
      qb.orderBy('CAST(p.price AS DECIMAL(12,2))', 'ASC');
    } else if (query.sort === PropertySortOption.PriceHighToLow) {
      qb.orderBy('CAST(p.price AS DECIMAL(12,2))', 'DESC');
    } else {
      qb.orderBy('p.createdAt', 'DESC');
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    const mappedItems = items.map(p => ({
      ...p,
      canonicalSlug: p.slug ? `${p.slug}${getPropertyIdSuffix(p.propertyType, p.id)}` : null
    }));

    return { items: mappedItems as any, total, page, limit };
  }

  async details(propertyType: string, id: number): Promise<Property> {
    const property = await this.propertyRepository.findOne({
      where: { id, propertyType: propertyType as PropertyType, status: PropertyStatus.AVAILABLE },
      relations: [
        'propertyDetails',
        'propertyLocations',
        'propertyAmenities',
        'propertyUnits',
        'propertyFiles',
        'propertyImages',
        'faqs'
      ],
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    return property;
  }

  async detailsBySlug(slug: string): Promise<Record<string, unknown>> {
    let property = await this.propertyRepository.findOne({
      where: [
        { slug, status: PropertyStatus.AVAILABLE },
        { propertyCode: slug, status: PropertyStatus.AVAILABLE }
      ],
      relations: [
        'propertyDetails',
        'propertyLocations',
        'propertyAmenities',
        'propertyUnits',
        'propertyFiles',
        'propertyImages',
        'faqs'
      ],
    });

    if (!property) {
      // Try to parse ID suffix like -ap8471
      const match = slug.match(/-([a-z]{2})(\d+)$/);
      if (match) {
        const id = parseInt(match[2], 10);
        property = await this.propertyRepository.findOne({
          where: { id, status: PropertyStatus.AVAILABLE },
          relations: [
            'propertyDetails',
            'propertyLocations',
            'propertyAmenities',
            'propertyUnits',
            'propertyFiles',
            'propertyImages',
            'faqs'
          ],
        });
      }
    }

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const expectedCanonicalSlug = property.slug ? `${property.slug}${getPropertyIdSuffix(property.propertyType, property.id)}` : slug;

    return {
      ...property,
      requestedSlug: slug,
      canonicalSlug: expectedCanonicalSlug,
      shouldRedirect: expectedCanonicalSlug !== slug
    };
  }
}
