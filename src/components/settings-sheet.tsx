import { useRef, useState } from "react";
import { toast } from "sonner";
import { SheetFrame } from "@/components/sheet-frame";
import { Button } from "@/components/ui/button";
import { askConfirm } from "@/components/confirm-gate";
import { useLifeStore } from "@/lib/life-store";
import { todayIso } from "@/lib/dates";
import { downloadIcs, lifeToIcs } from "@/lib/ics";
import { lockNow } from "@/lib/lock";
import type { LifeSnapshot } from "@/lib/types";

export function SettingsSheet({
  onClose,
  onLock,
}: {
  onClose: () => void;
  onLock: () => void;
}) {
  const clients = useLifeStore((s) => s.clients);
  const animals = useLifeStore((s) => s.animals);
  const tasks = useLifeStore((s) => s.tasks);
  const coachDismissed = useLifeStore((s) => s.coachDismissed);
  const replaceAll = useLifeStore((s) => s.replaceAll);
  const resetToStarter = useLifeStore((s) => s.resetToStarter);
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
        body: "Your current list is overwritten. Undo can still reverse it.",
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
      toast("Backup imported");
      onClose();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  async function reset() {
    const res = await askConfirm({
      title: "Reset to the starter pack?",
      body: "Type RESET. Export a backup first if you have added real rows.",
      confirmLabel: "Reset",
      danger: true,
      kind: "type-name",
      expectedName: "RESET",
    });
    if (!res.ok) return;
    resetToStarter();
    toast("Restored starter pack");
    onClose();
  }

  function lock() {
    lockNow();
    toast("Locked");
    onLock();
  }

  return (
    <SheetFrame title="Settings" subtitle="Backups live on this device. Export before you experiment." onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-muted">
          {clients.length} shops · {animals.length} animals · {tasks.filter((t) => t.status !== "Done").length} open
          tasks. Saved in this browser.
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
        <Button variant="secondary" className="w-full" onClick={lock}>
          Lock
        </Button>
        <Button variant="danger" className="w-full" onClick={reset}>
          Reset to starter pack
        </Button>
        {msg ? <p className="text-sm text-overdue">{msg}</p> : null}
      </div>
    </SheetFrame>
  );
}
