# Life OS

Personal tracker for Nick — Forge clients, animal care, content, and personal tasks.

Live: https://nicklife.xyz

Password-gated. Blob-backed. Same data on every device.

## How it works
- **Do Now** — the only front door. Animals due today/overdue, tasks due today/tomorrow, stale shops, missing next actions.
- **Forge** — shop pipeline. Leads stay parked so 90 potentials cannot drown today. Paid shops show care-plan money.
- **Animals** — one tap Fed / Cleaned. Typed-name guard before delete.
- **Later** — content + personal that is not due yet.
- **Spreadsheet** — `/clients` for bulk edits.

Guardrails: undo, snooze, type-to-delete, type-the-dollar-amount to mark Paid, reason to mark Lost.

## Data
- Production: Vercel Blob (`clients.json` + `life-store.json`). The app never writes to the Vercel function filesystem. Default store mode is private; set `BLOB_ACCESS_MODE=public` only if the connected Blob store was created as public.
- Local: `data/clients.json` and `data/life-store.json`.
- Auth: shared password via `AUTH_PASSWORD`.
- Homepage mutations debounce 800ms and write back to Blob. An empty client list or empty animals/content/personal snapshot is refused so production data cannot be wiped by a bad hydrate.

## Setup
1. Copy `.env.example` → `.env.local` and set `AUTH_PASSWORD`.
2. Production: connect one Vercel Blob store to this project, ensure its access mode matches `BLOB_ACCESS_MODE` (default `private`), and redeploy. The store's generated `*_READ_WRITE_TOKEN` must be present in the deployment environment. Confirm the storage pill on `/clients` says `Vercel Blob ✓`.
3. Phone: open the site → Share → Add to Home Screen.

## Dev
```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run typecheck
```
