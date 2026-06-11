import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { hash } from 'bcrypt';
import * as path from 'path';

// Load .env file
config({ path: path.resolve(process.cwd(), '.env') });

const parseInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInteger(process.env.DB_PORT, 3306),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'majestan',
});

async function runSeed() {
  try {
    await dataSource.initialize();
    console.log('Database connection initialized for seeding.');

    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS login (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(64) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin') NOT NULL DEFAULT 'admin',
        status TINYINT NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // The hashed password for "Admin@12345"
    // To match your previous migrations: $2b$12$InrGdBi/oAiRVXMrFepWZ.1wCZDW76SLNKZ8RlilV3ncUGFnCiOKu
    const adminPasswordHash =
      '$2b$12$InrGdBi/oAiRVXMrFepWZ.1wCZDW76SLNKZ8RlilV3ncUGFnCiOKu';

    // Insert admin user safely
    await dataSource.query(
      `
      INSERT INTO login (username, password, role, status)
      VALUES ('admin', ?, 'admin', 1)
      ON DUPLICATE KEY UPDATE status = 1;
    `,
      [adminPasswordHash],
    );

    console.log('✅ Successfully seeded admin credentials!');
    console.log('username: admin');
    console.log('password: Admin@12345');
  } catch (err) {
    console.error('Error during admin seeding:', err);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

void runSeed();
