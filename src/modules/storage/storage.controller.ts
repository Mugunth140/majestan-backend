import { Controller, Get, Query, UnauthorizedException } from '@nestjs/common';
import { StorageService } from './storage.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';

@Controller('admin/media')
@Roles(AppRole.Admin)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('presigned-url')
  async getPresignedUrl(
    @Query('fileName') fileName: string,
    @Query('fileType') fileType: string,
  ) {
    if (!fileName || !fileType) {
      throw new Error('fileName and fileType are required');
    }
    return this.storageService.generatePresignedUrl(fileName, fileType);
  }
}
