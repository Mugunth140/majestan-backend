import { Module } from '@nestjs/common';
import { AdminBannersController } from './admin-banners.controller';
import { AdminBannersService } from './admin-banners.service';
import { AdminCommonModule } from '../common/admin-common.module';

@Module({
  imports: [AdminCommonModule],
  controllers: [AdminBannersController],
  providers: [AdminBannersService],
  exports: [AdminBannersService],
})
export class AdminBannersModule {}
