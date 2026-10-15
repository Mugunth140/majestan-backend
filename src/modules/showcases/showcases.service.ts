import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import {
  SHOWCASE_MAX_ITEMS,
  SHOWCASE_SECTION_KIND,
  ShowcaseItem,
  ShowcaseSection,
} from '../../database/entities/showcase-item.entity';
import { Property, PropertyStatus } from '../../database/entities/property.entity';
import { Project, ProjectStatus } from '../../database/entities/project.entity';
import { StorageService } from '../storage/storage.service';
import { toProjectListItem } from '../projects/projects.service';
import {
  FEATURED_PROPERTY_RELATIONS,
  FeaturedProperty,
  toFeaturedProperty,
} from './featured-property.mapper';

/** How many items the automatic fallback shows while a section is uncurated. */
const FALLBACK_LIMIT = 10;
const CANDIDATE_LIMIT = 20;

/** One row in the CRM picker: enough to recognise the record at a glance. */
export type ShowcaseSummary = {
  id: number;
  title: string;
  location: string | null;
  imageUrl: string | null;
  /** Short type label, e.g. "Apartment · Sell" or "Villa project". */
  meta: string | null;
  /** False when the record is no longer shown on the site (sold, unpublished…). */
  isLive: boolean;
};

const isLiveProperty = (p: Property) =>
  p.status === PropertyStatus.AVAILABLE && p.approvalStatus === 'Approved';
const isLiveProject = (p: Project) => p.status === ProjectStatus.PUBLISHED;

const titleCase = (value: string) =>
  value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Showcases: the CRM-curated lists behind the home page's "Handpicked
 * Properties" and "Featured Projects". Picks are stored by id in order; on
 * the site only live records render, and an empty section falls back to the
 * newest live records so the home page never loses the section.
 */
@Injectable()
export class ShowcasesService {
  constructor(
    @InjectRepository(ShowcaseItem) private readonly itemRepo: Repository<ShowcaseItem>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
  ) {}

  private readUrl = (key: string): string => this.storageService.generateReadUrl(key);
  private get propertyRepo() {
    return this.dataSource.getRepository(Property);
  }
  private get projectRepo() {
    return this.dataSource.getRepository(Project);
  }

  static parseSection(value: string): ShowcaseSection {
    if (!Object.values(ShowcaseSection).includes(value as ShowcaseSection)) {
      throw new BadRequestException(
        `Unknown showcase section "${value}". Use ${Object.values(ShowcaseSection).join(' or ')}.`,
      );
    }
    return value as ShowcaseSection;
  }

