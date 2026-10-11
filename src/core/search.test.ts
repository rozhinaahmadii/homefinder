import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeAll } from 'vitest';
import { RawListingSchema } from './types';
import type { Listing } from './types';
import { normalizeListing } from './normalize';
import { markDuplicates } from './dedupe';
import { searchListings } from './search';

const CTX = { today: '2026-10-10', imageFiles: new Set<string>() };

let all: Listing[];

beforeAll(() => {
  const rawData = JSON.parse(readFileSync('data/listings.raw.json', 'utf8')) as unknown[];
  const normalized: Listing[] = [];
  const errors: string[] = [];
  for (const record of rawData) {
    try {
      normalized.push(normalizeListing(RawListingSchema.parse(record), CTX));
    } catch (err) {
      const id = (record as Record<string, unknown>).id;
      errors.push(`id ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  expect(errors, `Normalization failures:\n${errors.join('\n')}`).toHaveLength(0);
  expect(normalized).toHaveLength(rawData.length);
  all = markDuplicates(normalized);
});

function byId(id: number): Listing {
  const l = all.find((x) => x.id === id);
  if (!l) throw new Error(`Listing ${id} not found in dataset`);
  return l;
}

describe('searchListings', () => {
  describe('duplicates', () => {
    it('1016 is marked as a duplicate and never appears in results', () => {
      expect(byId(1016).duplicateOf).not.toBeNull();
      const { items } = searchListings(all, {});
      expect(items.map((l) => l.id)).not.toContain(1016);
    });

    it('1059 (canonical) appears in results', () => {
      expect(byId(1059).duplicateOf).toBeNull();
      const { items } = searchListings(all, {});
      expect(items.map((l) => l.id)).toContain(1059);
    });

    it('no result has duplicateOf set', () => {
      const { items } = searchListings(all, {});
      for (const l of items) {
        expect(l.duplicateOf).toBeNull();
      }
    });
  });

  describe('query', () => {
    it('"Mokotow" (no diacritic) matches district Mokotów – finds 1042', () => {
      const { items } = searchListings(all, { query: 'Mokotow' });
      expect(items.map((l) => l.id)).toContain(1042);
    });

    it('"balcony Żoliborz" (two terms) finds 1001 and 1011', () => {
      const { items } = searchListings(all, { query: 'balcony Żoliborz' });
      const ids = items.map((l) => l.id);
      expect(ids).toContain(1001);
      expect(ids).toContain(1011);
    });

    it('both terms must match – "balcony Żoliborz" is a strict subset of "balcony"', () => {
      const { items: balcony } = searchListings(all, { query: 'balcony' });
      const { items: both } = searchListings(all, { query: 'balcony Żoliborz' });
      expect(both.length).toBeGreaterThan(0);
      expect(both.length).toBeLessThan(balcony.length);
      const balconyIds = new Set(balcony.map((l) => l.id));
      for (const l of both) expect(balconyIds.has(l.id)).toBe(true);
    });

    it('comma-separated terms behave like whitespace-separated', () => {
      const { items: ws } = searchListings(all, { query: 'balcony Żoliborz' });
      const { items: comma } = searchListings(all, { query: 'balcony,Żoliborz' });
      expect(comma.map((l) => l.id).sort((a, b) => a - b)).toEqual(
        ws.map((l) => l.id).sort((a, b) => a - b),
      );
    });

    it('match is case-insensitive', () => {
      const { items: lower } = searchListings(all, { query: 'mokotow' });
      const { items: upper } = searchListings(all, { query: 'MOKOTOW' });
      expect(lower.map((l) => l.id).sort()).toEqual(upper.map((l) => l.id).sort());
    });
  });

  describe('city aliases', () => {
    const idsFor = (city: string) => searchListings(all, { city }).items.map((l) => l.id);

    it('city "Warszawa" returns the same listings as city "Warsaw"', () => {
      expect(idsFor('Warsaw').length).toBeGreaterThan(0);
      expect(idsFor('Warszawa')).toEqual(idsFor('Warsaw'));
    });

    it('city "Warszawie" returns the same listings as city "Warsaw"', () => {
      expect(idsFor('Warszawie')).toEqual(idsFor('Warsaw'));
    });

    it('query "warszawa Mokotow" finds 1042', () => {
      const { items } = searchListings(all, { query: 'warszawa Mokotow' });
      expect(items.map((l) => l.id)).toContain(1042);
      for (const l of items) expect(l.city).toBe('Warsaw');
    });
  });

  describe('city / district filter', () => {
    it('city "krakow" (diacritic-insensitive) includes 1037 and 1052', () => {
      const { items } = searchListings(all, { city: 'krakow' });
      const ids = items.map((l) => l.id);
      expect(ids).toContain(1037);
      expect(ids).toContain(1052);
    });

    it('city filter excludes all listings from other cities', () => {
      const { items } = searchListings(all, { city: 'krakow' });
      for (const l of items) expect(l.city).toBe('Kraków');
    });

    it('district filter is diacritic-insensitive', () => {
      const { items } = searchListings(all, { district: 'Zoliborz' });
      expect(items.length).toBeGreaterThan(0);
      for (const l of items) expect(l.district?.toLowerCase()).toBe('żoliborz');
    });
  });

  describe('price filter', () => {
    it('maxPrice 800000 with offerType sale excludes 1095 (EUR currency)', () => {
      expect(byId(1095).currency).toBe('EUR');
      const { items } = searchListings(all, { maxPrice: 800000, offerType: 'sale' });
      expect(items.map((l) => l.id)).not.toContain(1095);
    });

    it('maxPrice 800000 with offerType sale excludes rent listings', () => {
      const { items } = searchListings(all, { maxPrice: 800000, offerType: 'sale' });
      for (const l of items) expect(l.offerType).toBe('sale');
    });

    it('minPrice filter excludes listings with null price', () => {
      const { items } = searchListings(all, { minPrice: 1 });
      for (const l of items) expect(l.price).not.toBeNull();
    });

    it('maxPrice filter excludes listings with null price', () => {
      const { items } = searchListings(all, { maxPrice: 999_999_999 });
      for (const l of items) expect(l.price).not.toBeNull();
    });

    it('price filter excludes non-PLN listings', () => {
      const { items } = searchListings(all, { minPrice: 1 });
      for (const l of items) expect(l.currency).toBe('PLN');
    });
  });

  describe('offerType / propertyType filter', () => {
    it('offerType sale returns only sale listings', () => {
      const { items } = searchListings(all, { offerType: 'sale' });
      for (const l of items) expect(l.offerType).toBe('sale');
    });

    it('propertyType studio returns only studios', () => {
      const { items } = searchListings(all, { propertyType: 'studio' });
      for (const l of items) expect(l.propertyType).toBe('studio');
    });
  });

  describe('numeric filters', () => {
    it('minRooms excludes listings with null rooms', () => {
      const { items } = searchListings(all, { minRooms: 1 });
      for (const l of items) expect(l.rooms).not.toBeNull();
    });

    it('minRooms filters correctly', () => {
      const { items } = searchListings(all, { minRooms: 3 });
      for (const l of items) expect(l.rooms!).toBeGreaterThanOrEqual(3);
    });

    it('minArea excludes listings with null area', () => {
      const { items } = searchListings(all, { minArea: 1 });
      for (const l of items) expect(l.area).not.toBeNull();
    });

    it('maxArea excludes listings with null area', () => {
      const { items } = searchListings(all, { maxArea: 999 });
      for (const l of items) expect(l.area).not.toBeNull();
    });

    it('minArea / maxArea filters are inclusive', () => {
      const { items } = searchListings(all, { minArea: 50, maxArea: 60 });
      for (const l of items) {
        expect(l.area!).toBeGreaterThanOrEqual(50);
        expect(l.area!).toBeLessThanOrEqual(60);
      }
    });
  });

  describe('features filter', () => {
    it('features ["pets allowed", "balcony"] returns only listings that have both', () => {
      const { items } = searchListings(all, { features: ['pets allowed', 'balcony'] });
      expect(items.length).toBeGreaterThan(0);
      for (const l of items) {
        expect(l.features).toContain('pets allowed');
        expect(l.features).toContain('balcony');
      }
    });

    it('single feature filter works', () => {
      const { items } = searchListings(all, { features: ['elevator'] });
      expect(items.length).toBeGreaterThan(0);
      for (const l of items) expect(l.features).toContain('elevator');
    });

    it('"Lift" (synonym) matches listings with normalized "elevator" feature', () => {
      const { items: lift } = searchListings(all, { features: ['Lift'] });
      const { items: elevator } = searchListings(all, { features: ['elevator'] });
      expect(lift.length).toBeGreaterThan(0);
      expect(lift.map((l) => l.id).sort((a, b) => a - b)).toEqual(
        elevator.map((l) => l.id).sort((a, b) => a - b),
      );
    });
  });

  describe('sort', () => {
    it('price_asc: first item has non-null price, 1033 (null price) is last among sale listings', () => {
      const { items } = searchListings(all, { offerType: 'sale', sort: 'price_asc' });
      expect(items[0].price).not.toBeNull();
      const ids = items.map((l) => l.id);
      expect(ids).toContain(1033);
      const firstNullIdx = items.findIndex((l) => l.price === null);
      expect(firstNullIdx).toBeGreaterThan(-1);
      const idx1033 = items.findIndex((l) => l.id === 1033);
      expect(idx1033).toBeGreaterThanOrEqual(firstNullIdx);
    });

    it('price_asc: all PLN-priced items are non-decreasing and precede non-PLN/null items', () => {
      const { items } = searchListings(all, { sort: 'price_asc' });
      // "null sort value" = price is null OR currency is not PLN
      const nullSortValue = (l: Listing) => l.price === null || l.currency !== 'PLN';
      const firstTailIdx = items.findIndex(nullSortValue);
      const plnPriced = firstTailIdx === -1 ? items : items.slice(0, firstTailIdx);
      expect(plnPriced.length).toBeGreaterThan(0);
      expect(plnPriced[0].price).not.toBeNull();
      for (let i = 1; i < plnPriced.length; i++) {
        expect(plnPriced[i].price!).toBeGreaterThanOrEqual(plnPriced[i - 1].price!);
      }
      if (firstTailIdx !== -1) {
        for (let i = firstTailIdx; i < items.length; i++) {
          expect(nullSortValue(items[i])).toBe(true);
        }
      }
    });

    it('price_desc: first item has non-null price, 1033 (null price) is last among sale listings', () => {
      const { items } = searchListings(all, { offerType: 'sale', sort: 'price_desc' });
      expect(items[0].price).not.toBeNull();
      const ids = items.map((l) => l.id);
      expect(ids).toContain(1033);
      const firstNullIdx = items.findIndex((l) => l.price === null);
      expect(firstNullIdx).toBeGreaterThan(-1);
      const idx1033 = items.findIndex((l) => l.id === 1033);
      expect(idx1033).toBeGreaterThanOrEqual(firstNullIdx);
    });

    it('price_desc: all PLN-priced items are non-increasing and precede non-PLN/null items', () => {
      const { items } = searchListings(all, { sort: 'price_desc' });
      const nullSortValue = (l: Listing) => l.price === null || l.currency !== 'PLN';
      const firstTailIdx = items.findIndex(nullSortValue);
      const plnPriced = firstTailIdx === -1 ? items : items.slice(0, firstTailIdx);
      expect(plnPriced.length).toBeGreaterThan(0);
      expect(plnPriced[0].price).not.toBeNull();
      for (let i = 1; i < plnPriced.length; i++) {
        expect(plnPriced[i].price!).toBeLessThanOrEqual(plnPriced[i - 1].price!);
      }
      if (firstTailIdx !== -1) {
        for (let i = firstTailIdx; i < items.length; i++) {
          expect(nullSortValue(items[i])).toBe(true);
        }
      }
    });

    it('newest (default): first item has non-null publishedAt, dates are non-increasing', () => {
      const { items } = searchListings(all, {});
      expect(items[0].publishedAt).not.toBeNull();
      // "null sort value" = publishedAt is null OR listing has DATE_IN_FUTURE flag
      const nullSortValue = (l: Listing) =>
        l.publishedAt === null || l.flags.some((f) => f.code === 'DATE_IN_FUTURE');
      const firstTailIdx = items.findIndex(nullSortValue);
      const dated = firstTailIdx === -1 ? items : items.slice(0, firstTailIdx);
      for (let i = 1; i < dated.length; i++) {
        expect(dated[i].publishedAt! <= dated[i - 1].publishedAt!).toBe(true);
      }
    });

    it('area_desc: first item has non-null area, areas are non-increasing', () => {
      const { items } = searchListings(all, { sort: 'area_desc' });
      expect(items[0].area).not.toBeNull();
      const firstNullIdx = items.findIndex((l) => l.area === null);
      const withArea = firstNullIdx === -1 ? items : items.slice(0, firstNullIdx);
      for (let i = 1; i < withArea.length; i++) {
        expect(withArea[i].area!).toBeLessThanOrEqual(withArea[i - 1].area!);
      }
    });

    it('newest: 1078 (DATE_IN_FUTURE) is not the first result', () => {
      expect(byId(1078).flags.some((f) => f.code === 'DATE_IN_FUTURE')).toBe(true);
      const { items } = searchListings(all, {});
      expect(items[0].id).not.toBe(1078);
    });

    it('newest: 1078 (DATE_IN_FUTURE) sorts after all non-future-dated listings', () => {
      const { items } = searchListings(all, {});
      const idx1078 = items.findIndex((l) => l.id === 1078);
      expect(idx1078).toBeGreaterThan(-1);
      // every item before 1078 must not have DATE_IN_FUTURE
      for (const l of items.slice(0, idx1078)) {
        expect(l.flags.some((f) => f.code === 'DATE_IN_FUTURE')).toBe(false);
      }
    });

    it('price_asc (sale): 1095 (EUR) comes after every PLN-priced listing', () => {
      expect(byId(1095).currency).toBe('EUR');
      const { items } = searchListings(all, { offerType: 'sale', sort: 'price_asc' });
      const idx1095 = items.findIndex((l) => l.id === 1095);
      expect(idx1095).toBeGreaterThan(-1);
      // no PLN-priced listing should appear after 1095
      for (const l of items.slice(idx1095 + 1)) {
        expect(l.currency).not.toBe('PLN');
      }
      // all items before idx1095 with a non-null price use PLN
      for (const l of items.slice(0, idx1095)) {
        if (l.price !== null) expect(l.currency).toBe('PLN');
      }
    });

    it('price_per_m2_asc: first item has non-null pricePerM2, values are non-decreasing', () => {
      const { items } = searchListings(all, { sort: 'price_per_m2_asc' });
      expect(items[0].pricePerM2).not.toBeNull();
      const firstNullIdx = items.findIndex((l) => l.pricePerM2 === null);
      const withValue = firstNullIdx === -1 ? items : items.slice(0, firstNullIdx);
      for (let i = 1; i < withValue.length; i++) {
        expect(withValue[i].pricePerM2!).toBeGreaterThanOrEqual(withValue[i - 1].pricePerM2!);
      }
    });
  });

  describe('total and limit', () => {
    it('without limit, returns all matches (total === items.length)', () => {
      const { total, items } = searchListings(all, {});
      expect(items).toHaveLength(total);
    });

    it('limit caps returned items; total is unchanged by limit', () => {
      const { total: total5, items: items5 } = searchListings(all, { limit: 5 });
      const { total: total20 } = searchListings(all, { limit: 20 });
      expect(items5).toHaveLength(5);
      expect(total5).toEqual(total20);
    });

    it('total equals items.length when results fit within limit', () => {
      const { total, items } = searchListings(all, { city: 'krakow', offerType: 'rent', limit: 100 });
      expect(total).toEqual(items.length);
    });
  });
});
