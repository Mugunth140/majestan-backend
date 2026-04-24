import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class BlogListQueryDto {
  @Transform(({ value }) => Number.parseInt(String(value ?? '1'), 10))
  @IsInt()
  @Min(1)
  page = 1;

  @Transform(({ value }) => Number.parseInt(String(value ?? '12'), 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 12;
}
