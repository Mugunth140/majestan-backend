import {
  pathValue,
  intentWhere,
  renderTemplate,
  filterKey,
  priceLabel,
} from './seo-utils';

describe('SEO routing and intent boundaries', () => {
  it('formats project minimum prices in Indian units', () => {
    expect(priceLabel(13000000)).toBe('₹1.3 Cr');
    expect(priceLabel(4500000)).toBe('₹45 Lakh');
    expect(priceLabel(15000)).toBe('₹15,000');
    expect(priceLabel(null)).toBe('Price on request');
  });
  it('maps Sale to all Sell inventory and Rent to Rent inventory', () => {
    expect(intentWhere('buy')).toBe("p.listing_type='Sell'");
    expect(intentWhere('rent')).toBe("p.listing_type='Rent'");
  });
  it.each([
    '//example.com',
    '/admin/users',
    '/api/v1/auth',
    '/x/../y',
    '/x%2fy',
    '/x\\y',
    'https://example.com',
    '/x?query=1',
  ])('rejects unsafe public path %s', (path) =>
    expect(() => pathValue(path)).toThrow(),
  );
  it('accepts indexed ASCII paths up to 512 characters', () => {
    expect(pathValue('/' + 'a'.repeat(511))).toHaveLength(512);
    expect(() => pathValue('/' + 'a'.repeat(512))).toThrow();
    expect(pathValue('/projects/coimbatore/saravanampatti/test/')).toBe(
      '/projects/coimbatore/saravanampatti/test',
    );
  });
  it('does not collide city-wide rules through SQL NULL uniqueness', () => {
    expect(
      filterKey({
        inventory_kind: 'property',
        transaction_intent: 'buy',
        city_id: 2,
      }),
    ).toBe('property:buy:all:2:0:0');
    expect(
      filterKey({
        inventory_kind: 'property',
        transaction_intent: 'rent',
        city_id: 2,
      }),
    ).not.toBe(
      filterKey({
        inventory_kind: 'property',
        transaction_intent: 'buy',
        city_id: 2,
      }),
    );
  });
  it('renders known variables with safe unknown fallbacks', () =>
    expect(
      renderTemplate('{BHK} {Property_Type} in {Location}', {
        Property_Type: 'Apartment',
        Location: 'Coimbatore',
      }),
    ).toBe('Apartment in Coimbatore'));
});
