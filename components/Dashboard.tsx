"use client";
import { useMemo } from "react";
import type { Store } from "@/lib/types";
import type { Client } from "@/lib/clients/types";
import { collectDashboardItems, collectDashboardStats } from "@/lib/dashboard";
import { bucketFor, bucketLabel, daysUntil, pillClass } from "@/lib/deadlines";
import { dashboardToIcs, downloadIcs } from "@/lib/ics";

export function Dashboard({
  store,
  clients,
  onJump,
}: {
  store: Store;
  clients: Client[];
  onJump: (s: string) => void;
}) {
  const items = useMemo(() => collectDashboardItems(store, clients), [store, clients]);
  const stats = useMemo(() => collectDashboardStats(items), [items]);
  const dated = useMemo(() => items.filter((it) => it.deadline), [items]);

  const empty = items.length === 0;

  function exportCalendar() {
    downloadIcs("life-os.ics", dashboardToIcs(items));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">
          Dated items can be dropped into Apple Calendar / Google Calendar as an .ics file.
        </p>
        <button
          type="button"
          onClick={exportCalendar}
          disabled={dated.length === 0}
          className="tab-btn active disabled:opacity-40"
          title={dated.length === 0 ? "Add a date first" : "Download calendar file"}
        >
          Export calendar (.ics)
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total items" value={stats.total} />
        <Stat label="Overdue" value={stats.overdue} tone="overdue" />
        <Stat label="Today / tomorrow" value={stats.soon} tone="soon" />
        <Stat label="Later" value={stats.later} tone="later" />
      </div>

      {empty ? (
        <div className="rounded-lg border border-dashed border-border bg-panel px-4 py-8 text-center text-sm text-muted">
          Nothing due right now. Set a date in Animals, Content, or Personal — or a Next Action on a Pending/Paid
          Forge client — and it&apos;ll show up here.
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-2">
            {items.map((it) => {
              const b = bucketFor(it.deadline);
              const d = daysUntil(it.deadline);
              return (
                <button
                  key={`${it.source}:${it.sourceId}`}
                  onClick={() => onJump(it.source)}
                  className="w-full text-left rounded-lg border border-border bg-panel p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted">{it.section}</div>
                      <div className="font-medium text-sm mt-0.5">{it.task || "—"}</div>
                    </div>
                    <span className={pillClass(b)}>
                      {it.deadline ? bucketLabel(b, d) : "—"}
                    </span>
                  </div>
                  {it.notes && <p className="text-sm text-muted mt-2">{it.notes}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                    {it.stage && <span>{it.stage}</span>}
                    {it.priority && <span className={`priority-${it.priority}`}>{it.priority}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          <div
            className="hidden md:grid overflow-x-auto rounded-lg border border-border bg-panel text-sm"
            style={{ gridTemplateColumns: "minmax(90px,0.8fr) minmax(160px,1.4fr) minmax(150px,1fr) minmax(70px,0.6fr) minmax(90px,0.8fr) minmax(160px,1.6fr)" }}
          >
            {["Section", "Task", "Deadline", "Priority", "Stage", "Notes"].map((label) => (
              <div
                key={label}
                className="text-left text-xs uppercase tracking-wide text-muted font-medium px-2 py-2 border-b border-border sticky top-0 bg-panel z-10"
              >
                {label}
              </div>
            ))}

            {items.map((it) => {
              const b = bucketFor(it.deadline);
              const d = daysUntil(it.deadline);
              return (
                <div
                  key={`${it.source}:${it.sourceId}`}
                  onClick={() => onJump(it.source)}
                  className="contents cursor-pointer group"
                >
                  <div className="px-2 py-2 border-b border-border/60 text-muted group-hover:bg-white/[0.02]">
                    {it.section}
                  </div>
                  <div className="px-2 py-2 border-b border-border/60 font-medium group-hover:bg-white/[0.02]">
                    {it.task || "—"}
                  </div>
                  <div className="px-2 py-2 border-b border-border/60 group-hover:bg-white/[0.02]">
                    <span className={pillClass(b)}>
                      {it.deadline || "—"}
                      {it.deadline && ` · ${bucketLabel(b, d)}`}
                    </span>
                  </div>
                  <div className={`px-2 py-2 border-b border-border/60 priority-${it.priority} group-hover:bg-white/[0.02]`}>
                    {it.priority || "—"}
                  </div>
                  <div className="px-2 py-2 border-b border-border/60 text-muted group-hover:bg-white/[0.02]">
                    {it.stage || "—"}
                  </div>
                  <div className="px-2 py-2 border-b border-border/60 text-muted group-hover:bg-white/[0.02]">
                    {it.notes || ""}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "overdue" | "soon" | "later" }) {
  const toneClass =
    tone === "overdue" ? "text-overdue"
    : tone === "soon" ? "text-soon"
    : tone === "later" ? "text-later"
    : "text-text";
  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}
