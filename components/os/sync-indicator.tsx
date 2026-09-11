"use client";

import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useLifeStore } from "@/lib/os/store";
import { pending } from "@/lib/os/outbox";

/**
 * Tells the truth about whether a change reached the server.
 *
 * The old app saved on a debounce with no feedback, so "I tapped Fed" and "the
 * server knows the animal was fed" were indistinguishable. Idle renders nothing
 * — a permanent green tick is noise.
 */
export function SyncIndicator() {
  const syncState = useLifeStore((s) => s.syncState);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      void pending().then((entries) => {
        if (!cancelled) setQueued(entries.length);
      });
    };
    check();
    const timer = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [syncState]);

  if (syncState === "offline" || queued > 0) {
    return (
      <span
        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-soon"
        title={
          queued > 0
            ? `${queued} change${queued === 1 ? "" : "s"} saved on this device, waiting to sync`
            : "Offline — changes are saved on this device"
        }
      >
        <CloudOff className="size-4" />
        {queued > 0 ? queued : null}
      </span>
    );
  }

  if (syncState === "error") {
    return (
      <span
        className="flex items-center rounded-md px-1.5 py-1 text-overdue"
        title="The last change did not save"
      >
        <TriangleAlert className="size-4" />
      </span>
    );
  }

  if (syncState === "saving") {
    return (
      <span className="flex items-center rounded-md px-1.5 py-1 text-muted" title="Saving…">
        <RefreshCw className="size-4 animate-spin" />
      </span>
    );
  }

  return null;
}
