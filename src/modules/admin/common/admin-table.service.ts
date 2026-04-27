import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PaginationQueryDto } from './dto/pagination-query.dto';

type SqlValue = string | number | boolean | Date | null;

@Injectable()
export class AdminTableService {
  private readonly columnsCache = new Map<string, Set<string>>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listRows(
    table: string,
    query: PaginationQueryDto,
    searchableColumns: string[] = [],
  ): Promise<{
    items: Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
  }> {
    const columns = await this.getColumns(table);
    const queryBuilder = this.dataSource.createQueryBuilder().from(table, 't');

    if (query.status !== undefined && columns.has('status')) {
      queryBuilder.andWhere('t.status = :status', { status: query.status });
    }

    const listingType = (query as { listingType?: string }).listingType;
    if (listingType && columns.has('posttype')) {
      queryBuilder.andWhere('t.posttype = :listingType', { listingType });
    }

    const trimmedSearch = query.search?.trim();
    if (trimmedSearch && searchableColumns.length > 0) {
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

    const sortBy =
      query.sortBy && columns.has(query.sortBy) ? query.sortBy : 'id';
    const sortDirection =
      query.sortDirection.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const offset = (query.page - 1) * query.limit;
    const totalQuery = queryBuilder.clone().getCount();
    const rowsQuery = queryBuilder
      .clone()
      .select('t.*')
      .orderBy(`t.${sortBy}`, sortDirection)
      .limit(query.limit)
      .offset(offset)
      .getRawMany<Record<string, unknown>>();

    const [total, rows] = await Promise.all([totalQuery, rowsQuery]);

    return {
      items: rows,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async getRowById(
    table: string,
    id: number,
  ): Promise<Record<string, unknown>> {
    const row = await this.dataSource
      .createQueryBuilder()
      .select('t.*')
      .from(table, 't')
      .where('t.id = :id', { id })
      .limit(1)
      .getRawOne<Record<string, unknown>>();

    if (!row) {
      throw new NotFoundException('Record not found');
    }

    return row;
  }

  async createRow(
    table: string,
    payload: Record<string, unknown>,
  ): Promise<{ id: number; record: Record<string, unknown> }> {
    const columns = await this.getColumns(table);
    const sanitized = this.sanitizePayload(payload, columns, [
      'id',
      'created_at',
      'updated_at',
    ]);

    if (Object.keys(sanitized).length === 0) {
      throw new BadRequestException('No valid fields provided');
    }

    const result = await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(table)
      .values(sanitized)
      .execute();

    const insertedId =
      Number(result.identifiers[0]?.id) ||
      Number((result.raw as { insertId?: number }).insertId);

    if (!insertedId) {
      throw new InternalServerErrorException('Failed to create record');
    }

    const record = await this.getRowById(table, insertedId);

    return {
      id: insertedId,
      record,
    };
  }

  async updateRow(
    table: string,
    id: number,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const columns = await this.getColumns(table);
    const sanitized = this.sanitizePayload(payload, columns, [
      'id',
      'created_at',
    ]);

    if (Object.keys(sanitized).length === 0) {
      throw new BadRequestException('No valid fields provided');
    }

    const fields = Object.keys(sanitized);
    if (fields.length === 0) {
      throw new BadRequestException('No valid fields provided');
    }

    const updatePayload: Record<string, unknown> = { ...sanitized };
    if (columns.has('updated_at')) {
      updatePayload.updated_at = () => 'CURRENT_TIMESTAMP';
    }

    await this.dataSource
      .createQueryBuilder()
      .update(table)
      .set(updatePayload)
      .where('id = :id', { id })
      .execute();

    return this.getRowById(table, id);
  }

  async updateStatus(
    table: string,
    id: number,
    status: number,
  ): Promise<Record<string, unknown>> {
    const columns = await this.getColumns(table);

    if (!columns.has('status')) {
      throw new BadRequestException(
        `Table ${table} does not have a status column`,
      );
    }

    const updatePayload: Record<string, unknown> = { status };

    if (columns.has('updated_at')) {
      updatePayload.updated_at = () => 'CURRENT_TIMESTAMP';
    }

    await this.dataSource
      .createQueryBuilder()
      .update(table)
      .set(updatePayload)
      .where('id = :id', { id })
      .execute();

    return this.getRowById(table, id);
  }

  async deleteRow(table: string, id: number): Promise<void> {
    const columns = await this.getColumns(table);

    if (columns.has('status')) {
      const updatePayload: Record<string, unknown> = { status: 2 };

      if (columns.has('updated_at')) {
        updatePayload.updated_at = () => 'CURRENT_TIMESTAMP';
      }

      await this.dataSource
        .createQueryBuilder()
        .update(table)
        .set(updatePayload)
        .where('id = :id', { id })
        .execute();
      return;
    }

    await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(table)
      .where('id = :id', { id })
      .execute();
  }

  async getColumns(table: string): Promise<Set<string>> {
    const cached = this.columnsCache.get(table);
    if (cached) {
      return cached;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    let columns = new Set<string>();

    try {
      const tableMetadata = await queryRunner.getTable(table);

      if (!tableMetadata) {
        throw new NotFoundException(`Table ${table} not found`);
      }

      columns = new Set(tableMetadata.columns.map((column) => column.name));
    } finally {
      await queryRunner.release();
    }

    this.columnsCache.set(table, columns);
    return columns;
  }

  private sanitizePayload(
    payload: Record<string, unknown>,
    allowedColumns: Set<string>,
    forbiddenColumns: string[] = [],
  ): Record<string, SqlValue> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('Payload must be a plain object');
    }

    const forbidden = new Set(forbiddenColumns);
    const result: Record<string, SqlValue> = {};

    for (const [key, value] of Object.entries(payload)) {
      if (!allowedColumns.has(key) || forbidden.has(key)) {
        continue;
      }

      if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        result[key] = value;
        continue;
      }

      if (value instanceof Date) {
        result[key] = value;
        continue;
      }

      if (Array.isArray(value) || typeof value === 'object') {
        result[key] = JSON.stringify(value);
      }
    }

    return result;
  }
}
