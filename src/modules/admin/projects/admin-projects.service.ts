import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Project } from '../../../database/entities/project.entity';
import { ProjectUnit } from '../../../database/entities/project-unit.entity';
import { ProjectSeo, ProjectSeoData } from '../../../database/entities/project-seo.entity';
import { toProjectSlug } from '../../../modules/projects/utils/project-slug.util';
import { generateProjectCode } from '../../../modules/projects/utils/project-code.util';
import { CreateProjectDto, CreateProjectUnitDto, UpdateProjectDto } from './dto/create-project.dto';
import { StorageService } from '../../storage/storage.service';

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
    private readonly storageService: StorageService,
  ) {}

  private async finalizeImage(key?: string): Promise<string | undefined> {
    if (!key) return undefined;
    return this.storageService.processAndUploadImage(key);
  }

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
      const coverImageUrl = await this.finalizeImage(payload.coverImageUrl);
      const project = queryRunner.manager.create(Project, {
        ...payload,
        coverImageUrl,
        slug,
        canonicalSlug: slug,
        units: undefined,
      });
      const saved = await queryRunner.manager.save(Project, project);
      if (payload.units?.length) {
        const rows: Record<string, unknown>[] = [];
        for (const u of payload.units) {
          rows.push({ ...toUnitRow(u, saved.id), floorPlanImageUrl: await this.finalizeImage(u.floorPlanImageUrl) });
        }
        const units = rows.map((r) => queryRunner.manager.create(ProjectUnit, r));
        await queryRunner.manager.save(ProjectUnit, units);
      }
      // Assign project code using DB-generated ID (same pattern as property codes and asset display IDs)
      const projectCode = generateProjectCode(saved.projectType, saved.id);
      saved.projectCode = projectCode;
      // canonicalSlug = slug-<projectcode-lowercase> for unique, SEO-friendly root URLs
      saved.canonicalSlug = `${saved.slug}-${projectCode.toLowerCase()}`;
      await queryRunner.manager.save(Project, saved);
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
      let slugPatch: Partial<{ slug: string; canonicalSlug: string }> = {};
      if (payload.slug) {
        const newSlug = toProjectSlug(payload.slug);
        // Keep canonicalSlug in sync: slug-<projectcode-lowercase>
        // existing.projectCode is already set; use it to rebuild canonical
        const existingCode = existing.projectCode as string | null;
        slugPatch = {
          slug: newSlug,
          canonicalSlug: existingCode ? `${newSlug}-${existingCode.toLowerCase()}` : newSlug,
        };
      }
      const { units, ...scalars } = payload;
      const coverImageUrl = scalars.coverImageUrl ? await this.finalizeImage(scalars.coverImageUrl) : scalars.coverImageUrl;
      await queryRunner.manager.update(Project, id, { ...scalars, coverImageUrl, ...slugPatch });
      if (units) {
        await queryRunner.manager.delete(ProjectUnit, { projectId: id });
        if (units.length) {
          const rows: Record<string, unknown>[] = [];
          for (const u of units) {
            rows.push({ ...toUnitRow(u, id), floorPlanImageUrl: await this.finalizeImage(u.floorPlanImageUrl) });
          }
          await queryRunner.manager.save(ProjectUnit, rows.map((r) => queryRunner.manager.create(ProjectUnit, r)));
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
