import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Project } from '../../../database/entities/project.entity';
import { ProjectUnit } from '../../../database/entities/project-unit.entity';
import { ProjectSeo, ProjectSeoData } from '../../../database/entities/project-seo.entity';
import { buildProjectCanonical, toProjectSlug } from '../../../modules/projects/utils/project-slug.util';
import { CreateProjectDto, CreateProjectUnitDto, UpdateProjectDto } from './dto/create-project.dto';

const DECIMAL_KEYS = ['price', 'monthlyRent', 'securityDeposit', 'maintenanceFee', 'carpetAreaSqft', 'builtupAreaSqft', 'superBuiltupAreaSqft'] as const;

const toUnitRow = (u: CreateProjectUnitDto, projectId: number) => {
  const row: Record<string, unknown> = { ...u, projectId };
  for (const key of DECIMAL_KEYS) {
    if (row[key] !== undefined && row[key] !== null) row[key] = String(row[key]);
  }
  return row;
};

@Injectable()
export class AdminProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectUnit) private readonly unitRepository: Repository<ProjectUnit>,
    @InjectRepository(ProjectSeo) private readonly seoRepository: Repository<ProjectSeo>,
    private readonly dataSource: DataSource,
  ) {}

  private async findOrFail(id: number) {
    const project = await this.projectRepository.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    const units = (await project.units) ?? [];
    const { units: _lazyUnits, seo: _lazySeo, ...scalars } = project as any;
    return { ...scalars, units };
  }

  async list(page = 1, limit = 20, search?: string, status?: string, projectType?: string) {
    const qb = this.projectRepository.createQueryBuilder('p');
    if (search) qb.andWhere('(p.name LIKE :s OR p.builderName LIKE :s OR p.city LIKE :s)', { s: `%${search}%` });
    if (status) qb.andWhere('p.status = :status', { status });
    if (projectType) qb.andWhere('p.projectType = :projectType', { projectType });
    const [projects, total] = await qb.orderBy('p.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    const items: any[] = [];
    for (const project of projects) {
      const units = (await project.units) ?? [];
      const { units: _lazyUnits, seo: _lazySeo, ...scalars } = project as any;
      items.push({ ...scalars, units });
    }
    return { items, total, page, limit };
  }

  async details(id: number) {
    return this.findOrFail(id);
  }

  async create(payload: CreateProjectDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const slug = payload.slug ? toProjectSlug(payload.slug) : toProjectSlug(payload.name);
      const project = queryRunner.manager.create(Project, {
        ...payload,
        slug,
        canonicalSlug: buildProjectCanonical(payload.city, slug),
        units: undefined,
      });
      const saved = await queryRunner.manager.save(Project, project);
      if (payload.units?.length) {
        const units = payload.units.map((u) => queryRunner.manager.create(ProjectUnit, toUnitRow(u, saved.id)));
        await queryRunner.manager.save(ProjectUnit, units);
      }
      await queryRunner.commitTransaction();
      return this.findOrFail(saved.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: number, payload: UpdateProjectDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const existing = await this.findOrFail(id);
      const slug = payload.slug ? toProjectSlug(payload.slug) : payload.name ? toProjectSlug(payload.name) : existing.slug;
      const city = payload.city ?? existing.city;
      const { units, ...scalars } = payload;
      await queryRunner.manager.update(Project, id, { ...scalars, slug, canonicalSlug: buildProjectCanonical(city, slug) });
      if (units) {
        await queryRunner.manager.delete(ProjectUnit, { projectId: id });
        if (units.length) {
          await queryRunner.manager.save(ProjectUnit, units.map((u) => queryRunner.manager.create(ProjectUnit, toUnitRow(u, id))));
        }
      }
      await queryRunner.commitTransaction();
      return this.findOrFail(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateStatus(id: number, status: string) {
    await this.findOrFail(id);
    await this.projectRepository.update(id, { status: status as any });
    return this.findOrFail(id);
  }

  async remove(id: number) {
    await this.findOrFail(id);
    await this.projectRepository.delete(id);
    return { deleted: true };
  }

  async getSeo(id: number) {
    await this.findOrFail(id);
    const row = await this.seoRepository.findOne({ where: { projectId: id } });
    return row ?? { projectId: id, seoData: {} };
  }

  async upsertSeo(id: number, seoData: ProjectSeoData, verificationStatus?: string, approvalStatus?: string) {
    await this.findOrFail(id);
    const existing = await this.seoRepository.findOne({ where: { projectId: id } });
    if (!existing) {
      return this.seoRepository.save(this.seoRepository.create({ projectId: id, seoData, verificationStatus: verificationStatus ?? 'Pending', approvalStatus: approvalStatus ?? 'Pending' }));
    }
    existing.seoData = seoData;
    if (verificationStatus) existing.verificationStatus = verificationStatus;
    if (approvalStatus) existing.approvalStatus = approvalStatus;
    return this.seoRepository.save(existing);
  }
}
