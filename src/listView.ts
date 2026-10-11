import type { Listing, SearchFilters } from './core/types';
import type { MetaResponse } from './data';
import { fetchListings, fetchMeta } from './data';
import { escapeHtml, formatPrice, formatRooms, offerTypeLabels } from './format';

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'price_per_m2_asc', label: 'Price per m²' },
  { value: 'area_desc', label: 'Largest area' },
];

let metaCache: MetaResponse | null = null;

async function getMeta(): Promise<MetaResponse> {
  if (!metaCache) metaCache = await fetchMeta();
  return metaCache;
}

function getHashParams(): URLSearchParams {
  const q = location.hash.indexOf('?');
  return q === -1 ? new URLSearchParams() : new URLSearchParams(location.hash.slice(q + 1));
}

function formToHashParams(form: HTMLFormElement): URLSearchParams {
  const data = new FormData(form);
  const params = new URLSearchParams();
  for (const name of ['query', 'city', 'offerType', 'minPrice', 'maxPrice', 'minRooms', 'minArea', 'maxArea'] as const) {
    const val = data.get(name) as string | null;
    if (val) params.set(name, val);
  }
  const features = data.getAll('features') as string[];
  if (features.length) params.set('features', features.join(','));
  const sort = data.get('sort') as string | null;
  if (sort && sort !== 'newest') params.set('sort', sort);
  return params;
}

function formToFilters(form: HTMLFormElement): SearchFilters {
  const data = new FormData(form);
  const filters: SearchFilters = {};

  const query = data.get('query') as string | null;
  if (query) filters.query = query;

  const city = data.get('city') as string | null;
  if (city) filters.city = city;

  const offerType = data.get('offerType') as string | null;
  if (offerType === 'sale' || offerType === 'rent') filters.offerType = offerType;

  const toNum = (name: string): number | undefined => {
    const v = data.get(name) as string | null;
    if (!v) return undefined;
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  };
  const minPrice = toNum('minPrice');
  if (minPrice !== undefined) filters.minPrice = minPrice;
  const maxPrice = toNum('maxPrice');
  if (maxPrice !== undefined) filters.maxPrice = maxPrice;
  const minRooms = toNum('minRooms');
  if (minRooms !== undefined) filters.minRooms = minRooms;
  const minArea = toNum('minArea');
  if (minArea !== undefined) filters.minArea = minArea;
  const maxArea = toNum('maxArea');
  if (maxArea !== undefined) filters.maxArea = maxArea;

  const features = data.getAll('features') as string[];
  if (features.length) filters.features = features;

  const sort = data.get('sort') as string | null;
  if (sort && sort !== 'newest') filters.sort = sort as NonNullable<SearchFilters['sort']>;

  return filters;
}

function fillFormFromHash(form: HTMLFormElement): void {
  const params = getHashParams();
  for (const name of ['query', 'city', 'offerType', 'minPrice', 'maxPrice', 'minRooms', 'minArea', 'maxArea', 'sort'] as const) {
    const val = params.get(name);
    if (val === null) continue;
    const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
    if (el) el.value = val;
  }
  const featuresParam = params.get('features');
  if (featuresParam) {
    const selected = new Set(featuresParam.split(','));
    form.querySelectorAll<HTMLInputElement>('input[name="features"]').forEach((cb) => {
      cb.checked = selected.has(cb.value);
    });
  }
}

function updatePriceHint(form: HTMLFormElement): void {
  const hint = form.querySelector<HTMLElement>('.price-hint');
  if (!hint) return;
  const minPrice = (form.elements.namedItem('minPrice') as HTMLInputElement | null)?.value ?? '';
  const maxPrice = (form.elements.namedItem('maxPrice') as HTMLInputElement | null)?.value ?? '';
  const offerType = (form.elements.namedItem('offerType') as HTMLSelectElement | null)?.value ?? '';
  hint.hidden = !(Boolean(minPrice || maxPrice) && !offerType);
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
        <div class="card-price">
          <span>${escapeHtml(formatPrice(listing))}</span>
          ${listing.flags.length ? '<span class="badge badge-muted">Check details</span>' : ''}
        </div>
        <h3 class="card-title">${escapeHtml(listing.title)}</h3>
        <div class="card-location">${escapeHtml(location)}</div>
        <div class="card-meta">
          <span>${listing.area !== null ? `${listing.area} m²` : '—'}</span>
          <span>${listing.rooms !== null ? escapeHtml(formatRooms(listing.rooms)) : '—'}</span>
          <span>${escapeHtml(offerTypeLabels[listing.offerType] ?? listing.offerType)}</span>
        </div>
      </div>
    </a>
  `;
}

let latestRequest = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSearch(form: HTMLFormElement, root: HTMLElement): void {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void doSearch(form, root), 200);
}

async function doSearch(form: HTMLFormElement, root: HTMLElement): Promise<void> {
  const myId = ++latestRequest;
  const resultsEl = root.querySelector<HTMLElement>('#results')!;
  const countEl = root.querySelector<HTMLElement>('#results-count')!;

  resultsEl.innerHTML = '<p class="status">Loading…</p>';

  try {
    const { total, items } = await fetchListings(formToFilters(form));
    if (myId !== latestRequest) return;
    countEl.textContent = `${total} listing${total !== 1 ? 's' : ''}`;
    resultsEl.innerHTML = items.length
      ? items.map(renderCard).join('')
      : '<p class="empty">No listings match your search.</p>';
  } catch (err) {
    if (myId !== latestRequest) return;
    const msg = err instanceof Error ? err.message : 'Unknown error';
    countEl.textContent = '';
    resultsEl.innerHTML = `<p class="status error">${escapeHtml(msg)}</p>`;
  }
}

export async function renderListView(root: HTMLElement): Promise<void> {
  root.innerHTML = '<p class="status">Loading…</p>';

  let meta: MetaResponse;
  try {
    meta = await getMeta();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    root.innerHTML = `<p class="status error">Could not load. ${escapeHtml(msg)}</p>`;
    return;
  }

  root.innerHTML = `
    <div class="layout">
      <aside class="filters">
        <form id="filters-form">
          <label>
            Search
            <input type="search" name="query" placeholder="e.g. balcony Mokotów" />
          </label>
          <label>
            City
            <select name="city">
              <option value="">All cities</option>
              ${meta.cities.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
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
            <p class="price-hint" hidden>Choose sale or rent to compare prices.</p>
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
          ${
            meta.features.length
              ? `<fieldset>
                   <legend>Features</legend>
                   <div class="checkbox-list">
                     ${meta.features
                       .map(
                         (f) => `<label class="checkbox-label">
                       <input type="checkbox" name="features" value="${escapeHtml(f)}" />
                       ${escapeHtml(f.charAt(0).toUpperCase() + f.slice(1))}
                     </label>`,
                       )
                       .join('')}
                   </div>
                 </fieldset>`
              : ''
          }
          <label>
            Sort
            <select name="sort">
              ${SORT_OPTIONS.map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('')}
            </select>
          </label>
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
  fillFormFromHash(form);
  updatePriceHint(form);

  form.addEventListener('input', () => {
    updatePriceHint(form);
    history.replaceState(null, '', '#/?' + formToHashParams(form).toString());
    scheduleSearch(form, root);
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('reset', () =>
    setTimeout(() => {
      updatePriceHint(form);
      history.replaceState(null, '', '#/?');
      void doSearch(form, root);
    }),
  );

  void doSearch(form, root);
}
