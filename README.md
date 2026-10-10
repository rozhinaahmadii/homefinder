# Homefinder

A small static web application for browsing real estate listings (apartments, studios and houses for sale and rent).

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Getting started

```bash
npm install
npm run dev
```

The development server prints a local URL (by default http://localhost:5173).

Other scripts:

- `npm run build` – type-checks the project and builds it into `dist/`
- `npm run preview` – serves the production build locally

## Technologies

- [Vite](https://vite.dev/) – development server and build tool
- TypeScript
- Plain HTML and CSS, no frontend framework

There is no backend. All data is loaded from a static JSON file.

## Project structure

```
index.html              page shell
public/
  data/listings.json    listings data
  images/               listing images
src/
  main.ts               app entry point and hash-based routing
  data.ts               loads the listings JSON
  types.ts              Listing type
  listView.ts           listings page with search and filters
  detailView.ts         listing details page
  format.ts             formatting helpers
  style.css             styles
```

## Data

All listings live in a single file: [`public/data/listings.json`](public/data/listings.json). It contains around 100 fictional listings. Each listing includes fields such as title, location (city, district, address), price and currency, area, number of rooms, floor, description, features, image, publication date and contact details.

## Current functionality

- **Listings page** (`#/`) – shows all listings as cards with price, title, location, area, number of rooms and offer type.
- **Search** – free-text search across title, description, city, district and address.
- **Filters** – city, offer type (sale / rent), price range, minimum number of rooms and area range. Filters are applied as you type and can be cleared with a single button.
- **Listing details** (`#/listings/:id`) – full description, key facts, features, price per m² for sale offers and contact details.
