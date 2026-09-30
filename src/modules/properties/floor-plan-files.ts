// site/majestan-backend/src/modules/properties/floor-plan-files.ts
import { PropertyDocumentType } from '../../database/entities/property-file.entity';

export type FloorPlanFileInput = {
  documentType: string;
  isPublic: boolean | number;
  sortOrder: number;
  title: string | null;
  fileKey: string;
};

export type FloorPlanFile = {
  title: string | null;
  imageUrl: string;
  imageKey: string;
};

/**
 * Picks the gallery-ready floor-plan uploads out of a listing's files:
 * public floor_plan documents with a storage key, ordered by sort order.
 * URL resolution stays with the caller (it owns the storage config).
 */
export function mapFloorPlanFiles(
  inputs: FloorPlanFileInput[],
  resolveUrl: (key: string) => string,
): FloorPlanFile[] {
  return inputs
    .filter(
      (f) =>
        f.documentType === PropertyDocumentType.FLOOR_PLAN &&
        !!f.isPublic &&
        !!f.fileKey,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((f) => ({
      title: f.title,
      imageUrl: resolveUrl(f.fileKey),
      imageKey: f.fileKey,
    }));
}
