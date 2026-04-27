import { Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UpsertRecordDto } from '../common/dto/upsert-record.dto';
import { AdminTableService } from '../common/admin-table.service';

@Injectable()
export class AdminBlogsService {
  constructor(private readonly adminTableService: AdminTableService) {}

  async list(query: PaginationQueryDto) {
    return this.adminTableService.listRows('blogs', query, ['title', 'slug']);
  }

  async details(id: number) {
    return this.adminTableService.getRowById('blogs', id);
  }

  async create(payload: UpsertRecordDto) {
    return this.adminTableService.createRow('blogs', payload.data);
  }

  async update(id: number, payload: UpsertRecordDto) {
    const record = await this.adminTableService.updateRow(
      'blogs',
      id,
      payload.data,
    );

    return {
      id,
      record,
    };
  }

  async updateStatus(id: number, status: number) {
    const record = await this.adminTableService.updateStatus(
      'blogs',
      id,
      status,
    );

    return {
      id,
      record,
    };
  }

  async remove(id: number) {
    await this.adminTableService.deleteRow('blogs', id);

    return {
      id,
      deleted: true,
    };
  }
}
