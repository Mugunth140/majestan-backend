import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Project, ProjectStatus } from '../../database/entities/project.entity';
import { PropertiesService, AREA_EXPR } from './properties.service';
import {
  PropertySearchQueryDto,
  PropertySortOption,
} from './dto/property-search.dto';
import { StorageService } from '../storage/storage.service';
import { toProjectListItem } from '../projects/projects.service';

const PROJECT_TYPES = ['apartment', 'villa', 'plot'];
const place = (value: string) =>
  value.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
const placeColumn = (column: string) =>
  `LOWER(REPLACE(REPLACE(TRIM(${column}), '-', ' '), '  ', ' '))`;
const projectArea =
  'COALESCE(u.builtupAreaSqft, u.carpetAreaSqft, u.superBuiltupAreaSqft, u.plotAreaSqft, u.plotAreaCents * 435.6)';
const list = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value])
    .filter((v) => v !== undefined && v !== null && v !== '')
    .map(String);

type ListingKey = { kind: 'property' | 'project'; id: number };

/** A database-paginated feed: never combine two independently paginated pages. */
@Injectable()
export class PropertyListingsService {
  constructor(
    private readonly properties: PropertiesService,
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
  ) {}

  projectSearchQuery(query: PropertySearchQueryDto) {
    const projectPrice =
      query.listingType === 'Rent' ? 'u.monthlyRent' : 'u.price';
    const qb = this.dataSource
      .getRepository(Project)
      .createQueryBuilder('project')
      .innerJoinAndSelect(
        'project.units',
        'u',
        "(u.status = :available OR project.status = 'booked') AND u.listingMode = :listingMode",
        {
          available: 'available',
          listingMode: query.listingType === 'Rent' ? 'rent' : 'sale',
        },
      )
      .where('project.status IN (:...publicProjectStatuses)', { publicProjectStatuses: [ProjectStatus.PUBLISHED, ProjectStatus.BOOKED] })
      .andWhere('project.projectType IN (:...projectTypes)', {
        projectTypes: PROJECT_TYPES,
      });
    if (query.propertyType)
      qb.andWhere('project.projectType = :selectedType', {
        selectedType: query.propertyType,
      });
    if (query.city)
      qb.andWhere(`${placeColumn('project.city')} = :city`, {
        city: place(query.city),
      });
    if (query.location)
      qb.andWhere(
        `(${placeColumn('project.city')} = :location OR ${placeColumn('project.sublocation')} = :location)`,
        { location: place(query.location) },
      );
    if (query.propertyName?.trim())
      qb.andWhere(
        '(project.name LIKE :keyword OR project.projectCode LIKE :keyword OR project.builderName LIKE :keyword OR project.city LIKE :keyword OR project.sublocation LIKE :keyword)',
        { keyword: `%${query.propertyName.trim()}%` },
      );
    for (const [key, expression, comparison] of [
      ['minPrice', projectPrice, '>='],
      ['maxPrice', projectPrice, '<='],
      ['minArea', projectArea, '>='],
      ['maxArea', projectArea, '<='],
    ] as const) {
      if (
        query[key] !== undefined &&
        query[key] !== '' &&
        Number.isFinite(Number(query[key]))
      ) {
        qb.andWhere(`${expression} ${comparison} :${key}`, {
          [key]: Number(query[key]),
        });
      }
    }
    if (query.bedrooms) {
      const bedrooms = parseInt(query.bedrooms, 10);
      if (Number.isFinite(bedrooms))
        qb.andWhere(
          `u.bedrooms ${query.bedrooms.endsWith('+') ? '>=' : '='} :bedrooms`,
          { bedrooms },
        );
    }
    const facings = list(query.facing).map((f) =>
      f.toLowerCase().replace(/[-\s]+/g, '_'),
    );
    if (facings.length) qb.andWhere('u.facing IN (:...facings)', { facings });
    const furnishingNames: Record<string, string> = {
      furnished: 'fully_furnished',
      unfurnished: 'unfurnished',
      semi: 'semi_furnished',
    };
    const furnishings = list(query.furnishing)
      .map((f) => furnishingNames[f.toLowerCase()])
      .filter(Boolean);
    if (furnishings.length)
      qb.andWhere('u.furnishedStatus IN (:...furnishings)', { furnishings });
    // Projects have no numeric property-age field. Only explicitly new
    // developments can satisfy the "New" bucket; never invent an older age.
    const ages = [...list(query.propertyAge), ...list(query.age)];
    if (ages.length) {
      if (ages.some((age) => age.toLowerCase() === 'new')) {
        qb.andWhere('project.possessionStatus IN (:...newStatuses)', {
          newStatuses: ['new_launch', 'under_construction', 'ready_to_move'],
        });
      } else qb.andWhere('1 = 0');
    }
    return qb;
  }

