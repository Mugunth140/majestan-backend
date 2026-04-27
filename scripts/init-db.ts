import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createConnection } from 'mysql2/promise';

const required = (value: string | undefined, key: string): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const parseStatements = (sql: string): string[] => {
  return sql
    .split(/;\s*\n/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
};

async function initDb() {
  const dbHost = required(process.env.DB_HOST, 'DB_HOST');
  const dbPort = Number.parseInt(process.env.DB_PORT ?? '3306', 10);
  const dbUser = required(process.env.DB_USERNAME, 'DB_USERNAME');
  const dbPassword = process.env.DB_PASSWORD ?? '';
  const dbName = required(process.env.DB_NAME, 'DB_NAME');

  const rootConnection = await createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    multipleStatements: false,
  });

  try {
    await rootConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await rootConnection.end();
  }

  const schemaPath = join(process.cwd(), 'db', 'schema.sql');
  const schemaSql = readFileSync(schemaPath, 'utf8');
  const statements = parseStatements(schemaSql);

  const appConnection = await createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    multipleStatements: false,
  });

  try {
    for (const statement of statements) {
      await appConnection.query(statement);
    }
  } finally {
    await appConnection.end();
  }

  console.log(`Database initialized successfully: ${dbName}`);
  console.log('Seeded admin credentials:');
  console.log('username: admin');
  console.log('password: Admin@12345');
}

void initDb();
