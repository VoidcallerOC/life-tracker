export const dynamic = "force-static";

/** Served by the service worker when a navigation fails with no cached shell. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Life OS</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">You are offline</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Anything you changed while offline is saved on this device and will sync the moment you
        reconnect. Nothing is lost.
      </p>
    </main>
  );
}
