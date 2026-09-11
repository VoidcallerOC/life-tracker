"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SheetFrame } from "@/components/os/sheet-frame";
import { Button } from "@/components/os/ui/button";
import { Input } from "@/components/os/ui/input";
import { Textarea } from "@/components/os/ui/textarea";
import { Label } from "@/components/os/ui/label";
import { useLifeStore } from "@/lib/os/store";
import type { Animal } from "@/lib/os/types";
import { emptyAnimal } from "@/lib/os/types";
import { animalNameError } from "@/lib/os/guardrails";

export function AnimalSheet({
  animal,
  onClose,
}: {
  animal: Animal | null;
  onClose: () => void;
}) {
  const creating = animal == null;
  const addAnimal = useLifeStore((s) => s.addAnimal);
  const updateAnimal = useLifeStore((s) => s.updateAnimal);
  const deleteAnimal = useLifeStore((s) => s.deleteAnimal);
  const [draft, setDraft] = useState<Omit<Animal, "id">>(() =>
    animal ? { ...animal } : emptyAnimal(),
  );
  const [error, setError] = useState<string | null>(null);

  function patch<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setError(null);
  }

  function save() {
    const err = animalNameError(draft.name);
    if (err) {
      setError(err);
      return;
    }
    if (creating) {
      addAnimal(draft);
      toast(`Added ${draft.name.trim()}`);
    } else if (animal) {
      updateAnimal(animal.id, draft);
      toast(`Saved ${draft.name.trim()}`);
    }
    onClose();
  }

  function remove() {
    if (!animal) return;
    deleteAnimal(animal.id);
    toast(`Removed ${animal.name}`, {
      action: {
        label: "Undo",
        onClick: () => {
          const label = useLifeStore.getState().undo();
          if (label) toast(`Undid: ${label}`);
        },
      },
    });
    onClose();
  }

  return (
    <SheetFrame
      title={creating ? "New animal" : animal.name}
      subtitle="Feed and clean intervals set the due date. You never type the next date by hand."
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {error ? <p className="text-sm text-overdue">{error}</p> : null}
          <div className="flex gap-2">
            {!creating ? (
              <Button variant="danger" onClick={remove}>
                Remove
              </Button>
            ) : null}
            <Button className="flex-1" onClick={save}>
              {creating ? "Add animal" : "Save"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="a-name">Name</Label>
          <Input id="a-name" value={draft.name} onChange={(e) => patch("name", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="a-species">Species</Label>
            <Input id="a-species" value={draft.species} onChange={(e) => patch("species", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="a-enc">Enclosure</Label>
            <Input id="a-enc" value={draft.enclosure} onChange={(e) => patch("enclosure", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="a-feed">Feed every (days)</Label>
            <Input
              id="a-feed"
              inputMode="numeric"
              value={String(draft.feedEveryDays)}
              onChange={(e) => patch("feedEveryDays", Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div>
            <Label htmlFor="a-clean">Clean every (days)</Label>
            <Input
              id="a-clean"
              inputMode="numeric"
              value={String(draft.cleanEveryDays)}
              onChange={(e) => patch("cleanEveryDays", Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="a-notes">Notes</Label>
          <Textarea id="a-notes" value={draft.notes} onChange={(e) => patch("notes", e.target.value)} />
        </div>
      </div>
    </SheetFrame>
  );
}
