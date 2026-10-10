import type { Listing } from './types';

export async function loadListings(): Promise<Listing[]> {
  const response = await fetch('/data/listings.json');
  if (!response.ok) {
    throw new Error(`Failed to load listings (${response.status})`);
  }
  return response.json();
}
