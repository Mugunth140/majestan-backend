import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property, PropertyType, PropertyStatus } from '../../database/entities/property.entity';
import { PropertySearchQueryDto, PropertySortOption } from './dto/property-search.dto';

type SearchResult = {
  items: Property[];
  total: number;
  page: number;
  limit: number;
};

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
  ) {}

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

    return { items, total, page, limit };
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
    const property = await this.propertyRepository.findOne({
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
      throw new NotFoundException('Property not found');
    }

    return {
      ...property,
      requestedSlug: slug,
      canonicalSlug: property.slug,
      shouldRedirect: property.slug !== slug
    };
  }
}
