import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RowDataPacket } from 'mysql2/promise';
import { PropertyType } from '../../common/enums/property-type.enum';
import { DatabaseService } from '../../database/database.service';
import {
  PROPERTY_TABLE_CONFIG,
  getPropertyConfig,
  resolvePropertyType,
} from '../properties/constants/property-table.config';
import { WishlistGuestQueryDto } from './dto/wishlist-guest-query.dto';
import { ToggleWishlistDto } from './dto/toggle-wishlist.dto';

type SqlValue = string | number | boolean | Date | null;

type WishlistRow = RowDataPacket & {
  id: number;
  property_id: number;
  property_type: string;
};

@Injectable()
export class WishlistService {
  private wishlistColumnsCache: Set<string> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async list(query: WishlistGuestQueryDto) {
    const columns = await this.getWishlistColumns();
    const statusCondition = columns.has('status') ? ' AND status = 1' : '';

    const wishlistRows = await this.databaseService.query<WishlistRow[]>(
      `
        SELECT id, property_id, property_type
        FROM wishlist
        WHERE user_id = ?${statusCondition}
        ORDER BY id DESC
      `,
      [query.guestId],
    );

    const items: Record<string, unknown>[] = [];

    for (const row of wishlistRows) {
      const resolved = this.resolveLegacyType(row.property_type);

      if (!resolved) {
        continue;
      }

      const property = await this.databaseService.query<RowDataPacket[]>(
        `SELECT * FROM ${resolved.config.table} WHERE id = ? LIMIT 1`,
        [row.property_id],
      );

      items.push({
        id: row.id,
        propertyId: row.property_id,
        propertyType: resolved.propertyType,
        legacyPropertyType: row.property_type,
        property: property[0] ?? null,
      });
    }

    return {
      items,
      total: items.length,
    };
  }

  async count(query: WishlistGuestQueryDto) {
    const columns = await this.getWishlistColumns();
    const statusCondition = columns.has('status') ? ' AND status = 1' : '';

    const rows = await this.databaseService.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM wishlist WHERE user_id = ?${statusCondition}`,
      [query.guestId],
    );

    return {
      total: Number((rows[0]?.total as number | undefined) ?? 0),
    };
  }

  async toggle(payload: ToggleWishlistDto) {
    const propertyType = this.ensurePropertyType(payload.propertyType);
    const config = getPropertyConfig(propertyType);

    await this.ensurePropertyExists(config.table, payload.propertyId);

    const columns = await this.getWishlistColumns();
    const statusCondition = columns.has('status') ? ' AND status = 1' : '';

    const existingRows = await this.databaseService.query<WishlistRow[]>(
      `
        SELECT id
        FROM wishlist
        WHERE user_id = ?
          AND property_id = ?
          AND property_type = ?${statusCondition}
        LIMIT 1
      `,
      [payload.guestId, payload.propertyId, config.legacyWishlistType],
    );

    const existing = existingRows[0];

    if (existing) {
      await this.databaseService.execute('DELETE FROM wishlist WHERE id = ?', [
        existing.id,
      ]);

      const count = await this.count({ guestId: payload.guestId });

      return {
        wished: false,
        total: count.total,
      };
    }

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
    const rows = await this.databaseService.query<RowDataPacket[]>(
      `SELECT id FROM ${table} WHERE id = ? AND status = 1 LIMIT 1`,
      [propertyId],
    );

    if (!rows[0]) {
      throw new NotFoundException('Property not found');
    }
  }

  private async getWishlistColumns(): Promise<Set<string>> {
    if (this.wishlistColumnsCache) {
      return this.wishlistColumnsCache;
    }

    const columns = await this.databaseService.query<RowDataPacket[]>(
      'SHOW COLUMNS FROM wishlist',
    );
    this.wishlistColumnsCache = new Set(
      columns.map((column) => String(column.Field).toLowerCase()),
    );

    return this.wishlistColumnsCache;
  }

  private async insertWishlistRow(
    columns: Set<string>,
    guestId: string,
    propertyId: number,
    legacyPropertyType: string,
  ): Promise<void> {
    const fieldNames: string[] = [];
    const valueExpressions: string[] = [];
    const params: SqlValue[] = [];

    fieldNames.push('user_id');
    valueExpressions.push('?');
    params.push(guestId);

    fieldNames.push('property_id');
    valueExpressions.push('?');
    params.push(propertyId);

    fieldNames.push('property_type');
    valueExpressions.push('?');
    params.push(legacyPropertyType);

    if (columns.has('status')) {
      fieldNames.push('status');
      valueExpressions.push('?');
      params.push(1);
    }

    if (columns.has('created_at')) {
      fieldNames.push('created_at');
      valueExpressions.push('CURRENT_TIMESTAMP');
    }

    if (columns.has('updated_at')) {
      fieldNames.push('updated_at');
      valueExpressions.push('CURRENT_TIMESTAMP');
    }

    const sql = `
      INSERT INTO wishlist (${fieldNames.join(', ')})
      VALUES (${valueExpressions.join(', ')})
    `;

    await this.databaseService.execute(sql, params);
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
