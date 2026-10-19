import { SeoAuthService } from './seo-auth';
import { hash } from 'bcrypt';
import { ConfigService } from '@nestjs/config';

describe('CRM-backed SEO sessions', () => {
  let auth: SeoAuthService;
  let row: any;
  beforeEach(async () => {
    const config = new ConfigService({
      database: {
        host: 'localhost',
        port: 3307,
        username: 'unused',
        password: 'unused',
      },
      auth: { accessTokenSecret: 'unit-test-secret-domain-separated' },
    });
    auth = new SeoAuthService(config);
    row = {
      id: 42,
      email: 'seo@example.test',
      name: 'SEO staff',
      role: 'Admin',
      is_active: 1,
      password_hash: await hash('verification-password', 10),
    };
    jest.spyOn(auth as any, 'find').mockImplementation(async () => row);
  });
  afterEach(() => auth.onModuleDestroy());
  it('authenticates the existing bcrypt password and rechecks active access on every request', async () => {
    const { token, actor } = await auth.login(
      'seo@example.test',
      'verification-password',
    );
    expect(actor.id).toBe(42);
    expect(
      await auth.authenticate({
        cookies: { majestan_seo_session: token },
      } as any),
    ).toEqual(actor);
    row.is_active = 0;
    await expect(
      auth.authenticate({ cookies: { majestan_seo_session: token } } as any),
    ).rejects.toThrow();
  });
  it('rejects wrong passwords, missing sessions and staff without SEO permission', async () => {
    await expect(
      auth.login('seo@example.test', 'wrong-password'),
    ).rejects.toThrow('Invalid email or password');
    await expect(auth.authenticate({ cookies: {} } as any)).rejects.toThrow();
    row.role = 'Staff';
    await expect(
      auth.login('seo@example.test', 'verification-password'),
    ).rejects.toThrow('SEO access');
    row.seo_permission = 1;
    expect(
      (await auth.login('seo@example.test', 'verification-password')).actor
        .role,
    ).toBe('Staff');
  });
});
