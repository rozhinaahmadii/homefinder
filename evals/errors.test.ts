import { describe, it, expect } from 'vitest';
import { classifyError } from './errors';

function apiError(status: number, body: unknown): Error {
  return Object.assign(new Error(JSON.stringify(body)), { status });
}

function quotaBody(quotaId: string, retryDelay: string) {
  return {
    error: {
      code: 429,
      status: 'RESOURCE_EXHAUSTED',
      message: 'You exceeded your current quota.',
      details: [
        { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId }] },
        { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay },
      ],
    },
  };
}

describe('classifyError', () => {
  it('treats a 429 with a short retry delay as temporary', () => {
    const err = apiError(429, quotaBody('GenerateRequestsPerMinutePerProjectPerModel-FreeTier', '34s'));
    expect(classifyError(err)).toBe('temporary');
  });

  it('treats a 429 with a long retry delay as the daily quota', () => {
    const err = apiError(429, quotaBody('GenerateRequests-FreeTier', '41852.5s'));
    expect(classifyError(err)).toBe('daily-quota');
  });

  it('treats a 429 that names a per-day quota as the daily quota', () => {
    const err = apiError(429, quotaBody('GenerateRequestsPerDayPerProjectPerModel-FreeTier', '12s'));
    expect(classifyError(err)).toBe('daily-quota');
  });

  it('treats a 503 as temporary', () => {
    const err = apiError(503, { error: { code: 503, status: 'UNAVAILABLE', message: 'The model is overloaded.' } });
    expect(classifyError(err)).toBe('temporary');
  });

  it('treats other API errors and plain errors as other', () => {
    expect(classifyError(apiError(400, { error: { code: 400 } }))).toBe('other');
    expect(classifyError(new Error('GEMINI_MODEL is not set.'))).toBe('other');
    expect(classifyError('boom')).toBe('other');
  });
});
