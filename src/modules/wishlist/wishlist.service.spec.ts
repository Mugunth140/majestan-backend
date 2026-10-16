jest.mock('bun', () => ({ S3Client: jest.fn(), S3File: jest.fn() }), {
  virtual: true,
});
import { NotFoundException } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { Property } from '../../database/entities/property.entity';
import { SavedListing } from '../../database/entities/saved-listing.entity';

function setup() {
  const execute = jest.fn().mockResolvedValue({});
  const insertValues = jest
    .fn()
    .mockReturnValue({ orIgnore: () => ({ execute }) });
  const saved = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    delete: jest.fn().mockResolvedValue({}),
    createQueryBuilder: jest.fn(() => ({
      insert: () => ({ values: insertValues }),
    })),
  };
  const propertyRepo = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
  };
  const projectRepo = { exist: jest.fn(), createQueryBuilder: jest.fn() };
  const dataSource = {
    getRepository: jest.fn((entity) =>
      entity === SavedListing
        ? saved
        : entity === Property
          ? propertyRepo
          : projectRepo,
    ),
  };
  const service = new WishlistService(
    dataSource as any,
    { generateReadUrl: (k: string) => k } as any,
  );
  return { service, saved, propertyRepo, projectRepo, insertValues };
}

const payload = (propertyType: string, propertyId = 15) => ({
  guestId: 'user-5',
  propertyId,
  propertyType,
});

describe('WishlistService.toggle', () => {
  it('saves a live property under its own DB type', async () => {
    const { service, propertyRepo, saved, insertValues } = setup();
    propertyRepo.findOne.mockResolvedValue({
      id: 15,
      propertyType: 'apartment',
    });
    saved.count.mockResolvedValue(1);

    await expect(service.toggle(payload('apartment'))).resolves.toEqual({
      wished: true,
      total: 1,
    });
    expect(insertValues).toHaveBeenCalledWith({
      ownerKey: 'user-5',
      listingKind: 'property',
      listingId: 15,
      listingType: 'apartment',
    });
  });

  it('saves a published project as "project", whatever the casing sent', async () => {
    const { service, projectRepo, insertValues } = setup();
    projectRepo.exist.mockResolvedValue(true);

    await service.toggle(payload('Project', 4));
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        listingKind: 'project',
        listingId: 4,
        listingType: 'project',
      }),
    );
  });

  it('refuses a listing that is not live', async () => {
    const { service, propertyRepo } = setup();
    propertyRepo.findOne.mockResolvedValue(null);
    await expect(service.toggle(payload('apartment'))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('removes an existing save without checking the listing is still live', async () => {
    const { service, saved, propertyRepo } = setup();
    saved.findOne.mockResolvedValue({ id: 7 });

    await expect(service.toggle(payload('apartment'))).resolves.toEqual({
      wished: false,
      total: 0,
    });
    expect(saved.delete).toHaveBeenCalledWith({ id: 7 });
    expect(propertyRepo.findOne).not.toHaveBeenCalled();
  });
});

describe('WishlistService.list', () => {
  it('keeps saves whose listing went offline, with no card, so they can be removed', async () => {
    const { service, saved } = setup();
    saved.find.mockResolvedValue([
      { id: 3, listingKind: 'property', listingId: 15, listingType: 'villa' },
    ]);

    await expect(service.list({ guestId: 'user-5' })).resolves.toEqual({
      items: [
        {
          id: 3,
          propertyId: 15,
          propertyType: 'villa',
          legacyPropertyType: 'villa',
          property: null,
        },
      ],
      total: 1,
    });
  });
});
