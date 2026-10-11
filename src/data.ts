import { z } from 'zod';
import { ListingSchema } from './core/types';
import type { Listing, SearchFilters } from './core/types';

const ListingsResponseSchema = z.object({ total: z.number(), items: z.array(ListingSchema) });
export type ListingsResponse = z.infer<typeof ListingsResponseSchema>;

const MetaResponseSchema = z.object({
  cities: z.array(z.string()),
  features: z.array(z.string()),
  assistantEnabled: z.boolean(),
});
export type MetaResponse = z.infer<typeof MetaResponseSchema>;

const AssistantResponseSchema = z.object({
  listings: z.array(z.object({ id: z.number(), reason: z.string() })),
  assumptions: z.array(z.string()),
  relaxed: z.array(z.string()),
  warnings: z.array(z.string()),
  message: z.string(),
});
export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;

const ApiErrorSchema = z.object({ error: z.string() });
const ASSISTANT_FAILED = 'The assistant could not answer. Try again.';

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
  return ListingsResponseSchema.parse(await apiFetch(`/api/listings${qs ? '?' + qs : ''}`));
}

export async function fetchListing(id: number): Promise<Listing | null> {
  const res = await fetch(`/api/listings/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
  return ListingSchema.parse(await res.json());
}

export async function fetchMeta(): Promise<MetaResponse> {
  return MetaResponseSchema.parse(await apiFetch('/api/meta'));
}

export async function askAssistant(message: string): Promise<AssistantResponse> {
  const res = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = ApiErrorSchema.safeParse(body);
    throw new Error(error.success ? error.data.error : ASSISTANT_FAILED);
  }
  const parsed = AssistantResponseSchema.safeParse(body);
  if (!parsed.success) throw new Error(ASSISTANT_FAILED);
  return parsed.data;
}
