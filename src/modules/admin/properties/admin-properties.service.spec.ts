jest.mock('bun', () => ({ S3Client: jest.fn(), S3File: jest.fn() }), {
  virtual: true,
});
jest.mock('meilisearch', () => ({ Meilisearch: jest.fn() }), { virtual: true });

import { AdminPropertiesService } from './admin-properties.service';

describe('AdminPropertiesService document storage', () => {
  it('promotes submitted temp documents once and leaves permanent documents untouched', async () => {
    const storageService = {
      moveFile: jest.fn(async (key: string) =>
        key.replace('/temp/', '/properties/'),
      ),
    };
    const saved: any[] = [];
    const manager = {
      save: jest.fn(async (entity: any) => {
        entity.id = saved.length + 1;
        saved.push(entity);
        return entity;
      }),
    };

    const deferredDeleteKeys: string[] = [];
    await (AdminPropertiesService.prototype as any).saveDocuments.call(
      { storageService },
      manager,
      44,
      [
        {
          fileKey: 'uploads/temp/owner-plan.pdf',
          fileName: 'owner-plan.pdf',
          mimeType: 'application/pdf',
          documentType: 'floor_plan',
        },
        {
          fileKey: 'uploads/properties/old-brochure.pdf',
          fileName: 'old-brochure.pdf',
          mimeType: 'application/pdf',
          documentType: 'brochure',
        },
      ],
      deferredDeleteKeys,
    );

    expect(storageService.moveFile).toHaveBeenCalledTimes(1);
    expect(storageService.moveFile).toHaveBeenCalledWith(
      'uploads/temp/owner-plan.pdf',
      'application/pdf',
      true,
    );
    expect(deferredDeleteKeys).toEqual(['uploads/temp/owner-plan.pdf']);
    expect(
      saved.filter((entity) => 'fileKey' in entity).map((file) => file.fileKey),
    ).toEqual([
      'uploads/properties/owner-plan.pdf',
      'uploads/properties/old-brochure.pdf',
    ]);
  });
});

describe('AdminPropertiesService property details', () => {
  it('returns saved furnishing selections and their master item names for CRM editing', async () => {
    const furnishingItem = { id: 12, name: 'Wardrobe', icon: 'wardrobe' };
    const record = {
      id: 44,
      propertyType: 'apartment',
      propertyDetails: Promise.resolve(null),
      propertyLocations: Promise.resolve([]),
      propertyAmenities: Promise.resolve([]),
      propertyFurnishings: Promise.resolve([
        {
          propertyId: 44,
          furnishingItemId: furnishingItem.id,
          furnishingItem: Promise.resolve(furnishingItem),
        },
      ]),
      propertyUnits: Promise.resolve([]),
      propertyFiles: Promise.resolve([]),
      propertyImages: Promise.resolve([]),
      faqs: Promise.resolve([]),
    };
    const findOne = jest.fn().mockResolvedValue(record);
    const service = {
      dataSource: { getRepository: jest.fn(() => ({ findOne })) },
      storageService: {
        resolveImageUrls: jest.fn((images) => images),
        generateReadUrl: jest.fn((url) => url),
      },
    };

    const result = await AdminPropertiesService.prototype.details.call(
      service,
      'apartment',
      44,
    );

    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: expect.arrayContaining([
          'propertyFurnishings',
          'propertyFurnishings.furnishingItem',
        ]),
      }),
    );
    expect(result.propertyFurnishings).toEqual([
      expect.objectContaining({
        furnishingItemId: furnishingItem.id,
        furnishingItem,
      }),
    ]);
  });
});
