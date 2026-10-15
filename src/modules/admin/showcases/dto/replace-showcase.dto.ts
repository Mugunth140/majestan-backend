import { ArrayMaxSize, IsArray, IsInt, Min } from 'class-validator';
import { SHOWCASE_MAX_ITEMS } from '../../../../database/entities/showcase-item.entity';

export class ReplaceShowcaseDto {
  @IsArray()
  @ArrayMaxSize(SHOWCASE_MAX_ITEMS)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}
