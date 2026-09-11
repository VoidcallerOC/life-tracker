/** Pull every number out of messy money text and add them up. */
export function parseMoney(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  if (!raw) return null;
  const matches = raw.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return null;
  const total = matches.reduce((sum, part) => sum + Number(part), 0);
  return Number.isFinite(total) ? total : null;
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
