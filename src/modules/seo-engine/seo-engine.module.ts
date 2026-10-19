import { StorageModule } from '../storage/storage.module';
import { Module } from '@nestjs/common';
import { SeoAuthService, SeoSessionGuard } from './seo-auth';
import { SeoEngineService } from './seo-engine.service';
import {
  PublicSeoEngineController,
  SeoAdminController,
} from './seo-engine.controller';

@Module({
  imports: [StorageModule],
  controllers: [SeoAdminController, PublicSeoEngineController],
  providers: [SeoEngineService, SeoAuthService, SeoSessionGuard],
})
export class SeoEngineModule {}
