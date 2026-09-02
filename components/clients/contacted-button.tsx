"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setContacted } from "@/app/clients/actions";

export function ContactedButton({
  id,
  contacted,
  onContactedChange,
}: {
  id: string;
  contacted: boolean;
  onContactedChange?: (contacted: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState(false);

  function handleClick() {
    if (isPending) return;

    const next = !contacted;
    setSaveError(false);
    onContactedChange?.(next);
    startTransition(async () => {
      const saved = await setContacted(id, next);
      if (saved) {
        router.refresh();
      } else {
        onContactedChange?.(contacted);
        setSaveError(true);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          handleClick();
        }}
        disabled={isPending}
        aria-pressed={contacted}
        aria-label={contacted ? "Mark client as not contacted" : "Mark client as contacted"}
        className={`inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold transition-transform active:scale-95 disabled:cursor-wait disabled:opacity-60 ${
          contacted
            ? "bg-violet-400 text-zinc-950"
            : "border border-violet-400/40 bg-violet-400/10 text-violet-200"
        }`}
      >
        {isPending ? "Saving…" : "Contacted"}
      </button>
      {saveError ? (
        <span className="text-[10px] text-rose-300">Couldn’t save</span>
      ) : null}
    </div>
  );
}
