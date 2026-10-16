import { slugDescribesProperty } from './property-slug.util';

describe('slugDescribesProperty', () => {
  // Real old-website URLs that the id-suffix recovery redirected to unrelated
  // new listings (seen live 2026-10-16).
  it.each([
    [
      '1-bhk-bedroom-apartment-flat-for-sale-in-town-icon-city-vilankurichi-coimbatore-503-sq-ft-ap178',
      'chettinad-burgandy-2bhk-apartment-in-codissia-road-ap178',
    ],
    [
      '2-bhk-bedroom-apartment-flat-for-sale-in-jains-antara-vilankurichi-coimbatore-730-sq-ft-ap100',
      '3bhk-apartment-in-ramanathapuram-ap100',
    ],
    [
      '2-bhk-bedroom-apartment-flat-for-sale-in-mount-galaxy-vadavalli-coimbatore-848-sq-ft-ap284',
      'sri-shrine-view-apartments-ap284',
    ],
    [
      '3-bhk-bedroom-apartment-flat-for-sale-in-thulir-by-dac-gn-mills-coimbatore-1514-sq-ft-ap242',
      'kubhera-vistas-ap242',
    ],
    [
      '1-bhk-bedroom-apartment-flat-for-sale-in-srivari-ekantam-ganapathy-coimbatore-609-sq-ft-ap109',
      'muktha-rithvich-3bhk-apartment-in-puliakulam-ap109',
    ],
    [
      '2-bhk-bedroom-apartment-flat-for-sale-in-jains-aashna-vilankurichi-coimbatore-992-sq-ft-ap135',
      'vrindhavana-adhira-2bhk-apartment-in-thudiyalur-ap135',
    ],
    [
      '2-bhk-bedroom-apartment-flat-for-sale-in-jains-antara-vilankurichi-coimbatore-730-sq-ft-ap101',
      '2bhk-apartment-in-gn-mills-ap101',
    ],
    [
      '3-bhk-bedroom-apartment-flat-for-sale-in-velar-urban-square-kalapatti-coimbatore-2251-sq-ft-ap159',
      'sreevatsa-vedh-ap159',
    ],
    [
      '2-bhk-1070-sqft-flat-near-sathy-road-chinnavedampatti-coimbatore-ap259',
      'arogya-residency-apartment-ap259',
    ],
    [
      '2-bhk-apartment-for-sale-in-avarampalayam-coimbatore-1150-sqft-elysium-vistara-avinashi-road-ap300',
      'kings-court-ap300',
    ],
  ])('rejects old URL %s for %s', (requested, actual) => {
    expect(slugDescribesProperty(requested, actual)).toBe(false);
  });

  it('accepts the current slug and crawler-doubled codes', () => {
    expect(
      slugDescribesProperty('opal-apartment-ap2462', 'opal-apartment-ap2462'),
    ).toBe(true);
    expect(
      slugDescribesProperty(
        'opal-apartment-ap2462-ap2462',
        'opal-apartment-ap2462',
      ),
    ).toBe(true);
    expect(slugDescribesProperty('vinoja-cs1605-cs1605', 'vinoja-cs1605')).toBe(
      true,
    );
  });

  it('still recovers a listing whose title was edited', () => {
    expect(
      slugDescribesProperty(
        'navaneethan-3bhk-near-saravanampatti-ap018',
        'navaneethan-new-3bhk-near-saravanampatti-ap018',
      ),
    ).toBe(true);
  });
});
