# Life OS

Personal tracker — Forge clients, animal care, content, and personal tasks.

Live: https://nicklife.xyz

Password-gated. Postgres-backed. Installable. Works offline.

## How it works

- **Do Now** — the only front door. Animals due today/overdue, tasks due today/tomorrow, stale shops, missing next actions.
- **Forge** — shop pipeline. Leads stay parked so 90 potentials cannot drown today.
- **Animals** — one tap Fed / Cleaned. Typed-name guard before delete.
- **Later** — content + personal that is not due yet.
- **Spreadsheet** — `/clients` for bulk edits.

Guardrails: undo, snooze, type-the-dollar-amount to mark Paid, a reason to mark Lost.

## Data

Every record is a row in Postgres, written one at a time.

- **Concurrency.** Each row carries a `version`. A write sends the version it read; if the row changed in the meantime the write is rejected with a 409, and the losing device reloads instead of overwriting. Two phones can no longer silently clobber each other.
- **Deletes are soft.** `deleted_at` is set rather than the row dropped, so undo restores the original record with its original id.
- **Offline.** Writes that cannot reach the server are queued in IndexedDB and replayed on reconnect. The header shows a cloud icon with the pending count.
- **Backups.** Settings → Download backup writes a JSON snapshot; Import restores one in a single transaction.

## Setup

1. `npm install`
2. Copy `.env.example` → `.env.local` and set `AUTH_PASSWORD`, `DATABASE_URL`, and `SESSION_SECRET`.
3. `npm run db:migrate`
4. `npm run dev`

Any Postgres works — Supabase, Neon, Vercel Postgres, or a local server.

### Migrating from the old Blob storage

The previous version stored everything in two JSON blobs. To bring that data across, set `DATABASE_URL` and the Blob `*_READ_WRITE_TOKEN`, then:

```bash
npm run db:import            # dry run — prints what it would write
npm run db:import -- --apply # writes the rows
```

It is keyed on the existing record ids and skips rows that already exist, so it is safe to run twice.

### Notifications

```bash
npm run push:keys   # prints a VAPID key pair
```

Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`, then turn notifications on per device in Settings. `vercel.json` runs `/api/cron/notify` daily; it pushes when animal care is overdue or work is due. Without the keys, notifications are simply unavailable and nothing else changes.

### Installing on a phone

Open the site → Share → Add to Home Screen. iOS only allows notifications for installed apps, so install first, then enable them in Settings.

## Auth

One shared password. Sessions are random tokens, stored hashed, valid 30 days, and revocable — "Log out on every device" in Settings ends all of them.

Set `SESSION_SECRET` (`openssl rand -hex 32`). Without it, cookies are signed with a key derived from `AUTH_PASSWORD`, which means rotating the password signs everyone out.

`/api/summary` and `/api/cron/notify` are for automation and authenticate with the `x-admin-key` header (`ADMIN_API_KEY`, falling back to `AUTH_PASSWORD`). Keys are never accepted from the query string.

## Dev

```bash
npm run dev        # http://localhost:3000
npm test           # unit tests; database tests run when DATABASE_URL is set
npm run typecheck
npm run lint
npm run build
npm run icons      # regenerate PWA icons
```

CI runs lint, typecheck, migrations, tests against a real Postgres, and a production build.
