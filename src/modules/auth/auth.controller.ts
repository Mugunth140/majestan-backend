import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import type { JwtPayload } from '../../common/types/jwt-payload.type';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(@Body() credentials: LoginDto) {
    return this.authService.login(credentials);
  }

  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user);
  }

  @Roles(AppRole.Admin)
  @Post('admins')
  async createAdmin(@Body() payload: CreateAdminDto) {
    return this.authService.createAdmin(payload);
  }

  @Post('change-password')
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() payload: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.sub, payload);
  }
}
