import {
  enforceSlugSuffix,
  generateSeoSlug,
  normalizeSeoSlug,
  slugDescribesProperty,
} from './property-slug.util';
import { planSlugRepairs } from '../../../database/migrations/1785500000000-SanitizePropertySlugs';

describe('property slug sanitising', () => {
  it('uses the project slug character rules', () => {
    expect(normalizeSeoSlug('P&K Heritage Farms')).toBe('pandk-heritage-farms');
    expect(normalizeSeoSlug("Sree Daksha's Macie Villa & Apartment")).toBe(
      'sree-dakshas-macie-villa-and-apartment',
    );
    expect(normalizeSeoSlug('Kovai E.N.T Complex')).toBe('kovai-e-n-t-complex');
    expect(normalizeSeoSlug('  Col’s  Calibre__/ ')).toBe('cols-calibre');
  });

  it('never emits unsafe characters from generated or custom slugs', () => {
    expect(generateSeoSlug('P&K Heritage Farms', 'farmland', 28)).toBe(
      'pandk-heritage-farms-fl028',
    );
    expect(enforceSlugSuffix("sree-daksha's-praktva", 'villa', 82)).toBe(
      'sree-dakshas-praktva-v082',
    );
  });

  it('keeps old shared links recognisable after a rename', () => {
    expect(
      slugDescribesProperty('p&k-heritage-farms-fl028', 'pandk-heritage-farms-fl028'),
    ).toBe(true);
  });

  it('plans renames only for unsafe slugs and never onto a slug in use', () => {
    const rows = [
      { id: 28, slug: 'p&k-heritage-farms-fl028' },
      { id: 82, slug: "sree-daksha's-praktva-v082" },
      { id: 97, slug: '2bhk-apartment-in-saibaba-colony-ap097' },
      { id: 5, slug: "tak'en-cs005" },
    ];
    expect(planSlugRepairs(rows, ['taken-cs005'])).toEqual([
      { id: 28, from: 'p&k-heritage-farms-fl028', to: 'pandk-heritage-farms-fl028' },
      { id: 82, from: "sree-daksha's-praktva-v082", to: 'sree-dakshas-praktva-v082' },
    ]);
  });
});
