import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  OnModuleDestroy,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { createHash } from 'crypto';
import { createPool, Pool, RowDataPacket } from 'mysql2/promise';
import type { Request } from 'express';

export const SEO_COOKIE = 'majestan_seo_session';
export type SeoActor = {
  id: number;
  email: string;
  name: string;
  role: string;
};
export type SeoRequest = Request & { seoActor: SeoActor };

export function assertSeoOrigin(req: Request) {
  if (!req.headers.origin) return; // Server-to-server proxy requests have no browser origin.
  const allowed = new Set(
    [
      'https://www.majestanrealty.com',
      'https://majestanrealty.com',
      process.env.FRONTEND_URL,
    ].filter(Boolean),
  );
  try {
    const origin = new URL(req.headers.origin);
    if (allowed.has(origin.origin)) return;
    if (
      process.env.NODE_ENV !== 'production' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
    )
      return;
  } catch {}
  throw new ForbiddenException('Invalid request origin');
}

@Injectable()
export class SeoAuthService implements OnModuleDestroy {
  private pool: Pool;
  private jwt = new JwtService();
  private secret: string;

  constructor(config: ConfigService) {
    this.pool = createPool({
      host: config.get('CRM_DB_HOST') || config.get('database.host'),
      port: Number(config.get('CRM_DB_PORT') || config.get('database.port')),
      user: config.get('CRM_DB_USERNAME') || config.get('database.username'),
      password:
        config.get('CRM_DB_PASSWORD') ?? config.get('database.password'),
      database: config.get('CRM_DB_NAME') || 'majestan_crm',
      connectionLimit: 3,
      ...(config.get<boolean>('database.ssl')
        ? { ssl: { rejectUnauthorized: true } }
        : {}),
    });
    // Domain-separated signing key: SEO cookies can never authenticate against
    // the legacy JWT strategy or CRM's sync routes.
    this.secret =
      config.get('SEO_SESSION_SECRET') ||
      createHash('sha256')
        .update(
          config.getOrThrow<string>('auth.accessTokenSecret') +
            ':seo-command-center:v1:' +
            (config.get('CRM_DB_NAME') || 'majestan_crm'),
        )
        .digest('hex');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  private async find(where: string, value: string | number) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT u.id,u.email,u.name,u.password_hash,u.is_active,r.name AS role,
      EXISTS(SELECT 1 FROM user_permissions up JOIN permissions p ON p.id=up.permission_id
        WHERE up.user_id=u.id AND p.name='seo.manage') AS seo_permission
      FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE ${where} LIMIT 1`,
      [value],
    );
    return rows[0];
  }

  private actor(row: RowDataPacket | undefined): SeoActor {
    if (!row || !row.is_active)
      throw new UnauthorizedException(
        'Account is inactive or no longer exists',
      );
    if (!['Admin', 'Super Admin'].includes(row.role) && !row.seo_permission) {
      throw new ForbiddenException('Your CRM account needs SEO access');
    }
    return { id: row.id, email: row.email, name: row.name, role: row.role };
  }

  async login(email: string, password: string) {
    const row = await this.find('LOWER(u.email)=?', email.trim().toLowerCase());
    // Always run bcrypt, including unknown users.
    const valid = await compare(
      password,
      row?.password_hash ||
        '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    );
    if (!row || !valid)
      throw new UnauthorizedException('Invalid email or password');
    const actor = this.actor(row);
    const token = this.jwt.sign(
      { sub: actor.id },
      {
        secret: this.secret,
        expiresIn: '8h',
        issuer: 'majestan-seo',
        audience: 'seo-admin',
      },
    );
    return { actor, token };
  }

  async authenticate(req: Request) {
    const token = req.cookies?.[SEO_COOKIE];
    if (!token)
      throw new UnauthorizedException('Sign in with your CRM account');
    let subject: number;
    try {
      const payload = this.jwt.verify(token, {
        secret: this.secret,
        issuer: 'majestan-seo',
        audience: 'seo-admin',
        algorithms: ['HS256'],
      });
      subject = Number(payload.sub);
      if (!Number.isSafeInteger(subject) || subject < 1)
        throw new Error('Invalid subject');
    } catch {
      throw new UnauthorizedException('Session expired. Please sign in again');
    }
    return this.actor(await this.find('u.id=?', subject));
  }
}

@Injectable()
export class SeoSessionGuard implements CanActivate {
  constructor(private readonly auth: SeoAuthService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<SeoRequest>();
    if (!['GET', 'HEAD'].includes(req.method)) assertSeoOrigin(req);
    req.seoActor = await this.auth.authenticate(req);
    return true;
  }
}
