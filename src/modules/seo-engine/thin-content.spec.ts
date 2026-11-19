jest.mock('../storage/storage.service', () => ({ StorageService: class {} }));
import { SeoEngineService } from './seo-engine.service';

describe('thin-content guard on listing pages', () => {
  const rule = { inventory_kind: 'property', transaction_intent: 'buy', property_type: 'apartment', city_name: 'Chennai', locality_name: null, minimum_active_listings: 2 };
  // Properties query returns `properties`, projects query returns `projects` rows.
  const service = (properties: number, projects: number) => {
    const query = jest.fn(async (sql: string) => Array(sql.includes('FROM projects p') ? projects : properties).fill({ price: 1 }));
    return { svc: new SeoEngineService({ query } as any), query };
  };

  it('counts matching projects when a city has no resale listings', async () => {
    const { svc } = service(0, 77);
    expect(await svc.activeListingCount(rule, { stats: { total: 0 } })).toBe(77);
  });

  it('stays thin when neither properties nor projects match', async () => {
    const { svc } = service(0, 0);
    expect(await svc.activeListingCount({ ...rule, property_type: 'plot' }, { stats: { total: 0 } })).toBe(0);
  });

  it('skips the project lookup when properties already pass', async () => {
    const { svc, query } = service(0, 0);
    expect(await svc.activeListingCount(rule, { stats: { total: 5 } })).toBe(5);
    expect(query).not.toHaveBeenCalled();
  });

  it('matches projects whose locality is stored with the city', async () => {
    const { svc, query } = service(0, 3);
    await svc.activeListingCount({ ...rule, locality_name: 'Medavakkam' }, { stats: { total: 0 } });
    const [sql, args] = query.mock.calls[0] as any[];
    expect(sql).toContain("LOWER(TRIM(TRAILING ',' FROM TRIM(p.sublocation))) IN (LOWER(?), LOWER(CONCAT(?, ', ', p.city)))");
    expect(args).toEqual(['Chennai', 'Medavakkam', 'Medavakkam', 'apartment']);
  });
});

describe('listing pages in every city', () => {
  const cities = [{ id: 1, city_name: 'Coimbatore' }, { id: 2, city_name: 'Chennai' }, { id: 3, city_name: 'Bangalore' }];
  const subs: Record<number, any[]> = {
    1: [{ id: 10, locality_name: 'Saravanampatti' }],
    2: [{ id: 20, locality_name: 'Padur' }, { id: 21, locality_name: 'Padur, Chennai' }, { id: 22, locality_name: 'Medavakkam, Chennai' }],
    3: [{ id: 30, locality_name: 'Electronic City,' }],
  };
  const svc = () => new SeoEngineService({
    query: jest.fn(async (sql: string, args: any[]) => (sql.includes('FROM cities') ? cities : subs[args[0]] ?? [])),
  } as any);

  it('indexes a page with a single listing', async () => {
    const rule = await svc().inferRule('/independent-houses-for-rent-in-saravanampatti-coimbatore');
    expect(rule).toMatchObject({ minimum_active_listings: 1, transaction_intent: 'rent', locality_name: 'Saravanampatti' });
    expect((await svc().inferRule('/villas-for-sale-in-bangalore'))?.minimum_active_listings).toBe(1);
  });

  it('drops the city and stray commas from area names', async () => {
    expect(await svc().inferRule('/apartments-for-sale-in-medavakkam-chennai')).toMatchObject({ sublocation_id: 22, locality_name: 'Medavakkam' });
    expect(await svc().inferRule('/apartments-for-sale-in-padur-chennai')).toMatchObject({ sublocation_id: 20, locality_name: 'Padur' });
    expect(await svc().inferRule('/apartments-for-sale-in-electronic-city-bangalore')).toMatchObject({ sublocation_id: 30, locality_name: 'Electronic City' });
  });

  it('still opens the old URL with the city repeated', async () => {
    expect(await svc().inferRule('/apartments-for-sale-in-medavakkam-chennai-chennai')).toMatchObject({ sublocation_id: 22 });
  });

  it('lists project-only area pages in the sitemap', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('UNION ALL')) return [
        { city: 'Chennai', property_type: 'apartment', listing_type: 'Sell', locality_name: 'Medavakkam, Chennai', total: 6 },
        { city: 'Chennai', property_type: 'apartment', listing_type: 'Sell', locality_name: 'Padur', total: 2 },
        { city: 'Chennai', property_type: 'apartment', listing_type: 'Sell', locality_name: 'Padur, Chennai', total: 2 },
        { city: 'Bangalore', property_type: 'villa', listing_type: 'Sell', locality_name: null, total: 1 },
      ];
      return [];
    });
    const entries = await new SeoEngineService({ query } as any).sitemapEntries('localities');
    const paths = entries.map((e: any) => e.path);
    expect(paths).toEqual(expect.arrayContaining(['/apartments-for-sale-in-medavakkam-chennai', '/apartments-for-sale-in-padur-chennai', '/villas-for-sale-in-bangalore']));
    expect(paths.filter((p: string) => p === '/apartments-for-sale-in-padur-chennai')).toHaveLength(1);
    const union = query.mock.calls.map(([sql]) => sql).find((sql) => sql.includes('UNION ALL'));
    expect(union).toContain('FROM projects p');
  });
});
