import { Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UpsertRecordDto } from '../common/dto/upsert-record.dto';
import { AdminTableService } from '../common/admin-table.service';

@Injectable()
export class AdminLocalitiesService {
  constructor(private readonly adminTableService: AdminTableService) {}

  async list(query: PaginationQueryDto) {
    return this.adminTableService.listRows('locations', query, ['cityName', 'localityName']);
  }

  async listAll() {
    return this.adminTableService.findAll('locations'); // Ensure AdminTableService has findAll or implement directly
  }

  async details(id: number) {
    return this.adminTableService.getRowById('locations', id);
  }

  async create(payload: UpsertRecordDto) {
    return this.adminTableService.createRow('locations', payload.data);
  }

  async update(id: number, payload: UpsertRecordDto) {
    const record = await this.adminTableService.updateRow('locations', id, payload.data);
    return { id, record };
  }

  async updateStatus(id: number, status: number) {
    const record = await this.adminTableService.updateStatus('locations', id, status);
    return { id, record };
  }

  async remove(id: number) {
    await this.adminTableService.deleteRow('locations', id);
    return { id, deleted: true };
  }
}
