import { buildProjectCanonical, toProjectSlug } from './project-slug.util';

describe('project slugs', () => {
  it('slugifies names', () => {
    expect(toProjectSlug('Sunrise Villas & Resorts')).toBe('sunrise-villas-and-resorts');
  });

  it('builds canonical slug with project code', () => {
    expect(buildProjectCanonical('sunrise-villas', 'PRV0001')).toBe('sunrise-villas-prv0001');
  });

  it('builds canonical slug without project code (fallback)', () => {
    expect(buildProjectCanonical('sunrise-villas')).toBe('sunrise-villas');
    expect(buildProjectCanonical('sunrise-villas', null)).toBe('sunrise-villas');
  });
});
