import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RowDataPacket } from 'mysql2/promise';
import { ListingType } from '../../common/enums/listing-type.enum';
import { PropertyType } from '../../common/enums/property-type.enum';
import { parseIndianNumber } from '../../common/utils/parse-indian-number.util';
import { DatabaseService } from '../../database/database.service';
import {
  PropertyTableConfig,
  getPropertyConfig,
  resolvePropertyType,
} from './constants/property-table.config';
import { PropertySearchQueryDto, PropertySortOption } from './dto/property-search.dto';

type SqlValue = string | number | boolean | Date | null;

type SearchResult = {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
};

type RawProperty = RowDataPacket & {
  id: number;
  posttype?: ListingType;
};

@Injectable()
export class PropertiesService {
  constructor(private readonly databaseService: DatabaseService) {}

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

    const rows = await this.databaseService.query<RawProperty[]>(
      `SELECT p.* FROM ${config.table} p WHERE p.id = ? AND p.status = 1 LIMIT 1`,
      [id],
    );

    const property = rows[0];

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
    const { whereSql, params } = this.buildWhereSql(config, query);
    const countSql = `SELECT COUNT(*) AS total FROM ${config.table} p ${whereSql}`;

    const countRows = await this.databaseService.query<RowDataPacket[]>(countSql, params);
    const total = Number((countRows[0]?.total as number | undefined) ?? 0);

    const dataSql = `
      SELECT p.*
      FROM ${config.table} p
      ${whereSql}
      ORDER BY ${this.buildSortClause(config, query.sort, query.listingType)}
      LIMIT ? OFFSET ?
    `;

    const dataRows = await this.databaseService.query<RawProperty[]>(dataSql, [
      ...params,
      query.limit,
      (query.page - 1) * query.limit,
    ]);

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
    const { whereSql, params } = this.buildWhereSql(config, query);
    const dataSql = `
      SELECT p.*
      FROM ${config.table} p
      ${whereSql}
      ORDER BY ${this.buildSortClause(config, query.sort, query.listingType)}
      ${paginated ? 'LIMIT ? OFFSET ?' : ''}
    `;

    const dataParams: SqlValue[] = [...params];

    if (paginated) {
      dataParams.push(query.limit, (query.page - 1) * query.limit);
    }

    const rows = await this.databaseService.query<RawProperty[]>(dataSql, dataParams);
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

  private buildWhereSql(config: PropertyTableConfig, query: PropertySearchQueryDto) {
    const where: string[] = ['p.status = 1'];
    const params: SqlValue[] = [];

    if (query.listingType) {
      where.push('p.posttype = ?');
      params.push(query.listingType);
    }

    if (query.location) {
      where.push(`p.${config.locationColumn} = ?`);
      params.push(query.location);
    }

    if (query.propertyName) {
      where.push(`(p.${config.nameColumn} LIKE ? OR p.${config.locationColumn} LIKE ?)`);
      const search = `%${query.propertyName}%`;
      params.push(search, search);
    }

    this.applyRangeFilter(
      where,
      params,
      query.priceRanges,
      query.listingType === ListingType.Rent && config.rentPriceColumn
        ? config.rentPriceColumn
        : config.sellPriceColumn,
    );

    this.applyRangeFilter(where, params, query.sqftRanges, config.areaColumn);
    this.applyInFilter(where, params, query.unitType, config.unitColumn);
    this.applyInFilter(where, params, query.furnishing, config.furnishingColumn);
    this.applyInFilter(where, params, query.floor, config.floorColumn);
    this.applyInFilter(where, params, query.facing, config.facingColumn);
    this.applyInFilter(where, params, query.age, config.ageColumn);
    this.applyInFilter(where, params, query.propertyUse, config.propertyUseColumn);

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    return { whereSql, params };
  }

  private applyInFilter(
    where: string[],
    params: SqlValue[],
    values: string[] | undefined,
    column?: string,
  ): void {
    if (!values || values.length === 0 || !column) {
      return;
    }

    const placeholders = values.map(() => '?').join(', ');
    where.push(`p.${column} IN (${placeholders})`);
    params.push(...values);
  }

  private applyRangeFilter(
    where: string[],
    params: SqlValue[],
    ranges: string[] | undefined,
    column: string,
  ): void {
    if (!ranges || ranges.length === 0) {
      return;
    }

    const rangeClauses: string[] = [];

    for (const range of ranges) {
      const [rawMin, rawMax] = range.split('-').map((part) => part.trim());
      const minValue = parseIndianNumber(rawMin);
      const maxValue = rawMax ? parseIndianNumber(rawMax) : null;

      if (!Number.isFinite(minValue)) {
        continue;
      }

      if (maxValue !== null && Number.isFinite(maxValue)) {
        rangeClauses.push(`CAST(p.${column} AS DECIMAL(18, 2)) BETWEEN ? AND ?`);
        params.push(minValue, maxValue);
      } else {
        rangeClauses.push(`CAST(p.${column} AS DECIMAL(18, 2)) >= ?`);
        params.push(minValue);
      }
    }

    if (rangeClauses.length > 0) {
      where.push(`(${rangeClauses.join(' OR ')})`);
    }
  }

  private buildSortClause(
    config: PropertyTableConfig,
    sort: PropertySortOption | undefined,
    listingType: ListingType | undefined,
  ): string {
    if (!sort) {
      return 'p.id DESC';
    }

    if (sort === PropertySortOption.AreaLowToHigh) {
      return `CAST(p.${config.areaColumn} AS UNSIGNED) ASC`;
    }

    if (sort === PropertySortOption.AreaHighToLow) {
      return `CAST(p.${config.areaColumn} AS UNSIGNED) DESC`;
    }

    const direction = sort === PropertySortOption.PriceLowToHigh ? 'ASC' : 'DESC';

    if (listingType === ListingType.Sell) {
      return `CAST(p.${config.sellPriceColumn} AS UNSIGNED) ${direction}`;
    }

    if (listingType === ListingType.Rent) {
      const rentColumn = config.rentPriceColumn ?? config.sellPriceColumn;
      return `CAST(p.${rentColumn} AS UNSIGNED) ${direction}`;
    }

    if (config.rentPriceColumn) {
      return `
        CASE
          WHEN p.posttype = 'Sell' THEN CAST(p.${config.sellPriceColumn} AS UNSIGNED)
          WHEN p.posttype = 'Rent' THEN CAST(p.${config.rentPriceColumn} AS UNSIGNED)
          ELSE 0
        END ${direction}
      `;
    }

    return `CAST(p.${config.sellPriceColumn} AS UNSIGNED) ${direction}`;
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

    const cleaned = String(value).replace(/,/g, '').trim();
    const numeric = Number.parseFloat(cleaned);

    return Number.isFinite(numeric) ? numeric : 0;
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }

    const parsed = Number.parseFloat(String(value ?? 0));
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
