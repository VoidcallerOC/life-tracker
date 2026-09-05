import type { DashboardItem, Store } from "@/lib/types";
import type { Client } from "@/lib/clients/types";
import { SECTION_LABEL } from "@/lib/store";
import { bucketFor } from "@/lib/deadlines";

export function collectDashboardItems(store: Store, clients: Client[]): DashboardItem[] {
  const items: DashboardItem[] = [];
  for (const r of store.animals) {
    if (!r.nextCareDue) continue;
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
    if (!r.deadline) continue;
    items.push({
      section: SECTION_LABEL.content,
      task: r.task,
      deadline: r.deadline,
      notes: r.notes,
      priority: r.id.startsWith("prio-") ? "High" : "",
      stage: r.status,
      source: "content",
      sourceId: r.id,
    });
  }
  for (const r of store.personal) {
    if (!r.deadline) continue;
    items.push({
      section: SECTION_LABEL.personal,
      task: r.task,
      deadline: r.deadline,
      notes: r.notes,
      priority: r.category === "Priority" || r.id.startsWith("prio-") ? "High" : "",
      stage: r.status,
      source: "personal",
      sourceId: r.id,
    });
  }
  for (const c of clients) {
    if (c.status !== "Pending" && c.status !== "Paid") continue;
    if (!c.nextAction.trim()) continue;
    items.push({
      section: "Forge",
      task: c.client,
      deadline: "",
      notes: c.nextAction,
      priority: c.nextAction.startsWith("#01") ? "High" : "",
      stage: c.status,
      source: "clients",
      sourceId: c.id,
    });
  }
  return items.sort((a, b) => {
    const rank = (p: string) => (p === "High" ? 0 : p === "Medium" ? 1 : 2);
    const byP = rank(a.priority) - rank(b.priority);
    if (byP !== 0) return byP;
    return (a.deadline || "9999").localeCompare(b.deadline || "9999");
  });
}

export interface DashboardStats {
  total: number;
  overdue: number;
  soon: number;
  later: number;
}

export function collectDashboardStats(items: DashboardItem[]): DashboardStats {
  let overdue = 0,
    soon = 0,
    later = 0;
  for (const it of items) {
    const b = bucketFor(it.deadline);
    if (b === "overdue") overdue++;
    else if (b === "soon") soon++;
    else if (b === "later") later++;
  }
  return { total: items.length, overdue, soon, later };
}
