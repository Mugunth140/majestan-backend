jest.mock('../storage/storage.service', () => ({ StorageService: class {} }));
import { ProjectsService } from './projects.service';
describe('public project details', () => {
  it.each(['published','booked','archived'])('retains the complete %s project page', async status => {
    const record = {id: 1, name: 'Project', slug: 'project', canonicalSlug: 'project-pa0001', projectType: 'apartment', status, units: [], projectAmenities: [], projectFaqs: [], galleryImageUrls: [], builder: null, seo: null};
    const service = new ProjectsService({findOne: jest.fn().mockResolvedValue(record)} as any, {generateReadUrl: (value:string)=>value} as any);
    expect(await service.detailsBySlug('project-pa0001')).toMatchObject({id:1,name:'Project',status,units:[],projectAmenities:[],projectFaqs:[]});
  });
  it('does not expose never-published drafts', async () => {
    const service = new ProjectsService({findOne: jest.fn().mockResolvedValue({status:'draft'})} as any, {} as any);
    await expect(service.detailsBySlug('draft')).rejects.toThrow('Project not found');
  });
});
