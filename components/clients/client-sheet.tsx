"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteClient } from "@/app/clients/actions";
import { STATUSES, type Client } from "@/lib/clients/types";
import { ContactActions } from "./contact-actions";

function moneyValue(n: number | null): string {
  return n == null ? "" : String(n);
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
  inputMode,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-1.5 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-base text-zinc-50 outline-none focus:border-emerald-400/60"
      />
    </label>
  );
}

export function ClientSheet({
  mode,
  client,
  onClose,
  onSaved,
}: {
  mode: "edit" | "create";
  client?: Client;
  onClose: () => void;
  onSaved?: (client: Client) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      const payload = Object.fromEntries(formData.entries());
      const endpoint = mode === "edit" ? "/api/clients" : "/api/clients/create";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { ok: boolean; client?: Client; error?: string };
      if (!res.ok || !json.ok || !json.client) {
        setError(json.error || `Save failed (${res.status})`);
        return;
      }
      onSaved?.(json.client);
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <button type="button" onClick={onClose} className="h-11 rounded-xl px-3 text-sm text-zinc-400">
          Close
        </button>
        <h2 className="text-base font-semibold">{mode === "edit" ? "Client" : "Add client"}</h2>
        <span className="w-14" />
      </div>
      <form action={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        {mode === "edit" && client ? <input type="hidden" name="id" value={client.id} /> : null}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6">
          {mode === "edit" && client ? <ContactActions client={client} /> : null}
          <Field label="Client" name="client" defaultValue={client?.client} placeholder="Business name" />
          <Field
            label="Business type"
            name="businessType"
            defaultValue={client?.businessType}
            placeholder="TCG / collectibles retail"
          />
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Status</span>
            <select
              name="status"
              defaultValue={client?.status ?? "Potential"}
              className="mt-1.5 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-base text-zinc-50 outline-none"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Next action"
            name="nextAction"
            defaultValue={client?.nextAction}
            placeholder="$35/mo care plan + referral ask"
          />
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Notes</span>
            <textarea
              name="notes"
              defaultValue={client?.notes}
              rows={4}
              className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-base text-zinc-50 outline-none focus:border-emerald-400/60"
            />
          </label>
          <Field label="Last contacted" name="lastContacted" type="date" defaultValue={client?.lastContacted} />
          <Field label="Contact name" name="contactName" defaultValue={client?.contactName} />
          <Field label="Phone" name="phone" defaultValue={client?.phone} type="tel" inputMode="tel" />
          <Field label="Email" name="email" defaultValue={client?.email} type="email" inputMode="email" />
          <Field label="Address" name="address" defaultValue={client?.address} placeholder="123 Main St, Town, CT" />
          <div className="grid grid-cols-3 gap-2">
            <Field label="Quoted" name="quoted" defaultValue={moneyValue(client?.quoted ?? null)} inputMode="decimal" placeholder="$" />
            <Field label="Deposit" name="deposit" defaultValue={moneyValue(client?.deposit ?? null)} inputMode="decimal" placeholder="$" />
            <Field label="Paid" name="paid" defaultValue={moneyValue(client?.paid ?? null)} inputMode="decimal" placeholder="$" />
          </div>
          <Field label="Paid date" name="paidDate" type="date" defaultValue={client?.paidDate} />
          <Field label="GitHub repo" name="githubRepo" defaultValue={client?.githubRepo} placeholder="VoidcallerOC/repo" />
          <Field label="Live URL" name="liveUrl" defaultValue={client?.liveUrl} placeholder="https://" inputMode="url" />
          <Field label="Domain" name="domain" defaultValue={client?.domain} />
        </div>
        <div className="border-t border-zinc-800 px-4 py-3 space-y-2">
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          <div className="flex gap-2">
            {mode === "edit" && client ? (
              <button
                type="button"
                className="h-12 rounded-xl border border-zinc-800 px-4 text-sm text-rose-400"
                onClick={async () => {
                  if (!confirm("Delete this client?")) return;
                  const result = await deleteClient(client.id);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  router.refresh();
                  onClose();
                }}
              >
                Delete
              </button>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="h-12 flex-1 rounded-xl bg-emerald-400 text-base font-semibold text-zinc-950 disabled:opacity-60"
            >
              {pending ? "Saving…" : mode === "edit" ? "Save" : "Add client"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
