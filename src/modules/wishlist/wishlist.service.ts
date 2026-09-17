import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PropertyType } from '../../common/enums/property-type.enum';
import {
  PROPERTY_TABLE_CONFIG,
  getPropertyConfig,
  resolvePropertyType,
} from '../properties/constants/property-table.config';
import { WishlistGuestQueryDto } from './dto/wishlist-guest-query.dto';
import { ToggleWishlistDto } from './dto/toggle-wishlist.dto';

type WishlistRow = {
  id: number;
  property_id: number;
  property_type: string;
};

type WishlistListItem = {
  id: number;
  propertyId: number;
  propertyType: PropertyType;
  legacyPropertyType: string;
  property: Record<string, unknown> | null;
};

@Injectable()
export class WishlistService {
  private wishlistColumnsCache: Set<string> | null = null;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(query: WishlistGuestQueryDto) {
    const columns = await this.getWishlistColumns();

    const wishlistQuery = this.dataSource
      .createQueryBuilder()
      .select('wishlist.id', 'id')
      .addSelect('wishlist.property_id', 'property_id')
      .addSelect('wishlist.property_type', 'property_type')
      .from('wishlist', 'wishlist')
      .where('wishlist.user_id = :guestId', { guestId: query.guestId })
      .orderBy('wishlist.id', 'DESC');

    if (columns.has('status')) {
      wishlistQuery.andWhere('wishlist.status = :status', { status: 1 });
    }

    const wishlistRows = await wishlistQuery.getRawMany<WishlistRow>();

    const groupedRows = new Map<string, Array<WishlistRow>>();

    for (const row of wishlistRows) {
      const resolved = this.resolveLegacyType(row.property_type);

      if (!resolved) {
        continue;
      }

      const entries = groupedRows.get(resolved.config.table) ?? [];
      entries.push({
        ...row,
      });
      groupedRows.set(resolved.config.table, entries);
    }

    const propertiesByTable = new Map<
      string,
      Map<number, Record<string, unknown>>
    >();

    await Promise.all(
      Array.from(groupedRows.entries()).map(async ([table, entries]) => {
        const ids = entries.map((entry) => entry.property_id);
        const properties = await this.dataSource
          .createQueryBuilder()
          .select('p.*')
          .from(table, 'p')
          .where('p.id IN (:...ids)', { ids })
          .getRawMany<Record<string, unknown>>();

        propertiesByTable.set(
          table,
          new Map(
            properties.map((property) => [Number(property.id), property]),
          ),
        );
      }),
    );

    const items: WishlistListItem[] = wishlistRows
      .map((row) => {
        const resolved = this.resolveLegacyType(row.property_type);

        if (!resolved) {
          return null;
        }

        // wishlist.property_id is VARCHAR while property PKs are numeric —
        // normalize so the Map lookup actually hits.
        const propertyId = Number(row.property_id);
        const property =
          propertiesByTable.get(resolved.config.table)?.get(propertyId) ??
          null;

        return {
          id: row.id,
          propertyId,
          propertyType: resolved.propertyType,
          legacyPropertyType: row.property_type,
          property,
        };
      })
      .filter((item): item is WishlistListItem => item !== null);

    return {
      items,
      total: items.length,
    };
  }

  async count(query: WishlistGuestQueryDto) {
    const columns = await this.getWishlistColumns();

    const countQuery = this.dataSource
      .createQueryBuilder()
      .from('wishlist', 'wishlist')
      .where('wishlist.user_id = :guestId', { guestId: query.guestId });

    if (columns.has('status')) {
      countQuery.andWhere('wishlist.status = :status', { status: 1 });
    }

    // NB: getCount() crashes on a raw .from() builder (no entity metadata),
    // so count explicitly instead.
    const countRow = await countQuery
      .select('COUNT(1)', 'cnt')
      .getRawOne<{ cnt: string | number }>();

    return {
      total: Number(countRow?.cnt ?? 0),
    };
  }

