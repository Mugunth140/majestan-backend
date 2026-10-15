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

import { Project } from '../../../database/entities/project.entity';
import { ProjectUnit } from '../../../database/entities/project-unit.entity';
import { AdminProjectsService } from './admin-projects.service';

function makeService() {
  const manager = {
    find: jest.fn(async () => [] as any[]),
    create: jest.fn((_: any, v: any) => v),
    // EntityManager signature: save(target, entity) / save(entity)
    save: jest.fn(async (...args: any[]) => {
      const v = args.length > 1 ? args[1] : args[0];
      return Array.isArray(v) ? v : { id: 11, ...v };
    }),
    findOne: jest.fn(async (entity: any) => entity === Project ? { id: 11, revision: 1, projectCode: 'AP011' } : null),
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
    deleteFiles: jest.fn(async () => undefined),
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

describe('named floors within project unit configurations', () => {
  it('keeps the legacy single-image contract for plot layouts', async () => {
    const { service, manager } = makeService();
    await service.create({ name: 'Plot layout', projectType: 'plot', units: [{ unitCode: 'P1', floorPlanImageKey: 'uploads/properties/plot.webp' }] } as any);
    expect(manager.create).toHaveBeenCalledWith(ProjectUnit, expect.objectContaining({ floorPlans: null, floorPlanImageKey: 'uploads/properties/plot.webp', floorPlanImageUrl: 'uploads/properties/plot.webp' }));
  });
  it('persists separate floor plans per configuration and cleans staged images only after commit', async () => {
    const { service, manager, storage, queryRunner } = makeService();
    await service.create({ name: 'Nested plans', projectType: 'apartment', units: [
      { unitCode: '2BHK-1200', floorPlans: [{ floorName: 'Ground floor', imageKey: 'uploads/temp/1200-g.png' }, { floorName: 'First floor', imageKey: 'uploads/temp/1200-f.png' }] },
      { unitCode: '2BHK-1400', floorPlans: [{ floorName: 'Ground floor', imageKey: 'uploads/temp/1400-g.png' }] },
    ] } as any);
    const rows = manager.create.mock.calls.filter(([entity]) => entity === ProjectUnit).map(([, row]) => row as any);
    expect(rows[0].floorPlans.map((p: any) => p.imageKey)).toEqual(['uploads/properties/1200-g.webp', 'uploads/properties/1200-f.webp']);
    expect(rows[1].floorPlans[0].imageKey).toBe('uploads/properties/1400-g.webp');
    expect(storage.processAndUploadImage).toHaveBeenCalledWith('uploads/temp/1200-g.png', true);
    expect(storage.deleteFiles.mock.invocationCallOrder[0]).toBeGreaterThan(queryRunner.commitTransaction.mock.invocationCallOrder[0]);
  });
  it('keeps named floors when an older client omits them, while an explicit list can clear them', async () => {
    const { service, manager } = makeService();
    manager.find.mockResolvedValue([{ unitCode: 'A', floorPlans: [{ floorName: 'Ground floor', imageKey: 'uploads/properties/g.webp' }] }]);
    await service.update(11, { expectedRevision: 1, units: [{ unitCode: 'A' }] } as any);
    expect(manager.create).toHaveBeenCalledWith(ProjectUnit, expect.objectContaining({ floorPlans: [{ floorName: 'Ground floor', imageKey: 'uploads/properties/g.webp', imageUrl: 'uploads/properties/g.webp' }] }));
    manager.create.mockClear();
    await service.update(11, { expectedRevision: 1, units: [{ unitCode: 'A', floorPlans: [], floorPlanImageKey: 'old.webp' }] } as any);
    expect(manager.create).toHaveBeenCalledWith(ProjectUnit, expect.objectContaining({ floorPlans: [], floorPlanImageKey: null, floorPlanImageUrl: null }));
  });
  it('retains staged originals after a failed save so the draft can retry', async () => {
    const { service, manager, storage } = makeService();
    manager.save.mockImplementation(async (...args: any[]) => {
      if (args[0] === ProjectUnit) throw new Error('Database write failed');
      return { id: 11, ...args[1] };
    });
    await expect(service.create({ name: 'Retry', projectType: 'apartment', units: [{ unitCode: 'A', floorPlans: [{ floorName: 'Ground floor', imageKey: 'uploads/temp/g.png' }] }] } as any)).rejects.toThrow('Database write failed');
    expect(storage.processAndUploadImage).toHaveBeenCalledWith('uploads/temp/g.png', true);
    expect(storage.deleteFiles).not.toHaveBeenCalled();
  });
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

describe('project concurrency protection', () => {
  it('rejects a stale unit snapshot before deleting units or finalizing media', async () => {
    const { service, manager, queryRunner, storage } = makeService();
    manager.findOne.mockResolvedValue({ id: 11, revision: 2 } as any);
    await expect(service.update(11, { expectedRevision: 1, units: [], galleryImageUrls: ['uploads/temp/new.png'] } as any)).rejects.toThrow('updated by another staff member');
    expect(manager.findOne).toHaveBeenCalledWith(Project, expect.objectContaining({ where: { id: 11 }, lock: { mode: 'pessimistic_write' } }));
    expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
    expect(storage.processAndUploadImage).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });
  it('rejects legacy clients that replace units without a revision', async () => {
    const { service, manager } = makeService();
    await expect(service.update(11, { units: [] } as any)).rejects.toThrow('updated by another staff member');
    expect(manager.delete).not.toHaveBeenCalled();
  });
  it('allows a matching revision and never persists the client precondition as a project field', async () => {
    const { service, manager, queryRunner } = makeService();
    await service.update(11, { expectedRevision: 1, name: 'Reviewed project', units: [] } as any);
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    const fields = manager.update.mock.calls[0][2];
    expect(fields).not.toHaveProperty('expectedRevision');
    expect(fields).not.toHaveProperty('revision');
    expect(fields).not.toHaveProperty('changedFields');
  });
  it('merges a stale save that touches only fields nobody else changed', async () => {
    const { service, manager, queryRunner } = makeService();
    manager.findOne.mockResolvedValue({ id: 11, revision: 3, fieldRevisions: { name: 3 } } as any);
    await service.update(11, { expectedRevision: 2, changedFields: ['description'], description: 'New copy', projectType: 'apartment' } as any);
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    const fields = (manager.update.mock.calls as any[])[0][2];
    expect(fields.fieldRevisions).toEqual({ name: 3, description: 4 });
  });
  it('refuses a stale save to a field someone else changed', async () => {
    const { service, manager } = makeService();
    manager.findOne.mockResolvedValue({ id: 11, revision: 3, fieldRevisions: { name: 3 } } as any);
    await expect(service.update(11, { expectedRevision: 2, changedFields: ['name'], name: 'Mine' } as any)).rejects.toThrow('Someone else changed name');
    expect(manager.update).not.toHaveBeenCalled();
  });
  it('rewrites only the units a save touched', async () => {
    const { service, manager } = makeService();
    manager.findOne.mockResolvedValue({ id: 11, revision: 3, fieldRevisions: { 'unit:A-1': 3 } } as any);
    await service.update(11, {
      expectedRevision: 2, changedFields: ['units'], changedUnitCodes: ['B-1'],
      units: [{ unitCode: 'A-1' }, { unitCode: 'B-1' }],
    } as any);
    const deleteCall = (manager.delete.mock.calls as any[]).find((call) => call[0] === ProjectUnit);
    expect(deleteCall[1].unitCode).toBeDefined();
  });
});
