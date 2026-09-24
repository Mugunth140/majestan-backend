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

import { StorageService } from './storage.service';

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
