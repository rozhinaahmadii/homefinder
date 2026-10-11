import { describe, it, expect } from 'vitest';
import {
  parsePrice,
  parseArea,
  parseRooms,
  parseFloor,
  parseDate,
  stripDiacritics,
  normalizeCity,
  normalizeOfferType,
  normalizePropertyType,
  normalizeFeatures,
  normalizeTitle,
  normalizeAddress,
  normalizeListing,
  flagPriceOutliers,
} from './normalize';
import type { Listing, QualityFlag, RawListing } from './types';

// ─── parsePrice ───────────────────────────────────────────────────────────────

describe('parsePrice', () => {
  it('parses a plain integer string with no currency', () => {
    expect(parsePrice('4700')).toEqual({ amount: 4700, currency: null });
  });

  it('parses a space-separated number with zł suffix', () => {
    expect(parsePrice('1 096 000 zł')).toEqual({ amount: 1096000, currency: 'PLN' });
  });

  it('parses PLN prefix with comma as thousands separator', () => {
    expect(parsePrice('PLN 740,000')).toEqual({ amount: 740000, currency: 'PLN' });
  });

  it('parses tys. shorthand (460 tys. zł → 460 000)', () => {
    expect(parsePrice('460 tys. zł')).toEqual({ amount: 460000, currency: 'PLN' });
  });

  it('returns null amount and currency for null input', () => {
    expect(parsePrice(null)).toEqual({ amount: null, currency: null });
  });

  it('passes through a numeric value', () => {
    expect(parsePrice(2083000)).toEqual({ amount: 2083000, currency: null });
  });
});

// ─── parseArea ────────────────────────────────────────────────────────────────

describe('parseArea', () => {
  it('strips "m2" suffix', () => {
    expect(parseArea('199 m2')).toBe(199);
  });

  it('strips "sqm" suffix', () => {
    expect(parseArea('30 sqm')).toBe(30);
  });

  it('passes through a numeric value unchanged', () => {
    expect(parseArea(59.2)).toBe(59.2);
  });

  it('returns null for null input', () => {
    expect(parseArea(null)).toBeNull();
  });
});

// ─── parseRooms ───────────────────────────────────────────────────────────────

describe('parseRooms', () => {
  it('parses a string "1" to integer 1', () => {
    expect(parseRooms('1')).toBe(1);
  });

  it('returns null for undefined', () => {
    expect(parseRooms(undefined)).toBeNull();
  });

  it('passes through a numeric value', () => {
    expect(parseRooms(4)).toBe(4);
  });
});

// ─── parseFloor ───────────────────────────────────────────────────────────────

describe('parseFloor', () => {
  it('maps "parter" (Polish ground floor) to 0', () => {
    expect(parseFloor('parter')).toBe(0);
  });

  it('passes through numeric 0', () => {
    expect(parseFloor(0)).toBe(0);
  });

  it('passes through a positive floor number', () => {
    expect(parseFloor(14)).toBe(14);
  });

  it('returns null for null input', () => {
    expect(parseFloor(null)).toBeNull();
  });

  it('returns null for an unrecognised string', () => {
    expect(parseFloor('unknown')).toBeNull();
  });

  it('parses a numeric string "3" to integer 3', () => {
    expect(parseFloor('3')).toBe(3);
  });
});

// ─── parseDate ────────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('normalises DD/MM/YYYY to YYYY-MM-DD', () => {
    expect(parseDate('14/09/2026')).toBe('2026-09-14');
  });

  it('passes through a valid ISO date unchanged', () => {
    expect(parseDate('2026-08-30')).toBe('2026-08-30');
  });

  it('returns null for an unparseable string', () => {
    expect(parseDate('not a date')).toBeNull();
  });

  it('returns null for an impossible ISO date (month 13)', () => {
    expect(parseDate('2026-13-01')).toBeNull();
  });

  it('returns null for an impossible DD/MM/YYYY date (31 Feb)', () => {
    expect(parseDate('31/02/2026')).toBeNull();
  });
});

// ─── stripDiacritics ──────────────────────────────────────────────────────────

describe('stripDiacritics', () => {
  it('removes combining accents via NFD (Kraków → Krakow)', () => {
    expect(stripDiacritics('Kraków')).toBe('Krakow');
  });

  it('handles ł → l and ó → o (Łódź → Lodz)', () => {
    expect(stripDiacritics('Łódź')).toBe('Lodz');
  });

  it('handles ń → n (Gdańsk → Gdansk)', () => {
    expect(stripDiacritics('Gdańsk')).toBe('Gdansk');
  });

  it('handles ł → l (Wrocław → Wroclaw) and ń → n (Poznań → Poznan)', () => {
    expect(stripDiacritics('Wrocław')).toBe('Wroclaw');
    expect(stripDiacritics('Poznań')).toBe('Poznan');
  });

  it('strips ś, ó, ź (Śródmieście → Srodmiescie)', () => {
    expect(stripDiacritics('Śródmieście')).toBe('Srodmiescie');
  });

  it('strips Ż → Z (Żoliborz → Zoliborz)', () => {
    expect(stripDiacritics('Żoliborz')).toBe('Zoliborz');
  });

  it('passes ASCII strings through unchanged', () => {
    expect(stripDiacritics('Warsaw')).toBe('Warsaw');
  });
});

