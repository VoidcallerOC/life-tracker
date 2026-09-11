export type DeadlineBucket = "overdue" | "soon" | "later" | "none";

export function bucketFor(deadline: string, today = new Date()): DeadlineBucket {
  if (!deadline) return "none";
  const d = new Date(deadline + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "none";
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  if (diff < 0) return "overdue";
  if (diff <= 1) return "soon";
  return "later";
}

export function daysUntil(deadline: string, today = new Date()): number | null {
  if (!deadline) return null;
  const d = new Date(deadline + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}

export function pillClass(bucket: DeadlineBucket): string {
  switch (bucket) {
    case "overdue": return "pill pill-overdue";
    case "soon":    return "pill pill-soon";
    case "later":   return "pill pill-later";
    default:        return "pill pill-none";
  }
}

export function bucketLabel(bucket: DeadlineBucket, days: number | null): string {
  if (bucket === "none") return "—";
  if (bucket === "overdue") return `${Math.abs(days ?? 0)}d late`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days}d`;
}
