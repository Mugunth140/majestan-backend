import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { DatabaseService } from '../../database/database.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  async check() {
    const databaseOk = await this.databaseService.ping();

    return {
      status: databaseOk ? 'ok' : 'degraded',
      checks: {
        database: databaseOk ? 'up' : 'down',
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
