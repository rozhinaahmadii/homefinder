import { z } from 'zod';

// Matched by shape so the runner does not depend on the model provider's SDK.
// The Gemini SDK throws an error with a numeric status and the response body as its message.
const ApiErrorShape = z.object({ status: z.number(), message: z.string() });

const LONG_RETRY_SECONDS = 60;

export type ErrorKind = 'daily-quota' | 'temporary' | 'other';

function isDailyQuota(message: string): boolean {
  if (/PerDay/i.test(message)) return true;
  const delay = message.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/);
  return delay !== null && Number(delay[1]) > LONG_RETRY_SECONDS;
}

export function classifyError(err: unknown): ErrorKind {
  const parsed = ApiErrorShape.safeParse(err);
  if (!parsed.success) return 'other';
  const { status, message } = parsed.data;
  if (status === 503) return 'temporary';
  if (status !== 429) return 'other';
  return isDailyQuota(message) ? 'daily-quota' : 'temporary';
}
