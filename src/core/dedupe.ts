import { stripDiacritics } from './normalize';
import type { Listing } from './types';

function hasHouseNumber(address: string): boolean {
  return /\d/.test(address);
}

function dedupeKey(l: Listing): string {
  const addr = stripDiacritics(l.address!.toLowerCase()).replace(/\s+/g, ' ');
  return [addr, l.city, l.area, l.rooms, l.floor, l.offerType].join('|');
}

export function markDuplicates(listings: Listing[]): Listing[] {
  const groups = new Map<string, Listing[]>();

  for (const l of listings) {
    if (!l.address || !hasHouseNumber(l.address)) continue;
    const key = dedupeKey(l);
    const g = groups.get(key);
    if (g) g.push(l);
    else groups.set(key, [l]);
  }

  const duplicateOf = new Map<number, number>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const canonical = group.reduce((best, curr) => {
      const bp = best.publishedAt ?? '';
      const cp = curr.publishedAt ?? '';
      if (cp > bp) return curr;
      if (cp < bp) return best;
      return curr.id < best.id ? curr : best;
    });
    for (const l of group) {
      if (l.id !== canonical.id) duplicateOf.set(l.id, canonical.id);
    }
  }

  return listings.map((l) => {
    const canon = duplicateOf.get(l.id);
    return canon !== undefined ? { ...l, duplicateOf: canon } : l;
  });
}
