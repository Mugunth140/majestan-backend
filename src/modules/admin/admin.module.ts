import { Module } from '@nestjs/common';
import { AdminBannersModule } from './banners/admin-banners.module';
import { AdminBlogsModule } from './blogs/admin-blogs.module';
import { AdminBusinessModule } from './business/admin-business.module';
import { AdminDashboardModule } from './dashboard/admin-dashboard.module';
import { AdminEnquiriesModule } from './enquiries/admin-enquiries.module';
import { AdminPropertiesModule } from './properties/admin-properties.module';

@Module({
  imports: [
    AdminPropertiesModule,
    AdminBlogsModule,
    AdminBusinessModule,
    AdminBannersModule,
    AdminEnquiriesModule,
    AdminDashboardModule,
  ],
})
export class AdminModule {}
