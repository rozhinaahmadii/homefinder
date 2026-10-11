import type { Listing } from './core/types';
import type { AssistantResponse } from './data';
import { askAssistant, fetchListing } from './data';
import { escapeHtml } from './format';

interface Shortlist {
  response: AssistantResponse;
  listings: Listing[];
}

export interface AssistantHooks {
  renderCard: (listing: Listing) => string;
  setListHidden: (hidden: boolean) => void;
}

// Kept across re-renders so the shortlist is still there after visiting a detail page.
let lastShortlist: Shortlist | null = null;

function renderNote(label: string, items: string[]): string {
  if (!items.length) return '';
  return `<p><strong>${label}:</strong> ${escapeHtml(items.join('; '))}</p>`;
}

function renderMessage(message: string): string {
  return `<p>${escapeHtml(message)}</p>`;
}

function renderShortlist({ response, listings }: Shortlist, hooks: AssistantHooks): string {
  const reasons = new Map(response.listings.map((l) => [l.id, l.reason]));
  const cards = listings
    .map(
      (l) =>
        `<div>${hooks.renderCard(l)}<p class="price-hint">${escapeHtml(reasons.get(l.id) ?? '')}</p></div>`,
    )
    .join('');
  return `
    ${renderMessage(response.message)}
    ${renderNote('Assumptions', response.assumptions)}
    ${renderNote('Loosened', response.relaxed)}
    ${renderNote('Warnings', response.warnings)}
    <div class="grid">${cards}</div>
    <button type="button" class="button-secondary" data-assistant-back>Back to all listings</button>
  `;
}

async function loadShortlist(message: string): Promise<Shortlist> {
  const response = await askAssistant(message);
  const fetched = await Promise.all(response.listings.map((l) => fetchListing(l.id)));
  return { response, listings: fetched.filter((l) => l !== null) };
}

export function mountAssistant(panel: HTMLElement, hooks: AssistantHooks): void {
  panel.innerHTML = `
    <form class="assistant-form">
      <input type="text" name="message" maxlength="500" required
        placeholder="Describe what you are looking for" aria-label="Describe what you are looking for" />
      <button type="submit" class="button">Ask</button>
    </form>
    <div class="assistant-output"></div>
  `;
  const form = panel.querySelector<HTMLFormElement>('form')!;
  const input = panel.querySelector<HTMLInputElement>('input')!;
  const button = panel.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const output = panel.querySelector<HTMLElement>('.assistant-output')!;

  function setBusy(busy: boolean): void {
    input.disabled = busy;
    button.disabled = busy;
  }

  function show(shortlist: Shortlist): void {
    const hasListings = shortlist.listings.length > 0;
    lastShortlist = hasListings ? shortlist : null;
    output.innerHTML = hasListings
      ? renderShortlist(shortlist, hooks)
      : renderMessage(shortlist.response.message);
    hooks.setListHidden(hasListings);
  }

  function showAllListings(): void {
    lastShortlist = null;
    output.innerHTML = '';
    hooks.setListHidden(false);
  }

  if (lastShortlist) show(lastShortlist);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    setBusy(true);
    output.innerHTML = '<p class="status">Searching…</p>';
    try {
      show(await loadShortlist(message));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'The assistant could not answer. Try again.';
      lastShortlist = null;
      output.innerHTML = `<p class="status error">${escapeHtml(msg)}</p>`;
      hooks.setListHidden(false);
    }
    setBusy(false);
  });

  output.addEventListener('click', (e) => {
    if (e.target instanceof HTMLElement && e.target.matches('[data-assistant-back]')) {
      showAllListings();
    }
  });
}
