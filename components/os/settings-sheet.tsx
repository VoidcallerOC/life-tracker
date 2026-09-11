"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { SheetFrame } from "@/components/os/sheet-frame";
import { Button } from "@/components/os/ui/button";
import { askConfirm } from "@/components/os/confirm-gate";
import { useLifeStore } from "@/lib/os/store";
import { todayIso } from "@/lib/os/dates";
import { downloadIcs, lifeToIcs } from "@/lib/os/ics";
import { logoutAction } from "@/app/login/actions";
import type { LifeSnapshot } from "@/lib/os/types";

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const clients = useLifeStore((s) => s.clients);
  const animals = useLifeStore((s) => s.animals);
  const tasks = useLifeStore((s) => s.tasks);
  const coachDismissed = useLifeStore((s) => s.coachDismissed);
  const replaceAll = useLifeStore((s) => s.replaceAll);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function exportJson() {
    const snap: LifeSnapshot = { clients, animals, tasks, coachDismissed };
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `life-os-${todayIso()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Backup downloaded");
  }

  function exportCalendar() {
    const ics = lifeToIcs(clients, animals, tasks);
    downloadIcs(`life-os-${todayIso()}.ics`, ics);
    toast("Calendar file downloaded");
  }

  async function importFile(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<LifeSnapshot>;
      if (!Array.isArray(parsed.clients) || !Array.isArray(parsed.animals) || !Array.isArray(parsed.tasks)) {
        throw new Error("That file is not a Life OS backup.");
      }
      const res = await askConfirm({
        title: "Replace everything with this backup?",
        body: "This overwrites the live tracker and syncs to every device. Undo can still reverse it on this phone until you leave.",
        confirmLabel: "Import",
        danger: true,
      });
      if (!res.ok) return;
      replaceAll(
        {
          clients: parsed.clients,
          animals: parsed.animals,
          tasks: parsed.tasks,
          coachDismissed: Boolean(parsed.coachDismissed),
        },
        "Import backup",
      );
      toast("Backup imported — syncing");
      onClose();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  return (
    <SheetFrame title="Settings" subtitle="Synced across devices. This is nicklife.xyz." onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted">
          {clients.length} shops · {animals.length} animals · {tasks.filter((t) => t.status !== "Done").length} open
          tasks.
        </p>
        <p className="text-sm text-muted">On iPhone: Share → Add to Home Screen.</p>
        <Button className="w-full" onClick={exportJson}>
          Download backup
        </Button>
        <Button variant="secondary" className="w-full" onClick={exportCalendar}>
          Export calendar (.ics)
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => fileRef.current?.click()}>
          Import backup
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importFile(f);
            e.currentTarget.value = "";
          }}
        />
        <Link
          href="/clients"
          className="flex h-11 w-full items-center justify-center rounded-md border border-border bg-surface2 text-sm font-medium text-fg"
        >
          Spreadsheet view
        </Link>
        <form action={logoutAction}>
          <Button variant="secondary" className="w-full" type="submit">
            Log out
          </Button>
        </form>
        {msg ? <p className="text-sm text-overdue">{msg}</p> : null}
      </div>
    </SheetFrame>
  );
}
