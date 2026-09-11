import type { Client as DomainClient } from "@/lib/os/types";
import { emptyClient as emptyDomainClient } from "@/lib/os/types";
import type { Client as LegacyClient } from "@/lib/clients/types";

/**
 * The `/clients` spreadsheet view keeps its own field names (`client` rather
 * than `name`). Rather than rename them across five components, the shapes are
 * translated at the page boundary — but both views now read and write the same
 * versioned rows, so neither can clobber the other.
 */

export function toLegacy(client: DomainClient): LegacyClient {
  return {
    id: client.id,
    version: client.version,
    client: client.name,
    businessType: client.businessType,
    status: client.status,
    contacted: client.contacted,
    contactName: client.contactName,
    phone: client.phone,
    email: client.email,
    address: client.address,
    quoted: client.quoted,
    deposit: client.deposit,
    paid: client.paid,
    paidDate: client.paidDate,
    githubRepo: client.githubRepo,
    liveUrl: client.liveUrl,
    domain: client.domain,
    nextAction: client.nextAction,
    notes: client.notes,
    lastContacted: client.lastContacted,
    dueDate: client.dueDate,
    snoozeUntil: client.snoozeUntil,
  };
}

export function fromLegacy(client: LegacyClient): DomainClient {
  return {
    ...emptyDomainClient(),
    id: client.id,
    version: client.version ?? 0,
    name: client.client,
    businessType: client.businessType,
    status: client.status,
    contacted: client.contacted,
    contactName: client.contactName,
    phone: client.phone,
    email: client.email,
    address: client.address,
    quoted: client.quoted,
    deposit: client.deposit,
    paid: client.paid,
    paidDate: client.paidDate,
    githubRepo: client.githubRepo,
    liveUrl: client.liveUrl,
    domain: client.domain,
    nextAction: client.nextAction,
    notes: client.notes,
    lastContacted: client.lastContacted,
    dueDate: client.dueDate ?? "",
    snoozeUntil: client.snoozeUntil ?? "",
  };
}
