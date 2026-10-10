import type { Listing } from './core/types';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatPrice(listing: Listing): string {
  if (listing.price === null) {
    return 'Price on request';
  }
  const suffix = listing.offerType === 'rent' ? ' / month' : '';
  return `${listing.price.toLocaleString('pl-PL')} ${listing.currency ?? ''}${suffix}`;
}

export function formatFloor(listing: Listing): string {
  if (listing.floor === null) return '';
  const floor = listing.floor === 0 ? 'Ground floor' : `Floor ${listing.floor}`;
  return listing.totalFloors ? `${floor} of ${listing.totalFloors}` : floor;
}

export function formatRooms(rooms: number): string {
  return rooms === 1 ? '1 room' : `${rooms} rooms`;
}

export const offerTypeLabels: Record<string, string> = {
  sale: 'For sale',
  rent: 'For rent',
};
