import { describe, it, expect } from 'vitest';
import { ingestRecords } from './ingest';

const ctx = {
  today: '2026-10-10',
  imageFiles: new Set(['/images/building-6.svg']),
};

// copied verbatim from data/listings.raw.json
const raw1001 = {
  id: 1001,
  title: '5 rooms with balcony – Żoliborz',
  offerType: 'sale',
  propertyType: 'apartment',
  city: 'Warsaw',
  district: 'Żoliborz',
  address: 'ul. Krasińskiego 80',
  price: 2083000,
  currency: 'PLN',
  area: 113,
  rooms: 5,
  floor: 6,
  totalFloors: 11,
  yearBuilt: 2009,
  description:
    'Five-room apartment of 113 m² in a new building with a landscaped courtyard. Four bedrooms, a bright living room connected to the kitchen and a bathroom with a window. Located on floor 6 of 11, with an elevator. There is a balcony overlooking the courtyard. A parking space in the garage hall is available. A basement storage unit is included. Close to Park Żeromskiego and Plac Wilsona. The apartment has its own land and mortgage register. Contact us to arrange a viewing.',
  features: ['basement', 'balcony', 'security', 'elevator', 'parking'],
  image: '/images/building-6.svg',
  publishedAt: '2026-08-30',
  contact: { name: 'Tomasz Wójcik', agency: 'Metropolia Estates', email: 'tomasz.wojcik@example.com' },
};

describe('ingestRecords', () => {
  it('rejects a null record and still loads the valid one', () => {
    const { rows, rejected } = ingestRecords([null, raw1001], ctx);
    expect(rows).toHaveLength(1);
    expect(rows[0].listing.id).toBe(1001);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].id).toBe('unknown id (record 1)');
  });

  it('keeps each listing paired with its own raw record', () => {
    const { rows } = ingestRecords([null, raw1001], ctx);
    expect(rows[0].raw).toBe(raw1001);
  });

  it('reports non-object records and records without an id by position', () => {
    const { rows, rejected } = ingestRecords(['text', 42, { title: 'no id' }], ctx);
    expect(rows).toHaveLength(0);
    expect(rejected.map((r) => r.id)).toEqual([
      'unknown id (record 1)',
      'unknown id (record 2)',
      'unknown id (record 3)',
    ]);
  });

  it('reports an invalid record by its id', () => {
    const { rows, rejected } = ingestRecords([{ ...raw1001, offerType: 'lease' }], ctx);
    expect(rows).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].id).toBe('1001');
  });
});
