import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PROPERTY_TABLE_CONFIG } from '../../properties/constants/property-table.config';

@Injectable()
export class AdminDashboardService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async summary() {
    const [
      propertyCounts,
      activeLeadsCount,
      localitiesCount,
      publishedBlogsCount,
    ] = await Promise.all([
      this.fetchPropertyCounts(),
      this.fetchSimpleCount('leads', "status = 'new'"),
      this.fetchSimpleCount('cities', 'is_active = 1'),
      this.fetchSimpleCount('blogs', "status = 'published'"),
    ]);

    const totalProperties = Object.values(propertyCounts).reduce((acc, count) => acc + count, 0);

    const recentActivities = await this.fetchRecentActivities();

    return {
      stats: {
        totalProperties,
        activeLeads: activeLeadsCount,
        localities: localitiesCount,
        publishedBlogs: publishedBlogsCount,
      },
      recentActivities,
    };
  }

  private async fetchRecentActivities() {
    // Fetch recent leads
    const recentLeads = await this.dataSource
      .createQueryBuilder()
      .from('leads', 'l')
      .select(['l.name AS title', 'l.created_at AS createdAt'])
      .addSelect("'Lead' AS type")
      .orderBy('l.created_at', 'DESC')
      .limit(4)
      .getRawMany();

    // Fetch recent blogs
    const recentBlogs = await this.dataSource
      .createQueryBuilder()
      .from('blogs', 'b')
      .select(['b.title AS title', 'b.created_at AS createdAt'])
      .addSelect("'Blog' AS type")
      .orderBy('b.created_at', 'DESC')
      .limit(4)
      .getRawMany();

    // Fetch recent properties
    const recentProperties = await this.dataSource
      .createQueryBuilder()
      .from('properties', 'p')
      .select(['p.title AS title', 'p.created_at AS createdAt'])
      .addSelect("'Property' AS type")
      .orderBy('p.created_at', 'DESC')
      .limit(4)
      .getRawMany();

    // Combine and sort
    const activities = [...recentLeads, ...recentBlogs, ...recentProperties]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4)
      .map(item => {
        let title = '';
        let desc = '';
        let iconType = '';
        let status = 'completed';

        if (item.type === 'Lead') {
          title = 'New Lead Received';
          desc = `${item.title} inquired about a property`;
          iconType = 'Users';
          status = 'pending';
        } else if (item.type === 'Blog') {
          title = 'Blog Published';
          desc = `'${item.title}'`;
          iconType = 'FileText';
        } else {
          title = 'Property Added';
          desc = `'${item.title}' was added`;
          iconType = 'Building2';
        }

        return {
          title,
          desc,
          time: new Date(item.createdAt).toISOString(),
          iconType,
          status,
        };
      });

    return activities;
  }

  private async fetchPropertyCounts() {
    const entries = Object.entries(PROPERTY_TABLE_CONFIG);

    const counts = await Promise.all(
      entries.map(([propertyType, config]) =>
        this.fetchSimpleCount(config.table, 'status = 1').then(
          (count) => [propertyType, count] as const,
        ),
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

    const result = await queryBuilder.select('COUNT(*)', 'cnt').getRawOne();
    return parseInt(result?.cnt || '0', 10);
  }
}
