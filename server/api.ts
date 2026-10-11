import 'dotenv/config';
import { serve } from '@hono/node-server';
import { app } from './app';
import { countListings } from './db';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

try {
  if (countListings() === 0) {
    console.error('No data. Run: npm run ingest');
    process.exit(1);
  }
} catch {
  console.error('No data. Run: npm run ingest');
  process.exit(1);
}

serve({ fetch: app.fetch, port: PORT });
console.log(`API running on http://localhost:${PORT}`);
