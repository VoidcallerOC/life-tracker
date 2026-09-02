"use client";

import { useFormStatus } from "react-dom";
import { loginAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-accent text-base font-semibold text-bg active:scale-[0.99] disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm({ error }: { error: boolean }) {
  return (
    <form action={loginAction} className="mt-8">
      <label htmlFor="password" className="block text-sm font-medium text-text">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        autoFocus
        className="mt-2 h-12 w-full rounded-xl border border-border bg-panel px-4 text-base text-text outline-none focus:ring-2 focus:ring-accent/40 placeholder:text-muted"
        placeholder="Shared password"
      />
      {error ? (
        <p className="mt-3 text-sm text-overdue">Wrong password. Try again.</p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
