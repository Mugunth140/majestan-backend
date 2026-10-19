import { AdminSeoService } from './admin-seo.service';

describe('Legacy SEO saves must not change inventory', () => {
  it.each(['published', 'unpublished'])(
    'saving %s preserves a sold property',
    async (approvalStatus) => {
      const property = { id: 81, status: 'sold', slug: null };
      const seo = { propertyId: 81, seoData: {} };
      const saved: any[] = [];
      const manager = {
        save: jest.fn(async (value) => {
          saved.push(value);
          return value;
        }),
      };
      const db = {
        getRepository: jest.fn((entity: any) => ({
          findOne: jest.fn(async () =>
            entity.name === 'Property' ? property : seo,
          ),
        })),
        transaction: jest.fn(async (fn) => fn(manager)),
      };
      const service = new AdminSeoService(db as any, {} as any);
      await service.upsertPropertySeo(81, { approvalStatus } as any);
      expect(property.status).toBe('sold');
      expect(saved).toEqual([seo]);
      expect(manager.save).not.toHaveBeenCalledWith(property);
    },
  );
});
