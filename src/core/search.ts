import { stripDiacritics, normalizeFeatures } from './normalize';
import type { Listing, SearchFilters } from './types';

function normalize(s: string): string {
  return stripDiacritics(s).toLowerCase();
}

function matchesQuery(listing: Listing, terms: string[]): boolean {
  const haystack = normalize(
    [
      listing.title,
      listing.description,
      listing.city,
      listing.district ?? '',
      listing.address ?? '',
      listing.features.join(' '),
    ].join(' '),
  );
  return terms.every((term) => haystack.includes(term));
}

function compareNullLast<T>(
  a: T | null,
  b: T | null,
  cmp: (x: T, y: T) => number,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return cmp(a, b);
}

function sortListings(listings: Listing[], sort: NonNullable<SearchFilters['sort']>): Listing[] {
  const copy = [...listings];
  switch (sort) {
    case 'price_asc':
      return copy.sort((a, b) =>
        compareNullLast(
          a.currency === 'PLN' ? a.price : null,
          b.currency === 'PLN' ? b.price : null,
          (x, y) => x - y,
        ),
      );
    case 'price_desc':
      return copy.sort((a, b) =>
        compareNullLast(
          a.currency === 'PLN' ? a.price : null,
          b.currency === 'PLN' ? b.price : null,
          (x, y) => y - x,
        ),
      );
    case 'price_per_m2_asc':
      return copy.sort((a, b) => compareNullLast(a.pricePerM2, b.pricePerM2, (x, y) => x - y));
    case 'area_desc':
      return copy.sort((a, b) => compareNullLast(a.area, b.area, (x, y) => y - x));
    case 'newest':
      return copy.sort((a, b) => {
        const da = a.flags.some((f) => f.code === 'DATE_IN_FUTURE') ? null : a.publishedAt;
        const db = b.flags.some((f) => f.code === 'DATE_IN_FUTURE') ? null : b.publishedAt;
        return compareNullLast(da, db, (x, y) => y.localeCompare(x));
      });
  }
}

export function searchListings(
  listings: Listing[],
  filters: SearchFilters,
): { total: number; items: Listing[] } {
  const {
    query,
    city,
    district,
    offerType,
    propertyType,
    minPrice,
    maxPrice,
    minRooms,
    minArea,
    maxArea,
    features,
    sort = 'newest',
    limit,
  } = filters;

  const terms = query
    ? query
        .split(/[\s,]+/)
        .map(normalize)
        .filter((t) => t.length > 0)
    : [];

  const normalizedFeatureFilter =
    features !== undefined && features.length > 0 ? normalizeFeatures(features) : undefined;

  const priceFilterActive = minPrice !== undefined || maxPrice !== undefined;

  const filtered = listings.filter((l) => {
    if (l.duplicateOf !== null) return false;

    if (terms.length > 0 && !matchesQuery(l, terms)) return false;

    if (city !== undefined && normalize(l.city) !== normalize(city)) return false;

    if (district !== undefined) {
      if (!l.district || normalize(l.district) !== normalize(district)) return false;
    }

    if (offerType !== undefined && l.offerType !== offerType) return false;

    if (propertyType !== undefined && l.propertyType !== propertyType) return false;

    if (priceFilterActive) {
      if (l.price === null || l.currency !== 'PLN') return false;
      if (minPrice !== undefined && l.price < minPrice) return false;
      if (maxPrice !== undefined && l.price > maxPrice) return false;
    }

    if (minRooms !== undefined) {
      if (l.rooms === null || l.rooms < minRooms) return false;
    }

    if (minArea !== undefined) {
      if (l.area === null || l.area < minArea) return false;
    }

    if (maxArea !== undefined) {
      if (l.area === null || l.area > maxArea) return false;
    }

    if (normalizedFeatureFilter !== undefined) {
      for (const f of normalizedFeatureFilter) {
        if (!l.features.includes(f)) return false;
      }
    }

    return true;
  });

  const sorted = sortListings(filtered, sort);
  const total = sorted.length;
  const items = limit !== undefined ? sorted.slice(0, limit) : sorted;

  return { total, items };
}
