import { SeoEngineModule } from '../seo-engine/seo-engine.module';
import { SeoSessionGuard } from '../seo-engine/seo-auth';
import { StorageModule } from '../storage/storage.module';
import { StorageService } from '../storage/storage.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  Module,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { EditorialService } from './editorial.service';
import { SaveBlogContentDto, SaveBlogSeoDto } from './editorial.dto';
@Public()
@Controller('editorial')
export class PublicEditorialController {
  constructor(private readonly service: EditorialService) {}
  @Get() list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.list(Number(page), Number(limit));
  }
  @Get('sitemap') sitemap() {
    return this.service.sitemap();
  }
  @Get('routing/resolve') resolve(@Query('slug') slug: string) {
    return this.service.resolveSlug(slug || '');
  }
  @Get('posts/:slug') post(@Param('slug') slug: string) {
    return this.service.details(slug);
  }
  @Get(':slug') details(@Param('slug') slug: string) {
    return this.service.details(slug);
  }
}
@Roles(AppRole.Admin, AppRole.Staff)
@Controller('admin/editorial')
export class AdminEditorialController {
  constructor(
    private readonly service: EditorialService,
    private readonly storage: StorageService,
  ) {}
  @Post('image')
  uploadImage(@Req() req: any) {
    return this.storage.uploadOpenGraphImage(
      req,
      req.headers['content-type'] || '',
      'uploads/blog',
    );
  }
  @Get() list(@Query('page') page?: string) {
    return this.service.list(Number(page), 30, true);
  }
  @Get(':id') details(@Param('id', ParseIntPipe) id: number) {
    return this.service.details(id, true);
  }
  @Post() create(@Body() dto: SaveBlogContentDto) {
    return this.service.saveContent(dto);
  }
  @Put(':id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveBlogContentDto,
  ) {
    return this.service.saveContent(dto, id);
  }
  @Delete(':id') remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('revision', ParseIntPipe) revision: number,
  ) {
    return this.service.remove(id, revision);
  }
}
@Public()
@UseGuards(SeoSessionGuard)
@Controller('seo-admin/blogs')
export class BlogSeoController {
  constructor(private readonly service: EditorialService) {}
  @Get() list(@Query('page') page?: string) {
    return this.service.list(Number(page), 30, true);
  }
  @Get(':id') details(@Param('id', ParseIntPipe) id: number) {
    return this.service.details(id, true);
  }
  @Put(':id') save(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveBlogSeoDto,
  ) {
    return this.service.saveSeo(id, dto);
  }
}
@Module({
  imports: [StorageModule, SeoEngineModule],
  controllers: [
    PublicEditorialController,
    AdminEditorialController,
    BlogSeoController,
  ],
  providers: [EditorialService],
})
export class EditorialModule {}
