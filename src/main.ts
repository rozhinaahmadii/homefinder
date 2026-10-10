import './style.css';
import type { Listing } from './types';
import { loadListings } from './data';
import { renderListView } from './listView';
import { renderDetailView } from './detailView';
import { escapeHtml } from './format';

const app = document.querySelector<HTMLElement>('#app')!;
let listings: Listing[] = [];
let listScrollY = 0;
let currentView: 'list' | 'detail' | null = null;

function route(): void {
  const match = location.hash.match(/^#\/listings\/(.+)$/);

  if (match) {
    if (currentView === 'list') listScrollY = window.scrollY;
    const id = decodeURIComponent(match[1]);
    renderDetailView(app, listings.find((listing) => String(listing.id) === id));
    currentView = 'detail';
    window.scrollTo(0, 0);
  } else {
    renderListView(app, listings);
    if (currentView === 'detail') window.scrollTo(0, listScrollY);
    currentView = 'list';
  }
}

app.innerHTML = '<p class="status">Loading listings…</p>';

loadListings()
  .then((data) => {
    listings = data;
    route();
    window.addEventListener('hashchange', route);
  })
  .catch((error: Error) => {
    app.innerHTML = `<p class="status error">Could not load listings. ${escapeHtml(error.message)}</p>`;
  });
