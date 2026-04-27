import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { ListingType } from '../../common/enums/listing-type.enum';
import { PropertyType } from '../../common/enums/property-type.enum';
import { parseIndianNumber } from '../../common/utils/parse-indian-number.util';
import {
  PropertyTableConfig,
  getPropertyConfig,
  resolvePropertyType,
} from './constants/property-table.config';
import { PropertySearchQueryDto, PropertySortOption } from './dto/property-search.dto';

type SortDirection = 'ASC' | 'DESC';

type SearchResult = {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
};

type RawProperty = {
  id: number;
  posttype?: ListingType;
  [key: string]: unknown;
};

@Injectable()
export class PropertiesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async search(query: PropertySearchQueryDto): Promise<SearchResult> {
    if (query.propertyType) {
      return this.searchSingleType(query.propertyType, query);
    }

    const aggregateRows: Record<string, unknown>[] = [];

    for (const propertyType of Object.values(PropertyType)) {
      const rows = await this.fetchRowsForType(propertyType, query, false);
      aggregateRows.push(...rows);
    }

    const sortedRows = this.sortInMemory(aggregateRows, query.sort);
    const startIndex = (query.page - 1) * query.limit;

    return {
      items: sortedRows.slice(startIndex, startIndex + query.limit).map((row) =>
        this.cleanInternalFields(row),
      ),
      total: sortedRows.length,
      page: query.page,
      limit: query.limit,
    };
  }

  async details(propertyTypeRaw: string, id: number): Promise<Record<string, unknown>> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('Invalid property id');
    }

    const propertyType = this.ensurePropertyType(propertyTypeRaw);
    const config = getPropertyConfig(propertyType);

    const property = await this.dataSource
      .createQueryBuilder()
      .select('p.*')
      .from(config.table, 'p')
      .where('p.id = :id', { id })
      .andWhere('p.status = :status', { status: 1 })
      .limit(1)
      .getRawOne<RawProperty>();

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    return this.cleanInternalFields(this.mapProperty(propertyType, config, property));
  }

  private ensurePropertyType(value: string): PropertyType {
    const resolvedType = resolvePropertyType(value);

    if (!resolvedType) {
      throw new BadRequestException('Unsupported property type');
    }

    return resolvedType;
  }

  private async searchSingleType(
    propertyType: PropertyType,
    query: PropertySearchQueryDto,
  ): Promise<SearchResult> {
    const config = getPropertyConfig(propertyType);
    const baseQuery = this.buildBaseQuery(config, query);
    const total = await baseQuery.clone().getCount();

    const dataQuery = baseQuery.clone().select('p.*');
    const sortOrder = this.buildSortOrder(config, query.sort, query.listingType);

    if (sortOrder) {
      dataQuery.orderBy(sortOrder.expression, sortOrder.direction);
    } else {
      dataQuery.orderBy('p.id', 'DESC');
    }

    const dataRows = await dataQuery
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)
      .getRawMany<RawProperty>();

    return {
      items: dataRows.map((row) => this.cleanInternalFields(this.mapProperty(propertyType, config, row))),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  private async fetchRowsForType(
    propertyType: PropertyType,
    query: PropertySearchQueryDto,
    paginated: boolean,
  ): Promise<Record<string, unknown>[]> {
    const config = getPropertyConfig(propertyType);
    const dataQuery = this.buildBaseQuery(config, query).select('p.*');
    const sortOrder = this.buildSortOrder(config, query.sort, query.listingType);

    if (sortOrder) {
      dataQuery.orderBy(sortOrder.expression, sortOrder.direction);
    } else {
      dataQuery.orderBy('p.id', 'DESC');
    }

    if (paginated) {
      dataQuery.limit(query.limit).offset((query.page - 1) * query.limit);
    }

    const rows = await dataQuery.getRawMany<RawProperty>();
    return rows.map((row) => this.mapProperty(propertyType, config, row));
  }

  private mapProperty(
    propertyType: PropertyType,
    config: PropertyTableConfig,
    row: RawProperty,
  ): Record<string, unknown> {
    const sellPrice = this.parseNumericValue(row[config.sellPriceColumn]);
    const rentPrice = config.rentPriceColumn
      ? this.parseNumericValue(row[config.rentPriceColumn])
      : null;
    const area = this.parseNumericValue(row[config.areaColumn]);

    return {
      ...row,
      propertyType,
      legacyPropertyType: config.legacyWishlistType,
      __sortPriceSell: sellPrice,
      __sortPriceRent: rentPrice,
      __sortArea: area,
    };
  }

  private cleanInternalFields(row: Record<string, unknown>): Record<string, unknown> {
    const clone = { ...row };

    delete clone.__sortPriceSell;
    delete clone.__sortPriceRent;
    delete clone.__sortArea;

    return clone;
  }

  private buildBaseQuery(
    config: PropertyTableConfig,
    query: PropertySearchQueryDto,
  ): SelectQueryBuilder<Record<string, unknown>> {
    const queryBuilder = this.dataSource
      .createQueryBuilder()
      .from(config.table, 'p')
      .where('p.status = :status', { status: 1 });

    if (query.listingType) {
      queryBuilder.andWhere('p.posttype = :listingType', {
        listingType: query.listingType,
      });
    }

    if (query.location) {
      queryBuilder.andWhere(`p.${config.locationColumn} = :location`, {
        location: query.location,
      });
    }

    if (query.propertyName) {
      queryBuilder.andWhere(
        `(p.${config.nameColumn} LIKE :propertySearch OR p.${config.locationColumn} LIKE :propertySearch)`,
        {
          propertySearch: `%${query.propertyName}%`,
        },
      );
    }

    this.applyRangeFilter(
      queryBuilder,
      query.priceRanges,
      query.listingType === ListingType.Rent && config.rentPriceColumn
        ? config.rentPriceColumn
        : config.sellPriceColumn,
      'priceRange',
    );

    this.applyRangeFilter(queryBuilder, query.sqftRanges, config.areaColumn, 'sqftRange');
    this.applyInFilter(queryBuilder, query.unitType, config.unitColumn, 'unitTypeValues');
    this.applyInFilter(
      queryBuilder,
      query.furnishing,
      config.furnishingColumn,
      'furnishingValues',
    );
    this.applyInFilter(queryBuilder, query.floor, config.floorColumn, 'floorValues');
    this.applyInFilter(queryBuilder, query.facing, config.facingColumn, 'facingValues');
    this.applyInFilter(queryBuilder, query.age, config.ageColumn, 'ageValues');
    this.applyInFilter(
      queryBuilder,
      query.propertyUse,
      config.propertyUseColumn,
      'propertyUseValues',
    );

    return queryBuilder;
  }

  private applyInFilter(
    queryBuilder: SelectQueryBuilder<Record<string, unknown>>,
    values: string[] | undefined,
    column?: string,
    paramKey = 'values',
  ): void {
    if (!values || values.length === 0 || !column) {
      return;
    }

    queryBuilder.andWhere(`p.${column} IN (:...${paramKey})`, {
      [paramKey]: values,
    });
  }

  private applyRangeFilter(
    queryBuilder: SelectQueryBuilder<Record<string, unknown>>,
    ranges: string[] | undefined,
    column: string,
    paramKeyPrefix: string,
  ): void {
    if (!ranges || ranges.length === 0) {
      return;
    }

    const rangeClauses: string[] = [];
    const parameters: Record<string, number> = {};

    for (const [index, range] of ranges.entries()) {
      const [rawMin, rawMax] = range.split('-').map((part) => part.trim());
      const minValue = parseIndianNumber(rawMin);
      const maxValue = rawMax ? parseIndianNumber(rawMax) : null;

      if (!Number.isFinite(minValue)) {
        continue;
      }

      if (maxValue !== null && Number.isFinite(maxValue)) {
        const minKey = `${paramKeyPrefix}Min${index}`;
        const maxKey = `${paramKeyPrefix}Max${index}`;
        rangeClauses.push(
          `CAST(p.${column} AS DECIMAL(18, 2)) BETWEEN :${minKey} AND :${maxKey}`,
        );
        parameters[minKey] = minValue;
        parameters[maxKey] = maxValue;
      } else {
        const minKey = `${paramKeyPrefix}Min${index}`;
        rangeClauses.push(`CAST(p.${column} AS DECIMAL(18, 2)) >= :${minKey}`);
        parameters[minKey] = minValue;
      }
    }

    if (rangeClauses.length > 0) {
      queryBuilder.andWhere(`(${rangeClauses.join(' OR ')})`, parameters);
    }
  }

  private buildSortOrder(
    config: PropertyTableConfig,
    sort: PropertySortOption | undefined,
    listingType: ListingType | undefined,
  ): { expression: string; direction: SortDirection } | null {
    if (!sort) {
      return null;
    }

    if (sort === PropertySortOption.AreaLowToHigh) {
      return {
        expression: `CAST(p.${config.areaColumn} AS UNSIGNED)`,
        direction: 'ASC',
      };
    }

    if (sort === PropertySortOption.AreaHighToLow) {
      return {
        expression: `CAST(p.${config.areaColumn} AS UNSIGNED)`,
        direction: 'DESC',
      };
    }

    const direction: SortDirection =
      sort === PropertySortOption.PriceLowToHigh ? 'ASC' : 'DESC';

    if (listingType === ListingType.Sell) {
      return {
        expression: `CAST(p.${config.sellPriceColumn} AS UNSIGNED)`,
        direction,
      };
    }

    if (listingType === ListingType.Rent) {
      const rentColumn = config.rentPriceColumn ?? config.sellPriceColumn;
      return {
        expression: `CAST(p.${rentColumn} AS UNSIGNED)`,
        direction,
      };
    }

    if (config.rentPriceColumn) {
      return {
        expression: `CASE WHEN p.posttype = 'Sell' THEN CAST(p.${config.sellPriceColumn} AS UNSIGNED) WHEN p.posttype = 'Rent' THEN CAST(p.${config.rentPriceColumn} AS UNSIGNED) ELSE 0 END`,
        direction,
      };
    }

    return {
      expression: `CAST(p.${config.sellPriceColumn} AS UNSIGNED)`,
      direction,
    };
  }

  private sortInMemory(
    rows: Record<string, unknown>[],
    sort: PropertySortOption | undefined,
  ): Record<string, unknown>[] {
    const cloned = [...rows];

    if (!sort) {
      return cloned.sort((a, b) => this.toNumber(b.id) - this.toNumber(a.id));
    }

    const direction =
      sort === PropertySortOption.AreaHighToLow || sort === PropertySortOption.PriceHighToLow
        ? -1
        : 1;

    if (sort === PropertySortOption.AreaLowToHigh || sort === PropertySortOption.AreaHighToLow) {
      return cloned.sort(
        (a, b) =>
          (this.toNumber(a.__sortArea) - this.toNumber(b.__sortArea)) * direction,
      );
    }

    return cloned.sort((a, b) => {
      const aValue = this.toNumber(a.__sortPriceSell ?? a.__sortPriceRent);
      const bValue = this.toNumber(b.__sortPriceSell ?? b.__sortPriceRent);

      return (aValue - bValue) * direction;
    });
  }

  private parseNumericValue(value: unknown): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    if (typeof value !== 'string') {
      return 0;
    }

    const cleaned = value.replace(/,/g, '').trim();
    const numeric = Number.parseFloat(cleaned);

    return Number.isFinite(numeric) ? numeric : 0;
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    if (typeof value !== 'string') {
      return 0;
    }

    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
