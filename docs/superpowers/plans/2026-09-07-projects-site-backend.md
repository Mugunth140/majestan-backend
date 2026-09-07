# Projects Site-Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New `projects` + `project_units` tables and a single site-backend REST API (public read + admin write + SEO) for villa/apartment projects with computed price/area/BHK ranges.

**Architecture:** New `ProjectsModule` (public `projects` controller) mirroring `PropertiesModule`; new `AdminProjectsModule` under `admin/projects` mirroring `AdminPropertiesModule` with `@Roles(Admin, Staff)`; TypeORM `synchronize: true` creates tables (no manual migration); ranges computed in JS from available units, never stored.

**Tech Stack:** NestJS 11, TypeORM 0.3 + MySQL 8, class-validator/transformer, jest 30 + ts-jest, bun runtime.

## Global Constraints

- TypeORM `synchronize: true` — entities are the migration; never write manual SQL migrations for site-backend.
- Global `JwtAuthGuard` + `RolesGuard` are on — every public route needs `@Public()`, every admin controller needs `@Roles(AppRole.Admin, AppRole.Staff)`.
- DB enum columns must use TS enums; snake_case column names; `CURRENT_TIMESTAMP(6)` timestamps; unsigned ints.
- No placeholders, no TODOs, complete code every step; commit after each task.

---

## File structure

- `src/database/entities/project.entity.ts` — `Project`, `ProjectType`, `PossessionStatus`, `ProjectStatus` (Task 1)
- `src/database/entities/project-unit.entity.ts` — `ProjectUnit`, reuses enums from `property-unit.entity` (Task 1)
- `src/database/entities/project-seo.entity.ts` — `ProjectSeo`, reuses `SeoPageData` type (Task 1)
- `src/modules/projects/utils/project-ranges.util.ts` + `.spec.ts` — pure range computation, TDD (Task 2)
- `src/modules/projects/utils/project-slug.util.ts` + `.spec.ts` — slug + canonical builder, TDD (Task 2)
- `src/modules/projects/dto/project-search.dto.ts`, `dto/create-project.dto.ts` (Task 3/4)
- `src/modules/projects/projects.service.ts`, `projects.controller.ts`, `projects.module.ts` — public read API (Task 3)
- `src/modules/admin/projects/admin-projects.service.ts`, `admin-projects.controller.ts`, `admin-projects.module.ts`, `dto/update-project-status.dto.ts` — admin write + SEO (Task 4)
- Modify `src/app.module.ts`, `src/modules/admin/admin.module.ts`, `src/database/entities/property.entity.ts` (Tasks 3/4/5)

---

### Task 1: Entities

**Files:**
- Create: `src/database/entities/project.entity.ts`
- Create: `src/database/entities/project-unit.entity.ts`
- Create: `src/database/entities/project-seo.entity.ts`

**Interfaces:**
- Consumes: enums `PropertyUnitType, FurnishedStatus, FacingDirection, ListingMode, PropertyUnitStatus` from `../property-unit.entity`; `SeoPageData` from `../property-seo.entity`.
- Produces: `Project`, `ProjectType`, `PossessionStatus`, `ProjectStatus`, `ProjectUnit`, `ProjectSeo` for Tasks 3–4.

- [ ] **Step 1: Create `src/database/entities/project.entity.ts`**

