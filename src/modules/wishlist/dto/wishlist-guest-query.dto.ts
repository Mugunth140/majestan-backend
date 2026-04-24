import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class WishlistGuestQueryDto {
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  guestId!: string;
}
