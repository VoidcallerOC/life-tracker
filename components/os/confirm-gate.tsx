"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/os/ui/button";
import { Input } from "@/components/os/ui/input";
import { Textarea } from "@/components/os/ui/textarea";
import { Label } from "@/components/os/ui/label";
import { namesMatch } from "@/lib/os/guardrails";
import { parseMoney } from "@/lib/os/money";

export type ConfirmKind = "simple" | "type-name" | "amount" | "reason";

export type ConfirmRequest = {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  kind?: ConfirmKind;
  expectedName?: string;
};

type Result = { ok: true; amount?: number; reason?: string } | { ok: false };

let resolver: ((r: Result) => void) | null = null;
let setGate: ((req: ConfirmRequest | null) => void) | null = null;

export function askConfirm(req: ConfirmRequest): Promise<Result> {
  return new Promise((resolve) => {
    resolver = resolve;
    setGate?.(req);
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  const [typed, setTyped] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    setGate = setReq;
    return () => {
      setGate = null;
    };
  }, []);

  useEffect(() => {
    setTyped("");
    setAmount("");
    setReason("");
  }, [req]);

  if (!req) return null;

  const kind = req.kind ?? "simple";
  const ready =
    kind === "simple"
      ? true
      : kind === "type-name"
        ? namesMatch(typed, req.expectedName ?? "")
        : kind === "amount"
          ? parseMoney(amount) != null && (parseMoney(amount) ?? 0) > 0
          : reason.trim().length >= 3;

  function close(result: Result) {
    resolver?.(result);
    resolver = null;
    setReq(null);
  }

  function confirm() {
    if (!ready) return;
    if (kind === "amount") close({ ok: true, amount: parseMoney(amount) ?? 0 });
    else if (kind === "reason") close({ ok: true, reason: reason.trim() });
    else close({ ok: true });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-3">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70"
        aria-label="Cancel"
        onClick={() => close({ ok: false })}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-soft"
      >
        <h2 id="confirm-title" className="text-lg font-semibold tracking-tight text-fg">
          {req.title}
        </h2>
        <p className="mt-2 text-sm text-muted">{req.body}</p>

        {kind === "type-name" && (
          <div className="mt-4">
            <Label htmlFor="confirm-name">Type {req.expectedName} to confirm</Label>
            <Input
              id="confirm-name"
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={req.expectedName}
            />
          </div>
        )}
        {kind === "amount" && (
          <div className="mt-4">
            <Label htmlFor="confirm-amount">Amount in dollars</Label>
            <Input
              id="confirm-amount"
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="200"
            />
          </div>
        )}
        {kind === "reason" && (
          <div className="mt-4">
            <Label htmlFor="confirm-reason">Why</Label>
            <Textarea
              id="confirm-reason"
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Declined / went with someone else / paused"
            />
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => close({ ok: false })}>
            Cancel
          </Button>
          <Button
            variant={req.danger ? "danger" : "primary"}
            className="flex-1"
            disabled={!ready}
            onClick={confirm}
          >
            {req.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
