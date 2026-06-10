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
import { RegisterUserDto } from './dto/register-user.dto';
import { UserLoginDto } from './dto/user-login.dto';
import { PhoneAuthDto } from './dto/phone-auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(@Body() credentials: LoginDto) {
    return this.authService.login(credentials);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('users/login')
  
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('user/phone')
  async phoneAuth(@Body() credentials: PhoneAuthDto) {
    return this.authService.phoneLoginOrRegister(credentials);
  }

  async loginUser(@Body() credentials: UserLoginDto) {
    return this.authService.loginUser(credentials);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('users/register')
  async registerUser(@Body() payload: RegisterUserDto) {
    return this.authService.registerUser(payload);
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

  @Roles(AppRole.Admin)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() payload: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.sub, payload);
  }
}
