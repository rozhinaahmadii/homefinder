import { describe, it, expect } from 'vitest';
import { FLAG_CODES } from './core/types';
import { flagMessages } from './flagMessages';

describe('flagMessages', () => {
  it('has a non-empty message for every flag code', () => {
    for (const code of FLAG_CODES) {
      expect(flagMessages[code], `missing message for ${code}`).toBeTruthy();
    }
  });
});
