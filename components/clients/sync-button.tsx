"use client";

import { useState, useTransition } from "react";
import { reseedFromRepo } from "@/app/clients/actions";

export function SyncButton() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            "Sync from repo? This replaces the live client list — including any edits made in the app — with the version shipped in the repository.",
          )
        ) {
          return;
        }
        startTransition(async () => {
          await reseedFromRepo();
          setDone(true);
          setTimeout(() => setDone(false), 2500);
        });
      }}
      className="h-9 rounded-lg border border-border px-3 text-xs font-medium text-muted disabled:opacity-60"
      title="Overwrite the live list with the version from the repo"
    >
      {pending ? "Syncing…" : done ? "Synced ✓" : "Sync"}
    </button>
  );
}
