import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

type LocationRow = {
  id: number;
  sublocation: string;
};

type UnitTypeRow = {
  id: number;
  unittype: string;
};

type BannerRow = {
  id: number;
  image: string;
  href: string | null;
};

type FeaturedPropertyRow = {
  id: number;
  slugUrl: string | null;
  propertyName: string | null;
  sublocation: string | null;
  photo: string | null;
  postType: string | null;
  expectedSalePrice: string | number | null;
  monthlyRent: string | number | null;
  pricePerSqft: string | number | null;
};

type FeaturedProperty = FeaturedPropertyRow & {
  propertyType: 'apartment' | 'villa';
  detailPath: string;
};

@Injectable()
export class HomeService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getHomePage() {
    const [sublocations, unitTypes, banners, featuredApartments, featuredVillas] =
      await Promise.all([
        this.listSublocations(),
        this.listUnitTypes(),
        this.listBanners(),
        this.listFeaturedProperties('apartment'),
        this.listFeaturedProperties('villa'),
      ]);

    return {
      filters: {
        sublocations,
        unitTypes,
      },
      banners,
      featuredApartments,
      featuredVillas,
    };
  }

  private async listSublocations(): Promise<LocationRow[]> {
    if (!(await this.tableExists('sublocations'))) {
      return [];
    }

    return this.dataSource
      .createQueryBuilder()
      .select('s.id', 'id')
      .addSelect('s.sublocation', 'sublocation')
      .from('sublocations', 's')
      .where('s.status = :status', { status: 1 })
      .orderBy('s.sublocation', 'ASC')
      .getRawMany<LocationRow>();
  }

  private async listUnitTypes(): Promise<UnitTypeRow[]> {
    if (!(await this.tableExists('unittypes'))) {
      return [];
    }

    return this.dataSource
      .createQueryBuilder()
      .select('u.id', 'id')
      .addSelect('u.unittype', 'unittype')
      .from('unittypes', 'u')
      .where('u.status = :status', { status: 1 })
      .orderBy('u.unittype', 'ASC')
      .getRawMany<UnitTypeRow>();
  }

  private async listBanners(): Promise<BannerRow[]> {
    if (!(await this.tableExists('banner'))) {
      return [];
    }

    const imageColumn = await this.firstExistingColumn('banner', [
      'banner_image',
      'image',
    ]);
    const hrefColumn = await this.firstExistingColumn('banner', [
      'banner_link',
      'redirect_url',
    ]);

    if (!imageColumn) {
      return [];
    }

    const query = this.dataSource
      .createQueryBuilder()
      .select('b.id', 'id')
      .addSelect(`b.${imageColumn}`, 'image')
      .addSelect(hrefColumn ? `b.${hrefColumn}` : 'NULL', 'href')
      .from('banner', 'b')
      .where('b.status = :status', { status: 1 });

    if (await this.columnExists('banner', 'banner_type')) {
      query.andWhere('b.banner_type = :bannerType', { bannerType: 1 });
    }

    const rows = await query
      .orderBy('b.id', 'DESC')
      .limit(3)
      .getRawMany<BannerRow>();

    return rows.map((row) => ({
      ...row,
      image: row.image.startsWith('http')
        ? row.image
        : `/assets/images/banner_image/${row.image}`,
      href: row.href && row.href.trim().length > 0 ? row.href : null,
    }));
  }

  private async listFeaturedProperties(
    propertyType: 'apartment' | 'villa',
  ): Promise<FeaturedProperty[]> {
    const table = propertyType === 'apartment' ? 'apartment' : 'villas';
    const codeColumn = propertyType === 'apartment' ? 'apartment_code' : 'villa_code';
    const suffix = propertyType === 'apartment' ? 'ap' : 'v';

    if (!(await this.tableExists(table))) {
      return [];
    }

    const slugColumn = await this.firstExistingColumn(table, ['slug_url', 'slug']);
    const photoColumn = await this.firstExistingColumn(table, ['photo1', 'image']);
    const priceColumn = await this.firstExistingColumn(table, ['price', 'price_per_sqft']);

    const query = this.dataSource
      .createQueryBuilder()
      .select('p.id', 'id')
      .addSelect(slugColumn ? `p.${slugColumn}` : 'NULL', 'slugUrl')
      .addSelect('p.propertyname', 'propertyName')
      .addSelect('p.sublocation', 'sublocation')
      .addSelect(photoColumn ? `p.${photoColumn}` : 'NULL', 'photo')
      .addSelect('p.posttype', 'postType')
      .addSelect('p.expectedsaleprice', 'expectedSalePrice')
      .addSelect('p.monthly_rent', 'monthlyRent')
      .addSelect(priceColumn ? `p.${priceColumn}` : 'NULL', 'pricePerSqft')
      .from(table, 'p')
      .where('p.status = :status', { status: 1 });

    if (await this.columnExists(table, 'featured_property')) {
      query.andWhere('p.featured_property = :featured', { featured: 1 });
    }

    const orderColumn = (await this.columnExists(table, codeColumn)) ? codeColumn : 'id';
    const rows = await query
      .orderBy(`p.${orderColumn}`, 'DESC')
      .limit(10)
      .getRawMany<FeaturedPropertyRow>();

    return rows.map((row) => {
      const slug = row.slugUrl?.trim() || `${propertyType}-${row.id}`;

      return {
        ...row,
        propertyType,
        detailPath: `/${slug}-${suffix}${row.id}`,
      };
    });
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const rows = (await this.dataSource.query(
      `
      SELECT COUNT(*) AS count
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?
      `,
      [tableName],
    )) as { count: number | string }[];

    return Number(rows[0]?.count ?? 0) > 0;
  }

  private async columnExists(
    tableName: string,
    columnName: string,
  ): Promise<boolean> {
    const rows = (await this.dataSource.query(
      `
      SELECT COUNT(*) AS count
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
      `,
      [tableName, columnName],
    )) as { count: number | string }[];

    return Number(rows[0]?.count ?? 0) > 0;
  }

  private async firstExistingColumn(
    tableName: string,
    columnNames: string[],
  ): Promise<string | null> {
    for (const columnName of columnNames) {
      if (await this.columnExists(tableName, columnName)) {
        return columnName;
      }
    }

    return null;
  }
}
