import dataSource from '../src/database/data-source';

async function runMigrations(): Promise<void> {
  await dataSource.initialize();

  try {
    const migrations = await dataSource.runMigrations({
      transaction: 'none',
    });

    if (migrations.length === 0) {
      console.log('No pending migrations.');
      return;
    }

    console.log(
      `Executed migrations: ${migrations
        .map((migration) => migration.name)
        .join(', ')}`,
    );
  } finally {
    await dataSource.destroy();
  }
}

void runMigrations();
