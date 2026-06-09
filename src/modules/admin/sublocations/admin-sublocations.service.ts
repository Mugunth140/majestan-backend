import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from '../../../database/entities/city.entity';
import { Sublocation } from '../../../database/entities/sublocation.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UpsertSublocationDto } from './dto/upsert-sublocation.dto';

@Injectable()
export class AdminSublocationsService {
  constructor(
    @InjectRepository(Sublocation)
    private readonly sublocationRepository: Repository<Sublocation>,
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
  ) {}

  async list(query: PaginationQueryDto) {
    const queryBuilder = this.sublocationRepository
      .createQueryBuilder('sublocation')
      .innerJoin('sublocation.city', 'city')
      .select([
        'sublocation.id AS id',
        'sublocation.cityId AS city_id',
        'sublocation.localityName AS locality_name',
        'sublocation.postalCode AS postal_code',
        'sublocation.isActive AS is_active',
        'sublocation.createdAt AS created_at',
        'sublocation.updatedAt AS updated_at',
        'city.cityName AS city_name',
        'city.stateName AS state_name',
        'city.countryName AS country_name',
      ]);

    const search = query.search?.trim();
    if (search) {
      queryBuilder.where(
        '(sublocation.localityName LIKE :search OR city.cityName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (query.status !== undefined) {
      queryBuilder.andWhere('sublocation.isActive = :status', {
        status: query.status,
      });
    }

    const total = await queryBuilder.clone().getCount();
    const items = await queryBuilder
      .orderBy(
        'sublocation.localityName',
        query.sortDirection.toUpperCase() as 'ASC' | 'DESC',
      )
      .offset((query.page - 1) * query.limit)
      .limit(query.limit)
      .getRawMany<Record<string, unknown>>();

    return { items, total, page: query.page, limit: query.limit };
  }

  async listAll() {
    return this.sublocationRepository
      .createQueryBuilder('sublocation')
      .innerJoin('sublocation.city', 'city')
      .select([
        'sublocation.id AS id',
        'sublocation.cityId AS city_id',
        'sublocation.localityName AS locality_name',
        'sublocation.postalCode AS postal_code',
        'sublocation.isActive AS is_active',
        'city.cityName AS city_name',
        'city.stateName AS state_name',
        'city.countryName AS country_name',
      ])
      .where('sublocation.isActive = :active', { active: 1 })
      .andWhere('city.isActive = :active', { active: 1 })
      .orderBy('city.cityName', 'ASC')
      .addOrderBy('sublocation.localityName', 'ASC')
      .getRawMany<Record<string, unknown>>();
  }

  async details(id: number) {
    const sublocation = await this.sublocationRepository
      .createQueryBuilder('sublocation')
      .innerJoin('sublocation.city', 'city')
      .select([
        'sublocation.id AS id',
        'sublocation.cityId AS city_id',
        'sublocation.localityName AS locality_name',
        'sublocation.postalCode AS postal_code',
        'sublocation.isActive AS is_active',
        'city.cityName AS city_name',
      ])
      .where('sublocation.id = :id', { id })
      .getRawOne<Record<string, unknown>>();

    if (!sublocation) {
      throw new NotFoundException('Sublocation not found');
    }

    return sublocation;
  }

  async create(payload: UpsertSublocationDto) {
    await this.ensureCityExists(payload.data.city_id);
    await this.ensureUnique(
      payload.data.city_id,
      payload.data.locality_name,
    );

    const sublocation = this.sublocationRepository.create({
      cityId: payload.data.city_id,
      localityName: payload.data.locality_name,
      postalCode: payload.data.postal_code,
      isActive: payload.data.is_active,
    });
    const saved = await this.sublocationRepository.save(sublocation);
    return { id: saved.id, record: await this.details(saved.id) };
  }

  async update(id: number, payload: UpsertSublocationDto) {
    const sublocation = await this.getSublocation(id);
    await this.ensureCityExists(payload.data.city_id);
    await this.ensureUnique(
      payload.data.city_id,
      payload.data.locality_name,
      id,
    );

    sublocation.cityId = payload.data.city_id;
    sublocation.localityName = payload.data.locality_name;
    sublocation.postalCode = payload.data.postal_code;
    sublocation.isActive = payload.data.is_active;
    await this.sublocationRepository.save(sublocation);

    return { id, record: await this.details(id) };
  }

  async updateStatus(id: number, status: number) {
    const sublocation = await this.getSublocation(id);
    sublocation.isActive = status === 1 ? 1 : 0;
    await this.sublocationRepository.save(sublocation);
    return { id, record: await this.details(id) };
  }

  async remove(id: number) {
    const sublocation = await this.getSublocation(id);
    sublocation.isActive = 0;
    await this.sublocationRepository.save(sublocation);
    return { id };
  }

  private async getSublocation(id: number): Promise<Sublocation> {
    const sublocation = await this.sublocationRepository.findOne({
      where: { id },
    });
    if (!sublocation) {
      throw new NotFoundException('Sublocation not found');
    }
    return sublocation;
  }

  private async ensureCityExists(cityId: number): Promise<void> {
    const city = await this.cityRepository.findOne({
      where: { id: cityId, isActive: 1 },
    });
    if (!city) {
      throw new NotFoundException('Active city not found');
    }
  }

  private async ensureUnique(
    cityId: number,
    localityName: string,
    excludedId?: number,
  ): Promise<void> {
    const query = this.sublocationRepository
      .createQueryBuilder('sublocation')
      .where('sublocation.cityId = :cityId', { cityId })
      .andWhere('LOWER(sublocation.localityName) = LOWER(:localityName)', {
        localityName,
      });

    if (excludedId) {
      query.andWhere('sublocation.id != :excludedId', { excludedId });
    }

    if (await query.getExists()) {
      throw new ConflictException(
        'This sublocation already exists for the selected city',
      );
    }
  }
}
