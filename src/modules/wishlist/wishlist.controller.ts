import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { ToggleWishlistDto } from './dto/toggle-wishlist.dto';
import { WishlistGuestQueryDto } from './dto/wishlist-guest-query.dto';
import { WishlistService } from './wishlist.service';

@Public()
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  async list(@Query() query: WishlistGuestQueryDto) {
    return this.wishlistService.list(query);
  }

  @Get('count')
  async count(@Query() query: WishlistGuestQueryDto) {
    return this.wishlistService.count(query);
  }

  @Post('toggle')
  async toggle(@Body() payload: ToggleWishlistDto) {
    return this.wishlistService.toggle(payload);
  }
}
