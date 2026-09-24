import { AdPlacement, AdLinkType } from './ad.entity';

describe('Ad entity vocabulary', () => {
  it('exposes hero plus reserved future placements', () => {
    expect(AdPlacement.Hero).toBe('hero');
    expect(AdPlacement.ListingFeed).toBe('listing_feed');
    expect(AdPlacement.Announcement).toBe('announcement');
    expect(AdPlacement.Popup).toBe('popup');
  });

  it('exposes preset/custom link types', () => {
    expect(AdLinkType.Preset).toBe('preset');
    expect(AdLinkType.Custom).toBe('custom');
  });
});
