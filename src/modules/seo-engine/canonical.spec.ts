jest.mock('../storage/storage.service', () => ({ StorageService: class {} }));
import { resolveCanonical } from './canonical';
import { normalizeSeoInput, validateSeoFields, sections } from './seo-fields';
const site = 'https://www.majestanrealty.com';
describe('canonical resolution', () => {
  it('cleans self paths and resolves parents', () => {
    expect(
      resolveCanonical('self', undefined, '/project/?x=1', undefined, site),
    ).toBe(site + '/project');
    expect(
      resolveCanonical(
        'parent',
        undefined,
        '/project/photos',
        '/project',
        site,
      ),
    ).toBe(site + '/project');
  });
  it('accepts safe custom URLs and rejects unsafe schemes', () => {
    expect(
      resolveCanonical(
        'custom',
        'https://example.com/home',
        '/home',
        undefined,
        site,
      ),
    ).toBe('https://example.com/home');
    expect(
      resolveCanonical(
        'custom',
        'javascript:alert(1)',
        '/home',
        undefined,
        site,
      ),
    ).toBe(site + '/home');
  });
  it('normalizes aliases and validates types', () => {
    expect(
      normalizeSeoInput({
        canonical_type: 'custom',
        custom_canonical_url: 'https://example.com/home',
      }).canonical_url,
    ).toBe('https://example.com/home');
    expect(
      sections({ photos: { canonical_type: 'parent' } }).photos.canonical_type,
    ).toBe('parent');
    expect(() =>
      validateSeoFields({ canonical_type: 'invalid' }, 'project'),
    ).toThrow();
  });
});

import { SeoEngineService } from './seo-engine.service';
it('excludes parent and custom canonical pages and inherits template section rules in sitemap', async () => {
  const db = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('FROM projects p'))
        return [
          { path: '/live', seo_type: 'apartment', canonical_type: 'self' },
          {
            path: '/duplicate',
            seo_type: 'apartment',
            canonical_type: 'custom',
            canonical_url: 'https://example.com/other',
          },
        ];
      if (sql.includes("scope='template'"))
        return [
          {
            config_key: 'template:project:apartment:buy',
            section_seo: {
              photos: { canonical_type: 'parent' },
              amenities: {
                canonical_type: 'custom',
                canonical_url: 'https://example.com/amenities',
              },
            },
          },
        ];
      if (sql.includes('SELECT public_path,section_seo')) return [];
      if (sql.includes('SELECT source_path')) return [];
      throw new Error(sql);
    }),
  };
  const service = new SeoEngineService(db as any);
  const paths = (await service.sitemapEntries('projects')).map(
    (row: any) => row.path,
  );
  expect(paths).toContain('/live');
  expect(paths).not.toContain('/duplicate');
  expect(paths).not.toContain('/live/photos');
  expect(paths).not.toContain('/live/amenities');
  expect(paths).toContain('/live/locality');
});

it('resolves legacy SEO image URLs to the same object on the active CDN', () => {
  const storage = {
    generateReadUrl: jest.fn((value: string) =>
      value.startsWith('http')
        ? value
        : 'https://cdn.majestanrealty.com/' + value,
    ),
  };
  const service = new SeoEngineService({} as any, storage as any);
  expect(
    (service as any).mediaReadUrl(
      'https://pub-44562b4995ca49a4bda808ad32940003.r2.dev/uploads/photo.jpg',
    ),
  ).toBe('https://cdn.majestanrealty.com/uploads/photo.jpg');
  expect(storage.generateReadUrl).toHaveBeenCalledWith('uploads/photo.jpg');
  expect((service as any).mediaReadUrl('https://other.example/photo.jpg')).toBe(
    'https://other.example/photo.jpg',
  );
});
