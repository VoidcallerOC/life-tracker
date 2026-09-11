import { PINNED, WEEK_OF } from "@/lib/priorities";

const TONE: Record<(typeof PINNED)[number]["tone"], string> = {
  overdue: "border-overdue/40 bg-overdue/10 text-overdue",
  soon: "border-soon/40 bg-soon/10 text-soon",
  later: "border-later/40 bg-later/10 text-later",
};

export function Priorities() {
  return (
    <section className="rounded-lg border border-border bg-panel p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text">This week — do not skip</h2>
        <span className="text-xs text-muted">{WEEK_OF}</span>
      </div>
      <p className="text-sm text-muted">
        Close Salem before you add names. Card shops only until two more say yes. Vintage, pets, antiques wait.
      </p>
      <ol className="space-y-2">
        {PINNED.map((item, i) => (
          <li key={item.id} className="rounded-lg border border-border bg-panel2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-sm">
                  {i + 1}. {item.title}
                </div>
                <p className="text-sm text-muted mt-1">{item.detail}</p>
              </div>
              <span className={`pill shrink-0 ${TONE[item.tone]}`}>{item.when}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
