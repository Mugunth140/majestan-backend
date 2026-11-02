import type { MigrationInterface, QueryRunner } from 'typeorm';
export class PropertyUploadAttribution1786600000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    if (!await q.hasColumn('properties', 'uploaded_by_crm_user_id')) await q.query('ALTER TABLE properties ADD COLUMN uploaded_by_crm_user_id INT UNSIGNED NULL');
    const table = await q.getTable('properties');
    if (!table?.indices.some(index => index.name === 'idx_properties_uploaded_date')) await q.query('CREATE INDEX idx_properties_uploaded_date ON properties (uploaded_by_crm_user_id, created_at)');
    if (!table?.indices.some(index => index.name === 'idx_properties_upload_date')) await q.query('CREATE INDEX idx_properties_upload_date ON properties (created_at)');
  }
  async down(): Promise<void> { /* Preserve recorded uploader identities. */ }
}
