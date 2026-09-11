"use client";

import * as React from "react";
import { cn } from "@/lib/os/cn";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-xs font-medium uppercase tracking-wide text-muted mb-1.5", className)}
      {...props}
    />
  );
}
