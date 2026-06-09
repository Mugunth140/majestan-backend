import { Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UpsertRecordDto } from '../common/dto/upsert-record.dto';
import { AdminTableService } from '../common/admin-table.service';

@Injectable()
export class AdminSublocationsService {
  constructor(private readonly adminTableService: AdminTableService) {}

  async list(query: PaginationQueryDto) {
    // We fetch sublocations joined with cities for display
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT s.*, c.city_name, c.state_name, c.country_name 
      FROM \`sublocations\` s
      LEFT JOIN \`cities\` c ON s.city_id = c.id
    `;
    
    const params: any[] = [];
    if (query.search) {
      sql += ` WHERE s.locality_name LIKE ? OR c.city_name LIKE ?`;
      params.push(`%${query.search}%`, `%${query.search}%`);
    }

    sql += ` ORDER BY s.id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const items = await this.adminTableService.dataSource.query(sql, params);

    let countSql = `
      SELECT COUNT(*) as total 
      FROM \`sublocations\` s
      LEFT JOIN \`cities\` c ON s.city_id = c.id
    `;
    const countParams: any[] = [];
    if (query.search) {
      countSql += ` WHERE s.locality_name LIKE ? OR c.city_name LIKE ?`;
      countParams.push(`%${query.search}%`, `%${query.search}%`);
    }
    const countResult = await this.adminTableService.dataSource.query(countSql, countParams);
    const total = parseInt(countResult[0].total, 10);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async listAll() {
    return this.adminTableService.findAll('sublocations');
  }

  async details(id: number) {
    return this.adminTableService.getRowById('sublocations', id);
  }

  async create(payload: UpsertRecordDto) {
    return this.adminTableService.createRow('sublocations', payload.data);
  }

  async update(id: number, payload: UpsertRecordDto) {
    const record = await this.adminTableService.updateRow('sublocations', id, payload.data);
    return { id, record };
  }

  async updateStatus(id: number, status: number) {
    const record = await this.adminTableService.updateStatus('sublocations', id, status);
    return { id, record };
  }

  async remove(id: number) {
    await this.adminTableService.deleteRow('sublocations', id);
    return { id };
  }
}
