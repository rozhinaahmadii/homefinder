import Database from 'better-sqlite3';
import { z } from 'zod';
import { ListingSchema } from '../src/core/types';
import type { Listing } from '../src/core/types';

export const db = new Database(process.env.DB_PATH ?? 'data/homefinder.db');

export function createSchema(): void {
  db.exec(`
    DROP TABLE IF EXISTS listings;
    CREATE TABLE listings (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      offer_type TEXT NOT NULL,
      property_type TEXT NOT NULL,
      city TEXT NOT NULL,
      district TEXT,
      address TEXT,
      price REAL,
      currency TEXT,
      area REAL,
      rooms INTEGER,
      floor INTEGER,
      total_floors INTEGER,
      year_built INTEGER,
      price_per_m2 REAL,
      description TEXT NOT NULL,
      image TEXT,
      published_at TEXT,
      duplicate_of INTEGER,
      features TEXT NOT NULL,
      flags TEXT NOT NULL,
      contact TEXT,
      raw TEXT NOT NULL
    );
    CREATE INDEX idx_listings_city ON listings(city);
    CREATE INDEX idx_listings_offer ON listings(offer_type);
  `);
}

export function insertListings(rows: { listing: Listing; raw: unknown }[]): void {
  const insert = db.prepare(`
    INSERT INTO listings (
      id, title, offer_type, property_type, city, district, address,
      price, currency, area, rooms, floor, total_floors, year_built,
      price_per_m2, description, image, published_at, duplicate_of,
      features, flags, contact, raw
    ) VALUES (
      @id, @title, @offer_type, @property_type, @city, @district, @address,
      @price, @currency, @area, @rooms, @floor, @total_floors, @year_built,
      @price_per_m2, @description, @image, @published_at, @duplicate_of,
      @features, @flags, @contact, @raw
    )
  `);

  const insertAll = db.transaction((rows: { listing: Listing; raw: unknown }[]) => {
    for (const { listing: l, raw } of rows) {
      insert.run({
        id: l.id,
        title: l.title,
        offer_type: l.offerType,
        property_type: l.propertyType,
        city: l.city,
        district: l.district ?? null,
        address: l.address ?? null,
        price: l.price ?? null,
        currency: l.currency ?? null,
        area: l.area ?? null,
        rooms: l.rooms ?? null,
        floor: l.floor ?? null,
        total_floors: l.totalFloors ?? null,
        year_built: l.yearBuilt ?? null,
        price_per_m2: l.pricePerM2 ?? null,
        description: l.description,
        image: l.image ?? null,
        published_at: l.publishedAt ?? null,
        duplicate_of: l.duplicateOf ?? null,
        features: JSON.stringify(l.features),
        flags: JSON.stringify(l.flags),
        contact: l.contact !== undefined ? JSON.stringify(l.contact) : null,
        raw: JSON.stringify(raw),
      });
    }
  });

  insertAll(rows);
}

function rowToListing(row: Record<string, unknown>): Listing {
  return ListingSchema.parse({
    id: row.id,
    title: row.title,
    offerType: row.offer_type,
    propertyType: row.property_type,
    city: row.city,
    district: row.district ?? null,
    address: row.address ?? null,
    price: row.price ?? null,
    currency: row.currency ?? null,
    area: row.area ?? null,
    rooms: row.rooms ?? null,
    floor: row.floor ?? null,
    totalFloors: row.total_floors ?? null,
    yearBuilt: row.year_built ?? null,
    pricePerM2: row.price_per_m2 ?? null,
    description: row.description,
    image: row.image ?? null,
    publishedAt: row.published_at ?? null,
    duplicateOf: row.duplicate_of ?? null,
    features: JSON.parse(row.features as string),
    flags: JSON.parse(row.flags as string),
    contact: row.contact !== null ? JSON.parse(row.contact as string) : undefined,
  });
}

const CountRowSchema = z.object({ count: z.number().int() });

export function countListings(): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM listings').get();
  return CountRowSchema.parse(row).count;
}

export function getAllListings(): Listing[] {
  const rows = db.prepare('SELECT * FROM listings').all() as Record<string, unknown>[];
  return rows.map(rowToListing);
}

export function getListingById(id: number): Listing | undefined {
  const row = db.prepare('SELECT * FROM listings WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row !== undefined ? rowToListing(row) : undefined;
}
