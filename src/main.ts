import './style.css';
import { fetchListing } from './data';
import { renderListView } from './listView';
import { renderDetailView } from './detailView';
import { escapeHtml } from './format';

const app = document.querySelector<HTMLElement>('#app')!;
let listScrollY = 0;
let currentView: 'list' | 'detail' | null = null;

async function showDetail(idStr: string): Promise<void> {
  if (currentView === 'list') listScrollY = window.scrollY;
  currentView = 'detail';
  app.innerHTML = '<p class="status">Loading…</p>';
  try {
    const listing = await fetchListing(Number(idStr));
    renderDetailView(app, listing);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    app.innerHTML = `<p class="status error">Could not load listing. ${escapeHtml(msg)}</p>`;
  }
  window.scrollTo(0, 0);
}

function route(): void {
  const match = location.hash.match(/^#\/listings\/(.+)$/);
  if (match) {
    void showDetail(decodeURIComponent(match[1]));
  } else {
    const wasDetail = currentView === 'detail';
    const savedScroll = listScrollY;
    currentView = 'list';
    void renderListView(app).then(() => {
      if (wasDetail) window.scrollTo(0, savedScroll);
    });
  }
}

route();
window.addEventListener('hashchange', route);
