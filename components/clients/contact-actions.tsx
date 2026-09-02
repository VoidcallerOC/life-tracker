import type { Client } from "@/lib/clients/types";

type Action = {
  key: string;
  label: string;
  href: string;
  external?: boolean;
  primary?: boolean;
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
    actions.push({ key: "call", label: "Call", href: `tel:${tel}`, primary: true });
    actions.push({ key: "text", label: "Text", href: `sms:${tel}` });
  }
  const email = (client.email || "").trim();
  if (email) {
    actions.push({ key: "email", label: "Email", href: `mailto:${email}` });
  }
  const address = (client.address || "").trim();
  if (address) {
    actions.push({
      key: "map",
      label: "Map",
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
      external: true,
    });
  }
  const site = websiteHref(client);
  if (site) {
    actions.push({ key: "site", label: "Website", href: site, external: true });
  }
  return actions;
}

export function ContactActions({
  client,
  compact = false,
  className,
}: {
  client: Client;
  compact?: boolean;
  className?: string;
}) {
  const actions = buildContactActions(client);
  if (actions.length === 0) return null;

  const base = compact
    ? "inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold"
    : "inline-flex h-11 flex-1 items-center justify-center rounded-xl px-3 text-sm font-semibold";
  const wrap = compact ? "flex flex-wrap gap-1.5" : "flex flex-wrap gap-2";

  return (
    <div className={className ? `${wrap} ${className}` : wrap}>
      {actions.map((a) => (
        <a
          key={a.key}
          href={a.href}
          {...(a.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          onClick={(e) => e.stopPropagation()}
          className={`${base} ${
            a.primary
              ? "bg-emerald-400 text-zinc-950"
              : "border border-zinc-700 bg-zinc-900 text-zinc-100"
          }`}
        >
          {a.label}
        </a>
      ))}
    </div>
  );
}
