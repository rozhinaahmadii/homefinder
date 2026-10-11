import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';

vi.hoisted(() => {
  process.env.DB_PATH = ':memory:';
});

import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createSchema, insertListings } from './db';
import { ingestRecords } from '../src/core/ingest';
import { createMcpServer } from './mcp';

const CTX = { today: '2026-10-10', imageFiles: new Set<string>() };

const TextResultSchema = z.object({
  isError: z.boolean().optional(),
  content: z.tuple([z.object({ type: z.literal('text'), text: z.string() })]),
});

const client = new Client({ name: 'mcp-test', version: '0.0.0' });
const server = createMcpServer();

async function call(name: string, args: Record<string, unknown>) {
  const result = TextResultSchema.parse(await client.callTool({ name, arguments: args }));
  return { isError: result.isError === true, json: JSON.parse(result.content[0].text) };
}

beforeAll(async () => {
  const records = z.array(z.unknown()).parse(JSON.parse(readFileSync('data/listings.raw.json', 'utf8')));
  createSchema();
  insertListings(ingestRecords(records, CTX).rows);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
});

afterAll(async () => {
  await client.close();
  await server.close();
});

describe('mcp server', () => {
  it('lists exactly search_listings and get_listing, each with a description', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['get_listing', 'search_listings']);
    for (const tool of tools) {
      expect(tool.description?.length ?? 0).toBeGreaterThan(0);
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it('search_listings with city "krakow" returns JSON with a total', async () => {
    const { isError, json } = await call('search_listings', { city: 'krakow' });
    expect(isError).toBe(false);
    expect(json.total).toBeGreaterThan(0);
    expect(json.items.length).toBe(json.shown);
  });

  it('get_listing with an unknown id is marked as an error', async () => {
    const { isError, json } = await call('get_listing', { id: 9999 });
    expect(isError).toBe(true);
    expect(json.error).toBe('Listing not found');
  });
});
