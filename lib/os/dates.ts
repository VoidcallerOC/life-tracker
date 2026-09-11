export type DeadlineBucket = "overdue" | "soon" | "later" | "none";

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return todayIso(d);
}

export function daysUntil(deadline: string, now = new Date()): number | null {
  if (!deadline) return null;
  const d = new Date(deadline + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}

export function bucketFor(deadline: string, now = new Date()): DeadlineBucket {
  const d = daysUntil(deadline, now);
  if (d == null) return "none";
  if (d < 0) return "overdue";
  if (d <= 1) return "soon";
  return "later";
}

export function bucketLabel(deadline: string, now = new Date()): string {
  const d = daysUntil(deadline, now);
  const b = bucketFor(deadline, now);
  if (b === "none") return "";
  if (b === "overdue") return `${Math.abs(d ?? 0)}d late`;
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  return `in ${d}d`;
}

export function formatLongDate(now = new Date()): string {
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function formatShort(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function weekdayHeading(now = new Date()): string {
  return now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
}
