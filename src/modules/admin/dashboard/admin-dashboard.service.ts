import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PROPERTY_TABLE_CONFIG } from '../../properties/constants/property-table.config';

@Injectable()
export class AdminDashboardService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async summary() {
    const [propertyCounts, enquiryCounts, saleEnquiryCounts, blogCounts, wishlistCounts] =
      await Promise.all([
        this.fetchPropertyCounts(),
        this.fetchSimpleCount('enquiry'),
        this.fetchSimpleCount(
          'enquiry',
          `(purchase_type = 'Sell' OR listing_type = 'Sell')`,
        ),
        this.fetchSimpleCount('blogs', 'status = 1'),
        this.fetchSimpleCount('wishlist', 'status = 1'),
      ]);

    return {
      properties: propertyCounts,
      enquiries: enquiryCounts,
      saleEnquiries: saleEnquiryCounts,
      blogs: blogCounts,
      wishlist: wishlistCounts,
    };
  }

  private async fetchPropertyCounts() {
    const entries = Object.entries(PROPERTY_TABLE_CONFIG);

    const counts = await Promise.all(
      entries.map(([propertyType, config]) =>
        this.fetchSimpleCount(config.table, 'status = 1').then((count) => [
          propertyType,
          count,
        ] as const),
      ),
    );

    const result: Record<string, number> = {};
    for (const [propertyType, count] of counts) {
      result[propertyType] = count;
    }

    return result;
  }

  private async fetchSimpleCount(
    table: string,
    whereClause?: string,
  ): Promise<number> {
    const queryBuilder = this.dataSource.createQueryBuilder().from(table, 't');

    if (whereClause) {
      queryBuilder.where(whereClause);
    }

    return queryBuilder.getCount();
  }
}
