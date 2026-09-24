import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum BlogLikeAction {
  Like = 'like',
  Unlike = 'unlike',
}

export class ToggleBlogLikeDto {
  @ApiProperty({ enum: BlogLikeAction, enumName: 'BlogLikeAction', required: false })
  @IsOptional()
  @IsEnum(BlogLikeAction)
  action: BlogLikeAction = BlogLikeAction.Like;
}
