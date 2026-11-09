import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { SiteAnalyticsModule } from './analytics.module';

describe('site analytics HTTP to DuckDB', () => {
  let app: INestApplication;
  const env = {
    SITE_ANALYTICS_ENABLED: true,
    SITE_ANALYTICS_DB_PATH: ':memory:',
    SITE_ANALYTICS_SECRET: 's'.repeat(40),
    SITE_ANALYTICS_READ_KEY: 'read-key',
    INTERNAL_API_KEY: 'internal',
  };
  let prior: string | undefined;
  beforeAll(async () => {
    prior = process.env.INTERNAL_API_KEY;
    process.env.INTERNAL_API_KEY = 'internal';
    const mod = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        SiteAnalyticsModule,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(env))
      .compile();
    // ConfigModule is global in the real app; explicitly provide it in this fixture.
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.enableShutdownHooks();
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    if (prior === undefined) delete process.env.INTERNAL_API_KEY;
    else process.env.INTERNAL_API_KEY = prior;
  });
  it('requires a private read key and a trusted ingestion origin', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/analytics/status')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/analytics/events')
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/analytics/events')
      .set('x-internal-key', 'internal')
      .set('origin', 'https://evil.com')
      .send({})
      .expect(403);
  });
  it('persists an acknowledged event and deduplicates a retry over HTTP', async () => {
    const body = {
      version: 1,
      events: [
        {
          id: randomUUID(),
          sessionId: randomUUID(),
          pageId: randomUUID(),
          kind: 'pageview',
          name: 'pageview',
          path: '/projects',
          hostname: 'www.majestanrealty.com',
          timestamp: Date.now(),
        },
      ],
    };
    for (let i = 0; i < 2; i++)
      await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .set('x-internal-key', 'internal')
        .set('origin', 'https://www.majestanrealty.com')
        .set('user-agent', 'Mozilla Chrome/123')
        .set('x-client-ip', '192.0.2.1')
        .send(body)
        .expect(200);
    const { body: status } = await request(app.getHttpServer())
      .get('/api/v1/analytics/status')
      .set('x-analytics-key', 'read-key')
      .expect(200);
    expect(Number(status.events)).toBe(1);
  });
  it('does not store bot visits or privacy-opted-out batches', async () => {
    for (const headers of [
      { 'user-agent': 'Googlebot' },
      { 'user-agent': 'Mozilla', dnt: '1' },
    ]) {
      const result = await request(app.getHttpServer())
        .post('/api/v1/analytics/events')
        .set('x-internal-key', 'internal')
        .set('origin', 'https://www.majestanrealty.com')
        .set(headers)
        .send({})
        .expect(200);
      expect(result.body.accepted).toBe(0);
    }
  });
});