```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProjectUnit } from './project-unit.entity';
import { ProjectSeo } from './project-seo.entity';

export enum ProjectType {
  APARTMENT = 'apartment',
  VILLA = 'villa',
}

export enum PossessionStatus {
  UNDER_CONSTRUCTION = 'under_construction',
  READY_TO_MOVE = 'ready_to_move',
}

export enum ProjectStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('projects')
@Index('idx_projects_city', ['city'])
@Index('idx_projects_type', ['projectType'])
@Index('idx_projects_status', ['status'])
@Index('idx_projects_slug', ['slug'], { unique: true })
@Index('idx_projects_canonical', ['canonicalSlug'], { unique: true })
export class Project {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'name', type: 'varchar', length: 255, nullable: false })
  name!: string;

  @Column({ name: 'slug', type: 'varchar', length: 512, nullable: false, unique: true })
  slug!: string;

  @Column({ name: 'canonical_slug', type: 'varchar', length: 512, nullable: false, unique: true })
  canonicalSlug!: string;

  @Column({ name: 'project_type', type: 'enum', enum: ProjectType, nullable: false })
  projectType!: ProjectType;

  @Column({ name: 'builder_name', type: 'varchar', length: 255, nullable: true })
  builderName!: string | null;

  @Column({ name: 'rera_number', type: 'varchar', length: 100, nullable: true })
  reraNumber!: string | null;

  @Column({ name: 'possession_date', type: 'date', nullable: true })
  possessionDate!: string | null;

  @Column({ name: 'possession_status', type: 'enum', enum: PossessionStatus, nullable: false, default: PossessionStatus.UNDER_CONSTRUCTION })
  possessionStatus!: PossessionStatus;

  @Column({ name: 'city', type: 'varchar', length: 255, nullable: false })
  city!: string;

  @Column({ name: 'state', type: 'varchar', length: 255, nullable: true })
  state!: string | null;

  @Column({ name: 'sublocation', type: 'varchar', length: 255, nullable: true })
  sublocation!: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  address!: string | null;

  @Column({ name: 'towers', type: 'smallint', unsigned: true, nullable: true })
  towers!: number | null;

  @Column({ name: 'total_units', type: 'int', unsigned: true, nullable: true })
  totalUnits!: number | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'cover_image_url', type: 'varchar', length: 1024, nullable: true })
  coverImageUrl!: string | null;

  @Column({ name: 'gallery_image_urls', type: 'json', nullable: true })
  galleryImageUrls!: string[] | null;

  @Column({ name: 'status', type: 'enum', enum: ProjectStatus, nullable: false, default: ProjectStatus.DRAFT })
  status!: ProjectStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt!: Date;

  @OneToMany('ProjectUnit', (unit: any) => unit.project, { lazy: true })
  units!: Promise<ProjectUnit[]>;

  @OneToOne('ProjectSeo', (seo: any) => seo.project, { lazy: true, nullable: true })
  seo!: Promise<ProjectSeo | null>;
}
```

- [ ] **Step 2: Create `src/database/entities/project-unit.entity.ts`** (full clone of `property-unit.entity.ts` fields, FK to Project)

```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';
import {
  FacingDirection,
  FurnishedStatus,
  ListingMode,
  PropertyUnitStatus,
  PropertyUnitType,
} from './property-unit.entity';

@Entity('project_units')
@Unique('uq_project_units_project_unit_code', ['projectId', 'unitCode'])
@Index('idx_project_units_project_id', ['projectId'])
@Index('idx_project_units_status', ['status'])
@Index('idx_project_units_price', ['price'])
@Index('idx_project_units_bedrooms', ['bedrooms'])
export class ProjectUnit {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'project_id', type: 'int', unsigned: true, nullable: false })
  projectId!: number;

  @Column({ name: 'unit_code', type: 'varchar', length: 64, nullable: false })
  unitCode!: string;

  @Column({ name: 'title', type: 'varchar', length: 150, nullable: true })
  title!: string | null;

  @Column({ name: 'unit_type', type: 'enum', enum: PropertyUnitType, nullable: false, default: PropertyUnitType.OTHER })
  unitType!: PropertyUnitType;

  @Column({ name: 'bedrooms', type: 'tinyint', unsigned: true, nullable: true })
  bedrooms!: number | null;

  @Column({ name: 'bathrooms', type: 'tinyint', unsigned: true, nullable: true })
  bathrooms!: number | null;

  @Column({ name: 'balconies', type: 'tinyint', unsigned: true, nullable: true })
  balconies!: number | null;

  @Column({ name: 'floor_no', type: 'smallint', unsigned: true, nullable: true })
  floorNo!: number | null;

  @Column({ name: 'total_floors', type: 'smallint', unsigned: true, nullable: true })
  totalFloors!: number | null;

  @Column({ name: 'carpet_area_sqft', type: 'decimal', precision: 12, scale: 2, nullable: true })
  carpetAreaSqft!: string | null;

  @Column({ name: 'builtup_area_sqft', type: 'decimal', precision: 12, scale: 2, nullable: true })
  builtupAreaSqft!: string | null;

  @Column({ name: 'super_builtup_area_sqft', type: 'decimal', precision: 12, scale: 2, nullable: true })
  superBuiltupAreaSqft!: string | null;

  @Column({ name: 'furnished_status', type: 'enum', enum: FurnishedStatus, nullable: true })
  furnishedStatus!: FurnishedStatus | null;

  @Column({ name: 'facing', type: 'enum', enum: FacingDirection, nullable: true })
  facing!: FacingDirection | null;

  @Column({ name: 'listing_mode', type: 'enum', enum: ListingMode, nullable: false, default: ListingMode.SALE })
  listingMode!: ListingMode;

  @Column({ name: 'price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  price!: string | null;

  @Column({ name: 'monthly_rent', type: 'decimal', precision: 12, scale: 2, nullable: true })
  monthlyRent!: string | null;

  @Column({ name: 'security_deposit', type: 'decimal', precision: 12, scale: 2, nullable: true })
  securityDeposit!: string | null;

  @Column({ name: 'maintenance_fee', type: 'decimal', precision: 12, scale: 2, nullable: true })
  maintenanceFee!: string | null;

  @Column({ name: 'available_from', type: 'date', nullable: true })
  availableFrom!: string | null;

  @Column({ name: 'status', type: 'enum', enum: PropertyUnitStatus, nullable: false, default: PropertyUnitStatus.AVAILABLE })
  status!: PropertyUnitStatus;

  @Column({ name: 'floor_plan_image_url', type: 'varchar', length: 1024, nullable: true })
  floorPlanImageUrl!: string | null;

  @Column({ name: 'floor_plan_image_key', type: 'varchar', length: 1024, nullable: true })
  floorPlanImageKey!: string | null;

  @Column({ name: 'is_primary', type: 'boolean', nullable: false, default: false })
  isPrimary!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt!: Date;

  @ManyToOne(() => Project, { lazy: true, nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id', referencedColumnName: 'id' })
  project!: Promise<Project>;
}
```

