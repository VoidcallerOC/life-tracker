"use client";

import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/os/ui/button";
import { DeadlinePill } from "@/components/os/ui/badge";
import { useLifeStore } from "@/lib/os/store";
import { bucketFor, bucketLabel, formatShort } from "@/lib/os/dates";

export function AnimalsView({
  onOpen,
  onCreate,
}: {
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const animals = useLifeStore((s) => s.animals);
  const markFed = useLifeStore((s) => s.markFed);
  const markCleaned = useLifeStore((s) => s.markCleaned);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Tap Fed or Cleaned. The next due date is computed for you.</p>
        <Button size="sm" onClick={onCreate}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      {animals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-5 py-10 text-center">
          <h2 className="text-lg font-semibold tracking-tight text-fg">No animals yet</h2>
          <p className="mt-2 text-sm text-muted">
            Add one with a name and a feed interval. You will never type the next care date by hand.
          </p>
          <Button className="mt-5" onClick={onCreate}>
            Add animal
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {animals.map((a) => {
            const bucket = bucketFor(a.nextCareDue);
            return (
              <li key={a.id} className="rounded-xl border border-border bg-surface p-4">
                <button type="button" className="w-full text-left" onClick={() => onOpen(a.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold tracking-tight text-fg">{a.name}</h3>
                      <p className="text-xs text-muted">
                        {[a.species, a.enclosure].filter(Boolean).join(" · ") || "No species set"}
                      </p>
                    </div>
                    <DeadlinePill bucket={bucket} label={bucketLabel(a.nextCareDue)} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
                    <span>Last fed {a.lastFed ? formatShort(a.lastFed) : "never"}</span>
                    <span>Last cleaned {a.lastCleaned ? formatShort(a.lastCleaned) : "never"}</span>
                    <span>Feed every {a.feedEveryDays}d</span>
                    <span>Clean every {a.cleanEveryDays}d</span>
                  </div>
                </button>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => {
                      markFed(a.id);
                      toast(`Fed ${a.name}`);
                    }}
                  >
                    Fed today
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      markCleaned(a.id);
                      toast(`Cleaned ${a.name}`);
                    }}
                  >
                    Cleaned today
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
