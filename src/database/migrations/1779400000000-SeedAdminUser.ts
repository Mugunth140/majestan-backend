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
        'admin@majestanrealty.com',
        '9999999999',
        '$2b$12$mWnLIs4cpAdX/C0FqteZnetw7M.TpFVvq9axeLAKlrrTULkoD6ZSC',
        'admin',
        true
      ) ON DUPLICATE KEY UPDATE 
        role = 'admin', password_hash = '$2b$12$mWnLIs4cpAdX/C0FqteZnetw7M.TpFVvq9axeLAKlrrTULkoD6ZSC';
    `);

    await queryRunner.query(`
      INSERT INTO users (
        name,
        email,
        phone,
        password_hash,
        role,
        is_verified
      ) VALUES (
        'Staff',
        'staff@majestanrealty.com',
        '8888888888',
        '$2b$12$bOzWjPnx.LzgEwA2vH.CJ.0eZHIjFvJSIOh5kGeDFgN77jCBgvtHG',
        'staff',
        true
      ) ON DUPLICATE KEY UPDATE 
        role = 'staff', password_hash = '$2b$12$bOzWjPnx.LzgEwA2vH.CJ.0eZHIjFvJSIOh5kGeDFgN77jCBgvtHG';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM users WHERE email IN ('admin@majestanrealty.com', 'staff@majestanrealty.com');`);
  }
}
