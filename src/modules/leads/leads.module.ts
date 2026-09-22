import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { CrmForwardingService } from './crm-forwarding.service';

@Module({
  controllers: [LeadsController],
  providers: [LeadsService, CrmForwardingService],
  exports: [LeadsService],
})
export class LeadsModule {}
