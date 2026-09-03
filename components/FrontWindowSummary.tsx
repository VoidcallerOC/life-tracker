"use client";
import Link from "next/link";
import { useMemo } from "react";
import type { Client } from "@/lib/clients/types";
import { PIPELINE_STATUSES } from "@/lib/clients/types";
import { BackfillPaidDatesNotice } from "@/components/clients/backfill-paid-dates";

const CARE_PLAN_PRICE = 35;

function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function isThisMonth(dateStr: string, now: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

const STATUS_PILL: Record<Client["status"], string> = {
  Potential: "border-accent/40 text-accent bg-accent/10",
  Pending: "border-soon/40 text-soon bg-soon/10",
  Paid: "border-later/40 text-later bg-later/10",
  Lost: "border-border text-muted bg-panel2",
};

export function FrontWindowSummary({ clients }: { clients: Client[] }) {
  const stats = useMemo(() => {
    const now = new Date();
    const counts: Record<Client["status"], number> = { Potential: 0, Pending: 0, Paid: 0, Lost: 0 };
    let quoted = 0, deposit = 0, paid = 0, paidThisMonth = 0, outstanding = 0;

    for (const c of clients) {
      counts[c.status] += 1;
      quoted += c.quoted ?? 0;
      deposit += c.deposit ?? 0;
      paid += c.paid ?? 0;

      if (c.paid && isThisMonth(c.paidDate, now)) paidThisMonth += c.paid;

      if (c.status !== "Lost" && c.quoted != null) {
        const owed = c.quoted - (c.deposit ?? 0) - (c.paid ?? 0);
        if (owed > 0) outstanding += owed;
      }
    }

    return {
      counts,
      quoted,
      deposit,
      paid,
      paidThisMonth,
      outstanding,
      mrr: counts.Paid * CARE_PLAN_PRICE,
      total: clients.length,
    };
  }, [clients]);

  const active = useMemo(
    () =>
      clients
        .filter((c) => PIPELINE_STATUSES.includes(c.status))
        .sort((a, b) => a.client.localeCompare(b.client)),
    [clients],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Front Window client pipeline · care plan $35/mo · live from /clients
        </p>
        <Link href="/clients" className="tab-btn active">
          Manage clients →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total clients" value={stats.total} />
        <Stat label="Potential" value={stats.counts.Potential} />
        <Stat label="Pending" value={stats.counts.Pending} />
        <Stat label="Paid" value={stats.counts.Paid} tone="later" />
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-muted mb-2">Revenue</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Est. MRR" value={money(stats.mrr)} tone="later" />
          <Stat label="Paid this month" value={money(stats.paidThisMonth)} tone="later" />
          <Stat label="Paid all-time" value={money(stats.paid)} />
          <Stat label="Outstanding balance" value={money(stats.outstanding)} tone={stats.outstanding > 0 ? "soon" : undefined} />
        </div>
        <p className="mt-2 text-xs text-muted">
          Est. MRR = Paid clients × $35/mo care plan. Outstanding balance = quoted − deposit − paid, summed across
          non-Lost clients still owed money.
        </p>
        <div className="mt-2">
          <BackfillPaidDatesNotice clients={clients} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total quoted" value={money(stats.quoted)} />
        <Stat label="Total deposits" value={money(stats.deposit)} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-panel">
        <table className="grid">
          <thead>
            <tr>
              <th>Client</th>
              <th>Status</th>
              <th>Next action</th>
              <th>Contact</th>
              <th>$ Q / D / P</th>
            </tr>
          </thead>
          <tbody>
            {active.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted py-6">
                  No active (Potential/Pending) clients — check /clients for the full list.
                </td>
              </tr>
            )}
            {active.map((c) => (
              <tr key={c.id}>
                <td className="px-2 py-2 font-medium">
                  {c.client}
                  {c.businessType && <div className="text-xs text-muted">{c.businessType}</div>}
                </td>
                <td className="px-2 py-2">
                  <span className={`pill ${STATUS_PILL[c.status]}`}>{c.status}</span>
                </td>
                <td className="px-2 py-2 text-muted">{c.nextAction || "—"}</td>
                <td className="px-2 py-2 text-muted">{c.phone || c.contactName || "—"}</td>
                <td className="px-2 py-2 text-muted">
                  {c.quoted ? money(c.quoted) : "—"} / {c.deposit ? money(c.deposit) : "—"} /{" "}
                  {c.paid ? money(c.paid) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "overdue" | "soon" | "later";
}) {
  const toneClass =
    tone === "overdue" ? "text-overdue" : tone === "soon" ? "text-soon" : tone === "later" ? "text-later" : "text-text";
  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}
