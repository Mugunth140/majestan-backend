import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import {
  Property,
  PropertyStatus,
} from '../../database/entities/property.entity';
import { Project, ProjectStatus } from '../../database/entities/project.entity';
import {
  SavedListing,
  SavedListingKind,
} from '../../database/entities/saved-listing.entity';
import { StorageService } from '../storage/storage.service';
import { toProjectListItem } from '../projects/projects.service';
import {
  FEATURED_PROPERTY_RELATIONS,
  toFeaturedProperty,
} from '../showcases/featured-property.mapper';
import { WishlistGuestQueryDto } from './dto/wishlist-guest-query.dto';
import { ToggleWishlistDto } from './dto/toggle-wishlist.dto';

/** Only live listings can be saved or shown (same gate as the public pages). */
const LIVE_PROPERTY = {
  status: PropertyStatus.AVAILABLE,
  approvalStatus: 'Approved',
} as const;

/**
 * The card fields the wishlist page reads. Named to match the page's
 * existing lookups (title, canonicalSlug, coverImageUrl, price, posttype…).
 */
export type WishlistCard = {
  id: number;
  title: string;
  canonicalSlug: string;
  coverImageUrl: string | null;
  sublocation: string | null;
  city: string | null;
  price: number | null;
  posttype: string | null;
  projectType?: string | null;
};

export type WishlistListItem = {
  id: number;
  propertyId: number;
  /** DB property type ("apartment"…) or "project": the key the site's
      wishlist store matches buttons on. */
  propertyType: string;
  legacyPropertyType: string;
  /** null when the listing has since gone offline (still removable). */
  property: WishlistCard | null;
};

const kindOf = (type: string): SavedListingKind =>
  type.trim().toLowerCase() === 'project' ? 'project' : 'property';

const toNumber = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Saved properties and projects ("wishlist"), keyed by the site's wishlist
 * id. Reads the unified `properties` / `projects` tables.
 */
@Injectable()
export class WishlistService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
  ) {}

  private get saved() {
    return this.dataSource.getRepository(SavedListing);
  }

  private readUrl = (key: string): string =>
    this.storageService.generateReadUrl(key);

  async list(
    query: WishlistGuestQueryDto,
  ): Promise<{ items: WishlistListItem[]; total: number }> {
    const rows = await this.saved.find({
      where: { ownerKey: query.guestId },
      order: { id: 'DESC' },
    });

    const propertyIds = rows
      .filter((r) => r.listingKind === 'property')
      .map((r) => r.listingId);
    const projectIds = rows
      .filter((r) => r.listingKind === 'project')
      .map((r) => r.listingId);
    const [properties, projects] = await Promise.all([
      this.propertyCards(propertyIds),
      this.projectCards(projectIds),
    ]);

    const items = rows.map((row): WishlistListItem => {
      const card =
        (row.listingKind === 'project' ? projects : properties).get(
          row.listingId,
        ) ?? null;
      return {
        id: row.id,
        propertyId: row.listingId,
        propertyType: row.listingType,
        legacyPropertyType: row.listingType,
        property: card,
      };
    });

    return { items, total: items.length };
  }

  async count(query: WishlistGuestQueryDto) {
    return {
      total: await this.saved.count({ where: { ownerKey: query.guestId } }),
    };
  }

  async toggle(payload: ToggleWishlistDto) {
    const kind = kindOf(payload.propertyType);
    const existing = await this.saved.findOne({
      where: {
        ownerKey: payload.guestId,
        listingKind: kind,
        listingId: payload.propertyId,
      },
    });

    // Removing always succeeds, even if the listing has since gone offline.
    if (existing) {
      await this.saved.delete({ id: existing.id });
      return {
        wished: false,
        total: (await this.count({ guestId: payload.guestId })).total,
      };
    }

    const listingType = await this.liveListingType(kind, payload.propertyId);
    // orIgnore: a double-click racing the first insert hits the unique key.
    await this.saved
      .createQueryBuilder()
      .insert()
      .values({
        ownerKey: payload.guestId,
        listingKind: kind,
        listingId: payload.propertyId,
        listingType,
      })
      .orIgnore()
      .execute();

    return {
      wished: true,
      total: (await this.count({ guestId: payload.guestId })).total,
    };
  }

  /** The type to store for a live listing; 404 when it isn't live. */
  private async liveListingType(
    kind: SavedListingKind,
    id: number,
  ): Promise<string> {
    if (kind === 'project') {
      const exists = await this.dataSource
        .getRepository(Project)
        .exist({ where: { id, status: ProjectStatus.PUBLISHED } });
      if (!exists) throw new NotFoundException('Project not found');
      return 'project';
    }
    const property = await this.dataSource.getRepository(Property).findOne({
      where: { id, ...LIVE_PROPERTY },
      select: { id: true, propertyType: true },
    });
    if (!property) throw new NotFoundException('Property not found');
    const type = String(property.propertyType ?? '').trim();
    if (!type) throw new BadRequestException('Unsupported property type');
    return type;
  }

  private async propertyCards(
    ids: number[],
  ): Promise<Map<number, WishlistCard>> {
    if (ids.length === 0) return new Map();
    const properties = await this.dataSource.getRepository(Property).find({
      where: { id: In(ids), ...LIVE_PROPERTY },
      relations: FEATURED_PROPERTY_RELATIONS,
    });
    const cards = await Promise.all(
      properties.map(async (p): Promise<WishlistCard> => {
        const f = await toFeaturedProperty(p, this.readUrl);
        return {
          id: p.id,
          title: f.propertyName || `Property #${p.id}`,
          canonicalSlug: f.detailPath.replace(/^\/+/, ''),
          coverImageUrl: f.photo,
          sublocation: f.sublocation,
          city: p.city ?? null,
          price: toNumber(p.price),
          posttype: f.postType ? f.postType.toLowerCase() : null,
        };
      }),
    );
    return new Map(cards.map((c) => [c.id, c]));
  }

  private async projectCards(
    ids: number[],
  ): Promise<Map<number, WishlistCard>> {
    if (ids.length === 0) return new Map();
    const projects = await this.dataSource
      .getRepository(Project)
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.units', 'u', 'u.status = :unitStatus', {
        unitStatus: 'available',
      })
      .where('p.id IN (:...ids)', { ids })
      .andWhere('p.status = :status', { status: ProjectStatus.PUBLISHED })
      .getMany();
    const cards = await Promise.all(
      projects.map(async (project): Promise<WishlistCard> => {
        const item = toProjectListItem(
          project,
          ((await project.units) ?? []) as any[],
          this.readUrl,
        );
        return {
          id: project.id,
          title: item.name,
          canonicalSlug: (item.canonicalSlug || item.slug || '').replace(
            /^\/+/,
            '',
          ),
          coverImageUrl: item.coverImageUrl ?? null,
          sublocation:
            [item.sublocation, item.city].filter(Boolean).join(', ') || null,
          city: item.city ?? null,
          price: toNumber(item.ranges?.minPrice),
          posttype: null,
          projectType: item.projectType ?? null,
        };
      }),
    );
    return new Map(cards.map((c) => [c.id, c]));
  }
}
