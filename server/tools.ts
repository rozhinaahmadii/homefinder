import { z } from 'zod';
import { SearchFiltersSchema } from '../src/core/types';
import { searchListings } from '../src/core/search';
import { normalizeCity, stripDiacritics } from '../src/core/normalize';
import type { Listing } from '../src/core/types';
import { getAllListings, getListingById } from './db';

export interface Tool {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  handler: (input: unknown) => unknown;
}

const SearchListingsInputSchema = SearchFiltersSchema.omit({ limit: true });

const GetListingInputSchema = z.object({ id: z.number().int() });

function foldCity(city: string): string {
  return stripDiacritics(normalizeCity(city)).toLowerCase();
}

function unknownCityHint(city: string, listings: Listing[]): string | undefined {
  const known = [...new Set(listings.filter((l) => l.duplicateOf === null).map((l) => l.city))].sort();
  if (known.some((k) => foldCity(k) === foldCity(city))) return undefined;
  return `Unknown city '${city}'. Known cities: ${known.join(', ')}.`;
}

export const tools: Tool[] = [
  {
    name: 'search_listings',
    description:      
      'Search real estate listings in Polish cities. Known cities: Gdańsk, Kraków, Łódź, Poznań, Warsaw, Wrocław. Filter by city, district, offer type (sale or rent), property type, price range in PLN, minimum rooms, area range, and features such as "balcony" or "pets allowed". The free-text query matches words in the title, description and location; every word must match. Returns the total number of matches and at most 10 summaries, newest first unless a sort is given. If total is larger than the number shown, add filters to narrow the search. Each summary includes flag codes: a non-empty flags list means some data on that listing is doubtful and should be verified with get_listing before recommending it. Duplicate listings are never returned.',

    schema: SearchListingsInputSchema,
    handler(input: unknown) {
      const result = SearchListingsInputSchema.safeParse(input);
      if (!result.success) {
        return { error: 'Invalid input', issues: result.error.issues };
      }
      const listings = getAllListings();
      const { total, items } = searchListings(listings, { ...result.data, limit: 10 });
      const hint =
        result.data.city !== undefined ? unknownCityHint(result.data.city, listings) : undefined;
      return {
        ...(hint !== undefined ? { hint } : {}),
        total,
        shown: items.length,
        items: items.map((l) => ({
          id: l.id,
          title: l.title,
          city: l.city,
          district: l.district,
          offerType: l.offerType,
          propertyType: l.propertyType,
          price: l.price,
          currency: l.currency,
          area: l.area,
          rooms: l.rooms,
          pricePerM2: l.pricePerM2,
          features: l.features,
          flags: l.flags.map((f) => f.code),
        })),
      };
    },
  },
  {
    name: 'get_listing',
    description:
      'Get the full details of one listing by its id: description, address, floor, year built, features, contact, and quality flags with an explanation of what is doubtful. Use it after search_listings to inspect a candidate before recommending or comparing it. Returns an error object if the id does not exist. Only use ids returned by search_listings; do not guess ids.',    schema: GetListingInputSchema,
    handler(input: unknown) {
      const result = GetListingInputSchema.safeParse(input);
      if (!result.success) {
        return { error: 'Invalid input', issues: result.error.issues };
      }
      const listing = getListingById(result.data.id);
      if (!listing) {
        return { error: 'Listing not found' };
      }
      return listing;
    },
  },
];