- [ ] **Step 3: Create `src/database/entities/project-seo.entity.ts`**

```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { SeoPageData } from './property-seo.entity';

export interface ProjectSeoData {
  overview?: SeoPageData;
  faqs?: { question: string; answer: string }[];
}

@Entity('project_seo')
export class ProjectSeo {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'project_id', type: 'int', unsigned: true, nullable: false, unique: true })
  projectId!: number;

  @Column({ name: 'seo_data', type: 'json', nullable: false })
  seoData: ProjectSeoData = {};

  @Column({ name: 'verification_status', type: 'varchar', length: 50, default: 'Pending' })
  verificationStatus!: string;

  @Column({ name: 'approval_status', type: 'varchar', length: 50, default: 'Pending' })
  approvalStatus!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt!: Date;

  @OneToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id', referencedColumnName: 'id' })
  project!: Project;
}
```

- [ ] **Step 4: Verify compile**

Run: `bun run build`
Expected: success, no TS errors (entities are auto-loaded by the `**/*.entity` glob; nothing else to register yet).

- [ ] **Step 5: Commit**

```bash
git add src/database/entities/project.entity.ts src/database/entities/project-unit.entity.ts src/database/entities/project-seo.entity.ts
git commit -m "feat(projects): add Project, ProjectUnit and ProjectSeo entities"
```

---

### Task 2: Range + slug utils (TDD)

**Files:**
- Create: `src/modules/projects/utils/project-ranges.util.ts`
- Create: `src/modules/projects/utils/project-ranges.util.spec.ts`
- Create: `src/modules/projects/utils/project-slug.util.ts`
- Create: `src/modules/projects/utils/project-slug.util.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `computeProjectRanges(units)` → `{ minPrice, maxPrice, minArea, maxArea, bhk, unitsCount }`; `toProjectSlug(name)`, `buildProjectCanonical(city, slug)` for Tasks 3–4.

- [ ] **Step 1: Write failing spec `src/modules/projects/utils/project-ranges.util.spec.ts`**

```ts
import { computeProjectRanges } from './project-ranges.util';

