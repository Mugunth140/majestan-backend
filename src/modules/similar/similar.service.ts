import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Not } from 'typeorm';
import { Property, PropertyStatus } from '../../database/entities/property.entity';
import { Project, ProjectStatus } from '../../database/entities/project.entity';
import { StorageService } from '../storage/storage.service';
import { toProjectListItem } from '../projects/projects.service';
import { computeProjectRanges } from '../projects/utils/project-ranges.util';
import {
  FEATURED_PROPERTY_RELATIONS,
  FeaturedProperty,
  toFeaturedProperty,
} from '../showcases/featured-property.mapper';
import {
  PROJECT_CRITERIA,
  PROPERTY_CRITERIA,
  ProjectTraits,
  PropertyTraits,
  rankByPriority,
} from './similar-ranking';

/** Same-type candidates scored per request. */
const SAME_TYPE_POOL = 150;
/** Other-type candidates, scored only to top up a thin same-type pool. */
const OTHER_TYPE_POOL = 40;

export type SimilarProperty = FeaturedProperty & {
  matches: string[];
  /** Built-up area in sq.ft, for the card's facts line. */
  builtUpAreaSqft: number | null;
  /** Plots only: "4.5 cents" or "2,400 Sq Ft". */
  plotAreaLabel: string | null;
  /** Plots only: "40 x 60" or the free-text dimension. */
  plotDimensions: string | null;
};
export type SimilarProject = ReturnType<typeof toProjectListItem> & { matches: string[] };

const time = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : 0);

const positive = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const trimNumber = (n: number) => String(Number(n.toFixed(2)));

/** Area figures the similar-property card shows, read from property details. */
function areaFacts(d: any): Pick<SimilarProperty, 'builtUpAreaSqft' | 'plotAreaLabel' | 'plotDimensions'> {
  const builtUp = positive(d?.builtUpArea) ?? positive(d?.superBuiltUpArea) ?? positive(d?.carpetArea) ?? positive(d?.areaSqft);
  const cents = positive(d?.plotSizeCents);
  const plotArea = positive(d?.plotArea);
  const plotAreaLabel = cents
    ? `${trimNumber(cents)} cents`
    : plotArea
      ? `${Math.round(plotArea).toLocaleString('en-IN')} ${String(d?.areaUnit || 'Sq Ft').trim()}`
      : null;
  const length = positive(d?.plotLength);
  const width = positive(d?.plotWidth);
  const plotDimensions =
    length && width ? `${trimNumber(length)} x ${trimNumber(width)}` : d?.dimension?.trim() || null;
  return { builtUpAreaSqft: builtUp, plotAreaLabel, plotDimensions };
}

/**
 * "Similar" rails for property and project pages. Candidates are live
 * listings in the same city (and, for properties, the same Buy/Rent);
 * `rankByPriority` puts the closest matches first (type, then possession
 * status, configuration, locality, price…) and steps down from there. Each
 * card carries the reasons it matched, for the UI.
 */
@Injectable()
export class SimilarService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
  ) {}

  private readUrl = (key: string): string => this.storageService.generateReadUrl(key);

  async similarProperties(id: number): Promise<SimilarProperty[]> {
    const repo = this.dataSource.getRepository(Property);
    const base = await repo.findOne({ where: { id }, relations: FEATURED_PROPERTY_RELATIONS });
    if (!base) return [];

    // Only listings in the same city and the same Buy/Rent are ever shown.
    if (!base.city?.trim()) return [];
    const live = {
      status: PropertyStatus.AVAILABLE,
      approvalStatus: 'Approved',
      city: base.city,
      listingType: base.listingType,
    };
    const sameType = await repo.find({
      where: { ...live, id: Not(id), propertyType: base.propertyType },
      relations: FEATURED_PROPERTY_RELATIONS,
      order: { createdAt: 'DESC' },
      take: SAME_TYPE_POOL,
    });
    const otherType = await repo.find({
      where: { ...live, id: Not(id), propertyType: Not(base.propertyType) },
      relations: FEATURED_PROPERTY_RELATIONS,
      order: { createdAt: 'DESC' },
      take: OTHER_TYPE_POOL,
    });
    const candidates = [...sameType, ...otherType];

    const traits = async (p: Property): Promise<PropertyTraits> => {
      const locations = await p.propertyLocations;
      const details = await p.propertyDetails;
      const d = Array.isArray(details) ? details[0] : details;
      const price = Number(p.price);
      return {
        id: p.id,
        propertyType: String(p.propertyType),
        listingType: p.listingType ?? null,
        possession: d?.possessionStatus ?? null,
        bedrooms: typeof d?.bedrooms === 'number' && d.bedrooms > 0 ? d.bedrooms : null,
        sublocation: locations?.[0]?.sublocation?.localityName ?? null,
        city: p.city ?? null,
        price: Number.isFinite(price) && price > 0 ? price : null,
        condition: p.propertyCondition ?? null,
        createdAt: time(p.createdAt),
      };
    };

    const byId = new Map(candidates.map((c) => [c.id, c]));
    const ranked = rankByPriority(
      await traits(base),
      await Promise.all(candidates.map(traits)),
      PROPERTY_CRITERIA,
    );
    return Promise.all(
      ranked.map(async ({ item, matches }) => {
        const property = byId.get(item.id)!;
        const details = await property.propertyDetails;
        const d = Array.isArray(details) ? details[0] : details;
        return {
          ...(await toFeaturedProperty(property, this.readUrl)),
          ...areaFacts(d),
          matches,
        };
      }),
    );
  }

  async similarProjects(id: number): Promise<SimilarProject[]> {
    const repo = this.dataSource.getRepository(Project);
    const withUnits = () =>
      repo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.units', 'u', 'u.status = :unitStatus', { unitStatus: 'available' });

    const base = await withUnits().where('p.id = :id', { id }).getOne();
    if (!base) return [];

    // Only projects in the same city are ever shown.
    if (!base.city?.trim()) return [];
    const published = (sameType: boolean, take: number) =>
      withUnits()
        .where('p.status = :status', { status: ProjectStatus.PUBLISHED })
        .andWhere('p.city = :city', { city: base.city })
        .andWhere(sameType ? 'p.projectType = :type' : 'p.projectType != :type', { type: base.projectType })
        .andWhere('p.id != :id', { id })
        .orderBy('p.createdAt', 'DESC')
        .take(take)
        .getMany();
    const candidates = [
      ...(await published(true, SAME_TYPE_POOL)),
      ...(await published(false, OTHER_TYPE_POOL)),
    ];

    const unitsOf = async (p: Project) => ((await p.units) ?? []) as any[];
    const traits = async (p: Project): Promise<ProjectTraits> => {
      const ranges = computeProjectRanges(await unitsOf(p));
      return {
        id: p.id,
        projectType: String(p.projectType),
        possession: p.possessionStatus ?? null,
        bhk: (ranges.bhk ?? []).map(Number).filter((n) => Number.isFinite(n) && n > 0),
        sublocation: p.sublocation ?? null,
        city: p.city ?? null,
        minPrice: ranges.minPrice ?? null,
        maxPrice: ranges.maxPrice ?? null,
        createdAt: time(p.createdAt),
      };
    };

    const byId = new Map(candidates.map((c) => [c.id, c]));
    const ranked = rankByPriority(
      await traits(base),
      await Promise.all(candidates.map(traits)),
      PROJECT_CRITERIA,
    );
    return Promise.all(
      ranked.map(async ({ item, matches }) => {
        const project = byId.get(item.id)!;
        return { ...toProjectListItem(project, await unitsOf(project), this.readUrl), matches };
      }),
    );
  }
}
