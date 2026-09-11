import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/badge";
import { ContactActions } from "@/components/contact-actions";
import { useLifeStore } from "@/lib/life-store";
import { CARE_PLAN, STALE_AFTER_DAYS } from "@/lib/guardrails";
import { formatMoney } from "@/lib/money";
import { addDays, daysUntil, todayIso } from "@/lib/dates";
import type { Client, Status } from "@/lib/types";
import { cn } from "@/lib/cn";

type Filter = "need" | "pipeline" | "leads" | "paid" | "lost";

function isThisMonth(dateStr: string, now: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function needsYou(c: Client, today: string): boolean {
  if (c.status === "Lost") return false;
  if ((c.status === "Pending" || c.status === "Paid") && !c.nextAction.trim()) return true;
  if (c.status !== "Paid") {
    const touched = c.contacted || Boolean(c.lastContacted);
    if (touched) {
      const staleOn = c.lastContacted ? addDays(c.lastContacted, STALE_AFTER_DAYS) : today;
      const d = daysUntil(staleOn);
      if (d != null && d < 0) return true;
    }
  }
  if (c.dueDate) {
    const d = daysUntil(c.dueDate);
    if (d != null && d <= 1) return true;
  }
  return false;
}

export function ForgeView({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate: () => void }) {
  const clients = useLifeStore((s) => s.clients);
  const markContacted = useLifeStore((s) => s.markContacted);
  const [filter, setFilter] = useState<Filter>("need");
  const today = todayIso();

  const stats = useMemo(() => {
    const now = new Date();
    const counts: Record<Status, number> = { Potential: 0, Pending: 0, Paid: 0, Lost: 0 };
    let paidAll = 0;
    let paidThisMonth = 0;
    let quoted = 0;
    let outstanding = 0;
    let leads = 0;
    for (const c of clients) {
      counts[c.status] += 1;
      paidAll += c.paid ?? 0;
      quoted += c.quoted ?? 0;
      if (c.paid && isThisMonth(c.paidDate, now)) paidThisMonth += c.paid;
      if (c.status !== "Lost" && c.quoted != null) {
        const owed = c.quoted - (c.deposit ?? 0) - (c.paid ?? 0);
        if (owed > 0) outstanding += owed;
      }
      if (c.status === "Potential" && !c.contacted) leads += 1;
    }
    return {
      counts,
      paidAll,
      paidThisMonth,
      quoted,
      outstanding,
      mrr: counts.Paid * CARE_PLAN,
      need: clients.filter((c) => needsYou(c, today)).length,
      leads,
    };
  }, [clients, today]);

  const visible = useMemo(() => {
    if (filter === "need") return clients.filter((c) => needsYou(c, today));
    if (filter === "leads") return clients.filter((c) => c.status === "Potential" && !c.contacted);
    if (filter === "paid") return clients.filter((c) => c.status === "Paid");
    if (filter === "lost") return clients.filter((c) => c.status === "Lost");
    return clients.filter((c) => c.status !== "Lost" && !(c.status === "Potential" && !c.contacted));
  }, [clients, filter, today]);

  const filters: { id: Filter; label: string }[] = [
    { id: "need", label: `Need me ${stats.need}` },
    { id: "pipeline", label: "Hot" },
    { id: "leads", label: `Leads ${stats.leads}` },
    { id: "paid", label: `Paid ${stats.counts.Paid}` },
    { id: "lost", label: "Lost" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Need you" value={stats.need} warn={stats.need > 0} />
        <Stat label="Est. MRR" value={formatMoney(stats.mrr)} />
        <Stat label="Paid this month" value={formatMoney(stats.paidThisMonth)} />
        <Stat label="Outstanding" value={formatMoney(stats.outstanding)} warn={stats.outstanding > 0} />
      </div>
      <p className="text-xs text-muted">
        Est. MRR = Paid shops × $35 care plan. {formatMoney(stats.paidAll)} collected all-time
        {stats.quoted ? ` · ${formatMoney(stats.quoted)} quoted` : ""}.
      </p>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "h-9 shrink-0 rounded-full border px-3 text-xs font-medium",
              filter === f.id
                ? "border-border bg-surface2 text-fg"
                : "border-border bg-surface text-muted",
            )}
          >
            {f.label}
          </button>
        ))}
        <Button size="sm" className="ml-auto shrink-0 rounded-full" onClick={onCreate}>
          <Plus className="size-4" />
          Add shop
        </Button>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-muted">
          {filter === "need"
            ? "Nobody needs you right now."
            : filter === "leads"
              ? "No uncalled leads."
              : "Nothing in this lane."}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((c) => (
            <li key={c.id} className="rounded-xl border border-border bg-surface p-4">
              <button type="button" className="w-full text-left" onClick={() => onOpen(c.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg leading-snug text-fg">{c.name}</h3>
                    {c.businessType ? <p className="text-xs text-muted">{c.businessType}</p> : null}
                  </div>
                  <StatusPill status={c.status} />
                </div>
                <p className={cn("mt-2 text-sm", c.nextAction ? "text-fg" : "text-overdue")}>
                  {c.nextAction ? `Next: ${c.nextAction}` : "No next action"}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                  {c.contactName ? <span>{c.contactName}</span> : null}
                  {c.phone ? <span>{c.phone}</span> : null}
                  {c.lastContacted ? <span>Last {c.lastContacted}</span> : null}
                  {c.paid ? <span>{formatMoney(c.paid)} paid</span> : null}
                </div>
              </button>
              <div className="mt-3 space-y-2">
                <ContactActions client={c} />
                {c.status !== "Lost" ? (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      markContacted(c.id);
                      toast(`Logged contact: ${c.name}`);
                    }}
                  >
                    I called
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={cn("mt-1 text-xl font-semibold tabular-nums", warn ? "text-soon" : "text-fg")}>
        {value}
      </div>
    </div>
  );
}
