jest.mock('bun', () => ({ S3Client: jest.fn(), S3File: jest.fn() }), {
  virtual: true,
});
import { HomeService } from './home.service';
import { Property } from '../../database/entities/property.entity';

describe('homepage property approval gate', () => {
  it('requires staff approval for both apartment and villa featured queries', async () => {
    const find = jest.fn().mockResolvedValue([]);
    const getRepository = jest.fn().mockReturnValue({ find });
    const service = new HomeService({ getRepository } as any, {} as any);
    await (service as any).listFeaturedProperties('apartment');
    await (service as any).listFeaturedProperties('villa');
    expect(getRepository).toHaveBeenCalledWith(Property);
    expect(find).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          propertyType: 'apartment',
          status: 'available',
          approvalStatus: 'Approved',
        },
      }),
    );
    expect(find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          propertyType: 'villa',
          status: 'available',
          approvalStatus: 'Approved',
        },
      }),
    );
  });
});
