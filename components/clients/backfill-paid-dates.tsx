"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Client } from "@/lib/clients/types";
import { backfillPaidDates } from "@/app/clients/actions";

export function BackfillPaidDatesNotice({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<number | null>(null);

  const count = useMemo(
    () => clients.filter((c) => c.status === "Paid" && c.paid && !c.paidDate).length,
    [clients],
  );

  if (count === 0 && done == null) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs rounded-lg border border-soon/30 bg-soon/5 px-3 py-2">
      {done == null ? (
        <>
          <span className="text-soon">
            {count} paid client{count === 1 ? "" : "s"} missing a Paid Date — excluded from "Paid this month".
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const n = await backfillPaidDates();
                setDone(n);
                router.refresh();
              });
            }}
            className="rounded-md border border-border px-2 py-0.5 text-muted hover:text-text disabled:opacity-60"
            title="Stamps today's date on paid clients missing one. Approximate — not real payment history."
          >
            {pending ? "Filling…" : "Set today's date on all of them"}
          </button>
        </>
      ) : (
        <span className="text-later">Filled {done} ✓ — dates set to today, edit any that need a real date.</span>
      )}
    </div>
  );
}
