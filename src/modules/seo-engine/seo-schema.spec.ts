jest.mock('../storage/storage.service', () => ({ StorageService: class {} }));

import { SeoEngineService } from './seo-engine.service';

describe('page-specific structured data', () => {
  const service = new SeoEngineService({} as any);
  const root = {
    path: '/example-pa1', source_path: '/example-pa1', h1: 'Example',
    robots_index: true, robots_follow: true,
    schema_overrides: { '@type': 'Service', name: 'Overview only' },
    section_seo: {
      photos: { schema_overrides: { '@graph': [
        { '@type': 'WebPage', description: 'Custom photos description' },
        { '@type': 'ImageGallery', name: 'Gallery only' },
      ] } },
      amenities: {},
    },
  };
  it('merges custom child nodes into generated schema and exposes saved schema for clients', () => {
    const child = (service as any).resolveSection(root, 'photos');
    expect(child.schema_overrides).toEqual(root.section_seo.photos.schema_overrides);
    expect(child.custom_schema_json).toEqual(child.schema_overrides);
    expect(child.json_ld['@graph']).toEqual(expect.arrayContaining([
      expect.objectContaining({ '@type': 'WebPage', url: 'https://www.majestanrealty.com/example-pa1/photos', description: 'Custom photos description' }),
      expect.objectContaining({ '@type': 'BreadcrumbList' }),
      expect.objectContaining({ '@type': 'ImageGallery', name: 'Gallery only' }),
    ]));
    expect(JSON.stringify(child.json_ld)).not.toContain('Overview only');
  });
  it('does not inherit overview or sibling overrides on another child', () => {
    const child = (service as any).resolveSection(root, 'amenities');
    expect(child.schema_overrides).toEqual({});
    expect(JSON.stringify(child.json_ld)).not.toContain('Gallery only');
    expect(JSON.stringify(child.json_ld)).not.toContain('Overview only');
  });
});
