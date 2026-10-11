import { vi, describe, it, expect, beforeAll } from 'vitest';

vi.hoisted(() => {
  process.env.DB_PATH = ':memory:';
});

import { createSchema, insertListings, getAllListings, getListingById, countListings } from './db';
import type { Listing } from '../src/core/types';

const listingA: Listing = {
  id: 101,
  title: 'Test apartment A',
  offerType: 'sale',
  propertyType: 'apartment',
  city: 'Warsaw',
  district: 'Mokotów',
  address: 'ul. Testowa 1',
  price: 500000,
  currency: 'PLN',
  area: 50,
  rooms: 2,
  floor: 3,
  totalFloors: 10,
  yearBuilt: 2020,
  pricePerM2: 10000,
  description: 'A test apartment for database round-trip verification.',
  features: ['balcony', 'elevator'],
  image: '/images/building-1.svg',
  publishedAt: '2026-01-15',
  contact: { name: 'Test Agent', agency: 'Test Agency', email: 'test@example.com' },
  flags: [],
  duplicateOf: null,
};

const listingB: Listing = {
  id: 102,
  title: 'Test studio B',
  offerType: 'rent',
  propertyType: 'studio',
  city: 'Kraków',
  district: null,
  address: null,
  price: null,
  currency: null,
  area: null,
  rooms: null,
  floor: null,
  totalFloors: null,
  yearBuilt: null,
  pricePerM2: null,
  description: 'Minimal listing for testing null fields and flag round-trip.',
  features: [],
  image: null,
  publishedAt: null,
  contact: { name: 'Private Seller', email: 'seller@example.com' },
  flags: [{ field: 'image', code: 'IMAGE_MISSING', message: 'No image provided.' }],
  duplicateOf: 101,
};

describe('db', () => {
  beforeAll(() => {
    createSchema();
    insertListings([
      { listing: listingA, raw: { original: 'raw-a' } },
      { listing: listingB, raw: { original: 'raw-b' } },
    ]);
  });

  it('getAllListings returns both inserted listings unchanged', () => {
    const all = getAllListings();
    expect(all).toHaveLength(2);
    expect(all.find((l) => l.id === 101)).toEqual(listingA);
    expect(all.find((l) => l.id === 102)).toEqual(listingB);
  });

  it('countListings returns the number of rows, duplicates included', () => {
    expect(countListings()).toBe(2);
  });

  it('getListingById returns the correct listing', () => {
    expect(getListingById(101)).toEqual(listingA);
    expect(getListingById(102)).toEqual(listingB);
  });

  it('getListingById returns undefined for a missing id', () => {
    expect(getListingById(9999)).toBeUndefined();
  });
});
