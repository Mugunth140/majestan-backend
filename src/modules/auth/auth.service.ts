import {
  BadRequestException,
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

type LegacyUserRow = {
  id: number;
  username: string;
  password: string;
  status?: number | string;
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
