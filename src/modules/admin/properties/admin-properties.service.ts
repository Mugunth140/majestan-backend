import { BadRequestException, Injectable } from '@nestjs/common';
import { PropertyType } from '../../../common/enums/property-type.enum';
import {
  getPropertyConfig,
  resolvePropertyType,
} from '../../properties/constants/property-table.config';
import { AdminTableService } from '../common/admin-table.service';
import { UpsertRecordDto } from '../common/dto/upsert-record.dto';
import { AdminPropertyQueryDto } from './dto/admin-property-query.dto';
import { ToggleBookingStatusDto } from './dto/toggle-booking-status.dto';

@Injectable()
export class AdminPropertiesService {
  constructor(private readonly adminTableService: AdminTableService) {}

  async list(propertyTypeRaw: string, query: AdminPropertyQueryDto) {
    const { type, table, searchableColumns } =
      await this.resolvePropertyTable(propertyTypeRaw);
    const result = await this.adminTableService.listRows(
      table,
      query,
      searchableColumns,
    );

    return {
      propertyType: type,
      ...result,
    };
  }

  async details(propertyTypeRaw: string, id: number) {
    const { type, table } = await this.resolvePropertyTable(propertyTypeRaw);
    const record = await this.adminTableService.getRowById(table, id);

    return {
      propertyType: type,
      record,
    };
  }

  async create(propertyTypeRaw: string, payload: UpsertRecordDto) {
    const { type, table } = await this.resolvePropertyTable(propertyTypeRaw);

    const created = await this.adminTableService.createRow(table, payload.data);

    return {
      propertyType: type,
      ...created,
    };
  }

  async update(propertyTypeRaw: string, id: number, payload: UpsertRecordDto) {
    const { type, table } = await this.resolvePropertyTable(propertyTypeRaw);
    const record = await this.adminTableService.updateRow(
      table,
      id,
      payload.data,
    );

    return {
      propertyType: type,
      record,
    };
  }

  async updateStatus(propertyTypeRaw: string, id: number, status: number) {
    const { type, table } = await this.resolvePropertyTable(propertyTypeRaw);
    const record = await this.adminTableService.updateStatus(table, id, status);

    return {
      propertyType: type,
      record,
    };
  }

  async updateBookingStatus(
    propertyTypeRaw: string,
    id: number,
    payload: ToggleBookingStatusDto,
  ) {
    const { type, table } = await this.resolvePropertyTable(propertyTypeRaw);

    const columns = await this.adminTableService.getColumns(table);
    if (!columns.has('booking_status')) {
      throw new BadRequestException(
        `Table ${table} does not have booking_status`,
      );
    }

    const record = await this.adminTableService.updateRow(table, id, {
      booking_status: payload.bookingStatus,
    });

    return {
      propertyType: type,
      record,
    };
  }

  async remove(propertyTypeRaw: string, id: number) {
    const { type, table } = await this.resolvePropertyTable(propertyTypeRaw);
    await this.adminTableService.deleteRow(table, id);

    return {
      propertyType: type,
      deleted: true,
      id,
    };
  }

  private async resolvePropertyTable(propertyTypeRaw: string): Promise<{
    type: PropertyType;
    table: string;
    searchableColumns: string[];
  }> {
    const type = resolvePropertyType(propertyTypeRaw);

    if (!type) {
      throw new BadRequestException('Unsupported property type');
    }

    const config = getPropertyConfig(type);

    const columns = await this.adminTableService.getColumns(config.table);
    const codeColumn = this.findCodeColumn(columns);

    const searchableColumns = [config.nameColumn, config.locationColumn];
    if (codeColumn) {
      searchableColumns.push(codeColumn);
    }

    return {
      type,
      table: config.table,
      searchableColumns,
    };
  }

  private findCodeColumn(columns: Set<string>): string | null {
    for (const column of columns) {
      if (column.endsWith('_code')) {
        return column;
      }
    }

    return null;
  }
}
