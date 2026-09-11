"use client";

import * as React from "react";
import { cn } from "@/lib/os/cn";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-24 w-full rounded-md border border-border bg-surface2 px-3 py-2 text-base text-fg placeholder:text-subtle",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
