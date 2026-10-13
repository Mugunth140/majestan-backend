jest.mock(
  'bun',
  () => ({
    S3Client: jest.fn().mockImplementation(() => ({
      presign: jest.fn(),
      write: jest.fn(),
      delete: jest.fn(),
    })),
    S3File: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  'meilisearch',
  () => ({
    Meilisearch: jest.fn().mockImplementation(() => ({ index: jest.fn() })),
  }),
  { virtual: true },
);

import { AdminProjectsService } from './admin-projects.service';

function makeService() {
  const manager = {
    create: jest.fn((_: any, v: any) => v),
    // EntityManager signature: save(target, entity) / save(entity)
    save: jest.fn(async (...args: any[]) => {
      const v = args.length > 1 ? args[1] : args[0];
      return Array.isArray(v) ? v : { id: 11, ...v };
    }),
    findOne: jest.fn(async () => null),
    // EntityManager signature: update(target, criteria, partial)
    update: jest.fn(async () => ({})),
    delete: jest.fn(async () => ({})),
  };
  const queryRunner = {
    connect: jest.fn(async () => undefined),
    startTransaction: jest.fn(async () => undefined),
    commitTransaction: jest.fn(async () => undefined),
    rollbackTransaction: jest.fn(async () => undefined),
    release: jest.fn(async () => undefined),
    manager,
  };
  const dataSource = { createQueryRunner: jest.fn(() => queryRunner) };
  const projectRepository = {
    // findOrFail stub: lazy relations resolve to empty
    findOne: jest.fn(async () => ({
      id: 11,
      units: Promise.resolve([]),
      projectAmenities: Promise.resolve([]),
      projectFaqs: Promise.resolve([]),
    })),
    update: jest.fn(async () => ({})),
    delete: jest.fn(async () => ({})),
    createQueryBuilder: jest.fn(),
  };
  const storage = {
    generateReadUrl: jest.fn((k: string) => `https://cdn.example/${k}`),
    processAndUploadImage: jest.fn(async (k: string) =>
      k.replace('uploads/temp/', 'uploads/properties/').replace(/\.[^/.]+$/, '.webp'),
    ),
    processCoverImage: jest.fn(async (k: string, slot: string) =>
      k.replace('uploads/temp/', `uploads/covers/${slot}-`).replace(/\.[^/.]+$/, '.webp'),
    ),
    deleteFile: jest.fn(async () => undefined),
  };
  const service = new AdminProjectsService(
    projectRepository as any,
    {} as any,
    {} as any,
    dataSource as any,
    storage as any,
    { indexProject: jest.fn(async () => undefined), deleteProject: jest.fn(async () => undefined) } as any,
  );
  return { service, manager, queryRunner, projectRepository, storage };
}

const validCreate = () => ({
  name: 'Sunrise Heights',
  projectType: 'apartment',
  coverImageUrl: 'uploads/temp/cover.png',
  mobileCoverImageUrl: 'uploads/temp/m-cover.png',
  galleryImageUrls: ['uploads/temp/g1.png', 'uploads/temp/g2.jpg'],
});

describe('AdminProjectsService gallery finalize', () => {
  it('routes gallery temp keys through the watermarked pipeline on create', async () => {
    const { service, manager, storage } = makeService();
    await service.create(validCreate() as any);
    expect(storage.processAndUploadImage).toHaveBeenCalledWith('uploads/temp/g1.png');
    expect(storage.processAndUploadImage).toHaveBeenCalledWith('uploads/temp/g2.jpg');
    expect(manager.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        galleryImageUrls: ['uploads/properties/g1.webp', 'uploads/properties/g2.webp'],
      }),
    );
  });

  it('keeps covers on the clean (non-watermarked) cover pipeline on create', async () => {
    const { service, storage } = makeService();
    await service.create(validCreate() as any);
    expect(storage.processCoverImage).toHaveBeenCalledWith('uploads/temp/cover.png', 'desktop');
    expect(storage.processCoverImage).toHaveBeenCalledWith('uploads/temp/m-cover.png', 'mobile');
    // Covers must NOT go through the watermarked property pipeline
    expect(storage.processAndUploadImage).not.toHaveBeenCalledWith('uploads/temp/cover.png');
  });

  it('omits galleryImageUrls on create when not supplied', async () => {
    const { service, manager, storage } = makeService();
    const { galleryImageUrls: _omit, ...payload } = validCreate();
    await service.create(payload as any);
    expect(storage.processAndUploadImage).not.toHaveBeenCalled();
    expect(manager.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.not.objectContaining({ galleryImageUrls: expect.anything() }),
    );
  });

  it('finalizes gallery on update and leaves it untouched when omitted', async () => {
    const { service, manager, storage } = makeService();
    await service.update(11, { galleryImageUrls: ['uploads/temp/g3.png'] } as any);
    expect(storage.processAndUploadImage).toHaveBeenCalledWith('uploads/temp/g3.png');
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), 
      11,
      expect.objectContaining({ galleryImageUrls: ['uploads/properties/g3.webp'] }),
    );

    storage.processAndUploadImage.mockClear();
    manager.update.mockClear();
    await service.update(11, { name: 'Renamed' } as any);
    expect(storage.processAndUploadImage).not.toHaveBeenCalled();
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), 11, expect.objectContaining({ galleryImageUrls: undefined }));
  });

  it('passes already-finalized gallery keys through unchanged', async () => {
    const { service, manager, storage } = makeService();
    await service.update(11, { galleryImageUrls: ['uploads/properties/old.webp'] } as any);
    expect(storage.processAndUploadImage).toHaveBeenCalledWith('uploads/properties/old.webp');
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), 
      11,
      expect.objectContaining({ galleryImageUrls: ['uploads/properties/old.webp'] }),
    );
  });
});
