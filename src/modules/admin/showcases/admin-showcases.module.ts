// admin-showcases.module.ts
import { Module } from '@nestjs/common';
import { AdminCommonModule } from '../common/admin-common.module';
import { ShowcasesModule } from '../../showcases/showcases.module';
import { AdminShowcasesController } from './admin-showcases.controller';

@Module({
  imports: [AdminCommonModule, ShowcasesModule],
  controllers: [AdminShowcasesController],
})
export class AdminShowcasesModule {}
