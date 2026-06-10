import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from '../../../database/entities/city.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UpsertCityDto } from './dto/upsert-city.dto';

@Injectable()
export class AdminCitiesService {
  constructor(
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
  ) {}

  async list(query: PaginationQueryDto) {
    const queryBuilder = this.cityRepository
      .createQueryBuilder('city')
      .select([
        'city.id AS id',
        'city.countryCode AS country_code',
        'city.countryName AS country_name',
        'city.stateName AS state_name',
        'city.cityName AS city_name',
        'city.isActive AS is_active',
        'city.createdAt AS created_at',
        'city.updatedAt AS updated_at',
      ]);

    const search = query.search?.trim();
    if (search) {
      queryBuilder.where(
        '(city.cityName LIKE :search OR city.stateName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (query.status !== undefined) {
      queryBuilder.andWhere('city.isActive = :status', {
        status: query.status,
      });
    }

    const total = await queryBuilder.clone().getCount();
    const items = await queryBuilder
      .orderBy('city.cityName', (query.sortDirection || 'DESC').toUpperCase() as 'ASC' | 'DESC')
      .offset((query.page - 1) * query.limit)
      .limit(query.limit)
      .getRawMany<Record<string, unknown>>();

    return { items, total, page: query.page, limit: query.limit };
  }

  async listAll() {
    return this.cityRepository
      .createQueryBuilder('city')
      .select([
        'city.id AS id',
        'city.countryCode AS country_code',
        'city.countryName AS country_name',
        'city.stateName AS state_name',
        'city.cityName AS city_name',
        'city.isActive AS is_active',
      ])
      .where('city.isActive = :active', { active: 1 })
      .orderBy('city.cityName', 'ASC')
      .getRawMany<Record<string, unknown>>();
  }

  async details(id: number) {
    const city = await this.cityRepository
      .createQueryBuilder('city')
      .select([
        'city.id AS id',
        'city.countryCode AS country_code',
        'city.countryName AS country_name',
        'city.stateName AS state_name',
        'city.cityName AS city_name',
        'city.isActive AS is_active',
      ])
      .where('city.id = :id', { id })
      .getRawOne<Record<string, unknown>>();

    if (!city) {
      throw new NotFoundException('City not found');
    }

    return city;
  }

  async create(payload: UpsertCityDto) {
    await this.ensureUnique(payload.data.city_name, payload.data.state_name);
    const city = this.cityRepository.create({
      cityName: payload.data.city_name,
      stateName: payload.data.state_name,
      countryName: 'India',
      countryCode: 'IN',
      isActive: payload.data.is_active,
    });
    const saved = await this.cityRepository.save(city);
    return { id: saved.id, record: await this.details(saved.id) };
  }

  async update(id: number, payload: UpsertCityDto) {
    const city = await this.getCity(id);
    await this.ensureUnique(
      payload.data.city_name,
      payload.data.state_name,
      id,
    );

    city.cityName = payload.data.city_name;
    city.stateName = payload.data.state_name;
    city.countryName = 'India';
    city.countryCode = 'IN';
    city.isActive = payload.data.is_active;
    await this.cityRepository.save(city);

    return { id, record: await this.details(id) };
  }

  async updateStatus(id: number, status: number) {
    const city = await this.getCity(id);
    city.isActive = status === 1 ? 1 : 0;
    await this.cityRepository.save(city);
    return { id, record: await this.details(id) };
  }

  async remove(id: number) {
    const city = await this.getCity(id);
    await this.cityRepository.delete(city.id);
    return { id, deleted: true };
  }

  private async getCity(id: number): Promise<City> {
    const city = await this.cityRepository.findOne({ where: { id } });
    if (!city) {
      throw new NotFoundException('City not found');
    }
    return city;
  }

  private async ensureUnique(
    cityName: string,
    stateName: string,
    excludedId?: number,
  ): Promise<void> {
    const query = this.cityRepository
      .createQueryBuilder('city')
      .where('LOWER(city.cityName) = LOWER(:cityName)', { cityName })
      .andWhere('LOWER(city.stateName) = LOWER(:stateName)', { stateName });

    if (excludedId) {
      query.andWhere('city.id != :excludedId', { excludedId });
    }

    if (await query.getExists()) {
      throw new ConflictException('This city already exists in the selected state');
    }
  }
}
