import { Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UpdateStatusDto } from '../common/dto/update-status.dto';
import { UpsertRecordDto } from '../common/dto/upsert-record.dto';
import { AdminTableService } from '../common/admin-table.service';

@Injectable()
export class AdminBannersService {
  constructor(private readonly adminTableService: AdminTableService) {}

  async list(query: PaginationQueryDto) {
    return this.adminTableService.listRows('banner', query, ['title']);
  }

  async details(id: number) {
    return this.adminTableService.getRowById('banner', id);
  }

  async create(payload: UpsertRecordDto) {
    return this.adminTableService.createRow('banner', payload.data);
  }

  async update(id: number, payload: UpsertRecordDto) {
    const record = await this.adminTableService.updateRow(
      'banner',
      id,
      payload.data,
    );

    return {
      id,
      record,
    };
  }

  async updateStatus(id: number, payload: UpdateStatusDto) {
    const record = await this.adminTableService.updateStatus(
      'banner',
      id,
      payload.status,
    );

    return {
      id,
      record,
    };
  }

  async remove(id: number) {
    await this.adminTableService.deleteRow('banner', id);

    return {
      id,
      deleted: true,
    };
  }
}
