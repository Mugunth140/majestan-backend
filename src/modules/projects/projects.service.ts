import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project, ProjectStatus } from '../../database/entities/project.entity';
import { ProjectSearchQueryDto } from './dto/project-search.dto';
import { computeProjectRanges } from './utils/project-ranges.util';

const toProjectListItem = (project: Project, units: any[]) => {
  const { id, name, slug, canonicalSlug, projectType, builderName, reraNumber, possessionDate, possessionStatus, city, state, sublocation, coverImageUrl, status, createdAt, updatedAt } = project;
  return {
    id, name, slug, canonicalSlug, projectType, builderName, reraNumber,
    possessionDate, possessionStatus, city, state, sublocation,
    coverImageUrl, status, createdAt, updatedAt,
    ranges: computeProjectRanges(units),
  };
};

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async list(query: ProjectSearchQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 12;
    const qb = this.projectRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.units', 'u', 'u.status = :unitStatus', { unitStatus: 'available' })
      .where('p.status = :status', { status: ProjectStatus.PUBLISHED });
    if (query.city) qb.andWhere('p.city LIKE :city', { city: `%${query.city}%` });
    if (query.projectType) qb.andWhere('p.projectType = :projectType', { projectType: query.projectType });
    if (query.possession) qb.andWhere('p.possessionStatus = :possession', { possession: query.possession });
    if (query.rera) qb.andWhere("p.reraNumber IS NOT NULL AND p.reraNumber != ''");
    if (query.bhk) qb.andWhere('u.bedrooms = :bhk', { bhk: query.bhk });
    if (query.minPrice) qb.andWhere('u.price >= :minPrice', { minPrice: query.minPrice });
    if (query.maxPrice) qb.andWhere('u.price <= :maxPrice', { maxPrice: query.maxPrice });
    const [projects, total] = await qb
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const items: any[] = [];
    for (const project of projects) {
      items.push(toProjectListItem(project, (await project.units) ?? []));
    }
    return { items, total, page, limit };
  }

  async detailsBySlug(slug: string) {
    const project = await this.projectRepository.findOne({
      where: [{ slug }, { canonicalSlug: slug }],
    });
    if (!project || project.status !== ProjectStatus.PUBLISHED) {
      throw new NotFoundException('Project not found');
    }
    const units = ((await project.units) ?? []) as any[];
    const seo = await project.seo;
    const availableFirst = [...units].sort((a: any, b: any) =>
      a.status === b.status ? 0 : a.status === 'available' ? -1 : 1,
    );
    return {
      ...toProjectListItem(project, units),
      description: project.description,
      address: project.address,
      towers: project.towers,
      totalUnits: project.totalUnits,
      galleryImageUrls: project.galleryImageUrls,
      units: availableFirst,
      seo: seo ?? null,
    };
  }

  async getAllSlugs(): Promise<string[]> {
    const projects = await this.projectRepository.find({
      where: { status: ProjectStatus.PUBLISHED },
      select: ['canonicalSlug'],
    });
    return projects.map((p) => p.canonicalSlug).filter(Boolean);
  }
}
