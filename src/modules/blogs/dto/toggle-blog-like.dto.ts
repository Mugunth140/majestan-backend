import { IsEnum, IsOptional } from 'class-validator';

export enum BlogLikeAction {
  Like = 'like',
  Unlike = 'unlike',
}

export class ToggleBlogLikeDto {
  @IsOptional()
  @IsEnum(BlogLikeAction)
  action: BlogLikeAction = BlogLikeAction.Like;
}
