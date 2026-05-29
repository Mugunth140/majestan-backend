import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createConnection } from 'mysql2/promise';

// ---------------------------------------------------------
// 1. ENVIRONMENT LOADERS & CONFIGURATION
// ---------------------------------------------------------

// Helper to load .env variables manually when running outside of Nest context
function loadEnv() {
  const envPath = join(__dirname, '..', '.env');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.slice(0, index).trim();
        const val = trimmed.slice(index + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const DB_HOST = process.env.DB_HOST ?? 'localhost';
const DB_USER = process.env.DB_USERNAME ?? 'root';
const DB_PASSWORD = process.env.DB_PASSWORD ?? '8220';
const DB_NAME = process.env.DB_NAME ?? 'majestan';

// Robustly determine ports:
// In docker-compose, port 3307 on the host maps to 3306 inside the container.
// If running on host (localhost), we try 3307 first, falling back to 3306.
// If running inside docker (DB_HOST === 'mysql'), we use 3306.
const primaryPort = DB_HOST === 'mysql' ? 3306 : 3307;
const fallbackPort = DB_HOST === 'mysql' ? 3306 : 3306;

// ---------------------------------------------------------
// 2. ROBUST DUMP FILE RESOLVER
// ---------------------------------------------------------
function resolveDumpFile(): string {
  const potentialPaths = [
    join(process.cwd(), '..', 'Project', 'dump.sql'),
    join(process.cwd(), '..', 'docs', 'dump.sql'),
    join(process.cwd(), 'db', 'dump.sql'),
    join(process.cwd(), 'Project', 'dump.sql'),
    join(process.cwd(), 'docs', 'dump.sql'),
  ];

  if (process.env.DUMP_PATH) {
    potentialPaths.unshift(process.env.DUMP_PATH);
  }

  for (const path of potentialPaths) {
    if (existsSync(path)) {
      console.log(`🔍 Found SQL Dump File at: ${path}`);
      return path;
    }
  }

  throw new Error(
    `❌ Could not locate 'dump.sql' in any of the following paths:\n${potentialPaths.join('\n')}\n` +
      `Please provide the DUMP_PATH environment variable.`
  );
}

// ---------------------------------------------------------
// 3. ROBUST SQL PARSER (Handles Comments, Quotes & Semicolons)
// ---------------------------------------------------------
function parseDumpSql(sql: string): string[] {
  const lines = sql.split('\n');
  const statements: string[] = [];
  let currentStatement = '';
  let inMultiLineComment = false;

  for (let line of lines) {
    const trimmed = line.trim();

    // Handle multi-line comments /* ... */
    if (trimmed.startsWith('/*')) {
      if (!trimmed.endsWith('*/')) {
        inMultiLineComment = true;
      }
      continue;
    }
    if (inMultiLineComment) {
      if (trimmed.endsWith('*/')) {
        inMultiLineComment = false;
      }
      continue;
    }

    // Skip single-line comments
    if (trimmed.startsWith('--') || trimmed.startsWith('#')) {
      continue;
    }
    if (!trimmed) {
      continue;
    }

    currentStatement += line + '\n';

    // Verify statement ending
    if (trimmed.endsWith(';')) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }

  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  return statements;
}

// ---------------------------------------------------------
// 4. MAIN SEED PROCESS
// ---------------------------------------------------------
async function seedDump() {
  console.log('🚀 Starting Robust Database Seeder...');
  
  let dumpPath: string;
  try {
    dumpPath = resolveDumpFile();
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }

  // Read SQL file
  console.log('📖 Reading SQL Dump File (this may take a few seconds)...');
  const sqlContent = readFileSync(dumpPath, 'utf8');
  console.log('⚙️ Parsing SQL Statements...');
  const statements = parseDumpSql(sqlContent);
  console.log(`✅ Parsed ${statements.length} SQL statements successfully.`);

  // Attempt connection with fallback ports
  let connection: any = null;
  let activePort = primaryPort;

  try {
    console.log(`🔌 Connecting to MySQL at ${DB_HOST}:${activePort} as ${DB_USER}...`);
    connection = await createConnection({
      host: DB_HOST,
      port: activePort,
      user: DB_USER,
      password: DB_PASSWORD,
    });
  } catch (err) {
    if (activePort !== fallbackPort) {
      console.log(`⚠️ Connection failed on port ${activePort}. Retrying on fallback port ${fallbackPort}...`);
      activePort = fallbackPort;
      try {
        connection = await createConnection({
          host: DB_HOST,
          port: activePort,
          user: DB_USER,
          password: DB_PASSWORD,
        });
      } catch (fallbackErr: any) {
        console.error(`❌ Connection failed on both ports. Error: ${fallbackErr.message}`);
        process.exit(1);
      }
    } else {
      console.error(`❌ Connection failed. Error: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  console.log(`✅ Connected successfully to MySQL on port ${activePort}!`);

  try {
    // 1. Create database if not exists
    console.log(`🛠️ Ensuring database '${DB_NAME}' exists...`);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${DB_NAME}\``);
    console.log(`✅ Database '${DB_NAME}' selected.`);

    // Disable foreign key and unique key checks for raw insert speed & ease
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('SET UNIQUE_CHECKS = 0');
    console.log('🔒 Foreign Key & Unique Checks disabled temporarily.');

    let successCount = 0;
    let ignoredCount = 0;
    let failedCount = 0;

    console.log('⚡ Executing SQL statements...');

    for (let i = 0; i < statements.length; i++) {
      let statement = statements[i];

      // Make DDL robust: Ensure table creations use CREATE TABLE IF NOT EXISTS
      if (statement.toUpperCase().startsWith('CREATE TABLE')) {
        statement = statement.replace(/\bCREATE TABLE\b/i, 'CREATE TABLE IF NOT EXISTS');
      }

      try {
        await connection.query(statement);
        successCount++;
      } catch (err: any) {
        // Handle common ignorable errors gracefully
        if (
          err.code === 'ER_TABLE_EXISTS_ERROR' || 
          err.message.includes('already exists')
        ) {
          ignoredCount++;
        } else if (
          err.code === 'ER_DUP_ENTRY' ||
          err.message.includes('Duplicate entry')
        ) {
          ignoredCount++;
        } else {
          failedCount++;
          console.warn(`\n⚠️ Warning: Statement failed: ${err.message}`);
          console.warn(`Statement: ${statement.substring(0, 150)}...\n`);
        }
      }

      // Log progress in intervals
      if ((i + 1) % 100 === 0 || i === statements.length - 1) {
        const percentage = Math.round(((i + 1) / statements.length) * 100);
        process.stdout.write(
          `▓ Progress: ${percentage}% (${i + 1}/${statements.length}) | Success: ${successCount} | Ignored: ${ignoredCount} | Failed: ${failedCount}\r`
        );
      }
    }

    console.log('\n\n🏁 Seeding complete!');
    console.log(`📈 Summary:`);
    console.log(`   - Total Executed: ${statements.length}`);
    console.log(`   - Successful operations: ${successCount}`);
    console.log(`   - Gracefully Ignored (Duplicates/Exists): ${ignoredCount}`);
    console.log(`   - Failed operations: ${failedCount}`);

    // Re-enable key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.query('SET UNIQUE_CHECKS = 1');
    console.log('🔑 Foreign Key & Unique Checks re-enabled.');

  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 MySQL connection closed.');
    }
  }
}

void seedDump();
