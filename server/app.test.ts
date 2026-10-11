import { vi, describe, it, expect, beforeAll, afterEach } from 'vitest';

vi.hoisted(() => {
  process.env.DB_PATH = ':memory:';
});

import { readFileSync } from 'node:fs';
import { app, createApp } from './app';
import type { AssistantResult } from './agent';
import { createSchema, insertListings } from './db';
import { RawListingSchema } from '../src/core/types';
import type { Listing } from '../src/core/types';
import { normalizeListing } from '../src/core/normalize';
import { markDuplicates } from '../src/core/dedupe';

const CTX = { today: '2026-10-10', imageFiles: new Set<string>() };
const SEED_IDS = [1001, 1016, 1037, 1052, 1059];

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

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('GET /api/health', () => {
  it('returns { ok: true }', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('GET /api/listings', () => {
  it('returns total and items for all non-duplicate listings', async () => {
    const res = await app.request('/api/listings');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; items: Listing[] };
    // 5 seeded, 1016 is a duplicate → 4 non-duplicates
    expect(body.total).toBe(4);
    expect(body.items).toHaveLength(4);
    expect(body.items.every((l) => l.duplicateOf === null)).toBe(true);
  });

  it('city=krakow filters diacritic-insensitively and returns Kraków listings', async () => {
    const res = await app.request('/api/listings?city=krakow');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; items: Listing[] };
    expect(body.total).toBe(2);
    expect(body.items.map((l) => l.id).sort((a, b) => a - b)).toEqual([1037, 1052]);
    for (const l of body.items) expect(l.city).toBe('Kraków');
  });

  it('empty city= parameter is ignored', async () => {
    const res = await app.request('/api/listings?city=');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; items: Listing[] };
    // same result as no filter
    expect(body.total).toBe(4);
  });

  it('features query param is split on commas', async () => {
    const res = await app.request('/api/listings?features=elevator,dishwasher');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; items: Listing[] };
    expect(body.total).toBeGreaterThan(0);
    for (const l of body.items) {
      expect(l.features).toContain('elevator');
      expect(l.features).toContain('dishwasher');
    }
  });

  it('minRooms=abc returns 400 with Zod issues', async () => {
    const res = await app.request('/api/listings?minRooms=abc');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { issues: unknown[] };
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues.length).toBeGreaterThan(0);
  });
});

describe('GET /api/listings/:id', () => {
  it('returns the listing for a valid id', async () => {
    const res = await app.request('/api/listings/1001');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Listing;
    expect(body.id).toBe(1001);
    expect(body.city).toBe('Warsaw');
  });

  it('duplicate listing is reachable by id', async () => {
    const res = await app.request('/api/listings/1016');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Listing;
    expect(body.id).toBe(1016);
    expect(body.duplicateOf).toBe(1059);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await app.request('/api/listings/9999');
    expect(res.status).toBe(404);
  });

  it('returns 400 for a non-numeric id', async () => {
    const res = await app.request('/api/listings/abc');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/meta', () => {
  it('returns sorted cities without city-string variants', async () => {
    const res = await app.request('/api/meta');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cities: string[]; features: string[] };
    // "kraków" and "Kraków " both normalize to "Kraków" → appears once
    expect(body.cities).toContain('Kraków');
    expect(body.cities.filter((c) => c === 'Kraków')).toHaveLength(1);
    // sorted
    expect(body.cities).toEqual([...body.cities].sort());
  });

  it('returns sorted features', async () => {
    const res = await app.request('/api/meta');
    const body = (await res.json()) as { cities: string[]; features: string[] };
    expect(body.features.length).toBeGreaterThan(0);
    expect(body.features).toEqual([...body.features].sort());
  });

  it('cities and features exclude duplicate listings', async () => {
    // 1016 is a duplicate; its features (dishwasher) also appear in 1059, so no change
    // but its city (Łódź) also comes from 1059 — verify 1016 does not inflate the count
    const res = await app.request('/api/meta');
    const body = (await res.json()) as { cities: string[]; features: string[] };
    // Łódź comes from 1059 (canonical), not 1016 (duplicate)
    expect(body.cities).toContain('Łódź');
    // only 3 distinct cities: Kraków, Łódź, Warsaw
    expect(body.cities).toHaveLength(3);
  });

  it('reports assistantEnabled true when both variables are set', async () => {
    configureAssistant();
    const res = await app.request('/api/meta');
    const body = (await res.json()) as { assistantEnabled: boolean };
    expect(body.assistantEnabled).toBe(true);
  });

  it('reports assistantEnabled false when either variable is missing', async () => {
    configureAssistant();
    vi.stubEnv('GEMINI_API_KEY', undefined);
    const withoutKey = (await (await app.request('/api/meta')).json()) as { assistantEnabled: boolean };
    expect(withoutKey.assistantEnabled).toBe(false);

    configureAssistant();
    vi.stubEnv('GEMINI_MODEL', undefined);
    const withoutModel = (await (await app.request('/api/meta')).json()) as { assistantEnabled: boolean };
    expect(withoutModel.assistantEnabled).toBe(false);
  });
});

function configureAssistant(): void {
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.stubEnv('GEMINI_MODEL', 'test-model');
}

const AGENT_RESULT: AssistantResult = {
  listings: [{ id: 1037, reason: 'Fits.', flags: [] }],
  assumptions: ['Assumed sale.'],
  relaxed: [],
  warnings: [],
  message: 'One match.',
  dropped: [],
  trace: [{ name: 'search_listings', input: { city: 'Kraków' } }],
  modelCalls: 2,
};

function ask(target: typeof app, body: unknown): Promise<Response> | Response {
  return target.request('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/assistant', () => {
  const fakeApp = createApp(async () => AGENT_RESULT);

  it('returns 503 when GEMINI_API_KEY is not set', async () => {
    configureAssistant();
    vi.stubEnv('GEMINI_API_KEY', undefined);
    const res = await ask(fakeApp, { message: 'flat in Kraków' });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'Assistant is not configured' });
  });

  it('returns 503 when GEMINI_MODEL is not set', async () => {
    configureAssistant();
    vi.stubEnv('GEMINI_MODEL', undefined);
    const res = await ask(fakeApp, { message: 'flat in Kraków' });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'Assistant is not configured' });
  });

  it('returns 400 for an empty message', async () => {
    configureAssistant();
    const res = await ask(fakeApp, { message: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a message over 500 characters', async () => {
    configureAssistant();
    const res = await ask(fakeApp, { message: 'a'.repeat(501) });
    expect(res.status).toBe(400);
  });

  it('returns 200 with the agent result and no trace field', async () => {
    configureAssistant();
    const res = await ask(fakeApp, { message: 'flat in Kraków' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty('trace');
    const { trace: _trace, ...expected } = AGENT_RESULT;
    expect(body).toEqual(expected);
  });

  it('returns 502 with a plain error when the agent throws', async () => {
    configureAssistant();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failingApp = createApp(async () => {
      throw new Error('quota exceeded for key abc');
    });
    const res = await ask(failingApp, { message: 'flat in Kraków' });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'The assistant could not answer. Try again.' });
    expect(logged).toHaveBeenCalled();
  });
});
