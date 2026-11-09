import type { MigrationInterface, QueryRunner } from 'typeorm';
/** "Pet Friendly" on every property type: a plain yes/no, off by default. */
export class PropertyPetFriendly1786700000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    if (!await q.hasColumn('properties', 'pet_friendly')) await q.query('ALTER TABLE properties ADD COLUMN pet_friendly TINYINT(1) NOT NULL DEFAULT 0');
  }
  async down(q: QueryRunner): Promise<void> {
    if (await q.hasColumn('properties', 'pet_friendly')) await q.query('ALTER TABLE properties DROP COLUMN pet_friendly');
  }
}
