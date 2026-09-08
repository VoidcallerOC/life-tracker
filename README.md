# Life OS

Personal tracker for Nick — Forge clients, animal care, content, and personal tasks.
Live: https://life-tracker-orcin-nine.vercel.app/

## Sections
- **Dashboard** — dated work across sections + Pending/Paid Forge next actions. Export `.ics` for calendar reminders.
- **Forge** — client pipeline (Potential / Pending / Paid / Lost), $35/mo care plan MRR.
- **Animals** — name, species, enclosure, last fed/cleaned, next care due.
- **Content** — social/marketing tasks with platform + deadline.
- **Personal** — general to-dos.

## Deadline colors
- **Red** — overdue
- **Yellow** — today or tomorrow
- **Green** — later

## Data
- Production: Vercel Blob (`clients.json` + `life-store.json`). The app never writes to the Vercel function filesystem. The default store mode is private; set `BLOB_ACCESS_MODE=public` only if the connected Blob store was created as public.
- Local: `data/clients.json` and `data/life-store.json`.
- Auth: shared password via `AUTH_PASSWORD`.
- If Animals/Content/Personal are empty on first load, a small starter set is written so the dashboard is not blank.

## Setup
1. Copy `.env.example` → `.env.local` and set `AUTH_PASSWORD`.
2. Production: connect one Vercel Blob store to this project, ensure its access mode matches `BLOB_ACCESS_MODE` (default `private`), and redeploy. The store's generated `*_READ_WRITE_TOKEN` must be present in the deployment environment. Confirm the storage pill on `/clients` says `Vercel Blob ✓`.
3. If the store was created with the other access mode, either change `BLOB_ACCESS_MODE` or recreate/connect the store with the intended mode; the server also retries the alternate mode to make an existing store migration safe.
4. On `/clients`, run **Set today's date** if Paid clients are missing `paidDate`.
5. Phone: open the site → Share → Add to Home Screen.

## Dev
```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run typecheck
```
