import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../../common/types/jwt-payload.type';
import { LeadsService } from './leads.service';
import { CreateProjectEnquiryDto } from './dto/create-project-enquiry.dto';

// NOTE: separate controller on purpose. LeadsController is @Public() at class
// level and RolesGuard/JwtAuthGuard honor class metadata, so a guarded route
// declared there would still skip auth.
@Controller('leads')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class ProjectEnquiryController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post('project-enquiry')
  async create(@Body() dto: CreateProjectEnquiryDto, @CurrentUser() user?: JwtPayload) {
    return this.leadsService.createProjectEnquiry(dto, user?.sub ?? null);
  }
}
