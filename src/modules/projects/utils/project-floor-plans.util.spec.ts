import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProjectUnitDto } from '../../admin/projects/dto/create-project.dto';
import { readUnitFloorPlans, resolveUnitFloorPlans, validateUnitFloorPlans } from './project-floor-plans.util';

describe('project configuration floor plans', () => {
  it('keeps legacy images but treats an explicit empty list as removal', () => {
    expect(readUnitFloorPlans({ floorPlanImageKey: 'old.webp' })).toEqual([{ floorName: 'Existing plan', imageKey: 'old.webp', imageUrl: 'old.webp' }]);
    expect(readUnitFloorPlans({ floorPlans: [], floorPlanImageKey: 'old.webp' })).toEqual([]);
  });
  it('resolves images per floor without mixing configurations', () => {
    const a = { floorPlans: [{ floorName: 'Ground floor', imageKey: '1200-ground.webp' }, { floorName: 'First floor', imageKey: '1200-first.webp' }] };
    const b = { floorPlans: [{ floorName: 'Ground floor', imageKey: '1400-ground.webp' }] };
    const url = (key: string) => `https://cdn.test/${key}`;
    expect(resolveUnitFloorPlans(a, url).map((p) => p.imageUrl)).toEqual(['https://cdn.test/1200-ground.webp', 'https://cdn.test/1200-first.webp']);
    expect(resolveUnitFloorPlans(b, url)[0].imageUrl).toBe('https://cdn.test/1400-ground.webp');
  });
  it('requires one image and a distinct floor name within each configuration', async () => {
    const invalid = plainToInstance(CreateProjectUnitDto, { unitCode: '2BHK-1200', floorPlans: [
      { floorName: ' Ground   floor ', imageKey: 'a.webp' }, { floorName: 'ground floor', imageKey: 'b.webp' },
    ] });
    expect((await validate(invalid)).some((error) => error.property === 'floorPlans')).toBe(true);
    expect(() => validateUnitFloorPlans(invalid.floorPlans!)).toThrow('only once');
    const noImage = plainToInstance(CreateProjectUnitDto, { unitCode: '2BHK-1200', floorPlans: [{ floorName: 'Basement' }] });
    expect((await validate(noImage)).some((error) => error.property === 'floorPlans')).toBe(true);
    expect(await validate(plainToInstance(CreateProjectUnitDto, { unitCode: '2BHK-1400', floorPlans: [{ floorName: 'Ground floor', imageKey: 'c.webp' }] }))).toEqual([]);
  });
});