  async search(query: PropertySearchQueryDto) {
    if (query.propertyType && !PROJECT_TYPES.includes(query.propertyType)) {
      return this.properties.search(query);
    }
    const descending =
      query.sort === PropertySortOption.PriceHighToLow ||
      query.sort === PropertySortOption.AreaHighToLow;
    const byArea =
      query.sort === PropertySortOption.AreaLowToHigh ||
      query.sort === PropertySortOption.AreaHighToLow;
    const sorted = Boolean(query.sort);
    const renting = query.listingType === 'Rent';
    const projectPrice = renting ? 'u.monthlyRent' : 'u.price';
    const propertyQuery = this.properties
      .databaseSearchQuery(query)
      .select([
        "'property' AS kind",
        'p.id AS id',
        'p.createdAt AS created_at',
        `${byArea ? AREA_EXPR : 'p.price'} AS sort_value`,
      ])
      .distinct(true);
    const projectQuery = this.projectSearchQuery(query)
      .select([
        "'project' AS kind",
        'project.id AS id',
        'project.createdAt AS created_at',
        `${descending ? 'MAX' : 'MIN'}(${byArea ? projectArea : projectPrice}) AS sort_value`,
      ])
      .groupBy('project.id')
      .addGroupBy('project.createdAt');
    const [propertySql, propertyParams] = propertyQuery.getQueryAndParameters();
    const [projectSql, projectParams] = projectQuery.getQueryAndParameters();
    const union = `${propertySql} UNION ALL ${projectSql}`;
    const params = [...propertyParams, ...projectParams];
    const page = query.page || 1;
    const limit = query.limit || 14;
    const order = sorted
      ? `sort_value IS NULL ASC, sort_value ${descending ? 'DESC' : 'ASC'}, `
      : '';
    const [counts, keys]: [{ total: string | number }[], ListingKey[]] =
      await Promise.all([
        this.dataSource.query(
          `SELECT COUNT(*) AS total FROM (${union}) listings`,
          params,
        ),
        this.dataSource.query(
          `SELECT kind, id FROM (${union}) listings ORDER BY ${order}created_at DESC, kind ASC, id DESC LIMIT ? OFFSET ?`,
          [...params, limit, (page - 1) * limit],
        ),
      ]);
    const propertyIds = keys
      .filter((key) => key.kind === 'property')
      .map((key) => Number(key.id));
    const projectIds = keys
      .filter((key) => key.kind === 'project')
      .map((key) => Number(key.id));
    const [properties, projects] = await Promise.all([
      propertyIds.length
        ? this.properties
            .databaseSearchQuery(query)
            .andWhere('p.id IN (:...pageIds)', { pageIds: propertyIds })
            .getMany()
        : [],
      projectIds.length
        ? this.projectSearchQuery(query)
            .andWhere('project.id IN (:...pageProjectIds)', {
              pageProjectIds: projectIds,
            })
            .getMany()
        : [],
    ]);
    const items = new Map<string, Record<string, unknown>>();
    for (const property of properties) {
      const images = this.storage.resolveImageUrls(
        (await property.propertyImages) ?? [],
      );
      items.set(`property:${property.id}`, {
        ...property,
        listingKind: 'property',
        images,
        propertyImages: images,
        canonicalSlug: property.slug || null,
      });
    }
    for (const project of projects) {
      const units = ((await project.units) ?? []).filter(
        (unit) =>
          (unit.status === 'available' || project.status === ProjectStatus.BOOKED) &&
          unit.listingMode === (renting ? 'rent' : 'sale'),
      );
      const card = toProjectListItem(
        project,
        renting
          ? units.map((unit) => ({ ...unit, price: unit.monthlyRent }))
          : units,
        (key) => this.storage.generateReadUrl(key),
      );
      items.set(`project:${project.id}`, {
        id: project.id,
        propertyType: project.projectType,
        canonicalSlug: project.canonicalSlug,
        listingKind: 'project',
        project: { ...card, listingType: renting ? 'Rent' : 'Sell' },
      });
    }
    return {
      items: keys
        .map((key) => items.get(`${key.kind}:${key.id}`))
        .filter(Boolean),
      total: Number(counts[0]?.total ?? 0),
      page,
      limit,
    };
  }
}