describe('computeProjectRanges', () => {
  it('computes min/max price, area and sorted bhk from available units only', () => {
    const ranges = computeProjectRanges([
      { price: '8000000', builtupAreaSqft: '1200', bedrooms: 3, status: 'available' },
      { price: '12000000', builtupAreaSqft: '1450', bedrooms: 4, status: 'available' },
      { price: '5000000', builtupAreaSqft: '900', bedrooms: 2, status: 'sold' },
    ]);
    expect(ranges).toEqual({
      minPrice: 8000000,
      maxPrice: 12000000,
      minArea: 1200,
      maxArea: 1450,
      bhk: [3, 4],
      unitsCount: 2,
    });
  });

  it('falls back to carpet then super-builtup area and ignores zero prices', () => {
    const ranges = computeProjectRanges([
      { price: '0', carpetAreaSqft: '1000', bedrooms: 2, status: 'available' },
      { price: null, superBuiltupAreaSqft: '1500', bedrooms: 3, status: 'available' },
    ]);
    expect(ranges.minPrice).toBeNull();
    expect(ranges.maxPrice).toBeNull();
    expect(ranges.minArea).toBe(1000);
    expect(ranges.maxArea).toBe(1500);
    expect(ranges.bhk).toEqual([2, 3]);
  });

  it('returns nulls for an empty unit list', () => {
    expect(computeProjectRanges([])).toEqual({
      minPrice: null,
      maxPrice: null,
      minArea: null,
      maxArea: null,
      bhk: [],
      unitsCount: 0,
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx jest project-ranges`
Expected: FAIL with "Cannot find module './project-ranges.util'".

- [ ] **Step 3: Write minimal implementation `src/modules/projects/utils/project-ranges.util.ts`**

```ts
export interface RangeUnitInput {
  price?: string | number | null;
  builtupAreaSqft?: string | number | null;
  carpetAreaSqft?: string | number | null;
  superBuiltupAreaSqft?: string | number | null;
  bedrooms?: number | null;
  status?: string | null;
}

export interface ProjectRanges {
  minPrice: number | null;
  maxPrice: number | null;
  minArea: number | null;
  maxArea: number | null;
  bhk: number[];
  unitsCount: number;
}

const toPositiveNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
};

export function computeProjectRanges(units: RangeUnitInput[]): ProjectRanges {
  const empty: ProjectRanges = {
    minPrice: null,
    maxPrice: null,
    minArea: null,
    maxArea: null,
    bhk: [],
    unitsCount: 0,
  };
  if (!units || units.length === 0) return empty;
  const available = units.filter((u) => !u.status || u.status === 'available');
  if (available.length === 0) return empty;
  const prices = available
    .map((u) => toPositiveNumber(u.price))
    .filter((n): n is number => n !== null);
  const areas = available
    .map((u) => toPositiveNumber(u.builtupAreaSqft ?? u.carpetAreaSqft ?? u.superBuiltupAreaSqft))
    .filter((n): n is number => n !== null);
  const bhk = Array.from(
    new Set(
      available
        .map((u) => (typeof u.bedrooms === 'number' ? u.bedrooms : Number(u.bedrooms)))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ).sort((a, b) => a - b);
  return {
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    minArea: areas.length ? Math.min(...areas) : null,
    maxArea: areas.length ? Math.max(...areas) : null,
    bhk,
    unitsCount: available.length,
  };
}
```

- [ ] **Step 4: Write failing slug spec `src/modules/projects/utils/project-slug.util.spec.ts`**

```ts
import { buildProjectCanonical, toProjectSlug } from './project-slug.util';

describe('project slugs', () => {
  it('slugifies names', () => {
    expect(toProjectSlug('Sunrise Villas & Resorts')).toBe('sunrise-villas-and-resorts');
  });

  it('builds canonical paths', () => {
    expect(buildProjectCanonical('Coimbatore', 'sunrise-villas')).toBe(
      'projects/coimbatore/sunrise-villas',
    );
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `bunx jest project-slug`
Expected: FAIL with "Cannot find module './project-slug.util'".

- [ ] **Step 6: Write minimal implementation `src/modules/projects/utils/project-slug.util.ts`**

```ts
export function toProjectSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildProjectCanonical(city: string, slug: string): string {
  return `projects/${toProjectSlug(city)}/${slug}`;
}
```

- [ ] **Step 7: Run both suites**

Run: `bunx jest project-ranges project-slug`
Expected: both PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/projects/utils/
git commit -m "feat(projects): add range computation and slug utils with tests"
```

---

### Task 3: Public read API

**Files:**
- Create: `src/modules/projects/dto/project-search.dto.ts`
- Create: `src/modules/projects/projects.service.ts`
- Create: `src/modules/projects/projects.controller.ts`
- Create: `src/modules/projects/projects.module.ts`
- Modify: `src/app.module.ts` (add `ProjectsModule` import + imports array entry)

**Interfaces:**
- Consumes: `Project, ProjectStatus` (Task 1), `computeProjectRanges` (Task 2).
- Produces: `ProjectsService.list/bySlug/allSlugs`, routes `GET /projects`, `GET /projects/by-slug/:slug`, `GET /projects/all-slugs` for frontend/CRM tasks.

- [ ] **Step 1: Create `src/modules/projects/dto/project-search.dto.ts`**

```ts
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ProjectSearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsIn(['apartment', 'villa'])
  projectType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bhk?: number;

  @IsOptional()
  @Type(() => Number)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  maxPrice?: number;

  @IsOptional()
  @IsIn(['under_construction', 'ready_to_move'])
  possession?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  rera?: boolean;

  @Transform(({ value }) => Number.parseInt(String(value ?? '1'), 10))
  @IsInt()
  @Min(1)
  page = 1;

  @Transform(({ value }) => Number.parseInt(String(value ?? '12'), 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 12;
}
```

- [ ] **Step 2: Create `src/modules/projects/projects.service.ts`**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project, ProjectStatus } from '../../database/entities/project.entity';
import { ProjectSearchQueryDto } from './dto/project-search.dto';
import { computeProjectRanges } from './utils/project-ranges.util';

const toProjectListItem = (project: Project) => {
  const units = ((project as any).units ?? []) as any[];
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
    return { items: projects.map(toProjectListItem), total, page, limit };
  }

  async detailsBySlug(slug: string) {
    const project = await this.projectRepository.findOne({
      where: [{ slug }, { canonicalSlug: slug }],
      relations: { units: true, seo: true },
    });
    if (!project || project.status !== ProjectStatus.PUBLISHED) {
      throw new NotFoundException('Project not found');
    }
    const units = ((project as any).units ?? []) as any[];
    const availableFirst = [...units].sort((a, b) =>
      a.status === b.status ? 0 : a.status === 'available' ? -1 : 1,
    );
    return { ...toProjectListItem(project), description: project.description, address: project.address, towers: project.towers, totalUnits: project.totalUnits, galleryImageUrls: project.galleryImageUrls, units: availableFirst, seo: (project as any).seo ?? null };
  }

  async getAllSlugs(): Promise<string[]> {
    const projects = await this.projectRepository.find({
      where: { status: ProjectStatus.PUBLISHED },
      select: ['canonicalSlug'],
    });
    return projects.map((p) => p.canonicalSlug).filter(Boolean);
  }
}
```

- [ ] **Step 3: Create `src/modules/projects/projects.controller.ts`**

```ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { ProjectsService } from './projects.service';
import { ProjectSearchQueryDto } from './dto/project-search.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Public()
  @Get()
  async list(@Query() query: ProjectSearchQueryDto) {
    return this.projectsService.list(query);
  }

  @Public()
  @Get('by-slug/:slug')
  async detailsBySlug(@Param('slug') slug: string) {
    return this.projectsService.detailsBySlug(slug);
  }

  @Public()
  @Get('all-slugs')
  async getAllSlugs() {
    return this.projectsService.getAllSlugs();
  }
}
```

- [ ] **Step 4: Create `src/modules/projects/projects.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../../database/entities/project.entity';
import { ProjectUnit } from '../../database/entities/project-unit.entity';
import { ProjectSeo } from '../../database/entities/project-seo.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectUnit, ProjectSeo])],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
```

- [ ] **Step 5: Register in `src/app.module.ts`** — add `import { ProjectsModule } from './modules/projects/projects.module';` and `ProjectsModule,` after `SearchModule,`.

- [ ] **Step 6: Verify build + boot + empty-list response**

Run: `bun run build`
Expected: success.
Run: boot dev server, then `curl -s "http://localhost:5000/api/v1/projects?limit=2"` (use the repo's configured port/prefix; confirm from `src/main.ts`).
Expected: `{ "items": [], "total": 0, ... }` wrapped by the success interceptor.
Also confirm tables exist: `docker exec <mysql> mysql -uroot -p$PASS -e "SHOW TABLES FROM <db> LIKE 'project%';"`.

- [ ] **Step 7: Commit**

```bash
git add src/modules/projects/ src/app.module.ts
git commit -m "feat(projects): add public read API (list, by-slug, all-slugs)"
```

---

### Task 4: Admin write API + SEO

**Files:**
- Create: `src/modules/admin/projects/dto/create-project.dto.ts` (Create + Update DTOs, unit DTO)
- Create: `src/modules/admin/projects/dto/update-project-status.dto.ts`
- Create: `src/modules/admin/projects/admin-projects.service.ts`
- Create: `src/modules/admin/projects/admin-projects.controller.ts`
- Create: `src/modules/admin/projects/admin-projects.module.ts`
- Modify: `src/modules/admin/admin.module.ts`

**Interfaces:**
- Consumes: `Project*` entities (Task 1), slug utils (Task 2), `ProjectsService.detailsBySlug` shape for consistent returns.
- Produces: `POST/GET/PATCH/DELETE /admin/projects`, `PATCH /admin/projects/:id/status`, `GET/PUT /admin/projects/:id/seo` for CRM proxy + site-admin tasks.

- [ ] **Step 1: Create `src/modules/admin/projects/dto/create-project.dto.ts`**

```ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  FacingDirection,
  FurnishedStatus,
  ListingMode,
  PropertyUnitStatus,
  PropertyUnitType,
} from '../../../../database/entities/property-unit.entity';
import {
  PossessionStatus,
  ProjectStatus,
  ProjectType,
} from '../../../../database/entities/project.entity';

export class CreateProjectUnitDto {
  @IsString()
  @MaxLength(64)
  unitCode!: string;

  @IsOptional() @IsString() @MaxLength(150) title?: string;
  @IsOptional() @IsEnum(PropertyUnitType) unitType?: PropertyUnitType;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bedrooms?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bathrooms?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) balconies?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) floorNo?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) totalFloors?: number;
  @IsOptional() @Type(() => Number) @IsNumber() carpetAreaSqft?: number;
  @IsOptional() @Type(() => Number) @IsNumber() builtupAreaSqft?: number;
  @IsOptional() @Type(() => Number) @IsNumber() superBuiltupAreaSqft?: number;
  @IsOptional() @IsEnum(FurnishedStatus) furnishedStatus?: FurnishedStatus;
  @IsOptional() @IsEnum(FacingDirection) facing?: FacingDirection;
  @IsOptional() @IsEnum(ListingMode) listingMode?: ListingMode;
  @IsOptional() @Type(() => Number) @IsNumber() price?: number;
  @IsOptional() @Type(() => Number) @IsNumber() monthlyRent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() securityDeposit?: number;
  @IsOptional() @Type(() => Number) @IsNumber() maintenanceFee?: number;
  @IsOptional() @IsDateString() availableFrom?: string;
  @IsOptional() @IsEnum(PropertyUnitStatus) status?: PropertyUnitStatus;
  @IsOptional() @IsString() @MaxLength(1024) floorPlanImageUrl?: string;
  @IsOptional() @IsString() @MaxLength(1024) floorPlanImageKey?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class CreateProjectDto {
  @IsString() @MaxLength(255) name!: string;
  @IsOptional() @IsString() @MaxLength(512) slug?: string;
  @IsEnum(ProjectType) projectType!: ProjectType;
  @IsOptional() @IsString() @MaxLength(255) builderName?: string;
  @IsOptional() @IsString() @MaxLength(100) reraNumber?: string;
  @IsOptional() @IsDateString() possessionDate?: string;
  @IsOptional() @IsEnum(PossessionStatus) possessionStatus?: PossessionStatus;
  @IsString() @MaxLength(255) city!: string;
  @IsOptional() @IsString() @MaxLength(255) state?: string;
  @IsOptional() @IsString() @MaxLength(255) sublocation?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) towers?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) totalUnits?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() @MaxLength(1024) coverImageUrl?: string;
  @IsOptional() @IsArray() galleryImageUrls?: string[];
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateProjectUnitDto) units?: CreateProjectUnitDto[];
}

export class UpdateProjectDto {
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(512) slug?: string;
  @IsOptional() @IsEnum(ProjectType) projectType?: ProjectType;
  @IsOptional() @IsString() @MaxLength(255) builderName?: string;
  @IsOptional() @IsString() @MaxLength(100) reraNumber?: string;
  @IsOptional() @IsDateString() possessionDate?: string;
  @IsOptional() @IsEnum(PossessionStatus) possessionStatus?: PossessionStatus;
  @IsOptional() @IsString() @MaxLength(255) city?: string;
  @IsOptional() @IsString() @MaxLength(255) state?: string;
  @IsOptional() @IsString() @MaxLength(255) sublocation?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) towers?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) totalUnits?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() @MaxLength(1024) coverImageUrl?: string;
  @IsOptional() @IsArray() galleryImageUrls?: string[];
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateProjectUnitDto) units?: CreateProjectUnitDto[];
}
```

- [ ] **Step 2: Create `src/modules/admin/projects/dto/update-project-status.dto.ts`**

```ts
import { IsEnum } from 'class-validator';
import { ProjectStatus } from '../../../../database/entities/project.entity';

export class UpdateProjectStatusDto {
  @IsEnum(ProjectStatus)
  status!: ProjectStatus;
}
```

- [ ] **Step 3: Create `src/modules/admin/projects/admin-projects.service.ts`** — queryRunner transactions mirroring `AdminPropertiesService.create` (`src/modules/admin/properties/admin-properties.service.ts:240-260`):

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Project } from '../../../database/entities/project.entity';
import { ProjectUnit } from '../../../database/entities/project-unit.entity';
import { ProjectSeo, ProjectSeoData } from '../../../database/entities/project-seo.entity';
import { buildProjectCanonical, toProjectSlug } from '../../../modules/projects/utils/project-slug.util';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';

@Injectable()
export class AdminProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectUnit) private readonly unitRepository: Repository<ProjectUnit>,
    @InjectRepository(ProjectSeo) private readonly seoRepository: Repository<ProjectSeo>,
    private readonly dataSource: DataSource,
  ) {}

  private async findOrFail(id: number): Promise<Project> {
    const project = await this.projectRepository.findOne({ where: { id }, relations: { units: true } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async list(page = 1, limit = 20, search?: string, status?: string) {
    const qb = this.projectRepository.createQueryBuilder('p').leftJoinAndSelect('p.units', 'u');
    if (search) qb.andWhere('(p.name LIKE :s OR p.builderName LIKE :s OR p.city LIKE :s)', { s: `%${search}%` });
    if (status) qb.andWhere('p.status = :status', { status });
    const [items, total] = await qb.orderBy('p.createdAt', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
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
        const units = payload.units.map((u) => queryRunner.manager.create(ProjectUnit, { ...u, projectId: saved.id }));
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
          await queryRunner.manager.save(ProjectUnit, units.map((u) => queryRunner.manager.create(ProjectUnit, { ...u, projectId: id })));
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
```

- [ ] **Step 4: Create controller + module, register in `AdminModule`**

`src/modules/admin/projects/admin-projects.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AppRole } from '../../../common/enums/app-role.enum';
import { AdminProjectsService } from './admin-projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import { UpdateProjectStatusDto } from './dto/update-project-status.dto';
import { ProjectSeoData } from '../../../database/entities/project-seo.entity';

@Roles(AppRole.Admin, AppRole.Staff)
@Controller('admin/projects')
export class AdminProjectsController {
  constructor(private readonly adminProjectsService: AdminProjectsService) {}

  @Get()
  async list(@Query('page') page = 1, @Query('limit') limit = 20, @Query('search') search?: string, @Query('status') status?: string) {
    return this.adminProjectsService.list(Number(page), Number(limit), search, status);
  }

  @Get(':id')
  async details(@Param('id', ParseIntPipe) id: number) {
    return this.adminProjectsService.details(id);
  }

  @Post()
  async create(@Body() payload: CreateProjectDto) {
    return this.adminProjectsService.create(payload);
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() payload: UpdateProjectDto) {
    return this.adminProjectsService.update(id, payload);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id', ParseIntPipe) id: number, @Body() payload: UpdateProjectStatusDto) {
    return this.adminProjectsService.updateStatus(id, payload.status);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminProjectsService.remove(id);
  }

  @Get(':id/seo')
  async getSeo(@Param('id', ParseIntPipe) id: number) {
    return this.adminProjectsService.getSeo(id);
  }

  @Put(':id/seo')
  async upsertSeo(@Param('id', ParseIntPipe) id: number, @Body() body: { seoData: ProjectSeoData; verificationStatus?: string; approvalStatus?: string }) {
    return this.adminProjectsService.upsertSeo(id, body.seoData, body.verificationStatus, body.approvalStatus);
  }
}
```

`src/modules/admin/projects/admin-projects.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../../../database/entities/project.entity';
import { ProjectUnit } from '../../../database/entities/project-unit.entity';
import { ProjectSeo } from '../../../database/entities/project-seo.entity';
import { AdminProjectsController } from './admin-projects.controller';
import { AdminProjectsService } from './admin-projects.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectUnit, ProjectSeo])],
  controllers: [AdminProjectsController],
  providers: [AdminProjectsService],
  exports: [AdminProjectsService],
})
export class AdminProjectsModule {}
```

Register: add `import { AdminProjectsModule } from './projects/admin-projects.module';` and entry in `src/modules/admin/admin.module.ts` imports.

- [ ] **Step 5: Verify build + admin CRUD round-trip**

Run: `bun run build` → success.
With dev server + admin JWT: `POST /api/v1/admin/projects` `{ name, projectType: 'apartment', city, units: [{ unitCode: '3BHK-A', bedrooms: 3, builtupAreaSqft: 1200, price: 8000000 }] }` → returns project with 1 unit; `GET /api/v1/projects/by-slug/<slug>` → published? No — draft returns 404 (expected). `PATCH /admin/projects/:id/status` `{ status: 'published' }` → then by-slug returns ranges `{ minPrice: 8000000, ..., bhk: [3] }`. `DELETE` the test project after.

- [ ] **Step 6: Commit**

```bash
git add src/modules/admin/projects/ src/modules/admin/admin.module.ts
git commit -m "feat(projects): add admin write API with nested units and SEO"
```

---

### Task 5: Link properties to projects

**Files:**
- Modify: `src/database/entities/property.entity.ts` (add `projectId` column + index)

**Interfaces:**
- Consumes: `Project` table from Task 1.
- Produces: `properties.project_id` nullable column for the CRM/site linking task.

- [ ] **Step 1: Add column** — in `@Entity('properties')` indexes add `@Index('idx_properties_project_id', ['projectId'])`; after `projectName` add:

```ts
@Column({ name: 'project_id', type: 'int', unsigned: true, nullable: true })
projectId!: number | null;
```

- [ ] **Step 2: Verify** — `bun run build` success; boot adds nullable column (no backfill; existing rows NULL).

- [ ] **Step 3: Commit**

```bash
git add src/database/entities/property.entity.ts
git commit -m "feat(projects): link properties to projects via nullable project_id"
```

---

## Self-review

- Spec coverage: data model (§Data model) → Tasks 1+5; single API (§API) → Tasks 3+4 (+CRM proxy is Plan 2); ranges computed → Task 2 used in Task 3; SEO entity → Task 1 + upsert in Task 4; v1 media columns (`coverImageUrl`, `galleryImageUrls`) → Task 1. Amenities link table deferred — spec says "reuse amenity master via link table"; no task covers it. Fix: defer explicitly — v1 reads amenity ids from `description`? No. Add note: amenities linkage is Plan 4 (site page) scope using existing `amenities` master read-only via `getFormData`-style query; link table `project-amenity` added only if the page needs more than id lists. Recorded here instead of silently dropping.
- Placeholder scan: no TBD/TODO; all code blocks complete; commands exact with expected outputs.
- Type consistency: `ProjectRanges`/`RangeUnitInput` names match Task 2→3 usage; `toProjectSlug`/`buildProjectCanonical` match Task 2→4 usage; `ProjectSeoData` import path consistent; `AppRole.Admin/Staff` match `app-role.enum.ts`; `@Public()` import path matches properties controller.
