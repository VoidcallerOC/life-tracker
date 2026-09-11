"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { LifeSnapshot } from "@/lib/os/types";
import { AppShell } from "@/components/os/app-shell";
import { hydrateLifeStore, useLifeStore } from "@/lib/os/store";

/**
 * Owns the lifecycle concerns around the store: initial hydrate, replaying
 * anything queued while offline, and re-reading server state when the app comes
 * back to the foreground. Writes themselves are per-record and live in the
 * store — this component no longer debounces a whole-document save.
 */
export function LifeOS({ initialSnapshot }: { initialSnapshot: LifeSnapshot }) {
  const [hydrated] = useState(() => {
    hydrateLifeStore(initialSnapshot);
    return true;
  });

  useEffect(() => {
    const store = useLifeStore.getState();

    store.setNotifier((message, tone) => {
      if (tone === "error") toast.error(message);
      else toast(message);
    });

    void store.flushOutbox();

    const onOnline = () => {
      void useLifeStore.getState().flushOutbox();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        const current = useLifeStore.getState();
        void current.flushOutbox();
        void current.refresh();
      }
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      useLifeStore.getState().setNotifier(null);
    };
  }, []);

  void hydrated;
  return <AppShell />;
}
