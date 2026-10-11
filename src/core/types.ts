import { z } from 'zod';

export const OFFER_TYPES = ['sale', 'rent'] as const;
export const PROPERTY_TYPES = ['apartment', 'house', 'studio'] as const;
export const FLAG_CODES = [
  'PRICE_IMPLAUSIBLE',
  'CURRENCY_NOT_PLN',
  'AREA_IMPLAUSIBLE',
  'AREA_MISMATCH_DESCRIPTION',
  'ROOMS_MISSING',
  'ROOMS_MISMATCH_TITLE',
  'FLOOR_EXCEEDS_TOTAL',
  'FLOOR_MISMATCH_DESCRIPTION',
  'FEATURE_CONTRADICTS_DESCRIPTION',
  'DATE_IN_FUTURE',
  'IMAGE_MISSING',
  'DESCRIPTION_THIN',
  'LOCATION_INCOMPLETE',
] as const;

const looseNumber = z.union([z.string(), z.number(), z.null()]).optional();

export const RawListingSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string(),
  offerType: z.string(),
  propertyType: z.string(),
  city: z.string(),
  district: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  price: looseNumber,
  currency: z.string().nullable().optional(),
  area: looseNumber,
  rooms: looseNumber,
  floor: looseNumber,
  totalFloors: z.number().nullable().optional(),
  yearBuilt: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  features: z.array(z.string()).default([]),
  image: z.string().nullable().optional(),
  publishedAt: z.string(),
  contact: z
    .object({ name: z.string(), agency: z.string().optional(), email: z.string().optional() })
    .optional(),
});
export type RawListing = z.infer<typeof RawListingSchema>;

export const QualityFlagSchema = z.object({
  field: z.string(),
  code: z.enum(FLAG_CODES),
  message: z.string(),
});
export type QualityFlag = z.infer<typeof QualityFlagSchema>;

export const ListingSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  offerType: z.enum(OFFER_TYPES),
  propertyType: z.enum(PROPERTY_TYPES),
  city: z.string(),
  district: z.string().nullable(),
  address: z.string().nullable(),
  price: z.number().nullable(),
  currency: z.string().nullable(),
  area: z.number().nullable(),
  rooms: z.number().int().nullable(),
  floor: z.number().int().nullable(),
  totalFloors: z.number().int().nullable(),
  yearBuilt: z.number().int().nullable(),
  pricePerM2: z.number().nullable(),
  description: z.string(),
  features: z.array(z.string()),
  image: z.string().nullable(),
  publishedAt: z.string().nullable(),
  contact: RawListingSchema.shape.contact,
  flags: z.array(QualityFlagSchema),
  duplicateOf: z.number().int().nullable(),
});
export type Listing = z.infer<typeof ListingSchema>;

export const SearchFiltersSchema = z.object({
  query: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  offerType: z.enum(OFFER_TYPES).optional(),
  propertyType: z.enum(PROPERTY_TYPES).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minRooms: z.coerce.number().optional(),
  minArea: z.coerce.number().optional(),
  maxArea: z.coerce.number().optional(),
  features: z.array(z.string()).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'price_per_m2_asc', 'area_desc']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type SearchFilters = z.infer<typeof SearchFiltersSchema>;
