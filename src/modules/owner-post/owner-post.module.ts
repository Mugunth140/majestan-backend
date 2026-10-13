import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyDraft } from '../../database/entities/property-draft.entity';
import { User } from '../../database/entities/user.entity';
import { AdminPropertiesModule } from '../admin/properties/admin-properties.module';
import { StorageModule } from '../storage/storage.module';
import { OwnerPostController } from './owner-post.controller';
import { OwnerPostService } from './owner-post.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PropertyDraft, User]),
    AdminPropertiesModule,
    StorageModule,
  ],
  controllers: [OwnerPostController],
  providers: [OwnerPostService],
})
export class OwnerPostModule {}
