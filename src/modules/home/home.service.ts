import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Property, PropertyStatus } from '../../database/entities/property.entity';
import { StorageService } from '../storage/storage.service';

type LocationRow = {
  id: number;
  sublocation: string;
  cityId: number;
  city: string;
  state: string;
  postalCode: string | null;
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
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
  ) {}

  async getHomePage() {
    const [
      sublocations,
      unitTypes,
      banners,
      featuredApartments,
      featuredVillas,
    ] = await Promise.all([
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
      .addSelect('s.locality_name', 'sublocation')
      .addSelect('s.city_id', 'cityId')
      .addSelect('c.city_name', 'city')
      .addSelect('c.state_name', 'state')
      .addSelect('s.postal_code', 'postalCode')
      .from('sublocations', 's')
      .innerJoin('cities', 'c', 'c.id = s.city_id')
      .where('s.is_active = :active', { active: 1 })
      .andWhere('c.is_active = :active', { active: 1 })
      .orderBy('c.city_name', 'ASC')
      .addOrderBy('s.locality_name', 'ASC')
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
    const properties = await this.dataSource.getRepository(Property).find({
      where: {
        propertyType: propertyType as any,
        status: PropertyStatus.AVAILABLE,
      },
      relations: ['propertyImages', 'propertyLocations', 'propertyLocations.sublocation', 'propertyDetails'],
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const suffix = propertyType === 'apartment' ? 'ap' : 'v';

    const mapped = await Promise.all(properties.map(async (p) => {
      const slug = p.slug?.trim() || `${propertyType}-${p.id}`;
      const images = await p.propertyImages;
      let primaryImageUrl = images?.find(img => img.isPrimary)?.imageUrl || images?.[0]?.imageUrl || null;
      
      if (primaryImageUrl) {
        primaryImageUrl = this.storageService.generateReadUrl(primaryImageUrl);
      }

      const locations = await p.propertyLocations;
      const loc = locations?.[0];

      let formattedLocation = p.city;
      if (loc?.sublocation?.localityName) {
        formattedLocation = `${loc.sublocation.localityName}, ${p.city}`;
      }

      return {
        id: p.id,
        propertyType,
        slugUrl: slug,
        propertyName: p.title,
        sublocation: formattedLocation,
        photo: primaryImageUrl,
        postType: p.listingType,
        expectedSalePrice: p.price,
        monthlyRent: p.price,
        pricePerSqft: null,
        detailPath: `/${slug}-${suffix}${p.id}`,
      } as any;
    }));
    return mapped;
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `
      SELECT COUNT(*) AS count
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?
      `,
      [tableName],
    );

    return Number(rows[0]?.count ?? 0) > 0;
  }

  private async columnExists(
    tableName: string,
    columnName: string,
  ): Promise<boolean> {
    const rows = await this.dataSource.query(
      `
      SELECT COUNT(*) AS count
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
      `,
      [tableName, columnName],
    );

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
