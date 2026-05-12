import dataSource from '../src/database/data-source';

async function showMigrations(): Promise<void> {
  await dataSource.initialize();

  try {
    const hasPendingMigrations = await dataSource.showMigrations();
    console.log(
      hasPendingMigrations
        ? 'There are pending migrations.'
        : 'All migrations have been executed.',
    );
  } finally {
    await dataSource.destroy();
  }
}

void showMigrations();
