import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedAdminUser1779400000000 implements MigrationInterface {
  name = 'SeedAdminUser1779400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO users (
        name,
        email,
        phone,
        password_hash,
        role,
        is_verified
      ) VALUES (
        'Admin',
        'admin@majestan.com',
        '9999999999',
        '$2b$12$y.68HGG/Gm/oiCKGSCwoBu3/Q2CoFTX6hP8NP7AI31Yc.I0UdmMDi',
        'admin',
        true
      ) ON DUPLICATE KEY UPDATE 
        role = 'admin', password_hash = '$2b$12$y.68HGG/Gm/oiCKGSCwoBu3/Q2CoFTX6hP8NP7AI31Yc.I0UdmMDi';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM users WHERE email = 'admin@majestan.com';`);
  }
}
