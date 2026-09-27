jest.mock(
  'bun',
  () => ({
    S3Client: jest.fn().mockImplementation(() => ({
      presign: jest.fn(),
      write: jest.fn(),
      delete: jest.fn(),
    })),
    S3File: jest.fn(),
  }),
  { virtual: true },
);

import { StorageService, resolveLocalUploadDir } from './storage.service';

describe('StorageService.processAdImage', () => {
  const OLD_ENV = { ...process.env };
  beforeEach(() => {
    process.env.R2_PUBLIC_URL = 'https://cdn.example';
    process.env.R2_BUCKET_NAME = 'test-bucket';
    process.env.R2_ACCOUNT_ID = 'test-acct';
    process.env.R2_ACCESS_KEY_ID = 'k';
    process.env.R2_SECRET_ACCESS_KEY = 's';
    global.fetch = jest.fn() as any;
  });
  afterEach(() => {
    process.env = { ...OLD_ENV };
    jest.restoreAllMocks();
  });

  it('passes non-temp keys through untouched', async () => {
    const svc = new StorageService({ get: () => undefined } as any);
    await expect(svc.processAdImage('uploads/ads/old.webp', 'desktop')).resolves.toBe(
      'uploads/ads/old.webp',
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('finalizes temp keys to uploads/ads webp WITHOUT any watermark param', async () => {
    const webp = new Blob(['fake'], { type: 'image/webp' });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => webp } as any) as any;
    const write = jest.fn().mockResolvedValue(undefined);
    const del = jest.fn().mockResolvedValue(undefined);
    const svc = new StorageService({ get: () => undefined } as any);
    (svc as any).s3Client = { write, delete: del };
    const out = await svc.processAdImage('uploads/temp/123-a.png', 'desktop');
    expect(out).toBe('uploads/ads/123-a.webp');
    const url = (global.fetch as unknown as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('rs:fit:1920:540:0');
    expect(url).toContain('/format:webp');
    expect(url).not.toContain('wm:');
    expect(url).not.toContain('watermark');
    expect(write).toHaveBeenCalledWith('uploads/ads/123-a.webp', webp, { type: 'image/webp' });
  });

  it('reads dimensions from the imgproxy info endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ width: 3200, height: 900 }) } as any) as any;
    const svc = new StorageService({ get: () => undefined } as any);
    await expect(svc.getImageDimensions('https://cdn.example/x.png')).resolves.toEqual({
      width: 3200,
      height: 900,
    });
    const url = (global.fetch as unknown as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/info/plain/https://cdn.example/x.png');
  });
});

describe('resolveLocalUploadDir', () => {
  it('honors an absolute dir instead of nesting it under cwd', () => {
    expect(resolveLocalUploadDir('/uploads', '/app')).toBe('/uploads');
  });

  it('resolves a relative dir against cwd (the static-server default)', () => {
    expect(resolveLocalUploadDir('./uploads', '/app')).toBe('/app/uploads');
    expect(resolveLocalUploadDir(undefined, '/app')).toBe('/app/uploads');
  });
});

describe('StorageService local driver', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  const OLD_ENV = { ...process.env };
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-local-'));
    process.env.STORAGE_DRIVER = 'local';
    process.env.LOCAL_UPLOAD_DIR = tmpDir;
    process.env.LOCAL_UPLOAD_BASE_URL = 'http://localhost:5000';
    delete process.env.R2_PUBLIC_URL;
  });
  afterEach(() => {
    process.env = { ...OLD_ENV };
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  const makeSvc = () => new StorageService({ get: () => undefined } as any);

  it('generatePresignedUrl returns a same-origin PUT url without touching S3', async () => {
    const svc = makeSvc();
    const presign = jest.fn();
    (svc as any).s3Client = { presign, write: jest.fn(), delete: jest.fn() };
    const out = await svc.generatePresignedUrl('banner.png', 'image/png');
    expect(out.key).toMatch(/^local\/temp\//);
    expect(out.url.startsWith('http://localhost:5000/api/v1/admin/media/upload-temp?key=')).toBe(true);
    expect(presign).not.toHaveBeenCalled();
  });

  it('generateReadUrl returns base+key for local keys', () => {
    const svc = makeSvc();
    expect(svc.generateReadUrl('local/ads/x.webp')).toBe(
      'http://localhost:5000/local/ads/x.webp',
    );
  });

  it('generateReadUrl keeps R2-hosted keys on R2 even in local mode', () => {
    const svc = makeSvc();
    (svc as any).s3Client = {
      presign: jest.fn(() => 'https://r2.test/presigned'),
      write: jest.fn(),
      delete: jest.fn(),
    };
    expect(svc.generateReadUrl('uploads/properties/x.webp')).toBe('https://r2.test/presigned');
  });

  it('deleteFile removes the file from disk', async () => {
    const svc = makeSvc();
    const key = 'local/temp/gone.png';
    fs.mkdirSync(path.join(tmpDir, 'local/temp'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, key), 'data');
    await svc.deleteFile(key);
    expect(fs.existsSync(path.join(tmpDir, key))).toBe(false);
  });

  it('processAdImage resizes to slot bounds as webp via sharp', async () => {
    const sharp = require('sharp');
    const svc = makeSvc();
    fs.mkdirSync(path.join(tmpDir, 'local/temp'), { recursive: true });
    await sharp({
      create: { width: 3200, height: 900, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toFile(path.join(tmpDir, 'local/temp/t.png'));
    const out = await svc.processAdImage('local/temp/t.png', 'desktop');
    expect(out).toBe('local/ads/t.webp');
    const meta = await sharp(path.join(tmpDir, out)).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBeLessThanOrEqual(1920);
    expect(meta.height).toBeLessThanOrEqual(540);
    expect(fs.existsSync(path.join(tmpDir, 'local/temp/t.png'))).toBe(false);
  });

  it('getImageDimensions reads local file dimensions', async () => {
    const sharp = require('sharp');
    const svc = makeSvc();
    fs.mkdirSync(path.join(tmpDir, 'local/temp'), { recursive: true });
    await sharp({
      create: { width: 800, height: 1000, channels: 3, background: { r: 4, g: 5, b: 6 } },
    })
      .png()
      .toFile(path.join(tmpDir, 'local/temp/m.png'));
    await expect(
      svc.getImageDimensions('http://localhost:5000/local/temp/m.png'),
    ).resolves.toEqual({ width: 800, height: 1000 });
  });
});
