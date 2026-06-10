import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { compare, hash } from 'bcrypt';
import { timingSafeEqual } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AppRole } from '../../common/enums/app-role.enum';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { UserLoginDto } from './dto/user-login.dto';
import { PhoneAuthDto } from './dto/phone-auth.dto';

type LegacyUserRow = {
  id: number;
  username: string;
  password: string;
  status?: number | string;
};

type AppUserRow = {
  id: number;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  role: AppRole;
  is_verified: boolean | number;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async login(credentials: LoginDto) {
    const user = await this.getUserByUsername(credentials.username);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== undefined && Number(user.status) !== 1) {
      throw new UnauthorizedException('Account is disabled');
    }

    const passwordValid = await this.verifyPassword(credentials.password, user);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: Number(user.id),
      username: user.username,
      role: AppRole.Admin,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      user: {
        id: payload.sub,
        username: payload.username,
        role: payload.role,
      },
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.configService.getOrThrow<string>('auth.accessTokenTtl'),
    };
  }

  async loginUser(credentials: UserLoginDto) {
    const user = await this.getAppUserByEmail(credentials.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await compare(
      credentials.password,
      user.password_hash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildUserAuthResponse(user);
  }

  async registerUser(payload: RegisterUserDto) {
    const email = payload.email.trim().toLowerCase();
    const existing = await this.getAppUserByEmail(email);

    if (existing) {
      throw new ConflictException('An account already exists for this email');
    }

    const rounds = this.configService.getOrThrow<number>('auth.saltRounds');
    const passwordHash = await hash(payload.password, rounds);

    const result = await this.dataSource
      .createQueryBuilder()
      .insert()
      .into('users')
      .values({
        name: payload.name.trim(),
        email,
        phone: payload.phone.trim(),
        password_hash: passwordHash,
        role: AppRole.User,
        is_verified: false,
      })
      .execute();

    const createdUserId =
      Number(result.identifiers[0]?.id) ||
      Number((result.raw as { insertId?: number }).insertId);
    const user = await this.getAppUserById(createdUserId);

    return this.buildUserAuthResponse(user);
  }

  me(user: JwtPayload) {
    return {
      id: user.sub,
      username: user.username,
      role: user.role,
    };
  }

  async createAdmin(payload: CreateAdminDto) {
    const existing = await this.getUserByUsername(payload.username);
    if (existing) {
      throw new BadRequestException('Username already exists');
    }

    const rounds = this.configService.getOrThrow<number>('auth.saltRounds');
    const hashedPassword = await hash(payload.password, rounds);

    const result = await this.dataSource
      .createQueryBuilder()
      .insert()
      .into('login')
      .values({
        username: payload.username,
        password: hashedPassword,
        status: 1,
      })
      .execute();

    const createdUserId =
      Number(result.identifiers[0]?.id) ||
      Number((result.raw as { insertId?: number }).insertId);

    const createdUser = await this.getUserById(createdUserId);

    return {
      id: Number(createdUser.id),
      username: createdUser.username,
      role: AppRole.Admin,
      status: createdUser.status,
    };
  }

  async changePassword(userId: number, payload: ChangePasswordDto) {
    const user = await this.getUserById(userId);
    const isValid = await this.verifyPassword(payload.currentPassword, user);

    if (!isValid) {
      throw new UnauthorizedException('Current password is invalid');
    }

    const rounds = this.configService.getOrThrow<number>('auth.saltRounds');
    const newHash = await hash(payload.newPassword, rounds);

    await this.dataSource
      .createQueryBuilder()
      .update('login')
      .set({ password: newHash })
      .where('id = :id', { id: userId })
      .execute();

    return {
      changed: true,
    };
  }

  
  async phoneLoginOrRegister(credentials: PhoneAuthDto) {
    let user = await this.getAppUserByPhone(credentials.phone);

    if (!user) {
      // Auto-register
      const email = `${credentials.phone}@user.majestan.local`;
      const dummyPassword = await hash(Math.random().toString(36).slice(-10), 10);
      
      const result = await this.dataSource
        .createQueryBuilder()
        .insert()
        .into('users')
        .values({
          name: 'Majestan User',
          email,
          phone: credentials.phone,
          password_hash: dummyPassword,
          role: 'user',
          is_verified: true,
        })
        .execute();

      const createdUserId =
        Number(result.identifiers[0]?.id) ||
        Number((result.raw as { insertId?: number })?.insertId);

      user = await this.getAppUserById(createdUserId);
    }

    if (!user) {
      throw new UnauthorizedException('Failed to authenticate');
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.email,
      role: user.role as AppRole,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  private async getAppUserByPhone(phone: string): Promise<AppUserRow | null> {
    const row = await this.dataSource
      .createQueryBuilder()
      .select('users.*')
      .from('users', 'users')
      .where('users.phone = :phone', { phone: phone.trim() })
      .andWhere('users.role = :role', { role: 'user' })
      .limit(1)
      .getRawOne<AppUserRow>();

    return row ?? null;
  }


  private async getAppUserByEmail(email: string): Promise<AppUserRow | null> {
    const row = await this.dataSource
      .createQueryBuilder()
      .select('users.*')
      .from('users', 'users')
      .where('LOWER(users.email) = :email', {
        email: email.trim().toLowerCase(),
      })
      .limit(1)
      .getRawOne<AppUserRow>();

    return row ?? null;
  }

  private async getAppUserById(id: number): Promise<AppUserRow> {
    const user = await this.dataSource
      .createQueryBuilder()
      .select('users.*')
      .from('users', 'users')
      .where('users.id = :id', { id })
      .limit(1)
      .getRawOne<AppUserRow>();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async buildUserAuthResponse(user: AppUserRow) {
    const role = user.role ?? AppRole.User;
    const payload: JwtPayload = {
      sub: Number(user.id),
      username: user.email,
      role,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      user: {
        id: Number(user.id),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role,
        isVerified: Number(user.is_verified) === 1,
      },
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.configService.getOrThrow<string>('auth.accessTokenTtl'),
    };
  }

  private async getUserByUsername(
    username: string,
  ): Promise<LegacyUserRow | null> {
    const row = await this.dataSource
      .createQueryBuilder()
      .select('login.*')
      .from('login', 'login')
      .where('login.username = :username', { username })
      .limit(1)
      .getRawOne<LegacyUserRow>();

    return row ?? null;
  }

  private async getUserById(id: number): Promise<LegacyUserRow> {
    const user = await this.dataSource
      .createQueryBuilder()
      .select('login.*')
      .from('login', 'login')
      .where('login.id = :id', { id })
      .limit(1)
      .getRawOne<LegacyUserRow>();

    if (!user) {
      throw new NotFoundException('Admin user not found');
    }

    return user;
  }

  private async verifyPassword(
    plainPassword: string,
    user: LegacyUserRow,
  ): Promise<boolean> {
    const storedPassword = String(user.password ?? '');
    const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(storedPassword);

    if (isBcryptHash) {
      return compare(plainPassword, storedPassword);
    }

    const allowLegacy = this.configService.get<boolean>(
      'auth.allowLegacyPlainPassword',
      false,
    );

    if (!allowLegacy) {
      return false;
    }

    const plainMatches = this.safePlainCompare(plainPassword, storedPassword);

    if (plainMatches) {
      await this.upgradePasswordHash(user.id, plainPassword);
    }

    return plainMatches;
  }

  private safePlainCompare(input: string, stored: string): boolean {
    const inputBuffer = Buffer.from(input);
    const storedBuffer = Buffer.from(stored);

    if (inputBuffer.length !== storedBuffer.length) {
      return false;
    }

    return timingSafeEqual(inputBuffer, storedBuffer);
  }

  private async upgradePasswordHash(
    userId: number,
    plainPassword: string,
  ): Promise<void> {
    try {
      const rounds = this.configService.getOrThrow<number>('auth.saltRounds');
      const hashedPassword = await hash(plainPassword, rounds);

      await this.dataSource
        .createQueryBuilder()
        .update('login')
        .set({ password: hashedPassword })
        .where('id = :id', { id: userId })
        .execute();

      this.logger.log(`Upgraded legacy password hash for user ${userId}`);
    } catch (error) {
      this.logger.warn(
        `Failed to upgrade password hash for user ${userId}: ${String(error)}`,
      );
    }
  }
}
