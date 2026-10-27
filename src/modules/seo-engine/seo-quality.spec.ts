import { cleanSeoText, decodeSeoEntities, usableArea, validateRobotsPolicy } from './seo-quality';
describe('SEO publication quality', () => {
  it('cleans missing area fragments and repeated cities', () => {
    expect(cleanSeoText('Plot (0 Sq.Ft) in Coimbatore, Coimbatore | Realty', 'Coimbatore')).toBe('Plot in Coimbatore | Realty');
    expect(cleanSeoText('Villa ( Sq.Ft) in Coimbatore Coimbatore', 'Coimbatore')).toBe('Villa in Coimbatore');
  });
  it('decodes HTML entities so search titles never show literal &amp;', () => {
    expect(decodeSeoEntities('Floor Plans &amp; Prices')).toBe('Floor Plans & Prices');
    expect(decodeSeoEntities('Floor Plans &amp;amp; Prices')).toBe('Floor Plans & Prices');
    expect(decodeSeoEntities('Sree Daksha&#x27;s &#39;Macie&#39; &quot;Villa&quot;')).toBe('Sree Daksha\'s \'Macie\' "Villa"');
    expect(decodeSeoEntities('R&D &unknown; & plain')).toBe('R&D &unknown; & plain');
    expect(cleanSeoText('Photos &amp; Gallery | Coimbatore', 'Coimbatore')).toBe('Photos & Gallery | Coimbatore');
  });
  it('distinguishes residential measurements from other types without guessing units', () => {
    expect(usableArea(2, 'apartment')).toBeNull();
    expect(usableArea(1200, 'apartment')).toBe(1200);
    expect(usableArea(75, 'coworking')).toBe(75);
  });
  const safe = 'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api';
  it('accepts effective protection and preserves ordinary public crawling', () => expect(() => validateRobotsPolicy(safe)).not.toThrow());
  it.each([
    safe + '\nDisallow: /',
    safe + '\nDisallow: /*',
    safe + '\nAllow: /admin',
    safe + '\nUser-agent: Googlebot\nAllow: /',
    'Disallow: /admin\nDisallow: /api',
    safe + '\nUser-agent: Googlebot\nDisallow: /admin\nDisallow: /api\nDisallow: /projects',
  ])('rejects ineffective or public-blocking policy', text => expect(() => validateRobotsPolicy(text)).toThrow());
  it('merges equally specific user-agent groups', () => expect(() => validateRobotsPolicy(safe + '\nUser-agent: Googlebot\nDisallow: /admin\nUser-agent: Googlebot\nDisallow: /api')).not.toThrow());
});
