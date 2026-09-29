// site/majestan-backend/src/modules/sms/sms.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Pay4SmsProvider } from './pay4sms.provider';
import { SmsService } from './sms.service';

@Module({
  imports: [ConfigModule],
  providers: [Pay4SmsProvider, SmsService],
  exports: [SmsService],
})
export class SmsModule {}
