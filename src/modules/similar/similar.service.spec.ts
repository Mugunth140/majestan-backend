jest.mock('bun', () => ({ S3Client: jest.fn(), S3File: jest.fn() }), { virtual: true });
import { SimilarService } from './similar.service';

const base = {
  id: 1,
  city: 'Coimbatore',
  listingType: 'Rent',
  propertyType: 'apartment',
  propertyLocations: Promise.resolve([]),
  propertyDetails: Promise.resolve([]),
  propertyImages: Promise.resolve([]),
};

function setup(over: Record<string, unknown> = {}) {
  const find = jest.fn().mockResolvedValue([]);
  const repo = { findOne: jest.fn().mockResolvedValue({ ...base, ...over }), find };
  const service = new SimilarService(
    { getRepository: () => repo } as any,
    { generateReadUrl: (k: string) => k } as any,
  );
  return { service, find };
}

describe('SimilarService properties', () => {
  it('only looks at the same city and the same Buy/Rent', async () => {
    const { service, find } = setup();
    await service.similarProperties(1);
    expect(find).toHaveBeenCalled();
    for (const [args] of find.mock.calls) {
      expect(args.where).toMatchObject({ city: 'Coimbatore', listingType: 'Rent', status: 'available', approvalStatus: 'Approved' });
    }
  });

  it('shows nothing when the listing has no city', async () => {
    const { service, find } = setup({ city: '' });
    await expect(service.similarProperties(1)).resolves.toEqual([]);
    expect(find).not.toHaveBeenCalled();
  });
});