// ─── normalizeCity ────────────────────────────────────────────────────────────

describe('normalizeCity', () => {
  it('maps lowercase kraków to canonical Kraków', () => {
    expect(normalizeCity('kraków')).toBe('Kraków');
  });

  it('maps ALL CAPS WROCŁAW to canonical Wrocław', () => {
    expect(normalizeCity('WROCŁAW')).toBe('Wrocław');
  });

  it('trims trailing whitespace (Kraków with trailing space)', () => {
    expect(normalizeCity('Kraków ')).toBe('Kraków');
  });

  it('maps diacritic-stripped Gdansk to Gdańsk', () => {
    expect(normalizeCity('Gdansk')).toBe('Gdańsk');
  });

  it('title-cases an unknown city', () => {
    expect(normalizeCity('berlin')).toBe('Berlin');
  });

  it('title-cases a multi-word unknown city', () => {
    expect(normalizeCity('nowy sącz')).toBe('Nowy Sącz');
  });
});

// ─── normalizeOfferType ───────────────────────────────────────────────────────

describe('normalizeOfferType', () => {
  it('lowercases Sale to sale', () => {
    expect(normalizeOfferType('Sale')).toBe('sale');
  });

  it('passes through lowercase sale unchanged', () => {
    expect(normalizeOfferType('sale')).toBe('sale');
  });

  it('lowercases RENT to rent', () => {
    expect(normalizeOfferType('RENT')).toBe('rent');
  });
});

// ─── normalizePropertyType ────────────────────────────────────────────────────

describe('normalizePropertyType', () => {
  it('maps flat to apartment', () => {
    expect(normalizePropertyType('flat')).toBe('apartment');
  });

  it('passes through apartment unchanged', () => {
    expect(normalizePropertyType('apartment')).toBe('apartment');
  });

  it('lowercases unknown type', () => {
    expect(normalizePropertyType('House')).toBe('house');
  });
});

// ─── normalizeFeatures ────────────────────────────────────────────────────────

describe('normalizeFeatures', () => {
  it('maps Polish terms to English equivalents and sorts', () => {
    expect(normalizeFeatures(['winda', 'umeblowane', 'balkon', 'security'])).toEqual([
      'balcony',
      'elevator',
      'furnished',
      'security',
    ]);
  });

  it('maps capitalised English synonyms and dedupes', () => {
    expect(
      normalizeFeatures(['Balcony', 'dishwasher', 'Lift', 'basement', 'Parking space']),
    ).toEqual(['balcony', 'basement', 'dishwasher', 'elevator', 'parking']);
  });

  it('deduplicates after synonym mapping (elevator + winda → one elevator)', () => {
    expect(normalizeFeatures(['elevator', 'winda'])).toEqual(['elevator']);
  });

  it('returns empty array for empty input', () => {
    expect(normalizeFeatures([])).toEqual([]);
  });
});

// ─── normalizeTitle ───────────────────────────────────────────────────────────

describe('normalizeTitle', () => {
  it('lowercases a mostly-uppercase title and strips trailing OKAZJA and !!!', () => {
    expect(normalizeTitle('4-ROOM APARTMENT, 72 M², NADODRZE!!! OKAZJA')).toBe(
      '4-room apartment, 72 m², nadodrze',
    );
  });

  it('collapses internal whitespace', () => {
    expect(normalizeTitle('Nice  apartment   in Warsaw')).toBe('Nice apartment in Warsaw');
  });

  it('passes through a normal mixed-case title unchanged', () => {
    expect(normalizeTitle('Spacious 3-room apartment, Mokotów')).toBe(
      'Spacious 3-room apartment, Mokotów',
    );
  });
});

// ─── normalizeAddress ─────────────────────────────────────────────────────────

describe('normalizeAddress', () => {
  it('replaces "ulica " prefix with "ul. "', () => {
    expect(normalizeAddress('ulica Górna Wilda 179')).toBe('ul. Górna Wilda 179');
  });

  it('is case-insensitive for the ulica prefix', () => {
    expect(normalizeAddress('Ulica Długa 5')).toBe('ul. Długa 5');
  });

  it('leaves an already-abbreviated address unchanged', () => {
    expect(normalizeAddress('ul. Marszałkowska 1')).toBe('ul. Marszałkowska 1');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeAddress('  ul. Nowa 3  ')).toBe('ul. Nowa 3');
  });
});

// ─── normalizeListing ─────────────────────────────────────────────────────────

