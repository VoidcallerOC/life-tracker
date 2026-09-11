import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { Tracker } from "@/components/clients/tracker";
import { BackfillPaidDatesNotice } from "@/components/clients/backfill-paid-dates";
import { toLegacy } from "@/lib/clients/adapter";
import { listClients } from "@/lib/db/repository";
import { databaseConfigured } from "@/lib/db/client";
import { currentSession } from "@/lib/session";
import { SetupNotice } from "@/components/setup-notice";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  if (!(await currentSession())) redirect("/login");
  if (!databaseConfigured()) return <SetupNotice />;

  const clients = (await listClients()).map(toLegacy);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[420px] px-4 pb-8 pt-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            Forge · Life OS
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-muted">
            Bulk edits. Every change is saved on its own row.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link
            href="/"
            className="h-12 inline-flex items-center rounded-xl border border-border px-3 text-sm text-muted hover:text-text"
          >
            ← Life OS
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="h-9 rounded-lg border border-border px-3 text-xs text-muted hover:text-text"
            >
              Log out
            </button>
          </form>
        </div>
      </header>
      <div className="mt-3">
        <BackfillPaidDatesNotice clients={clients} />
      </div>
      <Tracker clients={clients} />
    </main>
  );
}
