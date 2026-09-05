/** Pull every number out of a free-text money field and add them up.
 *  "200 cash + 150 trade" → 350
 *  "$35/mo + $200 site" → 235
 *  "trade only" → null
 */
export function parseMoney(value: unknown): number | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const matches = raw.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return null;
  const total = matches.reduce((sum, part) => sum + Number(part), 0);
  return Number.isFinite(total) ? total : null;
}

export function moneyDetail(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^-?\$?[\d,]+(?:\.\d+)?$/.test(raw)) return "";
  return raw;
}

export function mergeMoneyNote(notes: string, label: string, raw: unknown): string {
  const detail = moneyDetail(raw);
  if (!detail) return notes;
  const line = `${label}: ${detail}`;
  if (notes.includes(line)) return notes;
  return notes ? `${notes}
${line}` : line;
}
