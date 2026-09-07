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
- Production: Vercel Blob (`clients.json` + `life-store.json`). `clients.json` is the canonical source of truth; the app never writes client data to the Vercel function filesystem and never replaces a missing Blob object with the seed file.
- Local: `data/clients.json` and `data/life-store.json`.
- Auth: shared password via `AUTH_PASSWORD`.
- If Animals/Content/Personal are empty on first load, a small starter set is written so the dashboard is not blank.

## Setup
1. Copy `.env.example` → `.env.local` and set `AUTH_PASSWORD`.
2. Production: connect one Vercel Blob store to this project, set `BLOB_ACCESS_MODE` to the store's actual mode (`private` or `public`), and set `LIFE_TRACKER_BLOB_READ_WRITE_TOKEN` to that store's generated token. Redeploy. Do not configure multiple ambiguous `*_READ_WRITE_TOKEN` values.
3. Before opening production to edits, run `BLOB_ACCESS_MODE=... LIFE_TRACKER_BLOB_READ_WRITE_TOKEN=... npm run migrate:client-ids -- --apply`. The command validates every record, writes a rollback/import copy, stages the ID migration, verifies it, and only then replaces canonical `clients.json`.
4. On `/clients`, run **Set today's date** if Paid clients are missing `paidDate`.
5. Phone: open the site → Share → Add to Home Screen.

## Dev
```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run typecheck
```
