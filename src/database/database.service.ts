import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async ping(): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      return true;
    } catch (error) {
      this.logger.error('Database ping failed', error as Error);
      return false;
    } finally {
      await queryRunner.release();
    }
  }
}
