import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Life OS
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text">Sign in</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        Private tracker for Nick. Use the shared password.
      </p>
      <LoginForm error={params.error === "1"} />
      {params.error === "config" ? (
        <p className="mt-4 text-xs text-overdue">
          AUTH_PASSWORD is not configured on the server.
        </p>
      ) : null}
    </main>
  );
}