describe('normalizeListing', () => {
  const ctx = {
    today: '2026-10-10',
    imageFiles: new Set([
      '/images/building-1.svg',
      '/images/building-2.svg',
      '/images/building-5.svg',
      '/images/building-6.svg',
    ]),
  };

  const flags = (raw: RawListing) => normalizeListing(raw, ctx).flags.map((f) => f.code);

  it('1017: ROOMS_MISMATCH_TITLE — title says 4 rooms, field is 2', () => {
    const raw: RawListing = {
      id: 1017,
      title: '4-room apartment, 83 m², Bronowice',
      offerType: 'rent',
      propertyType: 'apartment',
      city: 'Kraków',
      district: 'Bronowice',
      address: 'ul. Rydla 99',
      price: 6400,
      currency: 'PLN',
      area: 83,
      rooms: 2,
      floor: 7,
      totalFloors: 10,
      yearBuilt: 1982,
      description:
        'Four-room apartment in a quiet building with a renovated staircase and new windows. Three bedrooms, a bright living room connected to the kitchen and a bathroom with a window. Located on floor 7 of 10, with an elevator. A storage room on the ground floor belongs to the apartment. The apartment is rented fully furnished and equipped. Close to shopping centres and the ring road. Rent plus administrative fees of approx. 650 PLN per month. Available from the beginning of next month.',
      features: ['storage room', 'furnished', 'elevator', 'pets allowed'],
      image: '/images/building-6.svg',
      publishedAt: '2026-07-18',
      contact: { name: 'Piotr Zieliński', agency: 'Metropolia Estates', email: 'piotr.zielinski@example.com' },
    };
    expect(flags(raw)).toEqual(['ROOMS_MISMATCH_TITLE']);
  });

  it('1019: no flags raised — price outlier is not yet detected', () => {
    const raw: RawListing = {
      id: 1019,
      title: '4-room apartment, 85.7 m², Żoliborz',
      offerType: 'sale',
      propertyType: 'apartment',
      city: 'Warsaw',
      district: 'Żoliborz',
      address: 'ul. Mickiewicza 123',
      price: 4500,
      currency: 'PLN',
      area: 85.7,
      rooms: 4,
      floor: 7,
      totalFloors: 11,
      yearBuilt: 2012,
      description:
        'Four-room apartment of 85.7 m² in a new building with a landscaped courtyard. Layout: a spacious living room, a separate kitchen, three bedrooms and a bathroom with a bathtub. Located on floor 7 of 11, with an elevator. An underground parking space is included in the price. The apartment is sold fully furnished and equipped. Air conditioning is installed in the living room. Close to Park Żeromskiego and Plac Wilsona. The apartment has its own land and mortgage register. Contact us to arrange a viewing.',
      features: ['air conditioning', 'furnished', 'parking', 'elevator'],
      image: '/images/building-2.svg',
      publishedAt: '2026-09-19',
      contact: { name: 'Joanna Krawczyk', agency: 'Dom i Ogród Nieruchomości', email: 'joanna.krawczyk@example.com' },
    };
    expect(flags(raw)).toEqual([]);
  });

  it('1044: FLOOR_EXCEEDS_TOTAL and FLOOR_MISMATCH_DESCRIPTION — field is 14, total is 4, description says floor 2', () => {
    const raw: RawListing = {
      id: 1044,
      title: 'Apartment in a historic tenement, Fabryczna',
      offerType: 'rent',
      propertyType: 'apartment',
      city: 'Wrocław',
      district: 'Fabryczna',
      address: 'ul. Legnicka 26',
      price: 6600,
      currency: 'PLN',
      area: 94,
      rooms: 5,
      floor: 14,
      totalFloors: 4,
      yearBuilt: 1935,
      description:
        'Bright five-room apartment in a renovated pre-war tenement on ul. Legnicka. Four bedrooms, a bright living room connected to the kitchen and a bathroom with a window. Located on floor 2 of 4. Balcony with a view of the greenery. Air conditioning is installed in the living room. Close to Magnolia Park and the western bypass. Utilities are paid separately according to consumption. A deposit equal to one month of rent is required.',
      features: ['air conditioning', 'balcony'],
      image: '/images/building-6.svg',
      publishedAt: '2026-06-29',
      contact: { name: 'Paweł Mazur', agency: 'Baltic Property', email: 'pawel.mazur@example.com' },
    };
    expect(flags(raw)).toEqual(['FLOOR_EXCEEDS_TOTAL', 'FLOOR_MISMATCH_DESCRIPTION']);
  });

  it('1055: FEATURE_CONTRADICTS_DESCRIPTION — features has elevator, description says without a lift', () => {
    const raw: RawListing = {
      id: 1055,
      title: '4-room apartment, 94.5 m², Praga-Północ',
      offerType: 'sale',
      propertyType: 'apartment',
      city: 'Warsaw',
      district: 'Praga-Północ',
      address: 'ul. Okrzei 166',
      price: 1850000,
      currency: 'PLN',
      area: 94.5,
      rooms: 4,
      floor: 3,
      totalFloors: 9,
      yearBuilt: 2014,
      description:
        'Four-room apartment of 94.5 m² in a new building with a landscaped courtyard. Three bedrooms, a bright living room connected to the kitchen and a bathroom with a window. Located on floor 3 of 9 in a building without a lift. A parking space in the garage hall is available. Close to the Vistula boulevards and Dworzec Wileński. Offer without commission for the buyer.',
      features: ['security', 'elevator', 'parking'],
      image: '/images/building-5.svg',
      publishedAt: '2026-08-28',
      contact: { name: 'Magdalena Kamińska', agency: 'Nova Home', email: 'magdalena.kaminska@example.com' },
    };
    expect(flags(raw)).toEqual(['FEATURE_CONTRADICTS_DESCRIPTION']);
  });

  it('1061: FLOOR_MISMATCH_DESCRIPTION — field is 0 (ground) but description says top floor', () => {
    const raw: RawListing = {
      id: 1061,
      title: '2 rooms with balcony – Ursynów',
      offerType: 'sale',
      propertyType: 'apartment',
      city: 'Warsaw',
      district: 'Ursynów',
      address: 'ul. Pileckiego 34',
      price: 679000,
      currency: 'PLN',
      area: 39.2,
      rooms: 2,
      floor: 0,
      totalFloors: 4,
      yearBuilt: 2018,
      description:
        'Finished to a high standard, this two-room apartment is located in a modern residential complex. The layout includes a living room with an open kitchen, a separate bedroom, a bathroom and a hallway with a built-in wardrobe. Located on the top floor with a panoramic view over the city. There is a balcony overlooking the courtyard. A basement storage unit is included. Close to Las Kabacki forest and the M1 metro line. Ready to move in. Low monthly administrative fees.',
      features: ['balcony', 'elevator', 'dishwasher', 'basement'],
      image: '/images/building-1.svg',
      publishedAt: '2026-09-06',
      contact: { name: 'Paweł Mazur', agency: 'Baltic Property', email: 'pawel.mazur@example.com' },
    };
    expect(flags(raw)).toEqual(['FLOOR_MISMATCH_DESCRIPTION']);
  });

  it('1067: AREA_MISMATCH_DESCRIPTION — field is 23.1 m² but description says 37 m²', () => {
    const raw: RawListing = {
      id: 1067,
      title: '2 rooms with balcony – Bronowice',
      offerType: 'sale',
      propertyType: 'apartment',
      city: 'Kraków',
      district: 'Bronowice',
      address: 'ul. Balicka 108A',
      price: 505000,
      currency: 'PLN',
      area: 23.1,
      rooms: 2,
      floor: 2,
      totalFloors: 12,
      yearBuilt: 2023,
      description:
        'Spacious apartment of 37 m² with a separate kitchen. The layout includes a living room with an open kitchen, a separate bedroom, a bathroom and a hallway with a built-in wardrobe. Located on floor 2 of 12, with an elevator. Balcony with a view of the greenery. Air conditioning is installed in the living room. Close to shopping centres and the ring road. Viewings available on weekdays after 5 pm and at weekends.',
      features: ['elevator', 'air conditioning', 'balcony', 'security'],
      image: '/images/building-6.svg',
      publishedAt: '2026-06-27',
      contact: { name: 'Anna Wiśniewska', agency: 'Dom i Ogród Nieruchomości', email: 'anna.wisniewska@example.com' },
    };
    expect(flags(raw)).toEqual(['AREA_MISMATCH_DESCRIPTION']);
  });

  it('1078: DATE_IN_FUTURE — publishedAt 2027-03-01 is after today 2026-10-10', () => {
    const raw: RawListing = {
      id: 1078,
      title: 'Apartment in a historic tenement, Widzew',
      offerType: 'sale',
      propertyType: 'apartment',
      city: 'Łódź',
      district: 'Widzew',
      address: 'ul. Piłsudskiego 27',
      price: 401000,
      currency: 'PLN',
      area: 40.2,
      rooms: 2,
      floor: 1,
      totalFloors: 3,
      yearBuilt: 1921,
      description:
        'Charming two-room apartment with high ceilings in a historic tenement house. The layout includes a living room with an open kitchen, a separate bedroom, a bathroom and a hallway with a built-in wardrobe. Located on floor 1 of 3. A basement storage unit is included. Close to the Widzew stadium and shopping centres. Viewings available on weekdays after 5 pm and at weekends.',
      features: ['basement', 'dishwasher', 'pets allowed'],
      image: '/images/building-5.svg',
      publishedAt: '2027-03-01',
      contact: { name: 'Krzysztof Piotrowski', email: 'krzysztof.piotrowski@example.com' },
    };
    expect(flags(raw)).toEqual(['DATE_IN_FUTURE']);
  });

  it('1112: ROOMS_MISSING and FLOOR_MISMATCH_DESCRIPTION — floor="parter" normalises to 0, description says floor 4', () => {
    const raw: RawListing = {
      id: 1112,
      title: 'Studio for rent in Psie Pole',
      offerType: 'rent',
      propertyType: 'studio',
      city: 'Wrocław',
      district: 'Psie Pole',
      address: 'ul. Kiełczowska 100C',
      price: 2000,
      currency: 'PLN',
      area: 22.5,
      floor: 'parter',
      totalFloors: 11,
      yearBuilt: 2016,
      description:
        'Compact studio on ul. Kiełczowska, ideal as a first apartment or an investment. Open-plan studio with a sleeping area, a kitchenette and a bathroom with a shower. Located on floor 4 of 11, with an elevator. Balcony with a view of the greenery. The apartment is rented fully furnished and equipped. Close to green areas and a new shopping centre. Rent plus administrative fees of approx. 650 PLN per month. Available from the beginning of next month.',
      features: ['elevator', 'balcony', 'furnished'],
      image: '/images/building-1.svg',
      publishedAt: '2026-08-23',
      contact: { name: 'Krzysztof Piotrowski', email: 'krzysztof.piotrowski@example.com' },
    };
    expect(flags(raw)).toEqual(['ROOMS_MISSING', 'FLOOR_MISMATCH_DESCRIPTION']);
  });

  it('1113: AREA_IMPLAUSIBLE — area is 3.45 m² (below 10 m² threshold)', () => {
    const raw: RawListing = {
      id: 1113,
      title: 'Sunny 1-room apartment in Ursynów',
      offerType: 'sale',
      propertyType: 'apartment',
      city: 'Warsaw',
      district: 'Ursynów',
      address: 'ul. Pileckiego 145',
      price: 598000,
      currency: 'PLN',
      area: 3.45,
      rooms: 1,
      floor: 7,
      totalFloors: 10,
      yearBuilt: 1972,
      description:
        'Functional one-room apartment in a well-maintained block from the 1970s. The apartment has one room with a kitchen annex, a bathroom and a small hallway. Located on floor 7 of 10, with an elevator. Balcony with a view of the greenery. A storage room on the ground floor belongs to the apartment. Close to Las Kabacki forest and the M1 metro line. Ready to move in. Low monthly administrative fees.',
      features: ['dishwasher', 'storage room', 'elevator', 'balcony'],
      image: '/images/building-2.svg',
      publishedAt: '2026-08-04',
      contact: { name: 'Joanna Krawczyk', agency: 'Dom i Ogród Nieruchomości', email: 'joanna.krawczyk@example.com' },
    };
    expect(flags(raw)).toEqual(['AREA_IMPLAUSIBLE']);
  });

  it('throws a ZodError when offerType is not a valid enum value', () => {
    expect(() =>
      normalizeListing(
        {
          id: 9001,
          title: 'Test',
          offerType: 'lease',
          propertyType: 'apartment',
          city: 'Warsaw',
          publishedAt: '2026-01-01',
          features: [],
        },
        ctx,
      ),
    ).toThrow();
  });

  it('null price does not raise any price-field flag', () => {
    const result = normalizeListing(
      {
        id: 9002,
        title: 'Test apartment',
        offerType: 'sale',
        propertyType: 'apartment',
        city: 'Warsaw',
        district: 'Mokotów',
        price: null,
        currency: null,
        publishedAt: '2026-01-01',
        features: [],
        image: '/images/building-1.svg',
        description: 'x'.repeat(40),
      },
      ctx,
    );
    expect(result.flags.map((f) => f.field)).not.toContain('price');
  });

  it('sets image to null and flags IMAGE_MISSING for an empty string image', () => {
    const result = normalizeListing(
      {
        id: 9003,
        title: 'Test apartment',
        offerType: 'sale',
        propertyType: 'apartment',
        city: 'Warsaw',
        district: 'Mokotów',
        price: 500000,
        currency: 'PLN',
        area: 50,
        rooms: 2,
        publishedAt: '2026-01-01',
        features: [],
        image: '',
        description: 'x'.repeat(40),
      },
      ctx,
    );
    expect(result.image).toBeNull();
    expect(result.flags.map((f) => f.code)).toContain('IMAGE_MISSING');
  });

  it('sets image to null and flags IMAGE_MISSING when image file is not in imageFiles', () => {
    const result = normalizeListing(
      {
        id: 9004,
        title: 'Test apartment',
        offerType: 'sale',
        propertyType: 'apartment',
        city: 'Warsaw',
        district: 'Mokotów',
        price: 500000,
        currency: 'PLN',
        area: 50,
        rooms: 2,
        publishedAt: '2026-01-01',
        features: [],
        image: '/images/nonexistent.svg',
        description: 'x'.repeat(40),
      },
      ctx,
    );
    expect(result.image).toBeNull();
    expect(result.flags.map((f) => f.code)).toContain('IMAGE_MISSING');
  });

  it('flags FLOOR_MISMATCH_DESCRIPTION when description starts with "Ground floor" and floor field is not 0', () => {
    const result = normalizeListing(
      {
        id: 9005,
        title: 'Test apartment',
        offerType: 'sale',
        propertyType: 'apartment',
        city: 'Warsaw',
        district: 'Mokotów',
        price: 500000,
        currency: 'PLN',
        area: 50,
        rooms: 2,
        floor: 3,
        totalFloors: 10,
        publishedAt: '2026-01-01',
        features: [],
        image: '/images/building-1.svg',
        description: 'Ground floor apartment with garden access. Very spacious and bright interior with high ceilings.',
      },
      ctx,
    );
    expect(result.flags.map((f) => f.code)).toContain('FLOOR_MISMATCH_DESCRIPTION');
  });

  it('does not flag FLOOR_MISMATCH_DESCRIPTION when description says "Ground floor" and floor field is 0', () => {
    const result = normalizeListing(
      {
        id: 9006,
        title: 'Test apartment',
        offerType: 'sale',
        propertyType: 'apartment',
        city: 'Warsaw',
        district: 'Mokotów',
        price: 500000,
        currency: 'PLN',
        area: 50,
        rooms: 2,
        floor: 0,
        totalFloors: 10,
        publishedAt: '2026-01-01',
        features: [],
        image: '/images/building-1.svg',
        description: 'Ground floor apartment with garden access. Very spacious and bright interior with high ceilings.',
      },
      ctx,
    );
    expect(result.flags.map((f) => f.code)).not.toContain('FLOOR_MISMATCH_DESCRIPTION');
  });

  it('1045: price field is unchanged after normalization (flag detection never changes a value)', () => {
    const raw: RawListing = {
      id: 1045,
      title: 'Cosy 4-room apartment in Śródmieście',
      offerType: 'sale',
      propertyType: 'apartment',
      city: 'Łódź',
      district: 'Śródmieście',
      address: 'ul. Zielona 36',
      price: 5950000,
      currency: 'PLN',
      area: 71,
      rooms: 4,
      floor: 9,
      totalFloors: 12,
      description:
        'Finished to a high standard, this four-room apartment is located in a modern residential complex. Layout: a spacious living room, a separate kitchen, three bedrooms and a bathroom with a bathtub. Located on floor 9 of 12, with an elevator. Balcony with a view of the greenery. Close to Piotrkowska Street and Łódź Fabryczna station. Offer without commission for the buyer.',
      features: ['balcony', 'elevator', 'pets allowed', 'dishwasher', 'security'],
      image: '/images/building-2.svg',
      publishedAt: '2026-08-29',
      contact: { name: 'Katarzyna Lewandowska', agency: 'Klucz Nieruchomości', email: 'katarzyna.lewandowska@example.com' },
    };
    const result = normalizeListing(raw, ctx);
    expect(result.price).toBe(5950000);
  });

  it('1018: parses "PLN 740,000" to price=740000 and currency="PLN" even with no currency field', () => {
    const raw: RawListing = {
      id: 1018,
      title: 'Quiet 3-room apartment in Stare Miasto',
      offerType: 'sale',
      propertyType: 'apartment',
      city: 'Poznań',
      district: 'Stare Miasto',
      address: 'ul. Woźna 42',
      price: 'PLN 740,000',
      area: 66,
      rooms: 3,
      floor: 10,
      totalFloors: 12,
      yearBuilt: 2022,
      description:
        'Modern three-room apartment in a recently completed development on ul. Woźna. Two bedrooms, a bright living room connected to the kitchen and a bathroom with a window. Located on floor 10 of 12, with an elevator. There is a balcony overlooking the courtyard. Air conditioning is installed in the living room. Close to the Old Market Square and Cytadela Park. Offer without commission for the buyer.',
      features: ['balcony', 'air conditioning', 'dishwasher', 'elevator'],
      image: '/images/building-2.svg',
      publishedAt: '2026-10-04',
      contact: { name: 'Krzysztof Piotrowski', email: 'krzysztof.piotrowski@example.com' },
    };
    const result = normalizeListing(raw, ctx);
    expect(result.price).toBe(740000);
    expect(result.currency).toBe('PLN');
  });

  it('pricePerM2 is computed for sale listings and null for rent', () => {
    const saleRaw: RawListing = {
      id: 1055,
      title: '4-room apartment, 94.5 m², Praga-Północ',
      offerType: 'sale',
      propertyType: 'apartment',
      city: 'Warsaw',
      district: 'Praga-Północ',
      address: 'ul. Okrzei 166',
      price: 1850000,
      currency: 'PLN',
      area: 94.5,
      rooms: 4,
      floor: 3,
      totalFloors: 9,
      yearBuilt: 2014,
      description:
        'Four-room apartment of 94.5 m² in a new building with a landscaped courtyard. Three bedrooms, a bright living room connected to the kitchen and a bathroom with a window. Located on floor 3 of 9 in a building without a lift. A parking space in the garage hall is available. Close to the Vistula boulevards and Dworzec Wileński. Offer without commission for the buyer.',
      features: ['security', 'elevator', 'parking'],
      image: '/images/building-5.svg',
      publishedAt: '2026-08-28',
      contact: { name: 'Magdalena Kamińska', agency: 'Nova Home', email: 'magdalena.kaminska@example.com' },
    };
    const rentRaw: RawListing = {
      id: 1017,
      title: '4-room apartment, 83 m², Bronowice',
      offerType: 'rent',
      propertyType: 'apartment',
      city: 'Kraków',
      district: 'Bronowice',
      address: 'ul. Rydla 99',
      price: 6400,
      currency: 'PLN',
      area: 83,
      rooms: 2,
      floor: 7,
      totalFloors: 10,
      yearBuilt: 1982,
      description:
        'Four-room apartment in a quiet building with a renovated staircase and new windows. Three bedrooms, a bright living room connected to the kitchen and a bathroom with a window. Located on floor 7 of 10, with an elevator. A storage room on the ground floor belongs to the apartment. The apartment is rented fully furnished and equipped. Close to shopping centres and the ring road. Rent plus administrative fees of approx. 650 PLN per month. Available from the beginning of next month.',
      features: ['storage room', 'furnished', 'elevator', 'pets allowed'],
      image: '/images/building-6.svg',
      publishedAt: '2026-07-18',
      contact: { name: 'Piotr Zieliński', agency: 'Metropolia Estates', email: 'piotr.zielinski@example.com' },
    };
    expect(normalizeListing(saleRaw, ctx).pricePerM2).toBe(Math.round(1850000 / 94.5));
    expect(normalizeListing(rentRaw, ctx).pricePerM2).toBeNull();
  });

  it('pricePerM2 is null for a non-PLN sale listing (1095 EUR)', () => {
    const raw: RawListing = {
      id: 1095,
      title: 'Spacious 2-room apartment in Śródmieście',
      offerType: 'sale',
      propertyType: 'apartment',
      city: 'Gdańsk',
      district: 'Śródmieście',
      address: 'ul. Chmielna 129',
      price: 173000,
      currency: 'EUR',
      area: 50.2,
      rooms: 2,
      floor: 0,
      totalFloors: 4,
      yearBuilt: 1981,
      description:
        'Two-room apartment in a quiet building with a renovated staircase and new windows. The layout includes a living room with an open kitchen, a separate bedroom, a bathroom and a hallway with a built-in wardrobe. Ground floor apartment in a building with 4 floors. There is a balcony overlooking the courtyard. A storage room on the ground floor belongs to the apartment. The apartment is sold fully furnished and equipped. Close to the Long Market and Motława riverside. The apartment has its own land and mortgage register. Contact us to arrange a viewing.',
      features: ['storage room', 'security', 'furnished', 'balcony'],
      image: '/images/building-4.svg',
      publishedAt: '2026-08-27',
      contact: { name: 'Ewa Grabowska', email: 'ewa.grabowska@example.com' },
    };
    const result = normalizeListing(raw, ctx);
    expect(result.currency).toBe('EUR');
    expect(result.pricePerM2).toBeNull();
  });
});

