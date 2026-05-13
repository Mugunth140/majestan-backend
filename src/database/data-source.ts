import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { CreateMajestanLegacySchema1778544000000 } from './migrations/1778544000000-CreateMajestanLegacySchema';
import { SeedMajestanReferenceData1778544001000 } from './migrations/1778544001000-SeedMajestanReferenceData';

const parseBoolean = (value: string | undefined, fallback = false): boolean => {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const parseInteger = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sslEnabled = parseBoolean(process.env.DB_SSL, false);

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInteger(process.env.DB_PORT, 3306),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'majestan',
  synchronize: false,
  logging: parseBoolean(process.env.TYPEORM_LOGGING, false),
  migrationsTableName: 'migrations',
  migrations: [
    CreateMajestanLegacySchema1778544000000,
    SeedMajestanReferenceData1778544001000,
  ],
  extra: {
    connectionLimit: parseInteger(process.env.DB_POOL_SIZE, 10),
  },
  ssl: sslEnabled ? { rejectUnauthorized: true } : undefined,
});
