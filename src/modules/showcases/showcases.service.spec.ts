jest.mock('bun', () => ({ S3Client: jest.fn(), S3File: jest.fn() }), {
  virtual: true,
});
import { BadRequestException } from '@nestjs/common';
import { ShowcasesService } from './showcases.service';
import { Property } from '../../database/entities/property.entity';
import { Project } from '../../database/entities/project.entity';
import { ShowcaseItem, ShowcaseSection } from '../../database/entities/showcase-item.entity';

const property = (id: number, over: Partial<Record<string, unknown>> = {}) => ({
  id,
  title: `Home ${id}`,
  slug: `home-${id}`,
  propertyType: 'apartment',
  status: 'available',
  approvalStatus: 'Approved',
  listingType: 'Sell',
  city: 'Coimbatore',
  price: '5000000',
  propertyCondition: null,
  propertyImages: Promise.resolve([]),
  propertyLocations: Promise.resolve([]),
  propertyDetails: Promise.resolve([]),
  ...over,
});

function setup(pickedIds: number[] = []) {
  const itemFind = jest.fn().mockResolvedValue(pickedIds.map((itemId, i) => ({ itemId, sortOrder: i })));
  const propertyRepo = { find: jest.fn(), count: jest.fn() };
  const projectRepo = { count: jest.fn(), createQueryBuilder: jest.fn() };
  const em = { delete: jest.fn(), insert: jest.fn() };
  const dataSource = {
    getRepository: jest.fn((entity) => (entity === Property ? propertyRepo : projectRepo)),
    transaction: jest.fn(async (fn) => fn(em)),
  };
  const service = new ShowcasesService(
    { find: itemFind } as any,
    dataSource as any,
    { generateReadUrl: (k: string) => `https://cdn/${k}` } as any,
  );
  return { service, itemFind, propertyRepo, projectRepo, em, dataSource };
}

describe('ShowcasesService', () => {
  it('falls back to approved, available apartments while Handpicked is uncurated', async () => {
    const { service, propertyRepo } = setup([]);
    propertyRepo.find.mockResolvedValue([property(1)]);

    const items = await service.handpickedProperties();

    expect(propertyRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { propertyType: 'apartment', status: 'available', approvalStatus: 'Approved' },
      }),
    );
    expect(items.map((i) => i.id)).toEqual([1]);
  });

  it('shows curated picks in CRM order and drops ones no longer live', async () => {
    const { service, propertyRepo } = setup([3, 1, 2]);
    propertyRepo.find.mockResolvedValue([
      property(1),
      property(2, { approvalStatus: 'Pending' }),
      property(3, { propertyType: 'plot', slug: 'land' }),
    ]);

    const items = await service.handpickedProperties();

    expect(items.map((i) => i.id)).toEqual([3, 1]);
    // Any property type maps, with the matching detail-route suffix.
    expect(items[0].detailPath).toBe('/land-p3');
  });

  it('replaces a section in the given order', async () => {
    const { service, propertyRepo, em } = setup([]);
    propertyRepo.count.mockResolvedValue(2);
    propertyRepo.find.mockResolvedValue([]);

    await service.replace(ShowcaseSection.HandpickedProperties, [7, 4]);

    expect(em.delete).toHaveBeenCalledWith(ShowcaseItem, { section: 'handpicked_properties' });
    expect(em.insert).toHaveBeenCalledWith(ShowcaseItem, [
      { section: 'handpicked_properties', itemId: 7, sortOrder: 0 },
      { section: 'handpicked_properties', itemId: 4, sortOrder: 1 },
    ]);
  });

  it('rejects duplicate picks and picks that do not exist', async () => {
    const { service, projectRepo } = setup([]);
    await expect(service.replace(ShowcaseSection.FeaturedProjects, [5, 5])).rejects.toThrow(BadRequestException);

    projectRepo.count.mockResolvedValue(1);
    await expect(service.replace(ShowcaseSection.FeaturedProjects, [5, 6])).rejects.toThrow(BadRequestException);
  });

  it('only accepts known section names', () => {
    expect(() => ShowcasesService.parseSection('villas')).toThrow(BadRequestException);
    expect(ShowcasesService.parseSection('featured_projects')).toBe(ShowcaseSection.FeaturedProjects);
  });

  it('falls back to published projects while Featured Projects is uncurated', async () => {
    const { service, projectRepo } = setup([]);
    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    projectRepo.createQueryBuilder.mockReturnValue(qb);

    await service.featuredProjects();

    expect(qb.where).toHaveBeenCalledWith('p.status = :status', { status: 'published' });
    expect(Project).toBeDefined();
  });
});
