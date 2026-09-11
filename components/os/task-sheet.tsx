"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SheetFrame } from "@/components/os/sheet-frame";
import { Button } from "@/components/os/ui/button";
import { Input } from "@/components/os/ui/input";
import { Textarea } from "@/components/os/ui/textarea";
import { Label } from "@/components/os/ui/label";
import { askConfirm } from "@/components/os/confirm-gate";
import { useLifeStore } from "@/lib/os/store";
import type { Priority, Task } from "@/lib/os/types";
import { emptyTask } from "@/lib/os/types";
import { taskDeadlineError, taskTitleError } from "@/lib/os/guardrails";
import { todayIso } from "@/lib/os/dates";

export function TaskSheet({
  task,
  lane,
  onClose,
}: {
  task: Task | null;
  lane: "content" | "personal";
  onClose: () => void;
}) {
  const creating = task == null;
  const addTask = useLifeStore((s) => s.addTask);
  const updateTask = useLifeStore((s) => s.updateTask);
  const deleteTask = useLifeStore((s) => s.deleteTask);
  const [draft, setDraft] = useState(() =>
    task ? { ...task } : { ...emptyTask(lane), deadline: todayIso() },
  );
  const [error, setError] = useState<string | null>(null);

  function patch<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setError(null);
  }

  function save() {
    const t = taskTitleError(draft.title);
    const d = taskDeadlineError(draft.deadline);
    const err = t ?? d;
    if (err) {
      setError(err);
      return;
    }
    if (creating) {
      addTask({ ...draft, lane });
      toast(`Added ${draft.title.trim()}`);
    } else if (task) {
      updateTask(task.id, draft);
      toast(`Saved ${draft.title.trim()}`);
    }
    onClose();
  }

  async function remove() {
    if (!task) return;
    const res = await askConfirm({
      title: `Delete “${task.title}”?`,
      body: "Type the task name.",
      confirmLabel: "Delete",
      danger: true,
      kind: "type-name",
      expectedName: task.title,
    });
    if (!res.ok) return;
    deleteTask(task.id);
    toast("Deleted task");
    onClose();
  }

  const priorities: Priority[] = ["High", "Medium", "Low"];

  return (
    <SheetFrame
      title={creating ? (lane === "content" ? "New content" : "New task") : task.title}
      subtitle="A date is required. Undated work is how things vanish."
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {error ? <p className="text-sm text-overdue">{error}</p> : null}
          <div className="flex gap-2">
            {!creating ? (
              <Button variant="danger" onClick={remove}>
                Delete
              </Button>
            ) : null}
            <Button className="flex-1" onClick={save}>
              {creating ? "Add" : "Save"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="t-title">Task</Label>
          <Input id="t-title" value={draft.title} onChange={(e) => patch("title", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="t-due">Deadline</Label>
          <Input id="t-due" type="date" value={draft.deadline} onChange={(e) => patch("deadline", e.target.value)} />
        </div>
        <div>
          <Label>Priority</Label>
          <div className="flex gap-2">
            {priorities.map((p) => (
              <Button
                key={p}
                variant={draft.priority === p ? "primary" : "secondary"}
                size="sm"
                onClick={() => patch("priority", p)}
              >
                {p}
              </Button>
            ))}
          </div>
        </div>
        {lane === "content" ? (
          <div>
            <Label htmlFor="t-plat">Platform</Label>
            <Input id="t-plat" value={draft.platform} onChange={(e) => patch("platform", e.target.value)} />
          </div>
        ) : (
          <div>
            <Label htmlFor="t-cat">Category</Label>
            <Input id="t-cat" value={draft.category} onChange={(e) => patch("category", e.target.value)} />
          </div>
        )}
        <div>
          <Label htmlFor="t-notes">Notes</Label>
          <Textarea id="t-notes" value={draft.notes} onChange={(e) => patch("notes", e.target.value)} />
        </div>
      </div>
    </SheetFrame>
  );
}
