import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  accessTokenSecret:
    process.env.JWT_ACCESS_SECRET ?? 'change-this-secret-immediately',
  accessTokenTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  saltRounds: Number.parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10),
  allowLegacyPlainPassword:
    (process.env.AUTH_ALLOW_LEGACY_PLAIN_PASSWORD ?? 'false').toLowerCase() ===
    'true',
}));
