// site/majestan-backend/src/modules/properties/floor-plan-files.spec.ts
import { mapFloorPlanFiles } from './floor-plan-files';

const input = (over: Record<string, unknown> = {}) => ({
  documentType: 'floor_plan',
  isPublic: true,
  sortOrder: 0,
  title: 'Floor Plan',
  fileKey: 'uploads/fp-1.png',
  ...over,
});

describe('mapFloorPlanFiles', () => {
  it('maps public floor-plan files to gallery entries with resolved urls', () => {
    const out = mapFloorPlanFiles(
      [input({ title: 'Ground floor', fileKey: 'uploads/g.png', sortOrder: 2 }), input({ title: 'First floor', fileKey: 'uploads/f.png', sortOrder: 1 })],
      (key) => `https://cdn.example/${key}`,
    );

    // sortOrder wins over input order.
    expect(out).toEqual([
      { title: 'First floor', imageUrl: 'https://cdn.example/uploads/f.png', imageKey: 'uploads/f.png' },
      { title: 'Ground floor', imageUrl: 'https://cdn.example/uploads/g.png', imageKey: 'uploads/g.png' },
    ]);
  });

  it('skips non-plan documents, private files and entries without a key', () => {
    const out = mapFloorPlanFiles(
      [
        input({ documentType: 'brochure' }),
        input({ isPublic: false }),
        input({ fileKey: '' }),
      ],
      (key) => `https://cdn.example/${key}`,
    );

    expect(out).toEqual([]);
  });
});
