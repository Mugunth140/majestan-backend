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
    expect(sql).toContain("LOWER(p.sublocation) IN (LOWER(?), LOWER(CONCAT(?, ', ', p.city)))");
    expect(args).toEqual(['Chennai', 'Medavakkam', 'Medavakkam', 'apartment']);
  });
});
