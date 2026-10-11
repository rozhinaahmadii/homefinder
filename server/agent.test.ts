import { vi, describe, it, expect, beforeAll, afterEach } from 'vitest';

vi.hoisted(() => {
  process.env.DB_PATH = ':memory:';
  process.env.GEMINI_MODEL = 'test-model';
});

import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { createSchema, insertListings } from './db';
import { ingestRecords } from '../src/core/ingest';
import { tools } from './tools';
import { runAssistant } from './agent';
import type { ModelClient, SessionInput, SessionSetup, ToolCall } from './agent';

const CTX = { today: '2026-10-10', imageFiles: new Set<string>() };

beforeAll(() => {
  const records = z.array(z.unknown()).parse(JSON.parse(readFileSync('data/listings.raw.json', 'utf8')));
  createSchema();
  insertListings(ingestRecords(records, CTX).rows);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function fakeClient(script: ToolCall[][]) {
  const inputs: SessionInput[] = [];
  const setups: SessionSetup[] = [];
  const client: ModelClient = {
    startSession(setup) {
      setups.push(setup);
      return {
        async send(input) {
          inputs.push(input);
          return script[inputs.length - 1] ?? [];
        },
      };
    },
  };
  return { client, inputs, setups };
}

function search(args: Record<string, unknown>): ToolCall {
  return { name: 'search_listings', args };
}

function get(id: number): ToolCall {
  return { name: 'get_listing', args: { id } };
}

function submit(listings: { id: number; reason: string }[], message = 'Done'): ToolCall {
  return {
    name: 'submit_shortlist',
    args: { listings, assumptions: [], relaxed: [], warnings: [], message },
  };
}

const EMPTY = { listings: [], assumptions: [], relaxed: [], warnings: [], dropped: [] };

describe('runAssistant', () => {
  it('a normal run (search, get_listing, submit) returns the shortlist and the ordered trace', async () => {
    const searchArgs = { city: 'Kraków', offerType: 'sale', maxPrice: 800000 };
    const submitCall: ToolCall = {
      name: 'submit_shortlist',
      args: {
        listings: [{ id: 1101, reason: 'Central and consistent data.' }],
        assumptions: ['Assumed sale from the budget.'],
        relaxed: [],
        warnings: [],
        message: 'One good match.',
      },
    };
    const { client, inputs, setups } = fakeClient([[search(searchArgs)], [get(1101)], [submitCall]]);

    const result = await runAssistant('2 rooms in Kraków under 800k', { client });

    // CTX has no image files, so every seeded listing carries IMAGE_MISSING
    expect(result.listings).toEqual([
      { id: 1101, reason: 'Central and consistent data.', flags: ['IMAGE_MISSING'] },
    ]);
    expect(result.assumptions).toEqual(['Assumed sale from the budget.']);
    expect(result.message).toBe('One good match.');
    expect(result.dropped).toEqual([]);
    expect(result.trace).toEqual([
      { name: 'search_listings', input: searchArgs },
      { name: 'get_listing', input: { id: 1101 } },
      { name: 'submit_shortlist', input: submitCall.args },
    ]);
    expect(inputs[0]).toEqual({ text: '2 rooms in Kraków under 800k' });
    expect(setups[0].model).toBe('test-model');
    expect(result.modelCalls).toBe(3);
  });

  it('attaches flag codes from the store to each shortlisted listing', async () => {
    const { client } = fakeClient([[submit([{ id: 1067, reason: 'Cheapest.' }])]]);

    const result = await runAssistant('cheap flat in Kraków', { client });

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0].flags).toContain('AREA_MISMATCH_DESCRIPTION');
  });

  it('drops an unknown id and a duplicate id and reports both in dropped', async () => {
    const { client } = fakeClient([
      [
        submit([
          { id: 9999, reason: 'Invented.' },
          { id: 1059, reason: 'Original.' },
          { id: 1016, reason: 'Duplicate.' },
        ]),
      ],
    ]);

    const result = await runAssistant('anything', { client });

    expect(result.listings.map((l) => l.id)).toEqual([1059]);
    expect(result.dropped).toEqual([9999, 1016]);
  });

  it('returns an empty shortlist after 8 model calls without submit_shortlist', async () => {
    const script = Array.from({ length: 10 }, () => [search({ city: 'Kraków' })]);
    const { client, inputs } = fakeClient(script);

    const result = await runAssistant('flat in Kraków', { client });

    expect(inputs).toHaveLength(8);
    expect(result).toMatchObject(EMPTY);
    expect(result.message).toMatch(/could not be completed/);
    expect(result.trace).toHaveLength(8);
    expect(result.modelCalls).toBe(8);
  });

  it('passes a tool error object back to the model and continues', async () => {
    const { client, inputs } = fakeClient([[get(9999)], [submit([{ id: 1101, reason: 'Fits.' }])]]);

    const result = await runAssistant('flat in Kraków', { client });

    expect(inputs[1]).toEqual({
      results: [{ name: 'get_listing', result: { error: 'Listing not found' } }],
    });
    expect(result.listings.map((l) => l.id)).toEqual([1101]);
  });

  it('returns an error to the model for an unknown tool name and continues', async () => {
    const { client, inputs } = fakeClient([
      [{ name: 'delete_listing', args: { id: 1101 } }],
      [submit([{ id: 1101, reason: 'Fits.' }])],
    ]);

    const result = await runAssistant('flat in Kraków', { client });

    expect(inputs[1]).toEqual({
      results: [{ name: 'delete_listing', result: { error: 'Unknown tool: delete_listing' } }],
    });
    expect(result.listings.map((l) => l.id)).toEqual([1101]);
  });

  it('sends invalid submit_shortlist input back as an error and lets the model retry', async () => {
    const six = [1101, 1037, 1085, 1030, 1067, 1059].map((id) => ({ id, reason: 'Fits.' }));
    const { client, inputs } = fakeClient([[submit(six)], [submit(six.slice(0, 5))]]);

    const result = await runAssistant('flat in Kraków', { client });

    expect(inputs[1]).toMatchObject({
      results: [{ name: 'submit_shortlist', result: { error: 'Invalid input' } }],
    });
    expect(result.listings).toHaveLength(5);
    expect(result.trace.map((t) => t.name)).toEqual(['submit_shortlist', 'submit_shortlist']);
  });

  it('a model reply with no tool call ends with an empty shortlist', async () => {
    const { client, inputs } = fakeClient([[]]);

    const result = await runAssistant('hello', { client });

    expect(inputs).toHaveLength(1);
    expect(result).toMatchObject(EMPTY);
    expect(result.message).toMatch(/could not be completed/);
    expect(result.trace).toEqual([]);
    expect(result.modelCalls).toBe(1);
  });

  it('throws a clear error when GEMINI_MODEL is missing', async () => {
    vi.stubEnv('GEMINI_MODEL', undefined);
    const { client } = fakeClient([]);

    await expect(runAssistant('flat in Kraków', { client })).rejects.toThrow(/GEMINI_MODEL/);
  });

  it('throws a clear error when GEMINI_API_KEY is missing and no client is injected', async () => {
    vi.stubEnv('GEMINI_API_KEY', undefined);

    await expect(runAssistant('flat in Kraków')).rejects.toThrow(/GEMINI_API_KEY/);
  });
});

describe('tool declarations', () => {
  it('offers every registry tool plus submit_shortlist', async () => {
    const { client, setups } = fakeClient([[]]);

    await runAssistant('hello', { client });

    const names = setups[0].tools.map((t) => t.name);
    expect(names).toEqual([...tools.map((t) => t.name), 'submit_shortlist']);
    for (const tool of setups[0].tools) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it('the schema sent to the model has no $schema, additionalProperties or safe-integer bounds', async () => {
    const { client, setups } = fakeClient([[]]);

    await runAssistant('hello', { client });

    const serialized = JSON.stringify(setups[0].tools);
    expect(serialized).not.toContain('$schema');
    expect(serialized).not.toContain('additionalProperties');
    expect(serialized).not.toContain('9007199254740991');
    const getListing = setups[0].tools.find((t) => t.name === 'get_listing');
    expect(getListing?.parameters).toEqual({
      type: 'object',
      properties: { id: { type: 'integer' } },
      required: ['id'],
    });
  });
});
