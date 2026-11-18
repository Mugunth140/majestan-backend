jest.mock('../storage/storage.service', () => ({ StorageService: class {} }));
import { SeoEngineService } from './seo-engine.service';

describe('old-website URLs', () => {
  const setup = (row: any) => {
    const svc = new SeoEngineService({ query: jest.fn().mockResolvedValue([]) } as any);
    const one = jest.spyOn(svc as any, 'one').mockImplementation(async (...args: any[]) =>
      (args[0] as string).includes('legacy_source_id') ? row : null);
    return { svc, one };
  };

  it('moves an old URL to the property that kept its code', async () => {
    const { svc, one } = setup({ slug: 'palanikumar-cs986', public_path: null });
    expect(await svc.resolve('/office-space-for-rent-in-saibaba-colony-coimbatore-1-floor-cs709')).toEqual({ redirect: '/palanikumar-cs986' });
    expect(one.mock.calls.find((c: any[]) => c[0].includes('legacy_source_id'))![1]).toEqual(['CS709']);
  });

  it('prefers the configured public path', async () => {
    const { svc } = setup({ slug: 'x-cs986', public_path: '/office-in-saibaba-colony-cs986' });
    expect(await svc.legacyRedirect('/old-office-cs709')).toBe('/office-in-saibaba-colony-cs986');
  });

  it('stays a 404 when no property kept the code, or the path has no code', async () => {
    const { svc, one } = setup(null);
    expect(await svc.resolve('/gone-warehouse-in154')).toBeNull();
    expect(await svc.legacyRedirect('/about-us')).toBeNull();
    expect(await svc.legacyRedirect('/a-cs1/amenities')).toBeNull();
    expect(one.mock.calls.filter((c: any[]) => c[0].includes('legacy_source_id'))).toHaveLength(1);
  });
});
