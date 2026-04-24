import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FieldPacket,
  Pool,
  ResultSetHeader,
  RowDataPacket,
  createPool,
} from 'mysql2/promise';

type SqlValue = string | number | boolean | Date | null;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const sslEnabled = this.configService.get<boolean>('database.ssl', false);

    this.pool = createPool({
      host: this.configService.getOrThrow<string>('database.host'),
      port: this.configService.getOrThrow<number>('database.port'),
      user: this.configService.getOrThrow<string>('database.username'),
      password: this.configService.getOrThrow<string>('database.password'),
      database: this.configService.getOrThrow<string>('database.database'),
      connectionLimit: this.configService.getOrThrow<number>(
        'database.connectionLimit',
      ),
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      decimalNumbers: true,
      ssl: sslEnabled ? { rejectUnauthorized: true } : undefined,
    });
  }

  async query<T extends RowDataPacket[] = RowDataPacket[]>(
    sql: string,
    params: SqlValue[] = [],
  ): Promise<T> {
    const [rows] = await this.pool.query<T>(sql, params);
    return rows;
  }

  async execute(
    sql: string,
    params: SqlValue[] = [],
  ): Promise<ResultSetHeader> {
    const [result] = await this.pool.execute<ResultSetHeader>(sql, params);
    return result;
  }

  async raw<T extends RowDataPacket[] = RowDataPacket[]>(
    sql: string,
    params: SqlValue[] = [],
  ): Promise<[T, FieldPacket[]]> {
    return this.pool.query<T>(sql, params);
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error('Database ping failed', error as Error);
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
