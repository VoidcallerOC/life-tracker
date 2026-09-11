"use client";
import { bucketFor, bucketLabel, daysUntil, pillClass } from "@/lib/deadlines";

export function DeadlineBadge({ date }: { date: string }) {
  const b = bucketFor(date);
  const d = daysUntil(date);
  return (
    <span className={pillClass(b)}>
      {date ? `${date} · ${bucketLabel(b, d)}` : "—"}
    </span>
  );
}
