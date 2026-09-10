import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Properties search sort (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  for (const sort of ['low_to_high', 'high_to_low']) {
    it(`/api/v1/properties?sort=${sort} (GET) returns 200 with items`, async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/v1/properties?listingType=Sell&sort=${sort}&limit=2`,
      );
      expect(res.status).toBe(200);
      expect((res.body as { success?: boolean }).success).toBe(true);
      const items = (res.body as { data?: { items?: Array<{ id: number; price: string }> } }).data?.items;
      expect(Array.isArray(items)).toBe(true);
    });
  }
});
