import { parsePropertySlugSuffix } from './utils/property-slug.util';

describe('parsePropertySlugSuffix', () => {
  it('parses known property-type suffixes', () => {
    expect(parsePropertySlugSuffix('3-bhk-apartment-for-rent-ap006')).toEqual({
      propertyType: 'apartment',
      id: 6,
    });
    expect(parsePropertySlugSuffix('warehouse-for-rent-is257')).toEqual({
      propertyType: 'industrial',
      id: 257,
    });
    expect(parsePropertySlugSuffix('shop-cs45')).toEqual({
      propertyType: 'commercial',
      id: 45,
    });
  });

  it('rejects project codes so project slugs 404 on the property endpoint', () => {
    // Regression: purnaya-ektha-pa0006 used to resolve to property id 6
    // (an unrelated apartment) instead of falling through to the project page.
    expect(parsePropertySlugSuffix('purnaya-ektha-pa0006')).toBeNull();
    expect(parsePropertySlugSuffix('some-project-PA12')).toBeNull();
  });

  it('rejects slugs without a valid suffix', () => {
    expect(parsePropertySlugSuffix('plain-slug')).toBeNull();
    expect(parsePropertySlugSuffix('ends-with-ap')).toBeNull();
    // Single-letter codes (villa -v, plot -p) never matched the old
    // two-letter pattern either — behavior unchanged.
    expect(parsePropertySlugSuffix('villa-for-sale-v12')).toBeNull();
    expect(parsePropertySlugSuffix('')).toBeNull();
  });
});
