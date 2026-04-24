import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RowDataPacket } from 'mysql2/promise';
import { compare, hash } from 'bcrypt';
import { timingSafeEqual } from 'node:crypto';
import { AppRole } from '../../common/enums/app-role.enum';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { DatabaseService } from '../../database/database.service';
import { LoginDto } from './dto/login.dto';

type LegacyUserRow = RowDataPacket & {
  id: number;
  username: string;
  password: string;
  status?: number | string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly databaseService: DatabaseService,
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

  async me(user: JwtPayload) {
    return {
      id: user.sub,
      username: user.username,
      role: user.role,
    };
  }

  private async getUserByUsername(
    username: string,
  ): Promise<LegacyUserRow | null> {
    const rows = await this.databaseService.query<LegacyUserRow[]>(
      'SELECT * FROM login WHERE username = ? LIMIT 1',
      [username],
    );

    return rows[0] ?? null;
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

      await this.databaseService.execute(
        'UPDATE login SET password = ? WHERE id = ?',
        [hashedPassword, userId],
      );

      this.logger.log(`Upgraded legacy password hash for user ${userId}`);
    } catch (error) {
      this.logger.warn(
        `Failed to upgrade password hash for user ${userId}: ${String(error)}`,
      );
    }
  }
}
