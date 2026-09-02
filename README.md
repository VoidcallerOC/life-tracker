# Life OS

Personal life tracker web app, ported from a Google Sheets "Life OS" setup.

## Sections
- **Dashboard** — unified list of every task/deadline across sections, sorted by date.
- **SaaS** — client projects with stage, deadline, follow-up date, contact, priority.
- **Animals** — animal ID, species, stage, buyer, sale date.
- **Content** — social/marketing tasks with platform.
- **Personal** — general to-dos with category and status.

## Deadline colors
- **Red** — overdue
- **Yellow** — today or tomorrow
- **Green** — later

## Data
Stored in your browser's `localStorage` under the key `life-os:v1`. Nothing is sent to a server.

Import / export CSV per section from the section's toolbar. Column names match the original sheet.

## Dev
```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run typecheck
```
