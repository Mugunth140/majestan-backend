import { AdminFurnishingItemsService } from './admin-furnishing-items.service';

describe('AdminFurnishingItemsService', () => {
  function make() {
    const adminTableService = {
      listRows: jest.fn(async () => ({ items: [] })),
      getRowById: jest.fn(async () => ({ id: 1 })),
      createRow: jest.fn(async (_t: string, data: unknown) => ({ id: 9, ...(data as object) })),
      updateRow: jest.fn(async (_t: string, id: number) => ({ id })),
      updateStatus: jest.fn(async (_t: string, id: number) => ({ id })),
    };
    const dataSource = { query: jest.fn(async () => []) };
    const service = new AdminFurnishingItemsService(adminTableService as any, dataSource as any);
    return { service, adminTableService, dataSource };
  }

  it('lists furnishing items by name search', async () => {
    const { service, adminTableService } = make();
    await service.list({ search: 'sofa' } as any);
    expect(adminTableService.listRows).toHaveBeenCalledWith(
      'furnishing_items',
      expect.objectContaining({ search: 'sofa' }),
      ['name'],
    );
  });

  it('generates the slug from the name on create', async () => {
    const { service, adminTableService } = make();
    await service.create({ data: { name: 'King Size Bed', icon: 'BedDouble' } } as any);
    expect(adminTableService.createRow).toHaveBeenCalledWith(
      'furnishing_items',
      expect.objectContaining({ name: 'King Size Bed', slug: 'king-size-bed', icon: 'BedDouble' }),
    );
  });

  it('regenerates the slug when renaming', async () => {
    const { service, adminTableService } = make();
    await service.update(4, { data: { name: 'Smart TV' } } as any);
    expect(adminTableService.updateRow).toHaveBeenCalledWith(
      'furnishing_items',
      4,
      expect.objectContaining({ slug: 'smart-tv' }),
    );
  });

  it('hard-deletes by id', async () => {
    const { service, dataSource } = make();
    await service.remove(4);
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM'),
      [4],
    );
  });
});
