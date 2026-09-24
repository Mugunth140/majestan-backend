jest.mock('bun', () => ({ S3Client: jest.fn(), S3File: jest.fn() }), { virtual: true });

import { AdPlacement } from '../../database/entities/ad.entity';
import { AdsService } from './ads.service';

describe('AdsService', () => {
  it('returns only active ads in sort order with absolute image urls', async () => {
    const repo = {
      find: jest.fn(async () => [
        { id: 2, title: 'B', desktopImageKey: 'uploads/ads/b.webp', mobileImageKey: 'uploads/ads/bm.webp', linkType: 'custom', linkPreset: null, linkCustom: '/rent', sortOrder: 1, isActive: true },
        { id: 1, title: 'A', desktopImageKey: 'uploads/ads/a.webp', mobileImageKey: 'uploads/ads/am.webp', linkType: 'preset', linkPreset: 'buy-apartments', linkCustom: null, sortOrder: 0, isActive: true },
      ]),
    };
    const storage = { generateReadUrl: jest.fn((k: string) => `https://cdn.example/${k}`) };
    const service = new AdsService(repo as any, storage as any);
    const out = await service.listActive(AdPlacement.Hero);
    expect(repo.find).toHaveBeenCalledWith({
      where: { placement: AdPlacement.Hero, isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    expect(out.items[0]).toEqual({
      id: 1,
      title: 'A',
      desktopImage: 'https://cdn.example/uploads/ads/a.webp',
      mobileImage: 'https://cdn.example/uploads/ads/am.webp',
      linkType: 'preset',
      linkPreset: 'buy-apartments',
      linkCustom: null,
    });
    expect(out.items).toHaveLength(2);
  });
});
