import { computeProjectRanges } from './project-ranges.util';

describe('computeProjectRanges', () => {
  it('computes min/max price, area and sorted bhk from available units only', () => {
    const ranges = computeProjectRanges([
      { price: '8000000', builtupAreaSqft: '1200', bedrooms: 3, status: 'available' },
      { price: '12000000', builtupAreaSqft: '1450', bedrooms: 4, status: 'available' },
      { price: '5000000', builtupAreaSqft: '900', bedrooms: 2, status: 'sold' },
    ]);
    expect(ranges).toEqual({
      minPrice: 8000000,
      maxPrice: 12000000,
      minArea: 1200,
      maxArea: 1450,
      bhk: [3, 4],
      facings: [],
      unitsCount: 2,
    });
  });

  it('falls back to carpet then super-builtup area and ignores zero prices', () => {
    const ranges = computeProjectRanges([
      { price: '0', carpetAreaSqft: '1000', bedrooms: 2, status: 'available' },
      { price: null, superBuiltupAreaSqft: '1500', bedrooms: 3, status: 'available' },
    ]);
    expect(ranges.minPrice).toBeNull();
    expect(ranges.maxPrice).toBeNull();
    expect(ranges.minArea).toBe(1000);
    expect(ranges.maxArea).toBe(1500);
    expect(ranges.bhk).toEqual([2, 3]);
  });

  it('returns nulls for an empty unit list', () => {
    expect(computeProjectRanges([])).toEqual({
      minPrice: null,
      maxPrice: null,
      minArea: null,
      maxArea: null,
      bhk: [],
      facings: [],
      unitsCount: 0,
    });
  });

  it('collects distinct facings from available units in compass order', () => {
    const ranges = computeProjectRanges([
      { price: '8000000', builtupAreaSqft: '1200', bedrooms: 3, facing: 'west', status: 'available' },
      { price: '9000000', builtupAreaSqft: '1300', bedrooms: 3, facing: 'East', status: 'available' },
      { price: '9500000', builtupAreaSqft: '1350', bedrooms: 3, facing: 'east', status: 'available' },
      { price: '5000000', builtupAreaSqft: '900', bedrooms: 2, facing: 'north', status: 'sold' },
    ]);
    expect(ranges.facings).toEqual(['east', 'west']);
  });
});
