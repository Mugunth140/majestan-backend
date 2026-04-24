import { registerAs } from '@nestjs/config';

const parseBoolean = (value: string | undefined, fallback = false): boolean => {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

export default registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number.parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'maje_majestanrealty',
  connectionLimit: Number.parseInt(process.env.DB_POOL_SIZE ?? '10', 10),
  ssl: parseBoolean(process.env.DB_SSL, false),
}));
