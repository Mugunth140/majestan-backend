import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Builder } from '../../../database/entities/builder.entity';
import { toProjectSlug } from '../../projects/utils/project-slug.util';
import { AdminBuilderQueryDto } from './dto/admin-builder-query.dto';
import { CreateBuilderDto, UpdateBuilderDto } from './dto/create-builder.dto';

@Injectable()
export class AdminBuildersService {
  constructor(
    @InjectRepository(Builder)
    private readonly builderRepository: Repository<Builder>,
  ) {}

  private async generateUniqueSlug(name: string, excludeId?: number): Promise<string> {
    const baseSlug = toProjectSlug(name) || 'builder';
    let candidate = baseSlug;
    let suffix = 1;

    while (true) {
      const existing = await this.builderRepository.findOne({
        where: { slug: candidate },
        select: ['id', 'slug'],
      });

      if (!existing || (excludeId && existing.id === excludeId)) {
        return candidate;
      }

      candidate = `${baseSlug}-${suffix++}`;
    }
  }

  async findAll(query: AdminBuilderQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const qb = this.builderRepository.createQueryBuilder('b');

    if (query.search?.trim()) {
      const s = `%${query.search.trim()}%`;
      qb.andWhere('(b.name LIKE :s OR b.email LIKE :s OR b.phone LIKE :s)', { s });
    }

    if (query.status === 'active') {
      qb.andWhere('b.isActive = :active', { active: true });
    } else if (query.status === 'inactive') {
      qb.andWhere('b.isActive = :inactive', { inactive: false });
    }

    qb.orderBy('b.createdAt', 'DESC').addOrderBy('b.id', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async findDropdown() {
    return this.builderRepository.find({
      where: { isActive: true },
      select: ['id', 'name', 'logoUrl'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number) {
    const builder = await this.builderRepository.findOne({ where: { id } });
    if (!builder) {
      throw new NotFoundException(`Builder with ID ${id} not found`);
    }
    return builder;
  }

  async create(dto: CreateBuilderDto) {
    const slug = await this.generateUniqueSlug(dto.name);
    const builder = this.builderRepository.create({
      ...dto,
      slug,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });
    return this.builderRepository.save(builder);
  }

  async update(id: number, dto: UpdateBuilderDto) {
    const builder = await this.findOne(id);

    if (dto.name && dto.name.trim() !== builder.name) {
      builder.slug = await this.generateUniqueSlug(dto.name, id);
    }

    Object.assign(builder, dto);
    return this.builderRepository.save(builder);
  }

  async remove(id: number) {
    const builder = await this.findOne(id);
    await this.builderRepository.remove(builder);
    return { deleted: true, id };
  }
}
