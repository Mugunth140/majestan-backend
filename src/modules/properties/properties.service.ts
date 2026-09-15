import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
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

// Best-known built-up area across the details columns (stored as strings).
const AREA_EXPR = `COALESCE(CAST(NULLIF(TRIM(details.superBuiltUpArea), '') AS DECIMAL(12,2)), CAST(NULLIF(TRIM(details.areaSqft), '') AS DECIMAL(12,2)), CAST(NULLIF(TRIM(details.carpetArea), '') AS DECIMAL(12,2)))`;

function toStrList(v: unknown): string[] {
  if (v === undefined || v === null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((x) => String(x).trim()).filter(Boolean);
}

function normFacing(v: string): string {
  return v.trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
}

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

  /**
   * Applies the listing-UI filters (price/area ranges, bedrooms, facing,
   * furnishing, age) to any property query builder that already joins
   * `propertyDetails` as `details`. Shared by the DB and Meilisearch paths
   * so both honor the same filters.
   */
  private applyListingFilters(qb: SelectQueryBuilder<Property>, query: PropertySearchQueryDto): void {
    const minP = parseFloat(String(query.minPrice ?? ''));
    if (Number.isFinite(minP)) {
      qb.andWhere('CAST(p.price AS DECIMAL(12,2)) >= :fMinPrice', { fMinPrice: minP });
    }
    const maxP = parseFloat(String(query.maxPrice ?? ''));
    if (Number.isFinite(maxP)) {
      qb.andWhere('CAST(p.price AS DECIMAL(12,2)) <= :fMaxPrice', { fMaxPrice: maxP });
    }
    const minA = parseFloat(String(query.minArea ?? ''));
    if (Number.isFinite(minA)) {
      qb.andWhere(`${AREA_EXPR} >= :fMinArea`, { fMinArea: minA });
    }
    const maxA = parseFloat(String(query.maxArea ?? ''));
    if (Number.isFinite(maxA)) {
      qb.andWhere(`${AREA_EXPR} <= :fMaxArea`, { fMaxArea: maxA });
    }
    if (query.bedrooms !== undefined && query.bedrooms !== null && String(query.bedrooms).trim() !== '') {
      const b = String(query.bedrooms).trim();
      if (b.endsWith('+')) {
        const n = parseInt(b, 10);
        if (Number.isFinite(n)) qb.andWhere('details.bedrooms >= :fBedrooms', { fBedrooms: n });
      } else {
        const n = parseInt(b, 10);
        if (Number.isFinite(n)) qb.andWhere('details.bedrooms = :fBedrooms', { fBedrooms: n });
      }
    }
    const facings = toStrList(query.facing).map(normFacing).filter(Boolean);
    if (facings.length > 0) {
      qb.andWhere(`LOWER(REPLACE(TRIM(details.propertyFacing), '-', ' ')) IN (:...fFacings)`, { fFacings: facings });
    }
    const furnishings = toStrList(query.furnishing).map((s) => s.toLowerCase());
    if (furnishings.length > 0) {
      const parts: string[] = [];
      if (furnishings.includes('furnished')) parts.push('details.furnished = TRUE');
      if (furnishings.includes('unfurnished')) parts.push('details.furnished = FALSE');
      if (furnishings.includes('semi')) parts.push(`LOWER(details.furnishingStatus) LIKE '%semi%'`);
      const uniq = [...new Set(parts)];
      if (uniq.length > 0) qb.andWhere(`(${uniq.join(' OR ')})`);
    }
    const ages = [...toStrList((query as any).propertyAge), ...toStrList((query as any).age)].map((s) => s.toLowerCase());
    if (ages.length > 0) {
      const parts: string[] = [];
      let i = 0;
      for (const a of ages) {
        if (a === 'new') {
          parts.push(`LOWER(details.propertyAge) LIKE '%new%'`);
        } else if (a === '1-5') {
          parts.push(`CAST(details.propertyAge AS UNSIGNED) BETWEEN 1 AND 5`);
        } else if (a === '5-10') {
          parts.push(`CAST(details.propertyAge AS UNSIGNED) BETWEEN 5 AND 10`);
        } else if (a === '10+') {
          parts.push(`CAST(details.propertyAge AS UNSIGNED) >= 10`);
        } else {
          parts.push(`LOWER(details.propertyAge) LIKE :fAge${i}`);
          qb.setParameter(`fAge${i}`, `%${a}%`);
        }
        i++;
      }
      if (parts.length > 0) qb.andWhere(`(${parts.join(' OR ')})`);
    }
  }

  async search(query: PropertySearchQueryDto): Promise<SearchResult> {
    if (this.searchService?.isEnabled() && query.propertyName && query.propertyName.trim().length >= 2) {
      try {
        const dbPropertyType = query.propertyType ? normalizePropertyType(query.propertyType as string) : undefined;
        const meili = await this.searchService.search(query.propertyName, { propertyType: dbPropertyType, listingType: query.listingType, location: query.location || query.city }, query.page || 1, query.limit || 10);
        if (meili.hits.length > 0) {
          const ids = meili.hits.map((h: any) => h.id);
          const meiliQb = this.propertyRepository.createQueryBuilder('p')
            .leftJoinAndSelect('p.propertyDetails', 'details')
            .leftJoinAndSelect('p.propertyLocations', 'locations')
            .leftJoinAndSelect('p.propertyImages', 'images', 'images.isPrimary = true')
            .leftJoinAndSelect('p.propertyUnits', 'units')
            .where('p.id IN (:...ids)', { ids })
            .andWhere('p.status = :status', { status: PropertyStatus.AVAILABLE });
          this.applyListingFilters(meiliQb, query);
          const props = await meiliQb.getMany();
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
      qb.leftJoin('locations.sublocation', 'subloc');
      qb.andWhere('(p.city = :location OR subloc.localityName = :location)', { location: query.location });
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

    // Singular listing-UI filters (price/area bounds, bedrooms, facing,
    // furnishing, age) shared with the Meilisearch path above.
    this.applyListingFilters(qb, query);

    if (query.sort === PropertySortOption.PriceLowToHigh) {
      qb.orderBy('p.price', 'ASC');
    } else if (query.sort === PropertySortOption.PriceHighToLow) {
      qb.orderBy('p.price', 'DESC');
    } else if (query.sort === PropertySortOption.AreaLowToHigh || query.sort === PropertySortOption.AreaHighToLow) {
      // Computed expression can't go in orderBy directly (alias resolution),
      // so select it under an alias first, then order by the alias.
      qb.addSelect(AREA_EXPR, 'f_area_sort');
      qb.orderBy('f_area_sort', query.sort === PropertySortOption.AreaLowToHigh ? 'ASC' : 'DESC');
    } else {
      qb.orderBy('p.createdAt', 'DESC');
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    const mappedItems = await Promise.all(items.map(async p => {
      const images = await p.propertyImages;
      // Strip the internal area-sort helper select so it never leaks into the API response
      const { f_area_sort: _areaSort, ...rest } = p as any;
      void _areaSort;
      return {
        ...rest,
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