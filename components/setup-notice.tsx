/**
 * Shown when the app is deployed without a database. Previously a missing
 * storage backend produced a blank screen or a silent no-op save; now it says
 * exactly what is missing and what to run.
 */
export function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col justify-center px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Life OS</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Database not connected</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        <code className="rounded bg-surface2 px-1.5 py-0.5">DATABASE_URL</code> is not set, so there
        is nowhere to read or write records. Nothing is lost — this deployment simply is not pointed
        at a database yet.
      </p>
      <ol className="mt-5 space-y-3 text-sm leading-6 text-muted">
        <li>
          <span className="font-medium text-fg">1.</span> Create a Postgres database (Supabase, Neon
          and Vercel Postgres all work) and copy its connection string.
        </li>
        <li>
          <span className="font-medium text-fg">2.</span> Set{" "}
          <code className="rounded bg-surface2 px-1.5 py-0.5">DATABASE_URL</code> in the deployment
          environment.
        </li>
        <li>
          <span className="font-medium text-fg">3.</span> Run{" "}
          <code className="rounded bg-surface2 px-1.5 py-0.5">npm run db:migrate</code>, then{" "}
          <code className="rounded bg-surface2 px-1.5 py-0.5">
            npm run db:import -- --apply
          </code>{" "}
          to bring the old Blob data across.
        </li>
      </ol>
    </main>
  );
}
