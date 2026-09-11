import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unlockWith } from "@/lib/lock";

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const ok = await unlockWith(value);
    setBusy(false);
    if (!ok) {
      setError(true);
      return;
    }
    onUnlock();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-5 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <form onSubmit={submit} className="w-full max-w-sm">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">Private</p>
        <h1 className="mt-2 font-display text-4xl text-fg">Life OS</h1>
        <p className="mt-2 text-sm text-muted">Private tracker for Nick. Shared password, then Do Now.</p>
        <div className="mt-8">
          <Label htmlFor="gate">Password</Label>
          <Input
            ref={inputRef}
            id="gate"
            type="password"
            autoComplete="current-password"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
            placeholder="Shared password"
          />
        </div>
        {error ? <p className="mt-3 text-sm text-overdue">Wrong password. Try again.</p> : null}
        <Button type="submit" className="mt-5 w-full" disabled={busy || !value.trim()}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
