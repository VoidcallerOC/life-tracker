import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { DeadlineBucket } from "@/lib/dates";
import type { Status } from "@/lib/types";

export function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DeadlinePill({ bucket, label }: { bucket: DeadlineBucket; label: string }) {
  if (!label || bucket === "none") return null;
  const tone =
    bucket === "overdue"
      ? "border-overdue/40 text-overdue bg-overdue/10"
      : bucket === "soon"
        ? "border-soon/40 text-soon bg-soon/10"
        : "border-later/40 text-later bg-later/10";
  return <Pill className={tone}>{label}</Pill>;
}

export function StatusPill({ status }: { status: Status }) {
  const tone =
    status === "Paid"
      ? "border-later/40 text-later bg-later/10"
      : status === "Pending"
        ? "border-soon/40 text-soon bg-soon/10"
        : status === "Lost"
          ? "border-border text-muted bg-surface2"
          : "border-border text-fg bg-surface2";
  return <Pill className={tone}>{status}</Pill>;
}
