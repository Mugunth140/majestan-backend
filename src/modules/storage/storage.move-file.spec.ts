jest.mock('bun', () => ({ S3Client: jest.fn(), S3File: jest.fn() }), {
  virtual: true,
});

import { StorageService } from './storage.service';

describe('StorageService.moveFile', () => {
  const previousDriver = process.env.STORAGE_DRIVER;

  afterEach(() => {
    if (previousDriver === undefined) delete process.env.STORAGE_DRIVER;
    else process.env.STORAGE_DRIVER = previousDriver;
  });

  it('keeps owner temp keys for retry until the property transaction commits', async () => {
    process.env.STORAGE_DRIVER = 'r2';
    const storage = new StorageService({ get: () => undefined } as any);
    (storage as any).s3Client = {
      file: jest.fn(() => ({})),
      write: jest.fn().mockResolvedValue(0),
    };
    const deleteFile = jest.spyOn(storage, 'deleteFile').mockResolvedValue();

    await expect(
      storage.moveFile('uploads/temp/plan.pdf', 'application/pdf', true),
    ).resolves.toBe('uploads/properties/plan.pdf');
    expect(deleteFile).not.toHaveBeenCalled();

    await storage.moveFile('uploads/temp/plan.pdf', 'application/pdf');
    expect(deleteFile).toHaveBeenCalledWith('uploads/temp/plan.pdf');
    await storage.moveFile('uploads/properties/existing.pdf', 'application/pdf');
    expect(deleteFile).toHaveBeenCalledTimes(1);
  });
});
