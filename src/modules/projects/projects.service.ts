import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project, ProjectStatus } from '../../database/entities/project.entity';
import { ProjectSearchQueryDto } from './dto/project-search.dto';
import { computeProjectRanges } from './utils/project-ranges.util';
import { StorageService } from '../storage/storage.service';

const toProjectListItem = (project: Project, units: any[], readUrl: (key: string) => string) => {
  const { id, name, slug, canonicalSlug, projectCode, projectType, builderName, reraNumber, possessionDate, possessionStatus, city, state, sublocation, coverImageUrl, brochureKey, brochureName, status, createdAt, updatedAt, totalFloors, projectAreaSqft, towerDetails, pincode, latitude, longitude, highlights, specifications } = project;
  return {
    id, name, slug, canonicalSlug, projectCode, projectType, builderName, reraNumber,
    possessionDate, possessionStatus, city, state, sublocation,
    totalFloors, projectAreaSqft, towerDetails, pincode, latitude, longitude, highlights, specifications,
    brochureUrl: brochureKey ? readUrl(brochureKey) : null,
    brochureName,
    coverImageUrl: coverImageUrl ? readUrl(coverImageUrl) : coverImageUrl,
    status, createdAt, updatedAt,
    ranges: computeProjectRanges(units),
  };
};

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly storageService: StorageService,
  ) {}

  private readUrl = (key: string): string => this.storageService.generateReadUrl(key);

  private resolveUnitUrls(units: any[]): any[] {
    return units.map((u) => ({
      ...u,
      floorPlanImageUrl: u.floorPlanImageUrl ? this.readUrl(u.floorPlanImageUrl) : u.floorPlanImageUrl,
    }));
  }

  async list(query: ProjectSearchQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 12;
    const qb = this.projectRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.units', 'u', 'u.status = :unitStatus', { unitStatus: 'available' })
      .where('p.status = :status', { status: ProjectStatus.PUBLISHED });
    if (query.city) qb.andWhere('(p.city LIKE :city OR p.sublocation LIKE :city)', { city: `%${query.city}%` });
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
      const units = this.resolveUnitUrls((await project.units) ?? []);
      items.push(toProjectListItem(project, units, this.readUrl));
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
    const rawUnits = ((await project.units) ?? []) as any[];
    const unitsWithFurnishings = await Promise.all(
      rawUnits.map(async (u: any) => {
        let links: any[] = [];
        try {
          links = (await u.unitFurnishings) ?? [];
        } catch {
          links = [];
        }
        const furnishingItems = await Promise.all(
          links.map(async (link: any) => link.furnishingItem),
        );
        return { ...u, furnishingItems };
      }),
    );
    const units = this.resolveUnitUrls(unitsWithFurnishings);
    const seo = await project.seo;
    const projectAmenitiesRaw = ((await project.projectAmenities) ?? []) as any[];
    const projectAmenities = await Promise.all(
      projectAmenitiesRaw.map(async (pa) => ({ ...pa, amenity: await pa.amenity })),
    );
    const projectFaqsRaw = ((await project.projectFaqs) ?? []) as any[];
    const projectFaqs = projectFaqsRaw
      .slice()
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const availableFirst = [...units].sort((a: any, b: any) =>
      a.status === b.status ? 0 : a.status === 'available' ? -1 : 1,
    );
    return {
      ...toProjectListItem(project, units, this.readUrl),
      description: project.description,
      address: project.address,
      towers: project.towers,
      totalUnits: project.totalUnits,
      galleryImageUrls: (project.galleryImageUrls ?? []).map((g) => this.readUrl(g)),
      units: availableFirst,
      projectAmenities,
      projectFaqs,
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
