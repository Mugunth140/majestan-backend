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
  const repo: any = {
    manager: { transaction: jest.fn(async (run: any) => run({ getRepository: () => repo })) },
    create: jest.fn((v: any) => v),
    save: jest.fn(async (v: any) => ({ id: 7, ...v })),
    find: jest.fn(async () => []),
    count: jest.fn(async () => 0),
    findOne: jest.fn(async () => null),
    delete: jest.fn(async () => ({})),
    ...overrides.repo,
  };
  const storage = {
    generatePresignedUrl: jest.fn(async () => ({ url: 'u', key: 'k' })),
    generateReadUrl: jest.fn((k: string) => `https://cdn.example/${k}`),
    processAdImage: jest.fn(async (k: string) => k.replace('uploads/temp/', 'uploads/ads/').replace(/\.[^/.]+$/, '.webp')),
    deleteFile: jest.fn(async () => undefined),
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
  describe('placement specs', () => {
    it('creates a single-image 3:2 mega-menu ad targeted at an audience', async () => {
      const { service, repo, storage } = makeService({
        storage: { getImageDimensions: jest.fn(async () => ({ width: 1500, height: 1000 })) },
      });
      await service.create(
        { title: 'Rent promo', placement: AdPlacement.MegaMenu, audience: 'rent', desktopImageKey: 'uploads/temp/d.png', linkType: 'preset', linkPreset: 'rent' } as any,
        'admin',
      );
      expect(storage.processAdImage).toHaveBeenCalledWith('uploads/temp/d.png', 'desktop', { width: 900, height: 600 });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ placement: AdPlacement.MegaMenu, audience: 'rent', mobileImageKey: null }),
      );
    });

    it('rejects a mega-menu image that is not 3:2', async () => {
      const { service } = makeService({
        storage: { getImageDimensions: jest.fn(async () => ({ width: 3200, height: 900 })) },
      });
      await expect(
        service.create({ title: 'X', placement: AdPlacement.MegaMenu, desktopImageKey: 'uploads/temp/d.png' } as any),
      ).rejects.toThrow(/3:2/);
    });

    it('drops a mobile upload on a single-image placement', async () => {
      const { service, repo, storage } = makeService({
        storage: { getImageDimensions: jest.fn(async () => ({ width: 1500, height: 1000 })) },
      });
      await service.create({ title: 'X', placement: AdPlacement.MegaMenu, desktopImageKey: 'uploads/temp/d.png', mobileImageKey: 'uploads/temp/m.png' } as any);
      expect(storage.deleteFile).toHaveBeenCalledWith('uploads/temp/m.png');
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ mobileImageKey: null }));
    });

    it('rejects an audience the placement does not offer', async () => {
      const { service } = makeService({
        storage: { getImageDimensions: jest.fn(async () => ({ width: 1500, height: 1000 })) },
      });
      await expect(
        service.create({ title: 'X', placement: AdPlacement.MegaMenu, audience: 'projects', desktopImageKey: 'uploads/temp/d.png' } as any),
      ).rejects.toThrow(/audience/);
    });

    it('lets the offers carousel skip the optional mobile image', async () => {
      const { service, repo } = makeService({
        storage: { getImageDimensions: jest.fn(async () => ({ width: 3600, height: 900 })) },
      });
      await service.create({ title: 'Offer', placement: AdPlacement.Offers, desktopImageKey: 'uploads/temp/d.png' } as any);
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ placement: AdPlacement.Offers, mobileImageKey: null, audience: null }));
    });

    it('still requires the hero mobile image', async () => {
      const { service } = makeService();
      await expect(
        service.create({ title: 'X', desktopImageKey: 'uploads/temp/d.png' } as any),
      ).rejects.toThrow(/mobile image is required/);
    });

    it('requires fresh images when an ad moves to a different placement', async () => {
      const existing = { id: 3, placement: AdPlacement.Hero, desktopImageKey: 'uploads/ads/d.webp', mobileImageKey: 'uploads/ads/m.webp', audience: null };
      const { service } = makeService({ repo: { findOne: jest.fn(async () => ({ ...existing })) } });
      await expect(service.update(3, { placement: AdPlacement.MegaMenu } as any)).rejects.toThrow(/new image/);
    });
  });

  it('finalizes both temp images on create and saves the ad', async () => {
    const { service, repo, storage } = makeService();
    const out = await service.create(validCreate() as any, 'admin');
    expect(storage.getImageDimensions).toHaveBeenCalledTimes(2);
    expect(storage.processAdImage).toHaveBeenCalledWith('uploads/temp/d.png', 'desktop', { width: 1920, height: 540 });
    expect(storage.processAdImage).toHaveBeenCalledWith('uploads/temp/m.png', 'mobile', { width: 1080, height: 1350 });
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

  it('performs zero processAdImage calls when the mobile ratio fails', async () => {
    const { service, storage } = makeService({
      storage: {
        getImageDimensions: jest.fn(async (url: string) =>
          String(url).includes('/m.png') ? { width: 1000, height: 1000 } : { width: 3200, height: 900 },
        ),
      },
    });
    await expect(service.create(validCreate() as any, 'admin')).rejects.toThrow(/4:5/i);
    expect(storage.processAdImage).not.toHaveBeenCalled();
    expect(storage.deleteFile).toHaveBeenCalledWith('uploads/temp/d.png');
    expect(storage.deleteFile).toHaveBeenCalledWith('uploads/temp/m.png');
  });

  it('list maps records to absolute desktopImage/mobileImage urls', async () => {
    const ad = { id: 1, desktopImageKey: 'uploads/ads/d.webp', mobileImageKey: 'uploads/ads/m.webp' };
    const { service } = makeService({ repo: { findAndCount: jest.fn(async () => [[ad], 1]) } });
    const out = await service.list('hero' as any);
    expect(out.total).toBe(1);
    expect(out.items[0]).toMatchObject({
      desktopImageKey: 'uploads/ads/d.webp',
      desktopImage: 'https://cdn.example/uploads/ads/d.webp',
      mobileImage: 'https://cdn.example/uploads/ads/m.webp',
    });
  });

  it('details returns absolute desktopImage/mobileImage urls', async () => {
    const ad = { id: 2, desktopImageKey: 'uploads/ads/d.webp', mobileImageKey: 'uploads/ads/m.webp' };
    const { service } = makeService({ repo: { findOne: jest.fn(async () => ad) } });
    const out: any = await service.details(2);
    expect(out.desktopImage).toBe('https://cdn.example/uploads/ads/d.webp');
    expect(out.mobileImage).toBe('https://cdn.example/uploads/ads/m.webp');
  });

  it('remove deletes both final R2 keys best-effort', async () => {
    const ad = { id: 5, desktopImageKey: 'uploads/ads/d.webp', mobileImageKey: 'uploads/ads/m.webp' };
    const { service, storage } = makeService({ repo: { findOne: jest.fn(async () => ({ ...ad })) } });
    const out = await service.remove(5);
    expect(out).toEqual({ id: 5, deleted: true });
    expect(storage.deleteFile).toHaveBeenCalledWith('uploads/ads/d.webp');
    expect(storage.deleteFile).toHaveBeenCalledWith('uploads/ads/m.webp');
  });

  it('update deletes the old final key when the image is replaced', async () => {
    const ad = { id: 6, desktopImageKey: 'uploads/ads/old.webp', mobileImageKey: 'uploads/ads/m.webp' };
    const { service, storage } = makeService({ repo: { findOne: jest.fn(async () => ({ ...ad })) } });
    await service.update(6, { desktopImageKey: 'uploads/temp/new.png' } as any);
    expect(storage.deleteFile).toHaveBeenCalledWith('uploads/ads/old.webp');
  });

  it('reorder assigns sort_order by position', async () => {
    const save = jest.fn(async (v: any) => v);
    const { service } = makeService({ repo: { find: jest.fn(async () => [{ id: 3 }, { id: 9 }]), save } });
    await service.reorder([9, 3]);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 9, sortOrder: 0 }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 3, sortOrder: 1 }));
  });
});

