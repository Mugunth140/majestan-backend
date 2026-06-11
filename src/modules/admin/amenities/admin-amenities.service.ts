import { Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UpsertRecordDto } from '../common/dto/upsert-record.dto';
import { AdminTableService } from '../common/admin-table.service';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminAmenitiesService {
  constructor(
    private readonly adminTableService: AdminTableService,
    private readonly dataSource: DataSource,
  ) {}

  async list(query: PaginationQueryDto) {
    return this.adminTableService.listRows('amenities', query, ['name']);
  }

  async details(id: number) {
    return this.adminTableService.getRowById('amenities', id);
  }

  async create(payload: UpsertRecordDto) {
    return this.adminTableService.createRow('amenities', payload.data);
  }

  async update(id: number, payload: UpsertRecordDto) {
    const record = await this.adminTableService.updateRow('amenities', id, payload.data);
    return { id, record };
  }

  async updateStatus(id: number, status: number) {
    const record = await this.adminTableService.updateStatus('amenities', id, status);
    return { id, record };
  }

  async remove(id: number) {
    // Explicit hard delete for amenities, because adminTableService does soft delete on `is_active`
    // which conflicts with the active/inactive status toggle.
    await this.dataSource.query(`DELETE FROM \`amenities\` WHERE id = ?`, [id]);
    return { id, deleted: true };
  }
}
