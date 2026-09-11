# Life OS — idiot-proof

This is the live app on nicklife.xyz.

## The rules

- **Do Now first.** The queue is animals due, tasks due, stale shops, missing next actions. Not a spreadsheet.
- **Postgres, one row at a time.** Every tap writes one record. Nothing rewrites the whole tracker any more, so nothing can wipe it.
- **Two devices are safe.** If you edit the same shop on your phone and laptop, the second save is rejected and that screen reloads. Nobody's edit disappears silently.
- **Offline works.** Mark an animal fed with no signal and it is saved on the phone. The cloud icon in the header shows how many changes are waiting. They go up when you reconnect.
- **Undo restores the actual record.** Deletes are soft, so undo brings back the same row, not a copy.
- **Spreadsheet kept** at `/clients` for bulk edits. It writes through the same versioned path.

## Where things live

- Week pin: edit it in the app (pencil on the "This week" card). No more code edits to change the week.
- Backups: Settings → Download backup. Import replaces everything in one transaction.
- Notifications: Settings → "Notify me when care is overdue". Install to the Home Screen first on iPhone.

## If something looks wrong

- **Red triangle in the header** — the last change did not save. It was rolled back; try again.
- **Cloud icon with a number** — you are offline, that many changes are queued on this device.
- **"Database not connected"** — `DATABASE_URL` is missing from the deployment. Nothing is lost; set it and redeploy.
- **An error screen** — your data is on the server, not in the page. Tap Reload.

## What changed from the Blob version

The old app kept everything in two JSON files and rewrote both on every keystroke-burst. That is why it needed "refuse to write an empty list" guards, why the second device won, and why a bad save could take the lot. All of that is gone: rows, versions, and real sessions.

The old `/api/admin/*` maintenance endpoints were removed. They were Blob-specific, could mutate via GET, and took the password in the URL. Use `psql` for maintenance now.
