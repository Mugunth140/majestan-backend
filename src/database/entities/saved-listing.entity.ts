import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export type SavedListingKind = 'property' | 'project';

/**
 * A property or project a visitor saved ("wishlist"). Keyed by the site's
 * wishlist id (`user-<id>` once signed in, else a persisted `guest-…` id),
 * not a users FK, so projects and guests fit the same table.
 */
@Entity('saved_listings')
@Unique('uq_saved_listings_owner_listing', [
  'ownerKey',
  'listingKind',
  'listingId',
])
@Index('idx_saved_listings_owner', ['ownerKey'])
export class SavedListing {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'owner_key', type: 'varchar', length: 64 })
  ownerKey!: string;

  @Column({ name: 'listing_kind', type: 'enum', enum: ['property', 'project'] })
  listingKind!: SavedListingKind;

  @Column({ name: 'listing_id', type: 'int', unsigned: true })
  listingId!: number;

  /** Property type at save time ("apartment"…), or "project"; kept so a
      listing that has since gone offline still shows what it was. */
  @Column({ name: 'listing_type', type: 'varchar', length: 32 })
  listingType!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;
}
