import type { Listing } from './types';
import { escapeHtml, formatPrice, formatRooms, offerTypeLabels } from './format';

interface Filters {
  query: string;
  city: string;
  offerType: string;
  minPrice: number | null;
  maxPrice: number | null;
  minRooms: number | null;
  minArea: number | null;
  maxArea: number | null;
}

let formValues: Record<string, string> = {};

function parseNumber(value: string | undefined): number | null {
  if (!value || value.trim() === '') return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function parseFilters(values: Record<string, string>): Filters {
  return {
    query: values.query ?? '',
    city: values.city ?? '',
    offerType: values.offerType ?? '',
    minPrice: parseNumber(values.minPrice),
    maxPrice: parseNumber(values.maxPrice),
    minRooms: parseNumber(values.minRooms),
    minArea: parseNumber(values.minArea),
    maxArea: parseNumber(values.maxArea),
  };
}

function filterListings(listings: Listing[], filters: Filters): Listing[] {
  const query = filters.query.trim().toLowerCase();

  return listings.filter((listing) => {
    if (query) {
      const text = [listing.title, listing.description, listing.city, listing.district, listing.address]
        .join(' ')
        .toLowerCase();
      if (!text.includes(query)) return false;
    }
    if (filters.city && listing.city !== filters.city) return false;
    if (filters.offerType && listing.offerType !== filters.offerType) return false;
    if (filters.minPrice !== null && (listing.price === null || listing.price < filters.minPrice)) return false;
    if (filters.maxPrice !== null && (listing.price === null || listing.price > filters.maxPrice)) return false;
    if (filters.minRooms !== null && listing.rooms < filters.minRooms) return false;
    if (filters.minArea !== null && listing.area < filters.minArea) return false;
    if (filters.maxArea !== null && listing.area > filters.maxArea) return false;
    return true;
  });
}

function renderCard(listing: Listing): string {
  const image = listing.image
    ? `<img src="${escapeHtml(listing.image)}" alt="" loading="lazy" />`
    : `<div class="no-image">No photo</div>`;
  const location = [listing.city, listing.district].filter(Boolean).join(', ');

  return `
    <a class="card" href="#/listings/${encodeURIComponent(listing.id)}">
      <div class="card-image">${image}</div>
      <div class="card-body">
        <div class="card-price">${escapeHtml(formatPrice(listing))}</div>
        <h3 class="card-title">${escapeHtml(listing.title)}</h3>
        <div class="card-location">${escapeHtml(location)}</div>
        <div class="card-meta">
          <span>${escapeHtml(listing.area)} m²</span>
          <span>${escapeHtml(formatRooms(listing.rooms))}</span>
          <span>${escapeHtml(offerTypeLabels[listing.offerType] ?? listing.offerType)}</span>
        </div>
      </div>
    </a>
  `;
}

function renderResults(root: HTMLElement, listings: Listing[]): void {
  const results = filterListings(listings, parseFilters(formValues));
  root.querySelector('#results-count')!.textContent = `${results.length} of ${listings.length} listings`;
  root.querySelector('#results')!.innerHTML = results.length
    ? results.map(renderCard).join('')
    : `<p class="empty">No listings match your search.</p>`;
}

export function renderListView(root: HTMLElement, listings: Listing[]): void {
  const cities = [...new Set(listings.map((listing) => listing.city))].sort((a, b) => a.localeCompare(b));

  root.innerHTML = `
    <div class="layout">
      <aside class="filters">
        <form id="filters-form">
          <label>
            Search
            <input type="search" name="query" placeholder="e.g. balcony, Mokotów" />
          </label>
          <label>
            City
            <select name="city">
              <option value="">All cities</option>
              ${cities.map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`).join('')}
            </select>
          </label>
          <label>
            Offer type
            <select name="offerType">
              <option value="">Sale and rent</option>
              <option value="sale">For sale</option>
              <option value="rent">For rent</option>
            </select>
          </label>
          <fieldset>
            <legend>Price</legend>
            <div class="range">
              <input type="number" name="minPrice" placeholder="Min" min="0" />
              <input type="number" name="maxPrice" placeholder="Max" min="0" />
            </div>
          </fieldset>
          <label>
            Rooms
            <select name="minRooms">
              <option value="">Any</option>
              <option value="1">1+</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
            </select>
          </label>
          <fieldset>
            <legend>Area (m²)</legend>
            <div class="range">
              <input type="number" name="minArea" placeholder="Min" min="0" />
              <input type="number" name="maxArea" placeholder="Max" min="0" />
            </div>
          </fieldset>
          <button type="reset" class="button-secondary">Clear filters</button>
        </form>
      </aside>
      <section class="results">
        <p class="results-count" id="results-count"></p>
        <div class="grid" id="results"></div>
      </section>
    </div>
  `;

  const form = root.querySelector<HTMLFormElement>('#filters-form')!;
  for (const [name, value] of Object.entries(formValues)) {
    const field = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
    if (field) field.value = value;
  }

  const update = () => {
    formValues = Object.fromEntries(new FormData(form)) as Record<string, string>;
    renderResults(root, listings);
  };

  form.addEventListener('input', update);
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('reset', () => setTimeout(update));

  renderResults(root, listings);
}
