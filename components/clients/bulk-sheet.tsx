"use client";

import { useFormStatus } from "react-dom";
import { bulkAdd } from "@/app/clients/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 flex-1 rounded-xl bg-emerald-400 text-base font-semibold text-zinc-950 disabled:opacity-60"
    >
      {pending ? "Adding…" : "Add to Potential"}
    </button>
  );
}

export function BulkSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-xl px-3 text-sm text-zinc-400"
        >
          Close
        </button>
        <h2 className="text-base font-semibold">Bulk add</h2>
        <span className="w-14" />
      </div>
      <form
        action={async (formData) => {
          await bulkAdd(formData);
          onClose();
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 px-4">
          <p className="text-sm leading-6 text-zinc-400">
            Paste business names, one per line or CSV. They land in Potential.
            First CSV column is the name. Header rows named client/name are skipped.
          </p>
          <textarea
            name="names"
            required
            rows={12}
            placeholder={"Shop A\nShop B\nShop C"}
            className="mt-4 h-[50vh] w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-base text-zinc-50 outline-none focus:border-emerald-400/60"
          />
        </div>
        <div className="flex gap-2 border-t border-zinc-800 px-4 py-3">
          <Submit />
        </div>
      </form>
    </div>
  );
}
