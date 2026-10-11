import { z } from 'zod';
import type { Listing } from '../src/core/types';
import type { AssistantResult } from '../server/agent';

export const ExpectSchema = z.strictObject({
  minResults: z.number().int().optional(),
  maxResults: z.number().int().optional(),
  idsWithin: z.array(z.number().int()).optional(),
  mustNotInclude: z.array(z.number().int()).optional(),
  mustInclude: z.array(z.number().int()).optional(),
  city: z.string().optional(),
  featureOrRelaxed: z.string().optional(),
});
export type Expect = z.infer<typeof ExpectSchema>;

export const ScenarioSchema = z.strictObject({
  id: z.string(),
  query: z.string(),
  expect: ExpectSchema,
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export interface FailedCheck {
  check: string;
  reason: string;
}

export type CheckedResult = Pick<
  AssistantResult,
  'completed' | 'listings' | 'dropped' | 'warnings' | 'relaxed'
>;

const MAX_LISTINGS = 5;

function namesId(text: string, id: number): boolean {
  return new RegExp(`(?<!\\d)${id}(?!\\d)`).test(text);
}

function idList(listings: Listing[]): string {
  return listings.map((l) => l.id).join(', ');
}

export function checkScenario(
  expect: Expect,
  result: CheckedResult,
  listingsById: Map<number, Listing>,
): FailedCheck[] {
  const failures: FailedCheck[] = [];
  const fail = (check: string, reason: string) => failures.push({ check, reason });

  const ids = result.listings.map((l) => l.id);
  const stored = ids.flatMap((id) => listingsById.get(id) ?? []);

  if (!result.completed) {
    fail('completed', 'the run ended without a valid submit_shortlist');
  }

  const unknown = ids.filter((id) => !listingsById.has(id));
  if (unknown.length) fail('idsExist', `not in the store: ${unknown.join(', ')}`);

  const duplicates = stored.filter((l) => l.duplicateOf !== null);
  if (duplicates.length) fail('noDuplicates', `duplicate listings returned: ${idList(duplicates)}`);

  if (result.dropped.length) {
    fail('nothingDropped', `the agent submitted ids that had to be dropped: ${result.dropped.join(', ')}`);
  }

  if (ids.length > MAX_LISTINGS) {
    fail('atMostFive', `${ids.length} listings returned`);
  }

  const unwarned = stored.filter(
    (l) => l.flags.length > 0 && !result.warnings.some((w) => namesId(w, l.id)),
  );
  if (unwarned.length) {
    fail('flagsWarned', `flagged listings not named in any warning: ${idList(unwarned)}`);
  }

  if (expect.minResults !== undefined && ids.length < expect.minResults) {
    fail('minResults', `expected at least ${expect.minResults}, got ${ids.length}`);
  }

  if (expect.maxResults !== undefined && ids.length > expect.maxResults) {
    fail('maxResults', `expected at most ${expect.maxResults}, got ${ids.length}`);
  }

  if (expect.idsWithin) {
    const allowed = new Set(expect.idsWithin);
    const outside = ids.filter((id) => !allowed.has(id));
    if (outside.length) fail('idsWithin', `ids outside the allowed list: ${outside.join(', ')}`);
  }

  if (expect.mustNotInclude) {
    const banned = new Set(expect.mustNotInclude);
    const included = ids.filter((id) => banned.has(id));
    if (included.length) fail('mustNotInclude', `excluded ids returned: ${included.join(', ')}`);
  }

  if (expect.mustInclude) {
    const missing = expect.mustInclude.filter((id) => !ids.includes(id));
    if (missing.length) fail('mustInclude', `expected ids not returned: ${missing.join(', ')}`);
  }

  if (expect.city !== undefined) {
    const elsewhere = stored.filter((l) => l.city !== expect.city);
    if (elsewhere.length) fail('city', `not in ${expect.city}: ${idList(elsewhere)}`);
  }

  if (expect.featureOrRelaxed !== undefined && result.relaxed.length === 0) {
    const feature = expect.featureOrRelaxed;
    const lacking = stored.filter((l) => !l.features.includes(feature));
    if (lacking.length) {
      fail('featureOrRelaxed', `without "${feature}" and nothing recorded as relaxed: ${idList(lacking)}`);
    }
  }

  return failures;
}
