"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SheetFrame } from "@/components/os/sheet-frame";
import { Button } from "@/components/os/ui/button";
import { Input } from "@/components/os/ui/input";
import { Label } from "@/components/os/ui/label";
import { Textarea } from "@/components/os/ui/textarea";
import { cn } from "@/lib/os/cn";
import { normalizeWeekPin, type PinTone, type WeekPin } from "@/lib/os/priorities";
import { rid } from "@/lib/os/types";

const TONES: { value: PinTone; label: string }[] = [
  { value: "overdue", label: "Overdue" },
  { value: "soon", label: "Soon" },
  { value: "later", label: "Later" },
];

/** Edits the week pin in the app, replacing what used to need a code change. */
export function WeekPinSheet({
  pin,
  onClose,
  onSaved,
}: {
  pin: WeekPin;
  onClose: () => void;
  onSaved: (pin: WeekPin) => void;
}) {
  const [draft, setDraft] = useState<WeekPin>(pin);
  const [saving, setSaving] = useState(false);

  function patchItem(id: string, patch: Partial<WeekPin["items"][number]>) {
    setDraft((d) => ({
      ...d,
      items: d.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  async function save() {
    setSaving(true);
    try {
      const cleaned = normalizeWeekPin({
        ...draft,
        items: draft.items.filter((item) => item.title.trim()),
      });
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ key: "weekPin", value: cleaned }),
      });
      if (!response.ok) throw new Error(`Save failed (${response.status})`);
      onSaved(cleaned);
      toast("Week pin updated");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the week pin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SheetFrame
      title="This week"
      subtitle="The short list that stays on top of Do Now."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="weekOf">Week of</Label>
          <Input
            id="weekOf"
            value={draft.weekOf}
            placeholder="Week of Sep 8"
            onChange={(e) => setDraft({ ...draft, weekOf: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="intro">The point of this week</Label>
          <Textarea
            id="intro"
            rows={2}
            value={draft.intro}
            placeholder="What must not slip."
            onChange={(e) => setDraft({ ...draft, intro: e.target.value })}
          />
        </div>

        <div className="space-y-3">
          {draft.items.map((item, index) => (
            <div key={item.id} className="rounded-lg border border-border bg-surface2 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted">Pin {index + 1}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove pin ${index + 1}`}
                  onClick={() =>
                    setDraft({ ...draft, items: draft.items.filter((i) => i.id !== item.id) })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <Input
                className="mt-2"
                value={item.title}
                placeholder="What to do"
                onChange={(e) => patchItem(item.id, { title: e.target.value })}
              />
              <Textarea
                className="mt-2"
                rows={2}
                value={item.detail}
                placeholder="Detail worth remembering"
                onChange={(e) => patchItem(item.id, { detail: e.target.value })}
              />
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={item.when}
                  placeholder="When"
                  onChange={(e) => patchItem(item.id, { when: e.target.value })}
                />
                <div className="flex shrink-0 gap-1">
                  {TONES.map((tone) => (
                    <button
                      key={tone.value}
                      type="button"
                      onClick={() => patchItem(item.id, { tone: tone.value })}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-xs font-medium",
                        item.tone === tone.value
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-muted",
                      )}
                    >
                      {tone.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {draft.items.length < 10 ? (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() =>
              setDraft({
                ...draft,
                items: [
                  ...draft.items,
                  { id: rid(), title: "", detail: "", when: "", tone: "later" },
                ],
              })
            }
          >
            <Plus className="size-4" />
            Add a pin
          </Button>
        ) : null}
      </div>
    </SheetFrame>
  );
}
