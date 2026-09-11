"use client";

import { useEffect } from "react";

/**
 * Without this, a single render error is a white screen on a phone with no way
 * back. Reset re-renders the segment; reload is the escape hatch when the error
 * came from bad cached state.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Life OS crashed", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-overdue">Something broke</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">The app hit an error</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Your data is safe on the server — this is a display problem, not a lost save.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 space-y-2">
        <button
          type="button"
          onClick={reset}
          className="h-12 w-full rounded-xl bg-accent text-base font-semibold text-bg active:scale-[0.99]"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-12 w-full rounded-xl border border-border text-base font-medium text-muted"
        >
          Reload the app
        </button>
      </div>
    </main>
  );
}
