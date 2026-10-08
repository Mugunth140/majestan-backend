import { Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UpsertRecordDto } from '../common/dto/upsert-record.dto';
import { AdminTableService } from '../common/admin-table.service';
import { DataSource } from 'typeorm';

function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class AdminUtilitiesService {
  constructor(
    private readonly adminTableService: AdminTableService,
    private readonly dataSource: DataSource,
  ) {}

  async list(query: PaginationQueryDto) {
    return this.adminTableService.listRows('utilities', query, ['name']);
  }

  async details(id: number) {
    return this.adminTableService.getRowById('utilities', id);
  }

  async create(payload: UpsertRecordDto) {
    const data = { ...(payload.data as Record<string, unknown>) };
    if (typeof data.name === 'string' && !data.slug) {
      data.slug = toSlug(data.name);
    }
    return this.adminTableService.createRow('utilities', data);
  }

  async update(id: number, payload: UpsertRecordDto) {
    const data = { ...(payload.data as Record<string, unknown>) };
    if (typeof data.name === 'string') {
      data.slug = toSlug(data.name);
    }
    const record = await this.adminTableService.updateRow('utilities', id, data);
    return { id, record };
  }

  async updateStatus(id: number, status: number) {
    const record = await this.adminTableService.updateStatus('utilities', id, status);
    return { id, record };
  }

  async remove(id: number) {
    // Explicit hard delete for utilities, because adminTableService does soft delete on `is_active`
    // which conflicts with the active/inactive status toggle.
    await this.dataSource.query(`DELETE FROM \`utilities\` WHERE id = ?`, [id]);
    return { id, deleted: true };
  }
}
