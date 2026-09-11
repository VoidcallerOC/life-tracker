"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Store } from "@/lib/types";
import type { Client } from "@/lib/clients/types";
import { isEmptyStore } from "@/lib/store";
import { saveStore, saveClientsAction } from "@/app/actions/lifeStore";
import { AppShell } from "@/components/os/app-shell";
import { hydrateLifeStore, useLifeStore } from "@/lib/os/store";
import { blobToSnapshot, osClientToBlob, osTasksToBlobStore } from "@/lib/os/blob-map";

const SAVE_DEBOUNCE_MS = 800;

export function LifeOS({
  initialClients,
  initialStore,
}: {
  initialClients: Client[];
  initialStore: Store;
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useState(() => {
    hydrateLifeStore(blobToSnapshot(initialClients, initialStore));
    return true;
  });

  useEffect(() => {
    return useLifeStore.subscribe((state) => {
      if (state.clients.length === 0) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const clients = state.clients.map(osClientToBlob);
        const store = osTasksToBlobStore(state.animals, state.tasks);
        if (clients.length === 0) return;
        // Never clobber Blob with an empty animals/content/personal snapshot.
        const writes: Promise<unknown>[] = [saveClientsAction(clients)];
        if (!isEmptyStore(store)) writes.push(saveStore(store));
        void Promise.all(writes).then((results) => {
          const clientResult = results[0] as Awaited<ReturnType<typeof saveClientsAction>>;
          if (clientResult && "ok" in clientResult && clientResult.ok === false) {
            toast.error(clientResult.error || "Could not save shops");
          }
        });
      }, SAVE_DEBOUNCE_MS);
    });
  }, []);

  return <AppShell />;
}
