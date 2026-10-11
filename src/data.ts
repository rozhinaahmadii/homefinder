import type { Listing, SearchFilters } from './core/types';

export interface ListingsResponse {
  total: number;
  items: Listing[];
}

export interface MetaResponse {
  cities: string[];
  features: string[];
}

async function apiFetch(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
  return res.json();
}

function filtersToParams(filters: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.query) p.set('query', filters.query);
  if (filters.city) p.set('city', filters.city);
  if (filters.district) p.set('district', filters.district);
  if (filters.offerType) p.set('offerType', filters.offerType);
  if (filters.propertyType) p.set('propertyType', filters.propertyType);
  if (filters.minPrice !== undefined) p.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice !== undefined) p.set('maxPrice', String(filters.maxPrice));
  if (filters.minRooms !== undefined) p.set('minRooms', String(filters.minRooms));
  if (filters.minArea !== undefined) p.set('minArea', String(filters.minArea));
  if (filters.maxArea !== undefined) p.set('maxArea', String(filters.maxArea));
  if (filters.features?.length) p.set('features', filters.features.join(','));
  if (filters.sort) p.set('sort', filters.sort);
  if (filters.limit !== undefined) p.set('limit', String(filters.limit));
  return p;
}

export async function fetchListings(filters: SearchFilters): Promise<ListingsResponse> {
  const qs = filtersToParams(filters).toString();
  return apiFetch(`/api/listings${qs ? '?' + qs : ''}`) as Promise<ListingsResponse>;
}

export async function fetchListing(id: number): Promise<Listing | null> {
  const res = await fetch(`/api/listings/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
  return res.json() as Promise<Listing>;
}

export async function fetchMeta(): Promise<MetaResponse> {
  return apiFetch('/api/meta') as Promise<MetaResponse>;
}
