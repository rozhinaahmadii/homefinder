import { describe, it, expect } from 'vitest';
import { markDuplicates } from './dedupe';
import { normalizeListing } from './normalize';
import type { RawListing } from './types';

// All images that appear in the test records
const ctx = {
  today: '2026-10-10',
  imageFiles: new Set([
    '/images/building-1.svg',
    '/images/building-2.svg',
    '/images/building-3.svg',
    '/images/building-4.svg',
    '/images/building-6.svg',
  ]),
};

// ── raw records copied verbatim from data/listings.raw.json ──────────────────

const raw1016: RawListing = {
  id: 1016,
  title: 'Quiet 1-room apartment in Śródmieście',
  offerType: 'sale',
  propertyType: 'apartment',
  city: 'Łódź',
  district: 'Śródmieście',
  address: 'ul. Narutowicza 64',
  price: 295000,
  currency: 'PLN',
  area: 30,
  rooms: 1,
  floor: 0,
  totalFloors: 3,
  yearBuilt: 1900,
  description:
    'Charming one-room apartment with high ceilings in a historic tenement house. The apartment has one room with a kitchen annex, a bathroom and a small hallway. Ground floor apartment in a building with 3 floors. Close to Piotrkowska Street and Łódź Fabryczna station. Mortgage-free, with a clear legal status. Available immediately.',
  features: ['dishwasher'],
  image: '/images/building-6.svg',
  publishedAt: '2026-07-13',
  contact: { name: 'Krzysztof Piotrowski', email: 'krzysztof.piotrowski@example.com' },
};

const raw1059: RawListing = {
  id: 1059,
  title: 'Quiet 1-room apartment in Śródmieście',
  offerType: 'sale',
  propertyType: 'apartment',
  city: 'Łódź',
  district: 'Śródmieście',
  address: 'ul. Narutowicza 64',
  price: 295000,
  currency: 'PLN',
  area: 30,
  rooms: 1,
  floor: 0,
  totalFloors: 3,
  yearBuilt: 1900,
  description:
    'Charming one-room apartment with high ceilings in a historic tenement house. The apartment has one room with a kitchen annex, a bathroom and a small hallway. Ground floor apartment in a building with 3 floors. Close to Piotrkowska Street and Łódź Fabryczna station. Mortgage-free, with a clear legal status. Available immediately.',
  features: ['dishwasher'],
  image: '/images/building-6.svg',
  publishedAt: '2026-08-19',
  contact: { name: 'Krzysztof Piotrowski', email: 'krzysztof.piotrowski@example.com' },
};

const raw1027: RawListing = {
  id: 1027,
  title: 'Cosy 4-room apartment in Bemowo',
  offerType: 'rent',
  propertyType: 'apartment',
  city: 'Warsaw',
  district: 'Bemowo',
  address: 'ul. Powstańców Śląskich 140',
  price: 5700,
  currency: 'PLN',
  area: 81.2,
  rooms: 4,
  floor: 3,
  totalFloors: 5,
  description:
    'Finished to a high standard, this four-room apartment is located in a modern residential complex. Layout: a spacious living room, a separate kitchen, three bedrooms and a bathroom with a bathtub. Located on floor 3 of 5, with an elevator. Balcony with a view of the greenery. A basement storage unit is included. The apartment is rented fully furnished and equipped. Close to Fort Bema park and good tram connections. Utilities are paid separately according to consumption. A deposit equal to one month of rent is required.',
  features: ['elevator', 'security', 'pets allowed', 'balcony', 'basement', 'furnished'],
  image: '/images/building-3.svg',
  publishedAt: '2026-07-23',
  contact: { name: 'Katarzyna Lewandowska', agency: 'Klucz Nieruchomości', email: 'katarzyna.lewandowska@example.com' },
};

const raw1084: RawListing = {
  id: 1084,
  title: 'Cosy 4-room apartment in Bemowo – PRICE REDUCED',
  offerType: 'rent',
  propertyType: 'apartment',
  city: 'Warsaw',
  district: 'Bemowo',
  address: 'ul. Powstańców Śląskich 140',
  price: 5500,
  currency: 'PLN',
  area: 81.2,
  rooms: 4,
  floor: 3,
  totalFloors: 5,
  description:
    'Finished to a high standard, this four-room apartment is located in a modern residential complex. Layout: a spacious living room, a separate kitchen, three bedrooms and a bathroom with a bathtub. Located on floor 3 of 5, with an elevator. Balcony with a view of the greenery. A basement storage unit is included. The apartment is rented fully furnished and equipped. Close to Fort Bema park and good tram connections. Utilities are paid separately according to consumption. A deposit equal to one month of rent is required.',
  features: ['elevator', 'security', 'pets allowed', 'balcony', 'basement', 'furnished'],
  image: '/images/building-3.svg',
  publishedAt: '2026-08-12',
  contact: { name: 'Katarzyna Lewandowska', agency: 'Klucz Nieruchomości', email: 'katarzyna.lewandowska@example.com' },
};

