import { PINNED, WEEK_OF } from "@/lib/priorities";
import { cn } from "@/lib/cn";

const TONE: Record<(typeof PINNED)[number]["tone"], string> = {
  overdue: "border-overdue/40 bg-overdue/10 text-overdue",
  soon: "border-soon/40 bg-soon/10 text-soon",
  later: "border-later/40 bg-later/10 text-later",
};

export function WeekPin() {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg text-fg">This week — do not skip</h2>
        <span className="text-xs text-muted">{WEEK_OF}</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        Close Salem before you add names. Card shops only until two more say yes.
      </p>
      <ol className="mt-3 space-y-2">
        {PINNED.map((item, i) => (
          <li key={item.id} className="rounded-lg border border-border bg-surface2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-fg">
                  {i + 1}. {item.title}
                </div>
                <p className="mt-1 text-sm text-muted">{item.detail}</p>
              </div>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                  TONE[item.tone],
                )}
              >
                {item.when}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
