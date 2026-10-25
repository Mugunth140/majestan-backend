import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddArchivedPropertyStatus1785300000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query("ALTER TABLE properties MODIFY status ENUM('available','sold','rented','unavailable','archived') NOT NULL DEFAULT 'available'");
    // Preserve unapproved owner submissions in their existing internal review state.
    await q.query("UPDATE properties SET status='archived' WHERE status='unavailable' AND approval_status='Approved'");
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query("UPDATE properties SET status='unavailable' WHERE status='archived'");
    await q.query("ALTER TABLE properties MODIFY status ENUM('available','sold','rented','unavailable') NOT NULL DEFAULT 'available'");
  }
}
