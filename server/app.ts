import { Hono } from 'hono';
import { z } from 'zod';
import { SearchFiltersSchema } from '../src/core/types';
import { searchListings } from '../src/core/search';
import { getAllListings, getListingById } from './db';
import { runAssistant } from './agent';
import type { AssistantResult } from './agent';

type Agent = (message: string) => Promise<AssistantResult>;

const AssistantRequestSchema = z.object({ message: z.string().trim().min(1).max(500) });

function assistantEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY) && Boolean(process.env.GEMINI_MODEL);
}

export function createApp(agent: Agent = runAssistant): Hono {
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
    return c.json({ cities, features, assistantEnabled: assistantEnabled() });
  });

  app.post('/api/assistant', async (c) => {
    if (!assistantEnabled()) {
      return c.json({ error: 'Assistant is not configured' }, 503);
    }

    const body: unknown = await c.req.json().catch(() => null);
    const parsed = AssistantRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Message must be 1 to 500 characters', issues: parsed.error.issues }, 400);
    }

    try {
      const { trace: _trace, ...result } = await agent(parsed.data.message);
      return c.json(result);
    } catch (err) {
      console.error(err);
      return c.json({ error: 'The assistant could not answer. Try again.' }, 502);
    }
  });

  return app;
}

export const app = createApp();
