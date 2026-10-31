jest.mock('bun', () => ({ S3Client: jest.fn(), S3File: jest.fn() }), { virtual: true });
jest.mock('meilisearch', () => ({ Meilisearch: jest.fn() }), { virtual: true });
import { AdminPropertiesService } from './admin-properties.service';
import { PropertyFile } from '../../../database/entities/property-file.entity';
import { FileEntity } from '../../../database/entities/file.entity';
function setup(failCommit = false) {
  let committed = false;
  const link = { id: 11, fileId: 2, propertyId: 7, isPublic: false, title: 'Original' };
  const file = { id: 2, fileKey: 'private.pdf', mimeType: 'application/pdf', fileSizeBytes: '123' };
  const manager = {
    find: jest.fn(async (entity: unknown) => entity === PropertyFile ? [link] : entity === FileEntity ? [file] : []),
    update: jest.fn(async () => ({})), delete: jest.fn(async () => ({})), count: jest.fn(async () => 0),
  };
  const q = { manager, connect: jest.fn(), startTransaction: jest.fn(), release: jest.fn(), rollbackTransaction: jest.fn(),
    commitTransaction: jest.fn(async () => { if (failCommit) throw new Error('Commit failed'); committed = true; }),
  };
  const storage = { deleteFiles: jest.fn(async () => { expect(committed).toBe(true); }) };
  const service = new AdminPropertiesService({ createQueryRunner: () => q } as any, storage as any, { indexProperty: jest.fn(async () => {}) } as any);
  jest.spyOn(service, 'details').mockResolvedValue({ id: 7 } as any);
  return { service, manager, q, storage, link, file };
}
it('retains file records, metadata and privacy even if an older client submits public defaults', async () => {
  const { service, manager, storage } = setup();
  await service.update('apartment', 7, { documents: [{ fileKey: 'private.pdf', title: 'Renamed', isPublic: true }] });
  expect(manager.delete).not.toHaveBeenCalled();
  expect(manager.update).toHaveBeenCalledWith(PropertyFile, { id: 11 }, expect.objectContaining({ title: 'Renamed' }));
  expect(storage.deleteFiles).not.toHaveBeenCalled();
});
it('cleans storage only after an explicit removal successfully commits', async () => {
  const { service, storage } = setup();
  await service.update('apartment', 7, { documents: [] });
  expect(storage.deleteFiles).toHaveBeenCalledWith(['private.pdf']);
});
it('does not remove any storage object if the transaction rolls back', async () => {
  const { service, storage, q } = setup(true);
  await expect(service.update('apartment', 7, { documents: [] })).rejects.toThrow('Commit failed');
  expect(q.rollbackTransaction).toHaveBeenCalled();
  expect(storage.deleteFiles).not.toHaveBeenCalled();
});
it('does not delete shared files while another property still links to them', async () => {
  const { service, manager, storage } = setup();
  manager.count.mockResolvedValue(1);
  await service.update('apartment', 7, { documents: [] });
  expect(manager.delete).not.toHaveBeenCalledWith(FileEntity, expect.anything());
  expect(storage.deleteFiles).not.toHaveBeenCalled();
});
