import { ArrayMinSize, ArrayUnique, Min, IsArray, IsInt } from 'class-validator';

export class ReorderAdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @Min(1, { each: true })
  @IsInt({ each: true })
  ids!: number[];
}
