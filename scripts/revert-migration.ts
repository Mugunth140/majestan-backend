import dataSource from '../src/database/data-source';

async function revertMigration(): Promise<void> {
  await dataSource.initialize();

  try {
    await dataSource.undoLastMigration({
      transaction: 'none',
    });
    console.log('Reverted the last migration.');
  } finally {
    await dataSource.destroy();
  }
}

void revertMigration();
