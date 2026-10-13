import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import type { JwtPayload } from '../../common/types/jwt-payload.type';
import { StorageService } from '../storage/storage.service';
import { SubmitOwnerPropertyDto } from './dto/submit-owner-property.dto';
import { UpsertDraftDto } from './dto/upsert-draft.dto';
import { assertOwnerPhotoKey } from './owner-post-policy';
import { OwnerPostService } from './owner-post.service';

@Controller('owner')
@Roles(AppRole.User)
export class OwnerPostController {
  constructor(
    private readonly ownerPostService: OwnerPostService,
    private readonly storageService: StorageService,
  ) {}
  @Get('media/presigned-url')
  async presignedUrl(
    @CurrentUser() user: JwtPayload,
    @Query('fileName') fileName: string,
    @Query('fileType') fileType: string,
  ) {
    await this.ownerPostService.accountFor(user.sub);
    if (
      !fileName ||
      fileName.length > 200 ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(fileType)
    )
      throw new BadRequestException('Choose a JPG, PNG or WebP photo.');
    const filename = `owner-${user.sub}-${randomUUID()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const signed = await this.storageService.generatePresignedUrl(
      filename,
      fileType,
    );
    return {
      ...signed,
      previewUrl: this.storageService.generateReadUrl(signed.key),
    };
  }
  @Put('media/upload-temp')
  async localUpload(
    @CurrentUser() user: JwtPayload,
    @Query('key') key: string,
    @Req() req: Request,
  ) {
    await this.ownerPostService.accountFor(user.sub);
    if (!this.storageService.isLocalDriver() || !key?.startsWith('local/'))
      throw new BadRequestException('Local uploads are disabled.');
    assertOwnerPhotoKey(key, user.sub);
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(
        String(req.headers['content-type']),
      )
    )
      throw new BadRequestException('Choose a JPG, PNG or WebP photo.');
    return this.storageService.writeLocalTempFile(key, req);
  }
  @Get('drafts/me')
  async getDraft(@CurrentUser() user: JwtPayload) {
    return { payload: await this.ownerPostService.getDraft(user.sub) };
  }
  @Post('drafts')
  async saveDraft(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertDraftDto,
  ) {
    return this.ownerPostService.saveDraft(user.sub, dto.payload);
  }
  @Throttle({ default: { limit: 3, ttl: 86_400_000 } })
  @Post('properties/:propertyType')
  async submit(
    @CurrentUser() user: JwtPayload,
    @Param('propertyType') propertyType: string,
    @Body() dto: SubmitOwnerPropertyDto,
  ) {
    return this.ownerPostService.submit(user.sub, propertyType, dto);
  }
}
