import { Module } from '@nestjs/common';
import { AdminBannersModule } from './banners/admin-banners.module';
import { AdminBlogsModule } from './blogs/admin-blogs.module';
import { AdminBusinessModule } from './business/admin-business.module';
import { AdminDashboardModule } from './dashboard/admin-dashboard.module';
import { AdminEnquiriesModule } from './enquiries/admin-enquiries.module';
import { AdminPropertiesModule } from './properties/admin-properties.module';
import { AdminCitiesModule } from './cities/admin-cities.module';
import { AdminSublocationsModule } from './sublocations/admin-sublocations.module';
import { AdminAmenitiesModule } from './amenities/admin-amenities.module';

@Module({
  imports: [
    AdminPropertiesModule,
    AdminBlogsModule,
    AdminBusinessModule,
    AdminBannersModule,
    AdminEnquiriesModule,
    AdminDashboardModule,
    AdminCitiesModule,
    AdminSublocationsModule,
    AdminAmenitiesModule,
  ],
})
export class AdminModule {}