// ─── flagPriceOutliers ────────────────────────────────────────────────────────

describe('flagPriceOutliers', () => {
  // Minimal Listing factory — only the fields flagPriceOutliers reads matter.
  function listing(
    id: number,
    city: string,
    offerType: 'sale' | 'rent',
    price: number | null,
    area: number | null,
    currency: string | null = 'PLN',
    existingFlags: QualityFlag[] = [],
  ): Listing {
    return {
      id,
      title: '',
      offerType,
      propertyType: 'apartment',
      city,
      district: 'X',
      address: null,
      price,
      currency,
      area,
      rooms: null,
      floor: null,
      totalFloors: null,
      yearBuilt: null,
      pricePerM2: price !== null && area !== null ? Math.round(price / area) : null,
      description: 'x'.repeat(40),
      features: [],
      image: null,
      publishedAt: null,
      contact: undefined,
      flags: existingFlags,
      duplicateOf: null,
    };
  }

  const areaImplausibleFlag: QualityFlag = { field: 'area', code: 'AREA_IMPLAUSIBLE', message: 'Area is implausible.' };

  // Warsaw / sale group — real price + area values from the dataset.
  // 1019 (price=4500, area=85.7) has ppm2≈53, far below the group median ≈18064.
  // 1113 carries AREA_IMPLAUSIBLE and must be excluded from both median and flagging.
  const warsawSale: Listing[] = [
    listing(1001, 'Warsaw', 'sale', 2083000, 113),        // ppm2 ≈ 18434
    listing(1010, 'Warsaw', 'sale', 1720000, 119),        // ppm2 ≈ 14454
    listing(1019, 'Warsaw', 'sale', 4500, 85.7),          // ppm2 ≈ 53 — outlier
    listing(1022, 'Warsaw', 'sale', 1647000, 72.5),       // ppm2 ≈ 22717
    listing(1025, 'Warsaw', 'sale', 1097000, 65.7),       // ppm2 ≈ 16697
    listing(1032, 'Warsaw', 'sale', 552000, 29.8),        // ppm2 ≈ 18523
    listing(1035, 'Warsaw', 'sale', 1681000, 95),         // ppm2 ≈ 17695
    listing(1042, 'Warsaw', 'sale', 1188000, 59.7),       // ppm2 ≈ 19899
    listing(1113, 'Warsaw', 'sale', 598000, 3.45, 'PLN', [areaImplausibleFlag]), // excluded
  ];

  // Łódź / sale group — all 9 real records.
  // 1045 (price=5950000, area=71) has ppm2≈83803, far above the group median ≈9833.
  const lodzSale: Listing[] = [
    listing(1002, 'Łódź', 'sale', 267000, 26),    // ppm2 ≈ 10269
    listing(1016, 'Łódź', 'sale', 295000, 30),    // ppm2 ≈ 9833
    listing(1024, 'Łódź', 'sale', 1435000, 199),  // ppm2 ≈ 7211
    listing(1045, 'Łódź', 'sale', 5950000, 71),   // ppm2 ≈ 83803 — outlier
    listing(1059, 'Łódź', 'sale', 295000, 30),    // ppm2 ≈ 9833
    listing(1078, 'Łódź', 'sale', 401000, 40.2),  // ppm2 ≈ 9975
    listing(1081, 'Łódź', 'sale', 758000, 130),   // ppm2 ≈ 5831
    listing(1093, 'Łódź', 'sale', 407000, 52.7),  // ppm2 ≈ 7723
    listing(1105, 'Łódź', 'sale', 448000, 46.2),  // ppm2 ≈ 9697
  ];

  it('1019 is flagged PRICE_IMPLAUSIBLE — ppm2≈53 is far below Warsaw/sale median', () => {
    const result = flagPriceOutliers(warsawSale);
    const r1019 = result.find((l) => l.id === 1019)!;
    expect(r1019.flags.map((f) => f.code)).toContain('PRICE_IMPLAUSIBLE');
  });

  it('1045 is flagged PRICE_IMPLAUSIBLE — ppm2≈83803 is far above Łódź/sale median', () => {
    const result = flagPriceOutliers(lodzSale);
    const r1045 = result.find((l) => l.id === 1045)!;
    expect(r1045.flags.map((f) => f.code)).toContain('PRICE_IMPLAUSIBLE');
  });

  it('1113 is not given PRICE_IMPLAUSIBLE — already has AREA_IMPLAUSIBLE', () => {
    const result = flagPriceOutliers(warsawSale);
    const r1113 = result.find((l) => l.id === 1113)!;
    expect(r1113.flags.map((f) => f.code)).not.toContain('PRICE_IMPLAUSIBLE');
    expect(r1113.flags.map((f) => f.code)).toContain('AREA_IMPLAUSIBLE');
  });

  it('a normal listing within 3× of the median is not flagged', () => {
    const result = flagPriceOutliers(warsawSale);
    const r1001 = result.find((l) => l.id === 1001)!; // ppm2≈18434, well within bounds
    expect(r1001.flags.map((f) => f.code)).not.toContain('PRICE_IMPLAUSIBLE');
  });

  it('groups with fewer than 3 eligible listings get no flags', () => {
    const tinyGroup: Listing[] = [
      listing(1, 'X', 'sale', 100000, 50),
      listing(2, 'X', 'sale', 1, 50), // outlier, but group too small
    ];
    const result = flagPriceOutliers(tinyGroup);
    expect(result[1].flags.map((f) => f.code)).not.toContain('PRICE_IMPLAUSIBLE');
  });

  it('listings with duplicateOf set are not counted in the median and not flagged', () => {
    // ppm2 = 100/50 = 2 — far below the group median; would be flagged if not skipped
    const dup = { ...listing(99, 'TestCity', 'sale', 100, 50), duplicateOf: 1 };
    const group = [
      listing(1, 'TestCity', 'sale', 900000, 50),   // ppm2 = 18000
      listing(2, 'TestCity', 'sale', 950000, 50),   // ppm2 = 19000
      listing(3, 'TestCity', 'sale', 1000000, 50),  // ppm2 = 20000
      dup,
    ];
    const result = flagPriceOutliers(group);
    expect(result.find((l) => l.id === 99)!.flags.map((f) => f.code)).not.toContain('PRICE_IMPLAUSIBLE');
  });

  it('does not mutate the input listings', () => {
    const before = warsawSale.map((l) => l.flags.length);
    flagPriceOutliers(warsawSale);
    const after = warsawSale.map((l) => l.flags.length);
    expect(after).toEqual(before);
  });
});
