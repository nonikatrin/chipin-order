# Chip!n Order

Pre-order (PO) app for home sellers and community organisers: orders, payments, pickup/delivery,
supplier payouts and jastip (personal-shopper) trips — built for running POs over WhatsApp.

- **Sellers** sign in with a seller account; their data syncs to the cloud and still works offline.
- **Buyers** never need an account: they open the seller's order link, pick items and send back an order code.

## Stack

Vite + React + TypeScript, zustand (local-first stores), Supabase (auth + Postgres with Row Level
Security, one row per PO per seller). Deployed to GitHub Pages by `.github/workflows/deploy.yml`.

## Run locally

```bash
npm install
npm run dev          # http://localhost:5176
npm run typecheck
npm run build
```

`VITE_CLOUD_OFF=1 npm run dev` runs without seller accounts (local data only).
The database schema lives in `supabase/migrations/`.
