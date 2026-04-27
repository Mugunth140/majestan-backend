import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AdminEnquiryQueryDto } from './dto/admin-enquiry-query.dto';

@Injectable()
export class AdminEnquiriesService {
  private readonly columnsCache = new Map<string, Set<string>>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listEnquiries(query: AdminEnquiryQueryDto) {
    return this.listFromTable('enquiry', query, [
      'name',
      'email',
      'phone',
      'property_type',
    ]);
  }

  async listSaleEnquiries(query: AdminEnquiryQueryDto) {
    return this.listFromTable(
      'enquiry',
      query,
      ['name', 'email', 'phone', 'property_type'],
      {
        fixedWhere: [`(purchase_type = 'Sell' OR listing_type = 'Sell')`],
      },
    );
  }

  async listPropertySubmissions(query: AdminEnquiryQueryDto) {
    return this.listFromTable('propertydetails', query, [
      'name',
      'email',
      'phone',
      'property_type',
    ]);
  }

  private async listFromTable(
    table: string,
    query: AdminEnquiryQueryDto,
    searchableColumns: string[],
    options?: { fixedWhere?: string[] },
  ) {
    const columns = await this.getColumns(table);
    const queryBuilder = this.dataSource.createQueryBuilder().from(table, 't');

    for (const clause of options?.fixedWhere ?? []) {
      queryBuilder.andWhere(clause);
    }

    if (query.status !== undefined && columns.has('status')) {
      queryBuilder.andWhere('t.status = :status', { status: query.status });
    }

    const trimmedSearch = query.search?.trim();
    if (trimmedSearch) {
      const allowedSearchable = searchableColumns.filter((column) =>
        columns.has(column),
      );

      if (allowedSearchable.length > 0) {
        const searchParams: Record<string, string> = {};
        const clauses = allowedSearchable.map((column, index) => {
          const key = `search${index}`;
          searchParams[key] = `%${trimmedSearch}%`;
          return `t.${column} LIKE :${key}`;
        });

        queryBuilder.andWhere(`(${clauses.join(' OR ')})`, searchParams);
      }
    }

    if (query.propertyType && columns.has('property_type')) {
      queryBuilder.andWhere('t.property_type = :propertyType', {
        propertyType: query.propertyType,
      });
    }

    if (query.purchaseType) {
      const hasPurchaseType = columns.has('purchase_type');
      const hasListingType = columns.has('listing_type');

      if (hasPurchaseType && hasListingType) {
        queryBuilder.andWhere(
          '(t.purchase_type = :purchaseType OR t.listing_type = :purchaseType)',
          {
            purchaseType: query.purchaseType,
          },
        );
      } else if (hasPurchaseType) {
        queryBuilder.andWhere('t.purchase_type = :purchaseType', {
          purchaseType: query.purchaseType,
        });
      } else if (hasListingType) {
        queryBuilder.andWhere('t.listing_type = :purchaseType', {
          purchaseType: query.purchaseType,
        });
      }
    }

    const sortBy =
      query.sortBy && columns.has(query.sortBy) ? query.sortBy : 'id';
    const sortDirection =
      query.sortDirection.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const total = await queryBuilder.clone().getCount();

    const offset = (query.page - 1) * query.limit;
    const rows = await queryBuilder
      .clone()
      .select('t.*')
      .orderBy(`t.${sortBy}`, sortDirection)
      .limit(query.limit)
      .offset(offset)
      .getRawMany<Record<string, unknown>>();

    return {
      items: rows,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  private async getColumns(table: string): Promise<Set<string>> {
    const cached = this.columnsCache.get(table);
    if (cached) {
      return cached;
    }

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      const tableMetadata = await queryRunner.getTable(table);
      const columns = new Set(
        (tableMetadata?.columns ?? []).map((column) => column.name),
      );
      this.columnsCache.set(table, columns);
      return columns;
    } finally {
      await queryRunner.release();
    }
  }
}
