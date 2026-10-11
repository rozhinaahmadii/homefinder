import { describe, it, expect } from 'vitest';
import type { Listing } from '../src/core/types';
import { checkScenario } from './check';
import type { CheckedResult, Expect } from './check';

function listing(id: number, overrides: Partial<Listing> = {}): Listing {
  return {
    id,
    title: `Listing ${id}`,
    offerType: 'sale',
    propertyType: 'apartment',
    city: 'Kraków',
    district: null,
    address: null,
    price: 500000,
    currency: 'PLN',
    area: 40,
    rooms: 2,
    floor: 1,
    totalFloors: 4,
    yearBuilt: 2000,
    pricePerM2: 12500,
    description: 'A flat.',
    features: ['balcony', 'pets allowed'],
    image: null,
    publishedAt: '2026-06-01',
    contact: undefined,
    flags: [],
    duplicateOf: null,
    ...overrides,
  };
}

const AREA_FLAG = {
  field: 'area',
  code: 'AREA_MISMATCH_DESCRIPTION' as const,
  message: 'Description says 37 m² but field is 23.1 m².',
};

const STORE = new Map<number, Listing>(
  [
    listing(1),
    listing(2),
    listing(3, { features: ['balcony'] }),
    listing(4, { city: 'Warsaw' }),
    listing(5, { duplicateOf: 1 }),
    listing(6, { flags: [AREA_FLAG] }),
    listing(7),
    listing(8),
    listing(9),
    listing(10),
  ].map((l) => [l.id, l]),
);

function result(ids: number[], overrides: Partial<CheckedResult> = {}): CheckedResult {
  return {
    completed: true,
    listings: ids.map((id) => ({ id, reason: 'Fits.', flags: [] })),
    dropped: [],
    warnings: [],
    relaxed: [],
    ...overrides,
  };
}

function failedChecks(expectation: Expect, checked: CheckedResult): string[] {
  return checkScenario(expectation, checked, STORE).map((f) => f.check);
}

describe('checkScenario', () => {
  it('returns no failures for a result that meets every expectation', () => {
    const expectation: Expect = {
      minResults: 1,
      maxResults: 3,
      idsWithin: [1, 2, 3],
      mustNotInclude: [5],
      city: 'Kraków',
      featureOrRelaxed: 'pets allowed',
    };
    expect(checkScenario(expectation, result([1, 2]), STORE)).toEqual([]);
  });

  it('fails when completed is false', () => {
    expect(failedChecks({}, result([], { completed: false }))).toEqual(['completed']);
  });

  it('fails when a returned id is not in the store', () => {
    const failures = checkScenario({}, result([1, 999]), STORE);
    expect(failures.map((f) => f.check)).toEqual(['idsExist']);
    expect(failures[0].reason).toContain('999');
  });

  it('fails when a returned id is a duplicate', () => {
    expect(failedChecks({}, result([5]))).toEqual(['noDuplicates']);
  });

  it('fails when dropped is not empty', () => {
    expect(failedChecks({}, result([1], { dropped: [999] }))).toEqual(['nothingDropped']);
  });

  it('fails when more than 5 listings are returned', () => {
    expect(failedChecks({}, result([1, 2, 3, 7, 8, 9]))).toEqual(['atMostFive']);
  });

  it('fails when a flagged listing is not named in any warning', () => {
    const checked = result([6], { warnings: ['Check the area before viewing.'] });
    expect(failedChecks({}, checked)).toEqual(['flagsWarned']);
  });

  it('passes when a flagged listing is named by id in a warning', () => {
    const checked = result([6], { warnings: ['Listing 6: verify the area.'] });
    expect(failedChecks({}, checked)).toEqual([]);
  });

  it('does not treat an id inside a longer number as naming the listing', () => {
    const checked = result([6], { warnings: ['Listing 1067: verify the area.'] });
    expect(failedChecks({}, checked)).toEqual(['flagsWarned']);
  });

  it('fails minResults when too few listings are returned', () => {
    expect(failedChecks({ minResults: 1 }, result([]))).toEqual(['minResults']);
  });

  it('fails maxResults when too many listings are returned', () => {
    expect(failedChecks({ maxResults: 0 }, result([1]))).toEqual(['maxResults']);
  });

  it('fails idsWithin when a returned id is outside the list', () => {
    expect(failedChecks({ idsWithin: [1, 2] }, result([1, 3]))).toEqual(['idsWithin']);
  });

  it('fails mustNotInclude when a listed id is returned', () => {
    expect(failedChecks({ mustNotInclude: [2] }, result([1, 2]))).toEqual(['mustNotInclude']);
  });

  it('mustInclude passes when every listed id is returned', () => {
    expect(failedChecks({ mustInclude: [1, 2] }, result([2, 7, 1]))).toEqual([]);
  });

  it('mustInclude fails and names the missing id', () => {
    const failures = checkScenario({ mustInclude: [1, 2] }, result([1, 7]), STORE);
    expect(failures).toEqual([{ check: 'mustInclude', reason: 'expected ids not returned: 2' }]);
  });

  it('fails city when a returned listing is in another city', () => {
    const failures = checkScenario({ city: 'Kraków' }, result([1, 4]), STORE);
    expect(failures.map((f) => f.check)).toEqual(['city']);
    expect(failures[0].reason).toContain('4');
  });

  it('featureOrRelaxed passes when every returned listing has the feature', () => {
    expect(failedChecks({ featureOrRelaxed: 'pets allowed' }, result([1, 2]))).toEqual([]);
  });

  it('featureOrRelaxed passes when a listing lacks the feature but relaxed is not empty', () => {
    const checked = result([1, 3], { relaxed: ['Dropped "pets allowed".'] });
    expect(failedChecks({ featureOrRelaxed: 'pets allowed' }, checked)).toEqual([]);
  });

  it('featureOrRelaxed fails when a listing lacks the feature and relaxed is empty', () => {
    expect(failedChecks({ featureOrRelaxed: 'pets allowed' }, result([1, 3]))).toEqual([
      'featureOrRelaxed',
    ]);
  });

  it('reports every failed check, not only the first', () => {
    const checked = result([4, 999], { completed: false });
    expect(failedChecks({ city: 'Kraków', maxResults: 1 }, checked)).toEqual([
      'completed',
      'idsExist',
      'maxResults',
      'city',
    ]);
  });
});
