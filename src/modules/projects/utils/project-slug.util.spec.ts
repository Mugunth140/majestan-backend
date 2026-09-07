import { buildProjectCanonical, toProjectSlug } from './project-slug.util';

describe('project slugs', () => {
  it('slugifies names', () => {
    expect(toProjectSlug('Sunrise Villas & Resorts')).toBe('sunrise-villas-and-resorts');
  });

  it('builds canonical paths', () => {
    expect(buildProjectCanonical('Coimbatore', 'sunrise-villas')).toBe(
      'projects/coimbatore/sunrise-villas',
    );
  });
});
