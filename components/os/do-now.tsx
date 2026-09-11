"use client";

import { Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/os/ui/button";
import { DeadlinePill } from "@/components/os/ui/badge";
import { WeekPin } from "@/components/os/week-pin";
import { useLifeStore } from "@/lib/os/store";
import { buildQueue, countOverdue, laneLabel } from "@/lib/os/queue";
import { bucketFor, bucketLabel } from "@/lib/os/dates";
import type { QueueItem } from "@/lib/os/types";
import { cn } from "@/lib/os/cn";

export function DoNow({
  onOpenClient,
  onOpenTask,
  onOpenAnimal,
  onGotoForge,
}: {
  onOpenClient: (id: string) => void;
  onOpenTask: (id: string) => void;
  onOpenAnimal: (id: string) => void;
  onGotoForge: () => void;
}) {
  const clients = useLifeStore((s) => s.clients);
  const animals = useLifeStore((s) => s.animals);
  const tasks = useLifeStore((s) => s.tasks);
  const coachDismissed = useLifeStore((s) => s.coachDismissed);
  const dismissCoach = useLifeStore((s) => s.dismissCoach);
  const markFed = useLifeStore((s) => s.markFed);
  const markCleaned = useLifeStore((s) => s.markCleaned);
  const completeTask = useLifeStore((s) => s.completeTask);
  const markContacted = useLifeStore((s) => s.markContacted);
  const clearClientNext = useLifeStore((s) => s.clearClientNext);
  const snoozeClient = useLifeStore((s) => s.snoozeClient);
  const snoozeAnimal = useLifeStore((s) => s.snoozeAnimal);
  const snoozeTask = useLifeStore((s) => s.snoozeTask);

  const queue = buildQueue(clients, animals, tasks);
  const overdue = countOverdue(queue);
  const uncalled = clients.filter((c) => c.status === "Potential" && !c.contacted).length;

  function primary(item: QueueItem) {
    if (item.kind === "animal-care") {
      if (item.primaryLabel === "Fed today") {
        markFed(item.sourceId);
        toast(`Fed ${item.title}`);
      } else {
        markCleaned(item.sourceId);
        toast(`Cleaned ${item.title}`);
      }
      return;
    }
    if (item.kind === "task") {
      completeTask(item.sourceId);
      toast(`Done: ${item.title}`);
      return;
    }
    if (item.kind === "client-missing-next") {
      onOpenClient(item.sourceId);
      return;
    }
    if (item.kind === "client-stale" || item.kind === "client-next") {
      if (item.kind === "client-next" && item.primaryLabel === "Done with this") {
        clearClientNext(item.sourceId);
        toast(`Cleared next action for ${item.title}`);
        return;
      }
      markContacted(item.sourceId);
      toast(`Logged contact: ${item.title}`);
    }
  }

  function snooze(item: QueueItem) {
    if (item.lane === "animals") snoozeAnimal(item.sourceId);
    else if (item.lane === "forge") snoozeClient(item.sourceId);
    else snoozeTask(item.sourceId);
    toast(`Snoozed ${item.title} until tomorrow`);
  }

  function open(item: QueueItem) {
    if (item.lane === "animals") onOpenAnimal(item.sourceId);
    else if (item.lane === "forge") onOpenClient(item.sourceId);
    else onOpenTask(item.sourceId);
  }

  return (
    <div className="space-y-4">
      {!coachDismissed ? (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold tracking-tight text-fg">How not to mess this up</h2>
          <ol className="mt-3 space-y-2 text-sm text-muted">
            <li>1. This list is the truth. If it is not here, it can wait.</li>
            <li>2. Living things go first. Feed before you pitch shops.</li>
            <li>3. Paid needs a dollar amount. Paid clients cannot be deleted.</li>
            <li>4. There is always Undo in the header.</li>
          </ol>
          <Button className="mt-4 w-full" onClick={dismissCoach}>
            Got it
          </Button>
        </section>
      ) : (
        <WeekPin />
      )}

      {overdue > 0 ? (
        <p className="rounded-lg border border-overdue/30 bg-overdue/10 px-3 py-2 text-sm text-overdue">
          {overdue} overdue. Handle these before you add anything new.
        </p>
      ) : null}

      {queue.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-5 py-10 text-center">
          <h2 className="text-lg font-semibold tracking-tight text-fg">Board is clear</h2>
          <p className="mt-2 text-sm text-muted">
            Do not invent work. If you want a shop to call, open Forge.
          </p>
          {uncalled > 0 ? (
            <Button className="mt-5" onClick={onGotoForge}>
              {uncalled} uncalled shops
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3">
          {queue.map((item) => {
            const bucket = bucketFor(item.deadline);
            const late = bucket === "overdue";
            return (
              <li
                key={item.id}
                className={cn(
                  "rounded-xl border bg-surface p-4",
                  late ? "border-overdue/35" : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted">
                      {laneLabel(item.lane)}
                    </div>
                    <h3 className="mt-1 text-base font-semibold leading-snug tracking-tight text-fg">{item.title}</h3>
                  </div>
                  <DeadlinePill bucket={bucket} label={bucketLabel(item.deadline)} />
                </div>
                {item.why ? <p className="mt-2 text-sm text-muted">{item.why}</p> : null}
                <div className="mt-4 flex flex-col gap-2">
                  <Button className="w-full" onClick={() => primary(item)}>
                    {item.primaryLabel}
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={() => snooze(item)}>
                      Snooze 1 day
                    </Button>
                    <Button variant="secondary" className="flex-1" onClick={() => open(item)}>
                      Open
                    </Button>
                    {item.phone ? (
                      <a
                        href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface2 text-fg"
                        aria-label={`Call ${item.title}`}
                      >
                        <Phone className="size-4" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
