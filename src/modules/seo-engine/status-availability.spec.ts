jest.mock('../storage/storage.service', () => ({ StorageService: class {} }));
import { SeoEngineService } from './seo-engine.service';
import { normalizeSeoInput } from './seo-fields';

describe('inventory status is the only availability source', () => {
  it.each(['available', 'sold', 'rented', 'unavailable'])('keeps an approved %s property live despite dates and old SEO policies', async status => {
    const target = {id: 2599, title: 'Luxury House', slug: 'luxury-house-ip2599', property_type: 'individual_portion', status, approval_status: 'Approved', available_until: '2000-01-01', city: 'Coimbatore'};
    const config = {scope: 'property', property_id: 2599, public_path: '/luxury-house-ip2599', settings: {expired_redirect_policy: 'gone', expired_redirect_path: '/elsewhere'}, robots_index: 1, robots_follow: 1};
    const service = new SeoEngineService({query: jest.fn().mockResolvedValue([])} as any);
    jest.spyOn(service as any, 'one').mockImplementation(async (...args: any[]) => {
      const sql = args[0] as string;
      if (sql.includes('FROM seo_redirects')) return null;
      if (sql.includes('seo_configs WHERE public_path')) return config;
      if (sql.includes('SELECT * FROM properties WHERE id')) return target;
      return null;
    });
    jest.spyOn(service as any, 'defaultSocialImage').mockResolvedValue('');
    jest.spyOn(service as any, 'inventoryMedia').mockResolvedValue([]);
    jest.spyOn(service as any, 'structuredData').mockReturnValue({});
    const result = await service.resolve('/luxury-house-ip2599');
    expect(result.gone).toBeUndefined();
    expect(result.redirect).toBeUndefined();
    expect(result.off_market).toBe(status !== 'available');
    expect(result.robots_index).toBe(true);
    expect(result.settings.expired_redirect_policy).toBeUndefined();
  });
  it('does not generate status-driven redirects in the routing cache', async () => {
    const db = {query: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{scope: 'property',public_path: '/home',property_status: 'unavailable',settings: {expired_redirect_path: '/elsewhere'}}])};
    expect((await new SeoEngineService(db as any).routing()).redirects).toEqual([]);
  });
  it.each(['property', 'project'])('discards legacy lifecycle settings when saving %s SEO', scope => {
    const result = normalizeSeoInput({settings: {expired_redirect_policy: 'gone', redirect_target_path: '/old'}}, {scope, settings: {expired_redirect_path: '/old', focus_keyword: 'home'}});
    expect(result.settings.focus_keyword).toBe('home');
    expect(result.settings.expired_redirect_policy).toBeUndefined();
    expect(result.settings.expired_redirect_path).toBeUndefined();
    expect(result.settings.redirect_target_path).toBeUndefined();
  });
});
