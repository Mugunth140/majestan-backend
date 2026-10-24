import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeoAuditRemediation1785200000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS seo_config_versions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      config_key VARCHAR(191) NOT NULL,
      revision INT UNSIGNED NOT NULL,
      snapshot JSON NOT NULL,
      actor_id INT NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      KEY idx_seo_versions_key (config_key, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    // Repair only the two copied overrides verified in the audit; leave unrelated editorial work intact.
    const rows = await q.query(`SELECT c.* FROM seo_configs c
      LEFT JOIN projects j ON j.id=c.project_id LEFT JOIN properties p ON p.id=c.property_id
      WHERE (j.name='Brooklyn By Dac' AND (c.meta_title LIKE '%Vrindhavana%' OR c.meta_description LIKE '%Vrindhavana%'))
         OR (p.title LIKE '%Ravimurugaa%Palacio%' AND (c.meta_title LIKE '%Sowpar%' OR c.meta_description LIKE '%Sowpar%'))`);
    for (const row of rows) {
      await q.query('INSERT INTO seo_config_versions (config_key,revision,snapshot) VALUES (?,?,?)', [row.config_key,row.revision,JSON.stringify({ config: row })]);
      const wrong = row.project_id ? /vrindhavana/i : /sowpar/i;
      const fields = ['meta_title','meta_description','og_title','og_description','h1'];
      const reset = fields.filter(field => wrong.test(row[field] || ''));
      if (reset.length) await q.query(`UPDATE seo_configs SET ${reset.map(field => `${field}=NULL`).join(',')},revision=revision+1 WHERE id=?`, [row.id]);
    }
    for (const [path, title, description] of [
      ['/emi-calculator','Home Loan EMI Calculator | Majestan Realty','Calculate monthly home loan repayments, total interest and repayment schedules.'],
      ['/affordability-calculator','Home Affordability Calculator | Majestan Realty','Estimate your home loan eligibility and affordable property budget.'],
    ]) await q.query(`INSERT IGNORE INTO seo_configs (config_key,scope,public_path,canonical_type,meta_title,meta_description,robots_index,robots_follow)
      VALUES (?,'page',?,'self',?,?,1,1)`, ['page:'+path,path,title,description]);
  }
  async down(): Promise<void> {
    // Retain repair snapshots and editorial data on rollback. Restores use optimistic revisions in the admin.
  }
}
