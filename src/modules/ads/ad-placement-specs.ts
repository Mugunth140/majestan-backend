// ad-placement-specs.ts
// Single source of truth for what each ad slot on the site accepts: which
// image variants it takes, their aspect ratio and finalize bounds, and which
// audiences an ad can target. Admin validation, image processing and the
// public feed all read from here, so adding a new slot is one entry.
//
// Mirrored for the editor UI in crm-frontend/src/lib/ads-link-presets.ts —
// keep ratios and audiences in sync.
import { AdPlacement } from '../../database/entities/ad.entity';

export interface AdSlotSpec {
  /** Aspect ratio as [width, height]; uploads must match within ±2%. */
  ratio: [number, number];
  /** Finalized webp is fit inside these bounds. */
  bounds: { width: number; height: number };
}

export interface AdPlacementSpec {
  desktop: AdSlotSpec;
  /** Absent = the slot only takes one image. */
  mobile?: AdSlotSpec & { required: boolean };
  /**
   * Audiences an ad can target. An ad with no audience is the fallback shown
   * wherever no audience-specific ad is active. Empty = no targeting.
   */
  audiences: readonly string[];
}

const HERO: AdPlacementSpec = {
  desktop: { ratio: [32, 9], bounds: { width: 1920, height: 540 } },
  mobile: { ratio: [4, 5], bounds: { width: 1080, height: 1350 }, required: true },
  audiences: [],
};

export const AD_PLACEMENT_SPECS: Record<AdPlacement, AdPlacementSpec> = {
  [AdPlacement.Hero]: HERO,
  // Home "Exclusive Offers and Highlights" carousel
  [AdPlacement.Offers]: {
    desktop: { ratio: [4, 1], bounds: { width: 1920, height: 480 } },
    mobile: { ratio: [4, 5], bounds: { width: 1080, height: 1350 }, required: false },
    audiences: [],
  },
  // Header mega-menu art panel (Buy / Rent / Services dropdowns)
  [AdPlacement.MegaMenu]: {
    desktop: { ratio: [3, 2], bounds: { width: 900, height: 600 } },
    audiences: ['buy', 'rent', 'services'],
  },
  // Banners between cards on the property and project listing pages
  [AdPlacement.ListingFeed]: {
    desktop: { ratio: [4, 1], bounds: { width: 1600, height: 400 } },
    mobile: { ratio: [16, 9], bounds: { width: 1080, height: 608 }, required: false },
    audiences: ['buy', 'rent', 'projects'],
  },
  // Reserved, not rendered on the site yet
  [AdPlacement.Announcement]: HERO,
  [AdPlacement.Popup]: HERO,
};

export function placementSpec(placement: AdPlacement | undefined): AdPlacementSpec {
  return AD_PLACEMENT_SPECS[placement ?? AdPlacement.Hero] ?? HERO;
}

export function ratioLabel([w, h]: [number, number]): string {
  return `${w}:${h}`;
}
