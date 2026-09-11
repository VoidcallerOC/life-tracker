# Life OS — idiot-proof

This is the live app on nicklife.xyz.

- **Do Now first.** The queue is animals due, tasks due, stale shops, missing next actions. Not a spreadsheet.
- **Same Blob as before.** `clients.json` + `life-store.json`. Cookie login. Password is `AUTH_PASSWORD`.
- **Spreadsheet kept** at `/clients` for bulk edits.
- **No client-side lock screen** — proxy already gates every page.
- **No seed overwrite.** The UI hydrates from Blob. Saves refuse an empty shop list or empty animals/content/personal snapshot.
- **Sans UI** (IBM Plex), compact 56px tab bar, no giant iPhone footer.
- Guardrails: undo, snooze, type-to-delete, type the paid amount, Lost needs a reason.

Week pin lives in `lib/os/priorities.ts`. Update that file when the week changes.
