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

import { AdPlacement } from '../../../database/entities/ad.entity';
import { AdminAdsService } from './admin-ads.service';

function makeService(overrides: any = {}) {
  const repo = {
    create: jest.fn((v: any) => v),
    save: jest.fn(async (v: any) => ({ id: 7, ...v })),
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    delete: jest.fn(async () => ({})),
    ...overrides.repo,
  };
  const storage = {
    generatePresignedUrl: jest.fn(async () => ({ url: 'u', key: 'k' })),
    generateReadUrl: jest.fn((k: string) => `https://cdn.example/${k}`),
    processAdImage: jest.fn(async (k: string) => k.replace('uploads/temp/', 'uploads/ads/').replace(/\.[^/.]+$/, '.webp')),
    getImageDimensions: jest.fn(async (url: string) =>
      String(url).includes('/m.png') ? { width: 800, height: 1000 } : { width: 3200, height: 900 },
    ),
    ...overrides.storage,
  };
  const service = new AdminAdsService(repo as any, storage as any);
  return { service, repo, storage };
}

const validCreate = () => ({
  title: 'Diwali Offer',
  desktopImageKey: 'uploads/temp/d.png',
  mobileImageKey: 'uploads/temp/m.png',
  linkType: 'preset',
  linkPreset: 'buy-apartments',
});

describe('AdminAdsService', () => {
  it('finalizes both temp images on create and saves the ad', async () => {
    const { service, repo, storage } = makeService();
    const out = await service.create(validCreate() as any, 'admin');
    expect(storage.getImageDimensions).toHaveBeenCalledTimes(2);
    expect(storage.processAdImage).toHaveBeenCalledWith('uploads/temp/d.png', 'desktop');
    expect(storage.processAdImage).toHaveBeenCalledWith('uploads/temp/m.png', 'mobile');
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Diwali Offer',
        desktopImageKey: 'uploads/ads/d.webp',
        mobileImageKey: 'uploads/ads/m.webp',
        placement: AdPlacement.Hero,
        createdBy: 'admin',
      }),
    );
    expect(out.id).toBe(7);
  });

  it('rejects a desktop image with the wrong aspect ratio', async () => {
    const { service } = makeService({
      storage: { getImageDimensions: jest.fn(async () => ({ width: 1000, height: 1000 })) },
    });
    await expect(service.create(validCreate() as any, 'admin')).rejects.toThrow(/32:9/i);
  });

  it('reorder assigns sort_order by position', async () => {
    const save = jest.fn(async (v: any) => v);
    const { service } = makeService({ repo: { find: jest.fn(async () => [{ id: 3 }, { id: 9 }]), save } });
    await service.reorder([9, 3]);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 9, sortOrder: 0 }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 3, sortOrder: 1 }));
  });
});
