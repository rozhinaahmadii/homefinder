import type { Listing } from './types';
import { escapeHtml, formatFloor, formatPrice, formatRooms, offerTypeLabels } from './format';

function renderNotFound(root: HTMLElement): void {
  root.innerHTML = `
    <a href="#/" class="back-link">← Back to listings</a>
    <div class="not-found">
      <h1>Listing not found</h1>
      <p>This listing may have been removed or the link is incorrect.</p>
    </div>
  `;
}

export function renderDetailView(root: HTMLElement, listing: Listing | undefined): void {
  if (!listing) {
    renderNotFound(root);
    return;
  }

  const image = listing.image
    ? `<img src="${escapeHtml(listing.image)}" alt="${escapeHtml(listing.title)}" />`
    : `<div class="no-image">No photo</div>`;
  const location = [listing.address, listing.district, listing.city].filter(Boolean).join(', ');
  const pricePerM2 = listing.price ? Math.round(listing.price / listing.area) : NaN;

  const facts: [string, string][] = [
    ['Area', `${listing.area} m²`],
    ['Rooms', formatRooms(listing.rooms)],
    ['Floor', formatFloor(listing)],
    ['Property type', listing.propertyType.charAt(0).toUpperCase() + listing.propertyType.slice(1)],
    ['Year built', listing.yearBuilt ? String(listing.yearBuilt) : ''],
    ['Published', listing.publishedAt],
    ['Listing ID', String(listing.id)],
  ];

  const contact = listing.contact;

  root.innerHTML = `
    <a href="#/" class="back-link">← Back to listings</a>
    <article class="detail">
      <div class="detail-image">${image}</div>
      <div class="detail-columns">
        <div class="detail-main">
          <span class="badge">${escapeHtml(offerTypeLabels[listing.offerType] ?? listing.offerType)}</span>
          <h1>${escapeHtml(listing.title)}</h1>
          <p class="detail-location">${escapeHtml(location)}</p>
          <p class="detail-price">${escapeHtml(formatPrice(listing))}</p>
          ${
            listing.offerType === 'sale' && Number.isFinite(pricePerM2)
              ? `<p class="detail-price-m2">${pricePerM2.toLocaleString('pl-PL')} ${escapeHtml(listing.currency)}/m²</p>`
              : ''
          }

          <dl class="facts">
            ${facts
              .filter(([, value]) => value)
              .map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`)
              .join('')}
          </dl>

          <h2>Description</h2>
          <p class="description">${escapeHtml(listing.description || 'No description provided.')}</p>

          ${
            listing.features.length
              ? `<h2>Features</h2>
                 <ul class="features">${listing.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}</ul>`
              : ''
          }
        </div>
        ${
          contact
            ? `<aside class="contact">
                 <h2>Contact</h2>
                 <p class="contact-name">${escapeHtml(contact.name)}</p>
                 ${contact.agency ? `<p class="contact-agency">${escapeHtml(contact.agency)}</p>` : '<p class="contact-agency">Private seller</p>'}
                 ${
                   contact.email
                     ? `<a class="button" href="mailto:${escapeHtml(contact.email)}?subject=${encodeURIComponent(`Listing ${listing.id}: ${listing.title}`)}">Send an email</a>`
                     : ''
                 }
               </aside>`
            : ''
        }
      </div>
    </article>
  `;
}
