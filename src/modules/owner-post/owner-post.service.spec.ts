jest.mock('bun', () => ({ S3Client: jest.fn(), S3File: jest.fn() }), {
  virtual: true,
});
jest.mock('meilisearch', () => ({ Meilisearch: jest.fn() }), { virtual: true });
import { OwnerPostService } from './owner-post.service';
import { assertOwnerMediaKey, ownerPayload } from './owner-post-policy';
import { SubmitOwnerPropertyDto } from './dto/submit-owner-property.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

const dto = (overrides: Record<string, unknown> = {}): SubmitOwnerPropertyDto =>
  ({
    title: 'My plot',
    description: 'A plot near the main road',
    price: '500000',
    listingType: 'Sell',
    cityId: 1,
    sublocationId: 2,
    location: { address: 'Example street' },
    details: { areaSqft: 1200 },
    ...overrides,
  }) as SubmitOwnerPropertyDto;
function make() {
  const drafts = new Map<string, any>();
  const draftRepository = {
    findOne: jest.fn(
      async ({ where: { phone } }: any) => drafts.get(phone) ?? null,
    ),
    upsert: jest.fn(async (v: any) => {
      drafts.set(v.phone, v);
    }),
    delete: jest.fn(async ({ phone }: any) => {
      drafts.delete(phone);
      return { affected: 1 };
    }),
  };
  const userRepository = {
    findOne: jest.fn(async () => ({
      id: 11,
      phone: '+919876543210',
      name: 'Verified owner',
      email: 'owner@example.test',
      isVerified: true,
      role: 'user',
    })),
  };
  const adminPropertiesService = {
    create: jest.fn(async (_type: string, payload: any) => ({
      id: 99,
      propertyCode: 'P099',
      ...payload,
    })),
  };
  return {
    service: new OwnerPostService(
      draftRepository as any,
      userRepository as any,
      adminPropertiesService as any,
    ),
    drafts,
    draftRepository,
    userRepository,
    adminPropertiesService,
  };
}
describe('owner property intake', () => {
  it('saves and resumes an account draft with atomic upsert', async () => {
    const { service, draftRepository } = make();
    expect(await service.getDraft(11)).toBeNull();
    await service.saveDraft(11, { title: 'My plot' });
    expect(await service.getDraft(11)).toEqual({ title: 'My plot' });
    expect(draftRepository.upsert).toHaveBeenCalled();
  });
  it('forces review state and trusted account identity instead of client flags', async () => {
    const { service, drafts, adminPropertiesService } = make();
    await service.saveDraft(11, { title: 'My plot' });
    expect(
      await service.submit(
        11,
        'plot',
        dto({
          status: 'sold',
          approvalStatus: 'Approved',
          ownerPhone: '+919111111111',
          source: 'staff',
        }),
      ),
    ).toEqual({ id: 99, propertyCode: 'P099', approvalStatus: 'Pending' });
    expect(adminPropertiesService.create).toHaveBeenCalledWith(
      'plot',
      expect.objectContaining({
        status: 'available',
        verificationStatus: 'Pending',
        approvalStatus: 'Pending',
        source: 'owner-post',
        ownerId: 11,
        ownerPhone: '+919876543210',
        ownerName: 'Verified owner',
      }),
    );
    expect(drafts.size).toBe(0);
  });
  it('persists owner floor plans as public floor_plan documents after checking ownership', async () => {
    const { service, adminPropertiesService } = make();
    const plan = {
      fileKey:
        'uploads/temp/123-owner-11-12345678-1234-1234-1234-123456789abc-plan.pdf',
      fileName: 'plan.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 1000,
    };
    await service.submit(11, 'plot', dto({ floorPlans: [plan] }));
    expect(adminPropertiesService.create).toHaveBeenCalledWith(
      'plot',
      expect.objectContaining({
        documents: [
          expect.objectContaining({
            ...plan,
            documentType: 'floor_plan',
            isPublic: true,
          }),
        ],
      }),
    );
    await expect(
      service.submit(
        11,
        'plot',
        dto({
          floorPlans: [
            { ...plan, fileKey: plan.fileKey.replace('owner-11', 'owner-12') },
          ],
        }),
      ),
    ).rejects.toThrow('own account');
  });
  it('does not clear the draft when property creation fails', async () => {
    const { service, drafts, adminPropertiesService } = make();
    await service.saveDraft(11, { title: 'My plot' });
    adminPropertiesService.create.mockRejectedValue(
      new Error('DB unavailable'),
    );
    await expect(service.submit(11, 'plot', dto())).rejects.toThrow(
      'DB unavailable',
    );
    expect(drafts.size).toBe(1);
  });
  it('returns success if draft cleanup fails after the property is created', async () => {
    const { service, draftRepository } = make();
    draftRepository.delete.mockRejectedValue(new Error('draft cleanup failed'));
    await expect(service.submit(11, 'plot', dto())).resolves.toHaveProperty(
      'id',
      99,
    );
  });
  it('rejects unverified users and media belonging to another owner', async () => {
    const { service, userRepository, adminPropertiesService } = make();
    userRepository.findOne.mockResolvedValue({
      id: 11,
      phone: '+919876543210',
      isVerified: false,
      role: 'user',
    } as any);
    await expect(service.submit(11, 'plot', dto())).rejects.toThrow(
      'Verify your phone',
    );
    userRepository.findOne.mockResolvedValue({
      id: 11,
      phone: '+919876543210',
      isVerified: true,
      role: 'user',
    } as any);
    await expect(
      service.submit(
        11,
        'plot',
        dto({
          files: [
            {
              fileKey:
                'uploads/temp/123-owner-12-12345678-1234-1234-1234-123456789abc-photo.jpg',
            },
          ],
        }),
      ),
    ).rejects.toThrow('own account');
    expect(adminPropertiesService.create).not.toHaveBeenCalled();
  });
  it('prunes hidden category and purpose fields on the server too', () => {
    const payload = ownerPayload(
      'plot',
      dto({
        listingType: 'Rent',
        bookingAmount: '10000',
        ownershipType: 'Freehold',
        details: {
          areaSqft: 1000,
          bedrooms: 3,
          floorNumber: '2',
          plotLength: 40,
          furnished: true,
        },
        furnishingItems: [{ furnishingItemId: 1 }],
      }),
    );
    expect(payload.details).toEqual({
      areaSqft: 1000,
      plotLength: 40,
      furnished: undefined,
    });
    expect(payload.bookingAmount).toBeUndefined();
    expect(payload.ownershipType).toBeUndefined();
    expect(payload.furnishingItems).toEqual([]);
  });
  it('validates category policy, numbers, address, areas and dates before creation', () => {
    expect(() => ownerPayload('unknown', dto())).toThrow('supported');
    expect(() =>
      ownerPayload('farmland', dto({ listingType: 'Rent' })),
    ).toThrow('sale');
    expect(() => ownerPayload('plot', dto({ price: '-1' }))).toThrow('price');
    expect(() =>
      ownerPayload('plot', dto({ location: { address: ' ' } })),
    ).toThrow('address');
    expect(() =>
      ownerPayload(
        'apartment',
        dto({
          details: {
            areaSqft: 100,
            bedrooms: 2,
            bathrooms: 1,
            carpetArea: 200,
          },
        }),
      ),
    ).toThrow('Carpet');
    expect(() =>
      ownerPayload(
        'plot',
        dto({ listingType: 'Rent', availableFrom: '2026-02-30' }),
      ),
    ).toThrow('date');
    expect(() =>
      assertOwnerMediaKey('https://example.test/file.jpg', 11),
    ).toThrow('own account');
  });
  it('accepts selected land units at HTTP validation and keeps canonical area for persistence', async () => {
    const payload = dto({
      details: {
        areaSqft: 87120,
        plotArea: 2,
        areaUnit: 'Acres',
        plotSizeCents: 200,
      },
    });
    expect(
      await validate(plainToInstance(SubmitOwnerPropertyDto, payload), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    ).toEqual([]);
    expect(ownerPayload('farmland', payload).details).toMatchObject({
      areaSqft: 87120,
      plotArea: 2,
      areaUnit: 'Acres',
      plotSizeCents: 200,
    });
    expect(() =>
      ownerPayload(
        'plot',
        dto({ details: { areaSqft: 1000, areaUnit: 'Unknown' } }),
      ),
    ).toThrow('land area unit');
  });
  it('rejects staff controls, unknown nested fields and invalid photo arrays at HTTP validation', async () => {
    const instance = plainToInstance(
      SubmitOwnerPropertyDto,
      dto({
        approvalStatus: 'Approved',
        details: { areaSqft: 1000, id: 123 },
        files: [{ fileKey: 'https://example.test/photo.jpg' }],
      }),
    );
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((e) => e.property)).toEqual(
      expect.arrayContaining(['approvalStatus', 'details', 'files']),
    );
    expect(
      await validate(plainToInstance(SubmitOwnerPropertyDto, dto()), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    ).toEqual([]);
  });
  it('caps floor plans at five and accepts only supported floor-plan MIME types', async () => {
    const plan = {
      fileKey: 'uploads/temp/plan.pdf',
      mimeType: 'application/pdf',
    };
    const tooMany = plainToInstance(
      SubmitOwnerPropertyDto,
      dto({
        floorPlans: Array.from({ length: 6 }, (_, i) => ({
          ...plan,
          fileKey: `${plan.fileKey}-${i}`,
        })),
      }),
    );
    const errors = await validate(tooMany, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((e) => e.property)).toContain('floorPlans');
    const badType = plainToInstance(
      SubmitOwnerPropertyDto,
      dto({ floorPlans: [{ ...plan, mimeType: 'text/html' }] }),
    );
    expect(
      (
        await validate(badType, { whitelist: true, forbidNonWhitelisted: true })
      ).map((e) => e.property),
    ).toContain('floorPlans');
  });
});
