import { Module } from '@nestjs/common';
import { AdminBusinessController } from './admin-business.controller';
import { AdminBusinessService } from './admin-business.service';
import { AdminCommonModule } from '../common/admin-common.module';

@Module({
  imports: [AdminCommonModule],
  controllers: [AdminBusinessController],
  providers: [AdminBusinessService],
  exports: [AdminBusinessService],
})
export class AdminBusinessModule {}
