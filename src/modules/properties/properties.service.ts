import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property, PropertyType, PropertyStatus } from '../../database/entities/property.entity';
import { PropertySearchQueryDto, PropertySortOption } from './dto/property-search.dto';

/**
 * Normalizes any property type string (API value, URL slug, legacy value)
 * to the canonical DB enum value stored in the `properties.property_type` column.
 * DB stores: 'apartment','villa','plot','commercial','industrial','individual_portion','farmland','coworking','other'
 */
function normalizePropertyType(value: string): string {
  const map: Record<string, string> = {
    // API / common enum aliases → DB enum values
    'commercial-space':  'commercial',
    'commercialspace':   'commercial',
    'industrial-space':  'industrial',
    'industrialspace':   'industrial',
    'independent-house': 'individual_portion',
    'independenthouse':  'individual_portion',
    'independent_house': 'individual_portion',
    'individual-house':  'individual_portion',
    'individual-portion':'individual_portion',
    // Pass-through values that already match DB enum
    'apartment':         'apartment',
    'villa':             'villa',
    'plot':              'plot',
    'commercial':        'commercial',
    'industrial':        'industrial',
    'individual_portion':'individual_portion',
    'farmland':          'farmland',
    'coworking':         'coworking',
    'other':             'other',
  };
  return map[value.toLowerCase()] ?? value;
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
import { StorageService } from '../storage/storage.service';
import { SearchService } from '../search/search.service';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    private readonly adminPropertiesService: AdminPropertiesService,
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
    private readonly searchService: SearchService,
  ) {}

  async getFormData() {
    const amenities = await this.dataSource.query('SELECT id, name, category, icon_key AS iconKey FROM amenities WHERE is_active = 1');
    const cities = await this.dataSource.query(
      'SELECT id, city_name, state_name, country_name FROM cities WHERE is_active = 1 ORDER BY city_name ASC',
    );
    const sublocations = await this.dataSource.query(
      `SELECT s.id, s.city_id, s.locality_name, s.postal_code
       FROM sublocations s
       INNER JOIN cities c ON c.id = s.city_id
       WHERE s.is_active = 1 AND c.is_active = 1
       ORDER BY c.city_name ASC, s.locality_name ASC`,
    );
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
    if (this.searchService?.isEnabled() && query.propertyName && query.propertyName.trim().length >= 2) {
      try {
        const dbPropertyType = query.propertyType ? normalizePropertyType(query.propertyType as string) : undefined;
        const meili = await this.searchService.search(query.propertyName, { propertyType: dbPropertyType, listingType: query.listingType, city: query.location || query.city }, query.page || 1, query.limit || 10);
        if (meili.hits.length > 0) {
          const ids = meili.hits.map((h: any) => h.id);
          const props = await this.propertyRepository.createQueryBuilder('p')
            .leftJoinAndSelect('p.propertyDetails', 'details')
            .leftJoinAndSelect('p.propertyLocations', 'locations')
            .leftJoinAndSelect('p.propertyImages', 'images', 'images.isPrimary = true')
            .leftJoinAndSelect('p.propertyUnits', 'units')
            .where('p.id IN (:...ids)', { ids })
            .andWhere('p.status = :status', { status: PropertyStatus.AVAILABLE })
            .getMany();
          const byId = new Map(props.map((p) => [p.id, p]));
          const ordered = ids.map((id: number) => byId.get(id)).filter(Boolean) as Property[];
          const mappedItems = await Promise.all(ordered.map(async (p) => {
            const images = await p.propertyImages;
            return { ...p, propertyImages: this.storageService.resolveImageUrls(images || []), images: this.storageService.resolveImageUrls(images || []), canonicalSlug: p.slug ? p.slug : null };
          }));
          return { items: mappedItems as any, total: meili.total, page: query.page || 1, limit: query.limit || 10 };
        }
        if (meili.total === 0) return { items: [], total: 0, page: query.page || 1, limit: query.limit || 10 };
      } catch {}
    }

    const qb = this.propertyRepository.createQueryBuilder('p')
      .leftJoinAndSelect('p.propertyDetails', 'details')
      .leftJoinAndSelect('p.propertyLocations', 'locations')
      .leftJoinAndSelect('p.propertyImages', 'images', 'images.isPrimary = true')
      .leftJoinAndSelect('p.propertyUnits', 'units')
      .where('p.status = :status', { status: PropertyStatus.AVAILABLE });

    if (query.propertyType) {
      const dbPropertyType = normalizePropertyType(query.propertyType as string);
      qb.andWhere('p.propertyType = :propertyType', { propertyType: dbPropertyType });
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

    // Parameterized price range filters (prevent SQL injection)
    if (query.priceRanges && query.priceRanges.length > 0) {
      const priceConditions: string[] = [];
      query.priceRanges.forEach((range, index) => {
        const parts = range.split('-');
        const min = parseFloat(parts[0]);
        const max = parts[1] !== undefined ? parseFloat(parts[1]) : null;
        if (!isFinite(min)) return; // skip malformed entries
        if (max !== null && isFinite(max)) {
          priceConditions.push(`(CAST(p.price AS DECIMAL(12,2)) >= :prMin${index} AND CAST(p.price AS DECIMAL(12,2)) <= :prMax${index})`);
          qb.setParameter(`prMin${index}`, min);
          qb.setParameter(`prMax${index}`, max);
        } else {
          priceConditions.push(`CAST(p.price AS DECIMAL(12,2)) >= :prMin${index}`);
          qb.setParameter(`prMin${index}`, min);
        }
      });
      if (priceConditions.length > 0) {
        qb.andWhere(`(${priceConditions.join(' OR ')})`);
      }
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

    const mappedItems = await Promise.all(items.map(async p => {
      const images = await p.propertyImages;
      return {
        ...p,
        propertyImages: this.storageService.resolveImageUrls(images || []),
        images: this.storageService.resolveImageUrls(images || []),
        canonicalSlug: p.slug ? p.slug : null
      };
    }));

    return { items: mappedItems as any, total, page, limit };
  }

  async details(propertyType: string, id: number): Promise<Record<string, unknown>> {
    const property = await this.propertyRepository.findOne({
      where: { id, propertyType: propertyType as PropertyType, status: PropertyStatus.AVAILABLE },
      relations: [
        'propertyDetails',
        'propertyLocations',
        'propertyAmenities',
        'propertyAmenities.amenity',
        'propertyUnits',
        'propertyFiles',
        'propertyImages',
        'faqs'
      ],
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const [
      propertyDetails,
      propertyLocations,
      propertyAmenitiesRaw,
      propertyUnits,
      propertyFiles,
      propertyImages,
      faqs,
    ] = await Promise.all([
      property.propertyDetails,
      property.propertyLocations,
      property.propertyAmenities,
      property.propertyUnits,
      property.propertyFiles,
      property.propertyImages,
      property.faqs,
    ]);

    const propertyAmenities = propertyAmenitiesRaw ? await Promise.all(
      propertyAmenitiesRaw.map(async (pa) => {
        const amenity = await pa.amenity;
        return { ...pa, amenity };
      })
    ) : [];

    const resolvedImages = this.storageService.resolveImageUrls(propertyImages || []);

    return {
      ...property,
      propertyDetails,
      propertyLocations,
      propertyAmenities,
      propertyUnits,
      propertyFiles,
      propertyImages: resolvedImages,
      images: resolvedImages,
      faqs,
    };
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
        'propertyAmenities.amenity',
        'propertyUnits',
        'propertyFiles',
        'propertyImages',
        'faqs',
        'seo'
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
            'propertyAmenities.amenity',
            'propertyUnits',
            'propertyFiles',
            'propertyImages',
            'faqs',
            'seo'
          ],
        });
      }
    }

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const propertyImages = await property.propertyImages;
    const resolvedImages = this.storageService.resolveImageUrls(
      propertyImages || []
    );

    const expectedCanonicalSlug = property.slug || slug;

    const [
      propertyDetails,
      propertyLocations,
      propertyAmenitiesRaw,
      propertyUnits,
      propertyFiles,
      faqs,
      seo,
    ] = await Promise.all([
      property.propertyDetails,
      property.propertyLocations,
      property.propertyAmenities,
      property.propertyUnits,
      property.propertyFiles,
      property.faqs,
      property.seo,
    ]);

    const propertyAmenities = propertyAmenitiesRaw ? await Promise.all(
      propertyAmenitiesRaw.map(async (pa) => {
        const amenity = await pa.amenity;
        return { ...pa, amenity };
      })
    ) : [];

    if (propertyDetails?.floorPlanImages) {
      propertyDetails.floorPlanImages = this.storageService.resolveImageUrls(
        propertyDetails.floorPlanImages as any
      );
    }

    return {
      ...property,
      propertyDetails,
      propertyLocations,
      propertyAmenities,
      propertyUnits,
      propertyFiles,
      faqs,
      seo,
      propertyImages: resolvedImages,
      images: resolvedImages,
      requestedSlug: slug,
      canonicalSlug: expectedCanonicalSlug,
      shouldRedirect: expectedCanonicalSlug !== slug
    };
  }

  async getAllSlugs(): Promise<string[]> {
    const properties = await this.propertyRepository.find({
      where: { status: PropertyStatus.AVAILABLE },
      select: ['slug', 'propertyCode']
    });
    return properties.map(p => p.slug || p.propertyCode).filter(Boolean) as string[];
  }
}