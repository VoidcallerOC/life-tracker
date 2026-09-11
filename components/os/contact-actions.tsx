"use client";

import { ExternalLink, Mail, MapPin, MessageSquare, Phone } from "lucide-react";
import type { Client } from "@/lib/os/types";
import { cn } from "@/lib/os/cn";

type Action = {
  key: string;
  label: string;
  href: string;
  external?: boolean;
  primary?: boolean;
  icon: typeof Phone;
};

function websiteHref(client: Client): string | null {
  const raw =
    (client.liveUrl && client.liveUrl.trim()) ||
    (client.domain && client.domain.trim() ? `https://${client.domain.trim()}` : "");
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function telDigits(phone: string): string {
  return (phone || "").replace(/[^\d+]/g, "");
}

export function buildContactActions(client: Client): Action[] {
  const actions: Action[] = [];
  const tel = telDigits(client.phone);
  if (tel) {
    actions.push({ key: "call", label: "Call", href: `tel:${tel}`, primary: true, icon: Phone });
    actions.push({ key: "text", label: "Text", href: `sms:${tel}`, icon: MessageSquare });
  }
  const email = (client.email || "").trim();
  if (email) {
    actions.push({ key: "email", label: "Email", href: `mailto:${email}`, icon: Mail });
  }
  const address = (client.address || "").trim();
  if (address) {
    actions.push({
      key: "map",
      label: "Map",
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
      external: true,
      icon: MapPin,
    });
  }
  const site = websiteHref(client);
  if (site) {
    actions.push({ key: "site", label: "Site", href: site, external: true, icon: ExternalLink });
  }
  return actions;
}

export function ContactActions({
  client,
  compact = false,
}: {
  client: Client;
  compact?: boolean;
}) {
  const actions = buildContactActions(client);
  if (actions.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap", compact ? "gap-1.5" : "gap-2")}>
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <a
            key={a.key}
            href={a.href}
            {...(a.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 font-medium",
              compact ? "h-9 rounded-sm px-3 text-xs" : "h-11 flex-1 rounded-md px-3 text-sm",
              a.primary
                ? "bg-accent text-accent-fg"
                : "border border-border bg-surface2 text-fg",
            )}
          >
            <Icon className="size-4" />
            {a.label}
          </a>
        );
      })}
    </div>
  );
}
