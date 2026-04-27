import { Module } from '@nestjs/common';
import { AdminBlogsController } from './admin-blogs.controller';
import { AdminBlogsService } from './admin-blogs.service';
import { AdminCommonModule } from '../common/admin-common.module';

@Module({
  imports: [AdminCommonModule],
  controllers: [AdminBlogsController],
  providers: [AdminBlogsService],
  exports: [AdminBlogsService],
})
export class AdminBlogsModule {}
