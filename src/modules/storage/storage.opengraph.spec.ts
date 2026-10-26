jest.mock('bun', () => ({ S3Client: jest.fn(), S3File: jest.fn() }), { virtual: true });
import sharp from 'sharp';
import { StorageService } from './storage.service';

async function* bytes(buffer: Buffer) { yield buffer; }

describe('OpenGraph R2 buffer upload', () => {
  const previous = { ...process.env };
  let service: StorageService;
  let write: jest.Mock;
  beforeEach(() => {
    process.env.R2_PUBLIC_URL = 'https://cdn.example/';
    process.env.STORAGE_DRIVER = 'local';
    service = new StorageService({ get: () => undefined } as any);
    write = jest.fn().mockResolvedValue(undefined);
    (service as any).s3Client = { write };
  });
  afterEach(() => { process.env = { ...previous }; });

  it.each(['png', 'jpeg', 'webp'] as const)('writes original %s bytes directly to R2 even with local driver', async (format) => {
    const buffer = await sharp({ create: { width: 12, height: 6, channels: 3, background: 'blue' } }).toFormat(format).toBuffer();
    const result = await service.uploadOpenGraphImage(bytes(buffer), `image/${format}`);
    expect(result.url).toBe(`https://cdn.example/${result.key}`);
    expect(result.key).toMatch(/^uploads\/seo\/opengraph\//);
    expect(write).toHaveBeenCalledWith(result.key, buffer, { type: `image/${format}` });
    expect(Buffer.isBuffer(write.mock.calls[0][1])).toBe(true);
  });

  it('stores blog images in their own folder using the same image validation', async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'blue' } }).png().toBuffer();
    const result = await service.uploadOpenGraphImage(bytes(png), 'image/png', 'uploads/blog');
    expect(result.key).toMatch(/^uploads\/blog\//);
    expect(write).toHaveBeenCalledWith(result.key, png, {type: 'image/png'});
  });
  it('rejects oversized uploads before writing to R2', async () => {
    await expect(service.uploadOpenGraphImage(bytes(Buffer.alloc(5 * 1024 * 1024 + 1)), 'image/png')).rejects.toThrow('5 MB');
    expect(write).not.toHaveBeenCalled();
  });
  it('rejects empty and unreadable images', async () => {
    await expect(service.uploadOpenGraphImage(bytes(Buffer.alloc(0)), 'image/png')).rejects.toThrow('Choose an image');
    await expect(service.uploadOpenGraphImage(bytes(Buffer.from('invalid')), 'image/png')).rejects.toThrow('not a readable image');
    expect(write).not.toHaveBeenCalled();
  });
  it('rejects unsupported content types', async () => {
    await expect(service.uploadOpenGraphImage(bytes(Buffer.from('<svg/>')), 'image/svg+xml')).rejects.toThrow('JPEG, PNG or WebP');
    expect(write).not.toHaveBeenCalled();
  });
  it('rejects files with mismatched image content', async () => {
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'red' } }).png().toBuffer();
    await expect(service.uploadOpenGraphImage(bytes(png), 'image/jpeg')).rejects.toThrow('does not match');
    expect(write).not.toHaveBeenCalled();
  });
  it('requires a permanent public R2 URL', async () => {
    delete process.env.R2_PUBLIC_URL;
    await expect(service.uploadOpenGraphImage(bytes(Buffer.from('x')), 'image/png')).rejects.toThrow('not configured');
    expect(write).not.toHaveBeenCalled();
  });
  it('reports R2 failure without returning a saved URL', async () => {
    write.mockRejectedValue(new Error('R2 unavailable'));
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'red' } }).png().toBuffer();
    await expect(service.uploadOpenGraphImage(bytes(png), 'image/png')).rejects.toThrow('upload failed');
  });
});
