export type ListingKind = 'property' | 'project';
export interface InventoryConfiguration {
  id: number;
  code: string | null;
  type: string;
  status: string;
  mode: string;
  bedrooms: number | null;
  price: string | null;
  rent: string | null;
  builtup: string | null;
  carpet: string | null;
  plot: string | null;
}
export interface InventoryRecord {
  key: string;
  kind: ListingKind;
  id: number;
  title: string;
  code: string | null;
  path: string | null;
  aliases: string[];
  type: string;
  mode: string | null;
  status: string;
  approval: string | null;
  verification: string | null;
  visible: boolean;
  city: string | null;
  localities: string[];
  latitude: number | null;
  longitude: number | null;
  builderId: number | null;
  builder: string | null;
  projectId: number | null;
  uploaderId: number | null;
  legacy: boolean;
  source: string | null;
  created: string | null;
  updated: string | null;
  availableUntil: string | null;
  price: string | null;
  rent: string | null;
  seatRent: string | null;
  seats: number | null;
  declaredRate: string | null;
  area: string | null;
  areaBasis: string | null;
  areaUnit: string | null;
  bedrooms: number | null;
  furnishing: string | null;
  floor: string | null;
  declaredUnits: number | null;
  possession: string | null;
  possessionDate: string | null;
  description: boolean;
  media: number;
  cover?: boolean;
  gallery?: number;
  locationConflict?: boolean;
  floorPlans: number;
  brochure: boolean;
  faqs: number;
  specifications: boolean;
  documents: number;
  legalFlags: Record<string, string | null>;
  seoTitle: boolean;
  seoDescription: boolean;
  indexing: string | null;
  configurations: InventoryConfiguration[];
  saves: number | null;
}
export interface InventoryFilters {
  from: string;
  to: string;
  kind?: string;
  city?: string;
  locality?: string;
  type?: string;
  mode?: string;
  status?: string;
  approval?: string;
  visible?: string;
  builder?: string;
  project?: string;
  bedrooms?: string;
  uploader?: string;
  provenance?: string;
  minPrice?: string;
  maxPrice?: string;
  areaBasis?: string;
  asOf?: string;
  added?: string;
  activity?: string;
  recordAge?: string;
  freshness?: string;
  furnishing?: string;
  configurationStatus?: string;
  bucket?: string;
  sort?: string;
  withoutIssue?: string;
  verification?: string;
  indexing?: string;
  possession?: string;
  configurationType?: string;
  configurationMode?: string;
  configurationBedrooms?: string;
  issue?: string;
  key?: string;
  section?: string;
  page?: string;
  limit?: string;
}
export interface TrafficRow {
  key: string;
  day: string | null;
  views: number;
  visitors: number;
  sessions: number;
  engagement: number;
  scroll: number;
  phone: number;
  whatsapp: number;
  email: number;
  wishlistAdds: number;
  wishlistRemoves: number;
  enquiries: number;
  visits: number;
  linkedEnquirySessions: number;
}
export interface CountRow {
  label: string;
  value: number;
  match?: Partial<InventoryFilters>;
  series?: string;
}
export interface Metric {
  key: string;
  label: string;
  value: number | null;
  unit?: string;
  match?: Partial<InventoryFilters>;
}
export interface InventoryChart {
  key: string;
  title: string;
  type:
    | 'bar'
    | 'stack'
    | 'line'
    | 'area'
    | 'histogram'
    | 'box'
    | 'scatter'
    | 'range'
    | 'heatmap';
  rows: Record<string, string | number | null | Partial<InventoryFilters>>[];
  unit?: string;
  note?: string;
}
