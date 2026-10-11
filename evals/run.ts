import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { getAllListings } from '../server/db';
import { runAssistant } from '../server/agent';
import type { AssistantResult } from '../server/agent';
import type { Listing } from '../src/core/types';
import { ScenarioSchema, checkScenario } from './check';
import type { FailedCheck, Scenario } from './check';
import { classifyError } from './errors';

const SCENARIOS_PATH = 'evals/scenarios.json';
const RESULTS_PATH = 'docs/EVAL_RESULTS.md';
const PAUSE_MS = 2_000;
const RETRY_WAIT_MS = 30_000;
const MAX_ERROR_LENGTH = 300;

interface Outcome {
  scenario: Scenario;
  result: AssistantResult | null;
  failures: FailedCheck[];
}

interface Options {
  id: string | null;
  verbose: boolean;
  save: boolean;
}

function fatal(message: string): never {
  console.error(message);
  process.exit(1);
}

function parseOptions(argv: string[]): Options {
  const idIndex = argv.indexOf('--id');
  const id = idIndex === -1 ? null : argv[idIndex + 1];
  if (id === undefined || id?.startsWith('--')) fatal('--id needs a scenario id.');
  return { id, verbose: argv.includes('--verbose'), save: argv.includes('--save') };
}

function loadScenarios(id: string | null): Scenario[] {
  const scenarios = z.array(ScenarioSchema).parse(JSON.parse(readFileSync(SCENARIOS_PATH, 'utf8')));
  if (id === null) return scenarios;
  const selected = scenarios.filter((s) => s.id === id);
  if (!selected.length) {
    fatal(`No scenario with id "${id}". Available: ${scenarios.map((s) => s.id).join(', ')}`);
  }
  return selected;
}

function loadListings(): Map<number, Listing> {
  let listings: Listing[] = [];
  try {
    listings = getAllListings();
  } catch {
    // a missing table is reported the same way as an empty one
  }
  if (!listings.length) fatal('No data. Run: npm run ingest');
  return new Map(listings.map((l) => [l.id, l]));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.length > MAX_ERROR_LENGTH ? `${message.slice(0, MAX_ERROR_LENGTH)}…` : message;
}

async function runWithRetry(query: string): Promise<AssistantResult> {
  try {
    return await runAssistant(query);
  } catch (err) {
    if (classifyError(err) !== 'temporary') throw err;
    console.log(`  temporary API error, retrying once in ${RETRY_WAIT_MS / 1000} seconds`);
    await sleep(RETRY_WAIT_MS);
    return runAssistant(query);
  }
}

function returnedIds(outcome: Outcome): string {
  const ids = outcome.result?.listings.map((l) => l.id) ?? [];
  return ids.length ? ids.join(', ') : 'none';
}

function modelCalls(outcome: Outcome): number {
  return outcome.result?.modelCalls ?? 0;
}

function status(outcome: Outcome): 'PASS' | 'FAIL' {
  return outcome.failures.length ? 'FAIL' : 'PASS';
}

function outcomeLines(outcome: Outcome, verbose: boolean): string[] {
  const lines = [
    `${status(outcome)} ${outcome.scenario.id}  ids: ${returnedIds(outcome)}  calls: ${modelCalls(outcome)}`,
    ...outcome.failures.map((f) => `  - ${f.check}: ${f.reason}`),
  ];
  if (verbose && outcome.result) {
    lines.push(`  message: ${outcome.result.message}`);
    outcome.result.trace.forEach((t, i) => {
      lines.push(`  ${i + 1}. ${t.name} ${JSON.stringify(t.input)}`);
    });
  }
  return lines;
}

function summaryLine(outcomes: Outcome[], model: string): string {
  const passed = outcomes.filter((o) => !o.failures.length).length;
  const calls = outcomes.reduce((sum, o) => sum + modelCalls(o), 0);
  return `${passed} / ${outcomes.length} passed, ${calls} model calls, model ${model}`;
}

function toMarkdown(outcomes: Outcome[], model: string): string {
  const failed = outcomes.filter((o) => o.failures.length);
  const lines = [
    '# Eval results',
    '',
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    '',
    `Model: \`${model}\``,
    '',
    '| Result | Scenario | Returned ids | Model calls |',
    '|---|---|---|---|',
    ...outcomes.map(
      (o) => `| ${status(o)} | ${o.scenario.id} | ${returnedIds(o)} | ${modelCalls(o)} |`,
    ),
    '',
  ];
  if (failed.length) {
    lines.push('## Failed checks', '');
    for (const o of failed) {
      lines.push(`### ${o.scenario.id}`, '', ...o.failures.map((f) => `- ${f.check}: ${f.reason}`), '');
    }
  }
  lines.push(`**${summaryLine(outcomes, model)}**`, '');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const model = process.env.GEMINI_MODEL;
  if (!process.env.GEMINI_API_KEY || !model) {
    fatal('GEMINI_API_KEY and GEMINI_MODEL must be set in .env to run the evals.');
  }
  const scenarios = loadScenarios(options.id);
  const listingsById = loadListings();

  const outcomes: Outcome[] = [];
  let quotaExhausted = false;

  for (const [index, scenario] of scenarios.entries()) {
    if (index > 0) await sleep(PAUSE_MS);
    let outcome: Outcome;
    try {
      const result = await runWithRetry(scenario.query);
      outcome = { scenario, result, failures: checkScenario(scenario.expect, result, listingsById) };
    } catch (err) {
      if (classifyError(err) === 'daily-quota') {
        quotaExhausted = true;
        break;
      }
      outcome = { scenario, result: null, failures: [{ check: 'run', reason: errorMessage(err) }] };
    }
    outcomes.push(outcome);
    for (const line of outcomeLines(outcome, options.verbose)) console.log(line);
  }

  if (quotaExhausted) {
    const remaining = scenarios.length - outcomes.length;
    console.error(
      `\nStopped: the daily API quota for ${model} is used up. ${remaining} of ${scenarios.length} scenarios were not run and nothing was saved. Try again after the quota resets, or set another GEMINI_MODEL.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\n${summaryLine(outcomes, model)}`);

  if (options.save) {
    writeFileSync(RESULTS_PATH, toMarkdown(outcomes, model));
    console.log(`Saved ${RESULTS_PATH}`);
  }

  if (outcomes.some((o) => o.failures.length)) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
