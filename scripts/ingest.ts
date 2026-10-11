import { readFileSync, readdirSync } from 'node:fs';
import { z } from 'zod';
import { ingestRecords } from '../src/core/ingest';
import { createSchema, insertListings } from '../server/db';

const RAW_PATH = 'data/listings.raw.json';

// ── 1. Read raw data ──────────────────────────────────────────────────────────

const rawData = z.array(z.unknown()).safeParse(JSON.parse(readFileSync(RAW_PATH, 'utf8')));
if (!rawData.success) {
  console.error(`${RAW_PATH} must contain a JSON array of listings. Nothing was imported.`);
  process.exit(1);
}

// ── 2. Build image set ────────────────────────────────────────────────────────

const imageFiles = new Set(readdirSync('public/images').map((f) => `/images/${f}`));
const today = new Date().toISOString().slice(0, 10);

// ── 3. Normalize, mark duplicates, flag price outliers ───────────────────────

const { rows, rejected } = ingestRecords(rawData.data, { today, imageFiles });

// ── 4. Write to database ──────────────────────────────────────────────────────

createSchema();
insertListings(rows);

// ── 5. Summary ────────────────────────────────────────────────────────────────

const listings = rows.map((row) => row.listing);
const duplicates = listings.filter((l) => l.duplicateOf !== null);

const flagsByCode = new Map<string, number[]>();
for (const l of listings) {
  for (const f of l.flags) {
    const ids = flagsByCode.get(f.code) ?? [];
    ids.push(l.id);
    flagsByCode.set(f.code, ids);
  }
}

const pad = (s: string, n: number) => s.padEnd(n);

console.log(`${pad('Read:', 12)} ${rawData.data.length}`);
console.log(`${pad('Inserted:', 12)} ${listings.length}`);
console.log(`${pad('Rejected:', 12)} ${rejected.length}`);
for (const r of rejected) {
  console.log(`  ${r.id}: ${r.reason}`);
}

console.log(`\nDuplicates (${duplicates.length}):`);
for (const l of duplicates) {
  console.log(`  ${l.id} → ${l.duplicateOf}`);
}

console.log(`\nFlags by code:`);
for (const [code, ids] of [...flagsByCode.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`  ${pad(code + ':', 34)} ${ids.sort((a, b) => a - b).join(', ')}`);
}
