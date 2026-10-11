import { Hono } from 'hono';
import { SearchFiltersSchema } from '../src/core/types';
import { searchListings } from '../src/core/search';
import { getAllListings, getListingById } from './db';

const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true }));

app.get('/api/listings', (c) => {
  const raw = c.req.query();

  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== '') cleaned[k] = v;
  }

  if (typeof cleaned.features === 'string') {
    cleaned.features = (cleaned.features as string)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  const result = SearchFiltersSchema.safeParse(cleaned);
  if (!result.success) {
    return c.json({ issues: result.error.issues }, 400);
  }

  const { total, items } = searchListings(getAllListings(), result.data);
  return c.json({ total, items });
});

app.get('/api/listings/:id', (c) => {
  const idStr = c.req.param('id');
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return c.json({ error: 'id must be a number' }, 400);
  }
  const listing = getListingById(id);
  if (listing === undefined) {
    return c.json({ error: 'not found' }, 404);
  }
  return c.json(listing);
});

app.get('/api/meta', (c) => {
  const listings = getAllListings().filter((l) => l.duplicateOf === null);
  const cities = [...new Set(listings.map((l) => l.city))].sort();
  const features = [...new Set(listings.flatMap((l) => l.features))].sort();
  return c.json({ cities, features });
});

export { app };
