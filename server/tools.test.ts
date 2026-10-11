import { vi, describe, it, expect, beforeAll } from 'vitest';

vi.hoisted(() => {
  process.env.DB_PATH = ':memory:';
});

import { readFileSync } from 'node:fs';
import { createSchema, insertListings } from './db';
import { RawListingSchema } from '../src/core/types';
import { normalizeListing } from '../src/core/normalize';
import { markDuplicates } from '../src/core/dedupe';
import { tools } from './tools';

const CTX = { today: '2026-10-10', imageFiles: new Set<string>() };
// 13 records; after deduplication 1016 is marked duplicate of 1059 → 12 non-duplicates
const SEED_IDS = [1001, 1016, 1033, 1037, 1042, 1044, 1050, 1052, 1059, 1067, 1078, 1084, 1095];

beforeAll(() => {
  const rawData = JSON.parse(readFileSync('data/listings.raw.json', 'utf8')) as unknown[];
  const toSeed = rawData.filter((r) =>
    SEED_IDS.includes((r as Record<string, unknown>).id as number),
  );
  const normalized = toSeed.map((r) => normalizeListing(RawListingSchema.parse(r), CTX));
  const listings = markDuplicates(normalized);
  createSchema();
  insertListings(listings.map((listing) => ({ listing, raw: {} })));
});

const searchTool = tools.find((t) => t.name === 'search_listings')!;
const getTool = tools.find((t) => t.name === 'get_listing')!;

type CompactItem = {
  id: number;
  title: string;
  city: string;
  district: string | null;
  offerType: string;
  propertyType: string;
  price: number | null;
  currency: string | null;
  area: number | null;
  rooms: number | null;
  pricePerM2: number | null;
  features: string[];
  flags: string[];
};

type SearchResult = { total: number; shown: number; items: CompactItem[] };
type ErrorResult = { error: string; issues?: unknown[] };

describe('search_listings handler', () => {
  it('returns items with exactly the compact summary keys', () => {
    const result = searchTool.handler({}) as SearchResult;
    expect(result.total).toBeGreaterThan(0);
    expect(result.items.length).toBeGreaterThan(0);
    const expectedKeys = [
      'id',
      'title',
      'city',
      'district',
      'offerType',
      'propertyType',
      'price',
      'currency',
      'area',
      'rooms',
      'pricePerM2',
      'features',
      'flags',
    ].sort();
    for (const item of result.items) {
      expect(Object.keys(item).sort()).toEqual(expectedKeys);
    }
  });

  it('total reflects all matches, shown is items.length', () => {
    const result = searchTool.handler({ city: 'Kraków' }) as SearchResult;
    expect(result.total).toBeGreaterThan(0);
    expect(result.shown).toBe(result.items.length);
  });

  it('result contains at most 10 items (total > shown when 12 non-duplicates match)', () => {
    const result = searchTool.handler({}) as SearchResult;
    expect(result.items.length).toBeLessThanOrEqual(10);
    expect(result.total).toBeGreaterThan(result.shown);
  });

  it('city filter is applied (krakow returns 1037 and 1052, not 1001)', () => {
    const result = searchTool.handler({ city: 'krakow' }) as SearchResult;
    const ids = result.items.map((l) => l.id);
    expect(ids).toContain(1037);
    expect(ids).toContain(1052);
    expect(ids).not.toContain(1001);
  });

  it('duplicates are excluded from results', () => {
    const result = searchTool.handler({}) as SearchResult;
    const ids = result.items.map((l) => l.id);
    expect(ids).not.toContain(1016);
  });

  it('flags in compact summary are code strings not objects (1044 specific)', () => {
    // 1044 is in Wrocław and has FLOOR_EXCEEDS_TOTAL and FLOOR_MISMATCH_DESCRIPTION flags
    const result = searchTool.handler({ city: 'Wrocław' }) as SearchResult;
    const item = result.items.find((l) => l.id === 1044);
    expect(item).toBeDefined();
    expect(item!.flags.length).toBeGreaterThan(0);
    for (const flag of item!.flags) {
      expect(typeof flag).toBe('string');
    }
    expect(item!.flags).toContain('FLOOR_EXCEEDS_TOTAL');
  });

  it('a limit field in caller input is stripped/ignored, result still capped at 10', () => {
    const result = searchTool.handler({ limit: 100 } as Record<string, unknown>) as SearchResult;
    expect(result.items.length).toBeLessThanOrEqual(10);
    expect(result.total).toBeGreaterThan(result.shown);
  });

  it('invalid input returns { error, issues } without throwing', () => {
    const result = searchTool.handler({ offerType: 'unknown' }) as ErrorResult;
    expect(result.error).toBeTruthy();
    expect(Array.isArray(result.issues)).toBe(true);
  });
});

describe('get_listing handler', () => {
  it('returns the full listing for a known id', () => {
    const result = getTool.handler({ id: 1001 }) as Record<string, unknown>;
    expect(result.id).toBe(1001);
    expect(typeof result.title).toBe('string');
    expect(typeof result.description).toBe('string');
    expect(Array.isArray(result.flags)).toBe(true);
  });

  it('returns { error: "Listing not found" } for an unknown id', () => {
    const result = getTool.handler({ id: 9999 }) as ErrorResult;
    expect(result.error).toBe('Listing not found');
  });

  it('a duplicate listing is reachable by id', () => {
    const result = getTool.handler({ id: 1016 }) as Record<string, unknown>;
    expect(result.id).toBe(1016);
    expect(result.duplicateOf).toBe(1059);
  });

  it('invalid input (non-number id) returns { error, issues } without throwing', () => {
    const result = getTool.handler({ id: 'abc' }) as ErrorResult;
    expect(result.error).toBeTruthy();
    expect(Array.isArray(result.issues)).toBe(true);
  });
});
