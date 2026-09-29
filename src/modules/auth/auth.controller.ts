import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  GoneException,
  HttpException,
  NotFoundException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import type { JwtPayload } from '../../common/types/jwt-payload.type';
import { normalizePhone } from '../../common/utils/phone.util';
import { OtpSendError } from '../sms/pay4sms.errors';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginDto } from './dto/login.dto';
import { OtpLoginRequestDto } from './dto/otp-login-request.dto';
import { OtpLoginVerifyDto } from './dto/otp-login-verify.dto';
import { OtpRegisterRequestDto } from './dto/otp-register-request.dto';
import { OtpRegisterVerifyDto } from './dto/otp-register-verify.dto';
import { PhoneAuthDto } from './dto/phone-auth.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { UserLoginDto } from './dto/user-login.dto';
import { OtpPurpose } from './otp-purpose.enum';
import { OtpHttpError, OtpService } from './otp.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(@Body() credentials: LoginDto) {
    return this.authService.login(credentials);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('user/phone')
  async phoneAuth(@Body() credentials: PhoneAuthDto) {
    void credentials;
    throw new GoneException('OTP_REQUIRED: use POST /auth/otp/login-request');
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('otp/register-request')
  async requestRegisterOtp(@Body() dto: OtpRegisterRequestDto) {
    const { canonical, providerNumber } = this.parsePhone(dto.countryCode, dto.phone);
    const existing = await this.authService.findAppUserByPhone(canonical);
    if (existing) throw new ConflictException('Phone already registered. Please login.');
    try {
      const res = await this.otpService.requestOtp({ canonical, providerNumber, purpose: OtpPurpose.REGISTER });
      return { otpSent: true, expiresInSeconds: res.expiresInSeconds };
    } catch (error) {
      this.mapOtpError(error);
    }
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('otp/login-request')
  async requestLoginOtp(@Body() dto: OtpLoginRequestDto) {
    const { canonical, providerNumber } = this.parsePhone(dto.countryCode, dto.phone);
    const existing = await this.authService.findAppUserByPhone(canonical);
    if (!existing) throw new NotFoundException('Phone not registered. Please register first.');
    try {
      const res = await this.otpService.requestOtp({ canonical, providerNumber, purpose: OtpPurpose.LOGIN });
      return { otpSent: true, expiresInSeconds: res.expiresInSeconds };
    } catch (error) {
      this.mapOtpError(error);
    }
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/register-verify')
  async verifyRegisterOtp(@Body() dto: OtpRegisterVerifyDto) {
    const { canonical } = this.parsePhone(dto.countryCode, dto.phone);
    try {
      await this.otpService.verifyOtp({ canonical, purpose: OtpPurpose.REGISTER, otp: dto.otp });
    } catch (error) {
      this.mapOtpError(error);
    }
    return this.authService.registerUserWithPhone({ name: dto.name, email: dto.email, phone: canonical });
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/login-verify')
  async verifyLoginOtp(@Body() dto: OtpLoginVerifyDto) {
    const { canonical } = this.parsePhone(dto.countryCode, dto.phone);
    try {
      await this.otpService.verifyOtp({ canonical, purpose: OtpPurpose.LOGIN, otp: dto.otp });
    } catch (error) {
      this.mapOtpError(error);
    }
    return this.authService.loginUserWithPhone(canonical);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('users/login')
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

  private parsePhone(countryCode: string, phone: string) {
    try {
      return normalizePhone(countryCode, phone);
    } catch {
      throw new BadRequestException('Invalid phone number');
    }
  }

  private mapOtpError(error: unknown): never {
    if (error instanceof OtpHttpError) {
      if (error.status === 404) throw new NotFoundException(error.message);
      if (error.status === 401) throw new UnauthorizedException('Invalid OTP');
      if (error.status === 410) throw new GoneException(error.code);
      if (error.status === 429) throw new HttpException(error.code, 429);
    }
    if (error instanceof OtpSendError) {
      if (error.code === 'OTP_DLT_CONFIGURATION_ERROR') throw new HttpException('OTP_DLT_CONFIGURATION_ERROR', 502);
      if (error.code === 'OTP_DESTINATION_INVALID') throw new BadRequestException(error.message);
      if (error.code === 'OTP_RATE_LIMITED') throw new HttpException('OTP_RATE_LIMITED', 429);
      throw new HttpException(error.code, 502);
    }
    throw error;
  }
}