const raw1050: RawListing = {
  id: 1050,
  title: 'Apartment in a historic tenement, Wilda',
  offerType: 'sale',
  propertyType: 'apartment',
  city: 'Poznań',
  district: 'Wilda',
  address: 'ul. Górna Wilda 179',
  price: 870000,
  currency: 'PLN',
  area: 67,
  rooms: 3,
  floor: 2,
  totalFloors: 3,
  yearBuilt: 1933,
  description:
    'Bright three-room apartment in a renovated pre-war tenement on ul. Górna Wilda. Two bedrooms, a bright living room connected to the kitchen and a bathroom with a window. Located on floor 2 of 3. A storage room on the ground floor belongs to the apartment. Air conditioning is installed in the living room. Close to the Poznań International Fair and the Warta river. Mortgage-free, with a clear legal status. Available immediately.',
  features: ['storage room', 'air conditioning', 'dishwasher'],
  image: '/images/building-6.svg',
  publishedAt: '2026-09-19',
  contact: { name: 'Tomasz Wójcik', agency: 'Metropolia Estates', email: 'tomasz.wojcik@example.com' },
};

// raw address uses "ulica" prefix; normalizeAddress converts it to "ul." — matching 1050
const raw1111: RawListing = {
  id: 1111,
  title: 'flat in a historic tenement, Wilda',
  offerType: 'sale',
  propertyType: 'apartment',
  city: 'Poznań',
  district: 'Wilda',
  address: 'ulica Górna Wilda 179',
  price: 870000,
  currency: 'PLN',
  area: 67,
  rooms: 3,
  floor: 2,
  totalFloors: 3,
  yearBuilt: 1933,
  description:
    'Bright three-room apartment in a renovated pre-war tenement on ul. Górna Wilda. Two bedrooms, a bright living room connected to the kitchen and a bathroom with a window. Located on floor 2 of 3. A storage room on the ground floor belongs to the apartment. Air conditioning is installed in the living room. Close to the Poznań International Fair and the Warta river. Mortgage-free, with a clear legal status. Available immediately.',
  features: ['storage room', 'air conditioning', 'dishwasher'],
  image: '/images/building-1.svg',
  publishedAt: '2026-09-19',
  contact: { name: 'Anna Wiśniewska', agency: 'Dom i Ogród Nieruchomości', email: 'anna.wisniewska@example.com' },
};

// Same street as 1047 but different flat number (20 vs 2) — must NOT be a duplicate
const raw1047: RawListing = {
  id: 1047,
  title: '4-ROOM APARTMENT, 72 M², NADODRZE!!! OKAZJA',
  offerType: 'sale',
  propertyType: 'apartment',
  city: 'WROCŁAW',
  district: 'Nadodrze',
  address: 'ul. Roosevelta 20',
  price: 914000,
  currency: 'PLN',
  area: 72,
  rooms: 4,
  floor: 4,
  totalFloors: 5,
  yearBuilt: 2008,
  description:
    'Modern four-room apartment in a recently completed development on ul. Roosevelta. The apartment consists of a living room with a kitchenette, three bedrooms, a bathroom and a separate WC. Located on floor 4 of 5, with an elevator. There is a balcony overlooking the courtyard. A storage room on the ground floor belongs to the apartment. Air conditioning is installed in the living room. Close to the Odra river and Nadodrze railway station. Mortgage-free, with a clear legal status. Available immediately.',
  features: ['air conditioning', 'elevator', 'security', 'storage room', 'balcony', 'dishwasher'],
  image: '/images/building-2.svg',
  publishedAt: '2026-08-16',
  contact: { name: 'Ewa Grabowska', email: 'ewa.grabowska@example.com' },
};