  async toggle(payload: ToggleWishlistDto) {
    const propertyType = this.ensurePropertyType(payload.propertyType);
    const config = getPropertyConfig(propertyType);

    const columns = await this.getWishlistColumns();

    const existingQuery = this.dataSource
      .createQueryBuilder()
      .select('wishlist.id', 'id')
      .from('wishlist', 'wishlist')
      .where('wishlist.user_id = :guestId', { guestId: payload.guestId })
      .andWhere('wishlist.property_id = :propertyId', {
        propertyId: payload.propertyId,
      })
      .andWhere('wishlist.property_type = :propertyType', {
        propertyType: config.legacyWishlistType,
      })
      .limit(1);

    if (columns.has('status')) {
      existingQuery.andWhere('wishlist.status = :status', { status: 1 });
    }

    const existing = await existingQuery.getRawOne<{ id: number }>();

    // Removing an existing save always succeeds — even if the underlying
    // property was deleted/unpublished since (stale rows must be removable).
    if (existing) {
      await this.dataSource
        .createQueryBuilder()
        .delete()
        .from('wishlist')
        .where('id = :id', { id: existing.id })
        .execute();

      const count = await this.count({ guestId: payload.guestId });

      return {
        wished: false,
        total: count.total,
      };
    }

    await this.ensurePropertyExists(config.table, payload.propertyId);

    await this.insertWishlistRow(
      columns,
      payload.guestId,
      payload.propertyId,
      config.legacyWishlistType,
    );

    const count = await this.count({ guestId: payload.guestId });

    return {
      wished: true,
      total: count.total,
    };
  }

  private ensurePropertyType(value: string): PropertyType {
    const propertyType = resolvePropertyType(value);

    if (!propertyType) {
      throw new BadRequestException('Unsupported property type');
    }

    return propertyType;
  }

  private async ensurePropertyExists(
    table: string,
    propertyId: number,
  ): Promise<void> {
    const publishedStatus =
      Object.values(PROPERTY_TABLE_CONFIG).find((c) => c.table === table)
        ?.publishedStatus ?? 1;
    const row = await this.dataSource
      .createQueryBuilder()
      .select('p.id', 'id')
      .from(table, 'p')
      .where('p.id = :propertyId', { propertyId })
      .andWhere('p.status = :status', { status: publishedStatus })
      .limit(1)
      .getRawOne<{ id: number }>();

    if (!row) {
      throw new NotFoundException('Property not found');
    }
  }

  private async getWishlistColumns(): Promise<Set<string>> {
    if (this.wishlistColumnsCache) {
      return this.wishlistColumnsCache;
    }

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      const table = await queryRunner.getTable('wishlist');
      this.wishlistColumnsCache = new Set(
        (table?.columns ?? []).map((column) => column.name.toLowerCase()),
      );
    } finally {
      await queryRunner.release();
    }

    if (!this.wishlistColumnsCache) {
      this.wishlistColumnsCache = new Set<string>();
    }

    return this.wishlistColumnsCache;
  }

  private async insertWishlistRow(
    columns: Set<string>,
    guestId: string,
    propertyId: number,
    legacyPropertyType: string,
  ): Promise<void> {
    const values: Record<string, unknown> = {
      user_id: guestId,
      property_id: propertyId,
      property_type: legacyPropertyType,
    };

    if (columns.has('status')) {
      values.status = 1;
    }

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into('wishlist')
      .values(values)
      .execute();
  }

  private resolveLegacyType(legacyType: string): {
    propertyType: PropertyType;
    config: (typeof PROPERTY_TABLE_CONFIG)[PropertyType];
  } | null {
    const entry = Object.entries(PROPERTY_TABLE_CONFIG).find(
      ([, config]) => config.legacyWishlistType === legacyType,
    );

    if (!entry) {
      return null;
    }

    return {
      propertyType: entry[0] as PropertyType,
      config: entry[1],
    };
  }
}
