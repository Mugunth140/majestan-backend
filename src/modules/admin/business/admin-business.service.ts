import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AdminTableService } from '../common/admin-table.service';
import { UpsertRecordDto } from '../common/dto/upsert-record.dto';

@Injectable()
export class AdminBusinessService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly adminTableService: AdminTableService,
  ) {}

  async getSetup() {
    return this.getSingleActiveRow('business_setup');
  }

  async upsertSetup(payload: UpsertRecordDto) {
    return this.upsertSingleActiveRow('business_setup', payload);
  }

  async getProfile() {
    return this.getSingleActiveRow('business_profile');
  }

  async upsertProfile(payload: UpsertRecordDto) {
    return this.upsertSingleActiveRow('business_profile', payload);
  }

  private async getSingleActiveRow(table: string) {
    return this.dataSource
      .createQueryBuilder()
      .select('t.*')
      .from(table, 't')
      .where('t.status = :status', { status: 1 })
      .orderBy('t.id', 'DESC')
      .limit(1)
      .getRawOne<Record<string, unknown>>();
  }

  private async upsertSingleActiveRow(table: string, payload: UpsertRecordDto) {
    const current = await this.getSingleActiveRow(table);

    if (!current) {
      const created = await this.adminTableService.createRow(table, {
        ...payload.data,
        status: 1,
      });

      return {
        created: true,
        ...created,
      };
    }

    const id = Number(current.id);
    const record = await this.adminTableService.updateRow(
      table,
      id,
      payload.data,
    );

    return {
      created: false,
      id,
      record,
    };
  }
}
