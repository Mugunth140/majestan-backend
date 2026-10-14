import { conflictMessage, findConflicts, nextFieldRevisions } from './project-merge.util';

describe('project field-level merge', () => {
  const seen = { name: 6, description: 4, 'unit:A-101': 7 };

  it('lets edits to different fields through after another save', () => {
    expect(findConflicts(seen, 5, ['description', 'city'], undefined)).toEqual([]);
  });

  it('refuses a field someone else changed since the base revision', () => {
    expect(findConflicts(seen, 5, ['name'], undefined)).toEqual(['name']);
  });

  it('merges unit edits unit by unit', () => {
    expect(findConflicts(seen, 5, ['units'], ['A-102', 'A-103'])).toEqual([]);
    expect(findConflicts(seen, 5, ['units'], ['A-101'])).toEqual(['unit:A-101']);
  });

  it('treats a whole unit list without codes as one field', () => {
    expect(findConflicts(seen, 5, ['units'], undefined)).toEqual(['units']);
    expect(findConflicts(seen, 7, ['units'], undefined)).toEqual([]);
  });

  it('stamps written fields and units with the new revision', () => {
    expect(nextFieldRevisions(seen, 8, ['city', 'units'], ['A-102'])).toEqual({
      name: 6, description: 4, 'unit:A-101': 7, city: 8, units: 8, 'unit:A-102': 8,
    });
  });

  it('names what conflicted', () => {
    expect(conflictMessage(['name', 'unit:A-101'])).toContain('name, unit A-101');
  });
});