describe('AdminAdsService.presignedUrl', () => {
  it('rejects missing fileName/fileType', () => {
    const { service, storage } = makeService();
    expect(() => service.presignedUrl('', '')).toThrow(/fileName and fileType are required/i);
    expect(storage.generatePresignedUrl).not.toHaveBeenCalled();
  });

  it('rejects unsupported mime types', () => {
    const { service, storage } = makeService();
    expect(() => service.presignedUrl('doc.pdf', 'application/pdf')).toThrow(/must be one of/i);
    expect(storage.generatePresignedUrl).not.toHaveBeenCalled();
  });

  it('delegates valid image uploads to storage', async () => {
    const { service, storage } = makeService();
    await expect(service.presignedUrl('a.png', 'image/png')).resolves.toEqual({ url: 'u', key: 'k' });
    expect(storage.generatePresignedUrl).toHaveBeenCalledWith('a.png', 'image/png');
  });
});

it('keeps the old creative when saving its replacement fails', async () => {
 const {service,storage}=makeService({repo:{findOne:jest.fn(async()=>({id:7,desktopImageKey:'uploads/ads/old.webp',placement:AdPlacement.MegaMenu})),save:jest.fn(async()=>{throw new Error('Database unavailable');})},storage:{getImageDimensions:jest.fn(async()=>({width:900,height:600}))}});
 await expect(service.update(7,{desktopImageKey:'uploads/temp/new.png'})).rejects.toThrow('Database unavailable');
 expect(storage.deleteFile).not.toHaveBeenCalledWith('uploads/ads/old.webp');
});
it('validates audience before processing or removing images',async()=>{
 const {service,storage}=makeService({repo:{findOne:jest.fn(async()=>({id:7,desktopImageKey:'uploads/ads/old.webp',placement:AdPlacement.MegaMenu}))}});
 await expect(service.update(7,{desktopImageKey:'uploads/temp/new.png',audience:'invalid'})).rejects.toThrow('audience must');
 expect(storage.processAdImage).not.toHaveBeenCalled();expect(storage.deleteFile).not.toHaveBeenCalledWith('uploads/ads/old.webp');
});
it('keeps a creative that remains referenced by another ad or image slot',async()=>{
 const {service,storage}=makeService({repo:{findOne:jest.fn(async()=>({id:7,desktopImageKey:'uploads/ads/shared.webp',mobileImageKey:'uploads/ads/shared.webp',placement:AdPlacement.Offers})),count:jest.fn(async()=>1)}});
 await service.update(7,{mobileImageKey:null});expect(storage.deleteFile).not.toHaveBeenCalled();
});

it('rejects duplicate IDs before reordering', async()=>{
 const {service,repo}=makeService(); await expect(service.reorder([7,7])).rejects.toThrow('unique positive'); expect(repo.save).not.toHaveBeenCalled();
});
it('does not reorder another placement by mistake',async()=>{
 const {service,repo}=makeService({repo:{find:jest.fn(async()=>[{id:7,placement:AdPlacement.Hero},{id:8,placement:AdPlacement.Offers}])}});
 await expect(service.reorder([7,8])).rejects.toThrow('one placement');expect(repo.save).not.toHaveBeenCalled();
});
it('performs a reorder through one database transaction',async()=>{
 const {service,repo}=makeService({repo:{find:jest.fn(async()=>[{id:7,placement:AdPlacement.Offers},{id:8,placement:AdPlacement.Offers}])}});
 await service.reorder([8,7]);expect(repo.manager.transaction).toHaveBeenCalledTimes(1);expect(repo.save.mock.calls.map(([ad]:any[])=>[ad.id,ad.sortOrder])).toEqual([[8,0],[7,1]]);
});
