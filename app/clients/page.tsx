import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { Tracker } from "@/components/clients/tracker";
import { SyncButton } from "@/components/clients/sync-button";
import { readClients } from "@/lib/clients/storage";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await readClients();
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[420px] px-4 pb-8 pt-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            Front Window · Life OS
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-muted">
            Care plan $35/mo · Potential / Pending / Paid
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link
            href="/"
            className="h-12 inline-flex items-center rounded-xl border border-border px-3 text-sm text-muted hover:text-text"
          >
            ← Life OS
          </Link>
          <div className="flex gap-2">
            <form action={logoutAction}>
              <button
                type="submit"
                className="h-9 rounded-lg border border-border px-3 text-xs text-muted hover:text-text"
              >
                Log out
              </button>
            </form>
            <SyncButton />
          </div>
        </div>
      </header>
      <Tracker clients={clients} />
    </main>
  );
}
