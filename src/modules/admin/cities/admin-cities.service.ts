import { Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UpsertRecordDto } from '../common/dto/upsert-record.dto';
import { AdminTableService } from '../common/admin-table.service';

@Injectable()
export class AdminCitiesService {
  constructor(private readonly adminTableService: AdminTableService) {}

  async list(query: PaginationQueryDto) {
    return this.adminTableService.listRows('cities', query, ['city_name']);
  }

  async listAll() {
    return this.adminTableService.findAll('cities');
  }

  async details(id: number) {
    return this.adminTableService.getRowById('cities', id);
  }

  async create(payload: UpsertRecordDto) {
    return this.adminTableService.createRow('cities', payload.data);
  }

  async update(id: number, payload: UpsertRecordDto) {
    const record = await this.adminTableService.updateRow('cities', id, payload.data);
    return { id, record };
  }

  async updateStatus(id: number, status: number) {
    const record = await this.adminTableService.updateStatus('cities', id, status);
    return { id, record };
  }

  async remove(id: number) {
    await this.adminTableService.deleteRow('cities', id);
    return { id };
  }
}
