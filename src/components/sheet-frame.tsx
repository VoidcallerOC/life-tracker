import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SheetFrame({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-bg/70" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-xl sm:rounded-xl border border-border bg-surface shadow-soft"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-xl text-fg">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
          </div>
          <Button variant="ghost" size="icon" className="size-10 shrink-0" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <footer className="border-t border-border px-5 py-4">{footer}</footer> : null}
      </div>
    </div>
  );
}
