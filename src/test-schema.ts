import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const queryRunner = dataSource.createQueryRunner();
  const tableMetadata = await queryRunner.getTable('cities');
  if (tableMetadata) {
    console.log(tableMetadata.columns.map(c => c.name));
  } else {
    console.log('Table not found');
  }
  await app.close();
}
bootstrap();
