import { usableArea } from '../seo-engine/seo-quality';
import { Property } from '../../database/entities/property.entity';
import { getPropertyTypeCode } from '../properties/utils/property-slug.util';

/** The card shape the home page's property carousel renders. */
export type FeaturedProperty = {
  id: number;
  propertyType: string;
  slugUrl: string;
  propertyName: string;
  sublocation: string | null;
  photo: string | null;
  postType: string | null;
  expectedSalePrice: string | null;
  monthlyRent: string | null;
  pricePerSqft: number | null;
  bedrooms: number | null;
  areaSqft: string | null;
  possession: string | null;
  facing: string | null;
  propertyCondition: string | null;
  detailPath: string;
};

/** Relations the mapper reads; load them with the property. */
export const FEATURED_PROPERTY_RELATIONS = [
  'propertyImages',
  'propertyLocations',
  'propertyLocations.sublocation',
  'propertyDetails',
];

/**
 * Property → home card. Moved here from HomeService so the curated
 * "Handpicked Properties" list and its automatic fallback map identically.
 * Any property type is accepted; the URL suffix comes from the same code
 * table the detail route resolves against.
 */
export async function toFeaturedProperty(
  p: Property,
  readUrl: (key: string) => string,
): Promise<FeaturedProperty> {
  const propertyType = String(p.propertyType);
  const slug = p.slug?.trim() || `${propertyType}-${p.id}`;
  const images = await p.propertyImages;
  const primaryKey = images?.find((img) => img.isPrimary)?.imageUrl || images?.[0]?.imageUrl || null;

  const locations = await p.propertyLocations;
  const loc = locations?.[0];
  const formattedLocation = loc?.sublocation?.localityName
    ? `${loc.sublocation.localityName}, ${p.city}`
    : p.city;

  const details = await p.propertyDetails;
  const d = Array.isArray(details) ? details[0] : details;
  // `area_sqft` is the canonical column; the others are type-specific
  // fallbacks that are frequently null.
  const candidates = [d?.areaSqft, d?.builtUpArea, d?.superBuiltUpArea, d?.carpetArea];
  const verifiedArea = candidates.map(value => usableArea(value, propertyType)).find(value => value !== null);
  const areaSqft = verifiedArea == null ? null : String(verifiedArea);

  const bedrooms = typeof d?.bedrooms === 'number' && d.bedrooms > 0 ? d.bedrooms : null;

  const priceNumber = Number(p.price);
  const areaNumber = Number(areaSqft);
  const pricePerSqft =
    Number.isFinite(priceNumber) && priceNumber > 0 && Number.isFinite(areaNumber) && areaNumber > 0
      ? Math.round(priceNumber / areaNumber)
      : null;

  return {
    id: p.id,
    propertyType,
    slugUrl: slug,
    propertyName: p.title,
    sublocation: formattedLocation,
    photo: primaryKey ? readUrl(primaryKey) : null,
    postType: p.listingType,
    expectedSalePrice: p.price,
    monthlyRent: p.price,
    pricePerSqft,
    bedrooms,
    areaSqft,
    possession: d?.possessionStatus?.trim() || null,
    facing: d?.propertyFacing?.trim() || null,
    propertyCondition: p.propertyCondition?.trim() || null,
    detailPath: p.slug?.trim() ? `/${p.slug.trim()}` : `/${slug}-${getPropertyTypeCode(propertyType)}${p.id}`,
  };
}
