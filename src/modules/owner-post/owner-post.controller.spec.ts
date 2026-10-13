jest.mock('bun', () => ({ S3Client: jest.fn(), S3File: jest.fn() }), {
  virtual: true,
});
jest.mock('meilisearch', () => ({ Meilisearch: jest.fn() }), { virtual: true });
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { OwnerPostController } from './owner-post.controller';
import { OwnerPostService } from './owner-post.service';
import { StorageService } from '../storage/storage.service';

const valid = {
  title: 'Owner plot',
  description: 'A plot with road access',
  listingType: 'Sell',
  price: '500000',
  cityId: 1,
  sublocationId: 2,
  details: { areaSqft: 1200 },
  location: { address: 'Example street' },
  files: [],
};
describe('owner HTTP validation and upload minting', () => {
  let app: INestApplication;
  const service = {
    submit: jest.fn().mockResolvedValue({ id: 99 }),
    accountFor: jest.fn().mockResolvedValue({ id: 11 }),
  };
  const storage = {
    generatePresignedUrl: jest.fn(async (name: string) => ({
      key: `uploads/temp/123-${name}`,
      url: 'https://upload.example.test',
    })),
    generateReadUrl: jest
      .fn()
      .mockReturnValue('https://cdn.example.test/photo.jpg'),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [OwnerPostController],
      providers: [
        { provide: OwnerPostService, useValue: service },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: any, _res: any, next: () => void) => {
      req.user = { sub: 11, role: 'user' };
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => jest.clearAllMocks());
  it('accepts the wizard payload and rejects staff-controlled/nested unknown fields', async () => {
    await request(app.getHttpServer())
      .post('/owner/properties/plot')
      .send(valid)
      .expect(201);
    expect(service.submit).toHaveBeenCalledWith(
      11,
      'plot',
      expect.objectContaining({ cityId: 1, details: { areaSqft: 1200 } }),
    );
    await request(app.getHttpServer())
      .post('/owner/properties/plot')
      .send({
        ...valid,
        approvalStatus: 'Approved',
        details: { areaSqft: 1200, propertyId: 1 },
      })
      .expect(400);
    expect(service.submit).toHaveBeenCalledTimes(1);
  });
  it('validates photo contents instead of just validating the outer array', async () => {
    await request(app.getHttpServer())
      .post('/owner/properties/plot')
      .send({
        ...valid,
        files: [{ fileKey: 'https://example.test/photo.jpg' }],
      })
      .expect(400);
    expect(service.submit).not.toHaveBeenCalled();
  });
  it('mints a unique account-scoped key and rejects non-photo uploads', async () => {
    const response = await request(app.getHttpServer())
      .get('/owner/media/presigned-url')
      .query({ fileName: 'front.jpg', fileType: 'image/jpeg' })
      .expect(200);
    expect(response.body.key).toMatch(
      /^uploads\/temp\/123-owner-11-[a-f0-9-]{36}-front.jpg$/,
    );
    await request(app.getHttpServer())
      .get('/owner/media/presigned-url')
      .query({ fileName: 'file.pdf', fileType: 'application/pdf' })
      .expect(400);
    expect(storage.generatePresignedUrl).toHaveBeenCalledTimes(1);
  });
});
