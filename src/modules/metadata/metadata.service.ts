import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class MetadataService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listSublocations() {
    return this.dataSource
      .createQueryBuilder()
      .select('sublocations.id', 'id')
      .addSelect('sublocations.sublocation', 'sublocation')
      .from('sublocations', 'sublocations')
      .where('sublocations.status = :status', { status: 1 })
      .orderBy('sublocations.sublocation', 'ASC')
      .getRawMany<{ id: number; sublocation: string }>();
  }

  async listUnitTypes() {
    return this.dataSource
      .createQueryBuilder()
      .select('unittypes.id', 'id')
      .addSelect('unittypes.unittype', 'unittype')
      .from('unittypes', 'unittypes')
      .where('unittypes.status = :status', { status: 1 })
      .orderBy('unittypes.unittype', 'ASC')
      .getRawMany<{ id: number; unittype: string }>();
  }
}
