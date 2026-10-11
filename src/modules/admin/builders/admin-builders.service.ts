import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Builder } from '../../../database/entities/builder.entity';
import { StorageService } from '../../storage/storage.service';
import { toProjectSlug } from '../../projects/utils/project-slug.util';
import { AdminBuilderQueryDto } from './dto/admin-builder-query.dto';
import { CreateBuilderDto, UpdateBuilderDto } from './dto/create-builder.dto';

@Injectable()
export class AdminBuildersService {
  constructor(
    @InjectRepository(Builder)
    private readonly builderRepository: Repository<Builder>,
    private readonly storageService: StorageService,
  ) {}

  private resolveUrl(key?: string | null): string | null {
    if (!key) return null;
    return this.storageService.generateReadUrl(key);
  }

  private mapBuilder(builder: Builder) {
    return {
      ...builder,
      logoUrl: this.resolveUrl(builder.logoUrl),
      rawLogoKey: builder.logoUrl,
    };
  }

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
    return {
      items: items.map((b) => this.mapBuilder(b)),
      total,
      page,
      limit,
    };
  }

  async findDropdown() {
    const list = await this.builderRepository.find({
      where: { isActive: true },
      select: ['id', 'name', 'logoUrl'],
      order: { name: 'ASC' },
    });
    return list.map((b) => ({
      id: b.id,
      name: b.name,
      logoUrl: this.resolveUrl(b.logoUrl),
    }));
  }

  async findOne(id: number) {
    const builder = await this.builderRepository.findOne({ where: { id } });
    if (!builder) {
      throw new NotFoundException(`Builder with ID ${id} not found`);
    }
    return this.mapBuilder(builder);
  }

  private async finalizeLogo(logoUrl?: string): Promise<string | undefined> {
    if (!logoUrl) return undefined;
    try {
      return await this.storageService.processBuilderLogo(logoUrl);
    } catch (err) {
      console.error(`[AdminBuildersService] Failed to process logo ${logoUrl}`, err);
      return logoUrl;
    }
  }

  async create(dto: CreateBuilderDto) {
    const slug = await this.generateUniqueSlug(dto.name);
    const logoKey = await this.finalizeLogo(dto.logoUrl);
    const builder = this.builderRepository.create({
      ...dto,
      logoUrl: logoKey,
      slug,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });
    const saved = await this.builderRepository.save(builder);
    return this.mapBuilder(saved);
  }

  async update(id: number, dto: UpdateBuilderDto) {
    const builder = await this.builderRepository.findOne({ where: { id } });
    if (!builder) {
      throw new NotFoundException(`Builder with ID ${id} not found`);
    }

    if (dto.name && dto.name.trim() !== builder.name) {
      builder.slug = await this.generateUniqueSlug(dto.name, id);
    }

    if (dto.logoUrl !== undefined && dto.logoUrl !== builder.logoUrl) {
      dto.logoUrl = await this.finalizeLogo(dto.logoUrl);
    }

    Object.assign(builder, dto);
    const saved = await this.builderRepository.save(builder);
    return this.mapBuilder(saved);
  }

  async remove(id: number) {
    const builder = await this.findOne(id);
    await this.builderRepository.remove(builder);
    return { deleted: true, id };
  }
}
