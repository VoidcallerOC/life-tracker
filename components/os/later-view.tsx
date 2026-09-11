"use client";

import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/os/ui/button";
import { DeadlinePill, Pill } from "@/components/os/ui/badge";
import { useLifeStore } from "@/lib/os/store";
import { laterTasks } from "@/lib/os/queue";
import { bucketFor, bucketLabel } from "@/lib/os/dates";
import type { Task } from "@/lib/os/types";

export function LaterView({
  onOpen,
  onCreate,
}: {
  onOpen: (id: string) => void;
  onCreate: (lane: "content" | "personal") => void;
}) {
  const tasks = useLifeStore((s) => s.tasks);
  const completeTask = useLifeStore((s) => s.completeTask);
  const later = laterTasks(tasks);
  const done = tasks.filter((t) => t.status === "Done");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onCreate("personal")}>
          <Plus className="size-4" />
          Personal
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onCreate("content")}>
          <Plus className="size-4" />
          Content
        </Button>
      </div>

      {later.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-5 py-10 text-center">
          <h2 className="text-lg font-semibold tracking-tight text-fg">Nothing waiting</h2>
          <p className="mt-2 text-sm text-muted">
            Anything due today or overdue lives on Do Now. This is the parking lot.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {later.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onOpen={() => onOpen(t.id)}
              onDone={() => {
                completeTask(t.id);
                toast(`Done: ${t.title}`);
              }}
            />
          ))}
        </ul>
      )}

      {done.length > 0 ? (
        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Done</h2>
          <ul className="space-y-2">
            {done.map((t) => (
              <li key={t.id} className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted line-through">
                {t.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function TaskCard({ task, onOpen, onDone }: { task: Task; onOpen: () => void; onDone: () => void }) {
  const bucket = bucketFor(task.deadline);
  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <button type="button" className="w-full text-left" onClick={onOpen}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Pill className="border-border text-muted">
                {task.lane === "content" ? "Content" : "Personal"}
              </Pill>
              {task.priority === "High" ? (
                <span className="text-xs font-medium text-overdue">High</span>
              ) : null}
            </div>
            <h3 className="mt-1 text-base font-semibold tracking-tight text-fg">{task.title}</h3>
          </div>
          <DeadlinePill bucket={bucket} label={bucketLabel(task.deadline)} />
        </div>
        {task.notes ? <p className="mt-2 text-sm text-muted">{task.notes}</p> : null}
      </button>
      <Button className="mt-3 w-full" variant="secondary" onClick={onDone}>
        Mark done
      </Button>
    </li>
  );
}
