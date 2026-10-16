import {
  PROJECT_CRITERIA,
  PROPERTY_CRITERIA,
  ProjectTraits,
  PropertyTraits,
  SIMILAR_LIMIT,
  possessionLabel,
  rankByPriority,
} from './similar-ranking';

const prop = (id: number, over: Partial<PropertyTraits> = {}): PropertyTraits => ({
  id,
  propertyType: 'apartment',
  listingType: 'Sell',
  possession: 'Ready to Move',
  bedrooms: 3,
  sublocation: 'Saravanampatti',
  city: 'Coimbatore',
  price: 6_000_000,
  condition: 'new',
  createdAt: id,
  ...over,
});

const proj = (id: number, over: Partial<ProjectTraits> = {}): ProjectTraits => ({
  id,
  projectType: 'apartment',
  possession: 'ready_to_move',
  bhk: [2, 3],
  sublocation: 'Ganapathy',
  city: 'Coimbatore',
  minPrice: 5_000_000,
  maxPrice: 9_000_000,
  createdAt: id,
  ...over,
});

const ids = <T extends { id: number }>(r: { item: T }[]) => r.map((x) => x.item.id);

describe('similar properties', () => {
  it('never returns the listing itself', () => {
    const base = prop(1);
    expect(ids(rankByPriority(base, [base, prop(2)], PROPERTY_CRITERIA))).toEqual([2]);
  });

  it('puts the same possession status ahead of everything below it', () => {
    const base = prop(1);
    const ranked = rankByPriority(
      base,
      [
        // Matches config, locality, price and city — but not possession.
        prop(2, { possession: 'Under Construction' }),
        // Matches possession only.
        prop(3, { bedrooms: 2, sublocation: 'Peelamedu', price: 20_000_000, city: 'Chennai' }),
      ],
      PROPERTY_CRITERIA,
    );
    expect(ids(ranked)).toEqual([3, 2]);
  });

  it('then configuration, then locality, then price', () => {
    const base = prop(1);
    const ranked = rankByPriority(
      base,
      [
        prop(2, { bedrooms: 2, sublocation: 'Peelamedu', price: 6_100_000 }), // price
        prop(3, { bedrooms: 2 }), // locality + price
        prop(4, { sublocation: 'Peelamedu', price: 20_000_000 }), // config
        prop(5), // everything
      ],
      PROPERTY_CRITERIA,
    );
    expect(ids(ranked)).toEqual([5, 4, 3, 2]);
  });

  it('keeps other types and rentals after every same-type sale', () => {
    const base = prop(1);
    const ranked = rankByPriority(
      base,
      [prop(2, { propertyType: 'villa' }), prop(3, { listingType: 'Rent' }), prop(4, { possession: null, bedrooms: null, sublocation: null })],
      PROPERTY_CRITERIA,
    );
    expect(ids(ranked)).toEqual([4, 3, 2]);
  });

  it('labels why each card matched', () => {
    const [top] = rankByPriority(prop(1), [prop(2)], PROPERTY_CRITERIA);
    expect(top.matches).toEqual(['Ready to move', '3 BHK', 'In Saravanampatti', 'Similar price', 'New']);
  });

  it('breaks ties by newest and caps the list', () => {
    const ranked = rankByPriority(prop(1), Array.from({ length: 12 }, (_, i) => prop(i + 2)), PROPERTY_CRITERIA);
    expect(ranked).toHaveLength(SIMILAR_LIMIT);
    expect(ranked[0].item.id).toBe(13);
  });
});

describe('similar projects', () => {
  it('ranks possession, then shared BHK, then locality', () => {
    const base = proj(1);
    const ranked = rankByPriority(
      base,
      [
        proj(2, { possession: 'under_construction' }),
        proj(3, { bhk: [4], sublocation: 'Peelamedu' }),
        proj(4, { bhk: [3, 4], sublocation: 'Peelamedu' }),
        proj(5, { bhk: [4] }),
      ],
      PROJECT_CRITERIA,
    );
    expect(ids(ranked)).toEqual([4, 5, 3, 2]);
    expect(ranked[0].matches).toContain('3 BHK');
  });

  it('formats possession values from either source', () => {
    expect(possessionLabel('ready_to_move')).toBe('Ready to move');
    expect(possessionLabel('Under Construction')).toBe('Under construction');
    expect(possessionLabel('')).toBeNull();
  });
});
