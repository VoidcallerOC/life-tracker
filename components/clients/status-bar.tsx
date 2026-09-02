"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { STATUSES, type Status } from "@/lib/clients/types";
import { setStatus } from "@/app/clients/actions";

const STYLES: Record<Status, { on: string; off: string }> = {
  Potential: {
    on: "bg-sky-400 text-zinc-950",
    off: "bg-zinc-900 text-sky-300 border border-zinc-800",
  },
  Pending: {
    on: "bg-amber-400 text-zinc-950",
    off: "bg-zinc-900 text-amber-300 border border-zinc-800",
  },
  Paid: {
    on: "bg-emerald-400 text-zinc-950",
    off: "bg-zinc-900 text-emerald-300 border border-zinc-800",
  },
  Lost: {
    on: "bg-zinc-400 text-zinc-950",
    off: "bg-zinc-900 text-zinc-400 border border-zinc-800",
  },
};

export function StatusBar({
  id,
  current,
  onStatusChange,
}: {
  id: string;
  current: Status;
  onStatusChange?: (status: Status) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState(false);

  function handleStatusChange(status: Status) {
    if (status === current || isPending) return;

    setSaveError(false);
    onStatusChange?.(status);
    startTransition(async () => {
      const saved = await setStatus(id, status);
      if (saved) {
        router.refresh();
      } else {
        onStatusChange?.(current);
        setSaveError(true);
      }
    });
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5">
        {STATUSES.map((status) => {
          const active = status === current;
          return (
            <button
              key={status}
              type="button"
              onClick={() => handleStatusChange(status)}
              disabled={active || isPending}
              aria-pressed={active}
              aria-label={`Move client to ${status}`}
              className={`h-12 rounded-xl text-xs font-semibold transition-transform active:scale-95 disabled:cursor-wait disabled:opacity-60 ${
                active ? STYLES[status].on : STYLES[status].off
              }`}
            >
              {status}
            </button>
          );
        })}
      </div>
      {saveError ? (
        <p className="mt-2 text-[11px] leading-4 text-rose-300">
          Couldn’t save. Production storage may not be configured (BLOB_READ_WRITE_TOKEN).
        </p>
      ) : null}
    </div>
  );
}

export function statusBadgeClass(status: Status): string {
  switch (status) {
    case "Potential":
      return "bg-sky-400/15 text-sky-300";
    case "Pending":
      return "bg-amber-400/15 text-amber-300";
    case "Paid":
      return "bg-emerald-400/15 text-emerald-300";
    case "Lost":
      return "bg-zinc-400/15 text-zinc-400";
  }
}
