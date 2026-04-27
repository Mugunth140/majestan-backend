import { Module } from '@nestjs/common';
import { AdminTableService } from './admin-table.service';

@Module({
  providers: [AdminTableService],
  exports: [AdminTableService],
})
export class AdminCommonModule {}