const raw1048: RawListing = {
  id: 1048,
  title: '2-room apartment, 48.5 m², Nadodrze',
  offerType: 'sale',
  propertyType: 'apartment',
  city: 'Wrocław',
  district: 'Nadodrze',
  address: 'ul. Roosevelta 2',
  price: 744000,
  currency: 'PLN',
  area: 48.5,
  rooms: 2,
  floor: 7,
  totalFloors: 9,
  yearBuilt: 2008,
  description:
    'Two-room apartment of 48.5 m² in a new building with a landscaped courtyard. The layout includes a living room with an open kitchen, a separate bedroom, a bathroom and a hallway with a built-in wardrobe. Located on floor 7 of 9, with an elevator. Close to the Odra river and Nadodrze railway station. Offer without commission for the buyer.',
  features: ['elevator', 'dishwasher'],
  image: '/images/building-4.svg',
  publishedAt: '2026-09-06',
  contact: { name: 'Ewa Grabowska', email: 'ewa.grabowska@example.com' },
};

// Address has no house number — must never be grouped
const raw1114: RawListing = {
  id: 1114,
  title: '1-room apartment, 32.9 m², Wola',
  offerType: 'sale',
  propertyType: 'apartment',
  city: 'Warsaw',
  district: null,
  address: 'ul. Kasprzaka',
  price: 615000,
  currency: 'PLN',
  area: 32.9,
  rooms: 1,
  floor: 0,
  totalFloors: 10,
  yearBuilt: 1969,
  description:
    'Functional one-room apartment in a well-maintained block from the 1960s. The apartment has one room with a kitchen annex, a bathroom and a small hallway. Ground floor apartment in a building with 10 floors. A west-facing balcony gets the afternoon sun. A parking space in the garage hall is available. The apartment is sold fully furnished and equipped. Close to the business district around Rondo Daszyńskiego. Ready to move in. Low monthly administrative fees.',
  features: ['elevator', 'furnished', 'balcony', 'parking'],
  image: '',
  publishedAt: '2026-07-10',
  contact: { name: 'Paweł Mazur', agency: 'Baltic Property', email: 'pawel.mazur@example.com' },
};

// ── helpers ──────────────────────────────────────────────────────────────────

function norm(raw: RawListing) {
  return normalizeListing(raw, ctx);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('markDuplicates', () => {
  it('1059 is canonical (newer publishedAt 2026-08-19 > 2026-07-13); 1016 gets duplicateOf = 1059', () => {
    const result = markDuplicates([norm(raw1016), norm(raw1059)]);
    const r1016 = result.find((l) => l.id === 1016)!;
    const r1059 = result.find((l) => l.id === 1059)!;
    expect(r1059.duplicateOf).toBeNull();
    expect(r1016.duplicateOf).toBe(1059);
  });

  it('1084 is canonical (newer publishedAt 2026-08-12 > 2026-07-23); 1027 gets duplicateOf = 1084', () => {
    const result = markDuplicates([norm(raw1027), norm(raw1084)]);
    const r1027 = result.find((l) => l.id === 1027)!;
    const r1084 = result.find((l) => l.id === 1084)!;
    expect(r1084.duplicateOf).toBeNull();
    expect(r1027.duplicateOf).toBe(1084);
  });

  it('1050 is canonical (tie on publishedAt 2026-09-19, lowest id wins); 1111 gets duplicateOf = 1050', () => {
    const result = markDuplicates([norm(raw1050), norm(raw1111)]);
    const r1050 = result.find((l) => l.id === 1050)!;
    const r1111 = result.find((l) => l.id === 1111)!;
    expect(r1050.duplicateOf).toBeNull();
    expect(r1111.duplicateOf).toBe(1050);
  });

  it('1047 and 1048 are not duplicates — same street, different flat number (Roosevelta 20 vs 2)', () => {
    const result = markDuplicates([norm(raw1047), norm(raw1048)]);
    const r1047 = result.find((l) => l.id === 1047)!;
    const r1048 = result.find((l) => l.id === 1048)!;
    expect(r1047.duplicateOf).toBeNull();
    expect(r1048.duplicateOf).toBeNull();
  });

  it('1114 is never marked — address has no house number', () => {
    // Pair 1114 with a second listing at the "same" address to prove it is never grouped
    const twin: RawListing = { ...raw1114, id: 9999 };
    const result = markDuplicates([norm(raw1114), norm(twin)]);
    expect(result.every((l) => l.duplicateOf === null)).toBe(true);
  });

  it('returns new objects and does not mutate the input', () => {
    const input = [norm(raw1016), norm(raw1059)];
    const before = input.map((l) => l.duplicateOf);
    markDuplicates(input);
    expect(input.map((l) => l.duplicateOf)).toEqual(before);
  });
});
