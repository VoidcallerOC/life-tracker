"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/os/cn";
import {
  EMPTY_WEEK_PIN,
  isWeekPinEmpty,
  normalizeWeekPin,
  type PinTone,
  type WeekPin as WeekPinData,
} from "@/lib/os/priorities";
import { WeekPinSheet } from "@/components/os/week-pin-sheet";

const TONE: Record<PinTone, string> = {
  overdue: "border-overdue/40 bg-overdue/10 text-overdue",
  soon: "border-soon/40 bg-soon/10 text-soon",
  later: "border-later/40 bg-later/10 text-later",
};

/**
 * The week's focus, loaded from settings rather than compiled in. Renders
 * nothing until loaded so an empty pin does not flash an empty card.
 */
export function WeekPin() {
  const [pin, setPin] = useState<WeekPinData | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings?key=weekPin", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!cancelled) setPin(normalizeWeekPin(body?.value));
      })
      .catch(() => {
        if (!cancelled) setPin(EMPTY_WEEK_PIN);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (pin === null) return null;

  if (isWeekPinEmpty(pin)) {
    return (
      <>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full rounded-xl border border-dashed border-border p-4 text-left text-sm text-muted"
        >
          Pin what must not slip this week →
        </button>
        {editing ? (
          <WeekPinSheet
            pin={pin}
            onClose={() => setEditing(false)}
            onSaved={(next) => setPin(next)}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight text-fg">
            This week — do not skip
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {pin.weekOf ? <span className="text-xs text-muted">{pin.weekOf}</span> : null}
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Edit the week pin"
              className="text-muted hover:text-fg"
            >
              <Pencil className="size-4" />
            </button>
          </div>
        </div>
        {pin.intro ? <p className="mt-1 text-sm text-muted">{pin.intro}</p> : null}
        <ol className="mt-3 space-y-2">
          {pin.items.map((item, i) => (
            <li key={item.id} className="rounded-lg border border-border bg-surface2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-fg">
                    {i + 1}. {item.title}
                  </div>
                  {item.detail ? <p className="mt-1 text-sm text-muted">{item.detail}</p> : null}
                </div>
                {item.when ? (
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                      TONE[item.tone],
                    )}
                  >
                    {item.when}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>
      {editing ? (
        <WeekPinSheet pin={pin} onClose={() => setEditing(false)} onSaved={(next) => setPin(next)} />
      ) : null}
    </>
  );
}