  async getIds(section: ShowcaseSection): Promise<number[]> {
    const rows = await this.itemRepo.find({
      where: { section },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return rows.map((r) => r.itemId);
  }

  /** Replace a section's picks with `ids`, in that order. */
  async replace(section: ShowcaseSection, ids: number[]): Promise<ShowcaseSummary[]> {
    const unique = [...new Set(ids)];
    if (unique.length !== ids.length) throw new BadRequestException('The same item was picked twice.');
    if (unique.length > SHOWCASE_MAX_ITEMS) {
      throw new BadRequestException(`A section can hold at most ${SHOWCASE_MAX_ITEMS} items.`);
    }

    if (unique.length > 0) {
      const repo = SHOWCASE_SECTION_KIND[section] === 'property' ? this.propertyRepo : this.projectRepo;
      const found = await repo.count({ where: { id: In(unique) } });
      if (found !== unique.length) throw new BadRequestException('Some picked items no longer exist.');
    }

    await this.dataSource.transaction(async (em) => {
      await em.delete(ShowcaseItem, { section });
      if (unique.length > 0) {
        await em.insert(
          ShowcaseItem,
          unique.map((itemId, sortOrder) => ({ section, itemId, sortOrder })),
        );
      }
    });

    return this.adminList(section);
  }

  /** The section as the CRM sees it: every pick, live or not, in order. */
  async adminList(section: ShowcaseSection): Promise<ShowcaseSummary[]> {
    const ids = await this.getIds(section);
    if (ids.length === 0) return [];
    const summaries =
      SHOWCASE_SECTION_KIND[section] === 'property'
        ? await this.summariseProperties(await this.loadProperties(ids))
        : await this.summariseProjects(await this.loadProjects(ids));
    const byId = new Map(summaries.map((s) => [s.id, s]));
    return ids.map((id) => byId.get(id)).filter((s): s is ShowcaseSummary => !!s);
  }

  /** Live records matching `q`, for the CRM picker. */
  async candidates(section: ShowcaseSection, q = ''): Promise<ShowcaseSummary[]> {
    const term = `%${q.trim()}%`;
    if (SHOWCASE_SECTION_KIND[section] === 'property') {
      const qb = this.propertyRepo
        .createQueryBuilder('p')
        .where('p.status = :status', { status: PropertyStatus.AVAILABLE })
        .andWhere('p.approvalStatus = :approved', { approved: 'Approved' });
      if (q.trim()) {
        qb.andWhere(
          new Brackets((w) => {
            w.where('p.title LIKE :term', { term }).orWhere('p.city LIKE :term', { term });
            if (/^\d+$/.test(q.trim())) w.orWhere('p.id = :id', { id: Number(q.trim()) });
          }),
        );
      }
      const rows = await qb.orderBy('p.createdAt', 'DESC').take(CANDIDATE_LIMIT).getMany();
      return this.summariseProperties(rows);
    }

    const qb = this.projectRepo
      .createQueryBuilder('p')
      .where('p.status = :status', { status: ProjectStatus.PUBLISHED });
    if (q.trim()) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('p.name LIKE :term', { term })
            .orWhere('p.city LIKE :term', { term })
            .orWhere('p.sublocation LIKE :term', { term })
            .orWhere('p.builderName LIKE :term', { term });
        }),
      );
    }
    const rows = await qb.orderBy('p.createdAt', 'DESC').take(CANDIDATE_LIMIT).getMany();
    return this.summariseProjects(rows);
  }

  /** Home page: curated live properties, else the newest live apartments. */
  async handpickedProperties(): Promise<FeaturedProperty[]> {
    const ids = await this.getIds(ShowcaseSection.HandpickedProperties);
    let properties: Property[];
    if (ids.length > 0) {
      const loaded = await this.loadProperties(ids, FEATURED_PROPERTY_RELATIONS);
      const byId = new Map(loaded.filter(isLiveProperty).map((p) => [p.id, p]));
      properties = ids.map((id) => byId.get(id)).filter((p): p is Property => !!p);
    } else {
      properties = [];
    }
    if (properties.length === 0) {
      properties = await this.propertyRepo.find({
        where: { propertyType: 'apartment' as any, status: PropertyStatus.AVAILABLE, approvalStatus: 'Approved' },
        relations: FEATURED_PROPERTY_RELATIONS,
        order: { createdAt: 'DESC' },
        take: FALLBACK_LIMIT,
      });
    }
    return Promise.all(properties.map((p) => toFeaturedProperty(p, this.readUrl)));
  }

  /** Home page: curated published projects, else the newest published ones. */
  async featuredProjects() {
    const ids = await this.getIds(ShowcaseSection.FeaturedProjects);
    let projects: Project[] = [];
    if (ids.length > 0) {
      const loaded = await this.loadProjects(ids, true);
      const byId = new Map(loaded.filter(isLiveProject).map((p) => [p.id, p]));
      projects = ids.map((id) => byId.get(id)).filter((p): p is Project => !!p);
    }
    if (projects.length === 0) {
      projects = await this.projectRepo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.units', 'u', 'u.status = :unitStatus', { unitStatus: 'available' })
        .where('p.status = :status', { status: ProjectStatus.PUBLISHED })
        .orderBy('p.createdAt', 'DESC')
        .take(FALLBACK_LIMIT)
        .getMany();
    }
    const items: ReturnType<typeof toProjectListItem>[] = [];
    for (const project of projects) {
      const units = ((await project.units) ?? []) as any[];
      items.push(toProjectListItem(project, units, this.readUrl));
    }
    return items;
  }

  private loadProperties(ids: number[], relations: string[] = ['propertyImages']) {
    return this.propertyRepo.find({ where: { id: In(ids) }, relations });
  }

  private loadProjects(ids: number[], withAvailableUnits = false) {
    const qb = this.projectRepo.createQueryBuilder('p').where('p.id IN (:...ids)', { ids });
    if (withAvailableUnits) {
      qb.leftJoinAndSelect('p.units', 'u', 'u.status = :unitStatus', { unitStatus: 'available' });
    }
    return qb.getMany();
  }

  private async summariseProperties(rows: Property[]): Promise<ShowcaseSummary[]> {
    return Promise.all(
      rows.map(async (p) => {
        const images = await p.propertyImages;
        const key = images?.find((i) => i.isPrimary)?.imageUrl || images?.[0]?.imageUrl || null;
        return {
          id: p.id,
          title: p.title,
          location: p.city || null,
          imageUrl: key ? this.readUrl(key) : null,
          meta: [titleCase(String(p.propertyType)), p.listingType].filter(Boolean).join(' · '),
          isLive: isLiveProperty(p),
        };
      }),
    );
  }

  private async summariseProjects(rows: Project[]): Promise<ShowcaseSummary[]> {
    return rows.map((p) => ({
      id: p.id,
      title: p.name,
      location: [p.sublocation, p.city].filter(Boolean).join(', ') || null,
      imageUrl: p.coverImageUrl ? this.readUrl(p.coverImageUrl) : null,
      meta: [p.projectType ? `${titleCase(String(p.projectType))} project` : 'Project', p.builderName]
        .filter(Boolean)
        .join(' · '),
      isLive: isLiveProject(p),
    }));
  }
}
