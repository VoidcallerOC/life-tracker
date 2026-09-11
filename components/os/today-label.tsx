"use client";

import { useEffect, useState } from "react";
import { formatLongDate } from "@/lib/os/dates";

/**
 * The date is rendered only after mount.
 *
 * Server-rendering it produced a hydration mismatch whenever the server's clock
 * (UTC) and the phone's timezone disagreed about the day — which, for an
 * evening in the US, is most of the time.
 */
export function TodayLabel({ suffix }: { suffix?: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(formatLongDate());
  }, []);

  return (
    <>
      {label ?? " "}
      {label && suffix ? suffix : null}
    </>
  );
}
