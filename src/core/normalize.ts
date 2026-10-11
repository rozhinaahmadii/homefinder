import { ListingSchema, type RawListing, type Listing, type QualityFlag } from './types';

export function stripDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L');
}

export function parsePrice(raw: unknown): { amount: number | null; currency: string | null } {
  if (raw === null || raw === undefined || raw === '') return { amount: null, currency: null };
  if (typeof raw === 'number') return { amount: Number.isFinite(raw) ? raw : null, currency: null };

  const text = String(raw).toLowerCase();
  const currency = /zł|pln/.test(text) ? 'PLN' : /eur|€/.test(text) ? 'EUR' : null;
  const match = text.match(/\d[\d\s.,]*/);
  if (!match) return { amount: null, currency };

  const digits = match[0]
    .replace(/\s/g, '')
    .replace(/[.,](?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
    .replace(/\.$/, '');
  const value = Number(digits);
  if (!Number.isFinite(value)) return { amount: null, currency };
  return { amount: /tys/.test(text) ? value * 1000 : value, currency };
}

export function parseArea(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const m = raw.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function parseRooms(raw: unknown): number | null {
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

export function parseFloor(raw: unknown): number | null {
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return null;
  if (raw.toLowerCase() === 'parter') return 0;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

export function parseDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let iso: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    iso = raw;
  } else {
    const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) iso = `${m[3]}-${m[2]}-${m[1]}`;
  }
  if (!iso) return null;
  const [y, mo, d] = iso.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? iso : null;
}

const CITY_MAP = new Map<string, string>([
  ['warsaw', 'Warsaw'],
  ['krakow', 'Kraków'],
  ['gdansk', 'Gdańsk'],
  ['wroclaw', 'Wrocław'],
  ['poznan', 'Poznań'],
  ['lodz', 'Łódź'],
]);

export function normalizeCity(raw: string): string {
  const key = stripDiacritics(raw.trim()).toLowerCase();
  const canonical = CITY_MAP.get(key);
  if (canonical) return canonical;
  return raw.trim().replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export function normalizeOfferType(raw: string): string {
  return raw.trim().toLowerCase();
}

const PROPERTY_TYPE_MAP = new Map<string, string>([['flat', 'apartment']]);

export function normalizePropertyType(raw: string): string {
  const lower = raw.trim().toLowerCase();
  return PROPERTY_TYPE_MAP.get(lower) ?? lower;
}

const FEATURE_MAP = new Map<string, string>([
  ['winda', 'elevator'],
  ['lift', 'elevator'],
  ['balkon', 'balcony'],
  ['umeblowane', 'furnished'],
  ['parking space', 'parking'],
]);

export function normalizeFeatures(raw: string[]): string[] {
  const mapped = raw.map((f) => {
    const lower = f.trim().toLowerCase();
    return FEATURE_MAP.get(lower) ?? lower;
  });
  return [...new Set(mapped)].sort();
}

const PROMO_SUFFIX = /[\s!]*(?:\s+(?:okazja|promocja|super oferta|must see))+[\s!]*$/i;

export function normalizeTitle(raw: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  const letters = collapsed.match(/\p{L}/gu) ?? [];
  const upper = collapsed.match(/\p{Lu}/gu) ?? [];
  if (letters.length > 0 && upper.length / letters.length > 0.6) {
    return collapsed
      .toLowerCase()
      .replace(PROMO_SUFFIX, '')
      .replace(/!{2,}/g, '')
      .trim();
  }
  return collapsed;
}

export function normalizeAddress(raw: string): string {
  return raw.trim().replace(/^ulica\s+/i, 'ul. ').replace(/\s+/g, ' ');
}

export function detectFlags(
  listing: Omit<Listing, 'flags'>,
  context: { today: string; imageFiles: Set<string> },
): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const desc = listing.description.toLowerCase();

  if (listing.currency !== null && listing.currency !== 'PLN') {
    flags.push({ field: 'currency', code: 'CURRENCY_NOT_PLN', message: `Currency is ${listing.currency}, expected PLN.` });
  }

  if (listing.area !== null && (listing.area < 10 || listing.area > 1000)) {
    flags.push({ field: 'area', code: 'AREA_IMPLAUSIBLE', message: `Area ${listing.area} m² is outside the plausible range (10–1000 m²).` });
  }

  if (listing.rooms === null) {
    flags.push({ field: 'rooms', code: 'ROOMS_MISSING', message: 'Number of rooms is missing.' });
  }

  const titleRoomsMatch = listing.title.match(/(\d+)[\s-]rooms?/i);
  if (titleRoomsMatch && listing.rooms !== null) {
    const titleRooms = parseInt(titleRoomsMatch[1], 10);
    if (titleRooms !== listing.rooms) {
      flags.push({ field: 'rooms', code: 'ROOMS_MISMATCH_TITLE', message: `Title implies ${titleRooms} rooms but field is ${listing.rooms}.` });
    }
  }

  if (listing.floor !== null && listing.totalFloors !== null && listing.floor > listing.totalFloors) {
    flags.push({ field: 'floor', code: 'FLOOR_EXCEEDS_TOTAL', message: `Floor ${listing.floor} exceeds total floors ${listing.totalFloors}.` });
  }

  const floorInDescMatch = desc.match(/located on (?:the )?floor\s+(\d+)\s+of\s+\d+/);
  if (floorInDescMatch && listing.floor !== null) {
    const descFloor = parseInt(floorInDescMatch[1], 10);
    if (descFloor !== listing.floor) {
      flags.push({ field: 'floor', code: 'FLOOR_MISMATCH_DESCRIPTION', message: `Description says floor ${descFloor} but field is ${listing.floor}.` });
    }
  }
  if (
    /located on (?:the )?ground floor|(?:^|[.!?]\s+)ground floor/m.test(desc) &&
    listing.floor !== null &&
    listing.floor !== 0
  ) {
    flags.push({ field: 'floor', code: 'FLOOR_MISMATCH_DESCRIPTION', message: `Description says ground floor but field is ${listing.floor}.` });
  }
  if (/located on (?:the )?top floor/.test(desc) && listing.floor !== null && listing.totalFloors !== null && listing.floor !== listing.totalFloors) {
    flags.push({ field: 'floor', code: 'FLOOR_MISMATCH_DESCRIPTION', message: `Description says top floor but field is ${listing.floor} (total: ${listing.totalFloors}).` });
  }

  const areaInDescMatch = desc.match(/(\d+(?:[.,]\d+)?)\s*m²/);
  if (areaInDescMatch && listing.area !== null) {
    const descArea = parseFloat(areaInDescMatch[1].replace(',', '.'));
    if (Math.abs(descArea - listing.area) / listing.area > 0.1) {
      flags.push({ field: 'area', code: 'AREA_MISMATCH_DESCRIPTION', message: `Description says ${descArea} m² but field is ${listing.area} m².` });
    }
  }

  if (listing.features.includes('elevator') && /without\s+(?:a\s+)?lift|no\s+lift|without\s+an?\s+elevator|no\s+elevator/i.test(desc)) {
    flags.push({ field: 'features', code: 'FEATURE_CONTRADICTS_DESCRIPTION', message: 'Features include elevator but description says without a lift.' });
  }

  if (listing.publishedAt !== null && listing.publishedAt > context.today) {
    flags.push({ field: 'publishedAt', code: 'DATE_IN_FUTURE', message: `Published date ${listing.publishedAt} is in the future.` });
  }

  if (listing.image === null) {
    flags.push({ field: 'image', code: 'IMAGE_MISSING', message: 'No image provided.' });
  }

  if (listing.description.length < 40) {
    flags.push({ field: 'description', code: 'DESCRIPTION_THIN', message: `Description is too short (${listing.description.length} chars).` });
  }

  if (!listing.district) {
    flags.push({ field: 'district', code: 'LOCATION_INCOMPLETE', message: 'District is missing.' });
  }

  return flags;
}

export function normalizeListing(
  raw: RawListing,
  context: { today: string; imageFiles: Set<string> },
): Listing {
  const id = typeof raw.id === 'string' ? parseInt(raw.id, 10) : Number(raw.id);
  const { amount: price, currency: parsedCurrency } = parsePrice(raw.price);
  const area = parseArea(raw.area);
  const rooms = parseRooms(raw.rooms);
  const floor = parseFloor(raw.floor);
  const publishedAt = parseDate(raw.publishedAt);
  const offerType = normalizeOfferType(raw.offerType);
  const propertyType = normalizePropertyType(raw.propertyType);
  const city = normalizeCity(raw.city);
  const features = normalizeFeatures(raw.features);
  const title = normalizeTitle(raw.title);
  const address = raw.address != null ? normalizeAddress(raw.address) : null;
  const currency = parsedCurrency ?? raw.currency ?? null;
  const pricePerM2 = offerType === 'sale' && price !== null && area !== null && currency === 'PLN' ? Math.round(price / area) : null;
  const rawImage = raw.image ?? null;
  const image = rawImage && context.imageFiles.has(rawImage) ? rawImage : null;

  const base = ListingSchema.parse({
    id,
    title,
    offerType,
    propertyType,
    city,
    district: raw.district ?? null,
    address,
    price,
    currency,
    area,
    rooms,
    floor,
    totalFloors: raw.totalFloors ?? null,
    yearBuilt: raw.yearBuilt ?? null,
    pricePerM2,
    description: raw.description ?? '',
    features,
    image,
    publishedAt,
    contact: raw.contact,
    flags: [],
    duplicateOf: null,
  });

  return { ...base, flags: detectFlags(base, context) };
}

function computeMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function priceValue(l: Listing): number | null {
  if (l.price === null || l.currency !== 'PLN') return null;
  return l.offerType === 'sale' ? (l.area !== null ? l.price / l.area : null) : l.price;
}

export function flagPriceOutliers(listings: Listing[]): Listing[] {
  const skip = (l: Listing) =>
    l.duplicateOf !== null || l.flags.some((f) => f.code === 'AREA_IMPLAUSIBLE');

  const groupValues = new Map<string, number[]>();
  for (const l of listings) {
    if (skip(l)) continue;
    const value = priceValue(l);
    if (value === null) continue;
    const key = `${l.city}|${l.offerType}`;
    const group = groupValues.get(key);
    if (group) group.push(value);
    else groupValues.set(key, [value]);
  }

  const groupMedians = new Map<string, number>();
  for (const [key, values] of groupValues) {
    if (values.length >= 3) groupMedians.set(key, computeMedian(values));
  }

  return listings.map((l) => {
    if (skip(l)) return l;
    const value = priceValue(l);
    if (value === null) return l;
    const med = groupMedians.get(`${l.city}|${l.offerType}`);
    if (med === undefined) return l;
    if (value > med * 3 || value < med / 3) {
      const label = l.offerType === 'sale' ? 'Price per m²' : 'Price';
      const flag: QualityFlag = {
        field: 'price',
        code: 'PRICE_IMPLAUSIBLE',
        message: `${label} (${Math.round(value)}) is more than 3× or less than ⅓ of the ${l.city} ${l.offerType} median (${Math.round(med)}).`,
      };
      return { ...l, flags: [...l.flags, flag] };
    }
    return l;
  });
}
