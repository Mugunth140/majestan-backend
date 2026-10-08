import { AdminUtilitiesService } from './admin-utilities.service';

describe('AdminUtilitiesService', () => {
  function make() {
    const adminTableService = {
      listRows: jest.fn(async () => ({ items: [] })),
      getRowById: jest.fn(async () => ({ id: 1 })),
      createRow: jest.fn(async (_t: string, data: unknown) => ({ id: 9, ...(data as object) })),
      updateRow: jest.fn(async (_t: string, id: number) => ({ id })),
      updateStatus: jest.fn(async (_t: string, id: number) => ({ id })),
    };
    const dataSource = { query: jest.fn(async () => []) };
    const service = new AdminUtilitiesService(adminTableService as any, dataSource as any);
    return { service, adminTableService, dataSource };
  }

  it('lists utilities by name search', async () => {
    const { service, adminTableService } = make();
    await service.list({ search: 'water' } as any);
    expect(adminTableService.listRows).toHaveBeenCalledWith(
      'utilities',
      expect.objectContaining({ search: 'water' }),
      ['name'],
    );
  });

  it('generates the slug from the name on create', async () => {
    const { service, adminTableService } = make();
    await service.create({ data: { name: 'Power Backup', icon: 'Zap' } } as any);
    expect(adminTableService.createRow).toHaveBeenCalledWith(
      'utilities',
      expect.objectContaining({ name: 'Power Backup', slug: 'power-backup', icon: 'Zap' }),
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
