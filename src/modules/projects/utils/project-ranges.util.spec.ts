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
      minPlotCents: null,
      maxPlotCents: null,
      plotCents: [],
      bhk: [3, 4],
      facings: [],
      unitsCount: 2,
      plotDimensions: [],
      plotBoundaryWall: false,
      plotOpenSides: [],
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
      minPlotCents: null,
      maxPlotCents: null,
      plotCents: [],
      bhk: [],
      facings: [],
      unitsCount: 0,
      plotDimensions: [],
      plotBoundaryWall: false,
      plotOpenSides: [],
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

  it('collects plot cents range from available units only', () => {
    const ranges = computeProjectRanges([
      { price: '5000000', plotAreaCents: '10', status: 'available' },
      { price: '9000000', plotAreaCents: '20.5', status: 'available' },
      { price: '4000000', plotAreaCents: '8', status: 'sold' },
    ]);
    expect(ranges.minPlotCents).toBe(10);
    expect(ranges.maxPlotCents).toBe(20.5);
    expect(ranges.plotCents).toEqual([10, 20.5]);
    expect(ranges.minArea).toBeNull();
    expect(ranges.bhk).toEqual([]);
  });

  it('collects plot dimensions, boundary wall and open sides from available units', () => {
    const ranges = computeProjectRanges([
      {
        price: '5000000', plotAreaCents: '10', status: 'available',
        boundaryWall: true, openSides: '2',
        roomDimensions: [{ name: 'Plot', dimensions: '30 × 40 ft' }],
      },
      {
        price: '9000000', plotAreaCents: '20', status: 'available',
        boundaryWall: false, openSides: 3,
        roomDimensions: [{ name: 'Plot', dimensions: '60 × 40 ft' }],
      },
      {
        price: '4000000', plotAreaCents: '8', status: 'sold',
        boundaryWall: true, openSides: 4,
        roomDimensions: [{ name: 'Plot', dimensions: '20 × 40 ft' }],
      },
    ]);
    expect(ranges.plotDimensions).toEqual(['30 × 40 ft', '60 × 40 ft']);
    expect(ranges.plotBoundaryWall).toBe(true);
    expect(ranges.plotOpenSides).toEqual([2, 3]);
  });
});
