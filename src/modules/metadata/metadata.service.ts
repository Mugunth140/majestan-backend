import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class MetadataService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listSublocations() {
    return this.dataSource
      .createQueryBuilder()
      .select('s.id', 'id')
      .addSelect('s.locality_name', 'sublocation')
      .addSelect('s.city_id', 'cityId')
      .addSelect('c.city_name', 'city')
      .addSelect('c.state_name', 'state')
      .addSelect('s.postal_code', 'postalCode')
      .from('sublocations', 's')
      .innerJoin('cities', 'c', 'c.id = s.city_id')
      .where('s.is_active = :active', { active: 1 })
      .andWhere('c.is_active = :active', { active: 1 })
      .orderBy('c.city_name', 'ASC')
      .addOrderBy('s.locality_name', 'ASC')
      .getRawMany<{
        id: number;
        sublocation: string;
        cityId: number;
        city: string;
        state: string;
        postalCode: string | null;
      }>();
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

  async listCities() {
    return this.dataSource
      .createQueryBuilder()
      .select('c.id', 'id')
      .addSelect('c.city_name', 'city')
      .addSelect('c.state_name', 'state')
      .addSelect('c.country_name', 'country')
      .from('cities', 'c')
      .where('c.is_active = :active', { active: 1 })
      .orderBy('c.city_name', 'ASC')
      .getRawMany<{
        id: number;
        city: string;
        state: string;
        country: string;
      }>();
  }
}
