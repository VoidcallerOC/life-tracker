"use client";
import { useMemo } from "react";
import type { DashboardItem, Store } from "@/lib/types";
import type { Client } from "@/lib/clients/types";
import { SECTION_LABEL } from "@/lib/store";
import { bucketFor, bucketLabel, daysUntil, pillClass } from "@/lib/deadlines";

function collect(store: Store, clients: Client[]): DashboardItem[] {
  const items: DashboardItem[] = [];
  for (const r of store.animals) {
    items.push({
      section: SECTION_LABEL.animals,
      task: `${r.name || "Unnamed"} · ${r.species || "Animal"}`.trim(),
      deadline: r.nextCareDue,
      notes: r.notes,
      priority: "",
      stage: r.enclosure,
      source: "animals",
      sourceId: r.id,
    });
  }
  for (const r of store.content) {
    items.push({
      section: SECTION_LABEL.content,
      task: r.task,
      deadline: r.deadline,
      notes: r.notes,
      priority: "",
      stage: r.status,
      source: "content",
      sourceId: r.id,
    });
  }
  for (const r of store.personal) {
    items.push({
      section: SECTION_LABEL.personal,
      task: r.task,
      deadline: r.deadline,
      notes: r.notes,
      priority: "",
      stage: r.status,
      source: "personal",
      sourceId: r.id,
    });
  }
  // Only actionable clients: not Lost, with a real next step set — otherwise
  // all 50+ CRM rows would flood a dashboard meant for "what needs attention."
  for (const c of clients) {
    if (c.status === "Lost") continue;
    if (!c.nextAction.trim()) continue;
    items.push({
      section: "Forge",
      task: c.client,
      deadline: "",
      notes: c.nextAction,
      priority: "",
      stage: c.status,
      source: "clients",
      sourceId: c.id,
    });
  }
  return items.sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"));
}

export function Dashboard({
  store,
  clients,
  onJump,
}: {
  store: Store;
  clients: Client[];
  onJump: (s: string) => void;
}) {
  const items = useMemo(() => collect(store, clients), [store, clients]);

  const stats = useMemo(() => {
    let overdue = 0, soon = 0, later = 0;
    for (const it of items) {
      const b = bucketFor(it.deadline);
      if (b === "overdue") overdue++;
      else if (b === "soon") soon++;
      else if (b === "later") later++;
    }
    return { total: items.length, overdue, soon, later };
  }, [items]);

  const empty = items.length === 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total items" value={stats.total} />
        <Stat label="Overdue" value={stats.overdue} tone="overdue" />
        <Stat label="Today / tomorrow" value={stats.soon} tone="soon" />
        <Stat label="Later" value={stats.later} tone="later" />
      </div>

      {empty ? (
        <div className="rounded-lg border border-dashed border-border bg-panel px-4 py-8 text-center text-sm text-muted">
          Nothing here yet. Add something in Animals, Content, or Personal — or set a Next Action on a Forge
          client — and it'll show up here.
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
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

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-border bg-panel">
            <table className="grid">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Task</th>
                  <th>Deadline</th>
                  <th>Priority</th>
                  <th>Stage</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const b = bucketFor(it.deadline);
                  const d = daysUntil(it.deadline);
                  return (
                    <tr
                      key={`${it.source}:${it.sourceId}`}
                      onClick={() => onJump(it.source)}
                      className="cursor-pointer"
                    >
                      <td className="px-2 py-2 text-muted">{it.section}</td>
                      <td className="px-2 py-2 font-medium">{it.task || "—"}</td>
                      <td className="px-2 py-2">
                        <span className={pillClass(b)}>
                          {it.deadline || "—"}{it.deadline && ` · ${bucketLabel(b, d)}`}
                        </span>
                      </td>
                      <td className={`px-2 py-2 priority-${it.priority}`}>{it.priority || "—"}</td>
                      <td className="px-2 py-2 text-muted">{it.stage || "—"}</td>
                      <td className="px-2 py-2 text-muted">{it.notes || ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
