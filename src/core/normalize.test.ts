import { describe, it, expect } from 'vitest';
import {
  parsePrice,
  parseArea,
  parseRooms,
  parseFloor,
  parseDate,
  stripDiacritics,
} from './normalize';

// ─── parsePrice ───────────────────────────────────────────────────────────────

describe('parsePrice', () => {
  it('parses a plain integer string with no currency', () => {
    expect(parsePrice('4700')).toEqual({ amount: 4700, currency: null });
  });

  it('parses a space-separated number with zł suffix', () => {
    expect(parsePrice('1 096 000 zł')).toEqual({ amount: 1096000, currency: 'PLN' });
  });

  it('parses PLN prefix with comma as thousands separator', () => {
    expect(parsePrice('PLN 740,000')).toEqual({ amount: 740000, currency: 'PLN' });
  });

  it('parses tys. shorthand (460 tys. zł → 460 000)', () => {
    expect(parsePrice('460 tys. zł')).toEqual({ amount: 460000, currency: 'PLN' });
  });

  it('returns null amount and currency for null input', () => {
    expect(parsePrice(null)).toEqual({ amount: null, currency: null });
  });

  it('passes through a numeric value', () => {
    expect(parsePrice(2083000)).toEqual({ amount: 2083000, currency: null });
  });
});

// ─── parseArea ────────────────────────────────────────────────────────────────

describe('parseArea', () => {
  it('strips "m2" suffix', () => {
    expect(parseArea('199 m2')).toBe(199);
  });

  it('strips "sqm" suffix', () => {
    expect(parseArea('30 sqm')).toBe(30);
  });

  it('passes through a numeric value unchanged', () => {
    expect(parseArea(59.2)).toBe(59.2);
  });

  it('returns null for null input', () => {
    expect(parseArea(null)).toBeNull();
  });
});

// ─── parseRooms ───────────────────────────────────────────────────────────────

describe('parseRooms', () => {
  it('parses a string "1" to integer 1', () => {
    expect(parseRooms('1')).toBe(1);
  });

  it('returns null for undefined', () => {
    expect(parseRooms(undefined)).toBeNull();
  });

  it('passes through a numeric value', () => {
    expect(parseRooms(4)).toBe(4);
  });
});

// ─── parseFloor ───────────────────────────────────────────────────────────────

describe('parseFloor', () => {
  it('maps "parter" (Polish ground floor) to 0', () => {
    expect(parseFloor('parter')).toBe(0);
  });

  it('passes through numeric 0', () => {
    expect(parseFloor(0)).toBe(0);
  });

  it('passes through a positive floor number', () => {
    expect(parseFloor(14)).toBe(14);
  });

  it('returns null for null input', () => {
    expect(parseFloor(null)).toBeNull();
  });

  it('returns null for an unrecognised string', () => {
    expect(parseFloor('unknown')).toBeNull();
  });
});

// ─── parseDate ────────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('normalises DD/MM/YYYY to YYYY-MM-DD', () => {
    expect(parseDate('14/09/2026')).toBe('2026-09-14');
  });

  it('passes through a valid ISO date unchanged', () => {
    expect(parseDate('2026-08-30')).toBe('2026-08-30');
  });

  it('returns null for an unparseable string', () => {
    expect(parseDate('not a date')).toBeNull();
  });
});

// ─── stripDiacritics ──────────────────────────────────────────────────────────

describe('stripDiacritics', () => {
  it('removes combining accents via NFD (Kraków → Krakow)', () => {
    expect(stripDiacritics('Kraków')).toBe('Krakow');
  });

  it('handles ł → l and ó → o (Łódź → Lodz)', () => {
    expect(stripDiacritics('Łódź')).toBe('Lodz');
  });

  it('handles ń → n (Gdańsk → Gdansk)', () => {
    expect(stripDiacritics('Gdańsk')).toBe('Gdansk');
  });

  it('handles ą, ę, ś, ź in Wrocław, Poznań', () => {
    expect(stripDiacritics('Wrocław')).toBe('Wroclaw');
    expect(stripDiacritics('Poznań')).toBe('Poznan');
  });

  it('passes ASCII strings through unchanged', () => {
    expect(stripDiacritics('Warsaw')).toBe('Warsaw');
  });
});
