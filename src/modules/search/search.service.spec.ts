jest.mock(
  'meilisearch',
  () => ({
    Meilisearch: jest.fn().mockImplementation(() => ({ index: jest.fn() })),
  }),
  { virtual: true },
);

import { SearchService } from './search.service';

function makeService() {
  const searchMock = jest.fn(async () => ({ hits: [], estimatedTotalHits: 0 }));
  const projectIndex = { search: searchMock };
  const propertyIndex = { search: jest.fn(async () => ({ hits: [], estimatedTotalHits: 0 })) };
  const client = { index: jest.fn((name: string) => (name === 'projects' ? projectIndex : propertyIndex)) };
  const config = { get: (key: string) => (key === 'meilisearch.host' ? 'http://meili.test' : 'test-key') };
  const repo: { findOne: jest.Mock; find: jest.Mock } = {
    findOne: jest.fn(async () => null),
    find: jest.fn(async () => []),
  };
  const dataSource = { getRepository: jest.fn(() => repo) };
  const service = new SearchService(config as any, dataSource as any);
  // Bypass lazy client init timing: force the known-good handles.
  (service as any).enabled = true;
  (service as any).client = client;
  (service as any).index = propertyIndex;
  (service as any).projectIndex = projectIndex;
  return { service, projectIndex, propertyIndex, repo, searchMock };
}

describe('SearchService project scope', () => {
  it('routes scope=projects to the projects index with a published gate', async () => {
    const { service, projectIndex, propertyIndex } = makeService();
    const res = await service.search('lakeview', {}, 1, 5, false, 'projects');
    expect(projectIndex.search).toHaveBeenCalledTimes(1);
    expect(propertyIndex.search).not.toHaveBeenCalled();
    const [q, opts] = (projectIndex.search as jest.Mock).mock.calls[0];
    expect(q).toBe('lakeview');
    expect(String(opts.filter)).toContain('status = published');
    expect(String(opts.filter)).toContain('status = booked');
    expect(res).toEqual(expect.objectContaining({ page: 1, limit: 5 }));
  });

  it('applies city and projectType filters on the projects scope', async () => {
    const { service, projectIndex } = makeService();
    await service.search('casa', { city: 'Coimbatore', propertyType: 'villa' }, 1, 5, false, 'projects');
    const [, opts] = (projectIndex.search as jest.Mock).mock.calls[0];
    expect(String(opts.filter)).toContain('projectType = "villa"');
    expect(String(opts.filter)).toContain('citySlug = "coimbatore"');
  });

  it('defaults to the properties index without a scope', async () => {
    const { service, projectIndex, propertyIndex } = makeService();
    await service.search('villa', {}, 1, 5);
    expect(propertyIndex.search).toHaveBeenCalledTimes(1);
    expect(projectIndex.search).not.toHaveBeenCalled();
  });

  it('removes non-published projects from the index on write', async () => {
    const { service, repo, projectIndex } = makeService();
    const deleteDocument: jest.Mock = jest.fn(async () => undefined);
    const addDocuments: jest.Mock = jest.fn(async () => ({}));
    (service as any).projectIndex = { search: jest.fn(), deleteDocument, addDocuments };
    repo.findOne.mockResolvedValueOnce({ id: 9, status: 'draft' });
    await service.indexProject(9);
    expect(deleteDocument).toHaveBeenCalledWith(9);
    expect(addDocuments).not.toHaveBeenCalled();
  });

  it.each(['published','booked'])('indexes %s projects with a canonical detail URL', async status => {
    const { service, repo } = makeService();
    const deleteDocument: jest.Mock = jest.fn(async () => undefined);
    const addDocuments: jest.Mock = jest.fn(async () => ({}));
    (service as any).projectIndex = { search: jest.fn(), deleteDocument, addDocuments };
    repo.findOne.mockResolvedValueOnce({
      id: 4,
      name: 'Lakeview Residences',
      builderName: null,
      projectCode: 'PA0004',
      slug: 'lakeview-residences-chennai',
      canonicalSlug: 'lakeview-residences-chennai-pa0004',
      projectType: 'apartment',
      city: 'Chennai',
      state: 'Tamil Nadu',
      sublocation: 'Sholinganallur',
      possessionStatus: 'ready_to_move',
      status,
      createdAt: new Date('2026-01-01'),
      units: Promise.resolve([{ price: '7500000' }]),
    });
    await service.indexProject(4);
    expect(addDocuments).toHaveBeenCalledTimes(1);
    const [docs] = addDocuments.mock.calls[0];
    expect(docs[0]).toMatchObject({
      id: 4,
      canonicalUrl: '/lakeview-residences-chennai-pa0004',
      minPriceNumeric: 7500000,
    });
  });
});
