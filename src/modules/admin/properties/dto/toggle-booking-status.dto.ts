import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class ToggleBookingStatusDto {
  @Transform(({ value }) => Number.parseInt(String(value), 10))
  @IsInt()
  @Min(0)
  @Max(5)
  bookingStatus!: number;
}
