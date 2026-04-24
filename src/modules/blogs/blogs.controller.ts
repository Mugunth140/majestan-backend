import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { BlogListQueryDto } from './dto/blog-list-query.dto';
import { ToggleBlogLikeDto } from './dto/toggle-blog-like.dto';
import { BlogsService } from './blogs.service';

@Public()
@Controller('blogs')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Get()
  async list(@Query() query: BlogListQueryDto) {
    return this.blogsService.list(query);
  }

  @Get(':id')
  async details(@Param('id', ParseIntPipe) id: number) {
    return this.blogsService.details(id);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':id/like')
  async like(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: ToggleBlogLikeDto,
  ) {
    return this.blogsService.like(id, payload);
  }
}
